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
  approveProposal,
  buildChecklistView,
  buildExportSummary,
  buildProjectStatus,
  type ChunkRepository,
  type CompletionAuditRepository,
  ConflictError,
  checkRequirement,
  createProject,
  createProposal,
  createTicket,
  deleteProject,
  deleteSubjectByTicket,
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
  type SubjectRepository,
  type TicketRepository,
  type UnitOfWork,
  updateProject,
  updateTicket,
  validateProposedOrder,
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
    findById: async (id) => this.data.repositories.find((r) => r.id === id) ?? null,
    listGlobal: async () => this.data.repositories,
    listByProject: async (projectId) =>
      this.data.repositories.filter((r) => r.projectId === projectId),
    findByProjectAndSlug: async (projectId, slug) =>
      this.data.repositories.find((r) => r.projectId === projectId && r.slug === slug) ?? null,
    listPaths: async (repositoryId) =>
      this.data.repositoryPaths.filter((p) => p.repositoryId === repositoryId),
    remove: async (id) => {
      this.data.repositories = this.data.repositories.filter((r) => r.id !== id);
    },
    listBySubject: async (subjectId) =>
      this.data.repositories.filter((r) => r.projectId === subjectId),
    attachToSubject: async (subjectId, repositoryId) => {
      const repo = this.data.repositories.find((r) => r.id === repositoryId);
      if (repo) repo.projectId = subjectId;
    },
    detachFromSubject: async (subjectId, repositoryId) => {
      const repo = this.data.repositories.find((r) => r.id === repositoryId);
      if (repo && repo.projectId === subjectId) repo.projectId = null;
    },
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
    permanentDelete: async (id) => {
      this.data.tickets = this.data.tickets.filter((t) => t.id !== id);
    },
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
    update: async (subject) => {
      const i = this.data.subjects.findIndex((s) => s.id === subject.id);
      if (i >= 0) this.data.subjects[i] = subject;
      return subject;
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
    listByTicket: async (ticketId) =>
      this.data.requirements
        .filter((r) => r.ticketId === ticketId)
        .sort((a, b) => a.displayOrder - b.displayOrder || a.createdAt.localeCompare(b.createdAt)),
    listActiveByTicket: async (ticketId) =>
      this.data.requirements
        .filter((r) => r.ticketId === ticketId && r.lifecycleStatus === 'active')
        .sort((a, b) => a.displayOrder - b.displayOrder || a.createdAt.localeCompare(b.createdAt)),
    listSupersededByTicket: async (ticketId) =>
      this.data.requirements
        .filter((r) => r.ticketId === ticketId && r.lifecycleStatus === 'superseded')
        .sort((a, b) => a.displayOrder - b.displayOrder || a.createdAt.localeCompare(b.createdAt)),
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

test('updateProject renames name and slug', async () => {
  const uow = new MemoryUnitOfWork();
  const { project } = await seedProjectTicket(uow);
  const updated = await updateProject(uow, {
    projectId: project.id,
    name: 'Loyalty Program',
    slug: 'loyalty-program',
  });
  assert.equal(updated.name, 'Loyalty Program');
  assert.equal(updated.slug, 'loyalty-program');
  await assert.rejects(
    () => updateProject(uow, { projectId: project.id, name: '  ' }),
    (e: unknown) => e instanceof InvalidOperationError,
  );
});

test('deleteProject requires the exact project name', async () => {
  const uow = new MemoryUnitOfWork();
  const { project } = await seedProjectTicket(uow);
  await assert.rejects(
    () => deleteProject(uow, { projectId: project.id, confirmName: 'Wrong name' }),
    (e: unknown) => e instanceof InvalidOperationError,
  );
  await assert.rejects(
    () => deleteProject(uow, { projectId: project.id, confirmName: 'Loyalty' }),
    (e: unknown) => e instanceof InvalidOperationError,
  );
});

test('updateTicket renames title and key', async () => {
  const uow = new MemoryUnitOfWork();
  const { ticket } = await seedProjectTicket(uow);
  const updated = await updateTicket(uow, {
    ticketId: ticket.id,
    title: 'Loyalty subject',
    key: 'LOYALTY-EDITED',
  });
  assert.equal(updated.title, 'Loyalty subject');
  assert.equal(updated.key, 'LOYALTY-EDITED');
});

test('deleteSubjectByTicket requires the exact subject title', async () => {
  const uow = new MemoryUnitOfWork();
  const { ticket } = await seedProjectTicket(uow);
  await assert.rejects(
    () => deleteSubjectByTicket(uow, { ticketId: ticket.id, confirmName: 'Wrong name' }),
    (e: unknown) => e instanceof InvalidOperationError,
  );
  await deleteSubjectByTicket(uow, { ticketId: ticket.id, confirmName: ticket.title });
  assert.equal(await uow.tickets.findById(ticket.id), null);
});

test('proposal order requires dependency rationale and unique ids', () => {
  validateProposedOrder({
    orderedIds: ['a', 'b'],
    rationale: 'Foundations before dependents.',
  });
  assert.throws(() => validateProposedOrder({ orderedIds: ['a', 'a'], rationale: 'x' }));
  assert.throws(() => validateProposedOrder({ orderedIds: ['a'], rationale: '  ' }));
});

test('approval applies the agent proposed order before appending new rows', async () => {
  const uow = new MemoryUnitOfWork();
  const { ticket } = await seedProjectTicket(uow);
  const seed = await createProposal(uow, {
    ticketId: ticket.id,
    kind: 'extraction',
    output: {
      kind: 'extraction',
      requirements: [{ title: 'Foundation check' }, { title: 'Dependent cap' }],
    },
  });
  await approveProposal(uow, { proposalId: seed.id });
  const before = await uow.requirements.listActiveByTicket(ticket.id);
  assert.equal(before.length, 2);
  const foundation = before.find((item) => item.title === 'Foundation check');
  const dependent = before.find((item) => item.title === 'Dependent cap');
  assert.ok(foundation);
  assert.ok(dependent);

  const proposal = await createProposal(uow, {
    ticketId: ticket.id,
    kind: 'reconciliation',
    output: {
      kind: 'reconciliation',
      create: [{ title: 'Receipt evidence note' }],
      proposedOrder: {
        orderedIds: [dependent.id, foundation.id],
        rationale: 'The cap decision depends on the foundation check.',
      },
    },
  });
  await approveProposal(uow, { proposalId: proposal.id });
  const active = await uow.requirements.listActiveByTicket(ticket.id);
  const titles = active.map((item) => item.title);
  assert.deepEqual(titles, ['Dependent cap', 'Foundation check', 'Receipt evidence note']);
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

test('buildProjectStatus rolls up per-ticket and project totals', async () => {
  const uow = new MemoryUnitOfWork();
  const { project, ticket } = await seedProjectTicket(uow);
  const proposal = await createProposal(uow, {
    ticketId: ticket.id,
    kind: 'extraction',
    output: { kind: 'extraction', requirements: [{ title: 'R1' }, { title: 'R2' }] },
  });
  await approveProposal(uow, { proposalId: proposal.id });
  const reqs = await uow.requirements.listByTicket(ticket.id);
  const firstReq = reqs[0];
  assert.ok(firstReq, 'a requirement exists');
  await checkRequirement(uow, { requirementId: firstReq.id, actorType: 'human' });

  const status = await buildProjectStatus(uow, project.id);
  assert.equal(status.totals.tickets, 1);
  assert.equal(status.totals.active, 2);
  assert.equal(status.totals.checked, 1);
  assert.equal(status.totals.remaining, 1);
  assert.equal(status.tickets[0]?.checked, 1);
  assert.equal(status.tickets[0]?.remaining, 1);
  assert.ok(status.updatedAt.length > 0);
});

test('buildChecklistView groups active items and lists superseded struck-through candidates', async () => {
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
          parentLabel: 'Discounting',
          impacts: [{ kind: 'service', value: 'config-service' }],
          scenarios: ['Non-VIP at cap'],
        },
      ],
    },
  });
  await approveProposal(uow, { proposalId: p1.id });
  const oldReq = (await uow.requirements.listByTicket(ticket.id))[0];
  assert.ok(oldReq, 'original requirement exists');
  const p2 = await createProposal(uow, {
    ticketId: ticket.id,
    kind: 'reconciliation',
    output: {
      kind: 'reconciliation',
      create: [
        {
          title: 'Discount cap 15%, VIP exempt',
          parentLabel: 'Discounting',
          supersedes: [oldReq.id],
        },
      ],
    },
  });
  await approveProposal(uow, { proposalId: p2.id });

  const view = await buildChecklistView(uow, { projectId: project.id, ticketKey: ticket.key });
  assert.equal(view.groups.length, 1);
  assert.equal(view.groups[0]?.label, 'Discounting');
  assert.equal(view.groups[0]?.items.length, 1);
  assert.equal(view.groups[0]?.items[0]?.title, 'Discount cap 15%, VIP exempt');
  assert.equal(view.groups[0]?.items[0]?.impacts.length, 0);
  assert.equal(view.superseded.length, 1);
  assert.equal(view.superseded[0]?.item.title, 'Discount cap 20%');
  assert.equal(view.superseded[0]?.supersededByTitle, 'Discount cap 15%, VIP exempt');
});

test('addRequirementManual creates a manual source and appends at the end', async () => {
  const uow = new MemoryUnitOfWork();
  const { project, ticket } = await seedProjectTicket(uow);
  const { addRequirementManual } = await import('./edits.ts');
  const r1 = await addRequirementManual(uow, {
    ticketId: ticket.id,
    title: 'Manual item',
    parentLabel: 'Ops',
    actorType: 'human',
    actorId: 'budi',
  });
  const r2 = await addRequirementManual(uow, {
    ticketId: ticket.id,
    title: 'Second',
    actorType: 'human',
    actorId: 'budi',
  });
  assert.equal(r1.displayOrder, 0);
  assert.equal(r2.displayOrder, 1);
  const sources = await uow.sources.listByTicket(ticket.id);
  const manual = sources.find((s) => s.id === r1.sourceId);
  assert.equal(manual?.type, 'manual');
  assert.equal(manual?.attribution, 'budi');
  assert.equal(r1.projectId, project.id);
});

test('editRequirementContent supersedes old and places new at same position', async () => {
  const uow = new MemoryUnitOfWork();
  const { ticket } = await seedProjectTicket(uow);
  const { addRequirementManual, editRequirementContent } = await import('./edits.ts');
  const a = await addRequirementManual(uow, {
    ticketId: ticket.id,
    title: 'A',
    actorType: 'human',
  });
  await addRequirementManual(uow, { ticketId: ticket.id, title: 'B', actorType: 'human' });

  const edited = await editRequirementContent(uow, {
    ticketId: ticket.id,
    requirementId: a.id,
    title: 'A revised',
    actorType: 'human',
    actorId: 'budi',
  });
  assert.equal(edited.displayOrder, a.displayOrder);
  const active = await uow.requirements.listActiveByTicket(ticket.id);
  assert.deepEqual(
    active.map((r) => r.title),
    ['A revised', 'B'],
  );
  const old = await uow.requirements.findById(a.id);
  assert.equal(old?.lifecycleStatus, 'superseded');
  const rels = await uow.requirements.listRelationshipsByTicket(ticket.id);
  assert.equal(rels.length, 1);
  assert.equal(rels[0]?.fromRequirementId, edited.id);
  assert.equal(rels[0]?.toRequirementId, a.id);
});

test('supersedeRequirement marks active item superseded without replacement', async () => {
  const uow = new MemoryUnitOfWork();
  const { ticket } = await seedProjectTicket(uow);
  const { addRequirementManual, supersedeRequirement } = await import('./edits.ts');
  const a = await addRequirementManual(uow, {
    ticketId: ticket.id,
    title: 'A',
    actorType: 'human',
  });
  await supersedeRequirement(uow, { ticketId: ticket.id, requirementId: a.id, actorType: 'human' });
  const active = await uow.requirements.listActiveByTicket(ticket.id);
  assert.equal(active.length, 0);
  const superseded = await uow.requirements.listSupersededByTicket(ticket.id);
  assert.equal(superseded.length, 1);
});

test('reorderChecklist rewrites display_order and validates the id set', async () => {
  const uow = new MemoryUnitOfWork();
  const { ticket } = await seedProjectTicket(uow);
  const { addRequirementManual, reorderChecklist } = await import('./edits.ts');
  const a = await addRequirementManual(uow, {
    ticketId: ticket.id,
    title: 'A',
    actorType: 'human',
  });
  const b = await addRequirementManual(uow, {
    ticketId: ticket.id,
    title: 'B',
    actorType: 'human',
  });
  const c = await addRequirementManual(uow, {
    ticketId: ticket.id,
    title: 'C',
    actorType: 'human',
  });
  await reorderChecklist(uow, { ticketId: ticket.id, orderedIds: [c.id, a.id, b.id] });
  const active = await uow.requirements.listActiveByTicket(ticket.id);
  assert.deepEqual(
    active.map((r) => r.title),
    ['C', 'A', 'B'],
  );
  await assert.rejects(
    () => reorderChecklist(uow, { ticketId: ticket.id, orderedIds: [a.id] }),
    (e: unknown) => e instanceof InvalidOperationError,
  );
});

test('uncheckRequirement flips dev status and records an uncheck audit', async () => {
  const uow = new MemoryUnitOfWork();
  const { ticket } = await seedProjectTicket(uow);
  const { addRequirementManual, uncheckRequirement } = await import('./edits.ts');
  const a = await addRequirementManual(uow, {
    ticketId: ticket.id,
    title: 'A',
    actorType: 'human',
  });
  await checkRequirement(uow, { requirementId: a.id, actorType: 'human' });
  const audit = await uncheckRequirement(uow, {
    requirementId: a.id,
    actorType: 'human',
    actorId: 'budi',
  });
  assert.equal(audit.action, 'uncheck');
  const updated = await uow.requirements.findById(a.id);
  assert.equal(updated?.devStatus, 'unchecked');
  const audits = await uow.completionAudits.listByRequirement(a.id);
  assert.deepEqual(audits.map((x) => x.action).sort(), ['check', 'uncheck']);
});
