export type { ArchiveManifest } from './archive.ts';
export { exportProjectArchive, importProjectArchive } from './archive.ts';
export type { VectorBackend, VectorBackendConfig } from './backend.ts';
export { resolveVectorBackend } from './backend.ts';
export { currentSchemaVersion, migrate, openDatabase } from './connection.ts';
export { createLazyLocalEmbedder, loadLocalEmbedder } from './embeddings.ts';
export { ingestFile } from './ingest.ts';
export { migrations, SCHEMA_VERSION } from './migrations.ts';
export type { Embedder, QdrantClient, QdrantConfig, QdrantPoint } from './qdrant.ts';
export {
  createQdrantClient,
  createQdrantSearchRepository,
  createQdrantVectorRepository,
  rebuildQdrantFromSnapshots,
} from './qdrant.ts';
export {
  SqliteAdjustmentJobRepository,
  SqliteUnitOfWork,
  SqliteVectorRepository,
} from './repositories.ts';
