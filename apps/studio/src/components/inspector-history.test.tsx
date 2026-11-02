// @vitest-environment jsdom
import React from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { sampleProject } from '@chart-studio/core';
import { getComponent } from '@chart-studio/components';
import { useStore } from '@chart-studio/editor';
import { Inspector } from './Inspector';
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

it('records only the first accepted change per inspector focus gesture', () => {
 vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
 const clip = {id:'counter',name:'Counter',element:'counter' as const,from:0,durationInFrames:90,props:{...getComponent('counter')!.defaults},effects:[]};
 useStore.setState({project:{...sampleProject,tracks:[{id:'track',name:'track',clips:[clip]}]},selectedClipIds:[clip.id],history:[],future:[],notice:null});
 const ui=render(<Inspector/>);
 const input=ui.getByRole('spinbutton', {name:'Decimals'}) as HTMLInputElement;
 fireEvent.focus(input);fireEvent.blur(input);
 expect(useStore.getState().history).toHaveLength(0);
 fireEvent.focus(input);fireEvent.change(input,{target:{value:'101'}});
 expect(useStore.getState().history).toHaveLength(0);
 expect(useStore.getState().project.tracks[0].clips[0].props.decimals).toBe(clip.props.decimals);
 fireEvent.change(input,{target:{value:'2'}});fireEvent.change(input,{target:{value:'3'}});fireEvent.blur(input);
 expect(useStore.getState().history).toHaveLength(1);
 expect(useStore.getState().project.tracks[0].clips[0].props.decimals).toBe(3);
 act(()=>useStore.getState().undo());
 expect(useStore.getState().project.tracks[0].clips[0].props.decimals).toBe(clip.props.decimals);
});

it('groups accepted effect control changes and rejects invalid edits', () => {
 vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} });
 const clip = {id:'effect-clip',name:'Shape',element:'shape' as const,from:0,durationInFrames:90,props:{...getComponent('shape')!.defaults},effects:[{id:'fx',type:'fadeIn' as const,params:{duration:15,easing:'linear',bez:'0, 0, 1, 1'}}]};
 useStore.setState({project:{...sampleProject,tracks:[{id:'track',name:'track',clips:[clip]}]},selectedClipIds:[clip.id],history:[],future:[],notice:null});
 const ui=render(<Inspector/>);
 fireEvent.mouseDown(ui.getByRole('tab',{name:'Effects'}),{button:0,ctrlKey:false});
 const input=ui.getByRole('spinbutton',{name:'Duration (frames)'}) as HTMLInputElement;
 fireEvent.focus(input);fireEvent.change(input,{target:{value:'0'}});
 expect(useStore.getState().history).toHaveLength(0);
 fireEvent.change(input,{target:{value:'20'}});fireEvent.change(input,{target:{value:'25'}});fireEvent.blur(input);
 expect(useStore.getState().history).toHaveLength(1);
 expect(useStore.getState().project.tracks[0].clips[0].effects[0].params.duration).toBe(25);
 act(()=>useStore.getState().undo());
 expect(useStore.getState().project.tracks[0].clips[0].effects[0].params.duration).toBe(15);
});
