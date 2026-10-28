// @vitest-environment jsdom
/**
 * The contract suite runs against both fallbacks: the localStorage backend
 * and the in-memory backend.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { describeRepositoryContract } from '../contract-suite';
import { StorageQuotaError, StorageUnavailableError } from '../types';
import { createLocalStorageRepository } from './local-storage-repository';
import { createMemoryRepository } from './memory-repository';

const emptyDocument = (name: string) => ({
  name,
  width: 1920,
  height: 1080,
  fps: 30,
  durationInFrames: 300,
  backgroundColor: '#0d0d14',
  tracks: [],
});

beforeEach(() => {
  window.localStorage.clear();
});

describeRepositoryContract('local-storage', createLocalStorageRepository);
describeRepositoryContract('memory', createMemoryRepository);

describe('local-storage backend', () => {
  const namespace = 'local-storage-details';

  it('keeps every project of a namespace under one key', async () => {
    const repo = await createLocalStorageRepository(namespace);
    await repo.commit({ name: 'One', document: emptyDocument('One') });

    expect(window.localStorage.length).toBe(1);
    expect(window.localStorage.key(0)).toBe(`chart-studio:${namespace}`);
    await repo.close();
  });

  it('reports a quota failure as a quota error', async () => {
    const repo = await createLocalStorageRepository(namespace);
    // jsdom's Storage is a proxy, so the whole object is replaced instead.
    const quota = Object.assign(new Error('quota'), { name: 'QuotaExceededError' });
    const real = window.localStorage;
    Object.defineProperty(globalThis, 'localStorage', {
      value: {
        getItem: (key: string) => real.getItem(key),
        setItem: () => {
          throw quota;
        },
        removeItem: (key: string) => real.removeItem(key),
      },
      configurable: true,
      writable: true,
    });

    await expect(
      repo.commit({ name: 'Too big', document: emptyDocument('Too big') }),
    ).rejects.toBeInstanceOf(StorageQuotaError);

    Object.defineProperty(globalThis, 'localStorage', {
      value: real,
      configurable: true,
      writable: true,
    });
    await repo.close();
  });

  it('refuses to open when the stored data is corrupt', async () => {
    window.localStorage.setItem(`chart-studio:${namespace}`, 'not json');
    const repo = await createLocalStorageRepository(namespace);

    await expect(repo.init()).rejects.toBeInstanceOf(StorageUnavailableError);
    await repo.close();
  });
});
