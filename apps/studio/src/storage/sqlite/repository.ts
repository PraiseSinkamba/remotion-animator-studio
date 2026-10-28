/**
 * The SQLite implementation of the storage port.
 *
 * All SQL for this adapter lives here. The function is pure in the sense that
 * matters: it takes a driver and a namespace and returns a repository. It
 * knows nothing about workers, OPFS, the DOM or the editor.
 */
import {
  StorageConflictError,
  StorageError,
  type CommitInput,
  type ProjectSummary,
  type StorageStatus,
  type StoredProject,
  type WorkspaceRepository,
} from '../types';
import type { SqlDriver } from './driver';
import { isProjectDocument } from './rpc';
import { runMigrations } from './schema';

/** A row of the `projects` table. */
interface ProjectRow {
  id: string;
  name: string;
  created_at: number;
  updated_at: number;
  head_revision: number;
  width: number;
  height: number;
  fps: number;
  duration_in_frames: number;
}

/** A project row joined with the document of its head revision. */
interface ProjectWithDocumentRow extends ProjectRow {
  document: string;
}

const toSummary = (row: ProjectRow): ProjectSummary => ({
  id: row.id,
  name: row.name,
  revision: row.head_revision,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
  width: row.width,
  height: row.height,
  fps: row.fps,
  durationInFrames: row.duration_in_frames,
});

const randomId = (): string => crypto.randomUUID();

/**
 * Creates a repository over an open database.
 *
 * @param driver    The connection the SQL runs on.
 * @param namespace The storage namespace this repository serves.
 */
export const createSqliteRepository = async (
  driver: SqlDriver,
  namespace: string,
): Promise<WorkspaceRepository> => {
  // The schema has to be in place before the first query, and the port's
  // methods may be called without `init()`, so the migrations run here.
  runMigrations(driver);

  let closed = false;

  const assertOpen = (): void => {
    if (closed) throw new StorageError('This repository has been closed');
  };

  const readProject = (id: string): ProjectWithDocumentRow | undefined =>
    driver.all<ProjectWithDocumentRow>(
      `SELECT p.id, p.name, p.created_at, p.updated_at, p.head_revision,
              p.width, p.height, p.fps, p.duration_in_frames, r.document
         FROM projects p
         JOIN project_revisions r
           ON r.project_id = p.id AND r.revision = p.head_revision
        WHERE p.id = ?`,
      [id],
    )[0];

  const repository: WorkspaceRepository = {
    backend: 'sqlite-opfs',

    async init(): Promise<StorageStatus> {
      assertOpen();
      return repository.status();
    },

    status(): StorageStatus {
      return {
        backend: 'sqlite-opfs',
        durable: true,
        writeAccess: 'owner',
      };
    },

    async list(): Promise<ProjectSummary[]> {
      assertOpen();
      return driver
        .all<ProjectRow>(
          `SELECT id, name, created_at, updated_at, head_revision,
                  width, height, fps, duration_in_frames
             FROM projects
            ORDER BY updated_at DESC, created_at DESC, rowid DESC`,
        )
        .map(toSummary);
    },

    async get(id: string): Promise<StoredProject | null> {
      assertOpen();
      const row = readProject(id);
      if (!row) return null;
      const document: unknown = JSON.parse(row.document);
      if (!isProjectDocument(document)) {
        throw new StorageError(`Stored project ${id} has an unreadable document`);
      }
      return { ...toSummary(row), document };
    },

    async commit(input: CommitInput): Promise<StoredProject> {
      assertOpen();
      if (typeof input.name !== 'string' || input.name.length === 0) {
        throw new StorageError('A commit needs a name');
      }
      if (!isProjectDocument(input.document)) {
        throw new StorageError('A commit needs a valid project document');
      }

      const now = Date.now();
      const document = JSON.stringify(input.document);

      return driver.transaction(() => {
        if (input.id) {
          const current = driver.all<ProjectRow>(
            `SELECT id, name, created_at, updated_at, head_revision,
                    width, height, fps, duration_in_frames
               FROM projects WHERE id = ?`,
            [input.id],
          )[0];
          if (!current) {
            throw new StorageError(`No project with id ${input.id}`);
          }
          if (
            input.expectedRevision !== undefined &&
            input.expectedRevision !== current.head_revision
          ) {
            throw new StorageConflictError(
              `Project ${input.id} is at revision ${current.head_revision}, not ${input.expectedRevision}`,
            );
          }

          const revision = current.head_revision + 1;
          driver.run(
            `INSERT INTO project_revisions (project_id, revision, document, created_at)
             VALUES (?, ?, ?, ?)`,
            [input.id, revision, document, now],
          );
          driver.run(
            `UPDATE projects
                SET name = ?, updated_at = ?, head_revision = ?,
                    width = ?, height = ?, fps = ?, duration_in_frames = ?
              WHERE id = ?`,
            [
              input.name,
              now,
              revision,
              input.document.width,
              input.document.height,
              input.document.fps,
              input.document.durationInFrames,
              input.id,
            ],
          );

          return {
            id: input.id,
            name: input.name,
            revision,
            createdAt: current.created_at,
            updatedAt: now,
            width: input.document.width,
            height: input.document.height,
            fps: input.document.fps,
            durationInFrames: input.document.durationInFrames,
            document: input.document,
          };
        }

        const id = randomId();
        driver.run(
          `INSERT INTO projects
             (id, name, created_at, updated_at, head_revision,
              width, height, fps, duration_in_frames)
           VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?)`,
          [
            id,
            input.name,
            now,
            now,
            input.document.width,
            input.document.height,
            input.document.fps,
            input.document.durationInFrames,
          ],
        );
        driver.run(
          `INSERT INTO project_revisions (project_id, revision, document, created_at)
           VALUES (?, 1, ?, ?)`,
          [id, document, now],
        );

        return {
          id,
          name: input.name,
          revision: 1,
          createdAt: now,
          updatedAt: now,
          width: input.document.width,
          height: input.document.height,
          fps: input.document.fps,
          durationInFrames: input.document.durationInFrames,
          document: input.document,
        };
      });
    },

    async remove(id: string): Promise<void> {
      assertOpen();
      driver.transaction(() => {
        driver.run('DELETE FROM project_revisions WHERE project_id = ?', [id]);
        driver.run('DELETE FROM projects WHERE id = ?', [id]);
      });
    },

    async close(): Promise<void> {
      if (closed) return;
      closed = true;
      driver.close();
    },
  };

  return repository;
};
