/**
 * The drawing tools, and how a click on the canvas becomes a drawing.
 *
 * A drawing is an ordinary clip: its own box, its own frame range and its
 * own points. It never names a market value, so it needs no chart, no pane
 * and no anchor resolution.
 */
import type { ChartPaneEvaluation, CandlestickChartProps } from '@chart-studio/components';
import type { Clip, DrawingKind, DrawingPoint, DrawingStyle } from '@chart-studio/core';

/** One of the drawing tools, and how many clicks it takes to place it. */
export interface DrawingTool {
  kind: DrawingKind;
  label: string;
  icon: string;
  /** How many clicks the creator makes: the first click starts the drawing. */
  clicks: number;
  /** The box a new drawing of this kind starts with. */
  width: number;
  height: number;
}

/** The drawing tools the editor offers, in the order the rail shows them. */
export const DRAWING_TOOLS: DrawingTool[] = [
  { kind: 'horizontalLine', label: 'Horizontal Line', icon: '─', clicks: 1, width: 480, height: 24 },
  { kind: 'verticalLine', label: 'Vertical Line', icon: '│', clicks: 1, width: 24, height: 320 },
  { kind: 'textLabel', label: 'Text Label', icon: 'T', clicks: 1, width: 200, height: 40 },
  { kind: 'position', label: 'Position', icon: '⇅', clicks: 1, width: 320, height: 240 },
  { kind: 'rectangle', label: 'Rectangle', icon: '▬', clicks: 1, width: 320, height: 180 },
  { kind: 'highLowLine', label: 'High/Low Line', icon: '↕', clicks: 2, width: 24, height: 320 },
  { kind: 'trendline', label: 'Trendline', icon: '╱', clicks: 2, width: 320, height: 180 },
  { kind: 'arrow', label: 'Arrow', icon: '→', clicks: 2, width: 320, height: 180 },
];

/** A click on the canvas, in composition pixels. */
export interface DrawingClick {
  x: number;
  y: number;
}

/**
 * What a new drawing needs: its own box, its own points and its own frame
 * range. The definition's defaults fill in the rest.
 */
export interface DrawingDraft {
  /** The box's centre, in composition pixels. */
  x: number;
  y: number;
  width: number;
  height: number;
  /** The drawing's points, as 0..1 fractions of its own box. */
  points?: Record<string, DrawingPoint>;
  caption?: string;
  position?: { direction: 'long' | 'short'; showRiskReward?: boolean };
  label?: { text?: string };
  trendline?: { ray?: 'none' | 'left' | 'right' | 'both' };
  style?: DrawingStyle;
  opacity?: number;
  /** The drawing's own frame range. */
  from?: number;
  durationInFrames?: number;
  /** The track the drawing lands on. */
  trackId?: string;
}

/** True when the element type is one of the drawing tools. */
export const isDrawingKind = (type: string): type is DrawingKind =>
  DRAWING_TOOLS.some((tool) => tool.kind === type);

/**
 * The draft a set of clicks makes.
 *
 * One click centres the tool's own box on the click. Two clicks bound the
 * drawing: the box is the rectangle between them and the points are the
 * clicks' own places inside it.
 */
export const drawingDraftFromClicks = (
  kind: DrawingKind,
  clicks: readonly DrawingClick[],
): DrawingDraft => {
  const tool = DRAWING_TOOLS.find((entry) => entry.kind === kind);
  const width = tool?.width ?? 320;
  const height = tool?.height ?? 180;

  const first = clicks[0];
  if (!first) return { x: 0, y: 0, width, height };
  if (clicks.length < 2) return { x: first.x, y: first.y, width, height };

  const second = clicks[1];
  if (kind === 'highLowLine') {
    // A high/low line is a vertical segment: the first click sets its x, the
    // two clicks set its top and bottom.
    const top = Math.min(first.y, second.y);
    const bottom = Math.max(first.y, second.y);
    return {
      x: first.x,
      y: (top + bottom) / 2,
      width,
      height: Math.max(1, bottom - top),
      points: { top: { x: 0.5, y: 0 }, bottom: { x: 0.5, y: 1 } },
    };
  }

  const left = Math.min(first.x, second.x);
  const right = Math.max(first.x, second.x);
  const top = Math.min(first.y, second.y);
  const bottom = Math.max(first.y, second.y);
  const boxWidth = Math.max(1, right - left);
  const boxHeight = Math.max(1, bottom - top);
  const fx = (click: DrawingClick) => (click.x - left) / boxWidth;
  const fy = (click: DrawingClick) => (click.y - top) / boxHeight;

  const points: Record<string, DrawingPoint> =
    kind === 'trendline'
      ? { start: { x: fx(first), y: fy(first) }, end: { x: fx(second), y: fy(second) } }
      : { from: { x: fx(first), y: fy(first) }, to: { x: fx(second), y: fy(second) } };

  return {
    x: left + boxWidth / 2,
    y: top + boxHeight / 2,
    width: boxWidth,
    height: boxHeight,
    points,
  };
};

/**
 * The chart and the pane a drawing would land on.
 */
export interface DrawingTarget {
  /** The chart clip, with the market it needs to resolve against. */
  chart: Clip;
  /** The pane the drawing would use. */
  paneId: string;
  /** That pane's state at the current frame. */
  pane: ChartPaneEvaluation;
  /** The chart's props, for the geometry the pane is measured in. */
  props: CandlestickChartProps;
}
