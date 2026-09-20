import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import Database from 'better-sqlite3';
import { load as loadVec } from 'sqlite-vec';
import { migrations } from './migrations.ts';

export interface OpenOptions {
  path: string;
  busyTimeoutMs?: number;
}

export function openDatabase(options: OpenOptions): Database.Database {
  if (options.path !== ':memory:') {
    mkdirSync(dirname(options.path), { recursive: true });
  }
  const db = new Database(options.path);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.pragma(`busy_timeout = ${options.busyTimeoutMs ?? 5000}`);
  try {
    loadVec(db);
  } catch {
    // Native vector search is optional; the FTS5 repository remains available.
  }
  return db;
}

export function migrate(db: Database.Database): void {
  db.exec(
    'CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at TEXT NOT NULL);',
  );
  const applied = new Set(
    (db.prepare('SELECT version FROM schema_migrations').all() as { version: number }[]).map(
      (r) => r.version,
    ),
  );
  const apply = db.transaction(() => {
    for (const migration of migrations) {
      if (applied.has(migration.version)) {
        continue;
      }
      db.exec(migration.sql);
      db.prepare('INSERT INTO schema_migrations (version, name, applied_at) VALUES (?, ?, ?)').run(
        migration.version,
        migration.name,
        new Date().toISOString(),
      );
    }
  });
  apply();
}

export function currentSchemaVersion(db: Database.Database): number {
  const row = db.prepare('SELECT MAX(version) AS version FROM schema_migrations').get() as {
    version: number | null;
  };
  return row.version ?? 0;
}
