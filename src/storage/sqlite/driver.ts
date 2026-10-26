/**
 * The SQL seam.
 *
 * Everything in this adapter is written against `SqlDriver`, never against a
 * concrete SQLite binding. That is what lets the same SQL run under the
 * browser's WASM build and under `node:sqlite` in the test suite.
 *
 * The driver is deliberately synchronous: SQLite is, and every caller here
 * already lives in a worker or in a synchronous test.
 */

/** A value that can be bound to a SQL parameter. */
export type SqlValue = string | number | null | Uint8Array;

export interface SqlDriver {
  /** Runs one or more statements that return no rows. */
  exec(sql: string): void;
  /** Runs a single statement with bound parameters. */
  run(sql: string, params?: SqlValue[]): void;
  /** Runs a single query and returns its rows. */
  all<T extends object>(sql: string, params?: SqlValue[]): T[];
  /** Runs `fn` inside a transaction, rolling back when it throws. */
  transaction<T>(fn: () => T): T;
  /** Releases the connection. */
  close(): void;
}

/** Row shape as the bindings hand it back, before normalisation. */
type RawRow = Record<string, unknown>;

/**
 * Normalises a value coming out of a binding.
 *
 * SQLite stores 64-bit integers; the bindings may hand those back as
 * `bigint`, and blobs as `ArrayBuffer` in some builds. The rest of the
 * adapter only ever wants the four value kinds `SqlValue` allows.
 */
const toSqlValue = (value: unknown): SqlValue => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') return value;
  if (typeof value === 'number') return value;
  if (typeof value === 'bigint') return Number(value);
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  return String(value);
};

const toRows = (rows: RawRow[]): RawRow[] =>
  rows.map((row) => {
    const out: RawRow = {};
    for (const [key, value] of Object.entries(row)) out[key] = toSqlValue(value);
    return out;
  });

/* ------------------------------------------------------------------ *
 * node:sqlite
 * ------------------------------------------------------------------ */

interface NodeStatement {
  all(...params: unknown[]): RawRow[];
  run(...params: unknown[]): unknown;
}

interface NodeDatabase {
  exec(sql: string): void;
  prepare(sql: string): NodeStatement;
  close(): void;
}

interface NodeSqliteModule {
  DatabaseSync: new (path: string) => NodeDatabase;
}

interface NodeProcess {
  getBuiltinModule?: (id: string) => unknown;
}

const getNodeProcess = (): NodeProcess | null => {
  const runtime = globalThis as { process?: unknown };
  const proc = runtime.process;
  if (typeof proc !== 'object' || proc === null) return null;
  const candidate = proc as Partial<NodeProcess>;
  return typeof candidate.getBuiltinModule === 'function'
    ? (candidate as NodeProcess)
    : null;
};

const isNodeSqliteModule = (value: unknown): value is NodeSqliteModule => {
  if (typeof value !== 'object' || value === null) return false;
  return typeof (value as Partial<NodeSqliteModule>).DatabaseSync === 'function';
};

/**
 * Reaches `node:sqlite` without a static import.
 *
 * A static `import 'node:sqlite'` in this file would be pulled into the
 * browser bundle — the worker imports this module for the WASM driver — and
 * `node:` builtins do not exist in a browser. `process.getBuiltinModule`
 * resolves the same builtin at runtime, in Node only.
 */
const loadNodeSqlite = (): NodeSqliteModule | null => {
  const module = getNodeProcess()?.getBuiltinModule?.('node:sqlite');
  return isNodeSqliteModule(module) ? module : null;
};

/**
 * A driver over a real SQLite file, for the test suite.
 *
 * Node 24 ships `node:sqlite` unflagged, so the same SQL that runs in the
 * browser runs here against a file in the OS temp directory.
 */
export const createNodeSqliteDriver = (path: string): SqlDriver => {
  const sqlite = loadNodeSqlite();
  if (!sqlite) {
    throw new Error('node:sqlite is not available in this runtime');
  }
  const db = new sqlite.DatabaseSync(path);
  let depth = 0;

  return {
    exec(sql) {
      db.exec(sql);
    },
    run(sql, params = []) {
      db.prepare(sql).run(...params);
    },
    all<T extends object>(sql: string, params: SqlValue[] = []): T[] {
      return toRows(db.prepare(sql).all(...params)) as T[];
    },
    transaction<T>(fn: () => T): T {
      // Nested calls join the outer transaction: SQLite has no nested
      // transactions and the inner work must roll back with the outer one.
      if (depth > 0) return fn();
      depth += 1;
      db.exec('BEGIN');
      try {
        const result = fn();
        db.exec('COMMIT');
        return result;
      } catch (error) {
        db.exec('ROLLBACK');
        throw error;
      } finally {
        depth -= 1;
      }
    },
    close() {
      db.close();
    },
  };
};

/* ------------------------------------------------------------------ *
 * sqlite3 WASM (OO1)
 * ------------------------------------------------------------------ */

interface WasmDatabase {
  exec(sql: string): unknown;
  exec(options: { sql: string; bind: readonly unknown[] }): unknown;
  selectObjects(sql: string, bind?: readonly unknown[]): RawRow[];
  transaction<T>(fn: () => T): T;
  close(): void;
}

const isWasmDatabase = (db: unknown): db is WasmDatabase => {
  if (typeof db !== 'object' || db === null) return false;
  const candidate = db as Record<string, unknown>;
  return (
    typeof candidate.exec === 'function' &&
    typeof candidate.selectObjects === 'function' &&
    typeof candidate.transaction === 'function' &&
    typeof candidate.close === 'function'
  );
};

/**
 * A driver over an open `sqlite3.oo1.DB` handle.
 *
 * The handle is created by the worker, which owns the OPFS VFS and the
 * database file. This wrapper only speaks SQL.
 */
export const createWasmDriver = (db: unknown): SqlDriver => {
  if (!isWasmDatabase(db)) {
    throw new Error('Not a sqlite3 OO1 database handle');
  }
  let depth = 0;

  return {
    exec(sql) {
      db.exec(sql);
    },
    run(sql, params = []) {
      db.exec({ sql, bind: params });
    },
    all<T extends object>(sql: string, params: SqlValue[] = []): T[] {
      return toRows(db.selectObjects(sql, params)) as T[];
    },
    transaction<T>(fn: () => T): T {
      if (depth > 0) return fn();
      depth += 1;
      try {
        return db.transaction(() => fn());
      } finally {
        depth -= 1;
      }
    },
    close() {
      db.close();
    },
  };
};
