/**
 * Public entry point of the storage layer.
 *
 * The editor talks to `WorkspaceRepository` and nothing else. The backends
 * below are interchangeable: the app never learns which one it got, and
 * swapping the backend means writing one more implementation of the port.
 *
 * - `selectRepository` picks a backend and opens it.
 * - `createSqliteRepository` is the durable backend: official SQLite WASM in a
 *   dedicated worker, persisted in OPFS.
 * - `createLocalStorageRepository` and `createMemoryRepository` are the
 *   fallbacks for browsers that cannot run the durable backend.
 */
export * from './types';

export { selectRepository, chooseBackend, type SelectOptions } from './select';
export { createSqliteRepository } from './sqlite/client';
export { createLocalStorageRepository } from './local/local-storage-repository';
export { createMemoryRepository } from './local/memory-repository';
