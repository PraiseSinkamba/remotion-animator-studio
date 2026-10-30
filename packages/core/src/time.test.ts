import { describe, expect, it } from 'vitest';

import type { Datasource, OhlcBar } from './series';
import type { MarketClock, PaneSpec } from './elements';
import { DEFAULT_FRAMES_PER_STEP, evaluateClockAt, evaluatePaneAt, framesPerBar } from './time';

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
});
