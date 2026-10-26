/**
 * The storage-agnostic repository engine plus the in-memory backend.
 *
 * The localStorage backend reuses the engine below — only the way the store is
 * read and written differs between the two, so the compare-and-set rules live
 * in one place.
 */
import type { Project } from '../../types';
import {
  StorageConflictError,
  StorageError,
  StorageQuotaError,
  type CommitInput,
  type ProjectSummary,
  type RepositoryFactory,
  type RepositoryOptions,
  type StorageBackend,
  type StorageStatus,
  type WorkspaceRepository,
} from '../types';

/**
 * Checks that a value is a project document.
 *
 * Documents are stored as JSON, so they are data from outside the program
 * once they come back from storage. Every field the port relies on is
 * checked here.
 */
export const isProject = (value: unknown): value is Project => {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<Project>;
  return (
    typeof candidate.name === 'string' &&
    typeof candidate.width === 'number' &&
    typeof candidate.height === 'number' &&
    typeof candidate.fps === 'number' &&
    typeof candidate.durationInFrames === 'number' &&
    typeof candidate.backgroundColor === 'string' &&
    Array.isArray(candidate.tracks) &&
    candidate.tracks.every(
      (track) =>
        typeof track?.id === 'string' &&
        typeof track?.name === 'string' &&
        Array.isArray(track?.clips),
    )
  );
};

/** One committed revision of a project document. */
export interface RevisionRecord {
  revision: number;
  name: string;
  document: Project;
  createdAt: number;
  updatedAt: number;
}

/** A project with every revision it ever had. */
export interface ProjectRecord {
  id: string;
  createdAt: number;
  updatedAt: number;
  revisions: RevisionRecord[];
}

/** Everything one namespace holds. */
export interface ProjectStore {
  projects: Record<string, ProjectRecord>;
}

/** Where a store lives and how it is written. */
export interface StoreDriver {
  backend: StorageBackend;
  /** True when a committed project survives a page reload. */
  durable: boolean;
  /** Reads the current contents; throws `StorageUnavailableError` when unreadable. */
  read(namespace: string): ProjectStore;
  /** Writes the whole store; throws `StorageQuotaError` when the budget is gone. */
  write(namespace: string, store: ProjectStore): void;
}

const emptyStore = (): ProjectStore => ({ projects: {} });

const newId = (): string => {
  const cryptoRef = globalThis.crypto;
  if (cryptoRef && typeof cryptoRef.randomUUID === 'function') return cryptoRef.randomUUID();
  // Fallback for environments without a random UUID source.
  return `p_${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`;
};

/**
 * Builds a repository over a store driver.
 *
 * The engine holds the compare-and-set semantics: a commit whose
 * `expectedRevision` does not match the stored head writes nothing.
 */
export const createRepositoryOverStore = (
  namespace: string,
  driver: StoreDriver,
  options?: RepositoryOptions,
): WorkspaceRepository => {
  let status: StorageStatus = {
    backend: driver.backend,
    durable: driver.durable,
    writeAccess: 'owner',
  };

  const setStatus = (next: StorageStatus) => {
    status = next;
    options?.onStatusChange?.(next);
  };

  const head = (record: ProjectRecord): RevisionRecord =>
    record.revisions[record.revisions.length - 1];

  const summaryOf = (record: ProjectRecord): ProjectSummary => {
    const revision = head(record);
    return {
      id: record.id,
      name: revision.name,
      revision: revision.revision,
      createdAt: record.createdAt,
      updatedAt: revision.updatedAt,
      width: revision.document.width,
      height: revision.document.height,
      fps: revision.document.fps,
      durationInFrames: revision.document.durationInFrames,
    };
  };

  const write = (store: ProjectStore) => {
    try {
      driver.write(namespace, store);
    } catch (error) {
      if (error instanceof StorageQuotaError) {
        setStatus({ ...status, problem: 'quota-exceeded', detail: error.message });
      }
      throw error;
    }
  };

  let closed = false;
  const assertOpen = (): void => {
    if (closed) throw new StorageError('This repository has been closed');
  };

  return {
    backend: driver.backend,

    init: async () => {
      assertOpen();
      // Reading proves the store is reachable before the app trusts it.
      driver.read(namespace);
      return status;
    },

    status: () => status,

    list: async () => {
      assertOpen();
      const store = driver.read(namespace);
      return Object.values(store.projects)
        .map(summaryOf)
        .sort((a, b) => b.updatedAt - a.updatedAt);
    },

    get: async (id: string) => {
      assertOpen();
      const store = driver.read(namespace);
      const record = store.projects[id];
      if (!record) return null;
      const revision = head(record);
      return { ...summaryOf(record), document: revision.document };
    },

    commit: async (input: CommitInput) => {
      assertOpen();
      if (typeof input.name !== 'string' || input.name.length === 0) {
        throw new StorageError('A commit needs a name');
      }
      if (!isProject(input.document)) {
        throw new StorageError('A commit needs a valid project document');
      }
      const store = driver.read(namespace);
      const id = input.id ?? newId();
      const existing = store.projects[id];
      const currentRevision = existing ? head(existing).revision : 0;

      if (input.expectedRevision !== undefined && input.expectedRevision !== currentRevision) {
        throw new StorageConflictError(
          `Project ${id} is at revision ${currentRevision}, not ${input.expectedRevision}.`,
        );
      }

      const now = Date.now();
      const record: ProjectRecord = existing ?? {
        id,
        createdAt: now,
        updatedAt: now,
        revisions: [],
      };
      record.revisions.push({
        revision: currentRevision + 1,
        name: input.name,
        document: input.document,
        createdAt: now,
        updatedAt: now,
      });
      record.updatedAt = now;
      store.projects[id] = record;
      write(store);

      return { ...summaryOf(record), document: input.document };
    },

    remove: async (id: string) => {
      assertOpen();
      const store = driver.read(namespace);
      if (!store.projects[id]) return;
      delete store.projects[id];
      write(store);
    },

    close: async () => {
      // The store outlives the repository on purpose; only the handle closes.
      closed = true;
    },
  };
};

/**
 * Module-level stores, keyed by namespace, so a second repository over the
 * same namespace sees the same data.
 */
const stores = new Map<string, ProjectStore>();

const memoryDriver: StoreDriver = {
  backend: 'memory',
  durable: false,
  read: (namespace) => stores.get(namespace) ?? emptyStore(),
  write: (namespace, store) => {
    stores.set(namespace, store);
  },
};

/** Creates an in-memory repository. Data does not survive a page reload. */
export const createMemoryRepository: RepositoryFactory = async (namespace, options) =>
  createRepositoryOverStore(namespace, memoryDriver, options);

