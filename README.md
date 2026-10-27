# Chart Studio

> **Status:** A working local-first video editor for trading content, built on Remotion.  
> **Date:** 2026-10-26

Chart Studio is a browser-based video editor for market-structure, SMT-divergence and
multi-timeframe breakdowns. It is a fork of `kr4ckhe4d/Remotion-Animator-Studio` being reshaped
into a trading-native studio. It is not a clone of any other product's assets or code.

## What it is today

- **A browser-based editor.** A timeline of typed scene objects, an inspector, a library, a
  preview that renders the same composition as the export, and a local render path. No account,
  no backend, no network call in the editing path.
- **A typed component registry.** Every element is a registry definition with a stable type, a
  Zod-validated props schema, defaults, a pure render adapter, editor metadata and a
  serialization version. The 22 inherited editor elements were converted to that contract.
- **A candlestick chart video component.** A first-party trading component that renders OHLC
  bars as SVG from pure props and the current frame, with intrabar simulation and no lookahead.
- **Local storage with SQLite in OPFS.** Projects are saved through one port
  (`WorkspaceRepository`); the durable backend is official SQLite WASM in a worker over OPFS,
  with `localStorage` and in-memory fallbacks.
- **Three vendored Remocn motion components.** `marker-highlight`, `soft-blur-in` and
  `typewriter`, vendored as source with their MIT licence and a provenance record.
- **A shadcn/ui editor chrome.** Tailwind CSS v4 with semantic tokens, Radix-based primitives
  and Lucide icons. The video path imports none of it.
- **A dense, cinema-style shell.** A full-height tool rail, a tabbed library with a grid/list
  toggle, a floating transport under the canvas, an inspector split into ordered sections, and a
  timeline that stacks overlapping clips into rows instead of drawing them on top of each other.
- **Light and dark modes.** One token set, two modes: the shell follows the operating system
  until the user picks one, and the choice persists.
- **Direct manipulation on the canvas.** Press an element to select and move it, and drop a
  library item onto the canvas to place it there.

## Requirements

- Node.js 22+ (developed on 24.20) and npm 10+.
- A Chromium-family browser for the preview. The first export downloads Remotion's Chrome
  Headless Shell into `node_modules/.remotion`.

The package manager is **npm**. There is no `pnpm-lock.yaml`, and none should be added.

## Install and run

```bash
npm install
npm run dev
```

`npm run dev` starts the Vite dev server and the local render API (`server.mjs`) together. The
editor is then in the browser. No account, no backend, no network call.

## Verification commands

```bash
npm run typecheck      # tsc -b — the type gate, no emit
npm test               # Vitest, single run
npm run build          # typecheck + production bundle into dist/
npm run preview        # serves the built dist/ with the storage headers
node scripts/verify-r1.mjs   # real Remotion render: stills and an mp4
```

The last command is the only one that proves a change reaches the *video* path: it bundles the
Remotion entry and renders PNG stills through the same pipeline the export uses.

For the working details — hosting the built app, the cross-origin isolation headers, where
things live, how to add a component — read [`docs/BOOTSTRAP.md`](docs/BOOTSTRAP.md).

## Project layout

```
src/
  registry/          the typed component contract and the registry
  trading/           the candlestick chart component and pure OHLC maths
  motion-components/ adapted Remocn source, vendored with licence + provenance
  project/           project document migrations
  storage/           local persistence behind one interface (SQLite/OPFS, localStorage, memory)
  remotion/          the composition and the element renderers
  components/        Library, Timeline, Inspector, PreviewPanel, TopBar, ToolRail, …
    ui/              the shadcn/ui primitives (copied source)
    library/         the tabbed library pane: cards, rows, group headers, view toggle
    inspector/       the inspector's sections, rows and parameter controls
    timeline/        track rows, clip chips, the ruler and the lane packing
  lib/               cn() and the theme provider
  index.css          the one stylesheet: Tailwind layers, light/dark tokens, legacy rules
remotion/            Remotion entry point (Composition id="Main")
docs/                the Chart Studio design documents and decisions
```

Two files sit next to the preview panel because they are canvas behaviour, not chrome:
`src/components/canvas-hit-test.ts` decides which element is under the pointer, and
`src/components/selection-overlay.tsx` draws the selection box and its handles.

## Documents

| Document | Purpose |
|---|---|
| [Bootstrap](docs/BOOTSTRAP.md) | how to install, run and verify the repository |
| [Documentation index](docs/README.md) | the full document map |
| [Upstream audit](docs/architecture/UPSTREAM_AUDIT.md) | what the upstream editor was, what R1/R2 changed, risks and known debt |
| [Storage](docs/architecture/STORAGE.md) | the persistence port, the backends, the one-writer rule |
| [Component contract](docs/spec/COMPONENT_CONTRACT.md) | the typed component contract (normative) |
| [ADR-003 — Component system](docs/decisions/ADR-003-COMPONENT-SYSTEM.md) | why the component system exists and what it must guarantee |
| [ADR-004 — Storage port](docs/decisions/ADR-004-STORAGE-PORT.md) | why persistence sits behind an interface |
| [ADR-005 — shadcn and Tailwind](docs/decisions/ADR-005-SHADCN-AND-TAILWIND.md) | the editor control layer: versions, licences, bundle cost, exit strategy |
| [Roadmap](docs/roadmap/ROADMAP.md) | the delivery sequence |
| [AGENTS.md](AGENTS.md) | the nonnegotiable guardrails and task workflow for coding agents |

## Licensing and data integrity

Remotion's licence is not universally MIT; check eligibility before commercial distribution.
Paid Remotion Timeline and Editor Starter are not bundled. The vendored Remocn source is MIT
and keeps its licence text next to the copy. Market-provider data redistribution rights require
review. Synthetic OHLC paths, modified historical bars and hypothetical branches stay
recognisable as such. No financial signals, brokerage connections or profitability claims are
part of this project.
