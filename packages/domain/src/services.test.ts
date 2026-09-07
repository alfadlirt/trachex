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
  Ticket,
} from './entities.ts';
import {
  approveProposal,
  buildExportSummary,
  type ChunkRepository,
  type CompletionAuditRepository,
  ConflictError,
  checkRequirement,
  createProject,
  createProposal,
  createTicket,
  type ExportRepository,
  editProposal,
  InvalidOperationError,
  type ProjectRepository,
  type ProposalRepository,
  type RepositoryRepository,
  type RequirementRepository,
  registerRepository,
  type SearchRepository,
  type SessionRepository,
  type SnapshotRepository,
  type SourceRepository,
  type TicketRepository,
  type UnitOfWork,
} from './index.ts';

class MemoryData {
  projects: Project[] = [];
  repositories: Repository[] = [];
  repositoryPaths: RepositoryPath[] = [];
  tickets: Ticket[] = [];
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

class MemoryUnitOfWork implements UnitOfWork {
  private readonly data = new MemoryData();

  readonly projects: ProjectRepository = {
    create: async (project) => {
      this.data.projects.push(project);
      return project;
    },
    findBySlug: async (slug) => this.data.projects.find((p) => p.slug === slug) ?? null,
    findById: async (id) => this.data.projects.find((p) => p.id === id) ?? null,
    list: async () => this.data.projects,
    update: async (project) => {
      const i = this.data.projects.findIndex((p) => p.id === project.id);
      if (i >= 0) this.data.projects[i] = project;
      return project;
    },
  };

  readonly repositories: RepositoryRepository = {
    create: async (repository) => {
      this.data.repositories.push(repository);
      return repository;
    },
    addPath: async (path) => {
      this.data.repositoryPaths.push(path);
      return path;
    },
    listByProject: async (projectId) =>
      this.data.repositories.filter((r) => r.projectId === projectId),
    findByProjectAndSlug: async (projectId, slug) =>
      this.data.repositories.find((r) => r.projectId === projectId && r.slug === slug) ?? null,
    listPaths: async (repositoryId) =>
      this.data.repositoryPaths.filter((p) => p.repositoryId === repositoryId),
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
    update: async (ticket) => {
      const i = this.data.tickets.findIndex((t) => t.id === ticket.id);
      if (i >= 0) this.data.tickets[i] = ticket;
      return ticket;
    },
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
      const snapshotIds = new Set(
        this.data.sources.filter((s) => s.ticketId === ticketId).map((s) => s.snapshotId),
      );
      return this.data.snapshots.filter((s) => snapshotIds.has(s.id));
    },
  };

  readonly sources: SourceRepository = {
    create: async (source) => {
      this.data.sources.push(source);
      return source;
    },
    findById: async (id) => this.data.sources.find((s) => s.id === id) ?? null,
    listByTicket: async (ticketId) => this.data.sources.filter((s) => s.ticketId === ticketId),
  };

  readonly chunks: ChunkRepository = {
    insertMany: async (chunks) => {
      this.data.chunks.push(...chunks);
    },
    listBySnapshot: async (snapshotId) =>
      this.data.chunks.filter((c) => c.snapshotId === snapshotId),
  };

  readonly requirements: RequirementRepository = {
    create: async (requirement) => {
      this.data.requirements.push(requirement);
      return requirement;
    },
    findById: async (id) => this.data.requirements.find((r) => r.id === id) ?? null,
    listByTicket: async (ticketId) => this.data.requirements.filter((r) => r.ticketId === ticketId),
    listActiveByTicket: async (ticketId) =>
      this.data.requirements.filter(
        (r) => r.ticketId === ticketId && r.lifecycleStatus === 'active',
      ),
    update: async (requirement) => {
      const i = this.data.requirements.findIndex((r) => r.id === requirement.id);
      if (i >= 0) this.data.requirements[i] = requirement;
      return requirement;
    },
    addRelationship: async (relationship) => {
      this.data.relationships.push(relationship);
      return relationship;
    },
    listRelationshipsByTicket: async (ticketId) => {
      const ids = new Set(
        this.data.requirements.filter((r) => r.ticketId === ticketId).map((r) => r.id),
      );
      return this.data.relationships.filter(
        (rel) => ids.has(rel.fromRequirementId) || ids.has(rel.toRequirementId),
      );
    },
    addImpact: async (impact) => {
      this.data.impacts.push(impact);
      return impact;
    },
    listImpactsByTicket: async (ticketId) => {
      const ids = new Set(
        this.data.requirements.filter((r) => r.ticketId === ticketId).map((r) => r.id),
      );
      return this.data.impacts.filter((i) => ids.has(i.requirementId));
    },
    addScenario: async (scenario) => {
      this.data.scenarios.push(scenario);
      return scenario;
    },
    listScenariosByTicket: async (ticketId) => {
      const ids = new Set(
        this.data.requirements.filter((r) => r.ticketId === ticketId).map((r) => r.id),
      );
      return this.data.scenarios.filter((s) => ids.has(s.requirementId));
    },
  };

  readonly proposals: ProposalRepository = {
    create: async (proposal) => {
      this.data.proposals.push(proposal);
      return proposal;
    },
    findById: async (id) => this.data.proposals.find((p) => p.id === id) ?? null,
    listByTicket: async (ticketId) => this.data.proposals.filter((p) => p.ticketId === ticketId),
    listPendingByTicket: async (ticketId) =>
      this.data.proposals.filter((p) => p.ticketId === ticketId && p.status === 'pending'),
    update: async (proposal) => {
      const i = this.data.proposals.findIndex((p) => p.id === proposal.id);
      if (i >= 0) this.data.proposals[i] = proposal;
      return proposal;
    },
    addVersion: async (version) => {
      this.data.proposalVersions.push(version);
      return version;
    },
    listVersions: async (proposalId) =>
      this.data.proposalVersions.filter((v) => v.proposalId === proposalId),
  };

  readonly completionAudits: CompletionAuditRepository = {
    create: async (audit) => {
      this.data.audits.push(audit);
      return audit;
    },
    listByRequirement: async (requirementId) =>
      this.data.audits.filter((a) => a.requirementId === requirementId),
  };

  readonly sessions: SessionRepository = {
    create: async (session) => {
      this.data.sessions.push(session);
      return session;
    },
    findById: async (id) => this.data.sessions.find((s) => s.id === id) ?? null,
    update: async (session) => {
      const i = this.data.sessions.findIndex((s) => s.id === session.id);
      if (i >= 0) this.data.sessions[i] = session;
      return session;
    },
    addMessage: async (message) => {
      this.data.messages.push(message);
      return message;
    },
    listMessages: async (sessionId) => this.data.messages.filter((m) => m.sessionId === sessionId),
    recordError: async (error) => {
      this.data.errors.push(error);
      return error;
    },
  };

  readonly exports: ExportRepository = {
    create: async (artifact) => {
      this.data.exports.push(artifact);
      return artifact;
    },
    listByProject: async (projectId) => this.data.exports.filter((e) => e.projectId === projectId),
  };

  readonly search: SearchRepository = {
    search: async () => [],
  };
}

async function seedProjectTicket(uow: UnitOfWork) {
  const project = await createProject(uow, { slug: 'loyalty', name: 'Loyalty' });
  await registerRepository(uow, {
    projectId: project.id,
    slug: 'front-office',
    path: '/repos/front-office',
  });
  await registerRepository(uow, {
    projectId: project.id,
    slug: 'config-service',
    path: '/repos/config-service',
  });
  const ticket = await createTicket(uow, {
    projectId: project.id,
    key: 'TICKET-1234',
    title: 'Loyalty program',
  });
  return { project, ticket };
}

test('project slug uniqueness is enforced', async () => {
  const uow = new MemoryUnitOfWork();
  await createProject(uow, { slug: 'loyalty', name: 'Loyalty' });
  await assert.rejects(
    () => createProject(uow, { slug: 'loyalty', name: 'Dup' }),
    (e: unknown) => e instanceof ConflictError,
  );
});

test('ticket key uniqueness is per-project', async () => {
  const uow = new MemoryUnitOfWork();
  const a = await createProject(uow, { slug: 'a', name: 'A' });
  const b = await createProject(uow, { slug: 'b', name: 'B' });
  await createTicket(uow, { projectId: a.id, key: 'K-1', title: 't' });
  await assert.rejects(
    () => createTicket(uow, { projectId: a.id, key: 'K-1', title: 't' }),
    (e: unknown) => e instanceof ConflictError,
  );
  await createTicket(uow, { projectId: b.id, key: 'K-1', title: 't' });
});

test('a project can contain multiple repositories', async () => {
  const uow = new MemoryUnitOfWork();
  const { project } = await seedProjectTicket(uow);
  const repos = await uow.repositories.listByProject(project.id);
  assert.equal(repos.length, 2);
});

test('extraction approval creates active unchecked requirements', async () => {
  const uow = new MemoryUnitOfWork();
  const { project, ticket } = await seedProjectTicket(uow);
  const proposal = await createProposal(uow, {
    ticketId: ticket.id,
    kind: 'extraction',
    output: {
      kind: 'extraction',
      requirements: [
        {
          title: 'Validate loyalty tier before applying discount',
          impacts: [{ kind: 'service', value: 'front-office-service' }],
          scenarios: ['VIP at cap'],
        },
      ],
    },
  });
  await approveProposal(uow, { proposalId: proposal.id });
  const reqs = await uow.requirements.listByTicket(ticket.id);
  assert.equal(reqs.length, 1);
  assert.equal(reqs[0]?.lifecycleStatus, 'active');
  assert.equal(reqs[0]?.devStatus, 'unchecked');
  assert.equal(reqs[0]?.projectId, project.id);
  const impacts = await uow.requirements.listImpactsByTicket(ticket.id);
  assert.equal(impacts.length, 1);
});

test('reconciliation approval supersedes the old requirement', async () => {
  const uow = new MemoryUnitOfWork();
  const { ticket } = await seedProjectTicket(uow);
  const p1 = await createProposal(uow, {
    ticketId: ticket.id,
    kind: 'extraction',
    output: { kind: 'extraction', requirements: [{ title: 'Discount cap 20%' }] },
  });
  await approveProposal(uow, { proposalId: p1.id });
  const oldReq = (await uow.requirements.listByTicket(ticket.id))[0];
  assert.ok(oldReq);

  const p2 = await createProposal(uow, {
    ticketId: ticket.id,
    kind: 'reconciliation',
    output: {
      kind: 'reconciliation',
      create: [
        {
          title: 'Discount cap 15%, VIP tier exempt',
          supersedes: [oldReq.id],
        },
      ],
    },
  });
  await approveProposal(uow, { proposalId: p2.id });

  const reqs = await uow.requirements.listByTicket(ticket.id);
  const active = reqs.filter((r) => r.lifecycleStatus === 'active');
  const superseded = reqs.filter((r) => r.lifecycleStatus === 'superseded');
  assert.equal(active.length, 1);
  assert.equal(active[0]?.title, 'Discount cap 15%, VIP tier exempt');
  assert.equal(superseded.length, 1);
  assert.equal(superseded[0]?.id, oldReq.id);
  const rels = await uow.requirements.listRelationshipsByTicket(ticket.id);
  assert.equal(rels.length, 1);
  assert.equal(rels[0]?.type, 'supersedes');
  assert.equal(rels[0]?.fromRequirementId, active[0]?.id);
  assert.equal(rels[0]?.toRequirementId, oldReq.id);
});

test('editing a proposal retains original model output and approval applies the edit', async () => {
  const uow = new MemoryUnitOfWork();
  const { ticket } = await seedProjectTicket(uow);
  const proposal = await createProposal(uow, {
    ticketId: ticket.id,
    kind: 'extraction',
    output: { kind: 'extraction', requirements: [{ title: 'Original title' }] },
  });
  const edited = await editProposal(uow, {
    proposalId: proposal.id,
    editedOutput: { kind: 'extraction', requirements: [{ title: 'Edited title' }] },
  });
  const versions = await uow.proposals.listVersions(proposal.id);
  assert.equal(versions.length, 2);
  const editedVersion = versions[1];
  assert.ok(editedVersion);
  assert.equal(editedVersion.modelOutput, versions[0]?.modelOutput);
  assert.ok(editedVersion.editedOutput?.includes('Edited title'));
  assert.equal(edited.id, editedVersion.id);

  await approveProposal(uow, { proposalId: proposal.id });
  const reqs = await uow.requirements.listByTicket(ticket.id);
  assert.equal(reqs.length, 1);
  assert.equal(reqs[0]?.title, 'Edited title');
});

test('approving a non-pending proposal is rejected', async () => {
  const uow = new MemoryUnitOfWork();
  const { ticket } = await seedProjectTicket(uow);
  const proposal = await createProposal(uow, {
    ticketId: ticket.id,
    kind: 'extraction',
    output: { kind: 'extraction', requirements: [{ title: 'R' }] },
  });
  await approveProposal(uow, { proposalId: proposal.id });
  await assert.rejects(
    () => approveProposal(uow, { proposalId: proposal.id }),
    (e: unknown) => e instanceof InvalidOperationError,
  );
});

test('checkRequirement records audit and flips dev status', async () => {
  const uow = new MemoryUnitOfWork();
  const { ticket } = await seedProjectTicket(uow);
  const proposal = await createProposal(uow, {
    ticketId: ticket.id,
    kind: 'extraction',
    output: { kind: 'extraction', requirements: [{ title: 'R' }] },
  });
  await approveProposal(uow, { proposalId: proposal.id });
  const req = (await uow.requirements.listByTicket(ticket.id))[0];
  assert.ok(req);

  const audit = await checkRequirement(uow, {
    requirementId: req.id,
    actorType: 'human',
    actorId: 'budi',
    note: 'done',
  });
  assert.equal(audit.actorType, 'human');
  const updated = await uow.requirements.findById(req.id);
  assert.equal(updated?.devStatus, 'checked');
  const audits = await uow.completionAudits.listByRequirement(req.id);
  assert.equal(audits.length, 1);
});

test('export summary includes checklist, impacts, scenarios, history, timeline', async () => {
  const uow = new MemoryUnitOfWork();
  const { project, ticket } = await seedProjectTicket(uow);
  const p1 = await createProposal(uow, {
    ticketId: ticket.id,
    kind: 'extraction',
    output: {
      kind: 'extraction',
      requirements: [
        {
          title: 'Discount cap 20%',
          impacts: [{ kind: 'service', value: 'config-service' }],
          scenarios: ['Non-VIP at cap'],
        },
      ],
    },
  });
  await approveProposal(uow, { proposalId: p1.id });
  const oldReq = (await uow.requirements.listByTicket(ticket.id))[0];
  assert.ok(oldReq);
  const p2 = await createProposal(uow, {
    ticketId: ticket.id,
    kind: 'reconciliation',
    output: {
      kind: 'reconciliation',
      create: [{ title: 'Discount cap 15%', supersedes: [oldReq.id] }],
    },
  });
  await approveProposal(uow, { proposalId: p2.id });
  const active = (await uow.requirements.listActiveByTicket(ticket.id))[0];
  assert.ok(active);
  await checkRequirement(uow, { requirementId: active.id, actorType: 'human' });

  const summary = await buildExportSummary(uow, {
    projectId: project.id,
    ticketKey: ticket.key,
  });
  assert.equal(summary.checklist.length, 1);
  assert.equal(summary.checklist[0]?.title, 'Discount cap 15%');
  assert.equal(summary.history.length, 1);
  assert.equal(summary.impacts.length, 1);
  assert.equal(summary.scenarios.length, 1);
  const kinds = summary.timeline.map((e) => e.kind);
  assert.ok(kinds.includes('proposal'));
  assert.ok(kinds.includes('approval'));
  assert.ok(kinds.includes('completion'));
});
