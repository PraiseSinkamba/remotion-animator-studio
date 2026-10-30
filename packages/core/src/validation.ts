/**
 * Runtime validation of the domain schemas.
 *
 * This is the only module in the workspace that names a Zod symbol. The Zod
 * `safeParse` result never leaves this file: the exported validators return a
 * plain result, so no consumer outside core needs Zod in scope and no consumer
 * outside core needs a Zod dependency (ADR-008).
 */

import * as z from 'zod/v4';

import type { Project } from './schemas';
import type { ChartProps } from './elements';
import type { SeriesSpec } from './series';

/**
 * The result of a validation.
 *
 * `issues` carries a path and a message, both strings, so a caller can show
 * the problem without understanding Zod.
 */
export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; issues: { path: string; message: string }[] };

/** Maps a Zod failure to the plain result. */
const toResult = <T>(parsed: z.ZodSafeParseResult<T>): ValidationResult<T> => {
  if (parsed.success) return { ok: true, value: parsed.data };
  return {
    ok: false,
    issues: parsed.error.issues.map((issue) => ({
      path: issue.path.join('.'),
      message: issue.message,
    })),
  };
};

/* ------------------------------------------------------------------ */
/* series                                                             */
/* ------------------------------------------------------------------ */

const ohlcBarSchema = z.object({
  id: z.string().min(1),
  t: z.number(),
  o: z.number().positive(),
  h: z.number().positive(),
  l: z.number().positive(),
  c: z.number().positive(),
  v: z.number().optional(),
});

const swingAnchorSchema = z.object({
  id: z.string().min(1),
  barIndex: z.number().int().nonnegative(),
  price: z.number().positive(),
  regime: z.enum(['auto', 'trend', 'range']).optional(),
});

const swingPathSchema = z.object({
  anchors: z.array(swingAnchorSchema).min(2),
  barCount: z.number().int().min(2).optional(),
});

const generatorOptionsSchema = z
  .object({
    volatility: z.number().positive().optional(),
    pathNoise: z.number().nonnegative().optional(),
    intrabarSteps: z.number().int().positive().optional(),
    baseVolume: z.number().nonnegative().optional(),
    tickSize: z.number().positive().optional(),
    retracements: z
      .object({
        enabled: z.boolean().optional(),
        probability: z.number().min(0).max(1).optional(),
        minBars: z.number().int().positive().optional(),
        everyBars: z.number().int().positive().optional(),
        depthMin: z.number().min(0).max(1).optional(),
        depthMax: z.number().min(0).max(1).optional(),
      })
      .optional(),
    consolidations: z
      .object({
        enabled: z.boolean().optional(),
        flatThreshold: z.number().positive().optional(),
        meanReversion: z.number().positive().optional(),
        rangeWidth: z.number().positive().optional(),
        trendPauseProbability: z.number().min(0).max(1).optional(),
        pauseMinBars: z.number().int().positive().optional(),
        pauseMaxBars: z.number().int().positive().optional(),
        pauseSpeed: z.number().positive().optional(),
      })
      .optional(),
    wicks: z
      .object({
        strength: z.number().nonnegative().optional(),
        slopeSensitivity: z.number().nonnegative().optional(),
        rangeBoost: z.number().nonnegative().optional(),
        bodySensitivity: z.number().nonnegative().optional(),
      })
      .optional(),
    volatilityClustering: z
      .object({
        persistence: z.number().min(0).max(1).optional(),
        shock: z.number().nonnegative().optional(),
      })
      .optional(),
  })
  .optional();

const seriesSpecSchema = z.discriminatedUnion('origin', [
  z.object({
    id: z.string().min(1),
    origin: z.literal('authored-path'),
    label: z.string(),
    symbol: z.string().optional(),
    timeframeId: z.string().optional(),
    timeBasis: z.literal('logical'),
    seed: z.string(),
    algorithmVersion: z.number().int().positive(),
    path: swingPathSchema,
    generator: generatorOptionsSchema,
  }),
  z.object({
    id: z.string().min(1),
    origin: z.literal('manual'),
    label: z.string(),
    symbol: z.string().optional(),
    timeframeId: z.string().optional(),
    timeBasis: z.literal('logical'),
    bars: z.array(ohlcBarSchema),
  }),
  z.object({
    id: z.string().min(1),
    origin: z.literal('synthetic'),
    label: z.string(),
    symbol: z.string().optional(),
    timeframeId: z.string().optional(),
    timeBasis: z.literal('logical'),
    seed: z.string(),
    algorithmVersion: z.number().int().positive(),
    generator: z.object({
      count: z.number().int().positive(),
      startPrice: z.number().positive(),
      timeframeMs: z.number().int().positive(),
      volatility: z.number().nonnegative().optional(),
      drift: z.number().optional(),
    }),
  }),
  z.object({
    id: z.string().min(1),
    origin: z.literal('imported'),
    label: z.string(),
    symbol: z.string().optional(),
    timeframeId: z.string().optional(),
    timeBasis: z.literal('utc'),
    revision: z.string().min(1),
    bars: z.array(ohlcBarSchema),
  }),
]);

/* ------------------------------------------------------------------ */
/* chart props                                                        */
/* ------------------------------------------------------------------ */

const elementRectSchema = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number().positive(),
  height: z.number().positive(),
});

const clockBindingSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('reference') }),
  z.object({ kind: z.literal('offset'), offsetBars: z.number().int() }),
  z.object({ kind: z.literal('utc') }),
]);

const priceRangeSchema = z.discriminatedUnion('mode', [
  z.object({ mode: z.literal('auto') }),
  z.object({ mode: z.literal('fixed'), min: z.number(), max: z.number() }),
]);

const paneSpecSchema = z.object({
  id: z.string().min(1),
  name: z.string().optional(),
  seriesId: z.string().min(1),
  timeframeId: z.string().optional(),
  aggregation: z.object({ factor: z.number().int().positive() }),
  rect: elementRectSchema,
  in: z.number().int().nonnegative(),
  out: z.number().int().nonnegative(),
  opacity: z.number().min(0).max(1),
  clock: clockBindingSchema,
  priceRange: priceRangeSchema,
  viewport: z
    .object({ fromBar: z.number().int().nonnegative(), barCount: z.number().int().positive() })
    .optional(),
});

const paneRelationSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('rollup'),
    finePaneId: z.string().min(1),
    coarsePaneId: z.string().min(1),
  }),
  z.object({
    kind: z.literal('lockstep'),
    paneIds: z.tuple([z.string().min(1), z.string().min(1)]),
    timeframeId: z.string().min(1),
  }),
]);

const marketClockSchema = z.object({
  id: z.string().min(1),
  unit: z.enum(['logical', 'utc']),
  referenceSeriesId: z.string().min(1),
  stepBars: z.number().int().positive(),
  offsets: z.record(z.string(), z.number().int()).optional(),
});

const chartPropsSchema = z.object({
  seriesId: z.string().min(1),
  panes: z.array(paneSpecSchema).min(1),
  clock: marketClockSchema,
  relations: z.array(paneRelationSchema).optional(),
});

/* ------------------------------------------------------------------ */
/* project document                                                   */
/* ------------------------------------------------------------------ */

const effectInstanceSchema = z.looseObject({
  id: z.string().min(1),
  type: z.string().min(1),
  params: z.record(z.string(), z.union([z.number(), z.string()])),
});

const clipSchema = z.looseObject({
  id: z.string().min(1),
  name: z.string(),
  element: z.string().min(1),
  from: z.number().int().nonnegative(),
  durationInFrames: z.number().int().positive(),
  props: z.record(z.string(), z.unknown()),
  effects: z.array(effectInstanceSchema),
  groupId: z.string().optional(),
  propsVersion: z.number().int().optional(),
});

const trackSchema = z.looseObject({
  id: z.string().min(1),
  name: z.string(),
  clips: z.array(clipSchema),
});

/**
 * The project document.
 *
 * Loose about unknown keys at every level: a document written by a newer build
 * must survive a round trip through an older one rather than being silently
 * truncated (ADR-008, "The migration boundary"). Zod strips unknown keys by
 * default, so every object in the document tree is declared `loose`.
 */
const projectSchema = z.looseObject({
  name: z.string(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  fps: z.number().positive(),
  durationInFrames: z.number().int().positive(),
  backgroundColor: z.string(),
  tracks: z.array(trackSchema),
  schemaVersion: z.number().int().optional(),
  series: z.array(seriesSpecSchema).optional(),
  durationMode: z.enum(['derived', 'fixed']).optional(),
});

/* ------------------------------------------------------------------ */
/* the exported validators                                            */
/* ------------------------------------------------------------------ */

/** Validates a series specification. */
export const validateSeriesSpec = (raw: unknown): ValidationResult<SeriesSpec> =>
  toResult(seriesSpecSchema.safeParse(raw));

/** Validates a chart clip's props. */
export const validateChartProps = (raw: unknown): ValidationResult<ChartProps> =>
  toResult(chartPropsSchema.safeParse(raw) as z.ZodSafeParseResult<ChartProps>);

/** Validates a whole project document. */
export const validateProjectDocument = (raw: unknown): ValidationResult<Project> =>
  toResult(projectSchema.safeParse(raw) as z.ZodSafeParseResult<Project>);
