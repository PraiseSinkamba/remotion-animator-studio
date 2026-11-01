/**
 * The eight independent drawing tools, registered from one file.
 *
 * A drawing is an ordinary clip that owns its own box, its own frame range
 * and its own points. It reads no chart, no pane and no market, so it renders
 * whether or not a chart exists in the project.
 *
 * The geometry is normalised inside the box: a point is a 0..1 fraction
 * (origin top-left, y down), and the adapter turns it into the box's own
 * pixels. The composition centres the clip's content on the clip's own
 * `x` / `y`, so the drawing needs no offset arithmetic of its own.
 */
import React from 'react';
import {
  componentBounds,
  registerComponent,
  type ComponentProps,
  type ComponentRenderContext,
  type DrawingKind,
  type DrawingPoint,
  type ElementType,
  type VideoComponentDefinition,
} from '@chart-studio/core';
import {
  ArrowAdapter,
  HighLowLineAdapter,
  HorizontalLineAdapter,
  PositionAdapter,
  RectangleAdapter,
  TextLabelAdapter,
  TrendlineAdapter,
  VerticalLineAdapter,
  type DrawingAdapterProps,
} from './adapters';
import { DrawingInspector } from '../inspectors/drawing';

/** The default points of a kind, as 0..1 fractions of its box. */
export const DEFAULT_DRAWING_POINTS: Record<DrawingKind, Record<string, DrawingPoint>> = {
  horizontalLine: {},
  verticalLine: { at: { x: 0.5, y: 0.5 } },
  trendline: { start: { x: 0.25, y: 0.75 }, end: { x: 0.75, y: 0.25 } },
  highLowLine: { top: { x: 0.5, y: 0.25 }, bottom: { x: 0.5, y: 0.75 } },
  rectangle: {},
  textLabel: { at: { x: 0.5, y: 0.5 } },
  arrow: { from: { x: 0.25, y: 0.75 }, to: { x: 0.75, y: 0.25 } },
  position: { entry: { x: 0, y: 0.5 }, stop: { x: 0, y: 0.75 }, target: { x: 0, y: 0.25 } },
};

/** The parameters every drawing shares. They are flat, so the store writes them directly. */
const COMMON_PARAMS = [
  // The generic inspector's POSITION section carries x and y, and the
  // PROPERTIES section carries the size: a drawing is an ordinary element
  // and is placed like one.
  { key: 'x', label: 'X', kind: 'number' as const, min: -1000, max: 5000, step: 1 },
  { key: 'y', label: 'Y', kind: 'number' as const, min: -1000, max: 4000, step: 1 },
  { key: 'width', label: 'Width', kind: 'number' as const, min: 8, max: 1920, step: 1 },
  { key: 'height', label: 'Height', kind: 'number' as const, min: 8, max: 1080, step: 1 },
  { key: 'opacity', label: 'Opacity', kind: 'number' as const, min: 0, max: 1, step: 0.05 },
];

/** The props a new drawing starts with, apart from its own content. */
const baseDefaults = (width: number, height: number): ComponentProps => ({
  x: 960,
  y: 540,
  width,
  height,
  opacity: 1,
  style: { color: '#e8eaf0', lineWidth: 1.5 },
});

/** One drawing definition, with only the fields that differ. */
const drawingDefinition = (
  type: DrawingKind,
  label: string,
  icon: string,
  description: string,
  defaults: ComponentProps,
  adapter: React.FC<DrawingAdapterProps>,
): VideoComponentDefinition => ({
  type: type as ElementType,
  label,
  icon,
  description,
  category: 'trading',
  propsVersion: 2,
  defaults,
  params: COMMON_PARAMS,
  render: ({ clip, props }: ComponentRenderContext): React.ReactElement | null => {
    if (clip.hidden) return null;
    const width = typeof props.width === 'number' ? props.width : 320;
    const height = typeof props.height === 'number' ? props.height : 180;
    const opacity = typeof props.opacity === 'number' ? props.opacity : 1;
    return React.createElement(
      'div',
      { style: { width, height, opacity } },
      React.createElement(adapter, {
        width,
        height,
        style: props.style,
        caption: props.caption,
        points: props.points,
        position: props.position,
        trendline: props.trendline,
        label: props.label,
      }),
    );
  },
  inspector: DrawingInspector,
  // The editor's selection box follows the drawing's own stored position.
  bounds: componentBounds,
});

/** The eight drawing definitions, in library order. */
export const drawingDefinitions: VideoComponentDefinition[] = [
  drawingDefinition(
    'horizontalLine',
    'Horizontal Line',
    '📏',
    'A horizontal rule across its own box.',
    { ...baseDefaults(480, 24), points: DEFAULT_DRAWING_POINTS.horizontalLine },
    HorizontalLineAdapter,
  ),
  drawingDefinition(
    'verticalLine',
    'Vertical Line',
    '┃',
    'A vertical rule down its own box.',
    { ...baseDefaults(24, 320), points: DEFAULT_DRAWING_POINTS.verticalLine },
    VerticalLineAdapter,
  ),
  drawingDefinition(
    'trendline',
    'Trendline',
    '📐',
    'A line between two points of its own box, at any angle.',
    {
      ...baseDefaults(320, 180),
      points: DEFAULT_DRAWING_POINTS.trendline,
      trendline: { ray: 'none' },
    },
    TrendlineAdapter,
  ),
  drawingDefinition(
    'highLowLine',
    'High/Low Line',
    '↕️',
    'A vertical segment between two points of its own box.',
    { ...baseDefaults(24, 320), points: DEFAULT_DRAWING_POINTS.highLowLine },
    HighLowLineAdapter,
  ),
  drawingDefinition(
    'rectangle',
    'Rectangle',
    '🟦',
    'The element’s own box, outlined and optionally filled.',
    { ...baseDefaults(320, 180), points: DEFAULT_DRAWING_POINTS.rectangle },
    RectangleAdapter,
  ),
  drawingDefinition(
    'textLabel',
    'Text Label',
    '🔤',
    'A text label at a point of its own box.',
    { ...baseDefaults(200, 40), points: DEFAULT_DRAWING_POINTS.textLabel, label: { text: 'Label' } },
    TextLabelAdapter,
  ),
  drawingDefinition(
    'arrow',
    'Arrow',
    '➡️',
    'An arrow between two points of its own box.',
    { ...baseDefaults(320, 180), points: DEFAULT_DRAWING_POINTS.arrow },
    ArrowAdapter,
  ),
  drawingDefinition(
    'position',
    'Position',
    '🎯',
    'Entry, stop and target levels, with an optional risk/reward ratio.',
    {
      ...baseDefaults(320, 240),
      points: DEFAULT_DRAWING_POINTS.position,
      position: { direction: 'long', showRiskReward: true },
    },
    PositionAdapter,
  ),
];

for (const definition of drawingDefinitions) registerComponent(definition);
