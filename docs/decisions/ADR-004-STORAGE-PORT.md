# ADR-004 — A storage port with official SQLite WASM in a worker as the durable backend

**Status:** Accepted; implemented in `src/storage/`.  
**Date:** 2026-10-26  
**Depends on:** [ADR-002 — Dependency Adoption](ADR-002-DEPENDENCY-ADOPTION.md) (local persistence
shortlist), [Technical Architecture](../architecture/TECHNICAL_ARCHITECTURE.md) (SQLite WASM + OPFS
topology).  
**Described in:** [Storage — Local Persistence](../architecture/STORAGE.md).  
**Decision owners:** Product owner + implementation lead.

## Context

Chart Studio is local-first. Projects live in the browser, there is no account and no server, and
the editor must keep working with the network off. The upstream fork had no persistence layer at
all: projects were an autosave string in `localStorage` and JSON files on disk. There were no
revisions, no conflict detection, and no way to know whether a write had landed.

The product invariants also require that the port never touches storage directly, that SQLite
runs in its own worker with one controlled writer, and that the application never misstates
durability. [ADR-002](ADR-002-DEPENDENCY-ADOPTION.md) shortlisted `@sqlite.org/sqlite-wasm` with
browser OPFS for local persistence, gated on a VFS, two-tab and quota spike.

The application also has to work in browsers that cannot run the durable backend. So the decision
is not only "which database"; it is "what does the editor talk to, and how is the database
replaced later without touching a caller".

## Decision

1. **A single port.** The whole application talks to one interface, `WorkspaceRepository`, in
   `src/storage/types.ts`. The editor, the store and the UI know nothing about SQL, workers,
   OPFS or `localStorage`. The React binding (`src/storage/useWorkspace.ts`) opens a repository
   and commits the document; it does not know which backend it got.

2. **The machine-checked contract is the contract.** `src/storage/contract-suite.ts` exports
   `describeRepositoryContract(label, create)`, and every backend runs it against itself. A
   backend that passes it can be swapped in without any caller noticing. The suite includes the
   durability case: a commit is visible to a later instance over the same namespace.

3. **Official SQLite WASM in a dedicated worker is the durable backend.** `@sqlite.org/sqlite-wasm`
   runs in a Web Worker. The main thread never opens the database. The worker owns the VFS, the
   file and the migrations, and answers a typed request/response protocol (`src/storage/sqlite/rpc.ts`)
   with one method per port operation.

4. **The VFS is the OPFS SAH pool.** `installOpfsSAHPoolVfs({ name: 'opfs-sahpool', directory:
   '/chart-studio/<namespace>' })`, then the database is opened as a URI:
   `file:/workspace.sqlite3?vfs=opfs-sahpool`. Two facts were established by experiment: the
   plain `opfs` VFS does not install in this build, and a plain path fails with
   `SQLITE_CANTOPEN`.

5. **Cross-origin isolation is a deployment requirement.** The app needs
   `Cross-Origin-Opener-Policy: same-origin` and `Cross-Origin-Embedder-Policy: require-corp`.
   The Vite dev server and `vite preview` send them; any host that serves the built app must as
   well, or the durable backend cannot run.

6. **One writer per workspace.** The backend takes an exclusive Web Locks API lock named
   `chart-studio-workspace`. The tab that holds it writes; every other tab is read-only and is
   blocked from the project list, not merely degraded.

7. **Two fallbacks, chosen automatically.** `src/storage/select.ts` tries SQLite, then
   `localStorage`, then memory. A degraded backend reports a `problem` and a `detail` that the
   top-bar chip shows. The status never claims the work is saved when it is not.

8. **Compare-and-set on every commit.** A commit carries the revision the caller believes is
   current. When it does not match the stored head, nothing is written and `StorageConflictError`
   is thrown. The rule lives in the port and is enforced by every backend.

## Consequences

**Good:** one interface and one contract suite make the backend replaceable and testable; the
editor cannot grow a storage dependency by accident; revisions and conflict detection replace
the autosave string; durability is reported honestly; the SQL stays in one directory.

**Costs:** a new runtime dependency and a wasm asset; a deployment requirement for
cross-origin isolation headers; a worker and an RPC protocol to maintain; the durable backend
does not run in every browser, so two fallbacks must be maintained and the fallback path is
exercised in real use.

**Limits accepted for now:** only the project document is stored. Binary assets in OPFS, quota
reporting, project thumbnails, a dashboard of recent projects, a portable `.chartstudio` archive
and market-data import are not implemented. The second tab cannot read the project list either;
it is blocked, not degraded.

## Dependency record

Required by `AGENTS.md` for a new runtime package.

- **Exact package and version:** `@sqlite.org/sqlite-wasm@3.54.1-build1`.
- **Licence:** Apache-2.0 for the WASM wrapper. The SQLite library itself is public domain.
- **Runtime and browser support:** needs WebAssembly, Web Workers, OPFS
  (`navigator.storage.getDirectory`) and cross-origin isolation. Verified on Chromium 155 on
  Windows. Browsers that cannot provide these fall back to `local-storage` or memory.
- **Bundle consequences:** a 879 kB wasm asset emitted once as a hashed asset, and a separate
  worker chunk. Both are loaded on demand; the main bundle is unaffected.
- **Security posture:** no network access, no `eval`, everything local to the origin. The
  database is only as safe as the origin's storage. A second tab is blocked rather than allowed
  to fork the workspace.
- **How it improves on what existed:** projects were an autosave string in `localStorage` and
  JSON files on disk, with no revisions and no conflict detection. There is now a durable
  transactional store with per-project revision history, compare-and-set writes and an explicit
  status that says where the work lives.
- **Exit strategy:** the port is the exit. A different database is one more implementation of
  `WorkspaceRepository` and one more entry in `src/storage/select.ts`. All SQL is confined to
  `src/storage/sqlite/`, so leaving it is a deletion, not a rewrite.

## Alternatives considered

| Approach | Advantage | Problem | Decision |
|---|---|---|---|
| `better-sqlite3` | Mature, fast, familiar Node API | Node only. It cannot run in a browser at all, so it would not serve the local-first requirement | Reject |
| A native SQLite build compiled to WebAssembly by us | Full control over the build | A hand-rolled build is a maintenance and licensing burden for no capability the official build does not have | Reject |
| Keep `localStorage` as the primary store | No wasm, no worker, no isolation headers | One blob per namespace, no transactions, no revisions, no indexing; it is the fallback, not the primary | Reject |
| IndexedDB | Widely supported, structured | No SQL, no transactions across object stores, and it is a different API surface with the same "one object store per namespace" shape | Reject |
| **Official SQLite WASM in a worker over OPFS, behind a port** | Real SQL, real transactions, real revisions, an official build | wasm asset, worker, isolation headers | **Select** |
