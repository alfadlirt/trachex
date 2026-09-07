import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import type Database from 'better-sqlite3';
import { SCHEMA_VERSION } from './migrations.ts';

export interface ArchiveManifest {
  schema_version: number;
  exported_at: string;
  project: Record<string, unknown>;
  repositories: Record<string, unknown>[];
  repository_paths: Record<string, unknown>[];
  tickets: Record<string, unknown>[];
  sources: Record<string, unknown>[];
  snapshots: Record<string, unknown>[];
  chunks: Record<string, unknown>[];
  requirements: Record<string, unknown>[];
  requirement_relationships: Record<string, unknown>[];
  impacts: Record<string, unknown>[];
  scenarios: Record<string, unknown>[];
  proposals: Record<string, unknown>[];
  proposal_versions: Record<string, unknown>[];
  completion_audits: Record<string, unknown>[];
  export_artifacts: Record<string, unknown>[];
  files: string[];
}

export function exportProjectArchive(
  db: Database.Database,
  input: { projectId: string; sourcesRoot: string; outDir: string },
): string {
  const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(input.projectId) as Record<
    string,
    unknown
  >;
  if (!project) {
    throw new Error(`project not found: ${input.projectId}`);
  }

  const manifest: ArchiveManifest = {
    schema_version: SCHEMA_VERSION,
    exported_at: new Date().toISOString(),
    project,
    repositories: [],
    repository_paths: [],
    tickets: [],
    sources: [],
    snapshots: [],
    chunks: [],
    requirements: [],
    requirement_relationships: [],
    impacts: [],
    scenarios: [],
    proposals: [],
    proposal_versions: [],
    completion_audits: [],
    export_artifacts: [],
    files: [],
  };

  const projectId = input.projectId;
  manifest.repositories = db
    .prepare('SELECT * FROM repositories WHERE project_id = ?')
    .all(projectId) as Record<string, unknown>[];
  const repoIds = manifest.repositories.map((r) => String(r.id));
  for (const repoId of repoIds) {
    manifest.repository_paths.push(
      ...(db
        .prepare('SELECT * FROM repository_paths WHERE repository_id = ?')
        .all(repoId) as Record<string, unknown>[]),
    );
  }
  manifest.tickets = db
    .prepare('SELECT * FROM tickets WHERE project_id = ?')
    .all(projectId) as Record<string, unknown>[];
  const ticketIds = manifest.tickets.map((t) => String(t.id));
  manifest.sources = db
    .prepare(
      'SELECT * FROM sources WHERE ticket_id IN (SELECT id FROM tickets WHERE project_id = ?)',
    )
    .all(projectId) as Record<string, unknown>[];
  manifest.snapshots = db
    .prepare('SELECT * FROM snapshots WHERE project_id = ?')
    .all(projectId) as Record<string, unknown>[];
  const snapshotIds = manifest.snapshots.map((s) => String(s.id));
  for (const snapshotId of snapshotIds) {
    manifest.chunks.push(
      ...(db.prepare('SELECT * FROM chunks WHERE snapshot_id = ?').all(snapshotId) as Record<
        string,
        unknown
      >[]),
    );
  }
  for (const ticketId of ticketIds) {
    manifest.requirements.push(
      ...(db.prepare('SELECT * FROM requirements WHERE ticket_id = ?').all(ticketId) as Record<
        string,
        unknown
      >[]),
    );
  }
  const requirementIds = manifest.requirements.map((r) => String(r.id));
  for (const reqId of requirementIds) {
    manifest.requirement_relationships.push(
      ...(db
        .prepare(
          'SELECT * FROM requirement_relationships WHERE from_requirement_id = ? OR to_requirement_id = ?',
        )
        .all(reqId, reqId) as Record<string, unknown>[]),
    );
    manifest.impacts.push(
      ...(db.prepare('SELECT * FROM impacts WHERE requirement_id = ?').all(reqId) as Record<
        string,
        unknown
      >[]),
    );
    manifest.scenarios.push(
      ...(db.prepare('SELECT * FROM scenarios WHERE requirement_id = ?').all(reqId) as Record<
        string,
        unknown
      >[]),
    );
  }
  for (const ticketId of ticketIds) {
    manifest.proposals.push(
      ...(db.prepare('SELECT * FROM proposals WHERE ticket_id = ?').all(ticketId) as Record<
        string,
        unknown
      >[]),
    );
  }
  const proposalIds = manifest.proposals.map((p) => String(p.id));
  for (const proposalId of proposalIds) {
    manifest.proposal_versions.push(
      ...(db
        .prepare('SELECT * FROM proposal_versions WHERE proposal_id = ?')
        .all(proposalId) as Record<string, unknown>[]),
    );
  }
  for (const reqId of requirementIds) {
    manifest.completion_audits.push(
      ...(db
        .prepare('SELECT * FROM completion_audits WHERE requirement_id = ?')
        .all(reqId) as Record<string, unknown>[]),
    );
  }
  manifest.export_artifacts = db
    .prepare('SELECT * FROM export_artifacts WHERE project_id = ?')
    .all(projectId) as Record<string, unknown>[];

  const sourcesOut = join(input.outDir, 'sources');
  mkdirSync(sourcesOut, { recursive: true });
  if (existsSync(input.sourcesRoot)) {
    for (const entry of readdirSync(input.sourcesRoot)) {
      const src = join(input.sourcesRoot, entry);
      const dst = join(sourcesOut, entry);
      copyFileSync(src, dst);
      manifest.files.push(entry);
    }
  }

  writeFileSync(join(input.outDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  return join(input.outDir, 'manifest.json');
}

export function importProjectArchive(
  db: Database.Database,
  input: { archiveDir: string; sourcesRoot: string },
): string {
  const manifest = JSON.parse(
    readFileSync(join(input.archiveDir, 'manifest.json'), 'utf8'),
  ) as ArchiveManifest;
  if (manifest.schema_version !== SCHEMA_VERSION) {
    throw new Error(
      `unsupported archive schema version: ${manifest.schema_version} (expected ${SCHEMA_VERSION})`,
    );
  }

  const tx = db.transaction(() => {
    insertRow(db, 'projects', manifest.project);
    for (const row of manifest.repositories) insertRow(db, 'repositories', row);
    for (const row of manifest.repository_paths) insertRow(db, 'repository_paths', row);
    for (const row of manifest.tickets) insertRow(db, 'tickets', row);
    for (const row of manifest.sources) insertRow(db, 'sources', row);
    for (const row of manifest.snapshots) insertRow(db, 'snapshots', row);
    for (const row of manifest.chunks) insertRow(db, 'chunks', row);
    for (const row of manifest.requirements) insertRow(db, 'requirements', row);
    for (const row of manifest.requirement_relationships)
      insertRow(db, 'requirement_relationships', row);
    for (const row of manifest.impacts) insertRow(db, 'impacts', row);
    for (const row of manifest.scenarios) insertRow(db, 'scenarios', row);
    for (const row of manifest.proposals) insertRow(db, 'proposals', row);
    for (const row of manifest.proposal_versions) insertRow(db, 'proposal_versions', row);
    for (const row of manifest.completion_audits) insertRow(db, 'completion_audits', row);
    for (const row of manifest.export_artifacts) insertRow(db, 'export_artifacts', row);
  });
  tx();

  const sourcesOut = input.sourcesRoot;
  mkdirSync(sourcesOut, { recursive: true });
  for (const file of manifest.files) {
    const src = join(input.archiveDir, 'sources', file);
    if (existsSync(src)) {
      copyFileSync(src, join(sourcesOut, file));
    }
  }

  return String(manifest.project.id);
}

function insertRow(db: Database.Database, table: string, row: Record<string, unknown>): void {
  const keys = Object.keys(row);
  if (keys.length === 0) {
    return;
  }
  const columns = keys.join(', ');
  const placeholders = keys.map(() => '?').join(', ');
  db.prepare(`INSERT INTO ${table} (${columns}) VALUES (${placeholders})`).run(
    ...keys.map((k) => row[k]),
  );
}
