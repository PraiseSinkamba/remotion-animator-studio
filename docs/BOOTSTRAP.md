# Bootstrap — running and verifying this repository

Chart Studio is a fork of `kr4ckhe4d/Remotion-Animator-Studio`: a React + TypeScript + Vite +
Zustand + Remotion video editor being reshaped into a local-first, trading-native video studio.

The editor runs entirely in the browser. Remotion is the only video engine. There is no backend,
no account and no network call in the editing path.

## Prerequisites

- Node.js 22+ (developed on 24.20) and npm 10+.
- A Chromium-family browser for the preview. The Remotion renderer uses the Chrome Headless
  Shell that Remotion downloads into `node_modules/.remotion` on first export.

## Hosting the built app

The app stores projects in a SQLite database that lives in the browser's origin private file
system. The SQLite WASM documentation prescribes **cross-origin isolation** for that path, so
the host that serves `dist/` should send:

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: credentialless
```

`npm run dev` and `npm run preview` already send them. `credentialless` rather than
`require-corp`: the editor can hold media from another origin, and `require-corp` blocks those
unless the other server opts in.

Without the headers the app still runs, and on Chromium 155 the database still persists — but a
browser that cannot provide them falls back to ordinary browser storage, and the top bar says
so.

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
| `npm run preview` | serves the built `dist/` with the headers the local database needs |
| `npm run render -- <project.json> <out.mp4>` | CLI export of a saved project through Remotion |
| `npm run docs:gifs` | regenerates the documentation GIFs |
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
  storage/           local persistence behind one interface
    types.ts         WorkspaceRepository — the port the editor talks to  (normative)
    contract-suite.ts the machine-checked contract every backend must pass
    select.ts        chooses and opens a backend
    sqlite/          official SQLite WASM in a worker, database in OPFS
    local/           localStorage and in-memory fallbacks
    useWorkspace.ts  the React binding: autosave, restore, storage status
  remotion/          the composition and the inherited element renderers
  components/        Library, Timeline, Inspector, PreviewPanel, TopBar, StorageIndicator
    ToolRail.tsx     the full-height tool rail on the left of the shell
    theme-toggle.tsx the light/dark switch in the top bar
    selection-overlay.tsx  the dashed selection box and its corner handles (editor only)
    canvas-hit-test.ts      which element is under the pointer (pure)
    library/         the tabbed library pane: cards, rows, group headers, view toggle
    inspector/       the inspector's sections, rows and parameter controls
    timeline/        track rows, clip chips, the ruler and the lane packing
    ui/              the shadcn/ui primitives — copied source, editor chrome only
  lib/utils.ts       cn() — the class-name helper the primitives use
  lib/theme.tsx      the theme provider: light, dark or system, persisted
  index.css          the one stylesheet: Tailwind layers, light/dark tokens, legacy rules
remotion/            Remotion entry point (Composition id="Main")
components.json      the shadcn project configuration (base radix, style radix-nova)
docs/                the Chart Studio design documents
```

## The shell

```
+---------------------------------------------------+
| tool rail | top bar                               |
|           | library | canvas + transport | inspector|
|           |---------------- timeline ------------|
+---------------------------------------------------+
```

- The **tool rail** is the leftmost column of the whole editor: it runs past the top bar and
  past the timeline. It shows the tools that exist today — Select, and the canvas drawing tools
  the current selection makes meaningful.
- The **library** filters the catalogue into `Presets · Text · Media · Audio · Scene · Chart ·
  Motion` and toggles between a card grid and a compact list.
- The **transport** floats over the bottom of the canvas: skip, a round play button, mute and
  the time readout. The canvas also carries its size chip (bottom left) and the active layer's
  name (bottom right).
- The **inspector** is split into `Properties | Effects`; `Properties` holds the `CLIP`,
  `POSITION`, `PROPERTIES` and `ACTIONS` sections.
- The **timeline** gives every track one row per overlapping clip, so a clip is never hidden
  under another one.

## Light and dark modes

The active mode is a class on `<html>` (`.dark`), set by `src/lib/theme.tsx` and by the
pre-paint script in `index.html` so the shell never flashes the wrong mode. The tokens live in
`src/index.css`: `:root` carries the light values and `.dark` overrides them. The choice is
stored under `chart-studio-theme` and defaults to `system`.

The hand-written rules in `@layer legacy` no longer own a palette: they read the semantic
tokens through aliases (`--bg`, `--panel`, `--accent`, …), so they follow the mode.

## Styling: Tailwind v4 and shadcn/ui

The editor chrome is styled with **Tailwind CSS v4** and **shadcn/ui**. The primitives are
copied source, not a runtime package: they live in `src/components/ui/` and are maintained
here.

- **One stylesheet.** `src/index.css` holds everything. It imports Tailwind's theme and
  utilities layers, declares the shadcn token block in `@theme inline` plus the `:root`
  variables, and keeps the surviving hand-written rules inside `@layer legacy`. The layer
  order is `@layer theme, base, components, legacy, utilities;`.
- **Preflight is not imported.** Only `tailwindcss/theme.css` and `tailwindcss/utilities.css`
  are imported. The in-app preview renders inside the app document while the export bundle
  imports no CSS at all, so importing preflight would change the preview and not the export.
  The parts the editor needs — the border reset, the inherited form-control font and the
  button background reset — are re-declared by hand in `@layer base`.
- **The Vite plugin, not a PostCSS config.** `@tailwindcss/vite` is registered in
  `vite.config.ts`. There is no `tailwind.config.js`; the configuration lives in CSS.
- **The `@/` alias.** `@/*` resolves to `./src/*` in both `vite.config.ts` and
  `tsconfig.json` (`paths`, without `baseUrl`). The generated primitives import `cn` from
  `@/lib/utils`.
- **The app is always dark.** `@custom-variant dark (&:is(.dark *));` and `<html class="dark">`
  keep the `dark:` variant tied to the document instead of the OS preference.
- **Editor chrome only.** No `src/components/ui/*` import may appear in `src/remotion/`,
  `src/registry/`, `src/trading/` or `src/motion-components/` — those are the video path.

The dependency record — versions, licences, the measured bundle cost and the exit strategy —
is in [`docs/decisions/ADR-005-SHADCN-AND-TAILWIND.md`](decisions/ADR-005-SHADCN-AND-TAILWIND.md).

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

For the things a test suite cannot check — the storage in a real browser, the one-writer rule,
the fallback — follow [`docs/quality/MANUAL_TEST_FLOWS.md`](quality/MANUAL_TEST_FLOWS.md).

## Documents

| Document | Purpose |
|---|---|
| [docs/architecture/UPSTREAM_AUDIT.md](architecture/UPSTREAM_AUDIT.md) | what the upstream editor was, what R0/R1 changed, risks and known debt |
| [docs/architecture/STORAGE.md](architecture/STORAGE.md) | how projects are stored: the port, the backends, the schema, the one-writer rule |
| [docs/spec/COMPONENT_CONTRACT.md](spec/COMPONENT_CONTRACT.md) | the typed component contract (normative) |
| [docs/decisions/ADR-004-STORAGE-PORT.md](decisions/ADR-004-STORAGE-PORT.md) | why persistence sits behind an interface, and what the SQLite backend costs |
| [docs/decisions/ADR-005-SHADCN-AND-TAILWIND.md](decisions/ADR-005-SHADCN-AND-TAILWIND.md) | the editor control layer: shadcn/ui and Tailwind v4, what they cost and how to leave them |
| [docs/decisions/ADR-003-COMPONENT-SYSTEM.md](decisions/ADR-003-COMPONENT-SYSTEM.md) | why the component system exists and what it must guarantee |
| [docs/roadmap/ROADMAP.md](roadmap/ROADMAP.md) | the delivery sequence |
| [docs/quality/MANUAL_TEST_FLOWS.md](quality/MANUAL_TEST_FLOWS.md) | what to click in the browser to check the editor, the chart and the storage |
| [docs/superpowers/plans/2026-10-25-chart-studio-scaffold.md](superpowers/plans/2026-10-25-chart-studio-scaffold.md) | the R0/R1 scaffold plan and what it actually produced |
