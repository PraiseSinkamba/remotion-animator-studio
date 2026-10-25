# ADR-002 — Reuse policy and concrete third-party library shortlist

**Status:** Proposed, to be validated during R0/R1 technical spikes · **Date:** 2026-10-24.  
**Goal:** keep implementation familiar to TypeScript/React coding agents, avoid rebuilding mature generic UI/video infrastructure, and reserve custom work for trading-aware behavior.

## Shortlist by job

| Job | Preferred reusable solution | What we keep custom | Gate |
|---|---|---|---|
| React video composition | `remotion`, `@remotion/player`, `@remotion/transitions` | Market-time binding, chart state evaluation, object-specific timeline semantics | Preview and export parity |
| Browser video export | `@remotion/web-renderer`, Remotion media + Mediabunny integration | Render snapshot, job UX, asset-resolution and failure policy | Supported Chromium 1080p/30fps + audio test |
| General-purpose video motion **(primary framework)** | [Remocn](https://remocn.dev/) shadcn-style, source-owned components | Internal registry integration, lifecycle and inspector adapters | Per component imports/license/render compatibility |
| Specialized trading video components **(required R1 work)** | First-party `packages/trading-components` library | All OHLC/SMT/MTF/trading object visuals, metadata and editing behavior | Component protocol tests and preview/export parity |
| General UI | Next.js + React, Tailwind, shadcn/ui, Lucide | Chart inspector and creator-specific editing workflows | Offline-safe app-shell spike |
| Drag/drop/sortable | [dnd-kit](https://dndkit.com/react/quickstart/) | Frame ruler, clip trim/snap, scene-local/global mappings | 100+ clip interaction test |
| Resizable panels | `react-resizable-panels` (candidate) | Panel persistence and chart object handles | keyboard and desktop performance |
| Runtime app state | Zustand | Pure domain model/commands/persistent revision state | no React imports in domain packages |
| Runtime schemas | Zod | Versioned project/domain schemas and invariants | round-trip and migration tests |
| Market coordinate scaling | `d3-scale` or small math adapters (candidate) | Session alignment, chart/scene transform layers, partial candle geometry | accurate price/time anchors, output parity |
| CSV parsing | Papa Parse or equivalent streaming parser (candidate) | Provider column mapping, timezone semantics, OHLC validation | malformed and 100k-row fixtures |
| Timeline virtualization | `@tanstack/react-virtual` (candidate) | video-clip semantics/keyframe overlaps | bounded DOM nodes |
| Archive compression | `fflate` or equivalent Zip library (candidate) | project manifest, checksums, atomic import, zip-slip defenses | clean-profile roundtrip + adversarial archive |
| Local persistence | `@sqlite.org/sqlite-wasm` + browser OPFS | worker RPC, schema, revisions and asset transactions | VFS/two-tab/quota/worker spike |
| UI, integration and E2E tests | Vitest + Testing Library + Playwright | authored trading fixtures, frame and source-integrity assertions | SC-08 release workflow |

**Version policy:** only add packages when a slice consumes them. Pin Remotion packages to the same compatible version, record exact lockfile state, and check licensing for all copied code. This shortlist is not a command to install every package.

## Reuse vs custom principles

- **Reuse known, generic mechanics:** video composition, React rendering, transitions, player transport, codec/export, typography, UI panels, drag/drop, CSV parse, ZIP encode, storage VFS and tests.
- **Build first-party components from day one where trading semantics matter:** charts, candles, high/low lines, trendlines, zones, positions, arrows, texts and SMT/MTF compositions must share a typed internal component protocol, lifecycle, inspector metadata, animation properties, market anchors and preview/export parity. See [ADR-003](ADR-003-COMPONENT-SYSTEM.md).
- **Build where domain correctness matters:** source OHLC provenance, no-lookahead HTF, pivot eligibility, SMT pair confirmation, market-price anchors, chart-object time mappings, user-authored hypothetical scenarios.
- **Implement adapters rather than fork libraries:** e.g. `ChartVideoObject` renders through Remotion but uses pure `evaluateChartAtFrame` computed by market domain; `TimelineClipRow` uses dnd-kit but persists commands via `editor-core`.

## Why not adopt a generic video editor wholesale?

The [Remotion Editor Starter](https://www.remotion.dev/docs/editor-starter) is a serious paid accelerator offering timeline, interactive canvas, assets and undo/redo. It may be worth purchasing to accelerate the general editor shell, but it does not understand chart price/time anchors, manual OHLC editing, no-lookahead MTF or user-confirmed SMT. Adapting its internal data shape may cost more than using lower-level Remotion libraries for a tightly focused first version. Procurement and source inspection are required before an agent may assume it exists.

Remotion's [paid Timeline](https://www.remotion.dev/docs/timeline/) also includes zoomable tracks and drag interaction and could replace much UI work; it carries a separate license. `dnd-kit` plus a small native timeline remains the unpaid fallback. [React Video Editor / RVE Pro](https://www.reactvideoeditor.com/docs/core/components/timeline) offers another timeline path, but its licensing and architecture must be reviewed before integration; do not assume its Pro documentation grants free source rights.

[TradingView Lightweight Charts](https://tradingview.github.io/lightweight-charts/docs/plugins/intro) has valuable chart primitives/custom series, but an independent canvas/widget state could undermine Remotion export parity and animation of partial candles. It is a potentially useful **data inspection view**, not the canonical output renderer in v1. Our chart visuals will be reusable React/SVG components inside Remotion, with chart-world transforms generated in pure TypeScript.

## Next.js and true offline-first operation

Use Next.js as the app shell if **static/client-only editor routes** and the installed service worker can load all required code, Remotion bundles, fonts, WASM and UI while offline. Require an offline refresh test after the initial successful visit. Favor static export/cached app-shell architecture and avoid runtime server actions for core features. If Next.js SSR/App Router route hydration prevents reliable offline refresh under the target browser, formally reassess a Vite + React SPA shell; the domain and renderer packages must remain unchanged. This is an implementation feasibility choice, not a change in product scope.

**Why this matters:** selecting Next.js does not itself deliver offline-first behavior. OPFS holds project data, but the application shell and worker/WASM scripts must also remain available offline.

## Component adoption review checklist

- Is it compatible with the chosen React and Remotion versions?
- Does it render reliably under `@remotion/web-renderer` (not only in normal DOM preview)?
- Can we pass explicit frame/time and seed with no `Date.now()`/`requestAnimationFrame` dependence?
- Does it preserve semantics of project object lifetime/in-out frames and transform?
- Is its license compatible with app distribution, including attribution requirements and source redistribution?
- Is its API smaller/easier to maintain than a custom alternative for the exact MVP use?
- Can it be replaced behind an adapter without migrating market data or project archives?

## Decisions intentionally not fixed yet

- Whether paid Remotion Timeline/Editor Starter provides a measurable benefit worth purchase.
- Whether React SVG alone meets the 3-chart export and performance target or Canvas is needed for candle drawing.
- Which SQLite OPFS VFS works best in supported browsers and single-writer model.
- Which ZIP/CSV/virtualization helper is most stable at implementation time.

All are R0/R1 spikes. No agent may silently substitute a different video runtime to work around a local integration issue.
