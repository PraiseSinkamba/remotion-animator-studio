# Chart Studio — "Cinema" editor shell · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the editor shell in the shape of the Stitch "Cinema" layout (tool rail, tabbed library with grid/list, transport under the canvas, sectioned inspector, selection bounding box) and give it a real light/dark theme, without adding or removing a single capability.

**Architecture:** Same Vite + React 18 + Zustand + Remotion SPA, same shadcn/ui + Tailwind v4 foundation. The Stitch's flat zinc/indigo visual language becomes the token set; the layout is rebuilt with Tailwind utilities and shadcn primitives. The video path (`src/remotion/`, `src/trading/`, `src/motion-components/`, the export bundle) is untouched.

**Tech Stack:** React 18.3, Tailwind v4.3.3, shadcn/ui (radix base, `nova` style, lucide icons), Zustand 5, Remotion 4.0.538, Vite 5.4, TypeScript 5.6, Vitest 3.

## Global Constraints

- npm only, never pnpm. Do not add `pnpm-lock.yaml`.
- React 18.3, Vite 5.4, TypeScript 5.6 and every `remotion` / `@remotion/*` package stay exactly as they are (`4.0.538`).
- **No `npm install`, no `npm run build`, no `npm test`** inside a task — the coordinator runs the gates once at the end. A task may run `npx tsc -p tsconfig.json` as a local type check (no emit, no build info).
- Semantic tokens only: `bg-background`, `text-muted-foreground`, `border-border`, `bg-primary`, `text-primary-foreground`, `bg-secondary`, `bg-accent`, `bg-destructive`. Never a raw colour utility (`bg-zinc-900`), never a `dark:` variant — the theme class does that.
- Use the shadcn primitives already installed in `src/components/ui/` (`button`, `input`, `select`, `slider`, `switch`, `tabs`, `tooltip`, `dropdown-menu`, `dialog`, `separator`, `scroll-area`, `badge`, `card`, `label`, `textarea`, `sonner`). Do not add components; do not edit files in `src/components/ui/`.
- Icons: `lucide-react` only. Icons inside a `Button` get `data-icon="inline-start"` / `inline-end` and no size classes.
- `src/remotion/`, `src/trading/`, `src/motion-components/` are read-only for this plan. The only exception is Task 6, which adds an optional `bounds` descriptor to the registry.
- Every control that exists today keeps existing. Nothing from the Stitch is copied that we have no equivalent of.
- Commit per task with a subject that says what changed for the user.

---

## File Structure

**New**
- `src/lib/theme.tsx` — theme provider, `useTheme()`, localStorage persistence, system default.
- `src/components/theme-toggle.tsx` — Sun/Moon button.
- `src/components/ToolRail.tsx` — 48px tool rail.
- `src/components/library/*` — library pane pieces (tab strip, card, list row, view toggle).
- `src/components/inspector/*` — inspector pieces (section, row, header).
- `src/components/timeline/*` — timeline pieces (track row, clip chip, ruler).

**Modified**
- `src/index.css` — theme tokens for both modes, legacy palette re-pointed, legacy rules retired.
- `index.html` — pre-paint theme script.
- `src/main.tsx` — provider mount.
- `src/App.tsx` — shell layout (rail, panes, transport row).
- `src/components/TopBar.tsx`, `Library.tsx`, `Inspector.tsx`, `Timeline.tsx`, `PreviewPanel.tsx`.
- `src/registry/types.ts` + the definition modules — optional `bounds` descriptor.
- `docs/BOOTSTRAP.md`, `README.md`.

---

### Task 1: Theme foundation — tokens, provider, toggle

**Files:**
- Create: `src/lib/theme.tsx`, `src/components/theme-toggle.tsx`
- Modify: `src/index.css`, `index.html`, `src/main.tsx`

**Interfaces:**
- Produces: `useTheme(): { theme: 'light' | 'dark' | 'system'; resolvedTheme: 'light' | 'dark'; setTheme(t): void }`; `<ThemeProvider>`; `<ThemeToggle />`; CSS classes `.dark` on `<html>`; the token set below.

- [ ] **Step 1: Write the two-mode token set**

In `src/index.css`, replace the current `:root { --background: var(--bg); ... }` token block with a two-mode block. `:root` is **light**, `.dark` is **dark**:

```css
:root {
  --radius: 0.375rem;
  --background: #ffffff;
  --foreground: #18181b;
  --card: #fafafa;
  --card-foreground: #18181b;
  --popover: #ffffff;
  --popover-foreground: #18181b;
  --primary: #4f46e5;
  --primary-foreground: #ffffff;
  --secondary: #f4f4f4;
  --secondary-foreground: #18181b;
  --muted: #f4f4f4;
  --muted-foreground: #52525b;
  --surface-hover: #e4e4e7;
  --accent-foreground: #18181b;
  --destructive: #dc2626;
  --destructive-foreground: #ffffff;
  --input: #e4e4e7;
  --border: #e4e4e7;
  --ring: #4f46e5;
}

.dark {
  --background: #09090b;
  --foreground: #fafafa;
  --card: #18181b;
  --card-foreground: #fafafa;
  --popover: #18181b;
  --popover-foreground: #fafafa;
  --primary: #6366f1;
  --primary-foreground: #ffffff;
  --secondary: #27272a;
  --secondary-foreground: #fafafa;
  --muted: #27272a;
  --muted-foreground: #a1a1aa;
  --surface-hover: #27272a;
  --accent-foreground: #fafafa;
  --destructive: #f87171;
  --destructive-foreground: #18181b;
  --input: #3f3f46;
  --border: #3f3f46;
  --ring: #6366f1;
}
```

Keep the existing `@theme inline { … }` mapping block as it is — it already points the `--color-*` utilities at these variables.

- [ ] **Step 2: Re-point the legacy palette at the tokens**

The legacy block currently reads:

```css
:root {
  --bg: #0e0f13;
  --panel: #16181f;
  --panel-2: #1c1f28;
  --border: #262a35;
  --text: #e8eaf0;
  --text-dim: #8b90a0;
  --accent: #7c5cff;
  --accent-soft: rgba(124, 92, 255, 0.18);
  --danger: #ff5c6c;
}
```

Replace it with mode-aware aliases. `--border` must not shadow the token: the legacy block keeps the name `--border` but the *token* `--border` is defined above, so delete the legacy `--border` declaration and let the legacy rules use the token directly.

```css
:root {
  --bg: var(--background);
  --panel: var(--card);
  --panel-2: var(--muted);
  --text: var(--foreground);
  --text-dim: var(--muted-foreground);
  --accent: var(--primary);
  --accent-soft: color-mix(in oklab, var(--primary) 18%, transparent);
  --danger: var(--destructive);
}
```

Then add the dark variant of the legacy aliases right after the `.dark` token block:

```css
.dark {
  --bg: var(--background);
  --panel: var(--card);
  --panel-2: var(--muted);
  --text: var(--foreground);
  --text-dim: var(--muted-foreground);
  --accent: var(--primary);
  --accent-soft: color-mix(in oklab, var(--primary) 18%, transparent);
  --danger: var(--destructive);
}
```

- [ ] **Step 3: Add the dark variant**

Add, next to the Tailwind imports at the top of `src/index.css`:

```css
@custom-variant dark (&:is(.dark *));
```

- [ ] **Step 4: Write the provider**

`src/lib/theme.tsx`:

```tsx
import { createContext, useContext, useEffect, useMemo, useState } from 'react';

type Theme = 'light' | 'dark' | 'system';
const STORAGE_KEY = 'chart-studio-theme';

interface ThemeContextValue {
  theme: Theme;
  resolvedTheme: 'light' | 'dark';
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const systemTheme = (): 'light' | 'dark' =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const [theme, setThemeState] = useState<Theme>(
    () => (localStorage.getItem(STORAGE_KEY) as Theme | null) ?? 'system',
  );
  const [system, setSystem] = useState<'light' | 'dark'>(systemTheme);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => setSystem(mq.matches ? 'dark' : 'light');
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const resolvedTheme = theme === 'system' ? system : theme;

  useEffect(() => {
    document.documentElement.classList.toggle('dark', resolvedTheme === 'dark');
    document.documentElement.style.colorScheme = resolvedTheme;
  }, [resolvedTheme]);

  const value = useMemo<ThemeContextValue>(
    () => ({
      theme,
      resolvedTheme,
      setTheme: (next) => {
        localStorage.setItem(STORAGE_KEY, next);
        setThemeState(next);
      },
    }),
    [theme, resolvedTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
};
```

- [ ] **Step 5: Write the toggle**

`src/components/theme-toggle.tsx` — a `Button variant="ghost" size="icon"` that flips between light and dark, showing `Sun` in dark mode and `Moon` in light mode, with a `Tooltip` that names the action.

- [ ] **Step 6: Mount the provider and pre-apply the class**

`src/main.tsx`: wrap the app in `<ThemeProvider>` (import from `./lib/theme`).

`index.html`: add a script in `<head>` so the class is set before first paint:

```html
<script>
  (function () {
    try {
      var t = localStorage.getItem('chart-studio-theme');
      var dark = t === 'dark' || (t !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches);
      document.documentElement.classList.toggle('dark', dark);
      document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
    } catch (e) {}
  })();
</script>
```

- [ ] **Step 7: Verify and commit**

```bash
npx tsc -p tsconfig.json
git add src/index.css src/lib/theme.tsx src/components/theme-toggle.tsx src/main.tsx index.html
git commit -m "Give the editor a light and dark theme with a persisted toggle"
```

---

### Task 2: Tool rail

**Files:**
- Create: `src/components/ToolRail.tsx`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `useStore` (`selectedClipIds`, `startDrawingPath`, `startDrawingTrail`, `drawingPath`, `drawingTrail`).
- Produces: `<ToolRail />`, rendered as the first column of the shell (48px, `border-r`).

- [ ] **Step 1: Build the rail**

A `flex flex-col items-center gap-2 w-12 border-r bg-card` column of 32px icon buttons:

- **Select** (`MousePointer2`) — always present, always active; it is the default tool.
- **Draw Path** (`Spline`) — rendered only when the current selection has a `motionPath` effect; activates `startDrawingPath(clipId, effectId)`, exactly as the inspector button does today.
- **Draw Trail** (`PenTool`) — rendered only when the current selection is a `nodeTrail` clip; activates `startDrawingTrail(clipId)`.

Each button is a shadcn `Button variant="ghost" size="icon"`; the active one uses `variant="secondary"`. A `Tooltip` names each. The rail must not add a tool we do not have — no hand, no shapes, no chart tools.

- [ ] **Step 2: Mount it in the shell**

`src/App.tsx`: the shell's main row becomes `[ToolRail] [Library] [Preview] [Inspector]`. The rail sits inside the same flex row as the panels, before the library, and never changes the panel widths.

- [ ] **Step 3: Verify and commit**

```bash
npx tsc -p tsconfig.json
git add src/components/ToolRail.tsx src/App.tsx
git commit -m "Add the tool rail the editor shell was missing"
```

---

### Task 3: Library pane — tabs, grid/list, card grid

**Files:**
- Create: `src/components/library/*.tsx`
- Modify: `src/components/Library.tsx`

**Interfaces:**
- Consumes: `useStore` (project, clips, `addElement`/preset-apply actions, `drag` payload contract), the registry (`listComponents`, `CATEGORY_ORDER`), `src/presets.ts`.
- Produces: the new library pane. **The drag-and-drop payload and the click-to-add behaviour must not change** — only the presentation.

- [ ] **Step 1: Build the tab strip**

Tabs over content that exists:

| Tab | Contents |
|---|---|
| Presets | the five templates from `src/presets.ts` |
| Text | `text`, `html`, `counter` |
| Media | `image`, `video`, `gif`, `emoji`, `particles`, `blob` |
| Audio | `audio`, `wave` |
| Scene | `background`, `shape`, `cursor`, `synthGrid`, `neonSun`, `isoCity`, `skyCycle`, `sunMoon`, `ridge`, `commitGraph`, `nodeTrail` |
| Chart | `candlestickChart` |
| Motion | `remocnMarkerHighlight`, `remocnSoftBlurIn`, `remocnTypewriter` |

Use the installed shadcn `Tabs` (`TabsList`/`TabsTrigger`), allowed to wrap to two rows (`flex-wrap`). The tab is a filter, not a new component source: every entry still comes from the registry or the preset list.

- [ ] **Step 2: Build the view toggle**

Two 24px icon buttons (`LayoutGrid`, `List`) in a bordered rounded group, right of the search field. The choice persists in `localStorage` under `chart-studio-library-view`.

- [ ] **Step 3: Build the card grid**

Grid view: two columns of compact cards — icon tile (28px, tinted with a muted surface), a type chip, the name, a one-line description, and a footer row (duration chip for presets, "Add" for components). List view: the same information as a single compact row per item.

Categories become sticky group headers with a small coloured dot, an uppercase 10px label and a count chip, in the same spirit as the Stitch's "Ready-Made Animations" / "Overlays & Badges" headers.

- [ ] **Step 4: Keep behaviour**

Clicking a component still adds it to the timeline exactly as today; dragging still carries the same payload; the search still filters the active tab. Nothing is added or removed functionally.

- [ ] **Step 5: Verify and commit**

```bash
npx tsc -p tsconfig.json
git add src/components/Library.tsx src/components/library
git commit -m "Rebuild the library pane with tabs, a view toggle and a card grid"
```

---

### Task 4: Inspector — accent bar, tabs, sectioned rows

**Files:**
- Create: `src/components/inspector/*.tsx`
- Modify: `src/components/Inspector.tsx`

**Interfaces:**
- Consumes: the current inspector's store calls (`updateClipProps`, `removeEffect`, `duplicateSelection`, `removeClips`, `startDrawingPath`, `startDrawingTrail`, `formatHtml`) and the registry's `params`/`inspector` descriptors.
- Produces: the new inspector. Every field and action survives.

- [ ] **Step 1: Build the shell**

- A 2px `bg-primary` accent bar across the top of the panel.
- A sticky header: the component's icon, its name, and a type chip.
- A `Properties | Effects` tab strip (shadcn `Tabs`).

- [ ] **Step 2: Build the sectioned rows**

A `Section` component renders an uppercase 10px `text-muted-foreground` header with a hairline separator, and a `Row` component renders a label on the left and the control on the right (`justify-between`, value in `font-mono text-xs`).

Section order in `Properties`:

1. `CLIP` — name, start frame, length frames.
2. `POSITION` — x and y, **only** when the selected component exposes them (the registry's `x`/`y` params).
3. `PROPERTIES` — the component's own params, unchanged in content and behaviour.
4. `ACTIONS` — duplicate, delete.

`Effects` holds the effect list and the per-effect controls that exist today.

- [ ] **Step 3: Keep behaviour**

The commit-on-blur/Enter contract, the boolean `Switch`, the colour picker, the range slider, the text and textarea fields, the HTML formatter button and the draw-path/draw-trail buttons all keep working exactly as they do now.

- [ ] **Step 4: Verify and commit**

```bash
npx tsc -p tsconfig.json
git add src/components/Inspector.tsx src/components/inspector
git commit -m "Reorganise the inspector into ordered, labelled sections"
```

---

### Task 5: Timeline — Stitch track rows and clip chips

**Files:**
- Create: `src/components/timeline/*.tsx`
- Modify: `src/components/Timeline.tsx`

**Interfaces:**
- Consumes: the current timeline's store calls and drag/trim behaviour.
- Produces: the restyled timeline. No new timeline behaviour.

- [ ] **Step 1: Restyle the rows**

A fixed-width label column on the left of each track, a compact row per track, clip chips that carry the track colour, an indigo playhead, a mono time ruler, and the zoom slider on the right. Use semantic tokens and Tailwind utilities; use the shadcn `ScrollArea`/`Separator` where they help.

- [ ] **Step 2: Keep behaviour**

Drag to reorder, trim handles, click to select, multi-select, the zoom slider and the playhead scrubbing all keep working exactly as today.

- [ ] **Step 3: Verify and commit**

```bash
npx tsc -p tsconfig.json
git add src/components/Timeline.tsx src/components/timeline
git commit -m "Restyle the timeline with compact track rows and clip chips"
```

---

### Task 6: Top bar, canvas transport and the selection bounding box

**Files:**
- Modify: `src/components/TopBar.tsx`, `src/components/PreviewPanel.tsx`, `src/App.tsx`, `src/registry/types.ts`, `src/registry/legacy.ts`, `src/trading/definition.ts`, `src/motion-components/definitions/soft-blur-in.ts`, `src/motion-components/definitions/typewriter.ts`

**Interfaces:**
- Consumes: the store's clip/position state, the `ThemeToggle` from Task 1.
- Produces: the restyled top bar, the transport bar under the canvas, and the selection overlay.

- [ ] **Step 1: Restyle the top bar**

Flat bar, `h-13`, `border-b`, `bg-card/90 backdrop-blur`. Brand square (rounded, primary-tinted) with the product name and a version chip; the project name as a borderless input that shows its field on hover; the format group (size, width × height, duration, fps) as a bordered pill group with mono figures; undo/redo as ghost icon buttons; "Saved locally" as a rounded-full chip with a status dot; the theme toggle next to it; **Export MP4** as the primary button.

Every control stays: New, Save, Save As, Open, Help, Still export, size, width/height, duration, fps, undo, redo, the saved indicator, and the export action.

- [ ] **Step 2: Move playback under the canvas**

Remove play/pause and mute from the top bar and put them in a transport strip directly under the preview: play/pause, mute, a mono `time / duration` readout and the current frame number. The strip is `border-t` and `bg-card`.

- [ ] **Step 3: Add the selection bounding box**

- Add an optional `bounds?: (props: Record<string, unknown>) => { x: number; y: number; width: number; height: number }` to `VideoComponentDefinition` in `src/registry/types.ts`.
- Provide it for the registry definitions: use `props.x`/`props.y` for the position and the component's `width`/`height` props (or its default size) for the box. Components without a size fall back to a 320×180 box so the overlay still shows where the element is.
- In `src/components/PreviewPanel.tsx`, render an editor-only overlay layer over the Player: for the selected clip, an indigo 1.5px outline, eight square handles and a small size readout in mono.
- Dragging inside the box keeps the existing move behaviour.
- Dragging a corner handle resizes **only** when the selected component exposes numeric `width`/`height` params — then it writes those props. Otherwise the handles are not drawn; the box is informational.
- The overlay lives entirely in the editor DOM. Nothing about it reaches the composition or the export.

- [ ] **Step 4: Verify and commit**

```bash
npx tsc -p tsconfig.json
git add src/components/TopBar.tsx src/components/PreviewPanel.tsx src/App.tsx src/registry src/trading/definition.ts src/motion-components/definitions
git commit -m "Restyle the top bar, move playback under the canvas and show the selection box"
```

---

### Task 7: Retire the dead stylesheet rules

**Files:**
- Modify: `src/index.css`

- [ ] **Step 1: Delete the rules nothing uses**

After Tasks 1–6, every legacy class that no longer appears in `src/**/*.tsx` is dead. Delete those rules from the `@layer legacy` block. Keep the rules that still apply (timeline, canvas, status bar, and anything the chrome still uses).

Prove each deletion with a search before removing it:

```bash
grep -rn "className=\"btn" src --include=*.tsx | grep -v src/components/ui
```

Expected: no hits for any class you delete.

- [ ] **Step 2: Verify and commit**

```bash
npx tsc -p tsconfig.json
git add src/index.css
git commit -m "Drop the stylesheet rules the new shell replaced"
```

---

### Task 8: Documentation and verification (coordinator)

**Files:**
- Modify: `README.md`, `docs/BOOTSTRAP.md`, `docs/architecture/UPSTREAM_AUDIT.md`, `docs/decisions/ADR-005-SHADCN-AND-TAILWIND.md`

- [ ] **Step 1: Update the docs**

README and BOOTSTRAP describe the new shell, the light/dark theme, the rail, the library tabs and the transport. ADR-005 gains the light/dark token table and the exit strategy note. UPSTREAM_AUDIT gains a short R3 addendum.

- [ ] **Step 2: Run the gates**

```bash
npm run typecheck
npm test
npm run build
node scripts/verify-r1.mjs
```

Expected: typecheck clean, all tests pass, the build succeeds, and the render produces the same frames as before (the export is unaffected by theming).

- [ ] **Step 3: Browser pass in both modes**

Run `npm run dev`, then capture screenshots into `out/verify/`: the top bar, the rail, the library in grid and list, the inspector, the timeline, the render and help dialogs, and a selected element with its bounding box — in **dark** and in **light**.

---

## Self-review

- **Spec coverage:** §2 rail → Task 2; §2 library → Task 3; §2 inspector → Task 4; §2 timeline → Task 5; §2 top bar / transport / bounding box → Task 6; §3 theme → Task 1; §7 bounds → Task 6; §9 dead CSS → Task 7; §10 verification → Task 8.
- **Ownership:** `src/index.css` is written only by Tasks 1 and 7; `src/App.tsx` by Tasks 2 and 6; `src/components/TopBar.tsx` only by Task 6; `src/components/PreviewPanel.tsx` only by Task 6. Tasks 2–5 touch disjoint files and may run in parallel after Task 1.
- **Placeholder scan:** every step names a file, a command and an expected result.
