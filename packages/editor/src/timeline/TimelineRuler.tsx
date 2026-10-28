import React from 'react';
import { framesToLabel, RULER_HEIGHT } from './shared';

export const TimelineRuler: React.FC<{
  marks: number[];
  fps: number;
  ppf: number;
  currentFrame: number;
  onSeek: (frame: number) => void;
}> = ({ marks, fps, ppf, currentFrame, onSeek }) => {
  const ref = React.useRef<HTMLDivElement>(null);

  const frameFromEvent = (e: React.PointerEvent) => {
    const el = ref.current;
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    return Math.round((e.clientX - rect.left) / ppf);
  };

  return (
    <div
      ref={ref}
      className="relative w-full cursor-ew-resize border-b border-border bg-card"
      style={{ height: RULER_HEIGHT }}
      onPointerDown={(e) => {
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        onSeek(frameFromEvent(e));
      }}
      onPointerMove={(e) => {
        if (e.buttons === 1) onSeek(frameFromEvent(e));
      }}
    >
      {marks.map((f) => (
        <div
          key={f}
          className="pointer-events-none absolute bottom-0 top-0 border-l border-border pl-1 font-mono text-[9px] leading-none text-muted-foreground"
          style={{ left: f * ppf }}
        >
          <span className="absolute bottom-1 left-1 whitespace-nowrap">{framesToLabel(f, fps)}</span>
        </div>
      ))}
      {/* playhead marker, drawn inside the ruler so it stays visible above the sticky ruler */}
      <div
        className="pointer-events-none absolute bottom-0 top-0 z-[1] w-px bg-primary"
        style={{ left: currentFrame * ppf }}
      >
        <div className="absolute -left-[4px] top-0 h-0 w-0 border-x-[4px] border-t-[6px] border-x-transparent border-t-primary" />
      </div>
    </div>
  );
};
