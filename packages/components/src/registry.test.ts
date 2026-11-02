import { describe, expect, it } from 'vitest';
import {
  buildComponentProps,
  getComponent,
  listComponents,
  listComponentsByCategory,
  registerComponent,
  resolveEditModel,
  type ElementType,
  type Project,
} from '@chart-studio/core';
import { CATEGORY_LABELS, CATEGORY_ORDER } from './registry';

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
  it('explicitly excludes both transition definitions from content box fallback', () => {
    for (const type of ['crossfade','wipe'] as const) {
      expect(getComponent(type)?.renderMode).toBe('transition');
      expect(resolveEditModel(getComponent(type)!)).toBeUndefined();
    }
  });
  it('registers every inherited element', () => {
    for (const type of LEGACY_TYPES) {
      expect(getComponent(type), type).toBeDefined();
    }
  });

  it('keeps the inherited catalog metadata', () => {
    const text = getComponent('text')!;
    expect(text.label).toBe('Text');
    expect(text.icon).toBe('🅣');
    expect(text.category).toBe('base');
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
    const base = listComponentsByCategory('base');
    for (const type of LEGACY_TYPES) {
      expect(base.map((d) => d.type)).toContain(type);
    }
    expect(listComponents().length).toBeGreaterThanOrEqual(LEGACY_TYPES.length);
  });

  it('registers the whole catalogue from the aggregator alone', () => {
    // Nothing in this file imports a definition directly. The aggregator
    // imports them for their side effect, so this fails if a definition is
    // ever dropped — which is what happens when a package that registers
    // components is wrongly declared free of side effects.
    expect(listComponents().length).toBe(34);
    expect(listComponentsByCategory('base').length).toBe(24);
    expect(listComponentsByCategory('trading').length).toBe(7);
    expect(listComponentsByCategory('motion').length).toBe(3);
  });

  it('orders the library categories base → trading → motion', () => {
    expect(CATEGORY_ORDER).toEqual(['base', 'trading', 'motion']);
    expect(CATEGORY_LABELS.base).toBe('Elements');
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
      category: 'base',
      defaults: {},
      params: [],
      render: () => null,
    });
    expect(getComponent(type)?.label).toBe('Test');
    expect(listComponentsByCategory('base').map((d) => d.type)).toContain(type);
  });
});

it('rejects duplicate IDs without replacing their definition',()=> { const original=getComponent('text')!; expect(()=>registerComponent({...original,label:'replacement'})).toThrow(/duplicate/i); expect(getComponent('text')).toBe(original); });

it('rejects invalid handles for every declaration without replacing the original',()=>{const original=getComponent('text')!; for(const edit of [{pick:'box' as const,handles:[{id:'n',effect:'wrap' as const,props:['maxWidth']}]},{pick:'box' as const,handles:[{id:'se',effect:'scale' as const}]}]) {expect(()=>registerComponent({...original,type:('invalid-'+edit.handles[0].id) as ElementType,edit})).toThrow(/Invalid handle/);} });
