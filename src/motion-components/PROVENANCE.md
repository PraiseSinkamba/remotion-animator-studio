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
| Licence text | `src/motion-components/LICENSE.remocn` |
| Retrieved | 2026-10-25 |
| Local file | `src/motion-components/marker-highlight.tsx` |
| Registry definition | `src/motion-components/definition.ts` |
| Verbatim upstream copy | `src/motion-components/upstream/marker-highlight.tsx` (source of truth for the diff) |

### Local modifications

1. Dropped the Next.js `"use client"` directive — this is a Vite/Remotion app.
2. Root element is a content-sized, centred box (`display: inline-flex`). The upstream
   `position: absolute; inset: 0` stretch and the hardcoded `background: "white"` rectangle
   were removed: the Chart Studio compositor positions the component at `(x, y)` and the
   composition owns the background, so the component must not paint over the frame.
3. Font stack changed from `var(--font-geist-sans), -apple-system, BlinkMacSystemFont, sans-serif`
   to the editor stack `Helvetica, Arial, sans-serif` (see the `text` element defaults in
   `src/elements.ts`).

Unchanged: the animation maths (`spring`, `interpolate`, `interpolateColors`), the
`MarkerHighlightProps` interface and the marker markup. The component still reads the
frame through Remotion's `useCurrentFrame()`, which is clip-relative inside the per-clip
`<Sequence>`.
