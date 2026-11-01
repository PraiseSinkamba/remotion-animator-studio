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
  schemaVersion: 3,
  tracks: [],
});

const drawingClip = (element: string, props: Record<string, unknown>): Clip => ({
  id: 'drawing-1',
  name: 'Drawing',
  element: element as Clip['element'],
  from: 0,
  durationInFrames: 300,
  props: {
    x: 960,
    y: 540,
    width: 320,
    height: 180,
    opacity: 1,
    style: { color: '#ffffff', lineWidth: 1.5 },
    ...props,
  },
  effects: [],
  propsVersion: 2,
});

/** Renders a drawing exactly as the composition does. */
const draw = (element: string, props: Record<string, unknown>, clip?: Partial<Clip>) => {
  const definition = drawingDefinitions.find((entry) => entry.type === element);
  if (!definition) throw new Error(`no drawing definition for ${element}`);
  const merged = drawingClip(element, { ...definition.defaults, ...props });
  const full = { ...merged, ...clip, props: { ...merged.props, ...(clip?.props ?? {}) } };
  const container = render(
    React.createElement(definition.render, {
      clip: full,
      props: full.props,
      frame: 25,
      fps: 30,
      evaluated: undefined,
    }),
  ).container;
  return { container, clip: full, definition };
};

describe('the drawing tools', () => {
  it('renders a horizontal line in its own box with no chart in the project', () => {
    const { container } = draw('horizontalLine', { width: 480, height: 24 });

    const line = container.querySelector('[data-testid="drawing-horizontal-line"] line');
    expect(line).not.toBeNull();
    // The rule runs across the whole box, at its vertical centre.
    expect(line?.getAttribute('x1')).toBe('0');
    expect(line?.getAttribute('x2')).toBe('480');
    expect(line?.getAttribute('y1')).toBe('12');
    expect(line?.getAttribute('y2')).toBe('12');
  });

  it('renders a trend line between its two points at any angle', () => {
    const { container } = draw('trendline', {
      width: 320,
      height: 180,
      points: { start: { x: 0.25, y: 0.75 }, end: { x: 0.75, y: 0.25 } },
    });

    const trend = container.querySelector('[data-testid="drawing-trendline"] line');
    expect(trend?.getAttribute('x1')).toBe('80');
    expect(trend?.getAttribute('y1')).toBe('135');
    expect(trend?.getAttribute('x2')).toBe('240');
    expect(trend?.getAttribute('y2')).toBe('45');
  });

  it("renders a rectangle as the element's own box", () => {
    const { container } = draw('rectangle', { width: 320, height: 180 });

    const rect = container.querySelector('[data-testid="drawing-rectangle"] rect');
    expect(rect?.getAttribute('x')).toBe('0');
    expect(rect?.getAttribute('y')).toBe('0');
    expect(rect?.getAttribute('width')).toBe('320');
    expect(rect?.getAttribute('height')).toBe('180');
  });

  it('renders a high and low line as a vertical segment', () => {
    const { container } = draw('highLowLine', {
      width: 24,
      height: 320,
      points: { top: { x: 0.5, y: 0.25 }, bottom: { x: 0.5, y: 0.75 } },
    });

    const line = container.querySelector('[data-testid="drawing-high-low-line"] line');
    expect(line?.getAttribute('x1')).toBe('12');
    expect(line?.getAttribute('x2')).toBe('12');
    expect(line?.getAttribute('y1')).toBe('80');
    expect(line?.getAttribute('y2')).toBe('240');
  });

  it('renders a text label at its point', () => {
    const { container } = draw('textLabel', {
      width: 200,
      height: 40,
      points: { at: { x: 0.5, y: 0.5 } },
      label: { text: 'Hello' },
    });

    const label = container.querySelector('[data-testid="drawing-text-label"] text');
    expect(label?.textContent).toBe('Hello');
    expect(label?.getAttribute('x')).toBe('100');
    expect(label?.getAttribute('y')).toBe('20');
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
      width: 320,
      height: 240,
      points: {
        entry: { x: 0, y: 0.5 },
        stop: { x: 0, y: 0.75 },
        target: { x: 0, y: 0.25 },
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
      width: 320,
      height: 240,
      points: {
        entry: { x: 0, y: 0.5 },
        stop: { x: 0, y: 0.75 },
        target: { x: 0, y: 0.25 },
      },
      position: { direction: 'long', showRiskReward: true },
    });

    const ratio = container.querySelector('[data-testid="drawing-risk-reward"]');
    // |target.y - entry.y| / |entry.y - stop.y| = 0.25 / 0.25 = 1.
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
