/**
 * The clock and the as-of evaluation.
 *
 * One pure function produces a pane's frame state: `evaluatePaneAt`. The rules
 * it enforces are the no-lookahead rules (TF-003, TF-004):
 *
 * - the pane's visible bars are those at or before the as-of index the clock yields;
 * - an aggregated bucket contains only the constituents revealed so far;
 * - with `priceRange.mode = 'auto'` the price scale is computed from the revealed
 *   bars only, so a future bar cannot move the axis.
 *
 * Pure functions only: no React, no Remotion, no DOM.
 */

import type { Datasource, OhlcBar } from './series';
import type { MarketClock, PaneSpec } from './elements';
import { computePriceRange } from './market';

/* ------------------------------------------------------------------ */
/* clock                                                               */
/* ------------------------------------------------------------------ */

/**
 * Frames one clock step lasts.
 *
 * A clock step advances `clock.stepBars` bars of the reference series, so the
 * clock spends `FRAMES_PER_CLOCK_STEP / stepBars` frames on one bar. The
 * constant is the chart component's default frames-per-bar; neither
 * `MarketClock` nor the clock evaluation carries a frames-per-step value, so
 * this is the one place the clock's pace is fixed.
 */
export const FRAMES_PER_CLOCK_STEP = 15;

/** Frames the clock spends on one bar of the reference series. */
export const framesPerBar = (clock: MarketClock): number => {
  const stepBars = Number.isFinite(clock.stepBars) && clock.stepBars > 0 ? clock.stepBars : 1;
  return FRAMES_PER_CLOCK_STEP / stepBars;
};

/** The clock's position at a chart-local frame. */
export interface ClockState {
  /** Index into the reference series. Negative before the first bar. */
  referenceIndex: number;
  /** 0..1 within the current bar. */
  progress: number;
}

/**
 * The clock's position at a chart-local frame.
 *
 * `clockStep = frame / framesPerBar`, the reference index is the floor of that
 * and the progress is its fraction.
 */
export const evaluateClockAt = (clock: MarketClock, chartLocalFrame: number): ClockState => {
  if (!Number.isFinite(chartLocalFrame)) return { referenceIndex: -1, progress: 0 };
  const step = chartLocalFrame / framesPerBar(clock);
  const referenceIndex = Math.floor(step);
  return { referenceIndex, progress: step - referenceIndex };
};

/* ------------------------------------------------------------------ */
/* pane                                                                */
/* ------------------------------------------------------------------ */

/** A pane's frame state: the revealed bars, the active one, the price scale. */
export interface PaneFrameState {
  /** Only bars at or before the as-of index. */
  bars: OhlcBar[];
  /** Index into `bars`, -1 when the pane shows nothing yet. */
  activeIndex: number;
  range: { min: number; max: number };
  /** True when the active bar is a partially aggregated bucket. */
  developing: boolean;
}

/** Aggregates the revealed constituents of one bucket into a single bar. */
const aggregateBucket = (paneId: string, bucketIndex: number, constituents: OhlcBar[]): OhlcBar => {
  const first = constituents[0];
  const last = constituents[constituents.length - 1];
  let high = -Infinity;
  let low = Infinity;
  let volume = 0;
  let hasVolume = true;
  for (const bar of constituents) {
    if (bar.h > high) high = bar.h;
    if (bar.l < low) low = bar.l;
    if (bar.v === undefined) hasVolume = false;
    else volume += bar.v;
  }
  const aggregated: OhlcBar = {
    id: `${paneId}:${bucketIndex}`,
    t: first.t,
    o: first.o,
    h: high,
    l: low,
    c: last.c,
  };
  if (hasVolume) aggregated.v = volume;
  return aggregated;
};

/**
 * Evaluates a pane at a chart-local frame.
 *
 * The pane's source index is the clock's reference index, shifted by
 * `offsetBars` for an `offset` binding. With `aggregation.factor = n` the pane's
 * bucket index is `floor(sourceIndex / n)` and the bucket aggregates only the
 * constituents whose index is at or before the source index.
 */
export const evaluatePaneAt = (
  pane: PaneSpec,
  datasource: Datasource,
  clock: MarketClock,
  chartLocalFrame: number,
): PaneFrameState => {
  const binding = pane.clock;
  if (binding.kind === 'utc' && datasource.timeBasis !== 'utc') {
    throw new Error(
      `Pane "${pane.id}" uses a utc clock binding but series "${datasource.id}" has no utc time basis.`,
    );
  }

  const empty: PaneFrameState = { bars: [], activeIndex: -1, range: { min: 0, max: 0 }, developing: false };

  const { referenceIndex } = evaluateClockAt(clock, chartLocalFrame);
  const offset = binding.kind === 'offset' ? binding.offsetBars : 0;
  const sourceIndex = referenceIndex + offset;
  const source = datasource.bars;
  if (sourceIndex < 0 || source.length === 0) return empty;

  const asOf = Math.min(sourceIndex, source.length - 1);
  const factor = Math.max(1, Math.floor(pane.aggregation.factor));
  const bucketIndex = Math.floor(asOf / factor);
  // The bucket is still forming when it lacks constituents that the source holds.
  const developing = factor > 1 && asOf % factor !== factor - 1 && asOf + 1 < source.length;

  const bars: OhlcBar[] = [];
  for (let bucket = 0; bucket <= bucketIndex; bucket++) {
    const start = bucket * factor;
    const end = Math.min(start + factor - 1, asOf);
    const constituents = source.slice(start, end + 1);
    bars.push(factor === 1 ? constituents[0] : aggregateBucket(pane.id, bucket, constituents));
  }

  const range =
    pane.priceRange.mode === 'fixed'
      ? { min: pane.priceRange.min, max: pane.priceRange.max }
      : computePriceRange(bars);

  return {
    bars,
    activeIndex: bars.length - 1,
    range,
    developing,
  };
};
