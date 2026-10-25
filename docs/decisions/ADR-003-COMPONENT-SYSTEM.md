# ADR-003 — Source-owned Component System From Day One

**Status:** Selected architecture; implementation feasibility and licensing remain subject to the standard R0/R1 gates.  
**Date:** 2026-10-24  
**Depends on:** [ADR-001 — Video Stack](ADR-001-VIDEO-STACK.md), [Technical Architecture](../architecture/TECHNICAL_ARCHITECTURE.md).

## Decision and intent

**Remotion is the only authoritative video composition, timing, preview and export engine. Remocn is the default source-owned motion component framework. Chart Studio's own typed trading/video component library is a required foundational subsystem in the very first engineering slice, not a post-MVP enhancement.** A specialized video editor cannot function without an editable library of domain-specific scene objects.

Use Remocn's shadcn-style source registry to install and adapt useful generic Remotion visuals (titles, effects, transitions, backgrounds) *when the actual component is needed*. It is not a substitute for the Chart Studio object catalog. Our trading component library is built alongside the first Remotion prototype and obeys the same shared scene-object protocol. Registry-publishing our internal library publicly is deferred; constructing and using it internally is P0.

## Alternatives and trade-offs

| Approach | Advantage | Problem | Decision |
|---|---|---|---|
| Render every object as bespoke editor widget | Quick individual demos | Duplicated lifecycle, inspector, serialization and export pathways | Reject |
| Force trading semantics into Remocn components | Reuses ready-made visual components | Remocn does not model OHLC/SMT/MTF/price anchors | Reject |
| **Shared component contract: first-party trading library + source-owned Remocn visuals + Remotion** | One lifecycle/inspector/timeline/render protocol, reuse when practical | Upfront typed adapter and catalog work | **Select** |

## Three different component responsibilities

1. **Trading domain components (`packages/trading-components`) — custom from R1:** `CandlestickChart`, `HighLowLine`, `HorizontalPriceLine`, `TrendLine`, `PriceZone`, `LongShortPosition`, `Arrow`, `TextLabel`, `SMTComparison`, `ChartGroup`. Each has a validated typed schema, rendering adapter and inspector/tool descriptor. HTF and LTF are chart instances or groups with independent data/timeframe bindings, not separate Remotion runtimes.
2. **General motion components (`packages/motion-components`) — source-owned Remocn-based library:** titles, kinetic typography, backgrounds, reveals, motion transitions and similar visuals. Source is installed/copied at the pinned revision, with license notices and local modifications tracked. Wrap components only when necessary to adapt them to timeline/object props.
3. **Video runtime (`packages/scene-compositor`) — Remotion:** `Composition`, `Sequence`, `AbsoluteFill`, transitions, `useCurrentFrame()`, preview player and export. The scene compositor maps typed video objects to rendering components; it never owns candle arithmetic or SMT matching.

The editor uses **shadcn/ui for controls** such as inspector inputs, buttons and dialogs. This is distinct from **Remocn for visual video content**. Do not place editor selection handles or Zustand hooks inside exportable components.

## Required component protocol

A component definition includes:

- Stable `type` and `schemaVersion`, with Zod-validated `props` and `defaultProps`.
- `render` adapter consuming a *pure evaluated object/frame state*, resolving data references outside the visual component.
- `editor` descriptor for inspector fields, icons, tool interactions, allowed anchoring and handle behavior.
- `animation` metadata for eligible keyframe properties and supported interpolation.
- Asset references and serialization/migration rules, plus capabilities supported by browser export.
- Preview/export snapshots and provenance/license metadata when third-party source is used.

A scene object instance includes `id`, `componentType`, `startFrame`, `endFrame`, `zOrder`, local transform, lifecycle animations and typed properties. Its active interval is `[startFrame,endFrame)`. The same property and market state must render at the same frame in both preview and export.

Conceptual API (to be finalized as typed Zod schemas at R1):

```ts
interface VideoComponentDefinition<Props, Evaluated> {
  type: string;
  schemaVersion: number;
  propsSchema: z.ZodType<Props>;
  defaults: Props;
  evaluate(input: {
    props: Props;
    sceneFrame: number;
    snapshot: ProjectSnapshot;
  }): Evaluated;
  renderer: React.ComponentType<{ state: Evaluated }>;
  editor: EditorDescriptor<Props>;
  keyframable: readonly (keyof Props)[];
}
```

This shows *the contract shape*, not an instruction to pass huge snapshots into every component: complex data is resolved/cached by chart/scene evaluators before render. Build-time/registry metadata and typed render registrations may be stored separately to avoid circular dependencies.

## First-party trading catalog — P0

| Component | Domain behavior | Minimum editing/animation behavior |
|---|---|---|
| `CandlestickChart` | OHLC series, chart axes, data provenance, viewport | Candle-by-candle and OHLC-consistent intrabar reveals; scale/position/opacity; independent lifespan |
| `ChartGroup` | 2/3 assets, HTF/LTF slots and market-time policy | Grid/side-by-side/PIP layout; independent panel transform and synchronized-or-frozen cursors |
| `HighLowLine` | Candle/bar high or low anchor | Extend, label, reveal, fade, move with chart |
| `HorizontalPriceLine` | Market price or scene-space anchor | Set precise level, style, width, animate in/out |
| `TrendLine` | Two chart/market anchors | Edit endpoints, animated draw progress |
| `PriceZone` | Time/price bounds | Fill/opacity, extend, staged reveal |
| `LongShortPosition` | Entry, stop, target, direction and optional risk/reward | Editable handles and reveal order |
| `Arrow` / `TextLabel` | Scene- or market-relative annotation | Position, duration, text/style, fade/slide/draw |
| `SMTComparison` | References user-confirmed pivot pairs/observation | Staged A↔B or A↔C swing reveal and source-integrity diagnostics |

A manual candle builder is an **editor tool and domain operation**, not necessarily a separate video component; it creates/edits the candle source consumed by `CandlestickChart`.

## Rendering and editing flow

```text
SQLite/OPFS source dataset + scene objects
             │
             ▼
Pure domain/frame evaluator (SMT/MTF/partial candles)
             │
             ▼
Component registry lookup by object type
             │
       ┌─────┴─────────┐
       ▼               ▼
Custom trading      Remocn-owned
video objects       motion objects
       └─────┬─────────┘
             ▼
Remotion scene composition
       ┌─────┴─────────┐
       ▼               ▼
Remotion Player    Remotion export
```

The canvas editor overlays interactive handles over the video objects and uses commands to change canonical project props. Remocn source components may be visually adapted, but if an effect has non-deterministic timing, unsupported browser render behavior or inaccessible property interfaces, choose a different component or implement the narrowly needed effect. Do not sacrifice preview/export parity to reuse a library.

## Foundational release gates

- **CPT-001:** Registry dispatch resolves a typed candle chart from scene-object data; inspector edits cause a command and an identical evaluated frame on reseek.
- **CPT-002:** A Remocn-sourced title effect is installed as source, receives frame-driven props, and plays/exports correctly; source license/provenance is recorded.
- **CPT-003:** A custom HighLowLine and CandlestickChart compose together within one Remotion scene; both retain independent frame intervals and transitions.
- **CPT-004:** One scene displays independent HTF and LTF chart instances side by side with their own frame lifecycles and market-time mappings.
- **CPT-005:** Editor drag handles never appear in exported output; drawing anchors remain on their intended market values during transform/zoom.
- **CPT-006:** Component definition migrations validate existing portable archives and safely reject unsupported future component schema versions.

## Boundaries

No Remocn component is treated as a trading analysis engine. No custom scene object runs its own free-running `setInterval`, animation RAF clock or video player. No copied component enters the canonical project document as executable code; persist typed component IDs, props, keyframes and immutable asset references. The component library is essential from R1, but a *public* component registry, arbitrary user plugins and public API are not MVP work.
