// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { cleanup, render } from '@testing-library/react';

// The vendored component reads the frame through Remotion's hooks. Fix them so
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
}));

import { getComponent } from '../registry/registry';
import { remocnMarkerHighlightDefinition } from './definition';

afterEach(() => cleanup());

describe('remocnMarkerHighlight definition', () => {
  it('has every required field', () => {
    const definition = remocnMarkerHighlightDefinition;
    expect(definition.type).toBe('remocnMarkerHighlight');
    expect(definition.label).toBe('Marker Highlight');
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
    const provenance = remocnMarkerHighlightDefinition.provenance;
    expect(provenance).toBeDefined();
    expect(provenance!.source).toBe('https://remocn.dev/r/marker-highlight.json');
    expect(provenance!.license).toBe('MIT');
    expect(provenance!.revision).toBe('2026-10-25');
    expect(provenance!.notes).toBeTruthy();
  });

  it('has JSON-serialisable defaults', () => {
    const defaults = remocnMarkerHighlightDefinition.defaults;
    expect(JSON.parse(JSON.stringify(defaults))).toEqual(defaults);
  });

  it('exposes an inspector param for every editable prop plus x/y', () => {
    const keys = remocnMarkerHighlightDefinition.params.map((param) => param.key);
    expect(keys).toEqual(
      expect.arrayContaining([
        'before',
        'highlight',
        'after',
        'markerColor',
        'baseColor',
        'highlightedTextColor',
        'fontSize',
        'fontWeight',
        'speed',
        'x',
        'y',
      ]),
    );
    for (const param of remocnMarkerHighlightDefinition.params) {
      expect(['number', 'color', 'text', 'textarea', 'select']).toContain(param.kind);
    }
  });

  it('registers itself on import', () => {
    expect(getComponent('remocnMarkerHighlight')).toBe(remocnMarkerHighlightDefinition);
  });

  it('renders the highlight text', () => {
    const definition = remocnMarkerHighlightDefinition;
    const clip = {
      id: 'c1',
      name: 'Marker Highlight',
      element: 'remocnMarkerHighlight' as const,
      from: 0,
      durationInFrames: 90,
      props: { ...definition.defaults, before: 'Watch ', highlight: 'breakout', after: ' now' },
      effects: [],
    };
    const { container } = render(
      createElement(definition.render, { clip, props: clip.props, frame: 30, fps: 30 }),
    );
    expect(container.textContent).toContain('breakout');
    expect(container.textContent).toContain('Watch ');
    expect(container.textContent).toContain(' now');
  });
});
