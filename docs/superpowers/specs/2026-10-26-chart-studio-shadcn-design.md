# Chart Studio — shadcn/ui adoption and Remocn expansion

**Status:** Design approved by owner · **Date:** 2026-10-26 · **Slice:** R2 editor shell + R0 Remocn completion
**Supersedes:** `docs/superpowers/specs/2026-10-26-chart-studio-r0-foundation-design.md` (monorepo scaffold) — withdrawn because the repository had already advanced past that premise (see §1).
**Authority:** `docs/architecture/UPSTREAM_AUDIT.md`, `docs/decisions/ADR-003-COMPONENT-SYSTEM.md`, `docs/spec/COMPONENT_CONTRACT.md`, `docs/roadmap/ROADMAP.md` (R0 item: evaluate and pin 2–3 Remocn motion components).

## 1. Context correction

An earlier draft of this spec proposed scaffolding a pnpm/Turborepo/Next.js monorepo. That premise is stale:

- The repository already contains a working Chart Studio implementation (23 commits): the typed component registry (`src/registry/`), the first first-party trading component (`src/trading/candlestick-chart.tsx`), project migrations (`src/project/`), the storage port with a SQLite/OPFS backend (`src/storage/`), and one vendored Remocn component (`src/motion-components/`).
- `docs/architecture/UPSTREAM_AUDIT.md` records the product decision: **keep the Vite + React + Zustand + Remotion SPA**. The Next.js/pnpm/Turborepo *packaging* in `docs/` was consciously declined; its *contracts* were kept.
- `docs/superpowers/plans/2026-10-25-chart-studio-scaffold.md` §5 lists exactly what R1 did not do: "a UI overhaul" and the monorepo packaging.

So the owner's request — install and set up shadcn, make the project use it, install Remocn — applies to the application that actually exists.

**What is genuinely missing today:**

| Requested | Actual state |
|---|---|
| shadcn/ui | Absent. No Tailwind, no `components.json`, no `src/components/ui/`. The editor chrome is hand-written CSS (`src/index.css`, 15 kB). |
| Tailwind (shadcn's prerequisite) | Absent. |
| Remocn | One component vendored (`marker-highlight`). The roadmap asks for 2–3 pinned. |
| shadcn in the docs | `docs/decisions/ADR-002-DEPENDENCY-ADOPTION.md` lists shadcn/ui + Tailwind for editor controls; no dependency record exists for their adoption. |

## 2. Goal

Adopt shadcn/ui as the editor control layer inside the existing Vite SPA — without changing what the editor *is* — and finish the Remocn evaluation the roadmap asks for, with everything verified through the real render path.

## 3. Decisions

1. **Stay in the Vite SPA.** No Next.js, no monorepo, no React upgrade. The packaging decision is documented (`UPSTREAM_AUDIT.md` §4.1); this slice changes the UI layer, not the architecture.
2. **Tailwind CSS v4** (`tailwindcss@4.3.3` + `@tailwindcss/vite@4.3.3`) with the Vite plugin and a single global stylesheet at `src/index.css`. Tailwind's content detection covers `src/**`.
3. **shadcn/ui via the CLI** (`npx shadcn@latest`, CLI 4.22.1): base `radix`, style `nova`, `iconLibrary: lucide`, `baseColor: neutral`, `rsc: false` (this is an SPA), components in `src/components/ui/`, `cn()` in `src/lib/utils.ts`, `@/*` → `./src/*` in both `tsconfig.json` and `vite.config.ts`.
4. **The app's dark palette becomes the shadcn token set.** `--background #0e0f13`, `--card/--popover #16181f`, `--secondary/--muted #1c1f28`, `--border/--input #262a35`, `--foreground #e8eaf0`, `--muted-foreground #8b90a0`, `--primary #7c5cff`, `--destructive #ff5c6c`, `--ring #7c5cff`. shadcn components therefore look native to the existing editor instead of importing a foreign light theme.
5. **Convert the chrome, keep the bespoke surfaces.** `TopBar`, `Inspector`, `Library`, `RenderDialog`, `HelpModal` and `StorageIndicator` move to shadcn primitives. `Timeline` and `PreviewPanel` keep their custom CSS (a frame ruler and a Remotion `<Player>` are not shadcn's business), except that plain buttons in them become `Button size="sm"`.
6. **shadcn never enters the render path.** No `src/components/ui/*` import may reach `src/remotion/`, `src/registry/` or any component `render` adapter. Editor chrome and video content stay separate, as ADR-003 requires.
7. **Remocn grows to three components.** Keep `marker-highlight`; add `soft-blur-in` (per-character title reveal) and `typewriter` (deterministic character-by-character reveal). Each is vendored as source with its MIT licence, provenance row, registry definition, `ElementType` id and a test. No runtime fetching.
8. **New dependency record.** `docs/decisions/ADR-005-SHADCN-AND-TAILWIND.md` records exact versions, licences, browser support, bundle consequences, security posture, the improvement over hand-written CSS, and the exit strategy — the record `AGENTS.md` requires before a dependency is adopted.
9. **Icons.** Converted chrome uses `lucide-react` instead of emoji. Emoji inside the video content (legacy elements) is untouched — that is content, not chrome.

## 4. File map

**Create**
- `components.json` — shadcn project config.
- `src/lib/utils.ts` — `cn()`.
- `src/components/ui/*.tsx` — shadcn primitives (CLI-generated).
- `src/motion-components/upstream/soft-blur-in.tsx`, `upstream/typewriter.tsx` — verbatim upstream copies.
- `src/motion-components/soft-blur-in.tsx`, `src/motion-components/typewriter.tsx` — adapted copies.
- `src/motion-components/definitions/soft-blur-in.ts`, `definitions/typewriter.ts` — registry definitions.
- `docs/decisions/ADR-005-SHADCN-AND-TAILWIND.md`.
- `docs/superpowers/plans/2026-10-26-chart-studio-shadcn.md`.

**Modify**
- `package.json`, `package-lock.json` — Tailwind v4 + Radix + lucide + cva/clsx/tailwind-merge.
- `vite.config.ts` — Tailwind plugin, `@` alias.
- `tsconfig.json` — `baseUrl` + `paths`.
- `src/index.css` — `@import "tailwindcss"`, shadcn token block, `@theme inline`.
- `src/types.ts` — two new `ElementType` ids (`remocnSoftBlurIn`, `remocnTypewriter`), appended, never renumbered.
- `src/registry/index.ts` — import the two new definition modules.
- `src/components/TopBar.tsx`, `Inspector.tsx`, `Library.tsx`, `RenderDialog.tsx`, `HelpModal.tsx`, `StorageIndicator.tsx`, `Timeline.tsx`, `PreviewPanel.tsx`.
- `src/motion-components/PROVENANCE.md` — two new component records.
- `docs/BOOTSTRAP.md`, `docs/architecture/UPSTREAM_AUDIT.md`, `docs/roadmap/ROADMAP.md`, `docs/README.md`, `README.md`.

## 5. Control mapping (Inspector)

| `ParamDef.kind` | Current | Becomes |
|---|---|---|
| `number` with min+max | `input[type=range]` + `input[type=number]` | `Slider` + `Input type="number"` (number commits on blur/Enter, as today) |
| `number` without range | `input[type=number]` | `Input type="number"` |
| `color` | `input[type=color]` + text input | `Input type="color"` + `Input` (same commit semantics) |
| `text` | `input[type=text]` | `Input` |
| `textarea` | `textarea` | `Textarea` |
| `select` | `select` | `Select` (Radix, `SelectGroup` + `SelectItem`) |
| `boolean` | existing boolean control | `Switch` (keep the existing store contract) |

Commit-on-blur/Enter behaviour must survive the swap: the store is updated when the value settles, not on every keystroke.

## 6. Error handling

- A shadcn CLI failure aborts that step; the repository is never left with a half-written `components.json`.
- If `init` rewrites `src/index.css` destructively, the file is restored from git and the token block is applied by hand (the exact block is in the plan).
- Radix overlays (`Dialog`, `DropdownMenu`, `Select`, `Tooltip`) must have their required parts: every `Dialog` has a `DialogTitle` (visually hidden if needed), every `SelectItem` sits inside a `SelectGroup`.
- The renderer path is untouched by this slice: a failure to convert a control must not change what the video renders.

## 7. Verification

1. `npm run typecheck` — clean.
2. `npm test` — the existing 71 tests plus new tests for the two Remocn components (registry lookup, defaults, deterministic render).
3. `npm run build` — bundle builds; report the size delta against the 721 kB / 227 kB gzip baseline.
4. `node scripts/verify-r1.mjs` — real Remotion render (stills + `out/chart-studio-r1.mp4`) including the two new Remocn components, proving they reach the video path.
5. Browser pass against `npm run dev`: the library, inspector, top bar, render dialog and help dialog render with shadcn styling; the timeline, preview and playback still work; a screenshot is saved to `out/verify/`.
6. No `src/components/ui` import appears in `src/remotion/`, `src/registry/` or `src/trading/`.

## 8. Risks

| Risk | Mitigation |
|---|---|
| Tailwind v4 preflight resets the hand-written editor CSS | The chrome is converted to shadcn in the same slice; before/after screenshots are compared and the legacy `.btn`/input rules stay until replaced |
| A current shadcn component needs React 19 | The project stays on React 18.3; if a component refuses to install, use the simpler variant (`label` instead of `field`, plain `Input` instead of `InputGroup`) and record it |
| CSS bundle growth | Tailwind v4 content detection + the reported bundle delta; no second styling system is introduced |
| Remocn component breaks the pure-adapter rule | Each upstream file is vendored verbatim next to the adapted copy; only the documented local modifications are allowed; the existing `definition.test.ts` pattern is extended |
| The `init` CLI prompts or rejects the existing project | The exact `components.json`, token block and `cn()` implementation are in the plan as a manual fallback |

## 9. Documentation updated by this slice

- `README.md` — rewrite for Chart Studio (the standing debt: it still claims there is no implementation).
- `docs/BOOTSTRAP.md` — the new folders, `components.json`, the Tailwind/shadcn setup, the verification commands.
- `docs/architecture/UPSTREAM_AUDIT.md` — an R2 addendum: shadcn/Tailwind adopted in the SPA, Remocn now at three components, and a short "how this fork maps onto the documented Next.js/pnpm architecture" note.
- `docs/roadmap/ROADMAP.md` — R0 "evaluate and pin 2–3 Remocn motion components" is done, with the three component names.
- `docs/decisions/ADR-005-SHADCN-AND-TAILWIND.md` — the dependency record.
- `docs/README.md` — index entries.

## 10. Non-goals

No Next.js, no monorepo, no React 19, no Tailwind rewrite of the video content, no dnd-kit timeline, no new editor features, no shadcn blocks or charts, no runtime registry fetching, no changes to the storage layer, no SMT/MTF/import work.

## 11. Implementation mechanics

- The work happens in a **separate git worktree** created through the `orca` CLI, with an agent deployed there to implement, per the owner's instruction.
- The worktree branch merges back only after §7 passes on observed output.
