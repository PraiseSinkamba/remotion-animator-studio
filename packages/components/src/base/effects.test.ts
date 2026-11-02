import { describe, expect, it } from 'vitest';
import { Easing } from 'remotion';
import { computeEffectStyle, getEasing, validateEffect } from './effects';
import type { EffectInstance, EffectType } from '@chart-studio/core';

const effect = (type: EffectType, params: Record<string, number | string>): EffectInstance => ({
  id: 'fx1',
  type,
  params,
});

describe('getEasing', () => {
  it('keeps the legacy easing names meaning what they meant', () => {
    const legacy: Record<string, (t: number) => number> = {
      linear: Easing.linear,
      easeIn: Easing.in(Easing.cubic),
      easeOut: Easing.out(Easing.cubic),
      easeInOut: Easing.inOut(Easing.cubic),
      bounceOut: Easing.bounce,
      elastic: Easing.out(Easing.elastic(1.4)),
      overshoot: Easing.out(Easing.back(1.7)),
    };
    for (const [name, expected] of Object.entries(legacy)) {
      const fn = getEasing(name);
      for (const t of [0, 0.2, 0.5, 0.8, 1]) {
        expect(fn(t)).toBeCloseTo(expected(t), 12);
      }
    }
  });

  it('falls back to the old default for an unknown name', () => {
    const fn = getEasing('nonsense');
    for (const t of [0, 0.2, 0.5, 0.8, 1]) {
      expect(fn(t)).toBeCloseTo(Easing.out(Easing.cubic)(t), 12);
    }
  });
});

describe('computeEffectStyle', () => {
  it('renders a fadeIn with the default easing as it did before', () => {
    const style = computeEffectStyle(5, 90, 30, [effect('fadeIn', { duration: 10 })]);
    expect(style.opacity).toBeCloseTo(0.5, 12);
  });

  it('applies a custom easing to fadeIn', () => {
    const bez = '0.25, 0.1, 0.75, 0.9';
    const style = computeEffectStyle(5, 90, 30, [
      effect('fadeIn', { duration: 10, easing: 'custom', bez }),
    ]);
    expect(style.opacity).toBeCloseTo(Easing.bezier(0.25, 0.1, 0.75, 0.9)(0.5), 12);
  });

  it('applies a custom easing to spinIn in place of the hardcoded curve', () => {
    const bez = '0.25, 0.1, 0.75, 0.9';
    const style = computeEffectStyle(5, 90, 30, [
      effect('spinIn', { rotations: 1, duration: 10, easing: 'custom', bez }),
    ]);
    expect(style.rotate).toBeCloseTo(
      (1 - Easing.bezier(0.25, 0.1, 0.75, 0.9)(0.5)) * 360,
      12,
    );
  });

  it('applies an easing to bounceDrop in place of the hardcoded curve', () => {
    const style = computeEffectStyle(5, 90, 30, [
      effect('bounceDrop', { height: 400, duration: 10, easing: 'easeOut' }),
    ]);
    expect(style.translateY).toBeCloseTo(
      -(1 - Easing.out(Easing.cubic)(0.5)) * 400,
      12,
    );
  });
});

it.each(['toString','constructor','__proto__'])('rejects inherited effect type %s directly', type => {
 expect(validateEffect(effect(type as EffectType, {}))).toEqual({path:'type',message:'Unsupported effect type'});
});
