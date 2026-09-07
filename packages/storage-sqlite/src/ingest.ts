import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { UnitOfWork } from '@trachex/domain';
import { type IngestSourceInput, ingestSource } from '@trachex/domain';
import { sourcesDir } from '@trachex/shared';

export interface IngestFileInput {
  appDir: string;
  projectId: string;
  ticketId: string;
  type: IngestSourceInput['type'];
  attribution?: string;
  sourceEventAt?: string;
  location?: string;
  relPath: string;
  contentKind: string;
  content: string;
}

export async function ingestFile(uow: UnitOfWork, input: IngestFileInput) {
  const root = sourcesDir(input.appDir, input.projectId);
  mkdirSync(root, { recursive: true });
  return ingestSource(uow, {
    projectId: input.projectId,
    ticketId: input.ticketId,
    type: input.type,
    ...(input.attribution !== undefined ? { attribution: input.attribution } : {}),
    ...(input.sourceEventAt !== undefined ? { sourceEventAt: input.sourceEventAt } : {}),
    ...(input.location !== undefined ? { location: input.location } : {}),
    relPath: input.relPath,
    contentKind: input.contentKind,
    content: input.content,
    writeSnapshotFile: async (snapshotId, content) => {
      writeFileSync(join(root, snapshotId), content, 'utf8');
    },
  });
}
