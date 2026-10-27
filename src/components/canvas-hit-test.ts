/**
 * Geometry helpers for picking elements off the canvas.
 *
 * Pure functions only: they know the project's clip layout and the registry's
 * component boxes, never the DOM. The pointer conversion stays in
 * `PreviewPanel`, which owns the stage rect.
 */
import { componentBounds, getComponent } from '../registry';
import type { Clip, Project } from '../types';

/** A box in project coordinates. */
export interface ClipBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** A clip's anchor — the point its content is centred on — and its box. */
export interface ClipGeometry {
  anchor: { x: number; y: number };
  box: ClipBox;
}

/** Every clip of a project, in track order. */
export const projectClips = (project: Project): Clip[] => project.tracks.flatMap((track) => track.clips);

/**
 * A clip's effective props: the component's defaults with the clip's own
 * props laid over them. Undefined clip props are ignored so a partial patch
 * never erases a default.
 */
export const clipProps = (clip: Clip): Record<string, unknown> | null => {
  const definition = getComponent(clip.element);
  if (!definition) return null;
  const merged: Record<string, unknown> = { ...definition.defaults };
  for (const [key, value] of Object.entries(clip.props)) {
    if (value !== undefined) merged[key] = value;
  }
  return merged;
};

/**
 * Where a clip sits on the canvas.
 *
 * The anchor is the point the compositor centres the content on (`x`/`y`).
 * The box is the component's own bounds — the same rectangle the selection
 * overlay draws — so what you can click is what you can see. Clips without an
 * anchor (audio, background) have none and are never picked.
 */
export const clipGeometry = (clip: Clip): ClipGeometry | null => {
  const props = clipProps(clip);
  if (!props) return null;
  const definition = getComponent(clip.element);
  if (!definition) return null;
  // Audio and background layers are not drawn as a positioned box.
  if (definition.renderMode === 'audio' || definition.renderMode === 'background') return null;
  if (typeof props.x !== 'number' || typeof props.y !== 'number') return null;
  const bounds = definition.bounds ? definition.bounds(props) : componentBounds(props);
  return {
    anchor: { x: props.x, y: props.y },
    // The compositor centres the content on the anchor, so the box spans
    // `anchor ± size / 2` — the same rectangle the selection overlay draws.
    box: {
      left: props.x - bounds.width / 2,
      top: props.y - bounds.height / 2,
      width: bounds.width,
      height: bounds.height,
    },
  };
};

/**
 * The clips of a project in visual order, topmost first.
 *
 * The composition renders the tracks reversed (tracks[0] is the top layer) and
 * each track's clips in order, so the topmost clip is the last clip of the
 * first track.
 */
const clipsTopDown = (project: Project): Clip[] => {
  const out: Clip[] = [];
  for (const track of project.tracks) {
    for (let i = track.clips.length - 1; i >= 0; i--) out.push(track.clips[i]);
  }
  return out;
};

/** A clip with its box, in visual order — the pick list of the canvas. */
export interface PickableClip {
  clip: Clip;
  box: ClipBox;
}

/** Every clip that can be picked, topmost first. */
export const pickableClips = (project: Project): PickableClip[] => {
  const out: PickableClip[] = [];
  for (const clip of clipsTopDown(project)) {
    const geometry = clipGeometry(clip);
    if (geometry) out.push({ clip, box: geometry.box });
  }
  return out;
};

/** The topmost clip whose box contains the point, or null. */
export const hitTest = (picks: PickableClip[], x: number, y: number): Clip | null => {
  for (const { clip, box } of picks) {
    if (x >= box.left && x <= box.left + box.width && y >= box.top && y <= box.top + box.height) {
      return clip;
    }
  }
  return null;
};
