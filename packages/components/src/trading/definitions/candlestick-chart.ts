/**
 * Registry definition for Chart Studio's first-party trading component: the
 * Candlestick Chart.
 *
 * Importing this module registers the component (side effect) so
 * `getComponent('candlestickChart')` resolves it.
 *
 * See docs/spec/COMPONENT_CONTRACT.md.
 */
import { createElement } from 'react';
import { registerComponent } from '@chart-studio/core';
import { componentBounds, type ComponentProps, type VideoComponentDefinition } from '@chart-studio/core';
import { CandlestickChart, type ChartEvaluation, type CandlestickChartProps } from '../chart';
import { CandlestickChartInspector } from '../inspectors/candlestick-chart';
import {
  applyHold,
  barsToFrames,
  evaluateBarsAtFrame,
  evaluatePaneAt,
  evaluateZoomAt,
  framesPerBar as framesPerBarOf,
  generateSyntheticBars,
  holdAt,
  marketFrameAt,
  materialiseSeries,
  seriesRevision,
  type Project,
  type SeriesSpec,
} from '@chart-studio/core';

const POSITION_PARAMS = [
  { key: 'x', label: 'X', kind: 'number' as const, min: -1000, max: 5000, step: 1 },
  { key: 'y', label: 'Y', kind: 'number' as const, min: -1000, max: 4000, step: 1 },
];

/**
 * Resolves the chart's series from the project registry and evaluates its
 * panes for this frame.
 *
 * Pure: the same project and frame always give the same result, whatever
 * order the frames were visited in.
 */
const evaluateChart = ({
  clip,
  props,
  sceneFrame,
  project,
}: {
  clip: { from: number };
  props: ComponentProps;
  sceneFrame: number;
  project: Project;
}): ChartEvaluation | undefined => {
  const seriesId = typeof props.seriesId === 'string' ? props.seriesId : undefined;
  const spec: SeriesSpec | undefined = project.series?.find((entry) => entry.id === seriesId);
  if (!spec) return undefined;

  // A path the creator has not drawn yet has nothing to generate from. The
  // chart shows an empty plot rather than failing: the path is the chart's
  // data, and a chart whose data is not drawn yet is simply empty.
  if (spec.origin === 'authored-path' && spec.path.anchors.length < 2) {
    return {
      panes: [
        {
          bars: [],
          totalBars: 0,
          developing: false,
          rect: { x: 0, y: 0, width: 1, height: 1 },
        },
      ],
      provenance: {
        origin: spec.origin,
        revision: seriesRevision(spec),
        label: spec.label,
        symbol: spec.symbol,
        timeframeId: spec.timeframeId,
      },
    };
  }

  const datasource = materialiseSeries(spec);
  const clock = props.clock;
  const panes = Array.isArray(props.panes) ? props.panes : [];
  if (!clock || panes.length === 0) return undefined;

  // The clock is in chart-local frames; the scene frame is absolute.
  const chartLocalFrame = sceneFrame - clip.from;
  // The clock carries the pace, so the reveal and the market position agree.
  const framesPerBar = Math.max(1, Math.round(framesPerBarOf(clock)));

  const evaluatedPanes = panes.map((pane) => {
    // A hold pauses the market: the frames it covers show the market as it
    // stood when the hold began, and no bar is invented to fill the gap.
    const marketFrame = marketFrameAt(pane.holds, chartLocalFrame);
    // The camera zoom track moves the viewport — the aggregation and the bar
    // range — and never a price.
    const viewport = evaluateZoomAt(pane, pane.zoom, chartLocalFrame);
    const factor = viewport.aggregation;
    const state = evaluatePaneAt(
      { ...pane, aggregation: { factor } },
      datasource,
      clock,
      marketFrame,
    );
    const held = applyHold(state, pane.holds, chartLocalFrame, pane.priceRange ?? { mode: 'auto' });
    const revealed = evaluateBarsAtFrame(
      held.bars,
      marketFrame,
      framesPerBar,
      props.revealMode === 'simulated' ? 'simulated' : 'discrete',
      props.simulationSeed ?? 'chart',
    );
    // The window starts at the zoomed bar; the slots shrink with it, so the
    // zoomed pane fills the same box.
    const visible = viewport.fromBar > 0 ? revealed.bars.slice(viewport.fromBar) : revealed.bars;
    const hold = holdAt(pane.holds, chartLocalFrame);
    return {
      bars: visible,
      totalBars: Math.max(0, Math.ceil(datasource.bars.length / factor) - viewport.fromBar),
      developing: held.developing,
      rect: pane.rect ?? { x: 0, y: 0, width: 1, height: 1 },
      ...(hold ? { hold: { barId: hold.barId, in: hold.in, out: hold.out } } : {}),
    };
  });

  return {
    panes: evaluatedPanes,
    provenance: {
      origin: datasource.origin,
      revision: datasource.revision,
      label: datasource.label,
      symbol: datasource.symbol,
      timeframeId: datasource.timeframeId,
    },
  };
};

export const candlestickChartDefinition: VideoComponentDefinition = {
  type: 'candlestickChart',
  label: 'Candlestick Chart',
  icon: '🕯',
  description: 'OHLC candlestick chart with a price axis and visible data provenance.',
  category: 'trading',
  propsVersion: 1,
  defaults: {
    bars: generateSyntheticBars({
      count: 12,
      startPrice: 100,
      seed: 'chart-1',
      timeframeMs: 300_000,
    }),
    dataSource: 'synthetic',
    revealMode: 'simulated',
    framesPerBar: 15,
    simulationSeed: 'chart-1',
    symbol: 'SYNTH',
    timeframe: '5m',
    width: 720,
    height: 420,
    x: 960,
    y: 540,
    upColor: '#26a69a',
    downColor: '#ef5350',
    wickColor: '#9aa4b2',
    gridColor: 'rgba(255,255,255,0.14)',
    showGrid: true,
    showPriceAxis: true,
    showProvenanceBadge: true,
  },
  params: [
    { key: 'revealMode', label: 'Reveal', kind: 'select', options: ['discrete', 'simulated'] },
    { key: 'framesPerBar', label: 'Frames per bar', kind: 'number', min: 1, max: 120, step: 1 },
    { key: 'simulationSeed', label: 'Simulation seed', kind: 'text' },
    { key: 'symbol', label: 'Symbol', kind: 'text' },
    { key: 'timeframe', label: 'Timeframe', kind: 'text' },
    { key: 'width', label: 'Width', kind: 'number', min: 100, max: 1920, step: 1 },
    { key: 'height', label: 'Height', kind: 'number', min: 100, max: 1080, step: 1 },
    { key: 'upColor', label: 'Up colour', kind: 'color' },
    { key: 'downColor', label: 'Down colour', kind: 'color' },
    { key: 'wickColor', label: 'Wick colour', kind: 'color' },
    { key: 'gridColor', label: 'Grid colour', kind: 'color' },
    { key: 'showGrid', label: 'Show grid', kind: 'boolean' },
    { key: 'showPriceAxis', label: 'Show price axis', kind: 'boolean' },
    { key: 'showProvenanceBadge', label: 'Show provenance', kind: 'boolean' },
    ...POSITION_PARAMS,
  ],
  // A clip may carry a partial props bag (an old file), so the defaults fill
  // the gaps before the adapter sees them.
  render: ({ props, frame, evaluated }) =>
    createElement(CandlestickChart, {
      props: {
        ...candlestickChartDefinition.defaults,
        ...props,
        bars: Array.isArray(props.bars) ? props.bars : candlestickChartDefinition.defaults.bars,
      } as CandlestickChartProps,
      frame,
      evaluated,
    }),
  inspector: CandlestickChartInspector,
  evaluate: evaluateChart,
  // The chart renders at its own width/height around its anchor.
  bounds: componentBounds,
  // A new chart is long enough to show its whole series.
  defaultDuration: (props: ComponentProps) => barsToFrames(props.bars ?? [], props.framesPerBar),
};

registerComponent(candlestickChartDefinition);
