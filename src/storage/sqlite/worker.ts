/**
 * The database worker.
 *
 * It is the only place that owns the database connection: it initialises the
 * SQLite WASM module, installs the OPFS VFS, opens the file, lets the
 * repository apply the migrations, and then answers RPC requests.
 *
 * Nothing here is exported — the client talks to it over `postMessage`.
 */
import sqlite3InitModule from '@sqlite.org/sqlite-wasm';
import { StorageError, StorageUnavailableError } from '../types';
import { createWasmDriver } from './driver';
import { createSqliteRepository } from './repository';
import { isCommitInput, isRpcRequest, toRpcError, type RpcRequest } from './rpc';
import type { WorkspaceRepository } from '../types';

/**
 * The worker's global scope.
 *
 * The DOM lib types `self` as a Window; in a worker it is a
 * DedicatedWorkerGlobalScope, whose `postMessage` has a different signature.
 */
interface WorkerScope {
  postMessage(message: unknown): void;
  addEventListener(
    type: 'message',
    listener: (event: MessageEvent) => void,
  ): void;
}

const scope = self as unknown as WorkerScope;

/** The VFS name; the OPFS directory below it carries the namespace. */
const VFS_NAME = 'opfs-sahpool';

let repository: Promise<WorkspaceRepository> | null = null;
let namespace: string | null = null;

/** Namespaces become directory names in OPFS, so they must be plain. */
const isSafeNamespace = (value: string): boolean => /^[A-Za-z0-9._-]+$/.test(value);

const openRepository = (requestedNamespace: string): Promise<WorkspaceRepository> => {
  if (repository) return repository;
  if (!isSafeNamespace(requestedNamespace)) {
    return Promise.reject(
      new StorageError(`"${requestedNamespace}" is not a usable storage namespace`),
    );
  }
  namespace = requestedNamespace;

  repository = (async () => {
    const sqlite3 = await sqlite3InitModule();
    await sqlite3.installOpfsSAHPoolVfs({
      name: VFS_NAME,
      directory: `/chart-studio/${requestedNamespace}`,
    });
    // The file must be opened as a URI so the VFS can be named in it.
    const db = new sqlite3.oo1.DB(
      `file:/workspace.sqlite3?vfs=${VFS_NAME}`,
      'c',
    );
    // The repository applies the schema migrations when it opens.
    return createSqliteRepository(createWasmDriver(db), requestedNamespace);
  })();

  return repository;
};

const requireRepository = async (): Promise<WorkspaceRepository> => {
  if (!repository || namespace === null) {
    throw new StorageUnavailableError('The database worker has not been opened');
  }
  return repository;
};

const requireString = (value: unknown): string => {
  if (typeof value !== 'string') {
    throw new StorageError('Expected a string argument');
  }
  return value;
};

const dispatch = async (request: RpcRequest): Promise<unknown> => {
  switch (request.method) {
    case 'init': {
      const repo = await openRepository(requireString(request.args[0]));
      return repo.init();
    }
    case 'status':
      return (await requireRepository()).status();
    case 'list':
      return (await requireRepository()).list();
    case 'get':
      return (await requireRepository()).get(requireString(request.args[0]));
    case 'commit': {
      const input = request.args[0];
      if (!isCommitInput(input)) {
        throw new StorageError('The commit request is not a valid commit');
      }
      return (await requireRepository()).commit(input);
    }
    case 'remove':
      return (await requireRepository()).remove(requireString(request.args[0]));
    case 'close':
      return (await requireRepository()).close();
    default:
      throw new StorageError(`Unknown method "${String(request.method)}"`);
  }
};

const handle = async (request: RpcRequest): Promise<void> => {
  try {
    const value = await dispatch(request);
    scope.postMessage({ id: request.id, ok: true, value });
  } catch (error) {
    scope.postMessage({ id: request.id, ok: false, error: toRpcError(error) });
  }
};

scope.addEventListener('message', (event: MessageEvent) => {
  const request: unknown = event.data;
  if (!isRpcRequest(request)) return;
  void handle(request);
});
