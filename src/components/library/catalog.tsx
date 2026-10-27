import type { ElementType } from '../../types';

/**
 * The library pane is a filter over the registry and the preset list — every
 * entry here already exists in `src/registry` or `src/presets.ts`.
 */
export interface TabDef {
  id: string;
  label: string;
  /** Registry types shown in this tab. Empty for the presets tab. */
  types: ElementType[];
}

export const TABS: TabDef[] = [
  { id: 'presets', label: 'Presets', types: [] },
  { id: 'text', label: 'Text', types: ['text', 'html', 'counter'] },
  { id: 'media', label: 'Media', types: ['image', 'video', 'gif', 'emoji', 'particles', 'blob'] },
  { id: 'audio', label: 'Audio', types: ['audio', 'wave'] },
  {
    id: 'scene',
    label: 'Scene',
    types: [
      'background',
      'shape',
      'cursor',
      'synthGrid',
      'neonSun',
      'isoCity',
      'skyCycle',
      'sunMoon',
      'ridge',
      'commitGraph',
      'nodeTrail',
    ],
  },
  { id: 'chart', label: 'Chart', types: ['candlestickChart'] },
  {
    id: 'motion',
    label: 'Motion',
    types: ['remocnMarkerHighlight', 'remocnSoftBlurIn', 'remocnTypewriter'],
  },
];

/** The dot colour of a group header — a semantic utility, never a raw colour. */
export const GROUP_DOT = 'bg-primary';
