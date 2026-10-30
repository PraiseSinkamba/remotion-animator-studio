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
  type MarketClock,
  type OhlcBar,
  type PaneRelation,
  type PaneSpec,
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
  /** The pause point that freezes this pane at this frame, if any. */
  hold?: { barId: string; in: number; out: number };
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
  /** The project series this chart draws. Absent on a chart with no series yet. */
  seriesId?: string;
  /** The chart's panes. Absent on a chart that predates the pane model. */
  panes?: PaneSpec[];
  /** The chart's clock. Absent on a chart that predates the clock. */
  clock?: MarketClock;
  /** The declared relations between this chart's panes. */
  relations?: PaneRelation[];
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
 * The price range a pane's visible bars give.
 *
 * The scale comes from the visible bars only — a future bar never moves it. A
 * bar that has not moved yet (a simulated bar at progress 0) collapses the
 * scale onto one price, so it is widened symmetrically by a fixed fraction
 * rather than borrowing a price from a future bar.
 */
export const chartPriceRange = (bars: PartialBar[]): { min: number; max: number } => {
  const visible = computePriceRange(
    bars.map((bar) => ({ t: bar.bar.t, o: bar.o, h: bar.h, l: bar.l, c: bar.c })),
  );
  if (visible.max > visible.min) return visible;
  return {
    min: visible.min - Math.max(Math.abs(visible.min) * 0.005, 0.5),
    max: visible.max + Math.max(Math.abs(visible.max) * 0.005, 0.5),
  };
};

/**
 * The market point under a position on the chart.
 *
 * The inverse of the renderer: the bar index from the slot the position falls
 * in, and the price from the position against the pane's current range. It
 * uses the same geometry and the same range the renderer draws with, so an
 * anchor lands exactly where the creator pointed.
 *
 * The position is in the chart's own box coordinates, not the composition's.
 */
export const chartPointToAnchor = (
  props: CandlestickChartProps,
  pane: { bars: PartialBar[]; totalBars: number },
  point: { x: number; y: number },
): { barIndex: number; price: number } | null => {
  if (pane.totalBars <= 0) return null;
  const geometry = chartGeometry(props, pane.totalBars);
  if (geometry.slotWidth <= 0) return null;
  const slot = Math.floor((point.x - geometry.plotLeft) / geometry.slotWidth);
  const barIndex = Math.max(0, Math.min(pane.totalBars - 1, slot));
  const range = chartPriceRange(pane.bars);
  const ratio =
    geometry.plotHeight > 0 ? (geometry.plotBottom - point.y) / geometry.plotHeight : 0.5;
  const price = range.min + ratio * (range.max - range.min);
  return { barIndex, price: Math.max(0.0001, price) };
};

/**
 * The position of an anchor on the chart.
 *
 * The inverse of `chartPointToAnchor`, so a handle drawn over the chart sits
 * exactly on the bar and price it names. The position is in the chart's own
 * box coordinates.
 */
export const chartAnchorToPoint = (
  props: CandlestickChartProps,
  pane: { bars: PartialBar[]; totalBars: number },
  anchor: { barIndex: number; price: number },
): { x: number; y: number } => {
  const geometry = chartGeometry(props, pane.totalBars);
  const range = chartPriceRange(pane.bars);
  const centre = geometry.plotLeft + (anchor.barIndex + 0.5) * geometry.slotWidth;
  const span = range.max - range.min;
  const ratio = span > 0 ? (anchor.price - range.min) / span : 0.5;
  return { x: centre, y: geometry.plotBottom - ratio * geometry.plotHeight };
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
  // The shared cursor marks the market instant the clock is at, so that panes
  // can be read against each other. It is a *shared* cursor: with one pane
  // there is nothing to relate it to, and the playhead already says where the
  // composition is.
  const clockDriven =
    Boolean(props.clock) &&
    panes.length > 1 &&
    Boolean((evaluated as ChartEvaluation | undefined)?.panes.length);

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
    const range = chartPriceRange(pane.bars);

    const gridPrices: number[] = [];
    for (let i = 0; i < GRID_LINES; i++) {
      gridPrices.push(range.max - ((range.max - range.min) * i) / (GRID_LINES - 1));
    }

    // The shared cursor: the pane's last revealed bar is the market instant
    // the clock's reference index falls in, so every pane marks the same
    // moment in its own scale.
    const cursorX = clockDriven
      ? geometry.plotLeft + (pane.bars.length - 0.5) * geometry.slotWidth
      : null;

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

    // The pause point: the held candle is marked, so the viewer can see that
    // the market is standing still rather than moving.
    const holdIndex = pane.hold
      ? pane.bars.findIndex((bar) => bar.bar.id === pane.hold?.barId)
      : -1;

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

        {holdIndex >= 0 ? (
          <g data-testid="hold-marker" data-bar={pane.hold?.barId}>
            <rect
              x={geometry.plotLeft + holdIndex * geometry.slotWidth}
              y={geometry.plotTop}
              width={geometry.slotWidth}
              height={geometry.plotHeight}
              fill="none"
              stroke={props.wickColor}
              strokeWidth={1}
              strokeDasharray="4 2"
            />
            <text
              x={geometry.plotLeft + holdIndex * geometry.slotWidth + 4}
              y={geometry.plotTop + 10}
              fontSize={9}
              fill={MUTED}
            >
              HOLD
            </text>
          </g>
        ) : null}

        {cursorX !== null ? (
          <line
            data-testid="clock-cursor"
            data-pane={paneIndex}
            x1={cursorX}
            x2={cursorX}
            y1={geometry.plotTop}
            y2={geometry.plotBottom}
            stroke={props.wickColor}
            strokeWidth={1}
            strokeDasharray="3 3"
          />
        ) : null}
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
