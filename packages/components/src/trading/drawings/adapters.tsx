/**
 * The eight independent drawing adapters.
 *
 * Every adapter draws inside its own box: an SVG of the drawing's own
 * `width` × `height`, with the points normalised inside it as 0..1
 * fractions (origin top-left, y down). A point at `(px, py)` is at
 * `(px * width, py * height)` in the box's own pixels.
 *
 * The composition already centres a clip's content on the clip's own
 * `x` / `y`, so the box is the element's own: no chart is read, and no
 * adapter needs an offset of its own.
 *
 * One rule for the position tool (OB-006): the adapter draws entry, stop
 * and target levels and, optionally, the risk/reward *ratio* between them.
 * It never draws a profit-and-loss figure and never implies a broker fill —
 * the ratio is a geometric fact about the drawn levels, not a claim about
 * money.
 */
import React from 'react';
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
  /** The drawing's own box, in pixels. */
  width: number;
  height: number;
  /** The drawing's own style. */
  style?: DrawingStyle;
  /** The creator's own figure, drawn beside the shape. */
  caption?: string;
  /** The drawing's points, as 0..1 fractions of the box. */
  points?: Record<string, DrawingPoint>;
  /** The position tool's direction and its ratio toggle. */
  position?: { direction: 'long' | 'short'; showRiskReward?: boolean };
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

/** A point of the drawing, in the box's own pixels. */
const pointAt = (
  points: Record<string, DrawingPoint> | undefined,
  key: string,
  width: number,
  height: number,
): { x: number; y: number } | null => {
  const point = points?.[key];
  if (!point) return null;
  return { x: point.x * width, y: point.y * height };
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

/**
 * Where a ray leaves the box.
 *
 * The trendline's ray runs to the edge of the drawing's own box, so it can
 * leave the shape it was drawn from without leaving the element.
 */
const boxExit = (
  x: number,
  y: number,
  ux: number,
  uy: number,
  width: number,
  height: number,
): { x: number; y: number } => {
  let t = Infinity;
  if (ux > 0) t = Math.min(t, (width - x) / ux);
  if (ux < 0) t = Math.min(t, -x / ux);
  if (uy > 0) t = Math.min(t, (height - y) / uy);
  if (uy < 0) t = Math.min(t, -y / uy);
  if (!Number.isFinite(t)) t = 0;
  return { x: x + ux * t, y: y + uy * t };
};

/** A horizontal rule across the box, at the box's vertical centre. */
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

/** A vertical rule at the point's x, down the box's full height. */
export const VerticalLineAdapter: React.FC<DrawingAdapterProps> = ({
  width,
  height,
  style,
  caption,
  points,
}) => {
  const at = pointAt(points, 'at', width, height);
  if (!at) return null;
  return (
    <svg
      data-testid="drawing-vertical-line"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
    >
      <line
        x1={at.x}
        x2={at.x}
        y1={0}
        y2={height}
        stroke={colorOf(style)}
        strokeWidth={widthOf(style)}
      />
      <Caption text={caption} style={style} x={Math.min(at.x + 4, width - 40)} y={12} />
    </svg>
  );
};

/** A line between two points, at any angle. */
export const TrendlineAdapter: React.FC<DrawingAdapterProps> = ({
  width,
  height,
  style,
  caption,
  points,
  trendline,
}) => {
  const start = pointAt(points, 'start', width, height);
  const end = pointAt(points, 'end', width, height);
  if (!start || !end) return null;

  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy) || 1;
  const ux = dx / length;
  const uy = dy / length;

  const ray = trendline?.ray ?? 'none';
  let x1 = start.x;
  let y1 = start.y;
  let x2 = end.x;
  let y2 = end.y;
  if (ray === 'left' || ray === 'both') {
    const exit = boxExit(start.x, start.y, -ux, -uy, width, height);
    x1 = exit.x;
    y1 = exit.y;
  }
  if (ray === 'right' || ray === 'both') {
    const exit = boxExit(end.x, end.y, ux, uy, width, height);
    x2 = exit.x;
    y2 = exit.y;
  }

  return (
    <svg
      data-testid="drawing-trendline"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
    >
      <line
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke={colorOf(style)}
        strokeWidth={widthOf(style)}
        strokeDasharray={ray === 'none' ? undefined : '6 4'}
      />
      {/* The two endpoints stay visible as the points the line is bound to. */}
      <circle cx={start.x} cy={start.y} r={3} fill={colorOf(style)} />
      <circle cx={end.x} cy={end.y} r={3} fill={colorOf(style)} />
      <Caption text={caption} style={style} x={4} y={12} />
    </svg>
  );
};

/** A vertical segment between the high and low points. */
export const HighLowLineAdapter: React.FC<DrawingAdapterProps> = ({
  width,
  height,
  style,
  caption,
  points,
}) => {
  const top = pointAt(points, 'top', width, height);
  const bottom = pointAt(points, 'bottom', width, height);
  if (!top || !bottom) return null;
  return (
    <svg
      data-testid="drawing-high-low-line"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
    >
      <line
        x1={top.x}
        x2={bottom.x}
        y1={top.y}
        y2={bottom.y}
        stroke={colorOf(style)}
        strokeWidth={widthOf(style)}
      />
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
  style,
  caption,
  points,
  label,
}) => {
  const at = pointAt(points, 'at', width, height);
  if (!at) return null;
  return (
    <svg
      data-testid="drawing-text-label"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
    >
      <text x={at.x} y={at.y} fontSize={fontOf(style)} fill={colorOf(style)}>
        {label?.text ?? ''}
      </text>
      <Caption text={caption} style={style} x={4} y={12} />
    </svg>
  );
};

/** An arrow between two points. */
export const ArrowAdapter: React.FC<DrawingAdapterProps> = ({
  width,
  height,
  style,
  caption,
  points,
}) => {
  const from = pointAt(points, 'from', width, height);
  const to = pointAt(points, 'to', width, height);
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
    <svg data-testid="drawing-arrow" width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
      <line x1={from.x} y1={from.y} x2={baseX} y2={baseY} stroke={color} strokeWidth={widthOf(style)} />
      <polygon
        points={`${to.x},${to.y} ${baseX - uy * 4},${baseY + ux * 4} ${baseX + uy * 4},${baseY - ux * 4}`}
        fill={color}
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
export const PositionAdapter: React.FC<DrawingAdapterProps> = ({
  width,
  height,
  style,
  caption,
  points,
  position,
}) => {
  const entry = pointAt(points, 'entry', width, height);
  const stop = pointAt(points, 'stop', width, height);
  const target = pointAt(points, 'target', width, height);
  if (!entry || !stop || !target) return null;

  const color = colorOf(style);
  const level = (y: number, name: string) => (
    <g key={name}>
      <line x1={0} x2={width} y1={y} y2={y} stroke={color} strokeWidth={widthOf(style)} />
    </g>
  );

  // The ratio is measured on the drawn levels, so it is a fact about the
  // drawing and not about a market.
  const reward = Math.abs(target.y - entry.y);
  const risk = Math.abs(entry.y - stop.y);
  const ratio = risk > 0 ? reward / risk : 0;

  return (
    <svg
      data-testid="drawing-position"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
    >
      {level(entry.y, 'entry')}
      {level(stop.y, 'stop')}
      {level(target.y, 'target')}
      {position?.showRiskReward ? (
        <text
          data-testid="drawing-risk-reward"
          x={4}
          y={Math.max(12, Math.min(entry.y, stop.y, target.y) - 6)}
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
