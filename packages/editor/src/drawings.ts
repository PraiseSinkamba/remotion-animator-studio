/**
 * The drawing tools, and how a click on the canvas becomes a drawing.
 *
 * A drawing is an ordinary clip: its own box, its own frame range and its
 * own points. It never names a market value, so it needs no chart, no pane
 * and no anchor resolution.
 */
import type { DrawingKind, DrawingPoint, DrawingStyle } from '@chart-studio/core';

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

/** The box a drawing occupies: its centre and its size, in composition pixels. */
export interface DrawingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** The padding a two-click drawing's box carries on each side. */
export const DRAWING_BOX_PADDING = 16;
/** The smallest a drawing's box may be, in either axis. */
export const DRAWING_BOX_MINIMUM = 32;

/**
 * The box a set of clicks makes.
 *
 * One click centres the tool's own box on the click. Two clicks bound the
 * drawing: the box is the rectangle between them, padded so the shape never
 * touches its own edge, and never smaller than the minimum in either axis.
 *
 * This is the one place a drawing's box is decided.
 */
export const defaultDrawingBox = (
  kind: DrawingKind,
  picks: readonly DrawingClick[],
): DrawingBox => {
  const tool = DRAWING_TOOLS.find((entry) => entry.kind === kind);
  const width = tool?.width ?? 320;
  const height = tool?.height ?? 180;

  const first = picks[0];
  if (!first) return { x: 0, y: 0, width, height };
  if (picks.length < 2) return { x: first.x, y: first.y, width, height };

  const second = picks[1];
  const left = Math.min(first.x, second.x);
  const right = Math.max(first.x, second.x);
  const top = Math.min(first.y, second.y);
  const bottom = Math.max(first.y, second.y);

  return {
    x: (left + right) / 2,
    y: (top + bottom) / 2,
    width: Math.max(DRAWING_BOX_MINIMUM, right - left + DRAWING_BOX_PADDING * 2),
    height: Math.max(DRAWING_BOX_MINIMUM, bottom - top + DRAWING_BOX_PADDING * 2),
  };
};

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
    const height = Math.max(DRAWING_BOX_MINIMUM, bottom - top);
    const boxTop = (top + bottom) / 2 - height / 2;
    return {
      x: first.x,
      y: (top + bottom) / 2,
      width: Math.max(DRAWING_BOX_MINIMUM, tool?.width ?? 24),
      height,
      points: {
        top: { x: 0.5, y: (top - boxTop) / height },
        bottom: { x: 0.5, y: (bottom - boxTop) / height },
      },
    };
  }

  const box = defaultDrawingBox(kind, clicks);
  const boxLeft = box.x - box.width / 2;
  const boxTop = box.y - box.height / 2;
  const fx = (click: DrawingClick) => (click.x - boxLeft) / box.width;
  const fy = (click: DrawingClick) => (click.y - boxTop) / box.height;

  const points: Record<string, DrawingPoint> =
    kind === 'trendline'
      ? { start: { x: fx(first), y: fy(first) }, end: { x: fx(second), y: fy(second) } }
      : { from: { x: fx(first), y: fy(first) }, to: { x: fx(second), y: fy(second) } };

  return {
    x: box.x,
    y: box.y,
    width: box.width,
    height: box.height,
    points,
  };
};


