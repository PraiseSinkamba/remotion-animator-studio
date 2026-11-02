import type { DrawingPoint } from '@chart-studio/core';

/** The filled arrow head and shaft, in composition pixels. Coincident ends use a diamond. */
export function arrowShape(from: DrawingPoint, to: DrawingPoint) {
  const dx = to.x - from.x, dy = to.y - from.y;
  const length = Math.hypot(dx, dy);
  if (length === 0) return { shaftEnd: to, head: [
    {x:to.x,y:to.y-8}, {x:to.x+8,y:to.y}, {x:to.x,y:to.y+8}, {x:to.x-8,y:to.y},
  ] };
  const size = Math.min(22, Math.max(12, length * 0.22));
  const ux = dx / length, uy = dy / length;
  const base = {x:to.x-ux*size,y:to.y-uy*size};
  return { shaftEnd: base, head: [to,
    {x:base.x-uy*size*0.42,y:base.y+ux*size*0.42},
    {x:base.x+uy*size*0.42,y:base.y-ux*size*0.42},
  ] };
}
