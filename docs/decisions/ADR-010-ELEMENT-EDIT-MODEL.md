# ADR-010 — The element edit model: every element declares how it is picked and edited

**Status:** Proposed for owner approval; implementation is not authorised by this document.
**Date:** 2026-11-01
**Depends on:** [ADR-003 — Component System](ADR-003-COMPONENT-SYSTEM.md) (one object protocol),
[ADR-009 — Drawings are independent elements](ADR-009-INDEPENDENT-DRAWING-ELEMENTS.md) (the drawings
became ordinary elements, which made their selection model's flaws visible),
[Technical Architecture](../architecture/TECHNICAL_ARCHITECTURE.md).
**Described in:** [The element edit model](../superpowers/specs/2026-11-01-chart-studio-element-edit-model-design.md),
the design this decision records.
**Companion:** [Implementation plan](../superpowers/plans/2026-11-01-chart-studio-element-edit-model.md).
**Decision owners:** Product owner for the owner decisions below; implementation lead for the rest.

## Context

The editor gave every element the same selection: an axis-aligned dashed rectangle with four corner
resize handles, drawn from the element's `x`, `y`, `width` and `height`. The canvas picked an element the
same way — *the topmost clip whose **box** contains the pointer*
(`apps/studio/src/components/canvas-hit-test.ts`).

Three facts about the code as it stood made that model untenable:

1. **A line's box swallowed the canvas.** A trend line's region is the bounding box of its two ends. On
   a chart that is hundreds of pixels across, so the line could not be selected without also selecting
   everything underneath it, and its corner handles adjusted a rectangle whose corners mean nothing.
2. **Some elements have no box at all.** `text`, `counter` and `emoji` carry **no width and no height** —
   their size is their font size — and `cursor`, `blob`, `neonSun` and `isoCity` carry a `size` or a
   `gridSize` instead. The overlay drew a dashed rectangle around them anyway, with no handles, describing
   nothing.
3. **The overlay was two overlays.** The selection overlay drew the box and its corner handles; the
   drawings had a second layer of green circle handles. A trend line showed both at once.

ADR-009 had already made the drawings independent elements — their own box, their own frame range, their
own geometry. That is what exposed the selection model: an element that is genuinely independent, with
genuinely its own shape, was still being drawn and picked as if it were a rectangle.

The editors solved this problem long ago, and their solutions are the ones creators already have in
their fingers: a path is its points, not a bounding box (Illustrator, Figma); a text box hugs its
content and a corner handle scales the type (CapCut, Canva); you grab the stroke, not a rectangle
around it.

## Decision

1. **Every component definition may declare an `edit` model**, and every element that can be picked on
   the canvas declares one:

   ```ts
   interface ElementEditModel {
     pick: 'box' | 'segment' | 'point';
     handles: ElementHandle[];
   }
   ```

   The editor reads the declaration and **never asks what kind of element it is looking at**. This
   follows the rule the product already applies to transport actions and inspector panels: *components
   declare, the shell executes*.

   A handle does not declare where it is; the shell derives it. A `scale`, `font` or `wrap` handle is a
   corner or a side of the element's region; a `point` or `level` handle is `props.points[id]`. A trend
   line's two ends are **not** at the corners of its bounding box, so a handle placed as a fraction of
   the region could not name them — the endpoints are the element's own points.

2. **The pick shape and the handles come from one declaration**, so an element cannot claim one shape
   for picking and another for editing.

3. **Picking is by shape, not by box.** A `box` element is picked anywhere inside it; a `segment` is
   picked within 6 **screen** pixels of the line; a `point` within 8 screen pixels. The tolerance is in
   screen pixels so it feels the same at every zoom — the swing path's 10 composition pixels is 2.5
   screen pixels at 25% zoom, which cannot be grabbed. A line's **endpoints** get 10 screen pixels
   against the line's 6: they are the handles, and a two-pixel stroke should not have to be hit.

4. **The layer order is unchanged.** Tracks top-down, and within a track the later clip is on top. A line
   crossing a candle is picked where it lies over the candle.

5. **The overlay is one layer.** It draws the control points the element declares, in one style. The
   second handle layer goes.

6. **A text's box is derived from the rendered content** — width is the longest line, height is the
   wrapped height — and the **font size is the single master**. A corner handle scales the font size; a
   side handle sets the wrap width. The creator still types a font size; the box follows.

7. **A line is its endpoints.** A trend line, an arrow and a high/low line have two absolute points and
   no box. Dragging an endpoint moves that end and leaves the other; dragging the line's body shifts
   both. The high/low line's ends stay on one vertical.

8. **The elements that genuinely are boxes keep their box**: the corners scale them from a fixed
   opposite corner, and the chart's corners scale its **outer box**; the plot has no props of its own yet, so driving the plot is deferred.

9. **Existing rotation and projected effects use the shared frame pose.** The 2026-11-02 repair adds forward/inverse planar projection for picking and manipulation without adding universal rotation props. A new universal authored rotation control remains a follow-up.

## Consequences

- A creator can select a trend line without swallowing the canvas, and can drag one end of it.
- A text's selection rectangle finally describes the text, and its corner handle changes the type size
  rather than resizing a box that does not exist.
- The editor has **no per-element-kind branches**. A new element declares its model and the shell is
  unchanged — the same property the transport actions have.
- **The inspector's width and height fields disappear for a text.** Its box is a measurement, not a number
  the creator sets. What it shows instead is the font size and the wrap width. This is the CapCut
  behaviour, and it is a visible change.
- **The text's box depends on the font being loaded.** The measurement is an estimate until the font
  arrives and then settles.
- **Project schema version 4.** The endpoint drawings lose their box and their points become absolute;
  the single-point drawings lose their unused dimension. The migration is non-destructive and idempotent.
- The `Main` render fixture — a v1 document with no drawings — stays **byte-identical**, because the
  migration is a no-op for a document with no drawings.

## Alternatives considered

| Alternative | Why not |
|---|---|
| **Derive the model from the props** — an element with points shows points, one with a width and a height shows corners | It cannot express the cases that differ from the default (the chart's handles drive its plot), and it makes the shape of the model implicit. The declaration is worth the one field. |
| **A switch over the element kinds in the shell** | The shell would name every component kind, which is the thing this product's architecture exists to avoid, and every new kind would mean editing the shell. |
| **Rotation in the same change** | Roughly double the work, and meaningless for a chart. Recorded as a follow-up instead. |
| **Keep the box for every element and add the points on top** | That is what the editor has now, and it is the complaint: two overlays, a box that describes nothing, and handles that adjust the wrong thing. |

## Exit strategy

The 2026-11-02 repair adds component-owned geometry, explicit coordinate/resize capabilities,
shared frame pose (including existing projected effects), content-only local measurements,
strict lifetime/lock gating and validated mutation boundaries. Scalar objects resize uniformly;
IsoCity corners change tileSize while gridSize remains topology. Content wrap grips are east/west
only where supported. Runtime validation and safe static HTML are defined by the
[current component contract](../spec/COMPONENT_CONTRACT.md#repair-contract-2026-11-02).
Audio/background/transition render modes are explicitly excluded from box fallback. Registration
rejects duplicate IDs and malformed handles; removing metadata does not remove a content object
from picking. This supersedes the original rotation exclusion for already-rendered effects.

The `edit` field is optional. An element that declares none keeps the current behaviour — the shell
falls back to the box model — so the contract can be rolled back by dropping the field and the shell's
branch, and any element can be moved back to the box model by removing its declaration.

## Accepted follow-up — purpose handles and layout placement, 2026-11-02

The owner-approved [position and line design](../superpowers/specs/2026-11-02-position-and-line-handles-design.md)
supersedes the original guide/position details above. Position props v4 has an explicit left paint
edge and level-derived vertical bounds, independently of its stable authored x/y pivot. It has
Target/Stop square grips, Entry/Width circle grips, and no corners. Entry changes entry.y only
with TP/SL fixed; Width changes width with left fixed; body movement translates all real geometry.
Horizontal/vertical guides span the actual composition, pick by their stroke, and expose one
center grip with the same y-only/x-only constraint as body movement. Segments keep two endpoints
and rectangles keep four corners.

Generic declarations now include composition context, optional layout `placement`, `moveAxis`,
translated scalar coordinates, scalar `width` handles and grip appearance/label metadata. The
compositor and overlay consume those declarations without shell kind dispatch. Legacy position
props migrate after absolute conversion, preserving pivot/levels/extensions and deriving left
from the old centered width. Project schema and SQLite schema remain unchanged. The normative
[component contract](../spec/COMPONENT_CONTRACT.md) records the current API.
