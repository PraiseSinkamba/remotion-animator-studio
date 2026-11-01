/**
 * The chart element model.
 *
 * A chart is a collection of elements: its panes, and the drawings anchored to
 * it. Everything here is plain data — no React, no Remotion, no DOM — so the
 * same object renders identically in preview and in export.
 *
 * Field sets follow the design spec §3.4 (panes, drawings, clock, relations)
 * and §3.4.1 (the timeframe ladder).
 */
import type { Curve } from './curve';

/** Identity of an element inside a project. */
export type ElementId = string;

/** Where an element sits inside the chart frame, in 0..1 of the chart's width/height. */
export interface ElementRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** A timeframe the product offers. A rung of the ladder, never a free multiplier. */
export type TimeframeId =
  | '1m' | '3m' | '5m' | '15m' | '30m' | '1H'
  | '4H' | '6H' | '7H' | '2D' | '1W' | '1M';

/** How many base units (one minute) each rung of the ladder spans. */
export const TIMEFRAME_BASE_UNITS: Record<TimeframeId, number> = {
  '1m': 1,
  '3m': 3,
  '5m': 5,
  '15m': 15,
  '30m': 30,
  '1H': 60,
  '4H': 240,
  '6H': 360,
  '7H': 420,
  '2D': 2880,
  '1W': 10080,
  '1M': 43200,
};

/** How a pane maps onto the chart's shared clock. */
export type ClockBinding =
  /** Follow the reference series' own bars. */
  | { kind: 'reference' }
  /** Explicit authored offset (logical time only). */
  | { kind: 'offset'; offsetBars: number }
  /** Real market time (requires a UTC series). */
  | { kind: 'utc' };

/** The shared market-time mapping for a chart's panes. */
export interface MarketClock {
  id: string;
  /** 'logical' until a UTC importer exists. */
  unit: 'logical' | 'utc';
  /** Reference series for a logical clock. */
  referenceSeriesId: string;
  /** Bars per clock step. */
  stepBars: number;
  /**
   * Video frames one clock step lasts.
   *
   * The clock's pace, and therefore how long a candle takes to form. It is
   * data rather than a constant so a creator can slow the market down or
   * hurry it along — a chart showing one daily candle per second is a
   * different animation from one showing twenty.
   */
  framesPerStep: number;
  /** Author-supplied offsets, keyed by series id, for panes on other series. */
  offsets?: Record<string, number>;
}

/** Price scale policy. 'auto' = revealed bars only (no leakage). */
export type PriceRangePolicy = { mode: 'auto' } | { mode: 'fixed'; min: number; max: number };

/** Pause point: hold the pane on one candle. */
export interface PaneHold {
  barId: string;
  in: number;
  out: number;
}

/** Camera zoom track, used by the HTF->LTF zoom element. */
export interface ZoomTrack {
  /** Frame ranges relative to the chart clip. */
  segments: Array<{
    in: number;
    out: number;
    from: { aggregation: number; fromBar: number };
    to: { aggregation: number; fromBar: number };
    curve?: Curve;
  }>;
}

/** Colours of a chart. */
export interface ChartStyle {
  backgroundColor?: string;
  upColor?: string;
  downColor?: string;
  wickColor?: string;
  /** Grid. */
  showGrid?: boolean;
  gridColor?: string;
  /** Axis. */
  showPriceAxis?: boolean;
  axisColor?: string;
  axisLabelColor?: string;
}

/** Colours of one pane. Overrides the chart's own style. */
export interface PaneStyle {
  upColor?: string;
  downColor?: string;
  wickColor?: string;
  showGrid?: boolean;
  gridColor?: string;
  showPriceAxis?: boolean;
  axisColor?: string;
  axisLabelColor?: string;
}

/** A candle pane: one series, one viewport, one clock binding. */
export interface PaneSpec {
  id: ElementId;
  name: string;
  seriesId: string;
  /** The rung of the ladder this pane displays. */
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
  /** Price scale policy. */
  priceRange: PriceRangePolicy;
  viewport?: { fromBar: number; barCount: number };
  /** Pause points: hold the pane on one candle. */
  holds?: PaneHold[];
  /** Camera zoom track. */
  zoom?: ZoomTrack;
  style?: PaneStyle;
}

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

/**
 * The drawing tools the product offers.
 *
 * A drawing of this model is pure geometry: its own box, its own points and
 * its own caption. It never names a market value.
 */
export type DrawingKind =
  | 'horizontalLine'
  | 'verticalLine'
  | 'trendline'
  | 'highLowLine'
  | 'rectangle'
  | 'textLabel'
  | 'arrow'
  | 'position';

/** Every drawing kind, in the order the tools offer them. */
export const INDEPENDENT_DRAWING_KINDS: readonly DrawingKind[] = [
  'horizontalLine',
  'verticalLine',
  'trendline',
  'highLowLine',
  'rectangle',
  'textLabel',
  'arrow',
  'position',
];

/** A point inside a drawing's own box, as a 0..1 fraction. Origin top-left, y down. */
export interface DrawingPoint { x: number; y: number; }

/** The colours and weights a drawing carries. */
export interface DrawingStyle {
  color?: string;
  lineWidth?: number;
  /** Fill opacity of a rectangle or a band. */
  fillOpacity?: number;
  fontSize?: number;
}

/** The props every independent drawing carries. */
export interface IndependentDrawingProps {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  opacity?: number;
  style?: DrawingStyle;
  /** The creator's own figure, drawn beside the shape. */
  caption?: string;
  /** Per-kind points, as 0..1 fractions of the box. */
  points?: Record<string, DrawingPoint>;
  /** The position tool's direction and its ratio toggle. */
  position?: {
    direction: 'long' | 'short';
    showRiskReward?: boolean;
  };
  label?: { text?: string };
  trendline?: { ray?: 'none' | 'left' | 'right' | 'both' };
}

/**
 * The persisted props of a candlestick chart clip (schema v2).
 *
 * Named for the document, not the render: the component's own render props
 * live in the components package and carry the pixel-level settings.
 */
export interface ChartProps {
  /** The series a new pane starts from. */
  seriesId: string;
  panes: PaneSpec[];
  /** The shared market-time mapping for this chart's panes. */
  clock: MarketClock;
  /** Chart-level default curve, overridden per element. */
  curve?: Curve;
  style: ChartStyle;
  /** Declared relations between the chart's panes. */
  relations?: PaneRelation[];
}

/** The scene-level container for the split layouts. */
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
