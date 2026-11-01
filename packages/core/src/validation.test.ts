import { describe, expect, it } from 'vitest';

import {
  validateChartGroup,
  validateChartProps,
  validateChartRelations,
  validateDrawingProps,
  validateProjectDocument,
  validateSeriesSpec,
} from './validation';

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

describe('validateChartRelations', () => {
  const pane = (overrides: Record<string, unknown> = {}) => ({
    id: 'pane-0',
    name: 'Pane 0',
    seriesId: 'series-a',
    aggregation: { factor: 1 },
    rect: { x: 0, y: 0, width: 1, height: 1 },
    in: 0,
    out: 300,
    opacity: 1,
    clock: { kind: 'reference' },
    priceRange: { mode: 'auto' },
    ...overrides,
  });

  const props = (overrides: Record<string, unknown> = {}) => ({
    seriesId: 'series-a',
    panes: [pane()],
    clock: {
      id: 'clock-0',
      unit: 'logical',
      referenceSeriesId: 'series-a',
      stepBars: 1,
      framesPerStep: 15,
    },
    ...overrides,
  });

  it('accepts a chart whose panes sit on the ladder', () => {
    const result = validateChartRelations(
      props({
        panes: [
          pane({ id: 'pane-fine', timeframeId: '1m', aggregation: { factor: 1 } }),
          pane({ id: 'pane-coarse', timeframeId: '4H', aggregation: { factor: 240 } }),
        ],
        relations: [{ kind: 'rollup', finePaneId: 'pane-fine', coarsePaneId: 'pane-coarse' }],
      }),
    );
    expect(result.ok).toBe(true);
  });

  it('rejects a pane whose timeframe is not a rung of the ladder', () => {
    const result = validateChartRelations(
      props({ panes: [pane({ timeframeId: '2h', aggregation: { factor: 120 } })] }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected the chart to be rejected');
    expect(result.issues[0].path).toBe('panes.0.timeframeId');
    expect(result.issues[0].message).toContain('2h');
  });

  it('rejects a pane whose factor does not match the rung it names', () => {
    const result = validateChartRelations(
      props({
        panes: [
          pane({ id: 'pane-fine', timeframeId: '1m', aggregation: { factor: 1 } }),
          pane({ id: 'pane-coarse', timeframeId: '4H', aggregation: { factor: 120 } }),
        ],
      }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected the chart to be rejected');
    expect(result.issues[0].path).toBe('panes.1.aggregation.factor');
    // The fine pane fixes the base at one minute, so 4H is 240 bars of it.
    expect(result.issues[0].message).toContain('240');
  });

  it('rejects a rollup whose panes read different series', () => {
    const result = validateChartRelations(
      props({
        panes: [
          pane({ id: 'pane-fine', seriesId: 'series-a', timeframeId: '1m', aggregation: { factor: 1 } }),
          pane({ id: 'pane-coarse', seriesId: 'series-b', timeframeId: '4H', aggregation: { factor: 240 } }),
        ],
        relations: [{ kind: 'rollup', finePaneId: 'pane-fine', coarsePaneId: 'pane-coarse' }],
      }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected the chart to be rejected');
    expect(result.issues.some((issue) => issue.message.includes('pane-coarse'))).toBe(true);
  });

  it('rejects a rollup whose coarse factor is not a whole multiple of the fine one', () => {
    const result = validateChartRelations(
      props({
        panes: [
          pane({ id: 'pane-fine', timeframeId: '4H', aggregation: { factor: 240 } }),
          pane({ id: 'pane-coarse', timeframeId: '6H', aggregation: { factor: 360 } }),
        ],
        relations: [{ kind: 'rollup', finePaneId: 'pane-fine', coarsePaneId: 'pane-coarse' }],
      }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected the chart to be rejected');
    // 360 / 240 is 1.5, so the two cannot be rolled up against each other.
    expect(result.issues.some((issue) => issue.message.includes('whole multiple'))).toBe(true);
    expect(result.issues.some((issue) => issue.message.includes('pane-coarse'))).toBe(true);
  });

  it('rejects a relation that names a pane the chart does not hold', () => {
    const result = validateChartRelations(
      props({
        relations: [{ kind: 'rollup', finePaneId: 'pane-0', coarsePaneId: 'pane-missing' }],
      }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected the chart to be rejected');
    expect(result.issues[0].path).toBe('relations.0.coarsePaneId');
  });

  it('accepts a lockstep whose panes carry the same rung and the same candle count', () => {
    const result = validateChartRelations(
      props({
        panes: [
          pane({
            id: 'pane-a',
            seriesId: 'series-a',
            timeframeId: '1H',
            aggregation: { factor: 60 },
            viewport: { fromBar: 0, barCount: 90 },
          }),
          pane({
            id: 'pane-b',
            seriesId: 'series-b',
            timeframeId: '1H',
            aggregation: { factor: 60 },
            viewport: { fromBar: 0, barCount: 90 },
          }),
        ],
        relations: [{ kind: 'lockstep', paneIds: ['pane-a', 'pane-b'], timeframeId: '1H' }],
      }),
    );
    expect(result.ok).toBe(true);
  });

  it('rejects a lockstep whose panes disagree on the rung', () => {
    const result = validateChartRelations(
      props({
        panes: [
          pane({
            id: 'pane-a',
            seriesId: 'series-a',
            timeframeId: '1H',
            aggregation: { factor: 60 },
            viewport: { fromBar: 0, barCount: 90 },
          }),
          pane({
            id: 'pane-b',
            seriesId: 'series-b',
            timeframeId: '4H',
            aggregation: { factor: 240 },
            viewport: { fromBar: 0, barCount: 90 },
          }),
        ],
        relations: [{ kind: 'lockstep', paneIds: ['pane-a', 'pane-b'], timeframeId: '1H' }],
      }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected the chart to be rejected');
    expect(result.issues.some((issue) => issue.message.includes('same rung'))).toBe(true);
  });

  it('rejects a lockstep whose panes disagree on the candle count', () => {
    const result = validateChartRelations(
      props({
        panes: [
          pane({
            id: 'pane-a',
            seriesId: 'series-a',
            timeframeId: '1H',
            aggregation: { factor: 60 },
            viewport: { fromBar: 0, barCount: 90 },
          }),
          pane({
            id: 'pane-b',
            seriesId: 'series-b',
            timeframeId: '1H',
            aggregation: { factor: 60 },
            viewport: { fromBar: 0, barCount: 60 },
          }),
        ],
        relations: [{ kind: 'lockstep', paneIds: ['pane-a', 'pane-b'], timeframeId: '1H' }],
      }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected the chart to be rejected');
    expect(result.issues.some((issue) => issue.message.includes('same number of candles'))).toBe(true);
  });

  it('accepts a lockstep whose panes state no candle count at all', () => {
    const result = validateChartRelations(
      props({
        panes: [
          pane({ id: 'pane-a', seriesId: 'series-a', timeframeId: '1H', aggregation: { factor: 60 } }),
          pane({ id: 'pane-b', seriesId: 'series-b', timeframeId: '1H', aggregation: { factor: 60 } }),
        ],
        relations: [{ kind: 'lockstep', paneIds: ['pane-a', 'pane-b'], timeframeId: '1H' }],
      }),
    );
    expect(result.ok).toBe(true);
  });
});

describe('validateChartGroup', () => {
  const group = (overrides: Record<string, unknown> = {}) => ({
    id: 'group-0',
    name: 'Group 0',
    chartClipIds: ['clip-a', 'clip-b'],
    layout: 'split-horizontal',
    clock: {
      id: 'clock-0',
      unit: 'logical',
      referenceSeriesId: 'series-a',
      stepBars: 1,
      framesPerStep: 15,
    },
    relations: [],
    ...overrides,
  });

  it('accepts a group of two charts', () => {
    expect(validateChartGroup(group()).ok).toBe(true);
  });

  it('rejects a group holding more than three charts', () => {
    const result = validateChartGroup(
      group({ chartClipIds: ['clip-a', 'clip-b', 'clip-c', 'clip-d'] }),
    );
    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected the group to be rejected');
    expect(result.issues[0].path).toBe('chartClipIds');
  });

  it('rejects a group holding no chart at all', () => {
    expect(validateChartGroup({ ...group(), chartClipIds: [] }).ok).toBe(false);
  });
});

describe('validateDrawingProps', () => {
  const trendlineProps = () => ({
    x: 960,
    y: 540,
    width: 320,
    height: 180,
    opacity: 1,
    style: { color: '#e8eaf0', lineWidth: 1.5, fillOpacity: 0.2, fontSize: 24 },
    caption: 'the creator’s own figure',
    points: { start: { x: 0, y: 0 }, end: { x: 1, y: 1 } },
    trendline: { ray: 'both' },
  });

  it("accepts an independent drawing's props", () => {
    const result = validateDrawingProps('trendline', trendlineProps());

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error('expected the drawing to be accepted');
    expect(result.value.points?.start).toEqual({ x: 0, y: 0 });
    expect(result.value.caption).toBe('the creator’s own figure');
  });

  it("rejects a point outside the drawing's own box", () => {
    const result = validateDrawingProps('trendline', { points: { start: { x: 1.5, y: 0 } } });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected the drawing to be rejected');
    expect(result.issues.some((issue) => issue.path === 'points.start.x')).toBe(true);
  });

  it('rejects a horizontal line that carries points', () => {
    const result = validateDrawingProps('horizontalLine', {
      points: { at: { x: 0.5, y: 0.5 } },
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected the drawing to be rejected');
    expect(result.issues.some((issue) => issue.path === 'points')).toBe(true);
  });

  it('rejects a retired market number', () => {
    const result = validateDrawingProps('horizontalLine', { price: 4200 });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected the drawing to be rejected');
    expect(result.issues.some((issue) => issue.path === 'price')).toBe(true);
  });

  it('rejects a retired position level', () => {
    const result = validateDrawingProps('position', {
      position: { direction: 'long', entry: 4200 },
    });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected the drawing to be rejected');
    expect(result.issues.some((issue) => issue.path === 'position.entry')).toBe(true);
  });

  it('rejects an opacity outside 0..1', () => {
    const result = validateDrawingProps('horizontalLine', { opacity: 1.5 });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error('expected the drawing to be rejected');
    expect(result.issues.some((issue) => issue.path === 'opacity')).toBe(true);
  });

  it('accepts a drawing with no kind-specific content', () => {
    const result = validateDrawingProps('horizontalLine', {
      x: 960,
      y: 540,
      width: 480,
      height: 24,
    });

    expect(result.ok).toBe(true);
  });
});
