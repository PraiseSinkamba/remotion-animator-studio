/**
 * Geometry helpers for picking elements off the canvas.
 *
 * Pure functions only: they know the project's clip layout and the registry's
 * component boxes, never the DOM. The pointer conversion stays in
 * `PreviewPanel`, which owns the stage rect.
 */
import { componentBounds, getComponent } from '@chart-studio/components';
import {
  elementRegion,
  isClipActive,
  hitsElement,
  LINE_TOLERANCE_PX,
  POINT_TOLERANCE_PX,
  type Box,
  type PickKind,
  type Region,
} from '@chart-studio/editor';
import type { Clip, Project } from '@chart-studio/core';

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
  /** The element's geometry, from what it declares. */
  region: Region;
  /** How the element is picked: by its box, by its stroke or by its point. */
  pick: PickKind;
}

/** Every clip that can be picked, topmost first. */
export const pickableClips = (
  project: Project,
  measured?: Map<string, Box>,
  sceneFrame?: number,
): PickableClip[] => {
  const out: PickableClip[] = [];
  for (const clip of clipsTopDown(project)) {
    // A hidden clip is not there to be picked, and a locked one is not to be
    // moved: the timeline still shows both.
    if (clip.hidden || clip.locked || (sceneFrame !== undefined && !isClipActive(clip, sceneFrame))) continue;
    // The region comes from what the element declares, so a line is picked by
    // its stroke and a point by its point — not by a rectangle around them.
    const region = elementRegion(clip, project, measured?.get(clip.id) ?? null);
    if (!region) continue;
    const box = region.box
      ? { left: region.box.left, top: region.box.top, width: region.box.width, height: region.box.height }
      : { left: region.anchor.x, top: region.anchor.y, width: 0, height: 0 };
    out.push({ clip, box, region, pick: region.pick });
  }
  return out;
};

/**
 * The topmost clip whose **shape** contains the point, or null.
 *
 * A box element is picked anywhere inside it. A line is picked near its
 * stroke, within a tolerance in screen pixels, so it does not swallow the
 * elements underneath it. A point is picked near the point.
 *
 * `scale` is the canvas scale — screen pixels per composition pixel — so the
 * tolerance feels the same at every zoom.
 */
export const hitTest = (
  picks: PickableClip[],
  x: number,
  y: number,
  scale = 1,
): Clip | null => {
  for (const { clip, region, pick } of picks) {
    const tolerance = pick === 'segment' ? LINE_TOLERANCE_PX : pick === 'point' ? POINT_TOLERANCE_PX : 0;
    if (hitsElement(pick, region, { x, y }, tolerance, scale)) return clip;
  }
  return null;
};
