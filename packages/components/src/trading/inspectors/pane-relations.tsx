/**
 * The pane and relation panel of the chart inspector.
 *
 * A chart is a collection of panes: each one reads a series, shows a rung of
 * the timeframe ladder, aggregates it as-of and draws in its own rect. The
 * relation between two panes is *declared* — a rollup (one asset at two
 * timeframes) or a lockstep (two assets on one timeframe) — and the panel
 * shows what the declaration resolves to, never a typed factor.
 */
import React from 'react';
import {
  evaluateRelation,
  isTimeframeId,
  paneFactor,
  seriesBaseRung,
  seriesBaseUnits,
  TIMEFRAME_BASE_UNITS,
  type Curve,
  type PaneRelation,
  type PaneSpec,
  type TimeframeId,
} from '@chart-studio/core';
import { CurveEditor } from '@chart-studio/ui/inspector/curve-editor';
import { readCurve } from '../chart';

/** The ladder, in order. A rung is a rung, never a free multiplier. */
export const LADDER: TimeframeId[] = Object.keys(TIMEFRAME_BASE_UNITS) as TimeframeId[];

/**
 * Sets a pane's rung, and derives the factor that rung carries.
 *
 * The factor is never typed: it is the rung's size over the series' base.
 * The base comes from the series' other panes — the pane that reads the
 * source bars one for one pins it — so a pane named `5m` over a `1m` base
 * aggregates five source bars.
 */
export const applyRung = (
  panes: readonly PaneSpec[],
  paneId: string,
  rung: TimeframeId,
): PaneSpec[] => {
  const target = panes.find((pane) => pane.id === paneId);
  if (!target) return [...panes];
  const others = panes.filter(
    (pane) => pane.seriesId === target.seriesId && pane.id !== paneId,
  );
  const base = seriesBaseUnits(others, target.seriesId);
  return panes.map((pane) =>
    pane.id === paneId
      ? {
          ...pane,
          timeframeId: rung,
          aggregation: { factor: TIMEFRAME_BASE_UNITS[rung] / base },
        }
      : pane,
  );
};

export interface PaneRelationPanelProps {
  panes: readonly PaneSpec[];
  relations: readonly PaneRelation[];
  /** The chart's own curve. A pane without a curve of its own inherits it. */
  chartCurve?: Curve;
  onChange: (patch: Record<string, unknown>) => void;
  commit: () => void;
}

/**
 * The pane and relation panel.
 *
 * Every discrete edit commits first, so one undo step reverts one edit.
 */
export const PaneRelationPanel: React.FC<PaneRelationPanelProps> = ({
  panes,
  relations,
  chartCurve,
  onChange,
  commit,
}) => {
  const edit = (patch: Record<string, unknown>) => {
    commit();
    onChange(patch);
  };

  /**
   * Writes the pane's own curve.
   *
   * The pane states the curve explicitly, so it never inherits ambiguously:
   * a pane with no curve of its own falls back to the chart's curve.
   */
  const setPaneCurve = (pane: PaneSpec, curve: Curve | undefined) => {
    edit({
      panes: panes.map((entry) => {
        if (entry.id !== pane.id) return entry;
        if (curve === undefined) {
          const { curve: _dropped, ...rest } = entry;
          return rest;
        }
        return { ...entry, curve };
      }),
    });
  };

  const setRect = (pane: PaneSpec, patch: Partial<PaneSpec['rect']>) => {
    edit({
      panes: panes.map((entry) =>
        entry.id === pane.id ? { ...entry, rect: { ...entry.rect, ...patch } } : entry,
      ),
    });
  };

  const setClock = (pane: PaneSpec, kind: 'reference' | 'offset') => {
    edit({
      panes: panes.map((entry) =>
        entry.id === pane.id
          ? {
              ...entry,
              clock:
                kind === 'offset'
                  ? { kind: 'offset' as const, offsetBars: 0 }
                  : { kind },
            }
          : entry,
      ),
    });
  };

  const removeRelation = (relation: PaneRelation) => {
    edit({ relations: relations.filter((entry) => entry !== relation) });
  };

  const addRollup = () => {
    const [fine, coarse] = panes;
    if (!fine || !coarse) return;
    const relation: PaneRelation = {
      kind: 'rollup',
      finePaneId: fine.id,
      coarsePaneId: coarse.id,
    };
    edit({ relations: [...relations, relation] });
  };

  const addLockstep = () => {
    const [first, second] = panes;
    if (!first || !second) return;
    const rung = (
      first.timeframeId && isTimeframeId(first.timeframeId) ? first.timeframeId : '1m'
    ) as TimeframeId;
    const relation: PaneRelation = {
      kind: 'lockstep',
      paneIds: [first.id, second.id],
      timeframeId: rung,
    };
    edit({ relations: [...relations, relation] });
  };

  return (
    <div className="chart-inspector">
      <div className="section-title">Panes</div>

      {panes.map((pane, index) => {
        const rung =
          pane.timeframeId && isTimeframeId(pane.timeframeId) ? pane.timeframeId : undefined;
        const factor = rung ? paneFactor(panes, pane.seriesId, rung) : pane.aggregation.factor;
        const base = seriesBaseRung(panes, pane.seriesId);
        return (
          <div key={pane.id} data-testid="pane-row" data-pane={pane.id}>
            <div className="param-row">
              <label>{pane.name ?? `Pane ${index + 1}`}</label>
              <select
                aria-label={`Pane ${index + 1} timeframe`}
                value={rung ?? ''}
                onChange={(e) => {
                  const chosen = e.target.value;
                  if (!chosen) return;
                  edit({ panes: applyRung(panes, pane.id, chosen as TimeframeId) });
                }}
              >
                <option value="">source bars</option>
                {LADDER.map((entry) => (
                  <option key={entry} value={entry}>
                    {entry}
                  </option>
                ))}
              </select>
            </div>

            <div className="chart-length-hint" data-testid="pane-derived-factor">
              {rung
                ? `${factor} × ${base ?? 'base'}`
                : `source bars · base ${base ?? 'base'}`}
            </div>

            <div className="param-row">
              <label>Rect</label>
              <input
                type="number"
                step={0.05}
                min={0}
                max={1}
                aria-label={`Pane ${index + 1} rect x`}
                value={pane.rect.x}
                onChange={(e) => setRect(pane, { x: Number(e.target.value) })}
              />
              <input
                type="number"
                step={0.05}
                min={0}
                max={1}
                aria-label={`Pane ${index + 1} rect y`}
                value={pane.rect.y}
                onChange={(e) => setRect(pane, { y: Number(e.target.value) })}
              />
              <input
                type="number"
                step={0.05}
                min={0}
                max={1}
                aria-label={`Pane ${index + 1} rect width`}
                value={pane.rect.width}
                onChange={(e) => setRect(pane, { width: Number(e.target.value) })}
              />
              <input
                type="number"
                step={0.05}
                min={0}
                max={1}
                aria-label={`Pane ${index + 1} rect height`}
                value={pane.rect.height}
                onChange={(e) => setRect(pane, { height: Number(e.target.value) })}
              />
            </div>

            <div className="param-row">
              <label>Clock</label>
              <select
                aria-label={`Pane ${index + 1} clock binding`}
                value={pane.clock.kind === 'utc' ? '' : pane.clock.kind}
                onChange={(e) => {
                  const chosen = e.target.value;
                  if (chosen !== 'reference' && chosen !== 'offset') return;
                  setClock(pane, chosen);
                }}
              >
                {pane.clock.kind === 'utc' ? (
                  <option value="">unavailable</option>
                ) : null}
                <option value="reference">reference</option>
                <option value="offset">offset</option>
              </select>
              {pane.clock.kind === 'utc' ? (
                // A hand-authored document may name a binding the chart cannot
                // honour. The picker does not offer it; the note says why.
                <div className="chart-length-hint" data-testid="pane-unavailable-binding">
                  this pane names a clock binding the chart cannot honour
                </div>
              ) : null}
              {pane.clock.kind === 'offset' ? (
                <input
                  type="number"
                  step={1}
                  aria-label={`Pane ${index + 1} offset bars`}
                  value={pane.clock.offsetBars}
                  onChange={(e) =>
                    edit({
                      panes: panes.map((entry) =>
                        entry.id === pane.id
                          ? {
                              ...entry,
                              clock: {
                                kind: 'offset' as const,
                                offsetBars: Number(e.target.value),
                              },
                            }
                          : entry,
                      ),
                    })
                  }
                />
              ) : null}
            </div>

            <div className="param-row">
              <label>Curve</label>
              <CurveEditor
                value={readCurve(pane.curve) ?? chartCurve}
                onChange={(curve) => setPaneCurve(pane, curve)}
                onClear={
                  readCurve(pane.curve) === undefined
                    ? undefined
                    : () => setPaneCurve(pane, undefined)
                }
                label={`Pane ${index + 1} curve`}
              />
            </div>
          </div>
        );
      })}

      <div className="section-title">Relations</div>

      {relations.map((relation, index) => {
        const state = evaluateRelation(relation, panes);
        const crossAsset =
          relation.kind === 'lockstep' &&
          relation.paneIds.length === 2 &&
          panes.find((pane) => pane.id === relation.paneIds[0])?.seriesId !==
            panes.find((pane) => pane.id === relation.paneIds[1])?.seriesId;
        return (
          <div key={index} data-testid="relation-row">
            <div className="param-row">
              <label>{relation.kind}</label>
              <span data-testid="relation-derived">
                {state === null
                  ? 'names a pane this chart does not hold'
                  : state.kind === 'rollup'
                    ? `${state.barsPerCoarse} × ${state.fineTimeframeId ?? 'base'} · base ${
                        state.baseTimeframeId ?? '—'
                      }`
                    : `${state.timeframeId} · ${state.barCount} candles`}
              </span>
              <button
                className="btn btn-small"
                aria-label={`Remove relation ${index + 1}`}
                onClick={() => removeRelation(relation)}
              >
                ✕
              </button>
            </div>
            {crossAsset ? (
              <div className="chart-length-hint" data-testid="authored-link-label">
                authored link — not market time
              </div>
            ) : null}
          </div>
        );
      })}

      <div className="chart-buttons">
        <button className="btn btn-small" onClick={addRollup} disabled={panes.length < 2}>
          + Rollup
        </button>
        <button className="btn btn-small" onClick={addLockstep} disabled={panes.length < 2}>
          + Lockstep
        </button>
      </div>
      {panes.length < 2 ? (
        <div className="chart-length-hint" data-testid="relation-needs-second-pane">
          a relation needs a second pane
        </div>
      ) : null}
    </div>
  );
};
