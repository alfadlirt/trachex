import type {
  CompletionAudit,
  Impact,
  ImpactKind,
  Proposal,
  ProposalVersion,
  Requirement,
  Scenario,
  Source,
  SourceType,
  Subject,
  Ticket,
} from './entities.ts';
import { ConflictError, InvalidOperationError, NotFoundError } from './errors.ts';
import { newId, nowIso } from './ids.ts';
import type { UnitOfWork } from './repositories.ts';

export interface CreateProjectInput {
  slug: string;
  name: string;
  description?: string;
}

export interface RegisterRepositoryInput {
  projectId?: string;
  slug: string;
  serviceName?: string;
  url?: string;
  path: string;
}

export interface CreateTicketInput {
  projectId: string;
  key: string;
  title: string;
  description?: string;
}

export interface CreateSubjectInput {
  projectId: string;
  name: string;
  description?: string;
}

export async function createSubject(uow: UnitOfWork, input: CreateSubjectInput): Promise<Subject> {
  const project = await uow.projects.findById(input.projectId);
  if (!project) throw new NotFoundError('project', input.projectId);
  const name = input.name.trim();
  if (!name) throw new InvalidOperationError('subject name must not be empty');
  if (await uow.subjects.findByProjectAndName(input.projectId, name)) {
    throw new ConflictError(`subject already exists in project: ${name}`);
  }
  const now = nowIso();
  const subject: Subject = {
    id: newId(),
    projectId: input.projectId,
    name,
    description: input.description?.trim() || null,
    createdAt: now,
    updatedAt: now,
  };
  await uow.subjects.create(subject);
  // A subject shares its immutable identity with the legacy ticket row that
  // carries the checklist (see entities.Subject). Creating the backing ticket
  // here keeps `ticket.id === subject.id` true so checklist flows and the TUI
  // can open a subject's checklist without guessing an unrelated ticket.
  await uow.tickets.create({
    id: subject.id,
    projectId: subject.projectId,
    key: subject.id,
    title: subject.name,
    description: subject.description,
    createdAt: now,
    updatedAt: now,
  });
  return subject;
}

export async function archiveProject(uow: UnitOfWork, projectId: string): Promise<void> {
  const project = await uow.projects.findById(projectId);
  if (!project) throw new NotFoundError('project', projectId);
  if (!uow.projects.archive) throw new InvalidOperationError('project archiving is unavailable');
  await uow.projects.archive(projectId);
}

export async function permanentlyDeleteProject(
  uow: UnitOfWork,
  projectId: string,
  force: boolean,
): Promise<void> {
  const project = await uow.projects.findById(projectId);
  if (!project) throw new NotFoundError('project', projectId);
  if (!force) throw new InvalidOperationError('permanent project deletion requires force=true');
  if (!uow.projects.permanentDelete)
    throw new InvalidOperationError('permanent project deletion is unavailable');
  await uow.projects.permanentDelete(projectId, force);
}

export async function archiveSubject(uow: UnitOfWork, subjectId: string): Promise<void> {
  const subject = await uow.subjects.findById(subjectId);
  if (!subject) throw new NotFoundError('subject', subjectId);
  if (!uow.subjects.archive) throw new InvalidOperationError('subject archiving is unavailable');
  await uow.subjects.archive(subjectId);
  const ticket = await uow.tickets.findById(subjectId);
  if (ticket && uow.requirements.archiveSubtree) {
    const requirements = await uow.requirements.listByTicket(ticket.id);
    for (const requirement of requirements.filter((item) => item.lifecycleStatus === 'active')) {
      await uow.requirements.archiveSubtree(requirement.id);
    }
  }
}

export async function permanentlyDeleteSubject(
  uow: UnitOfWork,
  subjectId: string,
  force: boolean,
): Promise<void> {
  const subject = await uow.subjects.findById(subjectId);
  if (!subject) throw new NotFoundError('subject', subjectId);
  if (!force) throw new InvalidOperationError('permanent subject deletion requires force=true');
  if (!uow.subjects.permanentDelete)
    throw new InvalidOperationError('permanent subject deletion is unavailable');
  await uow.subjects.permanentDelete(subjectId, force);
}

export async function archiveRequirement(uow: UnitOfWork, requirementId: string): Promise<void> {
  if (!(await uow.requirements.findById(requirementId)))
    throw new NotFoundError('requirement', requirementId);
  if (!uow.requirements.archiveSubtree)
    throw new InvalidOperationError('requirement archiving is unavailable');
  await uow.requirements.archiveSubtree(requirementId);
}

export interface BaselineContext {
  subject: Subject;
  ticket: Ticket;
  checklist: Requirement[];
  history: Requirement[];
  impacts: Impact[];
  scenarios: Scenario[];
  sources: Source[];
  repositories: Awaited<ReturnType<UnitOfWork['repositories']['listBySubject']>>;
  openProposals: Proposal[];
  evidence: Awaited<ReturnType<NonNullable<UnitOfWork['agents']>['listEvidenceReferences']>>;
  findings: Awaited<ReturnType<NonNullable<UnitOfWork['agents']>['listFindings']>>;
}

export async function buildSubjectBaseline(
  uow: UnitOfWork,
  subjectId: string,
): Promise<BaselineContext> {
  const subject = await uow.subjects.findById(subjectId);
  if (!subject) throw new NotFoundError('subject', subjectId);
  const ticket = await uow.tickets.findById(subject.id);
  if (!ticket || ticket.projectId !== subject.projectId)
    throw new NotFoundError('ticket', subject.id);
  const requirements = await uow.requirements.listByTicket(ticket.id);
  const proposals = await uow.proposals.listByTicket(ticket.id);
  const agents = uow.agents;
  return {
    subject,
    ticket,
    checklist: requirements.filter((item) => item.lifecycleStatus === 'active'),
    history: requirements.filter((item) => item.lifecycleStatus !== 'active'),
    impacts: await uow.requirements.listImpactsByTicket(ticket.id),
    scenarios: await uow.requirements.listScenariosByTicket(ticket.id),
    sources: await uow.sources.listByTicket(ticket.id),
    repositories: await uow.repositories.listBySubject(subject.id),
    openProposals: proposals.filter((proposal) => proposal.status === 'pending'),
    evidence: agents ? await agents.listEvidenceReferences(subject.id) : [],
    findings: agents ? await agents.listFindings(subject.id) : [],
  };
}

export interface AddSourceInput {
  ticketId: string;
  type: SourceType;
  attribution?: string;
  sourceEventAt?: string;
  snapshotId?: string;
  location?: string;
}

export interface RequirementDraft {
  title: string;
  description?: string;
  sourceLocation?: string;
  parentLabel?: string;
  impacts?: { kind: ImpactKind; value: string }[];
  scenarios?: string[];
  supersedes?: string[];
}

export interface ExtractionOutput {
  kind: 'extraction';
  requirements: RequirementDraft[];
}

export interface ReconciliationOutput {
  kind: 'reconciliation';
  create: RequirementDraft[];
}

export type ProposalOutput = ExtractionOutput | ReconciliationOutput;

export interface CreateProposalInput {
  ticketId: string;
  kind: Proposal['kind'];
  sourceId?: string;
  output: ProposalOutput;
}

export interface ApproveProposalInput {
  proposalId: string;
  editedOutput?: ProposalOutput;
}

export interface CheckRequirementInput {
  requirementId: string;
  actorType: CompletionAudit['actorType'];
  actorId?: string;
  note?: string;
}

export interface ExportSummary {
  projectSlug: string;
  ticketKey: string;
  ticketTitle: string;
  timeline: TimelineEvent[];
  checklist: Requirement[];
  impacts: Impact[];
  scenarios: Scenario[];
  history: Requirement[];
}

export interface TimelineEvent {
  at: string;
  kind: 'source' | 'proposal' | 'approval' | 'completion';
  description: string;
  action?: 'check' | 'uncheck';
}

export async function createProject(
  uow: UnitOfWork,
  input: CreateProjectInput,
): Promise<{ id: string; slug: string }> {
  const slug = input.slug.trim().toLowerCase();
  if (slug.length === 0) {
    throw new InvalidOperationError('project slug must not be empty');
  }
  const existing = await uow.projects.findBySlug(slug);
  if (existing) {
    throw new ConflictError(`project slug already exists: ${slug}`);
  }
  const now = nowIso();
  const project = {
    id: newId(),
    slug,
    name: input.name.trim(),
    description: input.description?.trim() || null,
    createdAt: now,
    updatedAt: now,
  };
  await uow.projects.create(project);
  return { id: project.id, slug: project.slug };
}

export async function registerRepository(
  uow: UnitOfWork,
  input: RegisterRepositoryInput,
): Promise<void> {
  const now = nowIso();
  if (input.projectId) {
    const project = await uow.projects.findById(input.projectId);
    if (!project) {
      throw new NotFoundError('project', input.projectId);
    }
    const existing = await uow.repositories.findByProjectAndSlug(input.projectId, input.slug);
    if (existing) {
      throw new ConflictError(`repository slug already exists in project: ${input.slug}`);
    }
  }
  const repository = {
    id: newId(),
    projectId: input.projectId ?? null,
    slug: input.slug,
    serviceName: input.serviceName?.trim() || null,
    url: input.url?.trim() || null,
    createdAt: now,
    updatedAt: now,
  };
  await uow.repositories.create(repository);
  await uow.repositories.addPath({
    id: newId(),
    repositoryId: repository.id,
    path: input.path,
    validFrom: now,
    validTo: null,
  });
}

export async function removeRepository(uow: UnitOfWork, repositoryId: string): Promise<void> {
  const repository = await uow.repositories.findById(repositoryId);
  if (!repository) {
    throw new NotFoundError('repository', repositoryId);
  }
  await uow.repositories.remove(repositoryId);
}

export async function attachRepositoryToSubject(
  uow: UnitOfWork,
  subjectId: string,
  repositoryId: string,
): Promise<void> {
  const subject = await uow.subjects.findById(subjectId);
  if (!subject) {
    throw new NotFoundError('subject', subjectId);
  }
  const repository = await uow.repositories.findById(repositoryId);
  if (!repository) {
    throw new NotFoundError('repository', repositoryId);
  }
  await uow.repositories.attachToSubject(subjectId, repositoryId);
}

export async function detachRepositoryFromSubject(
  uow: UnitOfWork,
  subjectId: string,
  repositoryId: string,
): Promise<void> {
  const subject = await uow.subjects.findById(subjectId);
  if (!subject) {
    throw new NotFoundError('subject', subjectId);
  }
  const repository = await uow.repositories.findById(repositoryId);
  if (!repository) {
    throw new NotFoundError('repository', repositoryId);
  }
  await uow.repositories.detachFromSubject(subjectId, repositoryId);
}

export async function createTicket(uow: UnitOfWork, input: CreateTicketInput): Promise<Ticket> {
  const project = await uow.projects.findById(input.projectId);
  if (!project) {
    throw new NotFoundError('project', input.projectId);
  }
  const key = input.key.trim();
  if (key.length === 0) {
    throw new InvalidOperationError('ticket key must not be empty');
  }
  const existing = await uow.tickets.findByProjectAndKey(input.projectId, key);
  if (existing) {
    throw new ConflictError(`ticket key already exists in project: ${key}`);
  }
  const now = nowIso();
  const ticket: Ticket = {
    id: newId(),
    projectId: input.projectId,
    key,
    title: input.title.trim(),
    description: input.description?.trim() || null,
    createdAt: now,
    updatedAt: now,
  };
  await uow.tickets.create(ticket);
  return ticket;
}

export async function addSource(uow: UnitOfWork, input: AddSourceInput): Promise<Source> {
  const ticket = await uow.tickets.findById(input.ticketId);
  if (!ticket) {
    throw new NotFoundError('ticket', input.ticketId);
  }
  const source: Source = {
    id: newId(),
    ticketId: input.ticketId,
    type: input.type,
    attribution: input.attribution?.trim() || null,
    sourceEventAt: input.sourceEventAt ?? null,
    ingestedAt: nowIso(),
    snapshotId: input.snapshotId ?? null,
    location: input.location?.trim() || null,
    note: null,
  };
  await uow.sources.create(source);
  return source;
}

export async function createProposal(
  uow: UnitOfWork,
  input: CreateProposalInput,
): Promise<Proposal> {
  const ticket = await uow.tickets.findById(input.ticketId);
  if (!ticket) {
    throw new NotFoundError('ticket', input.ticketId);
  }
  const now = nowIso();
  const proposal: Proposal = {
    id: newId(),
    ticketId: input.ticketId,
    kind: input.kind,
    status: 'pending',
    sourceId: input.sourceId ?? null,
    createdAt: now,
    updatedAt: now,
  };
  await uow.proposals.create(proposal);
  const version: ProposalVersion = {
    id: newId(),
    proposalId: proposal.id,
    version: 1,
    modelOutput: JSON.stringify(input.output),
    editedOutput: null,
    reviewedAt: null,
    createdAt: now,
  };
  await uow.proposals.addVersion(version);
  return proposal;
}

export async function editProposal(
  uow: UnitOfWork,
  input: { proposalId: string; editedOutput: ProposalOutput },
): Promise<ProposalVersion> {
  const proposal = await uow.proposals.findById(input.proposalId);
  if (!proposal) {
    throw new NotFoundError('proposal', input.proposalId);
  }
  if (proposal.status !== 'pending') {
    throw new InvalidOperationError('only pending proposals can be edited');
  }
  const versions = await uow.proposals.listVersions(proposal.id);
  const original = versions[0];
  if (!original) {
    throw new InvalidOperationError('proposal has no versions');
  }
  const nextVersion = versions.length + 1;
  const version: ProposalVersion = {
    id: newId(),
    proposalId: proposal.id,
    version: nextVersion,
    modelOutput: original.modelOutput,
    editedOutput: JSON.stringify(input.editedOutput),
    reviewedAt: null,
    createdAt: nowIso(),
  };
  await uow.proposals.addVersion(version);
  return version;
}

export async function approveProposal(uow: UnitOfWork, input: ApproveProposalInput): Promise<void> {
  const proposal = await uow.proposals.findById(input.proposalId);
  if (!proposal) {
    throw new NotFoundError('proposal', input.proposalId);
  }
  if (proposal.status !== 'pending') {
    throw new InvalidOperationError(`proposal is not pending: ${proposal.status}`);
  }
  const versions = await uow.proposals.listVersions(proposal.id);
  const latest = versions.at(-1);
  if (!latest) {
    throw new InvalidOperationError('proposal has no versions');
  }
  const effectiveOutput: ProposalOutput = input.editedOutput
    ? input.editedOutput
    : latest.editedOutput
      ? (JSON.parse(latest.editedOutput) as ProposalOutput)
      : (JSON.parse(latest.modelOutput) as ProposalOutput);
  const output = effectiveOutput;

  const now = nowIso();
  const ticket = await uow.tickets.findById(proposal.ticketId);
  if (!ticket) {
    throw new NotFoundError('ticket', proposal.ticketId);
  }

  if (output.kind === 'extraction') {
    for (const draft of output.requirements) {
      await createRequirementFromDraft(uow, ticket.projectId, ticket.id, proposal, draft, now);
    }
  } else if (output.kind === 'reconciliation') {
    for (const draft of output.create) {
      const created = await createRequirementFromDraft(
        uow,
        ticket.projectId,
        ticket.id,
        proposal,
        draft,
        now,
      );
      for (const targetId of draft.supersedes ?? []) {
        const target = await uow.requirements.findById(targetId);
        if (!target) {
          throw new InvalidOperationError(`cannot supersede unknown requirement: ${targetId}`);
        }
        if (target.ticketId !== ticket.id) {
          throw new InvalidOperationError('cannot supersede a requirement from another ticket');
        }
        const updated: Requirement = { ...target, lifecycleStatus: 'superseded', updatedAt: now };
        await uow.requirements.update(updated);
        await uow.requirements.addRelationship({
          id: newId(),
          fromRequirementId: created.id,
          toRequirementId: target.id,
          type: 'supersedes',
          createdAt: now,
        });
      }
    }
  }

  await uow.proposals.update({ ...proposal, status: 'approved', updatedAt: now });
  await uow.proposals.addVersion({
    id: newId(),
    proposalId: proposal.id,
    version: versions.length + 1,
    modelOutput: latest.modelOutput,
    editedOutput: latest.editedOutput,
    reviewedAt: now,
    createdAt: now,
  });
}

async function createRequirementFromDraft(
  uow: UnitOfWork,
  projectId: string,
  ticketId: string,
  proposal: Proposal,
  draft: RequirementDraft,
  now: string,
): Promise<Requirement> {
  const requirement: Requirement = {
    id: newId(),
    projectId,
    ticketId,
    title: draft.title.trim(),
    description: draft.description?.trim() || null,
    sourceId: proposal.sourceId,
    sourceLocation: draft.sourceLocation?.trim() || null,
    lifecycleStatus: 'active',
    devStatus: 'unchecked',
    parentLabel: draft.parentLabel?.trim() || null,
    parentId: null,
    displayOrder: await nextDisplayOrder(uow, ticketId),
    createdAt: now,
    updatedAt: now,
  };
  await uow.requirements.create(requirement);
  for (const impact of draft.impacts ?? []) {
    const row: Impact = {
      id: newId(),
      requirementId: requirement.id,
      kind: impact.kind,
      value: impact.value.trim(),
      createdAt: now,
    };
    await uow.requirements.addImpact(row);
  }
  for (const text of draft.scenarios ?? []) {
    const row: Scenario = {
      id: newId(),
      requirementId: requirement.id,
      text: text.trim(),
      reviewed: false,
      createdAt: now,
    };
    await uow.requirements.addScenario(row);
  }
  return requirement;
}

export async function rejectProposal(
  uow: UnitOfWork,
  input: { proposalId: string },
): Promise<void> {
  const proposal = await uow.proposals.findById(input.proposalId);
  if (!proposal) {
    throw new NotFoundError('proposal', input.proposalId);
  }
  if (proposal.status !== 'pending') {
    throw new InvalidOperationError(`proposal is not pending: ${proposal.status}`);
  }
  const now = nowIso();
  await uow.proposals.update({ ...proposal, status: 'rejected', updatedAt: now });
}

export async function checkRequirement(
  uow: UnitOfWork,
  input: CheckRequirementInput,
): Promise<CompletionAudit> {
  const requirement = await uow.requirements.findById(input.requirementId);
  if (!requirement) {
    throw new NotFoundError('requirement', input.requirementId);
  }
  const now = nowIso();
  const audit: CompletionAudit = {
    id: newId(),
    requirementId: requirement.id,
    actorType: input.actorType,
    actorId: input.actorId?.trim() || null,
    note: input.note?.trim() || null,
    action: 'check',
    checkedAt: now,
  };
  await uow.completionAudits.create(audit);
  await uow.requirements.update({ ...requirement, devStatus: 'checked', updatedAt: now });
  return audit;
}

export async function buildExportSummary(
  uow: UnitOfWork,
  input: { projectId: string; ticketKey: string },
): Promise<ExportSummary> {
  const project = await uow.projects.findById(input.projectId);
  if (!project) {
    throw new NotFoundError('project', input.projectId);
  }
  const ticket = await uow.tickets.findByProjectAndKey(input.projectId, input.ticketKey);
  if (!ticket) {
    throw new NotFoundError('ticket', input.ticketKey);
  }
  const requirements = await uow.requirements.listByTicket(ticket.id);
  const checklist = requirements.filter((r) => r.lifecycleStatus === 'active');
  const history = requirements.filter((r) => r.lifecycleStatus === 'superseded');
  const impacts = await uow.requirements.listImpactsByTicket(ticket.id);
  const scenarios = await uow.requirements.listScenariosByTicket(ticket.id);
  const sources = await uow.sources.listByTicket(ticket.id);
  const proposals = await uow.proposals.listByTicket(ticket.id);

  const timeline: TimelineEvent[] = [];
  for (const source of sources) {
    timeline.push({
      at: source.ingestedAt,
      kind: 'source',
      description: `source ${source.type}${source.attribution ? ` from ${source.attribution}` : ''}`,
    });
  }
  for (const proposal of proposals) {
    timeline.push({
      at: proposal.createdAt,
      kind: 'proposal',
      description: `proposal ${proposal.kind} ${proposal.status}`,
    });
    if (proposal.status === 'approved') {
      timeline.push({
        at: proposal.updatedAt,
        kind: 'approval',
        description: `approved proposal ${proposal.kind}`,
      });
    }
  }
  const audits = await Promise.all(
    requirements.map((r) => uow.completionAudits.listByRequirement(r.id)),
  );
  for (const list of audits) {
    for (const audit of list) {
      const action = audit.action === 'uncheck' ? 'unchecked' : 'checked';
      timeline.push({
        at: audit.checkedAt,
        kind: 'completion',
        action: audit.action,
        description: `${action} ${audit.requirementId} by ${audit.actorType}`,
      });
    }
  }
  timeline.sort((a, b) => a.at.localeCompare(b.at));

  return {
    projectSlug: project.slug,
    ticketKey: ticket.key,
    ticketTitle: ticket.title,
    timeline,
    checklist,
    impacts,
    scenarios,
    history,
  };
}

export async function nextDisplayOrder(uow: UnitOfWork, ticketId: string): Promise<number> {
  const requirements = await uow.requirements.listByTicket(ticketId);
  let max = -1;
  for (const requirement of requirements) {
    if (requirement.displayOrder > max) {
      max = requirement.displayOrder;
    }
  }
  return max + 1;
}
