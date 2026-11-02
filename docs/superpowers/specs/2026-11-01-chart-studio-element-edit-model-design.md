# Chart Studio — the element edit model — design

**Date:** 2026-11-01
**Status:** approved by the owner in discussion, 2026-11-01
**Companion ADR:** `docs/decisions/ADR-010-ELEMENT-EDIT-MODEL.md`
**Companion plan:** `docs/superpowers/plans/2026-11-01-chart-studio-element-edit-model.md`
**Builds on:** `docs/decisions/ADR-009-INDEPENDENT-DRAWING-ELEMENTS.md` (the drawings became independent
elements), `docs/decisions/ADR-003-COMPONENT-SYSTEM.md` (one object protocol), ADR-007 (the chart element
model and project schema version 2).

---

## 1. The problem

Every element in the editor gets the same selection: an axis-aligned dashed rectangle with four corner
resize handles, drawn from the element's `x`, `y`, `width` and `height`. The canvas picks an element the
same way — *"the topmost clip whose **box** contains the pointer"* (`apps/studio/src/components/canvas-hit-test.ts`).

That model is wrong in three ways, and each one is felt by the creator:

1. **A line's box swallows the canvas.** A trend line's region is the bounding box of its two ends. On a
   chart that is hundreds of pixels across, and the line cannot be selected without also selecting
   everything underneath it. The creator's words: *"if you select a line on the chart its bounded box
   covers the whole canvas you can't select other items."*
2. **A box that describes nothing.** `text`, `counter` and `emoji` have **no width and no height** at all —
   their size is their font size. The overlay nevertheless draws a dashed rectangle around them, with no
   handles, because the rectangle cannot describe anything. The same is true of `cursor`, `blob`,
   `neonSun` and `isoCity`, whose size comes from their own parameters.
3. **The handles do the wrong thing.** A text's corner handles, if they existed, would resize a box that
   is not really there. A trend line's corner handles adjust a rectangle whose corners mean nothing —
   *"adjusting a trending line along 4 axes is crazy work."*

The fix is not to improve the box. It is to **stop giving every element a box**.

## 2. What this design is

Each element declares **how it is picked and what the creator can drag**, and the editor draws and
handles exactly that. The editor never asks what kind of element it is looking at — it reads the
declaration, the same way it already reads a component's transport actions and inspector panel.

The behaviour follows what drawing and video editors do, because they are the same problem and their
solutions are the ones creators already have in their fingers:

- **After Effects** — a text box is the master; with auto-fit on, the type scales to fill it.
- **CapCut / Canva** — the content is the master; the box hugs it, and a corner handle scales the type.
- **Illustrator / Figma** — a path is its points, not a bounding box; you grab the stroke, not a rectangle
  around it.

This design takes the **content-driven** model (CapCut/Canva) for text, the **points** model for lines,
and keeps the honest box for the elements that genuinely are boxes.

**Not in scope: rotation.** Every editor has it, but rotation is a new prop on every element, a new
transform in every renderer and a new rule in the hit test — roughly double the size of this work, and
meaningless for a chart. It is recorded as a follow-up, not built here.

## 3. The contract

The component contract gains **one optional field**. A definition declares its own model:

```ts
/** How the editor picks an element and what the creator can drag. */
export interface ElementEditModel {
  /** How the canvas picks it. */
  pick: 'box' | 'segment' | 'point';
  /** The control points the overlay draws when it is selected. */
  handles: ElementHandle[];
}

export interface ElementHandle {
  /** Which point this is: a corner, a side, an endpoint, a level. */
  id: string;
  /** Where the handle sits, as a fraction of the element's region. */
  at: { x: number; y: number };
  /** What dragging it changes. */
  effect: 'scale' | 'font' | 'wrap' | 'point' | 'level';
  /** The props it writes, for the prop-driven effects. */
  props?: string[];
}
```

`pick` and the handles come from the same declaration, so an element cannot claim one shape for picking
and another for editing.

**A handle does not declare where it is; the shell derives it.** A `scale`, `font` or `wrap` handle is a
corner or a side of the element's region; a `point` or `level` handle is `props.points[id]`; a `move`
handle is the element's own anchor. That matters for a line: a trend line's two ends are **not** at the
corners of its bounding box, so a handle placed as a fraction of the region could not name them. The
endpoints are the element's own points, and the shell draws them where the points are.

The rule the product already follows — *components declare, the shell executes* — is what makes this
possible: the editor's overlay and hit test read the declaration and never name an element kind. The
three kinds of `pick` map onto the three shapes an element can have, and the five `effect`s map onto the
five things a drag can change.

## 4. Every element, reviewed

34 elements — the 26 the registry holds plus the eight drawings. Six groups, by what the creator does
with them.

### Group 1 — the box is the truth: 4 corner handles

`shape` `image` `video` `gif` `html` `wave` `synthGrid` `ridge` `commitGraph` `particles` `sunMoon`
`skyCycle` `rectangle` `blob` `cursor` `neonSun` `isoCity` `candlestickChart`

The element is a rectangle and the content fills it. The corners scale it; the opposite corner stays put,
so the box grows from a fixed point. For the **chart**, the corners scale its **outer box**; the plot has no
props of its own yet, so driving the plot itself is deferred.

`blob`, `cursor` and `neonSun` carry a `size` rather than a width and a height, so their corner handles
scale that parameter. `isoCity` scales `gridSize` and `tileSize`.

`particles`, `sunMoon` and `skyCycle` are sized exactly to the canvas, so their box **is** the frame and
their corners sit in the frame's corners. They keep the box because they can still be scaled — by their
own `width` and `height` — and the corner handles move those.

### Group 2 — the content is the truth: 4 corner handles + 4 side handles

`text` `counter` `emoji` `nodeTrail` `remocnMarkerHighlight` `remocnSoftBlurIn` `remocnTypewriter`

The box is **derived from the rendered content**: its width is the longest line, its height is the
wrapped height. It is a measurement, not a stored number.

- A **corner** handle scales the **font size**, proportionally to the pointer's movement. The box re-hugs
  the text afterwards.
- A **side** handle sets the **wrap width**. The text rewraps and the box re-hugs.

The font size stays the one number the creator types, in the inspector. It is the single master; the box
follows it. The wrap width is optional — with none set, the box is exactly as wide as the text.

The readout above the box shows the **font size**, not the width and height, because the width and
height are measurements.

### Group 3 — one anchor

`horizontalLine` `verticalLine`

The element is a point. Dragging it moves the element. A horizontal line keeps its length; a vertical
line keeps its length. A text label carries its text.

### Group 4 — two endpoints: `trendline` `arrow`

The line **is** its two ends. There is no rectangle around it.

- An **endpoint** handle moves that end; the other end stays where it is.
- Dragging the **line's body** — anywhere on it that is not an endpoint — shifts both ends, moving the
  whole line.
- The **high/low line** keeps its ends on one vertical: dragging an end changes its length, not its angle.

### Group 5 — a box with three levels: `position`

The tool is a box with an entry, a stop and a target inside it. Each level is its own handle; dragging
one moves that level; dragging the body moves the whole tool.

### Group 6 — not on the canvas: `audio` `background`

They are not drawn on the canvas. They are selected in the timeline only.

## 5. Picking

The rule changes from *"the topmost clip whose box contains the pointer"* to *"the topmost clip whose
**shape** contains the pointer"*.

| Shape | Picked when | Tolerance |
|---|---|---|
| `box` | the pointer is inside the box | none — the box is the shape |
| `segment` | the pointer is within a short distance of the line | 6 **screen** pixels |
| `point` | the pointer is within a short distance of the point | 8 screen pixels |

**The tolerance is in screen pixels.** The swing path's grab radius today is 10 *composition* pixels, so
at 25% zoom it is 2.5 screen pixels — the handle cannot be grabbed — and at 400% it is 40 screen pixels
— the wrong thing is grabbed. A screen-space tolerance feels the same at every zoom, which is what every
drawing tool does.

The endpoints of a line get a **larger radius than its body** — 10 screen pixels against the line's 6.
They are the handles, and a two-pixel stroke should not have to be hit to get them.

**Topmost still wins.** The layer order is unchanged: tracks top-down, and within a track the later clip
is on top. A line crossing a candle is picked where it lies over the candle, and the candle is picked
everywhere else. What changes is that a line no longer owns the rectangle it happens to span.

The **control points of the selected element take precedence over its body**: pressing on a trend line's
endpoint gives the endpoint, not the line.

A consequence to name: a line is pickable within the tolerance **where it is not drawn**. That is
deliberate and universal, but it means two crossing lines are separated by the layer order.

## 6. The overlay and the transforms

**One overlay, not two.** Today the selection overlay draws a dashed box with square corner handles, and
the drawings have a second layer of green circle handles — so a trend line currently shows both. The
overlay becomes one layer that draws whatever control points the element declares, in one style.

| Kind | What is drawn | What a handle does |
|---|---|---|
| Group 1 | the dashed rectangle, 4 corner squares, the `W × H` readout | corner: scales the element from a fixed opposite corner |
| Group 2 | the derived rectangle, 4 corner squares, 4 side squares, the font-size readout | corner: scales the **font size**; side: sets the **wrap width** |
| Group 3 | one handle | moves the element |
| Group 4 | **no rectangle** — the two endpoint handles, and the line itself lifts in colour | endpoint: moves that end; body: shifts the whole line |
| Group 5 | the box and three level handles | moves one level; body: moves the tool |

**A text's corner handle scales the font from the centre.** It cannot scale the box, because the box is
derived from the text — so the drag's ratio applies to the font size and the box re-hugs afterwards.

**A text's side handle sets a wrap width, not a stored width.** The box's width is
`min(the content's natural width, the wrap width you set)`, so a short single line hugs its text and a
long one wraps at your width.

**Dragging a line's body shifts both endpoints.** Only the endpoint handles change a line's shape.

## 5a. The authoring sessions are not edit models

Two overlays on the canvas are **not** an element's control points, and this design does not change them:

- The **swing path's anchors** are an authoring session — the creator is drawing a path on a chart, and
  the anchors belong to that session, not to a clip's edit model. They keep their own overlay and their
  own hit test.
- The **drawing path's stroke** is the same: a session that becomes an effect when it is finished.

They are worth naming because the editor currently has **three** overlays — the selection box, the
drawings' points, and the swing path's anchors — and this design merges the first two. The authoring
sessions stay separate, because they answer a different question: *what are you drawing right now?*

## 6a. Several elements selected

The editor already allows a multi-selection, and the new model has to say what the overlay shows and
what a drag means, because the handles are now per-element.

- **Every selected element shows its own control points**, drawn in the one style. A selection of three
  trend lines shows six endpoints, not three boxes.
- **A handle drag acts on the element it belongs to.** You grab one line's endpoint and that endpoint
  moves; the other lines do not. The element you grabbed decides, which is what every editor does.
- **A body drag still moves the whole selection.** Dragging the body of one of three selected elements
  moves all three, exactly as it does today — the grouping and the multi-selection are separate
  mechanisms, and grouping is what makes a set move as one.
- **A handle drag moves only its own element, even when the selection is grouped.** A grouped set that
  moves together when you drag its body would separate if you dragged one member's handle. That is
  intended: the handle is a precise edit to one element, and the group is a coarse one.

## 7. The data model

| Drawing | Now (v3) | After (v4) |
|---|---|---|
| `trendline` `arrow` | `{x, y, width, height, points:{start,end} as fractions}` | `{points:{start:{x,y}, end:{x,y}}}` — absolute, no box |
| `horizontalLine` | `{x, y, width, height}` | `{x, y, width}` — the width is its length |
| `verticalLine` | `{x, y, width, height}` | `{x, y, height}` |
| `textLabel` | `{x, y, width, height, points:{at}, label}` | becomes a `text`, carrying what it said |
| `rectangle` | `{x, y, width, height}` | unchanged |
| `position` | `{x, y, width, height, points:{entry,stop,target} as fractions}` | the same, with the points absolute |

**The base elements do not change at all**, except that the **text-like elements** — group 2 — gain an
optional `maxWidth` for wrapping.

Two consequences, both simplifications:

- **A trend line has no `x`, `y`, `width` or `height`.** Its position *is* its two endpoints, and its
  region is derived from them. Its definition therefore no longer declares `x`/`y` params, and the
  inspector's POSITION section does not appear for it — a trend line is moved by dragging it, which is
  what every editor does.
- **The element's region is derived for the endpoint kinds**, through the same `bounds` mechanism the box
  kinds already use for their own size.

## 8. The migration

**v3 → v4**, chained with the existing v1 → v2 → v3 in one pass.

| Drawing | Migration |
|---|---|
| `trendline` `arrow` | the box's centre and the fractional points become absolute points; `x`, `y`, `width`, `height` are dropped |
| `horizontalLine` | the box's centre becomes `x`/`y`; `width` stays as the length; `height` is dropped |
| `verticalLine` | the same, with `height` as the length |
| `textLabel` | becomes a `text`; its point becomes the text's place and its text is carried across |
| `position` | the three fractional points become absolute; the box stays |
| everything else | untouched |

Non-destructive and idempotent, like the migrations before it.

## 9. The awkward cases

- **A text's box is measured from the rendered text.** The composition stamps each clip's id onto its
  rendered root and the editor measures that. The cost is one attribute in one place — the composition's
  clip wrapper — and it means the **font must be loaded** for the measurement to be right. Before the font
  arrives the box is an estimate and then settles; it does not stay wrong.
- **Two endpoints at the same spot** (a zero-length line): the region collapses to a point, picking falls
  back to the point tolerance, and the two handles sit on top of each other. No crash and no division by
  zero — the tolerance is in absolute pixels, never a ratio.
- **A text with no content**: the measured box is empty, so the overlay falls back to a minimum size
  rather than drawing a zero-height rectangle.
- **A drawing whose points are missing** (hand-authored): the migration leaves it alone, the definition's
  defaults fill in, and it renders as the defaults say.

## 10. Testing

The rule this repo has used throughout: **anything that can be pure goes in a package, so it can be
tested.**

| Surface | Where | What it pins |
|---|---|---|
| the edit model | `packages/core` (the contract) | every registered element declares one; `pick` and the handles agree |
| the pick geometry | `packages/editor` — a pure `hitsElement(shape, region, point, tolerance)` | a segment is hit near the line and nowhere else; a box is hit inside it; the tolerance is in screen pixels |
| the region derivation | `packages/editor` | a trend line's region is the bounding box of its endpoints; a zero-length line does not divide by zero |
| the transform maths | `packages/editor` — pure functions the shell calls | a corner drag scales the font; a side drag sets the wrap width; an endpoint drag moves one end and leaves the other; the high/low line stays vertical |
| the migration | `packages/components` | the points become absolute; the boxes drop; it is idempotent and non-destructive; a drawing with missing points is left alone |

**Not testable here, and not to be pretended otherwise:** the overlay's rendering, the pointer wiring and
the text measurement live in `apps/studio`, which has **no test runner**. Those are exercised in the
browser and reported as observed.

**The regression guard:** the render gate's `Main` fixture — a v1 document with **no drawings** — must stay
**byte-identical**. The new migration only touches drawings, so for that fixture it is a no-op. The
`AuthoredPath` fixture does carry drawings, so its stills **will** change, because those drawings become
endpoint-based elements. That is expected and honest, exactly as when the drawings became free elements.

## 11. The artefacts

- **ADR-010 — the element edit model.** The contract gains a field; the editor stops deriving a model from
  the props and starts reading the component's declaration.
- **The design spec** — this document.
- **The implementation plan** — the slices, in dependency order.

## 12. What this design does not do

- **No rotation.** A follow-up, recorded in the roadmap.
- **No new component types.** Every element that exists keeps its name and its meaning.
- **No change to the chart's own model.** Panes, relations, holds, the zoom track and the provenance
  record are untouched.
- **No change to the rendering path for a document with no drawings.** The `Main` fixture's bytes are the
  guard.
