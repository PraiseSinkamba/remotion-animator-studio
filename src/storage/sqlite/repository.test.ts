/**
 * The SQLite adapter against the shared repository contract.
 *
 * The contract suite runs against a real SQLite file, not a stub: the SQL,
 * the migrations and the conflict rules are what this file is testing.
 */
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { describeRepositoryContract } from '../contract-suite';
import { StorageConflictError } from '../types';
import type { Project } from '../../types';
import { createNodeSqliteDriver, type SqlDriver } from './driver';
import { createSqliteRepository } from './repository';
import { runMigrations } from './schema';

const root = mkdtempSync(join(tmpdir(), 'chart-studio-sqlite-'));

afterAll(() => {
  // Windows keeps a lock on a database file that was not closed; retries keep
  // a failed case from failing the whole suite on teardown.
  rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
});

/** The file a namespace lives in, so a later instance finds the same data. */
const fileFor = (namespace: string): string =>
  join(root, `${namespace.replace(/[^A-Za-z0-9._-]/g, '_')}.sqlite3`);

const openDriver = (namespace: string): SqlDriver =>
  createNodeSqliteDriver(fileFor(namespace));

const create = async (namespace: string) =>
  createSqliteRepository(openDriver(namespace), namespace);

const sampleProject = (name: string): Project => ({
  name,
  width: 1920,
  height: 1080,
  fps: 30,
  durationInFrames: 300,
  backgroundColor: '#0d0d14',
  tracks: [],
});

describeRepositoryContract('sqlite', create);

describe('sqlite — migrations', () => {
  it('applies the schema once and then leaves it alone', () => {
    const driver = openDriver('migrations');
    expect(runMigrations(driver)).toBe(1);
    expect(runMigrations(driver)).toBe(0);
    driver.close();
  });

  it('refuses a database from a newer build', () => {
    const driver = openDriver('future-version');
    driver.exec(
      'CREATE TABLE schema_migrations (version INTEGER PRIMARY KEY, applied_at INTEGER NOT NULL)',
    );
    driver.run('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)', [
      999,
      Date.now(),
    ]);

    expect(() => runMigrations(driver)).toThrow(/newer than this build supports/);
    driver.close();
  });
});

describe('sqlite — conflicts', () => {
  it('leaves the stored document untouched when a commit is stale', async () => {
    const repo = await create('stale-commit');
    const created = await repo.commit({
      name: 'First',
      document: sampleProject('First'),
    });
    await repo.commit({
      id: created.id,
      name: 'Second',
      document: sampleProject('Second'),
      expectedRevision: 1,
    });

    await expect(
      repo.commit({
        id: created.id,
        name: 'Stale',
        document: sampleProject('Stale'),
        expectedRevision: 1,
      }),
    ).rejects.toBeInstanceOf(StorageConflictError);

    const stored = await repo.get(created.id);
    expect(stored?.name).toBe('Second');
    expect(stored?.revision).toBe(2);
    expect(stored?.document.name).toBe('Second');

    // The rejected commit wrote nothing: the two accepted revisions are still
    // the only ones on record.
    const driver = openDriver('stale-commit');
    const rows = driver.all<{ count: number }>(
      'SELECT COUNT(*) AS count FROM project_revisions WHERE project_id = ?',
      [created.id],
    );
    expect(rows[0]?.count).toBe(2);
    driver.close();
    await repo.close();
  });
});
