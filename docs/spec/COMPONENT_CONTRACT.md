# Component Contract

Normative reference for every exportable video object in Chart Studio: first-party
trading components, source-owned Remocn motion components, and the generic elements
inherited from the upstream editor.

Governing decisions: [ADR-003-COMPONENT-SYSTEM](../decisions/ADR-003-COMPONENT-SYSTEM.md)
(object protocol), [ADR-001-VIDEO-STACK](../decisions/ADR-001-VIDEO-STACK.md) (Remotion-first),
[ADR-007-CHART-ELEMENT-MODEL](../decisions/ADR-007-CHART-ELEMENT-MODEL.md) (chart element
model, schema version 2 and the datasource seam),
[ADR-009-INDEPENDENT-DRAWING-ELEMENTS](../decisions/ADR-009-INDEPENDENT-DRAWING-ELEMENTS.md)
(drawings as independent elements, schema version 3),
[ADR-010-ELEMENT-EDIT-MODEL](../decisions/ADR-010-ELEMENT-EDIT-MODEL.md)
(the element edit model, schema version 4),
[TECHNICAL_ARCHITECTURE](../architecture/TECHNICAL_ARCHITECTURE.md) (scene graph boundaries).

Machine-readable form: `packages/core/src/contract.ts`. The registry implementation lives in
`packages/core/src/registry.ts`.

### Repair contract, 2026-11-02

Definitions own `geometry(props, measured?)`: anchor, local box/origin, named points and
intrinsic rotation. `bounds` delegates to the same geometry. Coordinates and uniform/axis
resize capabilities are explicit metadata, independent of props versions. Registration rejects
duplicate IDs and invalid grips. Missing edit metadata on content resolves to box fallback;
audio/background/transitions remain outside canvas selection.

`evaluateElementPose(clip, sceneFrame, fps, geometry?)` supplies the existing effect style,
CSS transform and forward/inverse planar mappings for both video and editor. Picking uses
oriented/projected geometry; singular and camera-hidden points cannot be manipulated. Visible
polygon/segment clipping precedes perspective division. DOM caches hold only local content
sizes for `contentSized` definitions, with font/media/layout invalidation and cleanup.

Canvas eligibility is `[from, from + durationInFrames)`, visible, unlocked and canvas-capable.
Timeline selection outside it exposes no canvas grips. Store mutation boundaries enforce lock;
group edits skip locked members and validate other patches atomically. Drags capture immutable
originals, pause playback, and add one history entry on the first actual change; no-op clicks add
none. Cancellation/capture loss finalizes the last valid change; seeking clears the gesture.

Every registered definition has a plain props validator (installed from metadata when omitted).
`normalizeComponentProps` merges missing defaults recursively, rejects supplied malformed known
fields and retains extensions. Loading validates versions before conversion and validates the
whole converted project; user mutations reject invalid batches with a notice and unchanged
project/history. Scalar/domain/encoded fields are checked, not arbitrary future extensions.
Compatibility `ComponentProps` remains any-based in legacy adapters; this repair adds runtime
validation and does not claim a complete static-type rewrite.

HTML authored source remains unchanged. Preview/export share parser-based `sanitizeStaticHtml`
and emit only the [documented static subset](../decisions/2026-11-02-PARSE5-ADOPTION.md), with
no active/resource/navigation attributes or resource-loading styles. No project/SQLite/archive
schema version changes are introduced by runtime capabilities.

The composition owns baseline font/line-height and media display; the static HTML adapter owns
its safe semantic tag defaults. Editor Tailwind preflight is not a video dependency. Explicit
authored/component inline styles retain precedence. Stage chrome must not shrink the coordinate
surface used by the Player, picker and overlay.

## 1. Identity

- `ElementType` (`packages/core/src/schemas.ts`) is the closed union of component IDs. The ID is what a
  project file persists. **IDs are never renumbered, renamed or reused.** The one recorded exception
  is the two drawing kinds renamed in schema version 3: `priceLine` became `horizontalLine` and
  `priceZone` became `rectangle`. A line that keeps the name `priceLine` while holding no price is a
  false label, and the migration carries the mapping.
- Every registered component has exactly one `VideoComponentDefinition`.
- Component IDs are grouped by `category`: `base` (inherited editor elements),
  `trading` (Chart Studio first-party), `motion` (adapted Remocn source).

## 2. `VideoComponentDefinition`

| Field | Required | Meaning |
|---|---|---|
| `type` | yes | Stable component ID (`ElementType`). |
| `label` / `icon` / `description` | yes | Library and timeline presentation. |
| `category` | yes | `base` \| `trading` \| `motion`. |
| `defaults` | yes | Props applied to a new instance. Must be JSON-serialisable. |
| `params` | yes | Inspector controls generated from `ParamDef`s. |
| `render` | yes | Deterministic render adapter, `(clip, props, frame, fps) => ReactNode`. |
| `evaluate` | no | Pure evaluation step run once per clip per frame before render; its result is passed to the adapter as `evaluated`. |
| `transportActions` | no | Playback controls the shell renders and executes generically for the selected clip. |
| `edit` | no | How the editor picks the element and which control points it draws while it is selected. |
| `inspector` | no | Custom inspector panel, rendered below the generated params. |
| `defaultDuration` | no | Frames a new instance occupies. |
| `propsVersion` | no | Version of the component's props schema. Bump on breaking prop changes. |
| `provenance` | no | Required for adapted third-party source: `source`, `license`, `revision`, `notes`. |
| `renderMode` | no | `content` (default) \| `audio` \| `background` \| `transition`. |

`renderMode` decides how the compositor frames the adapter's output: `content` is positioned
at `(x, y)` and receives the clip's effects; `audio` and `background` are full-frame layers
and are not wrapped in the positioned box. `transition` renders between adjacent clips
and does not participate in canvas picking.

### The clip flags

`hidden` and `locked` are clip flags, not component behaviour, and the **shell** honours them
for every clip — a chart, a drawing, an image, an audio bed:

- A hidden clip is skipped by the composition. The composition returns nothing for it, so the
  renderer is never asked to draw it.
- A locked clip is not pickable on the canvas. It stays on the timeline, where it carries a lock
  badge, so the creator can still find it and unlock it.

Both flags are honoured by the pick list as well as by the composition: a hidden or a locked clip
is never a candidate for the pick, whatever shape it declares. A locked clip still renders — the
lock protects it from the creator, not from the frame.

A component definition therefore neither reads nor sets these flags, and the shell never asks a
definition whether it wants to be hidden.

### The edit model

The contract gains **one optional field**. A definition declares how the editor picks its element
and what the creator can drag:

```ts
export type ElementPickKind = 'box' | 'segment' | 'point';

export interface ElementHandle {
  /** The handle's name: a corner (`nw`), a side (`n`) or a point (`start`). */
  id: string;
  /** What dragging the handle does. */
  effect: 'scale' | 'font' | 'wrap' | 'point' | 'level' | 'move';
  /** The props the handle writes, for the effects that write props. */
  props?: string[];
}

export interface ElementEditModel {
  /** How the element is picked. */
  coordinates?: 'absolute' | 'fractional';
  resize?: 'axes' | 'uniform' | ((props: Record<string, unknown>) => 'axes' | 'uniform');
  contentSized?: boolean;
  pick: ElementPickKind;
  /** The handles the editor draws on the element while it is selected. */
  handles: ElementHandle[];
}
```

**The shell reads the declaration and never names an element kind.** This is the same rule the
transport actions and the inspector panels already follow: *components declare, the shell
executes*. The shell's obligation is therefore:

- **Never branch on the element's kind.** No `switch` over `ElementType` may decide how an element
  is picked, what handles it shows or what a drag writes. A new element declares its model and the
  shell is unchanged.
- **Derive the handle's place from the element's own geometry.** A `scale`, `font` or `wrap` handle
  is a corner or a side of the element's region; a `point` or `level` handle is the element's own
  `props.points[id]`; a `move` handle is the element's own anchor. A handle does not carry a
  position of its own, because a line's two ends are not at the corners of its bounding box.
- **Fall back to the box model** when a definition declares none. The field is optional, so an
  element that declares no `edit` keeps today's behaviour and any element can be moved back by
  removing its declaration. Audio, background and transition render modes remain explicitly excluded.

**The pick rule.** The canvas picks the topmost clip whose **shape** contains the pointer, and the
shape is the one the element declares:

| Shape | Picked when | Tolerance |
|---|---|---|
| `box` | the pointer is inside the region | none — the box is the shape |
| `segment` | the pointer is within a short distance of the line | **6 screen pixels** |
| `point` | the pointer is within a short distance of the point | **8 screen pixels** |

**The tolerance is in screen pixels.** The shell converts it to composition pixels with the canvas
scale, so the same pointer hits the same element at every zoom. A line's **endpoints** are grabbed
as the element's own control points, which take precedence over the line's body. The geometry
module declares a 10-screen-pixel endpoint tolerance, but the pick test does not consume it yet.

**The layer order is unchanged.** Tracks top-down, and within a track the later clip on top. A line
crossing a candle is picked where it lies over the candle, and the candle is picked everywhere
else. What changes is that a line no longer owns the rectangle it happens to span. The selected
element's own control points take precedence over its body.

**One overlay, not two.** The selection overlay draws the control points the element declares, in
one style. The drawings' separate point overlay is gone — a trend line no longer shows a rectangle
and a second layer of green circles at once. A line gets **no rectangle**: its region is the
bounding box of its two ends, but drawing that rectangle is exactly what the change removes.

**A text's box is measured, not stored.** The composition stamps each clip's id onto its rendered
root and the editor measures that element's box; the measurement is editor-only and the renderer
stays pure. The **font size is the single master**: a corner handle scales it, a side handle sets
the wrap width (a new optional `maxWidth` prop), and the box follows. The inspector's width and
height fields are gone for a text — it shows the font size and the wrap width. Within the content
group emoji writes `size` from corner and east/west handles. Counter exposes font corners only; NodeTrail has no scale/wrap grips and retains inspector label-font control. Supported text wrapping has east/west grips only.

**The chart's corner handles drive its outer box.** The chart's plot has no props of its own yet,
so the handles scale the box and driving the plot is deferred. Existing intrinsic rotation and effect rotation/perspective are respected by the shared pose; adding a universal authored rotation control remains deferred.

## 3. Lifecycle

```
Library drag/drop ─► store.addClip(type)
        │  props = definition.defaults  (+ x/y centred on the canvas)
        ▼
Inspector ─► generated params (definition.params) + custom panel (definition.inspector)
        │  every edit → store.updateClipProps → project snapshot
        ▼
Timeline ─► clip.from + clip.durationInFrames define the lifespan [start, end)
        ▼
MainComposition ─► Sequence(from, duration) ─► ClipRenderer (effects + position)
                                     └─► definition.evaluate({ clip, props, sceneFrame, project })
                                     └─► definition.render({ clip, props, frame, evaluated })
        ▼
Serialization ─► plain JSON; only IDs, numbers, strings, arrays and objects
```

`frame` is **clip-relative**: 0 is the clip's first frame. Remotion's `useCurrentFrame()`
inside a `Sequence` returns the same value, so adapted third-party components that own their
frame access keep working unchanged.

### The evaluate step

A component that cannot resolve its own geometry from `(clip, props, frame, fps)` — because it
needs project state at the current frame, such as a chart's pane state — declares a pure
evaluation step:

```ts
evaluate?: (input: {
  clip: Clip;
  props: ComponentProps;
  /** Absolute frame in the composition. */
  sceneFrame: number;
  /** The immutable project snapshot the frame is evaluated against. */
  project: Project;
}) => unknown;
```

The composition calls `evaluate` once per clip per frame and passes its result to the adapter as
`ComponentRenderContext.evaluated`. The rules:

- `evaluate` is pure. It receives no editor state, no DOM and no clock.
- `packages/core` still imports no React, Remotion, Zustand or storage code. `Project` is data.
- A definition without `evaluate` behaves exactly as it does today.

**The chart is the first user of the step.** It resolves its series from the project registry by
id, materialises it, evaluates each pane against the chart clock, and returns the pane states and
the series' provenance. The adapter then draws from those states rather than from inline bars. A
chart whose project carries no matching series falls back to the inline bars, so a chart written
before the registry still renders.

Because the evaluation is pure and the composition runs it for the preview and the export alike,
the same frame always evaluates to the same thing — whatever order the frames were visited in.

**The drawings no longer evaluate.** A drawing is pure geometry: its own shape, its own points, its
own style and its own caption. It reads no chart, no pane, no series and no market value, so it
needs no evaluation step and the six drawing definitions declare none. Their props *are* the
independent shape, and the adapter draws straight from them:

| Field | Meaning |
|---|---|
| `x`, `y` | The centre of the drawing's own box in composition space. |
| `width`, `height` | The size of the drawing's own box — or, for a horizontal line, its length, and for a vertical line, its height. |
| `opacity` | The drawing's own opacity. |
| `style` | `color`, `lineWidth`, `fillOpacity`, `fontSize`. |
| `caption` | The creator's own figure, drawn beside the shape. Never a market value. |
| `points` | Per-kind points as **absolute places in the composition** — `{x, y}` in composition pixels, not fractions of a box. |
| `position` | The position tool's direction and its ratio toggle. |
| `label` | The text label's text. |

**The project schema version is 4**, and a drawing's shape is now the shape it actually is:

| Kind | Stored as |
|---|---|
| `horizontalLine` | `{x, y, width}` — the width is its length. |
| `verticalLine` | `{x, y, height}` — the height is its length. |
| `rectangle` | `{x, y, width, height}` — the box is the truth. |
| `position` | `{x, y, width, height, points: {entry, stop, target}}` — the box stays, the levels are absolute. |
| `trendline`, `arrow` | `{points: {…}}` — two absolute points and no box. The region is the bounding box of the two ends. |

The trend line's **ray option is retired**. A trend line has no box to run to the edge of, and the
migration drops the prop; validation rejects a document that still carries it.

The drawing kinds are `horizontalLine`, `verticalLine`, `trendline`, `rectangle`, `arrow` and
`position`. A high and low line became a trend line and a text label became a text; the migration
carries both across, so nothing the creator wrote is lost. `priceLine` became `horizontalLine` and `priceZone` became
`rectangle` — a recorded exception to the rule that a component type is never renamed, because a
line that keeps the name `priceLine` while holding no price is a false label. The migration
carries the mapping; see §5.

A drawing's lifecycle is its own clip's `from` and `durationInFrames`. The drawing carries no
chart clip, no pane, no anchors and no chart-relative range.

### The inspector context

A custom inspector panel (`definition.inspector`) receives a `ComponentInspectorContext`: the
clip, its props, `onChange`, `updateClip` and `commit`, plus two optional fields — `sceneFrame`
(the absolute frame the playhead is on) and `evaluated` (the component's own `evaluate` result at
that frame). The shell runs the evaluation and hands it to the panel, so a panel that edits the
market acts on the state the renderer draws instead of evaluating the market a second time.

A drawing's inspector panel receives the same context. Because a drawing declares no `evaluate`
step, its `evaluated` is absent, and the panel edits the geometry — the points and the levels —
and the caption directly.

### Element-declared transport actions

A component may declare extra playback controls:

```ts
export interface TransportAction {
  id: string;
  label: string;
  icon: string;
  /** 'seek' jumps the transport; 'toggle' flips a state the component owns. */
  kind: 'seek' | 'toggle';
  /** Absolute frame to seek to. Null when the action is not currently applicable. */
  seekTo?: (input: { props: ComponentProps; sceneFrame: number }) => number | null;
  /** Toggle target, resolved by the shell through the component's own props. */
  toggle?: 'hold';
}
```

The shell renders the actions of the **selected** clip's definition in the floating transport bar
and executes them generically: `seek` calls `seekTo`, `toggle` flips the `holds` array of the
pane the component owns. No component name is hardcoded in `apps/studio`.

### Curves and easing

Two vocabularies coexist, deliberately.

- The **core curve** is a `Curve` value stored as data and evaluated by one pure function in
  `packages/core`. A chart carries one in `clip.props.curve`; a pane may override it with its own
  `curve`. The curve shapes each candle's growth inside the pane's slot. The same value produces
  the same frame in preview and export.
- The **legacy effect easing** stays on Remotion's `Easing`, and the existing effect `easing`
  parameter keeps its current meaning, so no rendered frame of an existing project changes. That
  vocabulary is extended rather than replaced: the easing control gains a `custom` option with a
  matching `bez` parameter, the effects that are currently static or linear gain an easing
  parameter, and the effects that carry a hardcoded curve gain one in place of it.

The two vocabularies are separate: the core curve presets and the legacy effect easing names are
not one merged list, and the legacy names keep their meaning.

One `CurveEditor` widget serves every surface that exposes a curve — the chart curve, a pane's
curve, a zoom segment's curve and an effect's custom cubic-bezier. The effect surface keeps its
legacy easing select and shows the curve editor only for the custom bezier.

### Export provenance

`buildProvenance(project)` in `packages/core` builds the record that travels with an export: one
entry per series carrying its origin and the fields that origin carries, plus the simulation flags
— whether a chart reveals its bars dynamically — independently of where the data came from. The
export tools write it beside the MP4 as `<output>.provenance.json`, best-effort: a project that
cannot be described never fails the export.

The record also carries an `annotations` section: one entry per drawing clip, naming the
drawing's kind and, when the creator typed one, its caption. The caption is the creator's own
figure, and it travels as such — never as a market value.

## 4. Rules

1. **Adapters are pure.** `render` receives `(clip, props, frame, fps)` and nothing else. It must
   not read editor state, the DOM, the wall clock, or unseeded randomness. Deterministic output
   for a given `(project, frame)` is a release gate, not a nicety. The single documented exception
   is a component that analyses a media asset (for example an audio-reactive wave), which may use
   Remotion's media hooks.
2. **No future data leakage.** A chart component may only draw data that exists at the current
   market time. Later bars must not influence the price scale or the visible series.
3. **Provenance stays visible.** Synthetic series, simulated intrabar paths and adapted
   third-party source must remain recognisable as such in the rendered output and in the
   component's metadata.
4. **No executable code in project files.** Only component IDs, props, frames and asset
   references are persisted.
5. **Adapted source is vendored, not imported at runtime.** Keep the upstream licence and
   revision with the copy, and record the same information in `provenance`.
6. **`evaluate` is pure and optional.** It receives `(clip, props, sceneFrame, project)` and
   nothing else, runs once per clip per frame, and its result reaches the adapter only as
   `evaluated`. A definition that does not need it never declares it.
7. **The shell executes what components declare.** Transport actions are rendered and executed
   from the registry. No component name is hardcoded in `apps/studio`.
8. **A curve is data.** A curve is stored in the project, evaluated by a pure function, and
   produces the same frame in preview and export.
9. **A drawing is independent geometry.** A drawing definition declares no `evaluate` step, reads
   no chart, no pane, no series and no market value, and carries no chart-relative lifecycle. Its
   props are its shape, its points, its style and its caption, and nothing else.
10. **The shell honours the clip flags.** `hidden` and `locked` belong to the clip, not to the
    component: the composition skips a hidden clip, and the canvas does not pick a hidden or a
    locked clip. A locked clip stays on the timeline with its badge.
11. **The edit model is a declaration, not a table of element kinds.** It is read from the
    registry like the transport actions and the inspector panels: no component name is hardcoded
    in `apps/studio`, and the shell derives the handles' places from the element's own geometry
    rather than from a list of kinds.

## 5. Schema versioning

- `Project.schemaVersion` — bumped when the project document itself changes shape.
  Loading a file with a **higher** version must fail with a clear error instead of guessing.
- `Clip.propsVersion` — the props schema version of the clip's component. A clip whose
  `propsVersion` is newer than the registered definition's must be rejected, not coerced.

`packages/components/src/project-migrate.ts` owns both migrations and is the only place where
legacy documents are reshaped.

Schema version 2 is the version the chart element model introduces: a project-level series
registry, chart props carrying panes, a clock and a style, stable bar ids, a `durationMode` and
the transition slot on the track boundary. The migration stays non-destructive and idempotent, and
a migrated document must render the same candles in the same place as the document it came from.

Schema version 3 is the version the independent drawing elements introduce: a drawing is an
ordinary clip with its own box, its own points, its own style and an optional caption, and it
carries no chart clip, no pane and no market anchor. The migration maps the old element types to
the new ones — `priceLine` to `horizontalLine` and `priceZone` to `rectangle` — and keeps a v2
price line's price **as its caption**. The placement of a migrated drawing uses the chart's plot
area and the chart's full-series price range, which is an approximation at the last frame: the old
position depended on the price scale at a frame, and a static migration cannot reproduce that. The
migration stays non-destructive and idempotent.

Schema version 4 is the version the element edit model introduces: a drawing stores **the shape it
actually is**. A trend line, an arrow and a high/low line store two absolute points and no box; a
horizontal line stores `{x, y, width}`, a vertical line `{x, y, height}`; a text label stores
`{x, y, points: {at}}` and no box; the rectangle keeps its box; the position tool keeps its box
and stores its three levels as absolute points; the trend line's ray option is retired and dropped.
The migration stays non-destructive and idempotent, and a drawing that does not carry the points
its shape needs is left exactly as it was.

## 6. Acceptance mapping

| ID | Covered by |
|---|---|
| CPT-001 | Registry dispatch resolves a typed chart component; inspector edits produce an identical frame on reseek. |
| CPT-002 | An adapted Remocn component is registered with the same lifecycle and records licence/provenance. |
| CPT-003 | Independent components keep their own frame intervals and transitions; the registry-driven `evaluate` step extends it. |
| CPT-004 | HTF/LTF chart instances keep independent lifespans (R2+; the R1 registry already supports multiple instances). |
| CPT-005 | Editor handles never reach the render path; a drawing's placement is its own box, so it is unaffected by a chart resize. |
| CPT-006 | Project and props migrations reject unsupported future versions. |
| MD-009 | The datasource seam carries identity, origin, revision, ordering and stable bar ids; the origin is one of `authored-path`, `manual`, `synthetic` or `imported`; no importer ships. |
| MD-010 | A chart consumes its series by reference, by id, so one dataset backs several chart instances. |
| AP-001 | The swing-path tool places anchors and the generated candles follow the drawn path, the close of each anchor bar equal to the placed price exactly; the drawn path is the skeleton of the series, not a corridor, so closes may overshoot the anchors between them. |
| AP-002 | Generation is a pure function of `(path, seed, algorithmVersion, generator settings)`; the same inputs produce the same bars, the anchor regime determines the character of the segment from that anchor to the next, and the generated series is scale-invariant. |
| AP-003 | Moving an anchor regenerates the series deterministically and re-renders without a reload; only the segments the moved anchor touches change. |
| AP-004 | An authored path stays distinguishable from synthetic and imported series in the editor and in export metadata. |
| CH-005 | Panes align through the chart clock and an explicit binding, never by row index; the relation between panes is declared as a rollup or a lockstep. |
| CH-009 | A chart is a collection of elements — its panes — with the collection controllable as a whole: a pane carries its own place in the chart box, clock binding, viewport, pause points and curve. A drawing is not an element of a chart; it is an ordinary element with its own geometry, lifecycle and opacity, resolving against no pane's scale. |
| CH-010 | A chart declares the relation between its panes as a rollup or a lockstep; a cross-asset link is labelled as an authored link in the editor, never as market time. |
| OB-010 | Every element carries its own `[in,out)` lifecycle, opacity and layer; a drawing's lifecycle is its own clip's range, not a range inside a chart clip; a pane or chart carries its own curve; elements are groupable and the track is the layer, `tracks[0]` being the top layer. |
| OB-011 | The drawing tools are offered without a chart selected; a click or a library drop places the drawing with its own frame range and its own track — the track immediately above the chart it was dropped on where there is one, otherwise the selected clip's track, otherwise the first track — and the drawing renders with no chart in the project. |
| OB-012 | A drawing's geometry is stored in composition space — absolute points where the drawing is its points, a box where it has one — and a handle drag rewrites the geometry in the clip's own props. |
| OB-013 | A drawing carries an optional caption the creator types, and the export records it as the creator's own figure, never as a market value. |
| OB-014 | The canvas context menu offers group, ungroup, duplicate, copy, paste, delete, rename, bring to front, send to back, lock and hide; rename selects the clip and focuses the inspector's name field. |
| OB-015 | Lock and hide apply to every clip: the composition skips a hidden clip, and `pickableClips` skips hidden and locked clips while the timeline still shows a locked clip with its badge. |
| CV-001 | A chart and its panes accept an editable easing curve; a pane's curve overrides the chart's and applies per candle within the pane's slot. |
| CV-002 | Static and linear effects accept an easing parameter; effects that already expose one accept a custom cubic-bezier as well, and the legacy easing names keep their meaning. |
| CV-003 | A curve is stored as data, evaluated by a pure function, and produces identical frames in preview and export. |
| CV-004 | One curve editor serves every surface that exposes a curve — the chart, a pane, a zoom segment and an effect's custom cubic-bezier. |
| CV-005 | The v2 → v3 migration maps `priceLine` to `horizontalLine` and `priceZone` to `rectangle`, keeps a price line's price as its caption, places the drawing from the chart's plot area and full-series price range — an approximation at the last frame — and is non-destructive and idempotent. |
| CV-006 | The v3 → v4 migration makes the drawings store the shapes they are — two absolute points and no box for a trend line, an arrow and a high/low line; `{x, y, width}` for a horizontal line; `{x, y, height}` for a vertical line; `{x, y, points: {at}}` and no box for a text label; the box unchanged for a rectangle; the box plus absolute levels for the position tool; the ray dropped — and is non-destructive and idempotent. |
| EM-001 | A component definition may declare an optional edit model — a pick kind and its handles — and the shell reads that declaration rather than branching on the element's kind. |
| EM-002 | A handle declares no place: the shell derives a `scale`, `font` or `wrap` handle from the region's corners and sides, a `point` or `level` handle from the element's own named point, and a `move` handle from the element's own anchor. |
| EM-003 | The 32 scene-object types (30 canvas-capable) and 2 separate non-canvas transition definitions declare their capabilities as follows: 18 box-the-truth elements with four `scale` corners; content elements with supported font corners and east/west wrap grips; Counter has font corners only and NodeTrail has no scaling or wrapping grips; 2 one-anchor elements with one `move` handle; 2 two-endpoint elements with two `point` handles; the position tool with three `level` handles; and the audio and background elements, which are not on the canvas, with none. |
| EM-004 | The canvas picks by shape: a box anywhere inside it, a segment within 6 screen pixels of the stroke, a point within 8 screen pixels — the tolerances in screen pixels, so the same pointer hits the same element at every zoom. |
| EM-005 | The pick order is unchanged (tracks top-down, later clip on top within a track), and the selected element's own control points take precedence over its body. |
| EM-006 | One selection overlay draws the declared control points in one style; the separate drawing point overlay is gone, and a line is drawn with no rectangle. |
| EM-007 | A text's box is measured from the rendered text — the composition stamps the clip's id onto the rendered root and the editor measures it — the font size is the single master, a corner handle scales it, a side handle sets the wrap width, and the inspector shows the font size and the wrap width instead of width and height. |
| EM-008 | The trend line's ray option is retired: the migration drops the prop and validation rejects a document that still carries it. |
| EM-009 | The chart's corner handles scale the chart's outer box; driving the plot is deferred, because the plot has no props of its own yet. |
| TL-009 | Duration is derived from the elements or set by the author, and the fixed value is adjustable with a draggable slider. |
| TL-010 | A component declares transport actions that the shell renders and executes generically. |
| TF-008 | The timeframe ratio of a rollup is derived from the panes, so it always agrees with the data; a lockstep names its shared timeframe, and the shared candle count comes from the two panes and must agree. |
| CH-011 | The split layouts are a grouped chart of one to three chart objects sharing an arrangement and a clock; each chart keeps its own data, scale, viewport and lifecycle, and pane relations are declared on the chart that holds the panes. |
| TF-009 | The timeframes come from a fixed ladder defined against the base rung; a non-whole ratio is shown as the fraction it is, never rounded. |
