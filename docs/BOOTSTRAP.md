# Bootstrap — running and verifying this repository

Chart Studio is a fork of `kr4ckhe4d/Remotion-Animator-Studio`: a React + TypeScript + Vite +
Zustand + Remotion video editor being reshaped into a local-first, trading-native video studio.

The editor runs entirely in the browser. Remotion is the only video engine. There is no backend,
no account and no network call in the editing path.

## Prerequisites

- Node.js 22+ (developed on 24.20) and npm 10+.
- A Chromium-family browser for the preview. The Remotion renderer uses the Chrome Headless
  Shell that Remotion downloads into `node_modules/.remotion` on first export.

## Install

```bash
npm install
```

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Vite dev server + the local render API (`server.mjs`) on port 3333 |
| `npm run dev:web` | only the Vite dev server |
| `npm run typecheck` | `tsc -b` — the type gate, no emit |
| `npm test` | Vitest, single run (node environment) |
| `npm run test:watch` | Vitest in watch mode |
| `npm run build` | typecheck + production bundle into `dist/` |
| `npm run render -- <project.json> <out.mp4>` | CLI export of a saved project through Remotion |
| `node scripts/verify-r1.mjs` | renders the R1 verification project to stills (`out/verify/`) and an mp4 (`out/chart-studio-r1.mp4`) |

## Where things live

```
src/
  registry/          the component contract and the registry
    types.ts         VideoComponentDefinition, render/inspector contexts  (normative)
    registry.ts      registerComponent / getComponent / listComponents
    legacy.ts        the 22 inherited editor elements, as registry definitions
    index.ts         public entry — import a definition module here to register it
  trading/           first-party trading components
    ohlc.ts          pure OHLC maths: synthetic series, intrabar simulation, frame mapping
    candlestick-chart.tsx       the chart render adapter (pure: props + frame -> svg)
    candlestick-chart-inspector.tsx  the OHLC editing panel
    definition.ts    the chart's registry definition
  motion-components/ adapted Remocn source, vendored with licence + provenance
  project/migrate.ts project document migrations (schema version, component type, props version)
  remotion/          the composition and the inherited element renderers
  components/        Library, Timeline, Inspector, PreviewPanel, TopBar
remotion/            Remotion entry point (Composition id="Main")
docs/                the Chart Studio design documents
```

## Adding a component

1. Write a definition module that exports a `VideoComponentDefinition` and calls
   `registerComponent(...)` on import.
2. Give it a stable `type` (a new member of `ElementType` in `src/types.ts`) — the ID is
   persisted in project files and must never be renumbered or reused.
3. Implement `render` as a pure function of `(clip, props, frame, fps)`. No editor state, no
   DOM, no clock, no unseeded randomness.
4. Add `params` for the generated inspector controls, and an `inspector` panel when a component
   needs a richer editor (a chart's OHLC table, for example).
5. Import the module in `src/registry/index.ts` so the library, timeline, inspector and the
   composition all see it.

The rules and the acceptance mapping are in
[`docs/spec/COMPONENT_CONTRACT.md`](spec/COMPONENT_CONTRACT.md).

## Verifying a change

```bash
npm run typecheck      # types
npm test               # unit + component tests
npm run build          # typecheck + bundle
node scripts/verify-r1.mjs --stills   # real Remotion render of the verification project
```

The last command is the only one that proves the change reaches the *video* path: it bundles the
Remotion entry and renders PNG stills through the same pipeline the export uses. Stills land in
`out/verify/`.

## Documents

| Document | Purpose |
|---|---|
| [docs/architecture/UPSTREAM_AUDIT.md](architecture/UPSTREAM_AUDIT.md) | what the upstream editor was, what R0/R1 changed, risks and known debt |
| [docs/spec/COMPONENT_CONTRACT.md](spec/COMPONENT_CONTRACT.md) | the typed component contract (normative) |
| [docs/decisions/ADR-003-COMPONENT-SYSTEM.md](decisions/ADR-003-COMPONENT-SYSTEM.md) | why the component system exists and what it must guarantee |
| [docs/roadmap/ROADMAP.md](roadmap/ROADMAP.md) | the delivery sequence |
| [docs/superpowers/plans/2026-10-25-chart-studio-scaffold.md](superpowers/plans/2026-10-25-chart-studio-scaffold.md) | the R0/R1 scaffold plan and what it actually produced |
