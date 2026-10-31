import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { buildProvenance, type Project } from '@chart-studio/core';
import { writeProvenanceSidecar } from './provenance-sidecar';

const project: Project = {
  name: 'Sidecar',
  width: 1920,
  height: 1080,
  fps: 30,
  durationInFrames: 60,
  backgroundColor: '#000000',
  schemaVersion: 2,
  series: [
    {
      id: 'series-manual',
      origin: 'manual',
      label: 'Manual series',
      timeBasis: 'logical',
      bars: [{ id: 'b0', t: 0, o: 10, h: 12, l: 9, c: 11 }],
    },
  ],
  tracks: [
    {
      id: 't-chart',
      name: 'Chart',
      clips: [
        {
          id: 'c-chart',
          name: 'Chart',
          element: 'candlestickChart',
          from: 0,
          durationInFrames: 60,
          props: { revealMode: 'simulated' },
          effects: [],
        },
      ],
    },
  ],
};

describe('writeProvenanceSidecar', () => {
  it('writes the record next to the video', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'chart-studio-sidecar-'));
    const output = path.join(dir, 'chart.mp4');

    const sidecarPath = writeProvenanceSidecar(output, project, { fps: 30, frameCount: 60 });

    expect(sidecarPath).toBe(`${output}.provenance.json`);
    if (!sidecarPath) throw new Error('no sidecar written');
    const body = JSON.parse(readFileSync(sidecarPath, 'utf8'));
    expect(body).toEqual({
      ...buildProvenance(project),
      fps: 30,
      frameCount: 60,
    });
  });

  it('does not throw when the project cannot be read', () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'chart-studio-sidecar-'));
    const output = path.join(dir, 'chart.mp4');

    // A project whose series is not a list: the record cannot be built.
    const sidecarPath = writeProvenanceSidecar(output, { series: {} }, {});

    expect(sidecarPath).toBeNull();
  });
});
