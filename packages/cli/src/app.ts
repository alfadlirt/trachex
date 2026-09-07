import { mkdirSync } from 'node:fs';
import type { UnitOfWork } from '@trachex/domain';
import { trachexAppDir } from '@trachex/shared';
import { migrate, openDatabase, SqliteUnitOfWork } from '@trachex/storage-sqlite';

export interface AppContext {
  appDir: string;
  db: ReturnType<typeof openDatabase>;
  uow: UnitOfWork;
}

export function openApp(appDir = trachexAppDir()): AppContext {
  mkdirSync(appDir, { recursive: true });
  const db = openDatabase({ path: `${appDir}/trachex.db` });
  migrate(db);
  return { appDir, db, uow: new SqliteUnitOfWork(db) };
}
