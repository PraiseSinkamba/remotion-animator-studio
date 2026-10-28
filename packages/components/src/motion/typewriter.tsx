/**
 * Typewriter — vendored and adapted from Remocn.
 *
 * - Upstream source: https://remocn.dev/r/typewriter.json
 * - Upstream repository: https://github.com/Remocn/remocn
 * - Retrieved: 2026-10-26
 * - Licence: MIT — Copyright (c) 2026 Remocn (see ./LICENSE.remocn)
 *
 * Local modifications (see ./PROVENANCE.md):
 * - Dropped the Next.js `"use client"` directive (not a Next.js app).
 * - Root element is a content-sized, centred box (`display: inline-flex`): the
 *   `position: absolute; inset: 0` stretch and the hardcoded
 *   `background: "white"` rectangle were removed because the Chart Studio
 *   compositor positions the component at (x, y) and the composition owns the
 *   background.
 * - Font stack replaced `var(--font-geist-sans), ...` with the editor's own
 *   stack ("Helvetica, Arial, sans-serif").
 * - The text span does not wrap: the compositor places the component inside a
 *   shrink-to-fit box, so a long phrase would otherwise break at the canvas edge.
 * - The two upstream imports were repointed at the vendored local copies:
 *   `Caret` comes from "./caret" (vendored from
 *   https://remocn.dev/r/caret.json) and `useTypewriter` from "./remocn-ui"
 *   (vendored from the upstream lib/remocn-ui timeline module).
 *
 * The animation maths, the props interface and the markup are unchanged. The
 * component still reads the frame through Remotion's `useCurrentFrame()`.
 */

import { Caret } from "./caret";
import { useTypewriter } from "./remocn-ui";

export interface TypewriterProps {
  text: string;
  cursor?: boolean;
  charsPerSecond?: number;
  speed?: number;
  fontSize?: number;
  color?: string;
  cursorColor?: string;
  fontWeight?: number;
  className?: string;
}

export function Typewriter({
  text,
  cursor = true,
  charsPerSecond = 22,
  speed = 1,
  fontSize = 48,
  color = "#171717",
  cursorColor = "#171717",
  fontWeight = 600,
  className,
}: TypewriterProps) {
  const tw = useTypewriter(text, { cps: charsPerSecond, speed });

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
          letterSpacing: "-0.03em",
          fontFamily: "Helvetica, Arial, sans-serif",
          whiteSpace: "nowrap",
        }}
      >
        {tw.text}
        {cursor && (
          <Caret
            color={cursorColor}
            blink={!tw.typing}
            speed={speed}
            radius={0}
            style={{
              width: "0.08em",
              height: "1em",
              marginLeft: "0.04em",
              verticalAlign: "text-bottom",
            }}
          />
        )}
      </span>
    </div>
  );
}
