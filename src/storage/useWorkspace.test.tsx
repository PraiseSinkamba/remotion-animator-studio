// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { sampleProject } from '../sampleProject';
import { useStore } from '../store';
import type { Project } from '../types';
import { useWorkspace } from './useWorkspace';
import {
  StorageConflictError,
  type CommitInput,
  type ProjectSummary,
  type RepositoryFactory,
  type StorageStatus,
  type StoredProject,
  type WorkspaceRepository,
} from './types';

/** A document that is obviously not the editor's default. */
const makeDocument = (name: string): Project => ({
  name,
  width: 1920,
  height: 1080,
  fps: 30,
  durationInFrames: 300,
  backgroundColor: '#101018',
  tracks: [],
});

const seedProject = (id: string, name: string, updatedAt: number): StoredProject => ({
  id,
  name,
  revision: 1,
  createdAt: updatedAt - 1000,
  updatedAt,
  width: 1920,
  height: 1080,
  fps: 30,
  durationInFrames: 300,
  document: makeDocument(name),
});

interface FakeRepository {
  repo: WorkspaceRepository;
  /** Every commit the hook attempted, in order. */
  commits: CommitInput[];
  /** The stored project with this id, if there is one. */
  stored: (id: string) => StoredProject | undefined;
  /** Makes every following commit fail with a conflict. */
  failWithConflict: (value: boolean) => void;
}

/**
 * A repository that keeps everything in memory.
 *
 * It is the test double for the storage port, not the subject of the test:
 * the assertions are about what the hook does with it.
 */
const createFakeRepository = (seed: StoredProject[] = []): FakeRepository => {
  const projects = new Map<string, StoredProject>();
  for (const project of seed) projects.set(project.id, project);

  const commits: CommitInput[] = [];
  const status: StorageStatus = { backend: 'memory', durable: false, writeAccess: 'owner' };
  let conflict = false;
  let created = 0;

  const repo: WorkspaceRepository = {
    backend: 'memory',
    init: async () => status,
    status: () => status,
    list: async (): Promise<ProjectSummary[]> =>
      [...projects.values()].sort((a, b) => b.updatedAt - a.updatedAt),
    get: async (id) => projects.get(id) ?? null,
    commit: async (input) => {
      commits.push(input);
      if (conflict) throw new StorageConflictError('the project moved on');
      const id = input.id ?? `p${++created}`;
      const existing = projects.get(id);
      const now = Date.now();
      const record: StoredProject = {
        id,
        name: input.name,
        revision: (existing?.revision ?? 0) + 1,
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
        width: input.document.width,
        height: input.document.height,
        fps: input.document.fps,
        durationInFrames: input.document.durationInFrames,
        document: input.document,
      };
      projects.set(id, record);
      return record;
    },
    remove: async (id) => {
      projects.delete(id);
    },
    close: async () => {},
  };

  return {
    repo,
    commits,
    stored: (id) => projects.get(id),
    failWithConflict: (value) => {
      conflict = value;
    },
  };
};

/** Lets every pending promise settle inside one act scope. */
const settle = async (): Promise<void> => {
  await act(async () => {
    for (let i = 0; i < 20; i += 1) await Promise.resolve();
  });
};

const mountWorkspace = async (fake: FakeRepository) => {
  const create: RepositoryFactory = async () => fake.repo;
  const view = renderHook(() => useWorkspace({ create }));
  await settle();
  return view;
};

/** An edit, the way the editor makes one. */
const editProject = async (name: string): Promise<void> => {
  await act(async () => {
    useStore.getState().setProject({ name });
  });
};

/** Moves the clock past the autosave delay. */
const advance = async (ms: number): Promise<void> => {
  await act(async () => {
    await vi.advanceTimersByTimeAsync(ms);
    for (let i = 0; i < 10; i += 1) await Promise.resolve();
  });
};

beforeEach(() => {
  useStore.setState({
    project: sampleProject,
    selectedClipIds: [],
    history: [],
    future: [],
    workspaceId: null,
    workspaceRevision: null,
  });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('useWorkspace — autosave', () => {
  it('commits the changed document to the repository', async () => {
    const fake = createFakeRepository();
    const { result, unmount } = await mountWorkspace(fake);

    vi.useFakeTimers();
    await editProject('Edited');
    expect(result.current.state.saving).toBe(true);

    await advance(800);

    expect(fake.commits).toHaveLength(1);
    expect(fake.commits[0].document.name).toBe('Edited');
    expect(fake.commits[0].name).toBe('Edited');
    expect(result.current.state.saving).toBe(false);

    // The editor now knows which stored project it is working on.
    const id = useStore.getState().workspaceId;
    expect(id).not.toBeNull();
    expect(useStore.getState().workspaceRevision).toBe(1);
    expect(fake.stored(id ?? '')?.document.name).toBe('Edited');

    unmount();
  });

  it('commits with the revision the app last committed', async () => {
    const fake = createFakeRepository();
    const { unmount } = await mountWorkspace(fake);

    vi.useFakeTimers();
    await editProject('First');
    await advance(800);
    const id = useStore.getState().workspaceId;

    await editProject('Second');
    await advance(800);

    expect(fake.commits).toHaveLength(2);
    expect(fake.commits[1].id).toBe(id);
    expect(fake.commits[1].expectedRevision).toBe(1);
    expect(fake.commits[1].document.name).toBe('Second');
    expect(useStore.getState().workspaceRevision).toBe(2);

    unmount();
  });

  it('surfaces a conflict and leaves the stored document alone', async () => {
    const fake = createFakeRepository([seedProject('p-seed', 'Seed doc', 1000)]);
    const { result, unmount } = await mountWorkspace(fake);

    vi.useFakeTimers();
    fake.failWithConflict(true);
    await editProject('Conflicting edit');
    await advance(800);

    expect(fake.commits).toHaveLength(1);
    expect(result.current.state.error).toMatch(/another tab/i);
    // The stored document is what it was before the failed commit.
    expect(fake.stored('p-seed')?.document.name).toBe('Seed doc');
    // The edit is still unsaved, so the editor keeps saying so.
    expect(result.current.state.saving).toBe(true);

    unmount();
  });

  it('saveNow commits without waiting for the debounce', async () => {
    const fake = createFakeRepository();
    const { result, unmount } = await mountWorkspace(fake);

    vi.useFakeTimers();
    await editProject('Saved now');
    expect(fake.commits).toHaveLength(0);
    // The debounce is pending, so the commit below cannot have waited for it.
    expect(vi.getTimerCount()).toBe(1);

    await act(async () => {
      await result.current.saveNow();
    });

    expect(fake.commits).toHaveLength(1);
    expect(fake.commits[0].document.name).toBe('Saved now');
    // The pending autosave was cancelled, so nothing is committed twice.
    expect(vi.getTimerCount()).toBe(0);

    await advance(2000);
    expect(fake.commits).toHaveLength(1);

    unmount();
  });
});

describe('useWorkspace — restore on boot', () => {
  it('hydrates the most recently updated project into the editor', async () => {
    const older = seedProject('p-old', 'Older doc', 1000);
    const newer = seedProject('p-new', 'Newest doc', 2000);
    const fake = createFakeRepository([older, newer]);
    const { result, unmount } = await mountWorkspace(fake);

    expect(useStore.getState().project.name).toBe('Newest doc');
    expect(useStore.getState().workspaceId).toBe('p-new');
    expect(useStore.getState().workspaceRevision).toBe(1);
    expect(result.current.projects.map((p) => p.id)).toEqual(['p-new', 'p-old']);

    unmount();
  });

  it('leaves the editor alone when the repository is empty', async () => {
    const before = useStore.getState().project;
    const fake = createFakeRepository();
    const { unmount } = await mountWorkspace(fake);

    expect(useStore.getState().project).toBe(before);
    expect(useStore.getState().workspaceId).toBeNull();

    unmount();
  });
});
