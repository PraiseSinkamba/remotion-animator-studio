import type { DrawingPoint } from '@chart-studio/core';

export const DEFAULT_ARROW_LINE_WIDTH = 5;

/** The filled arrow head and shaft, in composition pixels. Coincident ends use a diamond. */
export function arrowShape(from: DrawingPoint, to: DrawingPoint, lineWidth = DEFAULT_ARROW_LINE_WIDTH) {
  const dx = to.x - from.x, dy = to.y - from.y;
  const length = Math.hypot(dx, dy);
  const radius = Math.max(8, lineWidth);
  if (length === 0) return { shaftEnd: to, head: [
    {x:to.x,y:to.y-radius}, {x:to.x+radius,y:to.y}, {x:to.x,y:to.y+radius}, {x:to.x-radius,y:to.y},
  ] };
  // A broad head reads clearly at preview scale and grows with a thicker shaft.
  // Clamp its length to the arrow itself so short arrows never point backwards.
  const size = Math.min(length, Math.max(lineWidth * 3.5, Math.min(48, Math.max(24, length * 0.28))));
  const halfWidth = Math.max(lineWidth * 0.9, size * 0.5);
  const ux = dx / length, uy = dy / length;
  const base = {x:to.x-ux*size,y:to.y-uy*size};
  return { shaftEnd: base, head: [to,
    {x:base.x-uy*halfWidth,y:base.y+ux*halfWidth},
    {x:base.x+uy*halfWidth,y:base.y-ux*halfWidth},
  ] };
}
