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
import type { ChartGroupSpec, ChartProps } from './elements';
import { TIMEFRAME_BASE_UNITS } from './elements';
import type { SeriesSpec } from './series';
import {
  isTimeframeId,
  paneBarCount,
  paneRung,
  rungForBaseUnits,
  seriesBaseUnits,
} from './time';

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

const curveSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('preset'),
    name: z.enum(['linear', 'easeIn', 'easeOut', 'easeInOut', 'bounceOut', 'elastic', 'overshoot']),
  }),
  z.object({
    kind: z.literal('cubicBezier'),
    p: z.tuple([z.number(), z.number(), z.number(), z.number()]),
  }),
]);

/** The colours of one pane. */
const paneStyleSchema = z.object({
  upColor: z.string().optional(),
  downColor: z.string().optional(),
  wickColor: z.string().optional(),
  showGrid: z.boolean().optional(),
  gridColor: z.string().optional(),
  showPriceAxis: z.boolean().optional(),
  axisColor: z.string().optional(),
  axisLabelColor: z.string().optional(),
});

/** A pause point: the pane holds on one candle for a frame range. */
const paneHoldSchema = z.object({
  barId: z.string().min(1),
  in: z.number().int(),
  out: z.number().int(),
});

/** One camera zoom segment: from one aggregation and bar range to another. */
const zoomSegmentSchema = z.looseObject({
  in: z.number().int(),
  out: z.number().int(),
  from: z.object({
    aggregation: z.number().int().positive(),
    fromBar: z.number().int().nonnegative(),
  }),
  to: z.object({
    aggregation: z.number().int().positive(),
    fromBar: z.number().int().nonnegative(),
  }),
  curve: curveSchema.optional(),
});

/**
 * A pane.
 *
 * The pause points and the camera zoom track are declared, so they survive a
 * round trip, and so do the pane's curve and style.
 */
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
  curve: curveSchema.optional(),
  clock: clockBindingSchema,
  priceRange: priceRangeSchema,
  viewport: z
    .object({ fromBar: z.number().int().nonnegative(), barCount: z.number().int().positive() })
    .optional(),
  holds: z.array(paneHoldSchema).optional(),
  zoom: z.object({ segments: z.array(zoomSegmentSchema) }).optional(),
  style: paneStyleSchema.optional(),
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
  framesPerStep: z.number().int().positive(),
  offsets: z.record(z.string(), z.number().int()).optional(),
});

const chartPropsSchema = z.object({
  seriesId: z.string().min(1),
  panes: z.array(paneSpecSchema).min(1),
  clock: marketClockSchema,
  relations: z.array(paneRelationSchema).optional(),
});

/**
 * The scene-level container for the split layouts.
 *
 * A group holds one to three charts: SMT compares two or three assets, never
 * one and never more (CH-011). The group owns the arrangement, not the charts'
 * data, so it keeps only the ids of the charts it arranges.
 */
const chartGroupSpecSchema = z.looseObject({
  id: z.string().min(1),
  name: z.string(),
  chartClipIds: z.array(z.string().min(1)).min(1).max(3),
  layout: z.enum(['single', 'split-horizontal', 'split-vertical', 'pip']),
  clock: marketClockSchema,
  relations: z.array(paneRelationSchema).default([]),
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

const trackTransitionSchema = z.looseObject({
  id: z.string().min(1),
  fromClipId: z.string().min(1),
  toClipId: z.string().min(1),
  element: z.string().min(1),
  durationInFrames: z.number().int().nonnegative(),
  props: z.record(z.string(), z.unknown()).optional(),
});

const trackSchema = z.looseObject({
  id: z.string().min(1),
  name: z.string(),
  clips: z.array(clipSchema),
  transitions: z.array(trackTransitionSchema).optional(),
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
  chartGroups: z.array(chartGroupSpecSchema).optional(),
  durationMode: z.enum(['derived', 'fixed']).optional(),
});

/* ------------------------------------------------------------------ */
/* the ladder and the relation rules                                 */
/* ------------------------------------------------------------------ */

/**
 * Validates a chart's panes and its declared relations.
 *
 * Four rules, each about a fact the document claims:
 *
 * - a pane's rung is a rung of the ladder, and its factor is the ratio that
 *   rung carries against the base its series is built from;
 * - a rollup's two panes read the same series, and the coarse pane's factor
 *   is a whole multiple of the fine pane's;
 * - a lockstep's two panes carry the same rung and show the same number of
 *   candles;
 * - a relation names panes the chart holds.
 *
 * The issues carry a path and a message, so a caller can point at the pane
 * that has to change.
 */
export const validateChartRelations = (raw: unknown): ValidationResult<ChartProps> => {
  const shape = chartPropsSchema.safeParse(raw);
  if (!shape.success) {
    return {
      ok: false,
      issues: shape.error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    };
  }

  // The rules read the props as they were written: the schema strips the
  // fields it does not declare, and a pane keeps them.
  const props = raw as ChartProps;
  const issues: { path: string; message: string }[] = [];
  const panes = props.panes ?? [];
  const byId = new Map(panes.map((pane) => [pane.id, pane]));

  // The ladder: a rung is a rung, and a factor is the ratio it carries.
  panes.forEach((pane, index) => {
    const path = `panes.${index}`;
    if (pane.timeframeId !== undefined && !isTimeframeId(pane.timeframeId)) {
      issues.push({
        path: `${path}.timeframeId`,
        message: `"${pane.timeframeId}" is not a rung of the timeframe ladder.`,
      });
      return;
    }
    if (pane.timeframeId === undefined) {
      if (pane.aggregation.factor !== 1) {
        issues.push({
          path: `${path}.aggregation.factor`,
          message: `Pane "${pane.id}" names no timeframe, so it reads the source directly and must aggregate 1 bar, not ${pane.aggregation.factor}.`,
        });
      }
      return;
    }
    const baseUnits = seriesBaseUnits(panes, pane.seriesId);
    const baseRung = rungForBaseUnits(baseUnits);
    if (!baseRung) {
      issues.push({
        path: `${path}.aggregation.factor`,
        message: `Pane "${pane.id}" at ${pane.timeframeId} aggregates ${pane.aggregation.factor} bars, which makes a base of ${baseUnits} minutes — not a rung of the timeframe ladder.`,
      });
      return;
    }
    const expected = TIMEFRAME_BASE_UNITS[pane.timeframeId] / baseUnits;
    if (!Number.isInteger(expected)) {
      issues.push({
        path: `${path}.aggregation.factor`,
        message: `Pane "${pane.id}" at ${pane.timeframeId} is not a whole multiple of the ${baseRung} base.`,
      });
      return;
    }
    if (pane.aggregation.factor !== expected) {
      issues.push({
        path: `${path}.aggregation.factor`,
        message: `Pane "${pane.id}" at ${pane.timeframeId} must aggregate ${expected} bars of the ${baseRung} base, not ${pane.aggregation.factor}.`,
      });
    }
  });

  // The relations: what the creator declared must hold.
  (props.relations ?? []).forEach((relation, index) => {
    const path = `relations.${index}`;
    if (relation.kind === 'rollup') {
      const fine = byId.get(relation.finePaneId);
      const coarse = byId.get(relation.coarsePaneId);
      if (!fine) {
        issues.push({
          path: `${path}.finePaneId`,
          message: `Rollup names pane "${relation.finePaneId}", which this chart does not hold.`,
        });
      }
      if (!coarse) {
        issues.push({
          path: `${path}.coarsePaneId`,
          message: `Rollup names pane "${relation.coarsePaneId}", which this chart does not hold.`,
        });
      }
      if (!fine || !coarse) return;
      if (fine.seriesId !== coarse.seriesId) {
        issues.push({
          path: `${path}.coarsePaneId`,
          message: `Coarse pane "${coarse.id}" must read the same series ("${fine.seriesId}") as fine pane "${fine.id}", so the two can be rolled up against each other.`,
        });
      }
      const ratio = coarse.aggregation.factor / fine.aggregation.factor;
      if (!Number.isInteger(ratio)) {
        issues.push({
          path: `${path}.coarsePaneId`,
          message: `Coarse pane "${coarse.id}" aggregates ${coarse.aggregation.factor} bars, which is not a whole multiple of the ${fine.aggregation.factor} bars of fine pane "${fine.id}".`,
        });
      } else if (ratio <= 1) {
        issues.push({
          path: `${path}.coarsePaneId`,
          message: `Coarse pane "${coarse.id}" must aggregate more bars than fine pane "${fine.id}" to be a coarser rung.`,
        });
      }
      return;
    }

    // Lockstep: two assets on one rung, showing the same number of candles.
    if (!isTimeframeId(relation.timeframeId)) {
      issues.push({
        path: `${path}.timeframeId`,
        message: `"${relation.timeframeId}" is not a rung of the timeframe ladder.`,
      });
    }
    const [firstId, secondId] = relation.paneIds;
    const first = byId.get(firstId);
    const second = byId.get(secondId);
    if (!first) {
      issues.push({
        path: `${path}.paneIds.0`,
        message: `Lockstep names pane "${firstId}", which this chart does not hold.`,
      });
    }
    if (!second) {
      issues.push({
        path: `${path}.paneIds.1`,
        message: `Lockstep names pane "${secondId}", which this chart does not hold.`,
      });
    }
    if (!first || !second) return;
    const firstRung = paneRung(first, panes);
    const secondRung = paneRung(second, panes);
    if (firstRung !== secondRung) {
      issues.push({
        path: `${path}.paneIds`,
        message: `Lockstep panes "${first.id}" (${firstRung ?? 'no rung'}) and "${second.id}" (${secondRung ?? 'no rung'}) must carry the same rung.`,
      });
    }
    for (const pane of [first, second]) {
      if (pane.timeframeId !== undefined && pane.timeframeId !== relation.timeframeId) {
        issues.push({
          path: `${path}.paneIds`,
          message: `Pane "${pane.id}" must read ${relation.timeframeId} to stay in lockstep, not ${pane.timeframeId}.`,
        });
      }
    }
    const firstCount = paneBarCount(first);
    const secondCount = paneBarCount(second);
    if (firstCount !== secondCount) {
      issues.push({
        path: `${path}.paneIds`,
        message: `Lockstep panes "${first.id}" (${firstCount} candles) and "${second.id}" (${secondCount} candles) must show the same number of candles.`,
      });
    }
  });

  if (issues.length > 0) return { ok: false, issues };
  return { ok: true, value: props };
};

/* ------------------------------------------------------------------ */
/* the exported validators                                            */
/* ------------------------------------------------------------------ */

/** Validates a series specification. */
export const validateSeriesSpec = (raw: unknown): ValidationResult<SeriesSpec> =>
  toResult(seriesSpecSchema.safeParse(raw));

/** Validates a chart clip's props. */
export const validateChartProps = (raw: unknown): ValidationResult<ChartProps> =>
  toResult(chartPropsSchema.safeParse(raw) as z.ZodSafeParseResult<ChartProps>);

/**
 * Validates a grouped chart.
 *
 * A group holds one to three chart clips: SMT compares two or three assets,
 * never one and never more (CH-011).
 */
export const validateChartGroup = (raw: unknown): ValidationResult<ChartGroupSpec> =>
  toResult(chartGroupSpecSchema.safeParse(raw) as z.ZodSafeParseResult<ChartGroupSpec>);

/** Validates a whole project document. */
export const validateProjectDocument = (raw: unknown): ValidationResult<Project> =>
  toResult(projectSchema.safeParse(raw) as z.ZodSafeParseResult<Project>);

/** The scalar facts a project document must state. */
export interface ProjectScalars {
  fps: number;
  width: number;
  height: number;
  durationInFrames: number;
  tracks: unknown[];
}

const projectScalarsSchema = z.object({
  fps: z.number().positive(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  durationInFrames: z.number().int().positive(),
  tracks: z.array(z.unknown()),
});

/**
 * Validates only the scalar facts of a project document.
 *
 * The migration needs these and nothing more: the shape checks live in Zod,
 * while the checks that depend on the registry and on history — the version
 * gate, the unknown-component rejection and the props-version comparison —
 * stay hand-written (ADR-008, "The migration boundary").
 */
export const validateProjectScalars = (raw: unknown): ValidationResult<ProjectScalars> =>
  toResult(projectScalarsSchema.safeParse(raw) as z.ZodSafeParseResult<ProjectScalars>);
