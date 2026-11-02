/** Real editor workflow, trusted CDP pointers, synthetic data only. No production test API.
 * Run: node scripts/verify-element-repair.mjs
 * Requires installed Remotion Chromium; emits screenshots and JSON to out/element-repair.
 */
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { openBrowser, renderStill, selectComposition } from '@remotion/renderer';
import { bundleVideo } from '../packages/video/tools/bundle.mjs';
import { createServer } from '../apps/studio/node_modules/vite/dist/node/index.js';

const out = path.resolve('out/element-repair');
mkdirSync(out, { recursive: true });
const server = await createServer({ root: path.resolve('apps/studio'), server: { port: 5197, strictPort: true } });
let browser;
const evidence = { synthetic: true, checks: [], frames: [] };
try {
  await server.listen();
  browser = await openBrowser('chrome');
  const page = await browser.newPage({ context: () => null, logLevel: 'error', indent: false, pageIndex: 0, onBrowserLog: null, onLog: () => {} });
  // Use canonical Vite /@fs URLs so verification imports share the app's module identity.
  const sourceRoot = '/@fs/' + path.resolve('packages').replaceAll('\\', '/') + '/';
  const evaluate = (fn, ...args) => page.evaluate(`(${fn.toString().replaceAll('/__verification/', sourceRoot)})(...${JSON.stringify(args)})`);
  await page.setViewport({ width: 1600, height: 1000, deviceScaleFactor: 1 });
  await page.goto({ url: 'http://localhost:5197', timeout: 60000 });
  const settle = () => evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
  for (let i = 0; i < 100; i++) {
    if (await evaluate(() => !!document.querySelector('.preview-stage [data-clip-id]') && document.body.innerText.includes('Saved locally'))) break;
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  const fixture = await evaluate(async () => {
    const { useStore } = await import('/__verification/editor/src/store.ts');
    const { getComponent, migrateProject } = await import('/__verification/components/src/index.ts');
    const make = (id, element, props, from = 0, durationInFrames = 60) => ({ id, name: id, element, props: { ...getComponent(element).defaults, ...props }, from, durationInFrames, effects: [] });
    const project = migrateProject({ schemaVersion: 4, name: 'SYNTHETIC element repair workflow', width: 960, height: 540, fps: 30, durationInFrames: 90, backgroundColor: '#101018', tracks: [
      { id: 'annotations', name: 'Synthetic annotations', clips: [make('rect', 'rectangle', { x: 200, y: 200, width: 120, height: 80, style: { color: '#ff00ff', lineWidth: 3 } }), make('arrow', 'arrow', { points: { start: { x: 80, y: 350 }, end: { x: 200, y: 400 } } }, 10, 40), make('title', 'text', { text: 'SYNTHETIC — editing verification', x: 480, y: 55, fontSize: 24 })] },
      { id: 'chart-track', name: 'Synthetic chart', clips: [make('chart', 'candlestickChart', { x: 700, y: 330, width: 360, height: 240, dataSource: 'synthetic', symbol: 'SYNTHETIC' }),make('safe-html','html',{x:130,y:120,width:220,height:120,html:'<h1>SYNTHETIC HTML</h1><ul><li>static list</li></ul><pre><code>const safe = true</code></pre>'})] },
    ] });
    useStore.getState().hydrate(project);
    useStore.setState({ selectedClipIds: [], history: [], future: [], currentFrame: 0, playing: false });
    return project;
  });
  await evaluate(async () => { const { seekTo } = await import('/__verification/editor/src/playerRef.ts'); seekTo(0); });
  await settle();
  // Raster comparisons use one display pixel per composition pixel.
  const alignStage = () => evaluate(() => { const stage=document.querySelector('.preview-stage'); stage.style.width='960px';stage.style.height='540px';stage.style.maxWidth='none';stage.style.flexShrink='0';stage.style.transform='none';const r=stage.getBoundingClientRect();stage.style.transform='translate('+(Math.round(r.x)-r.x)+'px,'+(Math.round(r.y)-r.y)+'px)'; });
  await alignStage();
  await settle();
  evidence.catalogue = await evaluate(async () => {
    const {listComponents,resolveEditModel}=await import('/__verification/components/src/index.ts');
    return listComponents().map(d=>({type:d.type,renderMode:d.renderMode,canvas:!!resolveEditModel(d)}));
  });
  assert.equal(evidence.catalogue.length,34);
  assert.equal(evidence.catalogue.filter(d=>d.canvas).length,30);
  const state = () => evaluate(async () => {
    const { useStore } = await import('/__verification/editor/src/store.ts');
    const s = useStore.getState();
    return { project: s.project, selected: s.selectedClipIds, history: s.history.length, frame: s.currentFrame };
  });
  const command = (method, ...args) => evaluate(async ({ method, args }) => {
    const { useStore } = await import('/__verification/editor/src/store.ts');
    useStore.getState()[method](...args);
  }, { method, args });
  const stage = () => evaluate(() => { const r = document.querySelector('.preview-stage').getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; });
  const mouse = async (type, x, y, buttons = 0) => { const r = await stage(); await page._client().send('Input.dispatchMouseEvent', { type, x: r.x + x * r.width / 960, y: r.y + y * r.height / 540, button: 'left', buttons, clickCount: 1 }); };
  const click = async (x, y) => { await mouse('mousePressed', x, y, 1); await mouse('mouseReleased', x, y); await settle(); };
  const drag = async (x, y, toX, toY) => { await mouse('mousePressed', x, y, 1); for (let i = 1; i <= 8; i++) await mouse('mouseMoved', x + (toX-x)*i/8, y + (toY-y)*i/8, 1); await mouse('mouseReleased', toX, toY); await settle(); };
  const screenshot = async name => { const { value: { data } } = await page._client().send('Page.captureScreenshot', { format: 'png' }); writeFileSync(path.join(out, name), Buffer.from(data, 'base64')); };
  const clip = s => s.project.tracks[0].clips.find(c => c.id === 'rect');
  await click(200, 200);
  assert.deepEqual((await state()).selected, ['rect']);
  await drag(200, 200, 400, 220);
  assert.ok(Math.abs(clip(await state()).props.x - 400) < 1);
  assert.equal((await state()).history, 1);
  await click(30, 480); await click(200, 200);
  assert.deepEqual((await state()).selected, []);
  await click(400, 220); assert.deepEqual((await state()).selected, ['rect']);
  await screenshot('01-moved-reselected.png');
  await drag(460, 260, 500, 290);
  assert.ok(clip(await state()).props.width > 150);
  const resized = clip(await state()).props.width;
  await command('undo'); assert.ok(clip(await state()).props.width < resized);
  await command('redo'); assert.equal(clip(await state()).props.width, resized);
  evidence.checks.push('trusted pointer move beyond old box, old-position miss, reselect, corner resize, one history entry per drag, undo/redo');
  await command('selectClip', 'rect'); await command('selectClip', 'arrow', true); await command('groupSelection');
  await command('setClipLocked', 'arrow', true);
  const beforeGroup = await state();
  await command('selectClip', null); await click(clip(beforeGroup).props.x, clip(beforeGroup).props.y);
  await drag(clip(beforeGroup).props.x, clip(beforeGroup).props.y, clip(beforeGroup).props.x + 30, clip(beforeGroup).props.y + 20);
  assert.deepEqual((await state()).project.tracks[0].clips.find(c => c.id === 'arrow').props, beforeGroup.project.tracks[0].clips.find(c => c.id === 'arrow').props);
  assert.ok(clip(await state()).props.x > clip(beforeGroup).props.x + 20);
  evidence.checks.push('grouped unlocked body moves; locked member geometry remains unchanged');
  await command('ungroupSelection');
  await command('selectClip', 'rect');
  await command('addEffect', 'rect', 'transform');
  const effectId = clip(await state()).effects[0].id;
  await command('updateEffectParams', 'rect', effectId, { fromRotate: 28, toRotate: 28, fromX: 0, toX: 0, fromScale: 1, toScale: 1 });
  await command('addEffect', 'rect', 'flipIn');
  await settle();
  // A stable 45-degree perspective pose, in addition to the planar rotation.
  await evaluate(async () => { const { seekTo } = await import('/__verification/editor/src/playerRef.ts'); seekTo(10); });
  await settle();
  const geometry = async () => evaluate(async () => {
    const { useStore } = await import('/__verification/editor/src/store.ts');
    const { elementRegion, projectedCorners } = await import('/__verification/editor/src/geometry.ts');
    const s = useStore.getState(), c = s.project.tracks[0].clips.find(c => c.id === 'rect');
    const points = projectedCorners(elementRegion(c, s.project, undefined, s.currentFrame));
    const root = document.querySelector('[data-clip-id="rect"]'), r = root.getBoundingClientRect(), stage = document.querySelector('.preview-stage').getBoundingClientRect();
    return { points, dom: { left: (r.left-stage.left)*960/stage.width, top: (r.top-stage.top)*540/stage.height, width: r.width*960/stage.width, height: r.height*540/stage.height }, polygons: document.querySelectorAll('.preview-stage polygon').length, frame: s.currentFrame };
  });
  for (const frame of [10, 25, 59, 25]) {
    await evaluate(async frame => { const { seekTo } = await import('/__verification/editor/src/playerRef.ts'); seekTo(frame); }, frame);
    await settle();
    const g = await geometry();
    const expected = { left: Math.min(...g.points.map(p=>p.x)), top: Math.min(...g.points.map(p=>p.y)), width: Math.max(...g.points.map(p=>p.x))-Math.min(...g.points.map(p=>p.x)), height: Math.max(...g.points.map(p=>p.y))-Math.min(...g.points.map(p=>p.y)) };
    for (const key of Object.keys(expected)) assert.ok(Math.abs(expected[key]-g.dom[key]) < 1, `${frame} ${key}: pose ${expected[key]}, Chromium ${g.dom[key]}`);
    evidence.frames.push({ frame, expected, chromium: g.dom, toleranceCompositionPx: 1 });
  }
  evidence.isolatedScene = await evaluate(() => {
    const scene = document.querySelector('.chartstudio-video');
    const stage = document.querySelector('.preview-stage').getBoundingClientRect();
    const iframe = document.createElement('iframe');
    iframe.style.cssText='position:absolute;left:-10000px;width:960px;height:540px;border:0';
    document.body.appendChild(iframe);
    try {
      const doc=iframe.contentDocument;doc.open();doc.write(`<html><body style="margin:0">${scene.outerHTML}</body></html>`);doc.close();
      const measure = (root,id) => { const node=root.querySelector(`[data-clip-id="${id}"]`);const r=node.getBoundingClientRect();return {width:r.width,height:r.height}; };
      const htmlStyles=(root,view)=>['h1','ul','li','pre','code'].map(tag=>{const node=root.querySelector(`[data-clip-id="safe-html"] ${tag}`),s=view.getComputedStyle(node);return {tag,fontFamily:s.fontFamily,fontSize:s.fontSize,fontWeight:s.fontWeight,lineHeight:s.lineHeight,margin:s.margin,padding:s.padding,listStyleType:s.listStyleType};});
      return {rectangle:{preview:measure(scene,'rect'),isolated:measure(doc,'rect')},chart:{preview:measure(scene,'chart'),isolated:measure(doc,'chart')},font:{preview:getComputedStyle(scene.querySelector('[data-testid="chart-label"]')).fontFamily,isolated:iframe.contentWindow.getComputedStyle(doc.querySelector('[data-testid="chart-label"]')).fontFamily},html:{preview:htmlStyles(scene,window),isolated:htmlStyles(doc,iframe.contentWindow)},stageWidth:stage.width};
    } finally {iframe.remove();}
  });
  for(const id of ['rectangle','chart']) for(const key of ['width','height']) assert.ok(Math.abs(evidence.isolatedScene[id].preview[key]*960/evidence.isolatedScene.stageWidth-evidence.isolatedScene[id].isolated[key])<1, `${id} no-editor-CSS wrapper ${key}: ${JSON.stringify(evidence.isolatedScene)}`);
  assert.equal(evidence.isolatedScene.font.preview,evidence.isolatedScene.font.isolated);
  assert.deepEqual(evidence.isolatedScene.html.preview,evidence.isolatedScene.html.isolated);
  evidence.checks.push('actual cloned scene without editor CSS retains SVG wrapper dimensions within 1px and identical computed chart font family');
  await command('selectClip', null); const posed = clip(await state()).props; await click(posed.x, posed.y);
  assert.ok((await state()).selected.includes('rect'));
  assert.ok((await geometry()).polygons > 0);
  await screenshot('02-rotated-projected-selection.png');
  await drag(posed.x, posed.y, posed.x+25, posed.y+15);
  assert.ok(Math.abs(clip(await state()).props.x-posed.x-25)<1);
  evidence.checks.push('rotated and perspective CSS geometry agrees with pure pose within 1 composition pixel at 10/25/59/25; trusted posed body selection and drag');
  await evaluate(async () => { const { seekTo } = await import('/__verification/editor/src/playerRef.ts'); seekTo(60); }); await settle();
  assert.equal(await evaluate(() => document.querySelectorAll('.preview-stage .size-3').length), 0);
  assert.equal(await evaluate(() => !!document.querySelector('[data-clip-id="rect"]')), false);
  await screenshot('03-out-boundary.png');
  evidence.checks.push('out frame 60 removes rendered rectangle and selected handles');
  // Exercise the actual workspace autosave and reload, including the real OPFS worker.
  await new Promise(resolve => setTimeout(resolve, 1600));
  const saved = (await state()).project;
  await page.goto({ url: 'http://localhost:5197', timeout: 60000 });
  for (let i=0;i<100;i++) { if ((await state()).project.name === saved.name) break; await new Promise(resolve=>setTimeout(resolve,100)); }
  assert.deepEqual((await state()).project, saved);
  await alignStage();
  await settle();
  evidence.checks.push('actual application autosave/reload restores edited project');
  const storageBadge = await evaluate(() => {
    const button = [...document.querySelectorAll('button')].find(button => button.textContent.includes('Saved locally'));
    if (!button) throw new Error('Missing saved storage indicator');
    const r = button.getBoundingClientRect(); return { x:r.x+r.width/2,y:r.y+r.height/2 };
  });
  await page._client().send('Input.dispatchMouseEvent', {type:'mouseMoved',...storageBadge});
  await new Promise(resolve=>setTimeout(resolve,1200));
  evidence.storageBackend = await evaluate(() => [...document.querySelectorAll('[role="tooltip"]')].map(node=>node.textContent).join(' '));
  assert.match(evidence.storageBackend,/SQLite \(OPFS\)/);
  await screenshot('04-saved-storage-backend.png');
  evidence.browser = await evaluate(() => ({ userAgent: navigator.userAgent, isolated: crossOriginIsolated, opfs: typeof navigator.storage?.getDirectory === 'function', status: document.body.innerText.match(/SQLite|saved locally|Saved|localStorage/gi) }));
  writeFileSync(path.join(out, 'project.json'), JSON.stringify(saved, null, 2));
  const serveUrl = await bundleVideo();
  const composition = await selectComposition({ serveUrl, id: 'Main', inputProps: { project: saved } });
  for (const frame of [0,10,25,59,60]) {
    await evaluate(async frame => { const { seekTo } = await import('/__verification/editor/src/playerRef.ts'); seekTo(frame); }, frame);
    await command('selectClip', null);
    await settle();
    await alignStage();
    await settle();
    const bounds = await stage();
    const previewName = `preview-${frame}.png`;
    await screenshot(previewName);
    await renderStill({ serveUrl, composition, inputProps: { project: saved }, frame, output: path.join(out, `export-${frame}.png`) });
    // Compare actual magenta rectangle raster extents; ignore text/font antialias differences.
    const raster = await evaluate(async ({ preview, exported, bounds }) => {
      const scan = async (url, crop) => {
        const image = new Image(); image.src = url; await image.decode();
        const canvas = document.createElement('canvas'); canvas.width = image.width; canvas.height = image.height;
        const ctx = canvas.getContext('2d'); ctx.drawImage(image, 0, 0);
        const pixels = ctx.getImageData(0,0,image.width,image.height).data;
        let left=Infinity, top=Infinity, right=-Infinity, bottom=-Infinity, count=0;
        for(let y=Math.ceil(crop.y);y<crop.y+crop.height;y++) for(let x=Math.ceil(crop.x);x<crop.x+crop.width;x++) {
          const i=(y*image.width+x)*4;
          if(pixels[i]>160 && pixels[i+1]<100 && pixels[i+2]>160) {left=Math.min(left,x);top=Math.min(top,y);right=Math.max(right,x);bottom=Math.max(bottom,y);count++;}
        }
        return count ? {left:(left-crop.x)*960/crop.width,top:(top-crop.y)*540/crop.height,right:(right-crop.x)*960/crop.width,bottom:(bottom-crop.y)*540/crop.height,count} : null;
      };
      const load = async (url,crop) => { const image=new Image();image.src=url;await image.decode();const canvas=document.createElement('canvas');canvas.width=960;canvas.height=540;const ctx=canvas.getContext('2d');ctx.drawImage(image,crop.x,crop.y,crop.width,crop.height,0,0,960,540);return ctx.getImageData(532,214,260,24).data; };
      const a=await load(preview,bounds), b=await load(exported,{x:0,y:0,width:960,height:540});
      let difference=0;for(let i=0;i<a.length;i++) if(i%4!==3) difference+=Math.abs(a[i]-b[i]);
      return {preview:await scan(preview,bounds),exported:await scan(exported,{x:0,y:0,width:960,height:540}),chartLabelMeanRgbError:difference/(a.length*0.75)};
    }, { preview: `data:image/png;base64,${readFileSync(path.join(out,previewName)).toString('base64')}`, exported: `data:image/png;base64,${readFileSync(path.join(out,`export-${frame}.png`)).toString('base64')}`, bounds });
    assert.equal(raster.preview === null, raster.exported === null, `frame ${frame} visibility parity`);
    if ([10,25,59].includes(frame)) assert.notEqual(raster.preview, null, `frame ${frame} must contain the visible rectangle`);
    if(raster.preview) for(const key of ['left','top','right','bottom']) assert.ok(Math.abs(raster.preview[key]-raster.exported[key])<3, `raster ${frame} ${key}`);
    assert.ok(raster.chartLabelMeanRgbError<3, `chart label raster ${frame}: ${raster.chartLabelMeanRgbError}; stage ${JSON.stringify(bounds)}`);
    evidence.frames.push({frame,raster,stage:bounds,toleranceCompositionPx:3});
  }
  evidence.checks.push('same edited project actual preview/export magenta raster bounds agree within 3 composition pixels at 0/10/25/59/60; null bounds agree at singular/inactive frames; editor overlay excluded by composition ownership');
  evidence.fixtureInitial = fixture.name;
  writeFileSync(path.join(out, 'evidence.json'), JSON.stringify(evidence, null, 2));
  console.log(JSON.stringify(evidence, null, 2));
} finally {
  await browser?.close({ silent: true });
  await server.close();
}
