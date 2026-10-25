import { create } from 'zustand';
import { EFFECTS } from './effects';
import { buildComponentProps, getComponent } from './registry';
import { buildPresetClips, PRESETS } from './presets';
import { sampleProject } from './sampleProject';
import type { Clip, EffectType, ElementType, Project, Track } from './types';

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
  updateClip: (clipId: string, patch: Partial<Pick<Clip, 'from' | 'durationInFrames' | 'name'>>) => void;
  /** Move several clips horizontally by the same frame delta (multi-drag). No history push. */
  shiftClips: (moves: Array<{ clipId: string; from: number }>) => void;
  updateClipProps: (clipId: string, patch: Record<string, any>) => void;
  moveClipToTrack: (clipId: string, trackId: string) => void;
  addEffect: (clipId: string, type: EffectType) => void;
  removeEffect: (clipId: string, effectId: string) => void;
  updateEffectParams: (clipId: string, effectId: string, patch: Record<string, any>) => void;

  startDrawingPath: (clipId: string, effectId: string) => void;
  startDrawingTrail: (clipId: string) => void;
  addDrawingPoint: (pt: { x: number; y: number }) => void;
  cancelDrawingPath: () => void;
  /** Commit the drawn polyline: element moves to the first point, path becomes relative. */
  finishDrawingPath: () => void;

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

const findTrackOf = (project: Project, clipId: string): Track | null =>
  project.tracks.find((t) => t.clips.some((c) => c.id === clipId)) ?? null;

const cloneClip = (clip: Clip): Clip => ({
  ...clip,
  id: uid('c'),
  props: { ...clip.props },
  effects: clip.effects.map((e) => ({ ...e, id: uid('e'), params: { ...e.params } })),
});

export const useStore = create<EditorState>((set, get) => ({
  project: sampleProject,
  selectedClipIds: [],
  clipboard: [],
  currentFrame: 0,
  playing: false,
  muted: false,
  drawingPath: null,
  pixelsPerFrame: 4,
  history: [],
  future: [],

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
    const scaleProps = (p: Record<string, any>): Record<string, any> => {
      const q = { ...p };
      const scaleKey = (key: string, f: number) => {
        if (typeof q[key] === 'number') q[key] = Math.round(q[key] * f * 100) / 100;
      };
      scaleKey('x', rx);
      scaleKey('y', ry);
      scaleKey('width', rx);
      scaleKey('height', ry);
      for (const k of ['fontSize', 'size', 'borderRadius', 'letterSpacing', 'amplitude', 'drift']) scaleKey(k, m);
      scaleKey('wavelength', rx);
      return q;
    };
    set((state) => ({
      project: {
        ...state.project,
        width,
        height,
        tracks: state.project.tracks.map((t) => ({
          ...t,
          clips: t.clips.map((c) => ({ ...c, props: scaleProps(c.props) })),
        })),
      },
    }));
  },
  replaceProject: (p) => {
    get().commit();
    set({ project: p, selectedClipIds: [], currentFrame: 0 });
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
      }));
      // one track per clip so nothing hides in a shared lane;
      // buildPresetClips returns bottom→top, and the top layer belongs on the first track
      const newTracks: Track[] = [...clips]
        .reverse()
        .map((clip) => ({ id: uid('t'), name: clip.name, clips: [clip] }));
      return { project: { ...s.project, tracks: [...newTracks, ...s.project.tracks] } };
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
    if (idx < 0 || target < 0 || target >= s.project.tracks.length) return;
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
    if (s.selectedClipIds.length < 2) return;
    get().commit();
    const gid = uid('g');
    const sel = new Set(s.selectedClipIds);
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
    if (s.selectedClipIds.length === 0) return;
    get().commit();
    const sel = new Set(s.selectedClipIds);
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
      };
      return {
        project: {
          ...s.project,
          tracks: s.project.tracks.map((t) => (t.id === trackId ? { ...t, clips: [...t.clips, clip] } : t)),
        },
        selectedClipIds: [clip.id],
      };
    });
  },
  removeClips: (clipIds) => {
    if (clipIds.length === 0) return;
    get().commit();
    const gone = new Set(clipIds);
    set((s) => ({
      project: {
        ...s.project,
        tracks: s.project.tracks.map((t) => ({ ...t, clips: t.clips.filter((c) => !gone.has(c.id)) })),
      },
      selectedClipIds: s.selectedClipIds.filter((id) => !gone.has(id)),
    }));
  },
  updateClip: (clipId, patch) =>
    set((s) => ({ project: mapClips(s.project, clipId, (c) => ({ ...c, ...patch })) })),
  shiftClips: (moves) =>
    set((s) => {
      const byId = new Map(moves.map((m) => [m.clipId, m.from]));
      return {
        project: {
          ...s.project,
          tracks: s.project.tracks.map((t) => ({
            ...t,
            clips: t.clips.map((c) => (byId.has(c.id) ? { ...c, from: byId.get(c.id)! } : c)),
          })),
        },
      };
    }),
  updateClipProps: (clipId, patch) =>
    set((s) => ({
      project: mapClips(s.project, clipId, (c) => ({ ...c, props: { ...c.props, ...patch } })),
    })),
  // no history push — callers commit at gesture start
  moveClipToTrack: (clipId, trackId) => {
    const clip = findClip(get().project, clipId);
    if (!clip) return;
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
    get().commit();
    set((s) => ({
      project: mapClips(s.project, clipId, (c) => ({
        ...c,
        effects: [...c.effects, { id: uid('e'), type, params: { ...EFFECTS[type].defaults } }],
      })),
    }));
  },
  removeEffect: (clipId, effectId) => {
    get().commit();
    set((s) => ({
      project: mapClips(s.project, clipId, (c) => ({
        ...c,
        effects: c.effects.filter((e) => e.id !== effectId),
      })),
    }));
  },
  updateEffectParams: (clipId, effectId, patch) =>
    set((s) => ({
      project: mapClips(s.project, clipId, (c) => ({
        ...c,
        effects: c.effects.map((e) => (e.id === effectId ? { ...e, params: { ...e.params, ...patch } } : e)),
      })),
    })),

  startDrawingPath: (clipId, effectId) =>
    set({ drawingPath: { clipId, effectId, points: [] }, selectedClipIds: [clipId] }),
  startDrawingTrail: (clipId) => set({ drawingPath: { clipId, points: [] }, selectedClipIds: [clipId] }),
  addDrawingPoint: (pt) =>
    set((s) => (s.drawingPath ? { drawingPath: { ...s.drawingPath, points: [...s.drawingPath.points, pt] } } : s)),
  cancelDrawingPath: () => set({ drawingPath: null }),
  finishDrawingPath: () => {
    const s = get();
    const d = s.drawingPath;
    if (!d) return;
    if (d.points.length < 2) {
      set({ drawingPath: null });
      return;
    }
    get().commit();
    const [first, ...rest] = d.points;
    const rel = rest.map((pt) => ({ x: Math.round(pt.x - first.x), y: Math.round(pt.y - first.y) }));
    set((state) => ({
      project: mapClips(state.project, d.clipId, (c) => ({
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
      })),
      drawingPath: null,
    }));
  },

  copySelection: () => {
    const s = get();
    const entries: ClipboardEntry[] = [];
    for (const id of s.selectedClipIds) {
      const clip = findClip(s.project, id);
      const track = findTrackOf(s.project, id);
      if (clip && track) entries.push({ trackId: track.id, clip: { ...clip, props: { ...clip.props } } });
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
