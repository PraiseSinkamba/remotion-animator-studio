/**
 * Registry definition for the vendored Remocn "Marker Highlight" component.
 *
 * Importing this module registers the component (side effect) so
 * `getComponent('remocnMarkerHighlight')` resolves it.
 *
 * See ./PROVENANCE.md for the upstream source, licence and local modifications.
 */
import { createElement } from 'react';
import { registerComponent } from '../registry/registry';
import type { ComponentRenderContext, VideoComponentDefinition } from '../registry/types';
import { MarkerHighlight } from './marker-highlight';

const POSITION_PARAMS = [
  { key: 'x', label: 'X', kind: 'number' as const, min: -1000, max: 5000, step: 1 },
  { key: 'y', label: 'Y', kind: 'number' as const, min: -1000, max: 4000, step: 1 },
];

export const remocnMarkerHighlightDefinition: VideoComponentDefinition = {
  type: 'remocnMarkerHighlight',
  label: 'Marker Highlight',
  icon: '🖍',
  description: 'Colored marker block draws behind a phrase as the text color shifts.',
  category: 'motion',
  propsVersion: 1,
  defaultDuration: 90,
  defaults: {
    before: 'Watch ',
    highlight: 'price action',
    after: ' unfold',
    markerColor: '#facc15',
    baseColor: '#ffffff',
    highlightedTextColor: '#171717',
    fontSize: 72,
    fontWeight: 600,
    speed: 1,
    x: 960,
    y: 540,
  },
  params: [
    { key: 'before', label: 'Before', kind: 'text' },
    { key: 'highlight', label: 'Highlight', kind: 'text' },
    { key: 'after', label: 'After', kind: 'text' },
    { key: 'markerColor', label: 'Marker colour', kind: 'color' },
    { key: 'baseColor', label: 'Text colour', kind: 'color' },
    { key: 'highlightedTextColor', label: 'Highlighted text colour', kind: 'color' },
    { key: 'fontSize', label: 'Font size', kind: 'number', min: 8, max: 600, step: 1 },
    { key: 'fontWeight', label: 'Font weight', kind: 'number', min: 100, max: 900, step: 100 },
    { key: 'speed', label: 'Speed', kind: 'number', min: 0.1, max: 5, step: 0.1 },
    ...POSITION_PARAMS,
  ],
  provenance: {
    source: 'https://remocn.dev/r/marker-highlight.json',
    license: 'MIT',
    revision: '2026-10-25',
    notes:
      'Vendored from Remocn (MIT, Copyright (c) 2026 Remocn). Local changes: dropped the Next.js "use client" directive; the root is a content-sized centred box instead of position:absolute/inset:0 with a hardcoded white background (the Chart Studio compositor positions the component and the composition owns the background); the font stack uses the editor stack "Helvetica, Arial, sans-serif" instead of var(--font-geist-sans). Animation maths, props interface and marker markup are unchanged.',
  },
  // `definition.ts` is a .ts file, so the adapter builds its element with
  // createElement instead of JSX.
  render: ({ props }: ComponentRenderContext) => {
    const p = { ...remocnMarkerHighlightDefinition.defaults, ...props };
    return createElement(MarkerHighlight, {
      before: p.before,
      highlight: p.highlight,
      after: p.after,
      markerColor: p.markerColor,
      baseColor: p.baseColor,
      highlightedTextColor: p.highlightedTextColor,
      fontSize: p.fontSize,
      fontWeight: p.fontWeight,
      speed: p.speed,
      className: p.className,
    });
  },
};

registerComponent(remocnMarkerHighlightDefinition);
