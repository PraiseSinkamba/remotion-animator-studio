/**
 * Custom inspector panel for the Candlestick Chart component.
 *
 * The generated params cover the presentation props; this panel edits the
 * *series* — the bar table, the synthetic generator and the clip length.
 *
 * Every discrete edit pushes an undo snapshot (`commit()`) before it changes
 * anything, so one undo step reverts one edit.
 */
import React from 'react';
import type { ComponentInspectorContext } from '../registry/types';
import { barsToFrames, generateSyntheticBars, type OhlcBar } from './ohlc';

/** `'5m'` -> 300000. Unknown timeframes fall back to one minute. */
const timeframeToMs = (timeframe: string): number => {
  const match = /^(\d+)\s*([smhdw])$/i.exec(String(timeframe).trim());
  if (!match) return 60_000;
  const factors: Record<string, number> = {
    s: 1000,
    m: 60_000,
    h: 3_600_000,
    d: 86_400_000,
    w: 604_800_000,
  };
  return Number(match[1]) * factors[match[2].toLowerCase()];
};

const FIELDS = ['o', 'h', 'l', 'c'] as const;

export const CandlestickChartInspector: React.FC<ComponentInspectorContext> = ({
  clip,
  props,
  onChange,
  updateClip,
  commit,
}) => {
  const bars: OhlcBar[] = Array.isArray(props.bars) ? props.bars : [];
  const framesPerBar = Number(props.framesPerBar) || 1;
  const needed = barsToFrames(bars, framesPerBar);

  const [seed, setSeed] = React.useState(String(props.simulationSeed ?? 'chart-1'));
  const [count, setCount] = React.useState(String(bars.length || 12));
  const [startPrice, setStartPrice] = React.useState(String(bars[0]?.o ?? 100));

  const edit = (patch: Record<string, unknown>) => {
    commit();
    onChange(patch);
  };

  /** Edit one OHLC cell and keep the bar valid: h >= max(o, c), l <= min(o, c). */
  const editBar = (index: number, field: (typeof FIELDS)[number], raw: string) => {
    const value = Number(raw);
    if (!Number.isFinite(value)) return;
    const next = bars.map((bar, i) => (i === index ? { ...bar, [field]: value } : bar));
    const edited = next[index];
    edited.h = Math.max(edited.h, edited.o, edited.c);
    edited.l = Math.min(edited.l, edited.o, edited.c);
    edit({ bars: next, dataSource: 'manual' });
  };

  const addBar = () => {
    const last = bars[bars.length - 1];
    const price = last ? last.c : 100;
    const t = last ? last.t + timeframeToMs(String(props.timeframe ?? '5m')) : 0;
    edit({
      bars: [...bars, { t, o: price, h: price, l: price, c: price }],
      dataSource: 'manual',
    });
  };

  const removeBar = (index: number) => {
    edit({ bars: bars.filter((_, i) => i !== index), dataSource: 'manual' });
  };

  const generate = () => {
    const generated = generateSyntheticBars({
      count: Math.max(1, Math.floor(Number(count) || 0)),
      startPrice: Number(startPrice) || 1,
      seed,
      timeframeMs: timeframeToMs(String(props.timeframe ?? '5m')),
    });
    edit({ bars: generated, dataSource: 'synthetic' });
  };

  return (
    <div className="chart-inspector">
      <div className="section-title">Series</div>

      <div className="param-row">
        <label>Data source</label>
        <select
          aria-label="Data source"
          value={String(props.dataSource ?? 'manual')}
          onChange={(e) => edit({ dataSource: e.target.value })}
        >
          <option value="manual">Manual</option>
          <option value="synthetic">Synthetic</option>
        </select>
      </div>

      <table className="chart-table">
        <thead>
          <tr>
            <th>#</th>
            <th>O</th>
            <th>H</th>
            <th>L</th>
            <th>C</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {bars.map((bar, index) => (
            <tr key={index} data-testid="chart-bar-row">
              <td className="chart-table-index">{index + 1}</td>
              {FIELDS.map((field) => (
                <td key={field}>
                  <input
                    type="number"
                    step={0.01}
                    aria-label={`bar ${index + 1} ${field.toUpperCase()}`}
                    value={bar[field]}
                    onChange={(e) => editBar(index, field, e.target.value)}
                  />
                </td>
              ))}
              <td className="chart-table-remove">
                <button
                  className="btn btn-small"
                  aria-label={`Remove bar ${index + 1}`}
                  title="Remove bar"
                  onClick={() => removeBar(index)}
                >
                  ✕
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="chart-buttons">
        <button className="btn btn-small" onClick={addBar}>
          + Add bar
        </button>
      </div>

      <div className="section-title">Synthetic generator</div>
      <div className="param-row">
        <label>Seed</label>
        <input type="text" aria-label="Generator seed" value={seed} onChange={(e) => setSeed(e.target.value)} />
      </div>
      <div className="param-row">
        <label>Bar count</label>
        <input
          type="number"
          min={1}
          aria-label="Generator bar count"
          value={count}
          onChange={(e) => setCount(e.target.value)}
        />
      </div>
      <div className="param-row">
        <label>Start price</label>
        <input
          type="number"
          step={0.01}
          aria-label="Generator start price"
          value={startPrice}
          onChange={(e) => setStartPrice(e.target.value)}
        />
      </div>
      <button className="btn btn-small" onClick={generate}>
        ⟳ Generate
      </button>

      <div className="section-title">Length</div>
      <div className="chart-length-hint">
        {bars.length} bars × {framesPerBar} frames = {needed} frames needed · clip is{' '}
        {clip.durationInFrames} frames
      </div>
      <button
        className="btn btn-small"
        disabled={needed < 1}
        onClick={() => {
          if (needed < 1) return;
          commit();
          updateClip({ durationInFrames: needed });
        }}
      >
        Fit clip length to bars
      </button>
    </div>
  );
};
