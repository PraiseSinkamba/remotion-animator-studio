/**
 * Project document migrations.
 *
 * The only place where legacy documents are reshaped. Every load boundary
 * (opening a file, restoring the autosave, resolving the Remotion composition)
 * runs a document through `migrateProject` before it reaches the editor.
 *
 * Rules (docs/spec/COMPONENT_CONTRACT.md §5):
 * - a missing `schemaVersion` means version 1 (legacy document);
 * - a *higher* `schemaVersion` is rejected with a clear error, never guessed;
 * - a clip whose `propsVersion` is newer than its component's is rejected;
 * - an unknown component type is rejected.
 *
 * The migration is non-destructive and idempotent:
 * `migrateProject(migrateProject(p))` deep-equals `migrateProject(p)`.
 */
import { getComponent } from './registry';
import { computePriceRange, materialiseSeries, validateProjectScalars } from '@chart-studio/core';
import type {
  Clip,
  DrawingKind,
  ElementType,
  OhlcBar,
  Project,
  SeriesSpec,
  Track,
} from '@chart-studio/core';
import { candlestickChartDefinition } from './trading/definitions/candlestick-chart';
import { chartGeometry, priceToY } from './trading/chart';
// The drawing definitions register themselves; the migration needs them to
// know a drawing's props version.
import './trading/drawings/definitions';
import { CURRENT_PROJECT_SCHEMA_VERSION } from '@chart-studio/core';

/** Schema version this build writes and understands. */
export { CURRENT_PROJECT_SCHEMA_VERSION };

function fail(message: string): never {
  throw new Error(message);
}

const migrateClip = (raw: unknown, index: number): Clip => {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    fail(`Invalid project file: track clip ${index} is not an object.`);
  }
  const clip = raw as Record<string, unknown>;

  const id = typeof clip.id === 'string' ? clip.id : '';
  const element = clip.element;
  if (typeof element !== 'string') fail(`Invalid project file: clip "${id}" has no component type.`);

  const definition = getComponent(element as ElementType);
  if (!definition) fail(`Unsupported component type "${element}"`);

  const definitionVersion = definition.propsVersion ?? 1;
  const clipVersion = typeof clip.propsVersion === 'number' ? clip.propsVersion : 1;
  if (clipVersion > definitionVersion) {
    fail(`Clip "${id}" uses props version ${clipVersion} but "${element}" supports ${definitionVersion}`);
  }

  return {
    ...(clip as unknown as Clip),
    id,
    name: typeof clip.name === 'string' ? clip.name : definition.label,
    element: element as ElementType,
    from: typeof clip.from === 'number' ? clip.from : 0,
    durationInFrames: typeof clip.durationInFrames === 'number' ? clip.durationInFrames : 1,
    props:
      typeof clip.props === 'object' && clip.props !== null && !Array.isArray(clip.props)
        ? (clip.props as Record<string, unknown>)
        : {},
    effects: Array.isArray(clip.effects) ? (clip.effects as Clip['effects']) : [],
  };
};

const migrateTrack = (raw: unknown, index: number): Track => {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    fail(`Invalid project file: track ${index} is not an object.`);
  }
  const track = raw as Record<string, unknown>;
  if (!Array.isArray(track.clips)) fail(`Invalid project file: track ${index} has no clips array.`);
  return {
    ...(track as unknown as Track),
    id: typeof track.id === 'string' ? track.id : `t-${index}`,
    name: typeof track.name === 'string' ? track.name : `Track ${index + 1}`,
    clips: (track.clips as unknown[]).map((clip, clipIndex) => migrateClip(clip, clipIndex)),
  };
};

/**
 * The v1 → v2 conversion.
 *
 * Version 1 kept a chart's bars inside the clip's props. Version 2 moves them
 * into a project-level series that the chart references by id, so the data's
 * origin survives the move and two charts can share one series.
 *
 * The conversion is non-destructive: the legacy `bars` array stays on the
 * migrated clip as an inert compatibility key, so the chart renderer keeps
 * reading it and the document renders identically before and after.
 */
const migrateV1ToV2 = (
  doc: Record<string, unknown>,
  tracks: Track[],
): { doc: Record<string, unknown>; tracks: Track[] } => {
  const series: SeriesSpec[] = [];
  const nextTracks = tracks.map((track) => {
    const clips = track.clips.map((clip) => {
      if (clip.element !== 'candlestickChart') return clip;
      const props = clip.props as Record<string, unknown> | undefined;
      const bars = props?.bars;
      if (!Array.isArray(bars) || bars.length === 0) return clip;

      const seriesId = `series-${clip.id}`;
      const stamped = bars.map((bar, index) => ({
        ...(bar as Record<string, unknown>),
        id: `${seriesId}:${index}`,
      })) as OhlcBar[];

      const isSynthetic = props?.dataSource === 'synthetic';
      series.push(
        isSynthetic
          ? {
              id: seriesId,
              origin: 'synthetic',
              label: typeof props?.symbol === 'string' ? props.symbol : 'Series',
              symbol: typeof props?.symbol === 'string' ? props.symbol : undefined,
              timeBasis: 'logical',
              seed: `${seriesId}-seed`,
              algorithmVersion: 1,
              generator: {
                count: stamped.length,
                startPrice: stamped[0]?.o ?? 1,
                timeframeMs: 60_000,
              },
              // The bars are the record: version 1 never stored the seed that
              // produced them, so the recipe cannot make them again.
              bars: stamped,
            }
          : {
              id: seriesId,
              origin: 'manual',
              label: typeof props?.symbol === 'string' ? props.symbol : 'Series',
              symbol: typeof props?.symbol === 'string' ? props.symbol : undefined,
              timeBasis: 'logical',
              bars: stamped,
            },
      );

      // The legacy `bars` key stays: the renderer reads it until the props
      // move to v2 in a later slice.
      return {
        ...clip,
        props: {
          ...props,
          bars: stamped,
          seriesId,
          clock: {
            id: `${clip.id}-clock`,
            unit: 'logical',
            referenceSeriesId: seriesId,
            stepBars: 1,
            // The version 1 chart's own frames-per-bar is the clock's pace, so
            // the migrated chart forms its candles at the same rate.
            framesPerStep:
              typeof props?.framesPerBar === 'number' && props.framesPerBar > 0
                ? props.framesPerBar
                : 15,
          },
          panes: [
            {
              id: `${clip.id}-pane-0`,
              seriesId,
              aggregation: { factor: 1 },
              rect: { x: 0, y: 0, width: 1, height: 1 },
              in: 0,
              out: clip.durationInFrames,
              opacity: 1,
              clock: { kind: 'reference' as const },
              priceRange: { mode: 'auto' as const },
            },
          ],
        },
      };
    });
    return { ...track, clips };
  });

  return {
    doc: {
      ...doc,
      series,
      // The document keeps its length: 'fixed' means durationInFrames is
      // authoritative, exactly as it was in version 1.
      durationMode: 'fixed',
    },
    tracks: nextTracks,
  };
};

/* ------------------------------------------------------------------ */
/* the v2 to v3 conversion                                              */
/* ------------------------------------------------------------------ */

/**
 * The two renamed kinds.
 *
 * A line that keeps the name `priceLine` while holding no price is a false
 * label, so the kind is renamed and the migration carries the rename
 * (ADR-009, decision 9). There is no alias for the old names.
 */
const LEGACY_ELEMENT_NAMES: Record<string, string> = {
  priceLine: 'horizontalLine',
  priceZone: 'rectangle',
};

/** The eight independent drawing kinds, as element names. */
const DRAWING_ELEMENTS: readonly string[] = [
  'horizontalLine',
  'verticalLine',
  'trendline',
  'highLowLine',
  'rectangle',
  'textLabel',
  'arrow',
  'position',
];

/**
 * The market anchors a version 2 drawing stored.
 *
 * The type is read here and nowhere else: `MarketAnchor` is retired from
 * core, and the migration is the only thing that still speaks the old
 * vocabulary.
 */
type LegacyAnchor =
  | { kind: 'price'; price: number }
  | { kind: 'candle'; barId: string; side: 'high' | 'low' | 'close' }
  | { kind: 'time'; barId: string }
  | { kind: 'point'; barId: string; price: number };

/** One bar of the pane's own series, with the id a version 2 anchor would name. */
interface PaneBar {
  id: string;
  o: number;
  h: number;
  l: number;
  c: number;
}

/**
 * The pane's bars, bucketed by the pane's factor.
 *
 * The ids are the ones a version 2 anchor named: a pane that shows the
 * source bars unchanged carries the source bar's id, and a pane that buckets
 * them carries the bucket's id (`${pane.id}:${bucket}`).
 */
const paneBars = (bars: readonly OhlcBar[], paneId: string, factor: number): PaneBar[] => {
  if (factor <= 1) {
    return bars.map((bar) => ({ id: bar.id, o: bar.o, h: bar.h, l: bar.l, c: bar.c }));
  }
  const buckets: PaneBar[] = [];
  for (let start = 0, bucket = 0; start < bars.length; start += factor, bucket += 1) {
    const constituents = bars.slice(start, start + factor);
    const first = constituents[0];
    const last = constituents[constituents.length - 1];
    buckets.push({
      id: `${paneId}:${bucket}`,
      o: first.o,
      h: Math.max(...constituents.map((bar) => bar.h)),
      l: Math.min(...constituents.map((bar) => bar.l)),
      c: last.c,
    });
  }
  return buckets;
};

/** The legacy anchors of a drawing's props. */
const legacyAnchors = (props: Record<string, unknown>): Record<string, LegacyAnchor> => {
  const anchors = props.anchors;
  if (typeof anchors !== 'object' || anchors === null) return {};
  return anchors as Record<string, LegacyAnchor>;
};

/** The element remap, applied to the raw document before the clips are read. */
const renameLegacyElements = (doc: Record<string, unknown>): Record<string, unknown> => {
  const tracks = doc.tracks;
  if (!Array.isArray(tracks)) return doc;
  return {
    ...doc,
    tracks: tracks.map((track) => {
      const raw = track as Record<string, unknown>;
      if (!Array.isArray(raw.clips)) return track;
      return {
        ...raw,
        clips: raw.clips.map((clip) => {
          const rawClip = clip as Record<string, unknown>;
          const element = rawClip.element;
          if (typeof element !== 'string') return clip;
          const mapped = LEGACY_ELEMENT_NAMES[element];
          return mapped ? { ...rawClip, element: mapped } : clip;
        }),
      };
    }),
  };
};

/**
 * The points a version 2 drawing carried, as 0..1 fractions of its own box.
 *
 * The table is the migration's own: the definitions' defaults are absolute
 * places in the composition, and the version 2 → 3 step is the last one that
 * speaks in fractions.
 */
const LEGACY_DRAWING_POINTS: Record<DrawingKind, Record<string, { x: number; y: number }>> = {
  horizontalLine: {},
  verticalLine: { at: { x: 0.5, y: 0.5 } },
  trendline: { start: { x: 0.25, y: 0.75 }, end: { x: 0.75, y: 0.25 } },
  highLowLine: { top: { x: 0.5, y: 0.25 }, bottom: { x: 0.5, y: 0.75 } },
  rectangle: {},
  textLabel: { at: { x: 0.5, y: 0.5 } },
  arrow: { from: { x: 0.25, y: 0.75 }, to: { x: 0.75, y: 0.25 } },
  position: { entry: { x: 0, y: 0.5 }, stop: { x: 0, y: 0.75 }, target: { x: 0, y: 0.25 } },
};

/** The props a migrated drawing keeps when the chart cannot be resolved. */
const fallbackProps = (
  kind: DrawingKind,
  props: Record<string, unknown>,
): Record<string, unknown> => {
  const next: Record<string, unknown> = { ...props };
  delete next.chartClipId;
  delete next.paneId;
  delete next.anchors;
  delete next.in;
  delete next.out;
  delete next.price;
  delete next.zone;

  const defaults = LEGACY_DRAWING_POINTS[kind];
  if (Object.keys(defaults).length > 0) next.points = defaults;

  // The caption is the creator's own figure: keep it when it can be read.
  if (typeof props.caption === 'string') next.caption = props.caption;
  else {
    const anchors = legacyAnchors(props);
    const price = anchors.price;
    if (price && price.kind === 'price') next.caption = String(price.price);
  }

  const position = props.position as Record<string, unknown> | undefined;
  if (position) {
    next.position = {
      direction:
        position.direction === 'short' || position.direction === 'long'
          ? position.direction
          : 'long',
      ...(typeof position.showRiskReward === 'boolean'
        ? { showRiskReward: position.showRiskReward }
        : {}),
    };
  }

  return next;
};

/**
 * Migrates one drawing clip to the independent model.
 *
 * The placement uses the chart's plot area and the chart's **full-series**
 * price range, so it is an approximation at the last frame — the comment
 * says so in the same words.
 */
const migrateDrawingClip = (
  clip: Clip,
  chartClips: Map<string, Clip>,
  series: readonly SeriesSpec[],
): Clip => {
  const kind = clip.element as DrawingKind;
  const props = clip.props as Record<string, unknown>;
  const anchors = legacyAnchors(props);

  const chart = typeof props.chartClipId === 'string' ? chartClips.get(props.chartClipId) : undefined;
  const panes = (chart?.props as { panes?: { id?: string; seriesId?: string; aggregation?: { factor?: number }; rect?: { x: number; y: number; width: number; height: number } }[] } | undefined)
    ?.panes;
  const pane = panes?.find((entry) => entry.id === props.paneId);
  const paneSpec = series.find((entry) => entry.id === pane?.seriesId);

  // The fallback path: no chart, no pane or no series means the drawing keeps
  // the box it already had. It is never left half-converted.
  if (!chart || !pane || !paneSpec) {
    return {
      ...clip,
      props: fallbackProps(kind, props),
      propsVersion: 2,
    };
  }

  const datasource = materialiseSeries(paneSpec);
  const factor = Math.max(1, Math.floor(pane.aggregation?.factor ?? 1));
  const bars = paneBars(datasource.bars, pane.id ?? 'pane', factor);
  if (bars.length === 0) {
    return {
      ...clip,
      props: fallbackProps(kind, props),
      propsVersion: 2,
    };
  }

  // The full-series range, not the revealed subset: the drawing keeps the
  // level it was drawn at.
  const range = computePriceRange(bars.map((bar) => ({ l: bar.l, h: bar.h })));

  const chartProps = {
    ...candlestickChartDefinition.defaults,
    ...(chart.props as Record<string, unknown>),
  } as unknown as Parameters<typeof chartGeometry>[0];
  const geometry = chartGeometry(chartProps, bars.length, pane.rect);

  // The chart's own box, in composition pixels.
  const chartLeft = chartProps.x - chartProps.width / 2;
  const chartTop = chartProps.y - chartProps.height / 2;
  const plotLeft = chartLeft + geometry.plotLeft;
  const plotTop = chartTop + geometry.plotTop;

  const clamp01 = (value: number): number => Math.min(1, Math.max(0, value));
  const fractionX = (localX: number): number =>
    clamp01((localX - geometry.plotLeft) / geometry.plotWidth);
  const fractionY = (localY: number): number =>
    clamp01((localY - geometry.plotTop) / geometry.plotHeight);
  const priceY = (price: number): number =>
    priceToY(price, range.min, range.max, geometry);

  /** The slot centre of the bar an anchor names, or null when it names none. */
  const slotX = (barId: string): number | null => {
    const index = bars.findIndex((bar) => bar.id === barId);
    if (index < 0) return null;
    return geometry.plotLeft + (index + 0.5) * geometry.slotWidth;
  };

  /** The price a candle anchor names. */
  const candlePrice = (anchor: LegacyAnchor): number | null => {
    if (anchor.kind !== 'candle') return null;
    const bar = bars.find((entry) => entry.id === anchor.barId);
    if (!bar) return null;
    return anchor.side === 'high' ? bar.h : anchor.side === 'low' ? bar.l : bar.c;
  };

  /** A point anchor's own price, or the price it names at its bar. */
  const pointPrice = (anchor: LegacyAnchor): number | null => {
    if (anchor.kind === 'price') return anchor.price;
    if (anchor.kind === 'point') return anchor.price;
    return candlePrice(anchor);
  };

  const box = { x: plotLeft + geometry.plotWidth / 2, y: plotTop + geometry.plotHeight / 2, width: geometry.plotWidth, height: geometry.plotHeight };
  let points: Record<string, { x: number; y: number }> = {};
  let boxOverride = box;

  const priceAnchor = anchors.price;
  const price = priceAnchor && priceAnchor.kind === 'price' ? priceAnchor.price : undefined;

  switch (kind) {
    case 'horizontalLine': {
      if (price === undefined) return { ...clip, props: fallbackProps(kind, props), propsVersion: 2 };
      // The band is the plot area's width, 24 px tall, centred on the price.
      boxOverride = {
        x: plotLeft + geometry.plotWidth / 2,
        y: chartTop + priceY(price),
        width: geometry.plotWidth,
        height: 24,
      };
      break;
    }
    case 'rectangle': {
      // The zone's two edge prices are not carried over — they were
      // market-derived clicks. An extend-right zone's box is widened to the
      // chart's right edge.
      const zone = props.zone as { extendRight?: boolean } | undefined;
      if (zone?.extendRight) {
        const right = chartLeft + chartProps.width;
        boxOverride = {
          x: plotLeft + (right - plotLeft) / 2,
          y: box.y,
          width: right - plotLeft,
          height: box.height,
        };
      }
      break;
    }
    case 'verticalLine': {
      const anchor = anchors.bar;
      const x = anchor && 'barId' in anchor ? slotX(anchor.barId) : null;
      if (x === null) return { ...clip, props: fallbackProps(kind, props), propsVersion: 2 };
      points = { at: { x: fractionX(x), y: 0.5 } };
      break;
    }
    case 'highLowLine': {
      const high = anchors.high;
      const low = anchors.low;
      if (!high || !low) return { ...clip, props: fallbackProps(kind, props), propsVersion: 2 };
      const highX = 'barId' in high ? slotX(high.barId) : null;
      const lowX = 'barId' in low ? slotX(low.barId) : null;
      const highPrice = candlePrice(high);
      const lowPrice = candlePrice(low);
      if (highX === null || lowX === null || highPrice === null || lowPrice === null) {
        return { ...clip, props: fallbackProps(kind, props), propsVersion: 2 };
      }
      points = {
        top: { x: fractionX(highX), y: fractionY(priceY(highPrice)) },
        bottom: { x: fractionX(lowX), y: fractionY(priceY(lowPrice)) },
      };
      break;
    }
    case 'trendline':
    case 'arrow':
    case 'textLabel': {
      const keys =
        kind === 'trendline'
          ? ['start', 'end']
          : kind === 'arrow'
            ? ['from', 'to']
            : ['at'];
      for (const key of keys) {
        const anchor = anchors[key];
        if (!anchor) return { ...clip, props: fallbackProps(kind, props), propsVersion: 2 };
        const barId = 'barId' in anchor ? anchor.barId : null;
        const x = barId === null ? null : slotX(barId);
        const anchorPrice = pointPrice(anchor);
        if (x === null || anchorPrice === null) {
          return { ...clip, props: fallbackProps(kind, props), propsVersion: 2 };
        }
        points[key] = { x: fractionX(x), y: fractionY(priceY(anchorPrice)) };
      }
      break;
    }
    case 'position': {
      const levels = props.position as Record<string, unknown> | undefined;
      for (const key of ['entry', 'stop', 'target']) {
        const anchor = anchors[key];
        const level =
          anchor && (anchor.kind === 'price' || anchor.kind === 'point')
            ? anchor.price
            : typeof levels?.[key] === 'number'
              ? (levels[key] as number)
              : null;
        if (level === null) return { ...clip, props: fallbackProps(kind, props), propsVersion: 2 };
        points[key] = { x: 0, y: fractionY(priceY(level)) };
      }
      break;
    }
  }

  const next: Record<string, unknown> = { ...props };
  delete next.chartClipId;
  delete next.paneId;
  delete next.anchors;
  delete next.in;
  delete next.out;
  delete next.price;
  delete next.zone;

  next.x = boxOverride.x;
  next.y = boxOverride.y;
  next.width = boxOverride.width;
  next.height = boxOverride.height;
  if (Object.keys(points).length > 0) next.points = points;

  // The creator's own figure survives as the caption: a price line's price
  // is exactly the number the creator saw.
  if (typeof props.caption === 'string') {
    next.caption = props.caption;
  } else if (price !== undefined) {
    next.caption = String(price);
  }

  const position = props.position as Record<string, unknown> | undefined;
  if (position) {
    next.position = {
      ...(typeof position.direction === 'string' ? { direction: position.direction } : {}),
      ...(typeof position.showRiskReward === 'boolean'
        ? { showRiskReward: position.showRiskReward }
        : {}),
    };
  }

  // The lifecycle becomes the drawing's own: the chart's range, measured
  // from the chart's own start.
  const chartFrom = chart.from;
  const chartDuration = chart.durationInFrames;
  const inFrame = typeof props.in === 'number' ? props.in : 0;
  const outFrame = typeof props.out === 'number' ? props.out : 0;
  const duration = (outFrame > inFrame ? outFrame : chartDuration) - inFrame;

  return {
    ...clip,
    from: chartFrom + inFrame,
    durationInFrames: Math.max(1, duration),
    props: next,
    propsVersion: 2,
  };
};

/**
 * The v2 → v3 conversion.
 *
 * The two renamed kinds are mapped first, and every drawing becomes an
 * independent element: its own box, its own frame range and its own points.
 */
const migrateV2ToV3 = (
  doc: Record<string, unknown>,
  tracks: Track[],
): { doc: Record<string, unknown>; tracks: Track[] } => {
  const series = Array.isArray(doc.series) ? (doc.series as SeriesSpec[]) : [];
  const chartClips = new Map<string, Clip>();
  for (const track of tracks) {
    for (const clip of track.clips) chartClips.set(clip.id, clip);
  }

  const nextTracks = tracks.map((track) => ({
    ...track,
    clips: track.clips.map((clip) =>
      DRAWING_ELEMENTS.includes(clip.element)
        ? migrateDrawingClip(clip, chartClips, series)
        : clip,
    ),
  }));

  return { doc, tracks: nextTracks };
};

/**
 * The points each drawing's shape needs.
 *
 * A drawing that does not carry them is left exactly as it was: nobody drew
 * them, so nobody invents them.
 */
const DRAWING_POINT_KEYS: Record<DrawingKind, string[]> = {
  horizontalLine: [],
  verticalLine: [],
  trendline: ['start', 'end'],
  highLowLine: ['top', 'bottom'],
  rectangle: [],
  textLabel: ['at'],
  arrow: ['from', 'to'],
  position: ['entry', 'stop', 'target'],
};

/**
 * The v3 → v4 conversion of one drawing.
 *
 * A drawing's points become places in the composition: the fraction of the
 * drawing's own box becomes the pixel it pointed at. The drawings that have
 * no box of their own — a trend line, an arrow, a high/low line — lose the
 * box they never used, and a label keeps only its point.
 *
 * The conversion is non-destructive: a drawing that does not carry the
 * points its shape needs is left exactly as it was.
 */
const migrateDrawingToV4 = (clip: Clip): Clip => {
  const kind = clip.element as DrawingKind;
  const props = { ...(clip.props as Record<string, unknown>) };
  const points = props.points as Record<string, { x: number; y: number }> | undefined;

  const box = {
    x: typeof props.x === 'number' ? props.x : undefined,
    y: typeof props.y === 'number' ? props.y : undefined,
    width: typeof props.width === 'number' ? props.width : undefined,
    height: typeof props.height === 'number' ? props.height : undefined,
  };
  // The box's own origin in the composition: the content is centred on the
  // anchor, so the box's left edge sits half a width to the left of it.
  const left =
    box.x !== undefined && box.width !== undefined ? box.x - box.width / 2 : undefined;
  const top =
    box.y !== undefined && box.height !== undefined ? box.y - box.height / 2 : undefined;

  /** A fraction of the drawing's box, as a place in the composition. */
  const absolute = (
    point: { x: number; y: number } | undefined,
  ): { x: number; y: number } | undefined => {
    if (!point || left === undefined || top === undefined) return undefined;
    if (!box.width || !box.height) return undefined;
    return { x: left + point.x * box.width, y: top + point.y * box.height };
  };

  const needed = DRAWING_POINT_KEYS[kind];
  const next: Record<string, unknown> = { ...props };
  const set = (key: string, value: number | undefined): void => {
    if (value === undefined) delete next[key];
    else next[key] = value;
  };

  switch (kind) {
    case 'horizontalLine':
      // The rule keeps its centre and its length, and loses the band it was
      // drawn in.
      set('x', box.x);
      set('y', box.y);
      set('width', box.width);
      delete next.height;
      delete next.points;
      break;
    case 'verticalLine': {
      // The rule keeps its own x, the centre of its span and its length.
      const at = absolute(points?.at);
      set('x', at ? at.x : box.x);
      set('y', box.y);
      set('height', box.height);
      delete next.width;
      delete next.points;
      break;
    }
    case 'rectangle':
      // The box is the truth: it does not change.
      delete next.points;
      break;
    case 'textLabel': {
      const at = absolute(points?.at);
      if (!at) return clip;
      // The label keeps only its point.
      set('x', at.x);
      set('y', at.y);
      delete next.width;
      delete next.height;
      next.points = { at };
      break;
    }
    case 'position': {
      const entry = absolute(points?.entry);
      const stop = absolute(points?.stop);
      const target = absolute(points?.target);
      if (!entry || !stop || !target) return clip;
      // The box stays: the levels are places inside it.
      next.points = { entry, stop, target };
      break;
    }
    case 'trendline':
    case 'arrow':
    case 'highLowLine': {
      const converted: Record<string, { x: number; y: number }> = {};
      for (const key of needed) {
        const point = absolute(points?.[key]);
        if (!point) return clip;
        converted[key] = point;
      }
      // The shape is its points: the box it never used goes.
      next.points = converted;
      delete next.x;
      delete next.y;
      delete next.width;
      delete next.height;
      break;
    }
  }

  // The ray is retired: a trend line has no box to run to the edge of.
  delete next.trendline;

  return { ...clip, props: next, propsVersion: 3 };
};

/**
 * The v3 → v4 conversion.
 *
 * Only the drawings change: the rest of the document is carried through
 * untouched.
 */
const migrateV3ToV4 = (
  doc: Record<string, unknown>,
  tracks: Track[],
): { doc: Record<string, unknown>; tracks: Track[] } => {
  const nextTracks = tracks.map((track) => ({
    ...track,
    clips: track.clips.map((clip) =>
      DRAWING_ELEMENTS.includes(clip.element) ? migrateDrawingToV4(clip) : clip,
    ),
  }));

  return { doc, tracks: nextTracks };
};

/**
 * Validate and upgrade a project document.
 *
 * @throws when the document is malformed, uses an unsupported schema version,
 * references an unknown component or carries a props version the component
 * does not support.
 */
export const migrateProject = (raw: unknown): Project => {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    fail('Invalid project file: expected a JSON object.');
  }
  let doc = raw as Record<string, unknown>;

  const version = doc.schemaVersion === undefined ? 1 : doc.schemaVersion;
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    fail(`Invalid project schema version: ${String(doc.schemaVersion)}`);
  }
  if (version > CURRENT_PROJECT_SCHEMA_VERSION) {
    fail(`Unsupported project schema version ${version} (current: ${CURRENT_PROJECT_SCHEMA_VERSION})`);
  }

  // The scalar facts are checked by the validator, so the failure names the
  // field that is wrong rather than restating the shape here.
  const scalars = validateProjectScalars(doc);
  if (!scalars.ok) {
    const issue = scalars.issues[0];
    fail(`Invalid project file: "${issue.path}" is wrong — ${issue.message}`);
  }

  // The validator has already proved these are numbers.
  const fps = scalars.value.fps;
  const width = scalars.value.width;
  const height = scalars.value.height;
  const durationInFrames = scalars.value.durationInFrames;
  const name = typeof doc.name === 'string' ? doc.name : 'Untitled';
  const backgroundColor =
    typeof doc.backgroundColor === 'string' ? doc.backgroundColor : '#0d0d14';

  // The two renamed kinds are mapped before the clips are read, so a version 2
  // document opens with its price lines as horizontal lines and its price
  // zones as rectangles.
  if (version < 3) doc = renameLegacyElements(doc);

  const tracks = (doc.tracks as unknown[]).map((track, index) => migrateTrack(track, index));

  const v2 = version < 2 ? migrateV1ToV2(doc, tracks) : { doc, tracks };
  const v3 = version < 3 ? migrateV2ToV3(v2.doc, v2.tracks) : v2;
  const migrated = version < 4 ? migrateV3ToV4(v3.doc, v3.tracks) : v3;

  return {
    ...(migrated.doc as unknown as Project),
    name,
    width,
    height,
    fps,
    durationInFrames,
    backgroundColor,
    tracks: migrated.tracks,
    schemaVersion: CURRENT_PROJECT_SCHEMA_VERSION,
  };
};
