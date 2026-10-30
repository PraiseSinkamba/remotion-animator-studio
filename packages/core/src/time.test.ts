import { describe, expect, it } from 'vitest';

import type { Datasource, OhlcBar } from './series';
import type { MarketClock, PaneRelation, PaneSpec } from './elements';
import {
  DEFAULT_FRAMES_PER_STEP,
  evaluateClockAt,
  evaluatePaneAt,
  evaluateRelation,
  framesPerBar,
  paneBarCount,
} from './time';

const CLOCK: MarketClock = {
  id: 'clock-1',
  unit: 'logical',
  referenceSeriesId: 'series-1',
  stepBars: 1,
  framesPerStep: 15,
};

const makeBar = (index: number, o: number, h: number, l: number, c: number): OhlcBar => ({
  id: `bar-${index}`,
  t: index,
  o,
  h,
  l,
  c,
  v: 10,
});

/** Six bars; the later ones reach higher and lower than the first. */
const BARS: OhlcBar[] = [
  makeBar(0, 100, 102, 99, 101),
  makeBar(1, 101, 104, 100, 103),
  makeBar(2, 103, 106, 101, 102),
  makeBar(3, 102, 105, 98, 104),
  makeBar(4, 104, 120, 90, 110),
  makeBar(5, 110, 130, 80, 125),
];

const datasource: Datasource = {
  id: 'series-1',
  origin: 'manual',
  revision: 'r1',
  label: 'Series 1',
  timeBasis: 'logical',
  bars: BARS,
};

const makePane = (overrides: Partial<PaneSpec> = {}): PaneSpec => ({
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

/** The chart-local frame at which the clock reaches the given bar index. */
const frameOfBar = (index: number): number => index * framesPerBar(CLOCK);

describe('evaluateClockAt', () => {
  it('maps a frame to the reference bar index and the progress within it', () => {
    expect(evaluateClockAt(CLOCK, 0)).toEqual({ referenceIndex: 0, progress: 0 });

    const step = framesPerBar(CLOCK);
    const mid = evaluateClockAt(CLOCK, step / 2);
    expect(mid.referenceIndex).toBe(0);
    expect(mid.progress).toBeCloseTo(0.5, 10);

    const next = evaluateClockAt(CLOCK, step);
    expect(next.referenceIndex).toBe(1);
    expect(next.progress).toBeCloseTo(0, 10);
  });

  it('takes its pace from the clock, so a creator can change how fast the market moves', () => {
    const slow: MarketClock = { ...CLOCK, framesPerStep: 60 };
    const fast: MarketClock = { ...CLOCK, framesPerStep: 5 };

    expect(framesPerBar(slow)).toBe(60);
    expect(framesPerBar(fast)).toBe(5);

    // One second of video at 30fps: the slow clock has only just started its
    // first candle, the fast clock has finished six.
    expect(evaluateClockAt(slow, 30).referenceIndex).toBe(0);
    expect(evaluateClockAt(fast, 30).referenceIndex).toBe(6);
  });

  it('falls back to the default pace for a clock that states none', () => {
    const unstated = { ...CLOCK, framesPerStep: 0 };
    expect(framesPerBar(unstated)).toBe(DEFAULT_FRAMES_PER_STEP);
  });
});

describe('evaluatePaneAt', () => {
  it('returns no bars before the first frame', () => {
    const state = evaluatePaneAt(makePane(), datasource, CLOCK, -1);
    expect(state.bars).toEqual([]);
    expect(state.activeIndex).toBe(-1);
    expect(state.developing).toBe(false);
  });

  it('never returns a bar beyond the as-of index', () => {
    const state = evaluatePaneAt(makePane(), datasource, CLOCK, frameOfBar(2) + 3);
    expect(state.bars).toHaveLength(3);
    expect(state.bars.map((bar) => bar.id)).toEqual(['bar-0', 'bar-1', 'bar-2']);
    expect(state.activeIndex).toBe(2);
  });

  it('does not let a future bar move the price range', () => {
    const state = evaluatePaneAt(makePane(), datasource, CLOCK, 0);
    expect(state.range).toEqual({ min: 99, max: 102 });

    const later = evaluatePaneAt(makePane(), datasource, CLOCK, frameOfBar(5));
    expect(later.range).toEqual({ min: 80, max: 130 });
  });

  it('aggregates only the constituents at or before the as-of index', () => {
    const pane = makePane({ aggregation: { factor: 3 } });

    // Source index 4: bucket 1 holds constituents 3 and 4 only, not 5.
    const state = evaluatePaneAt(pane, datasource, CLOCK, frameOfBar(4));
    expect(state.bars).toHaveLength(2);
    expect(state.developing).toBe(true);

    const partial = state.bars[1];
    expect(partial.id).toBe('pane-1:1');
    expect(partial.o).toBe(BARS[3].o);
    expect(partial.c).toBe(BARS[4].c);
    expect(partial.h).toBe(Math.max(BARS[3].h, BARS[4].h));
    expect(partial.l).toBe(Math.min(BARS[3].l, BARS[4].l));
    expect(partial.h).not.toBe(BARS[5].h);
    expect(partial.l).not.toBe(BARS[5].l);
  });

  it('marks a complete bucket as not developing', () => {
    const pane = makePane({ aggregation: { factor: 3 } });
    const state = evaluatePaneAt(pane, datasource, CLOCK, frameOfBar(2));
    expect(state.developing).toBe(false);
    expect(state.bars).toHaveLength(1);
    expect(state.bars[0].h).toBe(Math.max(BARS[0].h, BARS[1].h, BARS[2].h));
    expect(state.bars[0].l).toBe(Math.min(BARS[0].l, BARS[1].l, BARS[2].l));
  });

  it('shifts the source index by the authored offset', () => {
    const pane = makePane({ clock: { kind: 'offset', offsetBars: 2 } });
    const state = evaluatePaneAt(pane, datasource, CLOCK, frameOfBar(1));
    expect(state.bars.map((bar) => bar.id)).toEqual(['bar-0', 'bar-1', 'bar-2', 'bar-3']);
    expect(state.activeIndex).toBe(3);
  });

  it('uses the author\'s range when the price range is fixed', () => {
    const pane = makePane({ priceRange: { mode: 'fixed', min: 0, max: 1000 } });
    const state = evaluatePaneAt(pane, datasource, CLOCK, 0);
    expect(state.range).toEqual({ min: 0, max: 1000 });
  });

  it('refuses a utc binding on a series that has no utc basis', () => {
    const pane = makePane({ clock: { kind: 'utc' } });
    expect(() => evaluatePaneAt(pane, datasource, CLOCK, 0)).toThrow(/utc/);
  });

  it('buckets a pane\'s bars by the ladder rung\'s base units', () => {
    // The source is a 1m base, so the 6H rung is 360 base units wide.
    const base = Array.from({ length: 1000 }, (_, index) => makeBar(index, index, index + 1, index - 1, index));
    const ladderSource: Datasource = { ...datasource, bars: base };
    const pane = makePane({ timeframeId: '6H', aggregation: { factor: 360 } });

    const state = evaluatePaneAt(pane, ladderSource, CLOCK, frameOfBar(720));
    expect(state.bars.map((bar) => bar.id)).toEqual(['pane-1:0', 'pane-1:1', 'pane-1:2']);
    // The second bucket opens on base unit 360, the third on 720.
    expect(state.bars[1].t).toBe(base[360].t);
    expect(state.bars[2].t).toBe(base[720].t);
  });

  it('never aligns two series by row index', () => {
    const other: Datasource = {
      ...datasource,
      id: 'series-2',
      label: 'Series 2',
      bars: BARS.map((bar) => ({ ...bar, id: `other-${bar.id}`, o: bar.o + 1000 })),
    };
    // The pane reads series 2 from its own first bar; it is not lined up with
    // series 1's rows.
    const pane = makePane({ id: 'pane-other', seriesId: 'series-2' });
    const state = evaluatePaneAt(pane, other, CLOCK, frameOfBar(2));
    expect(state.bars.map((bar) => bar.id)).toEqual(['other-bar-0', 'other-bar-1', 'other-bar-2']);
    expect(state.bars[0].o).toBe(BARS[0].o + 1000);
  });

  it('advances a lockstep pair together on the shared clock', () => {
    const other: Datasource = {
      ...datasource,
      id: 'series-2',
      label: 'Series 2',
      bars: BARS.map((bar) => ({ ...bar, id: `other-${bar.id}` })),
    };
    const first = makePane({ id: 'pane-a', seriesId: 'series-1', timeframeId: '1m' });
    const second = makePane({
      id: 'pane-b',
      seriesId: 'series-2',
      timeframeId: '1m',
      clock: { kind: 'offset', offsetBars: 0 },
    });

    for (const index of [0, 1, 4]) {
      const frame = frameOfBar(index);
      const left = evaluatePaneAt(first, datasource, CLOCK, frame);
      const right = evaluatePaneAt(second, other, CLOCK, frame);
      expect(right.bars).toHaveLength(left.bars.length);
      expect(right.activeIndex).toBe(left.activeIndex);
    }
  });
});

describe('evaluateRelation', () => {
  const fine = makePane({ id: 'pane-fine', timeframeId: '1m', aggregation: { factor: 1 } });
  const coarse = makePane({ id: 'pane-coarse', timeframeId: '4H', aggregation: { factor: 240 } });

  it('derives the rollup ratio from the two panes, never from the relation', () => {
    const relation: PaneRelation = {
      kind: 'rollup',
      finePaneId: 'pane-fine',
      coarsePaneId: 'pane-coarse',
    };
    const state = evaluateRelation(relation, [fine, coarse]);
    expect(state).toEqual({
      kind: 'rollup',
      barsPerCoarse: 240,
      fineTimeframeId: '1m',
      coarseTimeframeId: '4H',
      baseTimeframeId: '1m',
    });
  });

  it('returns null when a relation names a pane the chart does not hold', () => {
    const relation: PaneRelation = {
      kind: 'rollup',
      finePaneId: 'pane-fine',
      coarsePaneId: 'pane-missing',
    };
    expect(evaluateRelation(relation, [fine])).toBeNull();
  });

  it('carries the shared rung and the candle count of a lockstep', () => {
    const first = makePane({
      id: 'pane-a',
      seriesId: 'series-a',
      timeframeId: '1H',
      aggregation: { factor: 60 },
      viewport: { fromBar: 0, barCount: 90 },
    });
    const second = makePane({
      id: 'pane-b',
      seriesId: 'series-b',
      timeframeId: '1H',
      aggregation: { factor: 60 },
      viewport: { fromBar: 0, barCount: 90 },
    });
    const relation: PaneRelation = {
      kind: 'lockstep',
      paneIds: ['pane-a', 'pane-b'],
      timeframeId: '1H',
    };
    expect(evaluateRelation(relation, [first, second])).toEqual({
      kind: 'lockstep',
      timeframeId: '1H',
      barCount: 90,
    });
  });

  it('returns null when a lockstep names a pane the chart does not hold', () => {
    const relation: PaneRelation = {
      kind: 'lockstep',
      paneIds: ['pane-a', 'pane-missing'],
      timeframeId: '1H',
    };
    expect(evaluateRelation(relation, [fine])).toBeNull();
  });

  it('states a fractional ratio truthfully rather than rounding it', () => {
    // 6H over 4H is 1.5 candles: the panel has to say so.
    const fourHour = makePane({ id: 'pane-4h', timeframeId: '4H', aggregation: { factor: 240 } });
    const sixHour = makePane({ id: 'pane-6h', timeframeId: '6H', aggregation: { factor: 360 } });
    const relation: PaneRelation = {
      kind: 'rollup',
      finePaneId: 'pane-4h',
      coarsePaneId: 'pane-6h',
    };
    const state = evaluateRelation(relation, [fourHour, sixHour]);
    expect(state).toEqual({
      kind: 'rollup',
      barsPerCoarse: 1.5,
      fineTimeframeId: '4H',
      coarseTimeframeId: '6H',
      baseTimeframeId: '1m',
    });
  });
});
