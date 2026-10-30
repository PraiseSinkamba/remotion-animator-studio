/**
 * Path-conditioned synthetic candle generator (dependency-free TypeScript).
 *
 * Features:
 * - Exact closing prices at user-drawn anchors
 * - Geometric (log-price) Brownian bridges between anchors
 * - Automatic sideways/ranging regimes, with mean-reverting fluctuations
 * - Optional trend pauses/consolidations and explicit retracement sub-swings
 * - Volatility clustering and wick size influenced by anchor price/time slope
 * - Intrabar Brownian bridges to produce OHLC highs/lows
 * - Seeded deterministic randomness, optional tick-size quantization
 * - Pixel-stroke -> price/time anchor conversion
 *
 * IMPORTANT: All OHLCV is synthetic. Volume is an activity proxy, NOT actual
 * exchange volume. This is for UI previews, scenario testing and examples;
 * matching anchors does not validate a trading strategy against real markets.
 */

export interface PathAnchor {
  /** 0-based candle index. The first and last indices must be provided. */
  index: number;
  /** Positive price; exact candle CLOSE target at this index. */
  price: number;
  /** Controls the interval from THIS anchor to the NEXT anchor. */
  regime?: "auto" | "trend" | "range";
}

export interface Candle {
  /** Unix epoch milliseconds; use Math.floor(time / 1000) for some chart libraries. */
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  /** Fake activity measure, not actual market volume. */
  volume: number;
}

export interface RetracementConfig {
  enabled?: boolean;
  /** Chance of a retracement in each eligible trend block, 0..1. */
  probability?: number;
  /** Minimum anchor separation needed for retracements. */
  minBars?: number;
  /** Approximate bars per retracement opportunity. */
  everyBars?: number;
  /** Lower/upper fraction of the impulse taken back. */
  depthMin?: number;
  depthMax?: number;
}

export interface ConsolidationConfig {
  enabled?: boolean;
  /**
   * AUTO: classify an anchor segment as ranging if
   * abs(log(end / start)) / (volatility * sqrt(bars)) < flatThreshold.
   */
  flatThreshold?: number;
  /** Ranging segments mean-revert rather than just freely drift. */
  meanReversion?: number;
  /** Scales the sideways excursions of ranging segments. */
  rangeWidth?: number;
  /** Chance of a pause occurring within a trend segment. */
  trendPauseProbability?: number;
  pauseMinBars?: number;
  pauseMaxBars?: number;
  /** Trend progress during a pause (0 = completely flat, 1 = no slowdown). */
  pauseSpeed?: number;
}

export interface WickConfig {
  /** Base relative size of intrabar excursions. */
  strength?: number;
  /** How strongly wick volatility responds to anchor price movement per bar. */
  slopeSensitivity?: number;
  /** Extra relative wicks on sideways/ranging segments. */
  rangeBoost?: number;
  /** Extra intrabar variance when the candle's open-to-close body is large. */
  bodySensitivity?: number;
}

export interface VolatilityClusteringConfig {
  /** Persistence of volatility state; 0..1 (higher = longer clusters). */
  persistence?: number;
  /** Size of volatility shocks (0 disables stochastic clustering). */
  shock?: number;
}

export interface GeneratorOptions {
  candleCount: number;
  anchors: PathAnchor[];
  /** Default 0. */
  startTimeMs?: number;
  /** Default 60,000 milliseconds (1-minute candles). */
  intervalMs?: number;
  /** Typical log-return standard deviation PER CANDLE, e.g. 0.002 = 0.2%. */
  volatility?: number;
  /** Random deviations from the structural path; 0 disables close-price noise. */
  pathNoise?: number;
  /** Number of simulated subdivisions per candle, >= 2. */
  intrabarSteps?: number;
  baseVolume?: number;
  /** Same seed + settings -> same series. */
  seed?: number;
  /** If supplied, anchor prices must already lie on this tick grid. */
  tickSize?: number;
  retracements?: RetracementConfig;
  consolidations?: ConsolidationConfig;
  wicks?: WickConfig;
  volatilityClustering?: VolatilityClusteringConfig;
}

export interface SegmentInfo {
  fromIndex: number;
  toIndex: number;
  regime: "trend" | "range";
  /** abs(log(end/start)) divided by bars, per candle. */
  averageLogMovePerBar: number;
  /** The relative wick scaling determined by price/time slope & regime. */
  wickMultiplier: number;
  retracementCount: number;
  pauseCount: number;
}

export interface GeneratedMarket {
  candles: Candle[];
  segments: SegmentInfo[];
}

const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n));
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

function randomSource(seed: number) {
  let state = seed >>> 0;
  let spare: number | undefined;
  function uniform(): number {
    state = (state + 0x6d2b79f5) | 0;
    let z = Math.imul(state ^ (state >>> 15), 1 | state);
    z ^= z + Math.imul(z ^ (z >>> 7), 61 | z);
    return ((z ^ (z >>> 14)) >>> 0) / 4294967296;
  }
  function normal(): number {
    if (spare !== undefined) {
      const value = spare;
      spare = undefined;
      return value;
    }
    const u = Math.max(Number.MIN_VALUE, uniform());
    const v = uniform();
    const radius = Math.sqrt(-2 * Math.log(u));
    spare = radius * Math.sin(2 * Math.PI * v);
    return radius * Math.cos(2 * Math.PI * v);
  }
  function integer(lo: number, hi: number): number {
    return lo + Math.floor(uniform() * (hi - lo + 1));
  }
  return { uniform, normal, integer };
}

type Rand = ReturnType<typeof randomSource>;

interface ResolvedOptions {
  retr: Required<RetracementConfig>;
  cons: Required<ConsolidationConfig>;
  wick: Required<WickConfig>;
  cluster: Required<VolatilityClusteringConfig>;
  volatility: number;
  pathNoise: number;
  intrabarSteps: number;
  baseVolume: number;
  seed: number;
  startTimeMs: number;
  intervalMs: number;
  tickSize?: number;
}

function requiredFinite(label: string, n: number, min: number, max = Infinity) {
  if (!Number.isFinite(n) || n < min || n > max) {
    throw new RangeError(`${label} must be a finite number in [${min}, ${max}]`);
  }
}

function resolve(options: GeneratorOptions): ResolvedOptions {
  const retr: Required<RetracementConfig> = {
    enabled: options.retracements?.enabled ?? true,
    probability: options.retracements?.probability ?? 0.85,
    minBars: options.retracements?.minBars ?? 12,
    everyBars: options.retracements?.everyBars ?? 26,
    depthMin: options.retracements?.depthMin ?? 0.30,
    depthMax: options.retracements?.depthMax ?? 0.65,
  };
  const cons: Required<ConsolidationConfig> = {
    enabled: options.consolidations?.enabled ?? true,
    flatThreshold: options.consolidations?.flatThreshold ?? 0.85,
    meanReversion: options.consolidations?.meanReversion ?? 0.22,
    rangeWidth: options.consolidations?.rangeWidth ?? 1.2,
    trendPauseProbability: options.consolidations?.trendPauseProbability ?? 0.60,
    pauseMinBars: options.consolidations?.pauseMinBars ?? 4,
    pauseMaxBars: options.consolidations?.pauseMaxBars ?? 10,
    pauseSpeed: options.consolidations?.pauseSpeed ?? 0.09,
  };
  const wick: Required<WickConfig> = {
    strength: options.wicks?.strength ?? 1.45,
    slopeSensitivity: options.wicks?.slopeSensitivity ?? 0.42,
    rangeBoost: options.wicks?.rangeBoost ?? 1.30,
    bodySensitivity: options.wicks?.bodySensitivity ?? 0.32,
  };
  const cluster: Required<VolatilityClusteringConfig> = {
    persistence: options.volatilityClustering?.persistence ?? 0.93,
    shock: options.volatilityClustering?.shock ?? 0.14,
  };
  const out: ResolvedOptions = {
    retr, cons, wick, cluster,
    volatility: options.volatility ?? 0.002,
    pathNoise: options.pathNoise ?? 0.72,
    intrabarSteps: options.intrabarSteps ?? 24,
    baseVolume: options.baseVolume ?? 1000,
    seed: options.seed ?? 12345,
    startTimeMs: options.startTimeMs ?? 0,
    intervalMs: options.intervalMs ?? 60_000,
    tickSize: options.tickSize,
  };
  requiredFinite("volatility", out.volatility, Number.MIN_VALUE);
  requiredFinite("pathNoise", out.pathNoise, 0);
  requiredFinite("baseVolume", out.baseVolume, Number.MIN_VALUE);
  requiredFinite("intervalMs", out.intervalMs, Number.MIN_VALUE);
  requiredFinite("startTimeMs", out.startTimeMs, -Number.MAX_VALUE);
  requiredFinite("seed", out.seed, -Number.MAX_VALUE);
  requiredFinite("retracements.probability", retr.probability, 0, 1);
  requiredFinite("retracements.depthMin", retr.depthMin, 0, 1);
  requiredFinite("retracements.depthMax", retr.depthMax, retr.depthMin, 1);
  requiredFinite("consolidations.flatThreshold", cons.flatThreshold, 0);
  requiredFinite("consolidations.meanReversion", cons.meanReversion, 0, 1);
  requiredFinite("consolidations.rangeWidth", cons.rangeWidth, 0);
  requiredFinite("consolidations.trendPauseProbability", cons.trendPauseProbability, 0, 1);
  requiredFinite("consolidations.pauseSpeed", cons.pauseSpeed, 0, 1);
  requiredFinite("wicks.strength", wick.strength, 0);
  requiredFinite("wicks.slopeSensitivity", wick.slopeSensitivity, 0);
  requiredFinite("wicks.rangeBoost", wick.rangeBoost, 0);
  requiredFinite("wicks.bodySensitivity", wick.bodySensitivity, 0);
  requiredFinite("volatilityClustering.persistence", cluster.persistence, 0, 0.999999);
  requiredFinite("volatilityClustering.shock", cluster.shock, 0);
  for (const [name, value, min] of [
    ["intrabarSteps", out.intrabarSteps, 2],
    ["retracements.minBars", retr.minBars, 4],
    ["retracements.everyBars", retr.everyBars, 4],
    ["consolidations.pauseMinBars", cons.pauseMinBars, 1],
    ["consolidations.pauseMaxBars", cons.pauseMaxBars, cons.pauseMinBars],
  ] as const) {
    if (!Number.isSafeInteger(value) || value < min) {
      throw new RangeError(`${name} must be an integer >= ${min}`);
    }
  }
  if (out.tickSize !== undefined) requiredFinite("tickSize", out.tickSize, Number.MIN_VALUE);
  return out;
}

function validateAnchors(options: GeneratorOptions, tickSize?: number): PathAnchor[] {
  if (!Number.isSafeInteger(options.candleCount) || options.candleCount < 2) {
    throw new RangeError("candleCount must be an integer >= 2");
  }
  if (!Array.isArray(options.anchors) || options.anchors.length < 2) {
    throw new Error("At least two anchors are required");
  }
  const anchors = [...options.anchors].sort((a, b) => a.index - b.index);
  if (anchors[0].index !== 0 || anchors[anchors.length - 1].index !== options.candleCount - 1) {
    throw new Error("Anchors must include index 0 and index candleCount - 1");
  }
  anchors.forEach((a, i) => {
    if (!Number.isSafeInteger(a.index) || a.index < 0 || a.index >= options.candleCount) {
      throw new Error(`Invalid anchor index: ${a.index}`);
    }
    requiredFinite(`anchors[${i}].price`, a.price, Number.MIN_VALUE);
    if (i > 0 && a.index === anchors[i - 1].index) {
      throw new Error(`Duplicate anchor index: ${a.index}`);
    }
    if (a.regime && !["auto", "trend", "range"].includes(a.regime)) {
      throw new Error(`Unknown regime: ${a.regime}`);
    }
    if (tickSize !== undefined) {
      const units = a.price / tickSize;
      if (!Number.isSafeInteger(Math.round(units)) || Math.abs(units - Math.round(units)) > 1e-7) {
        throw new Error(`Anchor price ${a.price} is not on tick grid ${tickSize}`);
      }
    }
  });
  return anchors;
}

/**
 * Weighted Brownian bridge: retains both zero endpoints even when the
 * instantaneous volatility varies. Each step's variance determines how much
 * of the total excursion is removed by the endpoint conditioning.
 */
function noiseBridge(sigmas: number[], rng: Rand): number[] {
  const n = sigmas.length;
  const sums = new Float64Array(n + 1);
  const variances = new Float64Array(n + 1);
  for (let j = 1; j <= n; j++) {
    const s = sigmas[j - 1];
    sums[j] = sums[j - 1] + s * rng.normal();
    variances[j] = variances[j - 1] + s * s;
  }
  const lastSum = sums[n], lastVar = variances[n];
  return Array.from(sums, (v, j) =>
    lastVar === 0 ? 0 : v - (variances[j] / lastVar) * lastSum
  );
}

/**
 * Build log-price structural trajectory for a trend.
 * - Optional flat/slow intervals simulate consolidation/pause phases.
 * - Optional retracement sublegs intentionally move opposite the main trend.
 * Endpoints always match exactly.
 */
function trendGuide(
  n: number, from: number, to: number,
  rng: Rand, cfg: ResolvedOptions
): { guide: number[]; retracementCount: number; pauseCount: number } {
  const { cons, retr } = cfg;
  const weights = Array<number>(n).fill(1);
  let pauseCount = 0;
  if (cons.enabled && n >= cons.pauseMinBars + 6 && rng.uniform() < cons.trendPauseProbability) {
    const pauseSize = rng.integer(cons.pauseMinBars, Math.min(cons.pauseMaxBars, n - 4));
    const start = rng.integer(2, n - pauseSize - 2);
    for (let j = start; j < start + pauseSize; j++) weights[j] = cons.pauseSpeed;
    pauseCount = 1;
  }
  const total = weights.reduce((sum, w) => sum + w, 0);
  const guide: number[] = [from];
  let progress = 0;
  for (let j = 1; j <= n; j++) {
    progress += weights[j - 1] / total;
    guide[j] = lerp(from, to, progress);
  }
  guide[n] = to;

  let retracementCount = 0;
  if (retr.enabled && n >= retr.minBars) {
    const opportunities = Math.max(1, Math.floor(n / retr.everyBars));
    // Events are allocated to distinct blocks, so they never overlap.
    for (let k = 0; k < opportunities; k++) {
      if (rng.uniform() > retr.probability) continue;
      const blockStart = Math.floor((k * n) / opportunities);
      const blockEnd = Math.floor(((k + 1) * n) / opportunities);
      const usable = blockEnd - blockStart;
      if (usable < 8) continue;
      const margin = Math.max(1, Math.floor(usable * 0.12));
      const s = blockStart + margin;
      const e = blockEnd - margin;
      if (e - s < 6) continue;
      const p = s + Math.max(1, Math.floor((e - s) * 0.44));
      const r = p + Math.max(1, Math.floor((e - s) * 0.24));
      if (r >= e) continue;
      const dir = Math.sign(to - from);
      const distance = dir * (guide[e] - guide[s]);
      if (distance <= 0) continue;
      const depth = lerp(retr.depthMin, retr.depthMax, rng.uniform());
      const peak = guide[s] + dir * distance * 0.84;
      const trough = guide[s] + dir * distance * 0.84 * (1 - depth);
      const initial = guide[s], finish = guide[e];
      for (let j = s + 1; j < e; j++) {
        guide[j] = j <= p
          ? lerp(initial, peak, (j - s) / (p - s))
          : j <= r
            ? lerp(peak, trough, (j - p) / (r - p))
            : lerp(trough, finish, (j - r) / (e - r));
      }
      retracementCount++;
    }
  }
  return { guide, retracementCount, pauseCount };
}

function rangeGuide(
  n: number, from: number, to: number,
  sigmas: number[], rng: Rand, cfg: ResolvedOptions
): number[] {
  const output: number[] = new Array(n + 1);
  const ou = new Float64Array(n + 1);
  const rho = 1 - cfg.cons.meanReversion;
  for (let j = 1; j <= n; j++) {
    ou[j] = rho * ou[j - 1] +
      cfg.cons.rangeWidth * cfg.pathNoise * sigmas[j - 1] * rng.normal();
  }
  // Condition mean-reverting offsets on the right endpoint exactly.
  for (let j = 0; j <= n; j++) {
    const t = j / n;
    output[j] = lerp(from, to, t) + ou[j] - t * ou[n];
  }
  output[0] = from;
  output[n] = to;
  return output;
}

function quantize(n: number, tickSize: number | undefined): number {
  if (tickSize === undefined) return n;
  return Math.max(tickSize, Math.round(n / tickSize) * tickSize);
}

/** Returns candles plus diagnostics useful for chart overlays/UI. */
export function generateCandlesWithMeta(options: GeneratorOptions): GeneratedMarket {
  const cfg = resolve(options);
  const anchors = validateAnchors(options, cfg.tickSize);
  const rng = randomSource(cfg.seed);
  const nCandles = options.candleCount;
  const sigma = new Float64Array(nCandles);
  let volatilityState = 0;
  for (let i = 0; i < nCandles; i++) {
    volatilityState = cfg.cluster.persistence * volatilityState + cfg.cluster.shock * rng.normal();
    sigma[i] = cfg.volatility * clamp(Math.exp(volatilityState), 0.35, 3);
  }

  const logCloses = new Float64Array(nCandles);
  const wickMultipliers = new Float64Array(nCandles);
  const regimeAt = new Array<"trend" | "range">(nCandles).fill("trend");
  const segments: SegmentInfo[] = [];

  for (let k = 0; k < anchors.length - 1; k++) {
    const a = anchors[k], b = anchors[k + 1];
    const bars = b.index - a.index;
    const from = Math.log(a.price), to = Math.log(b.price);
    const distance = Math.abs(to - from);
    const significance = distance / (cfg.volatility * Math.sqrt(bars));
    const regime: "trend" | "range" = a.regime === "trend" || a.regime === "range"
      ? a.regime
      : cfg.cons.enabled && significance < cfg.cons.flatThreshold ? "range" : "trend";

    const slope = distance / bars;
    const slopeRatio = slope / cfg.volatility;
    // Same price distance in fewer bars -> greater volatility/wick response.
    const wickMultiplier = clamp(
      cfg.wick.strength * (0.85 + cfg.wick.slopeSensitivity * Math.sqrt(slopeRatio)) *
      (regime === "range" ? cfg.wick.rangeBoost : 1),
      0, 6,
    );
    const localSigmas: number[] = [];
    for (let j = 1; j <= bars; j++) localSigmas.push(sigma[a.index + j]);

    let guide: number[];
    let retracementCount = 0, pauseCount = 0;
    if (regime === "range") {
      guide = rangeGuide(bars, from, to, localSigmas, rng, cfg);
    } else {
      const result = trendGuide(bars, from, to, rng, cfg);
      guide = result.guide;
      retracementCount = result.retracementCount;
      pauseCount = result.pauseCount;
      const deviations = noiseBridge(localSigmas.map(s => s * cfg.pathNoise), rng);
      for (let j = 0; j <= bars; j++) guide[j] += deviations[j];
    }
    // Assign segment to each candle whose close is in it. At an internal
    // anchor, the following segment owns the subsequent candle, not the anchor.
    for (let j = 0; j <= bars; j++) {
      const index = a.index + j;
      logCloses[index] = guide[j];
      if (j > 0 || index === 0) {
        wickMultipliers[index] = wickMultiplier;
        regimeAt[index] = regime;
      }
    }
    segments.push({
      fromIndex: a.index, toIndex: b.index, regime,
      averageLogMovePerBar: slope,
      wickMultiplier, retracementCount, pauseCount,
    });
  }

  const exactAnchors = new Map(anchors.map(a => [a.index, a.price]));
  const candles: Candle[] = [];
  for (let i = 0; i < nCandles; i++) {
    const close = exactAnchors.get(i) ?? quantize(Math.exp(logCloses[i]), cfg.tickSize);
    const open = i === 0 ? close : candles[i - 1].close;
    const o = Math.log(open), c = Math.log(close);
    const body = Math.abs(c - o);
    const wickVol = sigma[i] * wickMultipliers[i] + cfg.wick.bodySensitivity * body;
    const steps = cfg.intrabarSteps;
    const stepSigmas = Array<number>(steps).fill(wickVol / Math.sqrt(steps));
    const wiggles = noiseBridge(stepSigmas, rng);
    let high = Math.max(open, close), low = Math.min(open, close);
    for (let j = 1; j < steps; j++) {
      const t = j / steps;
      const intrabarPrice = Math.exp(lerp(o, c, t) + wiggles[j]);
      high = Math.max(high, intrabarPrice);
      low = Math.min(low, intrabarPrice);
    }
    high = Math.max(open, close, quantize(high, cfg.tickSize));
    low = Math.min(open, close, quantize(low, cfg.tickSize));
    // Price magnitude is capped only by IEEE-754. Unrealistic volatility
    // settings are rejected here instead of silently emitting NaNs.
    if (![open, high, low, close].every(v => v > 0 && Number.isFinite(v))) {
      throw new RangeError("Price overflow/underflow; reduce volatility or anchor range");
    }
    const safeSigma = Math.max(sigma[i], 1e-12);
    const rangeUnits = clamp(Math.log(high / low) / safeSigma, 0, 10);
    const volume = Math.max(1, Math.round(cfg.baseVolume * Math.exp(
      0.22 * rng.normal() + 0.21 * (rangeUnits - 1) + (regimeAt[i] === "range" ? -0.12 : 0.08),
    )));
    const time = cfg.startTimeMs + i * cfg.intervalMs;
    if (!Number.isSafeInteger(time)) {
      throw new RangeError("Candle timestamp is outside JavaScript's safe integer range");
    }
    candles.push({ time, open, high, low, close, volume });
  }
  return { candles, segments };
}

/** Simple API when you only need OHLCV. */
export function generateCandles(options: GeneratorOptions): Candle[] {
  return generateCandlesWithMeta(options).candles;
}

export interface StrokePoint { x: number; y: number }
export interface StrokeOptions {
  width: number;
  height: number;
  candleCount: number;
  minPrice: number;
  maxPrice: number;
  /** Ramer-Douglas-Peucker simplification tolerance, in screen pixels. */
  simplifyTolerancePx?: number;
  /** Set true when the chart's vertical price axis uses a logarithmic scale. */
  logScale?: boolean;
  /** Optional price increment. Snap stroke-derived anchor prices to this grid. */
  tickSize?: number;
}

function simplifyStroke(points: StrokePoint[], tolerance: number): StrokePoint[] {
  if (points.length <= 2) return [...points];
  const a = points[0], b = points[points.length - 1];
  const dx = b.x - a.x, dy = b.y - a.y, lengthSquared = dx * dx + dy * dy;
  let largestDistance = -1, furthest = -1;
  for (let i = 1; i < points.length - 1; i++) {
    const p = points[i];
    const t = lengthSquared === 0 ? 0 : clamp(((p.x - a.x) * dx + (p.y - a.y) * dy) / lengthSquared, 0, 1);
    const distance = Math.hypot(p.x - (a.x + t * dx), p.y - (a.y + t * dy));
    if (distance > largestDistance) { largestDistance = distance; furthest = i; }
  }
  if (largestDistance <= tolerance || furthest < 1) return [a, b];
  return [
    ...simplifyStroke(points.slice(0, furthest + 1), tolerance).slice(0, -1),
    ...simplifyStroke(points.slice(furthest), tolerance),
  ];
}

/**
 * Map a left-to-right canvas stroke onto the requested candleCount and prices.
 * X determines relative elapsed candle time; Y is inverted (screen y down,
 * price up). The stroke's horizontal extent maps to the full series.
 */
export function strokeToAnchors(points: StrokePoint[], cfg: StrokeOptions): PathAnchor[] {
  if (points.length < 2 || !Number.isSafeInteger(cfg.candleCount) || cfg.candleCount < 2) {
    throw new RangeError("At least two stroke points and candleCount >= 2 are required");
  }
  for (const [key, value] of Object.entries({
    width: cfg.width, height: cfg.height,
    minPrice: cfg.minPrice, maxPrice: cfg.maxPrice,
    simplifyTolerancePx: cfg.simplifyTolerancePx ?? 6,
    ...(cfg.tickSize === undefined ? {} : { tickSize: cfg.tickSize }),
  })) {
    if (!Number.isFinite(value)) throw new RangeError(`${key} must be finite`);
  }
  if (cfg.width <= 0 || cfg.height <= 0 || cfg.minPrice <= 0 || cfg.maxPrice <= cfg.minPrice ||
    (cfg.simplifyTolerancePx ?? 6) < 0 ||
    (cfg.tickSize !== undefined && cfg.tickSize <= 0)) {
    throw new RangeError("Invalid chart bounds or simplification tolerance");
  }
  if (points.some(p => !Number.isFinite(p.x) || !Number.isFinite(p.y))) {
    throw new Error("Stroke coordinates must be finite");
  }
  const sorted = [...points].sort((a, b) => a.x - b.x);
  const reduced = simplifyStroke(sorted, cfg.simplifyTolerancePx ?? 6);
  const minX = reduced[0].x, maxX = reduced[reduced.length - 1].x;
  if (maxX <= minX) throw new Error("The stroke must have positive horizontal span");
  const anchors = new Map<number, number>();
  for (const p of reduced) {
    const index = Math.round(((p.x - minX) / (maxX - minX)) * (cfg.candleCount - 1));
    const normalizedY = 1 - clamp(p.y / cfg.height, 0, 1);
    const price = cfg.logScale
      ? Math.exp(lerp(Math.log(cfg.minPrice), Math.log(cfg.maxPrice), normalizedY))
      : lerp(cfg.minPrice, cfg.maxPrice, normalizedY);
    anchors.set(index, quantize(price, cfg.tickSize));
  }
  return [...anchors].sort((a, b) => a[0] - b[0])
    .map(([index, price]) => ({ index, price }));
}

/**
 * Example:
 *
 * const anchors: PathAnchor[] = [
 *   { index: 0, price: 18000 },
 *   { index: 60, price: 18450, regime: 'range' }, // consolidation until index 100
 *   { index: 100, price: 18475 },          // then downward move
 *   { index: 145, price: 18100 },         // downward move
 *   { index: 199, price: 18325 },
 * ];
 *
 * const { candles, segments } = generateCandlesWithMeta({
 *   candleCount: 200, anchors,
 *   startTimeMs: Date.UTC(2026, 0, 1), intervalMs: 60_000,
 *   volatility: 0.0015, pathNoise: 0.65,
 *   retracements: { probability: 1, everyBars: 22, depthMin: .35, depthMax: .65 },
 *   consolidations: { trendPauseProbability: .7, rangeWidth: 1.25 },
 *   wicks: { strength: 1.6, slopeSensitivity: .5, rangeBoost: 1.35 },
 *   seed: 42,
 * });
 */
