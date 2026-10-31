// Local render server: lets the editor's "Export" button render real MP4s.
// Started automatically by `npm run dev` (see package.json).
import { bundle } from '@remotion/bundler';
import { renderMedia, renderStill, selectComposition } from '@remotion/renderer';
import { createReadStream, mkdirSync, readFileSync, statSync } from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { writeProvenanceSidecar } from '../src/provenance-sidecar.ts';

const PORT = 3333;
const OUT_DIR = path.resolve('out');
mkdirSync(OUT_DIR, { recursive: true });

/** @type {Map<string, {status: string, progress: number, file?: string, error?: string}>} */
const jobs = new Map();

let bundlePromise = null;
const getBundle = () => {
  // Bundle once per server run; restart the dev server if you edit src/remotion/*.
  if (!bundlePromise) {
    console.log('[render] bundling composition (first render only)...');
    bundlePromise = bundle({ entryPoint: path.resolve('packages/video/remotion/index.ts') });
  }
  return bundlePromise;
};

const startRender = async (id, project, options) => {
  const job = jobs.get(id);
  try {
    const serveUrl = await getBundle();
    const inputProps = { project };
    const composition = await selectComposition({ serveUrl, id: 'Main', inputProps });
    const scale = Number(options.scale) || 1;
    const safeName = String(project.name || 'animation').replace(/[^a-z0-9-_ ]/gi, '').trim() || 'animation';
    const file = path.join(OUT_DIR, `${safeName}-${id}.mp4`);
    job.status = 'rendering';
    console.log(
      `[render] ${safeName}: ${composition.width * scale}x${composition.height * scale} @ ${composition.fps}fps, ${composition.durationInFrames} frames`,
    );
    await renderMedia({
      composition,
      serveUrl,
      codec: 'h264',
      outputLocation: file,
      inputProps,
      scale,
      onProgress: ({ progress }) => {
        job.progress = progress;
      },
    });
    job.status = 'done';
    job.progress = 1;
    job.file = file;
    console.log(`[render] done → ${file}`);
    // The provenance travels with the file. Best-effort: a project that cannot
    // be described must not fail the export.
    writeProvenanceSidecar(file, project, {
      fps: composition.fps,
      frameCount: composition.durationInFrames,
    });
  } catch (err) {
    job.status = 'error';
    job.error = String(err?.message ?? err);
    console.error('[render] failed:', err);
  }
};

const json = (res, code, body) => {
  res.writeHead(code, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(body));
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);

  if (req.method === 'POST' && url.pathname === '/api/render') {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      try {
        const { project, options = {} } = JSON.parse(body);
        if (!project?.tracks) return json(res, 400, { error: 'Invalid project' });
        const id = Math.random().toString(36).slice(2, 10);
        jobs.set(id, { status: 'bundling', progress: 0 });
        startRender(id, project, options);
        json(res, 200, { id });
      } catch (e) {
        json(res, 400, { error: String(e) });
      }
    });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/still') {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', async () => {
      try {
        const { project, frame = 0, scale = 1 } = JSON.parse(body);
        if (!project?.tracks) return json(res, 400, { error: 'Invalid project' });
        const serveUrl = await getBundle();
        const inputProps = { project };
        const composition = await selectComposition({ serveUrl, id: 'Main', inputProps });
        const safeName = String(project.name || 'frame').replace(/[^a-z0-9-_ ]/gi, '').trim() || 'frame';
        const file = path.join(OUT_DIR, 'stills', `${safeName}-f${frame}.png`);
        mkdirSync(path.dirname(file), { recursive: true });
        console.log(`[still] rendering frame ${frame} @ ${Number(scale)}x → ${file}`);
        await renderStill({
          composition,
          serveUrl,
          frame: Math.max(0, Math.min(composition.durationInFrames - 1, Number(frame))),
          output: file,
          inputProps,
          scale: Number(scale) || 1,
        });
        const png = readFileSync(file);
        res.writeHead(200, {
          'Content-Type': 'image/png',
          'Content-Length': png.length,
          'Content-Disposition': `attachment; filename="${path.basename(file)}"`,
        });
        res.end(png);
      } catch (e) {
        console.error('[still] failed:', e);
        json(res, 500, { error: String(e?.message ?? e) });
      }
    });
    return;
  }

  const jobMatch = url.pathname.match(/^\/api\/job\/([a-z0-9]+)$/);
  if (req.method === 'GET' && jobMatch) {
    const job = jobs.get(jobMatch[1]);
    if (!job) return json(res, 404, { error: 'No such job' });
    return json(res, 200, { status: job.status, progress: job.progress, error: job.error });
  }

  const dlMatch = url.pathname.match(/^\/api\/download\/([a-z0-9]+)$/);
  if (req.method === 'GET' && dlMatch) {
    const job = jobs.get(dlMatch[1]);
    if (!job?.file) return json(res, 404, { error: 'Not ready' });
    const stat = statSync(job.file);
    res.writeHead(200, {
      'Content-Type': 'video/mp4',
      'Content-Length': stat.size,
      'Content-Disposition': `attachment; filename="${path.basename(job.file)}"`,
    });
    createReadStream(job.file).pipe(res);
    return;
  }

  json(res, 404, { error: 'Not found' });
});

server.listen(PORT, () => {
  console.log(`[render] render server listening on http://localhost:${PORT}`);
});
