# Chart Studio — Independent drawing elements — implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the eight drawing tools ordinary elements, in **TradingView's vocabulary**. A horizontal line, vertical line, trend line, high and low line, rectangle, text label, arrow and long/short position tool each own a box in composition space, own their frame range on the timeline, and render whether or not a chart exists anywhere in the project. A drawing never reads a chart's scale, bars or pane — not even for one moment at placement time. Every kind is pure geometry: there are no market values anywhere in the set, and the creator's own figure is a caption.

**Architecture:** Four vertical slices over one object model. Project schema version 3 replaces the market-anchor drawing props (`chartClipId`, `paneId`, `anchors`, chart-relative `in`/`out`) with an independent geometry: a box (`x`, `y`, `width`, `height`), `opacity`, `style`, an optional `caption`, and per-kind content — normalised `points` inside the box for the kinds that have them, and three draggable levels inside the box for the position tool. Two kinds are renamed in the same cutover: `priceLine` becomes `horizontalLine` and `priceZone` becomes `rectangle`, because a line that keeps the name `priceLine` while holding no price is a false label. The eight adapters draw in their own box instead of the chart's; the drawing definitions lose their chart lookup and their `evaluate` step; `anchors.ts` and the `MarketAnchor` type go. A v2 → v3 migration converts existing documents, mapping the old element types to the new ones, keeping a price line's price as its caption, and placing elements using the chart's plot area and full-series price range — an approximation at the last frame, stated in the migration's own comment. The editor gains draggable point handles (reusing the swing path's machinery) and a canvas context menu over the actions that already exist (group, ungroup, duplicate, copy, paste, delete) plus new layer-order and rename actions, and lock/hide generalise from drawings-only to every clip.

**Tech Stack:** pnpm 10.28.2, Turborepo 2.11.10, Node 24.20.0, TypeScript 5.6.3, Vite 5.4.11, React 18.3.1, Remotion 4.0.538, Zustand 5.0.3, Tailwind CSS 4.3.3, Vitest 3.2.7, Zod 4.5.4 (`packages/core` only), radix-ui 1.8.1 (already a `packages/ui` dependency — the context menu needs no new package)

**Design spec:** `docs/superpowers/specs/2026-11-01-independent-drawing-elements-design.md` (edition 1.1). Decisions: `docs/decisions/ADR-009-INDEPENDENT-DRAWING-ELEMENTS.md`.

**Companion docs this plan updates as it goes:** `docs/spec/FUNCTIONAL_SPEC.md` (§2, §3, §5), `docs/spec/COMPONENT_CONTRACT.md`, `docs/roadmap/ROADMAP.md` (R3), `docs/quality/TEST_STRATEGY.md` (§3).

---

## Global Constraints

- `packages/core` imports no React, Remotion, Zustand or storage code at runtime. Its only React contact stays the type-only import at `packages/core/src/contract.ts:1`.
- Zod lives in `packages/core` only, imported as `import * as z from 'zod/v4'`, pinned exactly at `4.5.4`. Validators cross the package boundary as plain `{ ok: true, value }` / `{ ok: false, issues }` results — no consumer outside core names a Zod symbol (ADR-008). `packages/core/src/validation.ts` is the only module in the workspace that may name a Zod symbol.
- `VideoComponentDefinition` has no `propsSchema` field. The new drawing props are validated by a new exported validator, `validateDrawingProps(kind, props)` in `packages/core/src/validation.ts`, returning the plain `{ok, value}` / `{ok, issues}` shape.
- Cross-package imports use the package name and `workspace:*`. No TypeScript path alias crosses a package boundary. A package's relative imports stay extensionless; one tsconfig per package; typecheck only, no `dist`.
- The migration stays non-destructive and idempotent: `migrateProject(migrateProject(p))` deep-equals `migrateProject(p)`, and unknown keys survive. The migration keeps its history-dependent rejections (higher `schemaVersion`, unknown component type, newer clip `propsVersion` — `packages/components/src/project-migrate.ts:28-90`).
- No component `type` is renumbered or reused. **One exception, and it is stated in ADR-009 decision 9:** `priceLine` is renamed `horizontalLine` and `priceZone` is renamed `rectangle`, and the v2 → v3 migration maps the old element types to the new ones. The reason is the same rule the product applies to every name: a line that keeps the name `priceLine` while holding no price is a false label. The other six `DrawingKind` values keep their ids (`packages/core/src/elements.ts:182`).
- Clean cutover. There is no shim, alias or legacy read path for `MarketAnchor`, `DrawingSpec`, `anchors.ts`, `REQUIRED_ANCHORS`, `resolveAnchors`, `buildDrawingAnchors`, `drawingBarId`, `resolveDrawingTarget`, `setDrawingLocked` or `setDrawingHidden`, nor for the retired element types `priceLine` and `priceZone` or the authored-number props `price`, `position.entry`, `position.stop` and `position.target`. The chart API `chartPointToAnchor` / `chartAnchorToPoint` stays — it is chart API and is heavily tested.
- Local-first holds: no network call, login or server is needed to edit, save, preview or export.
- Remotion packages stay pinned to `4.0.538`. React stays on `18.3.1`.
- Determinism is structural: the same project snapshot and frame index produce the same frame. A drawing's rendered frame depends only on its own props and its own frame range.
- Components declare, the shell executes. No component name is hardcoded in `apps/studio` for tools, inspector panels or menu items.
- The render gate `node scripts/verify-r1.mjs` is required after every slice that touches rendering (S1, S2, S3). The suite alone is not proof that a change reached the video path.
- **The `Main` render-gate fixture must stay byte-identical.** It is a schema-v1 document with no drawings, so the v1 → v2 → v3 migration is a no-op for it; its stills and its MP4 must not change by one byte. Its provenance sidecar's `schemaVersion` field will read `3` — expected, and not a frame change.
- **The `AuthoredPath` render-gate fixture will change.** It carries a price line and a trendline, and those drawings become free elements — the price line as a horizontal line. The change is the honest record of the cutover, not a regression. The executor reports the new still sizes rather than asserting they match.
- Every task ends with a commit. Every task names the files it touches and the interfaces it consumes and produces.
- **Honesty rule for this plan and for every executor of it:** planned work is phrased as "the slice asserts" and "the executor must report". No slice may claim a test passed or a build succeeded on the strength of this document. Anything not exercised is reported as unverified.
- Do not touch `apps/studio/src/App.tsx`, `apps/studio/src/components/TopBar.tsx`, `apps/studio/src/components/HelpModal.tsx`, `docs/superpowers/plans/2026-10-31-topbar.md` or `docs/superpowers/specs/2026-10-31-topbar-design.md`. They are the owner's own uncommitted work.

---

## Open questions this plan proceeds on

| # | Default implemented | If overridden |
|---|---|---|
| Q1 | **The drawing's shape.** Every drawing is a box in composition space (`x`, `y` = centre, `width`, `height`), plus `opacity`, `style` and an optional `caption`. Geometry is normalised inside the box: `DrawingPoint = { x, y }` as 0..1 fractions, origin top-left, y down. Per kind: `horizontalLine` — no points, a rule at the box's vertical centre across the box's width; `verticalLine` — `points.at`, a vertical rule at `at.x` down the box's full height; `trendline` — `points.start` / `points.end`, **any angle**, `trendline.ray` kept; `highLowLine` — `points.top` / `points.bottom`, a vertical segment between the two points, **no bar snapping**; `rectangle` — no points, the element's own box outlined and optionally filled; `textLabel` — `points.at`, `label.text` kept; `arrow` — `points.from` / `points.to`, a segment with a head; `position` — `points.entry` / `points.stop` / `points.target`, three draggable levels in the box, with `position.direction` and `position.showRiskReward`. The dropped props are `chartClipId`, `paneId`, `anchors`, the chart-relative `in` / `out`, `zone.extendRight` (the render context carries no composition size), and every authored number (`price`, `position.entry` / `position.stop` / `position.target`). | If a kind keeps a market number, it is a second source of truth that the product cannot place. If `extendRight` is kept, the rectangle needs a composition size it does not have (`packages/core/src/contract.ts:22-34`). |
| Q2 | **The migration's placement and type mapping.** The migration maps the old element types to the new ones: `priceLine` → `horizontalLine`, `priceZone` → `rectangle`, the other six unchanged. A price line's price is preserved exactly **as the caption**; `label.text`, `trendline.ray`, `position.direction`, `position.showRiskReward`, `style` and `opacity` are preserved. The element's placement uses the chart's plot area and the chart's **full-series** price range (`materialiseSeries` + `computePriceRange` over all bars, not the revealed subset). That is an approximation at the last frame, and the migration's comment says so in those words. | If the old renderer is kept alive behind a flag for migrated documents, the pixels are exact and the product carries two drawing models forever. If the old type names are kept, the registry keeps two kinds whose names claim a market the element does not have. |
| Q3 | **The default track for a new drawing.** The track immediately above the chart it was dropped on when there is one — one step towards the top layer, because `tracks[0]` is the top layer (`packages/video/src/composition.tsx:172`); a chart already on the topmost track shares that track and the drawing is appended to it, so it renders above the chart. Otherwise the track of the selected clip. Otherwise the first track. | If a new drawing always lands on the first track, it jumps away from the chart it was dropped on. |
| Q4 | **The drawing inspector.** Box (`x`, `y`, `width`, `height`), the geometry (the points, the levels, the direction), the **caption**, the style, and the clip's own frame range. There are no number fields, because there are no numbers. The chart-relative `in` / `out` disappear, including from the shared drawing parameters (`packages/components/src/trading/drawings/definitions.ts:227`). The generic inspector's CLIP section already shows the clip's own start and length. | If the inspector also shows the market context the drawing used to be anchored to, that context no longer exists. |
| Q5 | **The canvas context menu.** Group, Ungroup, Duplicate, Copy, Paste, Delete, Rename, Bring to front, Send to back, Lock, Hide. Re-surfacing existing actions: `groupSelection`, `ungroupSelection`, `duplicateSelection`, `copySelection`, `paste`, `removeClips`. **New store work:** `requestRename`, `bringToFront`, `sendToBack`, and the generalised `setClipLocked` / `setClipHidden`. `moveClipToTrack` cannot express "send to back" — it always appends to the target track (`packages/editor/src/store.ts:594`) — so `sendToBack` needs its own code. | A timeline context menu is the alternative; the canvas is where the creator's pointer already is. |
| Q6 | **Lock and hide generalise to every clip.** `setDrawingLocked` / `setDrawingHidden` become `setClipLocked` / `setClipHidden`. A hidden clip is skipped by the composition; a locked clip is not canvas-pickable but stays timeline-selectable, with a lock badge on the clip chip. | Keeping them drawing-only means a context menu that offers "Hide" for some elements and not others. |
| Q7 | **The position tool's levels are positions, not prices.** The three levels — `points.entry`, `points.stop`, `points.target` — are fractions of the box's height that the creator drags. The ratio the tool shows is computed from the drawn geometry: `|target.y − entry.y| / |entry.y − stop.y|`. It is a true fact about the shape on screen. It is never a P&L figure and never a broker fill (OB-006 stands). TradingView's "% distance" is **not** shown — it needs a price scale this product does not have. `position.direction` tells the adapter how to read the roles; `position.showRiskReward` toggles the ratio label. **This supersedes the earlier default, which gave the tool three authored numbers.** | If the ratio were computed from prices, the picture and the label could disagree; a geometric ratio cannot. |
| Q8 | **No drawing states a market value.** The horizontal line carries no price, the rectangle carries no edge prices, the position tool carries no prices. The creator's own figure is the **caption** — a short string the creator types, drawn beside the shape, the way TradingView labels its lines. **This supersedes the earlier default, which gave the price line an authored price and stated an honesty limit about it.** | If a drawing must sit on a market price, the market-anchored model returns and nothing else in this plan survives. |
| Q9 | **The zone becomes a rectangle with no edge prices.** The zone's edges were market-derived clicks; a market-derived number has no meaning in an independent element. The rectangle is the element's own box, outlined and optionally filled, and it loses `extendRight` too. **This supersedes the earlier default, which kept the zone as a band of two points.** | If the rectangle keeps its edge numbers as authored values, they are figures the product cannot place and cannot verify. |
| Q10 | **The position tool takes one click and its levels are dragged afterwards**; two-click kinds place their two points; the other kinds take one click. The trend line takes any angle; the high and low line's two handles stay on a vertical segment. The handles are the swing path's machinery, reused. **This supersedes the earlier default, which typed the position tool's three numbers in the inspector.** | If the position tool took three clicks, the creator could not adjust a level without redrawing the whole shape. |
| Q11 | **`ensureChartMarket` is re-homed into `addClip` for `candlestickChart`,** so a chart added from the library still receives a series, a pane and a clock. It is currently reached only through `resolveDrawingTarget` (`packages/editor/src/store.ts:895`), which the cutover removes. | If it is deleted outright, library-added charts fall back to their inline `bars` — a behaviour change the owner did not ask for. |
| Q12 | **Two kinds are renamed, and the migration carries the rename.** `priceLine` → `horizontalLine`, `priceZone` → `rectangle`. The standing rule that a component type is never renamed **does not apply to these two** — ADR-009 decision 9 states the exception and the reason: a line that keeps the name `priceLine` while holding no price is a false label. The other six kinds keep their names. The registry, the library catalogue, the definitions and the migration all change together in S1. | If the names stay, the product keeps two kinds whose names promise a market the element does not have. |

---

## Slice priority and the pilot

The slices are ordered by dependency, not by appeal. The order is fixed: **S0 → S1 → S2 → S3.** The pilot is **S2**.

**S2 is the pilot slice.** It is the first slice in which a creator can do the thing this work is for: arm a drawing tool with no chart in the project, click the canvas, and get an element that is theirs, on the timeline, in their layer order. S0 and S1 are the price of that: a document model and a renderer. A creator looking at S0 sees nothing new, and a creator looking at S1 sees their existing drawings move — a change they will notice but cannot yet exercise, because the tools still need a chart to place one.

Why S2 and not S1:

- **S1 changes rendering but not capability.** After S1 the eight kinds draw in their own boxes, but the tool rail still shows the drawing tools only when a chart is selected (`apps/studio/src/components/ToolRail.tsx:22`) and the drop path still refuses without a chart (`apps/studio/src/components/PreviewPanel.tsx:541`). The creator cannot yet place an independent drawing, so the slice cannot be judged as the feature.
- **S2 is where the model can be falsified.** If a drawing placed with no chart in the project does not behave like an ordinary element — wrong layer, wrong range, wrong inspector, points that do not follow the drag — every one of those failures is a failure of S0's model or S1's renderer, and S2 is where it becomes visible. Shipping S0–S1 first and calling the model proven would be the "compiling scaffold" failure the slice rules forbid.
- **S0 and S1 must land together anyway.** See the atomicity note below: the migration, the definitions' `propsVersion` bump, the renderers, the store producer and the call sites are one release unit. S0 is therefore *additive* groundwork that can be landed and reviewed on its own, and S1 is the cutover.

Why not S3 as the pilot: S3 is a surface over actions that already exist. It is valuable and it is the right last slice, but piloting it would prove that a menu opens.

### Atomicity: why S0 is not "schema v3 + migration"

The requested breakdown put the schema bump and the v2 → v3 migration in S0, with the renderers in S1. **The code forces those two to be one release unit**, and this plan says so rather than pretending otherwise:

1. `migrateClip` rejects a clip whose `propsVersion` is newer than its component's, with the message `Clip "${id}" uses props version ${clipVersion} but "${element}" supports ${definitionVersion}` (`packages/components/src/project-migrate.ts:28-90`). The drawing definitions' `propsVersion` must move to 2 for the new props, and the migrated clips must carry 2 — so the definition bump and the migration ship together.
2. The migration rewrites the props the renderer reads. A document migrated to v3 by a build whose renderer still expects `anchors` renders drawings as nothing at all.
3. The store's `addDrawing` produces the props the renderer reads. A migrated document and a freshly created drawing must agree, or the editor and the export disagree.

So the plan splits the requested S0 into:

- **S0 — the model, additive and invisible.** New core types for the independent drawing geometry, `validateDrawingProps`, and the provenance groundwork. **No schema bump, no behaviour change, nothing rendered differently.** It can be reviewed and landed on its own.
- **S1 — the atomic cutover.** `CURRENT_PROJECT_SCHEMA_VERSION = 3`, the v2 → v3 migration, the eight adapters rewritten to draw in their own box, the definitions losing the chart lookup and the `evaluate` step, `anchors.ts` deleted, `MarketAnchor` / `DrawingSpec` retired, the definitions' `propsVersion` bumped to 2, the store producer rewritten, the minimal `PreviewPanel` / `ToolRail` call-site update so the app compiles and the tools keep working, the `AuthoredPath` fixture rewritten to v3.

Every slice leaves the app working and every slice is independently reviewable.

---

## Dependency order

```text
S0 the model (additive, invisible)
     │
     ▼
S1 the atomic cutover  (schema v3 + migration + renderers + producer + call sites)
     │
     ▼
S2 PILOT — the editor flow (tools without a chart, placement, drop, track rule, own range, inspector)
     │
     ▼
S3 the context menu (+ layer order + generalised lock/hide)
```

| Slice | Unblocks | Because |
|---|---|---|
| S0 | S1 | The independent geometry types and the validator are what the v3 props and the new renderer are written against. |
| S1 | S2 | The editor flow creates independent drawings; it can only do that once the props, the renderer and the migration agree. |
| S2 | S3 | The context menu acts on ordinary clips on a canvas — the state S2 produces. |
| S3 | — | Final surface. |

Slices that do not strictly depend on the previous one: S0's provenance groundwork may be written in parallel with its geometry types. Nothing else may start early: S1's migration and S1's renderer are one unit, and S2 edits files S1 rewrites.

---

## File Structure

| Path | Responsibility |
|---|---|
| `packages/core/src/elements.ts` | `DrawingPoint`, `DrawingStyle`, the per-kind props types, and the retirement of `MarketAnchor` / `DrawingSpec` |
| `packages/core/src/validation.ts` | `validateDrawingProps(kind, props)` — the only place a Zod symbol may be named for the new props |
| `packages/core/src/provenance.ts` | The `annotations` section of `ProvenanceRecord`, recording each drawing's kind and its caption as the creator's own |
| `packages/components/src/trading/drawings/definitions.ts` | The eight drawing definitions: independent props, `propsVersion: 2`, no `evaluate`, the params the inspector and the selection overlay need |
| `packages/components/src/trading/drawings/adapters.tsx` | The eight adapters, each drawing inside its own element box |
| `packages/components/src/trading/drawings/anchors.ts` | **Deleted** in S1 |
| `packages/components/src/trading/inspectors/drawing.tsx` | The drawing inspector panel: the caption, the style, the per-kind extras |
| `packages/components/src/project-migrate.ts` | `CURRENT_PROJECT_SCHEMA_VERSION = 3` and the v2 → v3 migration |
| `packages/components/src/trading/chart.tsx` | Unchanged — `chartGeometry`, `priceToY`, `chartPriceRange`, `chartPointToAnchor`, `chartAnchorToPoint` all stay |
| `packages/editor/src/drawings.ts` | The drawing tools' metadata: the kinds, the click counts and the default box sizes; `buildDrawingAnchors` and `drawingBarId` go |
| `packages/editor/src/store.ts` | `addDrawing` (independent), `setClipLocked` / `setClipHidden`, `bringToFront` / `sendToBack`, `requestRename` |
| `packages/ui/src/components/ui/context-menu.tsx` | **Created** in S3 — a Radix `ContextMenu` wrapper, the `dropdown-menu.tsx` pattern |
| `packages/ui/src/index.ts` | Exports the new context-menu wrapper |
| `packages/ui/src/components/library/catalog.tsx` | A separate **Drawings** group for the eight drawing kinds |
| `apps/studio/src/components/PreviewPanel.tsx` | Placement without a chart; the drop path; the drawing's point handles and their drag; the canvas context menu |
| `apps/studio/src/components/ToolRail.tsx` | The drawing tools offered without a chart selected |
| `apps/studio/src/components/canvas-hit-test.ts` | Filters hidden and locked clips out of the canvas pick list |
| `apps/studio/src/components/Inspector.tsx` | Lock / hide for every clip |
| `packages/editor/src/timeline/ClipChip.tsx` | The lock badge |
| `packages/video/src/composition.tsx` | Skips a hidden clip |
| `packages/video/remotion/authored-path-fixture.ts` | Rewritten to schema v3 with independent drawings |

---

## Risk table

| # | Risk | Mitigating slice | Proving test |
|---|---|---|---|
| R1 | A migrated document renders differently: the old drawing sat at a price on a live scale, the new one sits at a migrated box position. | S1 | `packages/components/src/project-migrate.test.ts` — "keeps a migrated price line's price as its caption" and "places a migrated drawing using the chart's plot area and the full-series price range" |
| R2 | The `Main` fixture's bytes change: any change to the composition or the migration path can move a pixel in an unrelated fixture. | S1, S2, S3 | `node scripts/verify-r1.mjs` — the six `Main` still sizes and the MP4 must be byte-identical to the pre-change render |
| R3 | The cutover lands in two pieces and migrated drawings render as nothing. | S1 | The migration, the `propsVersion` bump, the renderers, the producer and the call sites are one slice. `packages/components/src/project-migrate.test.ts` — "rejects a clip whose props version is newer than its component's" (existing behaviour, kept) |
| R4 | A hidden clip starts rendering: the `hidden` check lives inside the drawing renderer today (`packages/components/src/trading/drawings/definitions.ts:191`). | S1, S3 | `packages/video/src/evaluate.test.ts` or a new composition test — "does not render a hidden clip"; `apps/studio/src/components/canvas-hit-test.ts` behaviour — "does not pick a hidden clip" |
| R5 | A locked clip cannot be unlocked. | S3 | `packages/editor/src/store.test.ts` — "keeps a locked clip selectable on the timeline but not on the canvas" |
| R6 | A caption reads as a market claim: a caption that says 4200 next to a rule nowhere near 4200 invites distrust. | S1, S2 | `packages/components/src/trading/drawings/drawings.test.tsx` — "draws the caption beside the shape and claims no market value"; the interface states the limit in the inspector |
| R7 | The position tool's levels look like a market setup. | S1 | `packages/components/src/trading/drawings/drawings.test.tsx` — "draws no profit-and-loss figure and implies no broker fill" |
| R8 | Copy/paste shares state: a pasted drawing shares its `points` object with the original. | S1 | `packages/editor/src/store.test.ts` — "duplicates a drawing without sharing its points" |
| R9 | A drawing lands on the wrong track. | S2 | `packages/editor/src/store.test.ts` — "puts a new drawing on the track above the chart it was dropped on" and "falls back to the selected clip's track" |
| R10 | Scope creep into a second drawing model: "just keep the old renderer for migrated documents" is an easy sentence and a permanent cost. | S1 | `packages/components/src/project-migrate.test.ts` — "leaves no chart-anchor props on a migrated drawing" |
| R11 | The migration's approximation is not stated in the code, only in the design. | S1 | The migration's own comment carries the sentence; the executor reports reading it |
| R12 | The `AuthoredPath` fixture changes and the change is read as a regression. | S1 | The design states the change is expected; the executor reports the new still sizes rather than asserting equality |
| R13 | A context menu item silently does nothing for a locked or hidden clip. | S3 | `packages/editor/src/store.test.ts` — "does not let a hidden clip be deleted from the menu path" is not required; instead "keeps a hidden clip in the project until it is unhidden" |
| R14 | The library's Drawings group is added but the chart group still lists the drawings, so the tools appear twice. | S2 | `packages/components/src/registry.test.ts` — the catalogue count assertion stays correct; the executor confirms the library shows the eight drawing kinds once |
| R15 | A renamed kind breaks a saved document: `priceLine` and `priceZone` no longer exist in the registry. | S1 | `packages/components/src/project-migrate.test.ts` — "maps a migrated price line to a horizontal line" and "maps a migrated price zone to a rectangle"; the registry test asserts the new catalogue counts |
| R16 | A handle system is built twice: the drawing handles and the swing handles drift apart. | S2 | The plan names `swingHandles()` and the swing drag handler as the machinery to reuse; the executor reports that no second handle implementation was added |

---

## Deferred work

Not in this work, and not to be started by an executor of this plan:

- A drawing that positions itself against a market. That is the market-anchored model ADR-009 reverses.
- Re-introducing a chart-relative lifecycle for any drawing.
- The price zone's authored edge prices, and `zone.extendRight`.
- TradingView's "% distance" on the position tool — it needs a price scale this product does not have. The geometric distance ratio is shown instead.
- Snapping of any kind — a drawing never reads a chart, not even for one moment at placement time. The high and low line's bar snapping is gone with the rest of it.
- Importing, and every other deferred item in `docs/roadmap/ROADMAP.md` that this work does not name.
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

`node scripts/verify-r1.mjs` is the render gate and it is **required** for every slice that touches rendering (S1, S2, S3). It bundles `packages/video/remotion/index.ts`, renders PNG stills at frames 0, 20, 45, 100, 140 and 179 and renders `out/chart-studio-r1.mp4` for the `Main` fixture, and frames 45, 100 and 179 for the `AuthoredPath` fixture, and writes both provenance sidecars. It is the only command that proves a change reached the video path.

Per-slice render-gate expectations:

| Slice | `Main` fixture | `AuthoredPath` fixture |
|---|---|---|
| S0 | Unchanged — S0 changes no rendering. Report the still sizes. | Unchanged. Report the still sizes. |
| S1 | **Byte-identical** to the pre-S1 render: same six still sizes, same MP4. Only the sidecar's `schemaVersion` reads `3`. | **Expected to change** — the price line becomes a horizontal line and the trendline becomes a free element. Report the new still sizes and the MP4 outcome; do not assert they match. |
| S2 | **Byte-identical.** S2 changes the editor, not the render path. | Byte-identical — S2 changes placement, not the fixture. Report the sizes. |
| S3 | **Byte-identical.** S3 changes the editor surface, not the render path. | Byte-identical. Report the sizes. |

For every user-interface change the executor exercises the actual surface in a browser and reports what was observed — with no chart in the project, and with a chart in the project. Anything not exercised is reported as unverified. There is no substitute for the render gate.

The suite was **400 tests over 29 files** before this work. `docs/quality/TEST_STRATEGY.md` §3 understates this as 27 files / 378 cases and is corrected in S0.

---

### Task 1: S0 — The model: independent drawing geometry, validation, provenance groundwork

**Requirements:** OB-011, OB-012, OB-013, OB-014, OB-015, CV-005, MD-010, CPT-005 (rewritten), OB-005 (rewritten)

**Files:**

- Modify: `packages/core/src/elements.ts` (add `DrawingPoint`, `DrawingStyle`, `IndependentDrawingProps`; keep `DrawingKind` at `:182`; **do not yet** remove `MarketAnchor` / `DrawingSpec` — the S1 migration reads them)
- Modify: `packages/core/src/validation.ts` (add `validateDrawingProps`)
- Modify: `packages/core/src/provenance.ts` (add the `annotations` section to `ProvenanceRecord` and populate it)
- Modify: `packages/core/src/index.ts` if a new module is added (it re-exports with `export *`, so usually nothing to do)
- Modify: `packages/core/src/validation.test.ts`, `packages/core/src/provenance.test.ts`
- Modify: `docs/quality/TEST_STRATEGY.md` §3 (correct the stale count)

**Interfaces:**

- Consumes: `DrawingKind` (`packages/core/src/elements.ts:182`), `ComponentProps`, the existing validator result shape `{ ok: true, value }` / `{ ok: false, issues: { path, message }[] }` in `packages/core/src/validation.ts`.
- Produces:
  - `packages/core/src/elements.ts`:
    ```ts
    /** A point inside a drawing's own box, as a 0..1 fraction. Origin top-left, y down. */
    export interface DrawingPoint { x: number; y: number; }

    /** The colours and weights a drawing carries. */
    export interface DrawingStyle {
      color?: string;
      lineWidth?: number;
      /** Fill opacity of a rectangle or a band. */
      fillOpacity?: number;
      fontSize?: number;
    }

    /** The props every independent drawing carries. */
    export interface IndependentDrawingProps {
      x?: number;
      y?: number;
      width?: number;
      height?: number;
      opacity?: number;
      style?: DrawingStyle;
      /** The creator's own figure, drawn beside the shape. */
      caption?: string;
      /** Per-kind points, as 0..1 fractions of the box. */
      points?: Record<string, DrawingPoint>;
      /** The position tool's direction and its ratio toggle. */
      position?: {
        direction: 'long' | 'short';
        showRiskReward?: boolean;
      };
      label?: { text?: string };
      trendline?: { ray?: 'none' | 'left' | 'right' | 'both' };
    }
    ```
    There are **no market numbers** in these props. The position tool's three levels live in
    `points` — `points.entry`, `points.stop`, `points.target` — because they are positions inside
    the box, not prices.
  - `packages/core/src/validation.ts` — `validateDrawingProps(kind: DrawingKind, props: unknown): { ok: true; value: IndependentDrawingProps } | { ok: false; issues: { path: string; message: string }[] }`. It validates: `x`, `y`, `width`, `height` are finite numbers when present; `opacity` is a number in 0..1; `caption` is a string when present; every entry of `points` is an object with finite `x` and `y` in 0..1; `position.direction` is `'long'` or `'short'`; `position.showRiskReward` is a boolean when present. It rejects a point outside 0..1 with an issue whose `path` names the point key, e.g. `points.start.x`. It rejects the retired market-number props: a `price` prop on any kind is an issue whose `path` names `price`, and a `position.entry` / `position.stop` / `position.target` is an issue whose `path` names that key.
  - `packages/core/src/provenance.ts` — `ProvenanceRecord` gains `annotations: ProvenanceAnnotation[]`, where `ProvenanceAnnotation` is `{ clipId: string; kind: string; caption?: string }`. `buildProvenance(project)` populates it by walking the project's tracks and, for each clip whose `element` is one of the eight drawing kinds, recording the clip's kind and its caption. The caption is recorded as **the creator's own figure**, never as market-derived.

**This slice is additive and invisible.** It changes no rendering, no schema version and no editor behaviour.

- [ ] **Step 1: Add the independent drawing types to `packages/core/src/elements.ts`**

Add `DrawingPoint`, `DrawingStyle` and `IndependentDrawingProps` exactly as written in the Interfaces block above. Leave `MarketAnchor` (`:171`) and `DrawingSpec` (`:193`) in place — the S1 migration reads them, and removing them here would break the build.

- [ ] **Step 2: Write `validateDrawingProps` in `packages/core/src/validation.ts`**

Follow the pattern the module already uses: it is the only module allowed to name a Zod symbol (`import * as z from 'zod/v4'`), and it returns plain results. Build the schema per kind:

- a shared base: `x`, `y`, `width`, `height` finite numbers (optional); `opacity` a number between 0 and 1; `caption` a string (optional); `style` an object of optional `color` (string), `lineWidth` (number), `fillOpacity` (number), `fontSize` (number);
- `points`: an optional record of `{ x: number, y: number }` where both are between 0 and 1;
- `position`: an optional object with `direction` (`'long' | 'short'`) and `showRiskReward` (optional boolean);
- `label.text` (optional string) and `trendline.ray` (optional `'none' | 'left' | 'right' | 'both'`).

The validator takes the kind and requires the kind's own content to be present when it is present: a `horizontalLine` and a `rectangle` carry no points; the six point-carrying kinds carry `points`; a `position` carries `position` and its three levels in `points`.

The validator also **rejects the retired market-number props**, so a stray `price` or `position.entry` cannot slip into a v3 document: a `price` prop is an issue whose `path` is `price`, and a `position.entry`, `position.stop` or `position.target` is an issue whose `path` names that key.

- [ ] **Step 3: Write the validator's tests in `packages/core/src/validation.test.ts`**

Assert, by name:

- "accepts an independent drawing's props"
- "rejects a point outside the drawing's own box" — `points.start.x = 1.5` is rejected and the issue's `path` names `points.start.x`
- "rejects a horizontal line that carries points"
- "rejects a retired market number" — a `price` prop is rejected and the issue's `path` names `price`
- "accepts a drawing with no kind-specific content"

- [ ] **Step 4: Add the provenance annotations section**

In `packages/core/src/provenance.ts`, add `ProvenanceAnnotation` and the `annotations` field to `ProvenanceRecord` (`:71`), and populate it in `buildProvenance` (`:87`) as described in the Interfaces block. The package must stay free of React, Remotion and storage imports.

- [ ] **Step 5: Write the provenance tests in `packages/core/src/provenance.test.ts`**

Assert, by name:

- "records a drawing's caption as the creator's own figure" — a project with a `horizontalLine` clip carrying `caption: '4200'` yields one annotation whose `caption` is `'4200'`
- "records a drawing's kind"
- "records a drawing with no caption" — the annotation carries the kind and no caption

- [ ] **Step 6: Run the suite and report**

Run `pnpm test` and `pnpm typecheck`. The executor reports the observed test count and file count. The suite was **400 tests over 29 files** before this work; the count must go up and no file may disappear.

- [ ] **Step 7: Correct the stale test-strategy count**

In `docs/quality/TEST_STRATEGY.md` §3, replace "27 test files / 378 cases" with the observed figures, and list the new validation and provenance surfaces.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "Add the independent drawing geometry, its validator and the provenance annotations

The drawing model gets a box of its own, points normalised inside that box
and a caption the creator types, plus a validator that only core may write
and a provenance section that records a drawing's kind and caption as the
creator's own.

Nothing renders differently yet: this slice is the substrate the cutover
stands on.

"
```

---

### Task 2: S1 — The atomic cutover: schema v3, the two renames, the migration, the renderers, the producer

**Requirements:** OB-011, OB-012, OB-013, CV-005, MD-010, CPT-005 (rewritten), OB-003, OB-005 (rewritten), OB-006

**Files:**

- Modify: `packages/core/src/elements.ts` (retire `MarketAnchor` `:171` and `DrawingSpec` `:193`)
- Modify: `packages/core/src/elements.test.ts` if it names the retired types
- Modify: `packages/components/src/project-migrate.ts` (`CURRENT_PROJECT_SCHEMA_VERSION = 3` at `:22`, the v2 → v3 migration)
- Modify: `packages/components/src/project-migrate.test.ts` (the version assertion at `:57` moves from 2 to 3)
- Modify: `packages/components/src/trading/drawings/definitions.ts` (rewrite)
- Modify: `packages/components/src/trading/drawings/adapters.tsx` (rewrite)
- Delete: `packages/components/src/trading/drawings/anchors.ts`
- Modify: `packages/components/src/trading/inspectors/drawing.tsx` (rewrite)
- Modify: `packages/components/src/index.ts` (drop the `./trading/drawings/anchors` export at `:9`)
- Modify: `packages/components/src/registry.ts` (the two renamed kinds)
- Modify: `packages/editor/src/store.ts` (`addDrawing` at `:918`; `copyClipProps` at `:251`)
- Modify: `packages/editor/src/drawings.ts` (`DRAWING_TOOLS` at `:20`; `buildDrawingAnchors` `:65` and `drawingBarId` `:51` go)
- Modify: `packages/editor/src/drawings.test.ts`
- Modify: `packages/video/remotion/authored-path-fixture.ts`
- Modify: `packages/video/src/authored-path-fixture.test.ts`
- Modify: `apps/studio/src/components/PreviewPanel.tsx` (the minimal call-site update)
- Modify: `apps/studio/src/components/ToolRail.tsx` (the minimal call-site update)
- Modify: `packages/components/src/trading/drawings/drawings.test.tsx` (rewrite)
- Modify: `packages/editor/src/store.test.ts` (the drawing-tool cases)

**Interfaces:**

- Consumes: `DrawingPoint`, `DrawingStyle`, `IndependentDrawingProps` and `validateDrawingProps` from `packages/core`; `chartGeometry`, `priceToY`, `chartPriceRange` from `packages/components/src/trading/chart.tsx`; `materialiseSeries` (`packages/core/src/series.ts:133`) and `computePriceRange` (`packages/core/src/market.ts:251`) for the migration's full-series range.
- Produces:
  - `packages/components/src/project-migrate.ts` — `CURRENT_PROJECT_SCHEMA_VERSION = 3`; a `migrateV2ToV3(doc, tracks)` step that runs after `migrateV1ToV2` when `version < 3`, and that maps the old element types to the new ones.
  - `packages/components/src/trading/drawings/definitions.ts` — the eight definitions, each with `propsVersion: 2`, no `evaluate` field, and `params` that include numeric `width` and `height` (so the selection overlay's resize handles work — `apps/studio/src/components/selection-overlay.tsx` enables resize only when the definition exposes numeric `width` and `height` params), plus `opacity` and the kind's own params.
  - `packages/components/src/trading/drawings/adapters.tsx` — `DrawingAdapterProps` becomes `{ width, height, style?, caption?, points?, position?, trendline?, label? }`. Every adapter draws inside its own box: a point at fraction `(px, py)` is at `(px * width, py * height)`.
  - `packages/editor/src/store.ts` — `addDrawing(kind: DrawingKind, draft: DrawingDraft): string` where `DrawingDraft` is `{ x, y, width, height, points?, caption?, position?, label?, trendline?, style?, opacity?, from?, durationInFrames?, trackId? }`.
  - `packages/editor/src/drawings.ts` — `DRAWING_TOOLS` with the new click counts and default box sizes; `buildDrawingAnchors` and `drawingBarId` are deleted.

**The two renames.** The eight kinds become TradingView's set:

| v2 kind | v3 kind |
|---|---|
| `priceLine` | `horizontalLine` |
| `priceZone` | `rectangle` |
| `highLowLine`, `verticalLine`, `trendline`, `textLabel`, `arrow`, `position` | unchanged |

The registry (`packages/components/src/registry.ts`), the definitions, the library catalogue and the
migration all change together in this slice. There is no alias for the old names.

**The migration's algorithm, exactly.** The migration first **maps the old element types to the new
ones**: `priceLine` → `horizontalLine`, `priceZone` → `rectangle`; the other six keep their names.
Then, for each drawing clip in a v2 document:

1. Look up `props.chartClipId` in the project's tracks. If it is missing, take the fallback path (step 8).
2. Look up `props.paneId` among the chart's panes. If it is missing, take the fallback path.
3. Materialise the pane's series and aggregate it by the pane's factor; take `computePriceRange` over **all** of it — the full-series range, not the revealed subset.
4. `chartGeometry(chartProps, fullBarCount, pane.rect)` for the plot area.
5. Map the old anchors: a price anchor becomes a `y` via `priceToY` over the full-series range; a point anchor (bar + price) becomes the bar's slot-centre `x` and a price `y`; a candle anchor (bar + side) becomes that extreme's price mapped to a `y` at the bar's slot-centre `x`; a time anchor (bar) becomes the slot-centre `x`.
6. Build the new props per kind:
   - `horizontalLine` (from `priceLine`): no points. The box is a band of the plot area's width, 24 px tall, centred on the price's `y`. The old anchor's price becomes the **`caption`**, exactly — the creator's own figure is not lost.
   - `highLowLine`: `points.top` and `points.bottom` on a vertical segment. The bar snapping is gone — it does not read bars.
   - `verticalLine`: `points.at` from the bar's slot centre.
   - `trendline`: `points.start` and `points.end`.
   - `rectangle` (from `priceZone`): the element's own box. The zone's two edge prices are **not** carried over — they were market-derived clicks. A zone with `extendRight` gets a box widened to the chart's right edge.
   - `textLabel`: `points.at`; `label.text` is preserved.
   - `arrow`: `points.from` and `points.to`.
   - `position`: `points.entry`, `points.stop` and `points.target` are the old anchors' prices mapped to `y` fractions of the box; the box is the plot-area rect. `position.direction` and `position.showRiskReward` are preserved.
   - `caption`, `style` and `opacity` are preserved.
7. Convert the lifecycle: `from = chart.from + props.in`, `durationInFrames = (out > in ? out : chart.durationInFrames) − in`, where `out === 0` means open-ended.
8. The fallback path, when the chart, the pane or the series cannot be resolved: keep the drawing's stored `props.x`, `props.y`, `props.width`, `props.height` as the box, use the kind's default points, keep any caption that can be read, and set the default frame range. The migration never throws on a drawing and never leaves one half-converted.
9. Set the migrated clip's `propsVersion` to 2, set its `element` to the mapped kind, and remove `chartClipId`, `paneId`, `anchors`, `in` and `out` from its props.

**The migration's comment carries the approximation in these words:** the placement uses the chart's plot area and the chart's full-series price range, and is therefore an approximation at the last frame.

- [ ] **Step 1: Write the migration before the renderer**

Write `migrateV2ToV3` in `packages/components/src/project-migrate.ts` and bump `CURRENT_PROJECT_SCHEMA_VERSION` to 3. `migrateProject` (`:193`) runs `migrateV1ToV2` when `version < 2` and `migrateV2ToV3` when `version < 3`, in that order, so a v1 document passes through both. Keep every existing rejection, including the props-version comparison (`:37-44`).

- [ ] **Step 2: Write the migration's tests in `packages/components/src/project-migrate.test.ts`**

Change the assertion at `:57` from `toBe(2)` to `toBe(3)`. Assert, by name:

- "migrates a v2 document to v3"
- "maps a migrated price line to a horizontal line" — the clip's `element` becomes `horizontalLine`
- "maps a migrated price zone to a rectangle" — the clip's `element` becomes `rectangle`
- "keeps the other six drawing kinds' names"
- "keeps a migrated price line's price as its caption" — a v2 drawing with a price anchor of `4200` migrates to `props.caption === '4200'`
- "places a migrated drawing using the chart's plot area and the full-series price range"
- "converts a chart-relative lifecycle into the drawing's own frame range" — `in: 10`, `out: 40` on a chart at `from: 100` gives `from: 110`, `durationInFrames: 30`
- "treats an out of zero as an open-ended range"
- "falls back to the stored box when the chart is missing"
- "falls back to the stored box when the pane is missing"
- "leaves no chart-anchor props on a migrated drawing" — no `chartClipId`, no `paneId`, no `anchors`, no `in`, no `out`
- "leaves no retired market number on a migrated drawing" — no `price`, no `position.entry`, no `position.stop`, no `position.target`
- "is idempotent" — `migrateProject(migrateProject(doc))` deep-equals `migrateProject(doc)`
- "leaves a v3 document unchanged"

- [ ] **Step 3: Rewrite the adapters to draw in their own box**

In `packages/components/src/trading/drawings/adapters.tsx`, change `DrawingAdapterProps` to `{ width, height, style?, caption?, points?, position?, trendline?, label? }`. Remove the chart-relative `DrawingCanvas` offset: the composition already centres a clip's content on `props.x` / `props.y`, so a drawing's adapter renders an SVG of `width` × `height` with `viewBox="0 0 width height"` and draws in box-local pixels. A point at fraction `(px, py)` maps to `(px * width, py * height)`.

Per kind: `horizontalLine` draws a horizontal rule across the box at `height / 2`; `verticalLine` draws a vertical rule at `points.at.x * width` spanning the full height; `trendline` draws the segment between `points.start` and `points.end` — **any angle** — with the `ray` behaviour kept; `highLowLine` draws a vertical segment between `points.top` and `points.bottom`; `rectangle` draws the element's own box, outlined and optionally filled; `textLabel` draws `label.text` at `points.at`; `arrow` draws the arrow between `points.from` and `points.to`; `position` draws three horizontal levels at `points.entry.y`, `points.stop.y` and `points.target.y`, plus the ratio label `|target.y − entry.y| / |entry.y − stop.y|` when `position.showRiskReward` is set. Every adapter draws the `caption` beside the shape when one is present. **No adapter draws a market value, a P&L figure or a broker fill.**

- [ ] **Step 4: Rewrite the definitions**

In `packages/components/src/trading/drawings/definitions.ts`: remove the `evaluate` field and the chart lookup; set `propsVersion: 2`; rename the two kinds — `priceLine` → `horizontalLine`, `priceZone` → `rectangle` — and give each definition its own defaults — `x: 960`, `y: 540`, `opacity: 1`, `style: { color: '#e8eaf0', lineWidth: 1.5 }` — plus the kind's content and the kind's default box (`horizontalLine` 480×24, `verticalLine` 24×320, `trendline` 320×180, `highLowLine` 24×320, `rectangle` 320×180, `textLabel` 200×40, `arrow` 320×180, `position` 320×240). The `params` array per kind exposes numeric `width` and `height` (the selection overlay needs them for resize), `opacity`, and the kind's own params — a `caption` text field on every kind, `trendline.ray` on the trend line, `label.text` on the text label, `position.direction` and `position.showRiskReward` on the position tool. `COMMON_PARAMS` (`:227`) loses `in` and `out` and keeps `opacity`.

- [ ] **Step 5: Delete `anchors.ts` and retire the anchor types**

Delete `packages/components/src/trading/drawings/anchors.ts`; remove its export from `packages/components/src/index.ts` (`:9`); remove `MarketAnchor` (`:171`) and `DrawingSpec` (`:193`) from `packages/core/src/elements.ts`; remove `buildDrawingAnchors` (`:65`) and `drawingBarId` (`:51`) from `packages/editor/src/drawings.ts`; update `DRAWING_TOOLS` (`:20`) to the new kinds and click counts — `horizontalLine` 1, `verticalLine` 1, `textLabel` 1, `position` 1, `rectangle` 1, `highLowLine` 2, `trendline` 2, `arrow` 2.

- [ ] **Step 6: Rewrite the drawing inspector**

In `packages/components/src/trading/inspectors/drawing.tsx`, drop the anchors panel entirely. The panel now edits the **caption** — a text field on every kind — the style (`color`, `lineWidth`, `fillOpacity`, `fontSize`), and the per-kind extras (`trendline.ray`, `label.text`, `position.direction`, `position.showRiskReward`). There is no number field for a price or for the position tool's levels, because there are no numbers; the levels are dragged on the canvas. It writes through `onChange` with the same commit-first discipline the current panel uses.

- [ ] **Step 7: Rewrite the store producer**

In `packages/editor/src/store.ts`, `addDrawing` (`:918`) becomes `addDrawing(kind: DrawingKind, draft: DrawingDraft): string`. It creates a clip whose props are the definition's defaults merged with the draft, whose `from` and `durationInFrames` come from the draft (S2 supplies the defaults; S1 supplies the chart's range for the minimal call-site), and whose `propsVersion` is the definition's `propsVersion` (2). `copyClipProps` (`:251`) deep-copies `props.points` exactly as it deep-copies `props.anchors` today.

- [ ] **Step 8: Update the call sites so the app compiles and the tools keep working**

In `apps/studio/src/components/PreviewPanel.tsx`, the placement path must still run: the click now yields the drawing's own box instead of a chart anchor, and the `chartPointToAnchor` / `chartAnchorToPoint` calls are removed. In `apps/studio/src/components/ToolRail.tsx`, the chart gate (`:22`, `:92`) stays for now — S2 removes it — so the tools keep working exactly as they do today. The notice "A drawing needs a chart — drop it on one, or select a chart and use the tool rail." (`:541`) stays until S2. **S1 must leave the app working; it must not remove the tool rail gate or the notice.**

- [ ] **Step 9: Rewrite the drawings test suites**

In `packages/components/src/trading/drawings/drawings.test.tsx`, replace the fixtures that referenced `MarketAnchor` and the chart (`BARS`, `chartProps()`, `CHART_ID`, `FRAMES_PER_BAR`) with fixtures that build a drawing clip on its own. Assert, by name:

- "renders a horizontal line in its own box with no chart in the project"
- "renders a trend line between its two points at any angle"
- "renders a rectangle as the element's own box"
- "renders a high and low line as a vertical segment"
- "renders a text label at its point"
- "draws the caption beside the shape and claims no market value"
- "draws no profit-and-loss figure and implies no broker fill" — the rendered output of a position tool contains no currency-with-sign or P&L string
- "computes the position ratio from the drawn geometry" — the ratio label equals `|target.y − entry.y| / |entry.y − stop.y|`

In `packages/editor/src/drawings.test.ts`, drop the `buildDrawingAnchors` and `drawingBarId` assertions and assert the new tool metadata: the eight kinds and their click counts, and `isDrawingKind`.

- [ ] **Step 10: Update the store tests**

In `packages/editor/src/store.test.ts`, replace the cases "creates a price line as a clip anchored to a chart and a pane", "duplicates a drawing without sharing its anchors", "locks and hides a drawing" and "undoes a drawing deletion" with the equivalents for the independent model:

- "creates a horizontal line as an independent clip"
- "duplicates a drawing without sharing its points"
- "gives a new drawing its own frame range"
- "undoes a drawing deletion"

- [ ] **Step 11: Rewrite the `AuthoredPath` fixture**

In `packages/video/remotion/authored-path-fixture.ts`, rewrite the price line and the trendline as independent drawings at schema version 3: the price line becomes a `horizontalLine` with its own box and a caption carrying the old price; the trendline keeps its kind and carries its own box and its two points. The chart keeps its own props unchanged. Update `packages/video/src/authored-path-fixture.test.ts` to the new fixture shape.

- [ ] **Step 12: Run the render gate and report**

Run `node scripts/verify-r1.mjs`. The executor reports:

- the six `Main` still sizes and the MP4 outcome — **these must be byte-identical to the pre-S1 render**;
- the `Main` provenance sidecar's `schemaVersion` (expected: 3) and its `annotations` section;
- the three `AuthoredPath` still sizes and the MP4 outcome — **expected to change**, because the drawings become free elements; the change is not a regression.

- [ ] **Step 13: Run the suite and the build, and report**

Run `pnpm test`, `pnpm typecheck` and `pnpm build`. Report the observed counts and results. No test may be deleted to make a count work; the drawing suites are rewritten, not thinned.

- [ ] **Step 14: Commit**

```bash
git add -A
git commit -m "Make the drawings independent elements in TradingView's vocabulary

The eight drawing kinds lose their chart, their pane and their market
anchors. Each one is now a clip with its own box, its own frame range and
its own points, and it renders whether or not a chart exists in the
project. The price line becomes a horizontal line and the price zone
becomes a rectangle, because a line that keeps the name priceLine while
holding no price is a false label.

Existing documents are migrated: the old element types are mapped to the
new ones, a price line's price is kept as its caption, and the placement
uses the chart's plot area and full-series price range, which is an
approximation at the last frame and is stated in the migration's own
comment.

"
```

---

### Task 3: S2 — PILOT: the editor flow — tools without a chart, placement, the drop, the draggable handles, the track rule, the inspector

**Requirements:** OB-001, OB-003, OB-004, OB-011, OB-012, OB-013, OB-010, CH-009, TL-006

**Files:**

- Modify: `packages/editor/src/drawings.ts` (the default box sizes and the click-to-box helper)
- Modify: `packages/editor/src/store.ts` (`addDrawing`'s default track rule and default frame range; `ensureChartMarket` re-homed into `addClip` for `candlestickChart`)
- Modify: `packages/editor/src/store.test.ts`
- Modify: `apps/studio/src/components/ToolRail.tsx` (the chart gate goes)
- Modify: `apps/studio/src/components/PreviewPanel.tsx` (placement without a chart; the drop path; the notice goes; the drawing point handles and their drag handler)
- Modify: `packages/ui/src/components/library/catalog.tsx` (a separate **Drawings** group)
- Modify: `packages/components/src/trading/inspectors/drawing.tsx` (the panel shows the caption, the style and the per-kind extras)
- Modify: `packages/video/remotion/authored-path-fixture.ts` (only if the fixture needs the new props shape — it should not after S1)

**Interfaces:**

- Consumes: the independent drawing props from S1; the swing path's handle machinery — `swingHandles()` and the swing drag handler in `apps/studio/src/components/PreviewPanel.tsx`; `groupSelection` / `ungroupSelection` / `duplicateSelection` / `copySelection` / `paste` / `removeClips` (unchanged); `moveTrack` (`:480`) for the layer order.
- Produces:
  - `packages/editor/src/drawings.ts` — `DRAWING_TOOLS` gains the default box size per kind; a helper `defaultDrawingBox(kind, picks)` that builds the box from the creator's clicks: one-click kinds use the kind's default box centred on the click; two-click kinds use the bounding box of the two points, padded by 16 px on each side, with a minimum of 32 px in each axis.
  - `packages/editor/src/store.ts` — `addDrawing` gains the default track rule and the default frame range: the track immediately above the chart it was dropped on when there is one (one step towards the top layer, clamped at 0, appended to that track so it renders above the chart), otherwise the track of the selected clip, otherwise the first track; `from = currentFrame` and a duration of about 90 frames or the remaining project duration, whichever is shorter. `ensureChartMarket` moves into `addClip` for `candlestickChart`, so a chart added from the library still receives a series, a pane and a clock after `resolveDrawingTarget` is gone.
  - `apps/studio/src/components/PreviewPanel.tsx` — drawing point handles: the canvas draws a handle over each of the selected drawing's points, and dragging a handle rewrites that point in the clip's props. The handles are **the swing path's machinery, reused** — the same hit geometry, the same drag handler — not a second handle system.

- [ ] **Step 1: Add the default box helper to `packages/editor/src/drawings.ts`**

`defaultDrawingBox(kind: DrawingKind, picks: Array<{ x: number; y: number }>): { x, y, width, height }` where the picks are composition-space points. One-click kinds return the kind's default box centred on the single point. Two-click kinds return the bounding box of the two points with 16 px of padding on each side and a 32 px minimum in each axis, centred on the bounding box's middle. The points are then normalised inside that box: `point.x = (point.x − boxLeft) / box.width`, `point.y = (point.y − boxTop) / box.height`.

- [ ] **Step 2: Implement the default track rule and the default frame range in `addDrawing`**

In `packages/editor/src/store.ts`, `addDrawing` takes the optional `trackId` in the draft; when it is absent, the action resolves the track: the track immediately above the chart the drawing was dropped on when the caller supplies one, otherwise the track of the selected clip, otherwise `tracks[0]`. The clip is **appended** to that track's clip array, so it renders above the clips already there. The frame range is `from = currentFrame` and `durationInFrames = min(90, project.durationInFrames − from)`.

- [ ] **Step 3: Re-home `ensureChartMarket` into `addClip`**

`ensureChartMarket` (`:843`) is currently reached only through `resolveDrawingTarget` (`:895`), which S1 removed. Move its call into `addClip` (`:530`) for `element === 'candlestickChart'`, so a library-added chart still receives its series, pane and clock. Keep the action itself.

- [ ] **Step 4: Write the store tests for the new placement rules**

In `packages/editor/src/store.test.ts`, assert, by name:

- "puts a new drawing on the track above the chart it was dropped on"
- "puts a new drawing on the chart's own track when the chart is already on the top layer"
- "falls back to the selected clip's track"
- "falls back to the first track when nothing is selected"
- "gives a new drawing its own frame range starting at the current frame"

- [ ] **Step 5: Take the chart gate off the tool rail**

In `apps/studio/src/components/ToolRail.tsx`, remove the `isChart` gate (`:22`, `:92`) so the eight drawing tools are always offered.

- [ ] **Step 6: Place a drawing without a chart**

In `apps/studio/src/components/PreviewPanel.tsx`, the click path computes the drawing's own box and points from the click — using `defaultDrawingBox` — and calls `addDrawing` with them. No chart is looked up, no pane is resolved, no anchor is built. The drop path (`:527`) does the same at the drop point, and the notice "A drawing needs a chart — drop it on one, or select a chart and use the tool rail." (`:541`) is deleted.

- [ ] **Step 7: Draw the drawing's point handles and let the creator drag them**

In `apps/studio/src/components/PreviewPanel.tsx`, when a drawing is selected the canvas draws a handle over each of its points, and dragging a handle rewrites that point in the clip's props through `updateClip`. **Reuse the swing path's machinery** — `swingHandles()` (`:623`) and the swing drag handler (`onPointerMove`, `:392`, with the gesture state in `swingDrag`, `:116`) — for the handle's hit geometry and the drag interaction; do not build a second handle system. The trend line's two handles move freely, so the line takes any angle; the high and low line's two handles stay on a vertical segment; the position tool's three handles move their levels, and the ratio label follows the geometry.

- [ ] **Step 8: Give the library its own Drawings group**

In `packages/ui/src/components/library/catalog.tsx`, move the eight drawing kinds out of the "Chart" group (`:38-50`) into a new **Drawings** group, so a drawing appears once and the chart group's name stays true.

- [ ] **Step 9: Show the drawing's own fields in the inspector**

In `packages/components/src/trading/inspectors/drawing.tsx`, the panel shows the **caption**, the style and the per-kind extras. The box (`x`, `y`, `width`, `height`) is edited through the definition's numeric params, so the generic inspector's POSITION section carries `x` and `y` and the PROPERTIES section carries `width` and `height`; the clip's own frame range is the generic inspector's CLIP section. The chart-relative `in` / `out` are gone and are not replaced, and there is no number field for a price or for the position tool's levels — those are dragged on the canvas.

- [ ] **Step 10: Exercise the flow in a browser and report**

With **no chart anywhere in the project**: arm each of the eight tools, place a drawing, and confirm it renders, sits on the expected track, carries its own start and length, and shows its caption in the inspector. Drag each point of a trend line, a high and low line and a position tool and confirm the shape and the ratio follow. With **a chart in the project**: place a drawing over the chart and confirm the track rule (above the chart's track; the chart's own track when the chart is on the top layer). Report every observation.

- [ ] **Step 11: Run the render gate and report**

Run `node scripts/verify-r1.mjs`. Both fixtures' still sizes and both MP4 outcomes must be **byte-identical to the S1 render** — S2 changes the editor, not the render path. Report the sizes.

- [ ] **Step 12: Run the suite and report**

Run `pnpm test`, `pnpm typecheck` and `pnpm build`. Report the observed counts and results.

- [ ] **Step 13: Commit**

```bash
git add -A
git commit -m "Let a creator place a drawing anywhere

The drawing tools are offered without a chart selected, a click or a drop
places the drawing in the composition, and the drawing gets its own frame
range and its own track: the track above the chart it was dropped on, the
selected clip's track, or the first track.

The points are draggable handles now, reusing the swing path's machinery,
so the trend line takes any angle and the position tool's levels are where
the creator puts them. The chart-relative in and out are gone, and the
creator's own figure is a caption.

"
```

---

### Task 4: S3 — The canvas context menu, the layer order and the generalised lock / hide

**Requirements:** OB-010, OB-014, OB-015, TL-006, CV-004

**Files:**

- Create: `packages/ui/src/components/ui/context-menu.tsx`
- Modify: `packages/ui/src/index.ts` (export the new wrapper)
- Modify: `packages/editor/src/store.ts` (`setClipLocked` / `setClipHidden` replace `setDrawingLocked` / `setDrawingHidden`; `bringToFront`, `sendToBack`, `requestRename`)
- Modify: `packages/editor/src/store.test.ts`
- Modify: `apps/studio/src/components/PreviewPanel.tsx` (the context menu around the canvas stage)
- Modify: `apps/studio/src/components/canvas-hit-test.ts` (hidden and locked clips are not pickable)
- Modify: `apps/studio/src/components/Inspector.tsx` (lock and hide for every clip)
- Modify: `packages/editor/src/timeline/ClipChip.tsx` (the lock badge)
- Modify: `packages/video/src/composition.tsx` (a hidden clip is not rendered)
- Modify: `packages/editor/src/store.test.ts`, `apps/studio/src/components/Inspector.tsx` and the affected test suites

**Interfaces:**

- Consumes: `radix-ui`'s `ContextMenu` (already a `packages/ui` dependency — **no new package**); the existing store actions `groupSelection`, `ungroupSelection`, `duplicateSelection`, `copySelection`, `paste`, `removeClips`, `moveTrack`.
- Produces:
  - `packages/ui/src/components/ui/context-menu.tsx` — a Radix `ContextMenu` wrapper following the `packages/ui/src/components/ui/dropdown-menu.tsx` pattern, exported from `packages/ui/src/index.ts`.
  - `packages/editor/src/store.ts` — `setClipLocked(clipId, locked)`, `setClipHidden(clipId, hidden)`, `bringToFront(clipId)`, `sendToBack(clipId)`, `requestRename(clipId)`.
    - `bringToFront` removes the clip from every track and appends it to `tracks[0]`, the top layer (`packages/video/src/composition.tsx:172`), so it renders above everything there.
    - `sendToBack` removes the clip from every track and **prepends** it to the last track. It cannot be expressed with `moveClipToTrack` (`:594`), which always appends.
    - `requestRename` selects the clip and sets a rename-request signal that the inspector watches to focus its name field (`${clip.id}-name` in `apps/studio/src/components/Inspector.tsx:253`). No `window.prompt`.
  - `packages/video/src/composition.tsx` — `ClipRenderer` returns `null` for a clip with `hidden` set. Today the flag is honoured only inside the drawing renderer (`packages/components/src/trading/drawings/definitions.ts:191`), and that renderer is gone.
  - `apps/studio/src/components/canvas-hit-test.ts` — `pickableClips` (`:95`) filters out clips with `hidden` or `locked` set.

- [ ] **Step 1: Write the Radix context-menu wrapper**

Create `packages/ui/src/components/ui/context-menu.tsx` following `packages/ui/src/components/ui/dropdown-menu.tsx` exactly in structure: a `ContextMenu` root, a `ContextMenuTrigger`, a `ContextMenuContent`, and `ContextMenuItem` / `ContextMenuSeparator` items, each exported individually so consumers compose them. Export the module from `packages/ui/src/index.ts` alongside the other components (`export * from './components/ui/context-menu';`). **No new dependency** — `radix-ui@1.8.1` is already installed in `packages/ui`.

- [ ] **Step 2: Generalise lock and hide in the store**

In `packages/editor/src/store.ts`, rename `setDrawingLocked` (`:973`) to `setClipLocked` and `setDrawingHidden` (`:980`) to `setClipHidden`, and let both act on **any** clip, not only drawings. Remove the old names entirely — no aliases.

- [ ] **Step 3: Add the layer-order and rename actions**

Add `bringToFront`, `sendToBack` and `requestRename` to the store as specified in the Interfaces block. `requestRename` sets a `renameClipId` field in the store state and selects the clip; the inspector reads that field, focuses the name input and clears the signal.

- [ ] **Step 4: Skip a hidden clip in the composition**

In `packages/video/src/composition.tsx`, `ClipRenderer` returns `null` when `clip.hidden` is set. This is the check that moves out of the drawing renderer.

- [ ] **Step 5: Filter hidden and locked clips out of the canvas pick list**

In `apps/studio/src/components/canvas-hit-test.ts`, `pickableClips` (`:95`) skips a clip whose `hidden` or `locked` is set. The top-down order (`:80`) is unchanged.

- [ ] **Step 6: Add lock and hide to the inspector and a badge to the timeline**

In `apps/studio/src/components/Inspector.tsx`, add a lock toggle and a hide toggle to the CLIP section, acting on any clip. In `packages/editor/src/timeline/ClipChip.tsx`, render a lock badge when `clip.locked` is set, so a locked clip is unlockable from the timeline.

- [ ] **Step 7: Wrap the canvas stage in the context menu**

In `apps/studio/src/components/PreviewPanel.tsx`, wrap the canvas stage (`:693`) in the new `ContextMenu`. The items, in order: Group, Ungroup, Duplicate, Copy, Paste, Delete, Rename, Bring to front, Send to back, Lock, Hide. Group, Ungroup, Duplicate, Copy, Paste and Delete call the existing store actions; Rename calls `requestRename`; Bring to front and Send to back call the new actions; Lock and Hide call `setClipLocked` and `setClipHidden`.

- [ ] **Step 8: Write the store tests**

In `packages/editor/src/store.test.ts`, assert, by name:

- "brings a clip to the front of the top layer"
- "sends a clip behind every other clip"
- "keeps a locked clip selectable on the timeline but not on the canvas"
- "keeps a hidden clip in the project until it is unhidden"
- "requests a rename for the selected clip"

- [ ] **Step 9: Exercise the menu in a browser and report**

Right-click a drawing, a chart and a text element in turn. For each, report that the menu opens and that every item does what its label says — in particular that Group and Ungroup work on two selected elements, that Bring to front and Send to back change the visible stacking, that Lock makes the element unselectable on the canvas but still selectable on the timeline, and that Hide removes the element from the preview and the export.

- [ ] **Step 10: Run the render gate and report**

Run `node scripts/verify-r1.mjs`. Both fixtures' still sizes and both MP4 outcomes must be **byte-identical to the S2 render** — S3 changes the editor surface and the hidden-clip check, and no fixture hides a clip. Report the sizes.

- [ ] **Step 11: Run the suite and report**

Run `pnpm test`, `pnpm typecheck` and `pnpm build`. Report the observed counts and results.

- [ ] **Step 12: Update the companion documents**

- `docs/spec/FUNCTIONAL_SPEC.md` §2, §3, §5 — add OB-011 … OB-015 and CV-005; rewrite CH-009, OB-003, OB-004, OB-005 and OB-010 as they now read.
- `docs/spec/COMPONENT_CONTRACT.md` — the drawing definitions no longer evaluate; their props are the independent shape; the `hidden` and `locked` flags are honoured by the shell.
- `docs/roadmap/ROADMAP.md` R3 — record what shipped against the requirement IDs and the deferred list.
- `docs/quality/TEST_STRATEGY.md` §3 — the new test surfaces and the observed counts.

- [ ] **Step 13: Commit**

```bash
git add -A
git commit -m "Give the canvas a context menu and make lock and hide work on everything

Grouping, duplication, copy, paste and delete existed and were hard to
find; the canvas menu surfaces them and adds the layer order, the rename
and the lock and hide that now apply to every clip.

A hidden clip is skipped by the composition rather than by the drawing
renderer that used to honour it, and a locked clip keeps its badge on the
timeline so it can be unlocked.

"
```

---

### Task 5: Final sweep — the whole work, end to end

**Requirements:** every ID this work touches.

**Files:**

- Modify: `docs/spec/FUNCTIONAL_SPEC.md`, `docs/spec/COMPONENT_CONTRACT.md`, `docs/roadmap/ROADMAP.md`, `docs/quality/TEST_STRATEGY.md`
- Create: `docs/decisions/ADR-009-INDEPENDENT-DRAWING-ELEMENTS.md` (already written — this task confirms it matches what shipped)

**Interfaces:**

- Consumes: everything S0 to S3 produced.
- Produces: the companion documents, brought in line with the code as it now stands.

- [ ] **Step 1: Run the whole verification set**

```bash
pnpm typecheck
pnpm test
pnpm build
node scripts/verify-r1.mjs
```

- [ ] **Step 2: Report the observed results**

Report the observed test count and file count, the typecheck result, the build result, the six `Main` still sizes and the MP4 outcome (byte-identical to the pre-change render), the three `AuthoredPath` still sizes and the MP4 outcome (expected to differ, because the drawings became free elements), and both provenance sidecars' contents including their `schemaVersion` and their `annotations` sections.

- [ ] **Step 3: Confirm the cutover is clean**

Grep the workspace for `MarketAnchor`, `DrawingSpec`, `REQUIRED_ANCHORS`, `resolveAnchors`, `buildDrawingAnchors`, `drawingBarId`, `resolveDrawingTarget`, `setDrawingLocked`, `setDrawingHidden`, the retired element types `priceLine` and `priceZone`, and the retired props `price`, `position.entry`, `position.stop` and `position.target`. Every hit must be gone, except the historical references inside `docs/decisions/ADR-007-CHART-ELEMENT-MODEL.md` and `docs/decisions/ADR-009-INDEPENDENT-DRAWING-ELEMENTS.md`, which record what was decided. Report the grep output.

- [ ] **Step 4: Bring the companion documents in line**

Update `docs/spec/FUNCTIONAL_SPEC.md` (§2, §3, §5), `docs/spec/COMPONENT_CONTRACT.md`, `docs/roadmap/ROADMAP.md` (R3) and `docs/quality/TEST_STRATEGY.md` (§3) so that each reads as implemented. Confirm that the requirement IDs in the code match the ones in the documents.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "Bring the companion documents in line with the independent drawings

The functional spec, the component contract, the roadmap and the test
strategy now read as implemented: drawings are ordinary elements with
their own box, their own range and their own geometry, and the context menu
and the generalised lock and hide are recorded.

"
```

---

## What the executor must report at the end

- Per slice: the observed `pnpm typecheck`, `pnpm test` and `pnpm build` results; the render-gate still sizes and MP4 outcome for the slices that require it; the browser interaction observed for the slices with a UI.
- The final test count and file count (the suite was 400 tests over 29 files before this work).
- The six `Main` still sizes and the MP4 outcome, and the statement that they are byte-identical to the pre-change render; the `Main` provenance sidecar's `schemaVersion` and `annotations`.
- The three `AuthoredPath` still sizes and the MP4 outcome, and the statement that they changed because the drawings became free elements — expected, not a regression.
- The provenance sidecar's `annotations` section, showing a drawing's kind and its caption recorded as the creator's own.
- The grep output from the clean-cutover check, and the observation that the only remaining mentions of the retired symbols — `MarketAnchor`, `DrawingSpec`, `priceLine`, `priceZone`, `buildDrawingAnchors`, `drawingBarId`, `resolveDrawingTarget`, `setDrawingLocked`, `setDrawingHidden` — are in the two ADRs that record the decision.
- Every item listed in the Deferred work section, named as still deferred.
- The observation that a drawing states no market value, that the creator's own figure is its caption, and that the interface says so.
- Anything not exercised, named as unverified.
