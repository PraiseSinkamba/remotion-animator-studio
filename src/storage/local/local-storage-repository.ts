/**
 * The localStorage backend.
 *
 * One key per namespace holds every project of that namespace with all of
 * its revisions. This is the fallback for browsers where the durable backend
 * cannot run, so it implements the same compare-and-set rules as SQLite:
 * a commit whose `expectedRevision` does not match the stored head writes
 * nothing.
 */
import {
  StorageQuotaError,
  StorageUnavailableError,
  type RepositoryFactory,
} from '../types';
import {
  createRepositoryOverStore,
  isProject,
  type ProjectStore,
  type RevisionRecord,
  type StoreDriver,
} from './memory-repository';

const KEY_PREFIX = 'chart-studio:';

const keyFor = (namespace: string): string => `${KEY_PREFIX}${namespace}`;

/**
 * Reads the whole origin's storage.
 *
 * Touching `localStorage` throws in some privacy modes, so even the lookup
 * has to be guarded.
 */
const storage = (): Storage => {
  try {
    const store = globalThis.localStorage;
    if (!store) throw new Error('localStorage is not available in this environment');
    return store;
  } catch (error) {
    throw new StorageUnavailableError('This browser does not allow local storage.', {
      cause: error,
    });
  }
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Validates what came out of storage and rebuilds the typed store.
 *
 * A corrupted key must not take the app down; it is reported as an
 * unavailable backend so the app can fall back.
 */
const parseStore = (raw: string): ProjectStore => {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new StorageUnavailableError('Stored workspace data is not valid JSON.', {
      cause: error,
    });
  }
  if (!isRecord(parsed) || !isRecord(parsed.projects)) {
    throw new StorageUnavailableError('Stored workspace data has an unexpected shape.');
  }

  const projects: ProjectStore['projects'] = {};
  for (const [id, value] of Object.entries(parsed.projects)) {
    if (!isRecord(value)) {
      throw new StorageUnavailableError(`Stored project "${id}" is corrupted.`);
    }
    const { createdAt, updatedAt, revisions } = value;
    if (typeof createdAt !== 'number' || typeof updatedAt !== 'number') {
      throw new StorageUnavailableError(`Stored project "${id}" is corrupted.`);
    }
    if (!Array.isArray(revisions) || revisions.length === 0) {
      throw new StorageUnavailableError(`Stored project "${id}" is corrupted.`);
    }
    const parsedRevisions: RevisionRecord[] = [];
    for (const revision of revisions) {
      if (
        !isRecord(revision) ||
        typeof revision.revision !== 'number' ||
        typeof revision.name !== 'string' ||
        typeof revision.createdAt !== 'number' ||
        typeof revision.updatedAt !== 'number' ||
        !isProject(revision.document)
      ) {
        throw new StorageUnavailableError(`Stored project "${id}" is corrupted.`);
      }
      parsedRevisions.push({
        revision: revision.revision,
        name: revision.name,
        createdAt: revision.createdAt,
        updatedAt: revision.updatedAt,
        document: revision.document,
      });
    }
    projects[id] = { id, createdAt, updatedAt, revisions: parsedRevisions };
  }
  return { projects };
};

/** Browsers report an exhausted quota in a few different ways. */
const isQuotaError = (error: unknown): boolean => {
  if (typeof error !== 'object' || error === null) return false;
  const { name, code } = error as { name?: unknown; code?: unknown };
  return (
    name === 'QuotaExceededError' ||
    name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
    // Firefox reports the legacy code.
    code === 22
  );
};

const localStorageDriver: StoreDriver = {
  backend: 'local-storage',
  durable: true,

  read: (namespace) => {
    const raw = storage().getItem(keyFor(namespace));
    if (raw === null) return { projects: {} };
    return parseStore(raw);
  },

  write: (namespace, store) => {
    try {
      storage().setItem(keyFor(namespace), JSON.stringify(store));
    } catch (error) {
      if (isQuotaError(error)) {
        throw new StorageQuotaError('This browser has run out of local storage space.', {
          cause: error,
        });
      }
      throw new StorageUnavailableError('This browser refused to store the workspace.', {
        cause: error,
      });
    }
  },
};

/** Creates a repository that keeps the workspace in `localStorage`. */
export const createLocalStorageRepository: RepositoryFactory = async (namespace, options) =>
  createRepositoryOverStore(namespace, localStorageDriver, options);
