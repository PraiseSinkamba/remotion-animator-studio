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

  it('gives every kind with a shape of its own a default size', () => {
    for (const tool of DRAWING_TOOLS) {
      if (tool.kind === 'trendline' || tool.kind === 'arrow' || tool.kind === 'highLowLine') {
        // These three are placed by their points: they have no box.
        expect(tool.width).toBeUndefined();
        expect(tool.height).toBeUndefined();
        continue;
      }
      expect(tool.width ?? tool.height ?? 0).toBeGreaterThan(0);
    }
  });
});

describe('drawingDraftFromClicks', () => {
  it('places a horizontal rule by its centre and its length', () => {
    const draft = drawingDraftFromClicks('horizontalLine', [{ x: 400, y: 300 }]);
    expect(draft.x).toBe(400);
    expect(draft.y).toBe(300);
    expect(draft.width).toBe(480);
    expect(draft.height).toBeUndefined();
    expect(draft.points).toBeUndefined();
  });

  it('places a vertical rule by its own x and its length', () => {
    const draft = drawingDraftFromClicks('verticalLine', [{ x: 400, y: 300 }]);
    expect(draft.x).toBe(400);
    expect(draft.y).toBe(300);
    expect(draft.height).toBe(320);
    expect(draft.width).toBeUndefined();
  });

  it('places a text label at the click', () => {
    const draft = drawingDraftFromClicks('textLabel', [{ x: 400, y: 300 }]);
    expect(draft.x).toBe(400);
    expect(draft.y).toBe(300);
    expect(draft.points).toEqual({ at: { x: 400, y: 300 } });
  });

  it('gives the position tool its own box and its three levels', () => {
    const draft = drawingDraftFromClicks('position', [{ x: 400, y: 300 }]);
    expect(draft.width).toBe(320);
    expect(draft.height).toBe(240);
    // The levels are places in the composition: the box's left edge, and the
    // three levels inside the box.
    expect(draft.points).toEqual({
      entry: { x: 240, y: 300 },
      stop: { x: 240, y: 360 },
      target: { x: 240, y: 240 },
    });
  });

  it('makes a trend line the two clicks themselves', () => {
    const draft = drawingDraftFromClicks('trendline', [
      { x: 100, y: 200 },
      { x: 300, y: 100 },
    ]);
    expect(draft.points).toEqual({
      start: { x: 100, y: 200 },
      end: { x: 300, y: 100 },
    });
    expect(draft.x).toBeUndefined();
    expect(draft.y).toBeUndefined();
    expect(draft.width).toBeUndefined();
    expect(draft.height).toBeUndefined();
  });

  it('makes an arrow the two clicks themselves', () => {
    const draft = drawingDraftFromClicks('arrow', [
      { x: 100, y: 200 },
      { x: 300, y: 100 },
    ]);
    expect(draft.points).toEqual({
      from: { x: 100, y: 200 },
      to: { x: 300, y: 100 },
    });
    expect(draft.x).toBeUndefined();
  });

  it('makes a high and low line a vertical segment', () => {
    const draft = drawingDraftFromClicks('highLowLine', [
      { x: 500, y: 100 },
      { x: 520, y: 300 },
    ]);
    expect(draft.points).toEqual({
      top: { x: 500, y: 100 },
      bottom: { x: 500, y: 300 },
    });
    expect(draft.x).toBeUndefined();
    expect(draft.height).toBeUndefined();
  });
});
