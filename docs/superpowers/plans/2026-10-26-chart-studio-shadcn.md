# Chart Studio — shadcn/ui adoption and Remocn expansion · Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Install Tailwind CSS v4 and shadcn/ui into the existing Chart Studio editor shell, convert the editor chrome to shadcn primitives, and finish the Remocn evaluation with two more vendored components — all verified through the real Remotion render path.

**Architecture:** The repository stays a Vite + React 18 + Zustand + Remotion SPA (decision recorded in `docs/architecture/UPSTREAM_AUDIT.md` §4.1). Tailwind v4 is added to the single global stylesheet `src/index.css` **without preflight** so the editor DOM keeps its current behaviour and the in-app Remotion preview stays pixel-identical to the export (the export bundle imports no CSS at all). shadcn/ui primitives live in `src/components/ui/` and are used only by editor chrome — never by `src/remotion/`, `src/registry/` or `src/trading/` render adapters. Remocn components are vendored source with licence + provenance + a registry definition, exactly as `src/motion-components/marker-highlight.tsx` does today.

**Tech Stack:** Tailwind CSS 4.3.3, shadcn/ui CLI 4.22.1 (base `radix`, style `nova`, icons `lucide`), React 18.3, Remotion 4.0.538, Vite 5.4, TypeScript 5.6, Vitest 3.

## Global Constraints

- Package manager is **npm** (`package-lock.json`), never pnpm. Do not add a `pnpm-lock.yaml`.
- **React stays 18.3.x. Vite stays 5.4.x. TypeScript stays 5.6.x.** All `remotion` and `@remotion/*` packages stay pinned to exactly `4.0.538` — version drift between them caused a preview crash before.
- The app is always dark. Do not add a light theme or a theme switcher.
- shadcn components use **semantic tokens only** (`bg-background`, `text-muted-foreground`, `border-border`). Never a raw colour utility (`bg-blue-500`) and never a `dark:` variant.
- No `src/components/ui/*` import may appear in `src/remotion/`, `src/registry/`, `src/trading/` or `src/motion-components/` — those are the video path.
- Third-party source is **vendored**, never fetched at runtime. Keep the upstream copy verbatim next to the adapted copy.
- New `ElementType` ids are **appended** to the union in `src/types.ts` and never renumbered — the ids are persisted in project files.
- Every shadcn CLI command runs with the project's runner: `npx shadcn@latest …`. Never hand-edit a file the CLI generated.
- Commit after every task. Commit subject leads with what changed for the user, not with file names.
- Verification commands are the gates: `npm run typecheck`, `npm test`, `npm run build`, `node scripts/verify-r1.mjs`.

---

## File Structure

**Created**
- `components.json` — shadcn project config (Vite, no RSC).
- `src/lib/utils.ts` — `cn()` helper.
- `src/components/ui/*.tsx` — shadcn primitives (CLI-generated).
- `src/motion-components/upstream/soft-blur-in.tsx`, `src/motion-components/upstream/typewriter.tsx` — verbatim upstream source.
- `src/motion-components/soft-blur-in.tsx`, `src/motion-components/typewriter.tsx` — adapted copies.
- `src/motion-components/definitions/soft-blur-in.ts`, `src/motion-components/definitions/typewriter.ts` — registry definitions.
- `docs/decisions/ADR-005-SHADCN-AND-TAILWIND.md` — dependency adoption record.

**Modified**
- `package.json`, `package-lock.json` — Tailwind v4 + Radix primitives + `lucide-react` + `class-variance-authority` + `clsx` + `tailwind-merge`.
- `vite.config.ts` — Tailwind plugin + `@` alias.
- `tsconfig.json` — `baseUrl` + `paths`.
- `src/index.css` — Tailwind theme/utilities (no preflight) + shadcn token block.
- `src/types.ts` — two appended `ElementType` ids.
- `src/registry/index.ts` — import the two new definition modules.
- `src/components/TopBar.tsx`, `src/components/Inspector.tsx`, `src/components/Library.tsx`, `src/components/RenderDialog.tsx`, `src/components/HelpModal.tsx`, `src/components/StorageIndicator.tsx`, `src/components/Timeline.tsx`, `src/components/PreviewPanel.tsx`.
- `src/motion-components/PROVENANCE.md` — two new component records.
- `docs/BOOTSTRAP.md`, `docs/architecture/UPSTREAM_AUDIT.md`, `docs/roadmap/ROADMAP.md`, `docs/README.md`, `README.md`.

---

### Task 1: Tailwind v4 foundation, path alias, shadcn config

**Files:**
- Modify: `package.json`, `vite.config.ts`, `tsconfig.json`, `src/index.css`
- Create: `components.json`, `src/lib/utils.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `@/*` → `./src/*` import alias; Tailwind utility classes available app-wide; shadcn semantic CSS variables (`--background`, `--foreground`, `--card`, `--primary`, `--muted-foreground`, `--destructive`, `--border`, `--input`, `--ring`, `--radius`, `--surface-hover`); `cn()` exported from `@/lib/utils`.

- [ ] **Step 1: Install Tailwind v4**

```bash
npm install -D tailwindcss@4.3.3 @tailwindcss/vite@4.3.3
```

Expected: `added 2 packages` (or similar) and both packages appear in `devDependencies` with exact versions.

- [ ] **Step 2: Add the `@` path alias to TypeScript**

In `tsconfig.json`, inside `compilerOptions`, after `"jsx": "react-jsx"`, add:

```json
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    },
```

Do not touch `include`, `types` or any existing key.

- [ ] **Step 3: Add the Tailwind plugin and the alias to Vite**

In `vite.config.ts`, change the import block to:

```ts
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vitest/config';
import { fileURLToPath, URL } from 'node:url';
```

and change `plugins: [react()],` to:

```ts
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
```

`__dirname` is unavailable in this ESM config — use `fileURLToPath(new URL(...))`.

- [ ] **Step 4: Wire Tailwind into the global stylesheet — without preflight**

`src/index.css` currently starts with a `* { box-sizing: border-box; margin: 0; padding: 0; }` reset and then the app's `:root` palette. **Preflight must not be imported.** The in-app Remotion preview renders inside the app DOM while the export bundle imports no CSS at all; importing preflight would change the preview and not the export, breaking the preview/export parity invariant.

Replace the first two lines of `src/index.css` (the `* { … }` reset) with:

```css
@layer theme, base, components, utilities;
@import "tailwindcss/theme.css" layer(theme);
@import "tailwindcss/utilities.css" layer(utilities);

@layer base {
  *,
  ::before,
  ::after {
    border-style: solid;
    border-width: 0;
  }

  button,
  input,
  select,
  textarea {
    font: inherit;
    color: inherit;
  }
}

@layer base {
  *,
  ::before,
  ::after {
    border-color: var(--color-border);
  }
}
```

The `border-style: solid` reset is what shadcn's `border` utilities need (Tailwind's preflight normally provides it); everything else keeps the browser defaults the legacy editor already relies on.

- [ ] **Step 5: Add the shadcn token block**

Still in `src/index.css`, append at the end of the file:

```css
@theme inline {
  --radius-sm: calc(var(--radius) - 4px);
  --radius-md: calc(var(--radius) - 2px);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) + 4px);
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--surface-hover);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-destructive-foreground: var(--destructive-foreground);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --color-chart-1: #7c5cff;
  --color-chart-2: #38bdf8;
  --color-chart-3: #facc15;
  --color-chart-4: #ff5c6c;
  --color-chart-5: #34d399;
}

:root {
  --radius: 0.5rem;
  --background: var(--bg);
  --foreground: var(--text);
  --card: var(--panel);
  --card-foreground: var(--text);
  --popover: var(--panel);
  --popover-foreground: var(--text);
  --primary: var(--accent);
  --primary-foreground: #ffffff;
  --secondary: var(--panel-2);
  --secondary-foreground: var(--text);
  --muted: var(--panel-2);
  --muted-foreground: var(--text-dim);
  --surface-hover: #262a35;
  --accent-foreground: var(--text);
  --destructive: var(--danger);
  --destructive-foreground: #ffffff;
  --input: var(--border);
  --ring: var(--accent);
}
```

The shadcn "accent" token is mapped to `--surface-hover`, **not** to the legacy `--accent` variable: the legacy `--accent` is the brand purple `#7c5cff` and the brand maps to `--primary`. Reusing `--accent` for shadcn's hover surface would silently repaint every legacy button that uses `var(--accent)`.

- [ ] **Step 6: Create `components.json`**

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "nova",
  "rsc": false,
  "tsx": true,
  "tailwind": {
    "config": "",
    "css": "src/index.css",
    "baseColor": "neutral",
    "cssVariables": true,
    "prefix": ""
  },
  "iconLibrary": "lucide",
  "aliases": {
    "components": "@/components",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks",
    "utils": "@/lib/utils"
  }
}
```

- [ ] **Step 7: Create `src/lib/utils.ts`**

```ts
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
```

- [ ] **Step 8: Verify the foundation**

```bash
npm install
npm run typecheck
npm run build
```

Expected: typecheck clean, build succeeds. Then confirm the legacy stylesheet survived:

```bash
grep -n "^\.btn {" src/index.css
grep -n "^\.timeline" src/index.css
```

Expected: both match (the legacy rules are still there). Also confirm no preflight crept in:

```bash
grep -n "tailwindcss/preflight" src/index.css
```

Expected: no output.

- [ ] **Step 9: Commit**

```bash
git add package.json package-lock.json vite.config.ts tsconfig.json src/index.css components.json src/lib/utils.ts
git commit -m "Add Tailwind CSS v4 and the shadcn/ui foundation to the editor shell"
```

---

### Task 2: Install the shadcn primitives

**Files:**
- Create: `src/components/ui/*.tsx` (CLI-generated)
- Modify: `package.json`, `package-lock.json`

**Interfaces:**
- Consumes: `components.json`, `@/lib/utils` from Task 1.
- Produces: `Button`, `Input`, `Textarea`, `Label`, `Select`, `Slider`, `Switch`, `Dialog`, `Tabs`, `Tooltip`, `DropdownMenu`, `Separator`, `ScrollArea`, `Badge`, `Card`, `Sonner` (toast) exported from `@/components/ui/*`.

- [ ] **Step 1: Install the primitives through the CLI**

```bash
npx shadcn@latest add button input textarea label select slider switch dialog tabs tooltip dropdown-menu separator scroll-area badge card sonner
```

Expected: each component is created under `src/components/ui/`, and the CLI adds `class-variance-authority`, `clsx`, `tailwind-merge`, `radix-*` and `lucide-react` to `package.json`.

- [ ] **Step 2: Check what the CLI actually wrote**

```bash
ls src/components/ui
grep -n "from \"@/lib/utils\"" src/components/ui/*.tsx
```

Expected: every file that uses `cn` imports it from `@/lib/utils`. If any file imports `@/utils` or a relative path, rewrite that import to `@/lib/utils` — the CLI assumes a different layout.

- [ ] **Step 3: Verify the build**

```bash
npm run typecheck
npm run build
```

Expected: clean typecheck, successful build. If a component fails to typecheck on React 18, drop that component (delete its file from `src/components/ui/`, remove its import) and use the simpler alternative: `Label` instead of `Field`, plain `Input` instead of `InputGroup`, `Select` instead of `Combobox`. Record the substitution in the ADR.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json src/components/ui
git commit -m "Add the shadcn/ui component set the editor controls need"
```

---

### Task 3: Convert the top bar to shadcn

**Files:**
- Modify: `src/components/TopBar.tsx`

**Interfaces:**
- Consumes: `Button`, `Input`, `Select`, `DropdownMenu`, `Tooltip`, `Dialog` from Task 2; `lucide-react` icons.
- Produces: no new exports. Behaviour must be identical: open/save/save-as, export dialog, help dialog, undo/redo, resolution + fps inputs, play/pause, mute.

- [ ] **Step 1: Replace the button classes**

Every `<button className="btn …">` becomes `<Button variant="…" size="sm">`:

| Current | Replacement |
|---|---|
| `btn btn-primary` | `<Button size="sm">` (primary is the default variant) |
| `btn` | `<Button variant="outline" size="sm">` |
| `btn btn-small` | `<Button variant="outline" size="sm">` |
| `btn btn-danger` | `<Button variant="destructive" size="sm">` |
| icon-only button | `<Button variant="ghost" size="icon">` |

- [ ] **Step 2: Replace the text inputs**

`<input className="project-name" …>` becomes `<Input className="w-[170px]" …>`; the numeric size inputs become `<Input type="number" className="w-[62px]" …>`. Keep the existing commit-on-blur/Enter behaviour (`SizeInput` commits on blur or Enter, not on every keystroke) — do not let the shadcn `Input` change that contract.

- [ ] **Step 3: Replace the resolution and fps selectors**

The `<select>` for resolution becomes a shadcn `Select` with `SelectTrigger` / `SelectContent` / `SelectGroup` / `SelectItem`. The fps control is a number input — keep it as `Input type="number"`.

- [ ] **Step 4: Replace the emoji icons with lucide icons**

Use `lucide-react`: `Play`, `Pause`, `Undo2`, `Redo2`, `Save`, `FolderOpen`, `Download`, `Upload`, `HelpCircle`, `Volume2`, `VolumeX`. Icons inside a `Button` get `data-icon="inline-start"` (or `inline-end`); do **not** add size classes to the icon.

- [ ] **Step 5: Verify**

```bash
npm run typecheck
npm test
npm run build
```

Expected: all pass. Then open the app and confirm the top bar still opens/saves a project, toggles playback, and opens the export and help dialogs.

- [ ] **Step 6: Commit**

```bash
git add src/components/TopBar.tsx
git commit -m "Give the editor top bar shadcn controls and real icons"
```

---

### Task 4: Convert the inspector controls to shadcn

**Files:**
- Modify: `src/components/Inspector.tsx`

**Interfaces:**
- Consumes: `Input`, `Textarea`, `Label`, `Select`, `Slider`, `Switch`, `Button` from Task 2.
- Produces: no new exports. The store contract (`updateClipProps`, commit-on-blur) is unchanged.

- [ ] **Step 1: Map each parameter kind to a shadcn control**

| `ParamDef.kind` | Current markup | Replacement |
|---|---|---|
| `number` with `min` and `max` | `input[type=range]` + `input[type=number]` | `Slider` (Radix) bound to a local value, plus `Input type="number"`; both commit on release/blur |
| `number` without range | `input[type=number]` | `Input type="number"` |
| `color` | `input[type=color]` + text input | `Input type="color"` + `Input` |
| `text` | `input[type=text]` | `Input` |
| `textarea` | `textarea` | `Textarea` |
| `select` | `select` | `Select` with `SelectGroup` + `SelectItem` |
| `boolean` | the existing checkbox-style control | `Switch` |

- [ ] **Step 2: Keep the commit semantics**

The current control calls `onCommit()` before mutating so the in-progress edit is flushed. The `Slider` must update a local state while dragging and call `onChange` on release — never on every pointer move.

- [ ] **Step 3: Label the controls**

Use `Label` with `htmlFor` and a stable id built from the clip id and the param key (`id={`${clip.id}-${def.key}`}`). Do not use `Field`/`FieldGroup` unless Task 2 installed them successfully.

- [ ] **Step 4: Replace the action buttons**

`btn` → `Button variant="outline"`, `btn btn-danger` → `Button variant="destructive"`, `btn btn-small` → `Button variant="outline" size="sm"`.

- [ ] **Step 5: Verify**

```bash
npm run typecheck
npm test
npm run build
```

Expected: all pass. In the browser: select a clip, change every kind of parameter (number, colour, text, textarea, select, boolean) and confirm the value reaches the store and the preview.

- [ ] **Step 6: Commit**

```bash
git add src/components/Inspector.tsx
git commit -m "Replace the inspector's hand-rolled inputs with shadcn controls"
```

---

### Task 5: Convert the library, the dialogs and the storage indicator

**Files:**
- Modify: `src/components/Library.tsx`, `src/components/RenderDialog.tsx`, `src/components/HelpModal.tsx`, `src/components/StorageIndicator.tsx`, `src/components/Timeline.tsx`, `src/components/PreviewPanel.tsx`

**Interfaces:**
- Consumes: `Card`, `Badge`, `ScrollArea`, `Tabs`, `Dialog`, `Button`, `Separator` from Task 2.
- Produces: no new exports.

- [ ] **Step 1: Library panel**

Keep the three category groups (`generic`, `trading`, `motion`) and the drag-and-drop behaviour — the drop target must keep working. Use `ScrollArea` for the scroll container, `Badge` for the category label and the component type, and `Card` only where a card is genuinely a card (do not wrap every row in a `Card`).

- [ ] **Step 2: Render and help dialogs**

Convert `RenderDialog.tsx` and `HelpModal.tsx` to shadcn `Dialog`: `DialogContent` containing `DialogHeader` + `DialogTitle` (+ `DialogDescription` where it helps), `DialogBody` content, and `DialogFooter` with the actions. A `Dialog` without a `DialogTitle` fails the accessibility rule — give the help dialog a visible title and the render dialog the project name.

- [ ] **Step 3: Storage indicator**

`StorageIndicator.tsx` becomes a `Badge` (`variant="secondary"` for the fallback state, default for SQLite) with a lucide icon (`Database`, `HardDrive`, `TriangleAlert`). Keep the tooltip that explains the current backend.

- [ ] **Step 4: Timeline and preview — minimal touch only**

These two surfaces stay hand-written CSS: the timeline is a frame ruler and the preview is a Remotion `<Player>`. Replace only plain `<button className="btn …">` with `Button variant="ghost" size="sm"` / `size="icon"`, and do not restructure their markup.

- [ ] **Step 5: Verify**

```bash
npm run typecheck
npm test
npm run build
```

Expected: all pass. In the browser: open the library, drag a component onto a track, open the render dialog and the help dialog, confirm the storage indicator shows the SQLite backend.

- [ ] **Step 6: Commit**

```bash
git add src/components/Library.tsx src/components/RenderDialog.tsx src/components/HelpModal.tsx src/components/StorageIndicator.tsx src/components/Timeline.tsx src/components/PreviewPanel.tsx
git commit -m "Bring the library, dialogs and storage badge onto shadcn components"
```

---

### Task 6: Vendor two more Remocn components

**Files:**
- Create: `src/motion-components/upstream/soft-blur-in.tsx`, `src/motion-components/upstream/typewriter.tsx`, `src/motion-components/soft-blur-in.tsx`, `src/motion-components/typewriter.tsx`, `src/motion-components/definitions/soft-blur-in.ts`, `src/motion-components/definitions/typewriter.ts`
- Modify: `src/motion-components/PROVENANCE.md`, `src/types.ts`, `src/registry/index.ts`

**Interfaces:**
- Consumes: `registerComponent`, `VideoComponentDefinition` from `src/registry/`.
- Produces: two new component ids — `remocnSoftBlurIn` and `remocnTypewriter` — registered in the library, inspector and composition.

- [ ] **Step 1: Fetch the upstream source**

```bash
node -e "fetch('https://remocn.dev/r/soft-blur-in.json').then(r=>r.json()).then(j=>require('fs').writeFileSync('.tmp/soft-blur-in.json',JSON.stringify(j,null,2)))"
node -e "fetch('https://remocn.dev/r/typewriter.json').then(r=>r.json()).then(j=>require('fs').writeFileSync('.tmp/typewriter.json',JSON.stringify(j,null,2)))"
```

Expected: two JSON files. Each has `files[0].content` (the upstream TSX) and `files[0].target`. If a registry item 404s, pick a replacement from the documented list — `https://remocn.dev/docs/typography` lists every component — and use that name for the rest of this task.

- [ ] **Step 2: Write the verbatim upstream copies**

Write each `files[0].content` unchanged into `src/motion-components/upstream/<name>.tsx`. These are the source of truth for the diff, exactly as `upstream/marker-highlight.tsx` is today.

- [ ] **Step 3: Write the adapted copies**

Copy each upstream file to `src/motion-components/<name>.tsx` and apply only the four modifications already documented for `marker-highlight`:

1. Drop the `"use client";` directive — this is a Vite/Remotion app.
2. The root element is content-sized and centred (`display: inline-flex`), never `position: absolute; inset: 0` with a hardcoded background — the Chart Studio compositor positions the component and the composition owns the background.
3. Font stack `Helvetica, Arial, sans-serif` instead of `var(--font-geist-sans), …`.
4. Text does not wrap (`white-space: nowrap`) so a long phrase stays on one line at the canvas edge.

Do **not** change the animation maths, the props interface or the markup. Do not add a `useCurrentFrame` alternative — the vendored source keeps its own frame access.

- [ ] **Step 4: Register the ids**

In `src/types.ts`, append to the `ElementType` union:

```ts
  | 'remocnSoftBlurIn'
  | 'remocnTypewriter'
```

- [ ] **Step 5: Write the definitions**

Create `src/motion-components/definitions/soft-blur-in.ts` and `.../typewriter.ts` following `src/motion-components/definition.ts` exactly: `type`, `label`, `icon`, `description`, `category: 'motion'`, `propsVersion: 1`, `defaultDuration`, `defaults`, `params` (including the shared `x`/`y` number params), `provenance` (registry URL, MIT licence, retrieval date `2026-10-26`, local modifications), and a `render` adapter that merges `defaults` with `props` and calls `createElement`. Each module ends with `registerComponent(definition)`.

- [ ] **Step 6: Import the definitions**

In `src/registry/index.ts`, add:

```ts
import '../motion-components/definitions/soft-blur-in';
import '../motion-components/definitions/typewriter';
```

- [ ] **Step 7: Record the provenance**

Add a section per component to `src/motion-components/PROVENANCE.md` with the same fields the `marker-highlight` section has: Component, Registry URL, Upstream repository, Upstream licence, Licence text, Retrieved (`2026-10-26`), Local file, Registry definition, Verbatim upstream copy, and the numbered list of local modifications.

- [ ] **Step 8: Test the new components**

Extend `src/motion-components/definition.test.ts` (or add `src/motion-components/definitions.test.ts`) with, for each new component: the registry resolves the id, the defaults match the definition, and the render adapter returns an element for the default props. Use the same style as the existing test file.

- [ ] **Step 9: Verify**

```bash
npm run typecheck
npm test
```

Expected: clean typecheck, the new tests pass, and the existing tests still pass.

- [ ] **Step 10: Commit**

```bash
git add src/motion-components src/types.ts src/registry/index.ts
git commit -m "Add two more Remotion motion components from the Remocn registry"
```

---

### Task 7: Record the dependency decision and refresh the documentation

**Files:**
- Create: `docs/decisions/ADR-005-SHADCN-AND-TAILWIND.md`
- Modify: `README.md`, `docs/BOOTSTRAP.md`, `docs/architecture/UPSTREAM_AUDIT.md`, `docs/roadmap/ROADMAP.md`, `docs/README.md`

**Interfaces:**
- Consumes: the installed versions and the measured bundle size from Task 8.
- Produces: the documentation the repository's own rules require for a new dependency.

- [ ] **Step 1: Write ADR-005**

`docs/decisions/ADR-005-SHADCN-AND-TAILWIND.md` must contain, per `AGENTS.md`'s dependency rule: the exact packages and versions (`tailwindcss@4.3.3`, `@tailwindcss/vite@4.3.3`, `shadcn` CLI `4.22.1`, the Radix primitives the CLI pulled in, `lucide-react`, `class-variance-authority`, `clsx`, `tailwind-merge`), their licences, browser/runtime support, tree-shaking and bundle consequences, security posture (no runtime network calls; the CLI runs at development time only; the copied source is ours to maintain), how it improves on the existing hand-written CSS, and the exit strategy (the primitives live in one folder, the tokens in one block; removing shadcn means deleting `src/components/ui/` and the token block — no other package depends on them). It must also record the deviation: the documented architecture named Next.js/Tailwind/shadcn, and this repository keeps the Vite SPA while adopting Tailwind and shadcn inside it (`docs/architecture/UPSTREAM_AUDIT.md` §4.1).

- [ ] **Step 2: Rewrite `README.md`**

The current README claims the repository is design-only, which has been false for months. The new README states what Chart Studio is today (the editor, the component registry, the candlestick chart, local storage, the Remocn motion components), how to install and run it, the verification commands, the project layout, and links to `docs/BOOTSTRAP.md` for the working details.

- [ ] **Step 3: Update `docs/BOOTSTRAP.md`**

Add `src/components/ui/` and `src/lib/utils.ts` to the "Where things live" tree, mention `components.json` and the Tailwind setup, and keep the commands table in sync with `package.json`.

- [ ] **Step 4: Add the R2 addendum to `docs/architecture/UPSTREAM_AUDIT.md`**

One short section: what R2 changed (Tailwind v4 + shadcn/ui in the editor chrome; Remocn now at three components), the reason preflight is not imported, and the "how this fork maps onto the documented Next.js/pnpm architecture" note that the audit lists as owed.

- [ ] **Step 5: Update the roadmap and the index**

In `docs/roadmap/ROADMAP.md`, mark the R0 item "Evaluate and pin 2–3 Remocn motion components" as done and name the three components. In `docs/README.md`, add ADR-005, the new spec and the new plan to the index.

- [ ] **Step 6: Commit**

```bash
git add README.md docs/
git commit -m "Document the shadcn adoption, the dependency decision and the Remocn set"
```

---

### Task 8: Verification sweep and evidence

**Files:**
- Modify: `docs/architecture/UPSTREAM_AUDIT.md` (bundle numbers only, if they differ from the recorded baseline)

**Interfaces:**
- Consumes: everything from Tasks 1–7.
- Produces: observed evidence that the slice works.

- [ ] **Step 1: Run the gates**

```bash
npm run typecheck
npm test
npm run build
```

Expected: typecheck clean, every test passing, build succeeds. Record the bundle size reported by the build and compare it with the 721 kB / 227 kB gzip baseline from `docs/superpowers/plans/2026-10-25-chart-studio-scaffold.md` §4.

- [ ] **Step 2: Extend the render check to the new components**

In `scripts/verify-r1.mjs`, add a clip for `remocnSoftBlurIn` and one for `remocnTypewriter` to the verification project, each on its own track with a non-overlapping frame range, then:

```bash
node scripts/verify-r1.mjs
```

Expected: stills in `out/verify/` and `out/chart-studio-r1.mp4` re-rendered, with the new titles visible in the frames that show them.

- [ ] **Step 3: Prove the video path is untouched by shadcn**

```bash
grep -rn "components/ui" src/remotion src/registry src/trading src/motion-components
```

Expected: no output.

- [ ] **Step 4: Browser pass**

```bash
npm run dev
```

Open the editor and confirm, with a screenshot saved to `out/verify/`:

- the top bar, library, inspector and dialogs render with shadcn styling;
- the timeline and the preview still look and behave as before (no layout shift from the Tailwind change);
- a component can be dragged from the library onto a track and plays in the preview;
- the storage indicator shows the SQLite backend.

- [ ] **Step 5: Commit any evidence-only change**

```bash
git add docs/architecture/UPSTREAM_AUDIT.md
git commit -m "Record the measured bundle size after the shadcn adoption"
```

Only commit if the measured numbers actually changed and the file was updated.

---

## Self-review

- **Spec coverage:** §3.1–3.2 (Tailwind + shadcn setup) → Task 1; §3.3 (tokens) → Task 1 Step 5; §3.5 (chrome conversion) → Tasks 3–5; §3.6 (no shadcn in the render path) → Task 8 Step 3; §3.7 (three Remocn components) → Task 6; §3.8 (dependency record) → Task 7; §4 file map → every task's file list; §5 control mapping → Task 4 Step 1; §6 error handling → Task 1 Steps 6–7 (manual fallback), Task 2 Step 3, Task 5 Step 2 (dialog titles); §7 verification → Task 8; §9 documentation → Task 7.
- **Placeholder scan:** no TBD/TODO; every command has an expected result; every code change shows its content.
- **Type consistency:** the component ids `remocnSoftBlurIn` and `remocnTypewriter` are used identically in `src/types.ts`, the definition modules, the registry import and the verification script.
