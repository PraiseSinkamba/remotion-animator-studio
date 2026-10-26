# ADR-005 — Tailwind CSS v4 and shadcn/ui as the editor control layer

**Status:** Accepted; implemented in `src/components/ui/` and `src/index.css`.  
**Date:** 2026-10-26  
**Depends on:** [ADR-002 — Dependency Adoption](ADR-002-DEPENDENCY-ADOPTION.md) (editor control
shortlist), [ADR-003 — Component System](ADR-003-COMPONENT-SYSTEM.md) (the editor/video boundary),
[ADR-004 — Storage Port](ADR-004-STORAGE-PORT.md) (the style of this record).  
**Described in:** [Bootstrap](../BOOTSTRAP.md), [Upstream Audit](../architecture/UPSTREAM_AUDIT.md)
(R2 addendum), [shadcn adoption design](../superpowers/specs/2026-10-26-chart-studio-shadcn-design.md).  
**Decision owners:** Product owner + implementation lead.

## Context

Chart Studio's editor chrome was hand-written: one global stylesheet, `src/index.css`, at 14.5 kB
of rules that named colours directly, styled native controls by hand, and reached for emoji as
icons. Every button, input, select, dialog and badge was a bespoke widget with its own focus
behaviour and its own keyboard handling.

Two problems came out of that. The chrome had **two control systems** — the hand-written rules
and the browser's native controls — with no shared notion of colour or focus, so a control
changed in one place and not the other. And the accessibility work that a real editor needs
(focus management in overlays, keyboard navigation, escape-to-close, focus trapping) was not
available at all.

[ADR-002](ADR-002-DEPENDENCY-ADOPTION.md) already shortlisted Tailwind CSS and shadcn/ui for
the editor controls, but no dependency record existed for them, and `AGENTS.md` requires one
before a dependency is adopted.

The decision is scoped to the **editor chrome only**. The video path — `src/remotion/`,
`src/registry/`, `src/trading/` and `src/motion-components/` — must not import anything from
`src/components/ui/`, because ADR-003 requires the editor and the exported video to stay
separate. The in-app preview renders the same composition as the export, and the export bundle
imports no CSS at all.

## Decision

1. **Tailwind CSS v4 is the styling layer, driven by the Vite plugin.** `tailwindcss` and
   `@tailwindcss/vite` are devDependencies. There is no `tailwind.config.js`: the configuration
   lives in CSS, in one place, in `src/index.css`.

2. **There is one global stylesheet.** `src/index.css` imports Tailwind's theme and utilities
   layers, declares the shadcn token block, and keeps the surviving hand-written rules. No
   second stylesheet, no CSS modules, no inline style objects.

3. **Tailwind's preflight is deliberately not imported.** Only `tailwindcss/theme.css` and
   `tailwindcss/utilities.css` are imported, each into an explicit layer. The reason is
   preview/export parity: the in-app preview renders inside the app document, while the export
   bundle imports no CSS at all. Importing preflight would change the preview and not the
   export, which would break the parity invariant that ADR-003 and `AGENTS.md` both depend on.
   The parts of preflight the editor actually needs are re-declared by hand in `@layer base`:
   the border reset, the inherited form-control font, and the button background reset (without
   it, shadcn's ghost buttons keep the browser's default white background on this palette).

4. **The hand-written stylesheet now lives in `@layer legacy`.** The layer order is
   `@layer theme, base, components, legacy, utilities;`. A converted control can therefore
   restyle a legacy rule with utility classes, while an element that keeps its own class names
   is unaffected. The rules the shadcn controls replaced were deleted rather than kept as
   dead CSS.

5. **shadcn/ui components are copied source in `src/components/ui/`.** They are vendored, not
   imported from a package: the source is in this repository and is maintained here.
   `components.json` records the project configuration for the CLI.

6. **The app is always dark.** `@custom-variant dark (&:is(.dark *));` makes the `dark:` variant
   follow the document class instead of the operating system preference, and `<html class="dark">`
   is set. Without it a light-preference machine would render the primitives' light theme.

7. **The path alias is `@/*` → `./src/*`, declared as `paths` without `baseUrl`.** `paths` alone
   resolves relative to `tsconfig.json`. With `baseUrl: "."` TypeScript resolved the bare import
   `remotion` to the repository's root-level `remotion/` directory — the Remotion entry point —
   instead of the `remotion` package, and every Remotion import failed to typecheck.

8. **The `cn()` helper is the project's own.** `src/lib/utils.ts` exports `cn()` built on
   `clsx` and `tailwind-merge`. The npm package `cn` was deliberately not adopted.

9. **Remocn grows to three components.** `marker-highlight`, `soft-blur-in` and `typewriter` are
   vendored with their upstream MIT licence, a provenance record, a registry definition, an
   `ElementType` id and tests.

## Consequences

**Good:** one control system instead of two; semantic tokens instead of ad-hoc colours; Radix
primitives that carry real focus management, keyboard navigation and overlay behaviour; real
icons instead of emoji; a stylesheet that shrinks as the chrome converts instead of growing.

**Costs:** +224.6 kB raw / +68.6 kB gzip of JavaScript and a 14.5 kB → 58.1 kB stylesheet; a
second styling vocabulary for maintainers to learn; copied source in the repository that has to
be maintained.

**Limits accepted for now:** the editor still mixes converted shadcn controls with a bespoke
timeline and preview panel, and the legacy layer still holds rules the conversion did not
reach. The app has one theme. Nothing in the video path uses Tailwind.

## Dependency record

Required by `AGENTS.md` for a new dependency.

| Package | Version | Where | Licence |
|---|---|---|---|
| `tailwindcss` | 4.3.3 | devDependency | MIT |
| `@tailwindcss/vite` | 4.3.3 | devDependency | MIT |
| `shadcn` CLI | 4.22.1 | development-time only, not a dependency | MIT |
| `radix-ui` (unified package) | 1.8.1 | dependency | MIT |
| `class-variance-authority` | 0.7.1 | dependency | MIT |
| `clsx` | 2.1.1 | dependency | MIT |
| `tailwind-merge` | 3.7.0 | dependency | MIT |
| `lucide-react` | 1.61.0 | dependency | ISC |
| `sonner` | 2.0.8 | dependency | MIT |
| `next-themes` | 0.4.6 | dependency | MIT |

The Radix packages behind the unified `radix-ui` package are MIT.

- **Exact package and version:** as in the table above. `tailwindcss` and `@tailwindcss/vite`
  are build-time only; the shadcn CLI is invoked with `npx shadcn@latest` and is not a
  dependency at all.
- **Licence:** as in the table. MIT for Tailwind, the CLI, the Radix primitives, `cva`, `clsx`,
  `tailwind-merge`, `sonner` and `next-themes`; ISC for `lucide-react`. The vendored Remocn
  source is MIT and its licence text is kept next to the copy in
  `src/motion-components/LICENSE.remocn`.
- **Runtime and browser support:** the editor shell targets the browsers the fork already
  supports — a Chromium-family browser for the preview. Tailwind v4 and the Radix primitives
  use no API outside that baseline: no experimental browser APIs, no `eval`, no server-only
  code. The primitives are React 18 compatible; all sixteen typecheck and build on React
  18.3.1.
- **Tree-shaking and bundle consequences:** measured on a production build (`npm run build`).
  Before this slice the JavaScript bundle was 721 kB / 227 kB gzip and the hand-written
  stylesheet was 14.5 kB. After it, JavaScript is **945.56 kB / 295.63 kB gzip** and CSS is
  **58.12 kB / 10.54 kB gzip** — **+224.6 kB raw / +68.6 kB gzip** of JavaScript, and a
  14.5 kB → 58.1 kB stylesheet. The JavaScript went into the Radix primitives actually
  imported (select, scroll-area, slider, switch, dialog, dropdown-menu, tooltip, tabs) plus
  their `@floating-ui` positioning internals, `tailwind-merge` (one ~40 kB minified module) and
  the 42 `lucide-react` icon modules the chrome imports. The unused primitives (`sonner`,
  `next-themes`) and `culori` are tree-shaken out of the bundle entirely (0 modules). The
  stylesheet grew because Tailwind emits the utilities the shadcn components use, on top of
  the legacy rules that survived.
- **Security posture:** the shadcn CLI runs at development time only; it makes no network call
  at runtime, and the application makes none either. The copied component source is ours to
  maintain — it lives in `src/components/ui/` and is reviewed like any other repository code.
  The vendored Remocn source is MIT and its licence stays next to the copy. Nothing in this
  slice adds a runtime dependency on a registry, a CDN or a remote stylesheet.
- **How it improves on the existing approach:** the hand-written stylesheet had two control
  systems (bespoke rules plus native browser controls) with no shared tokens. The editor now
  has one: semantic tokens (`bg-background`, `text-muted-foreground`, `border-border`) instead
  of ad-hoc colours, accessible Radix primitives with focus management and keyboard support
  instead of hand-rolled behaviour, and real icons from `lucide-react` instead of emoji. The
  primitives are copied source, so the project keeps the source and can adjust any component
  rather than waiting for an upstream release.
- **Exit strategy:** the primitives live in one folder (`src/components/ui/`), the tokens in one
  block in `src/index.css`, and the class-name helper in `src/lib/utils.ts`. Removing shadcn
  means deleting that folder, that token block and the `cn()` helper — no other package depends
  on them. Tailwind itself exits just as cheaply: delete the two `@import` lines, the
  `@theme inline` block and the `@custom-variant`, and the legacy stylesheet is still intact
  inside `@layer legacy`, ready to be unwrapped back to the top level. The exit cost of both
  is a deletion, not a rewrite.

## Deviations from the plan

The implementation plan (`docs/superpowers/plans/2026-10-26-chart-studio-shadcn.md`) and the
design spec were written before the work ran. Eight things differed, and the differences are
recorded here rather than left in the code.

1. **Style `nova` does not exist in the registry.** The registry's style enum is `default`,
   `new-york`, `radix-vega`, `radix-nova`, `radix-maia`, … — `nova` on its own 404s
   (`https://ui.shadcn.com/r/styles/nova/button.json`). The plan's intent (base `radix`, style
   `nova`) is `radix-nova`, and that is what `components.json` now declares. The design's §3.3
   token values are unchanged.

2. **The `cn` package was dropped.** The registry item declares a dependency named `cn`; the
   CLI resolved it to the npm package `cn@0.5.0`. The plan already asks for the project's own
   `cn()` in `src/lib/utils.ts` (clsx + tailwind-merge), so the generated files were pointed
   at `@/lib/utils` and `cn` was uninstalled.

3. **The registry metadata omits three dependencies.** The generated components import
   `class-variance-authority`, `radix-ui` and `lucide-react`, but the registry items only
   declare `cn`; those three were installed explicitly.

4. **No component was dropped for React 18.** All sixteen primitives typecheck and build on
   React 18.3.1. The risk the design listed (a component requiring React 19) did not
   materialise.

5. **Tailwind's preflight is deliberately not imported.** The in-app Remotion preview renders
   inside the app document while the export bundle imports no CSS at all, so importing
   preflight would change the preview and not the export and break the preview/export parity
   invariant. The parts of preflight the editor needs are re-declared in `@layer base` in
   `src/index.css`: the border reset, the inherited form-control font, and the button background
   reset (without it, shadcn's ghost buttons keep the browser's default white background).

6. **The hand-written stylesheet now lives in `@layer legacy`.** It is declared after `base` and
   before `utilities` in `@layer theme, base, components, legacy, utilities;`, so a converted
   control can restyle a legacy rule with utility classes while elements that keep their own
   class names are unaffected. The dead rules (`.btn-primary`, `.btn-play`, `.btn-danger`,
   `.storage-chip*`, `.modal*`, `.progress-*`, `.project-name`, `.preset-item`, `.help-cols`)
   were deleted; `.btn` and `.btn-small` stay because the candlestick chart's custom inspector
   panel still uses them.

7. **`@custom-variant dark (&:is(.dark *));` and `<html class="dark">`.** Tailwind v4's `dark:`
   variant otherwise follows the operating system preference; the app is always dark, so the
   variant follows the document class.

8. **The path alias is `paths` without `baseUrl`.** The repository has a root-level `remotion/`
   directory (the Remotion entry point); with `baseUrl: "."` TypeScript resolved the bare import
   `remotion` to that folder instead of the `remotion` package and every Remotion import failed
   to typecheck. `paths` alone resolves relative to `tsconfig.json`.

## Remocn component set

Three components are now vendored: `marker-highlight` (`remocnMarkerHighlight`),
`soft-blur-in` (`remocnSoftBlurIn`) and `typewriter` (`remocnTypewriter`). The typewriter
additionally vendors its two upstream dependencies — the Remocn caret component and the
`useTypewriter` hook from `remocn-ui` — because the registry item imports them; `culori` was
deliberately not vendored. Every component has a verbatim upstream copy next to the adapted
copy, a licence, a provenance record in `src/motion-components/PROVENANCE.md`, a registry
definition, an `ElementType` id and tests.

## Commits in this slice

- `9724d2b` Add Tailwind CSS v4 and the shadcn/ui foundation to the editor shell
- `96b9491` Add two more Remotion motion components from the Remocn registry
- `f05a598` Add the shadcn/ui component set the editor controls need
- `54a026d` Give the editor top bar shadcn controls and real icons
- `b1ed127` Replace the inspector's hand-rolled inputs with shadcn controls
- `8435c9e` Bring the library, dialogs and storage badge onto shadcn components
- `0a11fe4` Drop the editor stylesheet rules the shadcn controls replaced
- `cde7122` Give icon buttons a transparent background so the ghost variant stops showing the
  browser default

## Alternatives considered

| Approach | Advantage | Problem | Decision |
|---|---|---|---|
| Keep the hand-written stylesheet and hand-roll the missing behaviours | No new dependency, no bundle growth | Two control systems, no semantic tokens, no focus management or keyboard support in overlays, emoji icons | Reject |
| Adopt a component library as a runtime package (MUI, Chakra) | Complete, versioned, no copied source | A second design language to fight the existing palette, a much larger bundle, and the components cannot be adjusted to the editor | Reject |
| Adopt Tailwind without shadcn | Utility classes only, no vendored component source | Every control still hand-written; the accessibility work still not done | Reject |
| Adopt shadcn without Tailwind | Not possible — shadcn's components are Tailwind classes | — | Reject |
| **Tailwind v4 + shadcn/ui source, editor chrome only, preflight not imported** | One control system, semantic tokens, accessible primitives, copied source we own, parity preserved | +68.6 kB gzip of JavaScript, copied source to maintain | **Select** |
