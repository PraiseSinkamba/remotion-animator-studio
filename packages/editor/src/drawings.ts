/**
 * The drawing tools, and how a click on the canvas becomes a market anchor.
 *
 * A drawing names the market, never a pixel: the anchors here are prices,
 * bars and sides, and they resolve against the pane's scale at render time.
 */
import type { ChartPaneEvaluation, CandlestickChartProps } from '@chart-studio/components';
import type { Clip, DrawingKind, MarketAnchor, PaneSpec } from '@chart-studio/core';

/** One of the drawing tools, and how many clicks it takes to place it. */
export interface DrawingTool {
  kind: DrawingKind;
  label: string;
  icon: string;
  /** How many clicks the creator makes: the first click starts the drawing. */
  clicks: number;
}

/** The drawing tools the editor offers, in the order the rail shows them. */
export const DRAWING_TOOLS: DrawingTool[] = [
  { kind: 'priceLine', label: 'Price Line', icon: '─', clicks: 1 },
  { kind: 'highLowLine', label: 'High/Low Line', icon: '↕', clicks: 1 },
  { kind: 'verticalLine', label: 'Vertical Line', icon: '│', clicks: 1 },
  { kind: 'trendline', label: 'Trendline', icon: '╱', clicks: 2 },
  { kind: 'priceZone', label: 'Price Zone', icon: '▬', clicks: 2 },
  { kind: 'textLabel', label: 'Text Label', icon: 'T', clicks: 1 },
  { kind: 'arrow', label: 'Arrow', icon: '→', clicks: 2 },
  { kind: 'position', label: 'Position', icon: '⇅', clicks: 3 },
];

/** What one click on the canvas gives the tool. */
export interface DrawingPick {
  /** The slot the pointer was over, in the pane's own bar order. */
  barIndex: number;
  /** The price under the pointer. */
  price: number;
}

/** True when the element type is one of the drawing tools. */
export const isDrawingKind = (type: string): type is DrawingKind =>
  DRAWING_TOOLS.some((tool) => tool.kind === type);

/**
 * The id of the bar in a slot.
 *
 * The ids are the ones `materialiseSeries` stamps: a pane that shows the
 * source bars unchanged carries the source bar's id, and a pane that buckets
 * them carries the bucket's id (`${pane.id}:${bucket}`). An anchor that names a
 * bar the pane has not revealed yet simply stays unresolved until it is.
 */
export const drawingBarId = (pane: PaneSpec, slot: number): string => {
  const factor = Math.max(1, Math.floor(pane.aggregation?.factor ?? 1));
  if (factor === 1) return `${pane.seriesId}:${slot}`;
  return `${pane.id}:${slot}`;
};

/**
 * Builds the anchors of a drawing from the clicks that placed it.
 *
 * Each tool names its own anchors; a tool that takes one click produces one
 * anchor, and a tool that takes several produces one per click. The anchors
 * are market facts, so a drawing drawn at a price stays at that price when the
 * chart is resized.
 */
export const buildDrawingAnchors = (
  kind: DrawingKind,
  picks: DrawingPick[],
  pane: PaneSpec,
): Record<string, MarketAnchor> => {
  const barId = (pick: DrawingPick) => drawingBarId(pane, pick.barIndex);

  switch (kind) {
    case 'priceLine':
      return { price: { kind: 'price', price: picks[0].price } };
    case 'highLowLine':
      return {
        high: { kind: 'candle', barId: barId(picks[0]), side: 'high' },
        low: { kind: 'candle', barId: barId(picks[0]), side: 'low' },
      };
    case 'verticalLine':
      return { bar: { kind: 'time', barId: barId(picks[0]) } };
    case 'trendline':
      return {
        start: { kind: 'point', barId: barId(picks[0]), price: picks[0].price },
        end: { kind: 'point', barId: barId(picks[1]), price: picks[1].price },
      };
    case 'priceZone': {
      // The top of the band is the higher of the two clicks, so the creator
      // can drag either way and the zone still reads as a zone.
      const top = Math.max(picks[0].price, picks[1].price);
      const bottom = Math.min(picks[0].price, picks[1].price);
      return {
        top: { kind: 'price', price: top },
        bottom: { kind: 'price', price: bottom },
      };
    }
    case 'textLabel':
      return { at: { kind: 'point', barId: barId(picks[0]), price: picks[0].price } };
    case 'arrow':
      return {
        from: { kind: 'point', barId: barId(picks[0]), price: picks[0].price },
        to: { kind: 'point', barId: barId(picks[1]), price: picks[1].price },
      };
    case 'position':
      return {
        entry: { kind: 'price', price: picks[0].price },
        stop: { kind: 'price', price: picks[1].price },
        target: { kind: 'price', price: picks[2].price },
      };
  }
};

/**
 * The chart and the pane a drawing would land on.
 */
export interface DrawingTarget {
  /** The chart clip, with the market it needs to resolve against. */
  chart: Clip;
  /** The pane the anchors resolve against. */
  paneId: string;
  /** That pane's state at the current frame. */
  pane: ChartPaneEvaluation;
  /** The chart's props, for the geometry the anchors are measured in. */
  props: CandlestickChartProps;
}
