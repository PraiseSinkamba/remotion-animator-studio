import { Player } from '@remotion/player';
import { Pause, Play, SkipBack, SkipForward, Volume2, VolumeX } from 'lucide-react';
import React, { useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { playerRef, seekTo, togglePlay } from '../playerRef';
import { MainComposition } from '../remotion/MainComposition';
import { findClip, useStore } from '../store';
import { SelectionOverlay } from './selection-overlay';

/** Seconds label for the transport readout, e.g. "1.5s". */
const secondsLabel = (frames: number, fps: number) => {
  const s = frames / fps;
  return s % 1 === 0 ? `${s}s` : `${s.toFixed(1)}s`;
};

export const PreviewPanel: React.FC = () => {
  const project = useStore((s) => s.project);
  const muted = useStore((s) => s.muted);
  const playing = useStore((s) => s.playing);
  const currentFrame = useStore((s) => s.currentFrame);
  const selectedClipId = useStore((s) => s.selectedClipIds[0] ?? null);
  const setCurrentFrame = useStore((s) => s.setCurrentFrame);
  const setPlaying = useStore((s) => s.setPlaying);
  const setMuted = useStore((s) => s.setMuted);
  const commit = useStore((s) => s.commit);
  const updateClipProps = useStore((s) => s.updateClipProps);

  const drawingPath = useStore((s) => s.drawingPath);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{
    startX: number;
    startY: number;
    /** original positions of every selected clip that has x/y — groups move together */
    origins: Array<{ clipId: string; x: number; y: number }>;
  } | null>(null);

  /**
   * The Player letterboxes the composition inside the stage, so map screen
   * coordinates through the fitted-canvas rect, not the stage rect.
   */
  const canvasMetrics = (rect: DOMRect) => {
    const scale = Math.min(rect.width / project.width, rect.height / project.height);
    return {
      scale,
      offsetX: (rect.width - project.width * scale) / 2,
      offsetY: (rect.height - project.height * scale) / 2,
    };
  };

  // Keep the store's frame/playing state in sync with the Player
  useEffect(() => {
    const p = playerRef.current;
    if (!p) return;
    const onFrame = (e: { detail: { frame: number } }) => setCurrentFrame(e.detail.frame);
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    p.addEventListener('frameupdate', onFrame);
    p.addEventListener('play', onPlay);
    p.addEventListener('pause', onPause);
    return () => {
      p.removeEventListener('frameupdate', onFrame);
      p.removeEventListener('play', onPlay);
      p.removeEventListener('pause', onPause);
    };
  }, [setCurrentFrame, setPlaying]);

  // Drag the selected element(s) around the canvas — grouped/multi-selected clips move together
  const onPointerDown = (e: React.PointerEvent) => {
    const s = useStore.getState();
    if (s.drawingPath) return; // clicks belong to the path tool
    const origins = s.selectedClipIds
      .map((id) => findClip(s.project, id))
      .filter((c): c is NonNullable<typeof c> => !!c && typeof c.props.x === 'number')
      .map((c) => ({ clipId: c.id, x: c.props.x as number, y: c.props.y as number }));
    if (origins.length === 0) return;
    commit();
    drag.current = { startX: e.clientX, startY: e.clientY, origins };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current || !wrapperRef.current) return;
    const rect = wrapperRef.current.getBoundingClientRect();
    const { scale } = canvasMetrics(rect);
    const dx = (e.clientX - drag.current.startX) / scale;
    const dy = (e.clientY - drag.current.startY) / scale;
    for (const o of drag.current.origins) {
      updateClipProps(o.clipId, { x: Math.round(o.x + dx), y: Math.round(o.y + dy) });
    }
  };
  const onPointerUp = () => {
    drag.current = null;
  };

  const selected = findClip(project, selectedClipId);
  const canDrag = selected && typeof selected.props.x === 'number';

  const onToggleMute = () => {
    const next = !muted;
    setMuted(next);
    if (next) playerRef.current?.mute();
    else playerRef.current?.unmute();
  };

  /** Step one frame back/forward, clamped to the composition. */
  const stepFrame = (delta: number) => {
    const frame = playerRef.current?.getCurrentFrame() ?? currentFrame;
    seekTo(Math.max(0, Math.min(project.durationInFrames - 1, frame + delta)));
  };

  return (
    <div className="preview-panel">
      <div
        className="preview-stage relative"
        ref={wrapperRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        style={{ cursor: canDrag ? 'move' : 'default', aspectRatio: `${project.width} / ${project.height}` }}
      >
        <Player
          ref={playerRef}
          component={MainComposition}
          inputProps={{ project }}
          durationInFrames={Math.max(1, project.durationInFrames)}
          fps={project.fps}
          compositionWidth={project.width}
          compositionHeight={project.height}
          style={{ width: '100%', height: '100%', pointerEvents: 'none' }}
          loop
          initiallyMuted={muted}
          acknowledgeRemotionLicense
        />
        <SelectionOverlay />
        {drawingPath ? (
          <div
            className="draw-overlay"
            onPointerDown={(e) => {
              e.stopPropagation();
              const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
              const { scale, offsetX, offsetY } = canvasMetrics(rect);
              useStore.getState().addDrawingPoint({
                x: (e.clientX - rect.left - offsetX) / scale,
                y: (e.clientY - rect.top - offsetY) / scale,
              });
            }}
            onDoubleClick={(e) => {
              e.stopPropagation();
              useStore.getState().finishDrawingPath();
            }}
          >
            {/* "meet" centers exactly like the Player's letterbox, keeping the overlay aligned */}
            <svg viewBox={`0 0 ${project.width} ${project.height}`} preserveAspectRatio="xMidYMid meet">
              <polyline
                points={drawingPath.points.map((p) => `${p.x},${p.y}`).join(' ')}
                fill="none"
                stroke="#7c5cff"
                strokeWidth={4}
                strokeDasharray="10 8"
              />
              {drawingPath.points.map((p, i) => (
                <circle key={i} cx={p.x} cy={p.y} r={i === 0 ? 12 : 8} fill={i === 0 ? '#6ee7a8' : '#7c5cff'} />
              ))}
            </svg>
            <div className="draw-toolbar">
              <span>
                Click to add points ({drawingPath.points.length}) — the element starts at the green dot
              </span>
              <Button size="sm" onClick={() => useStore.getState().finishDrawingPath()}>
                ✓ Done (Enter)
              </Button>
              <Button variant="ghost" size="sm" onClick={() => useStore.getState().cancelDrawingPath()}>
                ✕ Cancel (Esc)
              </Button>
            </div>
          </div>
        ) : null}

        {/* Canvas info: size on the left, the selected layer on the right. */}
        <div className="pointer-events-none absolute bottom-2 left-3 z-20 font-mono text-[10px] text-muted-foreground">
          {project.width}×{project.height} • {project.fps} fps
        </div>
        {selected ? (
          <div className="pointer-events-none absolute bottom-2 right-3 z-20 rounded border border-border bg-card/90 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
            {selected.name}
          </div>
        ) : null}

        {/* Floating transport, centred over the bottom edge of the canvas. */}
        {drawingPath ? null : (
          <div
            className="absolute bottom-3 left-1/2 z-20 flex -translate-x-1/2 items-center gap-1 rounded-full border border-border bg-card/90 px-3 py-1.5 shadow-lg backdrop-blur-md"
            onPointerDown={(e) => e.stopPropagation()}
          >
            <Button
              variant="ghost"
              size="icon-sm"
              className="size-6 text-muted-foreground hover:text-foreground"
              onClick={() => stepFrame(-1)}
              title="Previous frame"
              aria-label="Previous frame"
            >
              <SkipBack data-icon="inline-start" />
            </Button>
            <Button
              variant="default"
              size="icon-sm"
              className="rounded-full bg-foreground text-background shadow hover:opacity-90"
              onClick={togglePlay}
              title={playing ? 'Pause' : 'Play'}
              aria-label={playing ? 'Pause' : 'Play'}
            >
              {playing ? (
                <Pause data-icon="inline-start" className="fill-current" />
              ) : (
                <Play data-icon="inline-start" className="fill-current" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              className="size-6 text-muted-foreground hover:text-foreground"
              onClick={() => stepFrame(1)}
              title="Next frame"
              aria-label="Next frame"
            >
              <SkipForward data-icon="inline-start" />
            </Button>
            <div className="mx-1 h-3.5 w-px bg-border" />
            <Button
              variant="ghost"
              size="icon-sm"
              className="size-6 text-muted-foreground hover:text-foreground"
              onClick={onToggleMute}
              title={muted ? 'Unmute' : 'Mute'}
              aria-label={muted ? 'Unmute' : 'Mute'}
            >
              {muted ? <VolumeX data-icon="inline-start" /> : <Volume2 data-icon="inline-start" />}
            </Button>
            <span className="ml-1 font-mono text-[11px] tabular-nums text-muted-foreground">
              {secondsLabel(currentFrame, project.fps)} / {secondsLabel(project.durationInFrames, project.fps)}
            </span>
            <span className="font-mono text-[11px] tabular-nums text-muted-foreground/70">f{currentFrame}</span>
          </div>
        )}
      </div>
      {canDrag && !drawingPath ? (
        <div className="preview-hint">Drag anywhere on the canvas to move “{selected!.name}”</div>
      ) : null}
    </div>
  );
};
