/**
 * Marker Highlight — vendored and adapted from Remocn.
 *
 * - Upstream source: https://remocn.dev/r/marker-highlight.json
 * - Upstream repository: https://github.com/Remocn/remocn
 * - Upstream file: registry/remocn/marker-highlight/index.tsx
 * - Retrieved: 2026-10-25
 * - Licence: MIT — Copyright (c) 2026 Remocn (see ./LICENSE.remocn)
 *
 * Local modifications (see ./PROVENANCE.md):
 * - Dropped the Next.js `"use client"` directive (not a Next.js app).
 * - Root element is a content-sized, centred box: the `position: absolute;
 *   inset: 0` stretch and the hardcoded `background: "white"` rectangle were
 *   removed because the Chart Studio compositor positions the component at
 *   (x, y) and the composition owns the background.
 * - Font stack replaced `var(--font-geist-sans), ...` with the editor's own
 *   stack ("Helvetica, Arial, sans-serif").
 * - The title span does not wrap: the compositor places the component inside a
 *   shrink-to-fit box, so a long phrase would otherwise break at the canvas edge.
 * - The animation maths (spring / interpolate / interpolateColors), the props
 *   interface and the marker markup are unchanged.
 */

import {
  interpolate,
  interpolateColors,
  spring,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';

export interface MarkerHighlightProps {
  before?: string;
  highlight: string;
  after?: string;
  markerColor?: string;
  baseColor?: string;
  highlightedTextColor?: string;
  fontSize?: number;
  fontWeight?: number;
  speed?: number;
  className?: string;
}

export function MarkerHighlight({
  before = '',
  highlight,
  after = '',
  markerColor = '#facc15',
  baseColor = '#171717',
  highlightedTextColor = '#171717',
  fontSize = 72,
  fontWeight = 600,
  speed = 1,
  className,
}: MarkerHighlightProps) {
  const frame = useCurrentFrame() * speed;
  const { fps } = useVideoConfig();

  const markerScale = spring({
    frame: frame - 15,
    fps,
    config: { damping: 14 },
  });

  const textColor = interpolateColors(
    interpolate(markerScale, [0.5, 0.8], [0, 1], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    }),
    [0, 1],
    [baseColor, highlightedTextColor],
  );

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <span
        className={className}
        style={{
          fontSize,
          fontWeight,
          color: baseColor,
          letterSpacing: '-0.03em',
          fontFamily: 'Helvetica, Arial, sans-serif',
          // The compositor places this component at (x, y) inside a shrink-to-fit
          // box, so a long title would otherwise wrap at the canvas edge.
          whiteSpace: 'nowrap',
        }}
      >
        {before}
        <span style={{ position: 'relative', display: 'inline-block' }}>
          <span
            aria-hidden
            style={{
              position: 'absolute',
              inset: '0 -0.1em',
              background: markerColor,
              transformOrigin: 'left center',
              scale: `${markerScale} 1`,
              zIndex: 0,
            }}
          />
          <span style={{ position: 'relative', zIndex: 1, color: textColor }}>
            {highlight}
          </span>
        </span>
        {after}
      </span>
    </div>
  );
}
