/**
 * The export provenance record.
 *
 * A video that shows candles must say where the data came from, in the file
 * that ships with it. This module builds that statement from the project
 * document: one entry per series, each carrying the fields its origin's row
 * of the design's §5 table lists, plus the simulation flags that describe
 * *what was simulated* rather than where the data came from.
 *
 * Pure: the same project always gives the same record, and nothing is
 * materialised — the record reads the specs, so an authored path is never
 * regenerated just to describe it.
 *
 * Only type imports: the render tools import this module directly under plain
 * node, so it must not pull in runtime dependencies.
 */
import type { SeriesSpec } from './series';
import type { Project } from './schemas';

/** The provenance of one series, shaped by where the series came from. */
export type ProvenanceSeries =
  | {
      id: string;
      label: string;
      origin: 'authored-path';
      /** The generator's algorithm version. */
      algorithmVersion: number;
      /** The seed the generator ran with. */
      seed: string;
      /** The anchors the creator drew. */
      anchorCount: number;
    }
  | {
      id: string;
      label: string;
      origin: 'manual';
      /** The bars the creator typed. */
      barCount: number;
    }
  | {
      id: string;
      label: string;
      origin: 'synthetic';
      algorithmVersion: number;
      seed: string;
      /** The stored bars, when the series keeps them. */
      barCount?: number;
    }
  | {
      id: string;
      label: string;
      origin: 'imported';
      /** The revision of the source the series came from. */
      revision: string;
      /** The timestamp convention of the bars. */
      timeBasis: 'utc';
    };

/** What was simulated, independently of where the data came from. */
export interface ProvenanceSimulation {
  /**
   * True when a chart reveals its bars dynamically: a simulated intrabar path
   * (AN-005, MD-001, QA-005).
   */
  simulatedIntrabarPath: boolean;
  /** The chart clips that reveal their bars dynamically. */
  simulatedChartIds: string[];
}

/** The record that travels with an export. */
export interface ProvenanceRecord {
  /** The document schema version of the exported project. */
  schemaVersion: number;
  /** One entry per series in the project. */
  series: ProvenanceSeries[];
  /** The simulation flags of the project. */
  simulation: ProvenanceSimulation;
}

/**
 * Builds the provenance record of a project.
 *
 * Reads the specs only: a series' origin, seed, algorithm version, anchor
 * count and stored bar count all live in the spec. Nothing is materialised,
 * so an authored path is never regenerated to describe itself.
 */
export const buildProvenance = (project: Project): ProvenanceRecord => {
  const series: ProvenanceSeries[] = (project.series ?? []).map((spec) => {
    switch (spec.origin) {
      case 'authored-path':
        return {
          id: spec.id,
          label: spec.label,
          origin: 'authored-path',
          algorithmVersion: spec.algorithmVersion,
          seed: spec.seed,
          anchorCount: spec.path.anchors.length,
        };
      case 'manual':
        return {
          id: spec.id,
          label: spec.label,
          origin: 'manual',
          barCount: spec.bars.length,
        };
      case 'synthetic':
        return {
          id: spec.id,
          label: spec.label,
          origin: 'synthetic',
          algorithmVersion: spec.algorithmVersion,
          seed: spec.seed,
          ...(spec.bars ? { barCount: spec.bars.length } : {}),
        };
      case 'imported':
        return {
          id: spec.id,
          label: spec.label,
          origin: 'imported',
          revision: spec.revision,
          timeBasis: spec.timeBasis,
        };
    }
  });

  const simulatedChartIds = (project.tracks ?? [])
    .flatMap((track) => track.clips ?? [])
    .filter((clip) => clip.element === 'candlestickChart')
    .filter((clip) => {
      const props: Record<string, unknown> = clip.props ?? {};
      return props.revealMode === 'simulated';
    })
    .map((clip) => clip.id);

  return {
    schemaVersion: project.schemaVersion ?? 1,
    series,
    simulation: {
      simulatedIntrabarPath: simulatedChartIds.length > 0,
      simulatedChartIds,
    },
  };
};
