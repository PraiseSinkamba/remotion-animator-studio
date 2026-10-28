// Renders short demo GIFs for the docs site using the same pipeline as video export.
// Usage: npm run docs:gifs   → writes public/docs/gifs/*.gif
import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

const OUT = path.resolve('apps/studio/public/docs/gifs');
mkdirSync(OUT, { recursive: true });

let n = 0;
const id = () => `d${n++}`;

const clip = (element, props, effects, opts = {}) => ({
  id: id(),
  name: opts.name ?? element,
  element,
  from: opts.from ?? 0,
  durationInFrames: opts.dur ?? 75,
  props,
  effects: effects.map((e) => ({ id: id(), type: e[0], params: e[1] ?? {} })),
});

const project = (name, clips, opts = {}) => ({
  name,
  width: 480,
  height: 270,
  fps: 30,
  durationInFrames: opts.dur ?? 75,
  backgroundColor: '#12121c',
  tracks: [{ id: id(), name: 'demo', clips }],
});

const text = (t, extra = {}) => ({
  text: t,
  fontSize: 44,
  color: '#ffffff',
  fontFamily: 'Helvetica, Arial, sans-serif',
  fontWeight: 700,
  letterSpacing: 1,
  x: 240,
  y: 135,
  ...extra,
});

const DEMOS = {
  'bounce-drop': project('bounce', [
    clip(
      'shape',
      { kind: 'circle', width: 90, height: 90, fill: '#ff5c6c', rotation: 0, opacity: 1, x: 240, y: 190 },
      [
        ['bounceDrop', { height: 160, duration: 45 }],
        ['shadow', { offsetX: 0, offsetY: 10, blur: 16, color: '#000000' }],
      ],
    ),
  ]),
  glitch: project('glitch', [
    clip('text', text('GLITCH', { letterSpacing: 8, fontWeight: 900 }), [
      ['glitch', { intensity: 0.6, frequency: 0.45 }],
      ['rgbSplit', { amount: 5, jitter: 3 }],
      ['shake', { intensity: 3, speed: 12, rotation: 0 }],
    ]),
  ]),
  typewriter: project('typewriter', [
    clip('text', text('Typewriter effect…', { fontSize: 34, fontWeight: 400 }), [
      ['typewriter', { charsPerSecond: 14 }],
    ]),
  ]),
  'letter-pop': project('letterpop', [
    clip('text', text('Letter Pop!', { fontSize: 42 }), [
      ['letterPop', { stagger: 2, duration: 14, distance: 30 }],
    ]),
  ]),
  'motion-path': project('motionpath', [
    clip('emoji', { char: '🚀', size: 56, x: 90, y: 200 }, [
      ['motionPath', { path: 'M 0 0 C 80 -140 220 -140 300 0', orient: 'yes', easing: 'easeInOut' }],
    ]),
  ]),
  confetti: project('confetti', [
    clip(
      'particles',
      {
        kind: 'confetti',
        count: 90,
        width: 480,
        height: 270,
        size: 10,
        speed: 1.6,
        drift: 25,
        colors: '#7c5cff,#35c4ff,#ff5c6c,#ffd166,#6ee7a8',
        seed: 'party',
        opacity: 1,
        x: 240,
        y: 135,
      },
      [],
    ),
    clip('text', text('Particles', { fontSize: 38 }), [['springPop', { damping: 11, mass: 0.8 }]]),
  ]),
  'wave-blob': project('waveblob', [
    clip('blob', { size: 120, color: '#7c5cff', wobble: 0.4, speed: 0.8, points: 8, seed: 'b', opacity: 0.9, x: 240, y: 110 }, []),
    clip('wave', { width: 480, height: 110, color: '#35c4ff', amplitude: 16, wavelength: 150, speed: 0.6, layers: 3, opacity: 0.9, x: 240, y: 225 }, []),
  ]),
  'ken-burns': project('kenburns', [
    clip(
      'image',
      { src: 'https://picsum.photos/seed/kenburns/960/540', width: 520, height: 300, borderRadius: 0, objectFit: 'cover', opacity: 1, x: 240, y: 135 },
      [['kenBurns', { zoomFrom: 1, zoomTo: 1.2, panX: -20, panY: -12 }]],
    ),
  ]),
};

console.log('Bundling composition...');
const serveUrl = await bundle({ entryPoint: path.resolve('apps/studio/remotion/index.ts') });

for (const [name, proj] of Object.entries(DEMOS)) {
  const inputProps = { project: proj };
  const composition = await selectComposition({ serveUrl, id: 'Main', inputProps });
  const out = path.join(OUT, `${name}.gif`);
  process.stdout.write(`Rendering ${name}.gif... `);
  await renderMedia({
    composition,
    serveUrl,
    codec: 'gif',
    outputLocation: out,
    inputProps,
    everyNthFrame: 2,
  });
  console.log('done');
}
console.log(`\nAll GIFs → ${OUT}`);
