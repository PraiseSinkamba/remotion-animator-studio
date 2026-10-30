/**
 * The eight market-linked drawing tools, registered from one file.
 *
 * A drawing is an ordinary clip. It names the chart clip it belongs to and the
 * pane inside it, and it stores *market anchors* — never pixels. Its
 * `evaluate` step resolves the chart, resolves the pane and resolves the
 * anchors against that pane's current scale, so a price line keeps its price
 * when the chart is resized or re-scaled (R1).
 *
 * The render draws inside the chart's own box: the position comes from the
 * chart clip's live `x`, `y`, `width` and `height`, not from the drawing
 * clip's own stored position. That is what makes a drawing move with the
 * chart it is anchored to (R6).
 */
import React from 'react';
import {
  componentBounds,
  registerComponent,
  type ComponentEvaluationInput,
  type ComponentProps,
  type ComponentRenderContext,
  type DrawingKind,
  type ElementType,
  type MarketAnchor,
  type Project,
  type VideoComponentDefinition,
} from '@chart-studio/core';
import { candlestickChartDefinition } from '../definitions/candlestick-chart';
import {
  chartGeometry,
  chartPriceRange,
  type CandlestickChartProps,
  type ChartEvaluation,
  type ChartGeometry,
} from '../chart';
import { canDraw, resolveAnchors, REQUIRED_ANCHORS, type ResolvedAnchors } from './anchors';
import {
  ArrowAdapter,
  DrawingCanvas,
  HighLowLineAdapter,
  PositionAdapter,
  PriceLineAdapter,
  PriceZoneAdapter,
  TextLabelAdapter,
  TrendlineAdapter,
  VerticalLineAdapter,
  type DrawingAdapterProps,
  type DrawingStyle,
} from './adapters';
import { DrawingInspector } from '../inspectors/drawing';
import type { Clip } from '@chart-studio/core';

/** The chart's box, in composition pixels, at the moment of the render. */
export interface DrawingChartBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** What a drawing's evaluation resolves. */
export interface DrawingEvaluation {
  /** False when the drawing must draw nothing. */
  visible: boolean;
  /** The resolved anchors, in the chart's own box coordinates. */
  anchors: ResolvedAnchors;
  /** The pane's plot geometry, in the chart's own box coordinates. */
  geometry: ChartGeometry | null;
  /** The chart clip's live box. */
  chart: DrawingChartBox | null;
}

/** The chart clip a drawing is attached to. */
const findChartClip = (project: Project, chartClipId: unknown): Clip | undefined => {
  if (typeof chartClipId !== 'string' || chartClipId === '') return undefined;
  for (const track of project.tracks) {
    const clip = track.clips.find((entry) => entry.id === chartClipId);
    if (clip) return clip;
  }
  return undefined;
};

/** The style of a drawing, normalised to what the adapters read. */
const readStyle = (raw: unknown): DrawingStyle => {
  const style = (raw ?? {}) as Record<string, unknown>;
  return {
    color: typeof style.color === 'string' ? style.color : undefined,
    lineWidth: typeof style.lineWidth === 'number' ? style.lineWidth : undefined,
    fillOpacity: typeof style.fillOpacity === 'number' ? style.fillOpacity : undefined,
    fontSize: typeof style.fontSize === 'number' ? style.fontSize : undefined,
  };
};

/**
 * Resolves a drawing against the chart it is anchored to.
 *
 * The chart's own evaluation decides which bars are revealed at this frame, so
 * a drawing can never reveal a price the chart has not shown yet.
 */
const evaluateDrawing = (
  kind: DrawingKind,
  { props, sceneFrame, project }: ComponentEvaluationInput,
): DrawingEvaluation => {
  const hidden: DrawingEvaluation = { visible: false, anchors: {}, geometry: null, chart: null };
  const chartClip = findChartClip(project, props.chartClipId);
  if (!chartClip) return hidden;

  // The chart is evaluated with its own raw props, exactly as the composition
  // evaluates it — a drawing must see the same pane state the chart draws.
  const evaluation = candlestickChartDefinition.evaluate?.({
    clip: chartClip,
    props: chartClip.props,
    sceneFrame,
    project,
  }) as ChartEvaluation | undefined;
  if (!evaluation) return hidden;

  // The layout, on the other hand, comes from the chart's merged props: the
  // chart renderer fills the gaps before it draws, so the drawing must lay out
  // against the same numbers.
  const chartProps = {
    ...candlestickChartDefinition.defaults,
    ...chartClip.props,
  } as CandlestickChartProps;

  const panes = Array.isArray(chartProps.panes) ? chartProps.panes : [];
  const index = panes.findIndex((pane) => pane.id === props.paneId);
  const pane = index >= 0 ? evaluation.panes[index] : undefined;
  if (!pane) return hidden;

  // The drawing's lifecycle is relative to the chart it is anchored to.
  const chartLocalFrame = sceneFrame - chartClip.from;
  const inFrame = typeof props.in === 'number' ? props.in : 0;
  const outFrame = typeof props.out === 'number' ? props.out : 0;
  if (chartLocalFrame < inFrame) return hidden;
  if (outFrame > inFrame && chartLocalFrame >= outFrame) return hidden;

  // The plot geometry and the scale come from the chart's own props and the
  // pane's revealed bars — the same numbers the chart renderer draws with.
  const geometry = chartGeometry(chartProps, pane.totalBars, pane.rect);
  const range = chartPriceRange(pane.bars);
  const bars = pane.bars.map((bar) => ({
    id: bar.bar.id,
    high: bar.h,
    low: bar.l,
    close: bar.c,
  }));

  const stored = { ...((props.anchors ?? {}) as Record<string, MarketAnchor>) };

  // The position tool's levels are prices. They live in the anchors like every
  // other market anchor; a project that carries them as plain numbers in
  // `position` still resolves.
  if (kind === 'position') {
    const levels = (props.position ?? {}) as Record<string, unknown>;
    for (const key of ['entry', 'stop', 'target']) {
      if (stored[key]) continue;
      const price = levels[key];
      if (typeof price === 'number' && Number.isFinite(price)) {
        stored[key] = { kind: 'price', price };
      }
    }
  }

  const anchors = resolveAnchors(stored, { bars, geometry, range });

  return {
    visible: canDraw(anchors, REQUIRED_ANCHORS[kind]),
    anchors,
    geometry,
    chart: {
      x: chartProps.x,
      y: chartProps.y,
      width: chartProps.width,
      height: chartProps.height,
    },
  };
};

/**
 * Renders a drawing inside the chart's own box.
 *
 * The compositor centres a clip's content on the clip's own `x`/`y`, so the
 * drawing offsets itself by the difference between the chart's live position
 * and its own stored position. The drawing therefore follows the chart
 * wherever the chart goes, without the editor having to re-sync anything.
 */
const renderDrawing =
  (kind: DrawingKind, adapter: React.FC<DrawingAdapterProps>) =>
  ({ clip, props, evaluated }: ComponentRenderContext): React.ReactElement | null => {
    if (clip.hidden) return null;
    const evaluation = evaluated as DrawingEvaluation | undefined;
    if (!evaluation || !evaluation.visible || !evaluation.chart || !evaluation.geometry) {
      return null;
    }

    const { chart, geometry, anchors } = evaluation;
    const ownX = typeof props.x === 'number' ? props.x : chart.x;
    const ownY = typeof props.y === 'number' ? props.y : chart.y;
    const opacity = typeof props.opacity === 'number' ? props.opacity : 1;

    return React.createElement(
      DrawingCanvas,
      {
        kind,
        width: chart.width,
        height: chart.height,
        left: chart.x - ownX,
        top: chart.y - ownY,
        opacity,
      },
      React.createElement(adapter, {
        anchors,
        geometry,
        width: chart.width,
        height: chart.height,
        style: readStyle(props.style),
        position: props.position,
        zone: props.zone,
        trendline: props.trendline,
        label: props.label,
      }),
    );
  };

/** The parameters every drawing shares. They are flat, so the store writes them directly. */
const COMMON_PARAMS = [
  { key: 'opacity', label: 'Opacity', kind: 'number' as const, min: 0, max: 1, step: 0.05 },
  { key: 'in', label: 'In (chart frames)', kind: 'number' as const, min: 0, max: 3600, step: 1 },
  { key: 'out', label: 'Out (chart frames)', kind: 'number' as const, min: 0, max: 3600, step: 1 },
];

/** The props a new drawing starts with. */
const baseDefaults = (): ComponentProps => ({
  chartClipId: '',
  paneId: '',
  anchors: {},
  in: 0,
  out: 0,
  opacity: 1,
  style: { color: '#e8eaf0', lineWidth: 1.5 },
  x: 960,
  y: 540,
  width: 720,
  height: 420,
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
  propsVersion: 1,
  defaults,
  params: COMMON_PARAMS,
  evaluate: (input) => evaluateDrawing(type, input),
  render: renderDrawing(type, adapter),
  inspector: DrawingInspector,
  // The editor's selection box follows the drawing's own stored position; the
  // render path ignores it and draws inside the chart's box.
  bounds: componentBounds,
});

/** The eight drawing definitions, in library order. */
export const drawingDefinitions: VideoComponentDefinition[] = [
  drawingDefinition(
    'priceLine',
    'Price Line',
    '📏',
    'A horizontal line at a price, anchored to a chart and a pane.',
    baseDefaults(),
    PriceLineAdapter,
  ),
  drawingDefinition(
    'highLowLine',
    'High/Low Line',
    '↕️',
    'A vertical line between a candle high and its low.',
    baseDefaults(),
    HighLowLineAdapter,
  ),
  drawingDefinition(
    'verticalLine',
    'Vertical Line',
    '┃',
    'A vertical line at a bar of a chart.',
    baseDefaults(),
    VerticalLineAdapter,
  ),
  drawingDefinition(
    'trendline',
    'Trendline',
    '📐',
    'A line between two points, each a bar and a price.',
    { ...baseDefaults(), trendline: { ray: 'none' } },
    TrendlineAdapter,
  ),
  drawingDefinition(
    'priceZone',
    'Price Zone',
    '🟦',
    'A filled band between two prices, optionally running to the right edge.',
    { ...baseDefaults(), zone: { extendRight: false } },
    PriceZoneAdapter,
  ),
  drawingDefinition(
    'textLabel',
    'Text Label',
    '🔤',
    'A text label anchored to a point in a chart.',
    { ...baseDefaults(), label: { text: 'Label' } },
    TextLabelAdapter,
  ),
  drawingDefinition(
    'arrow',
    'Arrow',
    '➡️',
    'An arrow between two points in a chart.',
    baseDefaults(),
    ArrowAdapter,
  ),
  drawingDefinition(
    'position',
    'Position',
    '🎯',
    'Entry, stop and target levels, with an optional risk/reward ratio.',
    { ...baseDefaults(), position: { direction: 'long', showRiskReward: true } },
    PositionAdapter,
  ),
];

for (const definition of drawingDefinitions) registerComponent(definition);
