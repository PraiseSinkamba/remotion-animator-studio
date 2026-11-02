/** Synthetic SC-03 drawing workflow: trusted Chromium pointers, SQLite reopen, real Remotion paint. */
import assert from 'node:assert/strict';
import {mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import path from 'node:path';
import {openBrowser, renderStill, selectComposition} from '@remotion/renderer';
import {createServer} from '../apps/studio/node_modules/vite/dist/node/index.js';
import {bundleVideo} from '../packages/video/tools/bundle.mjs';

const out=path.resolve('out/drawing-handles');
mkdirSync(out,{recursive:true});
const evidence={synthetic:true,scenario:'SC-03 drawing manipulation subset; no market data',checks:[],geometry:[],rasters:[]};
const server=await createServer({root:path.resolve('apps/studio'),server:{port:5198,strictPort:true}});
let browser;
try {
  await server.listen();
  browser=await openBrowser('chrome');
  const page=await browser.newPage({context:()=>null,logLevel:'error',indent:false,pageIndex:0,onBrowserLog:null,onLog:()=>{}});
  const sourceRoot='/@fs/'+path.resolve('packages').replaceAll('\\','/')+'/';
  const evaluate=(fn,...args)=>page.evaluate(`(${fn.toString().replaceAll('/__verification/',sourceRoot)})(...${JSON.stringify(args)})`);
  const settle=()=>evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  const state=()=>evaluate(async()=>{const {useStore}=await import('/__verification/editor/src/store.ts');const s=useStore.getState();return {project:s.project,selected:s.selectedClipIds,history:s.history.length,frame:s.currentFrame};});
  const command=(method,...args)=>evaluate(async({method,args})=>{const {useStore}=await import('/__verification/editor/src/store.ts');useStore.getState()[method](...args);},{method,args});
  const getClip=(s,id)=>s.project.tracks.flatMap(t=>t.clips).find(c=>c.id===id);
  const stage=()=>evaluate(()=>{const r=document.querySelector('.preview-stage').getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height};});
  const scaleStage=async scale=>{await evaluate(scale=>{const s=document.querySelector('.preview-stage');s.style.width=`${960*scale}px`;s.style.height=`${540*scale}px`;s.style.maxWidth='none';s.style.flexShrink='0';s.style.transform='none';const r=s.getBoundingClientRect();s.style.transform=`translate(${Math.round(r.x)-r.x}px,${Math.round(r.y)-r.y}px)`;},scale);await settle();const s=await stage();assert.ok(Math.abs(s.width-960*scale)<.1);};
  const mouse=async(type,x,y,buttons=0)=>{const r=await stage();await page._client().send('Input.dispatchMouseEvent',{type,x:r.x+x*r.width/960,y:r.y+y*r.height/540,button:'left',buttons,clickCount:1});};
  const click=async(x,y)=>{await mouse('mousePressed',x,y,1);await mouse('mouseReleased',x,y);await settle();};
  const drag=async(x,y,toX,toY)=>{await mouse('mousePressed',x,y,1);for(let i=1;i<=8;i++)await mouse('mouseMoved',x+(toX-x)*i/8,y+(toY-y)*i/8,1);await mouse('mouseReleased',toX,toY);await settle();};
  const screenshot=async name=>{const {value:{data}}=await page._client().send('Page.captureScreenshot',{format:'png'});writeFileSync(path.join(out,name),Buffer.from(data,'base64'));};
  const near=(actual,expected,label,tolerance=.15)=>assert.ok(Math.abs(actual-expected)<tolerance,`${label}: expected ${expected}, got ${actual}`);
  const grips=()=>evaluate(()=>[...document.querySelectorAll('.preview-stage .pointer-events-auto.size-3')].map(n=>({label:n.getAttribute('aria-label'),circle:n.classList.contains('rounded-full')})));
  const geometry=async id=>evaluate(async id=>{
    const {useStore}=await import('/__verification/editor/src/store.ts');
    const {elementRegion,handleAt,projectedCorners}=await import('/__verification/editor/src/geometry.ts');
    const {getComponent}=await import('/__verification/components/src/index.ts');
    const s=useStore.getState(),c=s.project.tracks.flatMap(t=>t.clips).find(c=>c.id===id),r=elementRegion(c,s.project,null,s.currentFrame);
    const stage=document.querySelector('.preview-stage').getBoundingClientRect();
    const rect=n=>{const b=n.getBoundingClientRect();return {left:(b.left-stage.left)*960/stage.width,top:(b.top-stage.top)*540/stage.height,width:b.width*960/stage.width,height:b.height*540/stage.height};};
    const root=document.querySelector(`[data-clip-id="${id}"]`);
    return {box:r.box,origin:r.origin,corners:projectedCorners(r),handles:getComponent(c.element).edit.handles.map(h=>({id:h.id,...handleAt(r,h,c)})),dom:rect(root),zones:[...root.querySelectorAll('rect')].map(rect),ratio:root.querySelector('[data-testid="drawing-risk-reward"]')?.textContent,lines:[...root.querySelectorAll('line')].map(n=>{const m=n.getScreenCTM();const a=new DOMPoint(+n.getAttribute('x1'),+n.getAttribute('y1')).matrixTransform(m),b=new DOMPoint(+n.getAttribute('x2'),+n.getAttribute('y2')).matrixTransform(m);return {start:{x:(a.x-stage.left)*960/stage.width,y:(a.y-stage.top)*540/stage.height},end:{x:(b.x-stage.left)*960/stage.width,y:(b.y-stage.top)*540/stage.height}};})};
  },id);
  const dragGrip=async(id,handle,dx,dy)=>{
    const p=(await geometry(id)).handles.find(h=>h.id===handle);
    const hit=await evaluate(p=>{const r=document.querySelector('.preview-stage').getBoundingClientRect();return document.elementFromPoint(r.x+p.x*r.width/960,r.y+p.y*r.height/540)?.classList.contains('pointer-events-auto');},p);
    assert.equal(hit,true,`${id} ${handle} grip must be unobscured at its declared location`);
    await drag(p.x,p.y,p.x+dx,p.y+dy);
  };
  await page.setViewport({width:1800,height:1100,deviceScaleFactor:1});
  await page.goto({url:'http://localhost:5198',timeout:60000});
  for(let i=0;i<150;i++){if(await evaluate(()=>document.body.innerText.includes('Saved locally')))break;await pause(100);}
  await evaluate(async()=>{
    const {useStore}=await import('/__verification/editor/src/store.ts');
    const {getComponent,migrateProject}=await import('/__verification/components/src/index.ts');
    const make=(id,element,props)=>({id,name:id,element,propsVersion:getComponent(element).propsVersion,props:{...getComponent(element).defaults,...props},from:0,durationInFrames:90,effects:[]});
    const project=migrateProject({schemaVersion:4,name:'SYNTHETIC drawing handles — SC-03 subset',width:960,height:540,fps:30,durationInFrames:90,backgroundColor:'#101018',tracks:[{id:'drawings',name:'SYNTHETIC drawings',clips:[
      make('position','position',{x:430,y:270,left:270,width:320,height:120,points:{entry:{x:270,y:270},target:{x:270,y:210},stop:{x:270,y:330}},style:{color:'#ff00ff',lineWidth:3},caption:'SYNTHETIC geometry'}),
      make('horizontal','horizontalLine',{x:600,y:80,width:40,style:{color:'#00ffff',lineWidth:3}}),
      make('vertical','verticalLine',{x:800,y:220,height:40,style:{color:'#ffff00',lineWidth:3}}),
      make('trend','trendline',{points:{start:{x:40,y:130},end:{x:200,y:210}}}),
      make('arrow','arrow',{points:{from:{x:50,y:360},to:{x:200,y:400}}}),
      make('rectangle','rectangle',{x:690,y:180,width:100,height:80}),
      make('label','text',{text:'SYNTHETIC — position / line editing',x:480,y:38,fontSize:22})]}]});
    useStore.getState().hydrate(project);useStore.setState({selectedClipIds:[],history:[],future:[],currentFrame:0,playing:false});
    const {seekTo}=await import('/__verification/editor/src/playerRef.ts');seekTo(0);
  });
  await settle();await scaleStage(1);
  await click(400,260);assert.deepEqual((await state()).selected,['position']);
  assert.deepEqual(await grips(),[{label:'Target',circle:false},{label:'Stop',circle:false},{label:'Entry',circle:true},{label:'Width',circle:true}]);
  await dragGrip('position','target',0,-90);await dragGrip('position','stop',0,110);
  let g=await geometry('position');near(g.box.top,120,'extended top');near(g.box.height,320,'extended height');near(g.dom.top,120,'paint top');near(g.dom.height,320,'paint height');
  assert.deepEqual(g.zones,[{left:270,top:120,width:320,height:150},{left:270,top:270,width:320,height:170}]);
  await screenshot('01-extended-levels-synthetic.png');
  await dragGrip('position','entry',25,40);
  let p=getClip(await state(),'position').props;
  assert.deepEqual(p.points,{entry:{x:270,y:310},target:{x:270,y:120},stop:{x:270,y:440}});
  assert.equal((await geometry('position')).ratio,'R 1.46');
  await dragGrip('position','width',100,25);p=getClip(await state(),'position').props;
  near(p.width,420,'width');near(p.left,270,'left anchored');assert.equal(p.points.entry.y,310);assert.equal(p.points.target.y,120);assert.equal(p.points.stop.y,440);
  await drag(450,220,510,240);p=getClip(await state(),'position').props;
  near(p.x,490,'body origin x');near(p.y,290,'body origin y');near(p.left,330,'body left');
  assert.deepEqual(p.points,{entry:{x:330,y:330},target:{x:330,y:140},stop:{x:330,y:460}});assert.equal('width' in p.points,false);
  evidence.geometry.push({phase:'extended-entry-width-body',...(await geometry('position'))});
  evidence.checks.push('Trusted four purpose grips; TP/SL extend beyond old box with visible zones; entry-only R 1.46; width 420 left fixed; body translates origin/left/real points only');
  await screenshot('02-entry-width-body-synthetic.png');
  // Repeat actual purpose manipulation at half scale, preserving one command per gesture.
  await scaleStage(.5);const beforeHalf=await state();await dragGrip('position','entry',0,-20);near(getClip(await state(),'position').props.points.entry.y,310,'half-scale entry');assert.equal((await state()).history,beforeHalf.history+1);await command('undo');assert.deepEqual(getClip(await state(),'position').props,getClip(beforeHalf,'position').props);
  await screenshot('03-half-scale-synthetic.png');await scaleStage(1);
  for(const scale of [1,.5]){
    await scaleStage(scale);
    await command('selectClip',null);await click(15,80);assert.deepEqual((await state()).selected,['horizontal']);assert.equal((await grips()).length,1);near((await geometry('horizontal')).handles[0].x,480,'horizontal center');
    let before=getClip(await state(),'horizontal').props;await drag(15,before.y,65,before.y-10);let after=getClip(await state(),'horizontal').props;near(after.x,before.x,'horizontal x locked');near(after.y,before.y-10,'horizontal body y');
    await dragGrip('horizontal','anchor',45,-10);after=getClip(await state(),'horizontal').props;near(after.x,before.x,'horizontal grip x locked');near(after.y,before.y-20,'horizontal grip y');await command('undo');await command('undo');
    await command('selectClip',null);await click(800,520);assert.deepEqual((await state()).selected,['vertical']);assert.equal((await grips()).length,1);near((await geometry('vertical')).handles[0].y,270,'vertical center');
    before=getClip(await state(),'vertical').props;await drag(before.x,520,before.x+10,490);after=getClip(await state(),'vertical').props;near(after.x,before.x+10,'vertical body x');near(after.y,before.y,'vertical y locked');
    await dragGrip('vertical','anchor',10,40);after=getClip(await state(),'vertical').props;near(after.x,before.x+20,'vertical grip x');near(after.y,before.y,'vertical grip y locked');await command('undo');await command('undo');
  }
  await scaleStage(1);
  for(const [id,point,keys] of [['trend',{x:120,y:170},['start','end']],['arrow',{x:110,y:376},['from','to']]]){
    await command('selectClip',null);await click(point.x,point.y);assert.deepEqual((await state()).selected,[id]);assert.equal((await grips()).length,2);
    assert.equal(await evaluate(()=>document.querySelectorAll('.preview-stage .border-dashed,.preview-stage polygon[stroke-dasharray]').length),0);
    const before=getClip(await state(),id).props.points;await drag(point.x,point.y,point.x+20,point.y+15);const after=getClip(await state(),id).props.points;
    for(const key of keys){near(after[key].x,before[key].x+20,`${id} ${key} x`);near(after[key].y,before[key].y+15,`${id} ${key} y`);}
  }
  await command('selectClip',null);await click(690,180);assert.deepEqual((await state()).selected,['rectangle']);assert.equal((await grips()).length,4);
  await dragGrip('rectangle','se',10,10);near(getClip(await state(),'rectangle').props.width,110,'rectangle resize');await command('undo');
  evidence.checks.push('At 1/.5 scale guides pick near endpoints, span 960×540 and have one center grip; body/grip axis locks; segments have two endpoints/no box and body translates both; rectangle retains four corners');
  await command('selectClip','horizontal');await screenshot('04-full-span-guide-synthetic.png');
  // Selected position export comparison below must include the overlay in the preview screenshot.
  const staticProject=(await state()).project;
  await command('selectClip','position');await screenshot('05-selected-position-before-export-synthetic.png');
  const exportCases=[{name:'static',project:staticProject}];
  await command('addEffect','position','transform');
  let effect=getClip(await state(),'position').effects[0].id;
  await command('updateEffectParams','position',effect,{fromRotate:15,toRotate:15,fromScale:.8,toScale:.8,fromX:0,toX:0,fromY:0,toY:0});await settle();
  g=await geometry('position');
  const expected={left:Math.min(...g.corners.map(p=>p.x)),top:Math.min(...g.corners.map(p=>p.y)),width:Math.max(...g.corners.map(p=>p.x))-Math.min(...g.corners.map(p=>p.x)),height:Math.max(...g.corners.map(p=>p.y))-Math.min(...g.corners.map(p=>p.y))};
  for(const key of Object.keys(expected))near(g.dom[key],expected[key],`posed ${key}`,1);
  const entryBefore=getClip(await state(),'position').props.points.entry;
  const handle=g.handles.find(h=>h.id==='entry');await drag(handle.x,handle.y,handle.x-4.1411,handle.y+15.4548);
  near(getClip(await state(),'position').props.points.entry.y,entryBefore.y+20,'posed local entry',.3);near(getClip(await state(),'position').props.points.target.y,140,'posed target fixed');await command('undo');
  await command('selectClip','position');await settle();
  evidence.geometry.push({phase:'scale .8 rotation 15',...(await geometry('position'))});await screenshot('06-posed-position-synthetic.png');exportCases.push({name:'posed',project:(await state()).project});
  evidence.checks.push('Position rendered bounds match projected geometry under scale .8/rotation 15 within 1px; trusted posed Entry drag writes local entry only');
  // Store a genuine old props-v3 document through the app autosave, then let normal reopen migrate it.
  const old=structuredClone(staticProject),oldPosition=getClip({project:old},'position');old.name+=' legacy props3';oldPosition.propsVersion=3;delete oldPosition.props.left;
  const legacyLeft=oldPosition.props.x-oldPosition.props.width/2;
  await command('hydrate',old);await pause(1800);
  assert.ok(await evaluate(()=>document.body.innerText.includes('Saved locally')));
  await page.goto({url:'http://localhost:5198',timeout:60000});
  for(let i=0;i<150;i++){if((await state()).project.name===old.name)break;await pause(100);}
  let reopened=await state();assert.equal(reopened.project.name,old.name);assert.equal(getClip(reopened,'position').propsVersion,4);near(getClip(reopened,'position').props.left,legacyLeft,'migrated old left');assert.deepEqual(getClip(reopened,'position').props.points,oldPosition.props.points);
  // A new edit commits migrated version 4, and a second real reload proves that version is durable.
  await command('updateClipProps','position',{caption:'SYNTHETIC migrated and saved props4'});await pause(1800);const migrated=(await state()).project;
  await page.goto({url:'http://localhost:5198',timeout:60000});
  for(let i=0;i<150;i++){if(getClip(await state(),'position')?.props.caption==='SYNTHETIC migrated and saved props4')break;await pause(100);}
  assert.deepEqual((await state()).project,migrated);await scaleStage(1);
  const badge=await evaluate(()=>{const n=[...document.querySelectorAll('button')].find(n=>n.textContent.includes('Saved locally'));const r=n.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};});
  await page._client().send('Input.dispatchMouseEvent',{type:'mouseMoved',...badge});await pause(1200);
  evidence.storageBackend=await evaluate(()=>[...document.querySelectorAll('[role="tooltip"]')].map(n=>n.textContent).join(' '));assert.match(evidence.storageBackend,/SQLite \(OPFS\)/);
  await screenshot('07-sqlite-migrated-props4-synthetic.png');
  evidence.checks.push('Actual application SQLite OPFS saves old props3, normal reopen migrates to props4 preserving levels and old left; edited props4 survives second reload');
  const serveUrl=await bundleVideo();
  for(const item of exportCases){
    await command('hydrate',item.project);await command('selectClip','position');await settle();await scaleStage(1);
    const bounds=await stage(),g=await geometry('position');await screenshot(`preview-${item.name}-selected.png`);
    assert.equal(g.lines.length,3,`${item.name} has three painted SVG levels`);
    const composition=await selectComposition({serveUrl,id:'Main',inputProps:{project:item.project}});
    const exportPath=path.join(out,`export-${item.name}.png`);await renderStill({serveUrl,composition,inputProps:{project:item.project},frame:0,output:exportPath});
    // Grips intentionally cover the left ends of level strokes. Compare painted geometry using
    // the unselected preview, then prove the selected overlay is absent at each grip below.
    await command('selectClip',null);await settle();await screenshot(`preview-${item.name}-clean.png`);
    // Paint masks are independent of overlay color: teal/red fills, magenta levels, cyan/yellow guides.
    const raster=await evaluate(async({preview,exported,bounds})=>{
      const load=async url=>{const i=new Image();i.src=url;await i.decode();const c=document.createElement('canvas');c.width=i.width;c.height=i.height;const ctx=c.getContext('2d');ctx.drawImage(i,0,0);return {data:ctx.getImageData(0,0,i.width,i.height).data,width:i.width};};
      const scan=(im,crop,test)=>{let left=Infinity,top=Infinity,right=-Infinity,bottom=-Infinity,count=0;for(let y=Math.ceil(crop.y);y<crop.y+crop.height;y++)for(let x=Math.ceil(crop.x);x<crop.x+crop.width;x++){const i=(y*im.width+x)*4;if(test(im.data[i],im.data[i+1],im.data[i+2])){left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);count++;}}return count?{left:(left-crop.x)*960/crop.width,top:(top-crop.y)*540/crop.height,right:(right-crop.x)*960/crop.width,bottom:(bottom-crop.y)*540/crop.height,count}:null;};
      const a=await load(preview),b=await load(exported),full={x:0,y:0,width:960,height:540};
      // .28-opacity zone over #101018: reward RGB(22,58,60), risk RGB(78,35,40).
      const masks={reward:(r,g,b)=>Math.abs(r-22)<=2&&Math.abs(g-58)<=2&&Math.abs(b-60)<=2,risk:(r,g,b)=>Math.abs(r-78)<=2&&Math.abs(g-35)<=2&&Math.abs(b-40)<=2,levels:(r,g,b)=>r>180&&g<80&&b>180,horizontal:(r,g,b)=>r<70&&g>180&&b>180,vertical:(r,g,b)=>r>180&&g>180&&b<70};
      return Object.fromEntries(Object.entries(masks).map(([name,test])=>[name,{preview:scan(a,bounds,test),exported:scan(b,full,test)}]));
    },{preview:`data:image/png;base64,${readFileSync(path.join(out,`preview-${item.name}-clean.png`)).toString('base64')}`,exported:`data:image/png;base64,${readFileSync(exportPath).toString('base64')}`,bounds});
    for(const [name,mask] of Object.entries(raster)){
      assert.ok(mask.preview&&mask.exported,`${item.name} ${name} paint exists`);
      for(const edge of ['left','top','right','bottom'])near(mask.preview[edge],mask.exported[edge],`${item.name} ${name} raster ${edge}`,3);
    }
    const levelSamples=await evaluate(async({preview,exported,bounds,lines})=>{
      const load=async(url,crop)=>{const i=new Image();i.src=url;await i.decode();const c=document.createElement('canvas');c.width=960;c.height=540;const ctx=c.getContext('2d');ctx.drawImage(i,crop.x,crop.y,crop.width,crop.height,0,0,960,540);return ctx.getImageData(0,0,960,540).data;};
      const a=await load(preview,bounds),b=await load(exported,{x:0,y:0,width:960,height:540});
      const painted=(data,p)=>{for(let y=Math.round(p.y)-1;y<=Math.round(p.y)+1;y++)for(let x=Math.round(p.x)-1;x<=Math.round(p.x)+1;x++){const i=(y*960+x)*4;if(data[i]>180&&data[i+1]<80&&data[i+2]>180)return true;}return false;};
      return lines.map(line=>[.1,.3,.5].map(t=>{const point={x:line.start.x+(line.end.x-line.start.x)*t,y:line.start.y+(line.end.y-line.start.y)*t};return {point,preview:painted(a,point),exported:painted(b,point)};}));
    },{preview:`data:image/png;base64,${readFileSync(path.join(out,`preview-${item.name}-clean.png`)).toString('base64')}`,exported:`data:image/png;base64,${readFileSync(exportPath).toString('base64')}`,bounds,lines:g.lines});
    for(const line of levelSamples)for(const sample of line){assert.equal(sample.preview,true,'declared level painted in preview');assert.equal(sample.exported,true,'declared level painted in export');}
    near(raster.horizontal.exported.left,0,'export horizontal left',2);near(raster.horizontal.exported.right,959,'export horizontal right',2);near(raster.vertical.exported.top,0,'export vertical top',2);near(raster.vertical.exported.bottom,539,'export vertical bottom',2);
    // Compare every selected grip neighborhood against the clean preview and actual export.
    const handles=await evaluate(async({selected,clean,exported,bounds,handles})=>{
      const load=async url=>{const image=new Image();image.src=url;await image.decode();const c=document.createElement('canvas');c.width=960;c.height=540;const ctx=c.getContext('2d');if(image.width===960&&image.height===540)ctx.drawImage(image,0,0);else ctx.drawImage(image,bounds.x,bounds.y,bounds.width,bounds.height,0,0,960,540);return ctx.getImageData(0,0,960,540).data;};
      const a=await load(selected),b=await load(clean),c=await load(exported);
      return handles.map(h=>{let selectionDifference=0,exportError=0,count=0;for(let y=Math.round(h.y)-4;y<=Math.round(h.y)+4;y++)for(let x=Math.round(h.x)-4;x<=Math.round(h.x)+4;x++){if(x<0||y<0||x>=960||y>=540)continue;for(let k=0;k<3;k++){const i=(y*960+x)*4+k;selectionDifference+=Math.abs(a[i]-b[i]);exportError+=Math.abs(c[i]-b[i]);count++;}}return {id:h.id,selectionMeanRgbDifference:selectionDifference/count,cleanExportMeanRgbError:exportError/count};});
    },{selected:`data:image/png;base64,${readFileSync(path.join(out,`preview-${item.name}-selected.png`)).toString('base64')}`,clean:`data:image/png;base64,${readFileSync(path.join(out,`preview-${item.name}-clean.png`)).toString('base64')}`,exported:`data:image/png;base64,${readFileSync(exportPath).toString('base64')}`,bounds,handles:g.handles});
    for(const h of handles){assert.ok(h.selectionMeanRgbDifference>5,`${item.name} ${h.id} selected grip visible`);assert.ok(h.cleanExportMeanRgbError<3,`${item.name} ${h.id} export has no grip: ${h.cleanExportMeanRgbError}`);}
    evidence.rasters.push({case:item.name,raster,levelSamples,handles,toleranceCompositionPx:3,gripMeanRgbTolerance:3});writeFileSync(path.join(out,`project-${item.name}.json`),JSON.stringify(item.project,null,2));
  }
  evidence.checks.push('Actual Remotion static/posed exports contain both zones/three levels/full-span guides; painted preview/export extents agree within 3px; all four grip neighborhoods match clean preview within mean RGB 3 while selected preview differs >5');
  evidence.browser=await evaluate(()=>({userAgent:navigator.userAgent,isolated:crossOriginIsolated,opfs:typeof navigator.storage?.getDirectory==='function'}));
  evidence.completedAt=new Date().toISOString();
  writeFileSync(path.join(out,'evidence.json'),JSON.stringify(evidence,null,2));
  writeFileSync(path.resolve('docs/reviews/evidence/drawing-handles-result.json'),JSON.stringify(evidence,null,2));
  console.log(JSON.stringify(evidence,null,2));
} finally {await browser?.close({silent:true});await server.close();}
