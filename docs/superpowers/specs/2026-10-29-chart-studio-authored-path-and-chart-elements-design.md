# Chart Studio — Authored swing paths, chart elements and playback control

**Status:** Proposed for owner approval — no implementation authorised by this document.
**Date:** 2026-10-29
**Design edition:** 1.0
**Supersedes:** nothing. Extends `docs/spec/FUNCTIONAL_SPEC.md`, `docs/architecture/TECHNICAL_ARCHITECTURE.md`, `docs/decisions/ADR-003-COMPONENT-SYSTEM.md`, `docs/spec/COMPONENT_CONTRACT.md`.
**Companions:** `docs/decisions/ADR-007-CHART-ELEMENT-MODEL.md` (schema v2 + datasource seam), `docs/decisions/ADR-008-ZOD-DOMAIN-SCHEMAS.md` (dependency record), `docs/superpowers/plans/2026-10-29-chart-studio-authored-path-and-chart-elements.md` (implementation plan).

---

## 1. The problem this slice solves

The editor today produces a generic animation video with one trading component attached: a candlestick
chart clip that owns an inline `bars` array, renders SVG candles, and nothing else. Everything that
makes a *trading* video — drawing on the chart, holding on one candle, showing two instruments
together, curving the motion — is absent.

The creator-facing problem is stated in one sentence:

> A creator should be able to **draw the shape of the move**, have the app turn that shape into
> realistic candles, and then control every element of the result — the candle, the line, the
> arrow, the pane, the curve — individually and as a whole.

This slice defines the object model that makes that sentence true, and the seam that lets real
market data replace the authored shape later without rewriting any of it.

### 1.1 What is in scope

| # | Feature | Requirement IDs |
|---|---|---|
| F1 | Interactive candle authoring: a swing-path tool captures swing anchors on the canvas, either by clicking or by drawing a freehand stroke that is converted into anchors; dragging an anchor regenerates the series so the candles follow the drawn path | AP-001, AP-002, AP-003, MD-001, MD-009 |
| F2 | Deterministic generation: the authored path generator is a port of the author's reference algorithm, seeded and reproducible with no unseeded stochastic model, and provenance that distinguishes authored / synthetic / imported | AP-002, AP-004, AN-003, MD-001, MD-009 |
| F3 | Drawing tools as market-linked objects: horizontal price line, candle high/low line, vertical line, trendline, price zone, label, arrow, long/short position (entry, stop, target, optional R:R) | OB-001, OB-003, OB-004, OB-005, OB-006, CH-007, CPT-005 |
| F4 | Animation curve editing: overall, per element, and per candle where meaningful; easing control extended to effects that are currently static or linear | CV-001, CV-002, AN-002, AN-003, TL-002 |
| F5 | Chart = collection of elements; each element individually controllable (position, size, lifecycle, curve) and the collection controllable as a whole | CH-009, OB-010, CH-001, OB-002 |
| F6 | Richer inspector: per-element-type panels, dense but organised, replacing the generic parameter list; curve editors where applicable | OB-004, CV-004 |
| F7 | Linked panes: different instruments side by side, one instrument at two timeframes side by side, and an HTF→LTF zoom element; shared market-time mapping, never row index | CH-002, CH-003, CH-005, AN-007, TF-003, TF-005 |
| F8 | Pause points: hold a chart on one candle after a pattern, with defined in/out frames | AN-006, AN-008, CH-004 |
| F9 | Richer effects and transitions, including a transition slot (the object model has none) | TL-001, TL-006, EX-003 |
| F10 | Element-declared play controls: a component declares extra transport buttons (jump to element in/out, focus, hold) | TL-010, CPT-003 |
| F11 | Duration: derived from elements, or author-set fixed with a draggable slider | TL-009, TL-001, TL-005 |

### 1.2 Scope decisions already made (not reopened here)

- **SMT is deferred.** No pivot detection, no swing-pair comparison, no confirmation workflow. The
  swing path in F1 is an *authoring* device, not a pivot detector: nothing in this spec infers
  structure from data.
- **CSV/JSON import is deferred to a seam only.** F2 defines a typed datasource interface in
  `packages/core` — source identity, provenance/origin, revision/hash, bar ordering, stable bar IDs.
  No importer, no wizard, no file reading. The chart consumes a datasource-shaped series whether it
  came from an authored path, the synthetic generator, or a future importer.
- **Authentic tick replay stays out** (FUNCTIONAL_SPEC §9). Every intrabar path in this slice is a
  simulation and must be labelled as one.

### 1.3 The one place the scope narrows, and why

F7 says linked panes move together by a shared **market-time** mapping. With import deferred there
are no real UTC timestamps anywhere in the product: every series is either authored (logical bar
indices) or synthetic (a synthetic timeline). Two *different* instruments therefore have no shared
market truth to align to.

The smallest decision that changes the request: **the shared clock exists and is explicit, and the
binding of a pane to that clock is authored, never inferred.** The relation between two panes is
one of exactly two kinds (§3.4.1), and each is honest about what it knows.

- **Rollup — one asset at two timeframes.** Exact by construction: both panes read the same
  source, the clock maps to bar indices in that source, and the coarser pane aggregates it as-of.
  The relation between the two timeframes is *derived* from the two aggregation factors
  ("1D = 24 × 1H"), so it cannot disagree with the data. No row-index alignment is used — the
  alignment is by construction.
- **Lockstep — two assets on one timeframe.** The two panes are on the same timeframe and the same
  number of candles, and they advance together on the shared clock, so a candle forming in one
  forms at the same moment in the other. Because the two series share no market truth yet, the
  correspondence is **authored**: the creator declares the shared timeframe, the inspector labels
  the relation "authored link — not market time", and the export metadata records it as authored.
  The UI never claims market-time alignment for data that has no market time.
- When a real importer lands, the UTC binding replaces the authored one; nothing else moves.

This is stated now rather than discovered during implementation. It does not narrow F7's other half:
pane layout, per-pane lifecycle, shared cursor, camera and aggregation are all delivered in full.

---

## 2. Design principles for this slice

1. **One model, not two.** Panes and drawings are not a parallel object system beside clips; they
   are data inside the chart clip, and drawings are clips that anchor to a chart clip. Every new
   concept is expressed with the existing vocabulary: `Clip`, `Track`, `ElementType`, registry
   definition, props bag.
2. **Market truth is a value, never a pixel.** A drawing stores a price, a bar and a time. Pixels
   are derived at render time from the pane that owns the drawing. Resizing, re-scaling or moving a
   chart cannot detach an annotation from its price (CPT-005).
3. **Determinism is structural.** Path → series → candles → frame state is a chain of pure functions
   in `packages/core` with no clock, no randomness beyond a seeded PRNG and no editor state. The same
   project snapshot and frame index always produce the same frame (TL-007).
4. **No lookahead, by construction.** A pane's visible bars are those whose bar index is at or
   before the as-of index the clock yields. Aggregation of a coarser timeframe uses only eligible
   constituent bars (TF-003). The price scale never moves because of a bar that has not been revealed
   unless the author pinned the range explicitly.
5. **Provenance is never lost.** A series carries its origin. A generated series carries the
   algorithm version and the seed. A simulated intrabar path is labelled in the editor and in the
   export (AN-005, QA-005).
6. **Components declare, the shell executes.** New capabilities that touch the chrome — transport
   actions, tool availability, inspector panels — are declared in the registry, not hardcoded in
   `apps/studio` by component name. This is the ADR-003 rule applied to the editor, not just to the
   renderer.

---

## 3. The target object model

### 3.1 Shape of the document

```text
Project                                   schemaVersion 2
├── name, width, height, fps, backgroundColor
├── durationInFrames                      derived or fixed (TL-009)
├── durationMode                          'derived' | 'fixed'
├── series: SeriesSpec[]                  project-level market data registry (MD-009)
└── tracks: Track[]
    ├── id, name
    ├── clips: Clip[]                     one clip = one scene object
    │   ├── id, name, element: ElementType, from, durationInFrames
    │   ├── props                         typed per component; the chart carries panes + elements
    │   ├── effects: EffectInstance[]
    │   ├── groupId?, propsVersion?
    │   └── (chart clips) panes, drawings, clock
    └── transitions?: TrackTransition[]    transition slot on the clip boundary (F9)
```

A **scene object** in this slice is exactly a `Clip`. There is no second object graph.

### 3.2 Series registry and the datasource seam

Series live at project level so that one dataset can back several chart instances without
duplication (CH-006) and so that a pane can point at a series by reference.

```ts
// packages/core/src/series.ts

export type SeriesOrigin = 'authored-path' | 'manual' | 'synthetic' | 'imported';

export interface OhlcBar {
  /** Stable within a series revision. */
  id: string;
  /** Bar open time. Logical bar index for authored/manual series; UTC ms when timeBasis is 'utc'. */
  t: number;
  o: number; h: number; l: number; c: number; v?: number;
}

/** The read-only view a chart consumes. */
export interface Datasource {
  readonly id: string;
  readonly origin: SeriesOrigin;
  /** Content hash of the materialised series. Changes when the content changes. */
  readonly revision: string;
  readonly label: string;
  readonly symbol?: string;
  readonly timeframeId?: string;
  readonly timeBasis: 'logical' | 'utc';
  /** Ascending by time. Stable ids. */
  readonly bars: readonly OhlcBar[];
}

/** The persisted, authored form. Discriminated by origin. */
export type SeriesSpec =
  | { id: string; origin: 'authored-path'; label: string; symbol?: string;
      timeframeId?: string; timeBasis: 'logical'; seed: string; algorithmVersion: number;
      path: SwingPath }
  | { id: string; origin: 'manual'; label: string; symbol?: string;
      timeframeId?: string; timeBasis: 'logical'; bars: OhlcBar[] }
  | { id: string; origin: 'synthetic'; label: string; symbol?: string;
      timeframeId?: string; timeBasis: 'logical'; seed: string; algorithmVersion: number;
      generator: { count: number; startPrice: number; timeframeMs: number;
                   volatility?: number; drift?: number } }
  | { id: string; origin: 'imported'; label: string; symbol?: string;
      timeframeId?: string; timeBasis: 'utc'; revision: string; bars: OhlcBar[] };

export const materialiseSeries: (spec: SeriesSpec) => Datasource;   // pure
export const seriesRevision: (spec: SeriesSpec) => string;          // pure content hash
```

`materialiseSeries` is the single place a spec becomes bars:

- `authored-path` → `generateSeriesFromPath` (§3.3).
- `manual` / `imported` → the stored bars, re-hashed.
- `synthetic` → `generateSyntheticBars` with the stored seed and generator options.

The revision hash covers the materialised content, so an edited anchor, an edited bar and a changed
seed all produce a different revision — which is what MD-004's "source revisions / content hashes
are stable references" needs.

**Imported bars stay immutable.** MD-004 requires edits to be overlays on an immutable source. That
overlay model is *not* built in this slice (it belongs with the importer). What this slice does
guarantee: an `imported` series' `bars` are never mutated in place by any command in this slice; the
only series this slice mutates is `authored-path` (its path) and `manual` (its bars, by the existing
numeric inspector). The plan records the overlay work as the first task of the import slice.

### 3.3 The authored swing path

```ts
// packages/core/src/path.ts

export type AnchorRegime = 'auto' | 'trend' | 'range';

export interface SwingAnchor {
  id: string;
  /** Index of the bar this anchor pins. */
  barIndex: number;
  /** The price this bar closes at, exactly. */
  price: number;
  /**
   * The character of the segment that runs FROM this anchor TO the next one.
   * `auto` classifies it from the drawn move against the configured volatility:
   * a move that is small next to the noise is a range, anything else is a trend.
   * `trend` and `range` force the choice.
   */
  regime?: AnchorRegime;
}

/** The authored drawing: the anchors, and nothing else. */
export interface SwingPath {
  /** Ascending by barIndex. The first is bar 0 and the last is the final bar. */
  anchors: SwingAnchor[];
}

/** The generator's settings. Every field has a default; the creator sets few of them. */
export interface PathGeneratorOptions {
  /** Typical log-return standard deviation per candle. Default 0.002 (0.2%). */
  volatility?: number;
  /** Deviation of the realised price from the drawn guide. Default 0.72; 0 = the guide exactly. */
  pathNoise?: number;
  /** Simulated subdivisions per candle. Default 24. */
  intrabarSteps?: number;
  /** Base activity proxy. Default 1000. This is NOT exchange volume. */
  baseVolume?: number;
  /** Quantise prices to this grid. Anchor prices must already lie on it. */
  tickSize?: number;
  /** Counter-trend sub-swings inside a trend segment. */
  retracements?: { enabled?: boolean; probability?: number; minBars?: number;
                   everyBars?: number; depthMin?: number; depthMax?: number };
  /** Sideways phases: ranging segments and trend pauses. */
  consolidations?: { enabled?: boolean; flatThreshold?: number; meanReversion?: number;
                     rangeWidth?: number; trendPauseProbability?: number;
                     pauseMinBars?: number; pauseMaxBars?: number; pauseSpeed?: number };
  /** Wick sizing. */
  wicks?: { strength?: number; slopeSensitivity?: number; rangeBoost?: number;
            bodySensitivity?: number };
  /** Volatility persistence and shock size. */
  volatilityClustering?: { persistence?: number; shock?: number };
}

/** What the generator decided about one segment between two anchors. */
export interface PathSegment {
  fromIndex: number;
  toIndex: number;
  regime: 'trend' | 'range';
  /** abs(log(end/start)) per bar. */
  averageLogMovePerBar: number;
  /** The relative wick scale this segment's slope and regime produced. */
  wickMultiplier: number;
  retracementCount: number;
  pauseCount: number;
}

export const generateSeriesFromPath: (
  path: SwingPath,
  options: {
    seed: string;
    algorithmVersion: number;
    seriesId: string;
    generator?: PathGeneratorOptions;
  },
) => { bars: OhlcBar[]; segments: PathSegment[] };

/** A price/time point on the drawn stroke, before an id is minted. */
export interface AnchorPoint {
  barIndex: number;
  price: number;
}

/**
 * Convert a freehand screen stroke into anchor points. The stroke's horizontal
 * extent maps across the whole series; its vertical extent maps onto the price
 * range. The stroke is simplified (Ramer–Douglas–Peucker) before conversion.
 */
export const strokeToAnchorPoints: (
  points: readonly { x: number; y: number }[],
  cfg: {
    width: number;
    height: number;
    candleCount: number;
    minPrice: number;
    maxPrice: number;
    simplifyTolerancePx?: number;
    logScale?: boolean;
    tickSize?: number;
  },
) => AnchorPoint[];
```

**Generation algorithm (normative).** `generateSeriesFromPath` is a pure function of
`(path, seed, algorithmVersion, generator)`. It is a **port** of the author's reference
implementation, `docs/reference/data-generation/path-to-candles-advanced.ts`, which is the
normative source for this algorithm; the port changes only the seeding (it uses the package's
seeded PRNG) and the output shape (`OhlcBar[]` instead of `Candle[]`).

The algorithm works in **log-price space** — the natural space for a price series, because
percentage moves are then additive and the result is scale-invariant (a path drawn on a
0.5–0.6 series and the same path drawn on 10000–12000 produce identical relative output).

1. **Validate.** Reject a `candleCount` below 2, fewer than two anchors, a duplicate anchor index,
   an index outside `[0, candleCount - 1]`, a non-finite or non-positive price, an unknown regime,
   and — when a `tickSize` is configured — an anchor price that is not on the tick grid. The first
   anchor must be index `0` and the last must be index `candleCount - 1`: a path is defined over
   the whole series, not over a fragment of it.
2. **Build the volatility series.** A per-bar volatility is drawn from an AR(1) process:
   `volState = persistence * volState + shock * normal()`, then
   `sigma[i] = volatility * clamp(exp(volState), 0.35, 3)`. This produces **volatility
   clustering** — quiet stretches stay quiet, a shock raises volatility for a while and then decays.
   Volatility is per-bar and expressed as a log-return standard deviation, so the same setting
   behaves identically at any price level.
3. **Classify each segment.** A segment runs from anchor *k* to anchor *k+1*. Its regime is
   `auto`-classified: the drawn move is compared with the volatility over that segment, and a move
   that is small next to the noise becomes a `range`, anything else a `trend`. An anchor's explicit
   `regime` (`trend` or `range`) overrides the classification. The classification is what makes a
   flat drawn segment produce a sideways market instead of a straight line.
4. **Build the guide.** For a `trend` segment the guide runs from the first anchor's log-price to
   the second's, with two optional structural features:
   - a **pause** — a stretch of bars where progress nearly stops, so the trend consolidates;
   - a **retracement** — a sub-leg that moves *against* the trend by a fraction of the impulse,
     which is what makes a drawn rise read like a real market rather than a straight line.
   For a `range` segment the guide is a mean-reverting process around the drawn line, conditioned
   on both endpoints, so it oscillates instead of trending. Both ends of the guide are exactly the
   anchor prices.
5. **Add the noise.** A **Brownian bridge** in log-price space is laid over the guide: the
   increments are drawn from the seeded PRNG and the walk is re-centred so its value is `0` at both
   ends, which keeps the anchor prices exact while letting the path wander between them. The
   bridge is **weighted by the local volatility**, so a quiet stretch wanders less than a volatile
   one. `pathNoise` scales it; `pathNoise = 0` gives the bare guide.
6. **Build the body.** The close of a bar is the exponentiated guide; the open is the previous
   close. **At an anchor's own `barIndex` the close equals the placed price exactly** — the anchor
   price overrides the generated value, so the drawn price is authoritative, not approximate.
7. **Build the extremes.** Each bar's high and low come from a second Brownian bridge **inside**
   the bar: the bridge is walked from the open to the close in `intrabarSteps` steps, and the
   highest and lowest sampled points become `h` and `l`. The bridge's per-step scale is
   `wickVol / sqrt(steps)`, where `wickVol` combines the bar's volatility with a multiple of its
   body, so a large body gets a wider range. The wick scale also rises with the segment's price
   slope — the same price distance over fewer bars is a sharper move and gets more wick — and a
   `range` segment gets extra wick. The result visits both extremes and starts at the open and
   ends at the close, which is what AN-003 requires of a simulated intrabar path.
8. **Apply the tick grid** when `tickSize` is configured: the close, the high and the low are
   rounded to the grid, and the anchor prices were already required to lie on it.
9. **Enforce the invariants.** `h >= max(o, c)`, `l <= min(o, c)`, all prices finite and strictly
   positive; a violation throws rather than emitting a broken bar.
10. **Emit** bars with `id = `${seriesId}:${index}`` and `t = index` (logical time basis), and the
    per-segment diagnostics (`regime`, `averageLogMovePerBar`, `wickMultiplier`,
    `retracementCount`, `pauseCount`) alongside them.

**What the algorithm guarantees, and what it does not.**

- **Guaranteed:** the close of an anchor bar equals the placed price exactly; the OHLC invariants
  hold; the same `(path, seed, algorithmVersion, generator)` always produces the same bars; the
  result is scale-invariant in the sense above; the seed is the only source of randomness.
- **Not guaranteed:** that the closes stay inside the drawn band. A leg's closes can overshoot
  their anchors — the drawn path is the *skeleton*, not a corridor. Measured on the reference
  implementation with the default settings, the worst overshoot on a 100 → 120 leg over 60 bars is
  0.08% of the price; raising `volatility` widens it, and at `volatility = 0.05` it reaches ~40%.
  The `auto` regime classification is what keeps a *flat* leg from drifting: a flat drawn segment
  becomes a `range` and mean-reverts around the line instead of wandering off it.
- **Not guaranteed:** that a drawn reversal reads as a reversal of the same magnitude. A
  retracement is a fraction of the impulse, so a drawn V produces a shallower V. This is the
  intended realism, and it is why the `regime` override exists.

**Why the close and not the extreme.** An earlier draft of this algorithm pinned a `high` anchor to
the bar's `h` and a `low` anchor to its `l`. That is degenerate: the guide already passes through
the anchor price as the close, so pinning the extreme to the same price produced `h == c` on a high
anchor and `l == c` on a low anchor — a zero-range bar with no wick at all, and a "swing high" that
rendered as a flat line. Pinning the **close** keeps one quantity authoritative (the placed price)
and gives every bar a real range. The adopted reference implementation reaches the same conclusion
independently: it overrides the generated close at anchor indices and never pins an extreme. The
drawn level is a close; the wick may reach beyond it.

**Why the Brownian bridge and not a clamp.** A hard clamp to the drawn band would make every leg
monotone and the series visibly artificial — a real market that rises 20% does not rise in a
straight line. The bridge gives the same *anchors* with a realistic path between them, and the
`auto` regime classification handles the flat-leg case that a clamp would have handled badly. The
cost is that the drawn path is a skeleton rather than a corridor, which is a deliberate change of
meaning: the creator draws the shape of the market, not its exact trace.

**Intrabar path.** The generator's own Brownian bridge supplies each bar's high and low, and it
satisfies AN-003 by construction: the path starts at the open, ends at the close, stays inside
`[low, high]` and visits both extremes, because `h` and `l` *are* the extremes of the sampled path.
The **reveal** of a partially formed bar during playback is a separate concern and continues to use
`buildWaypoints` and `simulateBar` in `packages/core/src/market.ts` unchanged. The two never
disagree: the reveal walks the range the generator already fixed.

### 3.4 Chart clips: panes and elements

A chart clip's props move from a flat bag to a typed structure. The chart *is* the collection of
elements (CH-009).

```ts
// packages/core/src/elements.ts

export type ElementId = string;

/** Where an element sits inside the chart frame, in 0..1 of the chart's width/height. */
export interface ElementRect { x: number; y: number; width: number; height: number; }

/** A candle pane: one series, one viewport, one clock binding. */
export interface PaneSpec {
  id: ElementId;
  name: string;
  seriesId: string;
  timeframeId?: string;
  /** 1 = raw bars. n = buckets of n source bars, aggregated as-of. */
  aggregation: { factor: number };
  rect: ElementRect;
  /** Lifecycle relative to the chart clip's first frame. */
  in: number;
  out: number;
  opacity: number;
  /** Easing curve for this pane's growth and its own entry/exit. */
  curve?: Curve;
  /** How this pane maps onto the chart's shared clock. */
  clock: ClockBinding;
  /** Price scale policy. 'auto' = revealed bars only (today's behaviour, no leakage). */
  priceRange: { mode: 'auto' } | { mode: 'fixed'; min: number; max: number };
  viewport?: { fromBar: number; barCount: number };
  /** Pause points: hold the pane on one candle. */
  holds?: PaneHold[];
  /** Camera zoom track, used by the HTF→LTF zoom element. */
  zoom?: ZoomTrack;
  style?: PaneStyle;
}

export interface PaneHold { barId: string; in: number; out: number; }

export interface ZoomTrack {
  /** Frame ranges relative to the chart clip. */
  segments: Array<{ in: number; out: number; from: { aggregation: number; fromBar: number };
                   to: { aggregation: number; fromBar: number }; curve?: Curve }>;
}

/** A market anchor: the only way a drawing refers to the market. */
export type MarketAnchor =
  | { kind: 'price'; price: number }                                  // an explicit level
  | { kind: 'candle'; barId: string; side: 'high' | 'low' | 'close' }  // a candle extreme
  | { kind: 'time'; barId: string }                                   // a bar's time
  | { kind: 'point'; barId: string; price: number };                   // a price at a bar

export interface DrawingSpec {
  id: ElementId;
  kind: DrawingKind;
  name: string;
  /** The chart clip this drawing is attached to. */
  chartClipId: string;
  /** The pane inside that chart whose scale and time the anchor resolves against. */
  paneId: ElementId;
  anchors: Record<string, MarketAnchor>;
  /** Lifecycle relative to the chart clip. */
  in: number;
  out: number;
  opacity: number;
  curve?: Curve;
  style?: Record<string, string | number | boolean>;
  /** Position tool specifics. */
  position?: { direction: 'long' | 'short'; entry: number; stop: number; target: number;
               showRiskReward?: boolean };
  /** Zone specifics. */
  zone?: { extendRight?: boolean };
  /** Label specifics. */
  label?: { text: string };
}

export type DrawingKind =
  | 'priceLine' | 'highLowLine' | 'verticalLine' | 'trendline'
  | 'priceZone' | 'textLabel' | 'arrow' | 'position';
```

**Chart props (schema v2).**

```ts
export interface CandlestickChartProps {
  /** The series a new pane starts from. */
  seriesId: string;
  panes: PaneSpec[];
  /** The shared market-time mapping for this chart's panes. */
  clock: MarketClock;
  /** Chart-level default curve, overridden per element. */
  curve?: Curve;
  style: ChartStyle;
}

export interface MarketClock {
  id: string;
  /** 'logical' until a UTC importer exists. */
  unit: 'logical' | 'utc';
  /** Reference series for a logical clock. */
  referenceSeriesId: string;
  /** Bars per clock step. */
  stepBars: number;
  /** Author-supplied offsets, keyed by series id, for panes on other series. */
  offsets?: Record<string, number>;
}
```

### 3.4.1 The timeframe ladder

Every timeframe the product offers is one rung of a **ladder**, and each rung declares how many
**base units** it spans. The base unit is one minute:

| Rung | Base units | Notes |
|---|---|---|
| `1m` | 1 | the base rung |
| `3m` | 3 | |
| `5m` | 5 | |
| `15m` | 15 | |
| `30m` | 30 | |
| `1H` | 60 | |
| `4H` | 240 | |
| `6H` | 360 | |
| `7H` | 420 | the overnight futures session |
| `2D` | 2880 | two 24-hour periods |
| `1W` | 10080 | seven 24-hour periods |
| `1M` | 43200 | thirty 24-hour periods — **nominal**; a calendar month is 28 to 31 days |

The ladder is a **fixed catalogue**, not a free-form factor. A pane names a rung; it does not carry
an arbitrary multiplier. The ladder is what makes the relationships between timeframes *derivable*
rather than authored twice.

**The base rung resolves the divisibility problem.** Measured across the ladder's 66 unordered
pairs, **58 divide evenly** and **8 do not**:

| Pair | Ratio | Why |
|---|---|---|
| `3m → 5m` | 1.667 | |
| `4H → 6H` | 1.5 | |
| `4H → 7H` | 1.75 | |
| `6H → 7H` | 1.167 | |
| `7H → 2D` | 6.857 | a 24-hour period is not a whole number of 7-hour sessions |
| `7H → 1M` | 102.857 | |
| `2D → 1W` | 3.5 | a week is not a whole number of two-day periods |
| `1W → 1M` | 4.286 | a month is not a whole number of weeks |

This is not a defect to be engineered away — it is what the real calendar does, and it is exactly
why the ladder is defined against a **base rung** rather than against each other. Every coarser
timeframe is built from the base:

```text
barsPerRung(rung) = rung.baseUnits / base.baseUnits
```

A `4H` pane and a `6H` pane over the same `1m` source do **not** have a whole-number ratio to
each other (1.5), and no amount of authoring fixes that — a 6-hour candle is not a whole number of
4-hour candles. What *is* expressible is that both are built from the same base: `4H = 240 × 1m`
and `6H = 360 × 1m`, so they share the base and can be compared against it.

So the rollup relation between two timeframes is stated **through the base**, and the product says
so plainly:

- when the ratio is whole — `1H = 60 × 1m`, `1D = 24 × 1H` — the relation is an exact integer
  multiple and is displayed as such;
- when it is not — `4H = 1.5 × 6H` — the relation is displayed as a **fraction of the base**, never
  as a fake whole-number multiple, and the two panes are related through the base rather than to
  each other.

**The ladder is not a session calendar.** A base unit is a minute of *clock time*, not a minute of
*trading*. A 24-hour period is 1440 minutes regardless of the market's session, but how many of
those minutes carry a price depends on the session — 23 hours for a futures session, 6.5 hours of
regular trading hours for a cash equity, and a different answer across a daylight-saving
boundary. The ladder therefore fixes the **ratio**; the **calendar** fixes which base units exist.
That split is the honest one, and it is why TF-001 and TF-007 stay deferred: the ratio can be
delivered now, the calendar cannot.

This is why "1D = 24 × 1H" is not one number but two: **24** is the clock-time ratio (a day is
1440 minutes, an hour is 60) and **23** is the session ratio (a futures day carries 23 hourly
candles). The ladder states the first. The second needs the session calendar, so the product
labels it as unavailable rather than guessing a number and calling it a day. A creator who knows
their instrument's session can still author the buckets; the app does not invent them.

A rollup therefore **buckets by base units**, not by row index across a coarser series: the
`6H` pane's bucket boundary falls on base unit 360, 720, 1080… and the `4H` pane's on 240, 480,
720… Two panes on the same base share every boundary that is a multiple of both, which is what
makes them comparable at all.

### 3.4.2 The grouped chart

A **grouped chart** is the scene-level container for the split layouts. It holds **one to three
chart objects** and gives them a shared arrangement, a shared clock and a shared set of
relationships. The name matters because it says what the thing *is*: not a special widget with two
panes, but a group of charts that the creator arranges.

```ts
// packages/core/src/elements.ts

/** The scene-level container for one to three chart objects. */
export interface ChartGroupSpec {
  id: ElementId;
  name: string;
  /** The chart clips in this group. One to three. */
  chartClipIds: ElementId[];
  /** The arrangement the creator chose. */
  layout: 'single' | 'split-horizontal' | 'split-vertical' | 'pip';
  /** The shared clock for the group's charts. */
  clock: MarketClock;
  /** The declared relations between the group's panes. */
  relations: PaneRelation[];
}
```

**Why a group and not a two-pane chart.** CH-002 asks for "HTF alone, LTF alone, two charts side by
side, HTF with LTF inset, and synchronized 2/3-asset layouts". Those are not two needs — they are
one need with a count. A group of one to three charts expresses all of them: one chart alone is
the single layout, two side by side is the split, and a third gives the 3-asset layout that SMT
needs (SM-001, SM-011). A dedicated two-pane widget would have to be extended to three anyway, and
would leave the 2/3-asset layout — which the SMT engine requires — as a different mechanism.

**The count is a product limit, not an arbitrary one.** SMT compares **two or three** assets, never
one and never more than three (SM-001). The group's ceiling of three is the SMT ceiling, so the
layout the comparison workflow needs is the layout the product already has.

**What the group owns and what it does not.** The group owns the *arrangement* — the layout
preset, the shared clock and the declared relations. It does **not** own the charts' data, their
lifecycles or their prices. Each chart keeps its own series, its own price scale, its own viewport
and its own in/out frames, exactly as CH-003 and CH-004 require. The group's convenience is that
the charts move together by default; it never forces them to (SC-002: a group is an association,
not an ownership requirement).

**The relation lives on the group, not on the chart.** A rollup relates two panes of the same
chart — one asset at two timeframes. A lockstep relates panes across two charts — two assets on
one timeframe. Both are properties of the *arrangement*, so both are declared on the group, where
the layout that makes them visible is defined alongside them.

### 3.4.3 How panes relate to each other

A chart may hold panes that are unrelated (an HTF beside an LTF that share nothing) or panes the
creator meant to be compared. A relation is **declared**, never inferred from two panes happening
to sit next to each other: only a declared relation can be checked, labelled and exported.

```ts
// packages/core/src/elements.ts

/** A timeframe the product offers. A rung of the ladder, never a free multiplier. */
export type TimeframeId =
  | '1m' | '3m' | '5m' | '15m' | '30m' | '1H'
  | '4H' | '6H' | '7H' | '2D' | '1W' | '1M';

/** A declared relation between two panes of one chart. */
export type PaneRelation =
  | {
      kind: 'rollup';
      /** The pane that reads the base rung directly. */
      finePaneId: ElementId;
      /** The pane that buckets the same base into a coarser rung. */
      coarsePaneId: ElementId;
    }
  | {
      kind: 'lockstep';
      /** The two panes, on two different series. */
      paneIds: [ElementId, ElementId];
      /** The shared displayed rung, authored by the creator. */
      timeframeId: TimeframeId;
    };
```

`CandlestickChartProps` gains `relations?: PaneRelation[]`.

**Rollup — one asset at two timeframes.** Both panes read the *same* base series. The fine pane
shows the base rung's bars; the coarse pane buckets the same base into its rung, aggregated as-of.
The relation between the two timeframes is therefore exact and **derived**, never authored twice:

```text
barsPerCoarse = coarse.baseUnits / fine.baseUnits
```

Both panes' buckets are aligned to the base, so the two timeframes are always comparable through
it. The coarse pane's ratio is displayed exactly: `24 × 1H` where that is the truth, `1.5 × 4H`
where it is not, and in every case the base it is built from is shown too.

**Lockstep — two assets on one timeframe.** The two panes read *different* series. They share the
chart's clock, so they advance together: at any chart frame both panes have consumed the same
number of bars, and the candle forming in one forms at the same moment in the other. The relation
states the shared displayed rung, and the validator checks what is checkable:

- both panes carry the same rung — neither is coarser than the other;
- both panes show the same number of candles — the same effective `viewport.barCount`;
- both panes' `timeframeId`, where declared, equals the relation's `timeframeId`.

The second pane's clock binding is `offset` with `offsetBars: 0`: it reads its own series at the
clock's index. A non-zero offset is the same mechanism with the series deliberately shifted — the
authored case of "ES leads NY by three bars" — and it carries the same label.

**What a relation does not claim.** Without a UTC source there is no shared market truth between
two different series, so a lockstep relation asserts only what the creator authored: that the two
series are to be read side by side at the clock's index. The inspector labels a cross-asset
relation "authored link — not market time", and the export metadata records it as authored. When a
UTC importer lands, the same relation resolves against market time and nothing else about it
changes (CH-005, §1.3).

**Why a relation must be declared.** Two panes in one chart share a clock whether or not they are
related, so "they sit in the same chart" says nothing about whether the creator meant them to be
compared. A declared relation is what makes the constraints checkable, what makes the timeframe
relationship readable, and what makes the export record say which panes were compared and how.

**Why drawings are clips and not chart children.** OB-003 requires a drawing to anchor to
`(chartId, candle/time, price)` — a reference *out* of the drawing, which means the drawing is a
sibling of the chart in the scene graph, not a child of it. OB-001 lists the drawing kinds alongside
chart and chart group as object types. A drawing therefore is a `Clip` with its own `ElementType`,
its own track position, its own in/out frames and its own effects stack, exactly like every other
scene object. The chart is the collection of elements the creator perceives: its panes, and the
drawings anchored to it.

**The pane is the element collection's data.** A chart clip holds its panes; drawings are separate
clips that name a `chartClipId` and a `paneId`. Selecting the chart selects the whole collection;
selecting a drawing selects one element. "Controllable as a whole" means the chart clip keeps its own
transform, size, effects and lifecycle; "individually controllable" means each pane and each drawing
carries its own rect, lifecycle, opacity and curve.

### 3.5 The clock, the binding, and the as-of evaluation

```ts
export type ClockBinding =
  | { kind: 'reference' }                                   // follow the reference series' own bars
  | { kind: 'offset'; offsetBars: number }                  // explicit authored offset (logical only)
  | { kind: 'utc' };                                        // real market time (requires a UTC series)
```

The chart's clock advances with the chart clip's own playback. At chart-local frame *f*:

```text
clockStep(f)     = f / framesPerBar
referenceIndex   = floor(clockStep(f))                     // index into the reference series
progress         = fract(clockStep(f))                     // 0..1 within that bar
```

For a pane bound with `offset`, the pane's source index is `referenceIndex + offsetBars`. For a pane
with `aggregation.factor = n`, the pane's bucket index is `floor(sourceIndex / n)` and the bucket's
as-of state aggregates only the constituent bars with index `<= sourceIndex` — a partially formed
bucket shows the aggregated values so far and is labelled as developing (TF-003, TF-004).

`evaluatePaneAt(pane, datasource, clock, chartLocalFrame)` in `packages/core/src/time.ts` is the one
pure function that produces a pane's frame state:

```ts
export interface PaneFrameState {
  bars: PartialBar[];        // only bars at or before the as-of index
  activeIndex: number;       // index into the pane's own bar array, -1 when none
  range: { min: number; max: number };
  /** True when the active bar is a partially aggregated bucket. */
  developing: boolean;
}
```

Two rules follow from it and are asserted by tests:

- **No future bar.** `bars` never contains an index beyond the as-of index.
- **No future influence on the scale.** With `priceRange.mode = 'auto'` the range is computed from
  the revealed bars only, so a future bar cannot move the axis. With `'fixed'` the author chose the
  range, which is a deliberate, visible authoring decision, not leakage.

`evaluateBarsAtFrame` in `packages/core/src/market.ts` is kept and becomes the uniform-mapping special
case of this evaluation, so the existing 154 tests keep their names and their assertions.

### 3.6 Curves

```ts
// packages/core/src/curve.ts

export type CurvePreset =
  | 'linear' | 'easeIn' | 'easeOut' | 'easeInOut' | 'bounceOut' | 'elastic' | 'overshoot';

export type Curve =
  | { kind: 'preset'; name: CurvePreset }
  | { kind: 'cubicBezier'; p: [number, number, number, number] };

export const evaluateCurve: (curve: Curve, t: number) => number;   // pure, 0..1 -> 0..1
```

`evaluateCurve` is implemented in `packages/core` with no Remotion import: a cubic-bezier solver
(bisection on x, then y) plus the presets expressed as control points. It is the single evaluator
for everything curve-driven in this slice:

- a pane's growth curve (how its bars form, per candle where meaningful),
- a drawing's own curve (its entry/exit and any progressive draw),
- the chart-level default curve.

**The legacy effect easing vocabulary is not rewritten.** `packages/components/src/base/effects.ts`
keeps Remotion's `Easing` for the existing `easing` parameter, so no rendered frame of an existing
project changes. This slice *extends* that vocabulary where the brief asks for it:

- the shared `EASING_PARAM` gains the `custom` option and a matching bezier text parameter, so every
  effect that already exposes `easing` can take a custom curve through the same control;
- the effects that are currently static or linear — `fadeIn`, `fadeOut`, `blurIn` — gain an `easing`
  parameter, and `spinIn` and `bounceDrop` gain one in place of their hardcoded curve.

The curve editor writes `Curve` values for elements and panes, and writes the legacy `easing`/`bez`
string parameters for effects. The inspector presents them through one widget (CV-004).

### 3.7 The evaluate/render contract extension

A market-anchored drawing cannot resolve its own geometry: it needs the chart clip's pane state at
the current frame. The current contract — "render receives `(clip, props, frame, fps)` and nothing
else" — cannot express that, so the contract gains an evaluation step, matching the shape ADR-003
already describes conceptually:

```ts
export interface VideoComponentDefinition {
  // …existing fields…
  /** Optional pure evaluation. Runs once per frame per clip, before render. */
  evaluate?: (input: {
    clip: Clip;
    props: ComponentProps;
    /** Absolute frame in the composition. */
    sceneFrame: number;
    /** The immutable project snapshot the frame is evaluated against. */
    project: Project;
  }) => unknown;
}

export interface ComponentRenderContext {
  clip: Clip;
  props: ComponentProps;
  /** Clip-relative frame. */
  frame: number;
  fps: number;
  /** Result of the definition's evaluate step, if it has one. */
  evaluated?: unknown;
}
```

Rules:

- `evaluate` is pure and receives no editor state, no DOM and no clock.
- The composition calls `evaluate` once per clip per frame and passes the result to `render`.
- A definition without `evaluate` behaves exactly as today.
- `packages/core` still imports no React, Remotion, Zustand or storage code; `Project` is data.

This is the only change to the component contract in this slice, and it is recorded in
`docs/spec/COMPONENT_CONTRACT.md` (CPT-003 extension) and in ADR-007.

### 3.8 Element-declared transport actions

```ts
export interface TransportAction {
  id: string;
  label: string;
  icon: string;
  /** 'seek' jumps the transport; 'toggle' flips a state the component owns. */
  kind: 'seek' | 'toggle';
  /** Absolute frame to seek to. Null when the action is not currently applicable. */
  seekTo?: (input: { props: ComponentProps; sceneFrame: number }) => number | null;
  /** Toggle target, resolved by the shell through the component's own props. */
  toggle?: 'hold';
}

export interface VideoComponentDefinition {
  // …
  transportActions?: TransportAction[];
}
```

The shell renders the buttons of the **selected** clip's definition in the transport bar
(`apps/studio/src/components/PreviewPanel.tsx`, the floating bar that already holds play, step and
mute) and executes them generically: `seek` calls `seekTo`, `toggle` flips the `holds` array of the
pane the component owns. No component name is hardcoded in `apps/studio` (CPT-003, TL-010).

### 3.9 Transitions and duration

**Transition slot.** ADR-003's addendum already decided the location: *a transition belongs to the
boundary between two clips on a track, not to a clip.* The track gains an optional list.

```ts
export interface TrackTransition {
  id: string;
  /** The clip that hands over. */
  fromClipId: string;
  /** The clip that takes over. */
  toClipId: string;
  /** A transition component id from the registry. */
  element: ElementType;
  durationInFrames: number;
  props?: ComponentProps;
}
```

The compositor clamps the duration to what the adjacent clips can give and the inspector reports the
clamp rather than letting a transition overlap a clip silently. Scene-level transitions reuse the
same slot when the hierarchical timeline lands (R6); nothing in the slot is scene-specific.

**Duration.** The project gains a mode:

```ts
durationMode: 'derived' | 'fixed';
durationInFrames: number;
```

- `derived` — the composition length is the maximum of every clip's `from + durationInFrames` and
  every chart element's `out`, clamped to at least one frame.
- `fixed` — the author sets it. The top bar already exposes a seconds field; this slice adds a
  draggable slider bound to the same value (TL-009).

**Verified, and stated because the brief asked:** the "8 second" figure is the *seeded sample
project's* duration, not an engine cap. `packages/core/src/sample-project.ts` declares 240 frames at
30 fps, the repository-root `project.json` declares the same 240, and `scripts/verify-r1.mjs` builds
its fixture with the same 240. The engine has no cap: the top-bar seconds field allows up to 3600
seconds, a new project starts at 300 frames, and the project migration accepts any positive
`durationInFrames`. The plan states this in the slice that touches duration.

### 3.10 Schema version 2 and migration

`CURRENT_PROJECT_SCHEMA_VERSION` moves from 1 to 2. The migration is **non-destructive and
idempotent**, exactly as the existing one is: `migrateProject(migrateProject(p))` deep-equals
`migrateProject(p)`.

What changes for an existing document:

| v1 | v2 |
|---|---|
| chart clip `props.bars: OhlcBar[]` | a project-level `series` entry of origin `manual` (or `synthetic` when `props.dataSource === 'synthetic'`) + the chart clip's `props.seriesId` |
| chart clip flat props | chart props v2: `seriesId`, `panes: [one pane]`, `clock`, `style` |
| `OhlcBar` without `id` | every bar carries a stable id, assigned deterministically from the series id and index |
| `Project.durationInFrames` | `durationMode: 'fixed'` with the same value, so no saved project changes length |

The migration rejects, as today, a document with a higher `schemaVersion`, an unknown component
type, or a clip whose `propsVersion` is newer than its component's (CPT-006). A v1 document with a
chart clip migrates to a v2 document whose single pane renders the same candles in the same place —
the plan asserts this by comparing rendered output before and after.

---

## 4. The datasource seam as the importer's landing site

The seam is a pure function boundary, not an interface with an implementation:

```text
SeriesSpec (persisted, authored)
        │  materialiseSeries(spec)            ← packages/core, pure
        ▼
Datasource (read-only view: identity, origin, revision, ordering, stable bar ids)
        │  consumed by panes
        ▼
PaneFrameState (bars, active index, range)
```

An importer written later produces a `SeriesSpec` with `origin: 'imported'`, `timeBasis: 'utc'` and
real timestamps, and nothing above this line changes. The chart does not know or care which of the
three origins produced the series it is drawing, except for the provenance badge it is required to
show (MD-001, AN-005).

---

## 5. Provenance and labelling

| Origin | Editor badge | Export metadata |
|---|---|---|
| `authored-path` | `AUTHORED PATH` | `origin: 'authored-path'`, `algorithmVersion`, `seed`, anchor count |
| `manual` | `MANUAL` | `origin: 'manual'`, bar count |
| `synthetic` | `SYNTHETIC DATA` (today's wording) | `origin: 'synthetic'`, `algorithmVersion`, `seed` |
| `imported` (future) | `IMPORTED` + source label | `origin: 'imported'`, source revision, timestamp convention |

Independently of the series origin, a chart that reveals bars dynamically carries today's
`SIMULATED INTRABAR` badge (AN-005). A partially aggregated bucket carries a `DEVELOPING` marker
(TF-004). A drawing that resolves against a `candle` anchor is hidden until its bar is revealed, so
an annotation can never reveal a future price.

---

## 6. Requirement mapping

### 6.1 New requirement IDs (to be added to `docs/spec/FUNCTIONAL_SPEC.md`)

| ID | Requirement |
|---|---|
| **MD-009** | The editor MUST expose a typed datasource seam carrying source identity, provenance/origin, a revision/content hash, ascending bar order and stable bar identifiers; no importer ships in this slice. |
| **MD-010** | A chart MUST consume its series by reference, so the same dataset can back several chart instances without duplication. |
| **CH-009** | A chart object MUST be a collection of elements — panes and the drawings anchored to it — each individually controllable in position, size, lifecycle and curve, with the collection itself controllable as a whole. |
| **OB-010** | Every element inside a chart MUST carry its own `[in,out)` lifecycle, opacity, transform and curve, evaluated relative to the chart clip. |
| **AP-001** | A swing-path tool MUST let the creator place swing anchors on the chart, and the generated candles MUST follow the drawn path, with the close of each anchor bar equal to the placed price exactly. The drawn path is the skeleton of the series, not a corridor: closes MAY overshoot the anchors between them. |
| **AP-002** | Candle generation MUST be a pure function of the path, a seed, an algorithm version and the generator settings; the same inputs MUST always produce the same bars. The anchor regime MUST determine the character of the segment that runs from that anchor to the next, and the generated series MUST remain scale-invariant. |
| **AP-003** | Moving an anchor MUST regenerate the series deterministically and re-render the affected elements without a reload. |
| **AP-004** | An authored path MUST remain distinguishable in the editor and in export metadata from synthetic and imported series. |
| **CV-001** | Element, pane and chart animations MUST accept an editable easing curve; the curve MUST apply per element and, where meaningful, per candle. |
| **CV-002** | Effects that are currently static or linear MUST accept an easing parameter, and effects that already expose one MUST accept a custom cubic-bezier through the same control. |
| **CV-003** | A curve MUST be stored as data, evaluated by a pure function, and MUST produce identical frames in preview and export. |
| **CV-004** | The inspector MUST provide a curve editor for every element, pane and effect that exposes a curve. |
| **TL-009** | Composition duration MUST be either derived from the elements or set by the author, and the fixed duration MUST be adjustable with a draggable slider. |
| **TL-010** | A component MUST be able to declare transport actions that the shell renders and executes generically in the playback controls. |
| **CH-010** | A chart MUST express the relation between its panes as a declared relation of exactly two kinds — a **rollup** (one asset at two timeframes, the coarser pane aggregating the same source as-of) or a **lockstep** (two assets on the same timeframe and the same number of candles, advancing together on the shared clock) — and the relation MUST be labelled and exported honestly, never claiming a market-time alignment that the data does not have. |
| **TF-008** | The relation between a rollup's two timeframes MUST be derivable from the panes themselves, so the displayed ratio ("1D = 24 × 1H") always agrees with the data; a lockstep relation MUST state the shared timeframe and the shared candle count it requires. |
| **TF-009** | The timeframes the product offers MUST be drawn from a fixed ladder — `1m`, `3m`, `5m`, `15m`, `30m`, `1H`, `4H`, `6H`, `7H`, `2D`, `1W`, `1M` — and every timeframe MUST be defined against the base rung rather than against each other, so two rungs with no whole-number ratio to each other remain comparable through the base. A non-whole ratio MUST be displayed as the fraction it is, never rounded into a whole-number multiple. |
| **CH-011** | The split layouts MUST be delivered as a **grouped chart** holding one to three chart objects with a shared arrangement, a shared clock and declared relations; the group MUST NOT take ownership of the charts' data, lifecycles or prices, and each chart MUST keep its own series, price scale, viewport and lifecycle. |

### 6.2 Existing requirement IDs this slice satisfies

| ID | How this slice satisfies it |
|---|---|
| CH-001 | A chart object has identity, series reference, timeframe, viewport, placement, style and frame in/out — now expressed as panes (§3.4). |
| CH-002 | HTF alone, LTF alone, side-by-side and inset are pane layouts inside one chart; presets are pane arrangements. The two split kinds the creator needs are present: one asset at two timeframes (rollup) and two assets on one timeframe (lockstep). |
| CH-003 | Each pane has its own vertical price scale and viewport; the shared cursor is the chart clock. |
| CH-004 | Solo, hide, freeze, resize, fade, move and zoom are per-pane lifecycle, opacity, rect, hold and zoom track. |
| CH-005 | Panes align through the chart clock and an explicit binding, never by row index. The relation between panes is declared (§3.4.1): a rollup is exact by construction, a lockstep across two assets is an authored link, labelled as such. |
| CH-006 | Series live at project level and are referenced, not copied. |
| CH-007 | A chart is selectable with canvas handles; its elements are selectable individually. |
| OB-001 | price line, high/low line, trendline, price zone, long/short position, arrow and text label ship as object types; the chart and chart group follow. |
| OB-002 | Every element carries `[in,out)`, ordered layer, opacity, placement and typed properties; the layer order is the track order. |
| OB-003 | Drawings anchor to `(chartId, candle/time, price)` through `MarketAnchor`. |
| OB-004 | Drawings are created on the canvas, edited numerically and by handles, and support delete, duplicate, lock, group, hide and undo/redo. |
| OB-005 | A zone carries price high/low and a horizontal interval with extend-right; a trendline keeps two chart-bound endpoints. |
| OB-006 | The position tool carries entry, stop, target, direction and an optional R:R label, and asserts no broker fill or P&L. |
| AN-001, AN-002 | Discrete and simulated reveals remain first-class per pane; the reveal set gains fade/grow/wipe choices with a curve. |
| AN-003 | The intrabar reveal path is generalised, not replaced; determinism, bounds and endpoint guarantees are unchanged. The generator's own intrabar bridge fixes each bar's high and low, and the reveal walks that range. |
| AN-004 | Partial state updates open, current high/low, current close and body for any directly seeked frame. |
| AN-005 | Simulation is identified in the editor and in export metadata. |
| AN-006 | Replay has a time remap with holds (pause points) and speed changes; preview speed does not alter saved durations. |
| AN-007 | Panes sharing a clock evaluate at a common instant with independent scales. |
| AN-008 | A held pane holds last-known values; no bar is fabricated to fill a gap. |
| MD-001 | Manual and imported series produce normalised, editable OHLC with stable IDs and explicit origin metadata. |
| MD-002 | The generator enforces finite values, `h >= max(o,c)`, `l <= min(o,c)` and positive prices. |
| MD-003 | Deferred with the importer; the seam carries symbol, timeframe and time basis so the wizard's answers have a home. |
| MD-004 | Imported bars are immutable; edits are overlays (overlay model lands with the importer). |
| MD-005 | Numeric OHLC entry stays; drag-handle editing of a candle is a later slice. |
| MD-007 | Series are addressable by id with a stable revision hash. |
| MD-008 | Authored series use logical bar indices; no UTC is fabricated. |
| TL-001, TL-005, TL-007 | Project-level ordering, half-open integer intervals and direct frame evaluation are preserved and asserted. |
| TL-002 | Scene-level tracks edit chart, drawing, text and image clips separately; the keyframe-lane UI is deferred with the timeline work. |
| TL-006 | A transition slot lives on the track boundary and its duration is clamped to the adjacent clips. |
| EX-003 | Preview and export evaluate the same frame state, because `evaluate` and the pane evaluation are pure and shared. |
| QA-002 | Direct seek equals sequential playback, asserted per pane and per drawing. |
| QA-005 | Provenance labels survive save, reopen and archive import. |
| CPT-003 | Independent components keep their own frame intervals; the registry-driven evaluate step extends it. |
| CPT-005 | Editor handles never reach the render path; anchors survive transform and zoom. |
| CPT-006 | Schema and props migrations reject unsupported future versions. |

### 6.3 Not claimed by this slice

SM-001…SM-011 (SMT), TF-001/TF-002/TF-006/TF-007 (real aggregation, session calendars, DST),
MD-003 (import wizard), MD-006 (stale invalidation across a reimport), EX-004…EX-007 (export
freezing, codecs, media diagnostics), PR-005…PR-008 (portable archive), TL-003/TL-004/TL-008
(hierarchical timeline, snapping, audio), SC-001…SC-005 (scenes, templates), QA-001/QA-003/QA-004/QA-006.

---

## 7. Risks

| # | Risk | Why it is real | Mitigation and where it is proven |
|---|---|---|---|
| R1 | **Anchor drift on resize.** A drawing anchored to a price could detach when the chart is resized or scaled. | The anchor is stored as a price, but the pixel depends on the pane's scale and rect. | Anchors are resolved at render time through the same `PaneFrameState` the chart draws with. A test resizes the chart and asserts the drawn y still maps to the anchored price (CPT-005). |
| R2 | **Price-scale behaviour while the visible range changes.** The axis moves as bars are revealed; an anchored line would slide if it were resolved against a stale scale. | Today's scale is computed from revealed bars only, so it changes every frame the range widens. | The scale policy is explicit: `auto` (revealed bars only — unchanged, and the reason a future bar cannot move the axis) or `fixed` (author-pinned). Drawings resolve against the *current* scale, so a price line tracks the price level rather than a pixel. A test asserts the axis does not move because of an unrevealed bar. |
| R3 | **Curve edits changing rendered frames.** A curve that changes a frame changes the export, and a curve stored as a loose parameter can produce different output in preview and export. | Curves currently live in effect params as strings, and only `transform` accepts a custom bezier. | One pure evaluator in `packages/core` (`evaluateCurve`), stored as data, evaluated identically in preview and export. A test evaluates the same curve through both paths at the same frame. |
| R4 | **Cross-timeframe alignment without lookahead.** A coarser pane built from a finer source can leak a future constituent into a partial bucket. | Aggregation is the classic place where future data leaks in. | `evaluatePaneAt` aggregates only constituents with index `<= as-of`; a test asserts a bucket's partial state contains no value from a later constituent (TF-003). |
| R5 | **Regenerated candles not deterministic.** Dragging an anchor must not reshuffle the whole series, and the same drag must give the same bars. | A naive implementation re-seeds on every change. | Generation is a pure function of `(path, seed, algorithmVersion)`; the seed is stored in the series spec, never derived from the edit. A test drags an anchor twice and asserts identical bars (AP-002). |
| R6 | **Drawing lifecycle vs chart lifecycle.** A drawing's `[in,out)` is relative to its chart clip; if the chart moves, the drawing must move with it. | Two different frame spaces. | Drawings are clips whose *anchor* is market data; their evaluated position is derived from the chart's evaluated pane state, so they cannot drift from their chart. A test moves the chart and asserts the drawing's rendered position follows. |
| R7 | **Migration changing saved projects.** A v1 chart has inline bars; lifting them into a project series can change the rendered frame. | The scale and the reveal depend on the bar array. | The migration is asserted to produce a v2 document whose single pane renders the same candles; the plan compares rendered output before and after. |
| R8 | **Bundling a second easing vocabulary.** Adding `packages/core/src/curve.ts` next to Remotion's `Easing` risks two meanings of "easeOut". | The legacy effect vocabulary must keep working untouched. | The new evaluator is used only by the new curve-driven surfaces; the legacy effect parameters keep Remotion's `Easing` so no existing frame changes. The overlap is limited to the preset names, and a test pins the legacy behaviour. |
| R9 | **Scope creep into the importer.** The datasource seam invites "just add CSV". | The seam's whole point is to be an interface. | The plan contains no importer, no file reading and no wizard; the seam is a pure function with three origins, one of which (`imported`) has no producer in this slice. |
| R10 | **A degenerate anchor bar.** Pinning the placed price to the bar's extreme instead of its close collapses the bar: `h == c` on a high anchor, `l == c` on a low anchor, leaving a zero-range bar whose "swing high" renders as a flat line. | The drawn path already passes through the anchor price as the close, so pinning the extreme to the same price makes the two coincide. Found by running the algorithm, not by reading it. | The anchor pins the **close** (§3.3). The adopted reference implementation reaches the same conclusion independently. A test asserts every bar has `l < h` and that no anchor bar has `h == c` or `l == c`. |
| R11 | **The path wandering off the drawing.** The Brownian bridge is not clamped to the drawn band, so closes can overshoot their anchors and the series no longer traces the drawn line exactly. | The bridge is the one stochastic element in the generator, and nothing bounds it by construction. | Deliberate: the drawn path is the skeleton, not a corridor (§3.3). The `auto` regime classification keeps a *flat* leg from drifting, and `volatility` bounds the excursion — measured at 0.08% of price on a 100 → 120 leg with the defaults. A test asserts the excursion is bounded relative to the configured volatility, not that it is zero. |
| R12 | **A tick grid collapsing a bar to zero range.** With `tickSize` set, the rounded high and low can land on the same tick, producing a bar with `l == h` — and at anchor indices, `h == c`. | The rounding is applied independently to the high and the low. Measured: 10 of 1200 bars collapsed to zero range, and 35 anchor bars had `h == c`, on a 0.5-tick grid. | The tick grid is **off by default** and the grid is chosen to be far finer than the bar's typical range. The invariant is `l <= h`, not `l < h`, when a tick size is configured; a test asserts the collapse is reported rather than silently emitted as a broken bar. |
| R13 | **A cross-asset link that reads as market time.** Two assets side by side, moving in lockstep, look exactly like a market-time alignment — and without a UTC source that claim would be false. | The visual result of an authored link and a UTC link is identical: the same candles, side by side, at the same instants. The difference exists only in what the data knows. | The relation is **declared and labelled**: the inspector says "authored link — not market time" and the export metadata records the relation as authored (CH-010). The claim lives in the label, not in the picture — a test asserts the label and the metadata are present. |
| R14 | **A rollup between two panes that do not share a base.** The relation is only meaningful when both panes bucket the same base series; two panes reading different series cannot be rolled up against each other. | A rollup names two panes, and the creator can pick any two — including two that read different assets. | The validator requires a rollup's two panes to share a base series, and rejects it otherwise, naming the pane that has to change (TF-008). The displayed ratio always agrees with the data. |
| R15 | **A rounded ratio that lies.** Eight of the ladder's 66 pairs have no whole-number ratio — `4H` to `6H` is 1.5, `2D` to `1W` is 3.5, `1W` to `1M` is 4.286. A UI that rounds these to "2 ×" or "3 ×" states something false about the data. | The rounding is a display convenience and the ratio is a real fraction. | The ratio is displayed as the fraction it is, and every pair is related **through the base rung** so the two remain comparable (TF-009). A test asserts `4H` over `6H` reads 1.5, not 2. |
| R16 | **The ladder read as a session calendar.** "1D = 24 × 1H" is the clock-time ratio; a futures session carries 23 hourly candles and a cash equity 6.5 hours of regular trading. A creator reading 24 as their session count is wrong. | The ladder's units are minutes of clock time, and a minute that carries no price still counts. | The ladder fixes the **ratio**; the session calendar fixes which base units exist, and it is deferred (TF-001, TF-007). The inspector shows the clock-time ratio and labels the session count as unavailable rather than guessing it. |

---

## 8. Verification the executor must run and report

Every slice runs and reports the observed result of:

```bash
pnpm typecheck        # turbo typecheck, all six packages
pnpm test             # vitest across the workspace
pnpm build            # turbo build; the studio bundle must build
node scripts/verify-r1.mjs   # real Remotion render: stills AND an MP4
```

`node scripts/verify-r1.mjs` is the render gate. It is the only command that proves a change reached
the *video* path: it bundles `packages/video/remotion/index.ts`, renders PNG stills at frames
0, 20, 45, 100, 140 and 179, and renders `out/chart-studio-r1.mp4`. A slice that changes rendering
extends that fixture (a chart with panes, a drawing, a curve) and reports the still byte sizes and
the MP4 outcome.

For any user-interface change, the executor exercises the actual surface in a browser and reports
what was observed — not that the code "should" work. The plan names the interaction for each slice.

Anything not exercised is reported as unverified. There is no "tests pass" substitute for the render
gate.

---

## 9. Deliverables this slice produces

| Artefact | Path |
|---|---|
| This design | `docs/superpowers/specs/2026-10-29-chart-studio-authored-path-and-chart-elements-design.md` |
| Implementation plan | `docs/superpowers/plans/2026-10-29-chart-studio-authored-path-and-chart-elements.md` |
| Reference implementation of the generator (the normative algorithm) | `docs/reference/data-generation/path-to-candles-advanced.ts`, with its provenance note in `docs/reference/data-generation/README.md` |
| ADR: chart element model, schema v2, datasource seam | `docs/decisions/ADR-007-CHART-ELEMENT-MODEL.md` |
| ADR: Zod for domain schemas (dependency record) | `docs/decisions/ADR-008-ZOD-DOMAIN-SCHEMAS.md` |
| New requirement IDs | `docs/spec/FUNCTIONAL_SPEC.md` §2, §3, §5 |
| Component contract extension | `docs/spec/COMPONENT_CONTRACT.md` §2, §3, §6 |
| Roadmap stage | `docs/roadmap/ROADMAP.md` §2 |
| Test coverage record | `docs/quality/TEST_STRATEGY.md` §3 |

---

## 10. Approval

This document changes the project schema, the component contract and the dependency set. Under
`AGENTS.md` it requires owner approval before any implementation begins, and the roadmap is not
coding permission.

Three decisions inside it are the owner's to confirm or override, because each has a visible
alternative:

1. **§3.4 — drawings are clips, panes live inside the chart clip.** The alternative is to make
   drawings children of the chart clip. That contradicts OB-003's `(chartId, …)` anchor and would
   remove drawings from the scene timeline.
2. **§1.3 — the relation between panes is declared, and a cross-instrument link is authored until
   an importer exists.** The alternative is to ship linked panes only for one instrument at two
   timeframes, deferring side-by-side different instruments entirely. Under this decision both split
   kinds ship: a rollup (one asset at two timeframes, exact by construction) and a lockstep (two
   assets on one timeframe, advancing together with the same number of candles), with the
   cross-asset link labelled "authored link — not market time" and recorded as authored in the
   export metadata.
3. **§3.6 — the legacy effect easing vocabulary stays on Remotion's `Easing`.** The alternative is to
   move every effect onto `packages/core`'s evaluator, which would change the rendered frames of
   existing projects.
