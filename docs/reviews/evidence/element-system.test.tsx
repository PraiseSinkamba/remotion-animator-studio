/** Diagnostic evidence: these assertions document existing defects, not fixed behavior. */
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, render } from '@testing-library/react';
import { getComponent, registerComponent, migrateProject, computeEffectStyle } from '../../../packages/components/src/index';
import { CounterAdapter, HtmlAdapter } from '../../../packages/components/src/base/adapters';
import type { Clip, Project } from '../../../packages/core/src/index';
import { dragEffect, elementRegion, hitsElement } from '../../../packages/editor/src/geometry';
import { useStore } from '../../../packages/editor/src/store';
import { hitTest, pickableClips } from '../../../apps/studio/src/components/canvas-hit-test';
import { PreviewPanel } from '../../../apps/studio/src/components/PreviewPanel';

vi.mock('@remotion/player', async () => {
  const React = await import('react');
  return ({
  Player: React.forwardRef(function PlayerMock({ inputProps }: { inputProps: { project: Project } }, _ref) {
    return <>{inputProps.project.tracks.flatMap(t => t.clips).map(c => <div key={c.id} data-clip-id={c.id} />)}</>;
  }),
  });
});

const clip = (patch: Partial<Clip> = {}): Clip => ({
  id: 'review-shape', name: 'Review shape', element: 'shape', from: 0,
  durationInFrames: 30, props: { ...getComponent('shape')!.defaults, x: 300, y: 200, width: 100, height: 100 },
  effects: [], ...patch,
});
const project = (...clips: Clip[]): Project => ({
  schemaVersion: 4, name: 'review', width: 1920, height: 1080, fps: 30,
  durationInFrames: 300, backgroundColor: '#000', tracks: [{ id: 'review-track', name: 'Review', clips }],
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe('current element-system defects (diagnostic assertions)', () => {
  it('actual PreviewPanel keeps the old measured box after a position and size update', () => {
    const frames = new Map<number, FrameRequestCallback>(); let nextId = 0;
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => { frames.set(++nextId, cb); return nextId; });
    vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id));
    vi.stubGlobal('ResizeObserver', class {
      constructor(private cb: () => void) {}
      observe() { this.cb(); }
      disconnect() {}
    });
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(1920);
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(1080);
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function () {
      const c = useStore.getState().project.tracks[0].clips[0];
      const isClip = this.hasAttribute('data-clip-id');
      const width = isClip ? c.props.width : 1920, height = isClip ? c.props.height : 1080;
      return { x: 0, y: 0, left: isClip ? c.props.x - width / 2 : 0,
        top: isClip ? c.props.y - height / 2 : 0, width, height, right: width, bottom: height, toJSON() {} } as DOMRect;
    });
    const c = clip();
    useStore.setState({ project: project(c), currentFrame: 0, selectedClipIds: [c.id], drawingPath: null, swingPath: null });
    const ui = render(<PreviewPanel />);
    const flushFrame = () => act(() => { const queued = [...frames.values()]; frames.clear(); queued.forEach(cb => cb(0)); });
    flushFrame();
    const box = () => ui.container.querySelector('.border-dashed.border-primary') as HTMLElement;
    expect(box().style.left).toBe('250px');
    act(() => useStore.getState().updateClipProps(c.id, { x: 800, width: 200 }));
    flushFrame();
    expect(useStore.getState().project.tracks[0].clips[0].props.x).toBe(800);
    // Desired: left=700,width=200. Observed: old geometry despite a fresh DOM measurement.
    expect(box().style.left).toBe('250px');
    expect(box().style.width).toBe('100px');
    const stale = new Map([[c.id, { left: 250, top: 150, width: 100, height: 100 }]]);
    expect(hitTest(pickableClips(useStore.getState().project, stale), 800, 200)).toBeNull();
    expect(hitTest(pickableClips(useStore.getState().project, stale), 300, 200)?.id).toBe(c.id);
  });

  it('picking returns a future clip over a currently visible clip', () => {
    const visible = clip({ id: 'visible' }), future = clip({ id: 'future', from: 100 });
    expect(hitTest(pickableClips(project(visible, future)), 300, 200)?.id).toBe('future');
  });

  it('an effect moves rendered content without moving the pick region', () => {
    const c = clip({ effects: [{ id: 'fx', type: 'transform', params: { fromX: 500, toX: 500 } }] });
    const fx = computeEffectStyle(0, 30, 30, c.effects);
    expect(fx.translateX).toBe(500);
    const region = elementRegion(c, project(c))!;
    expect(hitsElement('box', region, { x: 800, y: 200 }, 0)).toBe(false);
    expect(hitsElement('box', region, { x: 300, y: 200 }, 0)).toBe(true);
  });

  it('a vertical trendline cannot have an endpoint dragged sideways', () => {
    const c = clip({ element: 'trendline', propsVersion: 3, props: { points: { start: { x: 100, y: 100 }, end: { x: 100, y: 300 } } } });
    const patch = dragEffect(c, { id: 'start', effect: 'point' }, elementRegion(c, project(c))!, { x: 250, y: 120 }, { x: 100, y: 100 });
    expect(patch?.points).toMatchObject({ start: { x: 100, y: 120 } });
  });

  it('locking a selected clip leaves it selected and writable', () => {
    const c = clip();
    useStore.setState({ project: project(c), selectedClipIds: [c.id] });
    useStore.getState().setClipLocked(c.id, true);
    expect(useStore.getState().selectedClipIds).toContain(c.id);
    expect(pickableClips(useStore.getState().project)).toHaveLength(0);
    useStore.getState().updateClipProps(c.id, { x: 900 });
    expect(useStore.getState().project.tracks[0].clips[0].props.x).toBe(900);
  });

  it('current-version loading accepts malformed element props', () => {
    const c = clip({ props: { x: 'wrong', width: -100, height: 'wrong' } });
    expect(migrateProject(project(c)).tracks[0].clips[0].props).toEqual(c.props);
  });

  it('removing an optional edit declaration removes picking instead of falling back to a box', () => {
    const definition = getComponent('shape')!;
    try {
      registerComponent({ ...definition, edit: undefined });
      expect(elementRegion(clip(), project())).toBeNull();
    } finally { registerComponent(definition); }
  });

  it('a declared north wrap handle has no drag effect', () => {
    const c = clip({ element: 'text', props: { ...getComponent('text')!.defaults } });
    const handle = getComponent('text')!.edit!.handles.find(h => h.id === 'n')!;
    expect(dragEffect(c, handle, elementRegion(c, project(c))!, { x: 960, y: 300 }, { x: 960, y: 400 })).toBeNull();
  });

  it('counter wrap width is written by its handle but unused by its renderer', () => {
    const c = clip({ element: 'counter', props: { ...getComponent('counter')!.defaults, maxWidth: 40 } });
    const ui = render(<CounterAdapter clip={c} props={c.props} frame={0} fps={30} />);
    const content = ui.container.firstElementChild as HTMLElement;
    expect(content.style.maxWidth).toBe('');
    expect(content.style.whiteSpace).toBe('pre');
  });

  it('HTML elements retain event-handler attributes from project props', () => {
    // Inspect only; do not dispatch the handler or perform network requests.
    const c = clip({ element: 'html', props: { ...getComponent('html')!.defaults,
      html: '<button onclick="window.__review_probe = true">probe</button>' } });
    const ui = render(<HtmlAdapter clip={c} props={c.props} frame={0} fps={30} />);
    expect(ui.container.querySelector('button')?.getAttribute('onclick')).toBe('window.__review_probe = true');
  });
});

