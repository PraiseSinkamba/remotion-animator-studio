# ADR-001 — Remotion-first video editor; domain-native trading renderer

**Status:** Remotion engine + Remocn framework + foundational custom trading components selected; remaining feasibility/licensing gates still apply.  
**Date:** 2026-10-24  
**Supersedes:** v1.1's Canvas2D-first renderer proposal, not its pure market-data and frame-evaluation requirements.  
**Decision owners:** Product owner + implementation lead.

## Context

Chart Studio is a local-first React/Next.js creative application. It needs deterministic video compositions, an editable timeline, audio/captions, scenes, local MP4 exports, and *highly specialized* chart interaction and SMT/MTF analytics. Rebuilding general-purpose video infrastructure is unnecessary. Conversely, generic video libraries do not understand candle source provenance, market timestamps, cross-market swing pairs, or higher-timeframe partial bars.

The supplied URLs are **not interchangeable**:

- [Remotion](https://www.remotion.dev/) is the React video framework, with [`@remotion/player`](https://www.remotion.dev/docs/player/player), [`@remotion/web-renderer`](https://www.remotion.dev/docs/web-renderer) and server [`@remotion/renderer`](https://www.remotion.dev/docs/renderer).
- [remocn](https://remocn.dev/) is a shadcn-style, MIT-licensed (as its current site states) registry of ready-made Remotion animation components. Its product is aimed at agents creating marketing/product demos. It is **not the video runtime**. See [Remocn's GitHub profile](https://github.com/Remocn).
- [framecn](https://www.framecn.dev/docs) provides shadcn-style motion components built on Editframe (not Remotion), with associated [Editframe elements](https://www.framecn.dev/docs/components/getting-started) and cloud rendering patterns. It is **not necessary** for our selected Remotion runtime.

## Options considered

| Option | Pros | Cons | Decision |
|---|---|---|---|
| A. Custom Canvas2D renderer + custom video encoder | Precise chart rasterization and full control | Rebuild timeline/media/audio/encode; preview parity burden | Not primary |
| B. Remotion compositions + typed chart React/SVG renderers | Reuses video composition, transitions, preview, browser export; React/TS familiar | Must respect browser-render CSS/DOM and performance limits | **Selected** |
| C. Editframe + framecn as foundation | Existing motion components, concise visual animations | Second runtime incompatible with Remotion-first asset and timeline architecture | Rejected for core |
| D. Remotion + multiple independent chart widgets | Fast interactive preview initially | Chart widget state, pointer controls, fonts/axes and browser export may diverge | Reference/prototype only |

## Decision

1. Implement video composition in React through **Remotion**. Each scene renders a pure React `SceneComposition`; a project uses a `ProjectComposition` with scene sequencing and transitions. Remotion provides presentation time, `useCurrentFrame`, sequences, preview and export.
2. **Custom typed trading domain** (OHLC, market-time map, series edits, SMT, MTF, drawing anchors) is separate and pure. Scene rendering calls `evaluateSceneAtFrame(snapshot, sceneId, frame)` and presents evaluated shapes/labels. Remotion does not become our data store or trading calculation engine.
3. Start with **SVG/React chart layers** for deterministic bars, price lines, zones, arrows and text; limit drawn bars to viewport and memoize geometries. Editor selection/resize/drag handles are an overlay that does not render in exports. Native `<canvas>` is a fallback *only after* a browser-export spike proves consistent capture and performance. Avoid TradingView-dependent export.
4. Use `@remotion/player` for a single authoritative video preview within the editor. A scene with three charts is **one video composition with three chart objects**, not three independently running video players. The app's timeline state controls the selected Remotion frame, not a competing render clock.
5. Use [`@remotion/web-renderer`](https://www.remotion.dev/docs/client-side-rendering) for browser rendering. It is documented as stable since v4.0.491 and uses WebCodecs with Mediabunny. Use `canRenderMediaOnWeb` and capability detection; do not guarantee H.264 if the browser cannot encode it. `@remotion/renderer` is an optional future server path. Keep composition/inputProps parity across them.
6. Adopt **Remocn as our default source-owned motion component framework**: use its shadcn-style registry to bring compatible Remotion titles/effects/transitions into `packages/motion-components`, check license/import/export behavior, and adapt them to our common lifecycle. Build **our first-party trading component library in R1** (`packages/trading-components`); generic Remocn components do not replace charts, SMT/MTF and trading tools. See [ADR-003](ADR-003-COMPONENT-SYSTEM.md). Do not blindly install every Remocn component or attach trading logic to an agent-driven prompting framework.
7. **Do not depend on framecn in v1**. Its Editframe runtime overlaps rather than complements Remotion. It may provide aesthetic inspiration or later experimental adapters after a dedicated ADR and parity tests; never assume Editframe elements run under Remotion.
8. For editor UI use React + TypeScript, Next.js App Router, shadcn/ui/Tailwind, Zustand for transient state, dnd-kit for scene/clip dragging and snapping. Implement only the minimal app-specific timeline behaviors not supplied by the selected starter.
9. Remotion [Timeline](https://www.remotion.dev/docs/timeline/) and [Editor Starter](https://www.remotion.dev/docs/editor-starter) are **paid, optional accelerators**. An agent must not assume purchase, source access or sublicense rights. Evaluate procurement before deciding custom timeline work. The open-source-independent path uses dnd-kit + custom frame ruler/clip components under our own typed timeline state.
10. TradingView [Lightweight Charts](https://tradingview.github.io/lightweight-charts/docs/plugins/intro) offers custom series and primitives useful as editor data-preview references; it is **not selected for source-of-truth video rendering** because output must support hypothetical intrabar paths, draggable video objects, scene transformations, and browser export. An optional inspect-only integration is acceptable after a small parity experiment.

## Most important caveat: client rendering

Remotion's browser renderer **does not support all HTML/CSS** and is single-concurrency; output depends on supported browser codecs and resources. See [client renderer limitations](https://www.remotion.dev/docs/client-side-rendering/limitations). Important restrictions include some CSS effects and z-index assumptions; render layered elements in explicit DOM order and rely on SVG where reliable. Unsupported browser combinations must offer an actionable diagnostic, still-image fallback and later optional server rendering — not a falsely successful render.

The [Remotion WebCodecs package](https://www.remotion.dev/docs/webcodecs) is being phased out in favor of Mediabunny. Do not build the main encoder around the older `@remotion/webcodecs` package.

## License and cost guardrails

Remotion has its own commercial license, and paid Timeline/Editor Starter have separate terms. According to [Remotion's current licensing FAQ](https://www.remotion.dev/docs/license/faq) and [pricing](https://www.remotion.dev/docs/license/pricing), individuals and small qualifying organizations may use the free license, while larger organizations and some automated/editor products may require a Company License. Legal/commercial eligibility depends on the organization and deployment; recheck before release. Do not describe core Remotion as MIT. Remocn claims MIT source ownership, but copied components retain notices and must be audited. Framecn claims its repository is MIT, but copying code does not make Editframe's service/runtime terms disappear.

## Spike gates before locking dependencies (P0)

- **SPK-RENDER-01:** React/SVG component that animates one partial candle, zone and caption at 0/50/100%; preview in Player, export via web-renderer, assert shape positions and elapsed frames. Run in supported Chromium versions.
- **SPK-RENDER-02:** 3 synchronized 1080p chart panels, fade between HTF/LTF, audio, local MP4, peak memory and codec support. Compare frames at transition midpoints.
- **SPK-RENDER-03:** Manual resize/select overlay visible in editor but not export; test SVG pointer interaction and font consistency.
- **SPK-TIMELINE-01:** Make a parent scene strip and nested 5-track editor with dnd-kit, trim, zoom, snapping and scrubbing; evaluate latency on 100+ clips.
- **SPK-LICENSE-01:** Review actual installed Remotion/remocn versions and licensing with the intended user/team/business model; document results.

If Remotion browser export fails a blocking requirement, first consider narrowing unsupported CSS / a supported canvas integration; next consider a server render option. Do not quietly reintroduce an entire second video engine.

## Consequences

**Good:** reuse mature composition, transitions, media and encoding; one React expertise set; clearer agent tasks; trading logic portable; early video-first progress.  
**Costs:** browser export compatibility spikes; careful separation of editor overlays; React SVG performance work for many candles; licensing checks.  
**Revisit when:** local browser output cannot meet minimum accepted video scenario, viewport culling cannot hit reference performance, license terms become unsuitable, or a purchased editor starter substantially changes the cost-benefit analysis.
