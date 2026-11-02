import { describe, expect, it } from 'vitest';
import { arrowShape } from './arrow-geometry';

describe('arrow silhouette', () => {
  it.each([{x:200,y:0}, {x:0,y:200}, {x:-200,y:0}, {x:120,y:-160}])(
    'gives a normal arrow a substantial head in every orientation: %o', to => {
      const shape = arrowShape({x:0,y:0}, to);
      expect(Math.hypot(to.x-shape.shaftEnd.x,to.y-shape.shaftEnd.y)).toBeGreaterThanOrEqual(40);
      expect(Math.hypot(shape.head[1].x-shape.head[2].x,shape.head[1].y-shape.head[2].y)).toBeGreaterThanOrEqual(40);
      expect(shape.head[0]).toEqual(to);
    },
  );

  it.each([{x:3,y:0}, {x:0,y:-3}, {x:-2,y:2}])('keeps a short head ahead of its tail: %o', to => {
    const shape = arrowShape({x:0,y:0}, to);
    for (const point of [shape.shaftEnd, ...shape.head]) {
      expect(point.x*to.x+point.y*to.y).toBeGreaterThanOrEqual(-1e-10);
      expect(Number.isFinite(point.x) && Number.isFinite(point.y)).toBe(true);
    }
  });
});
