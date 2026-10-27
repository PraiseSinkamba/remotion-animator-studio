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
import { registerComponent } from '../registry/registry';
import { componentBounds, type ComponentProps, type VideoComponentDefinition } from '../registry/types';
import { CandlestickChart, type CandlestickChartProps } from './candlestick-chart';
import { CandlestickChartInspector } from './candlestick-chart-inspector';
import { barsToFrames, generateSyntheticBars } from './ohlc';

const POSITION_PARAMS = [
  { key: 'x', label: 'X', kind: 'number' as const, min: -1000, max: 5000, step: 1 },
  { key: 'y', label: 'Y', kind: 'number' as const, min: -1000, max: 4000, step: 1 },
];

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
  render: ({ props, frame }) =>
    createElement(CandlestickChart, {
      props: {
        ...candlestickChartDefinition.defaults,
        ...props,
        bars: Array.isArray(props.bars) ? props.bars : candlestickChartDefinition.defaults.bars,
      } as CandlestickChartProps,
      frame,
    }),
  inspector: CandlestickChartInspector,
  // The chart renders at its own width/height around its anchor.
  bounds: componentBounds,
  // A new chart is long enough to show its whole series.
  defaultDuration: (props: ComponentProps) => barsToFrames(props.bars ?? [], props.framesPerBar),
};

registerComponent(candlestickChartDefinition);
