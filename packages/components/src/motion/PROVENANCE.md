# Provenance — vendored Remocn motion components

Third-party source adapted into Chart Studio is vendored, never fetched at runtime
(component contract §4.5). The upstream licence and revision stay next to the copy.

## marker-highlight

| Field | Value |
|---|---|
| Component | Marker Highlight (`remocnMarkerHighlight`) |
| Registry URL | https://remocn.dev/r/marker-highlight.json |
| Upstream repository | https://github.com/Remocn/remocn (`registry/remocn/marker-highlight/index.tsx`) |
| Upstream licence | MIT — Copyright (c) 2026 Remocn |
| Licence text | `packages/components/src/motion/LICENSE.remocn` |
| Retrieved | 2026-10-25 |
| Local file | `packages/components/src/motion/marker-highlight.tsx` |
| Registry definition | `packages/components/src/motion/definitions/marker-highlight.ts` |
| Verbatim upstream copy | `vendor/remocn/source/marker-highlight.tsx` (source of truth for the diff) |

### Local modifications

1. Dropped the Next.js `"use client"` directive — this is a Vite/Remotion app.
2. Root element is a content-sized, centred box (`display: inline-flex`). The upstream
   `position: absolute; inset: 0` stretch and the hardcoded `background: "white"` rectangle
   were removed: the Chart Studio compositor positions the component at `(x, y)` and the
   composition owns the background, so the component must not paint over the frame.
3. Font stack changed from `var(--font-geist-sans), -apple-system, BlinkMacSystemFont, sans-serif`
   to the editor stack `Helvetica, Arial, sans-serif` (see the `text` element defaults in
   `packages/components/src/base/definitions.ts`).
4. The title span does not wrap (`white-space: nowrap`). The compositor places the component
   at `(x, y)` inside a shrink-to-fit box, so a long phrase would otherwise break at the
   canvas edge instead of staying one line.

Unchanged: the animation maths (`spring`, `interpolate`, `interpolateColors`), the
`MarkerHighlightProps` interface and the marker markup. The component still reads the
frame through Remotion's `useCurrentFrame()`, which is clip-relative inside the per-clip
`<Sequence>`.

## soft-blur-in

| Field | Value |
|---|---|
| Component | Soft Blur In (`remocnSoftBlurIn`) |
| Registry URL | https://remocn.dev/r/soft-blur-in.json |
| Upstream repository | https://github.com/Remocn/remocn (`registry/remocn/soft-blur-in/index.tsx`) |
| Upstream licence | MIT — Copyright (c) 2026 Remocn |
| Licence text | `packages/components/src/motion/LICENSE.remocn` |
| Retrieved | 2026-10-26 |
| Local file | `packages/components/src/motion/soft-blur-in.tsx` |
| Registry definition | `packages/components/src/motion/definitions/soft-blur-in.ts` |
| Verbatim upstream copy | `vendor/remocn/source/soft-blur-in.tsx` (source of truth for the diff) |

### Local modifications

1. Dropped the Next.js `"use client"` directive — this is a Vite/Remotion app.
2. Root element is a content-sized, centred box (`display: inline-flex`). The upstream
   `position: absolute; inset: 0` stretch and the hardcoded `background: "transparent"`
   rectangle were removed: the Chart Studio compositor positions the component at `(x, y)`
   and the composition owns the background.
3. Font stack changed from `var(--font-geist-sans), -apple-system, BlinkMacSystemFont, sans-serif`
   to the editor stack `Helvetica, Arial, sans-serif`.
4. The text span does not wrap (`white-space: nowrap`). The compositor places the component
   at `(x, y)` inside a shrink-to-fit box, so a long phrase would otherwise break at the
   canvas edge instead of staying one line.

Unchanged: the animation maths (`Easing.bezier`, `interpolate`), the `SoftBlurInProps`
interface and the per-character markup. The component still reads the frame through
Remotion's `useCurrentFrame()`, which is clip-relative inside the per-clip `<Sequence>`.

## typewriter

| Field | Value |
|---|---|
| Component | Typewriter (`remocnTypewriter`) |
| Registry URL | https://remocn.dev/r/typewriter.json |
| Upstream repository | https://github.com/Remocn/remocn (`registry/remocn/typewriter/index.tsx`) |
| Upstream licence | MIT — Copyright (c) 2026 Remocn |
| Licence text | `packages/components/src/motion/LICENSE.remocn` |
| Retrieved | 2026-10-26 |
| Local file | `packages/components/src/motion/typewriter.tsx` |
| Registry definition | `packages/components/src/motion/definitions/typewriter.ts` |
| Verbatim upstream copy | `vendor/remocn/source/typewriter.tsx` (source of truth for the diff) |

The upstream component depends on two other Remocn registry items. Both are vendored as
source (never fetched at runtime) and only the files the typewriter actually needs were
taken:

| Vendored dependency | Registry URL | Upstream file | Verbatim upstream copy | Local file |
|---|---|---|---|---|
| Caret | https://remocn.dev/r/caret.json | `registry/remocn/caret/index.tsx` | `vendor/remocn/source/caret.tsx` | `packages/components/src/motion/caret.tsx` |
| Remocn UI (timeline hook) | https://remocn.dev/r/remocn-ui.json | `registry/remocn-ui/core/timeline.ts` | `vendor/remocn/source/remocn-ui-timeline.ts` | `packages/components/src/motion/remocn-ui.ts` |
| Remocn UI (types) | https://remocn.dev/r/remocn-ui.json | `registry/remocn-ui/core/types.ts` | `vendor/remocn/source/remocn-ui-types.ts` | `packages/components/src/motion/remocn-ui-types.ts` |

The `remocn-ui` registry item also ships `color.ts`, `motion.ts` and `theme.ts`. They were
not vendored: `color.ts` pulls in the `culori` package, and this app installs no new
dependencies. Only the timeline hook and the `Step` type the typewriter needs were taken.

### Local modifications

Applied to `packages/components/src/motion/typewriter.tsx`:

1. Dropped the Next.js `"use client"` directive — this is a Vite/Remotion app.
2. Root element is a content-sized, centred box (`display: inline-flex`). The upstream
   `position: absolute; inset: 0` stretch and the hardcoded `background: "white"` rectangle
   were removed: the Chart Studio compositor positions the component at `(x, y)` and the
   composition owns the background.
3. Font stack changed from `var(--font-geist-sans), -apple-system, BlinkMacSystemFont, sans-serif`
   to the editor stack `Helvetica, Arial, sans-serif`.
4. The text span does not wrap (`white-space: nowrap`, upstream `white-space: pre`). The
   compositor places the component at `(x, y)` inside a shrink-to-fit box, so a long phrase
   would otherwise break at the canvas edge instead of staying one line.
5. The two upstream imports were repointed at the vendored local copies: `Caret` now comes
   from `./caret` (upstream `@/components/remocn/caret`) and `useTypewriter` from
   `./remocn-ui` (upstream `@/lib/remocn-ui`).

Applied to the vendored dependencies:

6. `packages/components/src/motion/caret.tsx` — the Next.js `"use client"` directive only. The
   `CaretProps` interface, the blink maths and the markup are unchanged.
7. `packages/components/src/motion/remocn-ui.ts` — the `Step` type import changed from `"./types"` to
   `"./remocn-ui-types.js"`, because the vendored type file was renamed so the two vendored
   Remocn UI files are distinguishable at a glance. The timeline maths (`useTypewriter`,
   `revealCount`, `revealedText`, `useCurrentState`, `useStateTransition`) is unchanged.

Unchanged: the animation maths, the `TypewriterProps` interface and the typewriter markup.
The component still reads the frame through Remotion's `useCurrentFrame()`, which is
clip-relative inside the per-clip `<Sequence>`.

### Supporting files

`vendor/remocn/source/types.ts` re-exports the vendored `Step` type so the
verbatim upstream timeline file resolves its own `"./types"` import unchanged.

The verbatim upstream tree lives in `vendor/remocn/source/` and sits outside every package's
TypeScript configuration, so it is a record rather than code that compiles. The two upstream
module paths it imports — `@/components/remocn/caret` and `@/lib/remocn-ui` — are the upstream
project's own layout, not this repository's, and are not resolved here.

## 2026-11-02 editing capability repair

All three adapted components now accept an optional maxWidth prop. A positive width enables normal wrapping and overflow-wrap:anywhere on the title span; omitted/zero width preserves the original nowrap output. The registered east/west wrap handles pass this prop through their render adapters. Animation maths and verbatim vendor sources remain unchanged. Local props interfaces therefore include this additional optional field.
