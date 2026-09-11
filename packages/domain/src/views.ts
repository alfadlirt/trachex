import type { Impact, Requirement, Scenario, Source } from './entities.ts';
import { NotFoundError } from './errors.ts';
import type { UnitOfWork } from './repositories.ts';

export interface TicketStatus {
  key: string;
  title: string;
  checked: number;
  active: number;
  remaining: number;
  openProposals: number;
  updatedAt: string;
}

export interface ProjectStatus {
  projectSlug: string;
  projectName: string;
  updatedAt: string;
  totals: {
    tickets: number;
    active: number;
    checked: number;
    remaining: number;
    openProposals: number;
  };
  tickets: TicketStatus[];
}

export async function buildProjectStatus(
  uow: UnitOfWork,
  projectId: string,
): Promise<ProjectStatus> {
  const project = await uow.projects.findById(projectId);
  if (!project) {
    throw new NotFoundError('project', projectId);
  }
  const tickets = await uow.tickets.listByProject(projectId);

  const ticketRows: TicketStatus[] = [];
  let maxUpdated = '';
  let totalActive = 0;
  let totalChecked = 0;
  let totalRemaining = 0;
  let totalOpenProposals = 0;

  for (const ticket of tickets) {
    const requirements = await uow.requirements.listByTicket(ticket.id);
    const active = requirements.filter((r) => r.lifecycleStatus === 'active');
    const checked = active.filter((r) => r.devStatus === 'checked').length;
    const remaining = active.length - checked;
    const proposals = await uow.proposals.listByTicket(ticket.id);
    const openProposals = proposals.filter((p) => p.status === 'pending').length;

    let ticketUpdated = ticket.updatedAt;
    for (const requirement of requirements) {
      if (requirement.updatedAt > ticketUpdated) ticketUpdated = requirement.updatedAt;
      for (const audit of await uow.completionAudits.listByRequirement(requirement.id)) {
        if (audit.checkedAt > ticketUpdated) ticketUpdated = audit.checkedAt;
      }
    }
    for (const source of await uow.sources.listByTicket(ticket.id)) {
      if (source.ingestedAt > ticketUpdated) ticketUpdated = source.ingestedAt;
    }
    for (const proposal of proposals) {
      if (proposal.createdAt > ticketUpdated) ticketUpdated = proposal.createdAt;
      if (proposal.updatedAt > ticketUpdated) ticketUpdated = proposal.updatedAt;
    }

    ticketRows.push({
      key: ticket.key,
      title: ticket.title,
      active: active.length,
      checked,
      remaining,
      openProposals,
      updatedAt: ticketUpdated,
    });
    if (ticketUpdated > maxUpdated) maxUpdated = ticketUpdated;
    totalActive += active.length;
    totalChecked += checked;
    totalRemaining += remaining;
    totalOpenProposals += openProposals;
  }

  return {
    projectSlug: project.slug,
    projectName: project.name,
    updatedAt: maxUpdated || project.updatedAt,
    totals: {
      tickets: tickets.length,
      active: totalActive,
      checked: totalChecked,
      remaining: totalRemaining,
      openProposals: totalOpenProposals,
    },
    tickets: ticketRows,
  };
}

export interface ChecklistItem {
  id: string;
  title: string;
  description: string | null;
  devStatus: Requirement['devStatus'];
  parentLabel: string | null;
  parentId: string | null;
  displayOrder: number;
  source: Pick<Source, 'type' | 'attribution' | 'location'> | null;
  impacts: Pick<Impact, 'kind' | 'value'>[];
  scenarios: Pick<Scenario, 'text'>[];
}

export interface ChecklistTree {
  item: ChecklistItem;
  children: ChecklistTree[];
}

/**
 * Build an arbitrary-depth tree from the flat active list. Items with a
 * parentId are nested under their parent; root items are ordered by
 * display_order (falling back to createdAt via the repository ordering).
 * Orphans (parent missing or superseded) degrade to roots.
 */
export function buildChecklistTree(items: ChecklistItem[]): ChecklistTree[] {
  const byId = new Map<string, ChecklistTree>();
  for (const item of items) {
    byId.set(item.id, { item, children: [] });
  }
  const roots: ChecklistTree[] = [];
  for (const tree of byId.values()) {
    const parent = tree.item.parentId ? byId.get(tree.item.parentId) : undefined;
    if (parent) {
      parent.children.push(tree);
    } else {
      roots.push(tree);
    }
  }
  const sort = (trees: ChecklistTree[]) => {
    trees.sort((a, b) => a.item.displayOrder - b.item.displayOrder);
  };
  const sortAll = (trees: ChecklistTree[]) => {
    sort(trees);
    for (const tree of trees) sortAll(tree.children);
  };
  sortAll(roots);
  return roots;
}

export interface ChecklistGroup {
  label: string;
  items: ChecklistItem[];
}

export interface SupersededEntry {
  item: ChecklistItem;
  supersededByTitle: string | null;
}

export interface ChecklistView {
  ticketKey: string;
  title: string;
  groups: ChecklistGroup[];
  tree: ChecklistTree[];
  superseded: SupersededEntry[];
}

export async function buildChecklistView(
  uow: UnitOfWork,
  input: { projectId: string; ticketKey: string },
): Promise<ChecklistView> {
  const project = await uow.projects.findById(input.projectId);
  if (!project) {
    throw new NotFoundError('project', input.projectId);
  }
  const ticket = await uow.tickets.findByProjectAndKey(input.projectId, input.ticketKey);
  if (!ticket) {
    throw new NotFoundError('ticket', input.ticketKey);
  }

  const impacts = await uow.requirements.listImpactsByTicket(ticket.id);
  const scenarios = await uow.requirements.listScenariosByTicket(ticket.id);
  const sources = await uow.sources.listByTicket(ticket.id);
  const sourceById = new Map(sources.map((s) => [s.id, s]));
  const relationships = await uow.requirements.listRelationshipsByTicket(ticket.id);

  const toItem = (requirement: Requirement): ChecklistItem => {
    const source = requirement.sourceId ? (sourceById.get(requirement.sourceId) ?? null) : null;
    return {
      id: requirement.id,
      title: requirement.title,
      description: requirement.description,
      devStatus: requirement.devStatus,
      parentLabel: requirement.parentLabel,
      parentId: requirement.parentId,
      displayOrder: requirement.displayOrder,
      source: source
        ? { type: source.type, attribution: source.attribution, location: source.location }
        : null,
      impacts: impacts
        .filter((i) => i.requirementId === requirement.id)
        .map((i) => ({ kind: i.kind, value: i.value })),
      scenarios: scenarios
        .filter((s) => s.requirementId === requirement.id)
        .map((s) => ({ text: s.text })),
    };
  };

  const active = await uow.requirements.listActiveByTicket(ticket.id);
  const groups = new Map<string, ChecklistItem[]>();
  for (const requirement of active) {
    const label = requirement.parentLabel ?? '(ungrouped)';
    const list = groups.get(label) ?? [];
    list.push(toItem(requirement));
    groups.set(label, list);
  }

  const supersededRequirements = await uow.requirements.listSupersededByTicket(ticket.id);
  const supersededByTitle = new Map<string, string | null>();
  for (const rel of relationships) {
    if (rel.type === 'supersedes') {
      const oldReq = supersededRequirements.find((r) => r.id === rel.toRequirementId);
      if (oldReq) {
        const newer = active.find((r) => r.id === rel.fromRequirementId);
        supersededByTitle.set(oldReq.id, newer?.title ?? null);
      }
    }
  }
  const superseded = supersededRequirements.map((requirement) => ({
    item: toItem(requirement),
    supersededByTitle: supersededByTitle.get(requirement.id) ?? null,
  }));

  return {
    ticketKey: ticket.key,
    title: ticket.title,
    groups: [...groups.entries()].map(([label, items]) => ({ label, items })),
    tree: buildChecklistTree(active.map(toItem)),
    superseded,
  };
}
