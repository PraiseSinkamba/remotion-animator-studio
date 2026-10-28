import React from 'react';
import { Pencil, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { EFFECTS, getEasing } from '../../effects';
import { useStore } from '../../store';
import type { Clip } from '../../types';
import { ParamControl } from './param-control';

/** Small graph of the selected animation curve. */
const EasingPreview: React.FC<{ name: string; bez?: string }> = ({ name, bez }) => {
  const W = 120;
  const H = 56;
  const pad = 6;
  const fn = getEasing(name, bez);
  const pts = Array.from({ length: 41 }, (_, i) => {
    const t = i / 40;
    const v = fn(t);
    const x = pad + t * (W - pad * 2);
    // eased values can overshoot [0,1] (elastic, overshoot) — leave headroom
    const y = H - pad - v * (H - pad * 2) * 0.75 - (H - pad * 2) * 0.05;
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');
  return (
    <div className="rounded-md border border-border bg-muted/40 p-1">
      <svg width={W} height={H} className="text-primary">
        <polyline points={pts} fill="none" stroke="currentColor" strokeWidth={2} />
      </svg>
    </div>
  );
};

/**
 * The effects of one clip: a card per effect with its own parameters, plus the
 * canvas-drawing button for the motion path effect.
 */
export const EffectList: React.FC<{ clip: Clip; commit: () => void }> = ({ clip, commit }) => {
  const { updateEffectParams, removeEffect, startDrawingPath } = useStore.getState();

  return (
    <div className="space-y-2">
      {clip.effects.map((fx) => {
        const fxDef = EFFECTS[fx.type];
        return (
          <div key={fx.id} className="rounded-md border border-border bg-muted/40 p-2">
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="truncate text-[11px] font-medium text-foreground">
                {fxDef.icon} {fxDef.label}
              </span>
              <Button
                variant="ghost"
                size="icon-xs"
                title="Remove effect"
                aria-label="Remove effect"
                onClick={() => removeEffect(clip.id, fx.id)}
              >
                <X />
              </Button>
            </div>
            <div className="space-y-1.5">
              {fxDef.params.map((def) => {
                // frame-based params can never exceed the clip's own length
                const framed =
                  def.kind === 'number' && ['start', 'duration', 'at'].includes(def.key)
                    ? { ...def, max: clip.durationInFrames }
                    : def;
                return (
                  <React.Fragment key={def.key}>
                    <ParamControl
                      def={framed}
                      value={fx.params[def.key] ?? fxDef.defaults[def.key]}
                      idPrefix={`${clip.id}-fx-${fx.id}`}
                      onCommit={commit}
                      onChange={(v) => updateEffectParams(clip.id, fx.id, { [def.key]: v })}
                    />
                    {def.key === 'easing' ? (
                      <EasingPreview
                        name={String(fx.params.easing ?? fxDef.defaults.easing ?? 'easeOut')}
                        bez={String(fx.params.bez ?? fxDef.defaults.bez ?? '')}
                      />
                    ) : null}
                  </React.Fragment>
                );
              })}
              {fx.type === 'motionPath' ? (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => startDrawingPath(clip.id, fx.id)}
                >
                  <Pencil data-icon="inline-start" />
                  Draw path on canvas
                </Button>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
};
