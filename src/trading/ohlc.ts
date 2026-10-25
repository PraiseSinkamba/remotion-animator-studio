/**
 * OHLC domain maths for Chart Studio.
 *
 * Pure functions only: no React, no Remotion, no DOM, no registry imports.
 * Usable from a worker, a test or the Remotion render path.
 */

export interface OhlcBar {
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v?: number;
}

export type BarRevealMode = 'discrete' | 'simulated';

export interface PartialBar {
  /** the authored bar (the final state) */
  bar: OhlcBar;
  /** the state at this frame */
  o: number;
  h: number;
  l: number;
  c: number;
  /** 0..1 within the active bar */
  progress: number;
  complete: boolean;
}

export interface ChartFrameState {
  /** only bars that exist at this frame — never a future bar */
  bars: PartialBar[];
  /** index into the authored series, -1 when none */
  activeIndex: number;
}

/* ------------------------------------------------------------------ */
/* seeded PRNG (inline, no dependency)                                 */
/* ------------------------------------------------------------------ */

/** FNV-1a 32-bit string hash. */
const hashString = (value: string): number => {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
};

/** mulberry32 — small, fast, deterministic. */
const createRng = (seed: string): (() => number) => {
  let a = hashString(seed);
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

const clamp = (value: number, min: number, max: number): number =>
  value < min ? min : value > max ? max : value;

/* ------------------------------------------------------------------ */
/* synthetic series                                                    */
/* ------------------------------------------------------------------ */

export const generateSyntheticBars = (options: {
  count: number;
  startPrice: number;
  seed: string;
  timeframeMs: number;
  volatility?: number;
  drift?: number;
}): OhlcBar[] => {
  const { count, seed, timeframeMs } = options;
  const volatility = options.volatility ?? 0.02;
  const drift = options.drift ?? 0;
  if (!Number.isFinite(count) || count <= 0) return [];

  const rng = createRng(seed);
  let price = Number.isFinite(options.startPrice) && options.startPrice > 0 ? options.startPrice : 1;
  const bars: OhlcBar[] = [];

  for (let i = 0; i < count; i++) {
    const open = price;
    const close = open * (1 + drift + (rng() * 2 - 1) * volatility);
    const high = Math.max(open, close) * (1 + rng() * volatility * 0.5);
    const low = Math.max(Math.min(open, close) * (1 - rng() * volatility * 0.5), open * 1e-6);
    const volume = Math.round(1000 + rng() * 9000);

    bars.push({ t: i * timeframeMs, o: open, h: high, l: low, c: close, v: volume });
    price = close;
  }

  return bars;
};

/* ------------------------------------------------------------------ */
/* intrabar path (simulated reveal)                                   */
/* ------------------------------------------------------------------ */

interface Waypoint {
  p: number;
  price: number;
}

/**
 * Waypoints of the intrabar path for one bar. The path starts at the open,
 * visits the high and the low (in a seeded order) and ends exactly at the close.
 */
const buildWaypoints = (bar: OhlcBar, index: number, seed: string): Waypoint[] => {
  const rng = createRng(`${seed}:${index}`);
  const upFirst = rng() < 0.5;
  const firstP = 0.15 + rng() * 0.3;
  const secondP = firstP + 0.25 + rng() * 0.25;
  const midP = firstP + (secondP - firstP) * (0.3 + rng() * 0.4);
  const midPrice = clamp(bar.l + rng() * (bar.h - bar.l), bar.l, bar.h);

  return [
    { p: 0, price: bar.o },
    { p: firstP, price: upFirst ? bar.h : bar.l },
    { p: midP, price: midPrice },
    { p: secondP, price: upFirst ? bar.l : bar.h },
    { p: 1, price: bar.c },
  ];
};

const pathPriceAt = (waypoints: Waypoint[], progress: number): number => {
  for (let i = 1; i < waypoints.length; i++) {
    const from = waypoints[i - 1];
    const to = waypoints[i];
    if (progress <= to.p) {
      const span = to.p - from.p;
      const ratio = span > 0 ? (progress - from.p) / span : 1;
      return from.price + (to.price - from.price) * clamp(ratio, 0, 1);
    }
  }
  return waypoints[waypoints.length - 1].price;
};

/**
 * Partial OHLC at `progress` along the seeded intrabar path.
 * Always OHLC-consistent: h >= max(o, c) and l <= min(o, c).
 */
const simulateBar = (bar: OhlcBar, index: number, seed: string, progress: number): PartialBar => {
  const waypoints = buildWaypoints(bar, index, seed);
  const current = pathPriceAt(waypoints, progress);

  let high = bar.o;
  let low = bar.o;
  for (const waypoint of waypoints) {
    if (waypoint.p > progress) break;
    if (waypoint.price > high) high = waypoint.price;
    if (waypoint.price < low) low = waypoint.price;
  }
  if (current > high) high = current;
  if (current < low) low = current;

  return {
    bar,
    o: bar.o,
    h: high,
    l: low,
    c: current,
    progress,
    complete: progress >= 1,
  };
};

/* ------------------------------------------------------------------ */
/* frame evaluation                                                    */
/* ------------------------------------------------------------------ */

/**
 * Bar `i` occupies frames [i * framesPerBar, (i + 1) * framesPerBar).
 * The first frame of the slot is progress 0, the last frame is progress 1.
 */
const slotProgress = (frame: number, framesPerBar: number): number => {
  if (framesPerBar <= 1) return 1;
  return clamp(frame / (framesPerBar - 1), 0, 1);
};

export const evaluateBarsAtFrame = (
  bars: OhlcBar[],
  frame: number,
  framesPerBar: number,
  mode: BarRevealMode,
  seed = 'default',
): ChartFrameState => {
  const empty: ChartFrameState = { bars: [], activeIndex: -1 };
  if (bars.length === 0 || !Number.isFinite(frame) || frame < 0) return empty;

  const slot = Math.max(1, Math.floor(framesPerBar));
  const activeIndex = Math.min(bars.length - 1, Math.floor(frame / slot));
  const startFrame = activeIndex * slot;
  const progress = slotProgress(frame - startFrame, slot);

  const state: PartialBar[] = [];
  for (let i = 0; i < activeIndex; i++) {
    const bar = bars[i];
    state.push({ bar, o: bar.o, h: bar.h, l: bar.l, c: bar.c, progress: 1, complete: true });
  }

  const active = bars[activeIndex];
  state.push(
    mode === 'discrete'
      ? {
          bar: active,
          o: active.o,
          h: active.h,
          l: active.l,
          c: active.c,
          progress,
          complete: true,
        }
      : simulateBar(active, activeIndex, seed, progress),
  );

  return { bars: state, activeIndex };
};

/* ------------------------------------------------------------------ */
/* series helpers                                                      */
/* ------------------------------------------------------------------ */

export const computePriceRange = (bars: OhlcBar[]): { min: number; max: number } => {
  if (bars.length === 0) return { min: 0, max: 0 };
  let min = Infinity;
  let max = -Infinity;
  for (const bar of bars) {
    if (bar.l < min) min = bar.l;
    if (bar.h > max) max = bar.h;
  }
  return { min, max };
};

export const barsToFrames = (bars: OhlcBar[], framesPerBar: number): number =>
  bars.length * framesPerBar;
