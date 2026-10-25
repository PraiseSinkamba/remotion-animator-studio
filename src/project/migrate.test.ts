import { describe, expect, it } from 'vitest';
import type { ElementType, Project } from '../types';
import { CURRENT_PROJECT_SCHEMA_VERSION, migrateProject } from './migrate';

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
  it('treats a missing schemaVersion as version 1', () => {
    const migrated = migrateProject(legacyProject());
    expect(CURRENT_PROJECT_SCHEMA_VERSION).toBe(1);
    expect(migrated.schemaVersion).toBe(1);
    expect(migrated.tracks[0].clips[0].element).toBe('text');
    expect(migrated.tracks[0].clips[0].props).toEqual({ text: 'Hi' });
  });

  it('rejects a newer schema version by name', () => {
    expect(() => migrateProject({ ...legacyProject(), schemaVersion: 2 })).toThrow(/2/);
  });

  it('rejects a malformed document', () => {
    expect(() => migrateProject(null)).toThrow();
    expect(() => migrateProject({ ...legacyProject(), tracks: 'nope' })).toThrow();
    expect(() => migrateProject({ ...legacyProject(), fps: 0 })).toThrow();
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
      schemaVersion: 1,
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
