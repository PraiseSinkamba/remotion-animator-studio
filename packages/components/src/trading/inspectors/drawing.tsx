/**
 * The inspector for the independent drawing tools.
 *
 * One panel serves all eight kinds: it edits the **caption** — a text field
 * on every kind — the style, and the per-kind extras (the label's text, the
 * position tool's direction and its risk/reward label).
 *
 * There is no number field for a price or for the position tool's levels,
 * because there are no numbers: a drawing holds no market value. The levels
 * are dragged on the canvas.
 *
 * The panel writes through `onChange` with the same commit-first discipline
 * the current panel uses.
 */
import React from 'react';
import type { ComponentInspectorContext, DrawingKind } from '@chart-studio/core';

interface DrawingOption {
  key: string;
  label: string;
  kind: 'text' | 'boolean' | 'select';
  options?: string[];
}

/** The per-kind extras this panel edits. */
const KIND_OPTIONS: Record<DrawingKind, DrawingOption[]> = {
  horizontalLine: [],
  verticalLine: [],
  trendline: [],
  rectangle: [],
  arrow: [],
  position: [
    { key: 'direction', label: 'Direction', kind: 'select', options: ['long', 'short'] },
    { key: 'showRiskReward', label: 'Risk/reward', kind: 'boolean' },
  ],
};

export const DrawingInspector: React.FC<ComponentInspectorContext> = ({
  clip,
  props,
  onChange,
  commit,
}) => {
  const kind = clip.element as DrawingKind;
  const style = (props.style ?? {}) as Record<string, unknown>;
  const options = KIND_OPTIONS[kind] ?? [];

  const editStyle = (key: string, value: string | number) => {
    commit();
    onChange({ style: { ...style, [key]: value } });
  };

  const editOption = (option: DrawingOption, value: string | boolean) => {
    commit();
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

  return (
    <div className="chart-inspector">
      <div className="section-title">Caption</div>
      <div className="param-row">
        <label>Caption</label>
        <input
          type="text"
          aria-label="Drawing caption"
          value={String(props.caption ?? '')}
          onChange={(event) => {
            commit();
            onChange({ caption: event.target.value });
          }}
        />
      </div>

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
      <div className="param-row">
        <label>Fill opacity</label>
        <input
          type="number"
          step={0.05}
          min={0}
          max={1}
          aria-label="Drawing fill opacity"
          value={Number(style.fillOpacity ?? 0.16)}
          onChange={(event) => editStyle('fillOpacity', Number(event.target.value))}
        />
      </div>
      <div className="param-row">
        <label>Font size</label>
        <input
          type="number"
          step={1}
          min={6}
          max={96}
          aria-label="Drawing font size"
          value={Number(style.fontSize ?? 12)}
          onChange={(event) => editStyle('fontSize', Number(event.target.value))}
        />
      </div>

      {options.map((option) => {
        const source =
          option.key === 'text' ? (props.label ?? {}) : (props.position ?? {});
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
