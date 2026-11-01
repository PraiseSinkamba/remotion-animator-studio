import { describe, expect, it } from 'vitest';

import { DRAWING_TOOLS, drawingDraftFromClicks, isDrawingKind } from './drawings';

describe('isDrawingKind', () => {
  it('recognises a drawing tool', () => {
    expect(isDrawingKind('horizontalLine')).toBe(true);
    expect(isDrawingKind('rectangle')).toBe(true);
  });

  it('does not mistake an ordinary element for a drawing', () => {
    expect(isDrawingKind('candlestickChart')).toBe(false);
    expect(isDrawingKind('text')).toBe(false);
  });
});

describe('the drawing tools', () => {
  it('offers the eight independent kinds', () => {
    expect(DRAWING_TOOLS.map((tool) => tool.kind)).toEqual([
      'horizontalLine',
      'verticalLine',
      'textLabel',
      'position',
      'rectangle',
      'highLowLine',
      'trendline',
      'arrow',
    ]);
  });

  it('says how many clicks each kind takes', () => {
    const clicks = Object.fromEntries(DRAWING_TOOLS.map((tool) => [tool.kind, tool.clicks]));
    expect(clicks).toEqual({
      horizontalLine: 1,
      verticalLine: 1,
      textLabel: 1,
      position: 1,
      rectangle: 1,
      highLowLine: 2,
      trendline: 2,
      arrow: 2,
    });
  });

  it('gives every kind a default box', () => {
    for (const tool of DRAWING_TOOLS) {
      expect(tool.width).toBeGreaterThan(0);
      expect(tool.height).toBeGreaterThan(0);
    }
  });
});

describe('drawingDraftFromClicks', () => {
  it('centres the kind\'s own box on a single click', () => {
    const draft = drawingDraftFromClicks('horizontalLine', [{ x: 400, y: 300 }]);
    expect(draft.x).toBe(400);
    expect(draft.y).toBe(300);
    expect(draft.width).toBe(480);
    expect(draft.height).toBe(24);
    expect(draft.points).toBeUndefined();
  });

  it('bounds a two-click drawing by the rectangle between the clicks, padded', () => {
    // The box is the rectangle between the clicks, padded by 16 on each side
    // so the shape never touches its own edge.
    const draft = drawingDraftFromClicks('trendline', [
      { x: 100, y: 200 },
      { x: 300, y: 100 },
    ]);
    expect(draft.x).toBe(200);
    expect(draft.y).toBe(150);
    expect(draft.width).toBe(232);
    expect(draft.height).toBe(132);
    // The clicks keep their own places inside the padded box: the box's left
    // edge is 16 px before the first click and its top edge 16 px above it.
    expect(draft.points).toEqual({
      start: { x: 16 / 232, y: 116 / 132 },
      end: { x: 216 / 232, y: 16 / 132 },
    });
  });

  it('makes a high and low line a vertical segment', () => {
    const draft = drawingDraftFromClicks('highLowLine', [
      { x: 500, y: 100 },
      { x: 520, y: 300 },
    ]);
    expect(draft.x).toBe(500);
    expect(draft.y).toBe(200);
    expect(draft.height).toBe(200);
    expect(draft.points).toEqual({
      top: { x: 0.5, y: 0 },
      bottom: { x: 0.5, y: 1 },
    });
  });
});
