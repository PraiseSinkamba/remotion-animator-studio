// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import React from 'react';

import { drawingDefinitions } from './definitions';
import { chartGeometry, chartPriceRange } from '../chart';
import type { Clip, MarketAnchor, OhlcBar, Project } from '@chart-studio/core';

afterEach(() => cleanup());

const BARS = [
  { id: 'series-a:0', t: 0, o: 100, h: 110, l: 95, c: 105 },
  { id: 'series-a:1', t: 10_000, o: 105, h: 115, l: 101, c: 112 },
  { id: 'series-a:2', t: 20_000, o: 112, h: 120, l: 108, c: 118 },
  { id: 'series-a:3', t: 30_000, o: 118, h: 125, l: 114, c: 123 },
];

const CHART_ID = 'chart-1';
const FRAMES_PER_BAR = 10;

const chartProps = (overrides: Record<string, unknown> = {}) => ({
  seriesId: 'series-a',
  dataSource: 'manual',
  revealMode: 'discrete',
  framesPerBar: FRAMES_PER_BAR,
  simulationSeed: 'seed',
  symbol: 'TEST',
  timeframe: '5m',
  width: 400,
  height: 200,
  x: 100,
  y: 100,
  upColor: '#26a69a',
  downColor: '#ef5350',
  wickColor: '#9aa4b2',
  gridColor: '#333333',
  showGrid: false,
  showPriceAxis: false,
  showProvenanceBadge: false,
  panes: [
    {
      id: 'pane-0',
      seriesId: 'series-a',
      aggregation: { factor: 1 },
      rect: { x: 0, y: 0, width: 1, height: 1 },
      in: 0,
      out: 300,
      opacity: 1,
      clock: { kind: 'reference' as const },
      priceRange: { mode: 'auto' as const },
    },
  ],
  clock: {
    id: 'clock-0',
    unit: 'logical' as const,
    referenceSeriesId: 'series-a',
    stepBars: 1,
    framesPerStep: FRAMES_PER_BAR,
  },
  ...overrides,
});

const project = (chartOverrides: Record<string, unknown> = {}): Project => ({
  name: 'Project',
  width: 1920,
  height: 1080,
  fps: 30,
  durationInFrames: 300,
  backgroundColor: '#000000',
  schemaVersion: 2,
  series: [
    {
      id: 'series-a',
      origin: 'manual',
      label: 'Series A',
      timeBasis: 'logical',
      bars: BARS,
    },
  ],
  tracks: [
    {
      id: 'track-0',
      name: 'Track 0',
      clips: [
        {
          id: CHART_ID,
          name: 'Chart',
          element: 'candlestickChart',
          from: 0,
          durationInFrames: 300,
          props: chartProps(chartOverrides),
          effects: [],
        },
      ],
    },
  ],
});

const drawingClip = (props: Record<string, unknown>, overrides: Partial<Clip> = {}): Clip => ({
  id: 'drawing-1',
  name: 'Drawing',
  element: 'priceLine',
  from: 0,
  durationInFrames: 300,
  props: {
    chartClipId: CHART_ID,
    paneId: 'pane-0',
    anchors: {},
    in: 0,
    out: 0,
    opacity: 1,
    style: { color: '#ffffff', lineWidth: 1.5 },
    x: 100,
    y: 100,
    width: 400,
    height: 200,
    ...props,
  },
  effects: [],
  ...overrides,
});

const definitionFor = (type: string) => {
  const definition = drawingDefinitions.find((entry) => entry.type === type);
  if (!definition) throw new Error(`no drawing definition for ${type}`);
  return definition;
};

/** Evaluates a drawing and renders it, exactly as the composition does. */
const draw = (
  type: string,
  props: Record<string, unknown>,
  options: { sceneFrame?: number; clip?: Partial<Clip>; project?: Project } = {},
) => {
  const definition = definitionFor(type);
  const clip = drawingClip(props, options.clip);
  const sceneFrame = options.sceneFrame ?? 25;
  const evaluated = definition.evaluate?.({
    clip,
    props: clip.props,
    sceneFrame,
    project: options.project ?? project(),
  });
  const container = render(
    React.createElement(definition.render, {
      clip,
      props: clip.props,
      frame: sceneFrame,
      fps: 30,
      evaluated,
    }),
  ).container;
  return { container, clip };
};

/** The bars the pane has revealed at a frame: the clock's pace, no more. */
const revealedBars = (sceneFrame: number): OhlcBar[] =>
  BARS.slice(0, Math.min(BARS.length, Math.floor(sceneFrame / FRAMES_PER_BAR) + 1));

/** The price a y coordinate maps to, using the chart's own scale. */
const priceAt = (
  y: number,
  options: { sceneFrame?: number; chart?: Record<string, unknown> } = {},
) => {
  const sceneFrame = options.sceneFrame ?? 25;
  const props = chartProps(options.chart ?? {});
  const geometry = chartGeometry(props as never, BARS.length, props.panes[0].rect as never);
  const range = chartPriceRange(
    revealedBars(sceneFrame).map((bar) => ({
      bar,
      o: bar.o,
      h: bar.h,
      l: bar.l,
      c: bar.c,
      progress: 1,
      complete: true,
    })),
  );
  const span = range.max - range.min;
  const ratio = geometry.plotHeight > 0 ? (geometry.plotBottom - y) / geometry.plotHeight : 0.5;
  return range.min + ratio * span;
};

/** Where the drawing's svg sits on the composition, in composition pixels. */
const absoluteLeft = (container: HTMLElement, clip: Clip, chartWidth: number) => {
  const svg = container.querySelector('svg');
  const clipX = Number(clip.props.x);
  return clipX - chartWidth / 2 + Number.parseFloat(svg?.style.left ?? '0');
};

describe('the drawing tools', () => {
  it('keeps a price line on its price when the chart rect changes', () => {
    const anchors: Record<string, MarketAnchor> = { price: { kind: 'price', price: 110 } };

    const small = draw('priceLine', { anchors });
    const large = draw('priceLine', { anchors }, { project: project({ height: 400 }) });

    const smallY = Number(small.container.querySelector('line')?.getAttribute('y1'));
    const largeY = Number(large.container.querySelector('line')?.getAttribute('y1'));

    // The chart got taller, so the y coordinate moved — but both still map
    // back to the anchored price.
    expect(smallY).not.toBe(largeY);
    expect(priceAt(smallY)).toBeCloseTo(110, 6);
    expect(priceAt(largeY, { chart: { height: 400 } })).toBeCloseTo(110, 6);
  });

  it('moves a drawing with the chart clip it is anchored to', () => {
    const anchors: Record<string, MarketAnchor> = { price: { kind: 'price', price: 110 } };

    const before = draw('priceLine', { anchors });
    const after = draw('priceLine', { anchors }, { project: project({ x: 300 }) });

    // The chart moved 200 to the right; the drawing's box follows it, even
    // though the drawing clip's own stored position never changed.
    expect(absoluteLeft(after.container, after.clip, 400)).toBe(300 - 400 / 2);
    expect(absoluteLeft(before.container, before.clip, 400)).toBe(100 - 400 / 2);
  });

  it('hides a drawing anchored to a bar that has not been revealed', () => {
    const anchors: Record<string, MarketAnchor> = { bar: { kind: 'time', barId: 'series-a:3' } };

    // Five frames in, only the first bar is on screen.
    const hidden = draw('verticalLine', { anchors }, { sceneFrame: 5 });
    expect(hidden.container.querySelector('[data-testid="drawing-vertical-line"]')).toBeNull();

    const shown = draw('verticalLine', { anchors }, { sceneFrame: 35 });
    expect(shown.container.querySelector('[data-testid="drawing-vertical-line"]')).not.toBeNull();
  });

  it('keeps a zone high and low on their prices', () => {
    const anchors: Record<string, MarketAnchor> = {
      top: { kind: 'price', price: 120 },
      bottom: { kind: 'price', price: 100 },
    };

    const { container } = draw('priceZone', { anchors });
    const rect = container.querySelector('[data-testid="drawing-price-zone"] rect');
    const top = Number(rect?.getAttribute('y'));
    const height = Number(rect?.getAttribute('height'));

    expect(priceAt(top)).toBeCloseTo(120, 6);
    expect(priceAt(top + height)).toBeCloseTo(100, 6);
  });

  it('draws a trendline between its two endpoints', () => {
    const anchors: Record<string, MarketAnchor> = {
      start: { kind: 'point', barId: 'series-a:0', price: 100 },
      end: { kind: 'point', barId: 'series-a:2', price: 118 },
    };

    const { container } = draw('trendline', { anchors });
    const trend = container.querySelector('[data-testid="drawing-trendline"] line');

    expect(priceAt(Number(trend?.getAttribute('y1')))).toBeCloseTo(100, 6);
    expect(priceAt(Number(trend?.getAttribute('y2')))).toBeCloseTo(118, 6);
  });

  it('shows the position entry, stop and target and no P&L', () => {
    const anchors: Record<string, MarketAnchor> = {
      entry: { kind: 'price', price: 105 },
      stop: { kind: 'price', price: 100 },
      target: { kind: 'price', price: 115 },
    };

    const { container } = draw('position', {
      anchors,
      position: { direction: 'long', showRiskReward: true },
    });
    const text = container.textContent ?? '';

    expect(text).toContain('ENTRY');
    expect(text).toContain('STOP');
    expect(text).toContain('TARGET');
    expect(text).toContain('LONG');
    expect(text).toContain('R 2.00');
    expect(text).not.toMatch(/P&L|\$|profit/i);
  });

  it('renders a hidden drawing as nothing', () => {
    const anchors: Record<string, MarketAnchor> = { price: { kind: 'price', price: 110 } };

    const { container } = draw('priceLine', { anchors }, { clip: { hidden: true } });
    expect(container.querySelector('[data-testid="drawing-price-line"]')).toBeNull();
  });
});
