import { describe, expect, it } from 'vitest';

import { resolveAnchors } from '@chart-studio/components';
import {
  evaluatePaneAt,
  framesPerBar,
  type Datasource,
  type MarketClock,
  type PaneSpec,
} from '@chart-studio/core';

import { buildDrawingAnchors, drawingBarId, isDrawingKind } from './drawings';

const CLOCK: MarketClock = {
  id: 'clock-1',
  unit: 'logical',
  referenceSeriesId: 'series-1',
  stepBars: 1,
  framesPerStep: 15,
};

/** 240 bars, so a factor-60 pane reveals four buckets. */
const datasource: Datasource = {
  id: 'series-1',
  origin: 'manual',
  revision: 'r1',
  label: 'Series 1',
  timeBasis: 'logical',
  bars: Array.from({ length: 240 }, (_, index) => ({
    id: `series-1:${index}`,
    t: index,
    o: 100 + index,
    h: 102 + index,
    l: 99 + index,
    c: 101 + index,
    v: 10,
  })),
};

const pane = (overrides: Partial<PaneSpec> = {}): PaneSpec => ({
  id: 'pane-1',
  name: 'Pane 1',
  seriesId: 'series-1',
  aggregation: { factor: 1 },
  rect: { x: 0, y: 0, width: 1, height: 1 },
  in: 0,
  out: 1000,
  opacity: 1,
  clock: { kind: 'reference' },
  priceRange: { mode: 'auto' },
  ...overrides,
});

const geometry = {
  plotLeft: 0,
  plotTop: 0,
  plotBottom: 100,
  plotRight: 100,
  plotWidth: 100,
  plotHeight: 100,
  slotWidth: 10,
  bodyWidth: 6,
};

describe('isDrawingKind', () => {
  it('recognises a drawing tool', () => {
    expect(isDrawingKind('priceLine')).toBe(true);
  });

  it('does not mistake an ordinary element for a drawing', () => {
    expect(isDrawingKind('candlestickChart')).toBe(false);
    expect(isDrawingKind('text')).toBe(false);
  });
});

describe('drawingBarId', () => {
  it('names the pane\'s own bucket on a bucketing pane', () => {
    expect(drawingBarId(pane({ aggregation: { factor: 60 } }), 3)).toBe('pane-1:3');
  });

  it('names the source bar on a pane that shows the source bars unchanged', () => {
    expect(drawingBarId(pane(), 3)).toBe('series-1:3');
  });
});

describe('a drawing anchor on a bucketing pane', () => {
  it('resolves against the bar the creator clicked', () => {
    const coarse = pane({ id: 'pane-coarse', aggregation: { factor: 60 } });

    // The frame at which the coarse pane holds four buckets.
    const frame = 3 * 60 * framesPerBar(CLOCK);
    const state = evaluatePaneAt(coarse, datasource, CLOCK, frame);

    // The pane's slot 3 holds the bucket 3 bar.
    expect(state.bars.map((bar) => bar.id)).toEqual([
      'pane-coarse:0',
      'pane-coarse:1',
      'pane-coarse:2',
      'pane-coarse:3',
    ]);

    const anchors = buildDrawingAnchors('verticalLine', [{ barIndex: 3, price: 100 }], coarse);
    expect(anchors.bar).toEqual({ kind: 'time', barId: 'pane-coarse:3' });

    const resolved = resolveAnchors(anchors, {
      bars: state.bars.map((bar) => ({
        id: bar.id,
        high: bar.h,
        low: bar.l,
        close: bar.c,
      })),
      geometry,
      range: state.range,
    });

    // The anchor points at slot 3, not at another slot.
    expect(resolved.bar).not.toBeNull();
    expect(resolved.bar?.x).toBe(geometry.plotLeft + 3.5 * geometry.slotWidth);
  });
});
