/**
 * The eight independent drawing adapters.
 *
 * A drawing's points are absolute: they are places in the composition, in
 * composition pixels. An adapter whose drawing has a box of its own converts
 * the points into the box's own pixels; an adapter whose drawing has no box —
 * a trend line, an arrow, a high/low line — draws where the points are.
 *
 * The composition centres a clip's content on the clip's own `x` / `y`, so a
 * drawing with a box needs no offset arithmetic of its own.
 *
 * One rule for the position tool (OB-006): the adapter draws entry, stop
 * and target levels and, optionally, the risk/reward *ratio* between them.
 * It never draws a profit-and-loss figure and never implies a broker fill —
 * the ratio is a geometric fact about the drawn levels, not a claim about
 * money.
 */
import React from 'react';
import { arrowShape } from './arrow-geometry';
import type { DrawingPoint, DrawingStyle } from '@chart-studio/core';

/**
 * The colours and weights a drawing carries.
 *
 * The type lives in core: the drawing model is core's, and the adapters read
 * it. Re-exported here for the callers that already import it from here.
 */
export type { DrawingStyle };

/** What every adapter receives. */
export interface DrawingAdapterProps {
  /** The drawing's own box, in pixels. Zero for a drawing that has no box. */
  width: number;
  height: number;
  /** The box's centre, in composition pixels — the point the content is centred on. */
  origin?: { x: number; y: number };
  /** The drawing's own style. */
  style?: DrawingStyle;
  /** The creator's own figure, drawn beside the shape. */
  caption?: string;
  /** The drawing's points, in composition pixels. */
  points?: Record<string, DrawingPoint>;
  /** The position tool's direction and its ratio toggle. */
  position?: { direction: 'long' | 'short'; showRiskReward?: boolean };
  /** The label tool's text. */
  label?: { text?: string };
}

const DEFAULT_COLOR = '#e8eaf0';
const DEFAULT_LINE_WIDTH = 1.5;

const colorOf = (style?: DrawingStyle): string => style?.color ?? DEFAULT_COLOR;
const widthOf = (style?: DrawingStyle): number => style?.lineWidth ?? DEFAULT_LINE_WIDTH;
const fontOf = (style?: DrawingStyle): number => style?.fontSize ?? 12;

/** The box's top-left corner, in composition pixels. */
const boxOrigin = (
  origin: { x: number; y: number } | undefined,
  width: number,
  height: number,
): { x: number; y: number } => ({
  x: (origin?.x ?? 0) - width / 2,
  y: (origin?.y ?? 0) - height / 2,
});

/** An absolute point, in the box's own pixels. */
const localPoint = (
  point: DrawingPoint,
  origin: { x: number; y: number } | undefined,
  width: number,
  height: number,
): { x: number; y: number } => {
  const topLeft = boxOrigin(origin, width, height);
  return { x: point.x - topLeft.x, y: point.y - topLeft.y };
};

/** The padding an endpoint shape carries, so its stroke and its points are not cut off. */
const ENDPOINT_PADDING = 8;

/**
 * The box that holds an endpoint shape.
 *
 * The shape has no box of its own — its two points are its shape — so the
 * box is derived from the points and the content is placed in composition
 * pixels.
 */
const endpointBox = (points: readonly DrawingPoint[]): {
  left: number;
  top: number;
  width: number;
  height: number;
} => {
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const left = Math.min(...xs) - ENDPOINT_PADDING;
  const top = Math.min(...ys) - ENDPOINT_PADDING;
  return {
    left,
    top,
    width: Math.max(1, Math.max(...xs) + ENDPOINT_PADDING - left),
    height: Math.max(1, Math.max(...ys) + ENDPOINT_PADDING - top),
  };
};

/** The caption, drawn beside the shape. The creator's own words, never a number we made. */
const Caption: React.FC<{ text?: string; style?: DrawingStyle; x: number; y: number }> = ({
  text,
  style,
  x,
  y,
}) =>
  text ? (
    <text
      data-testid="drawing-caption"
      x={x}
      y={y}
      fontSize={fontOf(style)}
      fill={colorOf(style)}
    >
      {text}
    </text>
  ) : null;

/** A horizontal rule across the band, at the band's centre. */
export const HorizontalLineAdapter: React.FC<DrawingAdapterProps> = ({
  width,
  height,
  style,
  caption,
}) => (
  <svg
    data-testid="drawing-horizontal-line"
    width={width}
    height={height}
    viewBox={`0 0 ${width} ${height}`}
  >
    <line
      x1={0}
      x2={width}
      y1={height / 2}
      y2={height / 2}
      stroke={colorOf(style)}
      strokeWidth={widthOf(style)}
    />
    <Caption text={caption} style={style} x={4} y={Math.max(10, height / 2 - 6)} />
  </svg>
);

/** A vertical rule down the band, at the band's own x. */
export const VerticalLineAdapter: React.FC<DrawingAdapterProps> = ({
  width,
  height,
  style,
  caption,
}) => (
  <svg
    data-testid="drawing-vertical-line"
    width={width}
    height={height}
    viewBox={`0 0 ${width} ${height}`}
  >
    <line
      x1={width / 2}
      x2={width / 2}
      y1={0}
      y2={height}
      stroke={colorOf(style)}
      strokeWidth={widthOf(style)}
    />
    <Caption text={caption} style={style} x={Math.min(width / 2 + 4, width - 40)} y={12} />
  </svg>
);

/** A line between two points, at any angle. */
export const TrendlineAdapter: React.FC<DrawingAdapterProps> = ({ style, caption, points }) => {
  const start = points?.start;
  const end = points?.end;
  if (!start || !end) return null;

  const box = endpointBox([start, end]);
  const x1 = start.x - box.left;
  const y1 = start.y - box.top;
  const x2 = end.x - box.left;
  const y2 = end.y - box.top;

  return (
    <svg
      data-testid="drawing-trendline"
      style={{ position: 'absolute', left: box.left, top: box.top }}
      width={box.width}
      height={box.height}
      viewBox={`0 0 ${box.width} ${box.height}`}
    >
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={colorOf(style)} strokeWidth={widthOf(style)} />
      {/* The two endpoints stay visible as the points the line is bound to. */}
      <circle cx={x1} cy={y1} r={3} fill={colorOf(style)} />
      <circle cx={x2} cy={y2} r={3} fill={colorOf(style)} />
      <Caption text={caption} style={style} x={4} y={12} />
    </svg>
  );
};

/** A vertical segment between the high and low points. */
export const HighLowLineAdapter: React.FC<DrawingAdapterProps> = ({ style, caption, points }) => {
  const top = points?.top;
  const bottom = points?.bottom;
  if (!top || !bottom) return null;

  const box = endpointBox([top, bottom]);
  const x1 = top.x - box.left;
  const y1 = top.y - box.top;
  const x2 = bottom.x - box.left;
  const y2 = bottom.y - box.top;

  return (
    <svg
      data-testid="drawing-high-low-line"
      style={{ position: 'absolute', left: box.left, top: box.top }}
      width={box.width}
      height={box.height}
      viewBox={`0 0 ${box.width} ${box.height}`}
    >
      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={colorOf(style)} strokeWidth={widthOf(style)} />
      <Caption text={caption} style={style} x={4} y={12} />
    </svg>
  );
};

/** The element's own box, outlined and optionally filled. */
export const RectangleAdapter: React.FC<DrawingAdapterProps> = ({
  width,
  height,
  style,
  caption,
}) => (
  <svg
    data-testid="drawing-rectangle"
    width={width}
    height={height}
    viewBox={`0 0 ${width} ${height}`}
  >
    <rect
      x={0}
      y={0}
      width={width}
      height={height}
      fill={colorOf(style)}
      fillOpacity={style?.fillOpacity ?? 0.16}
      stroke={colorOf(style)}
      strokeWidth={widthOf(style)}
      strokeOpacity={0.6}
    />
    <Caption text={caption} style={style} x={4} y={14} />
  </svg>
);

/** A text label at its point. */
export const TextLabelAdapter: React.FC<DrawingAdapterProps> = ({
  width,
  height,
  origin,
  style,
  caption,
  points,
  label,
}) => {
  const at = points?.at;
  if (!at) return null;
  const local = localPoint(at, origin, width, height);
  return (
    <svg
      data-testid="drawing-text-label"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
    >
      <text x={local.x} y={local.y} fontSize={fontOf(style)} fill={colorOf(style)}>
        {label?.text ?? ''}
      </text>
      <Caption text={caption} style={style} x={4} y={12} />
    </svg>
  );
};

/** An arrow between two points. */
export const ArrowAdapter: React.FC<DrawingAdapterProps> = ({ style, caption, points }) => {
  const from = points?.from;
  const to = points?.to;
  if (!from || !to) return null;

  const shape = arrowShape(from, to);
  const padding = Math.max(8, widthOf(style) / 2 + 1);
  const vertices = [from, to, ...shape.head];
  const left = Math.min(...vertices.map(p => p.x)) - padding;
  const top = Math.min(...vertices.map(p => p.y)) - padding;
  const box = {left, top, width: Math.max(...vertices.map(p => p.x)) - left + padding, height: Math.max(...vertices.map(p => p.y)) - top + padding};
  const x1 = from.x - left, y1 = from.y - top;
  const baseX = shape.shaftEnd.x - left, baseY = shape.shaftEnd.y - top;
  const headPoints = shape.head.map(p => `${p.x-left},${p.y-top}`).join(' ');
  const color = colorOf(style);
  return (
    <svg
      data-testid="drawing-arrow"
      style={{ position: 'absolute', left: box.left, top: box.top }}
      width={box.width}
      height={box.height}
      viewBox={`0 0 ${box.width} ${box.height}`}
    >
      <line x1={x1} y1={y1} x2={baseX} y2={baseY} stroke={color} strokeWidth={widthOf(style)} />
      <polygon
        points={headPoints}
        fill={color}
        stroke={color}
        strokeWidth={1}
        strokeLinejoin="round"
      />
      <Caption text={caption} style={style} x={4} y={12} />
    </svg>
  );
};

/**
 * Entry, stop and target levels.
 *
 * The risk/reward label states the *ratio* between the drawn levels — a
 * geometric fact about the drawing. It never states a profit and never
 * implies that a broker filled the position (OB-006).
 */
/** The reward zone: what the target is worth. */
const REWARD_FILL = '#26a69a';
/** The risk zone: what the stop costs. */
const RISK_FILL = '#ef5350';

export const PositionAdapter: React.FC<DrawingAdapterProps> = ({
  width,
  height,
  origin,
  style,
  caption,
  points,
  position,
}) => {
  const entry = points?.entry;
  const stop = points?.stop;
  const target = points?.target;
  if (!entry || !stop || !target) return null;

  const e = localPoint(entry, origin, width, height);
  const s = localPoint(stop, origin, width, height);
  const t = localPoint(target, origin, width, height);

  const color = colorOf(style);
  const level = (y: number, name: string) => (
    <g key={name}>
      <line x1={0} x2={width} y1={y} y2={y} stroke={color} strokeWidth={widthOf(style)} />
    </g>
  );

  // The ratio is measured on the drawn levels, so it is a fact about the
  // drawing and not about a market.
  const reward = Math.abs(t.y - e.y);
  const risk = Math.abs(e.y - s.y);
  const ratio = risk > 0 ? reward / risk : 0;

  // The two zones: what the target is worth above the entry, and what the
  // stop costs below it. A position reads as a position because of them.
  const rewardTop = Math.min(e.y, t.y);
  const rewardBottom = Math.max(e.y, t.y);
  const riskTop = Math.min(e.y, s.y);
  const riskBottom = Math.max(e.y, s.y);
  const zone = (top: number, bottom: number, fill: string, name: string) => (
    <rect
      key={name}
      data-testid={`drawing-position-zone-${name}`}
      x={0}
      y={top}
      width={width}
      height={Math.max(0, bottom - top)}
      fill={fill}
      opacity={0.28}
    />
  );

  return (
    <svg
      data-testid="drawing-position"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
    >
      {zone(rewardTop, rewardBottom, REWARD_FILL, 'reward')}
      {zone(riskTop, riskBottom, RISK_FILL, 'risk')}
      {level(e.y, 'entry')}
      {level(s.y, 'stop')}
      {level(t.y, 'target')}
      {position?.showRiskReward ? (
        <text
          data-testid="drawing-risk-reward"
          x={4}
          y={Math.max(12, Math.min(e.y, s.y, t.y) - 6)}
          fontSize={fontOf(style)}
          fill={color}
        >
          {`R ${ratio.toFixed(2)}`}
        </text>
      ) : null}
      <Caption text={caption} style={style} x={4} y={height - 6} />
    </svg>
  );
};
