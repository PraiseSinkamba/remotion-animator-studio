# Storage — Local Persistence

Architecture document for how Chart Studio stores projects. Governing decision:
[ADR-004 — Storage Port](../decisions/ADR-004-STORAGE-PORT.md).

## 1. Purpose

Projects are stored locally. There is no account, no login, no server and no network
request: the browser is the only place a project ever lives, and the data belongs to the
origin it was created in. The editor does not know how that happens. It talks to one
interface, `WorkspaceRepository`, and every backend that serves it is interchangeable behind
that interface. This document describes the interface, the contract every backend must
satisfy, the backends that exist today and how one of them is chosen.

Related documents: [Component Contract](../spec/COMPONENT_CONTRACT.md) governs the shape of
the project document that is stored, and [Technical Architecture](TECHNICAL_ARCHITECTURE.md)
sets the wider persistence boundary.

## 2. The port

The port lives in `src/storage/types.ts`. It is the only thing the editor, the store and the
UI know about.

```ts
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
```

What each method means:

| Method | Meaning |
|---|---|
| `init` | Opens the backend and returns its status. It is idempotent: calling it twice opens nothing twice. |
| `status` | The current `StorageStatus`. Synchronous and cheap, so the UI can read it while rendering. |
| `list` | Every project in the namespace as a `ProjectSummary`, newest first. A summary has no document, only the head revision's metadata. |
| `get` | One project with its head document, or `null` when the id is unknown. |
| `commit` | Writes a new revision of a project and returns the stored result. This is the only write. |
| `remove` | Deletes a project and all of its revisions. Removing an id that is not there is not an error. |
| `close` | Releases the backend. The repository cannot be used afterwards. |

### CommitInput and the compare-and-set rule

```ts
export interface CommitInput {
  id?: string;
  name: string;
  document: Project;
  expectedRevision?: number;
}
```

Omit `id` to create a new project. The new project gets revision 1 and a generated id.

`expectedRevision` is the revision the caller believes is current. When it is given and it does
not match the stored head revision, the commit is rejected: **nothing is written** and
`StorageConflictError` is thrown. The stored document is left exactly as it was. This is a
compare-and-set, and it is the reason two tabs cannot silently overwrite each other.

The rule is enforced in both places that can write: the SQLite adapter checks it inside the
transaction that would have applied the change, and the shared store engine checks it before
the store is written. The contract suite asserts it for every backend.

### Errors

```ts
export class StorageError extends Error {}
export class StorageConflictError extends StorageError {}
export class StorageQuotaError extends StorageError {}
export class StorageUnavailableError extends StorageError {}
```

| Class | What it means for the user |
|---|---|
| `StorageError` | The base class for storage failures the app handles. It covers a malformed commit (no name, an invalid document), a closed repository and an unreadable stored document. The edit is not saved and the editor keeps saying so. |
| `StorageConflictError` | The stored revision moved on, so the caller's write was not applied. The editor reports that another tab changed the project. The user's unsaved edit is still in the editor. |
| `StorageQuotaError` | The origin's storage budget is exhausted. The write did not happen. The top-bar chip says the storage is full and points at export. |
| `StorageUnavailableError` | The backend could not be opened or cannot be written to. This covers a database that will not start, a corrupt `localStorage` blob and a workspace owned by another tab. |

All four carry `name`, `cause` and `message`. Errors that cross the worker boundary travel by
name and are rebuilt on the client side into the same classes.

## 3. The contract suite

`src/storage/contract-suite.ts` holds the machine-checked form of the contract.
`describeRepositoryContract(label, create)` runs a suite of cases against one backend, and
every backend runs it against itself:

- reports a status once it is open;
- stores a project and reads it back unchanged;
- lists the projects it stored;
- bumps the revision on every commit;
- refuses a commit whose expected revision is stale;
- creates a separate project when no id is given;
- removes a project and tolerates removing it twice;
- returns null for an unknown project;
- keeps committed projects visible to a later instance.

The suite only uses the public interface, so it is also the definition of what a backend must
do. A backend that passes it can be swapped in without any caller noticing, which is the
entire point of the port.

The last case is the durability case. Two repositories are opened over the same namespace in
sequence: the first commits a project and is closed, the second opens over the same namespace
and reads the project back with the same document and the same revision. A backend that cannot
do this is not durable, whatever its status says.

## 4. The backends

| Backend id | Durability | When it is used |
|---|---|---|
| `sqlite-opfs` | Durable. Official SQLite WASM in a dedicated worker, database file in OPFS. | The default whenever the browser can run it. |
| `local-storage` | Durable, origin-bound, single document blob per namespace. | The fallback for browsers that cannot run the durable backend. |
| `memory` | Not durable. | The last resort when the browser has no usable storage at all. |

The `local-storage` backend stores every project of a namespace, with all of its revisions, in
one `localStorage` key (`chart-studio:<namespace>`). It reuses the shared store engine, so the
compare-and-set rules live in one place rather than in each backend.

The `memory` backend keeps its stores in a module-level map keyed by namespace. A second
repository over the same namespace in the same page sees the same data, but a page reload
loses it.

## 5. Backend selection

`src/storage/select.ts` chooses and opens the backend. The order is:

1. `sqlite-opfs`;
2. `local-storage`;
3. `memory`.

`chooseBackend` reports the backend the browser can actually run. `selectRepository` opens it
and, when the durable backend cannot run, opens the next one instead.

Two problems mean the backend cannot serve the workspace at all and is replaced by a fallback:
`opfs-unavailable` (the browser has no usable OPFS) and `backend-unavailable` (the durable
backend could not be opened). A workspace owned by another tab is **not** in that list: a
read-only workspace can still be read from, so it is kept.

A degraded backend reports a `problem` and a `detail` on its status. The detail is plain text
that is safe to show in the UI, and it says what happened to the user's work:

> The local database could not be opened (…). Projects are saved in this browser's storage
> instead.

or, when only the in-memory backend is left:

> The local database could not be opened (…). Projects are kept in memory only and are lost on
> reload.

`selectRepository` also accepts `prefer`, which forces one backend, and `backends`, which
replaces individual backend factories. Both exist for tests.

The status is what the top-bar chip renders. `src/components/StorageIndicator.tsx` maps it to
a label, and the order of the checks matters: a problem with the backend outranks a pending
save, and nothing claims to be saved while the editor holds unsaved changes or the last write
failed. The chip says "Saved locally" only when the status is durable, there is no problem and
no error.

## 6. The SQLite backend

### The package

The backend uses `@sqlite.org/sqlite-wasm` at version `3.54.1-build1`, licence Apache-2.0. It
is the official SQLite WASM build, as [ADR-002 — Dependency Adoption](../decisions/ADR-002-DEPENDENCY-ADOPTION.md)
requires. The SQLite library itself is public domain; the WASM wrapper is Apache-2.0.

### The worker and the protocol

The database lives in a dedicated Web Worker (`src/storage/sqlite/worker.ts`). The main thread
never opens it. The client (`src/storage/sqlite/client.ts`) owns the worker, the write lock and
the message plumbing, and nothing else.

All access goes through a typed request/response protocol in `src/storage/sqlite/rpc.ts`. One
method per port operation: `init`, `status`, `list`, `get`, `commit`, `remove`, `close`. A
request carries an id, a method and its arguments; a response carries the same id and either a
value or an error. Errors travel by name so the client can rebuild the same error classes the
port defines. Every shape that arrives from the message port or from a database row is checked
before anything acts on it.

### The VFS

The VFS is the OPFS SAH pool. The exact recipe that works:

```ts
const sqlite3 = await sqlite3InitModule();
await sqlite3.installOpfsSAHPoolVfs({ name: 'opfs-sahpool', directory: '/chart-studio/<namespace>' });
const db = new sqlite3.oo1.DB('file:/workspace.sqlite3?vfs=opfs-sahpool', 'c');
```

Two facts were established by experiment and are easy to get wrong:

- The plain `opfs` VFS does not install in this build. The SAH pool variant does.
- The database must be opened as a URI. A plain path fails with `SQLITE_CANTOPEN`.

The namespace maps to the OPFS directory `/chart-studio/<namespace>`, and the database file
inside it is always `workspace.sqlite3`. A namespace has to be a plain name; anything outside
`[A-Za-z0-9._-]` is refused.

### Cross-origin isolation

The Vite dev server and `vite preview` send:

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: credentialless
```

The SQLite WASM documentation prescribes these headers for the worker-and-OPFS path, because the
SAH pool uses a `SharedArrayBuffer`. The app sends `credentialless` rather than `require-corp`:
it keeps the page cross-origin isolated, and it still lets the editor load media from another
origin, which `require-corp` blocks unless the other server opts in.

**Any host that serves the built app should send these headers too.** On Chromium 155 the pool
also installs and persists without any isolation headers, so this is the documented
configuration rather than a hard requirement — but it is the configuration the upstream
documentation prescribes, and it is the one that gives the worker a `SharedArrayBuffer`.

Without cross-origin
isolation the durable backend may not run, and the app falls back to `local-storage` or
`memory` and says so in the top bar.

### Bundle

The wasm binary is 879 kB and is emitted once as a hashed asset. The worker is a separate
chunk. Both are loaded on demand; the main bundle is unaffected.

## 7. The schema

`src/storage/sqlite/schema.ts` defines three tables:

| Table | What it holds |
|---|---|
| `schema_migrations` | The migration versions that have been applied, and when each was applied. |
| `projects` | One row per project: id, name, creation and update times, the head revision number, and the width, height, fps and duration of the head document. |
| `project_revisions` | Every committed revision of a project: the project id, the revision number, the document as JSON and the commit time. The primary key is `(project_id, revision)` and the rows cascade on delete. |

Migrations are numbered, forward-only and applied in a transaction that also records the
version in `schema_migrations`. A database that carries a version this build does not know is
refused rather than guessed at: guessing at a newer schema would corrupt it.

The SQL for this adapter is confined to `src/storage/sqlite/`. The rest of the application
never issues a query.

## 8. One writer per workspace

The backend takes an exclusive Web Locks API lock with the name `chart-studio-workspace`, in
`ifAvailable` mode.

- The tab that holds the lock writes.
- Every other tab is read-only, and the UI says "Read-only — another tab owns this
  workspace".

A lock that another tab holds is not an error: the caller gets a read-only workspace. A lock
API that fails outright is an error, because then nobody knows who owns the database.

A tab must never quietly become a second, divergent copy of the workspace. The second tab is
blocked, not degraded: it cannot list the projects and it cannot read one. Its `list` returns
nothing and its `get` returns `null`, and any attempt to write throws
`StorageUnavailableError`.

## 9. What is not implemented yet

These are known gaps, stated plainly so nobody plans around them:

- **No binary assets in OPFS.** Only the project document is stored. There is no asset table
  and no content-addressed file store.
- **No quota reporting.** `StorageStatus.usage` exists in the type but no backend fills it in.
  A `localStorage` write that hits the quota is detected and reported as `quota-exceeded`;
  nothing measures how much of the origin's budget is used.
- **No project thumbnails and no dashboard of recent projects.** There is no way to see what
  a project looks like without opening it.
- **No portable archive format.** There is no `.chartstudio` archive and no import or export
  of one. The OPFS database file is not a portable format and must not be treated as one.
- **No import of market data.** The database holds project documents only.
- **The second tab cannot read the project list either.** It is blocked, not degraded.
