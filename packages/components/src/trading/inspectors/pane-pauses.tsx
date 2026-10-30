/**
 * The pause-point panel and the camera zoom panel of the chart inspector.
 *
 * A hold freezes a pane on one candle for a frame range, relative to the
 * chart clip: the pane shows its last-known values and the market does not
 * advance. A zoom track moves the pane's viewport — the aggregation and the
 * bar range — across a frame range; it never touches a price.
 *
 * Every discrete edit commits first, so one undo step reverts one edit.
 */
import React from 'react';
import {
  PRESET_CONTROL_POINTS,
  type CurvePreset,
  type OhlcBar,
  type PaneSpec,
  type ZoomTrack,
} from '@chart-studio/core';

/** The curves a segment can be shaped with. */
const PRESETS = Object.keys(PRESET_CONTROL_POINTS) as CurvePreset[];

export interface PanePausePanelProps {
  panes: readonly PaneSpec[];
  /** The chart's own bars, so a hold can name a candle. */
  bars: readonly OhlcBar[];
  /** The chart clip's length, so a new hold covers a real range. */
  durationInFrames: number;
  onChange: (patch: Record<string, unknown>) => void;
  commit: () => void;
}

/**
 * The pause points of every pane.
 *
 * A hold is identified by the candle it holds, so a pane holds each candle
 * once: adding a hold on a candle that is already held replaces it.
 */
export const PaneHoldPanel: React.FC<PanePausePanelProps> = ({
  panes,
  bars,
  durationInFrames,
  onChange,
  commit,
}) => {
  const edit = (patch: Record<string, unknown>) => {
    commit();
    onChange(patch);
  };

  const setPane = (pane: PaneSpec, change: (pane: PaneSpec) => PaneSpec) =>
    edit({ panes: panes.map((entry) => (entry.id === pane.id ? change(entry) : entry)) });

  const addHold = (pane: PaneSpec) => {
    const barId = bars[bars.length - 1]?.id ?? '';
    const out = Math.max(1, Math.floor(durationInFrames / 2));
    setPane(pane, (entry) => ({
      ...entry,
      holds: [
        ...(entry.holds ?? []).filter((hold) => hold.barId !== barId),
        { barId, in: 0, out },
      ],
    }));
  };

  const updateHold = (
    pane: PaneSpec,
    barId: string,
    patch: Partial<{ barId: string; in: number; out: number }>,
  ) =>
    setPane(pane, (entry) => ({
      ...entry,
      holds: (entry.holds ?? []).map((hold) =>
        hold.barId === barId ? { ...hold, ...patch } : hold,
      ),
    }));

  const removeHold = (pane: PaneSpec, barId: string) =>
    setPane(pane, (entry) => ({
      ...entry,
      holds: (entry.holds ?? []).filter((hold) => hold.barId !== barId),
    }));

  return (
    <div className="chart-inspector">
      <div className="section-title">Pause points</div>

      {panes.map((pane, paneIndex) => (
        <div key={pane.id} data-testid="pane-holds" data-pane={pane.id}>
          {(pane.holds ?? []).map((hold, holdIndex) => (
            <div key={hold.barId} data-testid="hold-row">
              <div className="param-row">
                <label>Candle</label>
                <input
                  type="text"
                  aria-label={`Pane ${paneIndex + 1} hold ${holdIndex + 1} candle`}
                  value={hold.barId}
                  onChange={(e) => updateHold(pane, hold.barId, { barId: e.target.value })}
                />
                <input
                  type="number"
                  step={1}
                  aria-label={`Pane ${paneIndex + 1} hold ${holdIndex + 1} in frame`}
                  value={hold.in}
                  onChange={(e) => updateHold(pane, hold.barId, { in: Number(e.target.value) })}
                />
                <input
                  type="number"
                  step={1}
                  aria-label={`Pane ${paneIndex + 1} hold ${holdIndex + 1} out frame`}
                  value={hold.out}
                  onChange={(e) => updateHold(pane, hold.barId, { out: Number(e.target.value) })}
                />
                <button
                  className="btn btn-small"
                  aria-label={`Remove hold ${holdIndex + 1} of pane ${paneIndex + 1}`}
                  onClick={() => removeHold(pane, hold.barId)}
                >
                  ✕
                </button>
              </div>
            </div>
          ))}

          <div className="chart-buttons">
            <button className="btn btn-small" onClick={() => addHold(pane)}>
              + Hold on the last candle
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

/**
 * The camera zoom track of every pane.
 *
 * A segment moves the pane from one aggregation and bar range to another
 * across a frame range, shaped by an optional curve.
 */
export const PaneZoomPanel: React.FC<PanePausePanelProps> = ({
  panes,
  durationInFrames,
  onChange,
  commit,
}) => {
  const edit = (patch: Record<string, unknown>) => {
    commit();
    onChange(patch);
  };

  const setPane = (pane: PaneSpec, change: (pane: PaneSpec) => PaneSpec) =>
    edit({ panes: panes.map((entry) => (entry.id === pane.id ? change(entry) : entry)) });

  const addSegment = (pane: PaneSpec) => {
    const aggregation = Math.max(1, Math.floor(pane.aggregation?.factor ?? 1));
    const segment = {
      in: 0,
      out: Math.max(1, Math.floor(durationInFrames)),
      from: { aggregation, fromBar: 0 },
      to: { aggregation, fromBar: 0 },
    };
    setPane(pane, (entry) => ({
      ...entry,
      zoom: { segments: [...(entry.zoom?.segments ?? []), segment] },
    }));
  };

  const updateSegment = (
    pane: PaneSpec,
    index: number,
    patch: Partial<ZoomTrack['segments'][number]>,
  ) =>
    setPane(pane, (entry) => ({
      ...entry,
      zoom: {
        segments: (entry.zoom?.segments ?? []).map((segment, position) =>
          position === index ? { ...segment, ...patch } : segment,
        ),
      },
    }));

  const updateSide = (
    pane: PaneSpec,
    index: number,
    side: 'from' | 'to',
    patch: Partial<{ aggregation: number; fromBar: number }>,
  ) =>
    setPane(pane, (entry) => ({
      ...entry,
      zoom: {
        segments: (entry.zoom?.segments ?? []).map((segment, position) =>
          position === index ? { ...segment, [side]: { ...segment[side], ...patch } } : segment,
        ),
      },
    }));

  const removeSegment = (pane: PaneSpec, index: number) =>
    setPane(pane, (entry) => ({
      ...entry,
      zoom: {
        segments: (entry.zoom?.segments ?? []).filter((_, position) => position !== index),
      },
    }));

  const setCurve = (pane: PaneSpec, index: number, value: string) =>
    setPane(pane, (entry) => ({
      ...entry,
      zoom: {
        segments: (entry.zoom?.segments ?? []).map((segment, position) => {
          if (position !== index) return segment;
          if (value === '') {
            const { curve: _dropped, ...rest } = segment;
            return rest;
          }
          if (value === 'custom') return segment;
          return { ...segment, curve: { kind: 'preset' as const, name: value as CurvePreset } };
        }),
      },
    }));

  return (
    <div className="chart-inspector">
      <div className="section-title">Camera zoom</div>

      {panes.map((pane, paneIndex) => (
        <div key={pane.id} data-testid="pane-zoom" data-pane={pane.id}>
          {(pane.zoom?.segments ?? []).map((segment, index) => (
            <div key={index} data-testid="zoom-segment">
              <div className="param-row">
                <label>In</label>
                <input
                  type="number"
                  step={1}
                  aria-label={`Pane ${paneIndex + 1} zoom ${index + 1} in frame`}
                  value={segment.in}
                  onChange={(e) => updateSegment(pane, index, { in: Number(e.target.value) })}
                />
                <input
                  type="number"
                  step={1}
                  aria-label={`Pane ${paneIndex + 1} zoom ${index + 1} out frame`}
                  value={segment.out}
                  onChange={(e) => updateSegment(pane, index, { out: Number(e.target.value) })}
                />
                <button
                  className="btn btn-small"
                  aria-label={`Remove zoom segment ${index + 1} of pane ${paneIndex + 1}`}
                  onClick={() => removeSegment(pane, index)}
                >
                  ✕
                </button>
              </div>

              <div className="param-row">
                <label>From</label>
                <input
                  type="number"
                  step={1}
                  min={1}
                  aria-label={`Pane ${paneIndex + 1} zoom ${index + 1} from aggregation`}
                  value={segment.from.aggregation}
                  onChange={(e) =>
                    updateSide(pane, index, 'from', { aggregation: Number(e.target.value) })
                  }
                />
                <input
                  type="number"
                  step={1}
                  min={0}
                  aria-label={`Pane ${paneIndex + 1} zoom ${index + 1} from bar`}
                  value={segment.from.fromBar}
                  onChange={(e) =>
                    updateSide(pane, index, 'from', { fromBar: Number(e.target.value) })
                  }
                />
                <input
                  type="number"
                  step={1}
                  min={1}
                  aria-label={`Pane ${paneIndex + 1} zoom ${index + 1} to aggregation`}
                  value={segment.to.aggregation}
                  onChange={(e) =>
                    updateSide(pane, index, 'to', { aggregation: Number(e.target.value) })
                  }
                />
                <input
                  type="number"
                  step={1}
                  min={0}
                  aria-label={`Pane ${paneIndex + 1} zoom ${index + 1} to bar`}
                  value={segment.to.fromBar}
                  onChange={(e) =>
                    updateSide(pane, index, 'to', { fromBar: Number(e.target.value) })
                  }
                />
                <select
                  aria-label={`Pane ${paneIndex + 1} zoom ${index + 1} curve`}
                  value={
                    segment.curve
                      ? segment.curve.kind === 'preset'
                        ? segment.curve.name
                        : 'custom'
                      : ''
                  }
                  onChange={(e) => setCurve(pane, index, e.target.value)}
                >
                  <option value="">no curve</option>
                  {segment.curve && segment.curve.kind !== 'preset' ? (
                    <option value="custom">custom</option>
                  ) : null}
                  {PRESETS.map((preset) => (
                    <option key={preset} value={preset}>
                      {preset}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          ))}

          <div className="chart-buttons">
            <button className="btn btn-small" onClick={() => addSegment(pane)}>
              + Zoom segment
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};
