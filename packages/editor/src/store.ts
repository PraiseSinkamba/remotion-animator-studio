import { normalizeComponentProps, validateProjectDocument } from '@chart-studio/core';
import { create } from 'zustand';
import { EFFECTS, validateEffect } from '@chart-studio/components';
import { buildComponentProps, getComponent } from '@chart-studio/components';
import type { DrawingDraft } from './drawings';
import {defaultDrawingDraft} from './drawings';
import { buildPresetClips, PRESETS } from './presets';
import { buildChartGroup, relayoutChartGroup, withChartMarket } from './chartGroup';
import { sampleProject } from '@chart-studio/core';
import {
  addSwingAnchor,
  clampTransitionDuration,
  moveSwingAnchor,
  removeSwingAnchor,
  type AnchorRegime,
  type DrawingKind,
  type SwingPath,
} from '@chart-studio/core';
import type {
  ChartGroupSpec,
  Clip,
  EffectType,
  ElementType,
  OhlcBar,
  PaneHold,
  PaneSpec,
  Project,
  SeriesSpec,
  Track,
  ZoomTrack,
} from '@chart-studio/core';

let idCounter = 0;
export const uid = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${idCounter++}`;

/** A copied clip remembers which track it came from so paste can put it back there. */
interface ClipboardEntry {
  trackId: string;
  clip: Clip;
}

interface EditorState {
  project: Project;
  /** Multi-selection; the first entry is the "primary" clip shown in the Inspector. */
  selectedClipIds: string[];
  clipboard: ClipboardEntry[];
  currentFrame: number;
  playing: boolean;
  muted: boolean;
  /** Active "draw on canvas" session — a motion path for an effect, or waypoints for a Story Trail */
  drawingPath: {
    clipId: string;
    /** set when drawing a motion path for this effect; absent for trail waypoints */
    effectId?: string;
    points: Array<{ x: number; y: number }>;
  } | null;
  pixelsPerFrame: number;
  history: Project[];
  future: Project[];

  /** Identity of the project in the workspace storage; null when it is not stored. */
  workspaceId: string | null;
  /** Revision of the stored document the app last committed. */
  workspaceRevision: number | null;
  /** Point the editor at a stored project, or forget it with null. */
  setWorkspace: (identity: { id: string; revision: number } | null) => void;

  setProject: (patch: Partial<Project>) => void;
  /** Change canvas size, rescaling every clip's position/size props to match */
  resizeProject: (width: number, height: number) => void;
  replaceProject: (p: Project) => void;
  /** Load a project without touching undo history (autosave restore) */
  hydrate: (p: Project) => void;
  addPreset: (presetId: string, atFrame: number) => void;
  /** Plain click: select only this clip. additive (ctrl/cmd/shift): toggle membership. */
  selectClip: (id: string | null, additive?: boolean) => void;
  setCurrentFrame: (f: number) => void;
  setPlaying: (p: boolean) => void;
  setMuted: (m: boolean) => void;
  setPixelsPerFrame: (ppf: number) => void;

  /** Snapshot current project onto the undo stack (call at start of a gesture / discrete edit). */
  commit: () => void;
  undo: () => void;
  redo: () => void;

  addTrack: () => void;
  removeTrack: (trackId: string) => void;
  /** Move a track up (-1) or down (+1) in the layer order */
  moveTrack: (trackId: string, dir: -1 | 1) => void;
  renameTrack: (trackId: string, name: string) => void;
  groupSelection: () => void;
  ungroupSelection: () => void;
  addClip: (element: ElementType, trackId: string, atFrame: number) => void;
  removeClips: (clipIds: string[]) => void;
  updateClip: (clipId: string, patch: Partial<Pick<Clip, 'from' | 'durationInFrames' | 'name'>>, recordHistory?: boolean) => boolean;
  /** Move several clips horizontally by the same frame delta (multi-drag). No history push. */
  shiftClips: (moves: Array<{ clipId: string; from: number }>) => void;
  updateClipProps: (clipId: string, patch: Record<string, unknown>, recordHistory?: boolean) => boolean;
  updateClipsProps: (patches: ReadonlyArray<{clipId: string; patch: Record<string, unknown>}>, recordHistory?: boolean) => boolean;
  moveClipToTrack: (clipId: string, trackId: string, recordHistory?: boolean) => void;
  addEffect: (clipId: string, type: EffectType) => void;
  removeEffect: (clipId: string, effectId: string) => void;
  updateEffectParams: (clipId: string, effectId: string, patch: Record<string, any>, recordHistory?: boolean) => boolean;

  startDrawingPath: (clipId: string, effectId: string) => void;
  startDrawingTrail: (clipId: string) => void;
  addDrawingPoint: (pt: { x: number; y: number }) => void;
  cancelDrawingPath: () => void;
  /** Commit the drawn polyline: element moves to the first point, path becomes relative. */
  finishDrawingPath: () => void;

  /** The chart whose swing path is being authored, or null. */
  swingPath: { clipId: string } | null;
  /** Opens the path session on a chart, giving it an authored-path series if it has none. */
  startSwingPath: (clipId: string) => void;
  addSwingAnchor: (
    clipId: string,
    anchor: { barIndex: number; price: number; regime?: AnchorRegime },
  ) => void;
  moveSwingAnchor: (
    clipId: string,
    anchorId: string,
    patch: { barIndex?: number; price?: number },
  ) => void;
  removeSwingAnchor: (clipId: string, anchorId: string) => void;
  /** Replaces the whole path, as a freehand stroke does. */
  replaceSwingPath: (
    clipId: string,
    anchors: Array<{ barIndex: number; price: number }>,
  ) => void;
  /** Closes the path session. */
  finishSwingPath: () => void;

  /** The drawing tool the creator has armed, or null. */
  drawingTool: DrawingKind | null;
  setDrawingTool: (kind: DrawingKind | null) => void;
  /** One short sentence the shell shows the creator; null when there is none. */
  notice: string | null;
  /** Shows a message, or clears it with null. */
  setNotice: (message: string | null) => void;
  /** The clip the shell is asked to rename; null when there is none. */
  renameClipId: string | null;
  /** Clears the rename request once the name field has taken it. */
  clearRenameRequest: () => void;
  /**
   * Gives a chart the market it needs to host drawings: a series, a pane and a
   * clock. A chart added from the library carries inline bars and no series,
   * and a drawing cannot resolve against a chart that has no evaluated pane.
   */
  ensureChartMarket: (clipId: string) => void;
  /**
   * Groups chart clips: they share one clock and take the places the layout
   * gives them. The group positions its charts; it does not own them.
   */
  addChartGroup: (chartClipIds: string[], layout: ChartGroupSpec['layout']) => string;
  /** Moves a group's charts into another layout. */
  setChartGroupLayout: (groupId: string, layout: ChartGroupSpec['layout']) => void;
  /**
   * The chart and pane a drawing would land on, or null when the selection is
   * not a chart.
   *
   * A chart added from the library carries inline bars and no series, so it has
   * no market to resolve against and cannot be evaluated. The chart is given
   * its market first, so a drawing works on any chart the creator picks.
   */
  /** Creates a drawing: an independent clip with its own box and frame range. */
  addDrawing: (kind: DrawingKind, draft: DrawingDraft) => string;
  /** Changes a drawing's props. The caller commits at the start of a gesture. */
  updateDrawing: (clipId: string, patch: Record<string, any>) => void;
  /** Locks or unlocks any clip: a locked clip is not pickable on the canvas. */
  setClipLocked: (clipId: string, locked: boolean) => void;
  /** Hides or shows any clip: a hidden clip is not rendered. */
  setClipHidden: (clipId: string, hidden: boolean) => void;
  /** Moves a clip to the top of the top layer, so it draws above everything. */
  bringToFront: (clipId: string) => void;
  /** Moves a clip behind every other clip. */
  sendToBack: (clipId: string) => void;
  /** Asks the shell to rename the clip: it selects it and focuses its name. */
  requestRename: (clipId: string) => void;

  /** Adds a transition on the boundary between two adjacent clips of a track. */
  addTransition: (trackId: string, fromClipId: string, toClipId: string, element: ElementType) => void;
  /** Changes a transition's element or its requested duration. */
  updateTransition: (trackId: string, transitionId: string, patch: { element?: ElementType; durationInFrames?: number }) => void;
  removeTransition: (trackId: string, transitionId: string) => void;

  /** Switches the composition's length between derived from the content and the author's own number. */
  setDurationMode: (mode: 'derived' | 'fixed') => void;
  /** Sets the authored length, in seconds. The project's fps converts it to frames. */
  setFixedDuration: (seconds: number) => void;
  /**
   * Holds the market on a bar, or releases it if it is already held there.
   * The hold covers the rest of the clip, so the market stops where the
   * creator pressed the button.
   */
  togglePaneHold: (clipId: string, paneId: string, barId: string) => void;

  /**
   * Adds a pause point to a pane: the pane holds on one candle for a frame
   * range, relative to the chart clip. One undo step.
   */
  addHold: (
    clipId: string,
    paneId: string,
    barId: string,
    inFrame: number,
    outFrame: number,
  ) => void;
  /**
   * Changes a pause point. A hold is identified by the candle it holds, so a
   * pane holds each candle once. One undo step.
   */
  updateHold: (
    clipId: string,
    paneId: string,
    holdId: string,
    patch: Partial<PaneHold>,
  ) => void;
  /** Removes a pause point. One undo step. */
  removeHold: (clipId: string, paneId: string, holdId: string) => void;
  /** Replaces a pane's camera zoom track. One undo step. */
  updateZoomTrack: (clipId: string, paneId: string, track: ZoomTrack) => void;

  copySelection: () => void;
  /** Paste clipboard clips, re-timed so the earliest starts at `atFrame`. */
  paste: (atFrame: number) => void;
  duplicateSelection: () => void;
}

const MAX_HISTORY = 100;

const mapClips = (project: Project, clipId: string, fn: (c: Clip) => Clip): Project => ({
  ...project,
  tracks: project.tracks.map((t) => ({
    ...t,
    clips: t.clips.map((c) => (c.id === clipId ? fn(c) : c)),
  })),
});

export const findClip = (project: Project, clipId: string | null | undefined): Clip | null => {
  if (!clipId) return null;
  for (const t of project.tracks) {
    const c = t.clips.find((c) => c.id === clipId);
    if (c) return c;
  }
  return null;
};

const editableClip = (project: Project, clipId: string): Clip | null => {
  const clip = findClip(project, clipId);
  return clip && !clip.locked ? clip : null;
};

const findTrackOf = (project: Project, clipId: string): Track | null =>
  project.tracks.find((t) => t.clips.some((c) => c.id === clipId)) ?? null;

/**
 * Copies a clip's props, deep enough that a drawing's anchors do not stay
 * shared with the original. Two drawings that share an anchors object would
 * edit each other.
 */
const copyClipProps = (props: Record<string, any>): Record<string, any> => {
  const points = props.points;
  if (!points || typeof points !== 'object') return { ...props };
  const copiedPoints: Record<string, any> = {};
  for (const [key, point] of Object.entries(points as Record<string, any>)) {
    copiedPoints[key] = point && typeof point === 'object' ? { ...point } : point;
  }
  return { ...props, points: copiedPoints };
};

/** The duration a new transition asks for, before the clips clamp it. */
const DEFAULT_TRANSITION_FRAMES = 12;

const cloneClip = (clip: Clip): Clip => ({
  ...clip,
  id: uid('c'),
  props: copyClipProps(clip.props),
  effects: clip.effects.map((e) => ({ ...e, id: uid('e'), params: { ...e.params } })),
});

/** The series a chart clip draws, if the project holds one for it. */
const chartSeries = (project: Project, clip: Clip | null): SeriesSpec | undefined => {
  if (!clip) return undefined;
  const seriesId = clip.props.seriesId;
  if (typeof seriesId !== 'string') return undefined;
  return project.series?.find((series) => series.id === seriesId);
};

/** Replaces an authored path in the project, leaving every other series alone. */
const withAuthoredPath = (
  project: Project,
  seriesId: string,
  change: (path: SwingPath) => SwingPath,
): Project => ({
  ...project,
  series: project.series?.map((series) =>
    series.id === seriesId && series.origin === 'authored-path'
      ? { ...series, path: change(series.path) }
      : series,
  ),
});

/**
 * Rewrites one pane of one chart clip.
 *
 * A pane lives inside the chart clip's props, so a pane-level edit is a
 * project-level edit: the clip keeps its place and only the pane changes.
 */
const withPane = (
  project: Project,
  clipId: string,
  paneId: string,
  change: (pane: PaneSpec) => PaneSpec,
): Project =>
  mapClips(project, clipId, (clip) => {
    const panes = Array.isArray(clip.props.panes) ? (clip.props.panes as PaneSpec[]) : [];
    if (!panes.some((pane) => pane.id === paneId)) return clip;
    return {
      ...clip,
      props: {
        ...clip.props,
        panes: panes.map((pane) => (pane.id === paneId ? change(pane) : pane)),
      },
    };
  });

export const useStore = create<EditorState>((set, get) => ({
  project: sampleProject,
  selectedClipIds: [],
  clipboard: [],
  currentFrame: 0,
  playing: false,
  muted: false,
  drawingPath: null,
  swingPath: null,
  drawingTool: null,
  notice: null,
  renameClipId: null,
  pixelsPerFrame: 4,
  history: [],
  future: [],
  workspaceId: null,
  workspaceRevision: null,

  setWorkspace: (identity) =>
    set({
      workspaceId: identity?.id ?? null,
      workspaceRevision: identity?.revision ?? null,
    }),

  setProject: (patch) => {
    get().commit();
    set((s) => ({ project: { ...s.project, ...patch } }));
  },
  resizeProject: (width, height) => {
    const s = get();
    if (width === s.project.width && height === s.project.height) return;
    get().commit();
    const rx = width / s.project.width;
    const ry = height / s.project.height;
    const m = Math.min(rx, ry);
    const scaleProps = (clip: Clip): Record<string, unknown> => {
      const q: Record<string, unknown> = { ...clip.props };
      const edit = getComponent(clip.element)?.edit;
      const scaled = new Set<string>();
      const scaleKey = (key: string, f: number) => {
        if (scaled.has(key)) return;
        scaled.add(key);
        if (typeof q[key] === 'number') q[key] = Math.round(q[key] * f * 100) / 100;
      };
      scaleKey('x', rx);
      scaleKey('y', ry);
      scaleKey('width', rx);
      scaleKey('height', ry);
      for (const k of ['fontSize', 'size', 'borderRadius', 'letterSpacing', 'amplitude', 'drift']) scaleKey(k, m);
      scaleKey('wavelength', rx);
      for (const key of edit?.translate?.x ?? []) scaleKey(key, rx);
      for (const key of edit?.translate?.y ?? []) scaleKey(key, ry);
      if (edit?.coordinates === 'absolute' && q.points && typeof q.points === 'object' && !Array.isArray(q.points)) {
        q.points = Object.fromEntries(Object.entries(q.points).map(([id,value]: [string,unknown]) => {
          if (!value || typeof value !== 'object' || !('x' in value) || !('y' in value) || typeof value.x !== 'number' || typeof value.y !== 'number') return [id,value];
          return [id,{...value,x:Math.round(value.x*rx*100)/100,y:Math.round(value.y*ry*100)/100}];
        }));
      }
      return q;
    };
    set((state) => ({
      project: {
        ...state.project,
        width,
        height,
        tracks: state.project.tracks.map((t) => ({
          ...t,
          clips: t.clips.map((c) => c.locked ? c : ({ ...c, props: scaleProps(c) })),
        })),
      },
    }));
  },
  replaceProject: (p) => {
    get().commit();
    // A different document is a different workspace project, so the editor
    // forgets which stored project it was editing.
    set({ project: p, selectedClipIds: [], currentFrame: 0, workspaceId: null, workspaceRevision: null });
  },
  hydrate: (p) => set({ project: p, selectedClipIds: [] }),
  addPreset: (presetId, atFrame) => {
    const preset = PRESETS[presetId];
    if (!preset) return;
    get().commit();
    set((s) => {
      const { width, height, durationInFrames } = s.project;
      const at = Math.max(0, Math.min(atFrame, durationInFrames - 10));
      const clips = buildPresetClips(preset, width, height, at).map((c) => ({
        ...c,
        durationInFrames: Math.max(2, Math.min(c.durationInFrames, durationInFrames - c.from)),
        // Same rule as addClip: the clip records the props schema it was
        // written against.
        propsVersion: getComponent(c.element)?.propsVersion ?? 1,
      }));
      // one track per clip so nothing hides in a shared lane;
      // buildPresetClips returns bottom→top, and the top layer belongs on the first track
      const newTracks: Track[] = [...clips]
        .reverse()
        .map((clip) => ({ id: uid('t'), name: clip.name, clips: [clip] }));
      const project = { ...s.project, tracks: [...newTracks, ...s.project.tracks] };
      if (!preset.chartGroup) return { project };
      // A grouped preset drops as one group: the charts share a clock and
      // take the places the layout gives them.
      const chartIds = clips.filter((clip) => clip.element === 'candlestickChart').map((clip) => clip.id);
      const withMarkets = chartIds.reduce(
        (acc, id) => withChartMarket(acc, id),
        project,
      );
      return { project: buildChartGroup(withMarkets, uid('g'), chartIds, preset.chartGroup) };
    });
  },
  selectClip: (id, additive = false) =>
    set((s) => {
      if (id === null) return { selectedClipIds: [] };
      // a grouped clip always brings its whole group along
      const clip = findClip(s.project, id);
      const groupIds = clip?.groupId
        ? s.project.tracks.flatMap((t) => t.clips.filter((c) => c.groupId === clip.groupId).map((c) => c.id))
        : [id];
      if (!additive) return { selectedClipIds: groupIds };
      const allSelected = groupIds.every((g) => s.selectedClipIds.includes(g));
      return {
        selectedClipIds: allSelected
          ? s.selectedClipIds.filter((x) => !groupIds.includes(x))
          : [...new Set([...s.selectedClipIds, ...groupIds])],
      };
    }),
  setCurrentFrame: (f) => set({ currentFrame: f }),
  setPlaying: (p) => set({ playing: p }),
  setMuted: (m) => set({ muted: m }),
  setPixelsPerFrame: (ppf) => set({ pixelsPerFrame: Math.min(16, Math.max(0.5, ppf)) }),

  commit: () =>
    set((s) => ({
      history: [...s.history.slice(-MAX_HISTORY + 1), s.project],
      future: [],
    })),
  undo: () =>
    set((s) => {
      if (s.history.length === 0) return s;
      const prev = s.history[s.history.length - 1];
      return {
        project: prev,
        history: s.history.slice(0, -1),
        future: [s.project, ...s.future],
        selectedClipIds: [],
      };
    }),
  redo: () =>
    set((s) => {
      if (s.future.length === 0) return s;
      const [next, ...rest] = s.future;
      return {
        project: next,
        history: [...s.history, s.project],
        future: rest,
        selectedClipIds: [],
      };
    }),

  addTrack: () => {
    get().commit();
    set((s) => ({
      project: {
        ...s.project,
        tracks: [{ id: uid('t'), name: `Track ${s.project.tracks.length + 1}`, clips: [] }, ...s.project.tracks],
      },
    }));
  },
  removeTrack: (trackId) => {
    const track = get().project.tracks.find(t => t.id === trackId);
    if (!track || track.clips.some(c => c.locked)) return;
    get().commit();
    set((s) => ({
      project: { ...s.project, tracks: s.project.tracks.filter((t) => t.id !== trackId) },
      selectedClipIds: [],
    }));
  },

  moveTrack: (trackId, dir) => {
    const s = get();
    const idx = s.project.tracks.findIndex((t) => t.id === trackId);
    const target = idx + dir;
    if (idx < 0 || target < 0 || target >= s.project.tracks.length || s.project.tracks[idx].clips.some(c => c.locked) || s.project.tracks[target].clips.some(c => c.locked)) return;
    get().commit();
    set((state) => {
      const tracks = [...state.project.tracks];
      [tracks[idx], tracks[target]] = [tracks[target], tracks[idx]];
      return { project: { ...state.project, tracks } };
    });
  },
  renameTrack: (trackId, name) =>
    set((s) => ({
      project: {
        ...s.project,
        tracks: s.project.tracks.map((t) => (t.id === trackId ? { ...t, name } : t)),
      },
    })),
  groupSelection: () => {
    const s = get();
    const editable = s.selectedClipIds.filter(id => editableClip(s.project, id));
    if (editable.length < 2) return;
    get().commit();
    const gid = uid('g');
    const sel = new Set(editable);
    set((state) => ({
      project: {
        ...state.project,
        tracks: state.project.tracks.map((t) => ({
          ...t,
          clips: t.clips.map((c) => (sel.has(c.id) ? { ...c, groupId: gid } : c)),
        })),
      },
    }));
  },
  ungroupSelection: () => {
    const s = get();
    const editable = s.selectedClipIds.filter(id => editableClip(s.project, id)?.groupId);
    if (!editable.length) return;
    get().commit();
    const sel = new Set(editable);
    set((state) => ({
      project: {
        ...state.project,
        tracks: state.project.tracks.map((t) => ({
          ...t,
          clips: t.clips.map((c) => (sel.has(c.id) ? { ...c, groupId: undefined } : c)),
        })),
      },
    }));
  },
  addClip: (element, trackId, atFrame) => {
    const def = getComponent(element);
    if (!def) return;
    get().commit();
    set((s) => {
      const total = s.project.durationInFrames;
      const from = Math.max(0, Math.min(atFrame, total - 10));
      const props = buildComponentProps(def, s.project);
      const wanted =
        typeof def.defaultDuration === 'function' ? def.defaultDuration(props) : (def.defaultDuration ?? 90);
      const clip: Clip = {
        id: uid('c'),
        name: def.label,
        element,
        from,
        durationInFrames: Math.min(wanted, total - from),
        props,
        effects: [],
        // The props are written against the definition's current schema.
        // The migrator rejects a clip that is newer than the component
        // supports, so a clip has to say which schema it belongs to.
        propsVersion: def.propsVersion ?? 1,
      };
      // A chart added from the library carries inline bars and no series, so
      // it has no market: without a series, a pane and a clock it cannot be
      // evaluated. The chart is given its market as it is created.
      const project =
        element === 'candlestickChart'
          ? withChartMarket(
              {
                ...s.project,
                tracks: s.project.tracks.map((t) =>
                  t.id === trackId ? { ...t, clips: [...t.clips, clip] } : t,
                ),
              },
              clip.id,
            )
          : {
              ...s.project,
              tracks: s.project.tracks.map((t) =>
                t.id === trackId ? { ...t, clips: [...t.clips, clip] } : t,
              ),
            };
      return {
        project,
        selectedClipIds: [clip.id],
      };
    });
  },
  removeClips: (clipIds) => {
    const gone = new Set(clipIds.filter(id => editableClip(get().project, id)));
    if (gone.size === 0) return;
    get().commit();
    set((s) => ({
      project: {
        ...s.project,
        tracks: s.project.tracks.map((t) => ({ ...t, clips: t.clips.filter((c) => !gone.has(c.id)) })),
      },
      selectedClipIds: s.selectedClipIds.filter((id) => !gone.has(id)),
    }));
  },
  updateClip: (clipId, patch, recordHistory = false) => {
    let changed = false;
    set((s) => {
      const clip = editableClip(s.project, clipId);
      if (!clip || Object.entries(patch).every(([key, value]) => clip[key as keyof Clip] === value)) return s;
      const project=mapClips(s.project,clipId,c=>c.locked?c:({...c,...patch}));
      const validated=validateProjectDocument(project);
      if (!validated.ok) return {notice:`${validated.issues[0].path}: ${validated.issues[0].message}`};
      changed = true;
      return {project, ...(recordHistory ? {history: [...s.history.slice(-MAX_HISTORY + 1), s.project], future: []} : {})};
    });
    return changed;
  },
  shiftClips: (moves) =>
    set((s) => {
      if(moves.some(move=>!Number.isInteger(move.from)||move.from<0)) return {notice:'Clip from must be a nonnegative integer'};
      if (!moves.some(move => { const clip = editableClip(s.project, move.clipId); return clip && clip.from !== move.from; })) return s;
      const byId = new Map(moves.map((m) => [m.clipId, m.from]));
      return {
        project: {
          ...s.project,
          tracks: s.project.tracks.map((t) => ({
            ...t,
            clips: t.clips.map((c) => (!c.locked && byId.has(c.id) ? { ...c, from: byId.get(c.id)! } : c)),
          })),
        },
      };
    }),
  updateClipProps: (clipId, patch, recordHistory) => get().updateClipsProps([{ clipId, patch }], recordHistory),
  updateClipsProps: (patches, recordHistory = false) => {
   let accepted = false;
   set((s) => {
    const byId = new Map(patches.map(({clipId, patch}) => [clipId, patch]));
    let changed = false;
    let invalid: string | undefined;
    const tracks = s.project.tracks.map((track) => ({ ...track, clips: track.clips.map((clip) => {
      const patch = byId.get(clip.id);
      if (clip.locked || !patch || Object.entries(patch).every(([key,value]) => JSON.stringify(clip.props[key]) === JSON.stringify(value))) return clip;
      const definition=getComponent(clip.element);
      const normalized=definition ? normalizeComponentProps(definition,{...clip.props,...patch}) : undefined;
      if(normalized && !normalized.ok) {invalid=`Clip "${clip.id}" props.${normalized.issues[0].path}: ${normalized.issues[0].message}`;return clip;}
      changed = true;
      return { ...clip, props: normalized?.ok ? normalized.value : { ...clip.props, ...patch } };
    }) }));
    if(invalid) return {notice:invalid};
    if (!changed) return s;
    accepted = true;
    return {project: {...s.project, tracks}, ...(recordHistory ? {history: [...s.history.slice(-MAX_HISTORY + 1), s.project], future: []} : {})};
   });
   return accepted;
  },
  // A track transfer is one undoable action; rejected transfers create no snapshot.
  moveClipToTrack: (clipId, trackId, recordHistory = true) => {
    const clip = findClip(get().project, clipId);
    if (!clip || clip.locked || !get().project.tracks.some(t => t.id === trackId) || findTrackOf(get().project, clipId)?.id === trackId) return;
    if (recordHistory) get().commit();
    set((s) => ({
      project: {
        ...s.project,
        tracks: s.project.tracks.map((t) => {
          const without = t.clips.filter((c) => c.id !== clipId);
          return t.id === trackId ? { ...t, clips: [...without, clip] } : { ...t, clips: without };
        }),
      },
    }));
  },

  addEffect: (clipId, type) => {
    if (!editableClip(get().project, clipId) || !Object.hasOwn(EFFECTS, type)) return;
    get().commit();
    set((s) => ({
      project: mapClips(s.project, clipId, (c) => ({
        ...c,
        effects: [...c.effects, { id: uid('e'), type, params: { ...EFFECTS[type].defaults } }],
      })),
    }));
  },
  removeEffect: (clipId, effectId) => {
    if (!editableClip(get().project, clipId)?.effects.some(e => e.id === effectId)) return;
    get().commit();
    set((s) => ({
      project: mapClips(s.project, clipId, (c) => ({
        ...c,
        effects: c.effects.filter((e) => e.id !== effectId),
      })),
    }));
  },
  updateEffectParams: (clipId, effectId, patch, recordHistory = false) => {
   let changed = false;
   set((s) => {
    const clip = editableClip(s.project, clipId);
    const effect = clip?.effects.find(e => e.id === effectId);
    if (!effect) return s;
    const updated = { ...effect, params: { ...effect.params, ...patch } };
    const issue = validateEffect(updated);
    if (issue) return { notice: `Clip "${clipId}" effect "${effectId}" ${issue.path}: ${issue.message}` };
    if (JSON.stringify(updated.params) === JSON.stringify(effect.params)) return s;
    changed = true;
    return { project: mapClips(s.project, clipId, c => ({ ...c, effects: c.effects.map(e => e.id === effectId ? updated : e) })), ...(recordHistory ? {history: [...s.history.slice(-MAX_HISTORY + 1), s.project], future: []} : {}) };
   });
   return changed;
  },

  startDrawingPath: (clipId, effectId) => {
    if (!editableClip(get().project, clipId)?.effects.some(e => e.id === effectId)) return;
    set({ drawingPath: { clipId, effectId, points: [] }, selectedClipIds: [clipId] });
  },
  startDrawingTrail: (clipId) => {
    if (!editableClip(get().project, clipId)) return;
    set({ drawingPath: { clipId, points: [] }, selectedClipIds: [clipId] });
  },
  addDrawingPoint: (pt) =>
    set((s) => (s.drawingPath ? { drawingPath: { ...s.drawingPath, points: [...s.drawingPath.points, pt] } } : s)),
  cancelDrawingPath: () => set({ drawingPath: null }),
  finishDrawingPath: () => {
    const s = get();
    const d = s.drawingPath;
    if (!d) return;
    const clip = editableClip(s.project, d.clipId);
    if (!clip) { set({drawingPath: null}); return; }
    if (d.points.length < 2 || d.points.some(p => !Number.isFinite(p.x) || !Number.isFinite(p.y)) ||
        (d.effectId !== undefined && !clip.effects.some(e => e.id === d.effectId))) {
      set({ drawingPath: null });
      return;
    }
    const [first, ...rest] = d.points;
    const rel = rest.map((pt) => ({ x: Math.round(pt.x - first.x), y: Math.round(pt.y - first.y) }));
    if (rel.some(p => !Number.isFinite(p.x) || !Number.isFinite(p.y))) {
      set({drawingPath: null, notice: 'Path coordinates are out of range'});
      return;
    }
    const project = mapClips(s.project, d.clipId, (c) => ({
        ...c,
        // move the element to the first drawn point so the route starts where you clicked
        props: {
          ...c.props,
          ...(typeof c.props.x === 'number' ? { x: Math.round(first.x), y: Math.round(first.y) } : {}),
          ...(d.effectId === undefined
            ? {
                data: (() => {
                  // keep labels/colors from the existing JSON by index, replace positions
                  let old: any[] = [];
                  try {
                    const parsed = JSON.parse(String(c.props.data));
                    if (Array.isArray(parsed)) old = parsed;
                  } catch {
                    /* stale JSON — start fresh */
                  }
                  const pts = [{ x: 0, y: 0 }, ...rel];
                  return JSON.stringify(
                    pts.map((pt, i) => ({
                      x: pt.x,
                      y: pt.y,
                      ...(old[i]?.label !== undefined ? { label: old[i].label } : {}),
                      ...(old[i]?.color !== undefined ? { color: old[i].color } : {}),
                    })),
                  );
                })(),
              }
            : {}),
        },
        effects:
          d.effectId === undefined
            ? c.effects
            : c.effects.map((e) =>
                e.id === d.effectId
                  ? { ...e, params: { ...e.params, path: `M 0 0 ` + rel.map((pt) => `L ${pt.x} ${pt.y}`).join(' ') } }
                  : e,
              ),
      }));
    const updated = findClip(project, d.clipId)!;
    const definition = getComponent(updated.element);
    const props = definition ? normalizeComponentProps(definition, updated.props) : undefined;
    const effect = d.effectId === undefined ? undefined : updated.effects.find(e => e.id === d.effectId);
    const issue = effect && validateEffect(effect);
    if ((props && !props.ok) || issue) {
      const detail = issue ?? (props && !props.ok ? props.issues[0] : undefined);
      set({drawingPath: null, notice: `Clip "${d.clipId}" ${detail?.path}: ${detail?.message}`});
      return;
    }
    if (JSON.stringify(updated) === JSON.stringify(clip)) { set({drawingPath: null}); return; }
    get().commit();
    set({ project, drawingPath: null });
  },

  /* ---------------------------------------------------------------- */
  /* the swing path session                                            */
  /* ---------------------------------------------------------------- */

  startSwingPath: (clipId) => {
    const s = get();
    const clip = findClip(s.project, clipId);
    if (!clip || clip.locked || clip.element !== 'candlestickChart') return;
    set({ swingPath: { clipId } });

    // A chart that already draws an authored path is opened as it is.
    const series = chartSeries(s.project, clip);
    if (series?.origin === 'authored-path') return;

    // Otherwise the chart gets a new authored-path series and points at it.
    // The series it had stays in the registry: it is the creator's data and
    // removing it would destroy something they may still want.
    get().commit();
    set((state) => {
      const seriesId = uid('series');
      // The path starts as a flat market the creator reshapes: a drawing tool
      // needs a canvas with a scale to aim at, and an empty path has neither a
      // bar grid nor a price range.
      const legacyBars = Array.isArray(clip.props.bars) ? (clip.props.bars as { o: number }[]) : [];
      const barCount = Math.max(2, legacyBars.length);
      const startPrice = legacyBars[0]?.o ?? 100;
      const authored: SeriesSpec = {
        id: seriesId,
        origin: 'authored-path',
        label: 'Authored path',
        timeBasis: 'logical',
        // The seed is created once and never re-seeded: an edit changes the
        // path, not the seed.
        seed: `${seriesId}-seed`,
        algorithmVersion: 1,
        path: {
          anchors: [
            { id: uid('anchor'), barIndex: 0, price: startPrice },
            { id: uid('anchor'), barIndex: barCount - 1, price: startPrice },
          ],
        },
      };
      return {
        project: {
          ...state.project,
          series: [...(state.project.series ?? []), authored],
          tracks: state.project.tracks.map((t) => ({
            ...t,
            clips: t.clips.map((c) =>
              c.id === clipId
                ? {
                    ...c,
                    props: {
                      ...c.props,
                      seriesId,
                      panes: [
                        {
                          id: `${c.id}-pane-0`,
                          seriesId,
                          aggregation: { factor: 1 },
                          rect: { x: 0, y: 0, width: 1, height: 1 },
                          in: 0,
                          out: c.durationInFrames,
                          opacity: 1,
                          clock: { kind: 'reference' },
                          priceRange: { mode: 'auto' },
                        },
                      ],
                      clock: {
                        id: `${c.id}-clock`,
                        unit: 'logical',
                        referenceSeriesId: seriesId,
                        stepBars: 1,
                        framesPerStep:
                          typeof c.props.framesPerBar === 'number' ? c.props.framesPerBar : 15,
                      },
                    },
                  }
                : c,
            ),
          })),
        },
      };
    });
  },

  addSwingAnchor: (clipId, anchor) => {
    const s = get();
    const series = chartSeries(s.project, editableClip(s.project, clipId));
    if (!series || series.origin !== 'authored-path') return;
    s.commit();
    set((state) => ({
      project: withAuthoredPath(state.project, series.id, (path) =>
        addSwingAnchor(path, {
          id: uid('anchor'),
          barIndex: anchor.barIndex,
          price: anchor.price,
          ...(anchor.regime ? { regime: anchor.regime } : {}),
        }),
      ),
    }));
  },

  moveSwingAnchor: (clipId, anchorId, patch) => {
    const s = get();
    const series = chartSeries(s.project, editableClip(s.project, clipId));
    if (!series || series.origin !== 'authored-path') return;
    s.commit();
    set((state) => ({
      project: withAuthoredPath(state.project, series.id, (path) =>
        moveSwingAnchor(path, anchorId, patch),
      ),
    }));
  },

  removeSwingAnchor: (clipId, anchorId) => {
    const s = get();
    const series = chartSeries(s.project, editableClip(s.project, clipId));
    if (!series || series.origin !== 'authored-path') return;
    s.commit();
    set((state) => ({
      project: withAuthoredPath(state.project, series.id, (path) => removeSwingAnchor(path, anchorId)),
    }));
  },

  replaceSwingPath: (clipId, anchors) => {
    const s = get();
    const series = chartSeries(s.project, editableClip(s.project, clipId));
    if (!series || series.origin !== 'authored-path') return;
    s.commit();
    set((state) => ({
      project: withAuthoredPath(state.project, series.id, (path) => ({
        ...path,
        anchors: anchors.map((anchor) => ({ id: uid('anchor'), ...anchor })),
      })),
    }));
  },

  finishSwingPath: () => set({ swingPath: null }),

  /* ---------------------------------------------------------------- */
  /* the drawing tools                                                 */
  /* ---------------------------------------------------------------- */

  setDrawingTool: (kind) => set({ drawingTool: kind }),

  setNotice: (message) => set({ notice: message }),

  ensureChartMarket: (clipId) => {
    const s = get();
    const clip = findClip(s.project, clipId);
    if (!clip || clip.locked || clip.element !== 'candlestickChart') return;
    // A chart that already resolves its panes needs nothing.
    if (
      typeof clip.props.seriesId === 'string' &&
      Array.isArray(clip.props.panes) &&
      clip.props.clock
    ) {
      return;
    }

    get().commit();
    set((state) => ({ project: withChartMarket(state.project, clipId) }));
  },

  addChartGroup: (chartClipIds, layout) => {
    const s = get();
    const charts = chartClipIds
      .map((id) => findClip(s.project, id))
      .filter((clip): clip is Clip => clip !== null && !clip.locked && clip.element === 'candlestickChart');
    if (charts.length === 0) return '';

    const groupId = uid('g');
    get().commit();
    set((state) => {
      // A chart with no market cannot host a pane, so the group gives each
      // of its charts one before they share a clock.
      const withMarkets = charts.reduce(
        (project, clip) => withChartMarket(project, clip.id),
        state.project,
      );
      return { project: buildChartGroup(withMarkets, groupId, charts.map((clip) => clip.id), layout) };
    });
    return groupId;
  },

  setChartGroupLayout: (groupId, layout) => {
    const s = get();
    const group = s.project.chartGroups?.find((group) => group.id === groupId);
    if (!group || group.chartClipIds.some(id => findClip(s.project, id)?.locked)) return;
    get().commit();
    set((state) => ({ project: relayoutChartGroup(state.project, groupId, layout) }));
  },

  addDrawing: (kind, draft) => {
    const s = get();
    const definition = getComponent(kind as ElementType);
    const defaults = definition?.defaults ?? {};

    // The track the drawing lands on.
    //
    // A drawing dropped over a chart lands one step above that chart's
    // track, because `tracks[0]` is the top layer — the drawing draws over
    // the chart it was dropped on rather than under it. A chart already on
    // the topmost track shares that track, and the drawing is appended to it
    // so it still draws above the chart. Without a chart, the drawing lands on
    // the selected clip's track, or the first track.
    const namedIndex = draft.trackId
      ? s.project.tracks.findIndex((t) => t.id === draft.trackId)
      : -1;
    const track =
      namedIndex >= 0
        ? s.project.tracks[Math.max(0, namedIndex - 1)]
        : s.selectedClipIds[0]
          ? findTrackOf(s.project, s.selectedClipIds[0])
          : s.project.tracks[0];
    if (!track) return '';

    // The drawing's own frame range: it starts where the playhead is and
    // runs for three seconds, or to the end of the project, whichever is
    // shorter. It is timed by the timeline, not by a chart.
    const from = draft.from ?? s.currentFrame;
    const durationInFrames =
      draft.durationInFrames ?? Math.max(1, Math.min(90, s.project.durationInFrames - from));

    const { from: _from, durationInFrames: _duration, trackId: _trackId, ...rest } = draft;
    const id = uid('c');
    const clip: Clip = {
      id,
      name: definition?.label ?? kind,
      element: kind as ElementType,
      from,
      durationInFrames,
      props: {
        ...defaults,
        ...defaultDrawingDraft(kind,{x:draft.x??s.project.width/2,y:draft.y??s.project.height/2}),
        ...rest,
      },
      effects: [],
      propsVersion: definition?.propsVersion ?? 1,
    };

    get().commit();
    set((state) => ({
      project: {
        ...state.project,
        tracks: state.project.tracks.map((t) =>
          t.id === track.id ? { ...t, clips: [...t.clips, clip] } : t,
        ),
      },
      selectedClipIds: [id],
    }));
    return id;
  },

  updateDrawing: (clipId, patch) => get().updateClipProps(clipId, patch),

  setClipLocked: (clipId, locked) => {
    const clip = findClip(get().project, clipId);
    if (!clip || Boolean(clip.locked) === locked) return;
    get().commit();
    set((s) => ({
      project: mapClips(s.project, clipId, (c) => ({ ...c, locked })),
    }));
  },

  setClipHidden: (clipId, hidden) => {
    const clip = editableClip(get().project, clipId);
    if (!clip || Boolean(clip.hidden) === hidden) return;
    get().commit();
    set((s) => ({
      project: mapClips(s.project, clipId, (c) => ({ ...c, hidden })),
    }));
  },

  bringToFront: (clipId) => {
    const s = get();
    const clip = findClip(s.project, clipId);
    const top = s.project.tracks[0];
    if (!clip || clip.locked || !top) return;
    get().commit();
    set((state) => ({
      project: {
        ...state.project,
        tracks: state.project.tracks.map((track) => ({
          ...track,
          // The clip leaves every track and joins the top one, where it draws
          // above everything already there.
          clips: track.clips.filter((c) => c.id !== clipId),
        })),
      },
    }));
    set((state) => ({
      project: {
        ...state.project,
        tracks: state.project.tracks.map((track, index) =>
          index === 0 ? { ...track, clips: [...track.clips, clip] } : track,
        ),
      },
    }));
  },

  sendToBack: (clipId) => {
    const s = get();
    const clip = findClip(s.project, clipId);
    const last = s.project.tracks[s.project.tracks.length - 1];
    if (!clip || clip.locked || !last) return;
    get().commit();
    set((state) => ({
      project: {
        ...state.project,
        tracks: state.project.tracks.map((track) => ({
          ...track,
          clips: track.clips.filter((c) => c.id !== clipId),
        })),
      },
    }));
    set((state) => ({
      project: {
        ...state.project,
        tracks: state.project.tracks.map((track, index, all) =>
          index === all.length - 1 ? { ...track, clips: [clip, ...track.clips] } : track,
        ),
      },
    }));
  },

  requestRename: (clipId) => {
    const s = get();
    if (!findClip(s.project, clipId)) return;
    s.selectClip(clipId);
    set({ renameClipId: clipId });
  },

  clearRenameRequest: () => set({ renameClipId: null }),

  addTransition: (trackId, fromClipId, toClipId, element) => {
    const s = get();
    const track = s.project.tracks.find((t) => t.id === trackId);
    if (!track) return;
    const from = track.clips.find((c) => c.id === fromClipId);
    const to = track.clips.find((c) => c.id === toClipId);
    if (!from || !to) return;
    // A transition lives on a boundary between two clips that actually meet.
    if (to.from !== from.from + from.durationInFrames) return;

    get().commit();
    set((state) => ({
      project: {
        ...state.project,
        tracks: state.project.tracks.map((t) =>
          t.id === trackId
            ? {
                ...t,
                transitions: [
                  ...(t.transitions ?? []),
                  {
                    id: uid('tr'),
                    fromClipId,
                    toClipId,
                    element,
                    durationInFrames: clampTransitionDuration(from, to, DEFAULT_TRANSITION_FRAMES),
                  },
                ],
              }
            : t,
        ),
      },
    }));
  },

  updateTransition: (trackId, transitionId, patch) => {
    get().commit();
    set((state) => ({
      project: {
        ...state.project,
        tracks: state.project.tracks.map((t) =>
          t.id === trackId
            ? {
                ...t,
                transitions: (t.transitions ?? []).map((transition) =>
                  transition.id === transitionId ? { ...transition, ...patch } : transition,
                ),
              }
            : t,
        ),
      },
    }));
  },

  setDurationMode: (mode) => {
    get().commit();
    set((s) => ({
      project: { ...s.project, durationMode: mode },
    }));
  },

  togglePaneHold: (clipId, paneId, barId) => {
    const s = get();
    const clip = findClip(s.project, clipId);
    if (!clip || clip.locked) return;
    // The hold's frames are relative to the chart clip's own start.
    const localFrame = Math.max(0, s.currentFrame - clip.from);

    get().commit();
    set((state) => ({
      project: mapClips(state.project, clipId, (c) => {
        const panes = c.props.panes;
        if (!Array.isArray(panes)) return c;
        return {
          ...c,
          props: {
            ...c.props,
            panes: panes.map((pane: any) => {
              if (pane.id !== paneId) return pane;
              const holds = (pane.holds ?? []) as Array<{ barId: string; in: number; out: number }>;
              const held = holds.some((hold) => hold.barId === barId);
              return {
                ...pane,
                holds: held
                  ? holds.filter((hold) => hold.barId !== barId)
                  : [...holds, { barId, in: localFrame, out: c.durationInFrames }],
              };
            }),
          },
        };
      }),
    }));
  },

  setFixedDuration: (seconds) => {
    const s = get();
    const frames = Math.max(1, Math.round(seconds * s.project.fps));
    get().commit();
    set((state) => ({
      project: { ...state.project, durationInFrames: frames },
    }));
  },

  removeTransition: (trackId, transitionId) => {
    get().commit();
    set((state) => ({
      project: {
        ...state.project,
        tracks: state.project.tracks.map((t) =>
          t.id === trackId
            ? {
                ...t,
                transitions: (t.transitions ?? []).filter((transition) => transition.id !== transitionId),
              }
            : t,
        ),
      },
    }));
  },

  /* ---------------------------------------------------------------- */
  /* the pause points and the camera zoom track                        */
  /* ---------------------------------------------------------------- */

  addHold: (clipId, paneId, barId, inFrame, outFrame) => {
    if (!editableClip(get().project, clipId)) return;
    get().commit();
    set((s) => ({
      project: withPane(s.project, clipId, paneId, (pane) => {
        // A pane holds each candle once: the candle is the hold's identity.
        const holds = (pane.holds ?? []).filter((hold) => hold.barId !== barId);
        return { ...pane, holds: [...holds, { barId, in: inFrame, out: outFrame }] };
      }),
    }));
  },

  updateHold: (clipId, paneId, holdId, patch) => {
    if (!editableClip(get().project, clipId)) return;
    get().commit();
    set((s) => ({
      project: withPane(s.project, clipId, paneId, (pane) => ({
        ...pane,
        holds: (pane.holds ?? []).map((hold) =>
          hold.barId === holdId ? { ...hold, ...patch } : hold,
        ),
      })),
    }));
  },

  removeHold: (clipId, paneId, holdId) => {
    if (!editableClip(get().project, clipId)) return;
    get().commit();
    set((s) => ({
      project: withPane(s.project, clipId, paneId, (pane) => ({
        ...pane,
        holds: (pane.holds ?? []).filter((hold) => hold.barId !== holdId),
      })),
    }));
  },

  updateZoomTrack: (clipId, paneId, track) => {
    if (!editableClip(get().project, clipId)) return;
    get().commit();
    set((s) => ({
      project: withPane(s.project, clipId, paneId, (pane) => ({ ...pane, zoom: track })),
    }));
  },

  copySelection: () => {
    const s = get();
    const entries: ClipboardEntry[] = [];
    for (const id of s.selectedClipIds) {
      const clip = findClip(s.project, id);
      const track = findTrackOf(s.project, id);
      if (clip && track) {
        entries.push({ trackId: track.id, clip: { ...clip, props: copyClipProps(clip.props) } });
      }
    }
    if (entries.length > 0) set({ clipboard: entries });
  },
  paste: (atFrame) => {
    const s = get();
    if (s.clipboard.length === 0) return;
    get().commit();
    const minFrom = Math.min(...s.clipboard.map((e) => e.clip.from));
    const total = s.project.durationInFrames;
    const newIds: string[] = [];
    let tracks = s.project.tracks;
    for (const entry of s.clipboard) {
      const fresh = cloneClip(entry.clip);
      fresh.from = Math.max(0, Math.min(atFrame + (entry.clip.from - minFrom), total - 2));
      fresh.durationInFrames = Math.max(2, Math.min(fresh.durationInFrames, total - fresh.from));
      newIds.push(fresh.id);
      const targetId = tracks.some((t) => t.id === entry.trackId) ? entry.trackId : tracks[0]?.id;
      if (!targetId) return;
      tracks = tracks.map((t) => (t.id === targetId ? { ...t, clips: [...t.clips, fresh] } : t));
    }
    set({ project: { ...s.project, tracks }, selectedClipIds: newIds });
  },
  duplicateSelection: () => {
    const s = get();
    if (s.selectedClipIds.length === 0) return;
    get().commit();
    const newIds: string[] = [];
    let tracks = s.project.tracks;
    for (const id of s.selectedClipIds) {
      const clip = findClip(s.project, id);
      const track = findTrackOf(s.project, id);
      if (!clip || !track) continue;
      const fresh = cloneClip(clip);
      fresh.from = Math.min(clip.from + clip.durationInFrames, s.project.durationInFrames - 2);
      newIds.push(fresh.id);
      tracks = tracks.map((t) => (t.id === track.id ? { ...t, clips: [...t.clips, fresh] } : t));
    }
    set({ project: { ...s.project, tracks }, selectedClipIds: newIds });
  },
}));
