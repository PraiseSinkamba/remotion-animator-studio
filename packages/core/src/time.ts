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
import type { MarketClock, PaneRelation, PaneSpec, TimeframeId } from './elements';
import { TIMEFRAME_BASE_UNITS } from './elements';
import { computePriceRange } from './market';

/* ------------------------------------------------------------------ */
/* clock                                                               */
/* ------------------------------------------------------------------ */

/**
 * The pace used when a clock does not state one.
 *
 * A clock carries its own pace (`framesPerStep`); this is only the fallback
 * for a clock built by hand that omits it. It matches the chart component's
 * default frames-per-bar, so an unstated pace renders as it always did.
 */
export const DEFAULT_FRAMES_PER_STEP = 15;

/** Frames the clock spends on one bar of the reference series. */
export const framesPerBar = (clock: MarketClock): number => {
  const stepBars = Number.isFinite(clock.stepBars) && clock.stepBars > 0 ? clock.stepBars : 1;
  const framesPerStep =
    Number.isFinite(clock.framesPerStep) && clock.framesPerStep > 0
      ? clock.framesPerStep
      : DEFAULT_FRAMES_PER_STEP;
  return framesPerStep / stepBars;
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
/* the ladder                                                          */
/* ------------------------------------------------------------------ */

/** True when the value is a rung of the timeframe ladder. */
export const isTimeframeId = (value: string): value is TimeframeId =>
  Object.prototype.hasOwnProperty.call(TIMEFRAME_BASE_UNITS, value);

/** The rung that spans the given number of base units. */
export const rungForBaseUnits = (units: number): TimeframeId | undefined =>
  (Object.keys(TIMEFRAME_BASE_UNITS) as TimeframeId[]).find(
    (rung) => TIMEFRAME_BASE_UNITS[rung] === units,
  );

/**
 * The base a series' panes are built from, in base units.
 *
 * A pane's `aggregation.factor` says how many source bars one of its candles
 * holds, so `rung.baseUnits / factor` is the size of the source the pane
 * reads. A pane that reads the source bars one for one names that source's
 * own rung, so it pins the base. Without such a pane the base is the finest
 * source the series' panes imply.
 *
 * A series with no pane naming a rung is read at its own bar size, so its
 * base is one base unit.
 */
export const seriesBaseUnits = (panes: readonly PaneSpec[], seriesId: string): number => {
  const own = panes
    .filter(
      (pane) =>
        pane.seriesId === seriesId &&
        pane.aggregation.factor === 1 &&
        pane.timeframeId !== undefined &&
        isTimeframeId(pane.timeframeId),
    )
    .map((pane) => TIMEFRAME_BASE_UNITS[pane.timeframeId as TimeframeId]);
  if (own.length > 0) return Math.min(...own);
  const implied = panes
    .filter(
      (pane) =>
        pane.seriesId === seriesId &&
        pane.timeframeId !== undefined &&
        isTimeframeId(pane.timeframeId) &&
        pane.aggregation.factor > 0,
    )
    .map((pane) => TIMEFRAME_BASE_UNITS[pane.timeframeId as TimeframeId] / pane.aggregation.factor);
  return implied.length > 0 ? Math.min(...implied) : 1;
};

/** The rung a series is built from, if its base is a rung of the ladder. */
export const seriesBaseRung = (
  panes: readonly PaneSpec[],
  seriesId: string,
): TimeframeId | undefined => rungForBaseUnits(seriesBaseUnits(panes, seriesId));

/**
 * The factor a pane at the given rung carries against its series' base.
 *
 * The factor is derived, never typed: a pane at `1H` over a `1m` base
 * aggregates 60 source bars, and the creator never writes that number.
 */
export const paneFactor = (
  panes: readonly PaneSpec[],
  seriesId: string,
  rung: TimeframeId,
): number => TIMEFRAME_BASE_UNITS[rung] / seriesBaseUnits(panes, seriesId);

/**
 * The rung a pane displays.
 *
 * A pane that names a rung displays it. A pane that names none displays the
 * rung its aggregation factor reaches from its series' base.
 */
export const paneRung = (
  pane: PaneSpec,
  panes: readonly PaneSpec[] = [pane],
): TimeframeId | undefined => {
  if (pane.timeframeId !== undefined && isTimeframeId(pane.timeframeId)) return pane.timeframeId;
  const base = seriesBaseUnits(panes, pane.seriesId);
  return rungForBaseUnits(base * pane.aggregation.factor);
};

/**
 * The candles a pane shows.
 *
 * A pane that states a viewport shows exactly that many candles. A pane that
 * states none shows the default window.
 */
export const DEFAULT_PANE_BAR_COUNT = 120;

/** The candles a pane shows: its own window when it states one, the default otherwise. */
export const paneBarCount = (pane: PaneSpec): number =>
  pane.viewport?.barCount ?? DEFAULT_PANE_BAR_COUNT;

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

/* ------------------------------------------------------------------ */
/* relations                                                           */
/* ------------------------------------------------------------------ */

/**
 * What a declared relation resolves to.
 *
 * A rollup's ratio is derived from the two panes' aggregation factors, never
 * authored twice. A lockstep carries the rung both panes read and the number
 * of candles both of them show.
 */
export type RelationState =
  | {
      kind: 'rollup';
      /** How many fine candles make one coarse candle. */
      barsPerCoarse: number;
      fineTimeframeId?: TimeframeId;
      coarseTimeframeId?: TimeframeId;
      /** The rung both panes are built from. */
      baseTimeframeId?: TimeframeId;
    }
  | {
      kind: 'lockstep';
      /** The rung both panes read. */
      timeframeId: TimeframeId;
      /** The candles both panes show. */
      barCount: number;
    };

/**
 * Evaluates a declared relation against the chart's panes.
 *
 * Returns `null` when the relation names a pane the chart does not hold: a
 * relation that points at nothing says nothing.
 */
export const evaluateRelation = (
  relation: PaneRelation,
  panes: readonly PaneSpec[],
): RelationState | null => {
  if (relation.kind === 'rollup') {
    const fine = panes.find((pane) => pane.id === relation.finePaneId);
    const coarse = panes.find((pane) => pane.id === relation.coarsePaneId);
    if (!fine || !coarse) return null;
    const fineFactor = fine.aggregation.factor;
    const coarseFactor = coarse.aggregation.factor;
    return {
      kind: 'rollup',
      barsPerCoarse: fineFactor > 0 ? coarseFactor / fineFactor : 0,
      fineTimeframeId: fine.timeframeId && isTimeframeId(fine.timeframeId) ? fine.timeframeId : undefined,
      coarseTimeframeId:
        coarse.timeframeId && isTimeframeId(coarse.timeframeId) ? coarse.timeframeId : undefined,
      baseTimeframeId: seriesBaseRung(panes, fine.seriesId),
    };
  }

  const [firstId, secondId] = relation.paneIds;
  const first = panes.find((pane) => pane.id === firstId);
  const second = panes.find((pane) => pane.id === secondId);
  if (!first || !second) return null;
  return {
    kind: 'lockstep',
    timeframeId: relation.timeframeId,
    barCount: paneBarCount(first),
  };
};
