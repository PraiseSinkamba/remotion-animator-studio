/**
 * The export provenance sidecar.
 *
 * A rendered video travels with a `<output>.provenance.json` beside it: the
 * record the core module builds, plus the export's own facts. The record says
 * where the data came from — origin, seed, algorithm version, revision — and
 * whether the intrabar path was simulated.
 *
 * Best-effort by design: a project that cannot be described never fails the
 * export. The video is the deliverable; the sidecar is the label.
 */
import { writeFileSync } from 'node:fs';

import { buildProvenance } from '@chart-studio/core/provenance';

/** The export's own facts, alongside the provenance record. */
export interface ProvenanceSidecarMeta {
  fps?: number;
  frameCount?: number;
}

/**
 * Writes `<outputPath>.provenance.json`.
 *
 * Never throws: a failure to describe the export is logged and swallowed.
 *
 * @returns the sidecar path, or null when it could not be written.
 */
export const writeProvenanceSidecar = (
  outputPath: string,
  project: unknown,
  meta: ProvenanceSidecarMeta = {},
): string | null => {
  const sidecarPath = `${outputPath}.provenance.json`;
  try {
    const record = buildProvenance(project as Parameters<typeof buildProvenance>[0]);
    const body = {
      ...record,
      fps: meta.fps ?? null,
      frameCount: meta.frameCount ?? null,
    };
    writeFileSync(sidecarPath, `${JSON.stringify(body, null, 2)}\n`, 'utf8');
    console.log(`[provenance] → ${sidecarPath}`);
    return sidecarPath;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[provenance] could not write ${sidecarPath}: ${message}`);
    return null;
  }
};
