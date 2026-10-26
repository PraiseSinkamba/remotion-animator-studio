// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

import { CandlestickChart, type CandlestickChartProps } from './candlestick-chart';
import { CandlestickChartInspector } from './candlestick-chart-inspector';
import { candlestickChartDefinition } from './definition';
import { generateSyntheticBars, type OhlcBar } from './ohlc';
import { getComponent } from '../registry/registry';
import { migrateProject } from '../project/migrate';
import type { Clip, Project } from '../types';

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
    const bar: OhlcBar = { t: 0, o: 10, h: 20, l: 5, c: 15 };
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
    const bar: OhlcBar = { t: 0, o: 10, h: 20, l: 5, c: 10 };
    const container = draw({ ...BASE_PROPS, bars: [bar] }, 0);
    expect(Number(bodies(container)[0].getAttribute('height'))).toBeGreaterThanOrEqual(1);
  });

  it('colours a falling bar with the down colour', () => {
    const bar: OhlcBar = { t: 0, o: 20, h: 20, l: 5, c: 10 };
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
  const bar: OhlcBar = { t: 0, o: 100, h: 110, l: 95, c: 105 };
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
    expect(migrated).toEqual(project);
    expect(migrated.tracks[0].clips[0].props.bars).toEqual(props.bars);
  });
});

describe('candlestick chart — inspector', () => {
  const bars: OhlcBar[] = [
    { t: 0, o: 100, h: 110, l: 95, c: 105 },
    { t: 60_000, o: 105, h: 112, l: 101, c: 108 },
    { t: 120_000, o: 108, h: 115, l: 104, c: 112 },
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
