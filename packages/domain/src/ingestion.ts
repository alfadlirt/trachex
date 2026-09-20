import { chunkText, sha256 } from '@trachex/shared';
import type { Snapshot, Source, SourceType } from './entities.ts';
import { NotFoundError, ScopingError } from './errors.ts';
import { newId, nowIso } from './ids.ts';
import type { UnitOfWork } from './repositories.ts';

export interface IngestSourceInput {
  projectId: string;
  ticketId: string;
  type: SourceType;
  attribution?: string;
  sourceEventAt?: string;
  location?: string;
  note?: string;
  relPath: string;
  contentKind: string;
  content: string;
  writeSnapshotFile: (snapshotId: string, content: string) => Promise<void>;
}

export interface IngestSourceResult {
  source: Source;
  snapshot: Snapshot;
  chunkCount: number;
  reusedSnapshot: boolean;
}

export async function ingestSource(
  uow: UnitOfWork,
  input: IngestSourceInput,
): Promise<IngestSourceResult> {
  const ticket = await uow.tickets.findById(input.ticketId);
  if (!ticket) {
    throw new NotFoundError('ticket', input.ticketId);
  }
  if (ticket.projectId !== input.projectId) {
    throw new ScopingError('ticket does not belong to the given project');
  }

  const hash = sha256(input.content);
  const existing = await uow.snapshots.findByProjectAndHash(input.projectId, hash);
  const now = nowIso();

  let snapshot: Snapshot;
  let reusedSnapshot = false;
  let chunkCount = 0;

  if (existing) {
    snapshot = existing;
    reusedSnapshot = true;
  } else {
    snapshot = {
      id: newId(),
      projectId: input.projectId,
      repositoryId: null,
      relPath: input.relPath,
      contentHash: hash,
      contentKind: input.contentKind,
      size: input.content.length,
      createdAt: now,
    };
    await input.writeSnapshotFile(snapshot.id, input.content);
    await uow.snapshots.create(snapshot);
    const chunks = chunkText(input.content, input.relPath).map((c) => ({
      id: c.id,
      snapshotId: snapshot.id,
      chunkIndex: c.index,
      content: c.content,
      location: c.location,
      createdAt: now,
    }));
    await uow.chunks.insertMany(chunks);
    chunkCount = chunks.length;
  }

  const source: Source = {
    id: newId(),
    ticketId: input.ticketId,
    type: input.type,
    attribution: input.attribution?.trim() || null,
    sourceEventAt: input.sourceEventAt ?? null,
    ingestedAt: now,
    snapshotId: snapshot.id,
    location: input.location?.trim() || null,
    note: input.note?.trim() || null,
  };
  await uow.sources.create(source);

  // Indexing is deliberately outside canonical persistence. A missing or failed
  // semantic backend must not prevent the source/snapshot from being recorded.
  // Persist the source first so reused snapshots include its subject metadata.
  if (uow.vectors?.available) {
    try {
      await uow.vectors.indexSnapshot(snapshot.id);
    } catch {
      // Retrieval falls back to the authoritative FTS index.
    }
  }

  return { source, snapshot, chunkCount, reusedSnapshot };
}
