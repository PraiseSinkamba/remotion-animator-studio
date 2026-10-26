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
import { computePriceRange, evaluateBarsAtFrame, type OhlcBar } from './ohlc';

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
 */
export const chartGeometry = (props: CandlestickChartProps, barCount: number): ChartGeometry => {
  const axis = props.showPriceAxis ? PRICE_AXIS_WIDTH : 0;
  const plotLeft = CHART_PADDING;
  const plotTop = CHART_TOP;
  const plotWidth = Math.max(1, props.width - CHART_PADDING * 2 - axis);
  const plotHeight = Math.max(1, props.height - CHART_TOP - CHART_BOTTOM);
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

/** The provenance line: synthetic data and/or a simulated intrabar path. */
export const provenanceLabel = (props: CandlestickChartProps): string =>
  [
    props.dataSource === 'synthetic' ? 'SYNTHETIC DATA' : null,
    props.revealMode === 'simulated' ? 'SIMULATED INTRABAR' : null,
  ]
    .filter(Boolean)
    .join(' · ');

/**
 * Render the chart. `props` are the merged component props, `frame` is the
 * clip-relative frame.
 */
export const renderCandlestickChart = (
  props: CandlestickChartProps,
  frame: number,
): React.ReactElement => {
  const bars = Array.isArray(props.bars) ? props.bars : [];
  const geometry = chartGeometry(props, bars.length);
  const state = evaluateBarsAtFrame(
    bars,
    frame,
    props.framesPerBar,
    props.revealMode,
    props.simulationSeed,
  );

  if (state.bars.length === 0) {
    return (
      <svg
        data-testid="candlestick-chart"
        width={props.width}
        height={props.height}
        viewBox={`0 0 ${props.width} ${props.height}`}
      />
    );
  }

  // The scale comes from the visible bars only — a future bar never moves it.
  const visible = computePriceRange(
    state.bars.map((bar) => ({ t: bar.bar.t, o: bar.o, h: bar.h, l: bar.l, c: bar.c })),
  );
  // A bar that has not moved yet (a simulated bar at progress 0) collapses the
  // scale onto one price. Widen it symmetrically by a fixed fraction so the
  // grid stays readable without borrowing a price from a future bar.
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

  const candles = state.bars.map((bar, index) => {
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

  const provenance = provenanceLabel(props);

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
export const CandlestickChart: React.FC<{ props: CandlestickChartProps; frame: number }> = ({
  props,
  frame,
}) => renderCandlestickChart(props, frame);
