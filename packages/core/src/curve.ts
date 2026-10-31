/**
 * The one curve evaluator.
 *
 * Pure: no React, no Remotion, no DOM. A curve is stored as data and evaluated
 * identically in preview and in export, so a curve edit changes the same frames
 * everywhere.
 *
 * The shape of a curve is either a named preset or an explicit cubic bezier.
 * Both are discriminated by `kind`, matching every other union in the package.
 */

/** The named curves the product offers. */
export type CurvePreset =
  | 'linear'
  | 'easeIn'
  | 'easeOut'
  | 'easeInOut'
  | 'bounceOut'
  | 'elastic'
  | 'overshoot';

/** A curve: a preset, or an explicit cubic bezier `[x1, y1, x2, y2]`. */
export type Curve =
  | { kind: 'preset'; name: CurvePreset }
  | { kind: 'cubicBezier'; p: [number, number, number, number] };

/** Bezier control points for each preset. */
export const PRESET_CONTROL_POINTS: Record<CurvePreset, [number, number, number, number]> = {
  linear: [0, 0, 1, 1],
  easeIn: [0.42, 0, 1, 1],
  easeOut: [0, 0, 0.58, 1],
  easeInOut: [0.42, 0, 0.58, 1],
  /** Back-out: overshoots the target and settles on it. */
  bounceOut: [0.34, 1.56, 0.64, 1],
  /** Spring-like: undershoots before settling. */
  elastic: [0.68, -0.55, 0.265, 1.55],
  /** A stronger back-out than `bounceOut`. */
  overshoot: [0.34, 1.7, 0.64, 1],
};

type ControlPoints = [number, number, number, number];

/**
 * The presets the product offers, in the order they are listed.
 * Ordered so every surface shows the same curve list.
 */
export const CURVE_PRESETS: readonly CurvePreset[] = [
  'linear',
  'easeIn',
  'easeOut',
  'easeInOut',
  'bounceOut',
  'elastic',
  'overshoot',
];

const resolveControlPoints = (curve: Curve): ControlPoints => {
  if (curve.kind === 'preset') return PRESET_CONTROL_POINTS[curve.name];
  return curve.p;
};

/** One axis of a cubic bezier with endpoints 0 and 1. */
const bezierAxis = (t: number, a: number, b: number): number => {
  const mt = 1 - t;
  return 3 * mt * mt * t * a + 3 * mt * t * t * b + t * t * t;
};

/** Bisection steps used to invert the x axis. */
const SOLVER_STEPS = 64;

/**
 * Evaluate a curve at `t`.
 *
 * `t` is clamped to 0..1. The result is 0 at `t = 0` and 1 at `t = 1`, exactly,
 * for every preset and every bezier.
 */
export const evaluateCurve = (curve: Curve, t: number): number => {
  if (!(t > 0)) return 0;
  if (t >= 1) return 1;

  const [x1, y1, x2, y2] = resolveControlPoints(curve);

  // The identity curve: both axes are the same function, so the answer is t itself.
  if (x1 === 0 && x2 === 1 && y1 === 0 && y2 === 1) return t;

  // x1 and x2 are constrained to 0..1, so x is monotonic and bisection converges.
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < SOLVER_STEPS; i += 1) {
    const mid = (lo + hi) / 2;
    if (bezierAxis(mid, x1, x2) < t) lo = mid;
    else hi = mid;
  }
  return bezierAxis((lo + hi) / 2, y1, y2);
};
