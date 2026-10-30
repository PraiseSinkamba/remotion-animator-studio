import { describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

import { hashString } from './market';
import type { OhlcBar } from './series';
import {
  generateSeriesFromPath,
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
