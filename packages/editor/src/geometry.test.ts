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
  const textElements = ['text', 'counter', 'nodeTrail', 'remocnMarkerHighlight', 'remocnSoftBlurIn', 'remocnTypewriter'];
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
        expect(handle.props).toEqual(['gridSize', 'tileSize']);
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
        'n',
        'e',
        's',
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
      expect(edit.pick).toBe('point');
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

  it('declares three level handles for the position tool', () => {
    for (const type of levelElements) {
      const edit = editOf(type);
      expect(edit.pick).toBe('box');
      expect(edit.handles.map((handle) => handle.id)).toEqual(['entry', 'stop', 'target']);
      for (const handle of edit.handles) {
        expect(handle.effect).toBe('level');
      }
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
