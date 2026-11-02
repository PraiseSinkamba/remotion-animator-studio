/**
 * The eight independent drawing tools, registered from one file.
 *
 * A drawing is an ordinary clip that owns its own shape, its own frame range
 * and its own points. It reads no chart, no pane and no market, so it renders
 * whether or not a chart exists in the project.
 *
 * A drawing's points are absolute: they are places in the composition. A
 * drawing with a box of its own — a rule, a rectangle, a label, the position
 * tool — is centred by the composition on its own `x` / `y`. A drawing with
 * no box — a trend line, an arrow, a high/low line — is placed by its points
 * alone, and its region is derived from them.
 */
import React from 'react';
import {
  componentBounds,
  createPropsValidator,
  validateDrawingProps,
  registerComponent,
  type ComponentBounds,
  type ComponentProps,
  type ComponentRenderContext,
  type DrawingKind,
  type DrawingPoint,
  type DrawingStyle,
  type ElementEditModel,
  type ElementType,
  type VideoComponentDefinition,
} from '@chart-studio/core';
import {
  ArrowAdapter,
  HorizontalLineAdapter,
  PositionAdapter,
  RectangleAdapter,
  TrendlineAdapter,
  VerticalLineAdapter,
  type DrawingAdapterProps,
} from './adapters';
import { DrawingInspector } from '../inspectors/drawing';

/** The band a horizontal rule is drawn in: its thickness, not a stored size. */
const RULE_BAND = 24;
/** The band a vertical rule is drawn in. */
const RULE_THICKNESS = 24;
/** The text box a label is drawn in. */
const LABEL_BOX = { width: 200, height: 40 };

/** The parameters the inspector's POSITION section carries. */
const X_PARAM = { key: 'x', label: 'X', kind: 'number' as const, min: -1000, max: 5000, step: 1 };
const Y_PARAM = { key: 'y', label: 'Y', kind: 'number' as const, min: -1000, max: 4000, step: 1 };
const WIDTH_PARAM = { key: 'width', label: 'Width', kind: 'number' as const, min: 8, max: 1920, step: 1 };
const HEIGHT_PARAM = { key: 'height', label: 'Height', kind: 'number' as const, min: 8, max: 1080, step: 1 };
const OPACITY_PARAM = { key: 'opacity', label: 'Opacity', kind: 'number' as const, min: 0, max: 1, step: 0.05 };

/** The props a new drawing starts with, apart from its own shape. */
const baseDefaults = (shape: ComponentProps): ComponentProps => ({
  opacity: 1,
  style: { color: '#e8eaf0', lineWidth: 1.5 },
  ...shape,
});

const num = (value: unknown, fallback: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

/**
 * The box a drawing is drawn in.
 *
 * `null` when the drawing's shape is its points alone: a trend line, an arrow
 * and a high/low line have no box, and their content is placed by the points
 * themselves.
 */
type DrawingShape = (props: Record<string, unknown>) => {
  x: number;
  y: number;
  width: number;
  height: number;
} | null;

const horizontalShape: DrawingShape = (props) => ({
  x: num(props.x, 960),
  y: num(props.y, 540),
  width: num(props.width, 480),
  height: RULE_BAND,
});

const verticalShape: DrawingShape = (props) => ({
  x: num(props.x, 960),
  y: num(props.y, 540),
  width: RULE_THICKNESS,
  height: num(props.height, 320),
});

const rectangleShape: DrawingShape = (props) => ({
  x: num(props.x, 960),
  y: num(props.y, 540),
  width: num(props.width, 320),
  height: num(props.height, 180),
});


const positionShape: DrawingShape = (props) => ({
  x: num(props.x, 960),
  y: num(props.y, 540),
  width: num(props.width, 320),
  height: num(props.height, 240),
});

const endpointShape: DrawingShape = () => null;

/**
 * The region an endpoint drawing is picked in.
 *
 * The shape has no box of its own, so the region is the bounding box of its
 * two points.
 */
const pointBounds = (props: Record<string, unknown>): ComponentBounds => {
  const points = (props.points ?? {}) as Record<string, DrawingPoint>;
  const entries = Object.values(points).filter(
    (point) => point && typeof point.x === 'number' && typeof point.y === 'number',
  );
  if (entries.length === 0) return { x: 0, y: 0, width: 0, height: 0 };
  const xs = entries.map((point) => point.x);
  const ys = entries.map((point) => point.y);
  const width = Math.max(...xs) - Math.min(...xs);
  const height = Math.max(...ys) - Math.min(...ys);
  return {
    x: Math.min(...xs) + width / 2,
    y: Math.min(...ys) + height / 2,
    width,
    height,
  };
};

/** One drawing definition, with only the fields that differ. */
const drawingDefinition = (
  type: DrawingKind,
  label: string,
  icon: string,
  description: string,
  defaults: ComponentProps,
  shape: DrawingShape,
  bounds: (props: Record<string, unknown>) => ComponentBounds,
  params: VideoComponentDefinition['params'],
  adapter: React.FC<DrawingAdapterProps>,
  edit: ElementEditModel,
): VideoComponentDefinition => ({
  type: type as ElementType,
  label,
  icon,
  description,
  category: 'trading',
  propsVersion: 3,
  defaults,
  params,
  edit: {...edit, coordinates: 'absolute', resize: 'axes'},
  geometry: (input) => {
    const props = {...defaults, ...input, points: {...defaults.points, ...(input.points as Record<string, unknown> | undefined)}};
    const ownShape = shape(props);
    const b = bounds(props);
    const anchor = {x: ownShape?.x ?? 0, y: ownShape?.y ?? 0};
    const points: Record<string, DrawingPoint> = {};
    const raw = props.points;
    if (raw && typeof raw === 'object') for(const [id, value] of Object.entries(raw)) {
      if(value && typeof value === 'object' && 'x' in value && 'y' in value && typeof value.x === 'number' && typeof value.y === 'number') points[id] = {x:value.x,y:value.y};
    }
    return {anchor,origin:anchor,box:ownShape ? {left:b.x-b.width/2,top:b.y-b.height/2,width:b.width,height:b.height} : null,points};
  },
  render: ({ clip, props }: ComponentRenderContext): React.ReactElement | null => {
    if (clip.hidden) return null;
    // The definition's defaults under the clip's own props: a drawing that
    // misses a point is drawn as the defaults say.
    const merged: Record<string, unknown> = {
      ...defaults,
      ...(props as Record<string, unknown>),
    };
    const points = {
      ...(defaults.points as Record<string, DrawingPoint> | undefined),
      ...(merged.points as Record<string, DrawingPoint> | undefined),
    };
    const opacity = num(merged.opacity, 1);
    const adapterProps: DrawingAdapterProps = {
      width: 0,
      height: 0,
      style: merged.style as DrawingStyle | undefined,
      caption: typeof merged.caption === 'string' ? merged.caption : undefined,
      points,
      position: merged.position as { direction: 'long' | 'short'; showRiskReward?: boolean } | undefined,
      label: merged.label as { text?: string } | undefined,
    };

    const box = shape(merged);
    if (!box) {
      // The shape is its own points. The content is placed by them, in
      // composition pixels, and there is no box for the composition to centre.
      return React.createElement(
        'div',
        { style: { position: 'relative', width: 0, height: 0, opacity } },
        React.createElement(adapter, adapterProps),
      );
    }
    return React.createElement(
      'div',
      { style: { width: box.width, height: box.height, opacity } },
      React.createElement(adapter, {
        ...adapterProps,
        width: box.width,
        height: box.height,
        origin: { x: box.x, y: box.y },
      }),
    );
  },
  inspector: DrawingInspector,
  // The editor's selection box follows the drawing's own stored shape.
  bounds,
});

/** The eight drawing definitions, in library order. */
export const drawingDefinitions: VideoComponentDefinition[] = [
  drawingDefinition(
    'horizontalLine',
    'Horizontal Line',
    '📏',
    'A horizontal rule of its own length.',
    baseDefaults({ x: 960, y: 540, width: 480 }),
    horizontalShape,
    (props) => {
      const box = horizontalShape(props);
      return box ? { x: box.x, y: box.y, width: box.width, height: box.height } : componentBounds(props);
    },
    [X_PARAM, Y_PARAM, WIDTH_PARAM, OPACITY_PARAM],
    HorizontalLineAdapter,
    // One anchor: the line is dragged by its own anchor.
    { pick: 'point', handles: [{ id: 'anchor', effect: 'move' }] },
  ),
  drawingDefinition(
    'verticalLine',
    'Vertical Line',
    '┃',
    'A vertical rule of its own length.',
    baseDefaults({ x: 960, y: 540, height: 320 }),
    verticalShape,
    (props) => {
      const box = verticalShape(props);
      return box ? { x: box.x, y: box.y, width: box.width, height: box.height } : componentBounds(props);
    },
    [X_PARAM, Y_PARAM, HEIGHT_PARAM, OPACITY_PARAM],
    VerticalLineAdapter,
    // One anchor: the line is dragged by its own anchor.
    { pick: 'point', handles: [{ id: 'anchor', effect: 'move' }] },
  ),
  drawingDefinition(
    'trendline',
    'Trendline',
    '📐',
    'A line between two points, at any angle.',
    baseDefaults({ points: { start: { x: 880, y: 585 }, end: { x: 1040, y: 495 } } }),
    endpointShape,
    pointBounds,
    // A trend line has no anchor of its own: it is placed by its two points.
    [OPACITY_PARAM],
    TrendlineAdapter,
    // Two endpoints: the line is dragged by them.
    {
      pick: 'segment',
      handles: [
        { id: 'start', effect: 'point' },
        { id: 'end', effect: 'point' },
      ],
    },
  ),
  drawingDefinition(
    'rectangle',
    'Rectangle',
    '🟦',
    'The element’s own box, outlined and optionally filled.',
    baseDefaults({ x: 960, y: 540, width: 320, height: 180 }),
    rectangleShape,
    componentBounds,
    [X_PARAM, Y_PARAM, WIDTH_PARAM, HEIGHT_PARAM, OPACITY_PARAM],
    RectangleAdapter,
    // The box is the truth.
    {
      pick: 'box',
      handles: (['nw', 'ne', 'se', 'sw'] as const).map((id) => ({
        id,
        effect: 'scale' as const,
        props: ['width', 'height'],
      })),
    },
  ),
  drawingDefinition(
    'arrow',
    'Arrow',
    '➡️',
    'An arrow between two points.',
    baseDefaults({ points: { from: { x: 880, y: 585 }, to: { x: 1040, y: 495 } } }),
    endpointShape,
    pointBounds,
    [OPACITY_PARAM],
    ArrowAdapter,
    // Two endpoints: the arrow is dragged by them.
    {
      pick: 'segment',
      handles: [
        { id: 'from', effect: 'point' },
        { id: 'to', effect: 'point' },
      ],
    },
  ),
  drawingDefinition(
    'position',
    'Position',
    '🎯',
    'Entry, stop and target levels, with an optional risk/reward ratio.',
    baseDefaults({
      x: 960,
      y: 540,
      width: 320,
      height: 240,
      points: {
        entry: { x: 800, y: 540 },
        stop: { x: 800, y: 600 },
        target: { x: 800, y: 480 },
      },
      position: { direction: 'long', showRiskReward: true },
    }),
    positionShape,
    componentBounds,
    [X_PARAM, Y_PARAM, WIDTH_PARAM, HEIGHT_PARAM, OPACITY_PARAM],
    PositionAdapter,
    // Three levels, each dragged on its own.
    {
      pick: 'box',
      handles: [
        { id: 'entry', effect: 'level' },
        { id: 'stop', effect: 'level' },
        { id: 'target', effect: 'level' },
      ],
    },
  ),
];

for (const definition of drawingDefinitions) registerComponent({...definition, validateProps: (raw) => {
 const result=createPropsValidator(definition.defaults)(raw);
 if(!result.ok) return result;
 const domain=validateDrawingProps(definition.type as DrawingKind,result.value);
 return domain.ok ? result : domain;
}});
