import { describe, expect, it } from 'vitest';

import { validateChartProps, validateProjectDocument, validateSeriesSpec } from './validation';

const validSeries = () => ({
  id: 'series-a',
  origin: 'manual',
  label: 'Manual',
  timeBasis: 'logical',
  bars: [{ id: 'series-a:0', t: 0, o: 10, h: 12, l: 9, c: 11 }],
});

const validProject = () => ({
  name: 'Project',
  width: 1920,
  height: 1080,
  fps: 30,
  durationInFrames: 300,
  backgroundColor: '#0d0d14',
  schemaVersion: 2,
  tracks: [
    {
      id: 't1',
      name: 'Track 1',
      clips: [
        {
          id: 'c1',
          name: 'Title',
          element: 'text',
          from: 0,
          durationInFrames: 90,
          props: { text: 'Hi' },
          effects: [],
        },
      ],
    },
  ],
});

describe('validateSeriesSpec', () => {
  it('accepts a valid series spec', () => {
    const result = validateSeriesSpec(validSeries());
    expect(result.ok).toBe(true);
  });

  it('rejects a series whose origin is not one of the four', () => {
    const result = validateSeriesSpec({ ...validSeries(), origin: 'invented' });
    expect(result.ok).toBe(false);
  });

  it('reports the path of the offending field', () => {
    const result = validateSeriesSpec({
      ...validSeries(),
      bars: [{ id: 'b0', t: 0, o: -1, h: 12, l: 9, c: 11 }],
    });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected the series to be rejected');
    expect(result.issues[0].path).toContain('bars');
  });
});

describe('validateChartProps', () => {
  const validProps = () => ({
    seriesId: 'series-a',
    panes: [
      {
        id: 'pane-0',
        seriesId: 'series-a',
        aggregation: { factor: 1 },
        rect: { x: 0, y: 0, width: 1, height: 1 },
        in: 0,
        out: 300,
        opacity: 1,
        clock: { kind: 'reference' },
        priceRange: { mode: 'auto' },
      },
    ],
    clock: {
      id: 'clock-0',
      unit: 'logical',
      referenceSeriesId: 'series-a',
      stepBars: 1,
      framesPerStep: 15,
    },
  });

  it('accepts valid chart props', () => {
    expect(validateChartProps(validProps()).ok).toBe(true);
  });

  it('rejects a pane whose clock binding is not one of the three kinds', () => {
    const props = validProps();
    props.panes[0].clock = { kind: 'guess' } as never;
    expect(validateChartProps(props).ok).toBe(false);
  });

  it('rejects a pane with a non-positive aggregation factor', () => {
    const props = validProps();
    props.panes[0].aggregation = { factor: 0 };
    expect(validateChartProps(props).ok).toBe(false);
  });
});

describe('validateProjectDocument', () => {
  it('accepts a valid v2 project document', () => {
    expect(validateProjectDocument(validProject()).ok).toBe(true);
  });

  it('rejects a document with a non-positive fps', () => {
    const result = validateProjectDocument({ ...validProject(), fps: 0 });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected the document to be rejected');
    expect(result.issues.some((issue) => issue.path.includes('fps'))).toBe(true);
  });

  it('reports the path of the offending field', () => {
    const result = validateProjectDocument({ ...validProject(), width: 0 });
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected the document to be rejected');
    expect(result.issues[0].path).toContain('width');
  });

  it('keeps unknown keys on the project document', () => {
    const result = validateProjectDocument({ ...validProject(), somethingNew: 'kept' });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected the document to be accepted');
    expect((result.value as unknown as Record<string, unknown>).somethingNew).toBe('kept');
  });
});
