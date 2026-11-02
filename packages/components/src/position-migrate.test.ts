import {describe,expect,it} from 'vitest';
import {migrateProject} from './project-migrate';
import {getComponent,normalizeComponentProps,type Clip,type Project} from './registry';

const document = (schemaVersion:number,propsVersion:number,props:Record<string,unknown>):Project => ({
  name:'Synthetic drawing migration',width:960,height:540,fps:30,durationInFrames:90,backgroundColor:'#000',schemaVersion,
  tracks:[{id:'t',name:'t',clips:[{id:'p',name:'Position',element:'position',from:0,durationInFrames:90,effects:[],propsVersion,props}]}],
});
const migrated = (doc:Project):Clip => migrateProject(doc).tracks[0].clips[0];

describe('position props v4 migration',()=>{
  it.each([2,3,4])('converts fractional v2 levels before adding left in project v%s',schema=>{
    const props={x:430,y:270,width:320,height:240,style:{color:'#abc',future:{keep:true}},extension:{keep:true},
      points:{entry:{x:0,y:0.5,note:{keep:true}},target:{x:0,y:-0.5},stop:{x:0,y:1.5},extra:{x:0.2,y:0.6,note:'keep'}}};
    const doc=document(schema,2,props),before=structuredClone(doc);
    const result=migrateProject(doc),clip=result.tracks[0].clips[0];
    expect(clip.propsVersion).toBe(4);
    expect(clip.props).toMatchObject({left:270,x:430,y:270,width:320,height:240,style:props.style,extension:props.extension,
      points:{entry:{x:270,y:270,note:{keep:true}},target:{x:270,y:30},stop:{x:270,y:510},extra:props.points.extra}});
    expect(doc).toEqual(before);expect(migrateProject(result)).toEqual(result);
  });
  it.each([3,4])('retains absolute v3 levels in project v%s',schema=>{
    const points={entry:{x:280,y:310,note:{keep:true}},target:{x:270,y:120},stop:{x:270,y:440}};
    const clip=migrated(document(schema,3,{x:430,y:270,width:320,points}));
    expect(clip.props.points).toEqual(points);expect(clip.props.left).toBe(270);
  });
  it.each([2,3,4])('uses old sparse fractional defaults in project v%s',schema=>{
    const clip=migrated(document(schema,2,{x:430,y:270,points:{target:{x:0,y:-0.5,note:'keep'}}}));
    const normalized=normalizeComponentProps(getComponent('position')!,clip.props);
    expect(normalized).toMatchObject({ok:true,value:{left:270,width:320,height:240,
      points:{entry:{x:270,y:270},target:{x:270,y:30,note:'keep'},stop:{x:270,y:330}}}});
  });
  it.each([2,3,4])('migrates fallback v1 props without chart using legacy defaults in project v%s',schema=>{
    const clip=migrated(document(schema,1,{x:430,y:270,width:320,height:240,extension:{keep:true}}));
    expect(clip.props).toMatchObject({left:270,extension:{keep:true},points:{entry:{x:270,y:270},target:{x:270,y:210},stop:{x:270,y:330}}});
  });
  it('preserves nested v1 fallback point and style extensions',()=>{
    const doc=document(4,1,{style:{color:'#abc',future:{keep:true}},points:{entry:{x:0,y:0.5,note:{keep:true}}}});
    const before=structuredClone(doc),clip=migrated(doc);
    expect(clip.props).toMatchObject({style:{color:'#abc',future:{keep:true}},points:{entry:{x:800,y:540,note:{keep:true}}}});
    expect(doc).toEqual(before);
  });
  it('does not stamp retired fractional high/low points as current coordinates',()=>{
    const doc=document(4,2,{x:430,y:270,width:320,height:240,points:{top:{x:0.5,y:0},bottom:{x:0.5,y:1}}});
    (doc.tracks[0].clips[0] as {element:string}).element='highLowLine';
    const c=migrated(doc);
    expect(c.element).toBe('trendline');expect(c.propsVersion).toBe(3);
    expect(c.props.points).toEqual({start:{x:430,y:150},end:{x:430,y:390}});
  });
  it.each([{width:'bad'},{x:NaN},{points:{entry:{x:0,y:'bad'}}},{left:'bad'}])('rejects invalid legacy supplied values %j',bad=>{
    expect(()=>migrated(document(4,2,{...bad}))).toThrow();
  });
});
