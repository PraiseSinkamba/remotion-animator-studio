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
 return {Player: React.forwardRef(function MockPlayer({inputProps}: {inputProps: {project: typeof project}}, _ref) { return <>{inputProps.project.tracks.flatMap(t=>t.clips).map(c=><div key={c.id} data-clip-id={c.id}/>)}</>; })};
});
afterEach(() => {cleanup();vi.restoreAllMocks();vi.unstubAllGlobals();});
const setup = (scale=1) => {
 vi.stubGlobal('PointerEvent',MouseEvent);
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


describe('preview measurement replacement and grouped movement',()=>{
 it('replaces a measured ID at the same count and picks the replacement measured box',()=>{
  const ui=setup();
  vi.stubGlobal('PointerEvent',MouseEvent);
  const frames=new Map<number,FrameRequestCallback>();let nextId=0;
  vi.stubGlobal('requestAnimationFrame',(callback:FrameRequestCallback)=>{frames.set(++nextId,callback);return nextId;});
  vi.stubGlobal('cancelAnimationFrame',(id:number)=>frames.delete(id));
  vi.spyOn(HTMLElement.prototype,'offsetWidth','get').mockReturnValue(300);
  vi.spyOn(HTMLElement.prototype,'offsetHeight','get').mockReturnValue(80);
  const setText=(id:string,x:number)=>act(()=>useStore.setState({project:{...project,tracks:[{id:'t',name:'t',clips:[{...clip,id,element:'text',from:0,props:{...getComponent('text')!.defaults,text:'X',fontSize:10,x,y:300}}]}]},selectedClipIds:[id]}));
  const flush=()=>act(()=>{const callbacks=[...frames.values()];frames.clear();callbacks.forEach(callback=>callback(0));});
  setText('first',300);flush();
  expect((ui.container.querySelector('.border-dashed.border-primary') as HTMLElement).style.width).toBe('300px');
  setText('replacement"[id]',800);flush();
  const box=ui.container.querySelector('.border-dashed.border-primary') as HTMLElement;
  expect(box.style.left).toBe('650px');expect(box.style.width).toBe('300px');
  expect(ui.container.querySelector('[data-clip-id="first"]')).toBeNull();
  expect(ui.container.querySelectorAll('[data-clip-id]')).toHaveLength(1);
  const stage=ui.container.querySelector('.preview-stage')!;
  fireEvent.pointerDown(stage,{button:0,clientX:300,clientY:300});
  expect(useStore.getState().selectedClipIds).toEqual([]);
  fireEvent.pointerDown(stage,{button:0,clientX:900,clientY:300});
  fireEvent.pointerUp(stage,{button:0,clientX:900,clientY:300});
  expect(useStore.getState().selectedClipIds).toEqual(['replacement"[id]']);
 });
 it('excludes locked group members from real body-drag targets',()=>{
  const ui=setup();vi.stubGlobal('PointerEvent',MouseEvent);
  const original=useStore.getState().project.tracks[0].clips[0];
  const locked={...original,id:'locked',groupId:'group',locked:true,props:{...original.props,x:600}};
  act(()=>useStore.setState({project:{...project,tracks:[{id:'t',name:'t',clips:[{...original,groupId:'group'},locked]}]},selectedClipIds:[original.id,locked.id]}));
  const update=useStore.getState().updateClipsProps;
  const patches=vi.fn(update);
  act(()=>useStore.setState({updateClipsProps:patches}));
  try {
   const stage=ui.container.querySelector('.preview-stage')!;
   fireEvent.pointerDown(stage,{button:0,clientX:300,clientY:300});
   fireEvent.pointerMove(stage,{clientX:350,clientY:320});
   fireEvent.pointerUp(stage,{clientX:350,clientY:320});
   expect(patches).toHaveBeenCalledTimes(1);
   expect(patches.mock.calls[0][0].map(p=>p.clipId)).toEqual([original.id]);
   const [moved,unchanged]=useStore.getState().project.tracks[0].clips;
   expect(moved.props.x).toBe(350);expect(moved.props.y).toBe(320);
   expect(unchanged).toBe(locked);
   expect(useStore.getState().history).toHaveLength(1);
  } finally {act(()=>useStore.setState({updateClipsProps:update}));}
 });
});

describe('live body gesture eligibility and finalization',()=>{
 it.each(['seek','hide'] as const)('finalizes last moved state when %s invalidates the target',kind=>{
  const ui=setup();const stage=ui.container.querySelector('.preview-stage')!;
  fireEvent.pointerDown(stage,{button:0,clientX:300,clientY:300});
  fireEvent.pointerMove(stage,{clientX:350,clientY:320});
  expect(useStore.getState().project.tracks[0].clips[0].props.x).toBe(350);
  act(()=>{if(kind==='seek')useStore.getState().setCurrentFrame(30);else useStore.getState().setClipHidden(clip.id,true);});
  const history=useStore.getState().history.length;
  fireEvent.pointerMove(stage,{clientX:450,clientY:420});
  expect(useStore.getState().project.tracks[0].clips[0].props.x).toBe(350);
  act(()=>{if(kind==='seek')useStore.getState().setCurrentFrame(0);else useStore.getState().setClipHidden(clip.id,false);});
  fireEvent.pointerMove(stage,{clientX:500,clientY:420});
  expect(useStore.getState().project.tracks[0].clips[0].props.x).toBe(350);
  // Visibility toggles have their own history; invalid movement creates none.
  expect(useStore.getState().history.length).toBe(history+(kind==='hide'?1:0));
 });
 it('creates no history for a body move below authored coordinate precision',()=>{
  const ui=setup(4);const stage=ui.container.querySelector('.preview-stage')!;
  fireEvent.pointerDown(stage,{button:0,clientX:1200,clientY:1200});
  fireEvent.pointerMove(stage,{clientX:1200.00001,clientY:1200});
  fireEvent.pointerUp(stage,{clientX:1200.00001,clientY:1200});
  expect(useStore.getState().history).toHaveLength(0);
  expect(useStore.getState().project.tracks[0].clips[0].props.x).toBe(300);
 });
 it.each(['body','handle'] as const)('preserves changed %s gestures on cancel and capture loss',target=>{
  for(const completion of ['pointerCancel','lostPointerCapture'] as const){
   const ui=setup();const stage=ui.container.querySelector('.preview-stage')!;
   const el=target==='body'?stage:ui.container.querySelector('.size-3')!;
   const start=target==='body'?300:250;
   fireEvent.pointerDown(el,{button:0,clientX:start,clientY:start});
   fireEvent.pointerMove(el,{clientX:start+20,clientY:start+20});
   const props=useStore.getState().project.tracks[0].clips[0].props;
   expect(useStore.getState().history).toHaveLength(1);
   fireEvent[completion](el);
   fireEvent.pointerMove(el,{clientX:start+80,clientY:start+80});
   expect(useStore.getState().project.tracks[0].clips[0].props).toBe(props);
   expect(useStore.getState().history).toHaveLength(1);
   cleanup();vi.restoreAllMocks();vi.unstubAllGlobals();
  }
 });
});

describe('projected manipulation at fixed frame',()=>{
 it.each([0.25,1,4])('tracks animated body and resize pointers at canvas scale %s',scale=>{
  const ui=setup(scale);
  const c=useStore.getState().project.tracks[0].clips[0];
  act(()=>useStore.setState({project:{...project,tracks:[{id:'t',name:'t',clips:[{...c,effects:[{id:'z',type:'zoomIn',params:{fromScale:2,duration:30}}]}]}]}}));
  const stage=ui.container.querySelector('.preview-stage')!;
  fireEvent.pointerDown(stage,{button:0,clientX:300*scale,clientY:300*scale});
  fireEvent.pointerMove(stage,{clientX:320*scale,clientY:310*scale});
  fireEvent.pointerUp(stage);
  let moved=useStore.getState().project.tracks[0].clips[0];
  expect(moved.props.x).toBe(320);expect(moved.props.y).toBe(310);
  const grips=ui.container.querySelectorAll('.size-3');const se=grips[2] as HTMLElement;
  const sx=parseFloat(se.style.left),sy=parseFloat(se.style.top);
  fireEvent.pointerDown(se,{clientX:sx,clientY:sy});fireEvent.pointerMove(se,{clientX:sx+20*scale,clientY:sy+40*scale});fireEvent.pointerUp(se);
  moved=useStore.getState().project.tracks[0].clips[0];
  expect(moved.props.width).toBeCloseTo(110,3);expect(moved.props.height).toBeCloseTo(120,3);
  const next=ui.container.querySelectorAll('.size-3');expect(parseFloat((next[0] as HTMLElement).style.left)).toBeCloseTo(220*scale,3);
  expect(parseFloat((next[2] as HTMLElement).style.left)).toBeCloseTo(sx+20*scale,3);
 });
});

describe('late content layout',()=>{
 it('refreshes local sizes after fonts, media and panel resize, then cleans listeners',()=>{
  const ui=setup();const frames=new Map<number,FrameRequestCallback>();let n=0;
  vi.stubGlobal('requestAnimationFrame',(cb:FrameRequestCallback)=>{frames.set(++n,cb);return n;});vi.stubGlobal('cancelAnimationFrame',(id:number)=>frames.delete(id));
  const callbacks:Array<()=>void>=[];const disconnect=vi.fn();
  vi.stubGlobal('ResizeObserver',class{constructor(cb:()=>void){callbacks.push(cb);}observe(){}disconnect(){disconnect();}});
  const fonts=new EventTarget();Object.defineProperty(document,'fonts',{configurable:true,value:fonts});
  const remove=vi.spyOn(fonts,'removeEventListener');let width=200;
  vi.spyOn(HTMLElement.prototype,'offsetWidth','get').mockImplementation(()=>width);vi.spyOn(HTMLElement.prototype,'offsetHeight','get').mockReturnValue(80);
  const text={...clip,id:'text',element:'text' as const,from:0,props:{...getComponent('text')!.defaults,text:'Late font',x:300,y:300}};
  act(()=>useStore.setState({project:{...project,tracks:[{id:'t',name:'t',clips:[text]}]},selectedClipIds:['text']}));
  const flush=()=>act(()=>{const pending=[...frames.values()];frames.clear();pending.forEach(cb=>cb(0));});
  const box=()=>ui.container.querySelector('.border-dashed.border-primary') as HTMLElement;
  flush();expect(box().style.width).toBe('200px');
  width=240;act(()=>fonts.dispatchEvent(new Event('loadingdone')));flush();expect(box().style.width).toBe('240px');
  width=280;act(()=>callbacks.forEach(cb=>cb()));flush();expect(box().style.width).toBe('280px');
  width=320;fireEvent.load(ui.container.querySelector('[data-clip-id]')!);flush();expect(box().style.width).toBe('320px');
  ui.unmount();expect(disconnect).toHaveBeenCalled();expect(remove).toHaveBeenCalledWith('loadingdone',expect.any(Function));
  Reflect.deleteProperty(document,'fonts');
 });
});

describe('gesture frame stability',()=>{
 it.each(['body','handle'] as const)('finalizes %s manipulation on a seek within the active interval',target=>{
  const ui=setup();
  const el=target==='body'?ui.container.querySelector('.preview-stage')!:ui.container.querySelector('.size-3')!;
  const start=target==='body'?300:250;
  fireEvent.pointerDown(el,{button:0,clientX:start,clientY:start});
  fireEvent.pointerMove(el,{clientX:start+10,clientY:start+10});
  const original=useStore.getState().project.tracks[0].clips[0].props;
  act(()=>useStore.getState().setCurrentFrame(1));
  fireEvent.pointerMove(el,{clientX:start+30,clientY:start+30});
  act(()=>useStore.getState().setCurrentFrame(0));
  fireEvent.pointerMove(el,{clientX:start+40,clientY:start+40});
  expect(useStore.getState().project.tracks[0].clips[0].props).toBe(original);
  expect(useStore.getState().history).toHaveLength(1);
 });
});
