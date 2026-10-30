/**
 * The market data seam.
 *
 * A series is a *specification* of where a chart's data comes from; a
 * datasource is the materialised result. The two are separate so that the
 * origin of the data stays visible: a chart never holds bars, it holds a
 * reference to a series, and the series says whether those bars were drawn,
 * typed, generated or imported.
 *
 * Pure functions only: no React, no Remotion, no DOM, no registry imports.
 */

import { generateSyntheticBars, hashString } from './market';
import { generateSeriesFromPath, type PathGeneratorOptions, type SwingPath } from './path';

/**
 * One bar of a series.
 *
 * `id` is stable across a materialisation, so a bar can be referenced by an
 * anchor or a drawing without depending on its position.
 */
export interface OhlcBar {
  /** Stable identity of this bar within its series. */
  id: string;
  /** Bar time. Milliseconds for a UTC series, a logical index otherwise. */
  t: number;
  o: number;
  h: number;
  l: number;
  c: number;
  /** Activity proxy. Not exchange volume. */
  v?: number;
}

/** Where a series' data came from. Never lost: a chart always shows its provenance. */
export type SeriesOrigin = 'authored-path' | 'manual' | 'synthetic' | 'imported';

/**
 * A materialised series: the bars a chart reads.
 *
 * A chart never holds bars, it holds a reference to a series; the datasource is
 * the result of materialising that reference.
 */
export interface Datasource {
  readonly id: string;
  readonly origin: SeriesOrigin;
  readonly revision: string;
  readonly label: string;
  readonly symbol?: string;
  readonly timeframeId?: string;
  readonly timeBasis: 'logical' | 'utc';
  readonly bars: readonly OhlcBar[];
}

/**
 * The persisted, authored form of a series. Discriminated by origin, so the
 * origin is a type-level fact rather than a string that can disagree with the
 * data it describes.
 */
export type SeriesSpec =
  | {
      id: string;
      origin: 'authored-path';
      label: string;
      symbol?: string;
      timeframeId?: string;
      timeBasis: 'logical';
      seed: string;
      algorithmVersion: number;
      path: SwingPath;
      /** The generator's settings. Part of the spec, so part of the revision. */
      generator?: PathGeneratorOptions;
    }
  | {
      id: string;
      origin: 'manual';
      label: string;
      symbol?: string;
      timeframeId?: string;
      timeBasis: 'logical';
      bars: OhlcBar[];
    }
  | {
      id: string;
      origin: 'synthetic';
      label: string;
      symbol?: string;
      timeframeId?: string;
      timeBasis: 'logical';
      seed: string;
      algorithmVersion: number;
      generator: {
        count: number;
        startPrice: number;
        timeframeMs: number;
        volatility?: number;
        drift?: number;
      };
    }
  | {
      id: string;
      origin: 'imported';
      label: string;
      symbol?: string;
      timeframeId?: string;
      timeBasis: 'utc';
      revision: string;
      bars: OhlcBar[];
    };

/** Stamps the stable ids and sorts by time. The one place bar ids are set. */
const stampAndSort = (specId: string, bars: readonly OhlcBar[]): OhlcBar[] =>
  [...bars]
    .sort((a, b) => a.t - b.t)
    .map((bar, index) => ({ ...bar, id: `${specId}:${index}` }));

/**
 * Materialises a spec into the bars a chart reads.
 *
 * This is the single place a spec becomes bars, so the origin of the data is
 * never ambiguous: an authored path generates, a synthetic series generates,
 * and a manual or imported series is its own stored bars.
 */
export const materialiseSeries = (spec: SeriesSpec): Datasource => {
  const bars = ((): OhlcBar[] => {
    switch (spec.origin) {
      case 'authored-path': {
        const generated = generateSeriesFromPath(spec.path, {
          seed: spec.seed,
          algorithmVersion: spec.algorithmVersion,
          seriesId: spec.id,
          generator: spec.generator,
        });
        return generated.bars;
      }
      case 'synthetic':
        return generateSyntheticBars({
          count: spec.generator.count,
          startPrice: spec.generator.startPrice,
          seed: spec.seed,
          timeframeMs: spec.generator.timeframeMs,
          volatility: spec.generator.volatility,
          drift: spec.generator.drift,
          idPrefix: spec.id,
        });
      case 'manual':
      case 'imported':
        return [...spec.bars];
    }
  })();

  const stamped = stampAndSort(spec.id, bars);
  return {
    id: spec.id,
    origin: spec.origin,
    revision: seriesRevision(spec),
    label: spec.label,
    symbol: spec.symbol,
    timeframeId: spec.timeframeId,
    timeBasis: spec.timeBasis,
    bars: stamped,
  };
};

/**
 * A content hash of the materialised series.
 *
 * The hash covers the bars themselves, so an edited anchor, an edited bar and
 * a changed seed all produce a different revision. Two specs with the same
 * content share a revision, whatever produced them.
 */
export const seriesRevision = (spec: SeriesSpec): string => {
  const bars = ((): readonly OhlcBar[] => {
    switch (spec.origin) {
      case 'authored-path': {
        const generated = generateSeriesFromPath(spec.path, {
          seed: spec.seed,
          algorithmVersion: spec.algorithmVersion,
          seriesId: spec.id,
          generator: spec.generator,
        });
        return generated.bars;
      }
      case 'synthetic':
        return generateSyntheticBars({
          count: spec.generator.count,
          startPrice: spec.generator.startPrice,
          seed: spec.seed,
          timeframeMs: spec.generator.timeframeMs,
          volatility: spec.generator.volatility,
          drift: spec.generator.drift,
          idPrefix: spec.id,
        });
      case 'manual':
      case 'imported':
        return spec.bars;
    }
  })();

  // The content, not the ids: two series with the same bars are the same
  // content whatever they are called.
  const parts: string[] = [];
  for (const bar of bars) {
    parts.push(`${bar.t}|${bar.o}|${bar.h}|${bar.l}|${bar.c}|${bar.v ?? ''}`);
  }
  return hashString(parts.join(';')).toString(16).padStart(8, '0');
};
