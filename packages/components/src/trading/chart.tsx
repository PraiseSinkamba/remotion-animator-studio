/**
 * Render adapter for the Candlestick Chart component.
 *
 * Pure: `(props, frame)` -> one `<svg>`. No hooks, no state, no Remotion, no clock.
 *
 * Two rules drive the implementation (docs/spec/COMPONENT_CONTRACT.md §4):
 * - no future data leakage — only the bars that exist at `frame` are drawn and
 *   only they set the price scale;
 * - provenance stays visible — synthetic data and simulated intrabar paths are
 *   labelled in the rendered output.
 */
import React from 'react';
import {
  computePriceRange,
  evaluateBarsAtFrame,
  type ElementRect,
  type OhlcBar,
  type PartialBar,
  type SeriesOrigin,
} from '@chart-studio/core';

/** What one pane of an evaluated chart holds. */
export interface ChartPaneEvaluation {
  /** The bars to draw; the active one is revealed part-way. */
  bars: PartialBar[];
  /**
   * The authored bar count of the pane. The layout uses this, not the visible
   * count, so revealing a bar never moves the others.
   */
  totalBars: number;
  /** True when the active bar is a partially aggregated bucket. */
  developing: boolean;
  /** The pane's place in the chart box, in 0..1. */
  rect: ElementRect;
}

/** The result of the chart's evaluation step. */
export interface ChartEvaluation {
  panes: ChartPaneEvaluation[];
  provenance: {
    origin: SeriesOrigin;
    revision: string;
    label: string;
    symbol?: string;
    timeframeId?: string;
  };
}

export interface CandlestickChartProps {
  bars: OhlcBar[];
  dataSource: 'manual' | 'synthetic';
  revealMode: 'discrete' | 'simulated';
  framesPerBar: number;
  simulationSeed: string;
  symbol: string;
  timeframe: string;
  width: number;
  height: number;
  x: number;
  y: number;
  upColor: string;
  downColor: string;
  wickColor: string;
  gridColor: string;
  showGrid: boolean;
  showPriceAxis: boolean;
  showProvenanceBadge: boolean;
}

/** Padding around the plot area. */
export const CHART_PADDING = 8;
/** Room for the symbol / timeframe label row. */
export const CHART_TOP = 28;
/** Room for the provenance row. */
export const CHART_BOTTOM = 24;
/** Width of the right-hand price axis strip. */
export const PRICE_AXIS_WIDTH = 64;
/** Body width as a fraction of the slot. */
export const BODY_RATIO = 0.62;
/** Number of horizontal grid lines (and price labels). */
export const GRID_LINES = 5;

const MUTED = '#8b90a0';

export interface ChartGeometry {
  plotLeft: number;
  plotTop: number;
  plotBottom: number;
  plotRight: number;
  plotWidth: number;
  plotHeight: number;
  /** Slot width — one authored bar's slot, so the layout does not jump. */
  slotWidth: number;
  /** Candle body width. */
  bodyWidth: number;
}

/**
 * Layout of the plot area. Slot width is derived from the *authored* bar count:
 * bar positions are layout, not market data, so revealing a bar must not move
 * the others.
 *
 * The rect is the pane's place in the chart box, in 0..1. A pane covering the
 * whole box — the default — lays out exactly as it always did.
 */
export const chartGeometry = (
  props: CandlestickChartProps,
  barCount: number,
  rect?: ElementRect,
): ChartGeometry => {
  const axis = props.showPriceAxis ? PRICE_AXIS_WIDTH : 0;
  const box = rect ?? { x: 0, y: 0, width: 1, height: 1 };
  const plotLeft = box.x * props.width + CHART_PADDING;
  const plotTop = box.y * props.height + CHART_TOP;
  const plotWidth = Math.max(1, box.width * props.width - CHART_PADDING * 2 - axis);
  const plotHeight = Math.max(1, box.height * props.height - CHART_TOP - CHART_BOTTOM);
  const slotWidth = barCount > 0 ? plotWidth / barCount : 0;
  return {
    plotLeft,
    plotTop,
    plotBottom: plotTop + plotHeight,
    plotRight: plotLeft + plotWidth,
    plotWidth,
    plotHeight,
    slotWidth,
    bodyWidth: Math.max(1, slotWidth * BODY_RATIO),
  };
};

/** Map a price to a y coordinate. A flat range puts the price in the middle. */
export const priceToY = (
  price: number,
  min: number,
  max: number,
  geometry: ChartGeometry,
): number => {
  if (!(max > min)) return geometry.plotTop + geometry.plotHeight / 2;
  const ratio = (price - min) / (max - min);
  return geometry.plotBottom - ratio * geometry.plotHeight;
};

/** What each origin is called in the badge. */
const ORIGIN_LABELS: Record<SeriesOrigin, string> = {
  'authored-path': 'AUTHORED PATH',
  synthetic: 'SYNTHETIC DATA',
  imported: 'IMPORTED',
  manual: '',
};

/**
 * The provenance line: where the data came from and whether the intrabar path
 * is simulated.
 *
 * The origin label comes from the resolved series when the chart is driven by
 * the project registry, and from the legacy prop when it is not.
 */
export const provenanceLabel = (
  props: CandlestickChartProps,
  origin?: SeriesOrigin,
): string =>
  [
    origin ? ORIGIN_LABELS[origin] : props.dataSource === 'synthetic' ? 'SYNTHETIC DATA' : null,
    props.revealMode === 'simulated' ? 'SIMULATED INTRABAR' : null,
  ]
    .filter(Boolean)
    .join(' · ');

/**
 * The panes a chart draws.
 *
 * When the chart is driven by the project registry the panes come from the
 * evaluation. Otherwise the chart falls back to the inline bars, which keeps a
 * chart that predates the registry rendering.
 */
const panesToDraw = (
  props: CandlestickChartProps,
  frame: number,
  evaluated: unknown,
): { panes: ChartPaneEvaluation[]; origin?: SeriesOrigin } => {
  const evaluation = evaluated as ChartEvaluation | undefined;
  if (evaluation && evaluation.panes.length > 0) {
    return { panes: evaluation.panes, origin: evaluation.provenance.origin };
  }

  const bars = Array.isArray(props.bars) ? props.bars : [];
  const state = evaluateBarsAtFrame(
    bars,
    frame,
    props.framesPerBar,
    props.revealMode,
    props.simulationSeed,
  );
  return {
    panes: [
      {
        bars: state.bars,
        totalBars: bars.length,
        developing: false,
        rect: { x: 0, y: 0, width: 1, height: 1 },
      },
    ],
  };
};

/**
 * Render the chart. `props` are the merged component props, `frame` is the
 * clip-relative frame, and `evaluated` is the result of the chart's own
 * evaluation step.
 */
export const renderCandlestickChart = (
  props: CandlestickChartProps,
  frame: number,
  evaluated?: unknown,
): React.ReactElement => {
  const { panes, origin } = panesToDraw(props, frame, evaluated);
  const drawn = panes.filter((pane) => pane.bars.length > 0);

  if (drawn.length === 0) {
    return (
      <svg
        data-testid="candlestick-chart"
        width={props.width}
        height={props.height}
        viewBox={`0 0 ${props.width} ${props.height}`}
      />
    );
  }

  const paneElements = drawn.map((pane, paneIndex) => {
    const geometry = chartGeometry(props, pane.totalBars, pane.rect);

    // The scale comes from the visible bars only — a future bar never moves it.
    const visible = computePriceRange(
      pane.bars.map((bar) => ({ t: bar.bar.t, o: bar.o, h: bar.h, l: bar.l, c: bar.c })),
    );
    // A bar that has not moved yet (a simulated bar at progress 0) collapses
    // the scale onto one price. Widen it symmetrically by a fixed fraction so
    // the grid stays readable without borrowing a price from a future bar.
    const range =
      visible.max > visible.min
        ? visible
        : {
            min: visible.min - Math.max(Math.abs(visible.min) * 0.005, 0.5),
            max: visible.max + Math.max(Math.abs(visible.max) * 0.005, 0.5),
          };

    const gridPrices: number[] = [];
    for (let i = 0; i < GRID_LINES; i++) {
      gridPrices.push(range.max - ((range.max - range.min) * i) / (GRID_LINES - 1));
    }

    const candles = pane.bars.map((bar, index) => {
      const centre = geometry.plotLeft + (index + 0.5) * geometry.slotWidth;
      const yHigh = priceToY(bar.h, range.min, range.max, geometry);
      const yLow = priceToY(bar.l, range.min, range.max, geometry);
      const yOpen = priceToY(bar.o, range.min, range.max, geometry);
      const yClose = priceToY(bar.c, range.min, range.max, geometry);
      const top = Math.min(yOpen, yClose);
      const height = Math.max(1, Math.abs(yClose - yOpen));
      return (
        <g key={index} data-testid="candle" data-index={index}>
          <line
            data-testid="candle-wick"
            x1={centre}
            x2={centre}
            y1={yHigh}
            y2={yLow}
            stroke={props.wickColor}
            strokeWidth={1}
          />
          <rect
            data-testid="candle-body"
            x={centre - geometry.bodyWidth / 2}
            y={top}
            width={geometry.bodyWidth}
            height={height}
            fill={bar.c >= bar.o ? props.upColor : props.downColor}
          />
        </g>
      );
    });

    return (
      <g key={paneIndex} data-testid="chart-pane" data-pane={paneIndex}>
        {props.showGrid
          ? gridPrices.map((price, i) => {
              const y = priceToY(price, range.min, range.max, geometry);
              return (
                <line
                  key={i}
                  data-testid="grid-line"
                  x1={geometry.plotLeft}
                  x2={geometry.plotRight}
                  y1={y}
                  y2={y}
                  stroke={props.gridColor}
                  strokeWidth={1}
                />
              );
            })
          : null}

        {props.showPriceAxis
          ? gridPrices.map((price, i) => {
              const y = priceToY(price, range.min, range.max, geometry);
              return (
                <text
                  key={i}
                  data-testid="price-label"
                  x={geometry.plotRight + 6}
                  y={y + 4}
                  fontSize={10}
                  fill={MUTED}
                >
                  {price.toFixed(2)}
                </text>
              );
            })
          : null}

        {candles}
      </g>
    );
  });

  const provenance = provenanceLabel(props, origin);

  return (
    <svg
      data-testid="candlestick-chart"
      width={props.width}
      height={props.height}
      viewBox={`0 0 ${props.width} ${props.height}`}
    >
      <text data-testid="chart-label" x={CHART_PADDING} y={18} fontSize={14} fill="#e8eaf0">
        <tspan fontWeight={700}>{props.symbol}</tspan>
        <tspan dx={8} fontSize={12} fill={MUTED}>
          {props.timeframe}
        </tspan>
      </text>

      {paneElements}

      {props.showProvenanceBadge && provenance ? (
        <text
          data-testid="provenance"
          x={CHART_PADDING}
          y={props.height - 8}
          fontSize={10}
          letterSpacing={1}
          fill={MUTED}
        >
          {provenance}
        </text>
      ) : null}
    </svg>
  );
};

/** Component wrapper so the adapter can be used as a React element. */
export const CandlestickChart: React.FC<{
  props: CandlestickChartProps;
  frame: number;
  evaluated?: unknown;
}> = ({ props, frame, evaluated }) => renderCandlestickChart(props, frame, evaluated);
