/**
 * The machine-checked form of the storage contract.
 *
 * Every implementation of `WorkspaceRepository` runs this suite against
 * itself. A backend that passes it can be swapped in without any caller
 * noticing — which is the entire point of the port.
 *
 * The suite only uses the public interface, so it also serves as the
 * definition of what a backend must do.
 */
import { describe, expect, it } from 'vitest';
import type { Project } from '../types';
import { StorageConflictError, type RepositoryFactory } from './types';

const sampleProject = (name: string): Project => ({
  name,
  width: 1920,
  height: 1080,
  fps: 30,
  durationInFrames: 300,
  backgroundColor: '#0d0d14',
  tracks: [
    {
      id: 'track-1',
      name: 'Track 1',
      clips: [
        {
          id: 'clip-1',
          name: 'Chart',
          element: 'candlestickChart',
          from: 0,
          durationInFrames: 120,
          props: { symbol: 'SYNTH', bars: [{ o: 100, h: 110, l: 95, c: 105 }] },
          effects: [],
        },
      ],
    },
  ],
});

let namespaceCounter = 0;
const uniqueNamespace = (label: string) => `${label}-${Date.now().toString(36)}-${namespaceCounter++}`;

/**
 * Runs the contract against one backend.
 *
 * @param label  Name of the implementation, used in the test titles.
 * @param create Factory that opens a repository over a namespace.
 */
export const describeRepositoryContract = (label: string, create: RepositoryFactory) => {
  describe(`${label} — repository contract`, () => {
    it('reports a status once it is open', async () => {
      const repo = await create(uniqueNamespace('status'));
      const status = await repo.init();
      expect(status.backend).toBeTruthy();
      expect(['owner', 'read-only']).toContain(status.writeAccess);
      expect(repo.status().backend).toBe(status.backend);
      await repo.close();
    });

    it('stores a project and reads it back unchanged', async () => {
      const repo = await create(uniqueNamespace('roundtrip'));
      const document = sampleProject('Round trip');
      const stored = await repo.commit({ name: 'Round trip', document });

      expect(stored.revision).toBe(1);
      expect(stored.name).toBe('Round trip');

      const loaded = await repo.get(stored.id);
      expect(loaded).not.toBeNull();
      expect(loaded?.document).toEqual(document);
      expect(loaded?.revision).toBe(1);
      await repo.close();
    });

    it('lists the projects it stored', async () => {
      const repo = await create(uniqueNamespace('list'));
      const first = await repo.commit({ name: 'First', document: sampleProject('First') });
      const second = await repo.commit({ name: 'Second', document: sampleProject('Second') });

      const summaries = await repo.list();
      const ids = summaries.map((s) => s.id);
      expect(ids).toContain(first.id);
      expect(ids).toContain(second.id);
      expect(summaries.find((s) => s.id === first.id)?.name).toBe('First');
      await repo.close();
    });

    it('bumps the revision on every commit', async () => {
      const repo = await create(uniqueNamespace('revision'));
      const created = await repo.commit({ name: 'Rev', document: sampleProject('Rev') });
      expect(created.revision).toBe(1);

      const updated = await repo.commit({
        id: created.id,
        name: 'Rev 2',
        document: sampleProject('Rev 2'),
        expectedRevision: 1,
      });
      expect(updated.revision).toBe(2);
      expect(updated.name).toBe('Rev 2');
      expect((await repo.get(created.id))?.document.name).toBe('Rev 2');
      await repo.close();
    });

    it('refuses a commit whose expected revision is stale', async () => {
      const repo = await create(uniqueNamespace('conflict'));
      const created = await repo.commit({ name: 'Conflict', document: sampleProject('Conflict') });
      await repo.commit({
        id: created.id,
        name: 'Someone else',
        document: sampleProject('Someone else'),
        expectedRevision: 1,
      });

      await expect(
        repo.commit({
          id: created.id,
          name: 'Stale write',
          document: sampleProject('Stale write'),
          expectedRevision: 1,
        }),
      ).rejects.toBeInstanceOf(StorageConflictError);

      const stored = await repo.get(created.id);
      expect(stored?.name).toBe('Someone else');
      expect(stored?.revision).toBe(2);
      await repo.close();
    });

    it('creates a separate project when no id is given', async () => {
      const repo = await create(uniqueNamespace('create'));
      const a = await repo.commit({ name: 'A', document: sampleProject('A') });
      const b = await repo.commit({ name: 'B', document: sampleProject('B') });
      expect(a.id).not.toBe(b.id);
      await repo.close();
    });

    it('removes a project and tolerates removing it twice', async () => {
      const repo = await create(uniqueNamespace('remove'));
      const created = await repo.commit({ name: 'Gone', document: sampleProject('Gone') });
      await repo.remove(created.id);
      expect(await repo.get(created.id)).toBeNull();
      await expect(repo.remove(created.id)).resolves.toBeUndefined();
      await repo.close();
    });

    it('returns null for an unknown project', async () => {
      const repo = await create(uniqueNamespace('missing'));
      expect(await repo.get('does-not-exist')).toBeNull();
      await repo.close();
    });

    it('keeps committed projects visible to a later instance', async () => {
      const namespace = uniqueNamespace('durable');
      const first = await create(namespace);
      const created = await first.commit({ name: 'Durable', document: sampleProject('Durable') });
      await first.close();

      const second = await create(namespace);
      const loaded = await second.get(created.id);
      expect(loaded?.document.name).toBe('Durable');
      expect(loaded?.revision).toBe(1);
      await second.close();
    });
  });
};
