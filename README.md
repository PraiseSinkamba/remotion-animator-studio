# Chart Studio

> **Status:** Design and planning only — no application code has been implemented.  
> **Working design edition:** 1.2-draft, 2026-10-24. Requires product-owner approval before implementation.  
> **Mission:** A local-first, trading-native video studio for creating engaging, accurate market-structure, SMT-divergence and multi-timeframe breakdowns.

Chart Studio is an independent application inspired by existing chart animation products. It is **not** a clone of their proprietary assets or code. Unlike screen-recording-based editing, each chart, candle series, drawing, SMT relationship, caption and audio clip is a typed, editable video object with a timeline lifecycle. The output can show HTF/LTF charts individually, side-by-side or in animated layouts; candles can reveal as complete bars or evolve along clearly labeled OHLC-consistent simulated paths.

## What v1 aims to do

Create a complete annotated trading video using manual and imported OHLC data, 2–3-asset user-confirmed SMT observations, independently displayed or synchronized HTF/LTF charts, lines/zones/position and text tools, animated candles, captions, images, basic audio, multi-scene timelines, offline autosave, portable project files and local video export.

## Read this first

| Document | Purpose |
|---|---|
| [Product design](docs/design/PRODUCT_DESIGN.md) | User experience, principles, information architecture, interaction models, scene lifecycles |
| [Functional specification](docs/spec/FUNCTIONAL_SPEC.md) | Canonical feature behavior, object contracts, user-visible requirements and acceptance IDs |
| [Technical architecture](docs/architecture/TECHNICAL_ARCHITECTURE.md) | Remotion-first rendering, scene graph, SQLite WASM/OPFS, import and data integrity, export interfaces |
| [Feature catalogue](docs/features/FEATURE_CATALOG.md) | Full MVP and deferred inventory; expected behavior and acceptance mapping |
| [Video scenarios](docs/scenarios/VIDEO_SCENARIOS.md) | Storyboards, concrete creator journeys, scene/object/timeline recipes, test expectations |
| [Roadmap](docs/roadmap/ROADMAP.md) | Validation spikes, vertical slices, dependencies, deliverables, release gates and agent handoffs |
| [Architecture decisions](docs/decisions/ADR-001-VIDEO-STACK.md) | Video framework, framecn/remocn and rendering decision |
| [Dependency shortlist](docs/decisions/ADR-002-DEPENDENCY-ADOPTION.md) | Reuse existing libraries for timeline, import, archive, panels and exports |
| [Component architecture ADR](docs/decisions/ADR-003-COMPONENT-SYSTEM.md) | First-party trading components from day one; source-owned Remocn components; typed editor/video contract |
| [Test strategy](docs/quality/TEST_STRATEGY.md) | Test pyramid, fixtures, performance/error budgets, no-lookahead and render parity |
| [AGENTS.md](AGENTS.md) | Nonnegotiable guardrails and task workflow for coding agents |
| [Documentation index](docs/README.md) | Reading guide and status |
| [v1.1 design snapshot](docs/reference/chart-studio-design-v1.1.md) | Predecessor design preserved for traceability |

**Document authority:** `FUNCTIONAL_SPEC.md` is the canonical statement of observable v1 behavior; `TECHNICAL_ARCHITECTURE.md` defines interfaces and boundaries; `ADR-001-VIDEO-STACK.md` records dependency choices; `ROADMAP.md` sequences implementation. When docs conflict, raise a design issue rather than guess or silently invent behavior.

## Architecture at a glance

```
Next.js / React application + shadcn/ui editor
  ├── dashboard, inspector, canvas interactions, hierarchical timeline
  ├── project commands / Zod-validated domain model
  ├── chart and market data engine (custom, source-aware)
  ├── SMT + MTF engine (custom, no-lookahead)
  ├── first-party trading video objects + source-owned Remocn motion library
  ├── React / SVG scene elements rendered with Remotion
  │     ├── Remotion Player (preview)
  │     └── Remotion web renderer (local export, compatibility-gated)
  └── SQLite WASM worker (OPFS) + OPFS asset store

Optional future: versioned sync API + cloud storage + Remotion server renderer
```

**Do not confuse similarly named projects:** `remocn.dev` is a library of shadcn-installable *Remotion* motion components; `remotion.dev` is the video framework; `framecn.dev` is built on *Editframe*. **Remotion is our video runtime, Remocn our primary source-owned generic motion component framework, and our custom trading component library is foundational from the first slice.** Install/adapt Remocn source as needed instead of blindly importing the entire registry. See [the ADR](docs/decisions/ADR-001-VIDEO-STACK.md).

## Project structure (planned, not created)

```
apps/studio/
packages/domain/
packages/market-data/
packages/smt-mtf/
packages/chart-renderer/
packages/trading-components/  # custom chart, drawing and SMT/MTF video objects (P0)
packages/motion-components/   # adapted, source-owned Remocn motion pieces
packages/scene-compositor/
packages/editor-core/
packages/timeline/
packages/storage-sqlite/
packages/project-archive/
packages/export/
packages/ui/
tests/fixtures/
docs/
```

## Tooling (proposed)

Node.js LTS, pnpm, Turborepo, Next.js, TypeScript (strict), React, Tailwind CSS, shadcn/ui, Zod, Zustand, Remotion (`remotion`, `@remotion/player`, `@remotion/web-renderer`), `@sqlite.org/sqlite-wasm` in worker + OPFS, dnd-kit, Vitest, React Testing Library and Playwright. Versions must be checked and pinned together during the first technical spike; this documentation does not assert that any dependency is currently installed.

After the project is scaffolded, expected scripts will be `pnpm dev`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm test:e2e`, and `pnpm build`. **These commands are a contract for the future repository; they do not run in this docs-only package.**

## Licensing and data integrity

Remotion's license is not universally MIT; check eligibility before commercial distribution or team growth. Paid Remotion Timeline and Editor Starter are optional purchases, not bundled. Market-provider data redistribution rights require review. Synthetic OHLC paths, modified historical bars and hypothetical branches must remain recognizable as such. No financial signals, brokerage connections or profitability claims are part of v1.

## Current status

- [x] Product direction, source workflows, SMT/MTF, hierarchical scenes and file workflow selected
- [x] Expanded v1.2 design/spec/roadmap and agent guidance prepared for review
- [ ] Approve v1.2 design and library licensing decisions
- [ ] Run viability spikes (Remotion browser export + SQLite OPFS + chart-object interaction)
- [ ] Convert roadmap slices into Superpowers task-level implementation plans
- [ ] Implement, verify, and release creator-ready MVP
