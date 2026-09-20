import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { createProject, createSubject, createTicket } from '@trachex/domain';
import type Database from 'better-sqlite3';
import { ingestFile, migrate, openDatabase, SqliteUnitOfWork } from './index.ts';
import type { QdrantPoint } from './qdrant.ts';

function tempDir(): string {
  return mkdtempSync(join(tmpdir(), 'trachex-ingest-'));
}

function openDb(dir: string): Database.Database {
  const db = openDatabase({ path: join(dir, 'trachex.db') });
  migrate(db);
  return db;
}

async function seed(uow: SqliteUnitOfWork) {
  const project = await createProject(uow, { slug: 'loyalty', name: 'Loyalty' });
  const ticket = await createTicket(uow, {
    projectId: project.id,
    key: 'TICKET-1',
    title: 'Loyalty',
  });
  return { project, ticket };
}

test('ingest file creates snapshot, chunks, and searchable provenance', async () => {
  const dir = tempDir();
  try {
    const db = openDb(dir);
    const uow = new SqliteUnitOfWork(db);
    const { project, ticket } = await seed(uow);
    const content = [
      'Discount cap should be 15 percent for loyalty tier.',
      'VIP tier is exempt from the cap.',
    ].join('\n');
    const result = await ingestFile(uow, {
      appDir: dir,
      projectId: project.id,
      ticketId: ticket.id,
      type: 'fsd',
      attribution: 'FSD v1.2',
      relPath: 'docs/fsd.md',
      contentKind: 'markdown',
      content,
    });
    assert.equal(result.reusedSnapshot, false);
    assert.ok(result.chunkCount >= 1);
    assert.ok(existsSync(join(dir, 'projects', project.id, 'sources', result.snapshot.id)));
    assert.equal(result.snapshot.contentHash.length, 64);

    const hits = await uow.search.search('discount cap', project.id);
    assert.ok(hits.length >= 1);
    assert.equal(hits[0]?.relPath, 'docs/fsd.md');
    assert.ok(hits[0]?.location?.startsWith('docs/fsd.md:'));
    assert.ok(hits[0]?.content.includes('15 percent'));
    db.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('vector index scopes semantic results and preserves provenance', async () => {
  const dir = tempDir();
  try {
    const db = openDb(dir);
    const embedder = {
      async embedTexts(texts: string[]) {
        return texts.map((text) => {
          const vector = Array.from({ length: 384 }, () => 0);
          vector[0] = text.includes('VIP') ? 1 : 0;
          vector[1] = text.includes('cap') ? 1 : 0;
          return { vector };
        });
      },
    };
    const uow = new SqliteUnitOfWork(db, { embedder });
    const { project, ticket } = await seed(uow);
    const result = await ingestFile(uow, {
      appDir: dir,
      projectId: project.id,
      ticketId: ticket.id,
      type: 'fsd',
      relPath: 'docs/vector.md',
      contentKind: 'markdown',
      content: 'VIP customers are exempt from the cap.',
    });

    await uow.vectors.indexSnapshot(result.snapshot.id);
    const hits = await uow.vectors.search('VIP exemption', project.id, 5);
    assert.equal(hits.length, 1);
    assert.equal(hits[0]?.relPath, 'docs/vector.md');
    assert.equal(hits[0]?.projectId, project.id);
    db.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('qdrant backend indexes an ingested upload through the owning unit of work', async () => {
  const dir = tempDir();
  try {
    const db = openDb(dir);
    const points: QdrantPoint[] = [];
    const embedder = {
      async embedTexts(texts: string[]) {
        return texts.map(() => ({
          vector: Array.from({ length: 384 }, (_, i) => (i === 0 ? 1 : 0)),
        }));
      },
    };
    const qdrantClient = {
      async upsert(batch: QdrantPoint[]) {
        points.push(...batch);
      },
      async search() {
        return [];
      },
      async deleteCollection() {},
    };
    const uow = new SqliteUnitOfWork(db, {
      embedder,
      vectorBackend: 'qdrant',
      qdrantClient,
    });
    const { project, ticket } = await seed(uow);
    const result = await ingestFile(uow, {
      appDir: dir,
      projectId: project.id,
      ticketId: ticket.id,
      type: 'clarification',
      relPath: 'upload.md',
      contentKind: 'markdown',
      content: 'Uploaded clarification content.',
    });

    assert.ok(points.length >= 1);
    const point = points[0];
    assert.ok(point);
    assert.equal(point.payload.snapshot_id, result.snapshot.id);
    assert.equal(point.payload.rel_path, 'upload.md');
    db.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('qdrant payloads include every subject linked to a reused snapshot', async () => {
  const dir = tempDir();
  try {
    const db = openDb(dir);
    const points: QdrantPoint[] = [];
    const embedder = {
      async embedTexts(texts: string[]) {
        return texts.map(() => ({ vector: Array.from({ length: 384 }, () => 1) }));
      },
    };
    const qdrantClient = {
      async upsert(batch: QdrantPoint[]) {
        points.push(...batch);
      },
      async search() {
        return [];
      },
      async deleteCollection() {},
    };
    const uow = new SqliteUnitOfWork(db, {
      embedder,
      vectorBackend: 'qdrant',
      qdrantClient,
    });
    const project = await createProject(uow, { slug: 'shared', name: 'Shared' });
    const first = await createSubject(uow, { projectId: project.id, name: 'First subject' });
    const second = await createSubject(uow, { projectId: project.id, name: 'Second subject' });
    const input = {
      appDir: dir,
      projectId: project.id,
      type: 'document' as const,
      relPath: 'shared.md',
      contentKind: 'markdown',
      content: 'Shared subject evidence.',
    };
    const firstResult = await ingestFile(uow, { ...input, ticketId: first.id });
    await ingestFile(uow, { ...input, ticketId: second.id });

    const point = points.at(-1);
    assert.ok(point);
    assert.equal(point.payload.snapshot_id, firstResult.snapshot.id);
    assert.deepEqual(point.payload.subject_ids?.sort(), [first.id, second.id].sort());
    db.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('subject lexical search prefers matching evidence and falls back to project-only evidence', async () => {
  const dir = tempDir();
  try {
    const db = openDb(dir);
    const uow = new SqliteUnitOfWork(db);
    const project = await createProject(uow, { slug: 'scoped', name: 'Scoped' });
    const legacy = await createTicket(uow, {
      projectId: project.id,
      key: 'LEGACY',
      title: 'Legacy context',
    });
    const first = await createSubject(uow, { projectId: project.id, name: 'First subject' });
    const second = await createSubject(uow, { projectId: project.id, name: 'Second subject' });
    const ingest = (ticketId: string, content: string, relPath: string) =>
      ingestFile(uow, {
        appDir: dir,
        projectId: project.id,
        ticketId,
        type: 'document',
        relPath,
        contentKind: 'markdown',
        content,
      });
    await ingest(first.id, 'Evidence for first subject.', 'first.md');
    await ingest(second.id, 'Evidence for second subject.', 'second.md');
    await ingest(legacy.id, 'Legacy project evidence.', 'legacy.md');

    const hits = await uow.search.search('evidence', project.id, 10, first.id);
    assert.equal(hits[0]?.relPath, 'first.md');
    assert.ok(hits.some((hit) => hit.relPath === 'legacy.md'));
    assert.equal(
      hits.some((hit) => hit.relPath === 'second.md'),
      false,
    );
    db.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('re-ingesting changed content creates a new snapshot and preserves the old', async () => {
  const dir = tempDir();
  try {
    const db = openDb(dir);
    const uow = new SqliteUnitOfWork(db);
    const { project, ticket } = await seed(uow);
    const v1 = await ingestFile(uow, {
      appDir: dir,
      projectId: project.id,
      ticketId: ticket.id,
      type: 'fsd',
      relPath: 'docs/fsd.md',
      contentKind: 'markdown',
      content: 'Discount cap is 20 percent.',
    });
    const v2 = await ingestFile(uow, {
      appDir: dir,
      projectId: project.id,
      ticketId: ticket.id,
      type: 'fsd',
      relPath: 'docs/fsd.md',
      contentKind: 'markdown',
      content: 'Discount cap is 15 percent.',
    });
    assert.notEqual(v1.snapshot.id, v2.snapshot.id);
    assert.equal(v2.reusedSnapshot, false);
    const snapshots = await uow.snapshots.listByProject(project.id);
    assert.equal(snapshots.length, 2);
    assert.ok(existsSync(join(dir, 'projects', project.id, 'sources', v1.snapshot.id)));
    assert.ok(existsSync(join(dir, 'projects', project.id, 'sources', v2.snapshot.id)));
    db.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('identical re-ingest reuses the existing snapshot (dedup)', async () => {
  const dir = tempDir();
  try {
    const db = openDb(dir);
    const uow = new SqliteUnitOfWork(db);
    const { project, ticket } = await seed(uow);
    const v1 = await ingestFile(uow, {
      appDir: dir,
      projectId: project.id,
      ticketId: ticket.id,
      type: 'chat',
      relPath: 'note.txt',
      contentKind: 'text',
      content: 'same content',
    });
    const v2 = await ingestFile(uow, {
      appDir: dir,
      projectId: project.id,
      ticketId: ticket.id,
      type: 'chat',
      relPath: 'note.txt',
      contentKind: 'text',
      content: 'same content',
    });
    assert.equal(v2.reusedSnapshot, true);
    assert.equal(v1.snapshot.id, v2.snapshot.id);
    const snapshots = await uow.snapshots.listByProject(project.id);
    assert.equal(snapshots.length, 1);
    const sources = await uow.sources.listByTicket(ticket.id);
    assert.equal(sources.length, 2);
    db.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('pasted note ingestion works without a source file', async () => {
  const dir = tempDir();
  try {
    const db = openDb(dir);
    const uow = new SqliteUnitOfWork(db);
    const { project, ticket } = await seed(uow);
    const result = await ingestFile(uow, {
      appDir: dir,
      projectId: project.id,
      ticketId: ticket.id,
      type: 'clarification',
      attribution: 'Budi (BA)',
      relPath: 'note',
      contentKind: 'text',
      content: 'Discount cap should be 15%, not 20%. VIP tier is exempt.',
    });
    assert.equal(result.source.type, 'clarification');
    assert.equal(result.source.attribution, 'Budi (BA)');
    const hits = await uow.search.search('VIP tier exempt', project.id);
    assert.ok(hits.length >= 1);
    db.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
