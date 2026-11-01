import { describe, expect, it } from 'vitest';

import { buildProvenance } from './provenance';
import type { ElementType, Project } from './schemas';
import type { SeriesSpec } from './series';

const projectWith = (series: SeriesSpec[], revealMode?: 'discrete' | 'simulated'): Project => ({
  name: 'Provenance',
  width: 1920,
  height: 1080,
  fps: 30,
  durationInFrames: 240,
  backgroundColor: '#000000',
  schemaVersion: 2,
  series,
  tracks: [
    {
      id: 't-chart',
      name: 'Chart',
      clips:
        revealMode === undefined
          ? []
          : [
              {
                id: 'c-chart',
                name: 'Chart',
                element: 'candlestickChart' as const,
                from: 0,
                durationInFrames: 240,
                props: { revealMode },
                effects: [],
              },
            ],
    },
  ],
});

const authoredSeries: SeriesSpec = {
  id: 'series-authored',
  origin: 'authored-path',
  label: 'Authored path',
  timeBasis: 'logical',
  seed: 'seed-authored',
  algorithmVersion: 3,
  path: {
    anchors: [
      { id: 'a0', barIndex: 0, price: 100 },
      { id: 'a1', barIndex: 10, price: 120 },
      { id: 'a2', barIndex: 20, price: 95 },
    ],
  },
};

const manualSeries: SeriesSpec = {
  id: 'series-manual',
  origin: 'manual',
  label: 'Manual series',
  timeBasis: 'logical',
  bars: [
    { id: 'b0', t: 0, o: 10, h: 12, l: 9, c: 11 },
    { id: 'b1', t: 1, o: 11, h: 13, l: 10, c: 12 },
  ],
};

describe('buildProvenance', () => {
  it('records the origin, seed and algorithm version of an authored path', () => {
    const record = buildProvenance(projectWith([authoredSeries]));

    expect(record.schemaVersion).toBe(2);
    expect(record.series).toHaveLength(1);
    expect(record.series[0]).toEqual({
      id: 'series-authored',
      label: 'Authored path',
      origin: 'authored-path',
      algorithmVersion: 3,
      seed: 'seed-authored',
      anchorCount: 3,
    });
  });

  it('records the simulation flags independently of the origin', () => {
    const simulated = buildProvenance(projectWith([manualSeries], 'simulated'));
    expect(simulated.series[0]).toEqual({
      id: 'series-manual',
      label: 'Manual series',
      origin: 'manual',
      barCount: 2,
    });
    expect(simulated.simulation).toEqual({
      simulatedIntrabarPath: true,
      simulatedChartIds: ['c-chart'],
    });

    const discrete = buildProvenance(projectWith([manualSeries], 'discrete'));
    expect(discrete.simulation).toEqual({
      simulatedIntrabarPath: false,
      simulatedChartIds: [],
    });
  });

  it('records nothing for a project with no chart', () => {
    const record = buildProvenance(projectWith([]));

    expect(record.series).toEqual([]);
    expect(record.simulation).toEqual({
      simulatedIntrabarPath: false,
      simulatedChartIds: [],
    });
  });

  it('records a series that no chart draws', () => {
    // The record describes the data the project carries, not the frames it
    // shows: a series is listed whether or not a chart reads it.
    const record = buildProvenance(projectWith([manualSeries]));

    expect(record.series).toHaveLength(1);
    expect(record.series[0].origin).toBe('manual');
  });
});

describe('buildProvenance annotations', () => {
  const drawingProject = (element: string, props: Record<string, unknown>): Project => ({
    ...projectWith([]),
    tracks: [
      {
        id: 't-draw',
        name: 'Drawings',
        clips: [
          {
            id: 'c-draw',
            name: 'Drawing',
            // The v3 drawing kinds are not element types yet: the cutover
            // renames two of them and adds the rest in S1.
            element: element as ElementType,
            from: 0,
            durationInFrames: 240,
            props,
            effects: [],
          },
        ],
      },
    ],
  });

  it("records a drawing's caption as the creator's own figure", () => {
    const record = buildProvenance(drawingProject('horizontalLine', { caption: '4200' }));

    expect(record.annotations).toHaveLength(1);
    expect(record.annotations[0].caption).toBe('4200');
  });

  it("records a drawing's kind", () => {
    const record = buildProvenance(drawingProject('trendline', { caption: '4200' }));

    expect(record.annotations).toHaveLength(1);
    expect(record.annotations[0].kind).toBe('trendline');
    expect(record.annotations[0].clipId).toBe('c-draw');
  });

  it('records a drawing with no caption', () => {
    const record = buildProvenance(drawingProject('rectangle', { x: 10, y: 20 }));

    expect(record.annotations).toHaveLength(1);
    expect(record.annotations[0].kind).toBe('rectangle');
    expect(record.annotations[0].caption).toBeUndefined();
  });

  it('records nothing for an element that is not a drawing', () => {
    const record = buildProvenance(drawingProject('text', { caption: 'hello' }));

    expect(record.annotations).toEqual([]);
  });
});
