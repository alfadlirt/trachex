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
} from '@trachex/domain';
import {
  type ChunkRepository,
  type CompletionAuditRepository,
  createProject,
  createTicket,
  type ExportRepository,
  type ProjectRepository,
  type ProposalRepository,
  type RepositoryRepository,
  type RequirementRepository,
  type SearchRepository,
  type SessionRepository,
  type SnapshotRepository,
  type SourceRepository,
  type SubjectRepository,
  type TicketRepository,
  type UnitOfWork,
} from '@trachex/domain';
import type { RunAgentFn } from './factory.ts';
import { PipelineError, runExtraction, runReconciliation } from './pipeline.ts';

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

class MemoryUow implements UnitOfWork {
  readonly data = new MemoryData();

  readonly projects: ProjectRepository = {
    create: async (p) => {
      this.data.projects.push(p);
      return p;
    },
    findBySlug: async (slug) => this.data.projects.find((p) => p.slug === slug) ?? null,
    findById: async (id) => this.data.projects.find((p) => p.id === id) ?? null,
    list: async () => this.data.projects,
    update: async (p) => p,
  };
  readonly repositories: RepositoryRepository = {
    create: async (r) => r,
    addPath: async (p) => p,
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
  readonly tickets: TicketRepository = {
    create: async (t) => {
      this.data.tickets.push(t);
      return t;
    },
    findByProjectAndKey: async (projectId, key) =>
      this.data.tickets.find((t) => t.projectId === projectId && t.key === key) ?? null,
    findById: async (id) => this.data.tickets.find((t) => t.id === id) ?? null,
    listByProject: async () => [],
    update: async (t) => t,
  };
  readonly subjects: SubjectRepository = {
    create: async (s) => {
      this.data.subjects.push(s);
      return s;
    },
    findById: async (id) => this.data.subjects.find((s) => s.id === id) ?? null,
    findByProjectAndName: async (projectId, name) =>
      this.data.subjects.find((s) => s.projectId === projectId && s.name === name) ?? null,
    listByProject: async () => [],
    update: async (s) => s,
  };
  readonly snapshots: SnapshotRepository = {
    create: async (s) => {
      this.data.snapshots.push(s);
      return s;
    },
    findById: async (id) => this.data.snapshots.find((s) => s.id === id) ?? null,
    findByProjectAndHash: async (projectId, hash) =>
      this.data.snapshots.find((s) => s.projectId === projectId && s.contentHash === hash) ?? null,
    listByProject: async () => [],
    listByTicketSource: async () => [],
  };
  readonly chunks: ChunkRepository = {
    insertMany: async (chunks) => {
      this.data.chunks.push(...chunks);
    },
    listBySnapshot: async () => [],
  };
  readonly sources: SourceRepository = {
    create: async (s) => {
      this.data.sources.push(s);
      return s;
    },
    findById: async (id) => this.data.sources.find((s) => s.id === id) ?? null,
    listByTicket: async (ticketId) => this.data.sources.filter((s) => s.ticketId === ticketId),
  };
  readonly requirements: RequirementRepository = {
    create: async (r) => {
      this.data.requirements.push(r);
      return r;
    },
    findById: async (id) => this.data.requirements.find((r) => r.id === id) ?? null,
    listByTicket: async () => [],
    listActiveByTicket: async () => [],
    listSupersededByTicket: async () => [],
    update: async (r) => r,
    addRelationship: async (rel) => rel,
    listRelationshipsByTicket: async () => [],
    addImpact: async (i) => i,
    listImpactsByTicket: async () => [],
    addScenario: async (s) => s,
    listScenariosByTicket: async () => [],
  };
  readonly proposals: ProposalRepository = {
    create: async (p) => {
      this.data.proposals.push(p);
      return p;
    },
    findById: async (id) => this.data.proposals.find((p) => p.id === id) ?? null,
    listByTicket: async (ticketId) => this.data.proposals.filter((p) => p.ticketId === ticketId),
    listPendingByTicket: async (ticketId) =>
      this.data.proposals.filter((p) => p.ticketId === ticketId && p.status === 'pending'),
    update: async (p) => p,
    addVersion: async (v) => {
      this.data.proposalVersions.push(v);
      return v;
    },
    listVersions: async (proposalId) =>
      this.data.proposalVersions.filter((v) => v.proposalId === proposalId),
  };
  readonly completionAudits: CompletionAuditRepository = {
    create: async (a) => a,
    listByRequirement: async () => [],
  };
  readonly sessions: SessionRepository = {
    create: async (s) => s,
    findById: async () => null,
    update: async (s) => s,
    addMessage: async (m) => m,
    listMessages: async () => [],
    recordError: async (e) => {
      this.data.errors.push(e);
      return e;
    },
  };
  readonly exports: ExportRepository = {
    create: async (a) => a,
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

function baseInput(projectId: string, ticketId: string) {
  return {
    appDir: '/tmp/app',
    projectId,
    ticketId,
    type: 'fsd' as const,
    relPath: 'docs/fsd.md',
    contentKind: 'markdown',
    content: 'Discount cap is 15 percent for loyalty tier.',
  };
}

test('runExtraction ingests source and creates a pending extraction proposal', async () => {
  const uow = new MemoryUow();
  const { project, ticket } = await seed(uow);
  const runAgent: RunAgentFn = async () => ({
    kind: 'extraction',
    requirements: [{ title: 'Validate loyalty tier' }],
  });
  const result = await runExtraction(uow, { runAgent }, baseInput(project.id, ticket.id));
  assert.equal(result.source.type, 'fsd');
  assert.equal(uow.data.sources.length, 1);
  const proposals = await uow.proposals.listByTicket(ticket.id);
  assert.equal(proposals.length, 1);
  assert.equal(proposals[0]?.kind, 'extraction');
  assert.equal(proposals[0]?.status, 'pending');
  const firstProposal = proposals[0];
  assert.ok(firstProposal);
  const versions = await uow.proposals.listVersions(firstProposal.id);
  assert.equal(versions.length, 1);
  assert.equal(uow.data.requirements.length, 0);
});

test('runReconciliation ingests source and creates a pending reconciliation proposal', async () => {
  const uow = new MemoryUow();
  const { project, ticket } = await seed(uow);
  const runAgent: RunAgentFn = async () => ({
    kind: 'reconciliation',
    create: [{ title: 'Discount cap 15%', supersedes: ['item-001'] }],
  });
  const result = await runReconciliation(uow, { runAgent }, baseInput(project.id, ticket.id));
  assert.equal(result.source.type, 'fsd');
  const proposals = await uow.proposals.listByTicket(ticket.id);
  assert.equal(proposals.length, 1);
  assert.equal(proposals[0]?.kind, 'reconciliation');
  assert.equal(proposals[0]?.status, 'pending');
  assert.equal(uow.data.requirements.length, 0);
});

test('malformed agent output is recorded as an error and does not corrupt the ticket', async () => {
  const uow = new MemoryUow();
  const { project, ticket } = await seed(uow);
  const runAgent: RunAgentFn = async () => {
    throw new Error('malformed model output');
  };
  await assert.rejects(
    () => runExtraction(uow, { runAgent }, baseInput(project.id, ticket.id)),
    (e: unknown) =>
      e instanceof PipelineError && e.message === 'extraction failed: malformed model output',
  );
  assert.equal(uow.data.errors.length, 1);
  assert.equal(uow.data.errors[0]?.message, 'malformed model output');
  assert.equal(uow.data.proposals.length, 0);
  assert.equal(uow.data.requirements.length, 0);
  const sources = await uow.sources.listByTicket(ticket.id);
  assert.equal(sources.length, 1, 'source survives the failed extraction');
});

test('agent output is never applied directly (no requirements created by pipeline)', async () => {
  const uow = new MemoryUow();
  const { project, ticket } = await seed(uow);
  const runAgent: RunAgentFn = async () => ({
    kind: 'extraction',
    requirements: [{ title: 'Should stay a proposal' }],
  });
  await runExtraction(uow, { runAgent }, baseInput(project.id, ticket.id));
  assert.equal(uow.data.requirements.length, 0);
  assert.equal(uow.data.proposals.length, 1);
  assert.equal(uow.data.proposals[0]?.status, 'pending');
});

test('normalizes duplicate impacts and drops unsupported API/page impacts', async () => {
  const uow = new MemoryUow();
  const { project, ticket } = await seed(uow);
  const runAgent: RunAgentFn = async () => ({
    kind: 'extraction',
    requirements: [
      {
        title: 'Trial conversion',
        impacts: [
          { kind: 'service', value: 'downstream billing' },
          { kind: 'service', value: 'Downstream Billing' },
          { kind: 'api', value: 'POST /subscriptions' },
          { kind: 'api', value: 'POST /subscriptions' },
          { kind: 'page', value: '/checkout' },
          { kind: 'page', value: 'confirmation page' },
        ],
      },
    ],
  });
  const result = await runExtraction(
    uow,
    { runAgent },
    {
      ...baseInput(project.id, ticket.id),
      content: 'The checkout flow sends POST /subscriptions and shows the confirmation page.',
    },
  );
  const versions = await uow.proposals.listVersions(result.proposal.id);
  const output = JSON.parse(versions[0]?.modelOutput ?? '{}') as {
    requirements?: Array<{ impacts?: Array<{ kind: string; value: string }> }>;
  };
  assert.deepEqual(output.requirements?.[0]?.impacts, [
    { kind: 'service', value: 'downstream billing' },
    { kind: 'api', value: 'POST /subscriptions' },
    { kind: 'page', value: 'confirmation page' },
  ]);
});
