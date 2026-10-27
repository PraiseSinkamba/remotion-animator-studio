/**
 * Registry definition for the vendored Remocn "Soft Blur In" component.
 *
 * Importing this module registers the component (side effect) so
 * `getComponent('remocnSoftBlurIn')` resolves it.
 *
 * See ../PROVENANCE.md for the upstream source, licence and local modifications.
 */
import { createElement } from 'react';
import { registerComponent } from '../../registry/registry';
import { componentBounds, type ComponentRenderContext, type VideoComponentDefinition } from '../../registry/types';
import { SoftBlurIn } from '../soft-blur-in';

const POSITION_PARAMS = [
  { key: 'x', label: 'X', kind: 'number' as const, min: -1000, max: 5000, step: 1 },
  { key: 'y', label: 'Y', kind: 'number' as const, min: -1000, max: 4000, step: 1 },
];

export const remocnSoftBlurInDefinition: VideoComponentDefinition = {
  type: 'remocnSoftBlurIn',
  label: 'Soft Blur In',
  icon: '🌫️',
  description: 'Characters resolve out of a blur, one by one, with a soft focus pull.',
  category: 'motion',
  propsVersion: 1,
  defaultDuration: 90,
  defaults: {
    text: 'Blur into focus',
    blur: 12,
    fontSize: 72,
    color: '#ffffff',
    fontWeight: 600,
    speed: 1,
    x: 960,
    y: 540,
  },
  params: [
    { key: 'text', label: 'Text', kind: 'text' },
    { key: 'blur', label: 'Blur radius', kind: 'number', min: 0, max: 40, step: 1 },
    { key: 'fontSize', label: 'Font size', kind: 'number', min: 8, max: 600, step: 1 },
    { key: 'color', label: 'Text colour', kind: 'color' },
    { key: 'fontWeight', label: 'Font weight', kind: 'number', min: 100, max: 900, step: 100 },
    { key: 'speed', label: 'Speed', kind: 'number', min: 0.1, max: 5, step: 0.1 },
    ...POSITION_PARAMS,
  ],
  provenance: {
    source: 'https://remocn.dev/r/soft-blur-in.json',
    license: 'MIT',
    revision: '2026-10-26',
    notes:
      'Vendored from Remocn (MIT, Copyright (c) 2026 Remocn). Local changes: dropped the Next.js "use client" directive; the root is a content-sized centred box instead of position:absolute/inset:0 (the Chart Studio compositor positions the component and the composition owns the background); the font stack uses the editor stack "Helvetica, Arial, sans-serif" instead of var(--font-geist-sans); the text span does not wrap. Animation maths, props interface and per-character markup are unchanged. The default text colour is light (#ffffff) so the component reads on the dark composition background.',
  },
  // The component has no size of its own, so the box falls back to 320×180.
  bounds: componentBounds,
  // This module is a .ts file, so the adapter builds its element with
  // createElement instead of JSX.
  render: ({ props }: ComponentRenderContext) => {
    const p = { ...remocnSoftBlurInDefinition.defaults, ...props };
    return createElement(SoftBlurIn, {
      text: p.text,
      blur: p.blur,
      fontSize: p.fontSize,
      color: p.color,
      fontWeight: p.fontWeight,
      speed: p.speed,
      className: p.className,
    });
  },
};

registerComponent(remocnSoftBlurInDefinition);
