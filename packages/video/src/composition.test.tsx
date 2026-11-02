import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { sampleProject } from '@chart-studio/core';
import { MainComposition } from './composition';
vi.mock('remotion',async importOriginal=>{
  const actual=await importOriginal<typeof import('remotion')>();
  return {...actual,useCurrentFrame:()=>10,useVideoConfig:()=>({fps:30}),
    Sequence:({children}:{children:React.ReactNode})=><>{children}</>};
});

describe('composition isolation from editor typography', () => {
  it('lays out position paint bounds around the stable pivot and renders no editing grips',()=>{
    const markup=renderToStaticMarkup(<MainComposition project={{...sampleProject,width:960,height:540,tracks:[{id:'t',name:'t',clips:[{
      id:'p',name:'Synthetic position',element:'position',from:0,durationInFrames:90,propsVersion:4,
      props:{x:430,y:270,left:270,width:420,height:240,points:{entry:{x:270,y:310},target:{x:270,y:120},stop:{x:270,y:440}}},
      effects:[{id:'z',type:'zoomIn',params:{fromScale:2,duration:30}},{id:'r',type:'rotate',params:{rpm:20}}],
    }]}]}}/>);
    expect(markup).toContain('left:270px;top:120px;transform-origin:160px 150px');
    expect(markup).toContain('viewBox="0 0 420 320"');
    expect(markup).toContain('rotate(40deg)');
    expect(markup).not.toContain('translate(-50%');
    expect(markup).not.toMatch(/size-3|aria-label="(Entry|Width|Target|Stop)"/);
  });
  it.each(['horizontalLine','verticalLine'] as const)('renders %s across a non-default composition',element=>{
    const markup=renderToStaticMarkup(<MainComposition project={{...sampleProject,width:960,height:540,tracks:[{id:'t',name:'t',clips:[{
      id:'g',name:'Guide',element,from:0,durationInFrames:90,propsVersion:3,props:{x:430,y:270,width:15,height:15},effects:[],
    }]}]}}/>);
    expect(markup).toContain(element==='horizontalLine'?'viewBox="0 0 960 24"':'viewBox="0 0 24 540"');
    expect(markup).toContain(element==='horizontalLine'?'left:0;top:258px':'left:418px;top:0');
  });
  it('owns the font and line height inherited by chart SVG labels', () => {
    const markup = renderToStaticMarkup(<MainComposition project={{...sampleProject,tracks:[]}} />);
    expect(markup).toContain('font-family:Arial, sans-serif');
    expect(markup).toContain('line-height:1.2');
    expect(markup).toContain('.chartstudio-video svg,.chartstudio-video img,.chartstudio-video video{display:block;vertical-align:middle}');
    expect(markup).not.toContain('size-3');
  });
});
