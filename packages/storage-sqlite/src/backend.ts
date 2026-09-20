import type { QdrantClient } from './qdrant.ts';
import { createQdrantClient } from './qdrant.ts';

export type VectorBackend = 'sqlite' | 'qdrant';

export interface VectorBackendConfig {
  backend: VectorBackend;
  qdrantClient?: QdrantClient;
}

export function resolveVectorBackend(env: NodeJS.ProcessEnv = process.env): VectorBackendConfig {
  const backend =
    env.TRACHEX_VECTOR_BACKEND?.trim().toLowerCase() === 'qdrant' ? 'qdrant' : 'sqlite';
  if (backend !== 'qdrant') return { backend };
  return {
    backend,
    qdrantClient: createQdrantClient({
      url: env.QDRANT_URL?.trim() || 'http://localhost:6333',
      ...(env.QDRANT_API_KEY?.trim() ? { apiKey: env.QDRANT_API_KEY.trim() } : {}),
      collection: env.QDRANT_COLLECTION?.trim() || 'trachex',
    }),
  };
}
