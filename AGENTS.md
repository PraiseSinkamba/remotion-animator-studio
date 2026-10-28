# AGENTS.md — Chart Studio

Applies to all coding assistants, subagents and human contributors working in this repository. **Current repository is design-only; do not claim source code exists or launch implementation without explicit design approval.**

## First read (mandatory order)

1. `README.md` — status and index.
2. `docs/spec/FUNCTIONAL_SPEC.md` — v1 behavior and acceptance IDs.
3. `docs/architecture/TECHNICAL_ARCHITECTURE.md` — the source of architectural contracts.
4. `docs/decisions/ADR-001-VIDEO-STACK.md` and `docs/decisions/ADR-002-DEPENDENCY-ADOPTION.md` — build-versus-reuse and licensing.
5. `docs/decisions/ADR-003-COMPONENT-SYSTEM.md` — required component protocol, custom catalog and Remocn adapter contract.
6. `docs/roadmap/ROADMAP.md` — dependencies and deliverables.
7. `docs/quality/TEST_STRATEGY.md` plus relevant video scenario.

If a requirement is ambiguous or contradicts another doc, report it and propose the smallest decision. Never silently discard requirements. Do not rewrite or overwrite the predecessor snapshot in `docs/reference/`.

## Product invariants — nonnegotiable

- **Local-first:** no mandatory login, cloud call, server process or network request for core editing/save/preview/export after application is installed and assets are cached.
- **Remotion-first:** one React composition and frame-evaluation contract for preview and export. No unrelated video renderer or independent animation logic without an ADR and parity test.
- **Component system is P0:** custom trading video components and source-owned Remocn motion components must share the common typed registration/serialization/editor/lifecycle contract from R1. Do not hardcode per-object video editors or postpone trading components until after MVP.
- **No future data leakage:** replay only shows bars, pivot confirmations and partial HTF values available at the current market time. A completed higher-timeframe bar may only be used retrospectively when explicitly labeled.
- **Provenance:** manual, imported, modified, synthetic and authentic-tick origins must remain distinct; no invented market timestamps or unannounced fill policies.
- **SMT is user-confirmed:** candidate swings are suggestions, not auto-generated trade signals. The observation stores prior and current swing pairs per instrument, at most three assets in v1, and becomes stale if dependencies change.
- **Scene-object lifecycle:** all charts, groups, tools and captions are editable typed objects with frame intervals, opacity/transform/keyframes, chart/market coordinate anchors as appropriate, and explicit layering.
- **Portability:** local Save commits SQLite; Save As / Export Project emit a self-contained `.chartstudio` archive. Do not treat SQLite's internal OPFS file as the export format.
- **Determinism:** project snapshot + frame index -> same logical frame, independent of seek direction and preview history. Preview and export use the same scene implementation.
- **No silent destruction:** no overwritten source OHLC, deleted referenced asset, destructive reimport, external-file overwrite, or silent sync conflict.

## Build-versus-reuse

**Three foundational layers from R1:** Remotion is the video engine; **Remocn is the primary source-owned motion component framework** for compatible generic visual effects/titles/transitions; and **Chart Studio trading components are custom first-party objects from the very first slice**, not later extensions. Read `docs/decisions/ADR-003-COMPONENT-SYSTEM.md`. Each custom or adapted visual object must register typed props, inspector metadata, animation capabilities, frame lifecycle, renderer and serialization rules. Use Tailwind/shadcn/ui for editor controls (separate from video components). Drag-and-drop is handled by the editor's own pointer code; `dnd-kit` is not a dependency. **Do not make framecn/Editframe a required runtime**; it is a separate ecosystem. Remotion's paid Editor Starter/Timeline must never be assumed installed or licensed. Do not pull in a second competing video editor framework casually. Trading/chart/SMT/MTF logic is custom and independently tested; chart-preview libraries may be used only as adapters after a parity spike.

Before proposing a new dependency, record: exact package and version, license, runtime/browser support, tree-shaking/bundle consequences, security posture, how it improves on an existing component, and an exit strategy. Pin Remotion packages to the same compatible version.

## Development approach

- Follow Superpowers brainstorming/approval -> scoped implementation plans -> test-first execution -> independent review. Roadmap is not permission to begin coding.
- Prefer small vertical slices that leave the app working. Each issue/PR has a requirement ID, files touched, tests, screenshots/recordings if UI changes, and a migration note if schemas changed.
- For a slice, first identify the target spec sections and at least one video scenario; write failing tests; implement the smallest behavior; run tests, typecheck and lint; review; commit.
- All project data types are strict TypeScript discriminated unions validated at import/storage boundaries with Zod. Avoid `any`, unversioned JSON blobs as domain objects and unnecessary framework wrappers.
- Use parameterized SQL and versioned migrations. SQLite runs in its dedicated worker with one controlled writer; never call persistence directly from render components.
- Keep chart objects independent of the editor DOM. No Zustand hooks or browser I/O inside the deterministic evaluator, Remotion compositions, or market-data pure functions.
- Prefer pure functions for `partialCandleAt`, `aggregateAsOf`, `matchSwingPairs`, `evaluateSceneAtFrame`, and frame conversions; memoization is allowed only behind explicit dependency keys.
- Model source timestamps in UTC with declared bar-open/bar-close, session/calendar and price basis. Never align independent markets by index.
- Keep third-party code provenance and license notices when copying components; respect the terms of Remotion and code registries.

## Working conventions

Expected package manager: `pnpm` workspace + Turborepo. Use TypeScript strict mode, React functional components, a Vite SPA application shell at `apps/studio` (see [ADR-006](docs/decisions/ADR-006-SHELL-TECHNOLOGY.md) — Next.js is deferred, and the shell is the only thing a future swap would touch), scoped package boundaries, formatting/linting and explicit error types. Prefer no experimental APIs until a compatibility test has proved them in the supported browser. Do not hard-code HTTP URLs or server-only APIs into offline-essential modules. `dnd-kit` was **not** adopted: the timeline keeps its own pointer handling.

The repository is five packages and one application:

| Path | Owns |
|---|---|
| `packages/core` | The project, scene, clip and object schemas; the component contract; the registration mechanism; the candle maths. Pure TypeScript — no React, no Remotion, no storage code. |
| `packages/components` | The component catalogue, in three folders: `base/` (the 22 inherited generic elements), `trading/` (the candlestick chart and the nine planned trading objects), `motion/` (the adapted Remocn components, with their provenance record). Also the registry aggregator and the project migration. |
| `packages/ui` | The shadcn primitives and the presentational inspector and library pieces. |
| `packages/editor` | The store — commands, history, selection — the timeline pieces, and the local database. |
| `packages/video` | The Remotion composition, its entry point, and the render server and CLI render script. |
| `apps/studio` | The editor shell: the panels, the presets, the theme. |

Cross-package imports use the package's own name and a `workspace:*` dependency; no TypeScript path alias crosses a package boundary, because the dependency list is what enforces the ownership rules. **A package is consumed as source** — there is no build artefact and no `dist`, and each package has one TypeScript configuration that typechecks its source and emits nothing. That is deliberate: a library that creates its own worker resolves the worker URL against its own directory, and a built artefact would put that directory somewhere the URL cannot reach. The packages `smt-mtf`, `project-archive` and `testing` are documented but do not exist yet — they appear when the roadmap stage that needs them lands, never as empty shells.

## Repository shape

```text
apps/studio/            the editor shell: panels, presets, theme, the Remotion entry
packages/core/          schemas, the component contract, the registry mechanism, the candle maths
packages/components/    base/ trading/ motion/ — the catalogue, the aggregator, the migration
packages/ui/            shadcn primitives and the presentational inspector and library pieces
packages/editor/        the store, the timeline pieces, the local database
packages/video/         the composition, the Remotion entry, the render server and CLI
vendor/remocn/          verbatim upstream Remocn source, kept as the licence record; never bundled
docs/                   the specification, the decisions and the implementation records
```

The commands that exist:

```bash
pnpm install --frozen-lockfile   # install from the committed lockfile
pnpm typecheck                    # turbo: typecheck every package
pnpm test                         # vitest across the workspace
pnpm build                        # turbo: build every package and the application
pnpm dev                          # the editor and the render server
pnpm render                       # render ./project.json to out/animation.mp4
node scripts/verify-r1.mjs        # the real Remotion render check: stills and an MP4
```

**A feature is not done until the render still works.** `pnpm test` passing is not proof that the video
path is intact — `node scripts/verify-r1.mjs` is. The package conventions that make the split work (the
`.js` extension on a package's relative imports, the two TypeScript configurations, the Tailwind
`@source` for each package, the `sideEffects` declaration, and the worker's built file name) are
recorded in `docs/superpowers/specs/2026-10-28-chart-studio-platform-and-catalogue-reorganisation-design.md`
§5.2. Read it before adding a package.

## Required verification per feature

- Unit/property tests for invariants and off-by-one frame timing.
- Integration tests for imported/manual series, SQLite save/reopen, data provenance, source revisions, and cache invalidation.
- Browser tests for chart selection and drag handles, nested timelines, playback, OPFS permissions and import/export.
- Frame snapshot tests for editor preview vs browser export at beginning, middle, transition and end.
- One complete creator workflow from `docs/scenarios/VIDEO_SCENARIOS.md`; include SMT/MTF/no-lookahead cases when relevant.
- Handle missing assets, unsaved edits, unsupported codecs, storage quota and corrupt archives without data loss.

Never state tests passed unless commands actually ran and the results were inspected. No fake benchmark claims. For screenshot/video evidence, label synthetic market data plainly.

## PR template / completion report

```
Requirement IDs:
Affected package contracts:
Behavior and edge cases:
Tests executed and observed results:
Browser/platform tested:
Dependencies/licenses added:
SQLite/schema/archive migrations:
Preview/export visual evidence:
Known limitations and follow-ups:
```

## Explicitly out of MVP

Authentic tick ingestion/replay engine, automatic SMT scanning/signals, broker integrations, live data subscriptions, multi-user editing, cloud sync, remote renderer, AI narration, advanced media effects, arbitrary plugin marketplace. Preserve extension points but do not implement these prematurely.
