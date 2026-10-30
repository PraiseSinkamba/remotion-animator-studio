# Chart Studio — authored swing paths, chart elements and playback control — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the creator-facing sentence true: draw the shape of a move, let the app turn that shape into candles, then control every element of the result — the candle, the line, the arrow, the pane, the curve — individually and as a whole.

**Architecture:** Eleven vertical slices over one object model. Project schema version 2 lifts market data out of the chart clip into a project-level `series` registry consumed by reference through a pure datasource seam (`materialiseSeries`). A chart clip becomes a collection of elements: `PaneSpec[]` inside the chart props, market-linked drawings as sibling `Clip`s that name a `chartClipId` and a `paneId` and store `MarketAnchor`s rather than pixels. A shared `MarketClock` with an explicit `ClockBinding` replaces row-index alignment. One pure curve evaluator in `packages/core` drives element, pane and per-candle motion; the legacy Remotion `Easing` vocabulary for effects is extended, never rewritten. The component contract gains two optional fields — `evaluate` and `transportActions` — so components declare and the shell executes.

**Tech Stack:** pnpm 10.28.2, Turborepo 2.11.10, Node 24.20.0, TypeScript 5.6.3, Vite 5.4.11, React 18.3.1, Remotion 4.0.538, Zustand 5.0.3, Tailwind CSS 4.3.3, Vitest 3.2.7, Zod 4.5.4 (new, `packages/core` only)

**Design spec:** `docs/superpowers/specs/2026-10-29-chart-studio-authored-path-and-chart-elements-design.md` (edition 1.0). Decisions: `docs/decisions/ADR-007-CHART-ELEMENT-MODEL.md`, `docs/decisions/ADR-008-ZOD-DOMAIN-SCHEMAS.md`.

**Companion docs this plan updates as it goes:** `docs/spec/FUNCTIONAL_SPEC.md` (§2, §3, §5), `docs/spec/COMPONENT_CONTRACT.md` (§2, §3, §6), `docs/roadmap/ROADMAP.md` (§2, R2.5), `docs/quality/TEST_STRATEGY.md` (§3).

---

## Global Constraints

- `packages/core` imports no React, Remotion, Zustand or storage code at runtime. Its only React contact stays the type-only import at `packages/core/src/contract.ts:1`.
- Cross-package imports use the package name and `workspace:*`. No TypeScript path alias crosses a package boundary. A package's relative imports stay extensionless; one tsconfig per package; typecheck only, no `dist`.
- Zod lives in `packages/core` only, imported as `import * as z from 'zod/v4'`, pinned exactly at `4.5.4`. Validators cross the package boundary as plain `{ ok: true, value }` / `{ ok: false, issues }` results — no consumer outside core names a Zod symbol (ADR-008).
- Every project data type is a strict TypeScript discriminated union. `Clip.props` stays `Record<string, any>` at the type level in this slice (ADR-008 §"Not migrated in this slice"); the new shapes are typed unions with runtime Zod counterparts.
- The migration stays non-destructive and idempotent: `migrateProject(migrateProject(p))` deep-equals `migrateProject(p)`, and unknown keys survive. The migration keeps its history-dependent rejections (higher `schemaVersion`, unknown component type, newer clip `propsVersion`) — ADR-008 §"The migration boundary".
- No component `type` is renamed, renumbered or reused. New drawing types are added at the end of the `ElementType` union (`packages/core/src/schemas.ts:1-31`). A registered type that no library tab names does not appear in the library (`packages/ui/src/components/library/catalog.tsx:14-42`).
- `sideEffects: false` is not declared for `packages/components`; its definitions self-register (`packages/components/src/registry.ts:11-16`).
- Local-first holds: no network call, login or server is needed to edit, save, preview or export.
- Remotion packages stay pinned to `4.0.538`. React stays on `18.3.1`.
- Determinism is structural: path → series → candles → frame state is a chain of pure functions in `packages/core`. No clock, no unseeded randomness, no editor state. The same snapshot and frame index produce the same frame.
- No lookahead by construction: a pane's visible bars are those at or before the as-of index; an `auto` price range is computed from revealed bars only; a coarser bucket aggregates only eligible constituents.
- Provenance is never lost: a series carries its origin; a generated series carries seed and algorithm version; a simulated intrabar path is labelled in the editor and in the export.
- Components declare, the shell executes. No component name is hardcoded in `apps/studio` for transport actions, tools or inspector panels.
- The render gate `node scripts/verify-r1.mjs` is required after every slice that touches rendering. The suite alone is not proof that a change reached the video path.
- Every task ends with a commit. Every task names the files it touches and the interfaces it consumes and produces.
- **Honesty rule for this plan and for every executor of it:** planned work is phrased as "the slice asserts" and "the executor must report". No slice may claim a test passed or a build succeeded on the strength of this document. Anything not exercised is reported as unverified.

---

## Open questions this plan proceeds on


| #   | Default implemented                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | If overridden                                                                                                                                                                       |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Q1  | The chart's single pane uses the full chart rect (0,0,1,1) and keeps today's inner geometry (`CHART_PADDING`, `CHART_TOP`, `CHART_BOTTOM`, `PRICE_AXIS_WIDTH` — `packages/components/src/trading/chart.tsx:37-47`) inside the pane. A v1 document therefore renders identically after migration.                                                                                                                                                                                                                      | If panes own their own padding model, Task 1 grows a geometry migration and the render-gate still comparison moves to Task 2.                                                       |
| Q2  | Schema v2 keeps the legacy `bars` array on a migrated chart clip as an inert compatibility key; the renderer ignores it from Task 2 onward.                                                                                                                                                                                                                                                                                                                                                                           | If v2 must be free of `bars`, Task 1 must introduce the render-to-project seam before the chart can render at all — that pulls Task 2's contract work forward and blocks the pilot. |
| Q3  | `generateSeriesFromPath` lands with the data model in Task 1 (the seam needs it to materialise an `authored-path` series) and is pinned by the normative test suite in Task 3.                                                                                                                                                                                                                                                                                                                                        | If the generator must arrive only with its test suite, `materialiseSeries` cannot accept an `authored-path` spec in Task 1 — the seam ships with one origin short.                  |
| Q4  | The seeded PRNG and hash are **exported** from `packages/core/src/market.ts` (currently module-private at `:44-63`) and reused by `path.ts` and `series.ts`. No second implementation.                                                                                                                                                                                                                                                                                                                                | If they stay private, `path.ts` and the revision hash need their own copies — two sources of truth for determinism.                                                                 |
| Q5  | Duration is not engine-capped. 240 frames / 8 s is the seeded sample project's value (`packages/core/src/sample-project.ts:8`, `project.json:6`, `scripts/verify-r1.mjs:35`); the seconds field allows 1–3600 (`apps/studio/src/components/TopBar.tsx:404-414`); the migration accepts any positive `durationInFrames` (`packages/components/src/project-migrate.ts:100-101`).                                                                                                                                        | Nothing to override. Stated because the brief asked; Task 10 changes the *mode*, not the ceiling.                                                                                   |
| Q6  | The three owner decisions in ADR-007 stand as recorded: drawings are clips, the legacy effect easing vocabulary stays on Remotion's `Easing`, and the relation between panes is declared in one of two kinds — a rollup (one asset at two timeframes, exact by construction) or a lockstep (two assets on one timeframe moving together with the same number of candles). A cross-asset lockstep link is **authored** until an importer provides a real market clock, and is labelled as such (spec §10, decision 2). | Each is an owner decision with a recorded alternative in `docs/decisions/ADR-007-CHART-ELEMENT-MODEL.md` §"Owner decisions".                                                        |


---

## Slice priority and the pilot

The slices are ordered by dependency, not by appeal. The order is fixed: **S0 → S1 → S2 → S3 (pilot) → S4 → S5 → S6 → S7 → S8 → S9 → S10.**

**S3 is the pilot slice.** It is the first slice a creator can feel, and it is the first slice that exercises the whole stack end to end: a path tool on the canvas, anchor placement, anchor drag regenerating the series live, preview and export agreeing, and the provenance badge reading `AUTHORED PATH`.

Why S3 and not something earlier:

- **S0, S1 and S2 are invisible to a creator.** S0 is a document model, S1 is a contract extension, S2 is a pure generator. A creator looking at any of them sees nothing new; the only way to judge them is a test, and a test proves the model is consistent, not that the model is usable. A pilot that needs a user to be excited cannot be built on slices whose output the user cannot perceive.
- **S3 is the first slice that can falsify the model.** If anchor-drag regeneration feels wrong, if the candle body does not read as the drawn path, if the preview and the export disagree — every one of those failures is a design failure in S0/S1/S2, and S3 is where it becomes visible. Shipping S0–S2 first and calling the model proven would be exactly the "compiling scaffold" failure the slice rules forbid.
- **S3 keeps the model honest about scope.** It uses the authored-path origin, the pane, the clock, the curve default and the provenance badge — the whole chain — with one drawing kind of surface area (the path itself). It is the smallest slice that touches every layer.

Why not the deferred import work as the pilot:

- **There is nothing to pilot.** Import is deferred to a seam only (spec §1.2): no importer, no file reading, no wizard, no `origin: 'imported'` producer in this slice. A pilot needs a user-visible outcome; the import seam has none until an importer exists, which is a later slice by definition.
- **The import seam's risk is not its value.** The seam's risk (R9: scope creep into the importer) is mitigated by *not* building the importer. Piloting the import work would argue for building the very thing the plan defers.
- **The import path would teach the wrong lesson.** Imported bars carry real UTC timestamps; authored bars carry logical indices. Piloting on the UTC path would validate the as-of and session machinery that is itself deferred (TF-001/002/006/007), and would make the authored-path model look incidental rather than primary.
- **The authored path is the differentiating feature.** It is the one thing in this slice that no competitor of the same shape offers: draw the shape, get candles that follow it. It is also the feature that most stresses the model — a path is not a bar array, so it forces the series registry, the revision hash and the anchor model to be right.

Why not a later slice (S4 drawings, S5 panes, S7 curves) as the pilot:

- **S4 depends on S1 and S2 and on the anchor-resolution seam, and its demo is a set of eight tools** — a poor pilot: broad, shallow, and mostly a UI-integration exercise by the time the drawing kinds land.
- **S5 depends on the clock semantics that the spec itself calls the narrowest point in the design** (§1.3, the authored-offset decision). Piloting there would mean piloting the most contested decision rather than the most representative loop.
- **S7 curves are an enhancement to a motion vocabulary that already exists.** The creator can already see curves working; piloting there proves little about the new model.

---

## Dependency order

```text
S0 foundation ──► S1 evaluate contract ──► S2 path authoring ──► S3 PILOT
     │                                                 │
     │                                                 ▼
     │                                            S4 drawings
     │                                                 │
     │                                                 ▼
     └──────────────────────────────────► S5 panes + clock
                                                       │
                                                       ▼
                                                  S6 holds
                                                       │
                                                       ▼
                                                  S7 curves
                                                       │
                                                       ▼
                                              S8 transitions
                                                       │
                                                       ▼
                                        S9 transport + duration
                                                       │
                                                       ▼
                                        S10 inspector + provenance
```

Precise unblocking rules:


| Slice | Unblocks                | Because                                                                                                                                             |
| ----- | ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| S0    | S1, S2, S5, S7, S9, S10 | The `series` registry, `Project.series`, `Project.durationMode`, `Curve`, `PaneSpec` and the v2 document are the substrate everything else reads.   |
| S1    | S3, S4, S5, S8, S9      | `evaluate` is how a drawing or a pane reaches the project snapshot at a frame; without it a market-anchored element cannot resolve.                 |
| S2    | S3                      | The pilot needs a deterministic generator to regenerate on anchor drag.                                                                             |
| S3    | S4                      | The pilot proves the series registry, the revision hash and the provenance badge work under live editing; the drawing tools build on the same seam. |
| S4    | S5, S8                  | Drawings are clips anchored to a chart's pane; the pane model must exist before drawings can be resolved against more than one pane.                |
| S5    | S6, S7                  | Holds and the camera zoom track are per-pane; per-candle curves are per-pane too.                                                                   |
| S6    | S7                      | A held pane changes what "the frame state" means for a curve.                                                                                       |
| S7    | S8, S10                 | Transitions and the final inspector consume the curve vocabulary and its widget.                                                                    |
| S8    | S9                      | The transport bar and the duration slider are chrome changes on top of a composition that already renders transitions.                              |
| S9    | S10                     | The final inspector and the export provenance report the duration mode and the transport actions.                                                   |
| S10   | —                       | Final sweep.                                                                                                                                        |


Slices that do not strictly depend on the previous one, and may run in parallel once their own precondition is met: S2 with S1 (both only need S0); S5's clock semantics with S4's drawing resolution (both need S1+S3). S7's per-candle curve work may start once S6 lands.

---

## File Structure


| Path                                                    | Responsibility                                                                                                                                              |
| ------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `packages/core/src/series.ts`                           | `SeriesOrigin`, `SeriesSpec`, `Datasource`, `materialiseSeries`, `seriesRevision`, and the canonical `OhlcBar` (moved from `market.ts`, now carrying `id`). |
| `packages/core/src/path.ts`                             | `SwingAnchor`, `SwingPath`, `generateSeriesFromPath` (the normative algorithm), and the pure authoring operations on a path.                                |
| `packages/core/src/elements.ts`                         | `PaneSpec`, `PaneHold`, `ZoomTrack`, `MarketAnchor`, `DrawingKind`, `DrawingSpec`, `MarketClock`, `ClockBinding`, `ChartStyle`.                             |
| `packages/core/src/curve.ts`                            | `CurvePreset`, `Curve`, `evaluateCurve` — one pure evaluator, no Remotion import.                                                                           |
| `packages/core/src/time.ts`                             | `PaneFrameState`, `evaluatePaneAt`, `evaluateClockAt` — the one function that produces a pane's frame state.                                                |
| `packages/core/src/validation.ts`                       | Zod-backed validators for the new shapes, exported as plain `{ok,value}` / `{ok,issues}` results. The only module in the workspace that names a Zod symbol. |
| `packages/core/src/duration.ts`                         | `derivedDuration(project)` — the derived-duration calculation (Task 10).                                                                                    |
| `packages/core/src/transition.ts`                       | `clampTransitionDuration` — the boundary clamp (Task 9).                                                                                                    |
| `packages/core/src/provenance.ts`                       | `buildProvenance(project)` — the export provenance record (Task 11).                                                                                        |
| `packages/core/src/market.ts`                           | Unchanged maths, plus the exported `hashString` / `createRng` reused by the path generator and the revision hash.                                           |
| `packages/core/src/schemas.ts`                          | The document types: `Project.series`, `Project.durationMode`, the extended `ElementType` union, `Track.transitions`, `Clip.locked` / `Clip.hidden`.         |
| `packages/core/src/contract.ts`                         | The component contract: `evaluate`, `transportActions`, `TransportAction`, `ComponentRenderContext.evaluated`.                                              |
| `packages/components/src/trading/chart.tsx`             | The chart renderer: panes, price range policy, provenance badges, per-candle growth curve.                                                                  |
| `packages/components/src/trading/drawings/`             | The eight market-linked drawing adapters (Task 5).                                                                                                          |
| `packages/components/src/trading/definitions/`          | One definition module per registered trading component; each self-registers.                                                                                |
| `packages/components/src/project-migrate.ts`            | The v1 → v2 migration and `CURRENT_PROJECT_SCHEMA_VERSION`.                                                                                                 |
| `packages/components/src/base/effects.ts`               | The effect catalogue and the extended easing vocabulary (Task 8).                                                                                           |
| `packages/editor/src/store.ts`                          | The commands: series edits, swing-path authoring, drawing creation, holds, transitions, duration mode.                                                      |
| `packages/ui/src/components/inspector/curve-editor.tsx` | The one curve widget, used by every surface that exposes a curve (Task 8).                                                                                  |
| `apps/studio/src/components/ToolRail.tsx`               | The tool rail: Select, Path, and the eight drawing tools.                                                                                                   |
| `apps/studio/src/components/PreviewPanel.tsx`           | The canvas: pointer handling for tools, and the generic transport action bar.                                                                               |
| `apps/studio/src/components/TopBar.tsx`                 | The duration mode toggle and the draggable duration slider.                                                                                                 |
| `packages/video/src/evaluate.ts`                        | `evaluateClip` — the pure per-clip evaluation the composition calls.                                                                                        |
| `packages/video/src/composition.tsx`                    | The composition: evaluation wiring, transitions, pane-aware rendering.                                                                                      |
| `scripts/verify-r1.mjs`                                 | The render gate. Its fixture grows a pane chart, a drawing, a curve and an authored-path series as the slices land.                                         |


---

## Risk table


| #   | Risk                                                                                                                              | Mitigating slice   | Proving test                                                                                                                                                                                                                                      |
| --- | --------------------------------------------------------------------------------------------------------------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | Anchor drift on resize — a price-anchored drawing detaches when the chart is resized or scaled.                                   | S4                 | `packages/components/src/trading/drawings/drawings.test.tsx` — "keeps a price line on its price when the chart rect changes".                                                                                                                     |
| R2  | Price-scale behaviour while the visible range changes — an anchored line slides if resolved against a stale scale.                | S0, S5             | `packages/core/src/time.test.ts` — "does not let a future bar move the price range"; the existing `packages/components/src/trading/candlestick-chart.test.tsx` — "never lets a future bar move the price scale" must keep its name and assertion. |
| R3  | Curve edits changing rendered frames — a loose curve parameter can make preview and export diverge.                               | S8                 | `packages/core/src/curve.test.ts` — "evaluates the same curve to the same value at the same t"; `packages/components/src/trading/candlestick-chart.test.tsx` — "renders a curve-driven frame the same way on a fresh render and on a seek".       |
| R4  | Cross-timeframe alignment without lookahead — a coarser pane leaking a future constituent into a partial bucket.                  | S6                 | `packages/core/src/time.test.ts` — "aggregates only the constituents at or before the as-of index".                                                                                                                                               |
| R5  | Regenerated candles not deterministic — dragging an anchor reshuffling the series, or the same drag giving different bars.        | S3                 | `packages/core/src/path.test.ts` — "is deterministic for the same path, seed and algorithm version"; `packages/editor/src/store.test.ts` — "regenerates identical bars after the same anchor move".                                               |
| R6  | Drawing lifecycle versus chart lifecycle — a drawing's `[in,out)` is chart-relative and must move with its chart.                 | S5                 | `packages/components/src/trading/drawings/drawings.test.tsx` — "moves a drawing with the chart clip it is anchored to".                                                                                                                           |
| R7  | Migration changing saved projects — lifting inline bars into a series changing the rendered frame.                                | S1                 | `packages/components/src/project-migrate.test.ts` — "lifts a v1 chart bar array into a project series"; `packages/components/src/trading/candlestick-chart.test.tsx` — "renders the migrated chart identically to the v1 chart".                  |
| R8  | Bundling a second easing vocabulary — two meanings of "easeOut".                                                                  | S8                 | `packages/components/src/base/effects.test.ts` — "keeps the legacy easing names meaning what they meant".                                                                                                                                         |
| R9  | Scope creep into the importer — the datasource seam inviting "just add CSV".                                                      | S0, and every task | `packages/core/src/series.test.ts` — "materialises an imported series as stored" and no file-reading module exists in the workspace; the deferred list in this plan names the importer as a later slice.                                          |
| R10 | A degenerate anchor bar — pinning the placed price to the bar's extreme instead of its close collapses it to zero range.          | S2                 | `packages/core/src/path.test.ts` — "gives every bar a non-zero range, including at an anchor" and "closes every anchor bar at the placed price exactly".                                                                                          |
| R11 | The path wandering off the drawing — the Brownian bridge is not clamped to the drawn band, so closes can overshoot their anchors. | S2                 | `packages/core/src/path.test.ts` — "keeps the excursion beyond the drawn band bounded relative to the configured volatility". The bound is relative, not zero; the drawn path is the skeleton, not a corridor.                                    |
| R12 | A tick grid collapsing a bar to zero range — the rounded high and low can land on the same tick.                                  | S2                 | `packages/core/src/path.test.ts` — the tick-quantised parity case, plus "gives every bar a non-zero range" relaxed to `l <= h` when a tick size is configured. The tick grid is off by default.                                                   |
| R13 | A cross-asset link that reads as market time — an authored link and a UTC link look identical in the picture.                     | S5                 | `packages/components/src/trading/candlestick-chart.test.tsx` — "labels a cross-asset link as authored rather than market time". The claim lives in the label and the export metadata, never in the image.                                         |
| R14 | A rollup whose ratio does not divide — the two factors are authored independently, so the ratio can be fractional.                | S5                 | `packages/core/src/validation.test.ts` — "rejects a rollup whose factors do not divide", naming the pane that has to change.                                                                                                                      |


---

## Deferred work

Not in this slice, and not to be started by an executor of this plan:

- SMT — SM-001 … SM-011: pivot detection, swing-pair comparison, the confirmation workflow, staleness on dependency change.
- CSV/JSON import: the importer implementation and its wizard (MD-003). The seam (`SeriesSpec` with `origin: 'imported'`) exists; nothing produces one.
- The imported-series overlay model — MD-004, MD-006: edits as overlays on immutable source bars. The first task of the import slice, per ADR-007 §"Limits accepted for now".
- Real UTC, session and DST aggregation — TF-001, TF-002, TF-006, TF-007: session calendars, holidays, price basis, timestamp-gap diagnostics.
- The portable `.chartstudio` archive — PR-005 … PR-008.
- The hierarchical timeline — TL-003, TL-004, TL-008: scenes, breadcrumb navigation, snapping, audio alignment.
- Authentic tick replay — FUNCTIONAL_SPEC §9: every intrabar path in this slice is a simulation and is labelled as one.
- A rendered volume series — the generator produces a volume activity proxy and the data carries it, but no pane renders volume in this slice.
- Real market-time alignment across two instruments — a cross-asset lockstep link is authored, not derived from a market clock, until an importer provides UTC (spec §10, decision 2).
- Multi-user, cloud and sync.

---

## Verification

Every slice runs and **the executor must report** the observed result of:

```bash
pnpm typecheck        # turbo typecheck across the workspace
pnpm test             # vitest across the workspace
pnpm build            # turbo build; the studio bundle must build
node scripts/verify-r1.mjs   # real Remotion render: PNG stills AND an MP4
```

`node scripts/verify-r1.mjs` is the render gate and it is **required** for every slice that touches rendering (S0, S1, S2, S3, S4, S5, S6, S7, S8, S10). It bundles `packages/video/remotion/index.ts`, renders PNG stills at frames 0, 20, 45, 100, 140 and 179 and renders `out/chart-studio-r1.mp4`. It is the only command that proves a change reached the video path.

Per-slice render-gate fixture growth (each slice names the frames it asserts in its own steps):


| Slice | Fixture addition                                                                      | Frames asserted                                                                                                                                                                                                 |
| ----- | ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| S0    | Migrated v1 chart document (inline bars lifted into a series).                        | 0, 45, 179 — the same candles in the same place as the pre-migration render.                                                                                                                                    |
| S1    | Same chart, now driven by the evaluated pane state.                                   | 0, 45, 179 — identical stills to S0.                                                                                                                                                                            |
| S2    | An `authored-path` series with three anchors.                                         | 45, 100 — each anchor bar closes at the placed price.                                                                                                                                                           |
| S3    | The pilot chart: authored path, `AUTHORED PATH` badge.                                | 0, 45, 140, 179 — badge present, candles follow the path.                                                                                                                                                       |
| S4    | A price line and a trendline anchored to the chart.                                   | 45, 100, 179 — the line stays on its price.                                                                                                                                                                     |
| S5    | A rollup pair on one series (fine and coarse) plus a lockstep pair across two series. | 45, 140 — the rollup's coarse pane aggregates the same source as-of; the lockstep pair shows the same number of candles at the same instant, and the "authored link" label is in the metadata, not the picture. |
| S6    | A pane with a hold and a camera zoom segment.                                         | 45, 100, 140 — the held candle does not advance.                                                                                                                                                                |
| S7    | A curve-driven pane growth.                                                           | 45, 100 — the same curve shape as S6's uncurved baseline.                                                                                                                                                       |
| S8    | A crossfade between two clips.                                                        | 45, 100 — the transition boundary renders.                                                                                                                                                                      |
| S9    | A duration-mode project and a declared transport action.                              | 0, 179 — the derived length matches the fixture.                                                                                                                                                                |
| S10   | The final fixture: panes, drawing, curve, authored path, transition.                  | 0, 20, 45, 100, 140, 179 — all six stills plus the MP4.                                                                                                                                                         |


For every user-interface change the executor exercises the actual surface in a browser and reports what was observed. Anything not exercised is reported as unverified. There is no substitute for the render gate.

---

### Task 1: S0 — Foundation: schema v2, the datasource seam and the Zod core schemas

**Requirements:** MD-009, MD-010, CH-009, OB-010, CV-001, CV-003, AP-002, CPT-006

**Files:**

- Create: `packages/core/src/series.ts`, `packages/core/src/path.ts`, `packages/core/src/elements.ts`, `packages/core/src/curve.ts`, `packages/core/src/time.ts`, `packages/core/src/validation.ts`
- Create: `packages/core/src/series.test.ts`, `packages/core/src/path.test.ts`, `packages/core/src/curve.test.ts`, `packages/core/src/time.test.ts`, `packages/core/src/validation.test.ts`
- Modify: `packages/core/src/schemas.ts` (add `Project.series`, `Project.durationMode`; extend the `ElementType` union with the eight drawing types), `packages/core/src/market.ts` (move `OhlcBar` out, export `hashString` and `createRng`), `packages/core/src/index.ts` (export the new modules), `packages/core/package.json` (add `zod@4.5.4` exactly)
- Modify: `packages/components/src/project-migrate.ts` (`CURRENT_PROJECT_SCHEMA_VERSION = 2`, the v1 → v2 migration), `packages/components/src/project-migrate.test.ts`, `packages/components/src/trading/candlestick-chart.test.tsx`
- Modify: `pnpm-lock.yaml` (the `packages/core` importer entry for `zod`)

**Interfaces:**

- Consumes: the existing `Project`, `Clip`, `Track` and `ElementType` unions (`packages/core/src/schemas.ts:1-118`); `generateSyntheticBars` (`packages/core/src/market.ts:72-101`).
- Produces:
  - `packages/core/src/series.ts` — `SeriesOrigin = 'authored-path' | 'manual' | 'synthetic' | 'imported'`; `SeriesSpec` (discriminated by `origin`); `Datasource` (`id`, `origin`, `revision`, `label`, `symbol?`, `timeframeId?`, `timeBasis: 'logical' | 'utc'`, `bars: readonly OhlcBar[]`); `materialiseSeries(spec): Datasource` (pure); `seriesRevision(spec): string` (pure content hash); and the canonical `OhlcBar` with a required `id`.
  - `packages/core/src/path.ts` — `AnchorRegime`, `SwingAnchor`, `SwingPath`, `PathGeneratorOptions`, `PathSegment`, `AnchorPoint`, `generateSeriesFromPath(path, { seed, algorithmVersion, seriesId, generator })`, `strokeToAnchorPoints(points, cfg)`.
  - `packages/core/src/elements.ts` — `ElementId`, `ElementRect`, `PaneSpec`, `PaneRelation`, `PaneHold`, `ZoomTrack`, `MarketAnchor`, `DrawingKind`, `DrawingSpec`, `MarketClock`, `ClockBinding`, `ChartStyle`, and `ChartProps` (the **persisted** props of a chart clip). The persisted type is named `ChartProps`, not `CandlestickChartProps`: the components package already owns a `CandlestickChartProps` for the **render** props (the pixel-level settings), and `packages/components/src/index.ts` re-exports the core barrel, so the same name in both would collide — `TS2308: Module './registry' has already exported a member named 'CandlestickChartProps'`. One is the document, one is the picture; they are named for which they are.
  - `packages/core/src/curve.ts` — `CurvePreset`, `Curve`, `evaluateCurve(curve, t)`.
  - `packages/core/src/time.ts` — `PaneFrameState`, `evaluatePaneAt(pane, datasource, clock, chartLocalFrame)`, `evaluateClockAt(clock, chartLocalFrame)`.
  - `packages/core/src/validation.ts` — `validateProjectDocument(raw)`, `validateSeriesSpec(raw)`, `validateChartProps(raw)`, each returning `{ ok: true, value }` or `{ ok: false, issues: { path, message }[] }`.
  - `packages/core/src/schemas.ts` — `Project.series: SeriesSpec[]`, `Project.durationMode: 'derived' | 'fixed'`.

- [x] **Step 1: Add the pinned Zod dependency to `packages/core`**

Add to `packages/core/package.json`:

```jsonc
"dependencies": {
  "zod": "4.5.4"
}
```

Run `pnpm install`. The lockfile gains a `packages/core` importer entry pointing at the store entry the Remotion family already resolves (`pnpm-lock.yaml:3329`) — no second download, no version skew. Expected: the install completes with no lifecycle-script warning beyond `esbuild` (already allowlisted at `package.json` `pnpm.onlyBuiltDependencies`).

- [x] **Step 2: Move `OhlcBar` into `series.ts` and export the seeded helpers**

`packages/core/src/market.ts:8-15` currently defines `OhlcBar` without an `id`. Move the interface to `packages/core/src/series.ts` with `id: string` as the first field, and change `market.ts` to import the type from `./series` (no re-export — `packages/core/src/index.ts` uses `export *` from both modules and a duplicate export would be ambiguous).

`market.ts` gains an `idPrefix` option so the generator can stamp stable ids:

```ts
export const generateSyntheticBars = (options: {
  count: number;
  startPrice: number;
  seed: string;
  timeframeMs: number;
  volatility?: number;
  drift?: number;
  /** Prefix for the stable bar ids. Defaults to 'bar'. */
  idPrefix?: string;
}): OhlcBar[]
```

`id` becomes ``${idPrefix ?? 'bar'}:${i}``. Existing callers (`packages/components/src/trading/definitions/candlestick-chart.ts:30`, `packages/components/src/trading/inspectors/candlestick-chart.tsx:76`, `scripts/verify-r1.mjs:23`, `packages/core/src/market.test.ts`) keep working — they gain an `id` field they did not have to supply.

Also change `hashString` (`:44-51`) and `createRng` (`:54-63`) from module-private `const` to `export const`. **Decision, per Q4: export and reuse, do not duplicate.** One FNV-1a hash and one mulberry32 in the package means one definition of "deterministic" and one place to change it; a copy in `path.ts` would be a second source of truth for a correctness-critical helper. Exit strategy: removing the export is a deletion.

- [x] **Step 3: Write `packages/core/src/series.ts`**

The seam, exactly as the design specifies (spec §3.2, §4):

```ts
export type SeriesOrigin = 'authored-path' | 'manual' | 'synthetic' | 'imported';

export interface Datasource {
  readonly id: string;
  readonly origin: SeriesOrigin;
  readonly revision: string;
  readonly label: string;
  readonly symbol?: string;
  readonly timeframeId?: string;
  readonly timeBasis: 'logical' | 'utc';
  readonly bars: readonly OhlcBar[];
}

export type SeriesSpec =
  | { id: string; origin: 'authored-path'; label: string; symbol?: string;
      timeframeId?: string; timeBasis: 'logical'; seed: string; algorithmVersion: number;
      path: SwingPath }
  | { id: string; origin: 'manual'; label: string; symbol?: string;
      timeframeId?: string; timeBasis: 'logical'; bars: OhlcBar[] }
  | { id: string; origin: 'synthetic'; label: string; symbol?: string;
      timeframeId?: string; timeBasis: 'logical'; seed: string; algorithmVersion: number;
      generator: { count: number; startPrice: number; timeframeMs: number;
                   volatility?: number; drift?: number } }
  | { id: string; origin: 'imported'; label: string; symbol?: string;
      timeframeId?: string; timeBasis: 'utc'; revision: string; bars: OhlcBar[] };

export const materialiseSeries = (spec: SeriesSpec): Datasource;
export const seriesRevision = (spec: SeriesSpec): string;
```

`materialiseSeries` is the single place a spec becomes bars:

- `authored-path` → `generateSeriesFromPath(spec.path, { seed: spec.seed, algorithmVersion: spec.algorithmVersion, seriesId: spec.id, generator: spec.generator })`. The generator settings are part of the series spec, so they are part of the revision hash: changing the volatility changes the series and therefore the revision.
- `manual` → the stored bars, re-hashed.
- `synthetic` → `generateSyntheticBars` with the stored seed and generator options.
- `imported` → the stored bars, untouched.

`materialiseSeries` re-stamps every bar's id to ``${spec.id}:${index}`` (spec §3.3 step 7) and sorts by `t` ascending. `seriesRevision` hashes the materialised content with `hashString` and returns the hex digest — an edited anchor, an edited bar or a changed seed all produce a different revision.

- [x] **Step 4: Write `packages/core/src/path.ts` with the normative generator**

`packages/core/src/path.ts` is a **port** of `docs/reference/data-generation/path-to-candles-advanced.ts` — the author's reference implementation, which is the normative source for the algorithm. Port it; do not re-derive it. The port changes exactly two things and nothing else:

- **Seeding.** The reference takes a numeric seed and builds its own mulberry32 stream. The port uses the package's seeded PRNG: `hashString(seed)` produces the numeric state, and the reference's `randomSource` becomes a thin wrapper over the package's stream. The reference's `uniform`/`normal`/`integer` are the package's `createRng` extended with a Box–Muller normal and an integer draw — the reference's own `randomSource` already uses exactly that construction (mulberry32 + a cached Box–Muller spare), so the two agree bit for bit.
- **Output shape.** The reference returns `Candle[]` (with `time`, `open`, `high`, `low`, `close`, `volume`); the port returns `OhlcBar[]` (`t`, `o`, `h`, `l`, `c`, `v?`) with `id` stamped, plus the per-segment diagnostics.

The parity test is the acceptance criterion for this step. The port must reproduce the reference implementation's output *bit for bit* for a fixed set of configurations. Verified against the reference: with the reference seeded from `hashString(seed)` and the port seeded from the string `seed`, six configurations — including the flat-to-range case, the tick-quantised case and a case with retracements, consolidations and custom wicks — produce identical output. The test asserts this equality by running both implementations, so a future edit to either one that changes the numbers fails the build.

**How the test reaches the reference.** The reference lives in `docs/reference/data-generation/`, outside the package, and `packages/core/tsconfig.json` sets `rootDir: "src"`. A **static** import of the reference from the package therefore fails to typecheck with `TS6059: File ... is not under 'rootDir'` — verified. The test loads it dynamically instead:

```ts
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const REFERENCE_PATH = resolve(
  process.cwd(),
  'docs/reference/data-generation/path-to-candles-advanced.ts',
);

const loadReference = async () => {
  const mod = await import(/* @vite-ignore */ pathToFileURL(REFERENCE_PATH).href);
  return mod as { generateCandlesWithMeta: (options: unknown) => unknown };
};
```

A dynamic import with a computed specifier is not resolved by TypeScript, so `rootDir` does not apply, and Vitest transpiles the reference on the fly. Verified: the package typechecks and the test passes. The reference is loaded by path, so the test runs from the repository root — which is how the workspace test script already runs.

The alternative — copying the reference into the package — is rejected: two copies of the same algorithm drift, and the parity test would then compare a file against itself.

**Two decisions taken during execution, both recorded here so the next reader is not surprised.**

*`algorithmVersion` selects the algorithm; it is not folded into the seed.* Folding the version into the
seed string would change the output for the same path and seed, which breaks the parity guarantee
with the reference — and the reference is the normative algorithm. Instead the version is checked:
a version this build does not implement is **rejected**, not quietly rendered with version 1's bars.
A series labelled with a version it was not generated by is a false provenance record, which is the
same dishonesty the authored cross-asset link is guarded against. `SUPPORTED_ALGORITHM_VERSIONS` is
`[1]`; a test asserts an unknown version is rejected.

*`SwingPath` gained an optional `barCount`.* Without it, the spec's rule "the last anchor must be the
final bar" is a tautology — the bar count is derived from the last anchor, so the rule can never
fail. The optional field makes the rule a real check: when present it pins the extent of the path;
when absent the count is derived exactly as before.

The port keeps the reference's structure unchanged: validation (including the requirement that the first anchor is index `0` and the last is `candleCount - 1`), the AR(1) volatility series, the `auto` regime classification, the trend guide with its optional pause and retracement, the mean-reverting range guide, the weighted Brownian bridge over the guide, the exact-close override at anchor indices, the intrabar Brownian bridge that produces each bar's `h` and `l`, the optional tick quantisation, and the volume proxy.

Two facts about the result that the rest of the design depends on, both established by running the reference:

- The anchor pins the **close** exactly — the reference overrides the generated close at anchor indices and never pins an extreme. Pinning the extreme instead is degenerate: the guide already passes through the anchor price as the close, so `h = anchor.price` yields `h == c` and a zero-range bar (spec §3.3, risk R10).
- The drawn path is the **skeleton, not a corridor**. The bridge is not clamped, so closes can overshoot their anchors — 0.08 % of the price on a 100 → 120 leg with the default settings, and bounded by the configured `volatility` (spec §3.3, risk R11). The `auto` regime classification is what keeps a *flat* drawn leg from drifting: it becomes a `range` and mean-reverts around the line.

The port's signature carries the series id so the id rule lives in one place, and returns the segments alongside the bars:

```ts
export const generateSeriesFromPath = (
  path: SwingPath,
  options: {
    seed: string;
    algorithmVersion: number;
    seriesId: string;
    generator?: PathGeneratorOptions;
  },
): { bars: OhlcBar[]; segments: PathSegment[] };
```

`strokeToAnchorPoints` is ported from the reference's `strokeToAnchors` in the same step: it simplifies a freehand screen stroke (Ramer–Douglas–Peucker) and maps it onto `(barIndex, price)` points, with optional logarithmic price scaling and tick snapping.

The **reveal** of a partially formed bar during playback is a separate concern and is not re-implemented here: `buildWaypoints` and `simulateBar` (`packages/core/src/market.ts:116-173`) stay the only intrabar reveal machinery, so AN-003's guarantees are unchanged. The generator's own intrabar bridge fixes each bar's `h` and `l`; the reveal walks that range.

- [x] **Step 5: Write `packages/core/src/elements.ts` and `packages/core/src/curve.ts`**

`elements.ts` carries the element model verbatim from spec §3.4: `PaneSpec` (with `aggregation`, `rect`, `in`, `out`, `opacity`, `curve?`, `clock`, `priceRange`, `viewport?`, `holds?`, `zoom?`, `style?`), `PaneRelation` (the two kinds, `rollup` and `lockstep` — spec §3.4.1), `PaneHold`, `ZoomTrack`, `MarketAnchor` (the four variants: `price`, `candle`, `time`, `point`), `DrawingKind` (the eight kinds), `DrawingSpec`, `MarketClock`, `ClockBinding`, `ChartStyle`.

`curve.ts` carries `CurvePreset` (`linear`, `easeIn`, `easeOut`, `easeInOut`, `bounceOut`, `elastic`, `overshoot`), `Curve` (`preset` | `cubicBezier`) and `evaluateCurve(curve, t)`: a cubic-bezier solver (bisection on x, then y) plus the presets expressed as control points. No Remotion import. `evaluateCurve(curve, 0) === 0` and `evaluateCurve(curve, 1) === 1` for every curve.

- [x] **Step 6: Write `packages/core/src/time.ts`**

`evaluateClockAt(clock, chartLocalFrame)` returns `{ referenceIndex, progress }`:

```text
clockStep(f)   = f / framesPerBar
referenceIndex = floor(clockStep(f))
progress       = fract(clockStep(f))
```

`evaluatePaneAt(pane, datasource, clock, chartLocalFrame)` returns `PaneFrameState { bars, activeIndex, range, developing }`:

- the pane's source index is `referenceIndex + offsetBars` for a `reference` or `offset` binding, and the reference index itself for a `reference` binding;
- with `aggregation.factor = n` the bucket index is `floor(sourceIndex / n)` and the bucket aggregates only the constituents with index `<= sourceIndex`; a partially formed bucket sets `developing: true`;
- `bars` never contains an index beyond the as-of index;
- `range` comes from the revealed bars only when `priceRange.mode === 'auto'`, and from the author's `min`/`max` when the mode is `fixed`;
- the uniform mapping of today (`evaluateBarsAtFrame`, `packages/core/src/market.ts:188-225`) stays the special case of this evaluation and keeps its name and its assertions.

- [x] **Step 7: Write `packages/core/src/validation.ts`**

The only module in the workspace that names a Zod symbol:

```ts
import * as z from 'zod/v4';
```

It defines the runtime counterparts of the new shapes and exports plain validators:

```ts
export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; issues: { path: string; message: string }[] };

export const validateSeriesSpec: (raw: unknown) => ValidationResult<SeriesSpec>;
export const validateChartProps: (raw: unknown) => ValidationResult<ChartProps>;
export const validateProjectDocument: (raw: unknown) => ValidationResult<Project>;
```

The Zod `safeParse` result never crosses the boundary; `issues` are mapped to `{ path, message }` strings. The project document schema is **loose about unknown keys** so a document written by a newer build is not silently truncated on load (ADR-008 §"The migration boundary").

**Zod strips unknown keys by default, so the document tree must be declared `loose`.** Measured:
`z.object({ a: z.string() })` parses `{ a: 'x', extra: 1 }` to `{ a: 'x' }` — the unknown key is
gone. `z.looseObject({...})` and `z.object({...}).loose()` both keep it. Every object in the
document tree — the document, its tracks, its clips and their effects — is therefore declared
`loose`; otherwise a document written by a newer build loses its keys on the first load, which is
exactly the silent truncation the rule exists to prevent. A test asserts an unknown key survives
the round trip.

- [x] **Step 8: Extend the document types in `packages/core/src/schemas.ts`**

Add to `Project`:

```ts
  /** Project-level market data registry. Charts reference a series by id. */
  series: SeriesSpec[];
  /** 'derived' computes the length from the elements; 'fixed' uses durationInFrames. */
  durationMode: 'derived' | 'fixed';
```

`durationMode` is optional on the type until the migration in Step 9 makes it always present; the migration supplies the default.

Extend the `ElementType` union at the end with the eight drawing types — `priceLine`, `highLowLine`, `verticalLine`, `trendline`, `priceZone`, `textLabel`, `arrow`, `position` — and nothing else. No existing member is renamed, renumbered or reused.

- [x] **Step 9: Write the v1 → v2 migration**

In `packages/components/src/project-migrate.ts`: `CURRENT_PROJECT_SCHEMA_VERSION` moves from `1` to `2` (`:21`). The v1 → v2 conversion, per spec §3.10:


| v1                                 | v2                                                                                                                                           |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| chart clip `props.bars: OhlcBar[]` | a project-level `series` entry of origin `manual` (or `synthetic` when `props.dataSource === 'synthetic'`), plus the clip's `props.seriesId` |
| chart clip flat props              | chart props v2: `seriesId`, `panes: [one pane]`, `clock`, `style`                                                                            |
| `OhlcBar` without `id`             | every bar carries a deterministic id, ``${seriesId}:${index}``                                                                               |
| `Project.durationInFrames`         | joined by `durationMode: 'fixed'` with the same value, so no saved project changes length                                                    |


The single migrated pane gets `rect: { x: 0, y: 0, width: 1, height: 1 }` (per Q1), `aggregation: { factor: 1 }`, `priceRange: { mode: 'auto' }`, `clock: { kind: 'reference' }` and `in: 0`, `out` = the clip's duration. The legacy `bars` array stays on the migrated clip as an inert compatibility key (per Q2) and the chart renderer keeps reading it until Task 2.

The migration keeps its rejections unchanged: a higher `schemaVersion` (`:92-93`), an unknown component type via `getComponent` (`:37-38`), a clip whose `propsVersion` is newer than its component's (`:40-44`), and the malformed-scalar checks (`:96-101`) — the last group moves behind `validateProjectDocument` in Task 11, not now, so the migration's own error messages stay as they are.

- [x] **Step 10: Write the failing tests, then the implementation**

`packages/core/src/series.test.ts` (new):

- "materialises a manual series into a datasource with stable bar ids" — fails before Step 3 (no `series.ts`); passes after.
- "gives the same revision for the same spec" — fails before Step 3; passes after.
- "changes the revision when a bar changes" — fails before Step 3; passes after.
- "materialises an authored path into bars whose anchor bars close at the placed price" — fails before Step 4; passes after.
- "materialises an imported series as stored" — fails before Step 3; passes after. (R9: the imported variant is accepted as data; nothing produces one.)
- "keeps the materialised bars ascending by time".

`packages/core/src/path.test.ts` (new):

- "places the exact anchor price on the anchor bar" — fails before Step 4; passes after.
- "traces the drawn path between the anchors" — fails before Step 4; passes after.
- "rejects a duplicate anchor index" and "rejects a non-finite anchor price" — fail before Step 4; pass after.
- "keeps every generated bar OHLC-consistent and strictly positive" — fails before Step 4; passes after.
- "is deterministic for the same path, seed and algorithm version" (AP-002) — fails before Step 4; passes after.

`packages/core/src/curve.test.ts` (new):

- "maps 0 to 0 and 1 to 1 for every preset" — fails before Step 5; passes after.
- "solves a cubic bezier at its endpoints" — fails before Step 5; passes after.
- "is monotonic for a linear bezier" — fails before Step 5; passes after.

`packages/core/src/time.test.ts` (new):

- "returns no bars before the first frame" — fails before Step 6; passes after.
- "never returns a bar beyond the as-of index" — fails before Step 6; passes after.
- "does not let a future bar move the price range" (R2) — fails before Step 6; passes after.
- "aggregates only the constituents at or before the as-of index" (R4) — fails before Step 6; passes after.

`packages/core/src/validation.test.ts` (new):

- "accepts a valid v2 project document" — fails before Step 7; passes after.
- "rejects a document with a non-positive fps" and "reports the path of the offending field" — fail before Step 7; pass after.
- "keeps unknown keys on the project document" — fails before Step 7; passes after.

`packages/components/src/project-migrate.test.ts` (modify — keep the existing eight test names and assertions):

- "lifts a v1 chart bar array into a project series" — fails before Step 9; passes after.
- "gives every migrated bar a deterministic id" — fails before Step 9; passes after.
- "keeps the duration of a migrated document" — fails before Step 9; passes after.
- "is idempotent for a v2 document" — fails before Step 9; passes after.
- "migrates a v1 chart document to a single pane covering the whole chart" — fails before Step 9; passes after.

`packages/components/src/trading/candlestick-chart.test.tsx` (modify):

- "renders the migrated chart identically to the v1 chart" (R7) — fails before Step 9; passes after: render the v1 clip's props and the migrated clip's props at the same frame and compare the serialised SVG.

- [x] **Step 11: Verify**

```bash
pnpm typecheck
pnpm test
pnpm build
node scripts/verify-r1.mjs
```

The executor must report: the observed test counts (the suite was 154 tests over 12 files before this slice — `docs/quality/TEST_STRATEGY.md` §3), the typecheck result, the build result, and the render-gate still byte sizes and MP4 outcome for the migrated fixture (frames 0, 45, 179 asserted against the pre-migration render).

- [x] **Step 12: Commit**

```bash
git add -A
git commit -m "Add the schema v2 data model, the datasource seam and the v1 to v2 migration

Market data leaves the chart clip and becomes a project-level series
registry consumed by reference. A pure materialiseSeries turns any of the
four origins into a datasource with stable bar ids and a content-hash
revision; the authored swing path generates deterministic candles from it.
Curves, panes, drawings and the shared clock get their types, and Zod
validates the new shapes at the boundary.

The migration is non-destructive and idempotent, lifts a v1 chart's inline
bars into a series and keeps the document's length. The chart renders
identically before and after the migration.

"
```

---

### Task 2: S1 — The evaluate/render contract extension

**Requirements:** CPT-003, TL-010

**Files:**

- Create: `packages/video/src/evaluate.ts`, `packages/video/src/evaluate.test.ts`
- Modify: `packages/core/src/contract.ts` (`evaluate`, `transportActions`, `TransportAction`, `ComponentRenderContext.evaluated`), `packages/core/src/index.ts`, `packages/video/src/composition.tsx`, `packages/video/src/index.ts`
- Modify: `packages/components/src/trading/definitions/candlestick-chart.ts`, `packages/components/src/trading/chart.tsx`
- Modify: `packages/components/src/trading/candlestick-chart.test.tsx`
- Modify: `docs/spec/COMPONENT_CONTRACT.md` (§2, §3, §6)

**Interfaces:**

- Consumes: `Project`, `Clip` (`packages/core/src/schemas.ts`); `materialiseSeries` and `evaluatePaneAt` (`packages/core/src/series.ts`, `packages/core/src/time.ts`); `PaneSpec`, `MarketClock` (`packages/core/src/elements.ts`).
- Produces:
  - `packages/core/src/contract.ts` — `VideoComponentDefinition.evaluate?: (input: { clip: Clip; props: ComponentProps; sceneFrame: number; project: Project }) => unknown`; `VideoComponentDefinition.transportActions?: TransportAction[]`; `TransportAction { id, label, icon, kind: 'seek' | 'toggle', seekTo?, toggle? }`; `ComponentRenderContext.evaluated?: unknown`.
  - `packages/video/src/evaluate.ts` — `evaluateClip(definition, { clip, props, sceneFrame, project }): unknown` — pure; returns `undefined` for a definition without an `evaluate` step.
  - `packages/components/src/trading/definitions/candlestick-chart.ts` — the chart definition gains an `evaluate` that resolves its series from `project.series` and returns the pane frame states.

- [x] **Step 1: Extend the contract in `packages/core/src/contract.ts`**

Add the two optional definition fields and the one optional context field exactly as spec §3.7 and §3.8 specify. `evaluate` is pure and receives no editor state, no DOM and no clock. `ComponentRenderContext` gains `evaluated?: unknown`.

`transportActions` is declared here and executed by the shell in Task 10; in this slice it is a declaration only. `TransportAction.seekTo` returns an absolute frame or `null` when the action does not apply.

- [x] **Step 2: Write `packages/video/src/evaluate.ts`**

```ts
export const evaluateClip = (
  definition: VideoComponentDefinition,
  input: { clip: Clip; props: ComponentProps; sceneFrame: number; project: Project },
): unknown => (definition.evaluate ? definition.evaluate(input) : undefined);
```

Pure, no Remotion import, callable from a test without a Remotion context.

- [x] **Step 3: Wire the evaluation into the composition**

In `packages/video/src/composition.tsx`, `ClipRenderer` (`:45-119`) gains the project and the absolute scene frame. `useCurrentFrame()` inside the `<Sequence from={clip.from}>` (`:127-132`) is clip-relative; the absolute frame is `clip.from + frame`. The composition calls `evaluateClip` once per clip per frame and passes the result to the adapter:

```ts
const evaluated = evaluateClip(definition, { clip, props, sceneFrame: clip.from + frame, project });
const content = React.createElement(definition.render, { clip, props, frame, fps, evaluated });
```

`MainComposition` (`:121-139`) threads the `project` prop down to `ClipRenderer`. A definition without `evaluate` behaves exactly as it does today — `evaluated` is `undefined` and nothing else changes.

**A migrated synthetic series carries the bars it was created from.** Version 1 stored the
bars inline and never stored the seed that produced them, so the recipe in the generator cannot
make them again — a migrated synthetic series would materialise to *different* bars and the chart
would render something other than what the project showed. The synthetic origin therefore takes an
optional `bars` field: the generator is the recipe, the bars are the record, and the bars win when
they are present. A migrated chart keeps its own bars, its own origin and its own badge, so the
render is unchanged — the stills and the video are byte-identical to the pre-migration render.

- [x] **Step 4: Give the chart its `evaluate` step and switch the renderer to the pane state**

In `packages/components/src/trading/definitions/candlestick-chart.ts`, the definition gains:

```ts
evaluate: ({ clip, props, project }) => { ... }
```

It reads `props.seriesId`, finds the matching `SeriesSpec` in `project.series`, calls `materialiseSeries`, and for each pane in `props.panes` calls `evaluatePaneAt(pane, datasource, props.clock, sceneFrame - clip.from)`. The result carries, per pane: the pane's frame state, the pane's price range, and the resolved datasource identity and revision (for the provenance badge).

The chart renderer (`packages/components/src/trading/chart.tsx`) then draws from the evaluated pane state instead of from `props.bars`: the same `chartGeometry` (`:69-86`), the same `priceToY` (`:89-98`), the same `auto` range from revealed bars only (`:139-141`), the same body ratio and grid lines (`:36-47`). The legacy `props.bars` path stays as the fallback when the project carries no matching series — that keeps a chart created before Task 4 rendering, and it is deleted in Task 11 once every chart has a series.

The `evaluate` step is the first use of the contract extension, so it also proves the extension works end to end: preview and export both go through `MainComposition`, so they run the same evaluation.

- [x] **Step 5: Write the failing tests**

`packages/video/src/evaluate.test.ts` (new):

- "runs the definition evaluate step once per clip" — fails before Step 2 (no module); passes after.
- "returns undefined when the definition has no evaluate step" — fails before Step 2; passes after.
- "passes the scene frame and the project snapshot to evaluate" — fails before Step 2; passes after.
- "gives the same evaluated value for the same frame regardless of seek order" (QA-002) — fails before Step 2; passes after.

`packages/components/src/trading/candlestick-chart.test.tsx` (modify — keep every existing test name):

- "renders the same candles from the evaluated pane state as from the inline bars" (R7) — fails before Step 4 (the renderer reads `props.bars` only); passes after.
- "renders no future candle from the evaluated pane state" — fails before Step 4; passes after.
- "labels the series origin from the evaluated provenance" — fails before Step 4; passes after.

- [x] **Step 6: Verify**

```bash
pnpm typecheck
pnpm test
pnpm build
node scripts/verify-r1.mjs
```

The executor must report the render-gate stills for frames 0, 45 and 179 and confirm they are unchanged against Task 1's migrated-document render. Any difference in a still is a migration regression (R7) and blocks the slice.

- [x] **Step 7: Commit**

```bash
git add -A
git commit -m "Give the component contract a pure evaluate step and a transport action slot

A market-anchored element cannot resolve its geometry from (clip, props,
frame, fps) alone: it needs the project snapshot at the current frame. The
definition may now declare a pure evaluate step, and the composition runs
it once per clip per frame and hands the result to the adapter. A
definition without evaluate behaves exactly as before.

The chart uses the step to resolve its series from the project registry and
to render from the evaluated pane state, so the preview and the export run
the same evaluation.

"
```

---

### Task 3: S2 — Path authoring core

**Requirements:** AP-001, AP-002, AP-004, MD-001, MD-002, AN-003

**Files:**

- Modify: `packages/core/src/path.ts` (the authoring operations), `packages/core/src/series.ts` (the `authored-path` origin's revision inputs)
- Modify: `packages/core/src/path.test.ts`, `packages/core/src/series.test.ts`
- Modify: `docs/spec/FUNCTIONAL_SPEC.md` (§2, `AP` block — the new IDs are already recorded; confirm the wording matches the implementation)

**Interfaces:**

- Consumes: `SwingPath`, `SwingAnchor` (`packages/core/src/path.ts`); `hashString`, `createRng` (`packages/core/src/market.ts`).
- Produces:
  - `packages/core/src/path.ts` — `addSwingAnchor(path, anchor): SwingPath`, `moveSwingAnchor(path, anchorId, { barIndex?, price? }): SwingPath`, `removeSwingAnchor(path, anchorId): SwingPath`, `normalizeSwingPath(path): SwingPath` — pure, immutable, anchors ascending by `barIndex`, duplicate indices rejected.
  - `packages/core/src/series.ts` — the `authored-path` revision covers the path, the seed and the algorithm version, so an edited anchor produces a new revision.

**The segments are independent, and that is what a moved anchor changes.** Measured on a
three-anchor path: moving the *last* anchor changes only the bars of the segment it ends (11..20);
moving a *middle* anchor changes the two segments it touches, which is every bar of the path. The
property the test asserts is therefore the precise one: a moved anchor changes the bars of the
segments that touch it and leaves the others untouched. The volatility series is drawn once for the
whole path and is unaffected by any anchor.

- [x] **Step 1: Write the authoring operations**

All four operations are pure and return a new `SwingPath`. `addSwingAnchor` rejects a duplicate `barIndex` and a non-finite price; `moveSwingAnchor` moves an anchor's price and/or bar index and re-normalises; `removeSwingAnchor` drops an anchor; `normalizeSwingPath` sorts ascending by `barIndex` and rejects duplicates.

- [x] **Step 2: Pin the normative algorithm with the full test suite**

The generator landed in Task 1 (per Q3); this task is where the spec's normative algorithm is *proved*, test by test, and where the authoring model above is pinned.

`packages/core/src/path.test.ts` (extend):

- "reproduces the reference implementation bit for bit" — the parity test from Task 1's Step 4; keep it and add the flat-to-range, tick-quantised and retracement configurations. (This is the strongest guarantee in the file: any drift between the port and the reference fails here.)
- "is deterministic for the same path, seed, algorithm version and generator settings" — exists from Task 1; keep.
- "gives a different body for the same path under a different seed" — fails before Step 1 (no second seed comparison); passes after.
- "closes every anchor bar at the placed price exactly" — fails before Task 1's Step 4; passes after. (R10.)
- "gives every bar a non-zero range, including at an anchor" — fails before Step 2 (the anchor bar's extreme collapsed onto its close); passes after. (R10.)
- "classifies a flat leg as a range and a steep leg as a trend" — fails before Step 2; passes after.
- "honours an explicit regime override over the automatic classification" — fails before Step 2; passes after.
- "keeps the excursion beyond the drawn band bounded relative to the configured volatility" — fails before Step 2; passes after. The bound is *relative*, not zero: the drawn path is the skeleton, not a corridor. (R11.)
- "produces the same relative output for the same relative path at a different price level" — fails before Step 2; passes after. (Scale invariance.)
- "sorts the anchors by bar index when they are added out of order" — fails before Step 1; passes after.
- "rejects a duplicate anchor index" — fails before Step 1; passes after.
- "rejects a path whose first anchor is not index 0 or whose last is not the final bar" — fails before Step 1; passes after.
- "keeps the placed close when an anchor is moved" — fails before Step 1; passes after.
- "changes only the bars the moved anchor affects" — fails before Step 1; passes after.
- "simplifies a freehand stroke into anchor points" — fails before Step 1; passes after.
- "maps a stroke's vertical extent onto the price range" — fails before Step 1; passes after.

`packages/core/src/series.test.ts` (extend):

- "changes the revision when an anchor moves" (R5) — fails before Step 2; passes after.
- "keeps the revision when the same path is materialised twice" — fails before Step 2; passes after.

- [x] **Step 3: Confirm the intrabar reveal path is generalised, not replaced**

Assert in `packages/core/src/path.test.ts` that a generated series, evaluated with `evaluateBarsAtFrame` in `simulated` mode, keeps the existing intrabar guarantees — the path stays inside `[low, high]`, visits both extremes, starts at the open and ends at the close. The existing `packages/core/src/market.test.ts` assertions for `evaluateBarsAtFrame` must keep their names and pass unchanged: the intrabar machinery was not touched.

- [x] **Step 4: Verify**

```bash
pnpm typecheck
pnpm test
pnpm build
node scripts/verify-r1.mjs
```

The executor must report the render-gate stills for frames 45 and 100 against the authored-path fixture added to `scripts/verify-r1.mjs` (three anchors; each anchor bar closes at the placed price, and no anchor bar has a zero range).

- [x] **Step 5: Commit**

```bash
git add -A
git commit -m "Add the swing path authoring model and pin the path generator

Anchors can be added, moved and removed through pure operations that keep
the path sorted and reject duplicates. The generator now follows the
authored reference algorithm, and a parity test proves the port reproduces
it bit for bit: each anchor bar closes at the exact placed price, the
anchor regime sets the character of the segment that follows it, a flat
drawn leg becomes a ranging market, and the same path, seed, algorithm
version and settings always produce the same bars.

The seeded PRNG and the hash are exported from market.ts and reused here,
so there is one definition of determinism in the package.

"
```

---

### Task 4: S3 — PILOT: the observable creator loop

**Requirements:** AP-001, AP-003, AP-004, EX-003, CPT-005, QA-002

**Files:**

- Modify: `packages/editor/src/store.ts` (the swing-path commands and the series commands), `packages/editor/src/store.test.ts`
- Modify: `apps/studio/src/components/ToolRail.tsx` (the Path tool), `apps/studio/src/components/PreviewPanel.tsx` (anchor placement and drag on the canvas)
- Modify: `packages/components/src/trading/chart.tsx` (the provenance badge), `packages/components/src/trading/definitions/candlestick-chart.ts` (the authored-path defaults)
- Modify: `packages/components/src/trading/candlestick-chart.test.tsx`
- Modify: `scripts/verify-r1.mjs` (the pilot fixture)

**Interfaces:**

- Consumes: `addSwingAnchor`, `moveSwingAnchor`, `removeSwingAnchor` (`packages/core/src/path.ts`); `materialiseSeries`, `seriesRevision` (`packages/core/src/series.ts`); the chart's `evaluate` step (`packages/components/src/trading/definitions/candlestick-chart.ts`).
- Produces:
  - `packages/editor/src/store.ts` — `startSwingPath(clipId)`, `addSwingAnchor(clipId, { barIndex, price, regime? })`, `moveSwingAnchor(clipId, anchorId, patch)`, `removeSwingAnchor(clipId, anchorId)`, `finishSwingPath(clipId)`, `updateSeries(seriesId, patch)`; the store keeps `project.series` in the project snapshot, so every command participates in the existing whole-`Project` undo history (`commit` at `packages/editor/src/store.ts:228-232`, `undo` `:233-243`, `redo` `:244-255`).
  - `apps/studio/src/components/ToolRail.tsx` — a Path tool button, shown when the selected clip is a chart.
  - `apps/studio/src/components/PreviewPanel.tsx` — pointer handling that places an anchor on a click and drags an existing anchor.

- [ ] **Step 1: Add the swing-path commands to the store**

The store's `drawingPath` session (`packages/editor/src/store.ts:26-31`, commands at `:80-85`) is the existing pattern for a canvas gesture: a session with points, committed at the end. The swing-path session adds `anchorIds` and the chart clip's `seriesId`.

`startSwingPath(clipId)` opens the session on the chart clip. `addSwingAnchor` converts the click point into market coordinates — the bar index from the x position against the pane's slot layout, the price by inverting the pane's `priceToY` against the pane's *current* range — and appends an anchor to the series' `SwingPath`. `moveSwingAnchor` updates one anchor's price and re-normalises the path. Every command calls `commit()` before it changes the project, so undo restores the previous path exactly.

The series the path belongs to is an `authored-path` entry in `project.series` with a stored `seed` and `algorithmVersion` — **never re-seeded on an edit** (R5). Moving an anchor changes the path, not the seed.

- [ ] **Step 2: Add the Path tool to the tool rail**

`apps/studio/src/components/ToolRail.tsx` shows Select always, Draw Path and Draw Trail conditionally (`:37-69`). Add a Path tool, shown when the selected clip's element is `candlestickChart`. The tool name in the UI is "Path"; it is not a new `ElementType` — it is a mode of the chart, so nothing is added to the registry.

- [ ] **Step 3: Handle anchor placement and drag on the canvas**

`apps/studio/src/components/PreviewPanel.tsx` already converts a client point into project coordinates (`projectPoint`, `:81-90`) and owns the pointer gesture. With the Path tool active:

- a click on the chart places an anchor at the nearest bar index and the price under the pointer;
- a press on an existing anchor starts a drag that moves it, live, with the series regenerating on every move;
- a **freehand drag on empty chart space** draws a whole path: the pointer trail is collected, simplified and converted to anchor points by `strokeToAnchorPoints` (`packages/core/src/path.ts`), and the resulting anchors replace the path. This is the fastest way to sketch a market shape, and it is the reason the reference implementation carries a stroke converter at all;
- the anchors render as small handles over the canvas, drawn by the editor — never by the render adapter (CPT-005: editor handles must not reach the render path).

The freehand gesture needs the pane's own bounds: the canvas size, the bar count and the pane's current price range. The conversion is a pure function of those, so it stays in `packages/core/src/path.ts` and the editor only supplies the numbers.

The live regeneration works because the chart's `evaluate` materialises the series from the path on every frame; the store only changes the path.

- [ ] **Step 4: Show the provenance badge**

`packages/components/src/trading/chart.tsx`'s `provenanceLabel` (`:101-110`) gains the authored-path case: `AUTHORED PATH` for an `authored-path` series, `SYNTHETIC DATA` for a synthetic one, `MANUAL` for a manual one. The badge keeps its existing `SIMULATED INTRABAR` suffix, independently of the origin.

- [ ] **Step 5: Write the failing tests**

`packages/editor/src/store.test.ts` (modify — keep the two existing test names):

- "adds a swing anchor to the chart's authored series" — fails before Step 1; passes after.
- "regenerates the series when an anchor moves" — fails before Step 1; passes after.
- "regenerates identical bars after the same anchor move" (R5) — fails before Step 1; passes after.
- "undoes an anchor move back to the previous path" — fails before Step 1; passes after.
- "keeps the series seed across an anchor move" — fails before Step 1; passes after.

`packages/components/src/trading/candlestick-chart.test.tsx` (modify):

- "labels an authored path series AUTHORED PATH" (AP-004) — fails before Step 4; passes after.
- "keeps the badge when the reveal is simulated" — fails before Step 4; passes after.

- [ ] **Step 6: Exercise the pilot in the browser**

The executor opens the editor, selects the chart clip, activates the Path tool, clicks three anchors, drags the middle one, and reports what was observed: the candles follow the drawn path, the middle anchor's bar carries the dragged price exactly, the badge reads `AUTHORED PATH`, the preview and the export agree. The executor then draws a freehand stroke across the chart and reports that the stroke became a set of anchors and the series followed it. A recording or a screenshot is filed with the slice.

- [ ] **Step 7: Verify**

```bash
pnpm typecheck
pnpm test
pnpm build
node scripts/verify-r1.mjs
```

The executor must report the render-gate stills for frames 0, 45, 140 and 179 against the pilot fixture: the badge is present and each anchor bar closes at the placed price.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "Ship the pilot: draw a path, get candles that follow it

The Path tool places swing anchors on the chart, and dragging an anchor
regenerates the series live from the stored path and seed. The candles
follow the drawn path, each anchor bar closes at the exact placed price,
and the chart is labelled AUTHORED PATH.

This is the slice that exercises the whole chain end to end: the series
registry, the revision hash, the evaluated pane state, the provenance
badge and preview/export agreement.

"
```

---

### Task 5: S4 — Market-linked drawing tools

**Requirements:** OB-001, OB-003, OB-004, OB-005, OB-006, CH-007, CPT-005

**Files:**

- Create: `packages/components/src/trading/drawings/price-line.tsx`, `high-low-line.tsx`, `vertical-line.tsx`, `trendline.tsx`, `price-zone.tsx`, `text-label.tsx`, `arrow.tsx`, `position.tsx`
- Create: `packages/components/src/trading/drawings/drawings.test.tsx`
- Create: `packages/components/src/trading/definitions/price-line.ts`, `high-low-line.ts`, `vertical-line.ts`, `trendline.ts`, `price-zone.ts`, `text-label.ts`, `arrow.ts`, `position.ts`
- Modify: `packages/components/src/registry.ts` (import the new definitions), `packages/components/src/registry.test.ts` (the catalogue count)
- Modify: `packages/ui/src/components/library/catalog.tsx` (name the new types in the chart tab)
- Modify: `packages/editor/src/store.ts` (the drawing commands), `packages/editor/src/store.test.ts`
- Modify: `packages/core/src/schemas.ts` (`Clip.locked`, `Clip.hidden`)
- Modify: `apps/studio/src/components/ToolRail.tsx` (the drawing tools), `apps/studio/src/components/PreviewPanel.tsx` (creation and selection), `apps/studio/src/components/selection-overlay.tsx` (the drawing handles), `apps/studio/src/components/canvas-hit-test.ts` (pick the drawings)

**Interfaces:**

- Consumes: `MarketAnchor`, `DrawingSpec`, `DrawingKind` (`packages/core/src/elements.ts`); `PaneFrameState` (`packages/core/src/time.ts`); the chart's `evaluate` step.
- Produces:
  - Eight new `ElementType` members, each registered by its own definition module and each appearing in the chart library tab.
  - `packages/editor/src/store.ts` — `addDrawing(kind, chartClipId, paneId, anchor)`, `updateDrawing(clipId, patch)`, `setDrawingLocked(clipId, locked)`, `setDrawingHidden(clipId, hidden)`; delete, duplicate, group and undo/redo reuse the existing commands (`removeClips` `:355`, `duplicateSelection` `:517`, `groupSelection` `:292`, `ungroupSelection` `:308`).
  - `packages/core/src/schemas.ts` — `Clip.locked?: boolean`, `Clip.hidden?: boolean`.

- [ ] **Step 1: Add the drawing types and their definitions**

Each drawing is a `Clip` with its own `ElementType`, its own track position, its own in/out frames and its own effects stack. Its props carry `chartClipId`, `paneId`, `anchors: Record<string, MarketAnchor>`, `in`, `out`, `opacity`, `curve?` and the kind-specific fields the design names: `position?: { direction, entry, stop, target, showRiskReward? }` for the position tool, `zone?: { extendRight? }` for the price zone, `label?: { text }` for the text label.

The trendline keeps two chart-bound endpoints; the zone carries price high/low and a horizontal interval with extend-right; the position tool carries entry, stop, target, direction and an optional R:R label and asserts no broker fill and no P&amp;L (OB-006).

Each definition module self-registers with `registerComponent` (`packages/core/src/registry.ts:13`) and is imported by the aggregator (`packages/components/src/registry.ts:11-16`).

- [ ] **Step 2: Name the new types in the library tab**

`packages/ui/src/components/library/catalog.tsx:36` names the chart tab's types. All eight drawing types go into that tab. A registered type that no tab names never appears in the library (ADR-007 decision 9) — the library tab mapping is the visibility mechanism and must be updated in the same slice as the registration.

- [ ] **Step 3: Resolve the anchors at render time**

A drawing never stores a pixel. Its `evaluate` step finds the chart clip in the same project, resolves the named pane, and resolves each `MarketAnchor` against that pane's `PaneFrameState`:

- a `price` anchor resolves to its price, then to a y through the pane's current range;
- a `candle` anchor resolves to the bar's high, low or close — and the drawing stays hidden until that bar is revealed, so an annotation can never reveal a future price;
- a `time` anchor resolves to the bar's time;
- a `point` anchor resolves to a price at a bar.

Because the anchors resolve against the pane's *current* scale, a price line tracks the price level rather than a pixel: resizing or re-scaling the chart cannot detach it (R1, CPT-005).

- [ ] **Step 4: Add the creation and editing surfaces**

`apps/studio/src/components/ToolRail.tsx` gains the eight drawing tools. `apps/studio/src/components/PreviewPanel.tsx` creates a drawing on a click over the chart, anchoring it to the pane under the pointer. `apps/studio/src/components/selection-overlay.tsx` draws the handles for a selected drawing — the price endpoints of a trendline, the high/low of a high/low line, the corners of a zone — and drags them. `apps/studio/src/components/canvas-hit-test.ts` picks the drawings as well as the clips.

The numeric inspector is per drawing kind, in the same style as the existing `CandlestickChartInspector` (`packages/components/src/trading/inspectors/candlestick-chart.tsx:30`).

- [ ] **Step 5: Add lock, hide and the drawing commands**

`packages/core/src/schemas.ts` gains `Clip.locked?: boolean` and `Clip.hidden?: boolean`. A locked drawing is not selectable on the canvas and not editable in the inspector; a hidden drawing is not rendered. Both are editor-side flags and never reach the render path.

- [ ] **Step 6: Write the failing tests**

`packages/components/src/trading/drawings/drawings.test.tsx` (new):

- "keeps a price line on its price when the chart rect changes" (R1) — fails before Step 3; passes after.
- "moves a drawing with the chart clip it is anchored to" (R6) — fails before Step 3; passes after.
- "hides a drawing anchored to a bar that has not been revealed" — fails before Step 3; passes after.
- "keeps a zone's high and low on their prices" — fails before Step 3; passes after.
- "draws a trendline between its two endpoints" — fails before Step 3; passes after.
- "shows the position entry, stop and target and no P&amp;L" (OB-006) — fails before Step 3; passes after.
- "renders a hidden drawing as nothing" — fails before Step 3; passes after.

`packages/editor/src/store.test.ts` (modify):

- "creates a price line as a clip anchored to a chart and a pane" — fails before Step 5; passes after.
- "duplicates a drawing without sharing its anchors" — fails before Step 5; passes after.
- "locks and hides a drawing" — fails before Step 5; passes after.
- "undoes a drawing deletion" — fails before Step 5; passes after.

`packages/components/src/registry.test.ts` (modify):

- "registers the whole catalogue from the aggregator alone" — the expected counts change from 26/22/1/3 (total/base/trading/motion) to 34/22/9/3 — the eight drawing types join the trading category. The test fails before Step 1 and passes after.

- [ ] **Step 7: Verify**

```bash
pnpm typecheck
pnpm test
pnpm build
node scripts/verify-r1.mjs
```

The executor must report the render-gate stills for frames 45, 100 and 179 against the drawing fixture: the price line and the trendline sit on their prices.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "Add the market-linked drawing tools

Price line, high/low line, vertical line, trendline, price zone, text
label, arrow and long/short position ship as clips that name a chart and a
pane and store market anchors, not pixels. The anchors resolve against
the pane's current scale at render time, so a line tracks its price when
the chart is resized, and a drawing anchored to a bar that has not been
revealed stays hidden.

Each tool is created on the canvas, edited by handles and by a numeric
inspector, and supports delete, duplicate, lock, group, hide and
undo/redo.

"
```

---

### Task 6: S5 — Panes, the shared clock and linked views

**Requirements:** CH-002, CH-003, CH-005, AN-007, TF-003, TF-005, CH-009, CH-010, CH-011, TF-008, TF-009

**Files:**

- Modify: `packages/core/src/time.ts` (the aggregation, the binding and the relation evaluation), `packages/core/src/time.test.ts`
- Modify: `packages/core/src/elements.ts` (`TimeframeId`, `TIMEFRAME_BASE_UNITS`, `PaneRelation`, `ChartGroupSpec` and the clock fields)
- Modify: `packages/core/src/validation.ts` (the ladder and relation rules), `packages/core/src/validation.test.ts`
- Modify: `packages/components/src/trading/chart.tsx` (the multi-pane renderer, the shared cursor), `packages/components/src/trading/definitions/candlestick-chart.ts` (the pane parameters)
- Modify: `packages/components/src/trading/inspectors/candlestick-chart.tsx` (the pane panel and the relation panel)
- Modify: `packages/components/src/trading/candlestick-chart.test.tsx`
- Modify: `packages/editor/src/presets.ts` (the grouped-chart layout presets)

**Interfaces:**

- Consumes: `PaneSpec`, `PaneRelation`, `TimeframeId`, `ChartGroupSpec`, `MarketClock`, `ClockBinding` (`packages/core/src/elements.ts`); `evaluatePaneAt` (`packages/core/src/time.ts`).
- Produces:
  - `packages/core/src/elements.ts` — `TimeframeId` (the twelve ladder rungs), `TIMEFRAME_BASE_UNITS` (each rung's size in one-minute base units), `PaneRelation` (`{ kind: 'rollup'; finePaneId; coarsePaneId }` | `{ kind: 'lockstep'; paneIds; timeframeId }`), `ChartGroupSpec` (one to three chart clips, a layout, the shared clock and the relations), and `CandlestickChartProps.relations?: PaneRelation[]`.
  - `packages/core/src/time.ts` — `evaluatePaneAt` resolves a `reference` binding exactly, an `offset` binding by the author's `offsetBars`, and a `utc` binding only when the series' `timeBasis` is `utc`; a pane's bucket is `floor(baseIndex / rung.baseUnits)` and the bucket aggregates only the constituents at or before the as-of index. Plus `evaluateRelation(relation, panes): RelationState` — the derived ratio and base for a rollup, the shared rung and candle count for a lockstep.
  - `packages/core/src/validation.ts` — the ladder and relation rules (spec §3.4.1–§3.4.3): a pane's rung must be a ladder rung and its factor must equal `rung.baseUnits / base.baseUnits`; a rollup's two panes must share a base; a lockstep's two panes must carry the same rung and the same effective candle count; a relation's pane ids must exist; a group must hold one to three charts.
  - `packages/components/src/trading/chart.tsx` — a chart renders `props.panes` — each pane with its own rect, its own price scale, its own lifecycle and its own aggregation — plus a shared cursor at the clock's reference index.
  - `packages/editor/src/presets.ts` — grouped-chart layout presets: single, horizontal split, vertical split, PIP.

- [ ] **Step 1: Resolve the clock bindings**

`ClockBinding` is `reference` (the pane follows the reference series' own bars), `offset` (an explicit authored offset in bars, logical time only) or `utc` (real market time; requires a `timeBasis: 'utc'` series and is unavailable while import is deferred). The `utc` binding must fail loudly — not silently fall back — when the series has no UTC basis.

Two different series are aligned by an author-supplied offset and never by row index (CH-005).

- [ ] **Step 2: Add the timeframe ladder**

`packages/core/src/elements.ts` gains the ladder as a fixed catalogue, and `timeframeId` becomes a
rung of it rather than a free multiplier:

```ts
export type TimeframeId =
  | '1m' | '3m' | '5m' | '15m' | '30m' | '1H'
  | '4H' | '6H' | '7H' | '2D' | '1W' | '1M';

/** How many base units (one minute) each rung spans. */
export const TIMEFRAME_BASE_UNITS: Record<TimeframeId, number> = {
  '1m': 1, '3m': 3, '5m': 5, '15m': 15, '30m': 30, '1H': 60,
  '4H': 240, '6H': 360, '7H': 420, '2D': 2880, '1W': 10080, '1M': 43200,
};
```

Measured across the ladder's 66 unordered pairs, 58 divide evenly and 8 do not (`3m→5m` 1.667,
`4H→6H` 1.5, `4H→7H` 1.75, `6H→7H` 1.167, `7H→2D` 6.857, `7H→1M` 102.857, `2D→1W` 3.5,
`1W→1M` 4.286). That is not a defect to engineer away — it is what the real calendar does, and it
is why the ladder is defined against a **base rung** rather than against each other. Every coarser
timeframe is built from the base, so the two panes are related *through the base* even when they
have no whole-number ratio to each other.

A pane therefore carries a `timeframeId` (a rung) and its `aggregation.factor` is **derived** as
`rung.baseUnits / base.baseUnits`, not typed in. The display shows the ratio that is true:
`24 × 1H` where that is whole, `1.5 × 4H` where it is not, and the base it is built from in every
case (TF-008, TF-009).

The ladder is a **clock-time** catalogue, not a session calendar: a day is 1440 minutes, but how
many of those minutes carry a price depends on the session (23 for a futures session, 6.5 for
regular cash hours), and across a daylight-saving boundary the answer changes again. The ratio is
delivered now; the calendar is not (TF-001, TF-007). The inspector shows the clock-time ratio and
does **not** claim a session count it cannot know.

- [ ] **Step 3: Declare the relation between panes**

The chart props carry `relations?: PaneRelation[]`. A relation is **declared**, never inferred from two panes sharing a chart, because only a declared relation can be checked, labelled and exported (CH-010). There are exactly two kinds:

- **`rollup`** — one asset at two timeframes. Both panes read the *same* base series; the fine pane shows the base rung's bars and the coarse pane buckets the same base into its rung, aggregated as-of. The relation between the two timeframes is **derived** from the ladder, never authored twice:
  ```text
  barsPerCoarse = coarse.baseUnits / fine.baseUnits
  ```

  Both panes' bucket boundaries are aligned to the base — the `6H` pane's fall on base units 360, 720, 1080… and the `4H` pane's on 240, 480, 720… — so the two timeframes share every boundary that is a multiple of both, which is what makes them comparable at all.
- **`lockstep`** — two assets on one timeframe. The two panes read *different* series and advance together on the shared clock, so a candle forming in one forms at the same moment in the other. The relation states the shared rung, and the validator requires that both panes carry the same rung and the same effective `viewport.barCount` — the same number of candles, moving together. The second pane's binding is `offset` with `offsetBars: 0`.

  Because the two series share no market truth yet, this link is **authored**: the inspector labels it "authored link — not market time" and the export metadata records it as authored (R13). The visual result of an authored link and a UTC link is identical, so the claim has to live in the label and the metadata, never in the picture.

`evaluateRelation(relation, panes)` returns the derived state: for a rollup, `{ kind: 'rollup'; barsPerCoarse; fineTimeframeId; coarseTimeframeId; baseTimeframeId }`; for a lockstep, `{ kind: 'lockstep'; timeframeId; barCount }`. The validator rejects a rollup whose panes do not share a base, and rejects a lockstep whose two panes disagree on the rung or the candle count.

- [ ] **Step 4: Add the grouped chart**

`ChartGroupSpec` is the scene-level container for the split layouts: one to three chart clips, a
layout (`single`, `split-horizontal`, `split-vertical`, `pip`), the shared clock and the declared
relations (CH-011). The count is a product limit, not an arbitrary one: SMT compares two or three
assets and never more (SM-001, SM-011), so the layout the comparison workflow needs is the layout
the product already has.

The group owns the *arrangement* — the layout, the clock, the relations. It does **not** own the
charts' data, lifecycles or prices: each chart keeps its own series, price scale, viewport and
in/out frames (CH-003, CH-004), and the group's convenience is that the charts move together by
default, never that they are forced to (SC-002).

- [ ] **Step 5: Aggregate as-of**

With `aggregation.factor = n`, the bucket index is `floor(sourceIndex / n)` and the bucket's state aggregates only the constituents with index `<= sourceIndex`. A partially formed bucket is marked `developing: true` and is labelled `DEVELOPING` in the editor (TF-004). The `auto` price range of a pane is computed from the revealed bars only, so a future bar never moves that pane's axis.

- [ ] **Step 6: Render multiple panes**

`packages/components/src/trading/chart.tsx` draws each pane inside its own rect with its own price scale and viewport. The pane rect is in 0..1 of the chart's box, so a pane scales with the chart and its anchors resolve against the same rect (R1).

The shared cursor is the chart clock: one reference index across the panes, each with its own scale (CH-003, AN-007). A lockstep pair therefore shows both assets at the same instant, with the same number of candles.

- [ ] **Step 7: Add the pane inspector and the presets**

The chart inspector gains a pane panel: add, remove, reorder a pane; set its series, timeframe, aggregation factor, rect, lifecycle and opacity; set its clock binding. It gains a relation panel: declare a rollup or a lockstep, see the derived ratio, and see the "authored link — not market time" label on a cross-asset link. The presets in `packages/editor/src/presets.ts` (`:47`, 14 entries today) gain the pane arrangements, including the two split kinds.

- [ ] **Step 8: Write the failing tests**

`packages/core/src/time.test.ts` (modify):

- "aggregates only the constituents at or before the as-of index" (R4, TF-003) — exists from Task 1; keep, and extend with the multi-pane case.
- "offsets a pane by the authored number of bars" — fails before Step 1; passes after.
- "never aligns two series by row index" — fails before Step 1; passes after.
- "refuses a utc binding on a logical series" — fails before Step 1; passes after.
- "marks a partially aggregated bucket as developing" — fails before Step 5; passes after.
- "buckets a pane's bars by the ladder rung's base units" — fails before Step 2; passes after. The `6H` pane's buckets fall on base units 360, 720, 1080…
- "derives the rollup ratio from the two rungs" — fails before Step 3; passes after. The ratio always agrees with the data (TF-008).
- "states a fractional ratio truthfully rather than rounding it" — fails before Step 3; passes after. `4H` over `6H` is 1.5, and the panel says so (TF-009).
- "advances a lockstep pair together on the shared clock" — fails before Step 3; passes after. Both panes consume the same number of bars at every frame.

`packages/core/src/validation.test.ts` (modify):

- "rejects a timeframe that is not a ladder rung" — fails before Step 2; passes after.
- "derives a pane's factor from its rung and the base" — fails before Step 2; passes after.
- "rejects a rollup whose panes do not share a base" — fails before Step 3; passes after.
- "rejects a lockstep whose panes disagree on the candle count" — fails before Step 3; passes after.
- "rejects a relation naming a pane that does not exist" — fails before Step 3; passes after.
- "rejects a group holding more than three charts" — fails before Step 4; passes after (CH-011).

`packages/components/src/trading/candlestick-chart.test.tsx` (modify):

- "draws two panes side by side with independent price scales" — fails before Step 6; passes after.
- "draws one instrument at two timeframes from the same source" — fails before Step 6; passes after.
- "draws two instruments on one timeframe moving together with the same candle count" — fails before Step 6; passes after.
- "moves the shared cursor with the clock" — fails before Step 6; passes after.
- "labels a cross-asset link as authored rather than market time" — fails before Step 7; passes after (R13).

- [ ] **Step 9: Verify**

```bash
pnpm typecheck
pnpm test
pnpm build
node scripts/verify-r1.mjs
```

The executor must report the render-gate stills for frames 45 and 140 against the pane fixture: one rollup pair on a single series and one lockstep pair across two series, the lockstep pair showing the same number of candles at the same instant.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "Add panes, the shared market clock and the two kinds of split

A chart is now a collection of panes, each with its own series, rect,
price scale, viewport, lifecycle and aggregation, all evaluated against
one shared clock.

The relation between panes is declared rather than assumed, in one of two
forms: one asset at two timeframes, where the coarser pane aggregates the
same source as-of and the ratio between the timeframes is read off the
panes so it always agrees with the data; and two assets on one timeframe,
moving together with the same number of candles. A cross-asset link is
authored, so the inspector and the export metadata say so in words.

Presets cover HTF alone, LTF alone, the splits and PIP.

"
```

---

### Task 7: S6 — Pause points and holds

**Requirements:** AN-006, AN-008, CH-004

**Files:**

- Modify: `packages/core/src/time.ts` (the hold evaluation), `packages/core/src/time.test.ts`
- Modify: `packages/components/src/trading/chart.tsx` (the hold rendering, the camera zoom track)
- Modify: `packages/components/src/trading/definitions/candlestick-chart.ts` (the hold and zoom parameters)
- Modify: `packages/components/src/trading/inspectors/candlestick-chart.tsx` (the hold panel)
- Modify: `packages/editor/src/store.ts` (the hold commands), `packages/editor/src/store.test.ts`
- Modify: `packages/components/src/trading/candlestick-chart.test.tsx`

**Interfaces:**

- Consumes: `PaneHold`, `ZoomTrack` (`packages/core/src/elements.ts`); `PaneFrameState` (`packages/core/src/time.ts`).
- Produces:
  - `packages/core/src/time.ts` — a hold freezes a pane on one bar for an in/out frame range; the pane shows its last-known values and **no bar is fabricated to fill a gap** (AN-008).
  - `packages/editor/src/store.ts` — `addHold(clipId, paneId, barId, in, out)`, `updateHold(clipId, paneId, holdId, patch)`, `removeHold(clipId, paneId, holdId)`.
  - `packages/components/src/trading/chart.tsx` — the camera zoom track: a list of segments with a from/to aggregation and from/to bar index, each with an optional curve.

- [ ] **Step 1: Evaluate the holds**

A `PaneHold` names a `barId` and an `[in,out)` range relative to the chart clip. Inside the range, the pane's state is the state of that bar — frozen at its last-known values. No bar is invented to fill a gap, and the reveal does not advance past the held bar until the hold ends.

- [ ] **Step 2: Add the camera zoom track**

`ZoomTrack.segments` moves a pane from one aggregation and bar range to another across a frame range, with an optional curve per segment. The zoom changes the viewport only — the underlying bars and their prices are never rewritten (TF-006).

- [ ] **Step 3: Add the hold and zoom controls**

The chart inspector gains a hold panel: pick a bar, set the in/out frames, add, edit, remove a hold. The zoom track is edited as a list of segments.

- [ ] **Step 4: Write the failing tests**

`packages/core/src/time.test.ts` (modify):

- "holds the last known values inside a hold" — fails before Step 1; passes after.
- "fabricates no bar to fill a gap" (AN-008) — fails before Step 1; passes after.
- "resumes the reveal after the hold" — fails before Step 1; passes after.

`packages/editor/src/store.test.ts` (modify):

- "adds a hold to a pane and undoes it" — fails before Step 3; passes after.

`packages/components/src/trading/candlestick-chart.test.tsx` (modify):

- "freezes the held candle and shows the hold marker" — fails before Step 1; passes after.
- "zooms the viewport without changing a price" — fails before Step 2; passes after.

- [ ] **Step 5: Verify**

```bash
pnpm typecheck
pnpm test
pnpm build
node scripts/verify-r1.mjs
```

The executor must report the render-gate stills for frames 45, 100 and 140 against the hold fixture: the held candle does not advance inside the hold.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "Add pause points and the camera zoom track

A pane can hold on one candle for a defined in and out range: the pane
shows its last-known values and no bar is fabricated to fill the gap. A
zoom track moves a pane between aggregations and bar ranges across the
clip, changing the viewport only and never a price.

"
```

---

### Task 8: S7 — Curves end to end

**Requirements:** CV-001, CV-002, CV-003, CV-004, AN-002, TL-002

**Files:**

- Create: `packages/ui/src/components/inspector/curve-editor.tsx`, `packages/ui/src/components/inspector/curve-editor.test.tsx`
- Create: `packages/components/src/base/effects.test.ts`
- Modify: `packages/ui/src/index.ts` (export the curve editor), `packages/ui/package.json` (dev dependencies for the new test: `@testing-library/react` and `@testing-library/dom`, the versions `packages/components` and `packages/editor` already use; `jsdom` is already present in the workspace through `apps/studio` and resolves for the root Vitest run — add it here as well if the environment fails to resolve)
- Modify: `packages/components/src/base/effects.ts` (`EASING_PARAM` at `:50-55` gains `custom` and a bezier parameter; `fadeIn` `:69`, `fadeOut` `:77`, `blurIn` `:381` gain an easing parameter; `spinIn` `:146` and `bounceDrop` `:309` gain an easing parameter in place of their hardcoded curve)
- Modify: `packages/components/src/trading/chart.tsx` (the per-candle growth curve), `packages/components/src/trading/definitions/candlestick-chart.ts` (the curve parameters)
- Modify: `packages/components/src/trading/inspectors/candlestick-chart.tsx` (the curve control)
- Modify: `packages/core/src/curve.ts` (the presets the widget offers), `packages/core/src/curve.test.ts`

**Interfaces:**

- Consumes: `Curve`, `evaluateCurve` (`packages/core/src/curve.ts`); `ParamControl` (`packages/ui/src/components/inspector/param-control.tsx:90-206`); the Radix `Slider` (`packages/ui/src/components/ui/slider.tsx`).
- Produces:
  - `packages/ui/src/components/inspector/curve-editor.tsx` — `CurveEditor: React.FC<{ value: Curve; onChange: (curve: Curve) => void }>` — the one widget, used by every surface that exposes a curve (CV-004). A preset list plus a draggable cubic-bezier control; it writes `Curve` values for elements and panes and the legacy `easing`/`bez` strings for effects.
  - `packages/components/src/base/effects.ts` — the extended easing vocabulary.

- [ ] **Step 1: Extend the effect easing vocabulary, carefully**

The legacy vocabulary stays on Remotion's `Easing` (`packages/components/src/base/effects.ts:17-48`) so **no existing rendered frame changes** (R8). The changes are additive:

- `EASING_PARAM` (`:50-55`) gains the `custom` option and a matching `bez` text parameter — the shape `transform` already uses (`:338-339`);
- `fadeIn` (`:69`), `fadeOut` (`:77`) and `blurIn` (`:381`) gain an `easing` parameter; `fadeIn` is currently linear (`:570`), `fadeOut` linear (`:573`), `blurIn` linear (`:760`);
- `spinIn` (`:146`) replaces its hardcoded `Easing.out(cubic)` (`:619`) with an `easing` parameter defaulting to `easeOut`;
- `bounceDrop` (`:309`) replaces its hardcoded `Easing.bounce` (`:713`) with an `easing` parameter defaulting to `bounceOut`.

Every default reproduces today's behaviour exactly, so an existing project renders byte for byte as before.

- [ ] **Step 2: Write the curve editor**

`packages/ui/src/components/inspector/curve-editor.tsx` presents a preset list and a draggable two-handle cubic-bezier control. It reads and writes `Curve` values: `{ kind: 'preset', name }` or `{ kind: 'cubicBezier', p }`. For an effect it writes the legacy strings instead — `easing: 'custom'` plus `bez: "x1, y1, x2, y2"` — so the two vocabularies stay where they belong and the creator edits a curve in one place (CV-004).

- [ ] **Step 3: Apply the curve to elements, panes and candles**

`packages/components/src/trading/chart.tsx` uses the pane's `curve` for the pane's growth: a pane's candles form along the curve rather than linearly, and where meaningful the curve applies per candle. `evaluateCurve` is the only evaluator — the same function in the preview and in the export (CV-003).

- [ ] **Step 4: Write the failing tests**

`packages/components/src/base/effects.test.ts` (new):

- "keeps the legacy easing names meaning what they meant" (R8) — fails before Step 1; passes after: `bounceOut` is still `Easing.bounce`, not `Easing.out(Easing.bounce)`, and `elastic` is still `Easing.out(Easing.elastic(1.4))`.
- "renders a fadeIn with the default easing as it did before" — fails before Step 1; passes after.
- "applies a custom easing to fadeIn" — fails before Step 1; passes after.
- "applies a custom easing to spinIn in place of the hardcoded curve" — fails before Step 1; passes after.
- "applies an easing to bounceDrop in place of the hardcoded curve" — fails before Step 1; passes after.

`packages/core/src/curve.test.ts` (modify):

- "evaluates the same curve to the same value at the same t" (R3) — exists from Task 1; keep.
- "maps every preset onto the same endpoints" — exists from Task 1; keep.

`packages/ui/src/components/inspector/curve-editor.test.tsx` (new):

- "writes a preset curve as a Curve value" — fails before Step 2; passes after.
- "writes a dragged bezier as four control points" — fails before Step 2; passes after.
- "writes the legacy easing and bez strings for an effect" — fails before Step 2; passes after.

`packages/components/src/trading/candlestick-chart.test.tsx` (modify):

- "renders a curve-driven frame the same way on a fresh render and on a seek" (R3) — fails before Step 3; passes after.

- [ ] **Step 5: Verify**

```bash
pnpm typecheck
pnpm test
pnpm build
node scripts/verify-r1.mjs
```

The executor must report the render-gate stills for frames 45 and 100 against the curve fixture, and confirm that a project with no curve renders exactly as it did before this slice.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "Extend the curve vocabulary and give every surface one curve editor

Elements, panes and candles take a curve stored as data and evaluated by
one pure function, so the same curve produces the same frame in the
preview and in the export. The effect easing control gains a custom
cubic-bezier option, the effects that were static or linear gain an
easing parameter, and the effects that carried a hardcoded curve gain one
in place of it.

The legacy Remotion easing vocabulary keeps its meaning, so no existing
rendered frame changes. One widget edits every curve.

"
```

---

### Task 9: S8 — Transitions and richer effects

**Requirements:** TL-001, TL-006, EX-003

**Files:**

- Create: `packages/core/src/transition.ts`, `packages/core/src/transition.test.ts`
- Modify: `packages/core/src/schemas.ts` (`Track.transitions?: TrackTransition[]`)
- Modify: `packages/core/src/index.ts`
- Create: `packages/components/src/base/transitions.ts` (the transition components and their definitions)
- Modify: `packages/components/src/base/definitions.ts`, `packages/components/src/registry.ts`, `packages/components/src/registry.test.ts`
- Modify: `packages/video/src/composition.tsx` (render the transition between adjacent clips)
- Modify: `packages/editor/src/store.ts` (the transition commands), `packages/editor/src/store.test.ts`
- Modify: `apps/studio/src/components/Inspector.tsx` (the transition slot and the clamp report)

**Interfaces:**

- Consumes: `Clip`, `Track` (`packages/core/src/schemas.ts`); `registerComponent` (`packages/core/src/registry.ts:13`).
- Produces:
  - `packages/core/src/schemas.ts` — `TrackTransition { id, fromClipId, toClipId, element: ElementType, durationInFrames, props? }`, and `Track.transitions?: TrackTransition[]`.
  - `packages/core/src/transition.ts` — `clampTransitionDuration(from: Clip, to: Clip, requested: number): number` — the duration the adjacent clips can actually give.
  - `packages/components/src/base/transitions.ts` — the transition components: a crossfade and a wipe, each registering itself like every other component.

- [ ] **Step 1: Add the transition slot**

ADR-003's addendum decides the location: a transition belongs to the boundary between two clips on a track, not to a clip. `Track.transitions` is that slot. Nothing in the slot is scene-specific — the hierarchical timeline will reuse it.

- [ ] **Step 2: Clamp the duration and report the clamp**

`clampTransitionDuration(from, to, requested)` returns the largest duration the two adjacent clips can give without overlapping either clip's content. The inspector shows the requested value and the clamped value, and says that the duration was clamped (TL-006). The transition never retimes the underlying market history: the clips keep their own in/out frames.

- [ ] **Step 3: Build the transition components**

A transition is a registry component like any other: `registerComponent` (`packages/core/src/registry.ts:13`), its own `ElementType`, its own defaults, its own `render`. The composition renders a transition between two adjacent clips on the same track, at the boundary, for the clamped duration.

The transition renders **only** in the composition. Editor affordances — the slot, the handles, the duration field — never reach the render path (CPT-005).

- [ ] **Step 4: Add the editor surface**

`apps/studio/src/components/Inspector.tsx` gains a transition section on a clip: the transition element, its duration and the clamped duration. The store gains `addTransition`, `updateTransition` and `removeTransition`.

- [ ] **Step 5: Write the failing tests**

`packages/core/src/transition.test.ts` (new):

- "clamps a transition to the shorter adjacent clip" — fails before Step 2; passes after.
- "never lets a transition overlap the outgoing clip" — fails before Step 2; passes after.
- "keeps the clips' own in and out frames" — fails before Step 1; passes after.

`packages/components/src/registry.test.ts` (modify):

- "registers the whole catalogue from the aggregator alone" — the expected counts change from 34/22/9/3 to 36/24/9/3 — the two transition components join the base category. Fails before Step 3; passes after.

`packages/editor/src/store.test.ts` (modify):

- "adds a transition between two adjacent clips" — fails before Step 4; passes after.

- [ ] **Step 6: Verify**

```bash
pnpm typecheck
pnpm test
pnpm build
node scripts/verify-r1.mjs
```

The executor must report the render-gate stills for frames 45 and 100 against the transition fixture: the transition boundary renders and the clips keep their own timings.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "Add a transition slot on the track boundary

A transition belongs between two clips on a track, so the track gains an
optional list of them and the transition itself is a registry component.
The compositor clamps the duration to what the adjacent clips can give and
the inspector reports the clamp rather than overlapping a clip silently.
The clips keep their own in and out frames: a transition never retimes
market history.

"
```

---

### Task 10: S9 — Transport actions and duration modes

**Requirements:** TL-009, TL-010, TL-001, TL-005

**Files:**

- Create: `packages/core/src/duration.ts`, `packages/core/src/duration.test.ts`
- Modify: `packages/core/src/schemas.ts` (`Project.durationMode` becomes required after the migration), `packages/core/src/index.ts`
- Modify: `apps/studio/src/components/PreviewPanel.tsx` (the generic transport action bar)
- Modify: `apps/studio/src/components/TopBar.tsx` (the duration mode toggle and the draggable slider)
- Modify: `packages/editor/src/store.ts` (the duration commands), `packages/editor/src/store.test.ts`
- Modify: `packages/video/remotion/Root.tsx` (the composition's length from the mode), `packages/video/src/composition.tsx`

**Interfaces:**

- Consumes: `TransportAction` (`packages/core/src/contract.ts`); `playerRef.seekTo`, `togglePlay` (`packages/editor/src/playerRef.ts`); the `Slider` (`packages/ui/src/components/ui/slider.tsx`); `Project.durationInFrames`, `Project.durationMode`.
- Produces:
  - `packages/core/src/duration.ts` — `derivedDuration(project): number` — the maximum of every clip's `from + durationInFrames` and every chart element's `out`, clamped to at least one frame.
  - `packages/editor/src/store.ts` — `setDurationMode(mode)`, `setFixedDuration(seconds)`.
  - `apps/studio/src/components/PreviewPanel.tsx` — renders the **selected clip's** definition's `transportActions` in the floating transport bar and executes them generically.

- [ ] **Step 1: Implement the derived duration**

`derivedDuration(project)` walks every track and clip and takes the maximum of `clip.from + clip.durationInFrames` and, for a chart clip, the maximum `out` of its panes and drawings. The result is clamped to at least one frame.

The mode is `derived` or `fixed` (TL-009). There is **no engine ceiling**: 240 frames / 8 s is the seeded sample project's value (`packages/core/src/sample-project.ts:8`), the seconds field allows up to 3600 (`apps/studio/src/components/TopBar.tsx:404-414`) and the migration accepts any positive `durationInFrames` (`packages/components/src/project-migrate.ts:100-101`). This slice changes the *mode*, not the limit.

- [ ] **Step 2: Make the composition honour the mode**

`packages/video/remotion/Root.tsx`'s `calculateMetadata` (`:17-28`) returns `durationInFrames: project.durationMode === 'derived' ? derivedDuration(project) : project.durationInFrames`. A fixed project keeps exactly its authored length.

- [ ] **Step 3: Render and execute the transport actions generically**

`apps/studio/src/components/PreviewPanel.tsx` renders the transport bar (`:362-418`). Add, to the right of the mute button and before the time readout, the buttons declared by the **selected clip's** definition's `transportActions` (`packages/core/src/contract.ts`). Execution:

- `seek` calls `seekTo({ props, sceneFrame })`; a `null` result disables the button for that frame;
- `toggle` flips the `holds` array of the pane the component owns.

**No component name is hardcoded in `apps/studio`** (TL-010, CPT-003). The shell knows only the contract.

- [ ] **Step 4: Add the duration slider**

`apps/studio/src/components/TopBar.tsx` keeps the seconds field (`:404-414`) and adds a draggable slider bound to the same value, plus a mode toggle between `derived` and `fixed`. In `derived` mode the slider is disabled and the readout shows the derived length.

- [ ] **Step 5: Write the failing tests**

`packages/core/src/duration.test.ts` (new):

- "derives the duration from the longest clip" — fails before Step 1; passes after.
- "includes the chart elements' out frames" — fails before Step 1; passes after.
- "clamps a derived duration to at least one frame" — fails before Step 1; passes after.
- "leaves a fixed duration alone" — fails before Step 2; passes after.

`packages/editor/src/store.test.ts` (modify):

- "switches the duration mode and keeps the fixed length" — fails before Step 1; passes after.

- [ ] **Step 6: Verify**

```bash
pnpm typecheck
pnpm test
pnpm build
node scripts/verify-r1.mjs
```

The executor must report the render-gate stills for frames 0 and 179 and the composition length the gate prints for the derived fixture.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "Add derived and fixed duration and execute declared transport actions

The composition length is either derived from the elements or fixed by the
author, and the fixed value is adjustable with a draggable slider next to
the seconds field. The 8 second figure is the seeded sample project's
value, not a cap: the field already allows up to an hour.

A component may declare transport actions and the shell renders and
executes them generically in the transport bar. No component name is
hardcoded in the studio.

"
```

---

### Task 11: S10 — The richer inspector, export provenance and the final verification

**Requirements:** OB-004, CV-004, EX-003, QA-002, QA-005, MD-001, AN-005

**Files:**

- Create: `packages/core/src/provenance.ts`, `packages/core/src/provenance.test.ts`
- Modify: `packages/core/src/index.ts`, `packages/core/src/validation.ts` (the project document validator now backs the migration's scalar checks)
- Create: `packages/components/src/trading/inspectors/drawing-panels.tsx` (the per-drawing-kind numeric panels)
- Modify: `packages/components/src/trading/inspectors/candlestick-chart.tsx` (the chart panel: panes, clock, holds, curve, provenance)
- Modify: `apps/studio/src/components/Inspector.tsx` (per-element-type panels replacing the generic parameter list)
- Modify: `packages/video/tools/render.mjs` and `packages/video/tools/server.mjs` (write the provenance sidecar next to the MP4)
- Modify: `packages/components/src/trading/chart.tsx` (the final badge set)
- Modify: `scripts/verify-r1.mjs` (the final fixture)
- Modify: `docs/spec/FUNCTIONAL_SPEC.md`, `docs/spec/COMPONENT_CONTRACT.md`, `docs/roadmap/ROADMAP.md`, `docs/quality/TEST_STRATEGY.md`

**Interfaces:**

- Consumes: `SeriesSpec`, `Datasource`, `seriesRevision` (`packages/core/src/series.ts`); `PaneSpec`, `DrawingSpec` (`packages/core/src/elements.ts`); `Curve` (`packages/core/src/curve.ts`); `CurveEditor` (`packages/ui/src/components/inspector/curve-editor.tsx`).
- Produces:
  - `packages/core/src/provenance.ts` — `buildProvenance(project): ProvenanceRecord` — per series: `origin`, `algorithmVersion`, `seed`, `revision`, bar count, anchor count; plus the simulation flags.
  - `packages/video/tools/render.mjs` and `packages/video/tools/server.mjs` — a `<output>.provenance.json` sidecar beside the rendered MP4.

- [ ] **Step 1: Build the provenance record**

`buildProvenance(project)` returns the record the design's §5 table defines:


| Origin          | Export metadata                                    |
| --------------- | -------------------------------------------------- |
| `authored-path` | `origin`, `algorithmVersion`, `seed`, anchor count |
| `manual`        | `origin`, bar count                                |
| `synthetic`     | `origin`, `algorithmVersion`, `seed`               |
| `imported`      | `origin`, source revision, timestamp convention    |


Independently of the origin, the record carries the simulation flags: a chart that reveals bars dynamically is a simulated intrabar path (AN-005, MD-001, QA-005).

- [ ] **Step 2: Write the sidecar at export**

`packages/video/tools/render.mjs` and `packages/video/tools/server.mjs` write `<output>.provenance.json` next to the MP4, containing the record and the project's schema version, the fps and the frame count. The export therefore carries its provenance with it, and a reopened document's labels survive (QA-005).

- [ ] **Step 3: Write the per-element-type inspector panels**

`apps/studio/src/components/Inspector.tsx` currently renders the definition's generic `params` list (`:254-300`) plus the custom panel (`:302-307`). Replace the generic list for the trading components with per-element-type panels:

- the chart panel: the series and its origin, the panes, the clock and each pane's binding, the holds, the price-range policy, the curve, and the provenance;
- one numeric panel per drawing kind: the anchors as numbers, the direction, entry, stop, target and the R:R toggle for the position tool; the high, low and extend-right for the zone; the two endpoints and the ray for the trendline; the text for the label.

Every panel that exposes a curve uses the one `CurveEditor` widget (CV-004). The generic parameter list stays for the base and motion components, which have no element model.

**A panel per element type, and one per group.** A creator's productivity comes from the inspector
showing the controls that apply to *what is selected*, with the values that matter for that type
and nothing else. The panel is chosen by the selected object's type:

- selecting a **grouped chart** shows the group's panel: the member charts, the layout, the shared
clock, and the relations — each relation showing the **derived** timeframe ratio, not an editable
number, so the displayed ratio can never disagree with the data (spec §3.4.1). The relation panel
also carries the "authored link — not market time" label on a cross-asset lockstep;
- selecting a **chart** shows the chart panel: the series and its origin, the panes and their
rungs, the clock binding, the holds, the price-range policy, the curve and the provenance;
- selecting a **drawing** shows that drawing kind's numeric panel;
- selecting a **text or image** shows its own placement and timing controls.

The ladder is a **rung picker**, not a free multiplier: choosing a timeframe selects from the fixed
catalogue (`1m`, `3m`, `5m`, `15m`, `30m`, `1H`, `4H`, `6H`, `7H`, `2D`, `1W`, `1M`), and the panel
shows the relationship that selection implies — `1H = 60 × 1m` — rather than asking the creator to
type a factor.

- [ ] **Step 4: Move the migration's scalar checks behind the validator**

ADR-008 splits the migration: the shape checks live in Zod, the history-dependent checks stay hand-written. `packages/core/src/validation.ts`'s `validateProjectDocument` now covers the positive `fps`, `width`, `height` and `durationInFrames` and the `tracks` array shape (currently `packages/components/src/project-migrate.ts:96-101`), and reports the path of the offending field. The migration keeps its version gate, its unknown-component rejection and its `propsVersion` comparison.

- [ ] **Step 5: Write the failing tests**

`packages/core/src/provenance.test.ts` (new):

- "records the origin, seed and algorithm version of an authored path" — fails before Step 1; passes after.
- "records the simulation flags independently of the origin" — fails before Step 1; passes after.
- "records nothing for a project with no chart" — fails before Step 1; passes after.

`packages/components/src/trading/candlestick-chart.test.tsx` (modify):

- "keeps the provenance labels of every origin distinct" — fails before Step 5; passes after.

`packages/components/src/project-migrate.test.ts` (modify — keep every existing name):

- "reports the path of the offending field for a malformed document" — fails before Step 4; passes after.

- [ ] **Step 6: Extend the render gate to the final fixture**

`scripts/verify-r1.mjs` builds a project with two panes on one series, a second series with an authored path, a price line and a trendline, a curve-driven pane growth, a hold, a crossfade and a derived duration. The executor must report the byte size of all six stills (frames 0, 20, 45, 100, 140, 179) and the MP4 outcome.

- [ ] **Step 7: Run the full sweep and report**

```bash
pnpm typecheck
pnpm test
pnpm build
node scripts/verify-r1.mjs
```

The executor must report: the observed test count and the file count (the suite was 154 tests over 12 files before this plan — `docs/quality/TEST_STRATEGY.md` §3), the typecheck result, the build result, all six still sizes, the MP4 outcome, and the provenance sidecar's contents.

- [ ] **Step 8: Update the documents**

- `docs/spec/FUNCTIONAL_SPEC.md` §2, §3, §5 — confirm the new IDs (MD-009, MD-010, AP-001 … AP-004, CH-009, OB-010, CV-001 … CV-004, TL-009, TL-010) read as implemented.
- `docs/spec/COMPONENT_CONTRACT.md` §2, §3, §6 — the `evaluate` step, the transport actions and the two coexisting curve vocabularies, as implemented.
- `docs/roadmap/ROADMAP.md` §2 (R2.5) — mark the stage's items against what actually shipped, and record the deferred list above.
- `docs/quality/TEST_STRATEGY.md` §3 — replace "the new test surface is **not yet covered**" with the surfaces the suite now covers and the assertion set it pins.

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "Replace the generic parameter list with per-element panels and export provenance

Charts, panes and each drawing kind get their own inspector panel, every
surface that exposes a curve uses the one curve editor, and the export
writes a provenance sidecar beside the video: the origin, the seed, the
algorithm version, the revision and the simulation flags travel with the
file.

The migration's scalar checks move behind the Zod validator and report the
path of the offending field, while the version gate, the unknown-component
rejection and the props version comparison stay hand-written.

"
```

---

## What the executor must report at the end

- Per slice: the observed `pnpm typecheck`, `pnpm test` and `pnpm build` results; the render-gate still sizes and MP4 outcome for the slices that require it; the browser interaction observed for the slices with a UI.
- The final test count and file count, the six still sizes, the MP4 outcome, and the provenance sidecar's contents.
- Every item listed in the Deferred work section, named as still deferred.
- Anything not exercised, named as unverified.