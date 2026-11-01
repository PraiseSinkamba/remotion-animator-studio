# Chart Studio — Independent drawing elements

**Status:** Proposed for owner approval — no implementation authorised by this document.
**Date:** 2026-11-01
**Design edition:** 1.1 — the drawing vocabulary is TradingView's; `priceLine` → `horizontalLine`
and `priceZone` → `rectangle`; no drawing carries a market value.
**Supersedes:** the market-anchor drawing decision in
[ADR-007 — The chart element model](../decisions/ADR-007-CHART-ELEMENT-MODEL.md) §Decision item 4,
as recorded and explained in [ADR-009 — Drawings are independent elements](../decisions/ADR-009-INDEPENDENT-DRAWING-ELEMENTS.md).
Extends `docs/spec/FUNCTIONAL_SPEC.md`, `docs/spec/COMPONENT_CONTRACT.md`,
`docs/roadmap/ROADMAP.md`.
**Companions:** [ADR-009 — Drawings are independent elements](../decisions/ADR-009-INDEPENDENT-DRAWING-ELEMENTS.md)
(the decision record), [Implementation plan](../superpowers/plans/2026-11-01-independent-drawing-elements.md).

---

## 1. The problem this design solves

### 1.1 What the creator cannot do today

The eight drawing tools exist and work, but they are not elements. They are annotations on a
chart, and they inherit every constraint that comes with that:

| # | The creator wants to | What happens today |
|---|---|---|
| P1 | Put a horizontal level across a composition | A chart must exist, be selected, and be clicked inside. The tool rail shows the drawing tools only when a chart is selected (`apps/studio/src/components/ToolRail.tsx:22`, `:92`). |
| P2 | Drop a drawing from the library onto a canvas | The drop is refused with the notice "A drawing needs a chart — drop it on one, or select a chart and use the tool rail." (`apps/studio/src/components/PreviewPanel.tsx:541`). |
| P3 | Give a drawing its own time range | The drawing takes the chart's `from`, the chart's `durationInFrames` and the chart's relative `in` / `out` (`packages/editor/src/store.ts:918` — `addDrawing`), and it lives on the chart's own track. |
| P4 | See a drawing that was just placed | The anchors resolve against revealed bars, so an unresolved anchor renders nothing (`packages/components/src/trading/drawings/definitions.ts:100`). A creator must scrub forward to find out whether the tool worked. |
| P5 | Find grouping | Grouping works (`packages/editor/src/store.ts:499`) but is only reachable from the inspector's Actions section and ⌘G. |
| P6 | Lock or hide an element | The two flags exist on every `Clip` (`packages/core/src/schemas.ts:107`, `:109`) but are only honoured for drawings, and only for `hidden`, and only inside the drawing renderer (`packages/components/src/trading/drawings/definitions.ts:191`). Nothing else in the product renders them. |

### 1.2 The one sentence this design makes true

> A creator should be able to **place a drawing anywhere in the composition**, with its own box,
> its own time range and its own geometry, **whether or not a chart exists in the project at all**.

The word that carries the weight is *anywhere*. Not "on a chart's plot area, at a price". Anywhere.

### 1.3 In scope

| # | Feature | Requirement IDs |
|---|---|---|
| F1 | The eight drawing kinds become ordinary elements: their own box in composition space, their own frame range, their own layer position, rendered with no chart in the project | OB-001, OB-003, OB-010, CH-009 |
| F2 | The drawing set is TradingView's vocabulary — horizontal line, vertical line, trend line, high and low line, rectangle, text, arrow, long/short position — and every kind is pure geometry with no market value anywhere | OB-004, OB-005, OB-006, CPT-005 |
| F3 | The placement flow: the tools are always offered, a click or a drop places a drawing at that point, and the creator drags the points afterwards | OB-001, OB-004 |
| F4 | The migration: a document with today's chart-anchored drawings renders again after the cutover, with the old element types mapped to the new ones, the price kept as a caption, and the placement stated as an approximation | CV-001, CV-003, AP-002 |
| F5 | A canvas context menu: group, ungroup, duplicate, copy, paste, delete, rename, layer order, lock, hide | OB-010, TL-006 |
| F6 | Lock and hide generalise to every clip | OB-010, CV-004 |
| F7 | The provenance record gains an annotations section that records a drawing's kind and its caption | MD-010, EX-004 |

### 1.4 Scope decisions already made (not reopened here)

- **The chart is untouched.** Panes, relations, holds, zoom and the chart's provenance stay as they
  are. This design changes what a drawing *is*, not what a chart *is*.
- **No snapping, ever.** A drawing does not read a chart's scale, bars or pane — not even for a
  moment at placement time. Snapping would reintroduce exactly the coupling this design removes.
- **The vocabulary is TradingView's.** The set is horizontal line, vertical line, trend line, high
  and low line, rectangle, text, arrow and long/short position. Two kinds are **renamed**:
  `priceLine` becomes `horizontalLine` and `priceZone` becomes `rectangle`, because a line that
  keeps the name `priceLine` while holding no price is a false label. The registry's standing rule
  that a type is never renamed **does not apply to these two**, and the v2 → v3 migration maps the
  old element types to the new ones. The other six kinds keep their ids
  (`packages/core/src/elements.ts:182`), and no kind is renumbered or reused.
- **No market values anywhere.** Every kind is pure geometry. The horizontal line has no price,
  the rectangle has no edge prices, the position tool's three levels are positions inside its own
  box. The creator's own figure is a **caption** — a short string the creator types, drawn beside
  the shape.
- **The market-anchor model is not kept behind a flag.** The cutover is clean: no shim, no alias,
  no second drawing model.

---

## 2. Design principles

1. **One object graph.** A drawing is a `Clip` on a `Track` in a `Project`, exactly like every
   other element. The moment a drawing needs a second lifecycle, a second coordinate system or a
   second serialisation, it has stopped being an element.
2. **Independence is total.** No chart lookup, no pane lookup, no anchor resolution, no snapping,
   no fallback that quietly reads the market. A drawing that reads a chart is a chart annotation
   wearing an element's clothes.
3. **The drawing is geometry, and the creator owns it.** A drawing's points and levels are
   positions in its own box that the creator drags; the creator's own figure is a caption the
   creator types. Nothing in a drawing is market truth, and the product does not pretend otherwise.
4. **A name must not claim what the data does not support.** A line that holds no price is not a
   price line; a zone with no prices is a rectangle. That is why the two kinds are renamed, and it
   is the same rule that governs every other label in the product.
5. **Honesty over convenience.** Where independence costs something — a level cannot place itself
   on a market, a migration cannot reproduce a live scale — the cost is stated in the interface
   and in the code, not hidden behind a plausible-looking default.
6. **The timeline is the lifecycle.** One frame range, one place, one meaning. A chart-relative
   range is deleted, not deprecated.
7. **Surfaces over new machinery.** Grouping, duplication, copy, paste, delete and the layer order
   already exist in the store. The context menu surfaces them; it does not reinvent them.
8. **The render gate is the proof.** A change to a drawing is not done until
   `node scripts/verify-r1.mjs` has rendered it.

---

## 3. The target object model

### 3.1 What a drawing clip is

A drawing is a `Clip` whose `element` is one of the eight `DrawingKind` values. Its props are:

```ts
/** A point inside a drawing's own box, as a 0..1 fraction. Origin top-left, y down. */
export interface DrawingPoint {
  x: number;
  y: number;
}

/** The colours and weights a drawing carries. */
export interface DrawingStyle {
  color?: string;
  lineWidth?: number;
  /** Fill opacity of a rectangle or a zone band. */
  fillOpacity?: number;
  fontSize?: number;
}
```

Every drawing clip carries, in its props:

| Prop | Type | Meaning |
|---|---|---|
| `x`, `y` | number | the **centre** of the element's box, in composition pixels — the same convention every other element uses (`packages/video/src/composition.tsx` centres the clip's content with `translate(-50%, -50%)`) |
| `width`, `height` | number | the box size in pixels |
| `opacity` | number | 0..1 |
| `style` | `DrawingStyle` | the drawing's own appearance |
| `caption` | string | an optional short string the creator types, drawn beside the shape — the creator's own figure |

and, per kind, the content described in §3.3.

The clip's own `from` and `durationInFrames` are the drawing's lifecycle. There is no second range.

### 3.2 What is dropped, and why

| Dropped | Why |
|---|---|
| `chartClipId` | It names the chart a drawing resolves against. An independent drawing resolves against nothing. |
| `paneId` | Same reason. A pane is a chart's internal structure. |
| `anchors` (`MarketAnchor`) | A market anchor is a reference *out* of the drawing. The whole point is that the drawing has no reference out. |
| `in`, `out` (chart-relative) | A chart-relative frame range is a second clock. The clip's own range is the only range. |
| `zone.extendRight` | `ComponentRenderContext` carries no composition size (`packages/core/src/contract.ts:22-34`), so a rectangle cannot know where "the right edge" is. The box is the extent. |
| The authored numbers (`price`, `position.entry` / `position.stop` / `position.target`) | A drawing reads no market, so it holds no market value. The horizontal line carries no price; the rectangle carries no edge prices; the position tool's three levels are positions in its own box. The creator's own figure is a `caption`. |
| The drawing definitions' `evaluate` step | With nothing to resolve, there is nothing to evaluate. `evaluateDrawing` (`packages/components/src/trading/drawings/definitions.ts:100`) goes with `anchors.ts` (`packages/components/src/trading/drawings/anchors.ts`). |

Retired with them: `MarketAnchor` (`packages/core/src/elements.ts:171`) and `DrawingSpec`
(`:193`, already unused). The chart API `chartPointToAnchor` /
`chartAnchorToPoint` (`packages/components/src/trading/chart.tsx:280`, `:304`) stays — they are
chart API and are heavily tested.

### 3.3 The per-kind model

The set is TradingView's, and every kind is pure geometry. There is no market value anywhere in it.

| Kind | TradingView equivalent | Points | Other props | Drawn shape | How the creator manipulates it |
|---|---|---|---|---|---|
| `horizontalLine` | Horizontal Line | — | — | a horizontal rule across the box at the box's vertical centre | placed by one click; the caption is typed |
| `verticalLine` | Vertical Line | `points.at` | — | a vertical rule at `at.x`, spanning the box's full height | placed by one click; the point is dragged |
| `trendline` | Trend Line | `points.start`, `points.end` | `trendline.ray` | a straight line between the two points, **any angle**, optionally extended as a ray | two clicks, then two draggable handles |
| `highLowLine` | High and Low Line | `points.top`, `points.bottom` | — | a vertical segment between the two points | two clicks, then two draggable handles; the segment stays vertical |
| `rectangle` | Rectangle | — | — | the element's own box, outlined and optionally filled | one click; the box is resized like any element's |
| `textLabel` | Text | `points.at` | `label.text` | the text, anchored at the point | one click; the text is typed |
| `arrow` | Arrow | `points.from`, `points.to` | — | a segment from one point to the other, with a head | two clicks, then two draggable handles |
| `position` | Long/Short Position | `points.entry`, `points.stop`, `points.target` | `position.direction`, `position.showRiskReward` | three horizontal levels inside the box, plus the distance ratio | one click, then three draggable level handles |

Every kind also carries the optional `caption` (§3.1) and the shared `style`.

#### 3.3.1 Normalised points

`DrawingPoint` is a 0..1 fraction of the drawing's own box. Origin top-left, y down. A point at
`(0, 0)` is the box's top-left corner; `(1, 1)` is its bottom-right.

Consequences:

- Resizing a drawing scales its shape. A trendline's two points keep their relationship to the box.
- The box is the only thing that needs to be stored in composition coordinates.
- A point is meaningless outside its box, which is exactly the property the design wants: the
  geometry travels with the element.

#### 3.3.2 The horizontal line, and the caption

The horizontal line carries no points and no price. The rule is drawn at the box's vertical
centre, across the box's full width.

If the creator wants to state a level — "4200", "level 3", "stop here" — they type it in the
**caption**, and the caption is drawn beside the rule. TradingView labels its lines the same way.
The caption is the creator's own figure ✓ and the product never claims it is a market value.

This is the sharpest honesty limit in the design and it is stated rather than smoothed over:

> A drawing reads no market, so it states no market value. The caption is the creator's own
> figure; the box places the geometry.

#### 3.3.3 The position tool

The position tool carries three **levels** — `points.entry`, `points.stop`, `points.target` — which
are positions inside its own box, not prices. The creator drags them.

The tool shows the **distance ratio**: the target's distance from the entry, divided by the
stop's distance from the entry, computed from the drawn geometry:

```
ratio = |target.y − entry.y| / |entry.y − stop.y|
```

That is a true statement about the shape on screen — how many times further the target is from
the entry than the stop is. It is **not** a profit-and-loss figure and it does **not** imply a
broker fill (OB-006 stands).

TradingView's "% distance" is **not** shown: it needs a price scale, and this product has none.
A creator who wants a price in the trade types it in the caption.

`direction` (`long` / `short`) tells the adapter how to read the three roles — for a long the
target is above the entry and the stop below, for a short the other way round — and
`showRiskReward` toggles the ratio label.

#### 3.3.4 Default boxes and click counts

| Kind | Clicks to place | Default box (px) |
|---|---|---|
| `horizontalLine` | 1 | 480 × 24 |
| `verticalLine` | 1 | 24 × 320 |
| `trendline` | 2 | 320 × 180 |
| `highLowLine` | 2 | 24 × 320 |
| `rectangle` | 1 | 320 × 180 |
| `textLabel` | 1 | 200 × 40 |
| `arrow` | 2 | 320 × 180 |
| `position` | 1 | 320 × 240 |

Two-click kinds build their box from the two clicks: the bounding box of the two points, padded by
16 px on each side, with a minimum of 32 px in each axis. One-click kinds use the default box
centred on the click.

The position tool takes **one** click and its three levels are dragged afterwards. The rectangle
takes one click and is resized like any other element's box.

### 3.4 Rendering

A drawing's adapter draws inside the drawing's own box, in box-local pixels: a point at fraction
`(px, py)` is at `(px * width, py * height)`. The composition already positions a clip's content
centred on `props.x` / `props.y`, so the drawing needs no offset arithmetic of its own — the
`DrawingCanvas` shell that carried the chart-relative offset
(`packages/components/src/trading/drawings/adapters.tsx`) simplifies to a plain SVG of the drawing's
own size.

The caption, when present, is drawn beside the shape in the drawing's own style, in the same
manner TradingView labels its lines.

A drawing renders in every frame of its own range. There is no `visible` flag any more: the
lifecycle is the clip's frame range, and the range is the timeline's business.

### 3.5 The store

| Action | Signature | Behaviour |
|---|---|---|
| `addDrawing` | `(kind: DrawingKind, draft: DrawingDraft) => string` | Creates an independent clip: the box, the points and the optional caption from the draft, the frame range from the current frame, the track from the default rule (§3.7), the props from the definition's defaults merged with the draft. |
| `updateDrawing` | `(clipId, patch) => void` | Unchanged in shape; now patches an independent drawing's props. |
| `setClipLocked` | `(clipId, locked) => void` | Renamed from `setDrawingLocked` and generalised to every clip. |
| `setClipHidden` | `(clipId, hidden) => void` | Renamed from `setDrawingHidden` and generalised to every clip. |
| `bringToFront` | `(clipId) => void` | Moves the clip to `tracks[0]` (the top layer), appended to it so it renders above the clips already there. |
| `sendToBack` | `(clipId) => void` | Moves the clip to the last track, **prepended** to it, so it renders below everything else. |
| `requestRename` | `(clipId) => void` | Selects the clip and signals the inspector to focus its name field. No `window.prompt`. |

`moveClipToTrack` (`packages/editor/src/store.ts:594`) removes the clip from every track and
**appends** it to the target, so it cannot express "send to back"; `sendToBack` therefore needs its
own code rather than a call to it.

Removed with the market-anchored model: `resolveDrawingTarget` (`:888`), the `anchors` argument of
`addDrawing`, `buildDrawingAnchors` and `drawingBarId`
(`packages/editor/src/drawings.ts:65`, `:51`).

`copyClipProps` (`packages/editor/src/store.ts:251`) deep-copies the `points` object, exactly as
it deep-copies `anchors` today.

### 3.6 The editor flow

- **The tool rail** always offers the eight drawing tools. The chart gate
  (`apps/studio/src/components/ToolRail.tsx:22`, `:92`) goes.
- **A click on the canvas** with a tool armed places the drawing at that point: one click for the
  one-click kinds, two clicks for the two-point kinds. No chart is consulted.
- **A drop from the library** places the drawing at the drop point. The library's eight drawing
  kinds move into their own **Drawings** group
  (`packages/ui/src/components/library/catalog.tsx:38-50`).
- **The drop and the click both use the same path**, so the "A drawing needs a chart" notice
  (`apps/studio/src/components/PreviewPanel.tsx:541`) is deleted.
- **The drawing's own frame range** starts at the current frame and runs about ninety frames, or
  to the end of the project if that is sooner. The creator edits it in the timeline, like any
  clip's range.
- **The points are draggable handles.** The editor draws handles over the canvas for a drawing's
  points and the creator drags them. This is the machinery the swing path already uses for its
  anchors — `swingHandles()` (`apps/studio/src/components/PreviewPanel.tsx:623`) and the swing drag
  handler (`onPointerMove`, `:392`, with the gesture state in `swingDrag`, `:116`); it is **reused,
  not rebuilt**. The trend line's two handles take any angle; the high and low line's two handles
  stay on a vertical segment; the position tool's three handles move their levels.
- **The drawing inspector** shows the box, the geometry, the caption, the style, and the clip's own
  frame range. The chart-relative `in` / `out` are gone, including from
  `COMMON_PARAMS` (`packages/components/src/trading/drawings/definitions.ts:227`). There are no
  number fields, because there are no numbers.

### 3.7 The default track

A new drawing lands on:

1. the track **immediately above** the chart it was dropped on, when there is a chart under the
   drop point — one step towards the top layer, because `tracks[0]` is the top layer
   (`packages/video/src/composition.tsx:172`). A chart already on the topmost track shares that
   track and the drawing is appended to it, so it renders above the chart;
2. otherwise the track of the selected clip;
3. otherwise the first track.

### 3.8 The context menu

A Radix `ContextMenu` wraps the canvas stage
(`apps/studio/src/components/PreviewPanel.tsx:693`). `packages/ui` already depends on
`radix-ui@1.8.1`; the wrapper is a new file
`packages/ui/src/components/ui/context-menu.tsx` following the `dropdown-menu.tsx` pattern, exported
from `packages/ui/src/index.ts`. **No new dependency.**

| Item | Store action | New work? |
|---|---|---|
| Group | `groupSelection` | re-surfaced |
| Ungroup | `ungroupSelection` | re-surfaced |
| Duplicate | `duplicateSelection` | re-surfaced |
| Copy | `copySelection` | re-surfaced |
| Paste | `paste` | re-surfaced |
| Delete | `removeClips` | re-surfaced |
| Rename | `requestRename` → the inspector's name field (`${clip.id}-name`) | **new** |
| Bring to front | `bringToFront` | **new** |
| Send to back | `sendToBack` | **new** |
| Lock | `setClipLocked` | renamed + generalised |
| Hide | `setClipHidden` | renamed + generalised |

### 3.9 Lock and hide, generalised

- **Hidden**: the composition skips a hidden clip (`packages/video/src/composition.tsx`). Today the
  flag is honoured only inside the drawing renderer
  (`packages/components/src/trading/drawings/definitions.ts:191`), and once drawings stop using
  that renderer the check has to move to the composition or hidden drawings start rendering.
- **Locked**: a locked clip is not selectable on the canvas, so `canvas-hit-test.ts` filters it
  out of `pickableClips` (`:95`). It stays selectable on the timeline, where a lock badge on the
  clip chip is the way back in, and the inspector shows it read-only.
- Both flags already exist on every `Clip` (`packages/core/src/schemas.ts:107`, `:109`); the change
  is in where they are honoured and in the UI that sets them.

### 3.10 The migration (v2 → v3)

`CURRENT_PROJECT_SCHEMA_VERSION` (`packages/components/src/project-migrate.ts:22`) moves from 2 to
3 and the migration gains a v2 → v3 step. The rules the migration already keeps — a higher
`schemaVersion` is rejected, an unknown component is rejected, a clip whose `propsVersion` exceeds
its component's is rejected, the migration is non-destructive and idempotent — all stay.

The v1 → v2 step runs first, so a v1 document becomes v2 and then v3 in one pass.

#### 3.10.1 The algorithm

The migration **maps the old element types to the new ones** as its first act:

| v2 element | v3 element |
|---|---|
| `priceLine` | `horizontalLine` |
| `priceZone` | `rectangle` |
| `highLowLine`, `verticalLine`, `trendline`, `textLabel`, `arrow`, `position` | unchanged |

Then, for each drawing clip in the document:

1. **Find the chart.** Look up `props.chartClipId` in the project's tracks. If it is not there,
   fall back to the stored box (§3.10.3).
2. **Find the pane.** Look up `props.paneId` among the chart's panes. If it is not there, fall back
   to the stored box.
3. **Get the full-series price range.** Materialise the pane's series
   (`packages/core/src/series.ts:133` — `materialiseSeries`), aggregate it by the pane's factor,
   and take `computePriceRange` over **all** of it (`packages/core/src/market.ts:251`). Not the
   revealed subset — the whole series.
4. **Get the plot area.** `chartGeometry` (`packages/components/src/trading/chart.tsx:151`) with the
   chart's merged props and the pane's rect, using the full bar count.
5. **Map the old anchors to new content.**
   - A price anchor becomes a `y` via `priceToY` (`:176`) over the full-series range.
   - A point anchor (bar + price) becomes an `x` (the bar's slot centre) and a `y`.
   - A candle anchor (bar + side) becomes the bar's extreme price, mapped to a `y`.
   - A time anchor (bar) becomes the bar's slot centre `x`.
6. **Build the new props.**
   - `horizontalLine` (from `priceLine`): no points. The box is a band of the plot area's width and
     24 px tall, centred on the price's `y`. The old anchor's price becomes the **`caption`**,
     exactly — the creator's own figure is not lost.
   - `highLowLine`: `points.top` and `points.bottom` from the two anchors, on a vertical segment.
     The bar snapping is gone: the result is TradingView's shape without the bar.
   - `verticalLine`: `points.at` from the bar's slot centre.
   - `trendline`: `points.start` and `points.end`.
   - `rectangle` (from `priceZone`): the element's own box. The zone's two edge prices are **not**
     carried over — they were market-derived clicks and a market-derived number has no meaning in
     an independent element. An extend-right zone's box is widened to the chart's right edge.
   - `textLabel`: `points.at`; `label.text` is preserved.
   - `arrow`: `points.from` and `points.to`.
   - `position`: `points.entry`, `points.stop` and `points.target` are the old anchors' prices
     mapped to `y` fractions of the box; the box is the plot-area rect. The three levels are
     positions, so their old prices become their old *positions* — an approximation, stated in
     §3.10.2. `position.direction` and `position.showRiskReward` are preserved.
   - `caption`, `style` and `opacity` are preserved.
7. **Convert the lifecycle.** The old `in` / `out` were chart-relative:
   `from = chart.from + in`, and `durationInFrames = (out > in ? out : chart.durationInFrames) − in`.
   An `out` of 0 means open-ended.
8. **Bump the clip's `propsVersion`** to the definitions' new version (2).

#### 3.10.2 The approximation, stated

The placement uses the chart's **plot area** and the chart's **full-series** price range. A static
migration cannot reproduce the scale a chart had at a particular frame, so the migrated position is
an **approximation at the last frame**. The migration carries that sentence in its own comment, and
the design states it here so that nobody later reads the migration as exact.

What is *not* approximate: the caption. A v2 price line's price becomes the caption, exactly, so
the creator's own figure survives.

What *is* approximate: where the element sits, and — for the position tool — where its three
levels sit, because the levels are mapped from the old prices through the full-series range rather
than from the chart's live scale.

#### 3.10.3 The fallback

If the chart, the pane or the series cannot be resolved, the migration keeps the drawing's stored
box (`props.x`, `props.y`, `props.width`, `props.height`), uses the kind's default points, keeps
any caption it can read, and sets a default frame range. The migration never throws on a drawing
and never leaves a drawing half-converted.

#### 3.10.4 Idempotence

A v3 document passes through `migrateProject` unchanged. `migrateProject(migrateProject(p))`
deep-equals `migrateProject(p)`, as today.

### 3.11 Provenance

`ProvenanceRecord` (`packages/core/src/provenance.ts:71`) gains an `annotations` section: one
entry per drawing clip, carrying the drawing's kind and its caption, recorded as **the creator's
own** and not market-derived. The `series` and `simulation` sections stay as they are.
`packages/core` keeps its no-React, no-Remotion rule.

### 3.12 The render gate

`node scripts/verify-r1.mjs` renders two fixtures:

- **Main** — a schema-v1 document with **no drawings**. Its stills and its MP4 must stay
  byte-identical across this change: the v1 → v2 → v3 migration is a no-op for it. Its provenance
  sidecar's `schemaVersion` field will read 3; that is expected and is not a frame change.
- **AuthoredPath** — the feature fixture. It carries a price line and a trendline, both of which
  become independent drawings — the price line as a horizontal line. The fixture is rewritten to
  schema v3. Its stills and MP4 are **expected to change**, and that change is the honest record
  of the cutover.

---

## 4. Requirement mapping

### 4.1 Existing requirement IDs this design satisfies

| ID | Requirement | How |
|---|---|---|
| OB-001 | The product offers the eight drawing tools | The tools survive; they become elements (§3.3) |
| OB-003 | A drawing is an object with its own lifecycle | The clip's own frame range is the lifecycle (§3.1) |
| OB-004 | The creator controls a drawing's numbers | **Rewritten**: a drawing holds no market number at all. The creator controls the geometry — the points and the levels — and states a figure in the caption (§3.3) |
| OB-005 | The price zone is a band | **Rewritten twice over**: the kind is renamed `rectangle` and it is the element's own box, with no market-derived edge prices (§3.3) |
| OB-006 | The position tool shows levels and an optional R:R ratio, never a P&L figure and never a broker fill | Unchanged in rule; the levels are positions in the box and the ratio is computed from the drawn geometry (§3.3.3) |
| OB-010 | Objects can be grouped and layered | The context menu surfaces grouping; layer order is a new action (§3.8) |
| CH-009 | The chart is a collection of elements | Unchanged — and now the chart is not the *only* place an element can live |
| CPT-005 | A drawing's placement survives a chart resize | **Rewritten**: a drawing has no chart to resize. Its placement is its own box (§3.1) |
| MD-010 | Provenance travels with the export | The annotations section records each drawing's kind and caption (§3.11) |
| EX-004 | The export's metadata is complete | Same |

### 4.2 New requirement IDs (to be added to `docs/spec/FUNCTIONAL_SPEC.md` §3)

| ID | Requirement |
|---|---|
| OB-011 | A drawing is placed at a point in the composition and renders with no chart in the project |
| OB-012 | A drawing's geometry is authored inside its own box and scales with it |
| OB-013 | A drawing carries an optional caption the creator types, recorded in the export as the creator's own figure |
| OB-014 | The canvas offers a context menu: group, ungroup, duplicate, copy, paste, delete, rename, bring to front, send to back, lock, hide |
| OB-015 | Lock and hide apply to every clip, not only to drawings |
| CV-005 | A document that holds chart-anchored drawings is migrated to independent drawings, with the old element types mapped to the new ones and the price kept as a caption |

### 4.3 Not claimed by this design

- That a drawing states a market value. It does not, and cannot (§3.3.2). The creator's own
  figure is a caption.
- That a migrated drawing lands on exactly the pixel it had. It lands on an approximation, stated
  (§3.10.2).
- That the price zone keeps its authored edge prices. It does not; those edges were market-derived
  clicks, and a market-derived number has no meaning in an independent element.
- TradingView's "% distance" on the position tool. It needs a price scale this product does not
  have (§3.3.3).
- Any change to the chart's model. None is proposed.

---

## 5. The migration in one page

| Question | Answer |
|---|---|
| Which documents are affected? | Any document holding a drawing: schema v1 documents pass through v2 first |
| Which element types change? | `priceLine` → `horizontalLine` and `priceZone` → `rectangle`; the other six keep their names |
| What is preserved exactly? | The price line's price (as the caption), `label.text`, `trendline.ray`, `position.direction`, `position.showRiskReward`, `style`, `opacity` |
| What is approximated? | The element's placement, and the position tool's level positions |
| What is dropped? | The zone's `extendRight` behaviour and its edge prices; the high/low line's bar snapping |
| What happens when the chart is gone? | The stored box is kept, the default points are used, any caption is kept, a default range is set |
| Is it idempotent? | Yes — a v3 document passes through unchanged |
| Does the Main fixture change? | No: its stills and MP4 stay byte-identical; only its sidecar's `schemaVersion` reads 3 |

---

## 6. Risks

| # | Risk | Why it is real | Mitigation and where it is proven |
|---|---|---|---|
| R1 | **A migrated document renders differently.** The old drawing sat at a price on a live scale; the new one sits at a migrated box position. | The migration cannot reproduce a live scale. | The migration uses the plot area and the full-series range and states the approximation in its own comment. `packages/components/src/project-migrate.test.ts` — "keeps a migrated price line's price as its caption" and "places a migrated drawing using the chart's plot area". |
| R2 | **The Main fixture's bytes change.** Any change to the composition or the migration path can move a pixel in an unrelated fixture. | The render gate compares bytes. | `Main` holds no drawings, so the migration is a no-op for it. The render gate must report identical still sizes and an identical MP4 for `Main`. |
| R3 | **The cutover lands in two pieces.** The migration rewrites the props the renderer reads; a half-landed cutover renders nothing. | `migrateClip` rejects a clip whose `propsVersion` exceeds its component's (`packages/components/src/project-migrate.ts:28-90`), so the definition bump and the migration must ship together. | The migration, the definitions' `propsVersion` bump, the renderers, the store producer and the call sites are one atomic slice. The plan states this and does not split it. |
| R4 | **A hidden clip starts rendering.** The `hidden` check lives inside the drawing renderer today. | Once drawings stop using that renderer, nothing checks the flag. | The composition skips a hidden clip. A test asserts a hidden clip is not rendered and a hidden drawing is not pickable on the canvas. |
| R5 | **A locked clip cannot be unlocked.** Locking is easy; getting back is not. | A locked clip is not selectable on the canvas. | A locked clip stays selectable on the timeline and carries a lock badge. A test asserts a locked clip is not canvas-pickable but is timeline-selectable. |
| R6 | **A caption reads as a market claim.** A caption that says 4200 beside a rule nowhere near 4200 invites distrust. | The caption cannot place itself without a scale. | The caption is labelled as the creator's own figure, never as a market level, and the interface states the limit (§3.3.2). |
| R7 | **The position tool's levels mislead.** The ratio is a true fact about the geometry, but the levels look like a market setup. | The geometry looks like a trade even though nothing is market-derived. | The ratio is a geometric fact about the drawn levels; no P&L figure is drawn and no broker fill is implied (OB-006). A test asserts the picture contains no P&L string. |
| R8 | **Copy/paste shares state.** A pasted drawing could share its `points` object with the original. | `copyClipProps` deep-copies what it knows about. | `copyClipProps` deep-copies `points`. A test asserts a duplicated drawing's points are a different object with equal values. |
| R9 | **A drawing lands on the wrong track.** The default rule is a heuristic. | "Immediately above the chart" is one step towards the top layer, and a chart on the topmost track shares its track. | The rule is stated exactly (§3.7) and a store test asserts each branch. |
| R10 | **The context menu offers a locked clip's actions.** A locked clip's menu should be reduced. | The menu is generic. | Locked clips are not canvas-pickable, so the menu never opens on one. |
| R11 | **Scope creep into a second drawing model.** "Just keep the old renderer for migrated documents" is an easy sentence to write and a permanent cost. | It is the alternative the ADR rejects. | The cutover is clean: no shim, no alias. A test asserts the old anchor props are gone from the migrated document. |
| R12 | **A renamed kind breaks a saved document.** `priceLine` and `priceZone` no longer exist in the registry. | The element type is the persisted id. | The v2 → v3 migration maps the old types to the new ones, so an old document opens as a horizontal line and a rectangle. A test asserts the mapping. |

---

## 7. Verification the executor must run and report

Every slice runs and reports the observed result of:

```bash
pnpm typecheck        # turbo typecheck across the workspace
pnpm test             # vitest across the workspace
pnpm build            # turbo build; the studio bundle must build
node scripts/verify-r1.mjs   # real Remotion render: PNG stills AND an MP4
```

`node scripts/verify-r1.mjs` is the render gate and it is required for every slice that touches
rendering. It renders the **Main** fixture (frames 0, 20, 45, 100, 140, 179) and the
**AuthoredPath** fixture (frames 45, 100, 179), and writes the provenance sidecars.

The executor must report:

- the observed test count and file count (the suite was **400 tests over 29 files** before this
  work — `docs/quality/TEST_STRATEGY.md` §3 understates this as 27 / 378 and is corrected as part
  of this work);
- the typecheck and build results;
- the six Main still sizes and the MP4 outcome, and **whether they are byte-identical to the
  pre-change render**;
- the three AuthoredPath still sizes and the MP4 outcome, and that the change is the expected one;
- both provenance sidecars' contents, including the new annotations section and the `schemaVersion`
  each records;
- every user-interface interaction exercised in a browser: placing a drawing with no chart in the
  project, the context menu's every item, lock and hide on a chart and on a drawing, and the
  migration's effect on an existing document.

Anything not exercised is reported as unverified. There is no substitute for the render gate.

---

## 8. Deliverables this work produces

| Artefact | Path |
|---|---|
| The decision record | `docs/decisions/ADR-009-INDEPENDENT-DRAWING-ELEMENTS.md` |
| This design | `docs/superpowers/specs/2026-11-01-independent-drawing-elements-design.md` |
| The implementation plan | `docs/superpowers/plans/2026-11-01-independent-drawing-elements.md` |
| New requirement IDs | `docs/spec/FUNCTIONAL_SPEC.md` §3 (OB-011 … OB-015, CV-005) |
| Rewritten requirement IDs | `docs/spec/FUNCTIONAL_SPEC.md` §3 (CH-009, OB-003, OB-004, OB-005, OB-010) |
| Component contract update | `docs/spec/COMPONENT_CONTRACT.md` §2, §3, §5, §6 |
| Roadmap update | `docs/roadmap/ROADMAP.md` R3 |
| Test coverage record | `docs/quality/TEST_STRATEGY.md` §3 |

---

## 9. Approval

This document changes the project schema and the meaning of eight element types, and it renames
two of them. Under `AGENTS.md` it requires owner approval before any implementation begins, and
the roadmap is not coding permission.

Seven decisions inside it are the owner's, and ADR-009 records each with its alternative:

1. **§3.3 — the drawing set is TradingView's vocabulary, and every kind is pure geometry.** There
   are no market values anywhere in it; the creator's own figure is a caption. The alternative is a
   set that keeps authored prices on a horizontal line and on the position tool, which is what this
   design first proposed and what the owner's TradingView reference supersedes.
2. **§3.3, decision 9 in ADR-009 — `priceLine` is renamed `horizontalLine` and `priceZone` is
   renamed `rectangle`, and the migration carries the rename.** The alternative is keeping the old
   names over new behaviour, which leaves two kinds whose names claim a market the product does not
   have.
3. **§3.10 — the migration keeps what it can — the price as a caption — and approximates the
   placement.** The alternative is keeping the old renderer alive behind a flag, which keeps two
   drawing models in the product forever.
4. **§3.7 — the default track for a new drawing.** The alternative is always the first track.
5. **§3.6 — the drawing inspector shows box, geometry, caption, style and the clip's own frame
   range.** The alternative is an inspector that also shows the market context the drawing no
   longer has.
6. **§3.8 — the canvas context menu and its item set.** The alternative is a timeline context menu,
   or no context menu.
7. **§3.9 — lock and hide generalise to every clip.** The alternative is keeping them
   drawing-only.

Two points deserve the owner's attention before approval rather than after:

> **A drawing states no market value.** After this change, a horizontal line says "4200" in its
> caption and sits where the creator put it. That is the consequence of total independence, and
> the interface says so rather than implying a market anchor it does not have.

> **Two element types change name.** A document saved before this work opens with its price lines
> as horizontal lines and its price zones as rectangles. The migration carries the rename, so
> nothing is lost — but the names in the saved file are different afterwards.
