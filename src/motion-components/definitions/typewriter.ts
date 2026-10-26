/**
 * Registry definition for the vendored Remocn "Typewriter" component.
 *
 * Importing this module registers the component (side effect) so
 * `getComponent('remocnTypewriter')` resolves it.
 *
 * See ../PROVENANCE.md for the upstream source, licence and local modifications.
 */
import { createElement } from 'react';
import { registerComponent } from '../../registry/registry';
import type { ComponentRenderContext, VideoComponentDefinition } from '../../registry/types';
import { Typewriter } from '../typewriter';

const POSITION_PARAMS = [
  { key: 'x', label: 'X', kind: 'number' as const, min: -1000, max: 5000, step: 1 },
  { key: 'y', label: 'Y', kind: 'number' as const, min: -1000, max: 4000, step: 1 },
];

export const remocnTypewriterDefinition: VideoComponentDefinition = {
  type: 'remocnTypewriter',
  label: 'Typewriter',
  icon: '⌨️',
  description: 'Types text out character by character with a blinking caret.',
  category: 'motion',
  propsVersion: 1,
  defaultDuration: 90,
  defaults: {
    text: 'Watch the story type itself',
    cursor: true,
    charsPerSecond: 22,
    speed: 1,
    fontSize: 48,
    color: '#ffffff',
    cursorColor: '#facc15',
    fontWeight: 600,
    x: 960,
    y: 540,
  },
  params: [
    { key: 'text', label: 'Text', kind: 'text' },
    { key: 'cursor', label: 'Show caret', kind: 'boolean' },
    { key: 'charsPerSecond', label: 'Characters per second', kind: 'number', min: 1, max: 120, step: 1 },
    { key: 'fontSize', label: 'Font size', kind: 'number', min: 8, max: 600, step: 1 },
    { key: 'color', label: 'Text colour', kind: 'color' },
    { key: 'cursorColor', label: 'Caret colour', kind: 'color' },
    { key: 'fontWeight', label: 'Font weight', kind: 'number', min: 100, max: 900, step: 100 },
    { key: 'speed', label: 'Speed', kind: 'number', min: 0.1, max: 5, step: 0.1 },
    ...POSITION_PARAMS,
  ],
  provenance: {
    source: 'https://remocn.dev/r/typewriter.json',
    license: 'MIT',
    revision: '2026-10-26',
    notes:
      'Vendored from Remocn (MIT, Copyright (c) 2026 Remocn). Local changes: dropped the Next.js "use client" directive; the root is a content-sized centred box instead of position:absolute/inset:0 with a hardcoded white background (the Chart Studio compositor positions the component and the composition owns the background); the font stack uses the editor stack "Helvetica, Arial, sans-serif" instead of var(--font-geist-sans); the text span does not wrap. Fifth change: the two upstream imports were repointed at the vendored local copies — "Caret" now comes from "./caret" (vendored from https://remocn.dev/r/caret.json) and "useTypewriter" from "./remocn-ui" (vendored from the upstream lib/remocn-ui timeline module). The animation maths, the props interface and the markup are unchanged. The default text and caret colours are light so the component reads on the dark composition background.',
  },
  // This module is a .ts file, so the adapter builds its element with
  // createElement instead of JSX.
  render: ({ props }: ComponentRenderContext) => {
    const p = { ...remocnTypewriterDefinition.defaults, ...props };
    return createElement(Typewriter, {
      text: p.text,
      cursor: p.cursor,
      charsPerSecond: p.charsPerSecond,
      speed: p.speed,
      fontSize: p.fontSize,
      color: p.color,
      cursorColor: p.cursorColor,
      fontWeight: p.fontWeight,
      className: p.className,
    });
  },
};

registerComponent(remocnTypewriterDefinition);
