import {describe,it,expect} from 'vitest';
import {createPropsValidator} from './component-props';
describe('component props boundary',()=>{
 const validate=createPropsValidator({x:0,width:100,height:100,points:{start:{x:1,y:2}}});
 it('rejects malformed supplied fields',()=>{expect(validate({x:'wrong',width:-100,height:'wrong'}).ok).toBe(false);expect(validate({points:{start:{y:Infinity}}}).ok).toBe(false)});
 it('fills partial points preserving extensions without mutating input',()=>{const raw={points:{start:{x:20,extension:'ok'}},extension:true};const before=structuredClone(raw);expect(validate(raw)).toEqual({ok:true,value:{x:0,width:100,height:100,points:{start:{x:20,y:2,extension:'ok'}},extension:true}});expect(raw).toEqual(before)});
});

it('normalizes supported numeric font-weight selections and rejects wrong values', () => {
  const validate=createPropsValidator({fontWeight:700},[{key:'fontWeight',label:'Weight',kind:'select',options:['400','700']}]);
  expect(validate({fontWeight:'700'})).toEqual({ok:true,value:{fontWeight:700}});
  expect(validate({fontWeight:'wrong'}).ok).toBe(false);
});
