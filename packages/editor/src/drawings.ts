/**
 * The drawing tools, and how a click on the canvas becomes a drawing.
 *
 * A drawing is an ordinary clip: its own shape, its own frame range and its
 * own points. It never names a market value, so it needs no chart, no pane
 * and no anchor resolution.
 *
 * A drawing's points are absolute: they are places in the composition.
 */
import { getComponent } from '@chart-studio/components';
import type { DrawingKind, DrawingPoint, DrawingStyle } from '@chart-studio/core';

/** One of the drawing tools, and how many clicks it takes to place it. */
export interface DrawingTool {
  kind: DrawingKind;
  label: string;
  icon: string;
  /** How many clicks the creator makes: the first click starts the drawing. */
  clicks: number;
  /** The length of a rule, or the size of a box, in composition pixels. */
  width?: number;
  height?: number;
}

/** The drawing tools the editor offers, in the order the rail shows them. */
export const DRAWING_TOOLS: DrawingTool[] = [
  { kind: 'horizontalLine', label: 'Horizontal Line', icon: '─', clicks: 1, width: 480 },
  { kind: 'verticalLine', label: 'Vertical Line', icon: '│', clicks: 1, height: 320 },
  { kind: 'position', label: 'Position', icon: '⇅', clicks: 1, width: 320, height: 240 },
  { kind: 'rectangle', label: 'Rectangle', icon: '▬', clicks: 1, width: 320, height: 180 },
  // The three tools below are placed by their own points: they have no box.
  { kind: 'trendline', label: 'Trendline', icon: '╱', clicks: 2 },
  { kind: 'arrow', label: 'Arrow', icon: '→', clicks: 2 },
];

/** A click on the canvas, in composition pixels. */
export interface DrawingClick {
  x: number;
  y: number;
}

/**
 * What a new drawing needs: its own shape, its own points and its own frame
 * range. The definition's defaults fill in the rest.
 *
 * A box is optional: a trend line, an arrow and a high/low line are placed
 * by their points alone.
 */
export interface DrawingDraft {
  /** The anchor, in composition pixels: the point the content is centred on. */
  x?: number;
  y?: number;
  /** The drawing's own box, where it has one. */
  width?: number;
  height?: number;
  /** The drawing's points, in composition pixels. */
  points?: Record<string, DrawingPoint>;
  caption?: string;
  position?: { direction: 'long' | 'short'; showRiskReward?: boolean };
  label?: { text?: string };
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
 * One click places the drawing: a rule's centre, a label's point, a box's
 * centre. Two clicks bound the shape: the two points are the shape itself,
 * in composition pixels.
 */
export const drawingDraftFromClicks = (
  kind: DrawingKind,
  clicks: readonly DrawingClick[],
): DrawingDraft => {
  const tool = DRAWING_TOOLS.find((entry) => entry.kind === kind);
  const first = clicks[0];
  if (!first) return {};
  const second = clicks[1] ?? first;

  switch (kind) {
    case 'horizontalLine':
      // The rule's centre and its length.
      return { x: first.x, y: first.y, width: tool?.width ?? 480 };
    case 'verticalLine':
      // The rule's own x, the centre of its span and its length.
      return { x: first.x, y: first.y, height: tool?.height ?? 320 };
    case 'position': {
      // The tool's own box, and the three levels inside it.
      const width = tool?.width ?? 320;
      const height = tool?.height ?? 240;
      const left = first.x - width / 2;
      const top = first.y - height / 2;
      return {
        x: first.x,
        y: first.y,
        width,
        height,
        points: {
          entry: { x: left, y: top + height * 0.5 },
          stop: { x: left, y: top + height * 0.75 },
          target: { x: left, y: top + height * 0.25 },
        },
      };
    }
    case 'rectangle':
      return {
        x: first.x,
        y: first.y,
        width: tool?.width ?? 320,
        height: tool?.height ?? 180,
      };
    case 'trendline':
      return {
        points: {
          start: { x: first.x, y: first.y },
          end: { x: second.x, y: second.y },
        },
      };
    case 'arrow':
      return {
        points: {
          from: { x: first.x, y: first.y },
          to: { x: second.x, y: second.y },
        },
      };
  }
};

/**
 * The draft a drop makes.
 *
 * A tool that takes two clicks cannot be completed by one drop, so the drop
 * places the shape with its own default proportions at the pointer and the
 * creator drags its ends into place — which is what every drawing tool does.
 */
export const defaultDrawingDraft = (
  kind: DrawingKind,
  at: { x: number; y: number },
): DrawingDraft => {
  const defaults = (getComponent(kind)?.defaults ?? {}) as Record<string, unknown>;
  const points = defaults.points as Record<string, DrawingPoint> | undefined;

  // Where the shape is centred. A shape with an anchor is centred on it; a
  // shape made of points has no anchor, so its points are its centre.
  let centreX = Number(defaults.x ?? 0);
  let centreY = Number(defaults.y ?? 0);
  if (defaults.x === undefined && defaults.y === undefined && points) {
    const keys = Object.keys(points);
    centreX = keys.reduce((sum, key) => sum + points[key].x, 0) / keys.length;
    centreY = keys.reduce((sum, key) => sum + points[key].y, 0) / keys.length;
  }
  const dx = at.x - centreX;
  const dy = at.y - centreY;

  const moved = points
    ? Object.fromEntries(
        Object.entries(points).map(([key, point]) => [key, { x: point.x + dx, y: point.y + dy }]),
      )
    : undefined;

  return {
    x: at.x,
    y: at.y,
    ...(typeof defaults.width === 'number' ? { width: defaults.width } : {}),
    ...(typeof defaults.height === 'number' ? { height: defaults.height } : {}),
    ...(moved ? { points: moved } : {}),
  };
};
