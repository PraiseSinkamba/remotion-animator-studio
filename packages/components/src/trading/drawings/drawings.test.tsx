// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import React from 'react';

import { drawingDefinitions } from './definitions';
import type { Clip, Project } from '@chart-studio/core';

afterEach(() => cleanup());

/** A project with no chart in it: a drawing never needs one. */
const project = (): Project => ({
  name: 'Project',
  width: 1920,
  height: 1080,
  fps: 30,
  durationInFrames: 300,
  backgroundColor: '#000000',
  schemaVersion: 4,
  tracks: [],
});

/** Renders a drawing exactly as the composition does. */
const draw = (element: string, props: Record<string, unknown>, clip?: Partial<Clip>, composition = {width:960,height:540}) => {
  const definition = drawingDefinitions.find((entry) => entry.type === element);
  if (!definition) throw new Error(`no drawing definition for ${element}`);
  const full = {
    id: 'drawing-1',
    name: 'Drawing',
    element: element as Clip['element'],
    from: 0,
    durationInFrames: 300,
    props,
    effects: [],
    propsVersion: definition.propsVersion,
    ...clip,
  };
  const container = render(
    React.createElement(definition.render, {
      clip: full,
      props: full.props,
      frame: 25,
      fps: 30,
      evaluated: undefined,
      geometry: definition.geometry?.(full.props,undefined,composition),
      composition,
    }),
  ).container;
  return { container, clip: full, definition };
};

describe('the drawing tools', () => {
  it('draws both extended position zones inside its level-derived viewBox',()=>{
    const {container}=draw('position',{x:430,y:270,left:270,width:320,height:240,
      points:{entry:{x:270,y:310},target:{x:270,y:120},stop:{x:270,y:440}},position:{direction:'long',showRiskReward:true}});
    expect(container.querySelector('svg')?.getAttribute('viewBox')).toBe('0 0 320 320');
    expect(container.querySelector('[data-testid="drawing-position-zone-reward"]')?.getAttribute('height')).toBe('190');
    expect(container.querySelector('[data-testid="drawing-position-zone-risk"]')?.getAttribute('height')).toBe('130');
    expect(container.textContent).toContain('R 1.46');
  });
  it.each([270,330])('keeps collapsed and zero-risk position geometry finite at entry %s',entry=>{
    const {container}=draw('position',{points:{entry:{x:800,y:entry},target:{x:800,y:330},stop:{x:800,y:330}}});
    expect(container.innerHTML).not.toMatch(/NaN|Infinity/);
    expect(Number(container.querySelector('svg')?.getAttribute('height'))).toBeGreaterThan(0);
  });
  it('labels a nonzero reward with zero risk clearly',()=>{
    const {container}=draw('position',{points:{entry:{x:800,y:540},target:{x:800,y:480},stop:{x:800,y:540}}});
    expect(container.textContent).toContain('R — (zero risk)');
  });
  it('draws vertical guides across a non-default composition ignoring legacy height',()=>{
    const {container}=draw('verticalLine',{x:430,y:270,height:10});
    expect(container.querySelector('line')?.getAttribute('y2')).toBe('540');
  });
  it('renders a horizontal rule across the composition ignoring legacy length', () => {
    const { container } = draw('horizontalLine', { x: 960, y: 540, width: 480 });

    const line = container.querySelector('[data-testid="drawing-horizontal-line"] line');
    expect(line).not.toBeNull();
    // The rule runs across the whole length, at the band's vertical centre.
    expect(line?.getAttribute('x1')).toBe('0');
    expect(line?.getAttribute('x2')).toBe('960');
    expect(line?.getAttribute('y1')).toBe('12');
    expect(line?.getAttribute('y2')).toBe('12');
  });

  it('renders a trend line between its two points, wherever they are', () => {
    const { container } = draw('trendline', {
      points: { start: { x: 880, y: 585 }, end: { x: 1040, y: 495 } },
    });

    const svg = container.querySelector('[data-testid="drawing-trendline"]');
    // The shape has no box: it is placed by its points, in composition pixels.
    expect(svg?.getAttribute('style')).toContain('left: 872px');
    expect(svg?.getAttribute('style')).toContain('top: 487px');

    const trend = container.querySelector('[data-testid="drawing-trendline"] line');
    expect(trend?.getAttribute('x1')).toBe('8');
    expect(trend?.getAttribute('y1')).toBe('98');
    expect(trend?.getAttribute('x2')).toBe('168');
    expect(trend?.getAttribute('y2')).toBe('8');
  });

  it("renders a rectangle as the element's own box", () => {
    const { container } = draw('rectangle', { x: 960, y: 540, width: 320, height: 180 });

    const rect = container.querySelector('[data-testid="drawing-rectangle"] rect');
    expect(rect?.getAttribute('x')).toBe('0');
    expect(rect?.getAttribute('y')).toBe('0');
    expect(rect?.getAttribute('width')).toBe('320');
    expect(rect?.getAttribute('height')).toBe('180');
  });

  it('draws the caption beside the shape and claims no market value', () => {
    const { container } = draw('horizontalLine', { caption: '4200' });

    const caption = container.querySelector('[data-testid="drawing-caption"]');
    expect(caption?.textContent).toBe('4200');
    // The caption is the creator's own figure: the drawing states no price.
    expect(container.textContent).not.toMatch(/\$|USD|price/i);
  });

  it('draws no profit-and-loss figure and implies no broker fill', () => {
    const { container } = draw('position', {
      x: 960,
      y: 540,
      width: 320,
      height: 240,
      points: {
        entry: { x: 800, y: 540 },
        stop: { x: 800, y: 600 },
        target: { x: 800, y: 480 },
      },
      position: { direction: 'long', showRiskReward: true },
    });

    const text = container.textContent ?? '';
    expect(text).not.toMatch(/P&L|\$|profit|loss/i);
    expect(text).not.toMatch(/fill(ed)?|broker/i);
    // The ratio is a fact about the drawn levels, so it is drawn.
    expect(text).toContain('R 1.00');
  });

  it('computes the position ratio from the drawn geometry', () => {
    const { container } = draw('position', {
      x: 960,
      y: 540,
      width: 320,
      height: 240,
      points: {
        entry: { x: 800, y: 540 },
        stop: { x: 800, y: 600 },
        target: { x: 800, y: 480 },
      },
      position: { direction: 'long', showRiskReward: true },
    });

    const ratio = container.querySelector('[data-testid="drawing-risk-reward"]');
    // |target.y - entry.y| / |entry.y - stop.y| = 60 / 60 = 1.
    expect(ratio?.textContent).toBe('R 1.00');
  });

  it('renders a hidden drawing as nothing', () => {
    const { container } = draw('horizontalLine', {}, { hidden: true });
    expect(container.querySelector('[data-testid="drawing-horizontal-line"]')).toBeNull();
  });

  it('draws every kind without a chart in the project', () => {
    for (const definition of drawingDefinitions) {
      const { container } = draw(definition.type, definition.defaults);
      expect(container.querySelector('svg')).not.toBeNull();
    }
  });
});
