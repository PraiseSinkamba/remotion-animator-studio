import { describe, expect, it } from 'vitest';
// Registers every component definition, so the geometry works on the real
// catalogue instead of a fake one.
import '@chart-studio/components';
import { getComponent, type Clip, type ElementHandle, type ElementType, type Project } from '@chart-studio/core';
import { dragEffect, elementRegion, handleAt, hitsElement, moveElement } from './geometry';

const project: Project = {
  name: 'geometry',
  width: 1920,
  height: 1080,
  fps: 30,
  durationInFrames: 300,
  backgroundColor: '#000000',
  tracks: [],
};

const makeClip = (
  element: ElementType,
  props: Record<string, unknown> = {},
  propsVersion?: number,
): Clip => ({
  id: `${element}-1`,
  name: element,
  element,
  from: 0,
  durationInFrames: 90,
  props,
  effects: [],
  ...(propsVersion === undefined ? {} : { propsVersion }),
});

const regionOf = (clip: Clip) => {
  const region = elementRegion(clip, project);
  if (!region) throw new Error(`no region for ${clip.element}`);
  return region;
};

/**
 * A trend line across the frame: (880, 585) to (1040, 495).
 *
 * The points are places in the composition: a drawing that is placed by its
 * points has no box of its own.
 */
const trendline = () =>
  makeClip('trendline', {
    points: { start: { x: 880, y: 585 }, end: { x: 1040, y: 495 } },
  });

const SCALE: ElementHandle = { id: 'se', effect: 'scale', props: ['width', 'height'] };
const FONT: ElementHandle = { id: 'se', effect: 'font', props: ['fontSize'] };
const WRAP: ElementHandle = { id: 'e', effect: 'wrap', props: ['maxWidth'] };

describe('elementRegion', () => {
  it('gives a box element its box and anchor', () => {
    const region = regionOf(makeClip('shape', { x: 960, y: 540, width: 400, height: 200 }));
    expect(region.box).toEqual({ left: 760, top: 440, width: 400, height: 200 });
    expect(region.anchor).toEqual({ x: 960, y: 540 });
  });

  it('gives a trend line the bounding box of its two endpoints', () => {
    const region = regionOf(trendline());
    expect(region.box).toEqual({ left: 880, top: 495, width: 160, height: 90 });
  });

  it('has no region for an element that is not picked on the canvas', () => {
    expect(elementRegion(makeClip('audio', {}), project)).toBeNull();
    expect(elementRegion(makeClip('background', {}), project)).toBeNull();
  });
});

describe('hitsElement', () => {
  it('hits a box element inside its box and misses outside it', () => {
    const region = regionOf(makeClip('shape', { x: 960, y: 540, width: 400, height: 200 }));
    expect(hitsElement('box', region, { x: 960, y: 540 }, 6)).toBe(true);
    expect(hitsElement('box', region, { x: 700, y: 540 }, 6)).toBe(false);
  });

  it('hits a segment near the line and misses a point inside its bounding box', () => {
    const region = regionOf(trendline());
    expect(hitsElement('segment', region, { x: 960, y: 543 }, 6)).toBe(true);
    // The top left corner of the bounding box is off the line itself.
    expect(hitsElement('segment', region, { x: 880, y: 495 }, 6)).toBe(false);
  });

  it('hits a point element within its tolerance', () => {
    const region = regionOf(makeClip('horizontalLine', { x: 960, y: 540, width: 480 }));
    expect(hitsElement('point', region, { x: 965, y: 540 }, 8)).toBe(true);
    expect(hitsElement('point', region, { x: 985, y: 540 }, 8)).toBe(false);
  });

  it('keeps the tolerance in screen pixels, so the same pointer hits at every zoom', () => {
    const region = regionOf(
      makeClip('trendline', {
        points: { start: { x: 960, y: 495 }, end: { x: 960, y: 585 } },
      }),
    );
    for (const scale of [0.25, 1, 4]) {
      // 5 screen pixels from the line, at every zoom level.
      expect(hitsElement('segment', region, { x: 960 + 5 / scale, y: 540 }, 6, scale)).toBe(true);
      // 7 screen pixels from the line, at every zoom level.
      expect(hitsElement('segment', region, { x: 960 + 7 / scale, y: 540 }, 6, scale)).toBe(false);
    }
  });

  it('hits a zero length segment as a point', () => {
    const region = regionOf(
      makeClip('trendline', {
        points: { start: { x: 960, y: 540 }, end: { x: 960, y: 540 } },
      }),
    );
    expect(hitsElement('segment', region, { x: 960, y: 543 }, 6)).toBe(true);
    expect(hitsElement('segment', region, { x: 990, y: 540 }, 6)).toBe(false);
  });
});

describe('handleAt', () => {
  it('puts a corner handle on the corner of the box', () => {
    const region = regionOf(makeClip('shape', { x: 960, y: 540, width: 400, height: 200 }));
    expect(handleAt(region, { id: 'nw', effect: 'scale' })).toEqual({ x: 760, y: 440 });
    expect(handleAt(region, { id: 'se', effect: 'scale' })).toEqual({ x: 1160, y: 640 });
  });

  it('puts an endpoint handle on its own point', () => {
    const region = regionOf(trendline());
    expect(handleAt(region, { id: 'start', effect: 'point' })).toEqual({ x: 880, y: 585 });
    expect(handleAt(region, { id: 'end', effect: 'point' })).toEqual({ x: 1040, y: 495 });
  });
});

describe('dragEffect', () => {
  it('scales a box from a corner and leaves the opposite corner where it was', () => {
    const clip = makeClip('shape', { x: 960, y: 540, width: 400, height: 200 });
    const region = regionOf(clip);
    const patch = dragEffect(clip, SCALE, region, { x: 1260, y: 740 }, { x: 1160, y: 640 });
    expect(patch).not.toBeNull();
    expect(patch!.width).toBe(500);
    expect(patch!.height).toBe(300);
    expect(patch!.x).toBe(1010);
    expect(patch!.y).toBe(590);
    // The opposite corner stayed put.
    expect(patch!.x as number - (patch!.width as number) / 2).toBe(760);
    expect(patch!.y as number - (patch!.height as number) / 2).toBe(440);
  });

  it('writes the font size when a text is dragged from a corner', () => {
    const clip = makeClip('text', { x: 960, y: 540, text: 'Hello', fontSize: 90 });
    const region = regionOf(clip);
    const patch = dragEffect(clip, FONT, region, { x: 1160, y: 640 }, { x: 1060, y: 590 });
    expect(patch!.fontSize).toBe(180);
    expect(patch!.width).toBeUndefined();
    expect(patch!.height).toBeUndefined();
  });

  it('writes the wrap width when a text is dragged from a side', () => {
    const clip = makeClip('text', { x: 960, y: 540, text: 'Hello', fontSize: 90 });
    const region = regionOf(clip);
    const pointer = { x: region.box!.left + 400, y: 540 };
    const patch = dragEffect(clip, WRAP, region, pointer, { x: region.box!.left, y: 540 });
    expect(patch!.maxWidth).toBeCloseTo(400);
    expect(patch!.fontSize).toBeUndefined();
  });

  it('moves one endpoint and leaves the other where it was', () => {
    const clip = trendline();
    const region = regionOf(clip);
    const patch = dragEffect(clip, { id: 'start', effect: 'point' }, region, { x: 900, y: 560 }, { x: 880, y: 585 });
    const points = patch!.points as Record<string, { x: number; y: number }>;
    // The point is a place in the composition: it moves to the pointer.
    expect(points.start).toEqual({ x: 900, y: 560 });
    expect(points.end).toEqual({ x: 1040, y: 495 });
  });

  it('moves one level of a position tool', () => {
    const clip = makeClip('position', {
      x: 960,
      y: 540,
      width: 320,
      height: 240,
      points: {
        entry: { x: 800, y: 540 },
        stop: { x: 800, y: 600 },
        target: { x: 800, y: 480 },
      },
    });
    const region = regionOf(clip);
    const patch = dragEffect(clip, { id: 'stop', effect: 'level' }, region, { x: 960, y: 630 }, { x: 960, y: 630 });
    const points = patch!.points as Record<string, { x: number; y: number }>;
    // A level is a horizontal line: it moves up and down only.
    expect(points.stop).toEqual({ x: 800, y: 630 });
    expect(points.entry).toEqual({ x: 800, y: 540 });
    expect(points.target).toEqual({ x: 800, y: 480 });
  });
});

describe('the edit declarations', () => {
  const boxElements = [
    'shape',
    'image',
    'video',
    'gif',
    'html',
    'wave',
    'synthGrid',
    'ridge',
    'commitGraph',
    'particles',
    'sunMoon',
    'skyCycle',
    'rectangle',
    'candlestickChart',
  ];
  const sizeElements = ['blob', 'cursor', 'neonSun'];
  const gridElements = ['isoCity'];
  const textElements = ['text', 'remocnMarkerHighlight', 'remocnSoftBlurIn', 'remocnTypewriter'];
  const emojiElements = ['emoji'];
  const pointElements = ['horizontalLine', 'verticalLine'];
  const segmentElements: [string, string[]][] = [
    ['trendline', ['start', 'end']],
    ['arrow', ['from', 'to']],
  ];
  const levelElements = ['position'];
  const notOnCanvas = ['audio', 'background'];

  const editOf = (type: string) => {
    const edit = getComponent(type as ElementType)?.edit;
    expect(edit, `${type} declares an edit model`).toBeDefined();
    return edit!;
  };

  it('declares four scale corners for a box element', () => {
    for (const type of boxElements) {
      const edit = editOf(type);
      expect(edit.pick).toBe('box');
      expect(edit.handles.map((handle) => handle.id)).toEqual(['nw', 'ne', 'se', 'sw']);
      for (const handle of edit.handles) {
        expect(handle.effect).toBe('scale');
        expect(handle.props).toEqual(['width', 'height']);
      }
    }
  });

  it('declares the size prop for an element that scales one number', () => {
    for (const type of sizeElements) {
      const edit = editOf(type);
      expect(edit.pick).toBe('box');
      expect(edit.handles.map((handle) => handle.id)).toEqual(['nw', 'ne', 'se', 'sw']);
      for (const handle of edit.handles) {
        expect(handle.effect).toBe('scale');
        expect(handle.props).toEqual(['size']);
      }
    }
  });

  it('declares the grid props for the city element', () => {
    for (const type of gridElements) {
      const edit = editOf(type);
      expect(edit.pick).toBe('box');
      for (const handle of edit.handles) {
        expect(handle.effect).toBe('scale');
        expect(handle.props).toEqual(['tileSize']);
      }
    }
  });

  it('declares font corners and wrap sides for a content element', () => {
    for (const type of textElements) {
      const edit = editOf(type);
      expect(edit.pick).toBe('box');
      expect(edit.handles.filter((handle) => handle.effect === 'font').map((handle) => handle.id)).toEqual([
        'nw',
        'ne',
        'se',
        'sw',
      ]);
      expect(edit.handles.filter((handle) => handle.effect === 'wrap').map((handle) => handle.id)).toEqual([
        'e',
        'w',
      ]);
      for (const handle of edit.handles.filter((entry) => entry.effect === 'font')) {
        expect(handle.props).toEqual(['fontSize']);
      }
    }
  });

  it('declares the size prop for the emoji element', () => {
    for (const type of emojiElements) {
      const edit = editOf(type);
      expect(edit.pick).toBe('box');
      for (const handle of edit.handles.filter((entry) => entry.effect === 'font')) {
        expect(handle.props).toEqual(['size']);
      }
    }
  });

  it('declares one move handle for a one anchor element', () => {
    for (const type of pointElements) {
      const edit = editOf(type);
      expect(edit.pick).toBe('segment');
      expect(edit.handles).toHaveLength(1);
      expect(edit.handles[0].effect).toBe('move');
    }
  });

  it('declares two point handles for a segment element', () => {
    for (const [type, ids] of segmentElements) {
      const edit = editOf(type);
      expect(edit.pick).toBe('segment');
      expect(edit.handles.map((handle) => handle.id)).toEqual(ids);
      for (const handle of edit.handles) {
        expect(handle.effect).toBe('point');
      }
    }
  });

  it('declares three levels and a width handle for the position tool', () => {
    for (const type of levelElements) {
      const edit = editOf(type);
      expect(edit.pick).toBe('box');
      expect(edit.handles.map((handle) => handle.id)).toEqual(['target', 'stop', 'entry', 'width']);
      expect(edit.handles.map(handle => handle.effect)).toEqual(['level','level','level','width']);
    }
  });

  it('declares no edit model for an element that is not on the canvas', () => {
    for (const type of notOnCanvas) {
      expect(getComponent(type as ElementType)?.edit, `${type} declares an edit model`).toBeUndefined();
    }
  });
});

describe('moveElement', () => {
  it('moves a box element by its anchor', () => {
    const clip = makeClip('shape', { x: 400, y: 300, width: 200, height: 100 });
    const region = regionOf(clip);

    const patch = moveElement(clip, region, { x: 25, y: -10 });

    expect(patch).toEqual({ x: 425, y: 290 });
  });

  it('moves a line by its points, and does not give it an anchor', () => {
    const clip = makeClip(
      'trendline',
      { points: { start: { x: 100, y: 100 }, end: { x: 300, y: 200 } } },
      3,
    );
    const region = regionOf(clip);

    const patch = moveElement(clip, region, { x: 40, y: 15 });

    expect(patch?.points).toEqual({
      start: { x: 140, y: 115 },
      end: { x: 340, y: 215 },
    });
    expect(patch?.x).toBeUndefined();
    expect(patch?.y).toBeUndefined();
  });
});

describe('the measured box', () => {
  it('is used for an element instead of the estimate', () => {
    const clip = makeClip('text', { x: 500, y: 300, fontSize: 90, text: 'Hello' });
    const measured = { left: 0, top: 0, width: 320, height: 110 };
    const region = elementRegion(clip, project, measured);

    expect(region?.box?.width).toBe(320);
    expect(region?.box?.height).toBe(110);
  });
});

describe('free endpoints', () => {
 it('does not infer a vertical constraint', () => {
  const clip = makeClip('trendline', {points:{start:{x:100,y:100},end:{x:100,y:300}}},3);
  const patch = dragEffect(clip,{id:'end',effect:'point'},regionOf(clip),{x:250,y:120},{x:100,y:300});
  expect(patch?.points).toEqual({start:{x:100,y:100},end:{x:250,y:120}});
 });
});

describe('content edit fallback', () => {
 it('retains content picking and movement without optional edit metadata', () => {
  const definition = getComponent('shape')!;
  const edit = definition.edit;
  try {
   definition.edit = undefined;
   const clip = makeClip('shape',{x:300,y:300,width:100,height:100});
   const region=regionOf(clip);
   expect(region.box?.left).toBe(250);
   expect(moveElement(clip,region,{x:10,y:20})).toEqual({x:310,y:320});
  } finally { definition.edit=edit; }
 });
});

 describe('authoritative capabilities', () => {
 it('does not offer unsupported wraps or path scaling', () => {
 expect(getComponent('counter')!.edit!.handles.every(h => h.effect === 'font')).toBe(true);
 expect(getComponent('nodeTrail')!.edit!.handles).toEqual([]);
 });
 it('uses the actual clamped city dimensions', () => {
 for (const n of [2,9]) {
 const c = {...makeClip('isoCity'), props: {gridSize:n,tileSize:10,buildingHeight:40,x:-20,y:30}};
 expect(elementRegion(c, project)!.box).toEqual({left:-20-(2*n+1)*5,top:30-((n+1)*10+40)/2,width:(2*n+1)*10,height:(n+1)*10+40});
 }
 });
 });

describe('component geometry regressions',()=>{
 it('keeps the actual opposite scalar corner on a non-square drag',()=>{for(const element of ['blob','isoCity','shape'] as const){const clip=makeClip(element,{x:-100,y:-50,kind:'triangle',width:200,height:100});const r=regionOf(clip);const fixed=handleAt(r,{id:'nw',effect:'scale'})!;const h=getComponent(element)!.edit!.handles.find(h=>h.id==='se')!;const start=handleAt(r,h)!;const patch=dragEffect(clip,h,r,{x:start.x+80,y:start.y+10},start)!;const next=regionOf({...clip,props:{...clip.props,...patch}});expect(handleAt(next,{id:'nw',effect:'scale'})!.x).toBeCloseTo(fixed.x,3);expect(handleAt(next,{id:'nw',effect:'scale'})!.y).toBeCloseTo(fixed.y,3);}});
 it('matches circle and triangle dimensions',()=>{expect(regionOf(makeClip('shape',{kind:'circle',width:200,height:100})).box?.width).toBe(100);expect(regionOf(makeClip('shape',{kind:'triangle',width:200,height:100})).box?.height).toBeCloseTo(100*Math.sqrt(3));});
 it('includes non-centered trail labels without recentering the wrapper origin',()=>{const r=regionOf(makeClip('nodeTrail',{x:-100,y:30,data:JSON.stringify([{x:300,y:-50,label:'Long waypoint label'},{x:600,y:100,label:'End'}])}));expect(r.origin).toEqual({x:-100,y:30});expect(r.box!.left).toBeLessThan(200);expect(r.box!.left+r.box!.width).toBeGreaterThan(500);});
 it('ignores measurements for authored size and props versions for coordinates',()=>{const c=makeClip('shape',{width:100,height:80});expect(elementRegion(c,project,{left:0,top:0,width:800,height:900})!.box?.width).toBe(100);expect(regionOf(makeClip('trendline',{points:{start:{x:-10,y:20},end:{x:40,y:50}}},1)).points.start).toEqual({x:-10,y:20});});
});

describe('review: drawing defaults and projection metadata', () => {
  it('keeps sibling default endpoints with a partial point override', () => {
    const defaults = getComponent('trendline')!.defaults.points;
    const clip = makeClip('trendline', {points:{start:{x:-10,y:20,note:'authored'}}});
    const region = regionOf(clip);
    expect(region.points.start).toEqual({x:-10,y:20});
    expect(region.points.end).toEqual(defaults.end);
    expect(region.box).not.toBeNull();
    const patch = dragEffect(clip,{id:'start',effect:'point'},region,{x:30,y:40},{x:-10,y:20});
    expect(patch?.points).toEqual({start:{x:30,y:40,note:'authored'},end:defaults.end});
    expect(clip.props.points).toEqual({start:{x:-10,y:20,note:'authored'}});
  });
  it('forwards segment origin and intrinsic rotation', () => {
    const definition = getComponent('trendline')!;
    const geometry = definition.geometry!;
    try {
      definition.geometry = props => ({...geometry(props),origin:{x:12,y:-20},rotation:35});
      expect(regionOf(trendline())).toMatchObject({origin:{x:12,y:-20},rotation:35});
    } finally {definition.geometry = geometry;}
  });
});

describe('animated pose integration',()=>{
 it('moves picking and handles 500 pixels and rejects rotated AABB corners',()=>{
  const c={...makeClip('shape',{x:300,y:300,width:200,height:100}),effects:[{id:'s',type:'slideIn' as const,params:{direction:'right',distance:500,duration:30}}]};
  const r=elementRegion(c,project,null,0)!;
  expect(hitsElement('box',r,{x:800,y:300},0)).toBe(true);
  expect(hitsElement('box',r,{x:300,y:300},0)).toBe(false);
  expect(handleAt(r,{id:'ne',effect:'scale',props:['width','height']})!.x).toBeCloseTo(900);
  const rotated=elementRegion({...c,effects:[],props:{...c.props,rotation:45}},project,null,0)!;
  expect(hitsElement('box',rotated,{x:300,y:300},0)).toBe(true);
  expect(hitsElement('box',rotated,{x:400,y:200},0)).toBe(false);
 });
 it('moves anchored scaled boxes by the displayed pointer delta',()=>{
  const c={...makeClip('shape',{x:300,y:300,width:100,height:100}),effects:[{id:'z',type:'zoomIn' as const,params:{fromScale:2,duration:30}}]};
  const r=elementRegion(c,project,null,0)!;
  const patch=moveElement(c,r,{x:20,y:10})!;
  const next=elementRegion({...c,props:{...c.props,...patch}},project,null,0)!;
  const h={id:'ne',effect:'scale' as const,props:['width','height']};
  expect(handleAt(next,h)!.x-handleAt(r,h)!.x).toBeCloseTo(20);
  expect(handleAt(next,h)!.y-handleAt(r,h)!.y).toBeCloseTo(10);
 });
 it('keeps the projected opposite corner fixed after scaled resize',()=>{
  const c={...makeClip('shape',{x:300,y:300,width:100,height:100}),effects:[{id:'z',type:'zoomIn' as const,params:{fromScale:2,duration:30}}]};
  const r=elementRegion(c,project,null,0)!;
  const h={id:'se',effect:'scale' as const,props:['width','height']};
  const start=handleAt(r,h)!; const target={x:start.x+20,y:start.y+40};
  const patch=dragEffect(c,h,r,target,start)!;
  const next=elementRegion({...c,props:{...c.props,...patch}},project,null,0)!;
  expect(handleAt(next,h)!.x).toBeCloseTo(target.x,3);expect(handleAt(next,h)!.y).toBeCloseTo(target.y,3);
  const fixed={...h,id:'nw'};
  expect(handleAt(next,fixed)!.x).toBeCloseTo(handleAt(r,fixed)!.x,3);expect(handleAt(next,fixed)!.y).toBeCloseTo(handleAt(r,fixed)!.y,3);
 });
});

describe('projection regressions',()=>{
 it.each([0.25,1,4])('retains screen tolerance on transformed segments at %s',scale=>{
  const c={...trendline(),effects:[{id:'z',type:'zoomIn' as const,params:{fromScale:2,duration:30}}]};
  const r=elementRegion(c,project,null,0)!;const points=Object.values(r.points).map(p=>r.pose!.toComposition(p)!);
  const [a,b]=points;const dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy);
  const at=(distance:number)=>({x:(a.x+b.x)/2-dy/len*distance/scale,y:(a.y+b.y)/2+dx/len*distance/scale});
  expect(hitsElement('segment',r,at(5),6,scale)).toBe(true);expect(hitsElement('segment',r,at(7),6,scale)).toBe(false);
 });
 it.each(['horizontal','vertical'])('tracks fixed and dragged corners after rotated perspective resize (%s)',axis=>{
  const c={...makeClip('shape',{x:300,y:300,width:200,height:100,rotation:25}),effects:[{id:'f',type:'flipIn' as const,params:{axis,duration:30,easing:'linear'}}]};
  const r=elementRegion(c,project,null,15)!;const h={id:'se',effect:'scale' as const,props:['width','height']};
  const start=handleAt(r,h)!;const target={x:start.x+25,y:start.y+15};const fixed=handleAt(r,{...h,id:'nw'})!;
  const patch=dragEffect(c,h,r,target,start)!;const next=elementRegion({...c,props:{...c.props,...patch}},project,null,15)!;
  expect(handleAt(next,h)!.x).toBeCloseTo(target.x,3);expect(handleAt(next,h)!.y).toBeCloseTo(target.y,3);
  expect(handleAt(next,{...h,id:'nw'})!.x).toBeCloseTo(fixed.x,3);expect(handleAt(next,{...h,id:'nw'})!.y).toBeCloseTo(fixed.y,3);
 });
 it('moves each absolute endpoint through its own perspective inverse',()=>{
  const c={...trendline(),effects:[{id:'f',type:'flipIn' as const,params:{axis:'vertical',duration:30,easing:'linear'}}]};
  const r=elementRegion(c,project,null,15)!;const patch=moveElement(c,r,{x:20,y:10})!;const next=elementRegion({...c,props:{...c.props,...patch}},project,null,15)!;
  for(const id of Object.keys(r.points)){const a=r.pose!.toComposition(r.points[id])!,b=next.pose!.toComposition(next.points[id])!;expect(b.x-a.x).toBeCloseTo(20,3);expect(b.y-a.y).toBeCloseTo(10,3);}
 });
});

describe('camera-plane picking and overlay', () => {
 const effects: Clip['effects'] = [{id:'f',type:'flipIn',params:{axis:'vertical',duration:30,easing:'linear'}}];
 it('does not pick the hidden part of a large box or show its hidden grips', () => {
  const c = {...makeClip('shape',{x:300,y:300,width:20000,height:100}),effects};
  const region = elementRegion(c,project,null,15)!;
  expect(hitsElement('box',region,{x:1800,y:300},0)).toBe(false);
  expect(hitsElement('box',region,{x:300,y:300},0)).toBe(true);
  const hiddenPoint = {...region,pick:'point' as const,anchor:{x:-9700,y:300}};
  expect(hitsElement('point',hiddenPoint,{x:1745.2705446681691,y:300},8)).toBe(false);
  expect(handleAt(region,{id:'nw',effect:'scale',props:['width','height']})).toBeNull();
 });
 it('picks the visible ray of a crossing segment without joining its hidden endpoint', () => {
  const c = {...makeClip('trendline',{points:{start:{x:-10000,y:0},end:{x:10000,y:0}}}),effects};
  const region = elementRegion(c,project,null,15)!;
  expect(hitsElement('segment',region,{x:-500,y:0},6)).toBe(true);
  expect(hitsElement('segment',region,{x:1745,y:0},6)).toBe(false);
 });
});

it.each([
 [{x:0,y:0},{x:200,y:0},{x:178,y:9}],
 [{x:0,y:0},{x:0,y:200},{x:9,y:178}],
 [{x:0,y:0},{x:0,y:0},{x:0,y:7}],
])('picks the painted arrowhead for aligned and coincident endpoints', (from,to,point) => {
 const clip=makeClip('arrow',{points:{from,to}});
 expect(hitsElement('segment',regionOf(clip),point,0)).toBe(true);
});

describe('purpose drawing geometry', () => {
  const position = () => makeClip('position', {
    x:430,y:270,left:270,width:320,height:240,
    points:{entry:{x:280,y:270,note:{keep:true}},target:{x:270,y:210},stop:{x:270,y:330}},
  },4);
  const grip = (id: string) => getComponent('position')!.edit!.handles.find(h=>h.id===id)!;
  const drag = (clip: Clip, id: string, at: {x:number;y:number}) => {
    const region = regionOf(clip);
    const patch = dragEffect(clip,grip(id),region,at,handleAt(region,grip(id))!)!;
    return {...clip,props:{...clip.props,...patch}};
  };
  it('extends both zones, edits entry only, changes width only, then moves every stored point', () => {
    let clip=position();
    clip=drag(clip,'target',{x:999,y:120});
    clip=drag(clip,'stop',{x:999,y:440});
    expect(regionOf(clip).box).toEqual({left:270,top:120,width:320,height:320});
    clip=drag(clip,'entry',{x:999,y:310});
    expect(clip.props.points).toEqual({entry:{x:280,y:310,note:{keep:true}},target:{x:270,y:120},stop:{x:270,y:440}});
    expect(Math.abs(120-310)/Math.abs(440-310)).toBeCloseTo(1.461538);
    const before=structuredClone(clip.props);
    clip=drag(clip,'width',{x:690,y:999});
    expect(clip.props).toEqual({...before,width:420});
    const patch=moveElement(clip,regionOf(clip),{x:60,y:20})!;
    expect(patch).toEqual({x:490,y:290,left:330,points:{entry:{x:340,y:330,note:{keep:true}},target:{x:330,y:140},stop:{x:330,y:460}}});
    expect(Object.keys(patch.points as object)).not.toContain('width');
  });
  it('preserves the exact stored level x and nested data when changing only y',()=>{
    const clip=position();clip.props.points.entry.x=280.123456789;
    expect(drag(clip,'entry',{x:999,y:310}).props.points.entry).toEqual({x:280.123456789,y:310,note:{keep:true}});
  });
  it.each(['target','stop','entry','width'])('keeps the projected %s grip under its constrained pointer after a posed edit',id=>{
    const clip:Clip={...position(),effects:[{id:'z',type:'zoomIn',params:{fromScale:2,duration:30}},{id:'r',type:'rotate',params:{rpm:20}}]};
    const region=elementRegion(clip,project,null,10)!;
    const handle=grip(id),start=handleAt(region,handle)!;
    const desired=region.pose!.toComposition({x:region.points[id].x+(id==='width'?100:0),y:region.points[id].y+(id==='width'?0:-150)})!;
    const patch=dragEffect(clip,handle,region,desired,start)!;
    const next=elementRegion({...clip,props:{...clip.props,...patch}},project,null,10)!;
    expect(handleAt(next,handle)!.x).toBeCloseTo(desired.x,3);
    expect(handleAt(next,handle)!.y).toBeCloseTo(desired.y,3);
    expect(next.origin).toEqual(region.origin);
    if(id!=='width') expect(next.points.width.x).toBe(region.points.width.x);
  });
  it('moves the posed position body by the displayed delta without changing its geometry',()=>{
    const clip:Clip={...position(),effects:[{id:'z',type:'zoomIn',params:{fromScale:2,duration:30}},{id:'r',type:'rotate',params:{rpm:20}}]};
    const region=elementRegion(clip,project,null,10)!;
    const before=structuredClone(clip),delta={x:60,y:20};
    const patch=moveElement(clip,region,delta)!;
    const next=elementRegion({...clip,props:{...clip.props,...patch}},project,null,10)!;
    for(const handle of getComponent('position')!.edit!.handles) {
      const a=handleAt(region,handle)!,b=handleAt(next,handle)!;
      expect(b.x-a.x).toBeCloseTo(delta.x,3);expect(b.y-a.y).toBeCloseTo(delta.y,3);
    }
    expect(clip).toEqual(before);
  });
  it.each(['horizontalLine','verticalLine'] as const)('constrains %s body and handle movement and spans 960 by 540',element=>{
    const clip=makeClip(element,{x:430,y:270});
    const region=elementRegion(clip,{...project,width:960,height:540},null,0)!;
    const h=getComponent(element)!.edit!.handles[0];
    const expected=element==='horizontalLine'?{x:430,y:290}:{x:490,y:270};
    expect(moveElement(clip,region,{x:60,y:20})).toEqual(expected);
    const start=handleAt(region,h)!;
    expect(dragEffect(clip,h,region,{x:start.x+60,y:start.y+20},start)).toEqual(expected);
    for(const scale of [0.25,1,4]) {
      const horizontal=element==='horizontalLine';
      const point={x:horizontal?30:430+5/scale,y:horizontal?270+5/scale:30};
      expect(hitsElement('segment',region,point,6,scale)).toBe(true);
      expect(hitsElement('segment',region,{x:point.x+(horizontal?0:2/scale),y:point.y+(horizontal?2/scale:0)},6,scale)).toBe(false);
    }
  });
  it('derives position bounds from the levels and exposes four purpose grips', () => {
    const clip = makeClip('position', {x:430,y:270,left:270,width:320,points:{entry:{x:270,y:270},target:{x:270,y:120},stop:{x:270,y:440}}});
    const region = regionOf(clip);
    expect(region.box).toEqual({left:270,top:120,width:320,height:320});
    expect(getComponent('position')?.edit?.handles.map(h=>h.id)).toEqual(['target','stop','entry','width']);
  });
  it('picks guides across a non-default composition', () => {
    const clip=makeClip('horizontalLine',{x:430,y:270});
    const region=elementRegion(clip,{...project,width:960,height:540})!;
    expect(hitsElement('segment',region,{x:30,y:270},6)).toBe(true);
  });
});
