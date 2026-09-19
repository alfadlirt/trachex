import type {
  AgentRepository,
  AgentRun,
  ChatMessage,
  ChatSession,
  Chunk,
  ChunkRepository,
  CompletionAudit,
  CompletionAuditRepository,
  ErrorRecord,
  EvidenceReference,
  ExportArtifact,
  ExportRepository,
  Impact,
  Project,
  ProjectRepository,
  Proposal,
  ProposalRepository,
  ProposalVersion,
  Repository,
  RepositoryPath,
  RepositoryRepository,
  Requirement,
  RequirementRelationship,
  RequirementRepository,
  ReviewFinding,
  Scenario,
  SearchRepository,
  SearchResult,
  SessionRepository,
  Snapshot,
  SnapshotRepository,
  Source,
  SourceRepository,
  Subject,
  SubjectRepository,
  Ticket,
  TicketRepository,
  UnitOfWork,
} from '@trachex/domain';
import type Database from 'better-sqlite3';

type Row = Record<string, unknown>;

function projectFromRow(row: Row): Project {
  return {
    id: String(row.id),
    slug: String(row.slug),
    name: String(row.name),
    description: row.description == null ? null : String(row.description),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    ...(row.lifecycle_status !== undefined
      ? { lifecycleStatus: String(row.lifecycle_status) as 'active' | 'archived' }
      : {}),
  };
}

function repositoryFromRow(row: Row): Repository {
  return {
    id: String(row.id),
    projectId: row.project_id == null ? null : String(row.project_id),
    slug: String(row.slug),
    serviceName: row.service_name == null ? null : String(row.service_name),
    url: row.url == null ? null : String(row.url),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function repositoryPathFromRow(row: Row): RepositoryPath {
  return {
    id: String(row.id),
    repositoryId: String(row.repository_id),
    path: String(row.path),
    validFrom: String(row.valid_from),
    validTo: row.valid_to == null ? null : String(row.valid_to),
  };
}

function ticketFromRow(row: Row): Ticket {
  return {
    id: String(row.id),
    projectId: String(row.project_id),
    key: String(row.key),
    title: String(row.title),
    description: row.description == null ? null : String(row.description),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function subjectFromRow(row: Row): Subject {
  return {
    id: String(row.id),
    projectId: String(row.project_id),
    name: String(row.name),
    description: row.description == null ? null : String(row.description),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
    ...(row.lifecycle_status !== undefined
      ? { lifecycleStatus: String(row.lifecycle_status) as 'active' | 'archived' }
      : {}),
  };
}

function snapshotFromRow(row: Row): Snapshot {
  return {
    id: String(row.id),
    projectId: String(row.project_id),
    repositoryId: row.repository_id == null ? null : String(row.repository_id),
    relPath: String(row.rel_path),
    contentHash: String(row.content_hash),
    contentKind: String(row.content_kind),
    size: Number(row.size),
    createdAt: String(row.created_at),
  };
}

function sourceFromRow(row: Row): Source {
  return {
    id: String(row.id),
    ticketId: String(row.ticket_id),
    type: String(row.type) as Source['type'],
    attribution: row.attribution == null ? null : String(row.attribution),
    sourceEventAt: row.source_event_at == null ? null : String(row.source_event_at),
    ingestedAt: String(row.ingested_at),
    snapshotId: row.snapshot_id == null ? null : String(row.snapshot_id),
    location: row.location == null ? null : String(row.location),
    note: row.note == null ? null : String(row.note),
  };
}

function chunkFromRow(row: Row): Chunk {
  return {
    id: String(row.id),
    snapshotId: String(row.snapshot_id),
    chunkIndex: Number(row.chunk_index),
    content: String(row.content),
    location: row.location == null ? null : String(row.location),
    createdAt: String(row.created_at),
  };
}

function requirementFromRow(row: Row): Requirement {
  return {
    id: String(row.id),
    projectId: String(row.project_id),
    ticketId: String(row.ticket_id),
    title: String(row.title),
    description: row.description == null ? null : String(row.description),
    sourceId: row.source_id == null ? null : String(row.source_id),
    sourceLocation: row.source_location == null ? null : String(row.source_location),
    lifecycleStatus: String(row.lifecycle_status) as Requirement['lifecycleStatus'],
    devStatus: String(row.dev_status) as Requirement['devStatus'],
    parentLabel: row.parent_label == null ? null : String(row.parent_label),
    parentId: row.parent_id == null ? null : String(row.parent_id),
    displayOrder: Number(row.display_order ?? 0),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function relationshipFromRow(row: Row): RequirementRelationship {
  return {
    id: String(row.id),
    fromRequirementId: String(row.from_requirement_id),
    toRequirementId: String(row.to_requirement_id),
    type: String(row.type) as RequirementRelationship['type'],
    createdAt: String(row.created_at),
  };
}

function impactFromRow(row: Row): Impact {
  return {
    id: String(row.id),
    requirementId: String(row.requirement_id),
    kind: String(row.kind) as Impact['kind'],
    value: String(row.value),
    createdAt: String(row.created_at),
  };
}

function scenarioFromRow(row: Row): Scenario {
  return {
    id: String(row.id),
    requirementId: String(row.requirement_id),
    text: String(row.text),
    reviewed: Boolean(row.reviewed),
    createdAt: String(row.created_at),
  };
}

function proposalFromRow(row: Row): Proposal {
  return {
    id: String(row.id),
    ticketId: String(row.ticket_id),
    kind: String(row.kind) as Proposal['kind'],
    status: String(row.status) as Proposal['status'],
    sourceId: row.source_id == null ? null : String(row.source_id),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function proposalVersionFromRow(row: Row): ProposalVersion {
  return {
    id: String(row.id),
    proposalId: String(row.proposal_id),
    version: Number(row.version),
    modelOutput: String(row.model_output),
    editedOutput: row.edited_output == null ? null : String(row.edited_output),
    reviewedAt: row.reviewed_at == null ? null : String(row.reviewed_at),
    createdAt: String(row.created_at),
  };
}

function auditFromRow(row: Row): CompletionAudit {
  return {
    id: String(row.id),
    requirementId: String(row.requirement_id),
    actorType: String(row.actor_type) as CompletionAudit['actorType'],
    actorId: row.actor_id == null ? null : String(row.actor_id),
    note: row.note == null ? null : String(row.note),
    action: String(row.action ?? 'check') as CompletionAudit['action'],
    checkedAt: String(row.checked_at),
  };
}

function sessionFromRow(row: Row): ChatSession {
  return {
    id: String(row.id),
    projectId: row.project_id == null ? null : String(row.project_id),
    ticketId: row.ticket_id == null ? null : String(row.ticket_id),
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

function messageFromRow(row: Row): ChatMessage {
  return {
    id: String(row.id),
    sessionId: String(row.session_id),
    role: String(row.role) as ChatMessage['role'],
    content: String(row.content),
    createdAt: String(row.created_at),
  };
}

function exportArtifactFromRow(row: Row): ExportArtifact {
  return {
    id: String(row.id),
    projectId: String(row.project_id),
    ticketId: row.ticket_id == null ? null : String(row.ticket_id),
    format: String(row.format),
    path: String(row.path),
    createdAt: String(row.created_at),
  };
}

export class SqliteProjectRepository implements ProjectRepository {
  private readonly db: Database.Database;
  constructor(db: Database.Database) {
    this.db = db;
  }

  async create(project: Project): Promise<Project> {
    this.db
      .prepare(
        'INSERT INTO projects (id, slug, name, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
      )
      .run(
        project.id,
        project.slug,
        project.name,
        project.description,
        project.createdAt,
        project.updatedAt,
      );
    return project;
  }

  async findBySlug(slug: string, includeArchived = false): Promise<Project | null> {
    const row = this.db
      .prepare(
        `SELECT * FROM projects WHERE slug = ? ${includeArchived ? '' : "AND lifecycle_status = 'active'"}`,
      )
      .get(slug) as Row | undefined;
    return row ? projectFromRow(row) : null;
  }

  async findById(id: string): Promise<Project | null> {
    const row = this.db.prepare('SELECT * FROM projects WHERE id = ?').get(id) as Row | undefined;
    return row ? projectFromRow(row) : null;
  }

  async list(includeArchived = false): Promise<Project[]> {
    const rows = this.db
      .prepare(
        `SELECT * FROM projects ${includeArchived ? '' : "WHERE lifecycle_status = 'active'"} ORDER BY created_at`,
      )
      .all() as Row[];
    return rows.map(projectFromRow);
  }

  async update(project: Project): Promise<Project> {
    this.db
      .prepare(
        'UPDATE projects SET slug = ?, name = ?, description = ?, updated_at = ? WHERE id = ?',
      )
      .run(project.slug, project.name, project.description, project.updatedAt, project.id);
    return project;
  }

  async archive(id: string): Promise<void> {
    const tx = this.db.transaction(() => {
      const now = new Date().toISOString();
      this.db
        .prepare("UPDATE projects SET lifecycle_status = 'archived', updated_at = ? WHERE id = ?")
        .run(now, id);
      this.db
        .prepare(
          "UPDATE subjects SET lifecycle_status = 'archived', updated_at = ? WHERE project_id = ?",
        )
        .run(now, id);
      this.db
        .prepare(
          "UPDATE requirements SET lifecycle_status = 'archived', updated_at = ? WHERE project_id = ? AND lifecycle_status = 'active'",
        )
        .run(now, id);
    });
    tx();
  }
  async permanentDelete(id: string, force: boolean): Promise<void> {
    if (!force) throw new Error('permanent project deletion requires force');
    const tx = this.db.transaction(() => {
      const ticketIds = (
        this.db.prepare('SELECT id FROM tickets WHERE project_id = ?').all(id) as Row[]
      ).map((row) => String(row.id));
      for (const ticketId of ticketIds) {
        const proposalIds = (
          this.db.prepare('SELECT id FROM proposals WHERE ticket_id = ?').all(ticketId) as Row[]
        ).map((row) => String(row.id));
        for (const proposalId of proposalIds)
          this.db.prepare('DELETE FROM proposal_versions WHERE proposal_id = ?').run(proposalId);
        this.db.prepare('DELETE FROM proposals WHERE ticket_id = ?').run(ticketId);
        const requirementIds = (
          this.db.prepare('SELECT id FROM requirements WHERE ticket_id = ?').all(ticketId) as Row[]
        ).map((row) => String(row.id));
        for (const requirementId of requirementIds) {
          this.db
            .prepare('DELETE FROM completion_audits WHERE requirement_id = ?')
            .run(requirementId);
          this.db.prepare('DELETE FROM impacts WHERE requirement_id = ?').run(requirementId);
          this.db.prepare('DELETE FROM scenarios WHERE requirement_id = ?').run(requirementId);
        }
        this.db
          .prepare(
            'DELETE FROM requirement_relationships WHERE from_requirement_id IN (SELECT id FROM requirements WHERE ticket_id = ?) OR to_requirement_id IN (SELECT id FROM requirements WHERE ticket_id = ?)',
          )
          .run(ticketId, ticketId);
        this.db.prepare('DELETE FROM requirements WHERE ticket_id = ?').run(ticketId);
        this.db.prepare('DELETE FROM sources WHERE ticket_id = ?').run(ticketId);
        this.db.prepare('DELETE FROM sessions WHERE ticket_id = ?').run(ticketId);
        this.db.prepare('DELETE FROM tickets WHERE id = ?').run(ticketId);
      }
      // Repository paths and subject assignments reference repositories and
      // must be removed before the repository rows while foreign keys are on.
      this.db
        .prepare(
          'DELETE FROM repository_paths WHERE repository_id IN (SELECT id FROM repositories WHERE project_id = ?)',
        )
        .run(id);
      this.db
        .prepare(
          'DELETE FROM subject_repositories WHERE subject_id IN (SELECT id FROM subjects WHERE project_id = ?)',
        )
        .run(id);
      this.db.prepare('DELETE FROM subjects WHERE project_id = ?').run(id);
      this.db.prepare('DELETE FROM repositories WHERE project_id = ?').run(id);
      // Chunks are owned by snapshots; remove them before snapshots.
      this.db
        .prepare(
          'DELETE FROM chunks WHERE snapshot_id IN (SELECT id FROM snapshots WHERE project_id = ?)',
        )
        .run(id);
      this.db.prepare('DELETE FROM snapshots WHERE project_id = ?').run(id);
      this.db.prepare('DELETE FROM export_artifacts WHERE project_id = ?').run(id);
      this.db.prepare('DELETE FROM projects WHERE id = ?').run(id);
    });
    tx();
  }
}

export class SqliteRepositoryRepository implements RepositoryRepository {
  private readonly db: Database.Database;
  constructor(db: Database.Database) {
    this.db = db;
  }

  async create(repository: Repository): Promise<Repository> {
    this.db
      .prepare(
        'INSERT INTO repositories (id, project_id, slug, service_name, url, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      )
      .run(
        repository.id,
        repository.projectId,
        repository.slug,
        repository.serviceName,
        repository.url,
        repository.createdAt,
        repository.updatedAt,
      );
    return repository;
  }

  async addPath(path: RepositoryPath): Promise<RepositoryPath> {
    this.db
      .prepare(
        'INSERT INTO repository_paths (id, repository_id, path, valid_from, valid_to) VALUES (?, ?, ?, ?, ?)',
      )
      .run(path.id, path.repositoryId, path.path, path.validFrom, path.validTo);
    return path;
  }

  async listByProject(projectId: string): Promise<Repository[]> {
    const rows = this.db
      .prepare('SELECT * FROM repositories WHERE project_id = ? ORDER BY created_at')
      .all(projectId) as Row[];
    return rows.map(repositoryFromRow);
  }

  async findById(id: string): Promise<Repository | null> {
    const row = this.db.prepare('SELECT * FROM repositories WHERE id = ?').get(id) as
      | Row
      | undefined;
    return row ? repositoryFromRow(row) : null;
  }

  async listGlobal(): Promise<Repository[]> {
    const rows = this.db.prepare('SELECT * FROM repositories ORDER BY created_at').all() as Row[];
    return rows.map(repositoryFromRow);
  }

  async remove(id: string): Promise<void> {
    // Clear dependent rows first so foreign_keys enforcement does not reject
    // the delete: many-to-many subject assignments, path history, and
    // snapshot references.
    this.db.prepare('DELETE FROM subject_repositories WHERE repository_id = ?').run(id);
    this.db.prepare('DELETE FROM repository_paths WHERE repository_id = ?').run(id);
    this.db.prepare('UPDATE snapshots SET repository_id = NULL WHERE repository_id = ?').run(id);
    this.db.prepare('DELETE FROM repositories WHERE id = ?').run(id);
  }

  async listBySubject(subjectId: string): Promise<Repository[]> {
    const rows = this.db
      .prepare(
        'SELECT r.* FROM repositories r JOIN subject_repositories sr ON sr.repository_id = r.id WHERE sr.subject_id = ? ORDER BY r.created_at',
      )
      .all(subjectId) as Row[];
    return rows.map(repositoryFromRow);
  }

  async attachToSubject(subjectId: string, repositoryId: string): Promise<void> {
    this.db
      .prepare(
        'INSERT INTO subject_repositories (subject_id, repository_id, created_at) VALUES (?, ?, ?)',
      )
      .run(subjectId, repositoryId, new Date().toISOString());
  }

  async detachFromSubject(subjectId: string, repositoryId: string): Promise<void> {
    this.db
      .prepare('DELETE FROM subject_repositories WHERE subject_id = ? AND repository_id = ?')
      .run(subjectId, repositoryId);
  }

  async findByProjectAndSlug(projectId: string, slug: string): Promise<Repository | null> {
    const row = this.db
      .prepare('SELECT * FROM repositories WHERE project_id = ? AND slug = ?')
      .get(projectId, slug) as Row | undefined;
    return row ? repositoryFromRow(row) : null;
  }

  async listPaths(repositoryId: string): Promise<RepositoryPath[]> {
    const rows = this.db
      .prepare('SELECT * FROM repository_paths WHERE repository_id = ? ORDER BY valid_from')
      .all(repositoryId) as Row[];
    return rows.map(repositoryPathFromRow);
  }
}

export class SqliteTicketRepository implements TicketRepository {
  private readonly db: Database.Database;
  constructor(db: Database.Database) {
    this.db = db;
  }

  async create(ticket: Ticket): Promise<Ticket> {
    this.db
      .prepare(
        'INSERT INTO tickets (id, project_id, key, title, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      )
      .run(
        ticket.id,
        ticket.projectId,
        ticket.key,
        ticket.title,
        ticket.description,
        ticket.createdAt,
        ticket.updatedAt,
      );
    return ticket;
  }

  async findByProjectAndKey(projectId: string, key: string): Promise<Ticket | null> {
    const row = this.db
      .prepare('SELECT * FROM tickets WHERE project_id = ? AND key = ?')
      .get(projectId, key) as Row | undefined;
    return row ? ticketFromRow(row) : null;
  }

  async findById(id: string): Promise<Ticket | null> {
    const row = this.db.prepare('SELECT * FROM tickets WHERE id = ?').get(id) as Row | undefined;
    return row ? ticketFromRow(row) : null;
  }

  async listByProject(projectId: string): Promise<Ticket[]> {
    const rows = this.db
      .prepare('SELECT * FROM tickets WHERE project_id = ? ORDER BY created_at')
      .all(projectId) as Row[];
    return rows.map(ticketFromRow);
  }

  async update(ticket: Ticket): Promise<Ticket> {
    this.db
      .prepare('UPDATE tickets SET title = ?, description = ?, updated_at = ? WHERE id = ?')
      .run(ticket.title, ticket.description, ticket.updatedAt, ticket.id);
    return ticket;
  }
}

export class SqliteSubjectRepository implements SubjectRepository {
  private readonly db: Database.Database;
  constructor(db: Database.Database) {
    this.db = db;
  }
  async create(subject: Subject): Promise<Subject> {
    this.db
      .prepare(
        'INSERT INTO subjects (id, project_id, name, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
      )
      .run(
        subject.id,
        subject.projectId,
        subject.name,
        subject.description,
        subject.createdAt,
        subject.updatedAt,
      );
    return subject;
  }
  async findById(id: string): Promise<Subject | null> {
    const row = this.db.prepare('SELECT * FROM subjects WHERE id = ?').get(id) as Row | undefined;
    return row ? subjectFromRow(row) : null;
  }
  async findByProjectAndName(projectId: string, name: string): Promise<Subject | null> {
    const row = this.db
      .prepare('SELECT * FROM subjects WHERE project_id = ? AND name = ?')
      .get(projectId, name) as Row | undefined;
    return row ? subjectFromRow(row) : null;
  }
  async listByProject(projectId: string, includeArchived = false): Promise<Subject[]> {
    return (
      this.db
        .prepare(
          `SELECT * FROM subjects WHERE project_id = ? ${includeArchived ? '' : "AND lifecycle_status = 'active'"} ORDER BY created_at`,
        )
        .all(projectId) as Row[]
    ).map(subjectFromRow);
  }
  async update(subject: Subject): Promise<Subject> {
    this.db
      .prepare('UPDATE subjects SET name = ?, description = ?, updated_at = ? WHERE id = ?')
      .run(subject.name, subject.description, subject.updatedAt, subject.id);
    return subject;
  }

  async archive(id: string): Promise<void> {
    this.db
      .prepare("UPDATE subjects SET lifecycle_status = 'archived', updated_at = ? WHERE id = ?")
      .run(new Date().toISOString(), id);
  }
  async permanentDelete(id: string, force: boolean): Promise<void> {
    if (!force) throw new Error('permanent subject deletion requires force');
    const tx = this.db.transaction(() => {
      this.db.prepare('DELETE FROM subject_repositories WHERE subject_id = ?').run(id);
      const requirementIds = (
        this.db.prepare('SELECT id FROM requirements WHERE ticket_id = ?').all(id) as Row[]
      ).map((row) => String(row.id));
      for (const requirementId of requirementIds) {
        this.db
          .prepare('DELETE FROM completion_audits WHERE requirement_id = ?')
          .run(requirementId);
        this.db.prepare('DELETE FROM impacts WHERE requirement_id = ?').run(requirementId);
        this.db.prepare('DELETE FROM scenarios WHERE requirement_id = ?').run(requirementId);
      }
      this.db
        .prepare(
          'DELETE FROM requirement_relationships WHERE from_requirement_id IN (SELECT id FROM requirements WHERE ticket_id = ?) OR to_requirement_id IN (SELECT id FROM requirements WHERE ticket_id = ?)',
        )
        .run(id, id);
      this.db.prepare('DELETE FROM requirements WHERE ticket_id = ?').run(id);
      const proposalIds = (
        this.db.prepare('SELECT id FROM proposals WHERE ticket_id = ?').all(id) as Row[]
      ).map((row) => String(row.id));
      for (const proposalId of proposalIds)
        this.db.prepare('DELETE FROM proposal_versions WHERE proposal_id = ?').run(proposalId);
      this.db.prepare('DELETE FROM proposals WHERE ticket_id = ?').run(id);
      this.db.prepare('DELETE FROM sources WHERE ticket_id = ?').run(id);
      this.db.prepare('DELETE FROM tickets WHERE id = ?').run(id);
      this.db.prepare('DELETE FROM subjects WHERE id = ?').run(id);
    });
    tx();
  }
}

export class SqliteSnapshotRepository implements SnapshotRepository {
  private readonly db: Database.Database;
  constructor(db: Database.Database) {
    this.db = db;
  }

  async create(snapshot: Snapshot): Promise<Snapshot> {
    this.db
      .prepare(
        'INSERT INTO snapshots (id, project_id, repository_id, rel_path, content_hash, content_kind, size, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      )
      .run(
        snapshot.id,
        snapshot.projectId,
        snapshot.repositoryId,
        snapshot.relPath,
        snapshot.contentHash,
        snapshot.contentKind,
        snapshot.size,
        snapshot.createdAt,
      );
    return snapshot;
  }

  async findById(id: string): Promise<Snapshot | null> {
    const row = this.db.prepare('SELECT * FROM snapshots WHERE id = ?').get(id) as Row | undefined;
    return row ? snapshotFromRow(row) : null;
  }

  async findByProjectAndHash(projectId: string, contentHash: string): Promise<Snapshot | null> {
    const row = this.db
      .prepare('SELECT * FROM snapshots WHERE project_id = ? AND content_hash = ?')
      .get(projectId, contentHash) as Row | undefined;
    return row ? snapshotFromRow(row) : null;
  }

  async listByProject(projectId: string): Promise<Snapshot[]> {
    const rows = this.db
      .prepare('SELECT * FROM snapshots WHERE project_id = ? ORDER BY created_at')
      .all(projectId) as Row[];
    return rows.map(snapshotFromRow);
  }

  async listByTicketSource(ticketId: string): Promise<Snapshot[]> {
    const rows = this.db
      .prepare(
        `SELECT s.* FROM snapshots s
         JOIN sources src ON src.snapshot_id = s.id
         WHERE src.ticket_id = ? ORDER BY s.created_at`,
      )
      .all(ticketId) as Row[];
    return rows.map(snapshotFromRow);
  }
}

export class SqliteSourceRepository implements SourceRepository {
  private readonly db: Database.Database;
  constructor(db: Database.Database) {
    this.db = db;
  }

  async create(source: Source): Promise<Source> {
    this.db
      .prepare(
        'INSERT INTO sources (id, ticket_id, type, attribution, source_event_at, ingested_at, snapshot_id, location, note) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      )
      .run(
        source.id,
        source.ticketId,
        source.type,
        source.attribution,
        source.sourceEventAt,
        source.ingestedAt,
        source.snapshotId,
        source.location,
        source.note,
      );
    return source;
  }

  async findById(id: string): Promise<Source | null> {
    const row = this.db.prepare('SELECT * FROM sources WHERE id = ?').get(id) as Row | undefined;
    return row ? sourceFromRow(row) : null;
  }

  async listByTicket(ticketId: string): Promise<Source[]> {
    const rows = this.db
      .prepare('SELECT * FROM sources WHERE ticket_id = ? ORDER BY ingested_at')
      .all(ticketId) as Row[];
    return rows.map(sourceFromRow);
  }
}

export class SqliteChunkRepository implements ChunkRepository {
  private readonly db: Database.Database;
  constructor(db: Database.Database) {
    this.db = db;
  }

  async insertMany(chunks: Chunk[]): Promise<void> {
    const insert = this.db.prepare(
      'INSERT INTO chunks (id, snapshot_id, chunk_index, content, location, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    );
    const tx = this.db.transaction((rows: Chunk[]) => {
      for (const chunk of rows) {
        insert.run(
          chunk.id,
          chunk.snapshotId,
          chunk.chunkIndex,
          chunk.content,
          chunk.location,
          chunk.createdAt,
        );
      }
    });
    tx(chunks);
  }

  async listBySnapshot(snapshotId: string): Promise<Chunk[]> {
    const rows = this.db
      .prepare('SELECT * FROM chunks WHERE snapshot_id = ? ORDER BY chunk_index')
      .all(snapshotId) as Row[];
    return rows.map(chunkFromRow);
  }
}

export class SqliteRequirementRepository implements RequirementRepository {
  private readonly db: Database.Database;
  constructor(db: Database.Database) {
    this.db = db;
  }

  async create(requirement: Requirement): Promise<Requirement> {
    this.db
      .prepare(
        `INSERT INTO requirements (id, project_id, ticket_id, title, description, source_id, source_location,
           lifecycle_status, dev_status, parent_label, parent_id, display_order, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        requirement.id,
        requirement.projectId,
        requirement.ticketId,
        requirement.title,
        requirement.description,
        requirement.sourceId,
        requirement.sourceLocation,
        requirement.lifecycleStatus,
        requirement.devStatus,
        requirement.parentLabel,
        requirement.parentId,
        requirement.displayOrder,
        requirement.createdAt,
        requirement.updatedAt,
      );
    return requirement;
  }

  async findById(id: string): Promise<Requirement | null> {
    const row = this.db.prepare('SELECT * FROM requirements WHERE id = ?').get(id) as
      | Row
      | undefined;
    return row ? requirementFromRow(row) : null;
  }

  async listByTicket(ticketId: string): Promise<Requirement[]> {
    const rows = this.db
      .prepare('SELECT * FROM requirements WHERE ticket_id = ? ORDER BY display_order, created_at')
      .all(ticketId) as Row[];
    return rows.map(requirementFromRow);
  }

  async listActiveByTicket(ticketId: string): Promise<Requirement[]> {
    const rows = this.db
      .prepare(
        "SELECT * FROM requirements WHERE ticket_id = ? AND lifecycle_status = 'active' ORDER BY display_order, created_at",
      )
      .all(ticketId) as Row[];
    return rows.map(requirementFromRow);
  }

  async listSupersededByTicket(ticketId: string): Promise<Requirement[]> {
    const rows = this.db
      .prepare(
        "SELECT * FROM requirements WHERE ticket_id = ? AND lifecycle_status = 'superseded' ORDER BY display_order, created_at",
      )
      .all(ticketId) as Row[];
    return rows.map(requirementFromRow);
  }

  async listArchivedByTicket(ticketId: string): Promise<Requirement[]> {
    const rows = this.db
      .prepare(
        "SELECT * FROM requirements WHERE ticket_id = ? AND lifecycle_status = 'archived' ORDER BY display_order, created_at",
      )
      .all(ticketId) as Row[];
    return rows.map(requirementFromRow);
  }

  async update(requirement: Requirement): Promise<Requirement> {
    this.db
      .prepare(
        `UPDATE requirements SET title = ?, description = ?, source_id = ?, source_location = ?,
           lifecycle_status = ?, dev_status = ?, parent_label = ?, display_order = ?, updated_at = ?
         WHERE id = ?`,
      )
      .run(
        requirement.title,
        requirement.description,
        requirement.sourceId,
        requirement.sourceLocation,
        requirement.lifecycleStatus,
        requirement.devStatus,
        requirement.parentLabel,
        requirement.displayOrder,
        requirement.updatedAt,
        requirement.id,
      );
    return requirement;
  }

  async archiveSubtree(id: string): Promise<void> {
    const tx = this.db.transaction((root: string) => {
      const ids = [root];
      for (let i = 0; i < ids.length; i += 1) {
        const rows = this.db
          .prepare(
            "SELECT id FROM requirements WHERE parent_id = ? AND lifecycle_status = 'active'",
          )
          .all(ids[i]) as Row[];
        ids.push(...rows.map((row) => String(row.id)));
      }
      const stmt = this.db.prepare(
        "UPDATE requirements SET lifecycle_status = 'archived', updated_at = ? WHERE id = ?",
      );
      const now = new Date().toISOString();
      for (const requirementId of ids) stmt.run(now, requirementId);
    });
    tx(id);
  }

  async addRelationship(relationship: RequirementRelationship): Promise<RequirementRelationship> {
    this.db
      .prepare(
        'INSERT INTO requirement_relationships (id, from_requirement_id, to_requirement_id, type, created_at) VALUES (?, ?, ?, ?, ?)',
      )
      .run(
        relationship.id,
        relationship.fromRequirementId,
        relationship.toRequirementId,
        relationship.type,
        relationship.createdAt,
      );
    return relationship;
  }

  async listRelationshipsByTicket(ticketId: string): Promise<RequirementRelationship[]> {
    const rows = this.db
      .prepare(
        `SELECT r.* FROM requirement_relationships r
         JOIN requirements a ON a.id = r.from_requirement_id
         JOIN requirements b ON b.id = r.to_requirement_id
         WHERE a.ticket_id = ? OR b.ticket_id = ?
         ORDER BY r.created_at`,
      )
      .all(ticketId, ticketId) as Row[];
    return rows.map(relationshipFromRow);
  }

  async addImpact(impact: Impact): Promise<Impact> {
    this.db
      .prepare(
        'INSERT INTO impacts (id, requirement_id, kind, value, created_at) VALUES (?, ?, ?, ?, ?)',
      )
      .run(impact.id, impact.requirementId, impact.kind, impact.value, impact.createdAt);
    return impact;
  }

  async listImpactsByTicket(ticketId: string): Promise<Impact[]> {
    const rows = this.db
      .prepare(
        `SELECT i.* FROM impacts i
         JOIN requirements r ON r.id = i.requirement_id
         WHERE r.ticket_id = ? ORDER BY i.created_at`,
      )
      .all(ticketId) as Row[];
    return rows.map(impactFromRow);
  }

  async addScenario(scenario: Scenario): Promise<Scenario> {
    this.db
      .prepare(
        'INSERT INTO scenarios (id, requirement_id, text, reviewed, created_at) VALUES (?, ?, ?, ?, ?)',
      )
      .run(
        scenario.id,
        scenario.requirementId,
        scenario.text,
        scenario.reviewed ? 1 : 0,
        scenario.createdAt,
      );
    return scenario;
  }

  async listScenariosByTicket(ticketId: string): Promise<Scenario[]> {
    const rows = this.db
      .prepare(
        `SELECT s.* FROM scenarios s
         JOIN requirements r ON r.id = s.requirement_id
         WHERE r.ticket_id = ? ORDER BY s.created_at`,
      )
      .all(ticketId) as Row[];
    return rows.map(scenarioFromRow);
  }
}

export class SqliteProposalRepository implements ProposalRepository {
  private readonly db: Database.Database;
  constructor(db: Database.Database) {
    this.db = db;
  }

  async create(proposal: Proposal): Promise<Proposal> {
    this.db
      .prepare(
        'INSERT INTO proposals (id, ticket_id, kind, status, source_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      )
      .run(
        proposal.id,
        proposal.ticketId,
        proposal.kind,
        proposal.status,
        proposal.sourceId,
        proposal.createdAt,
        proposal.updatedAt,
      );
    return proposal;
  }

  async findById(id: string): Promise<Proposal | null> {
    const row = this.db.prepare('SELECT * FROM proposals WHERE id = ?').get(id) as Row | undefined;
    return row ? proposalFromRow(row) : null;
  }

  async listByTicket(ticketId: string): Promise<Proposal[]> {
    const rows = this.db
      .prepare('SELECT * FROM proposals WHERE ticket_id = ? ORDER BY created_at')
      .all(ticketId) as Row[];
    return rows.map(proposalFromRow);
  }

  async listPendingByTicket(ticketId: string): Promise<Proposal[]> {
    const rows = this.db
      .prepare(
        "SELECT * FROM proposals WHERE ticket_id = ? AND status = 'pending' ORDER BY created_at",
      )
      .all(ticketId) as Row[];
    return rows.map(proposalFromRow);
  }

  async update(proposal: Proposal): Promise<Proposal> {
    this.db
      .prepare('UPDATE proposals SET status = ?, updated_at = ? WHERE id = ?')
      .run(proposal.status, proposal.updatedAt, proposal.id);
    return proposal;
  }

  async addVersion(version: ProposalVersion): Promise<ProposalVersion> {
    this.db
      .prepare(
        'INSERT INTO proposal_versions (id, proposal_id, version, model_output, edited_output, reviewed_at, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      )
      .run(
        version.id,
        version.proposalId,
        version.version,
        version.modelOutput,
        version.editedOutput,
        version.reviewedAt,
        version.createdAt,
      );
    return version;
  }

  async listVersions(proposalId: string): Promise<ProposalVersion[]> {
    const rows = this.db
      .prepare('SELECT * FROM proposal_versions WHERE proposal_id = ? ORDER BY version')
      .all(proposalId) as Row[];
    return rows.map(proposalVersionFromRow);
  }
}

export class SqliteCompletionAuditRepository implements CompletionAuditRepository {
  private readonly db: Database.Database;
  constructor(db: Database.Database) {
    this.db = db;
  }

  async create(audit: CompletionAudit): Promise<CompletionAudit> {
    this.db
      .prepare(
        'INSERT INTO completion_audits (id, requirement_id, actor_type, actor_id, note, action, checked_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      )
      .run(
        audit.id,
        audit.requirementId,
        audit.actorType,
        audit.actorId,
        audit.note,
        audit.action,
        audit.checkedAt,
      );
    return audit;
  }

  async listByRequirement(requirementId: string): Promise<CompletionAudit[]> {
    const rows = this.db
      .prepare('SELECT * FROM completion_audits WHERE requirement_id = ? ORDER BY checked_at')
      .all(requirementId) as Row[];
    return rows.map(auditFromRow);
  }
}

export class SqliteSessionRepository implements SessionRepository {
  private readonly db: Database.Database;
  constructor(db: Database.Database) {
    this.db = db;
  }

  async create(session: ChatSession): Promise<ChatSession> {
    this.db
      .prepare(
        'INSERT INTO sessions (id, project_id, ticket_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
      )
      .run(session.id, session.projectId, session.ticketId, session.createdAt, session.updatedAt);
    return session;
  }

  async findById(id: string): Promise<ChatSession | null> {
    const row = this.db.prepare('SELECT * FROM sessions WHERE id = ?').get(id) as Row | undefined;
    return row ? sessionFromRow(row) : null;
  }

  async listByTicket(ticketId: string): Promise<ChatSession[]> {
    const rows = this.db
      .prepare('SELECT * FROM sessions WHERE ticket_id = ? ORDER BY updated_at DESC')
      .all(ticketId) as Row[];
    return rows.map(sessionFromRow);
  }

  async update(session: ChatSession): Promise<ChatSession> {
    this.db
      .prepare('UPDATE sessions SET updated_at = ? WHERE id = ?')
      .run(session.updatedAt, session.id);
    return session;
  }

  async addMessage(message: ChatMessage): Promise<ChatMessage> {
    this.db
      .prepare(
        'INSERT INTO messages (id, session_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)',
      )
      .run(message.id, message.sessionId, message.role, message.content, message.createdAt);
    return message;
  }

  async listMessages(sessionId: string): Promise<ChatMessage[]> {
    const rows = this.db
      .prepare('SELECT * FROM messages WHERE session_id = ? ORDER BY created_at')
      .all(sessionId) as Row[];
    return rows.map(messageFromRow);
  }

  async recordError(error: ErrorRecord): Promise<ErrorRecord> {
    this.db
      .prepare(
        'INSERT INTO errors (id, session_id, proposal_id, message, stack, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      )
      .run(
        error.id,
        error.sessionId,
        error.proposalId,
        error.message,
        error.stack,
        error.createdAt,
      );
    return error;
  }
}

export class SqliteExportRepository implements ExportRepository {
  private readonly db: Database.Database;
  constructor(db: Database.Database) {
    this.db = db;
  }

  async create(artifact: ExportArtifact): Promise<ExportArtifact> {
    this.db
      .prepare(
        'INSERT INTO export_artifacts (id, project_id, ticket_id, format, path, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      )
      .run(
        artifact.id,
        artifact.projectId,
        artifact.ticketId,
        artifact.format,
        artifact.path,
        artifact.createdAt,
      );
    return artifact;
  }

  async listByProject(projectId: string): Promise<ExportArtifact[]> {
    const rows = this.db
      .prepare('SELECT * FROM export_artifacts WHERE project_id = ? ORDER BY created_at')
      .all(projectId) as Row[];
    return rows.map(exportArtifactFromRow);
  }
}

function runFromRow(row: Row): AgentRun {
  return {
    id: String(row.id),
    subjectId: String(row.subject_id),
    kind: String(row.kind) as AgentRun['kind'],
    metadata: String(row.metadata),
    createdAt: String(row.created_at),
  };
}
function findingFromRow(row: Row): ReviewFinding {
  return {
    id: String(row.id),
    subjectId: String(row.subject_id),
    kind: String(row.kind) as ReviewFinding['kind'],
    severity: String(row.severity) as ReviewFinding['severity'],
    confidence: Number(row.confidence),
    summary: String(row.summary),
    evidence: JSON.parse(String(row.evidence)) as string[],
    affectedRequirementId:
      row.affected_requirement_id == null ? null : String(row.affected_requirement_id),
    affectedRepositoryId:
      row.affected_repository_id == null ? null : String(row.affected_repository_id),
    suggestedAction: row.suggested_action == null ? null : String(row.suggested_action),
    status: String(row.status) as ReviewFinding['status'],
    runId: String(row.run_id),
    createdAt: String(row.created_at),
  };
}
function evidenceReferenceFromRow(row: Row): EvidenceReference {
  return {
    id: String(row.id),
    subjectId: String(row.subject_id),
    sourceId: row.source_id == null ? null : String(row.source_id),
    chunkId: row.chunk_id == null ? null : String(row.chunk_id),
    excerpt: String(row.excerpt),
    retrievalMetadata: String(row.retrieval_metadata),
    createdAt: String(row.created_at),
  };
}
export class SqliteAgentRepository implements AgentRepository {
  private readonly db: Database.Database;
  constructor(db: Database.Database) {
    this.db = db;
  }
  async createRun(run: AgentRun): Promise<AgentRun> {
    this.db
      .prepare(
        'INSERT INTO agent_runs (id, subject_id, kind, metadata, created_at) VALUES (?, ?, ?, ?, ?)',
      )
      .run(run.id, run.subjectId, run.kind, run.metadata, run.createdAt);
    return run;
  }
  async listRuns(subjectId: string): Promise<AgentRun[]> {
    return (
      this.db
        .prepare('SELECT * FROM agent_runs WHERE subject_id = ? ORDER BY created_at')
        .all(subjectId) as Row[]
    ).map(runFromRow);
  }
  async createFinding(finding: ReviewFinding): Promise<ReviewFinding> {
    this.db
      .prepare(
        'INSERT INTO review_findings (id, subject_id, kind, severity, confidence, summary, evidence, affected_requirement_id, affected_repository_id, suggested_action, status, run_id, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      )
      .run(
        finding.id,
        finding.subjectId,
        finding.kind,
        finding.severity,
        finding.confidence,
        finding.summary,
        JSON.stringify(finding.evidence),
        finding.affectedRequirementId,
        finding.affectedRepositoryId,
        finding.suggestedAction,
        finding.status,
        finding.runId,
        finding.createdAt,
      );
    return finding;
  }
  async listFindings(subjectId: string): Promise<ReviewFinding[]> {
    return (
      this.db
        .prepare('SELECT * FROM review_findings WHERE subject_id = ? ORDER BY created_at')
        .all(subjectId) as Row[]
    ).map(findingFromRow);
  }
  async updateFinding(finding: ReviewFinding): Promise<ReviewFinding> {
    this.db
      .prepare('UPDATE review_findings SET status = ? WHERE id = ?')
      .run(finding.status, finding.id);
    return finding;
  }
  async createEvidenceReference(reference: EvidenceReference): Promise<EvidenceReference> {
    this.db
      .prepare(
        'INSERT INTO evidence_references (id, subject_id, source_id, chunk_id, excerpt, retrieval_metadata, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
      )
      .run(
        reference.id,
        reference.subjectId,
        reference.sourceId,
        reference.chunkId,
        reference.excerpt,
        reference.retrievalMetadata,
        reference.createdAt,
      );
    return reference;
  }
  async listEvidenceReferences(subjectId: string): Promise<EvidenceReference[]> {
    return (
      this.db
        .prepare('SELECT * FROM evidence_references WHERE subject_id = ? ORDER BY created_at')
        .all(subjectId) as Row[]
    ).map(evidenceReferenceFromRow);
  }
}

function escapeFtsQuery(query: string): string {
  const words = query
    .split(/\s+/)
    .map((w) => w.replace(/["*]/g, ''))
    .filter((w) => w.length > 0);
  if (words.length === 0) {
    return '';
  }
  return words.map((w) => `"${w}"*`).join(' ');
}

export class SqliteSearchRepository implements SearchRepository {
  private readonly db: Database.Database;
  constructor(db: Database.Database) {
    this.db = db;
  }

  async search(query: string, projectId: string, limit = 10): Promise<SearchResult[]> {
    const match = escapeFtsQuery(query);
    if (match.length === 0) {
      return [];
    }
    const rows = this.db
      .prepare(
        `SELECT chunk_id, snapshot_id, project_id, content, location, rel_path, bm25(chunks_fts) AS score
         FROM chunks_fts
         WHERE chunks_fts MATCH ? AND project_id = ?
         ORDER BY score
         LIMIT ?`,
      )
      .all(match, projectId, limit) as Row[];
    return rows.map((row) => ({
      chunkId: String(row.chunk_id),
      snapshotId: String(row.snapshot_id),
      projectId: String(row.project_id),
      content: String(row.content),
      location: row.location == null ? null : String(row.location),
      relPath: row.rel_path == null ? null : String(row.rel_path),
      score: Number(row.score),
    }));
  }
}

export class SqliteUnitOfWork implements UnitOfWork {
  readonly projects: ProjectRepository;
  readonly repositories: RepositoryRepository;
  readonly tickets: TicketRepository;
  readonly subjects: SubjectRepository;
  readonly snapshots: SnapshotRepository;
  readonly sources: SourceRepository;
  readonly chunks: ChunkRepository;
  readonly requirements: RequirementRepository;
  readonly proposals: ProposalRepository;
  readonly completionAudits: CompletionAuditRepository;
  readonly sessions: SessionRepository;
  readonly exports: ExportRepository;
  readonly search: SearchRepository;
  readonly agents: AgentRepository;

  constructor(db: Database.Database) {
    this.projects = new SqliteProjectRepository(db);
    this.repositories = new SqliteRepositoryRepository(db);
    this.tickets = new SqliteTicketRepository(db);
    this.subjects = new SqliteSubjectRepository(db);
    this.snapshots = new SqliteSnapshotRepository(db);
    this.sources = new SqliteSourceRepository(db);
    this.chunks = new SqliteChunkRepository(db);
    this.requirements = new SqliteRequirementRepository(db);
    this.proposals = new SqliteProposalRepository(db);
    this.completionAudits = new SqliteCompletionAuditRepository(db);
    this.sessions = new SqliteSessionRepository(db);
    this.exports = new SqliteExportRepository(db);
    this.search = new SqliteSearchRepository(db);
    this.agents = new SqliteAgentRepository(db);
  }
}
