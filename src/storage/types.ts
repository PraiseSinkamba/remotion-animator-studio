/**
 * The storage port.
 *
 * Everything above this line — the editor, the store, the UI — talks to
 * `WorkspaceRepository` and to nothing else. Everything below it — SQL dialect,
 * connections, workers, VFS choice, file layout — belongs to one adapter.
 *
 * Swapping the backend means writing one more implementation of this
 * interface. No caller changes, and no caller learns which backend it got.
 *
 * The contract every implementation must satisfy lives in
 * `docs/architecture/STORAGE.md`; the machine-checked version of it is
 * `contract-suite.ts`, which each adapter runs against itself.
 */
import type { Project } from '../types';

/** Which implementation is currently serving the port. */
export type StorageBackend = 'sqlite-opfs' | 'local-storage' | 'memory';

/** Why the workspace is not in its normal state. */
export type StorageProblem =
  /** The durable backend could not be opened; the app fell back. */
  | 'backend-unavailable'
  /** The browser has no usable OPFS, so the database cannot be durable. */
  | 'opfs-unavailable'
  /** Another tab owns the workspace; this tab may only read. */
  | 'locked-by-other-tab'
  /** The origin's storage quota is exhausted. */
  | 'quota-exceeded'
  /** The browser cannot run this app's persistence at all. */
  | 'unsupported-browser';

/** How much of the storage budget is used, when the backend can report it. */
export interface StorageUsage {
  usedBytes?: number;
  quotaBytes?: number;
}

/** What the user needs to be told about the workspace's health. */
export interface StorageStatus {
  backend: StorageBackend;
  /** True when a committed project survives a page reload. */
  durable: boolean;
  /** Whether this tab may write. */
  writeAccess: 'owner' | 'read-only';
  problem?: StorageProblem;
  /** Human-readable detail for the problem, safe to show in the UI. */
  detail?: string;
  usage?: StorageUsage;
}

/** A project as listed in the workspace, without its document. */
export interface ProjectSummary {
  id: string;
  name: string;
  /** Revision of the head document. */
  revision: number;
  createdAt: number;
  updatedAt: number;
  width: number;
  height: number;
  fps: number;
  durationInFrames: number;
}

/** A project with its head document. */
export interface StoredProject extends ProjectSummary {
  document: Project;
}

/** What to commit. Omit `id` to create a new project. */
export interface CommitInput {
  id?: string;
  name: string;
  document: Project;
  /**
   * The revision the caller believes is current. When the stored revision has
   * moved on, the commit is rejected instead of overwriting someone else's
   * work.
   */
  expectedRevision?: number;
}

/** Hooks the app can use to react to the backend's health. */
export interface RepositoryOptions {
  /** Called whenever the status changes (lock lost, quota hit, fallback). */
  onStatusChange?: (status: StorageStatus) => void;
}

/**
 * The interface the whole application uses to store projects.
 *
 * Implementations must be safe to use from a single tab. Cross-tab
 * coordination (one writer, others read-only) is the backend's business.
 */
export interface WorkspaceRepository {
  /** Which implementation is serving this repository. */
  readonly backend: StorageBackend;

  /** Open the backend and report its status. Idempotent. */
  init(): Promise<StorageStatus>;

  /** The current status. Cheap and synchronous. */
  status(): StorageStatus;

  /** Every stored project, newest first. */
  list(): Promise<ProjectSummary[]>;

  /** One project with its head document, or null when it does not exist. */
  get(id: string): Promise<StoredProject | null>;

  /**
   * Commit a new revision.
   *
   * When `expectedRevision` is given and does not match the stored revision,
   * nothing is written and a `StorageConflictError` is thrown.
   */
  commit(input: CommitInput): Promise<StoredProject>;

  /** Delete a project and its revisions. Missing ids are not an error. */
  remove(id: string): Promise<void>;

  /** Release the backend. The repository is unusable afterwards. */
  close(): Promise<void>;
}

/**
 * Creates a repository over a namespace.
 *
 * The namespace lets two instances of the same backend address the same
 * data, which is how the contract suite proves that a commit is durable.
 */
export type RepositoryFactory = (
  namespace: string,
  options?: RepositoryOptions,
) => Promise<WorkspaceRepository>;

/** Base class for storage failures the app is expected to handle. */
export class StorageError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'StorageError';
  }
}

/** The stored revision moved on; the caller's write was not applied. */
export class StorageConflictError extends StorageError {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'StorageConflictError';
  }
}

/** The origin's storage budget is exhausted. */
export class StorageQuotaError extends StorageError {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'StorageQuotaError';
  }
}

/** The backend could not be opened at all. */
export class StorageUnavailableError extends StorageError {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'StorageUnavailableError';
  }
}
