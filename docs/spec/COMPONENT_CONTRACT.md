# Component Contract

Normative reference for every exportable video object in Chart Studio: first-party
trading components, source-owned Remocn motion components, and the generic elements
inherited from the upstream editor.

Governing decisions: [ADR-003-COMPONENT-SYSTEM](../decisions/ADR-003-COMPONENT-SYSTEM.md)
(object protocol), [ADR-001-VIDEO-STACK](../decisions/ADR-001-VIDEO-STACK.md) (Remotion-first),
[TECHNICAL_ARCHITECTURE](../architecture/TECHNICAL_ARCHITECTURE.md) (scene graph boundaries).

Machine-readable form: `src/registry/types.ts`. The registry implementation lives in
`src/registry/registry.ts`.

## 1. Identity

- `ElementType` (`src/types.ts`) is the closed union of component IDs. The ID is what a
  project file persists. **IDs are never renumbered, renamed or reused.**
- Every registered component has exactly one `VideoComponentDefinition`.
- Component IDs are grouped by `category`: `generic` (inherited editor elements),
  `trading` (Chart Studio first-party), `motion` (adapted Remocn source).

## 2. `VideoComponentDefinition`

| Field | Required | Meaning |
|---|---|---|
| `type` | yes | Stable component ID (`ElementType`). |
| `label` / `icon` / `description` | yes | Library and timeline presentation. |
| `category` | yes | `generic` \| `trading` \| `motion`. |
| `defaults` | yes | Props applied to a new instance. Must be JSON-serialisable. |
| `params` | yes | Inspector controls generated from `ParamDef`s. |
| `render` | yes | Deterministic render adapter, `(clip, props, frame, fps) => ReactNode`. |
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
                                     └─► definition.render({ clip, props, frame })
        ▼
Serialization ─► plain JSON; only IDs, numbers, strings, arrays and objects
```

`frame` is **clip-relative**: 0 is the clip's first frame. Remotion's `useCurrentFrame()`
inside a `Sequence` returns the same value, so adapted third-party components that own their
frame access keep working unchanged.

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

## 5. Schema versioning

- `Project.schemaVersion` — bumped when the project document itself changes shape.
  Loading a file with a **higher** version must fail with a clear error instead of guessing.
- `Clip.propsVersion` — the props schema version of the clip's component. A clip whose
  `propsVersion` is newer than the registered definition's must be rejected, not coerced.

`src/project/migrate.ts` owns both migrations and is the only place where legacy documents
are reshaped.

## 6. Acceptance mapping

| ID | Covered by |
|---|---|
| CPT-001 | Registry dispatch resolves a typed chart component; inspector edits produce an identical frame on reseek. |
| CPT-002 | An adapted Remocn component is registered with the same lifecycle and records licence/provenance. |
| CPT-003 | Independent components keep their own frame intervals and transitions. |
| CPT-004 | HTF/LTF chart instances keep independent lifespans (R2+; the R1 registry already supports multiple instances). |
| CPT-005 | Editor handles never reach the render path; price-anchored drawings are unaffected by transform. |
| CPT-006 | Project and props migrations reject unsupported future versions. |
