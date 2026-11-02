import type {ComponentGeometry, DrawingPoint, EditPoint} from '@chart-studio/core';

/** Paint bounds and control points share one pure calculation with the adapter. */
export const positionGeometry = (
  origin: EditPoint,
  left: number,
  width: number,
  points: Record<string,DrawingPoint>,
): ComponentGeometry => {
  const levels=[points.entry.y,points.target.y,points.stop.y];
  const top=Math.min(...levels);
  const box={left,top,width,height:Math.max(1,Math.max(...levels)-top)};
  return {anchor:origin,origin,box,placement:box,points:{...points,
    target:{x:left,y:points.target.y},stop:{x:left,y:points.stop.y},
    entry:{x:left,y:points.entry.y},width:{x:left+width,y:points.entry.y}}};
};

/** Compatibility lengths are deliberately absent from the full-span geometry. */
export const guideGeometry = (
  axis:'x'|'y',
  origin:EditPoint,
  composition={width:1920,height:1080},
): ComponentGeometry => {
  const horizontal=axis==='y';
  const placement=horizontal
    ? {left:0,top:origin.y-12,width:composition.width,height:24}
    : {left:origin.x-12,top:0,width:24,height:composition.height};
  const points=horizontal
    ? {start:{x:0,y:origin.y},end:{x:composition.width,y:origin.y}}
    : {start:{x:origin.x,y:0},end:{x:origin.x,y:composition.height}};
  return {origin,anchor:horizontal?{x:composition.width/2,y:origin.y}:{x:origin.x,y:composition.height/2},
    box:null,placement,points};
};
