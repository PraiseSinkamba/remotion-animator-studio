# Chart Studio scaffold — R0/R1 plan and results

Date: 2026-10-25 · Status: R0 and R1 complete · Scope: the component system only.

## 1. Goal

Turn the `kr4ckhe4d/Remotion-Animator-Studio` fork into the foundation of Chart Studio without
rebuilding the editor: keep React + TypeScript + Vite + Zustand + Remotion, make Remotion the only
video engine, introduce a typed video-component registry that every surface reads from, and prove
it with one first-party trading component (`CandlestickChart`) and one adapted Remocn motion
component.

Explicitly **not** in scope: SMT, MTF, SQLite/OPFS persistence, a UI overhaul, Next.js, a
monorepo.

## 2. Plan (as executed)

| # | Task | Result |
|---|---|---|
| R0.1 | Audit the upstream code, establish a baseline (build, typecheck, render path) | `docs/architecture/UPSTREAM_AUDIT.md` |
| R0.2 | Repair the broken typecheck so it can act as a gate | `src/effects.ts` null guards |
| R0.3 | Add test tooling (Vitest + jsdom + Testing Library) and the scripts to use it | `vite.config.ts`, `package.json` |
| R1.1 | Write the typed component contract | `src/registry/types.ts`, `docs/spec/COMPONENT_CONTRACT.md` |
| R1.2 | Build the registry mechanism | `src/registry/registry.ts` |
| R1.3 | Move the 22 inherited elements onto the registry; delete the old catalogue and the render `switch` | `src/registry/legacy.ts`, `src/remotion/legacy-elements.tsx`, `src/remotion/MainComposition.tsx` |
| R1.4 | Read the registry from the library, timeline, inspector, store and presets | `src/components/*`, `src/store.ts`, `src/presets.ts` |
| R1.5 | Version the project document and migrate it at every load boundary | `src/project/migrate.ts`, `src/components/TopBar.tsx`, `src/App.tsx`, `remotion/Root.tsx` |
| R1.6 | Write the pure OHLC maths | `src/trading/ohlc.ts` |
| R1.7 | Adapt one Remocn motion component, vendored with licence and provenance | `src/motion-components/` |
| R1.8 | Build the `CandlestickChart` component, its inspector and its definition | `src/trading/` |
| R1.9 | Prove the whole thing in the real render path | `scripts/verify-r1.mjs` |

## 3. Architecture decisions taken

- **The registry replaces the catalogue and the switch, it does not sit beside them.**
  `src/elements.ts` and `ElementContent`'s `switch (clip.element)` are gone. A component is now
  one definition module; adding one means writing that module and importing it in
  `src/registry/index.ts`.
- **`ElementType` stays the ID union.** The upstream editor already called these things elements;
  renaming the union across ten files would have produced churn without changing behaviour. The
  registry is the new concept, the ID type is unchanged.
- **Adapters are pure.** `render({clip, props, frame, fps})` — no editor state, no DOM, no clock.
  `frame` is clip-relative, matching Remotion's `useCurrentFrame()` inside a `Sequence`, so the
  adapted Remocn component keeps its upstream frame access untouched.
- **The chart's price scale is built from the visible bars only.** A future bar can never move
  the scale or reach the screen.
- **Provenance is visible in the output.** Synthetic series and simulated intrabar paths are
  labelled on the chart itself; adapted third-party source carries its licence and revision.
- **Documents are versioned.** `Project.schemaVersion` and `Clip.propsVersion` let a future
  change either migrate an old file or refuse it with a clear message.
- **The editor was not rebuilt.** The Vite + React + Zustand + Remotion stack, the timeline, the
  effect system, the presets and both export paths are the upstream ones.

## 4. Verification actually performed

| Check | Command | Result |
|---|---|---|
| Types | `npm run typecheck` | clean (was failing before R0.2) |
| Tests | `npm test` | **71 passed** across 5 files |
| Bundle | `npm run build` | 721 kB / 227 kB gzip |
| Render — stills | `node scripts/verify-r1.mjs --stills` | 5 PNGs in `out/verify/` (frames 0, 20, 45, 100, 179) |
| Render — video | `node scripts/verify-r1.mjs` | `out/chart-studio-r1.mp4` — h264, 1920×1080, 30 fps, 240 frames, 8.0 s |
| Editor surface | browser against `npm run dev` | library shows the chart and the motion component in their own groups; a chart dropped on a track arrives with a 180-frame length (12 bars × 15); the inspector shows the generated properties and the OHLC table; the preview renders the chart during playback (3 candles and the provenance label at frame 65) |
| Project round-trip in the app | opened a saved project through the editor's **Open** button | the project name, the clip and all six bars' OHLC values came back exactly |

Screenshots: `out/verify/editor-ui.png`, `out/verify/editor-playing.png`, `out/verify/frame-*.png`.

## 5. What R1 deliberately does not do

- No SQLite/OPFS persistence, no autosave format change beyond versioning.
- No SMT, no MTF, no chart groups, no HTF/LTF, no drawing tools, no indicators.
- No CSV import for a series — the OHLC table is the editor for now.
- The library panel is grouped by category, but it is not redesigned.
- Remocn contributes one component. The registry can take the rest; nothing is fetched at runtime.

## 6. Unresolved issues and known debt

1. `DOCS.md` still documents the removed `ELEMENTS` export. It is upstream documentation for the
   generic editor and was left as-is rather than rewritten.
2. `README.md` still claims the repository has no implementation. It needs a Chart Studio
   rewrite (R2 documentation task). **It is modified in the working tree and was deliberately not
   committed here.**
3. `docs/` describes a Next.js / pnpm / Turborepo target layout. The contracts in those documents
   were followed; the packaging was not. A short "how this maps onto the fork" note is still owed.
4. A chart placed at the canvas centre overlaps the sample project's text. That is the editor's
   existing layering behaviour, not a chart bug.
5. The Remocn component's `useCurrentFrame()` is the one documented exception to the "adapters
   are pure" rule — it is what lets the vendored source stay unmodified in its animation logic.
6. The verification render needs a browser and about 70 seconds, so it is a script rather than a
   test-suite entry.
7. The `server.mjs` render API and the CLI export both go through the migration now, but neither
   has a regression test — they are covered by the script and the manual run above.

## 7. Commits

| Commit | What it changed |
|---|---|
| `be17d8b` | Restore a clean typecheck gate (motion path effect ignores missing geometry) |
| `7b68281` | Define the typed video-component contract and the two new component IDs; wire up Vitest |
| `8ed5afb` | Give render adapters the project frame rate |
| `1585fcd` | Add the component registry mechanism |
| `b2dc070` | Track project and per-clip schema versions |
| `31ec42d` | Add a boolean inspector control |
| `8386a57` | Registry cutover: 22 inherited elements onto the registry, project migrations, dynamic clip length, inspector clip updates |
| `f681d7d` | Add the candlestick chart as the first trading component |
| `3af214f` | Keep an adapted motion title on one line |
| `e4be016` | Run exported projects through the same validation as opened projects |
| `ce46e05` | Document the upstream audit, the bootstrap and the known debt |
| `794b5d0` | Add the render check that proves the new components reach the exported video |
