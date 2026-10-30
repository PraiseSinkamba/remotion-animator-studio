/**
 * Project document migrations.
 *
 * The only place where legacy documents are reshaped. Every load boundary
 * (opening a file, restoring the autosave, resolving the Remotion composition)
 * runs a document through `migrateProject` before it reaches the editor.
 *
 * Rules (docs/spec/COMPONENT_CONTRACT.md §5):
 * - a missing `schemaVersion` means version 1 (legacy document);
 * - a *higher* `schemaVersion` is rejected with a clear error, never guessed;
 * - a clip whose `propsVersion` is newer than its component's is rejected;
 * - an unknown component type is rejected.
 *
 * The migration is non-destructive and idempotent:
 * `migrateProject(migrateProject(p))` deep-equals `migrateProject(p)`.
 */
import { getComponent } from './registry';
import type { Clip, ElementType, OhlcBar, Project, SeriesSpec, Track } from '@chart-studio/core';

/** Schema version this build writes and understands. */
export const CURRENT_PROJECT_SCHEMA_VERSION = 2;

function fail(message: string): never {
  throw new Error(message);
}

const migrateClip = (raw: unknown, index: number): Clip => {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    fail(`Invalid project file: track clip ${index} is not an object.`);
  }
  const clip = raw as Record<string, unknown>;

  const id = typeof clip.id === 'string' ? clip.id : '';
  const element = clip.element;
  if (typeof element !== 'string') fail(`Invalid project file: clip "${id}" has no component type.`);

  const definition = getComponent(element as ElementType);
  if (!definition) fail(`Unsupported component type "${element}"`);

  const definitionVersion = definition.propsVersion ?? 1;
  const clipVersion = typeof clip.propsVersion === 'number' ? clip.propsVersion : 1;
  if (clipVersion > definitionVersion) {
    fail(`Clip "${id}" uses props version ${clipVersion} but "${element}" supports ${definitionVersion}`);
  }

  return {
    ...(clip as unknown as Clip),
    id,
    name: typeof clip.name === 'string' ? clip.name : definition.label,
    element: element as ElementType,
    from: typeof clip.from === 'number' ? clip.from : 0,
    durationInFrames: typeof clip.durationInFrames === 'number' ? clip.durationInFrames : 1,
    props:
      typeof clip.props === 'object' && clip.props !== null && !Array.isArray(clip.props)
        ? (clip.props as Record<string, unknown>)
        : {},
    effects: Array.isArray(clip.effects) ? (clip.effects as Clip['effects']) : [],
  };
};

const migrateTrack = (raw: unknown, index: number): Track => {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    fail(`Invalid project file: track ${index} is not an object.`);
  }
  const track = raw as Record<string, unknown>;
  if (!Array.isArray(track.clips)) fail(`Invalid project file: track ${index} has no clips array.`);
  return {
    ...(track as unknown as Track),
    id: typeof track.id === 'string' ? track.id : `t-${index}`,
    name: typeof track.name === 'string' ? track.name : `Track ${index + 1}`,
    clips: (track.clips as unknown[]).map((clip, clipIndex) => migrateClip(clip, clipIndex)),
  };
};

/**
 * The v1 → v2 conversion.
 *
 * Version 1 kept a chart's bars inside the clip's props. Version 2 moves them
 * into a project-level series that the chart references by id, so the data's
 * origin survives the move and two charts can share one series.
 *
 * The conversion is non-destructive: the legacy `bars` array stays on the
 * migrated clip as an inert compatibility key, so the chart renderer keeps
 * reading it and the document renders identically before and after.
 */
const migrateV1ToV2 = (
  doc: Record<string, unknown>,
  tracks: Track[],
): { doc: Record<string, unknown>; tracks: Track[] } => {
  const series: SeriesSpec[] = [];
  const nextTracks = tracks.map((track) => {
    const clips = track.clips.map((clip) => {
      if (clip.element !== 'candlestickChart') return clip;
      const props = clip.props as Record<string, unknown> | undefined;
      const bars = props?.bars;
      if (!Array.isArray(bars) || bars.length === 0) return clip;

      const seriesId = `series-${clip.id}`;
      const stamped = bars.map((bar, index) => ({
        ...(bar as Record<string, unknown>),
        id: `${seriesId}:${index}`,
      })) as OhlcBar[];

      const isSynthetic = props?.dataSource === 'synthetic';
      series.push(
        isSynthetic
          ? {
              id: seriesId,
              origin: 'synthetic',
              label: typeof props?.symbol === 'string' ? props.symbol : 'Series',
              symbol: typeof props?.symbol === 'string' ? props.symbol : undefined,
              timeBasis: 'logical',
              seed: `${seriesId}-seed`,
              algorithmVersion: 1,
              generator: {
                count: stamped.length,
                startPrice: stamped[0]?.o ?? 1,
                timeframeMs: 60_000,
              },
            }
          : {
              id: seriesId,
              origin: 'manual',
              label: typeof props?.symbol === 'string' ? props.symbol : 'Series',
              symbol: typeof props?.symbol === 'string' ? props.symbol : undefined,
              timeBasis: 'logical',
              bars: stamped,
            },
      );

      // The legacy `bars` key stays: the renderer reads it until the props
      // move to v2 in a later slice.
      return {
        ...clip,
        props: {
          ...props,
          bars: stamped,
          seriesId,
          panes: [
            {
              id: `${clip.id}-pane-0`,
              seriesId,
              aggregation: { factor: 1 },
              rect: { x: 0, y: 0, width: 1, height: 1 },
              in: 0,
              out: clip.durationInFrames,
              opacity: 1,
              clock: { kind: 'reference' as const },
              priceRange: { mode: 'auto' as const },
            },
          ],
        },
      };
    });
    return { ...track, clips };
  });

  return {
    doc: {
      ...doc,
      series,
      // The document keeps its length: 'fixed' means durationInFrames is
      // authoritative, exactly as it was in version 1.
      durationMode: 'fixed',
    },
    tracks: nextTracks,
  };
};

/**
 * Validate and upgrade a project document.
 *
 * @throws when the document is malformed, uses an unsupported schema version,
 * references an unknown component or carries a props version the component
 * does not support.
 */
export const migrateProject = (raw: unknown): Project => {
  if (typeof raw !== 'object' || raw === null || Array.isArray(raw)) {
    fail('Invalid project file: expected a JSON object.');
  }
  const doc = raw as Record<string, unknown>;

  const version = doc.schemaVersion === undefined ? 1 : doc.schemaVersion;
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    fail(`Invalid project schema version: ${String(doc.schemaVersion)}`);
  }
  if (version > CURRENT_PROJECT_SCHEMA_VERSION) {
    fail(`Unsupported project schema version ${version} (current: ${CURRENT_PROJECT_SCHEMA_VERSION})`);
  }

  if (!Array.isArray(doc.tracks)) fail('Invalid project file: "tracks" must be an array.');
  if (typeof doc.fps !== 'number' || doc.fps <= 0) fail('Invalid project file: "fps" must be a positive number.');
  if (typeof doc.width !== 'number' || doc.width <= 0) fail('Invalid project file: "width" must be a positive number.');
  if (typeof doc.height !== 'number' || doc.height <= 0) fail('Invalid project file: "height" must be a positive number.');
  if (typeof doc.durationInFrames !== 'number' || doc.durationInFrames <= 0) {
    fail('Invalid project file: "durationInFrames" must be a positive number.');
  }

  const fps = doc.fps;
  const width = doc.width;
  const height = doc.height;
  const durationInFrames = doc.durationInFrames;
  const name = typeof doc.name === 'string' ? doc.name : 'Untitled';
  const backgroundColor =
    typeof doc.backgroundColor === 'string' ? doc.backgroundColor : '#0d0d14';

  const tracks = (doc.tracks as unknown[]).map((track, index) => migrateTrack(track, index));

  const migrated = version < 2 ? migrateV1ToV2(doc, tracks) : { doc, tracks };

  return {
    ...(migrated.doc as unknown as Project),
    name,
    width,
    height,
    fps,
    durationInFrames,
    backgroundColor,
    tracks: migrated.tracks,
    schemaVersion: CURRENT_PROJECT_SCHEMA_VERSION,
  };
};
