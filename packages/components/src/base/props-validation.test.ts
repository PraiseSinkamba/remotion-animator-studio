import { describe,it,expect } from 'vitest';
import {getComponent,normalizeComponentProps} from '../registry';
describe('encoded visual data',()=>{
 it.each(['nodeTrail','commitGraph'] as const)('rejects malformed JSON for %s',type=>{
 const definition=getComponent(type)!;
 expect(normalizeComponentProps(definition,{data:'{broken'}).ok).toBe(false);
 expect(normalizeComponentProps(definition,{data:'{}'}).ok).toBe(false);
 });
 it('rejects malformed point and commit records with nested paths',()=>{
 const trail=normalizeComponentProps(getComponent('nodeTrail')!,{data:'[{"x":"wrong","y":2}]'});
 expect(trail).toMatchObject({ok:false,issues:[{path:'data.0.x'}]});
 expect(normalizeComponentProps(getComponent('commitGraph')!,{data:'[{"m":5,"b":"wrong"}]'}).ok).toBe(false);
 });
});

it('rejects counter decimal counts outside the toFixed domain', () => {
 const def=getComponent('counter')!;
 for (const decimals of [-1,101,1.5]) {
  expect(normalizeComponentProps(def,{decimals})).toMatchObject({ok:false,issues:[{path:'decimals'}]});
 }
 for (const decimals of [0,100]) expect(normalizeComponentProps(def,{decimals}).ok).toBe(true);
});

it('rejects point counts the shape helpers cannot render', () => {
 const def=getComponent('shape')!;
 for (const [kind,points] of [['star',-1],['star',2.5],['polygon',2],['polygon',3.5]] as const) {
  expect(normalizeComponentProps(def,{kind,points})).toMatchObject({ok:false,issues:[{path:'points'}]});
 }
 for (const [kind,points] of [['star',1],['polygon',3]] as const) expect(normalizeComponentProps(def,{kind,points}).ok).toBe(true);
});
