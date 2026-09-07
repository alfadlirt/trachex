import type { SearchRepository, SearchResult } from '@trachex/domain';
import { chunkText } from '@trachex/shared';

export interface QdrantConfig {
  url: string;
  apiKey?: string;
  collection: string;
}

export interface QdrantClient {
  upsert(points: QdrantPoint[]): Promise<void>;
  search(query: string, projectId: string, limit: number): Promise<SearchResult[]>;
  deleteCollection(): Promise<void>;
}

export interface QdrantPoint {
  id: string;
  vector: number[];
  payload: {
    project_id: string;
    snapshot_id: string;
    chunk_id: string;
    chunk_index: number;
    content: string;
    location: string | null;
    rel_path: string | null;
  };
}

export interface Embedder {
  embed(texts: string[]): Promise<number[][]>;
}

export function createQdrantSearchRepository(client: QdrantClient): SearchRepository {
  return {
    async search(query, projectId, limit = 10): Promise<SearchResult[]> {
      return client.search(query, projectId, limit);
    },
  };
}

export interface SnapshotForRebuild {
  id: string;
  projectId: string;
  relPath: string;
  content: string;
}

export async function rebuildQdrantFromSnapshots(input: {
  client: QdrantClient;
  embedder: Embedder;
  snapshots: SnapshotForRebuild[];
}): Promise<number> {
  const { client, embedder, snapshots } = input;
  await client.deleteCollection();
  const points: QdrantPoint[] = [];
  for (const snapshot of snapshots) {
    const chunks = chunkText(snapshot.content, snapshot.relPath);
    const vectors = await embedder.embed(chunks.map((c) => c.content));
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const vector = vectors[i];
      if (!chunk || !vector) {
        continue;
      }
      points.push({
        id: chunk.id,
        vector,
        payload: {
          project_id: snapshot.projectId,
          snapshot_id: snapshot.id,
          chunk_id: chunk.id,
          chunk_index: chunk.index,
          content: chunk.content,
          location: chunk.location,
          rel_path: snapshot.relPath,
        },
      });
    }
  }
  await client.upsert(points);
  return points.length;
}
