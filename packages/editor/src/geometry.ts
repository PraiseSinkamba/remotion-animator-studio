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
import {evaluateElementPose, type ElementPose} from '@chart-studio/components';
import { componentBounds, resolveEditModel, getComponent, type Clip, type ElementHandle, type Project } from '@chart-studio/core';

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
  origin?: Point;
  rotation?: number;
  pose?: ElementPose;
  context?: {project:Project;sceneFrame:number;measured?:Box|null};
}

/** Tolerance for a line's body, in screen pixels. */
export const LINE_TOLERANCE_PX = 6;
/** Tolerance for a point element, in screen pixels. */
export const POINT_TOLERANCE_PX = 8;
/** The smallest size a drag may leave an element at, in composition pixels. */
export const MIN_SIZE = 1;

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
  const props = { ...(definition?.defaults ?? {}), ...(clip.props ?? {}) };
  const defaults = definition?.defaults.points;
  const authored = props.points;
  if (defaults && typeof defaults === 'object' && !Array.isArray(defaults) && authored && typeof authored === 'object' && !Array.isArray(authored)) {
    props.points = {...defaults, ...authored};
  }
  return props;
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
    points[key] = { ...point, x, y };
  }
  return points;
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
const authoredRegion = (
  clip: Clip,
  project: Project,
  measured?: Box | null,
): Region | null => {
  const definition = getComponent(clip.element);
  const edit = definition ? resolveEditModel(definition) : undefined;
  if (!definition || !edit) return null;

  const props = mergedProps(clip);
  const anchor: Point = { x: num(props.x) ?? 0, y: num(props.y) ?? 0 };
  const pointsAreAbsolute = edit.coordinates === 'absolute';
  const declared = definition.geometry?.(props, edit.contentSized && measured ? measured : undefined);
  const bounds = (definition.bounds ?? componentBounds)(props);
  const frame = declared ? declared.box : (edit.pick === 'point' ? null : centredBox({x:bounds.x,y:bounds.y}, bounds.width,bounds.height));
  if (declared) {
    anchor.x = declared.anchor.x; anchor.y = declared.anchor.y;
  }

  const points: Record<string, Point> = {...declared?.points};
  for (const handle of edit.handles) {
    if (handle.effect !== 'point' && handle.effect !== 'level') continue;
    const raw = rawPoints(props)[handle.id];
    if (!raw) continue;
    points[handle.id] = resolvePoint(raw, frame, pointsAreAbsolute);
  }

  if (edit.pick === 'point') {
    return { pick: 'point', box: null, frame, anchor, points, pointsAreAbsolute, origin: declared?.origin ?? anchor, rotation: declared?.rotation };
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
      origin: declared?.origin ?? anchor,
      rotation: declared?.rotation,
    };
  }
  return { pick: 'box', box: frame, frame, anchor, points, pointsAreAbsolute, origin: declared?.origin ?? anchor, rotation: declared?.rotation };
};

/** Optional scene frame opts existing callers into the displayed pose. */
export const elementRegion = (clip:Clip,project:Project,measured?:Box|null,sceneFrame?:number):Region|null => {
  const region=authoredRegion(clip,project,measured);
  if (!region || sceneFrame===undefined) return region;
  const pose=evaluateElementPose(clip,sceneFrame,project.fps,{anchor:region.anchor,box:region.frame,origin:region.origin??region.anchor,rotation:region.rotation,points:region.points});
  return {...region,pose,context:{project,sceneFrame,measured}};
};

export const projectedCorners = (region:Region):Point[] => {
  if (!region.box || region.pose?.invertible===false) return [];
  const corners = ['nw', 'ne', 'se', 'sw'].map(id => cornerOf(region.box!, id)!);
  return region.pose ? region.pose.projectVisible(corners, true) : corners;
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
  if (region.pose) {
    if (!region.pose.invertible) return false;
    if (pick==='box') {
      const authored=region.pose.toAuthored(point);
      return authored ? hitsElement(pick,{...region,pose:undefined},authored,tolerancePx,scale):false;
    }
    const tolerance = tolerancePx / (scale > 0 ? scale : 1);
    if (pick === 'segment') {
      const ends = region.pose.projectVisible(Object.values(region.points), false);
      return ends.length === 2 && distanceToSegment(point, ends[0], ends[1]) <= tolerance;
    }
    const anchor = region.pose.toComposition(region.anchor);
    return anchor !== null && distance(point, anchor) <= tolerance;
  }
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
  if (region.pose) {
    if (!region.pose.invertible) return null;
    const local=handleAt({...region,pose:undefined},handle,_clip);
    return local?region.pose.toComposition(local):null;
  }
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
  clip: Clip,
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

  const definition = getComponent(clip.element);
  const resize = definition?.edit?.resize;
  const uniform = (typeof resize === 'function' ? resize(props) : resize) === 'uniform';
  const patch: Record<string, unknown> = {};
  for (const name of handle.props ?? []) {
    const value = num(props[name]);
    if (value === undefined) continue;
    patch[name] = round(Math.max(MIN_SIZE, uniform ? value * k : name === 'width' ? width : name === 'height' ? height : value * k));
  }
  if (!Object.keys(patch).length) return null;
  const next = definition?.geometry?.({...props,...patch});
  const nextBounds = definition ? (definition.bounds ?? componentBounds)({...props,...patch}) : null;
  const actual = next?.box ?? (nextBounds ? centredBox({x:nextBounds.x,y:nextBounds.y},nextBounds.width,nextBounds.height) : box);
  patch.x = round(fixed.x + signX * actual.width / 2);
  patch.y = round(fixed.y + signY * actual.height / 2);
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
  const target = { x: pointer.x, y: pointer.y };
  return {
    points: { ...raw, [handle.id]: {...raw[handle.id], ...toStoredPoint(target, region.frame, region.pointsAreAbsolute)} },
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
      moved[key] = { ...value, x: round(value.x + dx), y: round(value.y + dy) };
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
  if (region.pose) {
    if (!region.pose.invertible) return null;
    if (handle.effect==='move') return moveElement(clip,region,{x:pointer.x-start.x,y:pointer.y-start.y});
    const local=region.pose.toAuthored(pointer),localStart=region.pose.toAuthored(start);
    if (!local || !localStart) return null;
    // Wrapping stays centered in the renderer; an east/west grip changes
    // both half-widths, unlike a fixed-opposite-corner scale grip.
    if (handle.effect==='wrap' && region.box && handle.props?.[0]) {
      const sign=handle.id==='w'?-1:1;
      return {[handle.props[0]]:round(Math.max(MIN_SIZE,2*sign*(local.x-region.anchor.x)))};
    }
    const patch=dragEffect(clip,handle,{...region,pose:undefined},local,localStart);
    if (patch && handle.effect==='scale' && region.context) return fitProjectedResize(clip,handle,region,pointer,patch);
    return patch;
  }
  const props = mergedProps(clip);
  switch (handle.effect) {
    case 'scale':
      return scaleDrag(props, handle, region, pointer, clip);
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
  if (region.pose) {
    if (!region.pose.invertible) return null;
    // Anchored wrappers translate their origin too. Their screen delta is
    // therefore the authored anchor delta, independent of scale/rotation.
    if (region.pointsAreAbsolute && !region.frame) {
      const points={...rawPoints(mergedProps(clip))};
      for (const [id,point] of Object.entries(region.points)) {
        const displayed=region.pose.toComposition(point);
        const authored=displayed&&region.pose.toAuthored({x:displayed.x+delta.x,y:displayed.y+delta.y});
        if (!authored) return null;
        points[id]={...points[id],x:round(authored.x),y:round(authored.y)};
      }
      return {points};
    }
    return moveElement(clip,{...region,pose:undefined},delta);
  }
  const definition = getComponent(clip.element);
  if (!definition || (definition.renderMode !== undefined && definition.renderMode !== 'content')) return null;
  const edit = definition.edit ?? {pick: 'box'};
  const props = mergedProps(clip);
  const patch: Record<string, unknown> = {};

  const moved = Object.entries(region.points);
  if (moved.length > 0 && region.pointsAreAbsolute) {
    const points = { ...rawPoints(props) };
    for (const [key, point] of moved) {
      points[key] = {...points[key], ...toStoredPoint(
        { x: point.x + delta.x, y: point.y + delta.y },
        region.frame,
        region.pointsAreAbsolute,
      )};
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

/** Canvas lifetime is half-open; hidden and locked clips cannot be manipulated. */
export const isClipActive = (clip: Clip, sceneFrame: number): boolean =>
  !clip.hidden && !clip.locked && sceneFrame >= clip.from && sceneFrame < clip.from + clip.durationInFrames;

/** Solve displayed corner constraints while re-evaluating the moving pivot.
 * The two dimension variables use Newton steps; uniform controls use a
 * least-squares step along their declared one-dimensional resize capability.
 */
function fitProjectedResize(
  clip: Clip,
  handle: ElementHandle,
  region: Region,
  target: Point,
  initial: Record<string, unknown>,
): Record<string, unknown> | null {
  const context = region.context!;
  const fixedHandle = {...handle, id: OPPOSITE[handle.id]};
  const fixed = handleAt(region, fixedHandle);
  if (!fixed) return null;
  const props = mergedProps(clip);
  const resize = getComponent(clip.element)?.edit?.resize;
  const uniform = (typeof resize === 'function' ? resize(props) : resize) === 'uniform';
  const names = (handle.props ?? []).filter(name => typeof initial[name] === 'number');
  if (!names.length) return initial;
  const variables = uniform ? ['ratio'] : names;
  const values = uniform
    ? [Number(initial[names[0]]) / Number(props[names[0]])]
    : names.map(name => Number(initial[name]));

  const sample = (dimensions: number[]) => {
    const patch = {...initial};
    names.forEach((name, i) => {
      patch[name] = Math.max(MIN_SIZE, uniform ? Number(props[name]) * dimensions[0] : dimensions[i]);
    });
    const evaluated = () => elementRegion(
      {...clip, props: {...clip.props, ...patch}},
      context.project, context.measured, context.sceneFrame,
    );
    let next = evaluated();
    let at = next && handleAt(next, fixedHandle);
    if (!at) return null;
    // Translation also moves the pivot, so this correction is in displayed
    // pixels, not inverse-mapped pixels. Re-evaluate before measuring error.
    patch.x = Number(patch.x ?? props.x ?? 0) + fixed.x - at.x;
    patch.y = Number(patch.y ?? props.y ?? 0) + fixed.y - at.y;
    next = evaluated();
    at = next && handleAt(next, handle);
    return at ? {patch, error: [at.x - target.x, at.y - target.y]} : null;
  };

  for (let iteration = 0; iteration < 16; iteration++) {
    const current = sample(values);
    if (!current) return null;
    if (Math.hypot(...current.error) < 0.00001) return finish(current.patch);
    const columns = variables.map((_, i) => {
      const candidate = [...values];
      const step = Math.max(0.001, Math.abs(candidate[i]) * 0.00001);
      candidate[i] += step;
      const next = sample(candidate);
      return next ? next.error.map((error, j) => (error - current.error[j]) / step) : [0, 0];
    });
    if (columns.length === 1) {
      const [a, b] = columns[0];
      const norm = a*a + b*b;
      if (norm < 1e-12) break;
      values[0] -= (a * current.error[0] + b * current.error[1]) / norm;
    } else {
      const [a, c] = columns[0], [b, d] = columns[1];
      const determinant = a*d - b*c;
      if (Math.abs(determinant) < 1e-12) break;
      values[0] -= (d * current.error[0] - b * current.error[1]) / determinant;
      values[1] -= (-c * current.error[0] + a * current.error[1]) / determinant;
    }
  }
  const final = sample(values);
  return final ? finish(final.patch) : null;
}

/** Keep numerical fitting at the same authoring precision as other edits. */
function finish(patch: Record<string, unknown>): Record<string, unknown> | null {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(patch)) {
    if (typeof value === 'number') {
      if (!Number.isFinite(value)) return null;
      result[key] = round(value);
    } else result[key] = value;
  }
  return result;
}
