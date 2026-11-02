import { Player } from '@remotion/player';
import { ChevronsLeft, Pause, Play, SkipBack, SkipForward, Volume2, VolumeX } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import {
  DRAWING_TOOLS,
  defaultDrawingDraft,
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
import { elementRegion, isClipActive, moveElement, type Box } from '@chart-studio/editor';
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
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from '@chart-studio/ui';

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
 * A point on the canvas the creator can take hold of.
 *
 * The swing path's anchors and a drawing's points are the same thing: a
 * place in the composition the creator can drag. One handle type, one hit
 * test, one overlay — the canvas never grows a second one.
 */
interface CanvasHandle {
  /** The point's key: which anchor, or which of the drawing's points. */
  id: string;
  /** Where it is, in composition pixels. */
  x: number;
  y: number;
}

/**
 * The handle nearest the pointer, if the pointer is close enough to take it.
 *
 * The distance is in composition pixels, which is the same distance the
 * creator sees.
 */
const nearestHandle = (
  handles: readonly CanvasHandle[],
  point: { x: number; y: number } | null,
): CanvasHandle | null => {
  if (!point) return null;
  let nearest: CanvasHandle | null = null;
  let nearestDistance = Infinity;
  for (const handle of handles) {
    const distance = Math.hypot(handle.x - point.x, handle.y - point.y);
    if (distance <= ANCHOR_GRAB_RADIUS && distance < nearestDistance) {
      nearest = handle;
      nearestDistance = distance;
    }
  }
  return nearest;
};

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
  const selectedClipIds = useStore((s) => s.selectedClipIds);
  const notice = useStore((s) => s.notice);
  const setCurrentFrame = useStore((s) => s.setCurrentFrame);
  const setPlaying = useStore((s) => s.setPlaying);
  const setMuted = useStore((s) => s.setMuted);
  const commit = useStore((s) => s.commit);
  const updateClipsProps = useStore((s) => s.updateClipsProps);

  const drawingPath = useStore((s) => s.drawingPath);
  const swingPath = useStore((s) => s.swingPath);
  const wrapperRef = useRef<HTMLDivElement>(null);
  /** The clicks that place a drawing, until the tool has all it needs. */
  const drawingPicks = useRef<Array<{ x: number; y: number }>>([]);
  /**
   * A rename is pending.
   *
   * The menu gives the focus back to the canvas when it closes, which would
   * take it out of the name field the rename just focused. The request itself
   * is cleared as soon as the field has it, so the menu remembers it here.
   */
  const renamePending = useRef(false);
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
    origins: Array<{ clipId: string; clip: Clip; region: ReturnType<typeof elementRegion> }>;
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
  const picksCache = useRef<{
    project: Project;
    measured: Map<string, Box>;
    sceneFrame: number;
    picks: PickableClip[];
  } | null>(null);
  const picks = () => {
    const current = useStore.getState().project;
    const cached = picksCache.current;
    if (cached && cached.project === current && cached.measured === measured && cached.sceneFrame === useStore.getState().currentFrame) return cached.picks;
    const list = pickableClips(current, measured, useStore.getState().currentFrame);
    picksCache.current = { project: current, measured, sceneFrame: useStore.getState().currentFrame, picks: list };
    return list;
  };

  /**
   * The box an element actually rendered as.
   *
   * A text's size is its content's size, which the props do not carry, so the
   * editor measures the rendered frame. The measurement is the editor's
   * alone: the renderer stays pure.
   */
  const [measured, setMeasured] = useState<Map<string, Box>>(new Map());
  useEffect(() => {
    let id = 0;
    let disposed = false;
    const observed = new Set<Element>();
    const measure = () => {
      if (disposed) return;
      window.cancelAnimationFrame(id);
      id = window.requestAnimationFrame(() => {
        const stage = wrapperRef.current;
        if (!stage) return;
        const stageRect = stage.getBoundingClientRect();
        const { scale } = canvasMetrics(stageRect);
        if (scale <= 0) return;
        const next = new Map<string, Box>();
        const elements=new Map(Array.from(stage.querySelectorAll<HTMLElement>('[data-clip-id]')).map(el=>[el.dataset.clipId,el]));
        for (const clip of projectClips(project)) {
          const el = elements.get(clip.id);
          if (!el) continue;
          const definition = getComponent(clip.element);
          if (!definition?.edit?.contentSized) continue;
          if (!observed.has(el)) { observed.add(el); resize.observe(el); }
          const width = (el as HTMLElement).offsetWidth;
          const height = (el as HTMLElement).offsetHeight;
          if (width <= 0 || height <= 0) continue;
          // The measurement is the element's size; its place is its anchor, so
          // the box sits where the compositor put it.
          const anchorX = Number(clip.props.x ?? 0);
          const anchorY = Number(clip.props.y ?? 0);
          next.set(clip.id, {
            left: anchorX - width / 2,
            top: anchorY - height / 2,
            width,
            height,
          });
        }
        setMeasured((previous) => {
          let same = true;
          previous.forEach((box, key) => {
            const other = next.get(key);
            if (!other || Math.abs(other.left - box.left) > 0.5 || Math.abs(other.top - box.top) > 0.5 || Math.abs(other.width - box.width) > 0.5 || Math.abs(other.height - box.height) > 0.5) {
              same = false;
            }
          });
          if (same && next.size === previous.size) return previous;
          return next;
        });
      });
    };
    const stage = wrapperRef.current;
    const resize = new ResizeObserver(measure);
    const mutations = new MutationObserver(measure);
    if (stage) {
      resize.observe(stage);
      mutations.observe(stage, {childList: true, subtree: true, characterData: true});
      stage.addEventListener('load', measure, true);
    }
    document.fonts?.addEventListener('loadingdone', measure);
    void document.fonts?.ready?.then(measure);
    measure();
    return () => {
      disposed = true;
      window.cancelAnimationFrame(id);
      resize.disconnect();
      mutations.disconnect();
      stage?.removeEventListener('load', measure, true);
      document.fonts?.removeEventListener('loadingdone', measure);
    };
  }, [project, currentFrame]);

  /**
   * The topmost element under the pointer, or null for the background.
   *
   * The element is picked by the shape it declares — a line by its stroke, a
   * point by its point — so a line no longer swallows what is under it.
   */
  const pickAt = (clientX: number, clientY: number) => {
    const point = projectPoint(clientX, clientY);
    if (!point) return null;
    const stage = wrapperRef.current;
    const scale = stage ? canvasMetrics(stage.getBoundingClientRect()).scale : 1;
    return hitTest(picks(), point.x, point.y, scale);
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
  /**
   * The swing path's anchor nearest the pointer.
   *
   * The canvas has one handle hit test: the swing path's anchors and a
   * drawing's points are both handles, and both are picked with it.
   */
  const swingAnchorNear = (clientX: number, clientY: number) => {
    const handle = nearestHandle(swingHandles(), projectPoint(clientX, clientY));
    return handle?.id ?? null;
  };

  /**
   * Places a drawing from a click.
   *
   * The click is a position in the composition: the drawing gets its own box
   * around it, and the clicks accumulate until the tool has all it needs. A
   * drawing is an ordinary element, so it needs no chart — it takes its own
   * frame range from the timeline.
   */
  const placeDrawing = (clientX: number, clientY: number) => {
    const state = useStore.getState();
    const tool = state.drawingTool;
    if (!tool) return null;
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
    const created = useStore.getState().addDrawing(tool, draft);
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
      const target = s.project.tracks.flatMap(t => t.clips).find(c => c.id === s.swingPath!.clipId);
      if (!target || target.locked) return;
      // The path session owns the canvas: a press on an anchor drags it, and
      // a press anywhere else starts a freehand stroke.
      const point = swingPoint(e.clientX, e.clientY);
      if (!point) return;
      const near = swingAnchorNear(e.clientX, e.clientY);
      if (near) {
        s.commit();
        swingDrag.current = { mode: 'anchor', anchorId: near };
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
    playerRef.current?.pause();
    s.setPlaying(false);
    const next = useStore.getState();
    // The grabbed clip always moves; the rest of the selection moves with it.
    const moving = new Set([...next.selectedClipIds, hit.id]);
    const origins: Array<{ clipId: string; clip: Clip; region: ReturnType<typeof elementRegion> }> = [];
    for (const c of projectClips(next.project)) {
      if (!moving.has(c.id) || !isClipActive(c, next.currentFrame)) continue;
      const region = elementRegion(c, next.project, measured.get(c.id) ?? null, next.currentFrame);
      if (region && region.pose?.invertible!==false) origins.push({ clipId: c.id, clip: c, region });
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
    const state = useStore.getState();
    // Eligibility is live; geometry remains the immutable pointer-down snapshot.
    const eligible = drag.current.origins.filter(({clipId,region}) => {
      const live = findClip(state.project, clipId);
      return live && isClipActive(live, state.currentFrame) && region?.context?.sceneFrame===state.currentFrame;
    });
    if (eligible.length === 0) {
      drag.current = null;
      wrapperRef.current.style.cursor = 'default';
      return;
    }
    const patches: Array<{clipId: string; patch: Record<string, unknown>}> = [];
    for (const o of eligible) {
      const region = o.region ?? elementRegion(o.clip, project);
      if (!region) continue;
      const patch = moveElement(o.clip, region, { x: dx, y: dy });
      const live = findClip(state.project, o.clipId);
      if (patch && live && Object.entries(patch).some(([key,value]) => JSON.stringify(live.props[key]) !== JSON.stringify(value))) {
        patches.push({clipId: o.clipId, patch});
      }
    }
    if (patches.length === 0) return;
    if (!drag.current.moved) {
      drag.current.moved = true;
      commit(); // one undo entry, only after a changed authored patch exists
    }
    updateClipsProps(patches);
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
      // A drawing is an ordinary element: the drop point is where it lands,
      // and it needs no chart. It goes on the track above the chart under the
      // pointer when there is one, so it draws over that chart.
      const kind: DrawingKind = element;
      const toolSpec = DRAWING_TOOLS.find((tool) => tool.kind === kind);
      const clicks = toolSpec?.clicks ?? 1;
      const chart = chartAt(point);
      const trackId = chart
        ? s.project.tracks.find((track) => track.clips.some((clip) => clip.id === chart.id))?.id
        : undefined;

      // A tool that takes two clicks cannot be completed by one drop: the drop
      // places the shape with its own proportions and the creator drags its
      // ends into place.
      drawingPicks.current = [];
      const draft =
        clicks > 1
          ? defaultDrawingDraft(kind, { x: point.x, y: point.y })
          : drawingDraftFromClicks(kind, [{ x: point.x, y: point.y }]);
      useStore.getState().addDrawing(kind, { ...draft, trackId });
      s.setDrawingTool(null);
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

  /**
   * The element under the pointer, selected when the creator right-clicks it.
   *
   * The menu acts on the selection, so a right-click picks what it is over
   * first. A locked clip is not pickable, so the selection stays where it was.
   */
  const selectUnderPointer = (clientX: number, clientY: number) => {
    const hit = pickAt(clientX, clientY);
    if (hit) useStore.getState().selectClip(hit.id);
  };

  /** Step one frame back/forward, clamped to the composition. */
  const stepFrame = (delta: number) => {
    const frame = playerRef.current?.getCurrentFrame() ?? currentFrame;
    seekTo(Math.max(0, Math.min(project.durationInFrames - 1, frame + delta)));
  };

  return (
    <div className="preview-panel">
      <ContextMenu>
        <ContextMenuTrigger
          asChild
          onContextMenu={(e) => selectUnderPointer(e.clientX, e.clientY)}
        >
        <div
          className="preview-stage relative"
          ref={wrapperRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => { drag.current = null; swingDrag.current = null; if (wrapperRef.current) wrapperRef.current.style.cursor = 'default'; }}
        onLostPointerCapture={() => { drag.current = null; swingDrag.current = null; if (wrapperRef.current) wrapperRef.current.style.cursor = 'default'; }}
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
        <SelectionOverlay measured={measured} onManipulationStart={()=>playerRef.current?.pause()} />
        {swingHandles().length > 0 ? (
          <div className="pointer-events-none absolute inset-0 z-20">
            <svg
              viewBox={`0 0 ${project.width} ${project.height}`}
              preserveAspectRatio="xMidYMid meet"
              className="h-full w-full"
            >
              {swingHandles().map((handle) => (
                <circle
                  key={`${handle.id}`}
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
        </ContextMenuTrigger>
        <ContextMenuContent
          // A rename takes the focus into the name field; the menu must not
          // take it back when it closes.
          onCloseAutoFocus={(e: Event) => {
            if (!renamePending.current) return;
            renamePending.current = false;
            e.preventDefault();
          }}
        >
          <ContextMenuItem
            disabled={selectedClipIds.length < 2}
            onSelect={() => useStore.getState().groupSelection()}
          >
            Group
          </ContextMenuItem>
          <ContextMenuItem
            disabled={!selectedClipIds.some((id) => findClip(project, id)?.groupId)}
            onSelect={() => useStore.getState().ungroupSelection()}
          >
            Ungroup
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem
            disabled={!selected}
            onSelect={() => useStore.getState().duplicateSelection()}
          >
            Duplicate
          </ContextMenuItem>
          <ContextMenuItem
            disabled={!selected}
            onSelect={() => useStore.getState().copySelection()}
          >
            Copy
          </ContextMenuItem>
          <ContextMenuItem onSelect={() => useStore.getState().paste(currentFrame)}>Paste</ContextMenuItem>
          <ContextMenuItem
            disabled={!selected}
            variant="destructive"
            onSelect={() => useStore.getState().removeClips(selectedClipIds)}
          >
            Delete
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem
            disabled={!selected}
            onSelect={() => {
              renamePending.current = true;
              if (selected) useStore.getState().requestRename(selected.id);
            }}
          >
            Rename
          </ContextMenuItem>
          <ContextMenuItem
            disabled={!selected}
            onSelect={() => selected && useStore.getState().bringToFront(selected.id)}
          >
            Bring to front
          </ContextMenuItem>
          <ContextMenuItem
            disabled={!selected}
            onSelect={() => selected && useStore.getState().sendToBack(selected.id)}
          >
            Send to back
          </ContextMenuItem>
          <ContextMenuSeparator />
          <ContextMenuItem
            disabled={!selected}
            onSelect={() => selected && useStore.getState().setClipLocked(selected.id, !selected.locked)}
          >
            {selected?.locked ? 'Unlock' : 'Lock'}
          </ContextMenuItem>
          <ContextMenuItem
            disabled={!selected}
            onSelect={() => selected && useStore.getState().setClipHidden(selected.id, !selected.hidden)}
          >
            {selected?.hidden ? 'Show' : 'Hide'}
          </ContextMenuItem>
        </ContextMenuContent>
      </ContextMenu>
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
