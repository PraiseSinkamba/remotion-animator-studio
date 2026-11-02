import {describe,it,expect} from 'vitest';
import './registry';
import type {Clip} from '@chart-studio/core';
import {evaluateElementPose} from './element-pose';
const clip:Clip={id:'pose',name:'pose',element:'shape',from:10,durationInFrames:90,props:{x:100,y:100,width:200,height:100},effects:[{id:'slide',type:'slideIn',params:{direction:'right',distance:500,duration:30}}]};
describe('shared element pose',()=>{
 it('uses clip-relative effects and maps a 500 pixel translation',()=>{const pose=evaluateElementPose(clip,10,30);expect(pose.toComposition({x:100,y:100})).toEqual({x:600,y:100});expect(pose.toAuthored({x:600,y:100})).toEqual({x:100,y:100});});
 it('round trips intrinsic rotation and scale without seek history',()=>{const c={...clip,props:{...clip.props,rotation:35},effects:[{id:'z',type:'zoomIn' as const,params:{fromScale:2,duration:30}}]};for(const frame of [10,25,40,25,10]){const p=evaluateElementPose(c,frame,30);const result=p.toAuthored(p.toComposition({x:180,y:130})!);expect(result!.x).toBeCloseTo(180);expect(result!.y).toBeCloseTo(130);}});
 it('rejects zero scale',()=>{const p=evaluateElementPose({...clip,effects:[{id:'z',type:'zoomIn',params:{fromScale:0,duration:30}}]},10,30);expect(p.invertible).toBe(false);expect(p.toAuthored({x:1,y:2})).toBeNull();});
});

describe('perspective plane semantics',()=>{
 it.each(['horizontal','vertical'])('matches perspective=1200 %s flip and rejects edge-on',axis=>{
  const c={...clip,effects:[{id:'f',type:'flipIn' as const,params:{axis,duration:30,easing:'linear'}}]};
  expect(evaluateElementPose(c,10,30).invertible).toBe(false);
  const p=evaluateElementPose(c,25,30);const q={x:180,y:130};const v=p.toComposition(q)!;
  const angle=Math.PI/4; const z=axis==='horizontal'?30*Math.sin(angle):-80*Math.sin(angle);
  expect(v.x).toBeCloseTo(100+(axis==='horizontal'?80:80*Math.cos(angle))/(1-z/1200));
  expect(v.y).toBeCloseTo(100+(axis==='horizontal'?30*Math.cos(angle):30)/(1-z/1200));
  expect(p.toAuthored(v)!.x).toBeCloseTo(q.x);expect(p.toAuthored(v)!.y).toBeCloseTo(q.y);
 });
 it('projects absolute drawing endpoints around wrapper origin zero',()=>{
  const c:Clip={...clip,element:'trendline',props:{points:{start:{x:100,y:200},end:{x:300,y:400}}},effects:[{id:'z',type:'zoomIn',params:{fromScale:2,duration:30}}]};
  expect(evaluateElementPose(c,10,30).toComposition({x:100,y:200})).toEqual({x:200,y:400});
 });
});
