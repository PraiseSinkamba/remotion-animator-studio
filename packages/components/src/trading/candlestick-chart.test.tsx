// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

import {
  CandlestickChart,
  chartAnchorToPoint,
  chartPointToAnchor,
  type CandlestickChartProps,
  type ChartEvaluation,
} from './chart';
import { CandlestickChartInspector } from './inspectors/candlestick-chart';
import { candlestickChartDefinition } from './definitions/candlestick-chart';
import { generateSyntheticBars, type OhlcBar } from '@chart-studio/core';
import { getComponent } from '@chart-studio/core';
import { migrateProject } from '../project-migrate';
import type { Clip, Project, SeriesOrigin } from '@chart-studio/core';

afterEach(() => cleanup());

const BASE_PROPS: CandlestickChartProps = {
  bars: [],
  dataSource: 'manual',
  revealMode: 'discrete',
  framesPerBar: 10,
  simulationSeed: 'seed',
  symbol: 'TEST',
  timeframe: '5m',
  width: 400,
  height: 200,
  x: 0,
  y: 0,
  upColor: '#26a69a',
  downColor: '#ef5350',
  wickColor: '#9aa4b2',
  gridColor: '#333333',
  showGrid: true,
  showPriceAxis: true,
  showProvenanceBadge: true,
};

const draw = (props: CandlestickChartProps, frame: number) =>
  render(<CandlestickChart props={props} frame={frame} />).container;

const candles = (container: HTMLElement) => container.querySelectorAll('[data-testid="candle"]');
const bodies = (container: HTMLElement) => container.querySelectorAll('[data-testid="candle-body"]');
const priceLabels = (container: HTMLElement) =>
  Array.from(container.querySelectorAll('[data-testid="price-label"]')).map((n) => n.textContent ?? '');

const SERIES: OhlcBar[] = generateSyntheticBars({
  count: 5,
  startPrice: 100,
  seed: 'series',
  timeframeMs: 60_000,
});

describe('candlestick chart — what is on screen', () => {
  it('draws one candle at frame 0 and never a future one', () => {
    const props = { ...BASE_PROPS, bars: SERIES };
    const container = draw(props, 0);
    expect(candles(container)).toHaveLength(1);
    expect(candles(container)[0].getAttribute('data-index')).toBe('0');
  });

  it('reveals one more candle every framesPerBar frames', () => {
    const props = { ...BASE_PROPS, bars: SERIES, framesPerBar: 10 };
    for (let k = 0; k < SERIES.length; k++) {
      const container = draw(props, k * props.framesPerBar);
      expect(candles(container), `frame ${k * props.framesPerBar}`).toHaveLength(k + 1);
    }
  });

  it('stops at the end of the series', () => {
    const props = { ...BASE_PROPS, bars: SERIES, framesPerBar: 10 };
    expect(candles(draw(props, 10_000))).toHaveLength(SERIES.length);
  });

  it('never lets a future bar move the price scale', () => {
    const props = { ...BASE_PROPS, bars: SERIES, framesPerBar: 10 };
    const first = priceLabels(draw(props, 0));
    expect(first).toHaveLength(5);
    // The top of the scale is the high of the first bar only.
    expect(first[0]).toBe(SERIES[0].h.toFixed(2));
    const later = priceLabels(draw(props, 10));
    expect(later[0]).toBe(Math.max(SERIES[0].h, SERIES[1].h).toFixed(2));
  });

  it('spreads the grid when the visible price is still flat', () => {
    // A simulated bar at progress 0 is a single point: the scale would collapse
    // onto one price and every grid line would land on the same y.
    const props = { ...BASE_PROPS, bars: SERIES, revealMode: 'simulated' as const, framesPerBar: 10 };
    const labels = priceLabels(draw(props, 0));
    expect(labels).toHaveLength(5);
    expect(new Set(labels).size).toBe(5);
  });

  it('maps the open and close of a known bar to the body rectangle', () => {
    const bar: OhlcBar = { id: 'b0', t: 0, o: 10, h: 20, l: 5, c: 15 };
    const props = { ...BASE_PROPS, bars: [bar] };
    const container = draw(props, 0);

    // Layout: padding 8, label row 28, provenance row 24, price axis 64.
    const plotTop = 28;
    const plotBottom = 200 - 24;
    const y = (price: number) => plotBottom - ((price - bar.l) / (bar.h - bar.l)) * (plotBottom - plotTop);

    const body = bodies(container)[0];
    expect(Number(body.getAttribute('y'))).toBeCloseTo(y(bar.c), 6);
    expect(Number(body.getAttribute('height'))).toBeCloseTo(y(bar.o) - y(bar.c), 6);
    expect(body.getAttribute('fill')).toBe(BASE_PROPS.upColor);
  });

  it('gives a doji a visible body', () => {
    const bar: OhlcBar = { id: 'b0', t: 0, o: 10, h: 20, l: 5, c: 10 };
    const container = draw({ ...BASE_PROPS, bars: [bar] }, 0);
    expect(Number(bodies(container)[0].getAttribute('height'))).toBeGreaterThanOrEqual(1);
  });

  it('colours a falling bar with the down colour', () => {
    const bar: OhlcBar = { id: 'b0', t: 0, o: 20, h: 20, l: 5, c: 10 };
    const container = draw({ ...BASE_PROPS, bars: [bar] }, 0);
    expect(bodies(container)[0].getAttribute('fill')).toBe(BASE_PROPS.downColor);
  });

  it('renders an empty svg for an empty series', () => {
    const container = draw({ ...BASE_PROPS, bars: [] }, 0);
    expect(candles(container)).toHaveLength(0);
    expect(container.querySelector('svg')).not.toBeNull();
  });
});

describe('candlestick chart — simulated reveal', () => {
  const bar: OhlcBar = { id: 'b0', t: 0, o: 100, h: 110, l: 95, c: 105 };
  const props = {
    ...BASE_PROPS,
    bars: [bar],
    framesPerBar: 10,
    revealMode: 'simulated' as const,
    simulationSeed: 's5',
  };

  it('grows the body towards the final close and moves the close off the open', () => {
    const mid = bodies(draw(props, 4))[0];
    const final = bodies(draw(props, 9))[0];
    const midHeight = Number(mid.getAttribute('height'));
    const finalHeight = Number(final.getAttribute('height'));
    expect(midHeight).toBeGreaterThan(0);
    expect(midHeight).toBeLessThan(finalHeight);
  });

  it('shows the same final bar as the discrete mode at the end of the slot', () => {
    const simulated = bodies(draw(props, 9))[0];
    const discrete = bodies(draw({ ...props, revealMode: 'discrete' }, 9))[0];
    expect(Number(simulated.getAttribute('height'))).toBeCloseTo(
      Number(discrete.getAttribute('height')),
      6,
    );
  });

  it('moves the close away from the open inside the bar', () => {
    // At progress 0 the close is the open, so the body is degenerate.
    const first = bodies(draw(props, 0))[0];
    expect(Number(first.getAttribute('height'))).toBe(1);
    // Halfway through the bar the close has left the open.
    const mid = bodies(draw(props, 4))[0];
    expect(Number(mid.getAttribute('height'))).toBeGreaterThan(1);
  });

  it('shows a complete bar from the first frame in discrete mode', () => {
    const discrete = { ...props, revealMode: 'discrete' as const };
    const container = draw(discrete, 0);

    const plotTop = 28;
    const plotBottom = 200 - 24;
    const y = (price: number) =>
      plotBottom - ((price - bar.l) / (bar.h - bar.l)) * (plotBottom - plotTop);

    const body = bodies(container)[0];
    expect(Number(body.getAttribute('y'))).toBeCloseTo(y(bar.c), 6);
    expect(Number(body.getAttribute('height'))).toBeCloseTo(y(bar.o) - y(bar.c), 6);

    const wick = container.querySelector('[data-testid="candle-wick"]');
    expect(Number(wick?.getAttribute('y1'))).toBeCloseTo(y(bar.h), 6);
    expect(Number(wick?.getAttribute('y2'))).toBeCloseTo(y(bar.l), 6);
  });
});

describe('candlestick chart — provenance', () => {
  it('labels synthetic data', () => {
    const container = draw({ ...BASE_PROPS, bars: SERIES, dataSource: 'synthetic' }, 0);
    expect(container.querySelector('[data-testid="provenance"]')?.textContent).toBe('SYNTHETIC DATA');
  });

  it('labels a simulated reveal', () => {
    const container = draw(
      { ...BASE_PROPS, bars: SERIES, dataSource: 'manual', revealMode: 'simulated' },
      0,
    );
    expect(container.querySelector('[data-testid="provenance"]')?.textContent).toBe(
      'SIMULATED INTRABAR',
    );
  });

  it('joins both labels', () => {
    const container = draw(
      { ...BASE_PROPS, bars: SERIES, dataSource: 'synthetic', revealMode: 'simulated' },
      0,
    );
    expect(container.querySelector('[data-testid="provenance"]')?.textContent).toBe(
      'SYNTHETIC DATA · SIMULATED INTRABAR',
    );
  });

  it('shows nothing for manual data revealed discretely', () => {
    const container = draw(
      { ...BASE_PROPS, bars: SERIES, dataSource: 'manual', revealMode: 'discrete' },
      0,
    );
    expect(container.querySelector('[data-testid="provenance"]')).toBeNull();
    expect(container.textContent).not.toContain('SYNTHETIC');
  });
});

describe('candlestick chart — price axis', () => {
  it('labels the grid lines', () => {
    const labels = priceLabels(draw({ ...BASE_PROPS, bars: SERIES }, 0));
    expect(labels).toHaveLength(5);
    expect(labels.every((label) => label.length > 0)).toBe(true);
  });

  it('drops the labels when the axis is hidden', () => {
    const container = draw({ ...BASE_PROPS, bars: SERIES, showPriceAxis: false }, 0);
    expect(priceLabels(container)).toHaveLength(0);
  });
});

describe('candlestick chart — determinism', () => {
  const props = { ...BASE_PROPS, bars: SERIES, revealMode: 'simulated' as const };

  it('renders the same frame identically twice', () => {
    expect(draw(props, 37).innerHTML).toBe(draw(props, 37).innerHTML);
  });

  it('renders a seeked frame exactly like a fresh render of it', () => {
    const fresh = draw(props, 37).innerHTML;
    draw(props, 100);
    expect(draw(props, 37).innerHTML).toBe(fresh);
  });
});

describe('candlestick chart — registry definition', () => {
  it('registers itself on import', () => {
    expect(getComponent('candlestickChart')).toBe(candlestickChartDefinition);
  });

  it('describes itself as a trading component', () => {
    const definition = candlestickChartDefinition;
    expect(definition.category).toBe('trading');
    expect(definition.label).toBe('Candlestick Chart');
    expect(definition.icon.length).toBeGreaterThan(0);
    expect(definition.description.length).toBeGreaterThan(0);
    expect(definition.propsVersion).toBe(1);
  });

  it('defaults to a deterministic synthetic series', () => {
    const defaults = candlestickChartDefinition.defaults;
    expect(defaults.bars).toHaveLength(12);
    expect(defaults.dataSource).toBe('synthetic');
    expect(defaults.revealMode).toBe('simulated');
    expect(defaults.framesPerBar).toBe(15);
    expect(defaults.simulationSeed).toBe('chart-1');
    expect(defaults.symbol).toBe('SYNTH');
    expect(defaults.timeframe).toBe('5m');
  });

  it('survives a JSON round-trip', () => {
    const defaults = candlestickChartDefinition.defaults;
    expect(JSON.parse(JSON.stringify(defaults))).toEqual(defaults);
  });

  it('exposes a param for every editable prop except the series', () => {
    const keys = candlestickChartDefinition.params.map((param) => param.key);
    for (const key of [
      'revealMode',
      'framesPerBar',
      'simulationSeed',
      'symbol',
      'timeframe',
      'width',
      'height',
      'upColor',
      'downColor',
      'wickColor',
      'gridColor',
      'showGrid',
      'showPriceAxis',
      'showProvenanceBadge',
      'x',
      'y',
    ]) {
      expect(keys, key).toContain(key);
    }
    expect(keys).not.toContain('bars');
  });

  it('derives its duration from the series', () => {
    const duration = candlestickChartDefinition.defaultDuration as (props: unknown) => number;
    expect(duration(candlestickChartDefinition.defaults)).toBe(12 * 15);
  });
});

describe('candlestick chart — project round-trip', () => {
  it('survives JSON.stringify and migrateProject with the bars intact', () => {
    const props = { ...candlestickChartDefinition.defaults };
    const project: Project = {
      name: 'chart project',
      width: 1920,
      height: 1080,
      fps: 30,
      durationInFrames: 600,
      backgroundColor: '#000000',
      schemaVersion: 1,
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
              props,
              effects: [],
              propsVersion: 1,
            },
          ],
        },
      ],
    };

    const migrated = migrateProject(JSON.parse(JSON.stringify(project)));
    // The migration lifts the bars into a project-level series and adds the
    // chart's v2 props. The bars themselves stay on the clip as an inert
    // compatibility key, so the renderer keeps reading them unchanged. Their
    // prices are untouched; only the id becomes the series-scoped one.
    expect(migrated.schemaVersion).toBe(2);
    const migratedBars = migrated.tracks[0].clips[0].props.bars as OhlcBar[];
    expect(migratedBars.map((b: OhlcBar) => [b.t, b.o, b.h, b.l, b.c])).toEqual(
      props.bars.map((b: OhlcBar) => [b.t, b.o, b.h, b.l, b.c]),
    );
    expect(migratedBars[0].id).toBe('series-c1:0');
    expect(migrated.series).toHaveLength(1);
    expect(migrated.series?.[0].origin).toBe('synthetic');
  });

  it('renders the migrated chart identically to the v1 chart', (): void => {
    const props = { ...candlestickChartDefinition.defaults };
    const v1Project: Project = {
      name: 'chart project',
      width: 1920,
      height: 1080,
      fps: 30,
      durationInFrames: 600,
      backgroundColor: '#000000',
      schemaVersion: 1,
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
              props,
              effects: [],
              propsVersion: 1,
            },
          ],
        },
      ],
    };

    const migrated = migrateProject(JSON.parse(JSON.stringify(v1Project)));
    const v1Props = v1Project.tracks[0].clips[0].props as unknown as CandlestickChartProps;
    const migratedProps = migrated.tracks[0].clips[0].props as unknown as CandlestickChartProps;

    for (const frame of [0, 45, 90]) {
      const before = draw(v1Props, frame).innerHTML;
      const after = draw(migratedProps, frame).innerHTML;
      expect(after).toBe(before);
    }
  });
});

describe('candlestick chart — inspector', () => {
  const bars: OhlcBar[] = [
    { id: 'b0', t: 0, o: 100, h: 110, l: 95, c: 105 },
    { id: 'b1', t: 60_000, o: 105, h: 112, l: 101, c: 108 },
    { id: 'b2', t: 120_000, o: 108, h: 115, l: 104, c: 112 },
  ];

  const setup = () => {
    const props = { ...candlestickChartDefinition.defaults, bars, framesPerBar: 10 };
    const clip: Clip = {
      id: 'c1',
      name: 'Candlestick Chart',
      element: 'candlestickChart',
      from: 0,
      durationInFrames: 90,
      props,
      effects: [],
      propsVersion: 1,
    };
    const calls: string[] = [];
    const onChange = vi.fn((_patch: Record<string, unknown>) => calls.push('onChange'));
    const commit = vi.fn(() => calls.push('commit'));
    const updateClip = vi.fn((_patch: Partial<Pick<Clip, 'from' | 'durationInFrames' | 'name'>>) =>
      calls.push('updateClip'),
    );
    render(
      <CandlestickChartInspector
        clip={clip}
        props={props}
        onChange={onChange}
        updateClip={updateClip}
        commit={commit}
      />,
    );
    return { onChange, commit, updateClip, calls };
  };

  it('renders one row per bar', () => {
    setup();
    expect(screen.getAllByTestId('chart-bar-row')).toHaveLength(bars.length);
  });

  it('keeps the bar valid when a cell is edited', () => {
    const { onChange, calls } = setup();
    fireEvent.change(screen.getByLabelText('bar 1 C'), { target: { value: '500' } });

    const patch = onChange.mock.calls[0][0] as { bars: OhlcBar[]; dataSource: string };
    const edited = patch.bars[0];
    expect(edited.c).toBe(500);
    expect(edited.h).toBeGreaterThanOrEqual(Math.max(edited.o, edited.c));
    expect(edited.l).toBeLessThanOrEqual(Math.min(edited.o, edited.c));
    expect(patch.dataSource).toBe('manual');
    expect(calls).toEqual(['commit', 'onChange']);
  });

  it('lowers a low that is pushed above the close', () => {
    const { onChange } = setup();
    fireEvent.change(screen.getByLabelText('bar 1 L'), { target: { value: '400' } });
    const patch = onChange.mock.calls[0][0] as { bars: OhlcBar[] };
    expect(patch.bars[0].l).toBeLessThanOrEqual(Math.min(patch.bars[0].o, patch.bars[0].c));
  });

  it('adds and removes bars', () => {
    const { onChange } = setup();
    fireEvent.click(screen.getByText('+ Add bar'));
    const added = onChange.mock.calls[0][0] as { bars: OhlcBar[] };
    expect(added.bars).toHaveLength(bars.length + 1);
    expect(added.bars[bars.length].c).toBe(bars[bars.length - 1].c);

    fireEvent.click(screen.getByLabelText('Remove bar 2'));
    const removed = onChange.mock.calls[1][0] as { bars: OhlcBar[] };
    expect(removed.bars).toHaveLength(bars.length - 1);
    expect(removed.bars[1]).toEqual(bars[2]);
  });

  it('shows the frames the series needs and fits the clip to it', () => {
    const { updateClip, commit } = setup();
    expect(screen.getByText(/3 bars × 10 frames = 30 frames needed/)).not.toBeNull();
    fireEvent.click(screen.getByText('Fit clip length to bars'));
    expect(updateClip).toHaveBeenCalledWith({ durationInFrames: 30 });
    expect(commit).toHaveBeenCalled();
  });

  it('generates a synthetic series', () => {
    const { onChange } = setup();
    fireEvent.change(screen.getByLabelText('Generator bar count'), { target: { value: '4' } });
    fireEvent.click(screen.getByText('⟳ Generate'));
    const patch = onChange.mock.calls[0][0] as { bars: OhlcBar[]; dataSource: string };
    expect(patch.bars).toHaveLength(4);
    expect(patch.dataSource).toBe('synthetic');
  });
});

describe('the chart driven by the project registry', () => {
  const SERIES_BARS: OhlcBar[] = [
    { id: 'series-a:0', t: 0, o: 100, h: 110, l: 95, c: 105 },
    { id: 'series-a:1', t: 10_000, o: 105, h: 115, l: 101, c: 112 },
    { id: 'series-a:2', t: 20_000, o: 112, h: 120, l: 108, c: 118 },
    { id: 'series-a:3', t: 30_000, o: 118, h: 125, l: 114, c: 123 },
  ];

  const project = (): Project => ({
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
        bars: SERIES_BARS,
      },
    ],
    tracks: [],
  });

  const chartProps = (): CandlestickChartProps =>
    ({
      ...BASE_PROPS,
      bars: SERIES_BARS,
      dataSource: 'manual',
      revealMode: 'discrete',
      framesPerBar: 10,
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
        framesPerStep: 10,
      },
    }) as unknown as CandlestickChartProps;

  const evaluate = (props: CandlestickChartProps, sceneFrame: number) =>
    candlestickChartDefinition.evaluate?.({
      clip: { from: 0, durationInFrames: 300 } as Clip,
      props: props as unknown as Record<string, unknown>,
      sceneFrame,
      project: project(),
    });

  it('renders the same candles from the evaluated pane state as from the inline bars', () => {
    const props = chartProps();
    const evaluated = evaluate(props, 25);

    const fromInline = render(
      <CandlestickChart props={{ ...props, bars: SERIES_BARS }} frame={25} />,
    ).container;
    const fromEvaluated = render(
      <CandlestickChart props={props} frame={25} evaluated={evaluated} />,
    ).container;

    expect(candles(fromEvaluated).length).toBe(candles(fromInline).length);
    expect(
      Array.from(candles(fromEvaluated)).map((n) => n.getAttribute('data-index')),
    ).toEqual(Array.from(candles(fromInline)).map((n) => n.getAttribute('data-index')));
  });

  it('renders no future candle from the evaluated pane state', () => {
    const props = chartProps();
    const evaluated = evaluate(props, 12);

    const container = render(
      <CandlestickChart props={props} frame={12} evaluated={evaluated} />,
    ).container;

    // Twelve frames at ten frames per bar is the second bar.
    expect(candles(container).length).toBe(2);
  });

  it('labels the series origin from the evaluated provenance', () => {
    const props = chartProps();
    const evaluated = evaluate(props, 25);

    const container = render(
      <CandlestickChart props={props} frame={25} evaluated={evaluated} />,
    ).container;

    // A manual series is not labelled as synthetic.
    expect(container.querySelector('[data-testid="provenance"]')).toBeNull();
  });

  it('keeps the other panes when one pane names a binding the data cannot honour', () => {
    const props = chartProps();
    const basePane = props.panes?.[0];
    const withUtcPane = {
      ...props,
      panes: [
        { ...basePane, id: 'pane-utc', clock: { kind: 'utc' as const } },
        { ...basePane, id: 'pane-ok' },
      ],
    };

    // One bad pane must not take the whole frame down.
    let evaluated: unknown;
    expect(() => {
      evaluated = evaluate(withUtcPane as CandlestickChartProps, 25);
    }).not.toThrow();

    const panes = (evaluated as ChartEvaluation).panes;
    expect(panes).toHaveLength(2);
    expect(panes[0].bars).toHaveLength(0);
    expect(panes[1].bars.length).toBeGreaterThan(0);
  });

  it('labels an authored path as an authored path', () => {
    const authoredProject: Project = {
      ...project(),
      series: [
        {
          id: 'series-a',
          origin: 'authored-path',
          label: 'Authored',
          timeBasis: 'logical',
          seed: 'seed',
          algorithmVersion: 1,
          path: {
            anchors: [
              { id: 'a0', barIndex: 0, price: 100 },
              { id: 'a1', barIndex: 3, price: 120 },
            ],
          },
        },
      ],
    };
    const props = chartProps();
    const evaluated = candlestickChartDefinition.evaluate?.({
      clip: { from: 0, durationInFrames: 300 } as Clip,
      props: props as unknown as Record<string, unknown>,
      sceneFrame: 25,
      project: authoredProject,
    });

    const container = render(
      <CandlestickChart props={props} frame={25} evaluated={evaluated} />,
    ).container;

    expect(container.querySelector('[data-testid="provenance"]')?.textContent).toContain(
      'AUTHORED PATH',
    );
  });
});

describe('the transport actions the chart declares', () => {
  it('declares a hold the shell can execute without knowing what a chart is', () => {
    const actions = candlestickChartDefinition.transportActions ?? [];

    expect(actions.length).toBeGreaterThan(0);
    const hold = actions.find((action) => action.toggle === 'hold');
    expect(hold).toBeDefined();
    expect(hold!.kind).toBe('toggle');
    expect(hold!.label.length).toBeGreaterThan(0);
    expect(hold!.icon.length).toBeGreaterThan(0);
  });
});

describe('the provenance labels', () => {
  const bars: OhlcBar[] = [
    { id: 'b0', t: 0, o: 100, h: 110, l: 95, c: 105 },
    { id: 'b1', t: 1, o: 105, h: 115, l: 101, c: 112 },
  ];

  const labelFor = (origin: SeriesOrigin): string | null => {
    const props = { ...BASE_PROPS, bars } as CandlestickChartProps;
    const container = render(
      <CandlestickChart
        props={props}
        frame={0}
        evaluated={{
          panes: [
            {
              bars: bars.map((bar) => ({
                bar,
                o: bar.o,
                h: bar.h,
                l: bar.l,
                c: bar.c,
                progress: 1,
                complete: true,
              })),
              totalBars: bars.length,
              developing: false,
              rect: { x: 0, y: 0, width: 1, height: 1 },
            },
          ],
          provenance: { origin, revision: 'r', label: 'Series' },
        }}
      />,
    ).container;
    return container.querySelector('[data-testid="provenance"]')?.textContent ?? null;
  };

  it('keeps the provenance labels of every origin distinct', () => {
    const labels = {
      'authored-path': labelFor('authored-path'),
      synthetic: labelFor('synthetic'),
      imported: labelFor('imported'),
      manual: labelFor('manual'),
    };

    // Every origin but manual carries a label, and no two of them agree.
    expect(labels['authored-path']).toBe('AUTHORED PATH');
    expect(labels.synthetic).toBe('SYNTHETIC DATA');
    expect(labels.imported).toBe('IMPORTED');
    expect(labels.manual).toBeNull();

    const shown = [labels['authored-path'], labels.synthetic, labels.imported];
    expect(new Set(shown).size).toBe(shown.length);
  });
});

describe('the provenance badge of an authored path', () => {
  const authoredEvaluation = (): unknown => {
    const props = {
      ...BASE_PROPS,
      bars: [{ id: 'b0', t: 0, o: 100, h: 110, l: 95, c: 105 }],
      dataSource: 'synthetic',
      revealMode: 'simulated',
    } as CandlestickChartProps;
    return {
      panes: [
        {
          bars: [
            {
              bar: { id: 'b0', t: 0, o: 100, h: 110, l: 95, c: 105 },
              o: 100,
              h: 110,
              l: 95,
              c: 105,
              progress: 1,
              complete: true,
            },
          ],
          totalBars: 1,
          developing: false,
          rect: { x: 0, y: 0, width: 1, height: 1 },
        },
      ],
      provenance: {
        origin: 'authored-path',
        revision: 'abc123',
        label: 'Authored path',
      },
    };
  };

  it('labels an authored path series AUTHORED PATH', () => {
    const container = render(
      <CandlestickChart
        props={BASE_PROPS as CandlestickChartProps}
        frame={0}
        evaluated={authoredEvaluation()}
      />,
    ).container;
    expect(container.querySelector('[data-testid="provenance"]')?.textContent).toContain(
      'AUTHORED PATH',
    );
  });

  it('keeps the badge when the reveal is simulated', () => {
    const container = render(
      <CandlestickChart
        props={{ ...BASE_PROPS, revealMode: 'simulated' } as CandlestickChartProps}
        frame={0}
        evaluated={authoredEvaluation()}
      />,
    ).container;
    expect(container.querySelector('[data-testid="provenance"]')?.textContent).toContain(
      'SIMULATED INTRABAR',
    );
  });
});

describe('the geometry the path tool points with', () => {
  const props: CandlestickChartProps = {
    ...BASE_PROPS,
    width: 720,
    height: 420,
    bars: [
      { id: 'b0', t: 0, o: 100, h: 110, l: 95, c: 105 },
      { id: 'b1', t: 1, o: 105, h: 115, l: 101, c: 112 },
      { id: 'b2', t: 2, o: 112, h: 120, l: 108, c: 118 },
    ],
    revealMode: 'discrete',
  };

  const pane = () => ({
    bars: props.bars.map((bar) => ({
      bar,
      o: bar.o,
      h: bar.h,
      l: bar.l,
      c: bar.c,
      progress: 1,
      complete: true,
    })),
    totalBars: 3,
  });

  it('maps a point on the chart to the bar and price it names', () => {
    const anchor = chartPointToAnchor(props, pane(), { x: 200, y: 200 });
    expect(anchor).not.toBeNull();
    expect(anchor!.barIndex).toBe(0);
    expect(anchor!.price).toBeGreaterThan(props.bars[0].l);
    expect(anchor!.price).toBeLessThan(props.bars[0].h);
  });

  it('maps an anchor back to the point it came from', () => {
    const anchor = { barIndex: 1, price: 108 };
    const point = chartAnchorToPoint(props, pane(), anchor);
    const back = chartPointToAnchor(props, pane(), point);
    expect(back!.barIndex).toBe(anchor.barIndex);
    expect(back!.price).toBeCloseTo(anchor.price, 6);
  });

  it('snaps a point to the bar it falls in', () => {
    const first = chartPointToAnchor(props, pane(), { x: 20, y: 200 });
    const second = chartPointToAnchor(props, pane(), { x: 240, y: 200 });
    expect(first!.barIndex).toBe(0);
    expect(second!.barIndex).toBe(1);
  });

  it('gives a point outside the plot the price at the edge of the range', () => {
    const above = chartPointToAnchor(props, pane(), { x: 200, y: -500 });
    const below = chartPointToAnchor(props, pane(), { x: 200, y: 5000 });
    expect(above!.price).toBeGreaterThan(below!.price);
  });
});

describe('the shared cursor', () => {
  const SERIES_BARS: OhlcBar[] = [
    { id: 'series-a:0', t: 0, o: 100, h: 110, l: 95, c: 105 },
    { id: 'series-a:1', t: 10_000, o: 105, h: 115, l: 101, c: 112 },
    { id: 'series-a:2', t: 20_000, o: 112, h: 120, l: 108, c: 118 },
    { id: 'series-a:3', t: 30_000, o: 118, h: 125, l: 114, c: 123 },
  ];

  const project = (): Project => ({
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
        bars: SERIES_BARS,
      },
    ],
    tracks: [],
  });

  const pane = (id: string, rect: { x: number; y: number; width: number; height: number }) => ({
    id,
    name: id,
    seriesId: 'series-a',
    aggregation: { factor: 1 },
    rect,
    in: 0,
    out: 300,
    opacity: 1,
    clock: { kind: 'reference' as const },
    priceRange: { mode: 'auto' as const },
  });

  const chartProps = (): CandlestickChartProps =>
    ({
      ...BASE_PROPS,
      bars: SERIES_BARS,
      dataSource: 'manual',
      revealMode: 'discrete',
      framesPerBar: 10,
      seriesId: 'series-a',
      panes: [
        pane('pane-0', { x: 0, y: 0, width: 1, height: 0.5 }),
        pane('pane-1', { x: 0, y: 0.5, width: 1, height: 0.5 }),
      ],
      clock: {
        id: 'clock-0',
        unit: 'logical',
        referenceSeriesId: 'series-a',
        stepBars: 1,
        framesPerStep: 10,
      },
    }) as unknown as CandlestickChartProps;

  const evaluate = (props: CandlestickChartProps, sceneFrame: number) =>
    candlestickChartDefinition.evaluate?.({
      clip: { from: 0, durationInFrames: 300 } as Clip,
      props: props as unknown as Record<string, unknown>,
      sceneFrame,
      project: project(),
    });

  const cursors = (container: HTMLElement) =>
    Array.from(container.querySelectorAll('[data-testid="clock-cursor"]'));

  it('draws one cursor per pane', () => {
    const props = chartProps();
    const container = render(
      <CandlestickChart props={props} frame={25} evaluated={evaluate(props, 25)} />,
    ).container;

    expect(cursors(container)).toHaveLength(2);
  });

  it('moves the cursor with the clock', () => {
    const props = chartProps();
    const early = render(
      <CandlestickChart props={props} frame={5} evaluated={evaluate(props, 5)} />,
    ).container;
    const late = render(
      <CandlestickChart props={props} frame={25} evaluated={evaluate(props, 25)} />,
    ).container;

    const earlyX = Number(cursors(early)[0].getAttribute('x1'));
    const lateX = Number(cursors(late)[0].getAttribute('x1'));
    expect(lateX).toBeGreaterThan(earlyX);
  });

  it('draws no cursor on a chart without a clock', () => {
    const props = { ...BASE_PROPS, bars: SERIES_BARS } as CandlestickChartProps;
    const container = render(<CandlestickChart props={props} frame={25} />).container;

    expect(cursors(container)).toHaveLength(0);
  });

  it('draws no cursor on a chart with a single pane', () => {
    // The cursor is a *shared* one: with one pane there is nothing to relate
    // it to, and the playhead already says where the composition is.
    const props = chartProps();
    const single = { ...props, panes: [props.panes![0]] } as CandlestickChartProps;
    const container = render(
      <CandlestickChart props={single} frame={25} evaluated={evaluate(single, 25)} />,
    ).container;

    expect(cursors(container)).toHaveLength(0);
  });

  it('draws the cursor in the chart own box', () => {
    const props = chartProps();
    const container = render(
      <CandlestickChart props={props} frame={25} evaluated={evaluate(props, 25)} />,
    ).container;

    const cursor = cursors(container)[0];
    const x = Number(cursor.getAttribute('x1'));
    expect(x).toBeGreaterThan(0);
    expect(x).toBeLessThan(props.width);
  });
});

describe('the pane and relation panel', () => {
  const pane = (
    id: string,
    seriesId: string,
    rung: string,
    factor: number,
  ) => ({
    id,
    name: id,
    seriesId,
    timeframeId: rung,
    aggregation: { factor },
    rect: { x: 0, y: 0, width: 1, height: 1 },
    in: 0,
    out: 300,
    opacity: 1,
    clock: { kind: 'reference' as const },
    priceRange: { mode: 'auto' as const },
  });

  const setup = (panes: unknown[], relations: unknown[] = []) => {
    const props = {
      ...candlestickChartDefinition.defaults,
      panes,
      relations,
    } as unknown as Record<string, unknown>;
    const clip: Clip = {
      id: 'c1',
      name: 'Candlestick Chart',
      element: 'candlestickChart',
      from: 0,
      durationInFrames: 90,
      props: props as unknown as Clip['props'],
      effects: [],
      propsVersion: 1,
    };
    const onChange = vi.fn();
    const commit = vi.fn();
    const updateClip = vi.fn();
    render(
      <CandlestickChartInspector
        clip={clip}
        props={props}
        onChange={onChange}
        updateClip={updateClip}
        commit={commit}
      />,
    );
    return { onChange, commit };
  };

  it('shows the derived factor of a pane against its base', () => {
    setup([pane('fine', 'series-a', '1m', 1), pane('coarse', 'series-a', '1H', 60)]);

    const factors = Array.from(screen.getAllByTestId('pane-derived-factor')).map(
      (n) => n.textContent ?? '',
    );
    // The coarse pane counts sixty source bars against the 1m base.
    expect(factors[1]).toBe('60 × 1m');
  });

  it('shows the ratio a rollup resolves to', () => {
    setup(
      [pane('fine', 'series-a', '1m', 1), pane('coarse', 'series-a', '1H', 60)],
      [{ kind: 'rollup', finePaneId: 'fine', coarsePaneId: 'coarse' }],
    );

    expect(screen.getByTestId('relation-derived').textContent).toContain('60 × 1m');
  });

  it('shows the shared rung and candle count of a lockstep', () => {
    setup(
      [pane('a', 'series-a', '1m', 1), pane('b', 'series-b', '1m', 1)],
      [{ kind: 'lockstep', paneIds: ['a', 'b'], timeframeId: '1m' }],
    );

    expect(screen.getByTestId('relation-derived').textContent).toContain('1m');
    expect(screen.getByTestId('relation-derived').textContent).toContain('120 candles');
  });

  it('labels a cross-asset link as authored rather than market time', () => {
    setup(
      [pane('a', 'series-a', '1m', 1), pane('b', 'series-b', '1m', 1)],
      [{ kind: 'lockstep', paneIds: ['a', 'b'], timeframeId: '1m' }],
    );

    expect(screen.getByTestId('authored-link-label').textContent).toBe(
      'authored link — not market time',
    );
  });

  it('labels no authored link when both panes read the same series', () => {
    setup(
      [pane('a', 'series-a', '1m', 1), pane('b', 'series-a', '1m', 1)],
      [{ kind: 'lockstep', paneIds: ['a', 'b'], timeframeId: '1m' }],
    );

    expect(screen.queryByTestId('authored-link-label')).toBeNull();
  });

  it('offers the ladder as a rung picker', () => {
    setup([pane('fine', 'series-a', '1m', 1)]);

    const picker = screen.getByLabelText('Pane 1 timeframe') as HTMLSelectElement;
    const rungs = Array.from(picker.options).map((option) => option.value);
    expect(rungs).toContain('1m');
    expect(rungs).toContain('1H');
    expect(rungs).toContain('2D');
  });

  it('says a relation needs a second pane when the chart holds one pane', () => {
    setup([pane('fine', 'series-a', '1m', 1)]);

    expect(screen.getByTestId('relation-needs-second-pane').textContent).toContain(
      'a relation needs a second pane',
    );
    // The control cannot act, so it is disabled rather than silently inert.
    const rollup = screen.getByRole('button', { name: '+ Rollup' }) as HTMLButtonElement;
    const lockstep = screen.getByRole('button', { name: '+ Lockstep' }) as HTMLButtonElement;
    expect(rollup.disabled).toBe(true);
    expect(lockstep.disabled).toBe(true);
  });

  it('does not offer a utc clock binding', () => {
    setup([pane('fine', 'series-a', '1m', 1)]);

    const picker = screen.getByLabelText('Pane 1 clock binding') as HTMLSelectElement;
    const kinds = Array.from(picker.options).map((option) => option.value);
    expect(kinds).toContain('reference');
    expect(kinds).toContain('offset');
    expect(kinds).not.toContain('utc');
  });

  it('says a hand-authored utc binding cannot be honoured instead of offering it', () => {
    setup([{ ...pane('fine', 'series-a', '1m', 1), clock: { kind: 'utc' as const } }]);

    const picker = screen.getByLabelText('Pane 1 clock binding') as HTMLSelectElement;
    expect(Array.from(picker.options).map((option) => option.value)).not.toContain('utc');
    expect(screen.getByTestId('pane-unavailable-binding').textContent).toContain(
      'cannot honour',
    );
  });

  it('derives the factor when a rung is chosen', () => {
    const { onChange, commit } = setup([pane('fine', 'series-a', '1m', 1)]);
    fireEvent.change(screen.getByLabelText('Pane 1 timeframe'), { target: { value: '5m' } });

    const patch = onChange.mock.calls[0][0] as { panes: Array<{ timeframeId: string; aggregation: { factor: number } }> };
    expect(patch.panes[0].timeframeId).toBe('5m');
    expect(patch.panes[0].aggregation.factor).toBe(5);
    expect(commit).toHaveBeenCalled();
  });
});

describe('the pause point of a pane', () => {
  const BARS: OhlcBar[] = [
    { id: 'series-h:0', t: 0, o: 100, h: 104, l: 96, c: 102 },
    { id: 'series-h:1', t: 10_000, o: 102, h: 106, l: 100, c: 104 },
    { id: 'series-h:2', t: 20_000, o: 104, h: 120, l: 80, c: 110 },
    { id: 'series-h:3', t: 30_000, o: 110, h: 112, l: 108, c: 111 },
  ];

  const project = (): Project => ({
    name: 'Project',
    width: 1920,
    height: 1080,
    fps: 30,
    durationInFrames: 300,
    backgroundColor: '#000000',
    schemaVersion: 2,
    series: [{ id: 'series-h', origin: 'manual', label: 'Series H', timeBasis: 'logical', bars: BARS }],
    tracks: [],
  });

  const chartProps = (holds?: Array<{ barId: string; in: number; out: number }>): CandlestickChartProps =>
    ({
      ...BASE_PROPS,
      bars: BARS,
      dataSource: 'manual',
      revealMode: 'discrete',
      framesPerBar: 10,
      seriesId: 'series-h',
      panes: [
        {
          id: 'pane-0',
          seriesId: 'series-h',
          aggregation: { factor: 1 },
          rect: { x: 0, y: 0, width: 1, height: 1 },
          in: 0,
          out: 300,
          opacity: 1,
          clock: { kind: 'reference' },
          priceRange: { mode: 'auto' },
          ...(holds ? { holds } : {}),
        },
      ],
      clock: {
        id: 'clock-0',
        unit: 'logical',
        referenceSeriesId: 'series-h',
        stepBars: 1,
        framesPerStep: 10,
      },
    }) as unknown as CandlestickChartProps;

  const evaluate = (props: CandlestickChartProps, sceneFrame: number) =>
    candlestickChartDefinition.evaluate?.({
      clip: { from: 0, durationInFrames: 300 } as Clip,
      props: props as unknown as Record<string, unknown>,
      sceneFrame,
      project: project(),
    });

  const markers = (container: HTMLElement) =>
    Array.from(container.querySelectorAll('[data-testid="hold-marker"]'));

  it('freezes the held candle and shows the hold marker', () => {
    const held = chartProps([{ barId: 'series-h:1', in: 10, out: 30 }]);
    const container = render(
      <CandlestickChart props={held} frame={20} evaluated={evaluate(held, 20)} />,
    ).container;

    // The hold begins on the frame the second candle appears, so the market
    // stands still on it: two candles, and no third one.
    expect(candles(container)).toHaveLength(2);
    expect(candles(container)[1].getAttribute('data-index')).toBe('1');
    // The held candle is marked.
    expect(markers(container)).toHaveLength(1);
    expect(markers(container)[0].getAttribute('data-bar')).toBe('series-h:1');
  });

  it('does not let the market advance while the hold lasts', () => {
    const held = chartProps([{ barId: 'series-h:1', in: 10, out: 30 }]);
    const frozen = render(
      <CandlestickChart props={held} frame={20} evaluated={evaluate(held, 20)} />,
    ).container;
    const moving = render(
      <CandlestickChart props={held} frame={20} evaluated={evaluate(chartProps(), 20)} />,
    ).container;

    // Without the hold the same frame shows the third candle.
    expect(candles(moving)).toHaveLength(3);
    expect(candles(frozen)).toHaveLength(2);
  });

  it('resumes the reveal after the hold', () => {
    const held = chartProps([{ barId: 'series-h:1', in: 10, out: 30 }]);
    const container = render(
      <CandlestickChart props={held} frame={40} evaluated={evaluate(held, 40)} />,
    ).container;

    // The market picks up from the held candle's successor.
    expect(candles(container)).toHaveLength(3);
    expect(candles(container)[2].getAttribute('data-index')).toBe('2');
    expect(markers(container)).toHaveLength(0);
  });
});

describe('the camera zoom of a pane', () => {
  const BARS: OhlcBar[] = [
    { id: 'series-z:0', t: 0, o: 100, h: 104, l: 96, c: 102 },
    { id: 'series-z:1', t: 10_000, o: 102, h: 106, l: 100, c: 104 },
    { id: 'series-z:2', t: 20_000, o: 104, h: 120, l: 80, c: 110 },
    { id: 'series-z:3', t: 30_000, o: 110, h: 112, l: 108, c: 111 },
  ];

  const project = (): Project => ({
    name: 'Project',
    width: 1920,
    height: 1080,
    fps: 30,
    durationInFrames: 300,
    backgroundColor: '#000000',
    schemaVersion: 2,
    series: [{ id: 'series-z', origin: 'manual', label: 'Series Z', timeBasis: 'logical', bars: BARS }],
    tracks: [],
  });

  const chartProps = (zoom?: unknown): CandlestickChartProps =>
    ({
      ...BASE_PROPS,
      bars: BARS,
      dataSource: 'manual',
      revealMode: 'discrete',
      framesPerBar: 10,
      seriesId: 'series-z',
      panes: [
        {
          id: 'pane-0',
          seriesId: 'series-z',
          aggregation: { factor: 1 },
          rect: { x: 0, y: 0, width: 1, height: 1 },
          in: 0,
          out: 300,
          opacity: 1,
          clock: { kind: 'reference' },
          priceRange: { mode: 'auto' },
          ...(zoom ? { zoom } : {}),
        },
      ],
      clock: {
        id: 'clock-0',
        unit: 'logical',
        referenceSeriesId: 'series-z',
        stepBars: 1,
        framesPerStep: 10,
      },
    }) as unknown as CandlestickChartProps;

  const evaluate = (props: CandlestickChartProps, sceneFrame: number) =>
    candlestickChartDefinition.evaluate?.({
      clip: { from: 0, durationInFrames: 300 } as Clip,
      props: props as unknown as Record<string, unknown>,
      sceneFrame,
      project: project(),
    });

  it('zooms the viewport without changing a price', () => {
    const zoom = {
      segments: [
        {
          in: 0,
          out: 100,
          from: { aggregation: 1, fromBar: 0 },
          to: { aggregation: 1, fromBar: 1 },
        },
      ],
    };
    const zoomed = chartProps(zoom);
    const container = render(
      <CandlestickChart props={zoomed} frame={50} evaluated={evaluate(zoomed, 50)} />,
    ).container;
    const plain = render(
      <CandlestickChart props={zoomed} frame={50} evaluated={evaluate(chartProps(), 50)} />,
    ).container;

    // The viewport moved: the first candle is out of the window.
    expect(candles(plain)).toHaveLength(4);
    expect(candles(container)).toHaveLength(3);

    // The candle the zoom kept is drawn at the price it always had.
    const zoomedY = Number(bodies(container)[0].getAttribute('y'));
    const plainY = Number(bodies(plain)[1].getAttribute('y'));
    expect(zoomedY).toBeCloseTo(plainY, 6);
  });
});

describe('the pause point and zoom panels', () => {
  const bars: OhlcBar[] = [
    { id: 'b0', t: 0, o: 100, h: 110, l: 95, c: 105 },
    { id: 'b1', t: 60_000, o: 105, h: 112, l: 101, c: 108 },
  ];

  const pane = (holds?: Array<{ barId: string; in: number; out: number }>) => ({
    id: 'pane-0',
    name: 'Pane 1',
    seriesId: 'series-a',
    aggregation: { factor: 1 },
    rect: { x: 0, y: 0, width: 1, height: 1 },
    in: 0,
    out: 90,
    opacity: 1,
    clock: { kind: 'reference' as const },
    priceRange: { mode: 'auto' as const },
    ...(holds ? { holds } : {}),
  });

  const setup = (
    panes: unknown[],
    options?: { sceneFrame?: number; evaluated?: unknown },
  ) => {
    const props = {
      ...candlestickChartDefinition.defaults,
      bars,
      framesPerBar: 10,
      panes,
    } as unknown as Record<string, unknown>;
    const clip: Clip = {
      id: 'c1',
      name: 'Candlestick Chart',
      element: 'candlestickChart',
      from: 0,
      durationInFrames: 90,
      props: props as unknown as Clip['props'],
      effects: [],
      propsVersion: 1,
    };
    const onChange = vi.fn();
    const commit = vi.fn();
    const updateClip = vi.fn();
    render(
      <CandlestickChartInspector
        clip={clip}
        props={props}
        onChange={onChange}
        updateClip={updateClip}
        commit={commit}
        sceneFrame={options?.sceneFrame}
        evaluated={options?.evaluated}
      />,
    );
    return { onChange, commit };
  };

  it('adds a hold on the candle the pane is showing, from the current frame', () => {
    // The pane is showing the first candle, not the last of the series.
    const { onChange, commit } = setup([pane()], {
      sceneFrame: 20,
      evaluated: { panes: [{ bars: [{ bar: { id: 'b0' } }] }] },
    });

    fireEvent.click(screen.getByText('+ Hold on the current candle'));
    const patch = onChange.mock.calls[0][0] as {
      panes: Array<{ holds: Array<{ barId: string; in: number; out: number }> }>;
    };
    expect(patch.panes[0].holds).toEqual([{ barId: 'b0', in: 20, out: 90 }]);
    expect(commit).toHaveBeenCalled();
  });

  it('removes a hold', () => {
    const { onChange } = setup([pane([{ barId: 'b0', in: 0, out: 30 }])]);

    fireEvent.click(screen.getByLabelText('Remove hold 1 of pane 1'));
    const patch = onChange.mock.calls[0][0] as { panes: Array<{ holds: unknown[] }> };
    expect(patch.panes[0].holds).toEqual([]);
  });

  it('adds a zoom segment', () => {
    const { onChange } = setup([pane()]);

    fireEvent.click(screen.getByText('+ Zoom segment'));
    const patch = onChange.mock.calls[0][0] as {
      panes: Array<{ zoom: { segments: unknown[] } }>;
    };
    expect(patch.panes[0].zoom.segments).toEqual([
      {
        in: 0,
        out: 90,
        from: { aggregation: 1, fromBar: 0 },
        to: { aggregation: 1, fromBar: 0 },
      },
    ]);
  });
});

describe('the curve of the chart', () => {
  const BAR: OhlcBar = { id: 'b0', t: 0, o: 100, h: 110, l: 95, c: 105 };
  const CURVE = { kind: 'preset' as const, name: 'easeIn' as const };

  it('changes the candle-body growth compared with no curve', () => {
    const plain = draw(
      { ...BASE_PROPS, bars: [BAR], revealMode: 'simulated', framesPerBar: 10 },
      4,
    );
    const curved = draw(
      {
        ...BASE_PROPS,
        bars: [BAR],
        revealMode: 'simulated',
        framesPerBar: 10,
        curve: CURVE,
      },
      4,
    );

    // The curve shapes the growth of the developing candle, so the body is
    // drawn at a different height than without one.
    expect(Number(bodies(curved)[0].getAttribute('height'))).not.toBe(
      Number(bodies(plain)[0].getAttribute('height')),
    );
  });

  it('draws the same frame on the evaluated path as on the inline path', () => {
    const BARS: OhlcBar[] = [
      { id: 'series-c:0', t: 0, o: 100, h: 110, l: 95, c: 105 },
      { id: 'series-c:1', t: 10_000, o: 105, h: 115, l: 101, c: 112 },
      { id: 'series-c:2', t: 20_000, o: 112, h: 120, l: 108, c: 118 },
      { id: 'series-c:3', t: 30_000, o: 118, h: 125, l: 114, c: 123 },
    ];

    const project = (): Project => ({
      name: 'Project',
      width: 1920,
      height: 1080,
      fps: 30,
      durationInFrames: 300,
      backgroundColor: '#000000',
      schemaVersion: 2,
      series: [
        {
          id: 'series-c',
          origin: 'manual',
          label: 'Series C',
          timeBasis: 'logical',
          bars: BARS,
        },
      ],
      tracks: [],
    });

    const props = {
      ...BASE_PROPS,
      bars: BARS,
      dataSource: 'manual',
      revealMode: 'simulated',
      framesPerBar: 10,
      simulationSeed: 'curve-seed',
      seriesId: 'series-c',
      curve: CURVE,
      panes: [
        {
          id: 'pane-0',
          seriesId: 'series-c',
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
        referenceSeriesId: 'series-c',
        stepBars: 1,
        framesPerStep: 10,
      },
    } as unknown as CandlestickChartProps;

    const evaluated = candlestickChartDefinition.evaluate?.({
      clip: { from: 0, durationInFrames: 300 } as Clip,
      props: props as unknown as Record<string, unknown>,
      sceneFrame: 25,
      project: project(),
    });

    const fromEvaluated = render(
      <CandlestickChart props={props} frame={25} evaluated={evaluated} />,
    ).container;
    const fromInline = render(<CandlestickChart props={props} frame={25} />).container;

    // The same curve, the same frame — preview and export draw the same thing.
    expect(fromEvaluated.innerHTML).toBe(fromInline.innerHTML);
  });
});

describe('the developing candle of a pane', () => {
  const bars: OhlcBar[] = [
    { id: 'b0', t: 0, o: 100, h: 110, l: 95, c: 105 },
    { id: 'b1', t: 1, o: 105, h: 115, l: 101, c: 112 },
  ];

  const evaluation = (developing: boolean) => ({
    panes: [
      {
        bars: bars.map((bar) => ({
          bar,
          o: bar.o,
          h: bar.h,
          l: bar.l,
          c: bar.c,
          progress: 1,
          complete: true,
        })),
        totalBars: bars.length,
        developing,
        rect: { x: 0, y: 0, width: 1, height: 1 },
      },
    ],
    provenance: { origin: 'manual' as const, revision: 'r', label: 'Series' },
  });

  const groups = (container: HTMLElement) =>
    Array.from(container.querySelectorAll('[data-testid="candle"]'));
  const bodyOf = (group: Element) =>
    group.querySelector('[data-testid="candle-body"]') as SVGElement;

  it('marks the last candle of a pane that is still forming', () => {
    const container = render(
      <CandlestickChart props={BASE_PROPS} frame={0} evaluated={evaluation(true)} />,
    ).container;
    const candles = groups(container);

    // The forming bucket is the last candle of the pane; the closed ones
    // before it stay as they were.
    expect(candles[candles.length - 1].getAttribute('data-developing')).toBe('true');
    expect(candles[0].getAttribute('data-developing')).toBeNull();
  });

  it('draws the forming candle differently from the same closed candle', () => {
    const forming = render(
      <CandlestickChart props={BASE_PROPS} frame={0} evaluated={evaluation(true)} />,
    ).container;
    const closed = render(
      <CandlestickChart props={BASE_PROPS} frame={0} evaluated={evaluation(false)} />,
    ).container;

    const formingBody = bodyOf(groups(forming)[groups(forming).length - 1]);
    const closedBody = bodyOf(groups(closed)[groups(closed).length - 1]);

    // The forming body is not filled the way a closed one is, and it says so.
    expect(formingBody.getAttribute('fill')).not.toBe(closedBody.getAttribute('fill'));
    expect(formingBody.getAttribute('fill')).toBe('none');
    expect(formingBody.getAttribute('stroke-dasharray')).toBeTruthy();
  });

  it('draws a closed pane the way it always did', () => {
    const container = render(
      <CandlestickChart props={BASE_PROPS} frame={0} evaluated={evaluation(false)} />,
    ).container;
    const candles = groups(container);

    expect(container.querySelector('[data-developing]')).toBeNull();
    const body = bodyOf(candles[candles.length - 1]);
    expect(body.getAttribute('fill')).toBe(BASE_PROPS.upColor);
    expect(body.getAttribute('stroke-dasharray')).toBeNull();
  });
});

describe('the geometry of a pane that does not fill the chart box', () => {
  const props: CandlestickChartProps = {
    ...BASE_PROPS,
    width: 720,
    height: 420,
    bars: [
      { id: 'b0', t: 0, o: 100, h: 110, l: 95, c: 105 },
      { id: 'b1', t: 1, o: 105, h: 115, l: 101, c: 112 },
      { id: 'b2', t: 2, o: 112, h: 120, l: 108, c: 118 },
    ],
    revealMode: 'discrete',
  };

  const rect = { x: 0, y: 0, width: 0.5, height: 1 };

  const partial = props.bars.map((bar) => ({
    bar,
    o: bar.o,
    h: bar.h,
    l: bar.l,
    c: bar.c,
    progress: 1,
    complete: true,
  }));

  const pane = () => ({ bars: partial, totalBars: 3, rect });

  it('places an anchor where the renderer draws the bar', () => {
    const container = render(
      <CandlestickChart
        props={props}
        frame={0}
        evaluated={{
          panes: [
            { bars: partial, totalBars: 3, developing: false, rect },
          ],
          provenance: { origin: 'manual' as const, revision: 'r', label: 'Series' },
        }}
      />,
    ).container;

    const body = container.querySelectorAll('[data-testid="candle-body"]')[1];
    const drawnCentre =
      Number(body.getAttribute('x')) + Number(body.getAttribute('width')) / 2;

    // The anchor lands on the bar the renderer drew, inside the pane.
    const point = chartAnchorToPoint(props, pane(), { barIndex: 1, price: 112 });
    expect(point.x).toBeCloseTo(drawnCentre, 6);
    expect(point.y).toBeCloseTo(Number(body.getAttribute('y')), 6);
  });

  it('maps an anchor back to the point it came from', () => {
    const anchor = { barIndex: 2, price: 112 };
    const point = chartAnchorToPoint(props, pane(), anchor);
    const back = chartPointToAnchor(props, pane(), point);
    expect(back!.barIndex).toBe(anchor.barIndex);
    expect(back!.price).toBeCloseTo(anchor.price, 6);
  });

  it('lays the anchor out against the pane, not against the whole chart box', () => {
    const anchor = { barIndex: 1, price: 110 };
    const inPane = chartAnchorToPoint(props, pane(), anchor);
    const inBox = chartAnchorToPoint(props, { bars: partial, totalBars: 3 }, anchor);
    expect(inPane.x).not.toBeCloseTo(inBox.x, 3);
  });
});
