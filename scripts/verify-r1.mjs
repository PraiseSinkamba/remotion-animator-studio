/**
 * Chart Studio R1 verification render.
 *
 * Builds a project that uses the first first-party trading component (the
 * candlestick chart) together with the three adapted Remocn motion components
 * (marker highlight, soft blur in, typewriter), then renders it through the
 * real Remotion pipeline: stills at chosen frames plus an mp4 export.
 *
 * Usage:
 *   node scripts/verify-r1.mjs            # stills + mp4
 *   node scripts/verify-r1.mjs --stills   # stills only (fast)
 */
import { bundle } from '@remotion/bundler';
import { renderMedia, renderStill, selectComposition } from '@remotion/renderer';
import { mkdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { generateSyntheticBars } from '../src/trading/ohlc.ts';

const OUT_DIR = path.resolve('out', 'verify');
const STILL_FRAMES = [0, 20, 45, 100, 140, 179];
const FPS = 30;

const bars = generateSyntheticBars({
  count: 12,
  startPrice: 4200,
  seed: 'chart-1',
  timeframeMs: 5 * 60 * 1000,
});

const project = {
  name: 'Chart Studio R1 verification',
  width: 1920,
  height: 1080,
  fps: FPS,
  durationInFrames: 240,
  backgroundColor: '#0d0d14',
  schemaVersion: 1,
  tracks: [
    {
      id: 't-motion',
      name: 'Motion',
      clips: [
        {
          id: 'c-marker',
          name: 'Marker Highlight',
          element: 'remocnMarkerHighlight',
          from: 30,
          durationInFrames: 180,
          props: {
            before: 'Liquidity ',
            highlight: 'Sweep',
            after: ' on the 1H',
            markerColor: '#facc15',
            baseColor: '#f5f5f7',
            highlightedTextColor: '#171717',
            fontSize: 84,
            fontWeight: 700,
            speed: 1,
            x: 960,
            y: 200,
          },
          effects: [],
        },
      ],
    },
    {
      id: 't-motion-2',
      name: 'Motion 2',
      clips: [
        {
          id: 'c-soft-blur',
          name: 'Soft Blur In',
          element: 'remocnSoftBlurIn',
          from: 0,
          durationInFrames: 100,
          props: {
            text: 'Blur into focus',
            blur: 12,
            fontSize: 72,
            color: '#f5f5f7',
            fontWeight: 700,
            speed: 1,
            x: 960,
            y: 330,
          },
          effects: [],
        },
        {
          id: 'c-typewriter',
          name: 'Typewriter',
          element: 'remocnTypewriter',
          from: 100,
          durationInFrames: 120,
          props: {
            text: 'Watch the story type itself',
            cursor: true,
            charsPerSecond: 22,
            speed: 1,
            fontSize: 48,
            color: '#f5f5f7',
            cursorColor: '#facc15',
            fontWeight: 600,
            x: 960,
            y: 330,
          },
          effects: [],
        },
      ],
    },
    {
      id: 't-chart',
      name: 'Chart',
      clips: [
        {
          id: 'c-chart',
          name: 'Candlestick Chart',
          element: 'candlestickChart',
          from: 0,
          durationInFrames: 180,
          props: {
            bars,
            dataSource: 'synthetic',
            revealMode: 'simulated',
            framesPerBar: 15,
            simulationSeed: 'chart-1',
            symbol: 'SYNTH',
            timeframe: '5m',
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
      ],
    },
    {
      id: 't-bg',
      name: 'Background',
      clips: [
        {
          id: 'c-bg',
          name: 'Background',
          element: 'background',
          from: 0,
          durationInFrames: 240,
          props: { fillType: 'linear', colorA: '#0d0d14', colorB: '#1b1036', angle: 160 },
          effects: [],
        },
      ],
    },
  ],
};

mkdirSync(OUT_DIR, { recursive: true });

console.log('Bundling composition...');
const serveUrl = await bundle({ entryPoint: path.resolve('remotion/index.ts') });

const inputProps = { project };
const composition = await selectComposition({ serveUrl, id: 'Main', inputProps });
console.log(
  `Composition "${composition.id}" — ${composition.width}x${composition.height} @ ${composition.fps}fps, ${composition.durationInFrames} frames`,
);

for (const frame of STILL_FRAMES) {
  const output = path.join(OUT_DIR, `frame-${String(frame).padStart(4, '0')}.png`);
  await renderStill({ composition, serveUrl, output, inputProps, frame });
  console.log(`still → ${output} (${statSync(output).size} bytes)`);
}

if (!process.argv.includes('--stills')) {
  const output = path.resolve('out', 'chart-studio-r1.mp4');
  await renderMedia({
    composition,
    serveUrl,
    codec: 'h264',
    outputLocation: output,
    inputProps,
    onProgress: ({ progress }) => {
      process.stdout.write(`\r${Math.round(progress * 100)}%   `);
    },
  });
  console.log(`\nvideo → ${output} (${statSync(output).size} bytes)`);
}
