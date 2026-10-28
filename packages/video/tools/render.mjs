// Renders a saved project JSON to an MP4 using Remotion's server-side renderer.
// Usage: npm run render            (renders ./project.json)
//        npm run render -- path/to/project.json [output.mp4]
import { bundle } from '@remotion/bundler';
import { renderMedia, selectComposition } from '@remotion/renderer';
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import path from 'node:path';

const projectPath = process.argv[2] ?? 'project.json';
const outPath = process.argv[3] ?? path.join('out', 'animation.mp4');

if (!existsSync(projectPath)) {
  console.error(
    `No project file at "${projectPath}". In the editor, click "Save" to download a project JSON, place it here, then re-run.`,
  );
  process.exit(1);
}

const project = JSON.parse(readFileSync(projectPath, 'utf8'));
mkdirSync(path.dirname(outPath), { recursive: true });

console.log(`Bundling composition...`);
const serveUrl = await bundle({ entryPoint: path.resolve('packages/video/remotion/index.ts') });

const inputProps = { project };
const composition = await selectComposition({ serveUrl, id: 'Main', inputProps });

console.log(
  `Rendering "${project.name}" — ${composition.width}x${composition.height} @ ${composition.fps}fps, ${composition.durationInFrames} frames...`,
);

await renderMedia({
  composition,
  serveUrl,
  codec: 'h264',
  outputLocation: outPath,
  inputProps,
  onProgress: ({ progress }) => {
    process.stdout.write(`\r${Math.round(progress * 100)}%   `);
  },
});

console.log(`\nDone → ${outPath}`);
