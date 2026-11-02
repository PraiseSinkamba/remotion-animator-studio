import { describe, expect, it } from 'vitest';
import type { ElementType, Project } from '@chart-studio/core';
import { CURRENT_PROJECT_SCHEMA_VERSION, migrateProject } from './project-migrate';

interface TestClip {
  id: string;
  name: string;
  element: ElementType;
  from: number;
  durationInFrames: number;
  props: Record<string, unknown>;
  effects: unknown[];
  groupId?: string;
  propsVersion?: number;
}

interface TestDoc {
  name: string;
  width: number;
  height: number;
  fps: number;
  durationInFrames: number;
  backgroundColor: string;
  schemaVersion?: number;
  series?: unknown[];
  tracks: Array<{ id: string; name: string; clips: TestClip[] }>;
}

const legacyProject = (): TestDoc => ({
  name: 'Legacy',
  width: 1920,
  height: 1080,
  fps: 30,
  durationInFrames: 300,
  backgroundColor: '#0d0d14',
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

describe('migrateProject', () => {
  it('treats a missing schemaVersion as the legacy version', () => {
    const migrated = migrateProject(legacyProject());
    expect(CURRENT_PROJECT_SCHEMA_VERSION).toBe(4);
    expect(migrated.schemaVersion).toBe(4);
    expect(migrated.tracks[0].clips[0].element).toBe('text');
    expect(migrated.tracks[0].clips[0].props).toEqual({ text: 'Hi' });
  });

  it('rejects a newer schema version by name', () => {
    expect(() => migrateProject({ ...legacyProject(), schemaVersion: 5 })).toThrow(/5/);
  });

  it('rejects a malformed document', () => {
    expect(() => migrateProject(null)).toThrow();
    expect(() => migrateProject({ ...legacyProject(), tracks: 'nope' })).toThrow();
    expect(() => migrateProject({ ...legacyProject(), fps: 0 })).toThrow();
  });

  it('reports the path of the offending field for a malformed document', () => {
    expect(() => migrateProject({ ...legacyProject(), fps: 0 })).toThrow(/fps/);
    expect(() => migrateProject({ ...legacyProject(), width: -1 })).toThrow(/width/);
    expect(() => migrateProject({ ...legacyProject(), height: 0 })).toThrow(/height/);
    expect(() => migrateProject({ ...legacyProject(), durationInFrames: 0 })).toThrow(
      /durationInFrames/,
    );
  });

  it('rejects an unknown component type', () => {
    const doc = legacyProject();
    doc.tracks[0].clips[0].element = 'not-a-real-element' as ElementType;
    expect(() => migrateProject(doc)).toThrow('Unsupported component type "not-a-real-element"');
  });

  it('rejects a clip whose props version is newer than the component supports', () => {
    const doc = legacyProject();
    doc.tracks[0].clips[0].propsVersion = 2;
    expect(() => migrateProject(doc)).toThrow(/props version 2/);
  });

  it('keeps groupId and propsVersion', () => {
    const doc = legacyProject();
    doc.tracks[0].clips[0].groupId = 'g1';
    doc.tracks[0].clips[0].propsVersion = 1;
    const migrated = migrateProject(doc);
    expect(migrated.tracks[0].clips[0].groupId).toBe('g1');
    expect(migrated.tracks[0].clips[0].propsVersion).toBe(1);
  });

  it('is idempotent', () => {
    const once = migrateProject(legacyProject());
    const twice = migrateProject(once);
    expect(twice).toEqual(once);
  });

  it('accepts a current project unchanged', () => {
    const project: Project = {
      name: 'Current',
      width: 1920,
      height: 1080,
      fps: 30,
      durationInFrames: 300,
      backgroundColor: '#0d0d14',
      schemaVersion: CURRENT_PROJECT_SCHEMA_VERSION,
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
    };
    expect(migrateProject(project)).toEqual(project);
  });
});

describe('migrateProject — the v1 to v2 conversion', () => {
  const chartProject = (bars: unknown[], dataSource?: string): TestDoc => ({
    name: 'Chart project',
    width: 1920,
    height: 1080,
    fps: 30,
    durationInFrames: 600,
    backgroundColor: '#000000',
    tracks: [
      {
        id: 't1',
        name: 'Track 1',
        clips: [
          {
            id: 'c1',
            name: 'Candlestick Chart',
            element: 'candlestickChart',
            from: 0,
            durationInFrames: 180,
            props: { bars, dataSource },
            effects: [],
          },
        ],
      },
    ],
  });

  const BARS = [
    { t: 0, o: 100, h: 110, l: 95, c: 105 },
    { t: 60_000, o: 105, h: 112, l: 101, c: 108 },
  ];

  it('lifts a v1 chart bar array into a project series', () => {
    const migrated = migrateProject(chartProject(BARS));
    expect(migrated.series).toHaveLength(1);
    expect(migrated.series?.[0].id).toBe('series-c1');
    expect(migrated.tracks[0].clips[0].props.seriesId).toBe('series-c1');
  });

  it('gives every migrated bar a deterministic id', () => {
    const migrated = migrateProject(chartProject(BARS));
    const bars = migrated.tracks[0].clips[0].props.bars as { id: string }[];
    expect(bars.map((bar) => bar.id)).toEqual(['series-c1:0', 'series-c1:1']);
  });

  it('records a synthetic chart as a synthetic series', () => {
    const migrated = migrateProject(chartProject(BARS, 'synthetic'));
    expect(migrated.series?.[0].origin).toBe('synthetic');
  });

  it('records a manual chart as a manual series', () => {
    const migrated = migrateProject(chartProject(BARS, 'manual'));
    expect(migrated.series?.[0].origin).toBe('manual');
  });

  it('keeps the duration of a migrated document', () => {
    const migrated = migrateProject(chartProject(BARS));
    expect(migrated.durationInFrames).toBe(600);
    expect(migrated.durationMode).toBe('fixed');
  });

  it('migrates a v1 chart document to a single pane covering the whole chart', () => {
    const migrated = migrateProject(chartProject(BARS));
    const panes = migrated.tracks[0].clips[0].props.panes as {
      rect: { x: number; y: number; width: number; height: number };
      aggregation: { factor: number };
      clock: { kind: string };
    }[];
    expect(panes).toHaveLength(1);
    expect(panes[0].rect).toEqual({ x: 0, y: 0, width: 1, height: 1 });
    expect(panes[0].aggregation).toEqual({ factor: 1 });
    expect(panes[0].clock).toEqual({ kind: 'reference' });
  });

  it('is idempotent for a v2 document', () => {
    const once = migrateProject(chartProject(BARS));
    const twice = migrateProject(once);
    expect(twice).toEqual(once);
  });
});

/* ------------------------------------------------------------------ */
/* the v2 to v3 conversion                                              */
/* ------------------------------------------------------------------ */

describe('migrateProject — the v2 to v3 conversion', () => {
  const SERIES_ID = 'series-a';
  const CHART_ID = 'c-chart';
  const PANE_ID = 'pane-0';

  /** Four bars whose full-series range is 4000 to 4500. */
  const BARS = [
    { t: 0, o: 4050, h: 4100, l: 4000, c: 4080 },
    { t: 60_000, o: 4080, h: 4200, l: 4050, c: 4150 },
    { t: 120_000, o: 4150, h: 4400, l: 4120, c: 4300 },
    { t: 180_000, o: 4300, h: 4500, l: 4250, c: 4400 },
  ];

  const chartClip = (overrides: Partial<TestClip> = {}): TestClip => ({
    id: CHART_ID,
    name: 'Candlestick Chart',
    element: 'candlestickChart',
    from: 100,
    durationInFrames: 300,
    props: {
      seriesId: SERIES_ID,
      panes: [
        {
          id: PANE_ID,
          seriesId: SERIES_ID,
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
        id: 'clock-1',
        unit: 'logical',
        referenceSeriesId: SERIES_ID,
        stepBars: 1,
        framesPerStep: 15,
      },
      width: 1100,
      height: 560,
      x: 960,
      y: 690,
    },
    effects: [],
    ...overrides,
  });

  /** A version 2 drawing, anchored to the chart above. */
  const drawingClip = (
    element: ElementType,
    props: Record<string, unknown>,
    overrides: Partial<TestClip> = {},
  ): TestClip => ({
    id: `c-${element}`,
    name: element,
    element,
    from: 100,
    durationInFrames: 300,
    props: {
      chartClipId: CHART_ID,
      paneId: PANE_ID,
      anchors: {},
      in: 0,
      out: 0,
      opacity: 1,
      style: { color: '#e8eaf0', lineWidth: 1.5 },
      x: 960,
      y: 690,
      width: 1100,
      height: 560,
      ...props,
    },
    effects: [],
    propsVersion: 1,
    ...overrides,
  });

  const v2Document = (drawings: TestClip[], chartOverrides: Partial<TestClip> = {}): TestDoc => ({
    name: 'V2',
    width: 1920,
    height: 1080,
    fps: 30,
    durationInFrames: 600,
    backgroundColor: '#000000',
    schemaVersion: 2,
    series: [
      {
        id: SERIES_ID,
        origin: 'manual',
        label: 'Series A',
        timeBasis: 'logical',
        bars: BARS,
      },
    ],
    tracks: [
      {
        id: 't1',
        name: 'Track 1',
        clips: [chartClip(chartOverrides), ...drawings],
      },
    ],
  });

  /** The migrated drawing clip of a document. */
  const migratedDrawing = (doc: TestDoc, id: string) => {
    const migrated = migrateProject(doc);
    const clip = migrated.tracks
      .flatMap((track) => track.clips)
      .find((entry) => entry.id === id);
    if (!clip) throw new Error(`no clip ${id} in the migrated document`);
    return clip;
  };

  it('migrates a v2 document to v4', () => {
    const migrated = migrateProject(v2Document([]));
    expect(migrated.schemaVersion).toBe(4);
  });

  it('maps a migrated price line to a horizontal line', () => {
    const clip = migratedDrawing(
      v2Document([
        drawingClip('priceLine' as ElementType, { anchors: { price: { kind: 'price', price: 4200 } } }),
      ]),
      'c-priceLine',
    );
    expect(clip.element).toBe('horizontalLine');
  });

  it('maps a migrated price zone to a rectangle', () => {
    const clip = migratedDrawing(
      v2Document([
        drawingClip('priceZone' as ElementType, {
          anchors: {
            top: { kind: 'price', price: 4400 },
            bottom: { kind: 'price', price: 4100 },
          },
        }),
      ]),
      'c-priceZone',
    );
    expect(clip.element).toBe('rectangle');
  });

  it("keeps the other four drawing kinds' names", () => {
    const kinds: ElementType[] = ['verticalLine', 'trendline', 'arrow', 'position'];
    const doc = v2Document(
      kinds.map((kind) =>
        drawingClip(kind, {
          anchors: {
            high: { kind: 'candle', barId: `${SERIES_ID}:1`, side: 'high' },
            low: { kind: 'candle', barId: `${SERIES_ID}:1`, side: 'low' },
            bar: { kind: 'time', barId: `${SERIES_ID}:1` },
            start: { kind: 'point', barId: `${SERIES_ID}:0`, price: 4000 },
            end: { kind: 'point', barId: `${SERIES_ID}:3`, price: 4500 },
            at: { kind: 'point', barId: `${SERIES_ID}:1`, price: 4200 },
            from: { kind: 'point', barId: `${SERIES_ID}:0`, price: 4000 },
            to: { kind: 'point', barId: `${SERIES_ID}:3`, price: 4500 },
            entry: { kind: 'price', price: 4100 },
            stop: { kind: 'price', price: 4000 },
            target: { kind: 'price', price: 4500 },
          },
        }),
      ),
    );
    const migrated = migrateProject(doc);
    const names = migrated.tracks
      .flatMap((track) => track.clips)
      .filter((clip) => clip.element !== 'candlestickChart')
      .map((clip) => clip.element);
    expect(names).toEqual(kinds);
  });

  it("keeps a migrated price line's price as its caption", () => {
    const clip = migratedDrawing(
      v2Document([
        drawingClip('priceLine' as ElementType, { anchors: { price: { kind: 'price', price: 4200 } } }),
      ]),
      'c-priceLine',
    );
    expect(clip.props.caption).toBe('4200');
  });

  it("places a migrated drawing using the chart's plot area and the full-series price range", () => {
    const clip = migratedDrawing(
      v2Document([
        drawingClip('priceLine' as ElementType, { anchors: { price: { kind: 'price', price: 4200 } } }),
      ]),
      'c-priceLine',
    );
    // The chart sits at (960, 690) with a 1100×560 box, so its plot area runs
    // from (418, 438) to (1438, 946) in composition pixels. The price 4200
    // is 40% up the full-series range 4000–4500, so it lands at y 742.8.
    expect(clip.props.x).toBeCloseTo(928, 6);
    expect(clip.props.y).toBeCloseTo(742.8, 6);
    expect(clip.props.width).toBe(1020);
    // The rule keeps its length; the band it was drawn in is gone.
    expect(clip.props.height).toBeUndefined();
  });

  it("converts a chart-relative lifecycle into the drawing's own frame range", () => {
    const clip = migratedDrawing(
      v2Document([
        drawingClip('priceLine' as ElementType, {
          anchors: { price: { kind: 'price', price: 4200 } },
          in: 10,
          out: 40,
        }),
      ]),
      'c-priceLine',
    );
    expect(clip.from).toBe(110);
    expect(clip.durationInFrames).toBe(30);
  });

  it('treats an out of zero as an open-ended range', () => {
    const clip = migratedDrawing(
      v2Document([
        drawingClip('priceLine' as ElementType, {
          anchors: { price: { kind: 'price', price: 4200 } },
          in: 0,
          out: 0,
        }),
      ]),
      'c-priceLine',
    );
    expect(clip.from).toBe(100);
    expect(clip.durationInFrames).toBe(300);
  });

  it('falls back to the stored box when the chart is missing', () => {
    const doc = v2Document([
      drawingClip('priceLine' as ElementType, {
        chartClipId: 'c-missing',
        anchors: { price: { kind: 'price', price: 4200 } },
        x: 100,
        y: 200,
        width: 300,
        height: 40,
      }),
    ]);
    const clip = migratedDrawing(doc, 'c-priceLine');
    expect(clip.props.x).toBe(100);
    expect(clip.props.y).toBe(200);
    expect(clip.props.width).toBe(300);
    expect(clip.props.height).toBeUndefined();
    expect(clip.props.caption).toBe('4200');
  });

  it('falls back to the stored box when the pane is missing', () => {
    const doc = v2Document([
      drawingClip('priceLine' as ElementType, {
        paneId: 'pane-missing',
        anchors: { price: { kind: 'price', price: 4200 } },
        x: 100,
        y: 200,
        width: 300,
        height: 40,
      }),
    ]);
    const clip = migratedDrawing(doc, 'c-priceLine');
    expect(clip.props.x).toBe(100);
    expect(clip.props.y).toBe(200);
    expect(clip.props.width).toBe(300);
    expect(clip.props.height).toBeUndefined();
  });

  it('leaves no chart-anchor props on a migrated drawing', () => {
    const clip = migratedDrawing(
      v2Document([
        drawingClip('priceLine' as ElementType, { anchors: { price: { kind: 'price', price: 4200 } } }),
      ]),
      'c-priceLine',
    );
    expect(clip.props.chartClipId).toBeUndefined();
    expect(clip.props.paneId).toBeUndefined();
    expect(clip.props.anchors).toBeUndefined();
    expect(clip.props.in).toBeUndefined();
    expect(clip.props.out).toBeUndefined();
  });

  it('leaves no retired market number on a migrated drawing', () => {
    const clip = migratedDrawing(
      v2Document([
        drawingClip('position' as ElementType, {
          anchors: {
            entry: { kind: 'price', price: 4100 },
            stop: { kind: 'price', price: 4000 },
            target: { kind: 'price', price: 4500 },
          },
          position: { direction: 'long', showRiskReward: true },
        }),
      ]),
      'c-position',
    );
    expect(clip.props.price).toBeUndefined();
    const position = clip.props.position as Record<string, unknown>;
    expect(position.entry).toBeUndefined();
    expect(position.stop).toBeUndefined();
    expect(position.target).toBeUndefined();
    expect(position.direction).toBe('long');
  });

  it('is idempotent', () => {
    const once = migrateProject(
      v2Document([
        drawingClip('priceLine' as ElementType, { anchors: { price: { kind: 'price', price: 4200 } } }),
      ]),
    );
    const twice = migrateProject(once);
    expect(twice).toEqual(once);
  });

  it('converts a v3 document to v4', () => {
    const doc: TestDoc = {
      name: 'V3',
      width: 1920,
      height: 1080,
      fps: 30,
      durationInFrames: 600,
      backgroundColor: '#000000',
      schemaVersion: 3,
      tracks: [
        {
          id: 't1',
          name: 'Track 1',
          clips: [
            {
              id: 'c-line',
              name: 'Horizontal Line',
              element: 'horizontalLine' as ElementType,
              from: 0,
              durationInFrames: 90,
              props: {
                x: 960,
                y: 540,
                width: 480,
                height: 24,
                opacity: 1,
                style: { color: '#e8eaf0', lineWidth: 1.5 },
                caption: '4200',
              },
              effects: [],
              propsVersion: 2,
            },
          ],
        },
      ],
    };
    const migrated = migrateProject(doc);
    expect(migrated.schemaVersion).toBe(4);
    const clip = migrated.tracks[0].clips[0];
    // The rule keeps its centre and its length; the band it was drawn in is
    // gone.
    expect(clip.props.x).toBe(960);
    expect(clip.props.y).toBe(540);
    expect(clip.props.width).toBe(480);
    expect(clip.props.height).toBeUndefined();
    // The creator's own figure survives.
    expect(clip.props.caption).toBe('4200');
    expect(clip.propsVersion).toBe(3);
  });
});

describe('migrateProject — the v3 to v4 conversion', () => {
  /** A version 3 document with one drawing of its own. */
  // The element is a string: a version 3 document may still carry the two
  // kinds this migration converts.
  const v3Document = (element: string, props: Record<string, unknown>): TestDoc => ({
    name: 'V3',
    width: 1920,
    height: 1080,
    fps: 30,
    durationInFrames: 300,
    backgroundColor: '#0d0d14',
    schemaVersion: 3,
    tracks: [
      {
        id: 't1',
        name: 'Track 1',
        clips: [
          {
            id: 'c-drawing',
            name: 'Drawing',
            element: element as ElementType,
            from: 0,
            durationInFrames: 90,
            props,
            effects: [],
            propsVersion: 2,
          },
        ],
      },
    ],
  });

  /** The migrated drawing clip of a document. */
  const migratedDrawing = (doc: TestDoc) => {
    const migrated = migrateProject(doc);
    const clip = migrated.tracks
      .flatMap((track) => track.clips)
      .find((entry) => entry.id === 'c-drawing');
    if (!clip) throw new Error('no drawing in the migrated document');
    return clip;
  };

  it('makes a trend line’s points places in the composition', () => {
    const clip = migratedDrawing(
      v3Document('trendline', {
        x: 960,
        y: 540,
        width: 320,
        height: 180,
        points: { start: { x: 0.25, y: 0.75 }, end: { x: 0.75, y: 0.25 } },
      }),
    );

    expect(clip.props.points).toEqual({
      start: { x: 880, y: 585 },
      end: { x: 1040, y: 495 },
    });
    // The shape is its points: the box it never used is gone.
    expect(clip.props.x).toBeUndefined();
    expect(clip.props.y).toBeUndefined();
    expect(clip.props.width).toBeUndefined();
    expect(clip.props.height).toBeUndefined();
    expect(clip.propsVersion).toBe(3);
  });

  it('keeps a rule’s centre and its length, and drops its band', () => {
    const clip = migratedDrawing(
      v3Document('horizontalLine', {
        x: 960,
        y: 690,
        width: 1020,
        height: 24,
        caption: '100.5',
      }),
    );

    expect(clip.props.x).toBe(960);
    expect(clip.props.y).toBe(690);
    expect(clip.props.width).toBe(1020);
    expect(clip.props.height).toBeUndefined();
    // The creator's own figure survives.
    expect(clip.props.caption).toBe('100.5');
    expect(clip.propsVersion).toBe(3);
  });

  it('keeps a vertical rule’s own x, its span and its length', () => {
    const clip = migratedDrawing(
      v3Document('verticalLine', {
        x: 960,
        y: 540,
        width: 24,
        height: 320,
        points: { at: { x: 0.5, y: 0.5 } },
      }),
    );

    expect(clip.props.x).toBe(960);
    expect(clip.props.y).toBe(540);
    expect(clip.props.height).toBe(320);
    expect(clip.props.width).toBeUndefined();
    expect(clip.props.points).toBeUndefined();
  });

  it('turns a text label into a text and keeps what it said', () => {
    const clip = migratedDrawing(
      v3Document('textLabel', {
        x: 960,
        y: 540,
        width: 200,
        height: 40,
        points: { at: { x: 0.5, y: 0.5 } },
        label: { text: 'Hi' },
      }),
    );

    expect(clip.element).toBe('text');
    expect(clip.props.text).toBe('Hi');
    expect(clip.props.x).toBe(960);
    expect(clip.props.y).toBe(540);
    expect(clip.props.width).toBeUndefined();
    expect(clip.props.height).toBeUndefined();
    expect(clip.props.points).toBeUndefined();
    expect(clip.props.label).toBeUndefined();
  });

  it('turns a high and low line into a trend line and keeps its two points', () => {
    const clip = migratedDrawing(
      v3Document('highLowLine', {
        x: 960,
        y: 540,
        width: 24,
        height: 160,
        points: { top: { x: 0.5, y: 0 }, bottom: { x: 0.5, y: 1 } },
      }),
    );

    expect(clip.element).toBe('trendline');
    expect(clip.props.points).toEqual({ start: { x: 960, y: 460 }, end: { x: 960, y: 620 } });
    expect(clip.props.x).toBeUndefined();
    expect(clip.props.y).toBeUndefined();
  });

  it('keeps the position tool’s box and makes its levels places', () => {
    const clip = migratedDrawing(
      v3Document('position', {
        x: 960,
        y: 540,
        width: 320,
        height: 240,
        points: {
          entry: { x: 0, y: 0.5 },
          stop: { x: 0, y: 0.75 },
          target: { x: 0, y: 0.25 },
        },
      }),
    );

    expect(clip.props.points).toEqual({
      entry: { x: 800, y: 540 },
      stop: { x: 800, y: 600 },
      target: { x: 800, y: 480 },
    });
    expect(clip.props.x).toBe(960);
    expect(clip.props.y).toBe(540);
    expect(clip.props.width).toBe(320);
    expect(clip.props.height).toBe(240);
  });

  it('leaves the rectangle’s box alone', () => {
    const clip = migratedDrawing(
      v3Document('rectangle', { x: 960, y: 540, width: 320, height: 180 }),
    );

    expect(clip.props.x).toBe(960);
    expect(clip.props.y).toBe(540);
    expect(clip.props.width).toBe(320);
    expect(clip.props.height).toBe(180);
  });

  it('keeps the keys it does not know', () => {
    const clip = migratedDrawing(
      v3Document('horizontalLine', {
        x: 960,
        y: 690,
        width: 1020,
        height: 24,
        custom: 'kept',
      }),
    );

    expect(clip.props.custom).toBe('kept');
  });

  it('leaves a drawing without its points exactly as it was', () => {
    const clip = migratedDrawing(
      v3Document('trendline', { x: 960, y: 540, width: 320, height: 180 }),
    );

    expect(clip.props.points).toBeUndefined();
    expect(clip.props.x).toBe(960);
    expect(clip.props.width).toBe(320);
    expect(clip.propsVersion).toBe(2);
  });

  it('changes nothing else in the document', () => {
    const doc = legacyProject();
    doc.schemaVersion = 3;
    const migrated = migrateProject(doc);
    expect(migrated.tracks[0].clips[0].element).toBe('text');
    expect(migrated.tracks[0].clips[0].props).toEqual({ text: 'Hi' });
  });

  it('is idempotent', () => {
    const doc = v3Document('trendline', {
      x: 960,
      y: 540,
      width: 320,
      height: 180,
      points: { start: { x: 0.25, y: 0.75 }, end: { x: 0.75, y: 0.25 } },
    });
    const once = migrateProject(doc);
    const twice = migrateProject(once);
    expect(twice).toEqual(once);
  });
});
