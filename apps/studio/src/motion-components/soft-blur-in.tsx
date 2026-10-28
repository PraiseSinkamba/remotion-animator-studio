/**
 * Soft Blur In — vendored and adapted from Remocn.
 *
 * - Upstream source: https://remocn.dev/r/soft-blur-in.json
 * - Upstream repository: https://github.com/Remocn/remocn
 * - Retrieved: 2026-10-26
 * - Licence: MIT — Copyright (c) 2026 Remocn (see ./LICENSE.remocn)
 *
 * Local modifications (see ./PROVENANCE.md):
 * - Dropped the Next.js `"use client"` directive (not a Next.js app).
 * - Root element is a content-sized, centred box (`display: inline-flex`): the
 *   `position: absolute; inset: 0` stretch was removed because the Chart Studio
 *   compositor positions the component at (x, y) and the composition owns the
 *   background.
 * - Font stack replaced `var(--font-geist-sans), ...` with the editor's own
 *   stack ("Helvetica, Arial, sans-serif").
 * - The text span does not wrap: the compositor places the component inside a
 *   shrink-to-fit box, so a long phrase would otherwise break at the canvas edge.
 *
 * The animation maths (Easing.bezier / interpolate), the props interface and
 * the per-character markup are unchanged. The component still reads the frame
 * through Remotion's `useCurrentFrame()`.
 */

import { Easing, interpolate, useCurrentFrame } from "remotion";

export interface SoftBlurInProps {
  text: string;
  blur?: number;
  fontSize?: number;
  color?: string;
  fontWeight?: number;
  speed?: number;
  className?: string;
}

export function SoftBlurIn({
  text,
  blur = 12,
  fontSize = 72,
  color = "#171717",
  fontWeight = 600,
  speed = 1,
  className,
}: SoftBlurInProps) {
  const frame = useCurrentFrame() * speed;

  const chars = Array.from(text);
  const charDurationFrames = 27;
  const charTravelFrames = 9;
  const staggerFrames = 1;

  return (
    <div
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <span
        className={className}
        style={{
          fontSize,
          fontWeight,
          color,
          letterSpacing: "-0.05em",
          fontFamily: "Helvetica, Arial, sans-serif",
          whiteSpace: "nowrap",
        }}
      >
        {chars.map((char, i) => {
          const local = frame - i * staggerFrames;
          const easing = Easing.bezier(0.22, 1, 0.36, 1);
          const opacity = interpolate(local, [0, charDurationFrames], [0, 1], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing,
          });
          const y = interpolate(local, [0, charTravelFrames], [16, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
            easing,
          });
          const blurAmount = interpolate(
            local,
            [0, charDurationFrames],
            [blur, 0],
            { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing },
          );
          return (
            <span
              key={i}
              style={{
                display: "inline-block",
                whiteSpace: "pre",
                backfaceVisibility: "hidden",
                transformOrigin: "50% 55%",
                opacity,
                translate: `0 ${y}px`,
                filter: `blur(${blurAmount}px)`,
              }}
            >
              {char}
            </span>
          );
        })}
      </span>
    </div>
  );
}
