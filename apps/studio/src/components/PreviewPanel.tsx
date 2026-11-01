import { Player } from '@remotion/player';
import { ChevronsLeft, Pause, Play, SkipBack, SkipForward, Volume2, VolumeX } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import {
  DRAWING_TOOLS,
  drawingDraftFromClicks,
  isDrawingKind,
  playerRef,
  seekTo,
  togglePlay,
} from '@chart-studio/editor';
import { MainComposition } from '@chart-studio/video';
import { findClip, useStore } from '@chart-studio/editor';
import {
  chartAnchorToPoint,
  chartPointToAnchor,
  chartPriceRange,
  getComponent,
  type CandlestickChartProps,
  type ChartEvaluation,
} from '@chart-studio/components';
import { strokeToAnchorPoints } from '@chart-studio/core';
import type {
  Clip,
  DrawingKind,
  ElementType,
  Project,
  TransportAction,
} from '@chart-studio/core';
import { clipGeometry, hitTest, pickableClips, projectClips } from './canvas-hit-test';
import type { PickableClip } from './canvas-hit-test';
import { SelectionOverlay } from './selection-overlay';
import { Button, ELEMENT_MIME, PRESET_MIME } from '@chart-studio/ui';

/**
 * The bar a clip's first pane is showing at a frame.
 *
 * The shell asks the component's own evaluation, so it needs no knowledge of
 * what the component is.
 */
const activePaneBarId = (
  clip: Clip,
  sceneFrame: number,
  project: Project,
): string | undefined => {
  const definition = getComponent(clip.element);
  const evaluated = definition?.evaluate?.({
    clip,
    props: clip.props,
    sceneFrame,
    project,
  }) as { panes?: Array<{ bars?: Array<{ bar?: { id: string } }> }> } | undefined;
  const bars = evaluated?.panes?.[0]?.bars ?? [];
  return bars[bars.length - 1]?.bar?.id;
};

/** How close the pointer must be to an anchor to pick it up, in chart pixels. */
const ANCHOR_GRAB_RADIUS = 10;

/**
 * A composition point in the chart's own box coordinates.
 *
 * The composition centres a clip's content on its position — the chart's box
 * spans from `x - width / 2` to `x + width / 2`. The chart's geometry works
 * in its own 0..width coordinates, so the half-size has to come off.
 */
const chartLocalPoint = (
  props: CandlestickChartProps,
  point: { x: number; y: number },
): { x: number; y: number } => ({
  x: point.x - (Number(props.x ?? 0) - Number(props.width ?? 0) / 2),
  y: point.y - (Number(props.y ?? 0) - Number(props.height ?? 0) / 2),
});

/** The composition position of a point in the chart's own box. */
const chartCompositionPoint = (
  props: CandlestickChartProps,
  point: { x: number; y: number },
): { x: number; y: number } => ({
  x: Number(props.x ?? 0) - Number(props.width ?? 0) / 2 + point.x,
  y: Number(props.y ?? 0) - Number(props.height ?? 0) / 2 + point.y,
});

/** Seconds label for the transport readout, e.g. "1.5s". */
const secondsLabel = (frames: number, fps: number) => {
  const s = frames / fps;
  return s % 1 === 0 ? `${s}s` : `${s.toFixed(1)}s`;
};

/** What the creator still has to click to finish a drawing. */
const drawingPendingNotice = (kind: DrawingKind, remaining: number) => {
  const label = DRAWING_TOOLS.find((tool) => tool.kind === kind)?.label ?? kind;
  return `${label} — ${remaining} more click${remaining === 1 ? '' : 's'} on the chart.`;
};

export const PreviewPanel: React.FC = () => {
  const project = useStore((s) => s.project);
  const muted = useStore((s) => s.muted);
  const playing = useStore((s) => s.playing);
  const currentFrame = useStore((s) => s.currentFrame);
  const selectedClipId = useStore((s) => s.selectedClipIds[0] ?? null);
  const notice = useStore((s) => s.notice);
  const setCurrentFrame = useStore((s) => s.setCurrentFrame);
  const setPlaying = useStore((s) => s.setPlaying);
  const setMuted = useStore((s) => s.setMuted);
  const commit = useStore((s) => s.commit);
  const updateClipProps = useStore((s) => s.updateClipProps);

  const drawingPath = useStore((s) => s.drawingPath);
  const swingPath = useStore((s) => s.swingPath);
  const wrapperRef = useRef<HTMLDivElement>(null);
  /** The clicks that place a drawing, until the tool has all it needs. */
  const drawingPicks = useRef<Array<{ x: number; y: number }>>([]);
  /** The gesture in progress while a swing path is being authored. */
  const swingDrag = useRef<
    | { mode: 'anchor'; anchorId: string }
    | {
        mode: 'stroke';
        points: Array<{ x: number; y: number }>;
        /** The market point under the pointer, for a press that never moved. */
        anchor: { barIndex: number; price: number };
      }
    | null
  >(null);
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
   * The chart whose swing path is being authored, and its pane state.
   *
   * The pane state comes from the chart's own evaluation, so the geometry the
   * creator points at is the geometry the renderer draws with.
   */
  const swingContext = () => {
    const state = useStore.getState();
    const session = state.swingPath;
    if (!session) return null;
    const clip = findClip(state.project, session.clipId);
    if (!clip || clip.element !== 'candlestickChart') return null;
    const definition = getComponent(clip.element);
    const evaluated = definition?.evaluate?.({
      clip,
      props: clip.props,
      sceneFrame: state.currentFrame,
      project: state.project,
    }) as ChartEvaluation | undefined;
    if (!evaluated || evaluated.panes.length === 0) return null;
    return { clip, pane: evaluated.panes[0], props: clip.props as unknown as CandlestickChartProps };
  };

  /** The chart-local point under the pointer, and the anchor it names. */
  const swingPoint = (clientX: number, clientY: number) => {
    const context = swingContext();
    if (!context) return null;
    const project = projectPoint(clientX, clientY);
    if (!project) return null;
    const local = chartLocalPoint(context.props, project);
    const anchor = chartPointToAnchor(context.props, context.pane, local);
    if (!anchor) return null;
    return { context, local, anchor };
  };

  /** The anchor within a few pixels of a point, if there is one. */
  const swingAnchorNear = (local: { x: number; y: number }) => {
    const context = swingContext();
    if (!context) return null;
    const series = useStore
      .getState()
      .project.series?.find((entry) => entry.id === context.props.seriesId);
    if (!series || series.origin !== 'authored-path') return null;
    let nearest: { id: string; distance: number } | null = null;
    for (const anchor of series.path.anchors) {
      const point = chartAnchorToPoint(context.props, context.pane, anchor);
      const distance = Math.hypot(point.x - local.x, point.y - local.y);
      if (distance <= ANCHOR_GRAB_RADIUS && (!nearest || distance < nearest.distance)) {
        nearest = { id: anchor.id, distance };
      }
    }
    return nearest;
  };

  /**
   * The chart a drawing would land on, and the pane it would use.
   *
   * The chart under the pointer is the one the drawing belongs to; its first
   * pane is the one the anchors resolve against. The store resolves it,
   * because a chart that has no market yet has to be given one before it can
   * be evaluated — without a series, a pane and a clock there is nothing for
   * an anchor to resolve against.
   */
  const drawingTarget = () => {
    const state = useStore.getState();
    const clipId = state.selectedClipIds[0];
    if (!clipId) return null;
    return useStore.getState().resolveDrawingTarget(clipId);
  };

  /**
   * Places a drawing from a click.
   *
   * The click is a position in the composition: the drawing gets its own box
   * around it, and the clicks accumulate until the tool has all it needs. The
   * drawing takes its frame range from the chart it was drawn over — the
   * editor gives a drawing its own range in the next slice.
   */
  const placeDrawing = (clientX: number, clientY: number) => {
    const state = useStore.getState();
    const tool = state.drawingTool;
    if (!tool) return null;
    const target = drawingTarget();
    if (!target) return null;
    const project = projectPoint(clientX, clientY);
    if (!project) return null;

    const picks = [...drawingPicks.current, { x: project.x, y: project.y }];
    const toolSpec = DRAWING_TOOLS.find((entry) => entry.kind === tool);

    if (picks.length < (toolSpec?.clicks ?? 1)) {
      drawingPicks.current = picks;
      useStore
        .getState()
        .setNotice(drawingPendingNotice(tool, (toolSpec?.clicks ?? 1) - picks.length));
      return null;
    }

    const draft = drawingDraftFromClicks(tool, picks);
    const created = useStore.getState().addDrawing(tool, {
      ...draft,
      from: target.chart.from,
      durationInFrames: target.chart.durationInFrames,
    });
    drawingPicks.current = [];
    useStore.getState().setDrawingTool(null);
    useStore.getState().setNotice(null);
    return created;
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
    if (s.drawingTool) {
      // A drawing tool owns the canvas: a click places a market anchor.
      const placement = placeDrawing(e.clientX, e.clientY);
      if (!placement) return;
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      return;
    }
    if (s.swingPath) {
      // The path session owns the canvas: a press on an anchor drags it, and
      // a press anywhere else starts a freehand stroke.
      const point = swingPoint(e.clientX, e.clientY);
      if (!point) return;
      const near = swingAnchorNear(point.local);
      if (near) {
        s.commit();
        swingDrag.current = { mode: 'anchor', anchorId: near.id };
      } else {
        swingDrag.current = {
          mode: 'stroke',
          points: [point.local],
          anchor: point.anchor,
        };
      }
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
      return;
    }
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
    const gesture = swingDrag.current;
    if (gesture) {
      const point = swingPoint(e.clientX, e.clientY);
      if (!point) return;
      if (gesture.mode === 'anchor') {
        useStore
          .getState()
          .moveSwingAnchor(point.context.clip.id, gesture.anchorId, { price: point.anchor.price });
      } else {
        gesture.anchor = point.anchor;
        const last = gesture.points[gesture.points.length - 1];
        if (Math.hypot(point.local.x - last.x, point.local.y - last.y) > 2) {
          gesture.points.push(point.local);
        }
      }
      return;
    }
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
    const gesture = swingDrag.current;
    swingDrag.current = null;
    if (gesture) {
      if (gesture.mode === 'stroke') {
        const context = swingContext();
        if (gesture.points.length === 1) {
          // A press that never moved is a click: it places one anchor.
          if (context) {
            useStore
              .getState()
              .addSwingAnchor(context.clip.id, {
                barIndex: gesture.anchor.barIndex,
                price: gesture.anchor.price,
              });
          }
          return;
        }
        // A freehand stroke becomes the path: the trail is simplified and
        // converted to anchors against the pane's own scale.
        if (context && gesture.points.length >= 2) {
          const range = chartPriceRange(context.pane.bars);
          const points = strokeToAnchorPoints(gesture.points, {
            width: Number(context.props.width ?? 0),
            height: Number(context.props.height ?? 0),
            candleCount: context.pane.totalBars,
            minPrice: range.min,
            maxPrice: range.max,
          });
          // The stroke is the path: it replaces what was there.
          useStore
            .getState()
            .replaceSwingPath(context.clip.id, points.map((p) => ({ barIndex: p.barIndex, price: p.price })));
        }
      }
      return;
    }
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

  /**
   * The chart under a composition point, or null.
   *
   * The topmost hit can be a drawing lying over the chart, so the picks are
   * searched for the chart whose box holds the point.
   */
  const chartAt = (point: { x: number; y: number }) => {
    const list = picks();
    const hit = hitTest(list, point.x, point.y);
    if (hit && hit.element === 'candlestickChart') return hit;
    for (const { clip, box } of list) {
      if (clip.element !== 'candlestickChart') continue;
      if (
        point.x >= box.left &&
        point.x <= box.left + box.width &&
        point.y >= box.top &&
        point.y <= box.top + box.height
      ) {
        return clip;
      }
    }
    return null;
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
    if (element && isDrawingKind(element)) {
      // The tool rail still belongs to a chart, so a drawing dropped on the
      // canvas lands on the chart under the pointer.
      const chart = chartAt(point);
      if (!chart) {
        s.setNotice('A drawing needs a chart — drop it on one, or select a chart and use the tool rail.');
        return;
      }
      const target = useStore.getState().resolveDrawingTarget(chart.id);
      if (!target) {
        s.setNotice('That chart has no market yet.');
        return;
      }
      const kind: DrawingKind = element;
      const toolSpec = DRAWING_TOOLS.find((tool) => tool.kind === kind);
      const clicks = toolSpec?.clicks ?? 1;
      if (clicks > 1) {
        // The drop is the first point; the creator finishes with clicks.
        // The chart is selected so the follow-up clicks land on this chart.
        drawingPicks.current = [{ x: point.x, y: point.y }];
        s.selectClip(chart.id);
        s.setDrawingTool(kind);
        s.setNotice(drawingPendingNotice(kind, clicks - 1));
        return;
      }
      drawingPicks.current = []; // a one-click drawing leaves no clicks pending
      const draft = drawingDraftFromClicks(kind, [{ x: point.x, y: point.y }]);
      useStore.getState().addDrawing(kind, {
        ...draft,
        from: target.chart.from,
        durationInFrames: target.chart.durationInFrames,
        trackId: s.project.tracks.find((track) => track.clips.some((clip) => clip.id === chart.id))
          ?.id,
      });
      s.setNotice(null);
      return;
    }
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

  /**
   * The swing path's anchors, as positions in the composition.
   *
   * Drawn by the editor over the canvas — never by the render adapter, so the
   * handles can never reach the rendered frame (CPT-005).
   */
  const swingHandles = (): Array<{ id: string; x: number; y: number }> => {
    if (!swingPath) return [];
    const clip = findClip(project, swingPath.clipId);
    if (!clip || clip.element !== 'candlestickChart') return [];
    const series = project.series?.find((entry) => entry.id === clip.props.seriesId);
    if (!series || series.origin !== 'authored-path') return [];
    const definition = getComponent(clip.element);
    const evaluated = definition?.evaluate?.({
      clip,
      props: clip.props,
      sceneFrame: currentFrame,
      project,
    }) as ChartEvaluation | undefined;
    const pane = evaluated?.panes[0];
    if (!pane) return [];
    const props = clip.props as unknown as CandlestickChartProps;
    return series.path.anchors.map((anchor) => {
      const point = chartAnchorToPoint(props, pane, anchor);
      const composed = chartCompositionPoint(props, point);
      return { id: anchor.id, x: composed.x, y: composed.y };
    });
  };

  /**
   * The transport actions the selected clip's component declares.
   *
   * The shell names no component: it reads whatever the definition declares
   * and acts on the contract.
   */
  const transportActions = (() => {
    if (!selected) return [];
    const definition = getComponent(selected.element);
    return definition?.transportActions ?? [];
  })();

  /** Executes a declared transport action. */
  const runTransportAction = (action: TransportAction) => {
    if (!selected) return;
    if (action.kind === 'seek') {
      const frame = action.seekTo?.({ props: selected.props, sceneFrame: currentFrame });
      if (frame !== null && frame !== undefined) seekTo(frame);
      return;
    }
    // A toggle acts on the component's own state, through the editor's store so
    // it is one undo step.
    if (action.toggle === 'hold') {
      const paneId = (selected.props.panes as Array<{ id: string }> | undefined)?.[0]?.id;
      const barId = activePaneBarId(selected, currentFrame, project);
      if (paneId && barId) {
        useStore.getState().togglePaneHold(selected.id, paneId, barId);
      }
    }
  };

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
          loop={false}
          moveToBeginningWhenEnded={false}
          initiallyMuted={muted}
          acknowledgeRemotionLicense
        />
        <SelectionOverlay />
        {swingPath ? (
          <div className="pointer-events-none absolute inset-0 z-20">
            <svg
              viewBox={`0 0 ${project.width} ${project.height}`}
              preserveAspectRatio="xMidYMid meet"
              className="h-full w-full"
            >
              {swingHandles().map((handle) => (
                <circle
                  key={handle.id}
                  cx={handle.x}
                  cy={handle.y}
                  r={7}
                  fill="#6ee7a8"
                  stroke="#0d0d14"
                  strokeWidth={2}
                />
              ))}
            </svg>
          </div>
        ) : null}
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
              onClick={() => seekTo(0)}
              title="Back to start"
              aria-label="Back to start"
            >
              <ChevronsLeft data-icon="inline-start" />
            </Button>
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
            {transportActions.map((action) => (
              <Button
                key={action.id}
                variant="ghost"
                size="icon-sm"
                className="size-6 text-muted-foreground hover:text-foreground"
                title={action.label}
                aria-label={action.label}
                disabled={action.kind === 'seek' && action.seekTo?.({ props: selected?.props ?? {}, sceneFrame: currentFrame }) === null}
                onClick={() => runTransportAction(action)}
              >
                <span className="text-[10px] leading-none">{action.icon}</span>
              </Button>
            ))}
            <span className="ml-1 font-mono text-[11px] tabular-nums text-muted-foreground">
              {secondsLabel(currentFrame, project.fps)} / {secondsLabel(project.durationInFrames, project.fps)}
            </span>
            <span className="font-mono text-[11px] tabular-nums text-muted-foreground/70">f{currentFrame}</span>
          </div>
        )}
      </div>
      {!drawingPath ? (
        <div className="preview-hint">
          {notice
            ? notice
            : selected
              ? `Press an element on the canvas to select it — drag “${selected.name}” to move it`
              : 'Press an element on the canvas to select it'}
        </div>
      ) : null}
    </div>
  );
};
