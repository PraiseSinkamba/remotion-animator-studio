import { describe, expect, it } from 'vitest';
import {
  barsToFrames,
  computePriceRange,
  evaluateBarsAtFrame,
  generateSyntheticBars,
  type OhlcBar,
} from './ohlc';

const FRAMES_PER_BAR = 12;

const makeBars = (): OhlcBar[] =>
  generateSyntheticBars({
    count: 6,
    startPrice: 100,
    seed: 'test-seed',
    timeframeMs: 60_000,
  });

const isValidOhlc = (bar: OhlcBar): boolean =>
  Number.isFinite(bar.o) &&
  Number.isFinite(bar.h) &&
  Number.isFinite(bar.l) &&
  Number.isFinite(bar.c) &&
  bar.o > 0 &&
  bar.h > 0 &&
  bar.l > 0 &&
  bar.c > 0 &&
  bar.h >= Math.max(bar.o, bar.c) &&
  bar.l <= Math.min(bar.o, bar.c) &&
  bar.l <= bar.h;

describe('generateSyntheticBars', () => {
  it('is reproducible for the same seed', () => {
    const options = { count: 8, startPrice: 50, seed: 'alpha', timeframeMs: 1000 };
    expect(generateSyntheticBars(options)).toEqual(generateSyntheticBars(options));
  });

  it('differs for a different seed', () => {
    const a = generateSyntheticBars({ count: 8, startPrice: 50, seed: 'alpha', timeframeMs: 1000 });
    const b = generateSyntheticBars({ count: 8, startPrice: 50, seed: 'beta', timeframeMs: 1000 });
    expect(a).not.toEqual(b);
  });

  it('produces the requested count with valid OHLC values', () => {
    const bars = generateSyntheticBars({
      count: 12,
      startPrice: 100,
      seed: 'validity',
      timeframeMs: 5000,
      volatility: 0.05,
      drift: 0.001,
    });
    expect(bars).toHaveLength(12);
    for (const bar of bars) expect(isValidOhlc(bar)).toBe(true);
  });

  it('returns an empty series for a non-positive count', () => {
    expect(generateSyntheticBars({ count: 0, startPrice: 10, seed: 'x', timeframeMs: 1000 })).toEqual(
      [],
    );
  });
});

describe('evaluateBarsAtFrame', () => {
  it('shows a single flat point at the open on the first frame', () => {
    const bars = makeBars();
    const state = evaluateBarsAtFrame(bars, 0, FRAMES_PER_BAR, 'simulated', 'seed');

    expect(state.activeIndex).toBe(0);
    expect(state.bars).toHaveLength(1);
    const bar = state.bars[0];
    expect(bar.o).toBe(bars[0].o);
    expect(bar.h).toBe(bars[0].o);
    expect(bar.l).toBe(bars[0].o);
    expect(bar.c).toBe(bars[0].o);
    expect(bar.complete).toBe(false);
  });

  it('completes the authored bar exactly on the last frame of its slot', () => {
    const bars = makeBars();
    const lastFrameOfSlot = FRAMES_PER_BAR - 1;
    const state = evaluateBarsAtFrame(bars, lastFrameOfSlot, FRAMES_PER_BAR, 'simulated', 'seed');

    expect(state.activeIndex).toBe(0);
    const bar = state.bars[0];
    expect(bar.complete).toBe(true);
    expect(bar.o).toBe(bars[0].o);
    expect(bar.h).toBe(bars[0].h);
    expect(bar.l).toBe(bars[0].l);
    expect(bar.c).toBe(bars[0].c);
  });

  it('keeps the mid-bar partial state OHLC-consistent and moves the close off the open', () => {
    const bars = makeBars();
    const midFrame = Math.floor((FRAMES_PER_BAR - 1) / 2);
    const state = evaluateBarsAtFrame(bars, midFrame, FRAMES_PER_BAR, 'simulated', 'seed');

    const partial = state.bars[0];
    expect(partial.h).toBeGreaterThanOrEqual(Math.max(partial.o, partial.c));
    expect(partial.l).toBeLessThanOrEqual(Math.min(partial.o, partial.c));
    expect(partial.l).toBeLessThanOrEqual(partial.h);
    expect(partial.c).not.toBe(partial.o);
    expect(partial.c).toBeGreaterThanOrEqual(bars[0].l);
    expect(partial.c).toBeLessThanOrEqual(bars[0].h);
  });

  it('renders the complete authored bar immediately in discrete mode', () => {
    const bars = makeBars();
    const state = evaluateBarsAtFrame(bars, 0, FRAMES_PER_BAR, 'discrete', 'seed');

    expect(state.activeIndex).toBe(0);
    const bar = state.bars[0];
    expect(bar.complete).toBe(true);
    expect(bar.o).toBe(bars[0].o);
    expect(bar.h).toBe(bars[0].h);
    expect(bar.l).toBe(bars[0].l);
    expect(bar.c).toBe(bars[0].c);
  });

  it('never returns a bar beyond the active index', () => {
    const bars = makeBars();
    for (let frame = 0; frame < bars.length * FRAMES_PER_BAR; frame++) {
      const state = evaluateBarsAtFrame(bars, frame, FRAMES_PER_BAR, 'simulated', 'seed');
      expect(state.activeIndex).toBe(Math.floor(frame / FRAMES_PER_BAR));
      expect(state.bars).toHaveLength(state.activeIndex + 1);
      state.bars.forEach((partial, index) => {
        expect(partial.bar).toBe(bars[index]);
      });
    }
  });

  it('marks every bar before the active one as complete', () => {
    const bars = makeBars();
    const state = evaluateBarsAtFrame(bars, 3 * FRAMES_PER_BAR + 2, FRAMES_PER_BAR, 'simulated', 'seed');

    expect(state.activeIndex).toBe(3);
    expect(state.bars.slice(0, 3).every((partial) => partial.complete)).toBe(true);
    expect(state.bars[0].c).toBe(bars[0].c);
    expect(state.bars[2].h).toBe(bars[2].h);
  });

  it('is independent of evaluation order (seeking equals replaying)', () => {
    const bars = makeBars();
    const frame = 2 * FRAMES_PER_BAR + 5;

    const first = evaluateBarsAtFrame(bars, frame, FRAMES_PER_BAR, 'simulated', 'seed');
    evaluateBarsAtFrame(bars, 5 * FRAMES_PER_BAR, FRAMES_PER_BAR, 'simulated', 'seed');
    const second = evaluateBarsAtFrame(bars, frame, FRAMES_PER_BAR, 'simulated', 'seed');

    expect(second).toEqual(first);
  });

  it('returns no bars before the first frame', () => {
    const bars = makeBars();
    const state = evaluateBarsAtFrame(bars, -1, FRAMES_PER_BAR, 'simulated', 'seed');

    expect(state.activeIndex).toBe(-1);
    expect(state.bars).toEqual([]);
  });
});

describe('computePriceRange', () => {
  it('reflects only the bars passed in', () => {
    const bars = makeBars();
    const first = bars.slice(0, 3);

    const range = computePriceRange(first);
    expect(range.min).toBe(Math.min(...first.map((bar) => bar.l)));
    expect(range.max).toBe(Math.max(...first.map((bar) => bar.h)));

    const all = computePriceRange(bars);
    expect(all.min).toBeLessThanOrEqual(range.min);
    expect(all.max).toBeGreaterThanOrEqual(range.max);
  });

  it('returns zero bounds for an empty series', () => {
    expect(computePriceRange([])).toEqual({ min: 0, max: 0 });
  });
});

describe('barsToFrames', () => {
  it('is the bar count multiplied by the frames per bar', () => {
    const bars = makeBars();
    expect(barsToFrames(bars, FRAMES_PER_BAR)).toBe(bars.length * FRAMES_PER_BAR);
    expect(barsToFrames([], FRAMES_PER_BAR)).toBe(0);
  });
});
