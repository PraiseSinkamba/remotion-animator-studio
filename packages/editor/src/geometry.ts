/**
 * The pure geometry of the element edit model.
 *
 * Every function here is a pure function of the project, the clip and the
 * pointer — no DOM, no React, no editor state. The shell owns the pointer
 * and the overlay; this module owns the maths.
 *
 * Coordinates are composition pixels. The pick tolerances are screen pixels
 * (the product rule), so `hitsElement` converts them with the canvas scale
 * (screen pixels per composition pixel) — that is what makes a pick feel the
 * same at every zoom level.
 */
import { getComponent, type Clip, type ElementHandle, type Project } from '@chart-studio/core';

/** A point in composition pixels. */
export interface Point {
  x: number;
  y: number;
}

/** A rectangle in composition pixels. */
export interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** How an element is picked. Mirrors `ElementPickKind` in the contract. */
export type PickKind = 'box' | 'segment' | 'point';

/**
 * An element's geometry, in composition pixels.
 *
 * `box` is the pick region: the element's own box for a box element, the
 * bounding box of its two endpoints for a segment, `null` for a point.
 * `frame` is the element's own box — the frame its fractional points live in.
 */
export interface Region {
  pick: PickKind;
  /** The pick region. */
  box: Box | null;
  /** The element's own box, or `null` when it has none. */
  frame: Box | null;
  /** The element's anchor — where the compositor centres its content. */
  anchor: Point;
  /** The element's points, in composition pixels, keyed by handle id. */
  points: Record<string, Point>;
  /** True when the props store their points as absolute composition pixels. */
  pointsAreAbsolute: boolean;
}

/** Tolerance for a line's body, in screen pixels. */
export const LINE_TOLERANCE_PX = 6;
/** Tolerance for a line's endpoints, in screen pixels. */
export const ENDPOINT_TOLERANCE_PX = 10;
/** Tolerance for a point element, in screen pixels. */
export const POINT_TOLERANCE_PX = 8;
/**
 * Props version at which the drawing kinds store their points as absolute
 * composition pixels. Below it a point is a fraction of the element's frame.
 */
export const ABSOLUTE_POINTS_PROPS_VERSION = 3;

/** The smallest size a drag may leave an element at, in composition pixels. */
export const MIN_SIZE = 1;

const CORNERS = ['nw', 'ne', 'se', 'sw'] as const;
const SIDES = ['n', 'e', 's', 'w'] as const;

const OPPOSITE: Record<string, string> = { nw: 'se', ne: 'sw', se: 'nw', sw: 'ne' };

const num = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined;

const round = (value: number): number => Math.round(value * 10000) / 10000;

const distance = (a: Point, b: Point): number => Math.hypot(a.x - b.x, a.y - b.y);

const centredBox = (anchor: Point, width: number, height: number): Box => ({
  left: anchor.x - width / 2,
  top: anchor.y - height / 2,
  width,
  height,
});

/** The element's props: the definition's defaults under the clip's own props. */
const mergedProps = (clip: Clip): Record<string, unknown> => {
  const definition = getComponent(clip.element);
  return { ...(definition?.defaults ?? {}), ...(clip.props ?? {}) };
};

/** The element's points, read by name — never by shape. */
const rawPoints = (props: Record<string, unknown>): Record<string, Point> => {
  const value = props.points;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const points: Record<string, Point> = {};
  for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
    if (!entry || typeof entry !== 'object') continue;
    const point = entry as Record<string, unknown>;
    const x = num(point.x);
    const y = num(point.y);
    if (x === undefined || y === undefined) continue;
    points[key] = { x, y };
  }
  return points;
};

/** The size of the element, from the props its scale handle writes. */
const spanFromHandle = (
  props: Record<string, unknown>,
  handle: ElementHandle,
): { width: number; height: number } | null => {
  const names = handle.props ?? [];
  if (names.includes('width') || names.includes('height')) {
    const width = num(props.width);
    const height = num(props.height);
    if (width !== undefined && height !== undefined) return { width, height };
  }
  if (names.includes('size')) {
    const size = num(props.size);
    if (size !== undefined) return { width: size, height: size };
  }
  if (names.includes('gridSize') || names.includes('tileSize')) {
    const tile = num(props.tileSize);
    if (tile !== undefined) {
      const side = (num(props.gridSize) ?? 1) * tile;
      return { width: side, height: side };
    }
  }
  return null;
};

/** The waypoints of a path-like element, when its props carry them. */
const parseWaypoints = (data: unknown): Point[] | null => {
  if (typeof data !== 'string' || data.length === 0) return null;
  try {
    const parsed: unknown = JSON.parse(data);
    if (!Array.isArray(parsed)) return null;
    const points: Point[] = [];
    for (const entry of parsed) {
      if (!entry || typeof entry !== 'object') continue;
      const point = entry as Record<string, unknown>;
      points.push({ x: num(point.x) ?? 0, y: num(point.y) ?? 0 });
    }
    return points.length > 0 ? points : null;
  } catch {
    return null;
  }
};

/** How many characters the element's content holds. */
const textLength = (props: Record<string, unknown>): number => {
  if (typeof props.text === 'string') return Math.max(1, props.text.length);
  if (typeof props.before === 'string' || typeof props.after === 'string' || typeof props.highlight === 'string') {
    const text = [props.before, props.highlight, props.after]
      .filter((part): part is string => typeof part === 'string')
      .join('');
    return Math.max(1, text.length);
  }
  if (typeof props.char === 'string') return 1;
  if (num(props.to) !== undefined) return Math.max(1, String(props.to).length);
  if (typeof props.label === 'string') return Math.max(1, props.label.length);
  return 1;
};

/**
 * The box of an element that has no size of its own — a text element, whose
 * real box is measured from the rendered text. Until the shell measures it,
 * this is the estimate the handles work on.
 */
const estimateBox = (
  props: Record<string, unknown>,
  anchor: Point,
  project: Project,
): Box => {
  const waypoints = parseWaypoints(props.data);
  if (waypoints) {
    const xs = waypoints.map((point) => point.x);
    const ys = waypoints.map((point) => point.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    return {
      left: anchor.x + minX,
      top: anchor.y + minY,
      width: Math.min(project.width, maxX - minX),
      height: Math.min(project.height, maxY - minY),
    };
  }
  const fontSize = num(props.fontSize);
  const size = num(props.size);
  if (fontSize === undefined && size !== undefined) {
    return centredBox(anchor, size, size);
  }
  const em = fontSize ?? size ?? 48;
  return centredBox(
    anchor,
    Math.min(project.width, em * 0.6 * textLength(props)),
    Math.min(project.height, em * 1.25),
  );
};

/** The element's own box — the frame its fractional points live in. */
const frameFor = (
  props: Record<string, unknown>,
  edit: { pick: PickKind; handles: ElementHandle[] },
  anchor: Point,
  project: Project,
  measured?: Box | null,
): Box | null => {
  if (edit.pick === 'point') return null;
  // A measured box is the element's own size, read from the rendered frame:
  // it beats any estimate the props can offer.
  if (measured) return measured;
  const scale = edit.handles.find((handle) => handle.effect === 'scale');
  if (scale) {
    const span = spanFromHandle(props, scale);
    if (span) return centredBox(anchor, span.width, span.height);
  }
  const width = num(props.width);
  const height = num(props.height);
  if (width !== undefined && height !== undefined) return centredBox(anchor, width, height);
  if (edit.pick === 'box') return estimateBox(props, anchor, project);
  return null;
};

/** A point from the props, in composition pixels. */
const resolvePoint = (raw: Point, frame: Box | null, absolute: boolean): Point => {
  if (absolute || !frame) return { x: raw.x, y: raw.y };
  return { x: frame.left + raw.x * frame.width, y: frame.top + raw.y * frame.height };
};

/** A point in composition pixels, back into the props' own convention. */
const toStoredPoint = (point: Point, frame: Box | null, absolute: boolean): Point => {
  if (absolute || !frame || frame.width === 0 || frame.height === 0) {
    return { x: round(point.x), y: round(point.y) };
  }
  return {
    x: round((point.x - frame.left) / frame.width),
    y: round((point.y - frame.top) / frame.height),
  };
};

const boundsOf = (a: Point, b: Point): Box => ({
  left: Math.min(a.x, b.x),
  top: Math.min(a.y, b.y),
  width: Math.abs(a.x - b.x),
  height: Math.abs(a.y - b.y),
});

const cornerOf = (box: Box, id: string): Point | null => {
  switch (id) {
    case 'nw':
      return { x: box.left, y: box.top };
    case 'ne':
      return { x: box.left + box.width, y: box.top };
    case 'se':
      return { x: box.left + box.width, y: box.top + box.height };
    case 'sw':
      return { x: box.left, y: box.top + box.height };
    default:
      return null;
  }
};

const sideOf = (box: Box, id: string): Point | null => {
  switch (id) {
    case 'n':
      return { x: box.left + box.width / 2, y: box.top };
    case 'e':
      return { x: box.left + box.width, y: box.top + box.height / 2 };
    case 's':
      return { x: box.left + box.width / 2, y: box.top + box.height };
    case 'w':
      return { x: box.left, y: box.top + box.height / 2 };
    default:
      return null;
  }
};

const distanceToSegment = (point: Point, a: Point, b: Point): number => {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared === 0) return distance(point, a);
  const t = Math.max(0, Math.min(1, ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSquared));
  return distance(point, { x: a.x + t * dx, y: a.y + t * dy });
};

/**
 * The element's geometry, in composition pixels.
 *
 * `null` when the element declares no edit model — it is not picked on the
 * canvas (audio and background).
 */
export const elementRegion = (
  clip: Clip,
  project: Project,
  measured?: Box | null,
): Region | null => {
  const definition = getComponent(clip.element);
  const edit = definition?.edit;
  if (!definition || !edit) return null;

  const props = mergedProps(clip);
  const anchor: Point = { x: num(props.x) ?? 0, y: num(props.y) ?? 0 };
  const version = clip.propsVersion ?? definition.propsVersion ?? 1;
  const pointsAreAbsolute = version >= ABSOLUTE_POINTS_PROPS_VERSION;
  const frame = frameFor(props, edit, anchor, project, measured);

  const points: Record<string, Point> = {};
  for (const handle of edit.handles) {
    if (handle.effect !== 'point' && handle.effect !== 'level') continue;
    const raw = rawPoints(props)[handle.id];
    if (!raw) continue;
    points[handle.id] = resolvePoint(raw, frame, pointsAreAbsolute);
  }

  if (edit.pick === 'point') {
    return { pick: 'point', box: null, frame, anchor, points, pointsAreAbsolute };
  }
  if (edit.pick === 'segment') {
    const ends = Object.values(points);
    return {
      pick: 'segment',
      box: ends.length === 2 ? boundsOf(ends[0], ends[1]) : null,
      frame,
      anchor,
      points,
      pointsAreAbsolute,
    };
  }
  return { pick: 'box', box: frame, frame, anchor, points, pointsAreAbsolute };
};

/**
 * Does the pointer hit the element?
 *
 * `tolerancePx` is in screen pixels; `scale` is the canvas scale (screen
 * pixels per composition pixel), so the tolerance is converted to
 * composition pixels inside. The same pointer therefore hits the same
 * element at every zoom level.
 */
export const hitsElement = (
  pick: PickKind,
  region: Region,
  point: Point,
  tolerancePx: number,
  scale = 1,
): boolean => {
  const tolerance = tolerancePx / (scale > 0 ? scale : 1);
  if (pick === 'box') {
    const box = region.box;
    if (!box) return false;
    return (
      point.x >= box.left &&
      point.x <= box.left + box.width &&
      point.y >= box.top &&
      point.y <= box.top + box.height
    );
  }
  if (pick === 'point') {
    return distance(point, region.anchor) <= tolerance;
  }
  const ends = Object.values(region.points);
  if (ends.length !== 2) return false;
  return distanceToSegment(point, ends[0], ends[1]) <= tolerance;
};

/**
 * Where the handle sits, in composition pixels.
 *
 * `null` when the handle has no place on this element.
 */
export const handleAt = (region: Region, handle: ElementHandle, _clip?: Clip): Point | null => {
  switch (handle.effect) {
    case 'scale':
    case 'font': {
      if (!region.box) return null;
      return cornerOf(region.box, handle.id);
    }
    case 'wrap': {
      if (!region.box) return null;
      return sideOf(region.box, handle.id);
    }
    case 'point':
    case 'level':
      return region.points[handle.id] ?? null;
    case 'move':
      return region.anchor;
    default:
      return null;
  }
};

const scaleDrag = (
  props: Record<string, unknown>,
  handle: ElementHandle,
  region: Region,
  pointer: Point,
): Record<string, unknown> | null => {
  const box = region.box;
  const oppositeId = OPPOSITE[handle.id];
  if (!box || !oppositeId) return null;
  const fixed = cornerOf(box, oppositeId);
  const dragged = cornerOf(box, handle.id);
  if (!fixed || !dragged) return null;

  const signX = Math.sign(dragged.x - fixed.x) || 1;
  const signY = Math.sign(dragged.y - fixed.y) || 1;
  const width = Math.max(MIN_SIZE, signX * (pointer.x - fixed.x));
  const height = Math.max(MIN_SIZE, signY * (pointer.y - fixed.y));
  const kx = box.width > 0 ? width / box.width : 1;
  const ky = box.height > 0 ? height / box.height : 1;
  const k = (kx + ky) / 2;

  const patch: Record<string, unknown> = {};
  for (const name of handle.props ?? []) {
    if (name === 'width') {
      patch.width = round(width);
    } else if (name === 'height') {
      patch.height = round(height);
    } else if (name === 'size') {
      const size = num(props.size);
      if (size !== undefined) patch.size = Math.max(MIN_SIZE, Math.round(size * k));
    } else if (name === 'tileSize') {
      const tile = num(props.tileSize);
      if (tile !== undefined) patch.tileSize = Math.max(MIN_SIZE, Math.round(tile * Math.sqrt(k)));
    } else if (name === 'gridSize') {
      const grid = num(props.gridSize);
      if (grid !== undefined) patch.gridSize = Math.max(2, Math.round(grid * Math.sqrt(k)));
    }
  }
  if (Object.keys(patch).length === 0) return null;
  patch.x = round(fixed.x + (signX * width) / 2);
  patch.y = round(fixed.y + (signY * height) / 2);
  return patch;
};

const fontDrag = (
  props: Record<string, unknown>,
  handle: ElementHandle,
  region: Region,
  pointer: Point,
  start: Point,
): Record<string, unknown> | null => {
  const name = (handle.props ?? [])[0];
  if (!name) return null;
  const old = num(props[name]);
  if (old === undefined) return null;
  const from = distance(start, region.anchor);
  const to = distance(pointer, region.anchor);
  if (from === 0) return null;
  return { [name]: round(Math.max(MIN_SIZE, old * (to / from))) };
};

const wrapDrag = (
  props: Record<string, unknown>,
  handle: ElementHandle,
  region: Region,
  pointer: Point,
): Record<string, unknown> | null => {
  const name = (handle.props ?? [])[0];
  const box = region.box;
  if (!name || !box) return null;
  let width: number;
  if (handle.id === 'e') {
    width = pointer.x - box.left;
  } else if (handle.id === 'w') {
    width = box.left + box.width - pointer.x;
  } else {
    // A wrap width is horizontal — the top and bottom grips do not change it.
    return null;
  }
  return { [name]: round(Math.max(MIN_SIZE, width)) };
};

const pointDrag = (
  props: Record<string, unknown>,
  handle: ElementHandle,
  region: Region,
  pointer: Point,
): Record<string, unknown> | null => {
  const raw = rawPoints(props);
  const current = region.points[handle.id];
  if (!current || !raw[handle.id]) return null;
  const otherId = Object.keys(region.points).find((id) => id !== handle.id);
  const other = otherId ? region.points[otherId] : undefined;
  // Two ends on one vertical (a high/low line) stay on that vertical.
  const vertical = other !== undefined && Math.abs(other.x - current.x) < 0.01;
  const target = vertical ? { x: current.x, y: pointer.y } : { x: pointer.x, y: pointer.y };
  return {
    points: { ...raw, [handle.id]: toStoredPoint(target, region.frame, region.pointsAreAbsolute) },
  };
};

const levelDrag = (
  props: Record<string, unknown>,
  handle: ElementHandle,
  region: Region,
  pointer: Point,
): Record<string, unknown> | null => {
  const raw = rawPoints(props);
  const current = region.points[handle.id];
  if (!current || !raw[handle.id]) return null;
  // A level is a horizontal line — it moves up and down only.
  const target = { x: current.x, y: pointer.y };
  return {
    points: { ...raw, [handle.id]: toStoredPoint(target, region.frame, region.pointsAreAbsolute) },
  };
};

const moveDrag = (
  props: Record<string, unknown>,
  region: Region,
  pointer: Point,
  start: Point,
): Record<string, unknown> => {
  const dx = pointer.x - start.x;
  const dy = pointer.y - start.y;
  const patch: Record<string, unknown> = {
    x: round(region.anchor.x + dx),
    y: round(region.anchor.y + dy),
  };
  const raw = rawPoints(props);
  if (region.pointsAreAbsolute) {
    const moved: Record<string, Point> = {};
    for (const [key, value] of Object.entries(raw)) {
      moved[key] = { x: round(value.x + dx), y: round(value.y + dy) };
    }
    if (Object.keys(moved).length > 0) patch.points = moved;
  }
  return patch;
};

/**
 * What a drag of the handle writes into the clip's props.
 *
 * `null` when the drag changes nothing.
 */
export const dragEffect = (
  clip: Clip,
  handle: ElementHandle,
  region: Region,
  pointer: Point,
  start: Point,
): Record<string, unknown> | null => {
  const props = mergedProps(clip);
  switch (handle.effect) {
    case 'scale':
      return scaleDrag(props, handle, region, pointer);
    case 'font':
      return fontDrag(props, handle, region, pointer, start);
    case 'wrap':
      return wrapDrag(props, handle, region, pointer);
    case 'point':
      return pointDrag(props, handle, region, pointer);
    case 'level':
      return levelDrag(props, handle, region, pointer);
    case 'move':
      return moveDrag(props, region, pointer, start);
    default:
      return null;
  }
};

/**
 * Moves the whole element by a delta.
 *
 * The element's own points move with it — a line is its points, and a
 * position tool's levels sit inside its box — and a box element moves by its
 * anchor. An element with points and no box does not gain one: it has
 * nothing to move but its points.
 */
export const moveElement = (
  clip: Clip,
  region: Region,
  delta: Point,
): Record<string, unknown> | null => {
  const edit = getComponent(clip.element)?.edit;
  if (!edit) return null;
  const props = mergedProps(clip);
  const patch: Record<string, unknown> = {};

  const moved = Object.entries(region.points);
  if (moved.length > 0) {
    const points = { ...rawPoints(props) };
    for (const [key, point] of moved) {
      points[key] = toStoredPoint(
        { x: point.x + delta.x, y: point.y + delta.y },
        region.frame,
        region.pointsAreAbsolute,
      );
    }
    patch.points = points;
  }

  // A line is its points: it has no anchor to move.
  if (edit.pick !== 'segment' || moved.length === 0) {
    patch.x = round(region.anchor.x + delta.x);
    patch.y = round(region.anchor.y + delta.y);
  }
  return patch;
};
