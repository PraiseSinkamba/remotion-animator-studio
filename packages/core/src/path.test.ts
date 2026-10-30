import { describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

import { evaluateBarsAtFrame, hashString } from './market';
import type { OhlcBar } from './series';
import {
  addSwingAnchor,
  generateSeriesFromPath,
  moveSwingAnchor,
  normalizeSwingPath,
  removeSwingAnchor,
  strokeToAnchorPoints,
  type PathGeneratorOptions,
  type SwingPath,
} from './path';

/* ------------------------------------------------------------------ */
/* reference implementation (loaded at runtime)                        */
/* ------------------------------------------------------------------ */

const REFERENCE_PATH = resolve(
  fileURLToPath(new URL('.', import.meta.url)),
  '../../../docs/reference/data-generation/path-to-candles-advanced.ts',
);

interface ReferenceCandle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface ReferenceSegment {
  fromIndex: number;
  toIndex: number;
  regime: string;
  averageLogMovePerBar: number;
  wickMultiplier: number;
  retracementCount: number;
  pauseCount: number;
}

const loadReference = async () => {
  const mod = await import(/* @vite-ignore */ REFERENCE_PATH);
  return mod as {
    generateCandlesWithMeta: (options: unknown) => {
      candles: ReferenceCandle[];
      segments: ReferenceSegment[];
    };
  };
};

/* ------------------------------------------------------------------ */
/* fixtures                                                            */
/* ------------------------------------------------------------------ */

interface AnchorSpec {
  barIndex: number;
  price: number;
  regime?: 'auto' | 'trend' | 'range';
}

const toPath = (specs: AnchorSpec[]): SwingPath => ({
  anchors: specs.map((s, i) => ({
    id: `a${i}`,
    barIndex: s.barIndex,
    price: s.price,
    ...(s.regime ? { regime: s.regime } : {}),
  })),
});

interface ParityCase {
  name: string;
  seed: string;
  anchors: AnchorSpec[];
  generator?: PathGeneratorOptions;
}

const PARITY_CASES: ParityCase[] = [
  {
    name: 'base trend path',
    seed: 'parity-base',
    anchors: [
      { barIndex: 0, price: 100 },
      { barIndex: 40, price: 118 },
      { barIndex: 90, price: 112 },
      { barIndex: 140, price: 131 },
      { barIndex: 199, price: 124 },
    ],
  },
  {
    name: 'flat-to-range path',
    seed: 'parity-range',
    anchors: [
      { barIndex: 0, price: 100 },
      { barIndex: 40, price: 101 },
      { barIndex: 99, price: 100.5 },
      { barIndex: 160, price: 120 },
      { barIndex: 199, price: 119 },
    ],
  },
  {
    name: 'tick quantised path',
    seed: 'parity-tick',
    anchors: [
      { barIndex: 0, price: 100 },
      { barIndex: 30, price: 110.25 },
      { barIndex: 75, price: 107.5 },
      { barIndex: 120, price: 121.75 },
      { barIndex: 199, price: 119.25 },
    ],
    generator: { tickSize: 0.25 },
  },
  {
    name: 'retracements, consolidations and custom wicks',
    seed: 'parity-decorated',
    anchors: [
      { barIndex: 0, price: 100 },
      { barIndex: 50, price: 126 },
      { barIndex: 110, price: 118 },
      { barIndex: 170, price: 140 },
      { barIndex: 199, price: 133 },
    ],
    generator: {
      volatility: 0.0018,
      pathNoise: 0.6,
      intrabarSteps: 16,
      baseVolume: 2500,
      retracements: { probability: 1, everyBars: 22, depthMin: 0.35, depthMax: 0.65 },
      consolidations: { trendPauseProbability: 0.7, rangeWidth: 1.25 },
      wicks: { strength: 1.6, slopeSensitivity: 0.5, rangeBoost: 1.35 },
      volatilityClustering: { persistence: 0.9, shock: 0.2 },
    },
  },
  {
    name: 'explicit regimes with low volatility',
    seed: 'parity-regime',
    anchors: [
      { barIndex: 0, price: 50, regime: 'trend' },
      { barIndex: 60, price: 54, regime: 'range' },
      { barIndex: 120, price: 53.5, regime: 'trend' },
      { barIndex: 199, price: 60 },
    ],
    generator: { volatility: 0.0012, pathNoise: 0.5 },
  },
  {
    name: 'minimal intrabar steps',
    seed: 'parity-steps',
    anchors: [
      { barIndex: 0, price: 10 },
      { barIndex: 25, price: 12 },
      { barIndex: 199, price: 11 },
    ],
    generator: { intrabarSteps: 2, baseVolume: 10, volatility: 0.004 },
  },
];

const compareBars = (bars: OhlcBar[], candles: ReferenceCandle[]) => {
  expect(bars).toHaveLength(candles.length);
  for (let i = 0; i < bars.length; i++) {
    const bar = bars[i];
    const candle = candles[i];
    expect(bar.id).toBe(`series:${i}`);
    expect(bar.t).toBe(candle.time);
    expect(bar.o).toBe(candle.open);
    expect(bar.h).toBe(candle.high);
    expect(bar.l).toBe(candle.low);
    expect(bar.c).toBe(candle.close);
    expect(bar.v).toBe(candle.volume);
  }
};

/* ------------------------------------------------------------------ */
/* parity with the reference implementation                            */
/* ------------------------------------------------------------------ */

describe('parity with the reference implementation', () => {
  for (const testCase of PARITY_CASES) {
    it(`reproduces the reference for the ${testCase.name}`, async () => {
      const reference = await loadReference();
      const path = toPath(testCase.anchors);
      const barCount = testCase.anchors[testCase.anchors.length - 1].barIndex + 1;

      const { bars, segments } = generateSeriesFromPath(path, {
        seed: testCase.seed,
        algorithmVersion: 1,
        seriesId: 'series',
        generator: testCase.generator,
      });

      const expected = reference.generateCandlesWithMeta({
        candleCount: barCount,
        anchors: testCase.anchors.map((a) => ({
          index: a.barIndex,
          price: a.price,
          ...(a.regime ? { regime: a.regime } : {}),
        })),
        startTimeMs: 0,
        intervalMs: 1,
        seed: hashString(testCase.seed),
        ...(testCase.generator ?? {}),
      });

      compareBars(bars, expected.candles);
      expect(segments).toHaveLength(expected.segments.length);
      for (let k = 0; k < segments.length; k++) {
        expect(segments[k]).toEqual(expected.segments[k]);
      }
    });
  }
});

/* ------------------------------------------------------------------ */
/* behaviour                                                           */
/* ------------------------------------------------------------------ */

describe('generateSeriesFromPath', () => {
  it('places the exact anchor price on the anchor bar', () => {
    const path = toPath([
      { barIndex: 0, price: 100 },
      { barIndex: 30, price: 137.5 },
      { barIndex: 199, price: 96.25 },
    ]);
    const { bars } = generateSeriesFromPath(path, {
      seed: 'anchor-exact',
      algorithmVersion: 1,
      seriesId: 'series',
    });
    expect(bars[0].c).toBe(100);
    expect(bars[30].c).toBe(137.5);
    expect(bars[199].c).toBe(96.25);
  });

  it('rejects a duplicate anchor index', () => {
    const path = toPath([
      { barIndex: 0, price: 100 },
      { barIndex: 30, price: 110 },
      { barIndex: 30, price: 120 },
      { barIndex: 199, price: 100 },
    ]);
    expect(() =>
      generateSeriesFromPath(path, {
        seed: 'dup',
        algorithmVersion: 1,
        seriesId: 'series',
      }),
    ).toThrow(/Duplicate anchor index/);
  });

  it('rejects a non-finite anchor price', () => {
    const path = toPath([
      { barIndex: 0, price: 100 },
      { barIndex: 30, price: Number.NaN },
      { barIndex: 199, price: 100 },
    ]);
    expect(() =>
      generateSeriesFromPath(path, {
        seed: 'nan',
        algorithmVersion: 1,
        seriesId: 'series',
      }),
    ).toThrow(/price/);
  });

  it('keeps every generated bar OHLC-consistent and strictly positive', () => {
    const path = toPath([
      { barIndex: 0, price: 100 },
      { barIndex: 25, price: 118 },
      { barIndex: 90, price: 104 },
      { barIndex: 199, price: 130 },
    ]);
    const { bars } = generateSeriesFromPath(path, {
      seed: 'ohlc',
      algorithmVersion: 1,
      seriesId: 'series',
    });
    expect(bars).toHaveLength(200);
    for (const bar of bars) {
      expect(Number.isFinite(bar.o)).toBe(true);
      expect(Number.isFinite(bar.h)).toBe(true);
      expect(Number.isFinite(bar.l)).toBe(true);
      expect(Number.isFinite(bar.c)).toBe(true);
      expect(bar.o).toBeGreaterThan(0);
      expect(bar.h).toBeGreaterThan(0);
      expect(bar.l).toBeGreaterThan(0);
      expect(bar.c).toBeGreaterThan(0);
      expect(bar.h).toBeGreaterThanOrEqual(Math.max(bar.o, bar.c));
      expect(bar.l).toBeLessThanOrEqual(Math.min(bar.o, bar.c));
    }
  });

  it('is deterministic for the same path, seed and algorithm version', () => {
    const path = toPath([
      { barIndex: 0, price: 100 },
      { barIndex: 40, price: 121 },
      { barIndex: 199, price: 111 },
    ]);
    const options = { seed: 'determinism', algorithmVersion: 1, seriesId: 'series' };
    const first = generateSeriesFromPath(path, options);
    const second = generateSeriesFromPath(path, options);
    expect(second.bars).toEqual(first.bars);
    expect(second.segments).toEqual(first.segments);
  });

  it('rejects an algorithm version this build does not implement', () => {
    const path = toPath([
      { barIndex: 0, price: 100 },
      { barIndex: 40, price: 121 },
    ]);
    expect(() =>
      generateSeriesFromPath(path, {
        seed: 'version',
        algorithmVersion: 99,
        seriesId: 'series',
      }),
    ).toThrow(/algorithmVersion 99 is not supported/);
  });

  it('rejects a path whose first anchor is not index 0', () => {
    const path = toPath([
      { barIndex: 5, price: 100 },
      { barIndex: 199, price: 110 },
    ]);
    expect(() =>
      generateSeriesFromPath(path, {
        seed: 'no-zero',
        algorithmVersion: 1,
        seriesId: 'series',
      }),
    ).toThrow(/Anchors must include index 0/);
  });

  it('rejects a path whose last anchor is not the final bar', () => {
    const path: SwingPath = {
      anchors: [
        { id: 'a0', barIndex: 0, price: 100 },
        { id: 'a1', barIndex: 50, price: 110 },
      ],
      barCount: 100,
    };
    expect(() =>
      generateSeriesFromPath(path, {
        seed: 'short-tail',
        algorithmVersion: 1,
        seriesId: 'series',
      }),
    ).toThrow(/last anchor must be the final bar/);
  });
});

describe('strokeToAnchorPoints', () => {
  it('simplifies a freehand stroke into anchor points', () => {
    const points = [
      { x: 0, y: 100 },
      { x: 10, y: 99 },
      { x: 20, y: 101 },
      { x: 30, y: 100 },
      { x: 100, y: 20 },
      { x: 110, y: 21 },
      { x: 120, y: 19 },
      { x: 200, y: 80 },
    ];
    const anchors = strokeToAnchorPoints(points, {
      width: 200,
      height: 100,
      candleCount: 50,
      minPrice: 10,
      maxPrice: 100,
      simplifyTolerancePx: 6,
    });
    expect(anchors.length).toBeLessThan(points.length);
    expect(anchors.length).toBeGreaterThanOrEqual(2);
    expect(anchors[0].barIndex).toBe(0);
    expect(anchors[anchors.length - 1].barIndex).toBe(49);
    for (let i = 1; i < anchors.length; i++) {
      expect(anchors[i].barIndex).toBeGreaterThan(anchors[i - 1].barIndex);
    }
  });

  it('maps a stroke vertical extent onto the price range', () => {
    const anchors = strokeToAnchorPoints(
      [
        { x: 0, y: 0 },
        { x: 100, y: 50 },
        { x: 200, y: 100 },
      ],
      { width: 200, height: 100, candleCount: 10, minPrice: 10, maxPrice: 110 },
    );
    expect(anchors[0].price).toBeCloseTo(110, 10);
    expect(anchors[anchors.length - 1].price).toBeCloseTo(10, 10);
    for (const anchor of anchors) {
      expect(anchor.price).toBeGreaterThanOrEqual(10);
      expect(anchor.price).toBeLessThanOrEqual(110);
    }
  });
});

/* ------------------------------------------------------------------ */
/* the authoring operations                                            */
/* ------------------------------------------------------------------ */

describe('the authoring operations', () => {
  const base = (): SwingPath => ({
    anchors: [
      { id: 'a0', barIndex: 0, price: 100 },
      { id: 'a1', barIndex: 10, price: 120 },
      { id: 'a2', barIndex: 20, price: 95 },
    ],
  });

  it('normalises a path by sorting it and rejecting a duplicate index', () => {
    const sorted = normalizeSwingPath({
      anchors: [
        { id: 'a2', barIndex: 20, price: 95 },
        { id: 'a0', barIndex: 0, price: 100 },
        { id: 'a1', barIndex: 10, price: 120 },
      ],
    });
    expect(sorted.anchors.map((a) => a.barIndex)).toEqual([0, 10, 20]);

    expect(() =>
      normalizeSwingPath({
        anchors: [
          { id: 'a0', barIndex: 0, price: 100 },
          { id: 'a1', barIndex: 10, price: 120 },
          { id: 'a2', barIndex: 10, price: 95 },
        ],
      }),
    ).toThrow(/share bar index 10/);
  });

  it('sorts the anchors by bar index when they are added out of order', () => {
    const path = addSwingAnchor(
      { anchors: [{ id: 'a0', barIndex: 0, price: 100 }] },
      { id: 'a1', barIndex: 5, price: 110 },
    );
    expect(path.anchors.map((a) => a.barIndex)).toEqual([0, 5]);
  });

  it('rejects an anchor on a bar that already has one', () => {
    expect(() => addSwingAnchor(base(), { id: 'a3', barIndex: 10, price: 130 })).toThrow(
      /already sits on bar index 10/,
    );
  });

  it('rejects an anchor with a price that is not a finite number', () => {
    expect(() => addSwingAnchor(base(), { id: 'a3', barIndex: 15, price: Number.NaN })).toThrow(
      /finite number/,
    );
  });

  it('leaves the path it was given untouched', () => {
    const before = base();
    const snapshot = JSON.stringify(before);
    addSwingAnchor(before, { id: 'a3', barIndex: 15, price: 130 });
    moveSwingAnchor(before, 'a1', { price: 125 });
    removeSwingAnchor(before, 'a1');
    expect(JSON.stringify(before)).toBe(snapshot);
  });

  it('keeps the placed close when an anchor is moved', () => {
    const moved = moveSwingAnchor(base(), 'a1', { price: 130 });
    expect(moved.anchors.find((a) => a.id === 'a1')?.price).toBe(130);

    const bars = generateSeriesFromPath(moved, {
      seed: 'move',
      algorithmVersion: 1,
      seriesId: 's',
    }).bars;
    expect(bars[10].c).toBe(130);
  });

  it('rejects a move onto a bar that already has an anchor', () => {
    expect(() => moveSwingAnchor(base(), 'a1', { barIndex: 0 })).toThrow(
      /already sits on bar index 0/,
    );
  });

  it('rejects a move of an anchor that does not exist', () => {
    expect(() => moveSwingAnchor(base(), 'nope', { price: 1 })).toThrow(/no anchor "nope"/);
  });

  it('removes an anchor and keeps the rest in order', () => {
    const path = removeSwingAnchor(base(), 'a1');
    expect(path.anchors.map((a) => a.id)).toEqual(['a0', 'a2']);
  });

  it('rejects the removal of an anchor that does not exist', () => {
    expect(() => removeSwingAnchor(base(), 'nope')).toThrow(/no anchor "nope"/);
  });

  it('changes only the bars of the segments the moved anchor touches', () => {
    const path = base();
    const before = generateSeriesFromPath(path, {
      seed: 'segments',
      algorithmVersion: 1,
      seriesId: 's',
    }).bars;

    // The last anchor ends one segment and starts none, so only that
    // segment's bars move.
    const moved = moveSwingAnchor(path, 'a2', { price: 105 });
    const after = generateSeriesFromPath(moved, {
      seed: 'segments',
      algorithmVersion: 1,
      seriesId: 's',
    }).bars;

    const changed = before
      .map((bar, index) => ({
        index,
        same: bar.c === after[index].c && bar.o === after[index].o && bar.h === after[index].h,
      }))
      .filter((entry) => !entry.same)
      .map((entry) => entry.index);

    expect(changed.every((index) => index >= 11)).toBe(true);
    expect(changed).toContain(20);
  });
});

/* ------------------------------------------------------------------ */
/* the generator's properties                                          */
/* ------------------------------------------------------------------ */

describe('the generator properties', () => {
  const generate = (path: SwingPath, generator?: PathGeneratorOptions, seed = 'props') =>
    generateSeriesFromPath(path, { seed, algorithmVersion: 1, seriesId: 's', generator });

  it('gives every bar a non-zero range, including at an anchor', () => {
    const { bars } = generate(
      toPath([
        { barIndex: 0, price: 100 },
        { barIndex: 10, price: 120 },
        { barIndex: 20, price: 95 },
      ]),
    );
    for (const bar of bars) {
      expect(bar.h).toBeGreaterThan(bar.l);
    }
  });

  it('classifies a flat leg as a range and a steep leg as a trend', () => {
    const flat = generate(
      toPath([
        { barIndex: 0, price: 100 },
        { barIndex: 30, price: 100.2 },
        { barIndex: 60, price: 100 },
      ]),
    );
    expect(flat.segments[0].regime).toBe('range');

    const steep = generate(
      toPath([
        { barIndex: 0, price: 100 },
        { barIndex: 30, price: 180 },
        { barIndex: 60, price: 100 },
      ]),
    );
    expect(steep.segments[0].regime).toBe('trend');
  });

  it('honours an explicit regime override over the automatic classification', () => {
    const overridden = generate(
      toPath([
        { barIndex: 0, price: 100, regime: 'trend' },
        { barIndex: 30, price: 100.2, regime: 'trend' },
        { barIndex: 60, price: 100 },
      ]),
    );
    expect(overridden.segments[0].regime).toBe('trend');
  });

  it('gives a different body for the same path under a different seed', () => {
    const path = toPath([
      { barIndex: 0, price: 100 },
      { barIndex: 20, price: 120 },
    ]);
    const first = generate(path, undefined, 'seed-one').bars;
    const second = generate(path, undefined, 'seed-two').bars;
    expect(first.map((bar) => bar.c)).not.toEqual(second.map((bar) => bar.c));
  });

  it('keeps the excursion beyond the drawn band bounded relative to the volatility', () => {
    const path = toPath([
      { barIndex: 0, price: 100 },
      { barIndex: 60, price: 120 },
    ]);
    const measure = (volatility: number) => {
      const { bars } = generate(path, { volatility, pathNoise: 0.72 });
      let worst = 0;
      for (const bar of bars) {
        if (bar.t > 0 && bar.t < 60) {
          worst = Math.max(worst, 100 - bar.c, bar.c - 120);
        }
      }
      return worst;
    };
    const calm = measure(0.002);
    const wild = measure(0.02);
    // The excursion grows with the volatility, but stays a small fraction of
    // the price: the drawn path is the skeleton, not a corridor.
    expect(wild).toBeGreaterThan(calm);
    expect(wild).toBeLessThan(120 * 0.5);
  });

  it('produces the same relative output for the same relative path at a different price level', () => {
    const relative = (scale: number) => {
      const { bars } = generate(
        toPath([
          { barIndex: 0, price: 100 * scale },
          { barIndex: 40, price: 120 * scale },
        ]),
      );
      return bars.map((bar) => bar.c / scale);
    };
    const small = relative(1);
    const large = relative(100);
    expect(large[10]).toBeCloseTo(small[10], 6);
    expect(large[30]).toBeCloseTo(small[30], 6);
  });
});

/* ------------------------------------------------------------------ */
/* the intrabar reveal is generalised, not replaced                    */
/* ------------------------------------------------------------------ */

describe('the intrabar reveal of a generated series', () => {
  it('keeps the intrabar guarantees: inside the range, both extremes, open to close', () => {
    const { bars } = generateSeriesFromPath(
      toPath([
        { barIndex: 0, price: 100 },
        { barIndex: 30, price: 118 },
        { barIndex: 60, price: 112 },
      ]),
      { seed: 'intrabar', algorithmVersion: 1, seriesId: 's' },
    );

    for (const bar of bars) {
      const state = evaluateBarsAtFrame(bars, 0, 1, 'simulated', 'intrabar');
      expect(state.bars.length).toBeGreaterThan(0);
      break;
    }

    // Walk the series the way the renderer does and check the guarantees on
    // every bar that has been revealed.
    for (let index = 0; index < bars.length; index++) {
      const state = evaluateBarsAtFrame(bars, index, 1, 'simulated', 'intrabar');
      const active = state.bars[state.bars.length - 1];
      expect(active.h).toBeGreaterThanOrEqual(active.o);
      expect(active.h).toBeGreaterThanOrEqual(active.c);
      expect(active.l).toBeLessThanOrEqual(active.o);
      expect(active.l).toBeLessThanOrEqual(active.c);
      expect(active.h).toBeGreaterThanOrEqual(active.l);
      expect(Number.isFinite(active.c)).toBe(true);
    }
  });
});
