import { describe, expect, it } from 'vitest';
import {
  evaluateCurve,
  PRESET_CONTROL_POINTS,
  type Curve,
  type CurvePreset,
} from './curve';

const PRESETS: CurvePreset[] = [
  'linear',
  'easeIn',
  'easeOut',
  'easeInOut',
  'bounceOut',
  'elastic',
  'overshoot',
];

const presetCurve = (name: CurvePreset): Curve => ({ kind: 'preset', name });
const bezierCurve = (p: [number, number, number, number]): Curve => ({
  kind: 'cubicBezier',
  p,
});

describe('evaluateCurve', () => {
  it('maps 0 to 0 and 1 to 1 for every preset', () => {
    for (const name of PRESETS) {
      const curve = presetCurve(name);
      expect(evaluateCurve(curve, 0)).toBe(0);
      expect(evaluateCurve(curve, 1)).toBe(1);
    }
  });

  it('solves a cubic bezier at its endpoints', () => {
    const curve = bezierCurve([0.25, 0.1, 0.75, 0.9]);
    expect(evaluateCurve(curve, 0)).toBe(0);
    expect(evaluateCurve(curve, 1)).toBe(1);
  });

  it('is monotonic for a linear bezier', () => {
    const curve = bezierCurve([0, 0, 1, 1]);
    let previous = -Infinity;
    for (let i = 0; i <= 20; i += 1) {
      const t = i / 20;
      const value = evaluateCurve(curve, t);
      expect(value).toBeGreaterThanOrEqual(previous);
      expect(value).toBeCloseTo(t, 10);
      previous = value;
    }
  });

  it('clamps t outside 0..1 to the endpoints', () => {
    const curve = presetCurve('easeInOut');
    expect(evaluateCurve(curve, -1)).toBe(0);
    expect(evaluateCurve(curve, 2)).toBe(1);
  });

  it('evaluates a bezier whose x axis is not the identity', () => {
    const curve = bezierCurve([0.42, 0, 0.58, 1]);
    expect(evaluateCurve(curve, 0.5)).toBeCloseTo(0.5, 6);
    expect(evaluateCurve(curve, 0.25)).toBeLessThan(0.25);
    expect(evaluateCurve(curve, 0.75)).toBeGreaterThan(0.75);
  });

  it('eases a preset away from the identity', () => {
    const eased = evaluateCurve(presetCurve('easeIn'), 0.5);
    expect(eased).toBeLessThan(0.5);
    expect(evaluateCurve(presetCurve('easeOut'), 0.5)).toBeGreaterThan(0.5);
  });

  it('overshoots the target for a back-out preset', () => {
    const curve = presetCurve('overshoot');
    const peak = Math.max(
      ...Array.from({ length: 40 }, (_, i) => evaluateCurve(curve, i / 39)),
    );
    expect(peak).toBeGreaterThan(1);
  });

  it('gives every preset a control point set', () => {
    for (const name of PRESETS) {
      const points = PRESET_CONTROL_POINTS[name];
      expect(points).toHaveLength(4);
      expect(points.every((n) => Number.isFinite(n))).toBe(true);
    }
  });
});
