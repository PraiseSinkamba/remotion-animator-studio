/**
 * A verification fixture for the authored swing path.
 *
 * A chart driven by a drawn path: three anchors, the price at each one
 * becoming the price that bar closes at, exactly. It renders as its own
 * composition so the render gate can prove the authored path works without
 * disturbing the composition that proves a migrated project still renders the
 * same.
 */
import type { Project } from '@chart-studio/core';

export const AUTHORED_SERIES_ID = 'series-authored';

export const authoredPathProject: Project = {
  name: 'Chart Studio authored path verification',
  width: 1920,
  height: 1080,
  fps: 30,
  durationInFrames: 180,
  backgroundColor: '#0d0d14',
  schemaVersion: 4,
  series: [
    {
      id: AUTHORED_SERIES_ID,
      origin: 'authored-path',
      label: 'Authored path',
      symbol: 'DRAFT',
      timeBasis: 'logical',
      seed: 'verify-authored',
      algorithmVersion: 1,
      path: {
        anchors: [
          { id: 'ap0', barIndex: 0, price: 100 },
          { id: 'ap1', barIndex: 40, price: 118 },
          { id: 'ap2', barIndex: 79, price: 112 },
        ],
      },
    },
  ],
  tracks: [
    {
      id: 't-chart',
      name: 'Chart',
      clips: [
        {
          id: 'c-authored',
          name: 'Authored Chart',
          element: 'candlestickChart',
          from: 0,
          durationInFrames: 180,
          props: {
            seriesId: AUTHORED_SERIES_ID,
            panes: [
              {
                id: 'pane-0',
                seriesId: AUTHORED_SERIES_ID,
                aggregation: { factor: 1 },
                rect: { x: 0, y: 0, width: 0.62, height: 1 },
                in: 0,
                out: 180,
                opacity: 1,
                clock: { kind: 'reference' },
                priceRange: { mode: 'auto' },
              },
              {
                // The same asset at a coarser rung: the rollup, drawn beside
                // the fine pane, with its growth shaped by a curve.
                id: 'pane-1',
                seriesId: AUTHORED_SERIES_ID,
                aggregation: { factor: 60 },
                rect: { x: 0.62, y: 0, width: 0.38, height: 1 },
                in: 0,
                out: 180,
                opacity: 1,
                clock: { kind: 'reference' },
                priceRange: { mode: 'auto' },
                curve: { kind: 'preset', name: 'easeOut' },
              },
            ],
            clock: {
              id: 'clock-authored',
              unit: 'logical',
              referenceSeriesId: AUTHORED_SERIES_ID,
              stepBars: 1,
              framesPerStep: 15,
            },
            revealMode: 'simulated',
            framesPerBar: 15,
            simulationSeed: 'verify-authored',
            symbol: 'DRAFT',
            timeframe: '1m',
            width: 1100,
            height: 560,
            x: 960,
            y: 690,
            upColor: '#26a69a',
            downColor: '#ef5350',
            wickColor: '#9aa4b2',
            gridColor: 'rgba(255,255,255,0.14)',
            showGrid: true,
            showPriceAxis: true,
            showProvenanceBadge: true,
          },
          effects: [],
        },
        {
          id: 'c-authored-2',
          name: 'Authored Chart 2',
          element: 'candlestickChart',
          from: 180,
          durationInFrames: 180,
          props: {
            seriesId: AUTHORED_SERIES_ID,
            panes: [
              {
                id: 'pane-2',
                seriesId: AUTHORED_SERIES_ID,
                aggregation: { factor: 1 },
                rect: { x: 0, y: 0, width: 1, height: 1 },
                in: 0,
                out: 180,
                opacity: 1,
                clock: { kind: 'reference' },
                priceRange: { mode: 'auto' },
              },
            ],
            clock: {
              id: 'clock-authored-2',
              unit: 'logical',
              referenceSeriesId: AUTHORED_SERIES_ID,
              stepBars: 1,
              framesPerStep: 15,
            },
            revealMode: 'simulated',
            framesPerBar: 15,
            simulationSeed: 'verify-authored-2',
            symbol: 'DRAFT',
            timeframe: '1m',
            width: 1100,
            height: 560,
            x: 960,
            y: 690,
            upColor: '#26a69a',
            downColor: '#ef5350',
            wickColor: '#9aa4b2',
            gridColor: 'rgba(255,255,255,0.14)',
            showGrid: true,
            showPriceAxis: true,
            showProvenanceBadge: true,
          },
          effects: [],
        },
        {
          id: 'c-horizontal-line',
          name: 'Horizontal Line',
          element: 'horizontalLine',
          from: 0,
          durationInFrames: 180,
          props: {
            // The line owns its shape: it reads no chart and no market. The
            // creator's own figure rides along as the caption.
            caption: '100.5',
            opacity: 1,
            style: { color: '#6ee7a8', lineWidth: 1.5 },
            x: 960,
            y: 690,
            width: 1020,
          },
          effects: [],
          propsVersion: 3,
        },
        {
          id: 'c-trendline',
          name: 'Trendline',
          element: 'trendline',
          from: 0,
          durationInFrames: 180,
          props: {
            // Two points in the composition: the far end is a bar the pane
            // has not revealed yet, so the line runs ahead of the market.
            points: {
              start: { x: 501, y: 918.6 },
              end: { x: 603, y: 908.44 },
            },
            opacity: 1,
            style: { color: '#7c5cff', lineWidth: 1.5 },
          },
          effects: [],
          propsVersion: 3,
        },
      ],
      transitions: [
        {
          id: 'tr-authored',
          fromClipId: 'c-authored',
          toClipId: 'c-authored-2',
          element: 'crossfade',
          durationInFrames: 20,
        },
      ],
    },
  ],
};
