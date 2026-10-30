/**
 * Anchor resolution for the market-linked drawing tools.
 *
 * A drawing never stores a pixel. It names the chart clip it belongs to, the
 * pane inside it, and a set of *market anchors* — a price, a bar and a side, a
 * bar and a time, a bar and a price. This module turns those anchors into
 * positions in the chart's own box, against the pane's *current* scale, so a
 * price line keeps its price when the chart is resized or re-scaled.
 *
 * The one rule that is not negotiable: a drawing must never reveal a future
 * price. An anchor that names a bar the pane has not revealed yet resolves to
 * `null`, and a drawing with an unresolved anchor draws nothing at all.
 *
 * Pure: no React, no Remotion, no DOM.
 */
import type { DrawingKind, MarketAnchor } from '@chart-studio/core';
import { priceToY, type ChartGeometry } from '../chart';

/**
 * The anchors each drawing kind requires.
 *
 * One list, shared by the renderer and the editor: the editor creates exactly
 * these anchors and the renderer hides the drawing when one of them is
 * missing or unresolved.
 */
export const REQUIRED_ANCHORS: Record<DrawingKind, readonly string[]> = {
  priceLine: ['price'],
  highLowLine: ['high', 'low'],
  verticalLine: ['bar'],
  trendline: ['start', 'end'],
  priceZone: ['top', 'bottom'],
  textLabel: ['at'],
  arrow: ['from', 'to'],
  position: ['entry', 'stop', 'target'],
};

/** A resolved position in the chart's own box coordinates. */
export interface ResolvedAnchor {
  x: number;
  y: number;
}

/** Resolved anchors in the chart's own box coordinates; null where an anchor is not yet revealed. */
export type ResolvedAnchors = Record<string, ResolvedAnchor | null>;

/** The bar facts an anchor can name. */
export interface AnchorBar {
  /** The bar's stable id. */
  id: string;
  /** The bar's high as revealed so far. */
  high: number;
  /** The bar's low as revealed so far. */
  low: number;
  /** The bar's close as revealed so far. */
  close: number;
}

/** What the resolution needs to know about the pane. */
export interface AnchorContext {
  /** The pane's revealed bars, in slot order. */
  bars: readonly AnchorBar[];
  /** The pane's plot geometry, in the chart's own box coordinates. */
  geometry: ChartGeometry;
  /** The pane's current price range, from the revealed bars only. */
  range: { min: number; max: number };
}

/**
 * The x of a bar's slot centre.
 *
 * The slot is layout, not market data: it is derived from the pane's authored
 * bar count, so revealing a bar never moves the others.
 */
const slotCentre = (geometry: ChartGeometry, index: number): number =>
  geometry.plotLeft + (index + 0.5) * geometry.slotWidth;

/** The index of a revealed bar, or -1 when the bar has not been revealed. */
const revealedIndex = (bars: readonly AnchorBar[], barId: string): number =>
  bars.findIndex((bar) => bar.id === barId);

/**
 * Resolves one anchor against the pane's current scale.
 *
 * Returns `null` when the anchor names a bar the pane has not revealed yet.
 */
export const resolveAnchor = (
  anchor: MarketAnchor,
  context: AnchorContext,
): ResolvedAnchor | null => {
  const { bars, geometry, range } = context;

  if (anchor.kind === 'price') {
    return {
      x: geometry.plotLeft,
      y: priceToY(anchor.price, range.min, range.max, geometry),
    };
  }

  const index = revealedIndex(bars, anchor.barId);
  if (index < 0) return null;
  const x = slotCentre(geometry, index);

  if (anchor.kind === 'time') {
    return { x, y: (geometry.plotTop + geometry.plotBottom) / 2 };
  }

  if (anchor.kind === 'point') {
    return { x, y: priceToY(anchor.price, range.min, range.max, geometry) };
  }

  const bar = bars[index];
  const price =
    anchor.side === 'high' ? bar.high : anchor.side === 'low' ? bar.low : bar.close;
  return { x, y: priceToY(price, range.min, range.max, geometry) };
};

/** Resolves every anchor of a drawing. */
export const resolveAnchors = (
  anchors: Record<string, MarketAnchor>,
  context: AnchorContext,
): ResolvedAnchors => {
  const resolved: ResolvedAnchors = {};
  for (const [key, anchor] of Object.entries(anchors)) {
    resolved[key] = resolveAnchor(anchor, context);
  }
  return resolved;
};

/**
 * Whether a drawing may draw.
 *
 * A drawing draws when every anchor it declares resolved and every anchor it
 * requires is present. An anchor that resolved to `null` means the drawing
 * would have to reveal a price the chart has not shown yet, so the whole
 * drawing stays hidden.
 */
export const canDraw = (
  resolved: ResolvedAnchors,
  required: readonly string[],
): boolean =>
  required.every((key) => resolved[key] != null) &&
  Object.values(resolved).every((anchor) => anchor != null);
