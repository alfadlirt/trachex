import type {
  SearchRepository,
  SearchResult,
  VectorEmbedder,
  VectorIndexRepository,
} from '@trachex/domain';
import { chunkText } from '@trachex/shared';
import type Database from 'better-sqlite3';

export interface QdrantConfig {
  url: string;
  apiKey?: string;
  collection: string;
}

export interface QdrantClient {
  upsert(points: QdrantPoint[]): Promise<void>;
  search(query: number[], projectId: string, limit: number): Promise<SearchResult[]>;
  deleteCollection(): Promise<void>;
}

export function createQdrantClient(config: QdrantConfig): QdrantClient {
  const base = config.url.replace(/\/$/, '');
  const headers = {
    'Content-Type': 'application/json',
    ...(config.apiKey ? { 'api-key': config.apiKey } : {}),
  };
  const collectionUrl = `${base}/collections/${encodeURIComponent(config.collection)}`;
  const request = async (url: string, init?: RequestInit) => {
    const response = await fetch(url, { ...init, headers: { ...headers, ...init?.headers } });
    if (!response.ok && response.status !== 409) {
      throw new Error(`Qdrant request failed (${response.status})`);
    }
    return response;
  };
  let initialized: Promise<void> | undefined;
  const ensureCollection = () =>
    (initialized ??= request(collectionUrl, {
      method: 'PUT',
      body: JSON.stringify({ vectors: { size: 384, distance: 'Cosine' } }),
    }).then(() => undefined));
  return {
    async upsert(points) {
      await ensureCollection();
      await request(`${collectionUrl}/points?wait=true`, {
        method: 'PUT',
        body: JSON.stringify({ points }),
      });
    },
    async search(query, projectId, limit) {
      await ensureCollection();
      const response = await request(`${collectionUrl}/points/query`, {
        method: 'POST',
        body: JSON.stringify({
          query,
          limit,
          with_payload: true,
          filter: { must: [{ key: 'project_id', match: { value: projectId } }] },
        }),
      });
      const body = (await response.json()) as {
        result?: Array<{ score: number; payload: QdrantPoint['payload'] }>;
      };
      return (body.result ?? []).map((item) => ({
        chunkId: item.payload.chunk_id,
        snapshotId: item.payload.snapshot_id,
        projectId: item.payload.project_id,
        content: item.payload.content,
        location: item.payload.location,
        relPath: item.payload.rel_path,
        score: item.score,
      }));
    },
    async deleteCollection() {
      await request(collectionUrl, { method: 'DELETE' });
      initialized = undefined;
    },
  };
}

export function createQdrantVectorRepository(input: {
  db: Database.Database;
  client: QdrantClient;
  embedder: VectorEmbedder;
}): VectorIndexRepository {
  const { db, client, embedder } = input;
  return {
    available: true,
    async indexSnapshot(snapshotId) {
      const rows = db
        .prepare(
          `SELECT c.id, c.content, c.chunk_index, c.location, s.project_id, s.rel_path
           FROM chunks c JOIN snapshots s ON s.id = c.snapshot_id
           WHERE c.snapshot_id = ? ORDER BY c.chunk_index`,
        )
        .all(snapshotId) as Array<Record<string, unknown>>;
      const vectors = await embedder.embedTexts(rows.map((row) => String(row.content)));
      await client.upsert(
        rows.flatMap((row, index) => {
          const vector = vectors[index];
          if (!vector) return [];
          return [
            {
              id: toQdrantId(String(row.id)),
              vector: vector.vector,
              payload: {
                project_id: String(row.project_id),
                snapshot_id: snapshotId,
                chunk_id: String(row.id),
                chunk_index: Number(row.chunk_index),
                content: String(row.content),
                location: row.location == null ? null : String(row.location),
                rel_path: String(row.rel_path),
              },
            },
          ];
        }),
      );
    },
    async search(query, projectId, limit = 10) {
      const [embedding] = await embedder.embedTexts([query]);
      if (!embedding) return [];
      return client.search(embedding.vector, projectId, limit);
    },
  };
}

function toQdrantId(value: string): string {
  const hex = value
    .replace(/[^0-9a-f]/gi, '')
    .padEnd(32, '0')
    .slice(0, 32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
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

export function createQdrantSearchRepository(
  client: QdrantClient,
  embedder: VectorEmbedder,
): SearchRepository {
  return {
    async search(query, projectId, limit = 10): Promise<SearchResult[]> {
      const [embedding] = await embedder.embedTexts([query]);
      return embedding ? client.search(embedding.vector, projectId, limit) : [];
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
