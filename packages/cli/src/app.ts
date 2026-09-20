import { mkdirSync } from 'node:fs';
import type { UnitOfWork } from '@trachex/domain';
import { loadTrachexEnv, trachexAppDir } from '@trachex/shared';
import {
  createLazyLocalEmbedder,
  migrate,
  openDatabase,
  resolveVectorBackend,
  SqliteUnitOfWork,
} from '@trachex/storage-sqlite';

export interface AppContext {
  appDir: string;
  db: ReturnType<typeof openDatabase>;
  uow: UnitOfWork;
}

export function openApp(appDir?: string, env: NodeJS.ProcessEnv = process.env): AppContext {
  loadTrachexEnv(env);
  const resolvedAppDir = appDir ?? trachexAppDir(env);
  mkdirSync(resolvedAppDir, { recursive: true });
  const db = openDatabase({ path: `${resolvedAppDir}/trachex.db` });
  migrate(db);
  return {
    appDir: resolvedAppDir,
    db,
    uow: new SqliteUnitOfWork(db, {
      embedder: createLazyLocalEmbedder(),
      vectorBackend: resolveVectorBackend(env).backend,
      ...(resolveVectorBackend(env).qdrantClient
        ? { qdrantClient: resolveVectorBackend(env).qdrantClient }
        : {}),
    }),
  };
}
