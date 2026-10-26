/**
 * The browser-side repository.
 *
 * It owns nothing but the conversation with the worker: it takes the write
 * lock, starts the worker, and forwards the port's calls over RPC.
 *
 * Import-safety: nothing here touches `window`, `navigator` or `Worker` at
 * module scope, so the module can be imported in a Node test.
 */
import {
  StorageError,
  StorageUnavailableError,
  type CommitInput,
  type ProjectSummary,
  type RepositoryFactory,
  type RepositoryOptions,
  type StorageStatus,
  type StoredProject,
  type WorkspaceRepository,
} from '../types';
import {
  fromRpcError,
  isProjectSummaryList,
  isRpcResponse,
  isStorageStatus,
  isStoredProject,
  type RpcMethod,
} from './rpc';

/** One writer per origin; the losers read only. */
const LOCK_NAME = 'chart-studio-workspace';

const sameStatus = (a: StorageStatus, b: StorageStatus): boolean =>
  a.backend === b.backend &&
  a.durable === b.durable &&
  a.writeAccess === b.writeAccess &&
  a.problem === b.problem &&
  a.detail === b.detail;

/**
 * Whether an open failure is worth waiting out.
 *
 * The browser refuses to hand out a second OPFS access handle for a file that
 * one tab still holds. That handle belongs to a tab that is on its way out, so
 * the open succeeds a moment later. Every other failure is final.
 */
export const isTransientOpenError = (message: string): boolean => /access handle/i.test(message);

const blockedRepository = (status: StorageStatus): WorkspaceRepository => ({
  backend: 'sqlite-opfs',
  async init() {
    return status;
  },
  status() {
    return status;
  },
  async list(): Promise<ProjectSummary[]> {
    return [];
  },
  async get(): Promise<StoredProject | null> {
    return null;
  },
  async commit(): Promise<StoredProject> {
    throw new StorageUnavailableError(
      'The workspace is owned by another tab and cannot be written to',
    );
  },
  async remove(): Promise<void> {
    throw new StorageUnavailableError(
      'The workspace is owned by another tab and cannot be written to',
    );
  },
  async close(): Promise<void> {},
});

/**
 * Takes the exclusive workspace lock.
 *
 * A lock that another tab holds is not an error: the caller gets a
 * read-only workspace. A lock API that fails outright is an error, because
 * then nobody knows who owns the database.
 */
const takeWriteLock = async (): Promise<{
  granted: boolean;
  release: () => void;
}> => {
  if (typeof navigator === 'undefined' || !navigator.locks) {
    throw new StorageUnavailableError(
      'This browser cannot coordinate write access to the workspace',
    );
  }
  const hold = Promise.withResolvers<void>();
  const outcome = Promise.withResolvers<boolean>();
  const request = navigator.locks.request(
    LOCK_NAME,
    { mode: 'exclusive', ifAvailable: true },
    async (lock) => {
      if (!lock) {
        outcome.resolve(false);
        return;
      }
      outcome.resolve(true);
      // The lock is held until this promise settles, which happens on close.
      await hold.promise;
    },
  );
  // A failed request must not leave the caller waiting forever.
  void request.catch(() => outcome.resolve(false));
  const granted = await outcome.promise;
  return { granted, release: () => hold.resolve() };
};

/**
 * Creates a repository over the SQLite database in OPFS.
 *
 * The namespace maps to an OPFS directory; the database file inside it is
 * always `workspace.sqlite3`.
 */
export const createSqliteRepository: RepositoryFactory = async (
  namespace: string,
  options?: RepositoryOptions,
): Promise<WorkspaceRepository> => {
  const onStatusChange = options?.onStatusChange;
  const lock = await takeWriteLock();

  if (!lock.granted) {
    const status: StorageStatus = {
      backend: 'sqlite-opfs',
      durable: true,
      writeAccess: 'read-only',
      problem: 'locked-by-other-tab',
    };
    onStatusChange?.(status);
    return blockedRepository(status);
  }

  let status: StorageStatus = {
    backend: 'sqlite-opfs',
    durable: true,
    writeAccess: 'owner',
  };
  const setStatus = (next: StorageStatus): void => {
    if (sameStatus(status, next)) return;
    status = next;
    onStatusChange?.(next);
  };

  const worker = new Worker(new URL('./worker.ts', import.meta.url), {
    type: 'module',
  });

  let nextId = 1;
  const pending = new Map<
    number,
    { resolve: (value: unknown) => void; reject: (reason: unknown) => void }
  >();

  const failAll = (reason: unknown): void => {
    for (const entry of pending.values()) entry.reject(reason);
    pending.clear();
  };

  worker.addEventListener('message', (event: MessageEvent) => {
    const response: unknown = event.data;
    if (!isRpcResponse(response)) return;
    const entry = pending.get(response.id);
    if (!entry) return;
    pending.delete(response.id);
    if (response.ok) {
      entry.resolve(response.value);
    } else {
      entry.reject(fromRpcError(response.error));
    }
  });

  worker.addEventListener('error', (event: ErrorEvent) => {
    const reason = new StorageUnavailableError(
      event.message || 'The database worker failed',
    );
    failAll(reason);
    setStatus({
      backend: 'sqlite-opfs',
      durable: false,
      writeAccess: 'read-only',
      problem: 'backend-unavailable',
      detail: event.message,
    });
  });

  const call = (method: RpcMethod, args: unknown[] = []): Promise<unknown> => {
    const id = nextId++;
    const { promise, resolve, reject } = Promise.withResolvers<unknown>();
    pending.set(id, { resolve, reject });
    worker.postMessage({ id, method, args });
    return promise;
  };

  /**
   * Opens the database, waiting out the previous owner's file handle.
   *
   * A tab that held the workspace releases its OPFS access handle a moment
   * after it goes away. A tab that starts in that window cannot open the
   * file, and falling back to another store would hide the projects that are
   * already in the database — so the open is retried before giving up.
   */
  const openDatabase = async (): Promise<unknown> => {
    const attempts = 5;
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      try {
        return await call('init', [namespace]);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (attempt === attempts || !isTransientOpenError(message)) throw error;
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
    throw new StorageUnavailableError('The database could not be opened');
  };

  let closed = false;
  const guard = (): void => {
    if (closed) {
      throw new StorageUnavailableError('The repository has been closed');
    }
  };

  try {
    const opened = await openDatabase();
    if (!isStorageStatus(opened)) {
      throw new StorageError('The database worker returned an unusable status');
    }
    setStatus({ ...opened, writeAccess: 'owner', durable: true });
  } catch (error) {
    // The database cannot serve the workspace, so the caller must fall back.
    worker.terminate();
    lock.release();
    throw new StorageUnavailableError(
      `The workspace database could not be opened: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }

  return {
    backend: 'sqlite-opfs',

    async init(): Promise<StorageStatus> {
      return status;
    },

    status(): StorageStatus {
      return status;
    },

    async list(): Promise<ProjectSummary[]> {
      guard();
      const value = await call('list');
      if (!isProjectSummaryList(value)) {
        throw new StorageError('The database worker returned an unusable project list');
      }
      return value;
    },

    async get(id: string): Promise<StoredProject | null> {
      guard();
      const value = await call('get', [id]);
      if (value === null) return null;
      if (!isStoredProject(value)) {
        throw new StorageError('The database worker returned an unusable project');
      }
      return value;
    },

    async commit(input: CommitInput): Promise<StoredProject> {
      guard();
      const value = await call('commit', [input]);
      if (!isStoredProject(value)) {
        throw new StorageError('The database worker returned an unusable project');
      }
      return value;
    },

    async remove(id: string): Promise<void> {
      guard();
      await call('remove', [id]);
    },

    async close(): Promise<void> {
      if (closed) return;
      closed = true;
      try {
        await call('close');
      } catch {
        // The worker is going away regardless.
      }
      worker.terminate();
      lock.release();
    },
  };
};
