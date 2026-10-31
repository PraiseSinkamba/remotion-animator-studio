// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

import type { Clip, OhlcBar, Project } from '@chart-studio/core';
import { candlestickChartDefinition } from '../definitions/candlestick-chart';
import { CandlestickChartInspector } from './candlestick-chart';

afterEach(() => cleanup());

const BARS: OhlcBar[] = [
  { id: 'series-h:0', t: 0, o: 100, h: 104, l: 96, c: 102 },
  { id: 'series-h:1', t: 10_000, o: 102, h: 106, l: 100, c: 104 },
  { id: 'series-h:2', t: 20_000, o: 104, h: 120, l: 80, c: 110 },
  { id: 'series-h:3', t: 30_000, o: 110, h: 112, l: 108, c: 111 },
  { id: 'series-h:4', t: 40_000, o: 111, h: 115, l: 109, c: 113 },
  { id: 'series-h:5', t: 50_000, o: 113, h: 116, l: 111, c: 112 },
  { id: 'series-h:6', t: 60_000, o: 112, h: 118, l: 110, c: 117 },
  { id: 'series-h:7', t: 70_000, o: 117, h: 119, l: 115, c: 116 },
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

const props = {
  bars: BARS,
  dataSource: 'manual',
  revealMode: 'discrete',
  framesPerBar: 10,
  symbol: 'TEST',
  timeframe: '5m',
  seriesId: 'series-h',
  panes: [
    {
      id: 'pane-0',
      name: 'Pane 1',
      seriesId: 'series-h',
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
    referenceSeriesId: 'series-h',
    stepBars: 1,
    framesPerStep: 10,
  },
} as unknown as Record<string, unknown>;

const clip = (from = 0): Clip =>
  ({
    id: 'c1',
    name: 'Candlestick Chart',
    element: 'candlestickChart',
    from,
    durationInFrames: 300,
    props,
    effects: [],
    propsVersion: 1,
  }) as unknown as Clip;

/** The chart's own evaluation at a frame — what the shell hands the inspector. */
const evaluate = (sceneFrame: number, at = clip()) =>
  candlestickChartDefinition.evaluate?.({
    clip: at,
    props,
    sceneFrame,
    project: project(),
  }) as { panes?: Array<{ bars?: Array<{ bar?: { id?: string } }> }> } | undefined;

const renderInspector = (sceneFrame: number, at = clip()) => {
  const onChange = vi.fn();
  const commit = vi.fn();
  render(
    <CandlestickChartInspector
      clip={at}
      props={props}
      onChange={onChange}
      updateClip={vi.fn()}
      commit={commit}
      sceneFrame={sceneFrame}
      evaluated={evaluate(sceneFrame, at)}
    />,
  );
  return { onChange, commit };
};

const holdButton = () =>
  screen.getByText('+ Hold on the current candle') as HTMLButtonElement;

describe('the hold of a pane', () => {
  it('names the candle the pane is showing and starts at the current frame', () => {
    const { onChange, commit } = renderInspector(25);

    fireEvent.click(holdButton());

    const patch = onChange.mock.calls[0][0] as {
      panes: Array<{ holds: Array<{ barId: string; in: number; out: number }> }>;
    };
    // The candle the pane shows at frame 25 is the third one — not the last
    // candle of the series.
    expect(patch.panes[0].holds).toEqual([{ barId: 'series-h:2', in: 25, out: 300 }]);
    expect(commit).toHaveBeenCalled();
  });

  it('stops the market for the range of the hold', () => {
    const { onChange } = renderInspector(25);

    fireEvent.click(holdButton());
    const patch = onChange.mock.calls[0][0] as {
      panes: Array<{ holds: Array<{ barId: string; in: number; out: number }> }>;
    };
    const hold = patch.panes[0].holds[0];

    // The same hold, applied to the chart: at frame 60 the market stands
    // still on the held candle, while without it the market has moved on.
    const held = {
      ...props,
      panes: (props.panes as Array<object>).map((pane) => ({ ...pane, holds: [hold] })),
    };
    const frozen = candlestickChartDefinition.evaluate?.({
      clip: clip(),
      props: held as unknown as Record<string, unknown>,
      sceneFrame: 60,
      project: project(),
    }) as { panes: Array<{ bars: Array<{ bar: { id: string } }> }> };
    const moving = evaluate(60);

    expect(frozen.panes[0].bars).toHaveLength(3);
    expect(frozen.panes[0].bars[2].bar.id).toBe('series-h:2');
    expect(moving?.panes?.[0]?.bars).toHaveLength(7);
  });

  it('creates no hold when the pane shows nothing', () => {
    // The playhead is before the clip, so the pane has revealed no candle.
    const { onChange } = renderInspector(0, clip(10));

    const button = holdButton();
    expect(button.disabled).toBe(true);
    expect(screen.getByTestId('hold-unavailable').textContent).toMatch(/candle/i);

    fireEvent.click(button);
    expect(onChange).not.toHaveBeenCalled();
  });
});
