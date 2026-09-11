import assert from 'node:assert/strict';
import { test } from 'node:test';
import type {
  ChatMessage,
  ChatSession,
  Chunk,
  CompletionAudit,
  ErrorRecord,
  ExportArtifact,
  Impact,
  Project,
  Proposal,
  ProposalVersion,
  Repository,
  RepositoryPath,
  Requirement,
  RequirementRelationship,
  Scenario,
  Snapshot,
  Source,
  Subject,
  Ticket,
} from './entities.ts';
import {
  type ChunkRepository,
  type CompletionAuditRepository,
  createProject,
  createTicket,
  type ExportRepository,
  ingestSource,
  NotFoundError,
  type ProjectRepository,
  type ProposalRepository,
  type RepositoryRepository,
  type RequirementRepository,
  ScopingError,
  type SearchRepository,
  type SessionRepository,
  type SnapshotRepository,
  type SourceRepository,
  type SubjectRepository,
  type TicketRepository,
  type UnitOfWork,
} from './index.ts';

class MemoryData {
  projects: Project[] = [];
  repositories: Repository[] = [];
  repositoryPaths: RepositoryPath[] = [];
  tickets: Ticket[] = [];
  subjects: Subject[] = [];
  snapshots: Snapshot[] = [];
  sources: Source[] = [];
  chunks: Chunk[] = [];
  requirements: Requirement[] = [];
  relationships: RequirementRelationship[] = [];
  impacts: Impact[] = [];
  scenarios: Scenario[] = [];
  proposals: Proposal[] = [];
  proposalVersions: ProposalVersion[] = [];
  audits: CompletionAudit[] = [];
  sessions: ChatSession[] = [];
  messages: ChatMessage[] = [];
  exports: ExportArtifact[] = [];
  errors: ErrorRecord[] = [];
}

class MemoryIngestUow implements UnitOfWork {
  readonly data = new MemoryData();

  readonly projects: ProjectRepository = {
    create: async (project) => {
      this.data.projects.push(project);
      return project;
    },
    findBySlug: async (slug) => this.data.projects.find((p) => p.slug === slug) ?? null,
    findById: async (id) => this.data.projects.find((p) => p.id === id) ?? null,
    list: async () => this.data.projects,
    update: async (project) => project,
  };

  readonly tickets: TicketRepository = {
    create: async (ticket) => {
      this.data.tickets.push(ticket);
      return ticket;
    },
    findByProjectAndKey: async (projectId, key) =>
      this.data.tickets.find((t) => t.projectId === projectId && t.key === key) ?? null,
    findById: async (id) => this.data.tickets.find((t) => t.id === id) ?? null,
    listByProject: async (projectId) => this.data.tickets.filter((t) => t.projectId === projectId),
    update: async (ticket) => ticket,
  };

  readonly subjects: SubjectRepository = {
    create: async (subject) => {
      this.data.subjects.push(subject);
      return subject;
    },
    findById: async (id) => this.data.subjects.find((s) => s.id === id) ?? null,
    findByProjectAndName: async (projectId, name) =>
      this.data.subjects.find((s) => s.projectId === projectId && s.name === name) ?? null,
    listByProject: async (projectId) => this.data.subjects.filter((s) => s.projectId === projectId),
    update: async (subject) => subject,
  };

  readonly snapshots: SnapshotRepository = {
    create: async (snapshot) => {
      this.data.snapshots.push(snapshot);
      return snapshot;
    },
    findById: async (id) => this.data.snapshots.find((s) => s.id === id) ?? null,
    findByProjectAndHash: async (projectId, contentHash) =>
      this.data.snapshots.find((s) => s.projectId === projectId && s.contentHash === contentHash) ??
      null,
    listByProject: async (projectId) =>
      this.data.snapshots.filter((s) => s.projectId === projectId),
    listByTicketSource: async (ticketId) => {
      const ids = new Set(
        this.data.sources.filter((s) => s.ticketId === ticketId).map((s) => s.snapshotId),
      );
      return this.data.snapshots.filter((s) => ids.has(s.id));
    },
  };

  readonly chunks: ChunkRepository = {
    insertMany: async (chunks) => {
      this.data.chunks.push(...chunks);
    },
    listBySnapshot: async (snapshotId) =>
      this.data.chunks.filter((c) => c.snapshotId === snapshotId),
  };

  readonly sources: SourceRepository = {
    create: async (source) => {
      this.data.sources.push(source);
      return source;
    },
    findById: async (id) => this.data.sources.find((s) => s.id === id) ?? null,
    listByTicket: async (ticketId) => this.data.sources.filter((s) => s.ticketId === ticketId),
  };

  readonly repositories: RepositoryRepository = {
    create: async (repository) => repository,
    addPath: async (path) => path,
    findById: async () => null,
    listGlobal: async () => [],
    listByProject: async () => [],
    findByProjectAndSlug: async () => null,
    listPaths: async () => [],
    remove: async () => undefined,
    listBySubject: async () => [],
    attachToSubject: async () => undefined,
    detachFromSubject: async () => undefined,
  };

  readonly requirements: RequirementRepository = {
    create: async (requirement) => requirement,
    findById: async () => null,
    listByTicket: async () => [],
    listActiveByTicket: async () => [],
    listSupersededByTicket: async () => [],
    update: async (requirement) => requirement,
    addRelationship: async (relationship) => relationship,
    listRelationshipsByTicket: async () => [],
    addImpact: async (impact) => impact,
    listImpactsByTicket: async () => [],
    addScenario: async (scenario) => scenario,
    listScenariosByTicket: async () => [],
  };

  readonly proposals: ProposalRepository = {
    create: async (proposal) => proposal,
    findById: async () => null,
    listByTicket: async () => [],
    listPendingByTicket: async () => [],
    update: async (proposal) => proposal,
    addVersion: async (version) => version,
    listVersions: async () => [],
  };

  readonly completionAudits: CompletionAuditRepository = {
    create: async (audit) => audit,
    listByRequirement: async () => [],
  };

  readonly sessions: SessionRepository = {
    create: async (session) => session,
    findById: async () => null,
    update: async (session) => session,
    addMessage: async (message) => message,
    listMessages: async () => [],
    recordError: async (error) => error,
  };

  readonly exports: ExportRepository = {
    create: async (artifact) => artifact,
    listByProject: async () => [],
  };

  readonly search: SearchRepository = {
    search: async () => [],
  };
}

async function seed(uow: UnitOfWork) {
  const project = await createProject(uow, { slug: 'loyalty', name: 'Loyalty' });
  const ticket = await createTicket(uow, {
    projectId: project.id,
    key: 'T-1',
    title: 'Loyalty',
  });
  return { project, ticket };
}

test('ingestSource raises NotFoundError for a missing ticket', async () => {
  const uow = new MemoryIngestUow();
  await assert.rejects(
    () =>
      ingestSource(uow, {
        projectId: 'p1',
        ticketId: 'missing',
        type: 'fsd',
        relPath: 'x.md',
        contentKind: 'markdown',
        content: 'hello',
        writeSnapshotFile: async () => {},
      }),
    (e: unknown) => e instanceof NotFoundError,
  );
});

test('ingestSource raises ScopingError when the ticket is in another project', async () => {
  const uow = new MemoryIngestUow();
  const { ticket } = await seed(uow);
  await assert.rejects(
    () =>
      ingestSource(uow, {
        projectId: 'other-project',
        ticketId: ticket.id,
        type: 'fsd',
        relPath: 'x.md',
        contentKind: 'markdown',
        content: 'hello',
        writeSnapshotFile: async () => {},
      }),
    (e: unknown) => e instanceof ScopingError,
  );
});

test('ingestSource writes snapshot, chunks content, and returns reusedSnapshot=false', async () => {
  const uow = new MemoryIngestUow();
  const { project, ticket } = await seed(uow);
  let written = '';
  const result = await ingestSource(uow, {
    projectId: project.id,
    ticketId: ticket.id,
    type: 'fsd',
    attribution: 'FSD v1.2',
    relPath: 'docs/fsd.md',
    contentKind: 'markdown',
    content: 'Discount cap is 15 percent for loyalty tier.',
    writeSnapshotFile: async (_snapshotId, content) => {
      written = content;
    },
  });
  assert.equal(result.reusedSnapshot, false);
  assert.equal(written, 'Discount cap is 15 percent for loyalty tier.');
  assert.equal(result.snapshot.contentHash.length, 64);
  assert.ok(result.chunkCount >= 1);
  assert.equal(uow.data.chunks.length, result.chunkCount);
  assert.equal(result.source.type, 'fsd');
  assert.equal(result.source.attribution, 'FSD v1.2');
  assert.equal(uow.data.snapshots.length, 1);
});

test('ingestSource reuses an existing snapshot with the same hash (dedup)', async () => {
  const uow = new MemoryIngestUow();
  const { project, ticket } = await seed(uow);
  const content = 'identical content';
  const first = await ingestSource(uow, {
    projectId: project.id,
    ticketId: ticket.id,
    type: 'chat',
    relPath: 'note',
    contentKind: 'text',
    content,
    writeSnapshotFile: async () => {},
  });
  const second = await ingestSource(uow, {
    projectId: project.id,
    ticketId: ticket.id,
    type: 'chat',
    relPath: 'note',
    contentKind: 'text',
    content,
    writeSnapshotFile: async () => {},
  });
  assert.equal(second.reusedSnapshot, true);
  assert.equal(second.snapshot.id, first.snapshot.id);
  assert.equal(uow.data.snapshots.length, 1);
  assert.equal(uow.data.chunks.length, first.chunkCount);
  assert.equal(uow.data.sources.length, 2);
});
