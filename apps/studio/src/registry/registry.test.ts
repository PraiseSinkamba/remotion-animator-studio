import { describe, expect, it } from 'vitest';
import type { ElementType, Project } from '../types';
import { buildComponentProps, getComponent, listComponents, listComponentsByCategory, registerComponent } from './registry';
import { CATEGORY_LABELS, CATEGORY_ORDER } from './index';
import './legacy';

const LEGACY_TYPES: ElementType[] = [
  'text',
  'counter',
  'shape',
  'image',
  'video',
  'audio',
  'gif',
  'html',
  'cursor',
  'wave',
  'blob',
  'particles',
  'synthGrid',
  'neonSun',
  'isoCity',
  'skyCycle',
  'sunMoon',
  'ridge',
  'commitGraph',
  'nodeTrail',
  'emoji',
  'background',
];

describe('component registry', () => {
  it('registers every inherited element', () => {
    for (const type of LEGACY_TYPES) {
      expect(getComponent(type), type).toBeDefined();
    }
  });

  it('keeps the inherited catalog metadata', () => {
    const text = getComponent('text')!;
    expect(text.label).toBe('Text');
    expect(text.icon).toBe('🅣');
    expect(text.category).toBe('generic');
    expect(text.propsVersion).toBe(1);
    expect(text.defaults).toMatchObject({ text: 'Hello world', fontSize: 90 });
    expect(text.params.map((p) => p.key)).toContain('fontSize');
  });

  it('marks audio and background with their render modes', () => {
    expect(getComponent('audio')!.renderMode).toBe('audio');
    expect(getComponent('background')!.renderMode).toBe('background');
    expect(getComponent('text')!.renderMode ?? 'content').toBe('content');
  });

  it('returns undefined for an unknown component type', () => {
    expect(getComponent('not-a-real-element' as ElementType)).toBeUndefined();
  });

  it('lists components by category', () => {
    const generic = listComponentsByCategory('generic');
    for (const type of LEGACY_TYPES) {
      expect(generic.map((d) => d.type)).toContain(type);
    }
    expect(listComponents().length).toBeGreaterThanOrEqual(LEGACY_TYPES.length);
  });

  it('orders the library categories generic → trading → motion', () => {
    expect(CATEGORY_ORDER).toEqual(['generic', 'trading', 'motion']);
    expect(CATEGORY_LABELS.generic).toBe('Elements');
  });

  it('builds fresh props from the defaults, centred on the canvas', () => {
    const project: Project = {
      name: 'p',
      width: 1920,
      height: 1080,
      fps: 30,
      durationInFrames: 300,
      backgroundColor: '#000',
      tracks: [],
    };
    const props = buildComponentProps(getComponent('text')!, project);
    expect(props.text).toBe('Hello world');
    expect(props.x).toBe(960);
    expect(props.y).toBe(540);
  });

  it('registers a new component from a definition module', () => {
    const type = 'registered-by-test' as ElementType;
    registerComponent({
      type,
      label: 'Test',
      icon: '🧪',
      description: 'test component',
      category: 'generic',
      defaults: {},
      params: [],
      render: () => null,
    });
    expect(getComponent(type)?.label).toBe('Test');
    expect(listComponentsByCategory('generic').map((d) => d.type)).toContain(type);
  });
});
