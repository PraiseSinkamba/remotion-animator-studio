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
