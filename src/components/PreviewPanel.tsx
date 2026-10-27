import { Player } from '@remotion/player';
import { Pause, Play, SkipBack, SkipForward, Volume2, VolumeX } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { playerRef, seekTo, togglePlay } from '../playerRef';
import { MainComposition } from '../remotion/MainComposition';
import { findClip, useStore } from '../store';
import type { ElementType, Project } from '../types';
import { clipGeometry, hitTest, pickableClips, projectClips } from './canvas-hit-test';
import type { PickableClip } from './canvas-hit-test';
import { SelectionOverlay } from './selection-overlay';
import { ELEMENT_MIME, PRESET_MIME } from './library/mime';

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
    /** original positions of every clip that moves with the grabbed one */
    origins: Array<{ clipId: string; x: number; y: number }>;
    /** has the pointer actually moved? (a press that never moves is a click) */
    moved: boolean;
    /** the clip that was grabbed */
    grabId: string;
    /** a click without movement narrows the selection to the grabbed clip */
    collapse: boolean;
  } | null>(null);
  /** A library card hovers the canvas — show the drop affordance. */
  const [dropActive, setDropActive] = useState(false);

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

  /**
   * Convert a client point into project coordinates through the fitted canvas.
   */
  const projectPoint = (clientX: number, clientY: number) => {
    const rect = wrapperRef.current?.getBoundingClientRect();
    if (!rect) return null;
    const { scale, offsetX, offsetY } = canvasMetrics(rect);
    return { x: (clientX - rect.left - offsetX) / scale, y: (clientY - rect.top - offsetY) / scale };
  };

  /**
   * The pick list of the current project, cached until the project changes.
   * It is built on demand so a drag does not rebuild it on every frame.
   */
  const picksCache = useRef<{ project: Project; picks: PickableClip[] } | null>(null);
  const picks = () => {
    const current = useStore.getState().project;
    const cached = picksCache.current;
    if (cached && cached.project === current) return cached.picks;
    const list = pickableClips(current);
    picksCache.current = { project: current, picks: list };
    return list;
  };

  /**
   * The topmost element under the pointer, or null for the background.
   */
  const pickAt = (clientX: number, clientY: number) => {
    const point = projectPoint(clientX, clientY);
    if (!point) return null;
    return hitTest(picks(), point.x, point.y);
  };

  /**
   * Press an element on the canvas: it becomes the selection and the drag
   * handle. Pressing the background clears the selection and starts no drag,
   * so the canvas can never drag an element it was not pointed at.
   */
  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return;
    const s = useStore.getState();
    if (s.drawingPath) return; // clicks belong to the path tool
    const hit = pickAt(e.clientX, e.clientY);
    if (!hit) {
      s.selectClip(null); // the background never drags
      return;
    }
    const additive = e.metaKey || e.ctrlKey || e.shiftKey;
    const alreadySelected = s.selectedClipIds.includes(hit.id);
    if (additive) s.selectClip(hit.id, true);
    // A plain press on an unselected clip replaces the selection; a plain press
    // on an already selected clip keeps the multi-selection, so a group can be
    // grabbed by any of its members.
    else if (!alreadySelected) s.selectClip(hit.id);
    const next = useStore.getState();
    // The grabbed clip always moves; the rest of the selection moves with it.
    const moving = new Set([...next.selectedClipIds, hit.id]);
    const origins: Array<{ clipId: string; x: number; y: number }> = [];
    for (const c of projectClips(next.project)) {
      if (!moving.has(c.id)) continue;
      const geometry = clipGeometry(c);
      if (geometry) origins.push({ clipId: c.id, x: geometry.anchor.x, y: geometry.anchor.y });
    }
    if (!origins.some((o) => o.clipId === hit.id)) return;
    drag.current = {
      startX: e.clientX,
      startY: e.clientY,
      origins,
      moved: false,
      grabId: hit.id,
      // A press that never moves is a click: it narrows the selection to the
      // clip that was pressed.
      collapse: !additive && next.selectedClipIds.length > 1,
    };
    if (wrapperRef.current) wrapperRef.current.style.cursor = 'grabbing';
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current) {
      // Hover feedback: only an element under the pointer can be picked up.
      if (wrapperRef.current) {
        wrapperRef.current.style.cursor = pickAt(e.clientX, e.clientY) ? 'grab' : 'default';
      }
      return;
    }
    if (!wrapperRef.current) return;
    const rect = wrapperRef.current.getBoundingClientRect();
    const { scale } = canvasMetrics(rect);
    const dx = (e.clientX - drag.current.startX) / scale;
    const dy = (e.clientY - drag.current.startY) / scale;
    if (!drag.current.moved) {
      if (dx === 0 && dy === 0) return;
      drag.current.moved = true;
      commit(); // one undo entry per drag, taken before the first move
    }
    for (const o of drag.current.origins) {
      updateClipProps(o.clipId, { x: Math.round(o.x + dx), y: Math.round(o.y + dy) });
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const current = drag.current;
    drag.current = null;
    if (current && !current.moved && current.collapse) {
      useStore.getState().selectClip(current.grabId); // a click narrows the selection
    }
    // The pointer may still be over an element: show the grab cursor again.
    if (wrapperRef.current) {
      wrapperRef.current.style.cursor = pickAt(e.clientX, e.clientY) ? 'grab' : 'default';
    }
  };

  /** A library card is over the canvas — it can be dropped. */
  const isLibraryDrag = (e: React.DragEvent) =>
    e.dataTransfer.types.includes(ELEMENT_MIME) || e.dataTransfer.types.includes(PRESET_MIME);

  const onDragEnter = (e: React.DragEvent) => {
    if (isLibraryDrag(e)) setDropActive(true);
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault(); // the canvas accepts the drop
    e.dataTransfer.dropEffect = 'copy';
    if (isLibraryDrag(e)) setDropActive(true);
  };

  const onDragLeave = (e: React.DragEvent) => {
    // Moving onto a child of the stage fires a leave too — only a real exit
    // (pointer outside the stage) hides the affordance.
    const next = e.relatedTarget as Node | null;
    if (next && e.currentTarget.contains(next)) return;
    setDropActive(false);
  };

  /** Drop a library element or preset onto the canvas at the pointer. */
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDropActive(false);
    const element = e.dataTransfer.getData(ELEMENT_MIME);
    const preset = e.dataTransfer.getData(PRESET_MIME);
    if (!element && !preset) return;
    const point = projectPoint(e.clientX, e.clientY);
    if (!point) return;
    const s = useStore.getState();
    const before = new Set(projectClips(s.project).map((c) => c.id));
    if (element) {
      const track = s.project.tracks[0];
      if (!track) return;
      s.addClip(element as ElementType, track.id, s.currentFrame);
      const created = projectClips(useStore.getState().project).find((c) => !before.has(c.id));
      // The anchor is the drop point, so the element lands under the pointer.
      if (created && typeof created.props.x === 'number') {
        useStore.getState().updateClipProps(created.id, {
          x: Math.round(point.x),
          y: Math.round(point.y),
        });
      }
      return;
    }
    s.addPreset(preset, s.currentFrame);
    // Shift the whole preset so its centre lands on the pointer.
    const dx = point.x - s.project.width / 2;
    const dy = point.y - s.project.height / 2;
    const after = useStore.getState();
    for (const clip of projectClips(after.project)) {
      if (before.has(clip.id)) continue;
      if (typeof clip.props.x !== 'number' || typeof clip.props.y !== 'number') continue;
      after.updateClipProps(clip.id, {
        x: Math.round(clip.props.x + dx),
        y: Math.round(clip.props.y + dy),
      });
    }
  };

  const selected = findClip(project, selectedClipId);

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
        onPointerLeave={() => {
          if (wrapperRef.current && !drag.current) wrapperRef.current.style.cursor = 'default';
        }}
        onDragEnter={onDragEnter}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        style={{ aspectRatio: `${project.width} / ${project.height}` }}
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
        {dropActive ? (
          <>
            {/* The stage lights up while a library card hovers over it. */}
            <div className="pointer-events-none absolute inset-0 z-30 rounded-[10px] border-2 border-dashed border-primary" />
            <div className="pointer-events-none absolute left-1/2 top-3 z-30 -translate-x-1/2 rounded border border-border bg-card/90 px-2 py-0.5 font-mono text-[10px] text-muted-foreground">
              Drop to add
            </div>
          </>
        ) : null}
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
      {!drawingPath ? (
        <div className="preview-hint">
          {selected
            ? `Press an element on the canvas to select it — drag “${selected.name}” to move it`
            : 'Press an element on the canvas to select it'}
        </div>
      ) : null}
    </div>
  );
};
