// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createElement, isValidElement } from 'react';
import { cleanup, render } from '@testing-library/react';

// The vendored components read the frame through Remotion's hooks. Fix them so
// the animation maths is deterministic and independent of a Remotion context.
vi.mock('remotion', () => ({
  useCurrentFrame: () => 30,
  useVideoConfig: () => ({ fps: 30, width: 1920, height: 1080 }),
  interpolate: (value: number, input: number[], output: number[]) => {
    if (value <= input[0]) return output[0];
    if (value >= input[input.length - 1]) return output[output.length - 1];
    const i = input.findIndex((v) => v > value) - 1;
    const t = (value - input[i]) / (input[i + 1] - input[i]);
    return output[i] + t * (output[i + 1] - output[i]);
  },
  interpolateColors: (value: number, input: number[], output: string[]) =>
    value <= input[0] ? output[0] : output[output.length - 1],
  spring: ({ frame }: { frame: number }) => Math.max(0, Math.min(1, frame / 20)),
  Easing: {
    bezier: () => (t: number) => t,
  },
}));

import { getComponent } from '../registry/registry';
import type { Clip, ElementType } from '../types';
import { remocnSoftBlurInDefinition } from './definitions/soft-blur-in';
import { remocnTypewriterDefinition } from './definitions/typewriter';

afterEach(() => cleanup());

const makeClip = (element: ElementType, props: Record<string, unknown>): Clip => ({
  id: 'c1',
  name: 'Clip',
  element,
  from: 0,
  durationInFrames: 90,
  props,
  effects: [],
});

describe('remocnSoftBlurIn definition', () => {
  it('has every required field', () => {
    const definition = remocnSoftBlurInDefinition;
    expect(definition.type).toBe('remocnSoftBlurIn');
    expect(definition.label).toBe('Soft Blur In');
    expect(typeof definition.icon).toBe('string');
    expect(definition.icon.length).toBeGreaterThan(0);
    expect(typeof definition.description).toBe('string');
    expect(definition.description.length).toBeGreaterThan(0);
    expect(definition.category).toBe('motion');
    expect(definition.propsVersion).toBe(1);
    expect(definition.defaultDuration).toBe(90);
    expect(typeof definition.render).toBe('function');
    expect(definition.defaults).toBeTypeOf('object');
    expect(Array.isArray(definition.params)).toBe(true);
  });

  it('records provenance: source, licence and revision', () => {
    const provenance = remocnSoftBlurInDefinition.provenance;
    expect(provenance).toBeDefined();
    expect(provenance!.source).toBe('https://remocn.dev/r/soft-blur-in.json');
    expect(provenance!.license).toBe('MIT');
    expect(provenance!.revision).toBe('2026-10-26');
    expect(provenance!.notes).toBeTruthy();
  });

  it('has JSON-serialisable defaults', () => {
    const defaults = remocnSoftBlurInDefinition.defaults;
    expect(JSON.parse(JSON.stringify(defaults))).toEqual(defaults);
  });

  it('exposes an inspector param for every editable prop plus x/y', () => {
    const keys = remocnSoftBlurInDefinition.params.map((param) => param.key);
    expect(keys).toEqual(
      expect.arrayContaining(['text', 'blur', 'fontSize', 'color', 'fontWeight', 'speed', 'x', 'y']),
    );
    for (const param of remocnSoftBlurInDefinition.params) {
      expect(['number', 'color', 'text', 'textarea', 'select', 'boolean']).toContain(param.kind);
    }
  });

  it('registers itself on import', () => {
    expect(getComponent('remocnSoftBlurIn')).toBe(remocnSoftBlurInDefinition);
  });

  it('renders the configured text', () => {
    const definition = remocnSoftBlurInDefinition;
    const clip = makeClip('remocnSoftBlurIn', {
      ...definition.defaults,
      text: 'Focus pull',
    });
    const { container } = render(
      createElement(definition.render, { clip, props: clip.props, frame: 30, fps: 30 }),
    );
    expect(container.textContent).toBe('Focus pull');
  });
});

describe('remocnTypewriter definition', () => {
  it('has every required field', () => {
    const definition = remocnTypewriterDefinition;
    expect(definition.type).toBe('remocnTypewriter');
    expect(definition.label).toBe('Typewriter');
    expect(typeof definition.icon).toBe('string');
    expect(definition.icon.length).toBeGreaterThan(0);
    expect(typeof definition.description).toBe('string');
    expect(definition.description.length).toBeGreaterThan(0);
    expect(definition.category).toBe('motion');
    expect(definition.propsVersion).toBe(1);
    expect(definition.defaultDuration).toBe(90);
    expect(typeof definition.render).toBe('function');
    expect(definition.defaults).toBeTypeOf('object');
    expect(Array.isArray(definition.params)).toBe(true);
  });

  it('records provenance: source, licence and revision', () => {
    const provenance = remocnTypewriterDefinition.provenance;
    expect(provenance).toBeDefined();
    expect(provenance!.source).toBe('https://remocn.dev/r/typewriter.json');
    expect(provenance!.license).toBe('MIT');
    expect(provenance!.revision).toBe('2026-10-26');
    expect(provenance!.notes).toBeTruthy();
  });

  it('has JSON-serialisable defaults', () => {
    const defaults = remocnTypewriterDefinition.defaults;
    expect(JSON.parse(JSON.stringify(defaults))).toEqual(defaults);
  });

  it('exposes an inspector param for every editable prop plus x/y', () => {
    const keys = remocnTypewriterDefinition.params.map((param) => param.key);
    expect(keys).toEqual(
      expect.arrayContaining([
        'text',
        'cursor',
        'charsPerSecond',
        'speed',
        'fontSize',
        'color',
        'cursorColor',
        'fontWeight',
        'x',
        'y',
      ]),
    );
    for (const param of remocnTypewriterDefinition.params) {
      expect(['number', 'color', 'text', 'textarea', 'select', 'boolean']).toContain(param.kind);
    }
  });

  it('registers itself on import', () => {
    expect(getComponent('remocnTypewriter')).toBe(remocnTypewriterDefinition);
  });

  it('renders a deterministic prefix of the text', () => {
    const definition = remocnTypewriterDefinition;
    const text = 'Watch the story type itself';
    const clip = makeClip('remocnTypewriter', { ...definition.defaults, text });
    const { container } = render(
      createElement(definition.render, { clip, props: clip.props, frame: 30, fps: 30 }),
    );
    const revealed = container.textContent ?? '';
    expect(revealed.length).toBeGreaterThan(0);
    expect(revealed.length).toBeLessThan(text.length);
    // The revealed text is always a prefix of the full text.
    expect(text.startsWith(revealed)).toBe(true);
  });

  it('reveals the same text for the same frame', () => {
    const definition = remocnTypewriterDefinition;
    const text = 'Watch the story type itself';
    const clip = makeClip('remocnTypewriter', { ...definition.defaults, text });
    const renderAt = () =>
      render(
        createElement(definition.render, { clip, props: clip.props, frame: 30, fps: 30 }),
      ).container.textContent;
    expect(renderAt()).toBe(renderAt());
  });
});

describe('render adapters', () => {
  it('return a React element for the default props', () => {
    for (const definition of [remocnSoftBlurInDefinition, remocnTypewriterDefinition]) {
      const clip = makeClip(definition.type, { ...definition.defaults });
      const element = definition.render({ clip, props: clip.props, frame: 30, fps: 30 });
      expect(isValidElement(element)).toBe(true);
    }
  });
});
