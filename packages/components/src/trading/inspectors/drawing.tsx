/**
 * The numeric inspector for the market-linked drawing tools.
 *
 * One panel serves all eight kinds: it edits the *numbers* a drawing carries —
 * the price of each anchor that has one — plus the per-kind extras (the label
 * text, the zone's extend-right flag, the position's direction and its
 * risk/reward label).
 *
 * The anchors are the source of truth. This panel replaces the whole `anchors`
 * object on every edit, because the store merges props one level deep and the
 * anchors live one level down.
 *
 * The bar an anchor names is not editable here: a bar is a market fact, and
 * the canvas handles are where a bar is chosen.
 */
import React from 'react';
import type { ComponentInspectorContext, DrawingKind, MarketAnchor } from '@chart-studio/core';

interface DrawingOption {
  key: string;
  label: string;
  kind: 'text' | 'boolean' | 'select';
  options?: string[];
}

/** The per-kind extras this panel edits. */
const KIND_OPTIONS: Record<DrawingKind, DrawingOption[]> = {
  priceLine: [],
  highLowLine: [],
  verticalLine: [],
  trendline: [{ key: 'ray', label: 'Ray', kind: 'select', options: ['none', 'left', 'right', 'both'] }],
  priceZone: [{ key: 'extendRight', label: 'Extend right', kind: 'boolean' }],
  textLabel: [{ key: 'text', label: 'Text', kind: 'text' }],
  arrow: [],
  position: [
    { key: 'direction', label: 'Direction', kind: 'select', options: ['long', 'short'] },
    { key: 'showRiskReward', label: 'Risk/reward', kind: 'boolean' },
  ],
};

/** The anchors that carry a level: an explicit price, or a price at a bar. */
type PriceAnchor =
  | { kind: 'price'; price: number }
  | { kind: 'point'; barId: string; price: number };

const isPriceAnchor = (anchor: MarketAnchor): anchor is PriceAnchor =>
  anchor.kind === 'price' || anchor.kind === 'point';

/** The anchor's price, or null when it names a bar rather than a level. */
const anchorPrice = (anchor: MarketAnchor): number | null =>
  isPriceAnchor(anchor) ? anchor.price : null;

/** The bar an anchor names, or null when it carries a level instead. */
const anchorBarId = (anchor: MarketAnchor): string | null =>
  'barId' in anchor ? anchor.barId : null;

export const DrawingInspector: React.FC<ComponentInspectorContext> = ({
  clip,
  props,
  onChange,
  commit,
}) => {
  const kind = clip.element as DrawingKind;
  const anchors = (props.anchors ?? {}) as Record<string, MarketAnchor>;
  const style = (props.style ?? {}) as Record<string, unknown>;
  const options = KIND_OPTIONS[kind] ?? [];

  const editAnchors = (next: Record<string, MarketAnchor>) => {
    commit();
    onChange({ anchors: next });
  };

  const editPrice = (key: string, raw: string) => {
    const value = Number(raw);
    if (!Number.isFinite(value)) return;
    const anchor = anchors[key];
    if (!anchor || !isPriceAnchor(anchor)) return;
    editAnchors({ ...anchors, [key]: { ...anchor, price: value } });
  };

  const editStyle = (key: string, value: string | number) => {
    commit();
    onChange({ style: { ...style, [key]: value } });
  };

  const editOption = (option: DrawingOption, value: string | boolean) => {
    commit();
    if (option.key === 'extendRight') {
      onChange({ zone: { ...(props.zone ?? {}), extendRight: Boolean(value) } });
      return;
    }
    if (option.key === 'ray') {
      onChange({ trendline: { ...(props.trendline ?? {}), ray: String(value) } });
      return;
    }
    if (option.key === 'text') {
      onChange({ label: { ...(props.label ?? {}), text: String(value) } });
      return;
    }
    if (option.key === 'direction') {
      onChange({ position: { ...(props.position ?? {}), direction: String(value) } });
      return;
    }
    onChange({ position: { ...(props.position ?? {}), showRiskReward: Boolean(value) } });
  };

  const priceKeys = Object.keys(anchors).filter((key) => anchorPrice(anchors[key]) !== null);
  const barKeys = Object.keys(anchors).filter((key) => anchorPrice(anchors[key]) === null);

  return (
    <div className="chart-inspector">
      <div className="section-title">Anchors</div>
      {priceKeys.length === 0 && barKeys.length === 0 ? (
        <div className="chart-length-hint">No anchors yet — draw on the chart.</div>
      ) : null}

      {priceKeys.map((key) => (
        <div className="param-row" key={key}>
          <label>{key}</label>
          <input
            type="number"
            step={0.01}
            aria-label={`${key} price`}
            value={anchorPrice(anchors[key]) ?? 0}
            onChange={(event) => editPrice(key, event.target.value)}
          />
        </div>
      ))}

      {barKeys.map((key) => (
        <div className="param-row" key={key}>
          <label>{key}</label>
          <span className="chart-length-hint">{anchorBarId(anchors[key])}</span>
        </div>
      ))}

      <div className="section-title">Style</div>
      <div className="param-row">
        <label>Colour</label>
        <input
          type="text"
          aria-label="Drawing colour"
          value={String(style.color ?? '#e8eaf0')}
          onChange={(event) => editStyle('color', event.target.value)}
        />
      </div>
      <div className="param-row">
        <label>Line width</label>
        <input
          type="number"
          step={0.5}
          min={0.5}
          aria-label="Drawing line width"
          value={Number(style.lineWidth ?? 1.5)}
          onChange={(event) => editStyle('lineWidth', Number(event.target.value))}
        />
      </div>

      {options.map((option) => {
        const source =
          option.key === 'extendRight'
            ? (props.zone ?? {})
            : option.key === 'ray'
              ? (props.trendline ?? {})
              : option.key === 'text'
                ? (props.label ?? {})
                : (props.position ?? {});
        const value = (source as Record<string, unknown>)[option.key];
        return (
          <div className="param-row" key={option.key}>
            <label>{option.label}</label>
            {option.kind === 'select' ? (
              <select
                aria-label={option.label}
                value={String(value ?? option.options?.[0] ?? '')}
                onChange={(event) => editOption(option, event.target.value)}
              >
                {(option.options ?? []).map((entry) => (
                  <option key={entry} value={entry}>
                    {entry}
                  </option>
                ))}
              </select>
            ) : option.kind === 'boolean' ? (
              <input
                type="checkbox"
                aria-label={option.label}
                checked={Boolean(value)}
                onChange={(event) => editOption(option, event.target.checked)}
              />
            ) : (
              <input
                type="text"
                aria-label={option.label}
                value={String(value ?? '')}
                onChange={(event) => editOption(option, event.target.value)}
              />
            )}
          </div>
        );
      })}
    </div>
  );
};
