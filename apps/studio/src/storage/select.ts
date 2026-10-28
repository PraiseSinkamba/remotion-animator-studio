/**
 * Choosing the backend that serves the storage port.
 *
 * The order is SQLite (durable) → localStorage (durable, smaller) → memory
 * (not durable). When the durable backend cannot run, the app keeps working
 * on a fallback and says so through the repository's status.
 */
import { createLocalStorageRepository } from './local/local-storage-repository';
import { createMemoryRepository } from './local/memory-repository';
import { createSqliteRepository } from './sqlite/client';
import {
  StorageUnavailableError,
  type RepositoryFactory,
  type RepositoryOptions,
  type StorageBackend,
  type StorageProblem,
  type StorageStatus,
  type WorkspaceRepository,
} from './types';

export interface SelectOptions extends RepositoryOptions {
  /** Where the workspace lives. Two backends share data per namespace. */
  namespace?: string;
  /** Forces one backend instead of trying them in order. */
  prefer?: StorageBackend;
  /** Test seam: replaces individual backend factories. */
  backends?: Partial<Record<StorageBackend, RepositoryFactory>>;
}

const DEFAULT_NAMESPACE = 'default';

/**
 * Problems that mean the backend cannot serve the workspace at all.
 *
 * A backend that reports one of these is closed and replaced by a fallback.
 * A read-only workspace owned by another tab is not in this list: it can
 * still be read from.
 */
const UNSERVABLE: StorageProblem[] = ['opfs-unavailable', 'backend-unavailable'];

const errorText = (error: unknown): string =>
  error instanceof Error ? error.message : String(error);

/**
 * True when the browser can host the durable backend at all.
 *
 * Without OPFS the SQLite database cannot be opened, which is a different
 * problem from the database failing to start.
 */
const hasOpfs = (): boolean =>
  typeof navigator !== 'undefined' && typeof navigator.storage?.getDirectory === 'function';

/** True when the browser exposes a usable `localStorage`. */
const hasLocalStorage = (): boolean => {
  try {
    return typeof globalThis.localStorage !== 'undefined';
  } catch {
    // Some privacy modes throw on the lookup itself.
    return false;
  }
};

/**
 * Reports the backend the browser can actually run.
 */
export const chooseBackend = (available: {
  sqlite: boolean;
  localStorage: boolean;
}): StorageBackend => {
  if (available.sqlite) return 'sqlite-opfs';
  if (available.localStorage) return 'local-storage';
  return 'memory';
};

/**
 * Attaches the reason for the fallback to a status.
 *
 * A problem the fallback reports itself (a quota, for instance) is more
 * specific and wins.
 */
const withDegradation = (
  status: StorageStatus,
  degradation: { problem: StorageProblem; detail: string },
): StorageStatus =>
  status.problem
    ? status
    : { ...status, ...degradation };

/**
 * Wraps a fallback repository so it carries the problem that forced the
 * fallback.
 */
const degraded = (
  repo: WorkspaceRepository,
  problem: StorageProblem,
  detail: string,
): WorkspaceRepository => {
  const mark = (status: StorageStatus): StorageStatus =>
    withDegradation(status, { problem, detail });
  return {
    backend: repo.backend,
    init: async () => mark(await repo.init()),
    status: () => mark(repo.status()),
    list: () => repo.list(),
    get: (id) => repo.get(id),
    commit: (input) => repo.commit(input),
    remove: (id) => repo.remove(id),
    close: () => repo.close(),
  };
};

/**
 * Opens the best backend this browser can run.
 *
 * The returned repository is already open; `repo.status()` says which backend
 * it is and, when the durable backend could not run, why.
 */
export const selectRepository = async (
  options?: SelectOptions,
): Promise<WorkspaceRepository> => {
  const namespace = options?.namespace ?? DEFAULT_NAMESPACE;
  const overrides = options?.backends ?? {};
  let degradation: { problem: StorageProblem; detail: string } | undefined;
  const factories: Record<StorageBackend, RepositoryFactory> = {
    'sqlite-opfs': overrides['sqlite-opfs'] ?? createSqliteRepository,
    'local-storage': overrides['local-storage'] ?? createLocalStorageRepository,
    memory: overrides.memory ?? createMemoryRepository,
  };
  const repositoryOptions: RepositoryOptions = {
    // The problem is attached once the fallback is known, so later status
    // changes from the fallback keep it.
    onStatusChange: (status) =>
      options?.onStatusChange?.(degradation ? withDegradation(status, degradation) : status),
  };

  /**
   * Opens a backend and reports whether it can serve.
   *
   * The SQLite client reports an unusable database as a status instead of
   * throwing, so the status has to be read as well.
   */
  const openUsable = async (
    backend: StorageBackend,
  ): Promise<{ repo: WorkspaceRepository } | { cause: string }> => {
    let repo: WorkspaceRepository;
    try {
      repo = await factories[backend](namespace, repositoryOptions);
      await repo.init();
    } catch (error) {
      return { cause: errorText(error) };
    }
    const status = repo.status();
    if (status.problem && UNSERVABLE.includes(status.problem)) {
      await repo.close();
      return { cause: status.detail ?? `The ${backend} backend reported ${status.problem}.` };
    }
    return { repo };
  };

  if (options?.prefer) {
    const backend = options.prefer;
    const opened = await openUsable(backend);
    if ('repo' in opened) return opened.repo;
    throw new StorageUnavailableError(
      `The ${backend} backend could not be opened: ${opened.cause}`,
    );
  }

  let cause: string;
  {
    const opened = await openUsable('sqlite-opfs');
    if ('repo' in opened) return opened.repo;
    cause = opened.cause;
  }

  // Without OPFS the durable backend cannot run at all; that is a different
  // problem from the database failing to start.
  const problem: StorageProblem = hasOpfs() ? 'backend-unavailable' : 'opfs-unavailable';

  let fallback: WorkspaceRepository;
  {
    // The durable backend is gone; try the remaining ones in order.
    const preferred = chooseBackend({ sqlite: false, localStorage: hasLocalStorage() });
    const opened = await openUsable(preferred);
    if ('repo' in opened) {
      fallback = opened.repo;
    } else {
      const last = await openUsable('memory');
      if (!('repo' in last)) {
        throw new StorageUnavailableError(`The workspace could not be opened: ${last.cause}`);
      }
      fallback = last.repo;
    }
  }

  const detail =
    fallback.backend === 'memory'
      ? `The local database could not be opened (${cause}). Projects are kept in memory only and are lost on reload.`
      : `The local database could not be opened (${cause}). Projects are saved in this browser's storage instead.`;

  degradation = { problem, detail };
  const status: StorageStatus = withDegradation(fallback.status(), degradation);
  options?.onStatusChange?.(status);
  return degraded(fallback, problem, detail);
};
