/**
 * The eight market-linked drawing adapters.
 *
 * Every adapter is a pure function of the resolved anchors: it draws SVG and
 * reads nothing else. The anchors arrive in the chart's own box coordinates,
 * so a drawing sits exactly on the price, the bar or the point it names.
 *
 * One rule for the position tool (OB-006): the adapter draws entry, stop and
 * target levels and, optionally, the risk/reward *ratio* between them. It
 * never draws a profit-and-loss figure and never implies a broker fill — the
 * ratio is a geometric fact about the drawn levels, not a claim about money.
 */
import React from 'react';
import type { DrawingStyle } from '@chart-studio/core';
import type { ChartGeometry } from '../chart';
import type { ResolvedAnchors } from './anchors';

/**
 * The colours and weights a drawing carries.
 *
 * The type lives in core: the drawing model is core's, and the adapters read
 * it. Re-exported here for the callers that already import it from here.
 */
export type { DrawingStyle };

/** What every adapter receives. */
export interface DrawingAdapterProps {
  /** The resolved anchors, in the chart's own box coordinates. */
  anchors: ResolvedAnchors;
  /** The pane's plot area, in the chart's own box coordinates. */
  geometry: ChartGeometry;
  /** The chart's box size, in pixels. */
  width: number;
  height: number;
  /** The drawing's own style. */
  style?: DrawingStyle;
  /** The position tool's levels. */
  position?: { direction: 'long' | 'short'; showRiskReward?: boolean };
  /** The zone tool's options. */
  zone?: { extendRight?: boolean };
  /** The trendline tool's options. */
  trendline?: { ray?: 'none' | 'left' | 'right' | 'both' };
  /** The label tool's text. */
  label?: { text?: string };
}

const DEFAULT_COLOR = '#e8eaf0';
const DEFAULT_LINE_WIDTH = 1.5;

const colorOf = (style?: DrawingStyle): string => style?.color ?? DEFAULT_COLOR;
const widthOf = (style?: DrawingStyle): number => style?.lineWidth ?? DEFAULT_LINE_WIDTH;
const fontOf = (style?: DrawingStyle): number => style?.fontSize ?? 12;

/**
 * The shell a drawing is drawn into.
 *
 * The compositor centres a clip's content on the clip's own `x`/`y`, so the
 * shell carries the offset that puts the drawing's box on the chart's box:
 * `left`/`top` are the difference between the chart's live position and the
 * drawing's own stored position. The drawing therefore follows the chart
 * wherever the chart goes.
 */
export const DrawingCanvas: React.FC<{
  kind: string;
  width: number;
  height: number;
  left: number;
  top: number;
  opacity: number;
  children?: React.ReactNode;
}> = ({ kind, width, height, left, top, opacity, children }) => (
  <div style={{ position: 'relative', width, height }}>
    <svg
      data-testid={`drawing-${kind}`}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      style={{ position: 'absolute', left, top, opacity }}
    >
      {children}
    </svg>
  </div>
);

/** A horizontal line across the plot at the anchor's price. */
export const PriceLineAdapter: React.FC<DrawingAdapterProps> = ({ anchors, geometry, style }) => {
  const anchor = anchors.price;
  if (!anchor) return null;
  return (
    <g data-testid="drawing-price-line">
      <line
        x1={geometry.plotLeft}
        x2={geometry.plotRight}
        y1={anchor.y}
        y2={anchor.y}
        stroke={colorOf(style)}
        strokeWidth={widthOf(style)}
      />
    </g>
  );
};

/** A vertical line between a bar's high and its low. */
export const HighLowLineAdapter: React.FC<DrawingAdapterProps> = ({ anchors, style }) => {
  const high = anchors.high;
  const low = anchors.low;
  if (!high || !low) return null;
  return (
    <g data-testid="drawing-high-low-line">
      <line
        x1={high.x}
        x2={low.x}
        y1={high.y}
        y2={low.y}
        stroke={colorOf(style)}
        strokeWidth={widthOf(style)}
      />
    </g>
  );
};

/** A vertical line at a bar. */
export const VerticalLineAdapter: React.FC<DrawingAdapterProps> = ({ anchors, geometry, style }) => {
  const anchor = anchors.bar;
  if (!anchor) return null;
  return (
    <g data-testid="drawing-vertical-line">
      <line
        x1={anchor.x}
        x2={anchor.x}
        y1={geometry.plotTop}
        y2={geometry.plotBottom}
        stroke={colorOf(style)}
        strokeWidth={widthOf(style)}
      />
    </g>
  );
};

/** A line between two points, each a bar and a price. */
export const TrendlineAdapter: React.FC<DrawingAdapterProps> = ({
  anchors,
  geometry,
  width,
  height,
  style,
  trendline,
}) => {
  const start = anchors.start;
  const end = anchors.end;
  if (!start || !end) return null;

  // The line's direction, used to extend it past an endpoint when the creator
  // asks for a ray (OB-005).
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy) || 1;
  const ux = dx / length;
  const uy = dy / length;

  const ray = trendline?.ray ?? 'none';
  // The ray runs to the edge of the chart's box, so it can leave the plot.
  const reach = Math.max(width, height) * 2;
  let x1 = start.x;
  let y1 = start.y;
  let x2 = end.x;
  let y2 = end.y;
  if (ray === 'left' || ray === 'both') {
    x1 = start.x - ux * reach;
    y1 = start.y - uy * reach;
  }
  if (ray === 'right' || ray === 'both') {
    x2 = end.x + ux * reach;
    y2 = end.y + uy * reach;
  }

  return (
    <g data-testid="drawing-trendline">
      <line
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke={colorOf(style)}
        strokeWidth={widthOf(style)}
        strokeDasharray={ray === 'none' ? undefined : '6 4'}
      />
      {/* The two endpoints stay visible as the anchors the line is bound to. */}
      <circle cx={start.x} cy={start.y} r={3} fill={colorOf(style)} />
      <circle cx={end.x} cy={end.y} r={3} fill={colorOf(style)} />
    </g>
  );
};

/** A filled band between two prices. */
export const PriceZoneAdapter: React.FC<DrawingAdapterProps> = ({
  anchors,
  geometry,
  width,
  style,
  zone,
}) => {
  const top = anchors.top;
  const bottom = anchors.bottom;
  if (!top || !bottom) return null;
  const left = anchors.start?.x ?? geometry.plotLeft;
  // The zone ends at its own interval, or at the chart's right edge when the
  // creator asks it to run on.
  const right = zone?.extendRight ? width : (anchors.end?.x ?? geometry.plotRight);
  const topY = Math.min(top.y, bottom.y);
  const height = Math.max(1, Math.abs(bottom.y - top.y));
  return (
    <g data-testid="drawing-price-zone">
      <rect
        x={Math.min(left, right)}
        y={topY}
        width={Math.max(1, Math.abs(right - left))}
        height={height}
        fill={colorOf(style)}
        fillOpacity={style?.fillOpacity ?? 0.16}
        stroke={colorOf(style)}
        strokeWidth={widthOf(style)}
        strokeOpacity={0.6}
      />
    </g>
  );
};

/** A text label at an anchor. */
export const TextLabelAdapter: React.FC<DrawingAdapterProps> = ({ anchors, style, label }) => {
  const anchor = anchors.at;
  if (!anchor) return null;
  return (
    <g data-testid="drawing-text-label">
      <text x={anchor.x} y={anchor.y} fontSize={fontOf(style)} fill={colorOf(style)}>
        {label?.text ?? ''}
      </text>
    </g>
  );
};

/** An arrow between two points. */
export const ArrowAdapter: React.FC<DrawingAdapterProps> = ({ anchors, style }) => {
  const from = anchors.from;
  const to = anchors.to;
  if (!from || !to) return null;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy) || 1;
  // The head is a fixed-size triangle on the line's direction.
  const head = 10;
  const ux = dx / length;
  const uy = dy / length;
  const baseX = to.x - ux * head;
  const baseY = to.y - uy * head;
  const color = colorOf(style);
  return (
    <g data-testid="drawing-arrow">
      <line
        x1={from.x}
        y1={from.y}
        x2={baseX}
        y2={baseY}
        stroke={color}
        strokeWidth={widthOf(style)}
      />
      <polygon
        points={`${to.x},${to.y} ${baseX - uy * 4},${baseY + ux * 4} ${baseX + uy * 4},${baseY - ux * 4}`}
        fill={color}
      />
    </g>
  );
};

/**
 * Entry, stop and target levels.
 *
 * The risk/reward label states the *ratio* between the drawn levels — a
 * geometric fact about the drawing. It never states a profit and never
 * implies that a broker filled the position (OB-006).
 */
export const PositionAdapter: React.FC<DrawingAdapterProps> = ({
  anchors,
  geometry,
  style,
  position,
}) => {
  const entry = anchors.entry;
  const stop = anchors.stop;
  const target = anchors.target;
  if (!entry || !stop || !target) return null;

  const color = colorOf(style);
  const level = (y: number, name: string) => (
    <g key={name}>
      <line
        x1={geometry.plotLeft}
        x2={geometry.plotRight}
        y1={y}
        y2={y}
        stroke={color}
        strokeWidth={widthOf(style)}
        strokeDasharray={name === 'entry' ? undefined : '4 3'}
      />
      <text x={geometry.plotLeft + 4} y={y - 4} fontSize={fontOf(style)} fill={color}>
        {name.toUpperCase()}
      </text>
    </g>
  );

  const risk = Math.abs(entry.y - stop.y);
  const reward = Math.abs(target.y - entry.y);
  const ratio = risk > 0 ? reward / risk : null;

  return (
    <g data-testid="drawing-position">
      <text
        data-testid="drawing-position-direction"
        x={geometry.plotLeft + 4}
        y={entry.y - 16}
        fontSize={fontOf(style)}
        fill={color}
      >
        {(position?.direction ?? 'long').toUpperCase()}
      </text>
      {level(entry.y, 'entry')}
      {level(stop.y, 'stop')}
      {level(target.y, 'target')}
      {position?.showRiskReward && ratio !== null ? (
        <text
          data-testid="drawing-risk-reward"
          x={geometry.plotRight - 4}
          y={entry.y - 4}
          fontSize={fontOf(style)}
          textAnchor="end"
          fill={color}
        >
          {`R ${ratio.toFixed(2)}`}
        </text>
      ) : null}
    </g>
  );
};
