/**
 * The worker protocol and the shapes that travel over it.
 *
 * The client and the worker exchange plain messages: a request carries an id,
 * a method and its arguments; a response carries the same id and either a
 * value or an error. Errors travel by name so the client can rebuild the
 * same error classes the port defines.
 *
 * The shapes below are the contract between the two sides. A value that
 * arrives from a message port or from a database row is data from outside
 * the program, so it is checked before anything acts on it.
 */
import type { Project } from '../../types';
import {
  StorageConflictError,
  StorageError,
  StorageQuotaError,
  StorageUnavailableError,
  type CommitInput,
  type ProjectSummary,
  type StorageStatus,
  type StoredProject,
} from '../types';

/** The methods the worker serves. */
export type RpcMethod =
  | 'init'
  | 'status'
  | 'list'
  | 'get'
  | 'commit'
  | 'remove'
  | 'close';

export interface RpcRequest {
  id: number;
  method: RpcMethod;
  args: unknown[];
}

export interface RpcError {
  name: string;
  message: string;
}

export interface RpcOkResponse {
  id: number;
  ok: true;
  value: unknown;
}

export interface RpcErrorResponse {
  id: number;
  ok: false;
  error: RpcError;
}

export type RpcResponse = RpcOkResponse | RpcErrorResponse;

const isRpcMethod = (value: unknown): value is RpcMethod =>
  value === 'init' ||
  value === 'status' ||
  value === 'list' ||
  value === 'get' ||
  value === 'commit' ||
  value === 'remove' ||
  value === 'close';

export const isRpcRequest = (value: unknown): value is RpcRequest => {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<RpcRequest>;
  return (
    typeof candidate.id === 'number' &&
    isRpcMethod(candidate.method) &&
    Array.isArray(candidate.args)
  );
};

export const isRpcResponse = (value: unknown): value is RpcResponse => {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as { id?: unknown; ok?: unknown; error?: unknown };
  if (typeof candidate.id !== 'number' || typeof candidate.ok !== 'boolean') {
    return false;
  }
  if (candidate.ok) return true;
  const error = candidate.error;
  return (
    typeof error === 'object' &&
    error !== null &&
    typeof (error as RpcError).name === 'string' &&
    typeof (error as RpcError).message === 'string'
  );
};

/** Describes any thrown value as an error the client can rebuild. */
export const toRpcError = (error: unknown): RpcError => {
  if (error instanceof Error) {
    return { name: error.name, message: error.message };
  }
  return { name: 'StorageError', message: String(error) };
};

/**
 * Rebuilds an error on the client side.
 *
 * The worker runs in another context, so the error class cannot cross the
 * message boundary; the name carries it instead.
 */
export const fromRpcError = (error: RpcError): Error => {
  switch (error.name) {
    case 'StorageConflictError':
      return new StorageConflictError(error.message);
    case 'StorageQuotaError':
      return new StorageQuotaError(error.message);
    case 'StorageUnavailableError':
      return new StorageUnavailableError(error.message);
    case 'StorageError':
      return new StorageError(error.message);
    default:
      return new StorageError(error.message);
  }
};

/* ------------------------------------------------------------------ *
 * The shapes that travel over the wire
 * ------------------------------------------------------------------ */

/**
 * Checks that a value is a project document.
 *
 * A document arrives as JSON from the database and as a structured clone
 * from the worker. The cast is the boundary: every field the editor relies
 * on is checked below.
 */
export const isProjectDocument = (value: unknown): value is Project => {
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

/** Checks that a value is a project summary. */
const isProjectSummary = (value: unknown): value is ProjectSummary => {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<ProjectSummary>;
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.name === 'string' &&
    typeof candidate.revision === 'number' &&
    typeof candidate.createdAt === 'number' &&
    typeof candidate.updatedAt === 'number' &&
    typeof candidate.width === 'number' &&
    typeof candidate.height === 'number' &&
    typeof candidate.fps === 'number' &&
    typeof candidate.durationInFrames === 'number'
  );
};

/** Checks that a value is a list of project summaries. */
export const isProjectSummaryList = (
  value: unknown,
): value is ProjectSummary[] => {
  if (!Array.isArray(value)) return false;
  const items: unknown[] = value;
  return items.every((item: unknown) => isProjectSummary(item));
};

/** Checks that a value is a stored project: a summary plus its document. */
export const isStoredProject = (value: unknown): value is StoredProject => {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<StoredProject>;
  // The document is read before the summary check narrows the candidate.
  const document = candidate.document;
  return isProjectSummary(candidate) && isProjectDocument(document);
};

/** Checks that a value is a storage status. */
export const isStorageStatus = (value: unknown): value is StorageStatus => {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<StorageStatus>;
  return (
    (candidate.backend === 'sqlite-opfs' ||
      candidate.backend === 'local-storage' ||
      candidate.backend === 'memory') &&
    typeof candidate.durable === 'boolean' &&
    (candidate.writeAccess === 'owner' ||
      candidate.writeAccess === 'read-only') &&
    (candidate.problem === undefined || typeof candidate.problem === 'string') &&
    (candidate.detail === undefined || typeof candidate.detail === 'string')
  );
};

/** Checks that a value is a commit request the worker can serve. */
export const isCommitInput = (value: unknown): value is CommitInput => {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<CommitInput>;
  if (typeof candidate.name !== 'string' || candidate.name.length === 0) {
    return false;
  }
  if (!isProjectDocument(candidate.document)) return false;
  if (candidate.id !== undefined && typeof candidate.id !== 'string') {
    return false;
  }
  if (
    candidate.expectedRevision !== undefined &&
    typeof candidate.expectedRevision !== 'number'
  ) {
    return false;
  }
  return true;
};
