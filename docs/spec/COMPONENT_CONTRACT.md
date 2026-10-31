# Component Contract

Normative reference for every exportable video object in Chart Studio: first-party
trading components, source-owned Remocn motion components, and the generic elements
inherited from the upstream editor.

Governing decisions: [ADR-003-COMPONENT-SYSTEM](../decisions/ADR-003-COMPONENT-SYSTEM.md)
(object protocol), [ADR-001-VIDEO-STACK](../decisions/ADR-001-VIDEO-STACK.md) (Remotion-first),
[ADR-007-CHART-ELEMENT-MODEL](../decisions/ADR-007-CHART-ELEMENT-MODEL.md) (chart element
model, schema version 2 and the datasource seam),
[TECHNICAL_ARCHITECTURE](../architecture/TECHNICAL_ARCHITECTURE.md) (scene graph boundaries).

Machine-readable form: `packages/core/src/contract.ts`. The registry implementation lives in
`packages/core/src/registry.ts`.

## 1. Identity

- `ElementType` (`packages/core/src/schemas.ts`) is the closed union of component IDs. The ID is what a
  project file persists. **IDs are never renumbered, renamed or reused.**
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
| `inspector` | no | Custom inspector panel, rendered below the generated params. |
| `defaultDuration` | no | Frames a new instance occupies. |
| `propsVersion` | no | Version of the component's props schema. Bump on breaking prop changes. |
| `provenance` | no | Required for adapted third-party source: `source`, `license`, `revision`, `notes`. |
| `renderMode` | no | `content` (default) \| `audio` \| `background`. |

`renderMode` decides how the compositor frames the adapter's output: `content` is positioned
at `(x, y)` and receives the clip's effects; `audio` and `background` are full-frame layers
and are not wrapped in the positioned box.

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

A market-anchored drawing cannot resolve its own geometry: it needs the chart clip's pane state
at the current frame, and `render` receives only `(clip, props, frame, fps)`. The definition may
therefore declare a pure evaluation step:

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

## 6. Acceptance mapping

| ID | Covered by |
|---|---|
| CPT-001 | Registry dispatch resolves a typed chart component; inspector edits produce an identical frame on reseek. |
| CPT-002 | An adapted Remocn component is registered with the same lifecycle and records licence/provenance. |
| CPT-003 | Independent components keep their own frame intervals and transitions; the registry-driven `evaluate` step extends it. |
| CPT-004 | HTF/LTF chart instances keep independent lifespans (R2+; the R1 registry already supports multiple instances). |
| CPT-005 | Editor handles never reach the render path; price-anchored drawings are unaffected by transform. |
| CPT-006 | Project and props migrations reject unsupported future versions. |
| MD-009 | The datasource seam carries identity, origin, revision, ordering and stable bar ids; the origin is one of `authored-path`, `manual`, `synthetic` or `imported`; no importer ships. |
| MD-010 | A chart consumes its series by reference, by id, so one dataset backs several chart instances. |
| AP-001 | The swing-path tool places anchors and the generated candles follow the drawn path, the close of each anchor bar equal to the placed price exactly; the drawn path is the skeleton of the series, not a corridor, so closes may overshoot the anchors between them. |
| AP-002 | Generation is a pure function of `(path, seed, algorithmVersion, generator settings)`; the same inputs produce the same bars, the anchor regime determines the character of the segment from that anchor to the next, and the generated series is scale-invariant. |
| AP-003 | Moving an anchor regenerates the series deterministically and re-renders without a reload; only the segments the moved anchor touches change. |
| AP-004 | An authored path stays distinguishable from synthetic and imported series in the editor and in export metadata. |
| CH-005 | Panes align through the chart clock and an explicit binding, never by row index; the relation between panes is declared as a rollup or a lockstep. |
| CH-009 | A chart is a collection of elements — panes and the drawings anchored to it — with the collection controllable as a whole: a pane carries its own place in the chart box, clock binding, viewport, pause points and curve, and a drawing carries market anchors, lifecycle and opacity and resolves against the pane's scale. |
| CH-010 | A chart declares the relation between its panes as a rollup or a lockstep; a cross-asset link is labelled as an authored link in the editor, never as market time. |
| OB-010 | Every element inside a chart carries its own `[in,out)` lifecycle and opacity, relative to the chart clip, and a pane or chart carries its own curve; no element carries a separate transform. |
| CV-001 | A chart and its panes accept an editable easing curve; a pane's curve overrides the chart's and applies per candle within the pane's slot. |
| CV-002 | Static and linear effects accept an easing parameter; effects that already expose one accept a custom cubic-bezier as well, and the legacy easing names keep their meaning. |
| CV-003 | A curve is stored as data, evaluated by a pure function, and produces identical frames in preview and export. |
| CV-004 | One curve editor serves every surface that exposes a curve — the chart, a pane, a zoom segment and an effect's custom cubic-bezier. |
| TL-009 | Duration is derived from the elements or set by the author, and the fixed value is adjustable with a draggable slider. |
| TL-010 | A component declares transport actions that the shell renders and executes generically. |
| TF-008 | The timeframe ratio of a rollup is derived from the panes, so it always agrees with the data; a lockstep names its shared timeframe, and the shared candle count comes from the two panes and must agree. |
| CH-011 | The split layouts are a grouped chart of one to three chart objects sharing an arrangement and a clock; each chart keeps its own data, scale, viewport and lifecycle, and pane relations are declared on the chart that holds the panes. |
| TF-009 | The timeframes come from a fixed ladder defined against the base rung; a non-whole ratio is shown as the fraction it is, never rounded. |
