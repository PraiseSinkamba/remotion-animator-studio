# ADR-009 — Drawings are independent elements, not market-anchored clips

**Status:** Proposed for owner approval; implementation is not authorised by this document.
**Date:** 2026-11-01
**Depends on:** [ADR-003 — Component System](ADR-003-COMPONENT-SYSTEM.md) (one object protocol),
[ADR-007 — The chart element model, project schema version 2 and the datasource seam](ADR-007-CHART-ELEMENT-MODEL.md)
(the market-anchor drawing decision this record reverses),
[Technical Architecture](../architecture/TECHNICAL_ARCHITECTURE.md).
**Described in:** [Independent drawing elements](../superpowers/specs/2026-11-01-independent-drawing-elements-design.md)
§3, the design this decision records.
**Companion:** [Implementation plan](../superpowers/plans/2026-11-01-independent-drawing-elements.md).
**Decision owners:** Product owner for the six owner decisions below; implementation lead for the
rest.

## Context

ADR-007 recorded the decision that a drawing is a clip holding **market anchors**: "a drawing names
the market, never a pixel" (ADR-007 §Decision, item 4). A drawing's props carried `chartClipId`,
`paneId`, `anchors`, and chart-relative `in`/`out` frames
(`packages/components/src/trading/drawings/definitions.ts:234` — `baseDefaults()`). Its `evaluate`
step looked the chart clip up by `chartClipId`, found the pane by `paneId`, resolved the anchors
against that pane's bars and live geometry, and returned `visible: false` whenever an anchor was
unresolved (`packages/components/src/trading/drawings/definitions.ts:100` — `evaluateDrawing`).
The adapters then drew inside the **chart's** box using the chart's own geometry
(`packages/components/src/trading/drawings/adapters.tsx`).

That model is coherent and it was the right call at the time. It is also, in practice, unusable.
Three facts about the code as it stands today:

1. **A drawing cannot exist without a chart.** The tool rail shows the drawing tools only when the
   selected clip is a chart (`apps/studio/src/components/ToolRail.tsx:22`, `:92`), and both placement
   paths refuse to place a drawing that has no chart under the pointer: the tool-rail path calls
   `resolveDrawingTarget` (`apps/studio/src/components/PreviewPanel.tsx:267`, `:281`) and the
   library drop path posts the notice **"A drawing needs a chart — drop it on one, or select a
   chart and use the tool rail."** (`apps/studio/src/components/PreviewPanel.tsx:541`).
2. **A drawing's own timing is not its own.** `addDrawing` gives the new clip the chart's
   `from` and `durationInFrames` and its chart-relative `in`/`out`, and puts the clip **on the
   chart's own track** (`packages/editor/src/store.ts:918` — `addDrawing`). The drawing is a child
   of the chart in the timeline, not a peer.
3. **A drawing appears only once the market reaches its bar.** Because the anchors resolve against
   the pane's revealed bars, an unresolved anchor renders nothing. A creator who places a price
   line on a bar that has not been revealed yet sees nothing at all, and has to scrub forward to
   find out whether the tool worked.

The result is that a drawing is not an ordinary object in the editor. It is a decoration on a chart
that only exists while the chart is on screen, at the chart's scale, on the chart's track, during
the chart's frame range.

### What is wrong with the market-anchored model

The model ties a drawing's *content* to a chart's *scale*. That coupling is the problem, and it is
not a bug in the implementation:

- A creator who wants a horizontal line across the composition — a level, a threshold, a caption
  band — must first create a chart, select it, arm a tool and click inside the chart's plot area.
- A creator who wants the same line in a different video, or in a video with no chart at all,
  cannot have it. The line is not an element; it is a chart annotation.
- A creator who resizes or re-scales the chart cannot keep the drawing where they put it, because
  the drawing's position is derived from the chart's scale, not from its own.

The owner has decided that the drawing tools become **fully independent elements**: a price line, a
high/low line, a vertical line, a trendline, a price zone, a text label, an arrow and a position
tool are ordinary elements with their own box in composition space, their own time range on the
timeline, and no chart requirement of any kind. **Independent means independent**: a drawing never
reads a chart's scale, bars or pane — not even for one moment at placement time. There is no
snapping to a chart.

### What the numbers are

The numbers a drawing carries are the creator's own: a price line's price, the position tool's
entry / stop / target. They are authored values, typed or set by the creator. They are not derived
from a series, and they are not market truth. This is a deliberate change of meaning, and it has a
consequence that must be said plainly rather than hidden: **with no chart scale, an authored price
cannot position itself against a market.** The number is a creator-authored caption; the element's
box places the geometry. A price line says "4200" and sits where the creator put it.

### What is kept

The reversal is not a rejection of ADR-007. Three things from it stand:

- **A drawing is still a clip with its own frame interval.** It is a `Clip` on a `Track` in a
  `Project` (`packages/core/src/schemas.ts:93`), with its own `from` and `durationInFrames`, its own
  effects stack, its own selection, its own undo step.
- **The chart keeps everything it earned.** Its panes, its relations, its holds, its zoom and its
  provenance are untouched by this decision.
- **The export's provenance record still exists** (`packages/core/src/provenance.ts:87` —
  `buildProvenance`). It gains an annotations section rather than losing its series and simulation
  sections.

## Decision

1. **A drawing is an ordinary element with its own box.** Every drawing clip carries `x`, `y`
   (the box centre, in composition space — the same convention every other element uses),
   `width`, `height`, `opacity` and `style`. The clip's own `from` and `durationInFrames` are its
   lifecycle. A drawing renders whether or not a chart exists anywhere in the project.

2. **The market-anchored props are dropped.** `chartClipId`, `paneId`, `anchors`, and the
   chart-relative `in` / `out` are removed from the drawing props, and the drawing definitions lose
   their `evaluate` step (`packages/components/src/trading/drawings/definitions.ts:265`) and their
   chart lookup (`:100`). `anchors.ts` goes with them, and `MarketAnchor`
   (`packages/core/src/elements.ts:171`) and the unused `DrawingSpec` (`:193`) are retired. The
   migration is a clean cutover: no shim, no alias, no legacy read path.

3. **A drawing's geometry is normalised inside its own box.** `DrawingPoint = { x, y }` as 0..1
   fractions of the element's own box, origin top-left, y down. Points scale with the box, so
   resizing a drawing scales its shape rather than stretching one point away from the others.

4. **The per-kind shape is fixed.**

   | Kind | Points inside the box | Authored numbers | Other |
   |---|---|---|---|
   | `priceLine` | none | `price` (one number) | horizontal rule at the box's vertical centre; the price is a caption at the rule's right end |
   | `highLowLine` | `top`, `bottom` | none | vertical segment at the box's horizontal centre |
   | `verticalLine` | `at` | none | vertical rule at `at.x`, full box height |
   | `trendline` | `start`, `end` | none | `trendline.ray` kept |
   | `priceZone` | `top`, `bottom` | none | filled band across the full box width |
   | `textLabel` | `at` | none | `label.text` kept |
   | `arrow` | `from`, `to` | none | — |
   | `position` | none | `entry`, `stop`, `target` | `position.direction`, `position.showRiskReward` kept |

   The zone loses `zone.extendRight`: `ComponentRenderContext` carries no composition size
   (`packages/core/src/contract.ts:22-34`), so a zone cannot know where "the right edge" is. The
   creator widens the box instead.

5. **The position tool's three numbers are the truth, and they place the levels.** `entry`,
   `stop` and `target` are authored values. Inside the box they map affinely over their own
   min/max — the highest at the top, the lowest at the bottom, the middle interpolated by value —
   which for a canonical long puts entry at `risk / (risk + reward)` up from the bottom, so the
   drawn geometry preserves the risk/reward ratio. When all three are equal the levels are spaced
   evenly by role. The risk/reward label is `|target − entry| / |entry − stop|`. The position tool
   never shows a profit-and-loss figure and never implies a broker fill (OB-006 stands).

6. **A new drawing is placed by a click, and its numbers are typed.** One click places the box for
   the single-click kinds; two clicks place the two points of the two-point kinds; the position
   tool takes one click and its three numbers are typed in the inspector, because three clicks
   *and* three typed numbers would be two sources of truth. The drawing's own frame range starts
   at the current frame and lasts about ninety frames, and the creator edits it in the timeline.

7. **A new drawing lands on a defined track.** The track immediately above the chart it was
   dropped on when there is one; otherwise the track of the selected clip; otherwise the first
   track. "Immediately above" is one step towards the top layer, because `tracks[0]` is the top
   layer (`packages/video/src/composition.tsx:172`); a chart already on the topmost track shares
   that track and the drawing is appended to it, so it renders above the chart.

8. **The drawing inspector shows the drawing.** Box (`x`, `y`, `width`, `height`), the authored
   number or numbers, the style, and the clip's own frame range. The chart-relative `in` and `out`
   disappear, including from the shared drawing parameters
   (`packages/components/src/trading/drawings/definitions.ts:227` — `COMMON_PARAMS`).

9. **The canvas gets a context menu.** Group and Ungroup, Duplicate, Copy, Paste, Delete, Rename,
   Bring to front, Send to back, Lock and Hide. Grouping already works
   (`packages/editor/src/store.ts:499`, `:515`) and is only surfaced here; the layer-order and
   lock/hide entries are new store work.

10. **Lock and hide generalise to every clip.** `setDrawingLocked` and `setDrawingHidden` become
    clip-level actions. A context menu that offers "Hide" for some elements and not others is
    worse than no menu at all. A hidden clip is not rendered; a locked clip is not selectable on
    the canvas but stays selectable on the timeline, where a lock badge is the way back in.

11. **Existing documents are migrated, not broken.** A document that holds today's chart-anchored
    drawings is converted to the new shape so that nothing the creator already made stops
    rendering. The migration keeps the authored **number** exactly and places the element using the
    chart's plot area and the chart's **full-series** price range. That is an approximation at the
    last frame, because a static migration cannot reproduce the scale a chart had at a particular
    frame; the migration says so in its own comment.

12. **The provenance record gains an annotations section.** Each drawing's kind and its
    creator-authored numbers are recorded as authored, not market-derived, alongside the existing
    series and simulation sections.

## Owner decisions

Six choices in this decision are the owner's. This ADR does not pick them silently; it records the
position taken and the alternative that stays open.

### The drawing's shape: a box, points inside it, and the creator's own numbers

- **Position:** every drawing is a box in composition space; a trendline and an arrow carry two
  points inside that box; the position tool carries three levels derived from three authored
  numbers; the price line carries one authored number; every drawing carries a style. The
  chart-relative `in` / `out` are gone, and the clip's own frame range is the lifecycle.
- **Why:** the drawing's timing is the timeline's job, and the timeline already has a frame range
  for every clip. Keeping a second, chart-relative range gave one object two clocks.
- **Alternative:** keep `in` / `out` as absolute frames rather than chart-relative ones. That is
  less disruptive but leaves a second way to say "when is this visible" that no other element has.
- **Decided by:** product owner.

### The migration's placement: keep the number, approximate the position

- **Position:** the authored number is preserved exactly. The element's placement is computed from
  the chart's plot area and the chart's full-series price range, and the migration's comment says
  plainly that this is an approximation at the last frame.
- **Why:** the authored number is the creator's own figure and must survive; the pixel position
  depended on a live scale that a static migration cannot reproduce, so an approximation that is
  stated is better than a silent wrongness.
- **Alternative:** keep the old chart-anchored renderer alive behind a flag for migrated documents.
  That preserves the pixels exactly and keeps two drawing models in the product forever.
- **Decided by:** product owner.

### The default track for a new drawing

- **Position:** the track immediately above the chart it was dropped on when there is one;
  otherwise the track of the selected clip; otherwise the first track.
- **Why:** a drawing dropped on a chart should sit above that chart by default, because a drawing
  under a chart is invisible. Everything else falls back to where the creator's attention already
  is.
- **Alternative:** always put a new drawing on the first track. Simpler, but a drawing then jumps
  away from the chart it was dropped on.
- **Decided by:** product owner.

### The drawing inspector

- **Position:** box, authored number(s), style, and the clip's own frame range.
- **Why:** those are the four things a drawing has. The chart-relative range is gone because the
  range is no longer the drawing's.
- **Alternative:** a drawing inspector that also shows the market context it used to be anchored
  to. That context no longer exists.
- **Decided by:** product owner.

### The canvas context menu

- **Position:** Group / Ungroup, Duplicate, Copy, Paste, Delete, Rename, Bring to front, Send to
  back, Lock, Hide.
- **Why:** grouping, duplication, copy, paste and delete exist in the store and in the keyboard
  map but are hard to find; a canvas context menu is where a creator looks for them. Layer order
  and lock / hide are the two things a canvas menu can offer that the timeline cannot.
- **Alternative:** extend the timeline's own context menu instead of the canvas. The timeline row
  is a narrower target and the drawing tools live on the canvas.
- **Decided by:** product owner.

### Lock and hide generalise

- **Position:** both become actions on every clip, not on drawings only.
- **Why:** the context menu offers them; a menu that offers "Hide" for some elements and not
  others is worse than no menu.
- **Alternative:** keep them drawing-only and label the menu items accordingly. That is honest
  about the current implementation and dishonest about the intent.
- **Decided by:** product owner.

## Alternatives considered

| Approach | Advantage | Problem | Decision |
|---|---|---|---|
| Keep drawings market-anchored and add a second, independent drawing kind | Nothing breaks | Two drawing models, two inspectors, two sets of tools, and the creator has to learn which is which | Reject |
| Anchor a drawing to a chart but let it hold its own pixels as well | A chart-relative drawing could be frozen | The anchor and the pixels disagree the moment the chart moves; the drawing is still unusable without a chart | Reject |
| Let a drawing read a chart if one happens to exist, and fall back to its own box otherwise | One kind, two behaviours | The behaviour of a drawing would depend on what else is in the project; the same document would render differently after an unrelated edit | Reject |
| Make drawings children of the chart clip's props rather than clips | The chart's collection lives in one place | A child has no frame range of its own, no track of its own and no layer order — the three things the owner asked for | Reject |
| Snap a drawing's points to the nearest bar or price when a chart is under the pointer | Convenient | Snapping is a market coupling; independence means the drawing never reads the chart, not even for a moment at placement | Reject |
| Resolve the price scale lazily at render time from whatever chart is nearest | A price line would sit on its price | It is the market-anchored model again, with a worse failure mode: the line moves when an unrelated chart is added | Reject |
| Give every drawing a private price scale of its own | A price line could position itself | A scale with no market behind it is a fiction; the number would mean nothing measurable | Reject |
| Drop the price line's authored number and leave only a rule | Fewer props | The creator loses the one thing the price line was for: a stated level | Reject |
| Keep `zone.extendRight` | A zone can run to the chart's edge | `ComponentRenderContext` has no composition size; a zone cannot know where the edge is | Reject — the box is the extent |
| Generalise lock / hide to every clip | One menu, one meaning | It is net-new behaviour rather than a rename, and needs a canvas-side pick filter and a timeline badge | **Select** |
| Keep lock / hide drawing-only | Smaller diff | A context menu that hides some elements and not others | Reject |
| A canvas context menu | Where the creator's pointer already is | Needs a Radix wrapper in `packages/ui` (no new dependency) and a rename path that is not `window.prompt` | **Select** |
| A timeline context menu | The timeline is where objects live | Narrower target, and the drawing tools are a canvas affair | Reject |

## What this changes

- **The persisted document.** Project schema version 3. A drawing's props become
  `{ x, y, width, height, opacity, style, points?, price?, label?, trendline?, position? }`; the
  drawing definitions' `propsVersion` becomes 2; the migration gains a v2 → v3 step
  (`packages/components/src/project-migrate.ts:22` — `CURRENT_PROJECT_SCHEMA_VERSION`).
- **The drawing renderers.** The eight adapters draw inside their own element's box instead of
  inside the chart's box; the definitions lose their `evaluate` step and their chart lookup;
  `packages/components/src/trading/drawings/anchors.ts` is deleted.
- **`packages/core`.** `MarketAnchor` and `DrawingSpec` are retired; new independent-drawing
  types and a `validateDrawingProps` validator arrive; the provenance record gains an annotations
  section. The package keeps its no-React, no-Remotion, no-storage-import rule.
- **The editor store.** `addDrawing` produces an independent clip with its own range and track; the
  drawing-anchor helpers and `resolveDrawingTarget` go; `setDrawingLocked` / `setDrawingHidden`
  become clip-level actions; layer-order actions arrive.
- **The editor surfaces.** The tool rail offers the drawing tools without a chart selected; the
  canvas places a drawing at the drop point; the drawing inspector shows the new fields; the
  canvas gains a context menu; the library gains a separate Drawings group.

## What this does not change

- **One object graph.** A scene object is still a `Clip` on a `Track` in a `Project`. No new
  top-level concept is introduced.
- **The registry's rules.** The `type` is still the persisted stable id; the eight drawing kinds
  are not renamed, renumbered or reused; the component registry still decides what appears in the
  library.
- **The chart's own model.** Panes, relations, holds, zoom and provenance are untouched.
- **The preview / export parity rule.** The render path is unchanged in shape: one pure evaluation
  step, one render adapter, one composition. A drawing that evaluates to nothing simply draws
  nothing.
- **The local-first invariant.** No network call, login or server is needed to edit, save, preview
  or export.
- **The chart API.** `chartPointToAnchor` and `chartAnchorToPoint`
  (`packages/components/src/trading/chart.tsx:280`, `:304`) stay — they are chart API and are
  heavily tested.
- **The render gate.** `node scripts/verify-r1.mjs` remains the proof that a change reached the
  video path.

## Consequences

**Good:** a drawing is an element, so it can be placed, timed, layered, grouped, locked, hidden,
copied and exported like anything else; the eight tools work in a project with no chart at all; a
creator's authored numbers survive into the export as authored numbers; the timeline becomes the
single place a drawing's life is described.

**Costs:** a schema migration that must not change a single rendered frame of an existing
project; an approximation in that migration's placement that is stated rather than hidden; the loss
of the zone's `extendRight` and of the price zone's authored edge prices; the loss of the
market-anchored guarantee, which was a real guarantee and is now simply not offered; and an
honest limit that the product must state in the interface — an authored price is a caption, not a
position on a market.

**Limits accepted for now:** a price line's number cannot place the rule against a market; the
position tool's levels are derived from the creator's own three numbers and know nothing about a
market; a drawing is not tied to any chart, so moving or deleting a chart leaves the drawing
exactly where it was, which is the point; the context menu is a canvas surface only.

## Exit strategies

| Introduced thing | How it leaves |
|---|---|
| The normalised point model | A property of the drawing props. A future version that wants chart-relative behaviour reintroduces a prop; the box and the numbers stay. |
| `validateDrawingProps` | A validator in `packages/core/src/validation.ts`. Removing it is a deletion. |
| The provenance annotations section | A field on `ProvenanceRecord`. A future version drops it the way the record drops fields. |
| The canvas context menu | A surface over existing store actions. Closing it removes the surface, not the actions. |
| Clip-level lock and hide | Two fields that already exist on `Clip` (`packages/core/src/schemas.ts:107`, `:109`). The change is in where they are honoured. |
