# Chart Studio R2 — local persistence behind a port

Date: 2026-10-26 · Status: complete · Scope: the storage slice only.

## 1. Goal

Give Chart Studio a real local store. Before this slice a project was an autosave string in
`localStorage` plus a JSON file on disk: no revisions, no conflict detection, no way to tell the
user whether their work was safe.

The requirement that shaped everything else: **the database is an implementation detail**. The
editor talks to one interface, `WorkspaceRepository`, and swapping the backend means writing one
more implementation of it. Two backends already exist behind it, and the contract suite proves
they are interchangeable.

Still out of scope: SMT, MTF, chart groups, drawing tools, a project dashboard, a portable
archive format, market-data import.

## 2. Plan (as executed)

| # | Task | Result |
|---|---|---|
| R2.0 | Prove the official SQLite WASM + OPFS path in a real browser before designing anything | spike: the SAH-pool VFS works, the database survives a reload, and two facts that are easy to get wrong were established |
| R2.1 | Write the port and the machine-checked contract | `src/storage/types.ts`, `src/storage/contract-suite.ts` |
| R2.2 | Build the SQLite adapter: worker, RPC, schema, migrations, compare-and-set | `src/storage/sqlite/` |
| R2.3 | Build the fallbacks and the backend selection | `src/storage/local/`, `src/storage/select.ts` |
| R2.4 | Wire the editor to the port: autosave, restore, storage status | `src/storage/useWorkspace.ts`, `src/store.ts`, `src/App.tsx`, `src/components/StorageIndicator.tsx`, `src/components/TopBar.tsx` |
| R2.5 | Document the decision and the operational facts | `docs/architecture/STORAGE.md`, `docs/decisions/ADR-004-STORAGE-PORT.md` |

## 3. Architecture decisions taken

- **The port is the whole point.** `WorkspaceRepository` is the only thing the editor, the store
  and the UI know about. `commit` takes an `expectedRevision`; when it does not match the
  stored head, nothing is written and `StorageConflictError` is thrown. A second tab cannot
  silently overwrite the first.
- **The contract is executable.** `describeRepositoryContract` runs the same nine cases against
  every backend. The SQLite adapter, the `localStorage` adapter and the in-memory adapter all
  pass it. A backend that passes can be swapped in without a caller noticing.
- **The SQL is confined to `src/storage/sqlite/`.** The rest of the app never issues a query.
- **One writer per workspace.** The durable backend takes an exclusive Web Locks API lock named
  `chart-studio-workspace`. The tab that holds it writes; every other tab is read-only and the
  top bar says "Read-only — another tab owns this workspace". A tab never becomes a second,
  divergent copy of the workspace.
- **The VFS choice was made by experiment, not by documentation.** The plain `opfs` VFS does
  not install in this build; the SAH pool does, but only when `installOpfsSAHPoolVfs` is called
  explicitly, and the database must be opened as a URI (`file:/workspace.sqlite3?vfs=opfs-sahpool`)
  — a plain path fails with `SQLITE_CANTOPEN`.
- **Cross-origin isolation is a deployment requirement.** The Vite dev server and `vite preview`
  send the COOP/COEP headers; any host serving `dist/` must send them too, or the app falls
  back and says so.
- **Degradation is visible.** The status carries a `problem` and a readable `detail`, and the
  chip never claims the work is saved when it is not.
- **The old `localStorage` autosave is gone.** The editor autosaves into the workspace; the
  existing file buttons still write an external JSON file, which is a different thing and keeps
  working exactly as before.

## 4. Verification actually performed

| Check | Command | Result |
|---|---|---|
| Types | `npm run typecheck` | clean |
| Tests | `npm test` | **123 passed** across 9 files (52 of them storage) |
| Bundle | `npm run build` | clean; the wasm is emitted once as a hashed 879 kB asset, the worker is a separate chunk |
| Storage contract | `npx vitest run src/storage` | the same nine contract cases pass against the SQLite (real SQL through `node:sqlite`), `localStorage` and in-memory backends |
| Editor, dev server | browser against `npm run dev:web` | the chip reads "Saved locally"; the durable backend is really in use (the `chart-studio` directory appears in OPFS, and no `chart-studio*` key appears in `localStorage`); a renamed project is restored after a reload |
| Editor, production build | browser against `npm run preview` | the same: the project is autosaved and restored after a reload, no console errors |
| One writer per workspace | two tabs on the same origin | the first tab keeps "Saved locally"; the second reads "Read-only — another tab owns this workspace" |
| Render path | `npm run render -- project.json out/baseline-legacy.mp4` | the CLI export still renders 240 frames — the storage layer does not touch the video path |

## 5. What R2 deliberately does not do

- No binary assets in OPFS, no content-addressed file store. Only the project document is
  stored.
- No quota reporting. `StorageStatus.usage` exists but nothing fills it in.
- No project thumbnails and no dashboard of recent projects. The workspace is opened by the
  most recently updated project.
- No portable `.chartstudio` archive. The OPFS database file is not a portable format and is
  not treated as one.
- No market-data import; the database holds project documents only.
- The second tab is blocked, not degraded: it cannot list or read projects.
- Migrations are forward-only. A database written by a newer build is refused, not guessed at.

## 6. Unresolved issues and known debt

1. The storage layer has no end-to-end test in the browser suite — Vitest runs in Node, and the
   worker, the wasm and OPFS need a real browser. The proof is the manual run in §4 and the
   contract suite that covers the SQL.
2. `useWorkspace` commits the whole document on every autosave. Fine for a project of this
   size, wrong for a project with large media references.
3. The editor still keeps its own undo history in memory. The stored revisions are a durable
   history, but nothing reads them back yet, so "undo" does not walk the stored revisions.
4. `StorageStatus.usage` is never filled in, so the app cannot warn about a nearly full origin
   before a write fails.
5. The top-bar chip and the file "Save" button do different things. The chip commits to the
   workspace; the button writes an external JSON file. The tooltips say so, but the naming
   could still confuse a user.
6. The workspace identity (`workspaceId`, `workspaceRevision`) lives in the editor store. It is
   not part of the project document, so a project file opened from disk becomes a new
   workspace project when it is first autosaved.
7. `docs/DOCS.md` still documents the removed `ELEMENTS` export, and `README.md` still claims
   the repository has no implementation. Both are R0/R1 debt and are still open.

## 7. Commits

The slice lands as focused commits: the port and the contract, the SQLite adapter, the
fallbacks and the selection, the editor wiring, and this documentation.
