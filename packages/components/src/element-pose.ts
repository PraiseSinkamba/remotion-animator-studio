import { getComponent, type Clip, type ComponentGeometry } from '@chart-studio/core';
import { computeEffectStyle, type ComputedStyle } from './base/effects.js';

export interface PosePoint { x: number; y: number }
export interface ElementPose {
  style: ComputedStyle;
  /** CSS effects only: the component renderer owns intrinsic rotation. */
  transform: string;
  invertible: boolean;
  toComposition(point: PosePoint): PosePoint | null;
  toAuthored(point: PosePoint): PosePoint | null;
}

/** Project the authored plane in the same right-to-left order as CSS transforms.
 * Geometry is optional so measured content can supply its exact local origin.
 * No DOM matrix or editor state is involved; seeking has no history.
 */
export function evaluateElementPose(
  clip: Clip,
  sceneFrame: number,
  fps: number,
  geometry?: ComponentGeometry,
): ElementPose {
  const style = computeEffectStyle(sceneFrame - clip.from, clip.durationInFrames, fps, clip.effects);
  const definition = getComponent(clip.element);
  const props = { ...definition?.defaults, ...clip.props };
  const declared = geometry ?? definition?.geometry?.(props);
  const origin = declared?.origin ?? { x: Number(props.x ?? 0), y: Number(props.y ?? 0) };
  const anchor = declared?.anchor ?? origin;
  const radians = (value: number) => value * Math.PI / 180;
  const intrinsic = radians(declared?.rotation ?? 0);
  const rx = radians(style.rotateX), ry = radians(style.rotateY), rz = radians(style.rotate);

  // Homogeneous coordinates retain perspective until the final divide.
  const project = (x: number, y: number): [number, number, number] => {
    const ax = x - anchor.x, ay = y - anchor.y;
    x = anchor.x + ax * Math.cos(intrinsic) - ay * Math.sin(intrinsic) - origin.x;
    y = anchor.y + ax * Math.sin(intrinsic) + ay * Math.cos(intrinsic) - origin.y;
    const xx = x * Math.cos(ry), z = -x * Math.sin(ry);
    const yy = y * Math.cos(rx) - z * Math.sin(rx);
    const zz = y * Math.sin(rx) + z * Math.cos(rx);
    const w = 1 - zz / 1200;
    return [
      style.scale * (xx * Math.cos(rz) - yy * Math.sin(rz)) + (origin.x + style.translateX) * w,
      style.scale * (xx * Math.sin(rz) + yy * Math.cos(rz)) + (origin.y + style.translateY) * w,
      w,
    ];
  };

  // Three homogeneous basis evaluations recover the plane's 3x3 homography.
  const c = project(0, 0), x = project(1, 0), y = project(0, 1);
  const [a, b, d, e, h, i, j, k, l] = [
    x[0] - c[0], y[0] - c[0], c[0],
    x[1] - c[1], y[1] - c[1], c[1],
    x[2] - c[2], y[2] - c[2], c[2],
  ];
  const inverse = [
    h*l-i*k, d*k-b*l, b*i-d*h,
    i*j-e*l, a*l-d*j, d*e-a*i,
    e*k-h*j, b*j-a*k, a*h-b*e,
  ];
  const det = a * inverse[0] + b * inverse[3] + d * inverse[6];
  const invertible = Number.isFinite(det) && Math.abs(det) > 1e-9;
  const divide = (point: number[]): PosePoint | null =>
    Math.abs(point[2]) < 1e-9 || !point.every(Number.isFinite)
      ? null : { x: point[0] / point[2], y: point[1] / point[2] };
  return {
    style,
    invertible,
    transform: `translate(${style.translateX}px, ${style.translateY}px) scale(${style.scale}) rotate(${style.rotate}deg)` +
      (style.rotateX !== 0 || style.rotateY !== 0
        ? ` perspective(1200px) rotateX(${style.rotateX}deg) rotateY(${style.rotateY}deg)` : ''),
    toComposition: point => divide(project(point.x, point.y)),
    toAuthored: point => invertible ? divide([
      inverse[0] * point.x + inverse[1] * point.y + inverse[2],
      inverse[3] * point.x + inverse[4] * point.y + inverse[5],
      inverse[6] * point.x + inverse[7] * point.y + inverse[8],
    ]) : null,
  };
}
