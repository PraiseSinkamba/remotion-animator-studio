# ADR-007 — The chart element model, project schema version 2 and the datasource seam

**Status:** Proposed for owner approval; implementation is not authorised by this document.  
**Date:** 2026-10-30  
**Depends on:** [ADR-003 — Component System](ADR-003-COMPONENT-SYSTEM.md) (one object protocol),
[ADR-004 — Storage Port](ADR-004-STORAGE-PORT.md) (the persisted project document),
[Technical Architecture](../architecture/TECHNICAL_ARCHITECTURE.md).  
**Described in:** [Authored swing paths, chart elements and playback control](../superpowers/specs/2026-10-29-chart-studio-authored-path-and-chart-elements-design.md)
§3, the design this decision records.  
**Companion:** [ADR-008 — Zod domain schemas](ADR-008-ZOD-DOMAIN-SCHEMAS.md) (the dependency record
for validating the schemas this decision introduces).  
**Decision owners:** Product owner for the three owner decisions below; implementation lead for the
rest.

## Context

The editor today produces a generic animation video with one trading component attached. The
candlestick chart clip owns an inline `bars` array (`packages/core/src/schemas.ts:83` — `Clip.props`
is `Record<string, any>` today), renders SVG candles, and nothing else. There is no place to draw on
a chart, no way to hold on one candle, no way to show two instruments side by side, and no way to
curve an element's motion.

Three facts about the current code shape the decision:

1. **The document model is one object graph already.** A scene object is exactly a `Clip`
   (`packages/core/src/schemas.ts:76-89`), a `Track` holds clips (`packages/core/src/schemas.ts:91-95`)
   and a `Project` holds tracks (`packages/core/src/schemas.ts:97-108`). Introducing a second object
   system beside it would duplicate the lifecycle, the inspector, the serialisation and the export
   path for no capability.
2. **The component contract cannot express a market-anchored drawing.** A render adapter receives
   `(clip, props, frame, fps)` and nothing else (`packages/core/src/contract.ts:22-29`), and the
   composition calls it with exactly those four values
   (`packages/video/src/composition.tsx:53`). A drawing that anchors to a price needs the chart
   clip's pane state at the current frame, which is not in that tuple.
3. **The bars have no identity.** `OhlcBar` today carries `t`, `o`, `h`, `l`, `c` and an optional
   `v` — no id (`packages/core/src/market.ts:8-15`). Anything that must reference a bar (a drawing
   anchored to a candle's high, a pane's as-of index, an imported source's immutable rows) needs a
   stable handle.

Import is deferred: there is no importer, no wizard and no file reading. What exists is a plan for
one, and the chart must be able to consume its output later without being rewritten.

## Decision

1. **One object graph, and a chart is a collection of elements.** Panes live inside the chart
   clip's props; drawings are separate clips that name the chart clip and the pane they resolve
   against. There is no second scene-object type: the project stays one document, versioned as
   schema 2. The chart is the collection the creator perceives: its panes plus the drawings
   anchored to it.

2. **Series live at project level and are referenced.** A project gains a `series` registry; a chart
   clip names a series by id (`packages/core/src/schemas.ts:97-108` becomes the place the registry
   lives). One dataset can therefore back several chart instances without duplication, which is what
   CH-006 already requires and what today's inline `bars` array prevents.

3. **The datasource seam is a pure function boundary, not an interface with an implementation.**
   `packages/core` exposes `materialiseSeries(spec) => Datasource` and
   `seriesRevision(spec) => string`, both pure. `Datasource` carries source identity, origin,
   a content-hash revision, label, symbol, timeframe, time basis and ascending bars with stable
   ids. `SeriesSpec` is a discriminated union over four origins — `authored-path`, `manual`,
   `synthetic`, `imported` — and only the first three have a producer in this slice. The seam
   already has the shape the existing hashing and PRNG helpers support: `hashString` and
   `createRng` exist in `packages/core/src/market.ts:44-63` and are extended, not duplicated.

4. **Market truth is stored as an anchor, and pixels are derived.** A drawing stores a `MarketAnchor`
   — an explicit price, a candle extreme, a bar's time, or a price at a bar — plus the chart clip
   id and the pane id. The renderer resolves the anchor against the pane's frame state at render
   time, so resizing or moving the chart cannot detach an annotation from its price. This is the
   mechanism CPT-005 requires and it is the reason the price scale is computed from the visible bars
   only (`packages/components/src/trading/chart.tsx:139-141`).

5. **The clock is explicit and its binding is authored, never inferred.** A chart clip carries a
   `MarketClock` (unit, reference series, bars per step, author-supplied offsets by series id) and
   each pane carries a `ClockBinding` — `reference`, `offset` or `utc`. One series at two
   timeframes is exact, because both panes read the same source. Two different series are aligned by
   an author-supplied offset, and the inspector labels that link "authored offset — not market
   time". A UTC binding requires a UTC series and is not available while import is deferred.
   Today's uniform mapping — one series revealed bar by bar — becomes the special case of this
   evaluation rather than a separate path: `evaluateBarsAtFrame`
   (`packages/core/src/market.ts:188-225`) keeps its name and its assertions, and the frame that
   reaches a component stays clip-relative (`packages/video/src/composition.tsx:46`, `:127-132`).

6. **Project schema version 2.** `CURRENT_PROJECT_SCHEMA_VERSION` moves from 1 to 2
   (`packages/components/src/project-migrate.ts:21`). The migration stays non-destructive and
   idempotent, exactly as `migrateProject` is today
   (`packages/components/src/project-migrate.ts:82-115`), and keeps today's rejections: a higher
   schema version, an unknown component type, and a clip whose `propsVersion` is newer than its
   component's (`packages/components/src/project-migrate.ts:37-44`, `:88-93`). What changes for an
   existing document: the chart clip's inline `bars` become a project-level series entry and the
   clip's `props.seriesId`; the chart's flat props become chart props v2 (`seriesId`, `panes`,
   `clock`, `style`); every bar carries a deterministic id; and `durationInFrames` is joined by
   `durationMode: 'fixed'` so no saved project changes length.

7. **The component contract gains two optional fields, and nothing else.** `VideoComponentDefinition`
   (`packages/core/src/contract.ts:83-124`) gains:

   - `evaluate?: (input: { clip, props, sceneFrame, project }) => unknown` — a pure step that runs
     once per clip per frame before render, and whose result is passed to the adapter through
     `ComponentRenderContext.evaluated`. A definition without `evaluate` behaves exactly as today.
   - `transportActions?: TransportAction[]` — element-declared buttons the shell renders in the
     floating transport bar (`apps/studio/src/components/PreviewPanel.tsx:362-418`) and executes
     generically. No component name is hardcoded in `apps/studio`.

   `packages/core` still imports no React, Remotion, Zustand or storage code: `evaluate` receives
   `Project` as data.

8. **Curves are data, evaluated by one pure function, and the legacy effect vocabulary is not
   rewritten.** `packages/core` gains a `Curve` type and an `evaluateCurve` evaluator with no Remotion
   import. The existing effect easing vocabulary stays on Remotion's `Easing`
   (`packages/components/src/base/effects.ts:17-48`) so no rendered frame of an existing project
   changes. The shared `EASING_PARAM` gains the `custom` option and a matching bezier text
   parameter (`packages/components/src/base/effects.ts:50-55` today offers neither), and the effects
   that are currently static or linear — `fadeIn`, `fadeOut`, `blurIn`
   (`packages/components/src/base/effects.ts:69`, `:77`, `:381`) — gain an easing parameter, while
   `spinIn` and `bounceDrop` gain one in place of their hardcoded curve.

9. **Registration is unchanged and the library tab mapping is explicit.** A new element type is
   registered through `registerComponent` (`packages/core/src/registry.ts:13`) and appears in the
   library only if the library tab names it (`packages/ui/src/components/library/catalog.tsx:14-42`).
   The chart tab names `candlestickChart` today (`packages/ui/src/components/library/catalog.tsx:36`).

## Owner decisions

The design leaves three choices to the owner because each has a visible alternative. This ADR does
not pick one silently; it records the position the design takes and the alternative that stays open
until the owner decides.

### Drawings are clips; panes live inside the chart clip

- **Position:** a drawing is a `Clip` with its own `ElementType`, track position, in/out frames and
  effects stack. It names a `chartClipId` and a `paneId`. Panes are data inside the chart clip's
  props.
- **Why:** OB-003 requires a drawing to anchor to `(chartId, candle/time, price)` — a reference
  *out* of the drawing, which makes it a sibling of the chart in the scene graph, not a child of it.
  OB-001 lists the drawing kinds alongside chart and chart group as object types.
- **Alternative:** make drawings children of the chart clip. It would keep the chart's collection in
  one place, but it contradicts OB-003's anchor shape and removes drawings from the scene timeline
  and from the layer order.
- **Decided by:** product owner.

### The relation between panes is declared, and a cross-instrument link is authored until an importer exists

- **Position:** the shared clock exists and is explicit. A pane binds to it as `reference`,
  `offset` or `utc`. The relation *between* panes is a declared `PaneRelation` in the chart props,
  in one of exactly two kinds. A **rollup** — one asset at two timeframes — reads the same source
  in both panes and aggregates it as-of, so it is exact by construction and the timeframe ratio is
  derived from the two panes' factors. A **lockstep** — two assets on the same timeframe — reads
  two different series, shows the same number of candles in both and advances them together on the
  shared clock. With import deferred there are no real timestamps anywhere in the product, so the
  two instruments in a lockstep have no shared market truth: the link is **authored**, labelled in
  the inspector as "authored link — not market time" and recorded as authored in the export
  metadata. When an importer lands, the UTC binding replaces the authored one and nothing else
  moves.
- **Alternative:** ship linked panes only for one instrument at two timeframes and defer
  side-by-side different instruments entirely. That is more honest about the data and delivers less
  of the brief.
- **Decided by:** product owner.

### The legacy effect easing vocabulary stays on Remotion's `Easing`

- **Position:** existing effects keep their `easing` string parameter and the `getEasing` mapping
  (`packages/components/src/base/effects.ts:17-48`). The new `Curve` evaluator is used by the new
  curve-driven surfaces — elements, panes, the chart-level default — and the effect controls are
  extended, not replaced.
- **Why:** the alternative would change the rendered frames of existing projects, because the
  preset names overlap (`linear`, `easeIn`, `easeInOut`, `bounceOut`, `elastic`, `overshoot` are in
  both vocabularies, `packages/components/src/base/effects.ts:7-15`) and the two do not agree
  everywhere — `bounceOut` is `Easing.bounce` today and is not `Easing.out(Easing.bounce)`.
- **Alternative:** move every effect onto `packages/core`'s evaluator. One vocabulary, but a
  re-render of every existing project and a migration of every stored effect parameter.
- **Decided by:** product owner.

## Alternatives considered

| Approach | Advantage | Problem | Decision |
|---|---|---|---|
| Keep `bars` inline on the chart clip and add drawing props to it | Smallest diff; no migration | A chart cannot be a collection of independently-timed elements, and the same dataset cannot back two charts without duplication | Reject |
| A second object graph: panes and drawings as their own scene objects with their own persistence | Elements would be first-class everywhere | Duplicates the clip lifecycle, inspector, serialisation and export path; conflicts with "one model, not two" | Reject |
| Drawings as children of the chart clip | The chart's collection lives in one place | Contradicts OB-003's `(chartId, …)` anchor and removes drawings from the timeline and layer order | Reject |
| A `Datasource` interface with one implementation (a synthetic generator) | Interfaces are familiar | The importer's needs are not known yet, so the interface would be guessed; and a seam with one implementation is a wrapper | Reject — the seam is a pure function boundary with four origins |
| Resolve pane state through a React context or a global editor store | No contract change | Editor state cannot reach the export path; it breaks TL-007's "every frame evaluable from a frozen snapshot" | Reject |
| Resolve market anchors inside the render adapter by reading the store | Smallest contract change | Non-deterministic, editor-dependent rendering; breaks EX-003's preview/export parity | Reject |
| A registry-driven `evaluate` step, pure, run once per clip per frame | One contract extension; the shape ADR-003 already described conceptually | One more optional field in the definition | **Select** |
| Transport actions hardcoded in `apps/studio` by component name | No contract change | The shell grows a per-component switch; the ADR-003 rule is that components declare and the shell executes | Reject |
| `transportActions` declared on the definition | The shell stays generic | One more optional field | **Select** |
| One easing vocabulary for everything | No overlap to reason about | Re-renders every existing project; changes stored effect parameters | Reject |
| A second `Curve` evaluator in `packages/core`, legacy effect vocabulary untouched | No existing frame changes; one evaluator for new surfaces | Two vocabularies coexist with overlapping preset names | **Select** |
| Reuse Remotion's `Easing` for the new `Curve` type as well | One vocabulary, no new evaluator | `packages/core` would import Remotion, breaking the rule that it imports no React or Remotion | Reject |

## What this changes

- **The persisted document.** Schema version 2: a project-level `series` registry, chart props v2,
  stable bar ids, `durationMode`, and a transition slot on the track boundary
  (`packages/components/src/project-migrate.ts:21`).
- **The component contract.** Two optional definition fields, `evaluate` and `transportActions`, and
  one optional context field, `evaluated` (`packages/core/src/contract.ts:22-29`, `:83-124`).
- **`packages/core`.** New pure modules for series, path generation, curves and time evaluation; the
  package keeps its no-React, no-Remotion, no-storage-import rule.
- **The inspector.** Per-element panels replace the generic parameter list for charts, and a curve
  editor appears wherever a curve is exposed.
- **The chart renderer.** Pane state comes from one evaluation function rather than from the inline
  bar array, and the scale policy becomes explicit (`auto` or `fixed`).

## What this does not change

- **The object vocabulary of the editor.** A scene object is still a `Clip` on a `Track` in a
  `Project`; no new top-level concept is introduced.
- **The component registry's rules.** `type` is still the persisted stable id, ids are never
  renumbered, renamed or reused, and `provenance` still travels with adapted third-party source
  (ADR-003).
- **The preview/export parity rule.** `evaluate` and the pane evaluation are pure and shared, so
  EX-003 holds; the render gate `node scripts/verify-r1.mjs` remains the proof that a change reached
  the video path.
- **The local-first invariant.** No network call, login or server is required to edit, save, preview
  or export. The seam has no importer, no file reading and no wizard.
- **The legacy effect vocabulary and every existing rendered frame.** The third owner decision keeps it.
- **The duration ceiling.** There is none. The 8-second figure is the seeded sample project's value
  (`packages/core/src/sample-project.ts:8` declares 240 frames at 30 fps, and
  `scripts/verify-r1.mjs:35` builds its fixture with the same 240); the editor's seconds field
  allows up to 3600 (`apps/studio/src/components/TopBar.tsx:406-412`) and the migration accepts any
  positive `durationInFrames` (`packages/components/src/project-migrate.ts:100-102`).
- **The unimplemented roadmap stages.** R2's import half is still deferred and R3 has still not
  started; this decision changes what R3 will build, not what has been built.

## Consequences

**Good:** one object model, so a drawing is editable, layered, timed and exportable with no new
machinery; series are shared by reference; a real importer lands behind a seam that already has the
shape it needs; the anchor model makes CPT-005 true by construction rather than by discipline; the
market clock and its binding are explicit, so the editor never claims a market-time alignment it does
not have.

**Costs:** a schema migration that must not change a single rendered frame of an existing project;
two overlapping easing vocabularies to reason about, bounded by the third owner decision; a per-frame
evaluation step that every clip in a composition pays for; a wider inspector surface with per-element
panels; and an `apps/studio` that must learn to render a registry-declared transport bar.

**Limits accepted for now:** no importer, no file reading, no wizard; no UTC time basis; no overlay
model for imported bars — an `imported` series' bars are never mutated in place by any command in
this slice, and the overlay work is the first task of the import slice; the swing path is an
*authoring* device and nothing here infers structure from data; the derived-duration mode covers
clips and chart elements, not the scene hierarchy that lands with R6.

## Exit strategies

| Introduced thing | How it leaves |
|---|---|
| The `series` registry | A document-level field. A future version drops it by inlining bars again; the migration direction is reversible. |
| The `Datasource` seam | It is a pure function over a discriminated union. An importer adds a producer for the `imported` variant; nothing above the line changes. |
| `evaluate` on the definition | An optional field. A definition that does not need it never sets it. |
| `transportActions` on the definition | An optional field. The shell's generic renderer is the only consumer. |
| The `Curve` type and `evaluateCurve` | One module in `packages/core` with no Remotion import. Removing it is a deletion; the legacy effect vocabulary never depended on it. |
