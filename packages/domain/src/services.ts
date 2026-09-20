import type {
  CompletionAudit,
  Impact,
  ImpactKind,
  Project,
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

export function slugifyName(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase();
}

export interface UpdateProjectInput {
  projectId: string;
  name?: string;
  slug?: string;
}

export async function updateProject(uow: UnitOfWork, input: UpdateProjectInput): Promise<Project> {
  const project = await uow.projects.findById(input.projectId);
  if (!project) throw new NotFoundError('project', input.projectId);
  const name = input.name !== undefined ? input.name.trim() : project.name;
  const slug = input.slug !== undefined ? input.slug.trim().toLowerCase() : project.slug;
  if (!name) throw new InvalidOperationError('project name must not be empty');
  if (!slug) throw new InvalidOperationError('project slug must not be empty');
  if (slug !== project.slug) {
    const existing = await uow.projects.findBySlug(slug);
    if (existing) throw new ConflictError(`project slug already exists: ${slug}`);
  }
  const now = nowIso();
  return uow.projects.update({ ...project, name, slug, updatedAt: now });
}

export interface DeleteProjectInput {
  projectId: string;
  confirmName: string;
}

export async function deleteProject(uow: UnitOfWork, input: DeleteProjectInput): Promise<void> {
  const project = await uow.projects.findById(input.projectId);
  if (!project) throw new NotFoundError('project', input.projectId);
  if (input.confirmName !== project.name) {
    throw new InvalidOperationError('delete confirmation name does not match the project name');
  }
  if (!uow.projects.permanentDelete)
    throw new InvalidOperationError('permanent project deletion is unavailable');
  await uow.projects.permanentDelete(project.id, true);
}

export async function updateTicket(
  uow: UnitOfWork,
  input: { ticketId: string; title?: string; key?: string },
): Promise<Ticket> {
  const ticket = await uow.tickets.findById(input.ticketId);
  if (!ticket) throw new NotFoundError('ticket', input.ticketId);
  const title = input.title !== undefined ? input.title.trim() : ticket.title;
  const key = input.key !== undefined ? input.key.trim() : ticket.key;
  if (!title) throw new InvalidOperationError('ticket title must not be empty');
  if (!key) throw new InvalidOperationError('ticket key must not be empty');
  if (key !== ticket.key) {
    const existing = await uow.tickets.findByProjectAndKey(ticket.projectId, key);
    if (existing) throw new ConflictError(`ticket key already exists in project: ${key}`);
  }
  const now = nowIso();
  return uow.tickets.update({ ...ticket, title, key, updatedAt: now });
}

export async function deleteSubjectByTicket(
  uow: UnitOfWork,
  input: { ticketId: string; confirmName: string },
): Promise<void> {
  const ticket = await uow.tickets.findById(input.ticketId);
  if (!ticket) throw new NotFoundError('ticket', input.ticketId);
  if (input.confirmName !== ticket.title) {
    throw new InvalidOperationError('delete confirmation name does not match the subject title');
  }
  if (uow.subjects.permanentDelete) {
    const subject = await uow.subjects.findById(ticket.id);
    if (subject) {
      await uow.subjects.permanentDelete(subject.id, true);
      return;
    }
  }
  if (!uow.tickets.permanentDelete)
    throw new InvalidOperationError('permanent ticket deletion is unavailable');
  await uow.tickets.permanentDelete(ticket.id, true);
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
  implementationItems?: string[];
  successCriteria?: string[];
  impacts?: { kind: ImpactKind; value: string }[];
  /** Legacy name retained for proposals created before successCriteria. */
  scenarios?: string[];
  supersedes?: string[];
}

export interface ProposedOrder {
  orderedIds: string[];
  rationale: string;
  uncertainty?: string | null;
}

export interface ExtractionOutput {
  kind: 'extraction';
  requirements: RequirementDraft[];
  proposedOrder?: ProposedOrder | null;
}

export interface ReconciliationOutput {
  kind: 'reconciliation';
  create: RequirementDraft[];
  proposedOrder?: ProposedOrder | null;
}

export type ProposalOutput = ExtractionOutput | ReconciliationOutput;

export interface ProposalReviewDraft {
  title: string;
  description: string | null;
  sourceLocation: string | null;
  implementationItems: string[];
  successCriteria: string[];
  impacts: { kind: ImpactKind; value: string }[];
  scenarios: string[];
  supersedes: string[];
}

export interface ProposalReviewTarget {
  id: string;
  title: string;
  status: Requirement['lifecycleStatus'];
}

export interface ProposalReview {
  proposalId: string;
  kind: Proposal['kind'];
  status: Proposal['status'];
  source: Pick<Source, 'type' | 'attribution' | 'location' | 'sourceEventAt' | 'ingestedAt'> | null;
  drafts: ProposalReviewDraft[];
  originalDrafts: ProposalReviewDraft[];
  isEdited: boolean;
  version: number;
  supersessionTargets: ProposalReviewTarget[];
  proposedOrder: ProposedOrder | null;
  orderState: 'none' | 'valid' | 'stale';
  error: string | null;
}

function validateProposalOutput(output: unknown): asserts output is ProposalOutput {
  if (
    !output ||
    typeof output !== 'object' ||
    !('kind' in output) ||
    (output.kind !== 'extraction' && output.kind !== 'reconciliation')
  ) {
    throw new InvalidOperationError('proposal output must be an extraction or reconciliation');
  }
  // The discriminant is checked above; the remaining fields are validated below.
  const typedOutput = output as ProposalOutput;
  const drafts = typedOutput.kind === 'extraction' ? typedOutput.requirements : typedOutput.create;
  if (!Array.isArray(drafts) || (output.kind === 'extraction' && drafts.length === 0)) {
    throw new InvalidOperationError('proposal output has an invalid draft list');
  }
  for (const draft of drafts) {
    if (
      !draft ||
      typeof draft !== 'object' ||
      typeof draft.title !== 'string' ||
      draft.title.trim().length === 0
    ) {
      throw new InvalidOperationError('proposal drafts require a non-empty title');
    }
    for (const field of ['description', 'sourceLocation', 'parentLabel'] as const) {
      if (
        field in draft &&
        draft[field] !== undefined &&
        draft[field] !== null &&
        typeof draft[field] !== 'string'
      ) {
        throw new InvalidOperationError(`proposal ${field} must be a string`);
      }
    }
    for (const field of ['implementationItems', 'successCriteria'] as const) {
      if (field in draft && draft[field] !== undefined && !Array.isArray(draft[field])) {
        throw new InvalidOperationError(`proposal ${field} must be an array`);
      }
      for (const item of draft[field] ?? []) {
        if (typeof item !== 'string' || item.trim().length === 0) {
          throw new InvalidOperationError(`proposal ${field} must contain non-empty strings`);
        }
      }
    }
    if (draft.supersedes !== undefined && !Array.isArray(draft.supersedes)) {
      throw new InvalidOperationError('proposal supersedes must be an array of ids');
    }
    for (const id of draft.supersedes ?? []) {
      if (typeof id !== 'string' || id.trim().length === 0) {
        throw new InvalidOperationError('proposal supersedes targets must be non-empty ids');
      }
    }
    if (draft.impacts !== undefined && !Array.isArray(draft.impacts)) {
      throw new InvalidOperationError('proposal impacts must be an array');
    }
    for (const impact of draft.impacts ?? []) {
      if (
        !impact ||
        typeof impact !== 'object' ||
        (impact.kind !== 'service' && impact.kind !== 'api' && impact.kind !== 'page') ||
        typeof impact.value !== 'string' ||
        impact.value.trim().length === 0
      ) {
        throw new InvalidOperationError('proposal impacts are invalid');
      }
    }
    if (draft.scenarios !== undefined && !Array.isArray(draft.scenarios)) {
      throw new InvalidOperationError('proposal scenarios must be an array');
    }
    for (const scenario of draft.scenarios ?? []) {
      if (typeof scenario !== 'string' || scenario.trim().length === 0) {
        throw new InvalidOperationError('proposal scenarios are invalid');
      }
    }
  }
  const order = (typedOutput as { proposedOrder?: unknown }).proposedOrder;
  if (order !== undefined && order !== null) {
    validateProposedOrder(order);
  }
}

export function validateProposedOrder(order: unknown): asserts order is ProposedOrder {
  if (!order || typeof order !== 'object') {
    throw new InvalidOperationError('proposal order must be an object');
  }
  const candidate = order as { orderedIds?: unknown; rationale?: unknown; uncertainty?: unknown };
  if (!Array.isArray(candidate.orderedIds) || candidate.orderedIds.length === 0) {
    throw new InvalidOperationError('proposal order requires a non-empty orderedIds list');
  }
  const seen = new Set<string>();
  for (const id of candidate.orderedIds) {
    if (typeof id !== 'string' || id.trim().length === 0) {
      throw new InvalidOperationError('proposal order ids must be non-empty strings');
    }
    if (seen.has(id)) throw new InvalidOperationError('proposal order contains a duplicate id');
    seen.add(id);
  }
  if (typeof candidate.rationale !== 'string' || candidate.rationale.trim().length === 0) {
    throw new InvalidOperationError('proposal order requires a dependency rationale');
  }
  if (
    candidate.uncertainty !== undefined &&
    candidate.uncertainty !== null &&
    typeof candidate.uncertainty !== 'string'
  ) {
    throw new InvalidOperationError('proposal order uncertainty must be a string');
  }
}

function parseProposalOutput(value: string): ProposalOutput {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new InvalidOperationError('proposal output is not valid JSON');
  }
  validateProposalOutput(parsed);
  return parsed;
}

function parseAndValidateProposalOutput(value: string): ProposalOutput {
  const output = parseProposalOutput(value);
  validateProposalOutput(output);
  return output;
}

function reviewDraft(draft: RequirementDraft): ProposalReviewDraft {
  return {
    title: draft.title,
    description: draft.description ?? null,
    sourceLocation: draft.sourceLocation ?? null,
    implementationItems: [...(draft.implementationItems ?? [])],
    successCriteria: [...(draft.successCriteria ?? draft.scenarios ?? [])],
    impacts: (draft.impacts ?? []).map((impact) => ({ ...impact })),
    scenarios: [...(draft.scenarios ?? [])],
    supersedes: [...(draft.supersedes ?? [])],
  };
}

/** Builds a read-only, safe-to-render view of proposal versions for a ticket. */
export async function buildProposalReviews(
  uow: UnitOfWork,
  ticketId: string,
): Promise<ProposalReview[]> {
  const proposals = await uow.proposals.listByTicket(ticketId);
  const reviews: ProposalReview[] = [];
  for (const proposal of proposals) {
    const candidateSource = proposal.sourceId
      ? await uow.sources.findById(proposal.sourceId)
      : null;
    const source = candidateSource?.ticketId === ticketId ? candidateSource : null;
    const activeNow = await uow.requirements.listActiveByTicket(ticketId);
    const activeIds = new Set(activeNow.map((item) => item.id));
    const review: ProposalReview = {
      proposalId: proposal.id,
      kind: proposal.kind,
      status: proposal.status,
      source: source
        ? {
            type: source.type,
            attribution: source.attribution,
            location: source.location,
            sourceEventAt: source.sourceEventAt,
            ingestedAt: source.ingestedAt,
          }
        : null,
      drafts: [],
      originalDrafts: [],
      isEdited: false,
      version: 0,
      supersessionTargets: [],
      proposedOrder: null,
      orderState: 'none',
      error: null,
    };
    try {
      const versions = await uow.proposals.listVersions(proposal.id);
      const latest = versions.at(-1);
      if (!latest) throw new InvalidOperationError('proposal has no versions');
      review.version = latest.version;
      review.isEdited = latest.editedOutput !== null;
      const originalOutput = parseProposalOutput(versions[0]?.modelOutput ?? latest.modelOutput);
      const output = parseProposalOutput(latest.editedOutput ?? latest.modelOutput);
      if (originalOutput.kind !== proposal.kind || output.kind !== proposal.kind) {
        throw new InvalidOperationError(`proposal output kind must remain ${proposal.kind}`);
      }
      const originalDrafts =
        originalOutput.kind === 'extraction' ? originalOutput.requirements : originalOutput.create;
      const drafts = output.kind === 'extraction' ? output.requirements : output.create;
      review.drafts = drafts.map(reviewDraft);
      review.originalDrafts = originalDrafts.map(reviewDraft);
      const proposedOrder = output.proposedOrder ?? null;
      if (proposedOrder) {
        review.proposedOrder = {
          orderedIds: [...proposedOrder.orderedIds],
          rationale: proposedOrder.rationale,
          ...(proposedOrder.uncertainty !== undefined
            ? { uncertainty: proposedOrder.uncertainty }
            : {}),
        };
        const activeIdList = [...activeIds];
        const coversActive = activeIdList.every((id) => proposedOrder.orderedIds.includes(id));
        const onlyActive = proposedOrder.orderedIds.every((id) => activeIds.has(id));
        review.orderState = coversActive && onlyActive ? 'valid' : 'stale';
      }
      const targetIds = drafts.flatMap((draft) => draft.supersedes ?? []);
      for (const targetId of targetIds) {
        const target = await uow.requirements.findById(targetId);
        if (!target) {
          throw new InvalidOperationError(`cannot review unknown supersession target: ${targetId}`);
        }
        if (target.ticketId !== ticketId) {
          throw new InvalidOperationError(
            'cannot review a supersession target from another ticket',
          );
        }
        review.supersessionTargets.push({
          id: target.id,
          title: target.title,
          status: target.lifecycleStatus,
        });
      }
    } catch (error) {
      review.error =
        error instanceof Error ? error.message : 'proposal output could not be reviewed';
    }
    reviews.push(review);
  }
  return reviews;
}

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

export async function createProject(uow: UnitOfWork, input: CreateProjectInput): Promise<Project> {
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
  return project;
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
  validateProposalOutput(input.output);
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
  validateProposalOutput(input.editedOutput);
  const proposal = await uow.proposals.findById(input.proposalId);
  if (!proposal) {
    throw new NotFoundError('proposal', input.proposalId);
  }
  if (proposal.status !== 'pending') {
    throw new InvalidOperationError('only pending proposals can be edited');
  }
  if (proposal.kind !== input.editedOutput.kind) {
    throw new InvalidOperationError(
      `edited proposal kind must remain ${proposal.kind}, received ${input.editedOutput.kind}`,
    );
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

export async function resetProposal(
  uow: UnitOfWork,
  input: { proposalId: string },
): Promise<ProposalVersion> {
  const proposal = await uow.proposals.findById(input.proposalId);
  if (!proposal) throw new NotFoundError('proposal', input.proposalId);
  if (proposal.status !== 'pending') {
    throw new InvalidOperationError('only pending proposals can be reset');
  }
  const versions = await uow.proposals.listVersions(proposal.id);
  const original = versions[0];
  if (!original) throw new InvalidOperationError('proposal has no versions');
  const version: ProposalVersion = {
    id: newId(),
    proposalId: proposal.id,
    version: versions.length + 1,
    modelOutput: original.modelOutput,
    editedOutput: null,
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
      ? parseAndValidateProposalOutput(latest.editedOutput)
      : parseAndValidateProposalOutput(latest.modelOutput);
  validateProposalOutput(effectiveOutput);
  if (effectiveOutput.kind !== proposal.kind) {
    throw new InvalidOperationError(
      `proposal output kind must remain ${proposal.kind}, received ${effectiveOutput.kind}`,
    );
  }
  const output = effectiveOutput;

  const now = nowIso();
  const ticket = await uow.tickets.findById(proposal.ticketId);
  if (!ticket) {
    throw new NotFoundError('ticket', proposal.ticketId);
  }

  // Validate all supersession targets before creating any replacement rows. This
  // keeps malformed or cross-ticket edited proposals from partially applying.
  if (output.kind === 'reconciliation') {
    for (const draft of output.create) {
      for (const targetId of draft.supersedes ?? []) {
        const target = await uow.requirements.findById(targetId);
        if (!target) {
          throw new InvalidOperationError(`cannot supersede unknown requirement: ${targetId}`);
        }
        if (target.ticketId !== ticket.id) {
          throw new InvalidOperationError('cannot supersede a requirement from another ticket');
        }
      }
    }
  }

  if (output.kind === 'extraction') {
    const createdIds: string[] = [];
    for (const draft of output.requirements) {
      const created = await createRequirementFromDraft(
        uow,
        ticket.projectId,
        ticket.id,
        proposal,
        draft,
        now,
      );
      createdIds.push(created.id);
    }
    await applyProposedOrder(uow, ticket.id, output.proposedOrder ?? null, createdIds, null, now);
  } else if (output.kind === 'reconciliation') {
    const createdIds: string[] = [];
    const preApprovalActive = await uow.requirements.listActiveByTicket(ticket.id);
    const preApprovalIds = new Set(preApprovalActive.map((item) => item.id));
    for (const draft of output.create) {
      const created = await createRequirementFromDraft(
        uow,
        ticket.projectId,
        ticket.id,
        proposal,
        draft,
        now,
      );
      createdIds.push(created.id);
      for (const targetId of draft.supersedes ?? []) {
        const target = await uow.requirements.findById(targetId);
        // Targets were checked in the preflight above.
        if (!target)
          throw new InvalidOperationError(`cannot supersede unknown requirement: ${targetId}`);
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
    await applyProposedOrder(
      uow,
      ticket.id,
      output.proposedOrder ?? null,
      createdIds,
      preApprovalIds,
      now,
    );
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

async function applyProposedOrder(
  uow: UnitOfWork,
  ticketId: string,
  proposedOrder: ProposedOrder | null,
  createdIds: string[],
  preApprovalIds: Set<string> | null,
  now: string,
): Promise<void> {
  if (!proposedOrder) return;
  const created = new Set(createdIds);
  const active = await uow.requirements.listActiveByTicket(ticketId);
  // Rank only the requirements the agent actually saw. Rows created by this
  // approval and rows superseded by it are never part of the proposal's
  // dependency order, so they keep their appended positions.
  const rankable = new Set(
    [...(preApprovalIds ?? new Set(active.map((item) => item.id)))].filter((id) => {
      const row = active.find((item) => item.id === id);
      return row !== undefined && row.lifecycleStatus === 'active' && !created.has(id);
    }),
  );
  const ordered = proposedOrder.orderedIds.filter((id) => rankable.has(id));
  if (ordered.length === 0) return;
  const seen = new Set(ordered);
  if (seen.size !== ordered.length) {
    throw new InvalidOperationError('proposal order contains a duplicate id');
  }
  const orderedSet = new Set(ordered);
  const trailing = active
    .filter((item) => !orderedSet.has(item.id))
    .sort((a, b) => a.displayOrder - b.displayOrder);
  const sequence = [
    ...ordered
      .map((id) => active.find((item) => item.id === id))
      .filter((item): item is Requirement => Boolean(item)),
    ...trailing,
  ];
  for (let index = 0; index < sequence.length; index += 1) {
    const item = sequence[index];
    if (!item) continue;
    await uow.requirements.update({ ...item, displayOrder: index, updatedAt: now });
  }
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
  for (const text of draft.successCriteria ?? draft.scenarios ?? []) {
    const row: Scenario = {
      id: newId(),
      requirementId: requirement.id,
      text: text.trim(),
      reviewed: false,
      createdAt: now,
    };
    await uow.requirements.addScenario(row);
  }
  // Keep the business requirement as context and make each developer action a
  // separately checkable child. Older proposals without implementationItems
  // retain their existing one-row behavior.
  for (const item of draft.implementationItems ?? []) {
    await uow.requirements.create({
      ...requirement,
      id: newId(),
      title: item.trim(),
      description: `Developer work for: ${requirement.title}`,
      parentId: requirement.id,
      parentLabel: requirement.title,
      displayOrder: await nextDisplayOrder(uow, ticketId),
      createdAt: now,
      updatedAt: now,
    });
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
