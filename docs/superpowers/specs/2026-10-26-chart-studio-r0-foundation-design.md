# Chart Studio R0 Foundation — monorepo scaffold with shadcn/ui and Remocn

**Status:** Design approved by owner · **Date:** 2026-10-26 · **Slice:** R0 foundation
**Authority:** implements `docs/decisions/ADR-001`, `ADR-002`, `ADR-003`, `docs/roadmap/ROADMAP.md` (R0 items), `docs/design/PRODUCT_DESIGN.md` §3.

## 1. Problem

The repository currently holds two different things:

- A **design-only document set** (`README.md` + `docs/`) describing *Chart Studio*: a local-first trading-video studio to be built as a pnpm + Turborepo monorepo with Next.js, Tailwind, shadcn/ui and Remotion.
- A **working legacy app** (`src/`, `remotion/`, `server.mjs`, `render.mjs`, Vite + React 18 + Remotion 4.0.538, hand-written CSS) that is a generic animation studio with no Tailwind, no shadcn and no monorepo structure.

The owner wants the toolchain the docs already mandate — shadcn/ui for editor controls, Remocn for generic motion components — installed and actually exercised, before the trading feature work starts. Nothing in the repository currently proves that Next.js + Tailwind v4 + shadcn + Remotion 4.0.539 + Remocn can coexist in one workspace.

## 2. Decision summary

1. The repository root becomes a **pnpm + Turborepo workspace** matching the documented `apps/` + `packages/` structure.
2. **`apps/studio`** — Next.js 16 App Router studio shell: Tailwind v4, shadcn/ui, `@remotion/player` preview.
3. **`packages/ui`** — workspace-shared shadcn primitives (`@workspace/ui/components`).
4. **`packages/domain`** — Zod-validated project and scene-object schemas.
5. **`packages/motion-components`** — Remocn components installed as copied source, each wrapped in the ADR-003 adapter and recorded with license/provenance.
6. **`packages/scene-compositor`** — Remotion `Composition` registry; the single authoritative preview path.
7. **`apps/animator`** — the legacy Vite app moved verbatim (`git mv`), keeps its own npm lockfile, is **excluded** from the pnpm workspace and stays runnable.
8. No other packages are created in this slice. Empty shells are dead weight; `market-data`, `smt-mtf`, `chart-renderer`, `trading-components`, `editor-core`, `timeline`, `storage-sqlite`, `project-archive` and `export` are written by their own slices.

**Accepted cost:** two Remotion copies coexist — legacy `4.0.538` / React 18 / npm inside `apps/animator`, new `4.0.539` / React 19 / pnpm inside the workspace. They never share `node_modules`; version drift between them is invisible to the new workspace.

## 3. Alternatives considered

| Option | Advantage | Rejected because |
|---|---|---|
| Retrofit shadcn/Tailwind into the existing Vite app | Smallest diff; working editor stays the product | Contradicts the documented monorepo architecture; the docs describe a *different* product (trading studio), and a Vite retrofit would be thrown away when that shell is built |
| Scaffold the monorepo and port the legacy editor into it | Cleanest end state | Moves a large amount of working render-critical code in the same change; timeline and canvas would still be bespoke CSS, so the payoff does not arrive with the shadcn setup |
| Setup-only (init, tokens, one button) | Fastest | Proves nothing: no evidence that shadcn, Tailwind v4, React 19, Remotion 4.0.539 and Remocn work together, and no deliverable the owner can open |

## 4. Workspace layout

```
/ (pnpm workspace + Turborepo; packageManager pnpm@10.28.2)
├─ apps/
│  ├─ studio/            Next.js 16.4.3 App Router · React 19.3.1 · Tailwind v4 · shadcn/ui · @remotion/player
│  └─ animator/          legacy Vite app (git mv, own npm lockfile, excluded from workspace)
├─ packages/
│  ├─ ui/                shadcn primitives (@workspace/ui/components)
│  ├─ domain/            Zod v4 project + scene-object schemas
│  ├─ motion-components/ Remocn source + provenance manifest
│  └─ scene-compositor/  Remotion Composition registry
├─ docs/
├─ pnpm-workspace.yaml
└─ turbo.json
```

`pnpm-workspace.yaml` lists `apps/studio` and `packages/*` explicitly so `apps/animator` is never pulled into the pnpm install.

## 5. Pinned versions

| Package | Version | Note |
|---|---|---|
| `next` | 16.4.3 | App Router |
| `react`, `react-dom` | 19.3.1 | exact pin |
| `typescript` | 5.9.x | latest 5.x line; **not** the 7.0 line — avoid toolchain churn in this slice |
| `tailwindcss`, `@tailwindcss/postcss` | 4.3.3 | v4, CSS-first config |
| `shadcn` (CLI) | 4.22.1 | `npx shadcn@latest` |
| `turbo` | 2.11.10 | |
| `zod` | 4.6.7 | |
| `zustand` | 5.0.16 | app-shell state only |
| `remotion`, `@remotion/player`, `@remotion/renderer`, `@remotion/bundler` | **exactly 4.0.539** | identical patch across all Remotion packages — mismatched patch versions caused the legacy startup crash fixed in commit `f9807de` |
| `lucide-react` | 1.61.0 | shadcn `iconLibrary: lucide` |
| `class-variance-authority` | 0.7.1 | |
| `tailwind-merge` | 3.7.0 | |
| `clsx` | 2.1.1 | |
| Node | ≥ 22 (local 24.20.0) | |

## 6. shadcn/ui setup

- **Monorepo mode.** `components.json` exists in **both** `apps/studio` and `packages/ui`, with matching `style`, `baseColor` and `iconLibrary`; app-side aliases point at `@workspace/ui/components`, `@workspace/ui/lib/utils`.
- **Choices:** base `radix` (broadest component and documentation coverage on React 19), style `nova`, `iconLibrary: lucide`, `baseColor: neutral`, `tailwind.config` empty (Tailwind v4 CSS-first).
- **Theme.** `packages/ui/src/styles/globals.css` holds `@import "tailwindcss"`, the `@source` directive for the ui package, and the shadcn token block. `apps/studio` imports `@workspace/ui/globals.css`. `<html class="dark">` so the shell matches the existing dark studio aesthetic; `--primary` carries the legacy `#7c5cff` accent.
- **Components installed via the CLI from `apps/studio`:** Button, Card, Tabs, Input, Select, Dialog, Tooltip, Slider, Badge, Separator, ScrollArea, and `sonner` for toasts. The CLI writes them into `packages/ui` and rewrites imports to `@workspace/ui/components`.
- **Fallback if `init` rejects a pre-seeded monorepo:** write the canonical token block and `cn()` utility explicitly, then install every component with `shadcn add`. Never hand-author a component that the registry provides.

## 7. Remocn setup

- **Registry:** remocn items are served from `https://remocn.dev/r/{name}.json` and installed with `npx shadcn@latest add @remocn/<name>`. `packages/motion-components` gets its own `components.json` with the registry namespace `"@remocn": "https://remocn.dev/r/{name}.json"`; if the CLI does not resolve the namespace, install by direct registry URL.
- **Components in this slice (2):** `@remocn/soft-blur-in` (per-character hero title reveal — satisfies ADR-003 gate CPT-002) and `@remocn/backdrop` (frame fill). Both are deterministic TSX depending only on `remotion`, MIT-licensed, copied into the repo as source.
- **Adapter.** Each copied component is wrapped in the ADR-003 contract: stable `type`, `schemaVersion`, Zod props schema, defaults, renderer. Frame-driven props only; no `Date.now()`, no RAF clock, no editor state.
- **Provenance.** `packages/motion-components/PROVENANCE.md` records, per component: registry URL, MIT license, retrieval date, upstream file path, and local modifications.
- **Not installed:** the remocn *agent skill* (`npx skills add Remocn/remocn`) and the Claude/Codex plugin. Those drive prompt-based video authoring; component integration here is manual and governed by ADR-003.

## 8. Studio shell (apps/studio)

Follows the dashboard skeleton in `PRODUCT_DESIGN.md` §3:

- App bar with product name and a "New project" `Button`.
- Recent-projects area rendering the shadcn `Empty` state — honest about there being no persistence yet (R2 owns SQLite).
- "Component catalog" `Card` listing installed shadcn and Remocn components with `Badge` source labels, proving both registries are wired.
- Preview panel with `@remotion/player` playing the demo composition supplied by `packages/scene-compositor` (client component; `Player` is the only preview path).
- No project CRUD, no timeline, no market data, no export UI. The shell must not imply capabilities that do not exist yet.

## 9. Data flow and boundaries

```
packages/domain (Zod schemas)
        │  typed project + scene-object props
        ▼
packages/scene-compositor (Composition registry, pure props)
        │
        ▼
packages/motion-components (Remocn renderers, frame-driven)
        │
        ▼
apps/studio (@remotion/player preview + shadcn editor chrome)
```

- Zustand lives in the app shell only; no store hooks, no browser I/O inside render components or market functions.
- Remotion remains the only video runtime; Remocn supplies generic motion; first-party trading components arrive in R1.
- The Player renders the same `Composition` that the render script exports — one implementation, two consumers.

## 10. Error handling

- The app→domain boundary validates with Zod; invalid input renders a shadcn `Alert` with the failing field path. No exception escapes into the React tree.
- The Player is wrapped in an error boundary that shows a readable message and a retry action.
- A failed `shadcn` / remocn CLI invocation aborts that step and leaves the repository unchanged; no half-written `components.json` is committed.
- Remocn components that prove non-deterministic or browser-export-incompatible are removed from the catalog and replaced, not patched around.

## 11. Verification (all evidence must be observed)

1. `pnpm install` → `pnpm typecheck` → `pnpm lint` → `pnpm test` → `pnpm build` all exit 0 from a clean lockfile.
2. Vitest unit tests over `packages/domain` schemas: valid input, rejected input, defaults.
3. **Live smoke:** `pnpm dev` → the dashboard opens in a browser → screenshot shows shadcn-rendered cards, tabs and buttons, and the Player mid-animation.
4. **Parity proof (CPT-002):** a Node script using `@remotion/renderer` renders the same composition to an MP4/still; the output file exists and the frame matches the previewed frame.
5. **Legacy intact:** `npm ci && npm run build` inside `apps/animator` still succeeds after the move.
6. Tailwind v4 content detection covers `packages/ui` — a shadcn component renders with its classes applied in the Next build (not silently unstyled).

## 12. Documentation updated by this slice

- `README.md` — status line (design + R0 foundation implementation), actual structure tree, installed tooling (no longer "proposed").
- `AGENTS.md` — retire the "design-only" claim; mark `apps/animator` as frozen legacy.
- `docs/README.md` — index entry for this spec and the implementation plan.
- `docs/roadmap/ROADMAP.md` — R0 item "evaluate and pin 2–3 Remocn motion components" marked done with an evidence link.

## 13. Non-goals

No trading components, SMT/MTF, market data, SQLite persistence, timeline or dnd-kit, archive/export, service worker or offline mode, auth, cloud sync, no port of the legacy editor, no Tailwind rewrite of the legacy CSS, no remocn agent skill.

## 14. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Tailwind v4 does not scan `packages/ui` sources → shadcn classes missing | Explicit `@source` in `packages/ui/src/styles/globals.css`; verified by smoke screenshot |
| `@remocn` namespace not resolvable by the CLI | Registry namespace in `components.json`, with direct registry-URL install as fallback |
| React 19 + Remotion 4.0.539 incompatibility in the Player | Player smoke test is a release gate, not an assumption |
| Next.js App Router + Remotion Player SSR boundary | Player lives in a `"use client"` component; verified in `next build` |
| Mixed npm/pnpm lockfiles confuse future work | `apps/animator` excluded from `pnpm-workspace.yaml`; its README states npm is authoritative there |
| TypeScript 7.x lands during the slice | Pinned to 5.9.x in the workspace |

## 15. Implementation mechanics

- Work happens in a **separate git worktree** on a dedicated branch, never in the owner's checkout.
- An agent is deployed into that worktree through the `orca` CLI to perform the implementation, per the owner's instruction.
- The worktree branch is merged back only after §11 verification passes on real output.
