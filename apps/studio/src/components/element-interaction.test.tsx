// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import '@chart-studio/components';
import { pickableClips, hitTest } from './canvas-hit-test';
import { sampleProject, type Clip } from '@chart-studio/core';
const clip: Clip = { id: 'shape', element: 'shape', name: 'shape', from: 10, durationInFrames: 20, props: {x:800,y:300,width:200,height:100}, effects: [] };
const project = { ...sampleProject, tracks: [{id:'t',name:'t',clips:[clip]}] };
describe('canvas lifecycle and stale measurements', () => {
 it('uses current shape geometry after a move and resize', () => {
  const picks = pickableClips(project, new Map([[clip.id,{left:250,top:250,width:100,height:100}]]),10);
  expect(picks[0].box.left).toBe(700);
  expect(picks[0].box.width).toBe(200);
  expect(hitTest(picks,300,300)).toBeNull();
 });
 it.each([9,10,29,30])('checks the half-open frame interval at %s', frame => {
  expect(pickableClips(project, undefined, frame)).toHaveLength(frame>=10 && frame<30 ? 1:0);
 });
});

import React from 'react';
import { act, cleanup, render, fireEvent } from '@testing-library/react';
import { getComponent } from '@chart-studio/components';
import { PreviewPanel } from './PreviewPanel';
import { useStore } from '@chart-studio/editor';
vi.mock('@remotion/player', async () => {
 const React = await import('react');
 return {Player: React.forwardRef(function MockPlayer(_props, _ref) { return null; })};
});
afterEach(() => {cleanup();vi.restoreAllMocks();vi.unstubAllGlobals();});
const setup = (scale=1) => {
 vi.stubGlobal('ResizeObserver', class {constructor(private cb:()=>void) {} observe(){this.cb();} disconnect(){} });
 vi.stubGlobal('requestAnimationFrame', ()=>1);
 vi.stubGlobal('cancelAnimationFrame', ()=>{});
 vi.spyOn(HTMLElement.prototype,'clientWidth','get').mockReturnValue(1920*scale);
 vi.spyOn(HTMLElement.prototype,'clientHeight','get').mockReturnValue(1080*scale);
 vi.spyOn(HTMLElement.prototype,'getBoundingClientRect').mockReturnValue({left:0,top:0,width:1920*scale,height:1080*scale} as DOMRect);
 HTMLElement.prototype.setPointerCapture = ()=>{};
 const c={...clip,from:0,props:{...getComponent('shape')!.defaults,x:300,y:300,width:100,height:100}};
 useStore.setState({project:{...project,tracks:[{id:'t',name:'t',clips:[c]}]}, currentFrame:0, selectedClipIds:[c.id],drawingPath:null,swingPath:null,history:[],future:[]});
 return render(<PreviewPanel/>);
};
describe('actual preview and overlay',()=>{
 it.each([0.25,1,4])('tracks move and resize at scale %s',scale=>{
  const ui=setup(scale);
  const box=()=>ui.container.querySelector('.border-dashed.border-primary') as HTMLElement;
  expect(box().style.left).toBe(`${250*scale}px`);
  act(()=>useStore.getState().updateClipProps(clip.id,{x:800,width:200}));
  expect(box().style.left).toBe(`${700*scale}px`);
  expect(box().style.width).toBe(`${200*scale}px`);
  act(()=>useStore.getState().updateClipProps(clip.id,{x:900}));
  expect(box().style.left).toBe(`${800*scale}px`);
 });
 it('removes selected handles when locked, hidden, or outside the lifetime',()=>{
  const ui=setup();
  const handles=()=>ui.container.querySelectorAll('.size-3');
  expect(handles().length).toBeGreaterThan(0);
  act(()=>useStore.getState().setCurrentFrame(30));expect(handles()).toHaveLength(0);
  act(()=>useStore.getState().setCurrentFrame(0));expect(handles().length).toBeGreaterThan(0);
  act(()=>useStore.getState().setClipLocked(clip.id,true));expect(handles()).toHaveLength(0);
  act(()=>useStore.getState().setClipLocked(clip.id,false));
  act(()=>useStore.getState().setClipHidden(clip.id,true));expect(handles()).toHaveLength(0);
 });
 it('does not add history on unchanged handle click and clears cancelled gestures',()=>{
  const ui=setup();
  const handle=ui.container.querySelector('.size-3')!;
  fireEvent.pointerDown(handle,{clientX:250,clientY:250,pointerId:1});
  fireEvent.pointerUp(handle,{pointerId:1});
  expect(useStore.getState().history).toHaveLength(0);
  fireEvent.pointerDown(handle,{clientX:250,clientY:250,pointerId:1});
  fireEvent.pointerCancel(handle,{pointerId:1});
  fireEvent.pointerMove(handle,{clientX:200,clientY:200,pointerId:1});
  expect(useStore.getState().history).toHaveLength(0);
 });
});
