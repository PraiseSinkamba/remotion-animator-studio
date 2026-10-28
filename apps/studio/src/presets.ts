import type { Clip, EffectInstance, ElementType } from './types';
import { getComponent } from './registry';

let n = 0;
const pid = (p: string) => `${p}-${Date.now().toString(36)}-${n++}`;

interface PresetClipSpec {
  element: ElementType;
  name: string;
  /** offset from the preset insertion frame */
  offset: number;
  duration: number;
  props: Record<string, any>;
  // `undefined` allowed because TS widens unions of object literals with optional keys
  effects: Array<{ type: EffectInstance['type']; params?: Record<string, number | string | undefined> }>;
  /** Paint order within the preset's track — lower renders underneath (default 0) */
  layer?: number;
}

export interface PresetDef {
  label: string;
  icon: string;
  description: string;
  /** cx/cy are canvas center; w/h the canvas size — so presets adapt to any aspect ratio */
  build: (w: number, h: number) => PresetClipSpec[];
}

export const buildPresetClips = (preset: PresetDef, w: number, h: number, atFrame: number): Clip[] =>
  [...preset.build(w, h)]
    .sort((a, b) => (a.layer ?? 0) - (b.layer ?? 0))
    .map((spec) => ({
    id: pid('c'),
    name: spec.name,
    element: spec.element,
    from: atFrame + spec.offset,
    durationInFrames: spec.duration,
    props: { ...(getComponent(spec.element)?.defaults ?? {}), ...spec.props },
    effects: spec.effects.map((e) => ({
      id: pid('e'),
      type: e.type,
      params: Object.fromEntries(
        Object.entries(e.params ?? {}).filter(([, v]) => v !== undefined),
      ) as Record<string, number | string>,
    })),
  }));

export const PRESETS: Record<string, PresetDef> = {
  titleIntro: {
    label: 'Title Intro',
    icon: '🎬',
    description: 'Big spring-pop title with typewriter subtitle',
    build: (w, h) => [
      {
        element: 'text',
        name: 'Title',
        offset: 0,
        duration: 120,
        props: { text: 'Your Title', fontSize: Math.round(h * 0.11), x: w / 2, y: h * 0.44, fontWeight: 900 },
        effects: [
          { type: 'springPop', params: { damping: 11, mass: 0.8 } },
          { type: 'fadeOut', params: { duration: 18 } },
        ],
      },
      {
        element: 'text',
        name: 'Subtitle',
        offset: 18,
        duration: 102,
        props: {
          text: 'A subtitle goes here',
          fontSize: Math.round(h * 0.042),
          color: '#c9c9d9',
          fontWeight: 400,
          letterSpacing: 3,
          x: w / 2,
          y: h * 0.57,
        },
        effects: [
          { type: 'typewriter', params: { charsPerSecond: 22 } },
          { type: 'fadeOut', params: { duration: 18 } },
        ],
      },
    ],
  },
  lowerThird: {
    label: 'Lower Third',
    icon: '📛',
    description: 'Name + role bar, slides in bottom-left',
    build: (w, h) => [
      {
        element: 'shape',
        name: 'LT Bar',
        offset: 0,
        duration: 150,
        props: {
          kind: 'rect',
          width: Math.round(w * 0.03),
          height: Math.round(h * 0.12),
          fill: '#7c5cff',
          borderRadius: 6,
          x: w * 0.075,
          y: h * 0.85,
        },
        effects: [
          { type: 'wipeIn', params: { direction: 'top', duration: 14 } },
          { type: 'wipeOut', params: { direction: 'bottom', duration: 14 } },
        ],
      },
      {
        element: 'text',
        name: 'LT Name',
        offset: 4,
        duration: 146,
        props: {
          text: 'Jane Doe',
          fontSize: Math.round(h * 0.055),
          fontWeight: 700,
          x: w * 0.1 + w * 0.12,
          y: h * 0.825,
        },
        effects: [
          { type: 'slideIn', params: { direction: 'left', distance: 120, duration: 16 } },
          { type: 'fadeIn', params: { duration: 12 } },
          { type: 'fadeOut', params: { duration: 14 } },
        ],
      },
      {
        element: 'text',
        name: 'LT Role',
        offset: 10,
        duration: 140,
        props: {
          text: 'Director of Everything',
          fontSize: Math.round(h * 0.032),
          color: '#b9a8ff',
          fontWeight: 400,
          x: w * 0.1 + w * 0.12,
          y: h * 0.885,
        },
        effects: [
          { type: 'slideIn', params: { direction: 'left', distance: 120, duration: 16 } },
          { type: 'fadeIn', params: { duration: 12 } },
          { type: 'fadeOut', params: { duration: 14 } },
        ],
      },
    ],
  },
  glitchTitle: {
    label: 'Glitch Title',
    icon: '📺',
    description: 'Cyberpunk glitch text with RGB split + shake',
    build: (w, h) => [
      {
        element: 'text',
        name: 'Glitch Title',
        offset: 0,
        duration: 90,
        props: {
          text: 'GLITCH',
          fontSize: Math.round(h * 0.14),
          fontWeight: 900,
          letterSpacing: 10,
          x: w / 2,
          y: h / 2,
        },
        effects: [
          { type: 'glitch', params: { intensity: 0.6, frequency: 0.45 } },
          { type: 'rgbSplit', params: { amount: 7, jitter: 4 } },
          { type: 'shake', params: { intensity: 5, speed: 12, rotation: 0 } },
          { type: 'fadeIn', params: { duration: 5 } },
          { type: 'fadeOut', params: { duration: 10 } },
        ],
      },
    ],
  },
  kenBurnsPhoto: {
    label: 'Ken Burns Photo',
    icon: '🎞️',
    description: 'Full-frame photo with cinematic zoom + pan',
    build: (w, h) => [
      {
        element: 'image',
        name: 'KB Photo',
        offset: 0,
        duration: 150,
        props: {
          src: 'https://picsum.photos/seed/kenburns/1920/1080',
          width: w * 1.1,
          height: h * 1.1,
          borderRadius: 0,
          x: w / 2,
          y: h / 2,
        },
        effects: [
          { type: 'kenBurns', params: { zoomFrom: 1, zoomTo: 1.18, panX: -w * 0.03, panY: -h * 0.02 } },
          { type: 'fadeIn', params: { duration: 15 } },
          { type: 'fadeOut', params: { duration: 15 } },
        ],
      },
    ],
  },
  socialPop: {
    label: 'Social Pop',
    icon: '❤️',
    description: 'Emoji burst + follow call-to-action',
    build: (w, h) => [
      {
        element: 'emoji',
        name: 'Pop Emoji',
        offset: 0,
        duration: 90,
        props: { char: '❤️', size: Math.round(h * 0.2), x: w / 2, y: h * 0.42 },
        effects: [
          { type: 'springPop', params: { damping: 9, mass: 0.7 } },
          { type: 'pulse', params: { amount: 0.1, speed: 2 } },
        ],
      },
      {
        element: 'text',
        name: 'CTA',
        offset: 10,
        duration: 80,
        props: { text: 'Follow for more', fontSize: Math.round(h * 0.05), x: w / 2, y: h * 0.62 },
        effects: [
          { type: 'slideIn', params: { direction: 'bottom', distance: 100, duration: 15 } },
          { type: 'fadeIn', params: { duration: 12 } },
        ],
      },
    ],
  },
  statCounter: {
    label: 'Stat Counter',
    icon: '🔢',
    description: 'Animated number + label — great for stats',
    build: (w, h) => [
      {
        element: 'counter',
        name: 'Stat',
        offset: 0,
        duration: 110,
        props: { from: 0, to: 87, suffix: '%', fontSize: Math.round(h * 0.16), x: w / 2, y: h * 0.45 },
        effects: [
          { type: 'springPop', params: { damping: 14, mass: 1 } },
          { type: 'glow', params: { color: '#7c5cff', radius: 30, pulseSpeed: 0 } },
        ],
      },
      {
        element: 'text',
        name: 'Stat label',
        offset: 8,
        duration: 102,
        props: {
          text: 'of viewers watched to the end',
          fontSize: Math.round(h * 0.04),
          color: '#c9c9d9',
          fontWeight: 400,
          x: w / 2,
          y: h * 0.62,
        },
        effects: [{ type: 'fadeIn', params: { duration: 15 } }],
      },
    ],
  },
  newsTicker: {
    label: 'News Ticker',
    icon: '📰',
    description: 'Bar + text scrolling across the bottom',
    build: (w, h) => [
      {
        element: 'shape',
        name: 'Ticker Bar',
        offset: 0,
        duration: 240,
        props: {
          kind: 'rect',
          width: w * 1.2,
          height: Math.round(h * 0.075),
          fill: '#12121c',
          borderRadius: 0,
          opacity: 0.9,
          x: w / 2,
          y: h * 0.94,
        },
        effects: [],
      },
      {
        element: 'text',
        name: 'Ticker Text',
        offset: 0,
        duration: 240,
        props: {
          text: 'BREAKING — Your scrolling headline goes here · More news at 11 · ',
          fontSize: Math.round(h * 0.038),
          fontWeight: 500,
          x: w * 1.3,
          y: h * 0.94,
        },
        effects: [{ type: 'drift', params: { dx: -w * 2, dy: 0 } }],
      },
    ],
  },
  quoteCard: {
    label: 'Quote Card',
    icon: '❝',
    description: 'Typewriter quote with author reveal',
    build: (w, h) => [
      {
        element: 'text',
        name: 'Quote',
        offset: 0,
        duration: 160,
        props: {
          text: '“Creativity is intelligence\nhaving fun.”',
          fontSize: Math.round(h * 0.065),
          fontFamily: 'Georgia, serif',
          fontWeight: 400,
          x: w / 2,
          y: h * 0.45,
        },
        effects: [{ type: 'typewriter', params: { charsPerSecond: 24 } }],
      },
      {
        element: 'text',
        name: 'Author',
        offset: 55,
        duration: 105,
        props: {
          text: '— Albert Einstein',
          fontSize: Math.round(h * 0.035),
          color: '#b9a8ff',
          fontWeight: 400,
          letterSpacing: 2,
          x: w / 2,
          y: h * 0.63,
        },
        effects: [
          { type: 'fadeIn', params: { duration: 20 } },
          { type: 'slideIn', params: { direction: 'bottom', distance: 40, duration: 20 } },
        ],
      },
    ],
  },
  synthwaveOutrun: {
    label: 'Synthwave Outrun',
    icon: '🛣️',
    description: 'Driving through a neon city — car, lit skyline, striped sun, endless grid',
    build: (w, h) => [
      {
        element: 'particles',
        name: 'Stars',
        layer: 1,
        offset: 0,
        duration: 240,
        props: {
          kind: 'sparkles',
          count: 70,
          width: w,
          height: Math.round(h * 0.45),
          size: 7,
          speed: 1,
          drift: 0,
          colors: '#ffffff,#b9a8ff',
          x: w / 2,
          y: h * 0.22,
        },
        effects: [],
      },
      {
        element: 'html',
        name: 'City Skyline',
        layer: 3,
        offset: 0,
        duration: 240,
        props: {
          html: (() => {
            const buildings = [
              [7, 62], [5, 88], [8, 48], [6, 100], [9, 70], [5, 55], [7, 92], [6, 40], [8, 78], [5, 60], [7, 50], [6, 84],
            ];
            const divs = buildings
              .map(
                ([bw, bh]) => `
    <div style="width:${bw}%;height:${bh}%;background:#170f2e;border-top:2px solid #3b2a6b;position:relative">
      <div style="position:absolute;inset:6% 12%;background-image:repeating-linear-gradient(to right,#170f2e 0 5px,transparent 5px 13px),repeating-linear-gradient(to bottom,rgba(255,209,102,.85) 0 4px,transparent 4px 15px)"></div>
    </div>`,
              )
              .join('');
            return `<div style="width:100%;height:100%;display:flex;align-items:flex-end;gap:1.2%">${divs}</div>`;
          })(),
          width: w,
          height: Math.round(h * 0.3),
          contentScale: 1,
          opacity: 1,
          x: w / 2,
          y: Math.round(h * 0.52 - h * 0.15),
        },
        effects: [
          { type: 'fadeIn', params: { duration: 20 } },
          { type: 'flicker', params: { amount: 0.06, speed: 7 } },
        ],
      },
      {
        element: 'html',
        name: 'Car',
        layer: 5,
        offset: 0,
        duration: 240,
        props: {
          html: `
<svg viewBox="0 0 400 250" style="width:100%;height:100%;filter:drop-shadow(0 0 22px rgba(255,62,165,.65))">
  <defs>
    <linearGradient id="carbody" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#ffd166"/>
      <stop offset="45%" stop-color="#ff3ea5"/>
      <stop offset="100%" stop-color="#5b2c93"/>
    </linearGradient>
    <linearGradient id="carroof" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#b13a86"/>
      <stop offset="100%" stop-color="#4a2378"/>
    </linearGradient>
  </defs>
  <ellipse cx="200" cy="238" rx="165" ry="10" fill="#ff3ea5" opacity="0.35"/>
  <rect x="78" y="196" width="44" height="34" rx="7" fill="#0c0916"/>
  <rect x="278" y="196" width="44" height="34" rx="7" fill="#0c0916"/>
  <path d="M112 100 L134 52 Q139 42 150 42 L250 42 Q261 42 266 52 L288 100 Z" fill="url(#carroof)"/>
  <path d="M126 96 L143 58 Q146 52 153 52 L247 52 Q254 52 257 58 L274 96 Z" fill="#120b24"/>
  <path d="M70 138 Q70 104 102 100 L298 100 Q330 104 330 138 L336 192 Q337 210 316 210 L84 210 Q63 210 64 192 Z" fill="url(#carbody)"/>
  <rect x="86" y="150" width="228" height="13" rx="6.5" fill="#ffffff" style="filter:drop-shadow(0 0 8px #fff)"/>
  <circle cx="150" cy="196" r="7" fill="#1a1030" stroke="#ffd166" stroke-width="2"/>
  <circle cx="170" cy="196" r="7" fill="#1a1030" stroke="#ffd166" stroke-width="2"/>
  <circle cx="230" cy="196" r="7" fill="#1a1030" stroke="#ffd166" stroke-width="2"/>
  <circle cx="250" cy="196" r="7" fill="#1a1030" stroke="#ffd166" stroke-width="2"/>
</svg>`,
          width: Math.round(h * 0.42),
          height: Math.round(h * 0.27),
          contentScale: 1,
          opacity: 1,
          x: w / 2,
          y: Math.round(h * 0.76),
        },
        effects: [
          { type: 'slideIn', params: { direction: 'bottom', distance: 260, duration: 30, easing: 'easeOut' } },
          { type: 'float', params: { distance: 5, speed: 1.4 } },
        ],
      },
      {
        element: 'text',
        name: 'Retro Title',
        layer: 6,
        offset: 20,
        duration: 220,
        props: {
          text: 'OUTRUN',
          fontSize: Math.round(h * 0.13),
          color: '#ffe94d',
          fontFamily: 'Impact, sans-serif',
          fontWeight: 900,
          letterSpacing: 14,
          x: w / 2,
          y: h * 0.18,
        },
        effects: [
          { type: 'slideIn', params: { direction: 'top', distance: 200, duration: 25, easing: 'overshoot' } },
          { type: 'rgbSplit', params: { amount: 4, jitter: 1 } },
          { type: 'glow', params: { color: '#ff3ea5', radius: 24, pulseSpeed: 0.6 } },
        ],
      },
      {
        element: 'synthGrid',
        name: 'Grid Floor',
        layer: 4,
        offset: 0,
        duration: 240,
        props: { width: w, height: Math.round(h * 0.48), x: w / 2, y: h - Math.round(h * 0.24) },
        effects: [{ type: 'fadeIn', params: { duration: 20 } }],
      },
      {
        element: 'neonSun',
        name: 'Neon Sun',
        layer: 2,
        offset: 0,
        duration: 240,
        props: { size: Math.round(h * 0.58), x: w / 2, y: h * 0.38 },
        effects: [
          { type: 'fadeIn', params: { duration: 25 } },
          { type: 'transform', params: { start: 0, duration: 240, fromY: 60, toY: 0, fromX: 0, toX: 0, fromScale: 1, toScale: 1, fromRotate: 0, toRotate: 0, fromOpacity: 1, toOpacity: 1, easing: 'easeOut' } },
        ],
      },
      {
        element: 'background',
        name: 'Dusk BG',
        offset: 0,
        duration: 240,
        props: { fillType: 'linear', colorA: '#1c0533', colorB: '#0b0114', angle: 180 },
        effects: [],
      },
    ],
  },
  liquidType: {
    label: 'Liquid Type',
    icon: '🌊',
    description: 'Kinetic wave typography — add an audio URL to make it dance to the music',
    build: (w, h) => [
      {
        element: 'text',
        name: 'Liquid Title',
        offset: 0,
        duration: 180,
        props: {
          text: 'FEEL THE WAVE',
          fontSize: Math.round(h * 0.1),
          color: '#35c4ff',
          fontFamily: 'Impact, sans-serif',
          fontWeight: 900,
          letterSpacing: 8,
          x: w / 2,
          y: h * 0.45,
        },
        effects: [
          { type: 'letterWave', params: { amplitude: Math.round(h * 0.03), wavelength: 5, speed: 1.2 } },
          { type: 'glow', params: { color: '#35c4ff', radius: 26, pulseSpeed: 0 } },
          { type: 'fadeIn', params: { duration: 15 } },
        ],
      },
      {
        element: 'text',
        name: 'Liquid Sub',
        offset: 20,
        duration: 160,
        props: {
          text: 'set an Audio URL on the Liquid Wave effect →',
          fontSize: Math.round(h * 0.032),
          color: '#8b90a0',
          fontFamily: 'Helvetica, Arial, sans-serif',
          fontWeight: 400,
          x: w / 2,
          y: h * 0.62,
        },
        effects: [{ type: 'fadeIn', params: { duration: 20 } }],
      },
    ],
  },
  isoCityGrowth: {
    label: 'Iso City Growth',
    icon: '🏙️',
    description: 'Isometric skyline assembling out of a digital blueprint',
    build: (w, h) => [
      {
        element: 'isoCity',
        name: 'City',
        layer: 1,
        offset: 0,
        duration: 210,
        props: { x: w / 2, y: h * 0.52, tileSize: Math.round(h * 0.065) },
        effects: [{ type: 'fadeIn', params: { duration: 10 } }],
      },
      {
        element: 'text',
        name: 'City Title',
        layer: 2,
        offset: 130,
        duration: 80,
        props: {
          text: 'BUILD FAST',
          fontSize: Math.round(h * 0.07),
          color: '#ffffff',
          fontFamily: 'Helvetica, Arial, sans-serif',
          fontWeight: 900,
          letterSpacing: 6,
          x: w / 2,
          y: h * 0.9,
        },
        effects: [{ type: 'letterPop', params: { stagger: 1.5, duration: 14, distance: 40 } }],
      },
      {
        element: 'background',
        name: 'Blueprint BG',
        offset: 0,
        duration: 210,
        props: { fillType: 'radial', colorA: '#12172b', colorB: '#07090f', angle: 0 },
        effects: [],
      },
    ],
  },
  dayNight: {
    label: 'Day / Night Cycle',
    icon: '🌗',
    description: 'A full procedural day, built from editable pieces: sky, sun & moon, mountain ridges',
    build: (w, h) => [
      {
        element: 'skyCycle',
        name: 'Sky & Stars',
        layer: 0,
        offset: 0,
        duration: 300,
        props: { width: w, height: h, x: w / 2, y: h / 2 },
        effects: [],
      },
      {
        element: 'sunMoon',
        name: 'Sun & Moon',
        layer: 1,
        offset: 0,
        duration: 300,
        props: { width: w, height: Math.round(h * 0.8), size: Math.round(h * 0.08), x: w / 2, y: h * 0.4 },
        effects: [],
      },
      {
        element: 'ridge',
        name: 'Far Ridge',
        layer: 2,
        offset: 0,
        duration: 300,
        props: {
          width: w,
          height: Math.round(h * 0.42),
          peaks: 9,
          amplitude: Math.round(h * 0.22),
          baseHeight: Math.round(h * 0.13),
          colorDay: '#5f86b5',
          colorNight: '#141131',
          seed: 'far',
          x: w / 2,
          y: h - Math.round(h * 0.21),
        },
        effects: [],
      },
      {
        element: 'ridge',
        name: 'Near Ridge',
        layer: 3,
        offset: 0,
        duration: 300,
        props: {
          width: w,
          height: Math.round(h * 0.3),
          peaks: 7,
          amplitude: Math.round(h * 0.16),
          baseHeight: Math.round(h * 0.05),
          colorDay: '#39566e',
          colorNight: '#0b0920',
          seed: 'near',
          x: w / 2,
          y: h - Math.round(h * 0.15),
        },
        effects: [],
      },
    ],
  },
  commitTimeline: {
    label: 'Commit Timeline',
    icon: '🌿',
    description: 'Animated git history with glowing nodes and typing messages',
    build: (w, h) => [
      {
        element: 'commitGraph',
        name: 'History',
        layer: 1,
        offset: 15,
        duration: 285,
        props: { width: Math.round(w * 0.9), height: Math.round(h * 0.5), x: w / 2, y: h * 0.52 },
        effects: [{ type: 'fadeIn', params: { duration: 12 } }],
      },
      {
        element: 'text',
        name: 'Repo Title',
        layer: 2,
        offset: 0,
        duration: 300,
        props: {
          text: '~/product — git log',
          fontSize: Math.round(h * 0.038),
          color: '#6ee7a8',
          fontFamily: '"Courier New", monospace',
          fontWeight: 700,
          x: w / 2,
          y: h * 0.12,
        },
        effects: [{ type: 'typewriter', params: { charsPerSecond: 25 } }],
      },
      {
        element: 'background',
        name: 'Terminal BG',
        offset: 0,
        duration: 300,
        props: { fillType: 'solid', colorA: '#0a0d12', colorB: '#0a0d12', angle: 0 },
        effects: [],
      },
    ],
  },
  endCard: {
    label: 'End Card',
    icon: '🔔',
    description: '“Thanks for watching” + pulsing subscribe',
    build: (w, h) => [
      {
        element: 'text',
        name: 'Thanks',
        offset: 0,
        duration: 150,
        props: { text: 'Thanks for watching!', fontSize: Math.round(h * 0.085), x: w / 2, y: h * 0.4 },
        effects: [
          { type: 'letterPop', params: { stagger: 1.5, duration: 14, distance: 50 } },
          { type: 'shine', params: { period: 3, strength: 0.4 } },
        ],
      },
      {
        element: 'shape',
        name: 'Sub Button',
        offset: 20,
        duration: 130,
        props: {
          kind: 'rect',
          width: Math.round(w * 0.19),
          height: Math.round(h * 0.085),
          fill: '#e62b2b',
          borderRadius: Math.round(h * 0.043),
          x: w / 2,
          y: h * 0.6,
        },
        effects: [
          { type: 'springPop', params: { damping: 12, mass: 0.9 } },
          { type: 'pulse', params: { amount: 0.05, speed: 1.2 } },
        ],
      },
      {
        element: 'text',
        name: 'Sub Label',
        offset: 20,
        duration: 130,
        props: { text: 'SUBSCRIBE', fontSize: Math.round(h * 0.038), fontWeight: 900, x: w / 2, y: h * 0.6 },
        effects: [
          { type: 'springPop', params: { damping: 12, mass: 0.9 } },
          { type: 'pulse', params: { amount: 0.05, speed: 1.2 } },
        ],
      },
    ],
  },
};
