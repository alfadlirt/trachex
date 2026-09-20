import { mkdirSync } from 'node:fs';
import type { UnitOfWork } from '@trachex/domain';
import { trachexAppDir } from '@trachex/shared';
import {
  createLazyLocalEmbedder,
  migrate,
  openDatabase,
  resolveVectorBackend,
  SqliteUnitOfWork,
} from '@trachex/storage-sqlite';

export interface ApiContext {
  appDir: string;
  db: ReturnType<typeof openDatabase>;
  uow: UnitOfWork;
}

export function openApiContext(
  appDir = trachexAppDir(),
  env: NodeJS.ProcessEnv = process.env,
): ApiContext {
  mkdirSync(appDir, { recursive: true });
  const db = openDatabase({ path: `${appDir}/trachex.db` });
  migrate(db);
  const vector = resolveVectorBackend(env);
  return {
    appDir,
    db,
    uow: new SqliteUnitOfWork(db, {
      embedder: createLazyLocalEmbedder(),
      vectorBackend: vector.backend,
      ...(vector.qdrantClient ? { qdrantClient: vector.qdrantClient } : {}),
    }),
  };
}
