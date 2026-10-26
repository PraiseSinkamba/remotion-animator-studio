import { afterEach, describe, expect, it } from 'vitest';
import { chooseBackend, selectRepository } from './select';
import { StorageUnavailableError, type RepositoryFactory, type StorageProblem } from './types';

/** Node has no OPFS, so the durable backend cannot run here. */
const withoutOpfs = () => {
  Object.defineProperty(globalThis, 'navigator', {
    value: { storage: undefined },
    configurable: true,
    writable: true,
  });
};

/** Pretends the browser can host the durable backend. */
const withOpfs = () => {
  Object.defineProperty(globalThis, 'navigator', {
    value: { storage: { getDirectory: () => undefined } },
    configurable: true,
    writable: true,
  });
};

const originalNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');

afterEach(() => {
  if (originalNavigator) {
    Object.defineProperty(globalThis, 'navigator', originalNavigator);
  }
});

describe('chooseBackend', () => {
  it('prefers SQLite when it is available', () => {
    expect(chooseBackend({ sqlite: true, localStorage: true })).toBe('sqlite-opfs');
  });

  it('falls back to localStorage without SQLite', () => {
    expect(chooseBackend({ sqlite: false, localStorage: true })).toBe('local-storage');
  });

  it('falls back to memory without any durable backend', () => {
    expect(chooseBackend({ sqlite: false, localStorage: false })).toBe('memory');
  });

  it('prefers SQLite over localStorage', () => {
    expect(chooseBackend({ sqlite: true, localStorage: false })).toBe('sqlite-opfs');
  });
});

describe('selectRepository', () => {
  it('returns the memory backend when it is preferred', async () => {
    const repo = await selectRepository({ prefer: 'memory' });

    expect(repo.backend).toBe('memory');
    expect(repo.status().backend).toBe('memory');
    expect(repo.status().problem).toBeUndefined();
    await repo.close();
  });

  it('uses SQLite when it is preferred and available', async () => {
    withOpfs();
    const sqlite: RepositoryFactory = async () => ({
      backend: 'sqlite-opfs',
      init: async () => ({
        backend: 'sqlite-opfs',
        durable: true,
        writeAccess: 'owner',
      }),
      status: () => ({ backend: 'sqlite-opfs', durable: true, writeAccess: 'owner' }),
      list: async () => [],
      get: async () => null,
      commit: async () => {
        throw new Error('not used');
      },
      remove: async () => undefined,
      close: async () => undefined,
    });

    const repo = await selectRepository({ prefer: 'sqlite-opfs', backends: { 'sqlite-opfs': sqlite } });

    expect(repo.backend).toBe('sqlite-opfs');
    await repo.close();
  });

  it('falls back and reports a degraded status when SQLite fails', async () => {
    withOpfs();
    const failing: RepositoryFactory = async () => {
      throw new Error('the worker refused to start');
    };

    const repo = await selectRepository({ backends: { 'sqlite-opfs': failing } });

    expect(repo.backend).not.toBe('sqlite-opfs');
    expect(repo.status().problem).toBe('backend-unavailable');
    expect(repo.status().detail).toContain('the worker refused to start');
    await repo.close();
  });

  it('reports a missing OPFS separately from other failures', async () => {
    withoutOpfs();
    const failing: RepositoryFactory = async () => {
      throw new Error('no origin private file system');
    };

    const repo = await selectRepository({ backends: { 'sqlite-opfs': failing } });

    expect(repo.status().problem).toBe('opfs-unavailable');
    expect(repo.status().detail).toContain('no origin private file system');
    await repo.close();
  });

  it('keeps working on the fallback backend', async () => {
    withOpfs();
    const failing: RepositoryFactory = async () => {
      throw new Error('boom');
    };

    const repo = await selectRepository({ backends: { 'sqlite-opfs': failing } });
    const stored = await repo.commit({
      name: 'Fallback',
      document: {
        name: 'Fallback',
        width: 1920,
        height: 1080,
        fps: 30,
        durationInFrames: 300,
        backgroundColor: '#000000',
        tracks: [],
      },
    });

    expect(stored.revision).toBe(1);
    expect((await repo.list()).map((s) => s.name)).toContain('Fallback');
    await repo.close();
  });

  it('falls back when SQLite reports an unusable status instead of throwing', async () => {
    withOpfs();
    // The SQLite client reports an unusable database as a status.
    const blocked: RepositoryFactory = async () => ({
      backend: 'sqlite-opfs',
      init: async () => ({
        backend: 'sqlite-opfs',
        durable: false,
        writeAccess: 'read-only',
        problem: 'opfs-unavailable',
        detail: 'the database file could not be opened',
      }),
      status: () => ({
        backend: 'sqlite-opfs',
        durable: false,
        writeAccess: 'read-only',
        problem: 'opfs-unavailable',
        detail: 'the database file could not be opened',
      }),
      list: async () => [],
      get: async () => null,
      commit: async () => {
        throw new Error('not used');
      },
      remove: async () => undefined,
      close: async () => undefined,
    });

    const repo = await selectRepository({ backends: { 'sqlite-opfs': blocked } });

    expect(repo.backend).not.toBe('sqlite-opfs');
    expect(repo.status().problem).toBe('backend-unavailable');
    expect(repo.status().detail).toContain('the database file could not be opened');
    await repo.close();
  });

  it('keeps a read-only SQLite workspace instead of falling back', async () => {
    withOpfs();
    const locked: RepositoryFactory = async () => ({
      backend: 'sqlite-opfs',
      init: async () => ({
        backend: 'sqlite-opfs',
        durable: true,
        writeAccess: 'read-only',
        problem: 'locked-by-other-tab',
      }),
      status: () => ({
        backend: 'sqlite-opfs',
        durable: true,
        writeAccess: 'read-only',
        problem: 'locked-by-other-tab',
      }),
      list: async () => [],
      get: async () => null,
      commit: async () => {
        throw new Error('not used');
      },
      remove: async () => undefined,
      close: async () => undefined,
    });

    const repo = await selectRepository({ backends: { 'sqlite-opfs': locked } });

    expect(repo.backend).toBe('sqlite-opfs');
    expect(repo.status().problem).toBe('locked-by-other-tab');
    await repo.close();
  });

  it('reports the degraded problem to the status listener', async () => {
    withOpfs();
    const failing: RepositoryFactory = async () => {
      throw new Error('boom');
    };
    const seen: StorageProblem[] = [];

    const repo = await selectRepository({
      backends: { 'sqlite-opfs': failing },
      onStatusChange: (status) => {
        if (status.problem) seen.push(status.problem);
      },
    });

    expect(seen).toContain('backend-unavailable');
    expect(repo.status().problem).toBe('backend-unavailable');
    await repo.close();
  });

  it('fails loudly when a preferred backend cannot be opened', async () => {
    const failing: RepositoryFactory = async () => {
      throw new Error('nope');
    };

    await expect(
      selectRepository({ prefer: 'sqlite-opfs', backends: { 'sqlite-opfs': failing } }),
    ).rejects.toBeInstanceOf(StorageUnavailableError);
  });
});
