# Upstream Audit — Remotion-Animator-Studio → Chart Studio (R0)

Date: 2026-10-25 · Scope: R0 (audit + baseline) and R1 (component system) only.

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
