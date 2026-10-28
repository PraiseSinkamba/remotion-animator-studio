# Chart Studio — platform and catalogue reorganisation

**Status:** Draft for review · **Date:** 2026-10-28 · **Type:** Design spec
**Relates to:** `docs/architecture/TECHNICAL_ARCHITECTURE.md` §2, `docs/decisions/ADR-002-DEPENDENCY-ADOPTION.md`,
`docs/decisions/ADR-003-COMPONENT-SYSTEM.md`, `docs/architecture/REMOCN-CATALOGUE.md`, `docs/roadmap/ROADMAP.md` R1–R4
**Precedes:** implementation plans under `docs/superpowers/plans/`

---

## 1. Context

The repository is a working local-first trading video editor: a Vite SPA, React 18, Remotion 4.0.538,
Zustand, Tailwind v4, shadcn/ui, Vitest. 153 tests pass across 12 files and `tsc -b` is clean.

The documentation describes a different repository. `AGENTS.md`, `TECHNICAL_ARCHITECTURE.md` §2 and
`ROADMAP.md` specify pnpm, Turborepo, a Next.js App Router shell, and fourteen `packages/*` boundaries.
None of those exist. `UPSTREAM_AUDIT.md` §7 records that the monorepo shape was deliberately declined in
favour of the Vite SPA and maps `packages/*` onto `src/*` — but that mapping was never applied to the
source tree, and `AGENTS.md` still instructs every agent to work in packages that are not there.

The drift is not cosmetic:

- `ROADMAP.md` has two of roughly seventy checkboxes ticked, while the code has completed R1 and half of R2.
- `TEST_STRATEGY.md` states the repository "does not include an implemented app or runnable test suite".
- `DOCS.md` documents a pre-registry `ELEMENTS` map and points at a deleted file.
- The catalogue has grown to 26 components while `REMOCN-CATALOGUE.md` still reasons about 23.
- Three source areas are demonstrably dead: the verbatim upstream copies under `src/motion-components/upstream/`
  are never bundled and cannot typecheck against themselves; `scripts/gen-showcase.mjs` and
  `scripts/preset-stills.mjs` both import a `/tmp/presets-bundle.mjs` that no script produces;
  `examples/showcase.json` is a 51 KB artefact nothing references.

The roadmap's remaining stages cannot be built cleanly on this foundation. R3's nine trading components
need a price/time anchor model, and the architecture document's own component list has no owner for the
22 inherited generic elements.

This spec defines the restructure that closes the gap, and the sequence in which it happens.

## 2. Goals

1. The source tree matches the documented ownership boundaries in `TECHNICAL_ARCHITECTURE.md` §2.
2. The package manager and build orchestration match `AGENTS.md`: pnpm workspace plus Turborepo.
3. The component catalogue is grouped into three families — generic, trading, motion — so that more
   Remocn components can be adopted and the nine trading components have a home.
4. The dead code and the stale documentation are gone, and CI runs the gate automatically.
5. Every phase leaves the editor working, with preview and export rendering identical logical frames.

## 3. Non-goals

| Excluded | Why | When |
|---|---|---|
| Next.js App Router shell | Held by decision. ADR-002 and `TECHNICAL_ARCHITECTURE.md` §17 require a formal reassessment rather than a silent divergence, so ADR-004 records the Vite SPA as the retained choice. | Future spec |
| React, Remotion and dependency upgrades | Separate pass, after the structure settles so the upgrade is made once. | Future spec |
| The nine trading components' content | Phase 4. | Phase 4 |
| `.chartstudio` archive packaging | R7; `packages/project-archive` has no code. | R7 |
| SMT and MTF domain | R5; `packages/smt-mtf` has no code. | R5 |
| `packages/testing` | No shared fixtures exist yet; tests stay colocated. | When shared fixtures appear |
| Changing editor behaviour | Phase 1 is a move, not a redesign. | — |

## 4. Decisions

| # | Decision | Rationale | Alternative rejected |
|---|---|---|---|
| D1 | Move to a pnpm workspace, `apps/*` and `packages/*` | `AGENTS.md` and `TECHNICAL_ARCHITECTURE.md` §2 both specify it; the instruction from the repo owner. | Staying on npm leaves the documented architecture unreachable |
| D2 | Twelve packages, not fourteen | `smt-mtf`, `project-archive` and `testing` have no code. An empty package is scaffolding for later, which the repository rules forbid. | Creating all fourteen now |
| D3 | App shell at `apps/studio`, still a Vite SPA | The documented shell path, with the Next.js swap isolated to one package when it is approved. | Keeping the app at the repository root leaves no seam for the swap |
| D4 | Package consumption: built `dist/`, with a `development` export condition pointing at source | Dev and Vitest resolve source through the `development` condition, so there is no stale-build class of bug; production and the Remotion webpack bundler resolve `dist/`. The build graph is real, which is what makes Turborepo worth having. | Source-only consumption leaves Turborepo with no graph and the package boundaries unenforced |
| D5 | One root Vitest configuration, include globs over `packages/*/src` and `apps/*/src` | The existing suite already runs this way and 26 test files do not justify per-package configuration. | Per-package Vitest configs |
| D6 | Keep all 22 generic elements | `REMOCN-CATALOGUE.md` §3 finds not one upstream replacement for any element, and the repository owner confirmed generic elements such as text and html stay. | Pruning, which would require a project migration and retire the upstream demo assets |
| D7 | A transition slot is designed before any transition component is adopted | `REMOCN-CATALOGUE.md` §6.5: the object model has nowhere to put a `presentation()` wrapper. | Adopting transitions first, with no place to mount them |
| D8 | Remocn wave 1 is six new motion elements, not replacements | `REMOCN-CATALOGUE.md` §6.3 names the candidates; §3 shows upstream is additive. | Replacing existing elements, which the analysis rules out |
| D9 | Verbatim upstream copies move to `vendor/remocn/`, outside the compiled source tree | The component contract §4.5 requires the upstream licence and revision to travel with the copied code, and the current location makes them look like application source while being unable to compile. | Deleting them, or leaving them in `src/` behind a shim |
| D10 | `evaluateBarsAtFrame` and `ChartFrameState` live in `market-data`, not `domain` | They are market-time mapping, and `domain` must stay free of trading concepts. `TECHNICAL_ARCHITECTURE.md` §3 files "time models and frame identity" in the domain chapter, so this is a deliberate reading of that section and is flagged for review. | Moving them to `domain` |

## 5. Target workspace

```text
chart-studio/
  package.json                    private, packageManager: pnpm@10.28.2, scripts only
  pnpm-workspace.yaml             packages: ['apps/*', 'packages/*']
  turbo.json                      tasks: build, typecheck, test, dev
  pnpm-lock.yaml                  replaces package-lock.json
  tsconfig.base.json              shared compiler options
  vitest.config.ts                one root configuration, projects across apps and packages
  apps/
    studio/                       the editor shell — Vite SPA today, Next.js later
  packages/
    domain/                       project, scene, clip and object schemas
    market-data/                  candles, series, sessions, time mapping
    chart-renderer/               pure evaluated chart to React/SVG
    trading-components/           candlestickChart and the nine trading objects
    generic-components/           the 22 inherited generic elements
    motion-components/            adapted Remocn source and provenance
    scene-compositor/             Remotion composition and transitions
    editor-core/                  commands, history, selection coordination
    timeline/                     project and scene timeline UI
    storage-sqlite/               single database worker, queries, migrations
    ui/                           shadcn wrappers, inspector and library UI
    export/                       render configurations, freeze, local export
  vendor/
    remocn/                       verbatim upstream source, never bundled
```

`apps/render-worker/` is documented but deferred — there is no server renderer in this product.

### 5.1 Package consumption

Every internal package carries the same shape:

```jsonc
{
  "name": "@chart-studio/domain",
  "private": true,
  "type": "module",
  "exports": {
    ".": {
      "development": "./src/index.ts",   // Vite dev and Vitest
      "types": "./src/index.ts",
      "default": "./dist/index.js"       // production build and the Remotion bundler
    }
  },
  "scripts": {
    "build": "tsc -p tsconfig.build.json",
    "typecheck": "tsc --noEmit -p tsconfig.json",
    "test": "vitest run"
  }
}
```

Cross-package imports use the package's own name and the pnpm `workspace:*` protocol. No TypeScript path
aliases cross a package boundary — the dependency is declared in `package.json`, which is what enforces the
documented ownership rules mechanically rather than by convention.

Consequences that the implementation plan must handle:

- A package may only import a package listed in its own `dependencies`.
- `packages/ui` and `packages/motion-components` carry `react` as a peer dependency.
- `packages/export` is Node-only and has no React dependency.
- Global CSS stays with the application (`apps/studio/src/index.css`); `packages/ui` ships class names and
  depends on the CSS variables the application defines.

## 6. Ownership map

| Current path | Target | Notes |
|---|---|---|
| `src/types.ts` | `packages/domain/src/types.ts` | `ElementType`, `EffectType`, `Clip`, `Track`, `Project`, `ParamDef` |
| `src/project/migrate.ts`, `src/project/migrate.test.ts` | `packages/domain/src/project/` | the only place a stored document is reshaped |
| `src/registry/types.ts` | `packages/domain/src/registry/types.ts` | the component contract |
| `src/registry/registry.ts` | `packages/domain/src/registry/registry.ts` | the registration mechanism |
| `src/registry/registry.test.ts` | `packages/domain/src/registry/` | |
| `src/sampleProject.ts` | `packages/domain/src/project/sample-project.ts` | a project document factory |
| `src/trading/ohlc.ts`, `src/trading/ohlc.test.ts` | `packages/market-data/src/` | `OhlcBar`, `BarRevealMode`, `PartialBar`, `ChartFrameState`, `generateSyntheticBars`, `evaluateBarsAtFrame`, `computePriceRange`, `barsToFrames` |
| `src/trading/candlestick-chart.tsx` | `packages/chart-renderer/src/` | evaluated chart to SVG |
| `src/trading/definition.ts`, `src/trading/candlestick-chart-inspector.tsx`, `src/trading/candlestick-chart.test.tsx` | `packages/trading-components/src/` | manifest, params, inspector, render adapter |
| `src/registry/legacy.ts` | `packages/generic-components/src/definitions.ts` | the 22 generic element definitions |
| `src/remotion/legacy-elements.tsx`, `src/remotion/scenes.tsx` | `packages/generic-components/src/` | their render adapters |
| `src/effects.ts` | `packages/generic-components/src/effects.ts` | the 35-type effect stack |
| `src/motion-components/**` | `packages/motion-components/src/` | |
| `src/motion-components/upstream/**` | `vendor/remocn/` | verbatim, never bundled |
| `src/motion-components/upstream-modules.d.ts` | deleted | existed only to compile the copies above |
| `src/motion-components/LICENSE.remocn`, `PROVENANCE.md` | `packages/motion-components/` | travel with the copied source |
| `src/remotion/MainComposition.tsx` | `packages/scene-compositor/src/` | |
| `remotion/Root.tsx`, `remotion/index.ts` | `apps/studio/remotion/` | the Remotion entry point |
| `src/store.ts`, `src/store.test.ts`, `src/playerRef.ts` | `packages/editor-core/src/` | |
| `src/components/timeline/**` | `packages/timeline/src/` | |
| `src/storage/**` | `packages/storage-sqlite/src/` | `types.ts`, `contract-suite.ts`, `select.ts`, `useWorkspace.ts`, `sqlite/*`, `local/*` |
| `src/components/ui/**`, `src/components/inspector/**`, `src/components/library/**`, `src/lib/utils.ts` | `packages/ui/src/` | |
| `render.mjs`, `server.mjs` | `packages/export/src/` | Node-only; `@remotion/bundler` and `@remotion/renderer` become dependencies |
| `src/App.tsx`, `src/main.tsx`, `src/index.css`, `src/lib/theme.tsx` | `apps/studio/src/` | |
| `src/components/Library.tsx`, `Inspector.tsx`, `PreviewPanel.tsx`, `RenderDialog.tsx`, `SelectionOverlay.tsx`, `selection-overlay.tsx`, `canvas-hit-test.ts`, `StorageIndicator.tsx`, `theme-toggle.tsx`, `HelpModal.tsx`, `ToolRail.tsx`, `TopBar.tsx` | `apps/studio/src/components/` | the editor shell |
| `src/presets.ts` | `apps/studio/src/presets.ts` | the starter catalogue composes registered components |
| `src/registry/index.ts` | `apps/studio/src/registry.ts` | the composition root: imports all 26 definitions and registers them |
| `index.html`, `vite.config.ts`, `components.json` | `apps/studio/` | |

The registry aggregator moves to the application because it must import all three families, and
`packages/domain` must not import the families — the families import the contract from `domain`.

## 7. Component family model

Every registered component keeps the contract the repository already enforces: `type`, `label`, `icon`,
`description`, `category`, `defaults`, `params`, `render`, `provenance`, `bounds`, `propsVersion`,
`defaultDuration`. `category` gains the three values `generic`, `trading` and `motion`, and the library
panel groups by it. The `type` union is unchanged, because no component is renamed.

| Family | Category | Package | Components |
|---|---|---|---|
| Generic | `generic` | `generic-components` | text, shape, image, emoji, background, video, audio, gif, counter, wave, blob, particles, html, cursor, synthGrid, neonSun, isoCity, skyCycle, sunMoon, ridge, commitGraph, nodeTrail |
| Trading | `trading` | `trading-components` | candlestickChart, and the nine planned objects: HighLowLine, HorizontalPriceLine, TrendLine, PriceZone, LongShortPosition, Arrow, TextLabel, SMTComparison, ChartGroup |
| Motion | `motion` | `motion-components` | the three adopted Remocn components, plus the wave of §9 |

`type` identifiers are never renamed, renumbered or reused. Adding a family changes a component's
`category`, not its `type`, so no saved project is invalidated by this reorganisation.

## 8. Transition slot

A transition belongs to the boundary between two clips on a track, not to a clip. The track gains an
optional transition list:

```ts
export interface TrackTransition {
  /** The clip the transition starts from. */
  fromClipId: string;
  /** The registry item name of the transition component. */
  type: string;
  /** Duration in frames. */
  durationInFrames: number;
}
```

The track type gains `transitions?: TrackTransition[]`. This is a stored-document change and therefore a
schema migration, using the same pattern and the same migration identifier discipline as
`src/project/migrate.ts`: the schema version is bumped, the old shape migrates to the new one, and a
document from a newer version is rejected by name.

`@remotion/transitions` components are `presentation()` wrappers that own a scene boundary. The scene
compositor renders a track's clips in sequence and wraps each declared boundary in its transition. A
transition's duration must fit inside the adjacent clips' frames, or the compositor clamps it and the
inspector reports the clamp — it never silently overlaps a clip.

## 9. Remocn adoption

### 9.1 Wave 1

Six components, added as new motion elements, named in `REMOCN-CATALOGUE.md` §6.3 and §5:

| Component | Why it fits a trading video |
|---|---|
| `cursor` | Points at a candle, a level, a divergence marker |
| `simulated-cursor` | A drawn path with click and drag phases — a recording of a review session |
| `backdrop` | A richer fill than the solid and gradient backgrounds we have, including an image or a live element |
| `drift` | A slow push so a static chart is never frozen |
| `impact-shake` | Punctuation when a level breaks — upstream: "a launch word, a price or a logo should land like it weighs a ton" |
| `flow-field` | Seeded trails behind a chart |

Each needs a hand-written registry definition with the full contract, and a `provenance` entry naming the
upstream registry item, its revision and its MIT licence.

### 9.2 Rules for every adoption

1. **The composition-length gotcha.** An upstream component that reads `useVideoConfig().durationInFrames`
   computes its reveal against the whole composition, which is wrong inside our per-clip `<Sequence>`.
   Every adopted component reads `fps` only, or receives its progress as a prop.
2. **`speed` is the only retiming lever.** Upstream components have no duration prop. The registry
   definition's `defaultDuration` equals the upstream reveal length at 30 fps, and the component holds
   afterwards rather than looping or vanishing.
3. **Provenance travels with the copy.** The verbatim upstream file lands in `vendor/remocn/`, the adapted
   copy sits beside it, and `PROVENANCE.md` records the upstream URL, the retrieval date, the licence and
   the enumerated local modifications. The verbatim copy is outside the compiled source tree, so it is a
   record rather than code that must compile.
4. **Additions, not replacements.** An adopted component gets a new `type`. It never takes over an
   existing element's slot.
5. **No runtime dependency.** Remocn is a source registry, not a package. Nothing is added to
   `dependencies` for these six.

### 9.3 Dependency cost of the wider catalogue

`REMOCN-CATALOGUE.md` §2 records that adopting whole upstream families concentrates npm cost in four
packages: `@remotion/transitions`, `@remotion/captions`, `@paper-design/shaders-react` and
`@remotion/google-fonts`. Wave 1 needs none of them — all six components are Remotion-only. Transitions
will need `@remotion/transitions`, which is planned with the transition slot rather than with wave 1.
Captions need a transcript timeline that does not exist, so they stay out of scope.

## 10. Toolchain

| Concern | Choice |
|---|---|
| Package manager | pnpm 10.28.2, pinned through the root `packageManager` field |
| Node | v24.20.0, declared in `engines` |
| Lockfile | `pnpm-lock.yaml`; `package-lock.json` is deleted |
| Task runner | Turborepo, with `build` ordered by dependency and cached per package |
| Typecheck | per-package `tsc --noEmit -p tsconfig.json`, turbo-cached |
| Build | per-package `tsc` to `dist/`, then `apps/studio` builds with Vite |
| Tests | one root Vitest configuration; Node by default, jsdom opted into per file |
| Dev | `turbo run dev` — the shell plus the local render server |
| CI | `pnpm install --frozen-lockfile`, then `turbo run typecheck test build`, then a real Remotion render |

### 10.1 The pnpm lifecycle-script trap

pnpm 10 blocks dependency lifecycle scripts unless they are explicitly allowed. The repository currently
carries an npm-shaped `allowScripts` block permitting esbuild. Under pnpm this becomes:

```jsonc
{
  "pnpm": {
    "onlyBuiltDependencies": ["esbuild"]
  }
}
```

If esbuild's postinstall is blocked, Vite fails on first run with a native-binding error. This is the
first thing the implementation plan verifies, before any file moves. `@sqlite.org/sqlite-wasm` is also
checked for a postinstall requirement and added to the allowlist if it has one.

### 10.2 Dependency adoption record

Required by `AGENTS.md` before a dependency is proposed.

| Field | Turborepo |
|---|---|
| Exact package and version | `turbo` 2.11.10, pinned exactly in `pnpm-lock.yaml` |
| Licence | MIT |
| Runtime and browser support | Node-only; it never ships to the browser bundle |
| Tree-shaking and bundle consequences | none — a development-time task runner, absent from the client bundle |
| Security posture | no runtime dependencies of its own, no network access at task time, no postinstall script, no transitive native code |
| How it improves on what exists | replaces twelve independent typecheck and build invocations with one cached, dependency-ordered graph |
| Exit strategy | deleting `turbo.json` and the `turbo run` wrappers; the per-package scripts remain valid on their own |

pnpm is a tool, not a dependency, and carries the same properties: MIT, Node-only, no client bundle
impact, no postinstall of its own.

## 11. Documentation and ADRs

| Document | Change |
|---|---|
| `AGENTS.md` | After the move, the pnpm, Turborepo and `packages/*` claims become true. Next.js App Router becomes "the shell is a Vite SPA under `apps/studio`; see ADR-004". dnd-kit is corrected to "not adopted; the timeline keeps its own pointer handling". The package-boundary paragraph is replaced with the §6 map. |
| `docs/architecture/UPSTREAM_AUDIT.md` §7 | The `packages/*` to `src/*` table is replaced by the §6 map; the audit trail itself stays. |
| `docs/architecture/TECHNICAL_ARCHITECTURE.md` | §2 gains the three component families and the `apps/studio` reality. The other 480 lines stay as the behavioural contract. |
| `docs/roadmap/ROADMAP.md` | R1 and R2's persistence items are ticked against the code; the import items stay unticked until Phase 3. The workstream table's `apps/studio`, `packages/*` paths become real. The numbering collision with `UPSTREAM_AUDIT.md` is recorded. |
| `docs/quality/TEST_STRATEGY.md` | The "no implemented app, no runnable test suite" claim is removed. Playwright and the named fixture files are marked not present. |
| `DOCS.md` | The pre-registry `ELEMENTS` map becomes the registry; the element count becomes 26, grouped by family. The library's tabs, the 14 presets and the SQLite autosave path are corrected. |
| `docs/architecture/REMOCN-CATALOGUE.md` | The "23 elements" count becomes 26, and §5 gains the wave 1 outcome. |
| `docs/decisions/ADR-004-SHELL-TECHNOLOGY.md` | **New.** The Vite SPA shell is retained; Next.js is deferred with the reason, the trigger to revisit, and the requirement that the domain and renderer packages stay unchanged either way. |
| `docs/decisions/ADR-003-COMPONENT-SYSTEM.md` | **Addendum.** The three family packages, the transition slot, and the adoption rules of §9.2. |

## 12. Cleanup

| Action | Path | Reason |
|---|---|---|
| Delete | `scripts/gen-showcase.mjs` | its only output is `examples/showcase.json`; it imports a `/tmp/presets-bundle.mjs` no script produces |
| Delete | `scripts/preset-stills.mjs` | same broken import; nothing references it |
| Delete | `examples/showcase.json` | a 51 KB generated artefact nothing references |
| Delete | `src/motion-components/upstream-modules.d.ts` | existed only to compile the verbatim copies, which move out of the source tree |
| Move | `src/motion-components/upstream/` to `vendor/remocn/` | never bundled, cannot compile against itself, and reads as application source |
| Keep | `examples/hyperframe-style-launch.json`, `examples/gen-hyperframe-demo.mjs` | live and referenced |
| Keep | `public/docs/`, `docs-gifs.mjs` | the hosted demo surface and its generator |
| Keep | `docs/reference/remocn/` (63 KB + 117 KB + 262 KB) | the evidence base every adoption decision is re-checked against |
| Keep | all 22 generic elements | D6 |

## 13. Phases and acceptance gates

Every phase ends green. No phase changes editor behaviour except where stated.

Each phase is delivered as its own implementation plan under `docs/superpowers/plans/`, written with the
`writing-plans` skill, naming exact files, interfaces and tests — the convention `TECHNICAL_ARCHITECTURE.md`
§18 sets for this repository. Phase 1 is the only plan written before this spec is approved; the later
plans are written as their phase approaches, so each is reviewed against a codebase the previous phase
actually produced.

### Phase 1 — Platform

pnpm workspace, the twelve packages, the §6 ownership map applied, Turborepo, the root Vitest
configuration, CI, ADR-004, the §11 documentation corrections, the §12 cleanup.

| Gate | Check |
|---|---|
| Typecheck | `turbo run typecheck` — twelve packages, zero errors |
| Tests | `turbo run test` — the same 153 tests, same names, same results |
| Build | `turbo run build` produces `apps/studio/dist` |
| Render | `node packages/export/src/render.mjs` produces an MP4 whose logical frames match the preview |
| Boundary | no package imports a package absent from its own `package.json` |

### Phase 2 — Catalogue

The three families, the library grouped by category, the six wave 1 Remocn components, the transition
slot and its migration.

| Gate | Check |
|---|---|
| Typecheck and tests | as Phase 1, plus new tests for the transition slot and each adopted component |
| Preview and export parity | every wave 1 component renders identical logical frames in `<Player>` and in the exported MP4 |
| Transition | a transition renders between two clips on a track in the export path, and a project written before the schema bump still opens |
| Provenance | every adopted component's verbatim upstream source is in `vendor/remocn/`, its adapted copy is beside it, and `PROVENANCE.md` records the item, revision, licence and modifications |

### Phase 3 — Data

ROADMAP R2's remaining half: CSV and JSON import, provenance, the source-bound chart.

| Gate | Check |
|---|---|
| Import | a CSV and a JSON file both import; malformed rows are reported with their row number and skipped, not fatal |
| Immutability | the imported bars are never mutated; creator edits live in an overlay keyed by the original bar's timestamp, and "reset to source" restores the original |
| Provenance | the dataset's origin, import time, timestamp convention, session and price basis stay visible in the inspector |
| Reload | the dataset survives a reload, per R2's gate: "roundtrip project and dataset survive reload" |
| No leakage | a chart bound to an imported source never shows a bar that does not exist at the current market time |

### Phase 4 — Trading objects

The nine trading components on the timestamped anchor model.

| Gate | Check |
|---|---|
| Anchoring | a drawing anchored to a price and a timestamp follows the chart through pan, zoom and replay |
| No leakage | an HTF value is never visible before the HTF bar closes, unless explicitly labelled as retrospective |
| Parity | preview and export match at the beginning, middle, transition and end of a composition |
| Workflow | one complete creator workflow from `docs/scenarios/VIDEO_SCENARIOS.md` runs end to end |

## 14. Verification matrix

| Phase | Typecheck | Tests | Build | Real render | Browser | Documentation |
|---|---|---|---|---|---|---|
| 1 | per package | full suite | full | MP4 from `project.json` | editor opens, edits, saves, exports | §11 complete, ADR-004 merged |
| 2 | per package | + transition, + wave 1 | full | MP4 including a transition | new components in the library, grouped by family | catalogue count and wave recorded |
| 3 | per package | + importer, + source binding | full | MP4 from an imported dataset | import, preview, reload, edit | R2 ticked |
| 4 | per package | + each trading object | full | MP4 per scenario | full creator workflow | R3 ticked |

A real render is required in every phase. A passing test suite is not proof that the video path works.

## 15. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| The ownership map is a large mechanical move | an import graph break that looks like an application bug | Phase 1 permits no behaviour change; the gate is a green suite plus a byte-comparable render |
| `moduleResolution: bundler` with workspace symlinks and `exports` conditions | resolution failures, or dev resolving `dist/` while source changed | each package exports `types` explicitly; the conditions are verified on one package end to end before the rest move |
| The Remotion bundler is webpack, not Vite | the export path resolves packages differently from the dev server | `render.mjs` runs after `turbo run build`; the render gate in every phase covers it |
| pnpm 10 blocks lifecycle scripts | esbuild or sqlite-wasm fails at first run | the allowlist is the first task in Phase 1, verified before anything moves |
| The transition slot changes the stored document | projects written before the change fail to open | a schema-version migration following the existing pattern, exercised by a test |
| The generic effect stack is shared by many elements | moving `src/effects.ts` breaks several components at once | `generic-components` moves as one unit with its own definition file; the suite covers it |
| The package boundary rules become convention only | a package quietly imports another it should not | the dependency check in the Phase 1 gate, run in CI |

## 16. Open questions for review

1. **D10** — `evaluateBarsAtFrame` and `ChartFrameState` in `market-data` or `domain`? This spec places
   them in `market-data`, because `domain` must stay free of trading concepts, even though
   `TECHNICAL_ARCHITECTURE.md` §3 files "time models and frame identity" in the domain chapter.
2. **The transition's home** — the design places transitions on the track boundary. The alternative is a
   transition attached to the outgoing clip. The track form makes the overlap explicit and keeps the clip's
   own frame range honest.
3. **The generic family name** — `generic-components` versus `base-components`. The repository owner
   suggested "generic or base". This spec uses `generic`.
4. **Wave 1 size** — six components. If the reviewer wants a smaller first wave, `cursor`, `backdrop` and
   `drift` are the three with the lowest adoption cost and carry no dependency.
