# ADR-009 — Drawings are independent elements in a TradingView vocabulary, not market-anchored clips

**Status:** Proposed for owner approval; implementation is not authorised by this document.
**Date:** 2026-11-01
**Depends on:** [ADR-003 — Component System](ADR-003-COMPONENT-SYSTEM.md) (one object protocol),
[ADR-007 — The chart element model, project schema version 2 and the datasource seam](ADR-007-CHART-ELEMENT-MODEL.md)
(the market-anchor drawing decision this record reverses),
[Technical Architecture](../architecture/TECHNICAL_ARCHITECTURE.md).
**Described in:** [Independent drawing elements](../superpowers/specs/2026-11-01-independent-drawing-elements-design.md)
§3, the design this decision records.
**Companion:** [Implementation plan](../superpowers/plans/2026-11-01-independent-drawing-elements.md).
**Decision owners:** Product owner for the seven owner decisions below — the six the owner set when
the drawings became independent, and the vocabulary decision that followed from them; implementation
lead for the rest.

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

The owner has decided that the drawing tools become **fully independent elements**: a horizontal
line, a vertical line, a trend line, a high and low line, a rectangle, a text label, an arrow and a
long/short position tool are ordinary elements with their own box in composition space, their own
time range on the timeline, and no chart requirement of any kind. **Independent means independent**: a drawing never
reads a chart's scale, bars or pane — not even for one moment at placement time. There is no
snapping to a chart.

### What the vocabulary is

The owner has set the drawing set by reference to **TradingView**: "Think of a trading chart like
TradingView. There is no price line. There are trend lines that have two points I can control and
angles as I please, a horizontal and vertical line. Price line, high & low line, price zone is
just a rectangle, a position tool — think TradingView."

Two consequences follow, and they are the reason the vocabulary is what it is:

- **There is no price line and no price zone.** A horizontal line carries no price, and a zone is
  a rectangle. The names `priceLine` and `priceZone` would be false labels: they would claim a
  market meaning that the element does not have. This product's rule is that a label must not
  claim something the data does not support. So the two kinds are **renamed** — `priceLine`
  becomes `horizontalLine`, `priceZone` becomes `rectangle` — and the v2 → v3 migration maps the
  old element types to the new ones.
- **Every drawing is pure geometry.** Nothing in the drawing set carries a market value, because
  nothing in it reads a market. There are **no authored numbers**. The horizontal line has no
  price. The rectangle has no edge prices and no `extendRight`. The position tool's three levels
  are **positions inside its own box**, dragged by the creator, and the ratio it shows is a fact
  about the drawn geometry.

The vocabulary change is a **consequence** of the reversal of ADR-007, not a separate idea. A
drawing that no longer reads a chart cannot carry a chart's numbers, and a chart's numbers are
exactly what `priceLine` and `priceZone` were named after.

What the creator gets instead of numbers is a **caption**: a short string the creator types, drawn
beside the shape. TradingView labels its lines the same way. The migration moves a v2 price line's
price into its caption, so the number is not lost — it becomes the creator's own figure ✓. The text
label tool stays a separate element that holds its own text.

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

4. **The per-kind shape is fixed, in TradingView's vocabulary.** Every kind is pure geometry.
   There are no market values anywhere in the set.

   | Kind | TradingView equivalent | Points inside the box | Other |
   |---|---|---|---|
   | `horizontalLine` | Horizontal Line | none | a line at the box's vertical centre, across the box's width |
   | `verticalLine` | Vertical Line | `at` | a line at `at.x`, down the box's full height |
   | `trendline` | Trend Line | `start`, `end` | two points, **any angle**; `trendline.ray` kept |
   | `highLowLine` | High and Low Line | `top`, `bottom` | a vertical segment between the two points |
   | `rectangle` | Rectangle | none | the element's own box, outlined and optionally filled |
   | `textLabel` | Text | `at` | the text at the point; `label.text` kept |
   | `arrow` | Arrow | `from`, `to` | a segment between the two points with a head |
   | `position` | Long/Short Position | `points.entry`, `points.stop`, `points.target` | three draggable levels in the box, plus the distance ratio |

   The rectangle has no edge prices and no `extendRight`: `ComponentRenderContext` carries no
   composition size (`packages/core/src/contract.ts:22-34`), so a rectangle cannot know where
   "the right edge" is. The creator widens the box instead.

5. **The position tool's three levels are positions in its own box, and its ratio is a geometric
   fact.** The entry, stop and target are three draggable levels inside the box — fractions of the
   box's height, not prices. The ratio the tool shows is the target's distance from the entry
   divided by the stop's distance from the entry, computed from the drawn geometry. That is a
   true statement about the shape on screen. It is **not** a profit-and-loss figure and it does
   **not** imply a broker fill (OB-006 stands). TradingView's "% distance" is **not** shown: it
   needs a price scale, and this product has none. A creator who wants a price in the trade types
   it in the caption.

6. **The points are draggable handles.** The editor draws handles over the canvas for a drawing's
   points, and the creator drags them. This is the machinery the swing path already uses for its
   anchors — `swingHandles()` (`apps/studio/src/components/PreviewPanel.tsx:623`) and the swing
   drag handler (`onPointerMove`, `:392`); it is reused, not rebuilt. The trend line takes **any
   angle** — two points, no constraint — and the high and low line is a vertical segment with two
   ends, like TradingView's shape, without the bar: it no longer snaps to a bar's high and low,
   because it does not read bars.

7. **A new drawing is placed by a click.** One click places the box for the single-click kinds;
   two clicks place the two points of the two-point kinds; the position tool takes one click and
   its three levels are dragged afterwards. The drawing's own frame range starts at the current
   frame and lasts about ninety frames, and the creator edits it in the timeline.

8. **Every drawing carries an optional caption.** A short string the creator types, drawn beside
   the shape, the way TradingView labels its lines. The text label tool stays a separate element
   that holds its own text.

9. **Two kinds are renamed, and the migration carries the rename.** `priceLine` becomes
   `horizontalLine` and `priceZone` becomes `rectangle`. The standing rule that a component type
   is never renamed **does not apply here**, and the reason is the one this product already
   applies to names everywhere else: a line that keeps the name `priceLine` while holding no
   price is a false label. The v2 → v3 migration maps the old element types to the new ones, so a
   v2 document's price line becomes a horizontal line and its price zone becomes a rectangle. The
   other six kinds keep their names.

10. **A new drawing lands on a defined track.** The track immediately above the chart it was
    dropped on when there is one; otherwise the track of the selected clip; otherwise the first
    track. "Immediately above" is one step towards the top layer, because `tracks[0]` is the top
    layer (`packages/video/src/composition.tsx:172`); a chart already on the topmost track shares
    that track and the drawing is appended to it, so it renders above the chart.

11. **The drawing inspector shows the drawing.** Box (`x`, `y`, `width`, `height`), the geometry —
    the points, the levels, the direction — the caption, the style, and the clip's own frame
    range. The chart-relative `in` and `out` disappear, including from the shared drawing
    parameters (`packages/components/src/trading/drawings/definitions.ts:227` — `COMMON_PARAMS`).
    There are no number fields to edit, because there are no numbers.

12. **The canvas gets a context menu.** Group and Ungroup, Duplicate, Copy, Paste, Delete, Rename,
    Bring to front, Send to back, Lock and Hide. Grouping already works
    (`packages/editor/src/store.ts:499`, `:515`) and is only surfaced here; the layer-order and
    lock/hide entries are new store work.

13. **Lock and hide generalise to every clip.** `setDrawingLocked` and `setDrawingHidden` become
    clip-level actions. A context menu that offers "Hide" for some elements and not others is
    worse than no menu at all. A hidden clip is not rendered; a locked clip is not selectable on
    the canvas but stays selectable on the timeline, where a lock badge is the way back in.

14. **Existing documents are migrated, not broken.** A document that holds today's chart-anchored
    drawings is converted to the new shape so that nothing the creator already made stops
    rendering. The migration maps the old element types to the new ones, keeps what it can — a
    v2 price line's price becomes the new caption, a v2 price zone becomes a rectangle with no
    edge prices, a v2 high/low line becomes a plain vertical segment — and places the element
    using the chart's plot area and the chart's **full-series** price range. That is an
    approximation at the last frame, because a static migration cannot reproduce the scale a
    chart had at a particular frame; the migration says so in its own comment.

15. **The provenance record gains an annotations section.** Each drawing's kind and its caption are
    recorded as the creator's own, not market-derived, alongside the existing series and simulation
    sections.

## Owner decisions

Seven choices in this decision are the owner's. This ADR does not pick them silently; it records the
position taken and the alternative that stays open. The drawing vocabulary — TradingView's set,
with the two renames and no authored numbers — is one of them, and it supersedes the first
reading of the drawing's shape, which had given the horizontal line an authored price.

### The drawing's shape: a box, points inside it, and no numbers at all

- **Position:** every drawing is a box in composition space; a trend line and an arrow carry two
  points inside that box; the high and low line carries two points on a vertical segment; the
  position tool carries three draggable levels inside its box; the horizontal line is a rule at the
  box's centre; the rectangle is the box itself; every drawing carries a style and an optional
  caption. **There are no authored numbers.** The chart-relative `in` / `out` are gone, and the
  clip's own frame range is the lifecycle.
- **Why:** the drawing's timing is the timeline's job, and the timeline already has a frame range
  for every clip. Keeping a second, chart-relative range gave one object two clocks. And a
  drawing that reads no market has no market value to hold: the owner's TradingView reference
  settles the set, and a number the product cannot place is a number that only looks meaningful.
- **Alternative:** keep `in` / `out` as absolute frames rather than chart-relative ones. That is
  less disruptive but leaves a second way to say "when is this visible" that no other element has.
- **Alternative:** keep an authored price on the horizontal line. It preserves the creator's
  stated level, but the line cannot sit on it, so the number would sit beside a rule it does not
  locate — the caption does that job honestly.
- **Decided by:** product owner.

### The drawing vocabulary: TradingView's set, with two renames

- **Position:** the set is TradingView's — horizontal line, vertical line, trend line, high and
  low line, rectangle, text, arrow, long/short position. `priceLine` is renamed `horizontalLine`
  and `priceZone` is renamed `rectangle`; the migration maps the old element types to the new
  ones. The other six kinds keep their names.
- **Why:** a line that keeps the name `priceLine` while holding no price is a false label, and a
  zone is a rectangle. This product's rule is that a name must not claim something the data does
  not support. The owner's standing rule that a component type is never renamed does not apply
  here, and this decision states that exception in writing.
- **Alternative:** keep the old names and change only the tools. Cheaper, and it leaves two kinds
  whose names promise a market the product no longer has.
- **Decided by:** product owner.

### The migration's placement: keep what can be kept, approximate the position

- **Position:** the migration maps the old element types to the new ones and keeps what it can: a
  v2 price line's price becomes the new caption; a v2 price zone becomes a rectangle with no edge
  prices; a v2 high/low line becomes a plain vertical segment. The element's placement is computed
  from the chart's plot area and the chart's full-series price range, and the migration's comment
  says plainly that this is an approximation at the last frame.
- **Why:** the creator's own figure must survive, so the price becomes a caption; the pixel
  position depended on a live scale that a static migration cannot reproduce, so an approximation
  that is stated is better than a silent wrongness.
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

- **Position:** box, geometry (the points, the levels, the direction), caption, style, and the
  clip's own frame range.
- **Why:** those are the things a drawing has. The chart-relative range is gone because the range
  is no longer the drawing's, and there are no number fields because there are no numbers.
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
| Resolve the price scale lazily at render time from whatever chart is nearest | A horizontal line would sit on its price | It is the market-anchored model again, with a worse failure mode: the line moves when an unrelated chart is added | Reject |
| Give every drawing a private price scale of its own | A horizontal line could position itself | A scale with no market behind it is a fiction; the number would mean nothing measurable | Reject |
| Keep an authored price on the horizontal line and call it a price line | The creator keeps a stated level | The line cannot sit on the number, so the name promises a placement the element does not do; a caption states the same figure honestly | Reject — the kind is renamed `horizontalLine` |
| Keep the names `priceLine` and `priceZone` while changing what they hold | No migration of the element types | Two kinds whose names claim a market the product no longer has | Reject — the names are renamed and the migration carries the rename |
| Keep the price zone's authored edge prices | A zone states its two prices | The edges were market-derived clicks; a market-derived number has no meaning in an independent element | Reject — the zone becomes a rectangle with no edge prices |
| Keep `zone.extendRight` | A rectangle can run to the chart's edge | `ComponentRenderContext` has no composition size; a rectangle cannot know where the edge is | Reject — the box is the extent |
| Show TradingView's "% distance" on the position tool | A familiar percentage | It needs a price scale, and this product has none | Reject — the geometric distance ratio is shown instead |
| Build a second handle system for the drawing points | — | The swing path already has one | Reject — `swingHandles()` and the swing drag handler are reused |
| Generalise lock / hide to every clip | One menu, one meaning | It is net-new behaviour rather than a rename, and needs a canvas-side pick filter and a timeline badge | **Select** |
| Keep lock / hide drawing-only | Smaller diff | A context menu that hides some elements and not others | Reject |
| A canvas context menu | Where the creator's pointer already is | Needs a Radix wrapper in `packages/ui` (no new dependency) and a rename path that is not `window.prompt` | **Select** |
| A timeline context menu | The timeline is where objects live | Narrower target, and the drawing tools are a canvas affair | Reject |

## What this changes

- **The persisted document.** Project schema version 3. A drawing's props become
  `{ x, y, width, height, opacity, style, points?, caption?, label?, trendline?, position? }`; the
  drawing definitions' `propsVersion` becomes 2; the migration gains a v2 → v3 step
  (`packages/components/src/project-migrate.ts:22` — `CURRENT_PROJECT_SCHEMA_VERSION`).
- **Two element types.** `priceLine` becomes `horizontalLine` and `priceZone` becomes
  `rectangle`. The v2 → v3 migration maps the old types to the new ones, so a v2 document's
  price line arrives as a horizontal line carrying the old price as its caption.
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
- **The registry's rules.** The `type` is still the persisted stable id; no drawing kind is
  renumbered or reused; the component registry still decides what appears in the library. **The
  one exception is stated in decision 9:** `priceLine` and `priceZone` are renamed, because the
  old names would claim a market the element no longer holds. The other six kinds keep their
  names.
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
copied and exported like anything else; the eight tools work in a project with no chart at all; the
toolset is the one a creator already knows from TradingView; the creator's own figure survives
into the export as a caption; the timeline becomes the single place a drawing's life is described.

**Costs:** a schema migration that must not change a single rendered frame of an existing
project; two element types renamed, which the migration carries and the registry catalogue must
follow; an approximation in that migration's placement that is stated rather than hidden; the loss
of the zone's `extendRight` and of the price zone's authored edge prices; the loss of the
market-anchored guarantee, which was a real guarantee and is now simply not offered; and the loss
of every authored market number, replaced by captions and by geometry the creator controls
directly.

**Limits accepted for now:** a horizontal line states a level only through its caption; the
position tool's levels are positions in a box and its ratio is a geometric fact, not a money
figure; TradingView's "% distance" is not available because it needs a price scale this product
does not have; a drawing is not tied to any chart, so moving or deleting a chart leaves the
drawing exactly where it was, which is the point; the context menu is a canvas surface only.

## Exit strategies

| Introduced thing | How it leaves |
|---|---|
| The normalised point model | A property of the drawing props. A future version that wants chart-relative behaviour reintroduces a prop; the box and the points stay. |
| The two renamed types | A mapping in the v2 → v3 migration. A future version that wants the old names back adds a mapping in the other direction; the geometry does not change. |
| `validateDrawingProps` | A validator in `packages/core/src/validation.ts`. Removing it is a deletion. |
| The provenance annotations section | A field on `ProvenanceRecord`. A future version drops it the way the record drops fields. |
| The canvas context menu | A surface over existing store actions. Closing it removes the surface, not the actions. |
| Clip-level lock and hide | Two fields that already exist on `Clip` (`packages/core/src/schemas.ts:107`, `:109`). The change is in where they are honoured. |
