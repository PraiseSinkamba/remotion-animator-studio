/**
 * The schema and the migrations that produce it.
 *
 * Migrations are forward-only and versioned. A database that carries a
 * migration version this build does not know is refused: guessing at a
 * newer schema would corrupt it.
 */
import type { SqlDriver } from './driver';

export interface Migration {
  version: number;
  sql: string;
}

/** Migration 1 — the initial schema. */
export const MIGRATIONS: readonly Migration[] = [
  {
    version: 1,
    sql: `CREATE TABLE IF NOT EXISTS schema_migrations (
  version    INTEGER PRIMARY KEY,
  applied_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS projects (
  id                 TEXT PRIMARY KEY,
  name               TEXT    NOT NULL,
  created_at         INTEGER NOT NULL,
  updated_at         INTEGER NOT NULL,
  head_revision      INTEGER NOT NULL,
  width              INTEGER NOT NULL,
  height             INTEGER NOT NULL,
  fps                INTEGER NOT NULL,
  duration_in_frames INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS project_revisions (
  project_id TEXT    NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  revision   INTEGER NOT NULL,
  document   TEXT    NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (project_id, revision)
);`,
  },
];

/** The highest migration version this build knows. */
export const LATEST_VERSION = MIGRATIONS.reduce(
  (highest, migration) => Math.max(highest, migration.version),
  0,
);

/**
 * Applies every migration this build knows that the database does not have.
 *
 * @returns How many migrations were applied. Zero means the database was
 *          already up to date.
 * @throws When the database carries a version this build does not know.
 */
export const runMigrations = (driver: SqlDriver): number => {
  driver.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
  version    INTEGER PRIMARY KEY,
  applied_at INTEGER NOT NULL
)`);

  const rows = driver.all<{ version: number }>(
    'SELECT version FROM schema_migrations',
  );
  const applied = new Set(rows.map((row) => Number(row.version)));
  const known = new Set(MIGRATIONS.map((migration) => migration.version));

  for (const version of applied) {
    if (!known.has(version)) {
      throw new Error(
        `Database schema version ${version} is newer than this build supports (${LATEST_VERSION}). Refusing to open it.`,
      );
    }
  }

  let count = 0;
  for (const migration of MIGRATIONS) {
    if (applied.has(migration.version)) continue;
    driver.transaction(() => {
      driver.exec(migration.sql);
      driver.run(
        'INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)',
        [migration.version, Date.now()],
      );
    });
    count += 1;
  }
  return count;
};
