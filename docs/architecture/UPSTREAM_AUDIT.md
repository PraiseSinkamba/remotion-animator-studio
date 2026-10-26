# Upstream Audit — Remotion-Animator-Studio → Chart Studio (R0)

Date: 2026-10-25 · Scope: R0 (audit + baseline), R1 (component system) and R2 (editor shell +
Remocn completion). §7 is the R2 addendum.

## 1. What the upstream repository actually is

The fork is **`kr4ckhe4d/Remotion-Animator-Studio`** — a single-package Vite SPA that is a
general-purpose Remotion video editor. It is *not* a Chart Studio skeleton: the Chart Studio
documents in `docs/` were written for a planned Next.js/pnpm/Turborepo workspace that does not
exist in this tree.

Measured state at audit time (before any change):

| Area | Finding |
|---|---|
| Packages | one `package.json`, no workspace, no Turborepo |
| Framework | React 18.3 + Vite 5.4 + TypeScript 5.6 (strict) + Zustand 5 |
| Video | Remotion 4.0.538 (`remotion`, `@remotion/player`, `@remotion/bundler`, `@remotion/renderer`) |
| Storage | none — projects are JSON files, autosave in `localStorage` |
| Tests | **none** — no test runner, no test files, no CI config |
| Typecheck | **failing** — `tsc -b` reported 6 errors in `src/effects.ts` (nullable path geometry) |
| Build | `vite build` succeeded (704 kB / 221 kB gzip) |

`README.md` in the working tree says "design and planning only — no application code has been
implemented". That statement was already false for the code in this tree: the editor, timeline,
inspector, presets, effects library, server render endpoint and CLI export all exist. The
documentation and the code were out of sync before this work started.

## 2. Module map (upstream, pre-change)

| File | Lines | Responsibility |
|---|---|---|
| `src/types.ts` | 106 | `ElementType`, `EffectType`, `Clip`, `Track`, `Project`, `ParamDef` |
| `src/elements.ts` | 574 | the element catalogue: label, icon, defaults, inspector params for 22 element types |
| `src/effects.ts` | 817 | 37 effects, easing helpers, `computeEffectStyle` |
| `src/presets.ts` | 738 | five template presets built from element defaults |
| `src/store.ts` | 510 | Zustand editor state, undo/redo, clip commands |
| `src/remotion/MainComposition.tsx` | 760 | the composition: per-clip `Sequence`, effect styling, `switch (clip.element)` dispatch, 13 inline element renderers |
| `src/remotion/scenes.tsx` | 8 scenes | generative scene components |
| `src/components/*` | ~1200 | Library, Timeline, Inspector, PreviewPanel (Remotion `<Player>`), TopBar, RenderDialog |
| `remotion/Root.tsx`, `remotion/index.ts` | 29 | Remotion entry, `Composition id="Main"` |
| `render.mjs`, `server.mjs` | — | CLI mp4 export and the local render/still API used by the editor |

## 3. Boundaries kept, changed and deferred

**Kept as-is (working, not trading-specific):** the Vite + React + Zustand + Remotion stack, the
`<Player>`-based preview, the timeline, the effect system, the preset system, the project
save/open flow, the CLI and server render paths.

**Changed in R1:**
- `src/elements.ts` + the `switch` in `MainComposition` → one **typed component registry**
  (`src/registry/`). The 22 inherited elements are now registry definitions; the switch is gone.
- Every load boundary now runs the project through `src/project/migrate.ts` (schema version,
  component type, props version).
- The project document gained `schemaVersion`; clips gained `propsVersion`.
- `src/trading/ohlc.ts` — pure OHLC maths (deterministic synthetic series, intrabar simulation).
- `src/trading/candlestick-chart.tsx` — first first-party trading component.
- `src/motion-components/` — the first adapted Remocn component, vendored with its MIT licence.

**Explicitly deferred (not R0/R1):** SMT, MTF, SQLite/OPFS persistence, chart groups, HTF/LTF,
drawing tools, the UI overhaul, the Next.js/Turborepo packaging described in `docs/`.

## 4. Findings that needed a decision

1. **Docs describe a different application.** `docs/architecture/TECHNICAL_ARCHITECTURE.md` and
   `AGENTS.md` assume Next.js App Router, pnpm workspaces and Turborepo. The fork is a Vite SPA
   and the product decision is to keep it that way. The *contracts* in those documents (component
   protocol, determinism, provenance, no-leakage) were kept; the *packaging* was not.
2. **No component contract existed.** `ADR-003` describes the contract in prose only, and the
   code had two parallel dispatch points (the `ELEMENTS` map for the UI, the `switch` for the
   render). R1 introduced `docs/spec/COMPONENT_CONTRACT.md` and `src/registry/types.ts`.
3. **The project format was unversioned.** Any future change to a component's props would have
   broken existing files silently. R1 added versioning plus a migration that rejects documents
   it cannot understand.
4. **The typecheck was already broken** before this work (`src/effects.ts`, nullable path
   geometry). Fixed in the first commit so that `tsc -b` could act as a gate.
5. **No tests existed.** R1 added Vitest (node by default, jsdom per file) and 70 tests across
   the registry, the migration, the OHLC maths, the chart adapter and the adapted motion
   component.
6. **`DOCS.md` still documents the old `ELEMENTS` export** and is now stale. It is upstream
   documentation for the generic editor; it was left untouched rather than rewritten, and it is
   listed as known debt below.
7. **Remotion version drift is a real risk** (an upstream commit fixed a preview crash caused by
   mismatched Remotion versions). All `@remotion/*` packages are pinned to `4.0.538` and must
   stay pinned together.

## 5. Risk register

| Risk | Impact | Mitigation in place |
|---|---|---|
| Registry cutover breaks an inherited element | Editor regression | Every inherited element kept its exact label, icon, defaults and params; the catalogue parity was asserted before the old file was deleted; 22-ID coverage test |
| Preview and export diverge | Wrong output in exported video | Preview renders the same `MainComposition`; the verification script renders stills and an mp4 through the real pipeline |
| Chart shows future data | Trading content is wrong | The price scale and the drawn series come from the visible bars only; asserted per frame in the chart tests |
| Adapted third-party source drifts | Licence or behaviour risk | Source vendored with its MIT licence, provenance table, and only three documented local modifications |
| `tsc -b` regresses | Lost gate | Fixed at the start; every slice re-checks it |

## 6. Known debt after R1

- `DOCS.md` still describes the pre-registry `ELEMENTS` map.
- `README.md` still claims the repository has no implementation; it now needs rewriting for
  Chart Studio (R2 documentation task).
- `docs/` still describes the Next.js/pnpm target layout; it needs a short "how this maps onto
  the fork" note so the documents stop contradicting the code.
- The chart's series is edited through a table in the inspector — no CSV/import path, no
  indicator overlays, no volume pane.
- The verification render uses a hard-coded verification project; it is not part of the test
  suite because it needs a browser and minutes of wall-clock time.

## 7. R2 addendum — the editor shell and the Remocn set

R2 did not change the architecture. It changed the editor chrome and finished the Remocn
evaluation the roadmap asks for.

**What changed**

- **Tailwind CSS v4 and shadcn/ui are now the editor control layer.** Tailwind is added
  through `@tailwindcss/vite` with a single global stylesheet (`src/index.css`); the shadcn
  primitives are copied source in `src/components/ui/`, configured by `components.json`
  (base `radix`, style `radix-nova`, icons `lucide`). The top bar, inspector, library, render
  dialog, help dialog and storage indicator were converted; the timeline and preview panel keep
  their bespoke CSS.
- **The editor stays the Vite SPA.** No Next.js, no monorepo, no React upgrade. The decision
  recorded in §4.1 stands.
- **Remocn is now at three components.** `marker-highlight` (`remocnMarkerHighlight`),
  `soft-blur-in` (`remocnSoftBlurIn`) and `typewriter` (`remocnTypewriter`), each vendored as
  source with its MIT licence, a provenance row in `src/motion-components/PROVENANCE.md`, a
  registry definition, an `ElementType` id and a test.
- **shadcn never enters the render path.** No `src/components/ui/*` import appears in
  `src/remotion/`, `src/registry/`, `src/trading/` or `src/motion-components/`.

**Why preflight is not imported**

The in-app Remotion preview renders inside the app document, while the export bundle imports no
CSS at all. Importing Tailwind's preflight would therefore change the preview and not the
export, which would break the preview/export parity invariant that ADR-003 and `AGENTS.md`
both depend on. Only the theme and utilities layers are imported; the parts of preflight the
editor needs (the border reset, the inherited form-control font and the button background
reset) are re-declared by hand in `@layer base`. The surviving hand-written rules moved into
`@layer legacy`, declared after `base` and before `utilities`, so a converted control can
restyle a legacy rule with utility classes while elements that keep their own class names are
unaffected.

**Measured bundle**

| | Before R2 | After R2 |
|---|---|---|
| JavaScript | 721 kB / 227 kB gzip | 945.56 kB / 295.63 kB gzip |
| CSS | 14.5 kB (hand-written stylesheet) | 58.12 kB / 10.54 kB gzip |

That is **+224.6 kB raw / +68.6 kB gzip** of JavaScript and a 14.5 kB → 58.1 kB stylesheet. The
JavaScript went into the Radix primitives actually imported (select, scroll-area, slider,
switch, dialog, dropdown-menu, tooltip, tabs) plus their `@floating-ui` positioning internals,
`tailwind-merge` (one ~40 kB minified module) and the 42 `lucide-react` icon modules the chrome
imports. The unused primitives (`sonner`, `next-themes`) and `culori` are tree-shaken out of the
bundle entirely (0 modules). The stylesheet grew because Tailwind emits the utilities the
shadcn components use, on top of the legacy rules that survived.

**How this fork maps onto the documented Next.js/pnpm architecture**

This is the note §6 listed as owed. The fork keeps the **contracts** from
`docs/architecture/TECHNICAL_ARCHITECTURE.md` and `AGENTS.md`; it does not keep the
**packaging**.

| Documented target | This fork | The contract that survives |
|---|---|---|
| Next.js App Router shell | Vite SPA | The editor is a local-first client application; the exported video is Remotion, either way |
| pnpm workspaces + Turborepo | one npm package | Package boundaries become directory boundaries (`src/registry/`, `src/trading/`, `src/storage/`, `src/motion-components/`); import rules and the "no state in the evaluator" rule are unchanged |
| `packages/*` per domain | `src/*` per domain | The typed component protocol, the storage port and its contract suite, the migration rules and the provenance requirements are all as documented |
| shadcn/ui for editor controls | shadcn/ui for editor controls | Adopted as specified, in `src/components/ui/` — see ADR-005 |
| dnd-kit timeline interactions | not adopted | Deferred; the timeline keeps its own pointer handling |
| SQLite WASM worker over OPFS | SQLite WASM worker over OPFS | As documented — see ADR-004 and `docs/architecture/STORAGE.md` |

So the documents in `docs/` are not wrong about *what* the system must do; they are wrong about
*where the code sits*. Where a document names a path, read the equivalent directory in this
tree.

**Debt closed in R2**

- The `README.md` claim that the repository has no implementation is gone; the README now
  describes the editor as it is.
- The "how this fork maps onto the documented architecture" note is this section.

