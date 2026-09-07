import { mkdirSync } from 'node:fs';
import type { UnitOfWork } from '@trachex/domain';
import { trachexAppDir } from '@trachex/shared';
import { migrate, openDatabase, SqliteUnitOfWork } from '@trachex/storage-sqlite';

export interface ApiContext {
  appDir: string;
  db: ReturnType<typeof openDatabase>;
  uow: UnitOfWork;
}

export function openApiContext(appDir = trachexAppDir()): ApiContext {
  mkdirSync(appDir, { recursive: true });
  const db = openDatabase({ path: `${appDir}/trachex.db` });
  migrate(db);
  return { appDir, db, uow: new SqliteUnitOfWork(db) };
}
