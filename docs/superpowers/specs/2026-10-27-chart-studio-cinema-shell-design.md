# Chart Studio — "Cinema" editor shell, Stitch-inspired, with light and dark modes

**Status:** Design approved by owner · **Date:** 2026-10-27
**Inspiration:** Stitch project *Shadcn UI Overhaul* (id 3054282320112390430), screen *Remotion Animator — Cinema Modular Layout* (id 269916f2822b4cdeb3722221bf5d671d). Local copies: `.tmp/stitch/cinema.png`, `.tmp/stitch/cinema.html`.
**Authority:** `docs/architecture/UPSTREAM_AUDIT.md` (the repo keeps the Vite SPA), `docs/decisions/ADR-003-COMPONENT-SYSTEM.md`, `docs/spec/COMPONENT_CONTRACT.md`, `docs/decisions/ADR-005-SHADCN-AND-TAILWIND.md`.

## 1. Intent

The editor's *information architecture* is rebuilt in the shape of the Stitch screen — a tool rail, a tabbed left pane, a transport bar under the canvas, a sectioned inspector, a denser timeline — and its *visual language* is replaced with the Stitch's flat zinc/indigo system, now with a working light mode.

Two rules govern the whole slice:

- **Adapt, don't clone.** Every control, field, tab, track and shortcut we have today survives. Nothing from the Stitch is imported that we have no equivalent of (no guides toggle, no magnetic snapping, no "Blur" inspector tab, no "Data & Metrics" category, no new component types).
- **The video path is untouchable.** `src/remotion/`, `src/trading/`, `src/motion-components/` and the export bundle keep producing byte-identical frames. The export bundle imports no CSS, so theming cannot reach it.

## 2. What the Stitch contributes

| From the Stitch | Our adaptation |
|---|---|
| 48px icon tool rail, left | Rail with the tools that exist today: **Select** (always), **Draw Path** / **Draw Trail** (rendered only when the current selection makes them meaningful). The rail is the documented home for the future chart tools (candle, line, zone, position, arrow, text, SMT). |
| 300px pane, search + segmented tabs + grid/list toggle | **Library**: search, tab strip, grid/list toggle, sticky category headers, compact cards. |
| Card grid: icon tile, tag chip, title, subtitle, footer (+ Add) | Same card anatomy for presets and components, in both grid and list density. |
| Transport bar under the canvas | **Transport**: play/pause, mute, time + frame readout, moved out of the top bar. |
| Inspector: accent bar, header, tabs, sectioned label→value rows | **Inspector**: 2px accent bar, sticky header, `Properties \| Effects` tabs, sections `CLIP · POSITION · PROPERTIES · EFFECTS · ACTIONS` with 10px uppercase labels and right-aligned values. |
| Blue selection rectangle with handles on the canvas | **Selection overlay**: indigo outline, corner handles, size readout; drag to move (already exists), corner drag resizes the components that expose width/height. |
| Flat zinc surfaces, 1px borders, small radii, indigo accent | The new token set, in **light and dark**. |
| 9px/10px micro-typography, uppercase tracking headers | Section headers, badges and the transport use it; body text stays 13px. |

## 3. Theme model

- **Tokens.** One semantic set, two modes. Dark: canvas `#09090b`, panel `#18181b`, raised `#27272a`, border `#3f3f46`, text `#fafafa`, muted `#a1a1aa`, primary `#6366f1`, destructive `#f87171`. Light: canvas `#ffffff`, panel `#fafafa`, raised `#f4f4f4`, border `#e4e4e7`, text `#18181b`, muted `#52525b`, primary `#4f46e5`, destructive `#dc2626`.
- **Mechanism.** `.dark` on `<html>`, `@custom-variant dark (&:is(.dark *))`, `:root` = light. The shadcn primitives flip on their own because they only use semantic tokens.
- **Legacy CSS.** The nine hand-written palette variables (`--bg`, `--panel`, `--panel-2`, `--border`, `--text`, `--text-dim`, `--accent`, `--accent-soft`, `--danger`) are re-pointed at the semantic tokens, so the 104 legacy class rules follow the mode instead of owning a second palette. The legacy rules lose the hardcoded dark values.
- **Provider.** `src/lib/theme.tsx` — `theme: 'light' | 'dark' | 'system'`, resolved mode, `localStorage` key `chart-studio-theme`, default `system`. `src/components/theme-toggle.tsx` — a Sun/Moon button in the top bar next to the saved-status chip.
- **No webfont.** The app is local-first and must work offline; a self-hosted IBM Plex Sans is not worth the payload. The system sans stack is used, with the Stitch's micro-typography applied through size and weight.

## 4. Layout

```
┌───────────────────────────────────────────────────────────────────────────┐
│ top bar  brand · project name · New/Save/Save As/Open/Help/Still · format  │
│          group · undo/redo · saved chip · theme toggle · Export MP4        │
├────┬──────────────┬────────────────────────────────┬──────────────────────┤
│rail│ library      │ canvas (selection overlay)     │ inspector            │
│48px│ 300px        │ transport: play/pause, mute,   │ 300px                │
│    │ search       │          time + frame          │ accent bar, header,  │
│    │ tabs         ├────────────────────────────────┤ Properties|Effects,   │
│    │ grid|list    │ timeline: tracks, clips, ruler │ sectioned rows       │
│    │ card grid    │                                │                      │
├────┴──────────────┴────────────────────────────────┴──────────────────────┤
│ status bar: hints                                                            │
└───────────────────────────────────────────────────────────────────────────┘
```

Playback transport moves from the top bar to the strip directly under the canvas. The timeline keeps its zoom control; the inspector keeps every current section and control.

## 5. Library

- **Tabs** map to content that exists: `Presets` (the five templates in `src/presets.ts`), `Text` (`text`, `html`, `counter`), `Media` (`image`, `video`, `gif`, `emoji`, `particles`, `blob`), `Audio` (`audio`, `wave`), `Scene` (`background`, `shape`, `cursor`, and the generative scenes), `Chart` (`candlestickChart`), `Motion` (the three Remocn components). The strip wraps to two rows.
- **Grid / list toggle** changes the density of the card area; the choice is remembered in `localStorage`.
- **Cards** carry the icon tile, a type chip, the name, a one-line description and a footer (duration for presets, "Add" for components). Click adds to the timeline; drag still works.
- **Search** filters across the active tab.

## 6. Inspector

- 2px primary accent bar across the top; sticky header with the component icon, name and type chip.
- `Properties | Effects` tabs. `Properties` holds the sections; `Effects` holds the effect list and the "add effect" affordance.
- Sections in order: `CLIP` (name, start, length), `POSITION` (x/y — only for components that have them), `PROPERTIES` (the component's own params), `ACTIONS` (duplicate, delete). `EFFECTS` lives in its own tab.
- Every current control survives; only the presentation changes (uppercase 10px labels, right-aligned values, mono figures).

## 7. Selection overlay

- A new **optional** `bounds?: (props) => { x, y, width, height }` on the registry definition, so the editor can size a box for any component. Default fallback: `props.x/y` with `props.width/height` when present, otherwise the component's default size.
- The overlay draws an indigo outline, eight handles and a size readout over the Player.
- Dragging the body moves the selection (existing behaviour, unchanged). Dragging a corner handle resizes the component **only when it exposes numeric `width`/`height` params**; otherwise the box is informational. No scale system is invented for components that have none.
- The overlay is editor-only DOM. It never enters the composition.

## 8. Timeline

Restyled to the Stitch: a fixed label column, compact track rows, clip chips with the track colour, indigo playhead, mono time ruler, zoom slider on the right. Drag, trim, snapping to the current behaviour — no new timeline behaviour.

## 9. Non-goals

Guides and magnetic snapping, a Blur inspector tab, a Data & Metrics category, new component types, new editing verbs, a webfont, a themeable *video* canvas (the project background colour stays a project property), any change to the render or export path.

## 10. Verification

1. `npm run typecheck`, `npm test`, `npm run build` pass.
2. `node scripts/verify-r1.mjs` still renders the same frames — the export is unaffected.
3. Browser pass in **both** modes: screenshots of the top bar, rail, library (grid and list), inspector, timeline, dialogs and a selected element with its bounding box, saved to `out/verify/`.
4. The selection overlay moves the selection and resizes a component that supports it.
5. The theme toggle flips the whole shell and survives a reload.

## 11. Implementation mechanics

Built in a dedicated worktree (`feature/chart-studio-cinema`) by parallel agents over disjoint file sets, verified there, then merged into `main`. The legacy `.btn`-era CSS shrinks as the chrome moves to Tailwind utilities and shadcn primitives; rules that no longer have a consumer are deleted in the same slice.
