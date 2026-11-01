/**
 * The drawing tools, and how a click on the canvas becomes a drawing.
 *
 * A drawing is an ordinary clip: its own shape, its own frame range and its
 * own points. It never names a market value, so it needs no chart, no pane
 * and no anchor resolution.
 *
 * A drawing's points are absolute: they are places in the composition.
 */
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
  { kind: 'textLabel', label: 'Text Label', icon: 'T', clicks: 1, width: 200, height: 40 },
  { kind: 'position', label: 'Position', icon: '⇅', clicks: 1, width: 320, height: 240 },
  { kind: 'rectangle', label: 'Rectangle', icon: '▬', clicks: 1, width: 320, height: 180 },
  // The three tools below are placed by their own points: they have no box.
  { kind: 'highLowLine', label: 'High/Low Line', icon: '↕', clicks: 2 },
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
    case 'textLabel':
      // The label is its point.
      return { x: first.x, y: first.y, points: { at: { x: first.x, y: first.y } } };
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
    case 'highLowLine':
      // A high/low line is a vertical segment: the first click sets its x,
      // the two clicks set its top and its bottom.
      return {
        points: {
          top: { x: first.x, y: Math.min(first.y, second.y) },
          bottom: { x: first.x, y: Math.max(first.y, second.y) },
        },
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
