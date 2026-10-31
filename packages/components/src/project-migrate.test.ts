import { describe, expect, it } from 'vitest';
import type { ElementType, Project } from '@chart-studio/core';
import { CURRENT_PROJECT_SCHEMA_VERSION, migrateProject } from './project-migrate';

interface TestClip {
  id: string;
  name: string;
  element: ElementType;
  from: number;
  durationInFrames: number;
  props: Record<string, unknown>;
  effects: unknown[];
  groupId?: string;
  propsVersion?: number;
}

interface TestDoc {
  name: string;
  width: number;
  height: number;
  fps: number;
  durationInFrames: number;
  backgroundColor: string;
  schemaVersion?: number;
  tracks: Array<{ id: string; name: string; clips: TestClip[] }>;
}

const legacyProject = (): TestDoc => ({
  name: 'Legacy',
  width: 1920,
  height: 1080,
  fps: 30,
  durationInFrames: 300,
  backgroundColor: '#0d0d14',
  tracks: [
    {
      id: 't1',
      name: 'Track 1',
      clips: [
        {
          id: 'c1',
          name: 'Title',
          element: 'text',
          from: 0,
          durationInFrames: 90,
          props: { text: 'Hi' },
          effects: [],
        },
      ],
    },
  ],
});

describe('migrateProject', () => {
  it('treats a missing schemaVersion as the legacy version', () => {
    const migrated = migrateProject(legacyProject());
    expect(CURRENT_PROJECT_SCHEMA_VERSION).toBe(2);
    expect(migrated.schemaVersion).toBe(2);
    expect(migrated.tracks[0].clips[0].element).toBe('text');
    expect(migrated.tracks[0].clips[0].props).toEqual({ text: 'Hi' });
  });

  it('rejects a newer schema version by name', () => {
    expect(() => migrateProject({ ...legacyProject(), schemaVersion: 3 })).toThrow(/3/);
  });

  it('rejects a malformed document', () => {
    expect(() => migrateProject(null)).toThrow();
    expect(() => migrateProject({ ...legacyProject(), tracks: 'nope' })).toThrow();
    expect(() => migrateProject({ ...legacyProject(), fps: 0 })).toThrow();
  });

  it('reports the path of the offending field for a malformed document', () => {
    expect(() => migrateProject({ ...legacyProject(), fps: 0 })).toThrow(/fps/);
    expect(() => migrateProject({ ...legacyProject(), width: -1 })).toThrow(/width/);
    expect(() => migrateProject({ ...legacyProject(), height: 0 })).toThrow(/height/);
    expect(() => migrateProject({ ...legacyProject(), durationInFrames: 0 })).toThrow(
      /durationInFrames/,
    );
  });

  it('rejects an unknown component type', () => {
    const doc = legacyProject();
    doc.tracks[0].clips[0].element = 'not-a-real-element' as ElementType;
    expect(() => migrateProject(doc)).toThrow('Unsupported component type "not-a-real-element"');
  });

  it('rejects a clip whose props version is newer than the component supports', () => {
    const doc = legacyProject();
    doc.tracks[0].clips[0].propsVersion = 2;
    expect(() => migrateProject(doc)).toThrow(/props version 2/);
  });

  it('keeps groupId and propsVersion', () => {
    const doc = legacyProject();
    doc.tracks[0].clips[0].groupId = 'g1';
    doc.tracks[0].clips[0].propsVersion = 1;
    const migrated = migrateProject(doc);
    expect(migrated.tracks[0].clips[0].groupId).toBe('g1');
    expect(migrated.tracks[0].clips[0].propsVersion).toBe(1);
  });

  it('is idempotent', () => {
    const once = migrateProject(legacyProject());
    const twice = migrateProject(once);
    expect(twice).toEqual(once);
  });

  it('accepts a current project unchanged', () => {
    const project: Project = {
      name: 'Current',
      width: 1920,
      height: 1080,
      fps: 30,
      durationInFrames: 300,
      backgroundColor: '#0d0d14',
      schemaVersion: CURRENT_PROJECT_SCHEMA_VERSION,
      tracks: [
        {
          id: 't1',
          name: 'Track 1',
          clips: [
            {
              id: 'c1',
              name: 'Title',
              element: 'text',
              from: 0,
              durationInFrames: 90,
              props: { text: 'Hi' },
              effects: [],
            },
          ],
        },
      ],
    };
    expect(migrateProject(project)).toEqual(project);
  });
});

describe('migrateProject — the v1 to v2 conversion', () => {
  const chartProject = (bars: unknown[], dataSource?: string): TestDoc => ({
    name: 'Chart project',
    width: 1920,
    height: 1080,
    fps: 30,
    durationInFrames: 600,
    backgroundColor: '#000000',
    tracks: [
      {
        id: 't1',
        name: 'Track 1',
        clips: [
          {
            id: 'c1',
            name: 'Candlestick Chart',
            element: 'candlestickChart',
            from: 0,
            durationInFrames: 180,
            props: { bars, dataSource },
            effects: [],
          },
        ],
      },
    ],
  });

  const BARS = [
    { t: 0, o: 100, h: 110, l: 95, c: 105 },
    { t: 60_000, o: 105, h: 112, l: 101, c: 108 },
  ];

  it('lifts a v1 chart bar array into a project series', () => {
    const migrated = migrateProject(chartProject(BARS));
    expect(migrated.series).toHaveLength(1);
    expect(migrated.series?.[0].id).toBe('series-c1');
    expect(migrated.tracks[0].clips[0].props.seriesId).toBe('series-c1');
  });

  it('gives every migrated bar a deterministic id', () => {
    const migrated = migrateProject(chartProject(BARS));
    const bars = migrated.tracks[0].clips[0].props.bars as { id: string }[];
    expect(bars.map((bar) => bar.id)).toEqual(['series-c1:0', 'series-c1:1']);
  });

  it('records a synthetic chart as a synthetic series', () => {
    const migrated = migrateProject(chartProject(BARS, 'synthetic'));
    expect(migrated.series?.[0].origin).toBe('synthetic');
  });

  it('records a manual chart as a manual series', () => {
    const migrated = migrateProject(chartProject(BARS, 'manual'));
    expect(migrated.series?.[0].origin).toBe('manual');
  });

  it('keeps the duration of a migrated document', () => {
    const migrated = migrateProject(chartProject(BARS));
    expect(migrated.durationInFrames).toBe(600);
    expect(migrated.durationMode).toBe('fixed');
  });

  it('migrates a v1 chart document to a single pane covering the whole chart', () => {
    const migrated = migrateProject(chartProject(BARS));
    const panes = migrated.tracks[0].clips[0].props.panes as {
      rect: { x: number; y: number; width: number; height: number };
      aggregation: { factor: number };
      clock: { kind: string };
    }[];
    expect(panes).toHaveLength(1);
    expect(panes[0].rect).toEqual({ x: 0, y: 0, width: 1, height: 1 });
    expect(panes[0].aggregation).toEqual({ factor: 1 });
    expect(panes[0].clock).toEqual({ kind: 'reference' });
  });

  it('is idempotent for a v2 document', () => {
    const once = migrateProject(chartProject(BARS));
    const twice = migrateProject(once);
    expect(twice).toEqual(once);
  });
});
