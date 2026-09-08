import type { CompletionAudit, Impact, ImpactKind, Requirement, SourceType } from './entities.ts';
import { InvalidOperationError, NotFoundError } from './errors.ts';
import { newId, nowIso } from './ids.ts';
import type { UnitOfWork } from './repositories.ts';
import { nextDisplayOrder } from './services.ts';

export interface ManualEditActor {
  actorType: CompletionAudit['actorType'];
  actorId?: string;
  note?: string;
}

export interface AddRequirementManualInput extends ManualEditActor {
  ticketId: string;
  title: string;
  description?: string;
  parentLabel?: string;
  sourceType?: SourceType;
  attribution?: string;
  impacts?: { kind: ImpactKind; value: string }[];
}

export async function addRequirementManual(
  uow: UnitOfWork,
  input: AddRequirementManualInput,
): Promise<Requirement> {
  const ticket = await uow.tickets.findById(input.ticketId);
  if (!ticket) {
    throw new NotFoundError('ticket', input.ticketId);
  }
  const now = nowIso();
  const attribution = input.attribution?.trim() || input.actorId?.trim() || input.actorType;
  const source = await uow.sources.create({
    id: newId(),
    ticketId: input.ticketId,
    type: input.sourceType ?? 'manual',
    attribution,
    sourceEventAt: null,
    ingestedAt: now,
    snapshotId: null,
    location: null,
    note: input.note?.trim() || null,
  });
  const requirement: Requirement = {
    id: newId(),
    projectId: ticket.projectId,
    ticketId: input.ticketId,
    title: input.title.trim(),
    description: input.description?.trim() || null,
    sourceId: source.id,
    sourceLocation: null,
    lifecycleStatus: 'active',
    devStatus: 'unchecked',
    parentLabel: input.parentLabel?.trim() || null,
    displayOrder: await nextDisplayOrder(uow, input.ticketId),
    createdAt: now,
    updatedAt: now,
  };
  await uow.requirements.create(requirement);
  for (const impact of input.impacts ?? []) {
    const row: Impact = {
      id: newId(),
      requirementId: requirement.id,
      kind: impact.kind,
      value: impact.value.trim(),
      createdAt: now,
    };
    await uow.requirements.addImpact(row);
  }
  return requirement;
}

export interface EditRequirementContentInput extends ManualEditActor {
  ticketId: string;
  requirementId: string;
  title?: string;
  description?: string;
  parentLabel?: string;
}

export async function editRequirementContent(
  uow: UnitOfWork,
  input: EditRequirementContentInput,
): Promise<Requirement> {
  const old = await uow.requirements.findById(input.requirementId);
  if (!old) {
    throw new NotFoundError('requirement', input.requirementId);
  }
  if (old.ticketId !== input.ticketId) {
    throw new InvalidOperationError('requirement does not belong to the given ticket');
  }
  if (old.lifecycleStatus !== 'active') {
    throw new InvalidOperationError('only active requirements can be edited');
  }
  const now = nowIso();
  const attribution = input.actorId?.trim() || input.actorType;
  const source = await uow.sources.create({
    id: newId(),
    ticketId: input.ticketId,
    type: 'manual',
    attribution,
    sourceEventAt: null,
    ingestedAt: now,
    snapshotId: null,
    location: null,
    note: input.note?.trim() || null,
  });

  const created: Requirement = {
    id: newId(),
    projectId: old.projectId,
    ticketId: old.ticketId,
    title: (input.title ?? old.title).trim(),
    description: (input.description ?? old.description)?.trim() || null,
    sourceId: source.id,
    sourceLocation: null,
    lifecycleStatus: 'active',
    devStatus: old.devStatus,
    parentLabel: (input.parentLabel ?? old.parentLabel)?.trim() || null,
    displayOrder: old.displayOrder,
    createdAt: now,
    updatedAt: now,
  };
  await uow.requirements.create(created);

  // Copy impacts and scenarios from the superseded item.
  for (const impact of await uow.requirements.listImpactsByTicket(old.ticketId)) {
    if (impact.requirementId === old.id) {
      await uow.requirements.addImpact({
        id: newId(),
        requirementId: created.id,
        kind: impact.kind,
        value: impact.value,
        createdAt: now,
      });
    }
  }
  for (const scenario of await uow.requirements.listScenariosByTicket(old.ticketId)) {
    if (scenario.requirementId === old.id) {
      await uow.requirements.addScenario({
        id: newId(),
        requirementId: created.id,
        text: scenario.text,
        reviewed: scenario.reviewed,
        createdAt: now,
      });
    }
  }

  await uow.requirements.update({ ...old, lifecycleStatus: 'superseded', updatedAt: now });
  await uow.requirements.addRelationship({
    id: newId(),
    fromRequirementId: created.id,
    toRequirementId: old.id,
    type: 'supersedes',
    createdAt: now,
  });
  return created;
}

export interface SupersedeRequirementInput extends ManualEditActor {
  ticketId: string;
  requirementId: string;
}

export async function supersedeRequirement(
  uow: UnitOfWork,
  input: SupersedeRequirementInput,
): Promise<Requirement> {
  const requirement = await uow.requirements.findById(input.requirementId);
  if (!requirement) {
    throw new NotFoundError('requirement', input.requirementId);
  }
  if (requirement.ticketId !== input.ticketId) {
    throw new InvalidOperationError('requirement does not belong to the given ticket');
  }
  if (requirement.lifecycleStatus !== 'active') {
    throw new InvalidOperationError('only active requirements can be superseded');
  }
  const updated: Requirement = {
    ...requirement,
    lifecycleStatus: 'superseded',
    updatedAt: nowIso(),
  };
  await uow.requirements.update(updated);
  return updated;
}

export interface ReorderChecklistInput {
  ticketId: string;
  orderedIds: string[];
}

export async function reorderChecklist(
  uow: UnitOfWork,
  input: ReorderChecklistInput,
): Promise<void> {
  const active = await uow.requirements.listActiveByTicket(input.ticketId);
  const activeIds = new Set(active.map((r) => r.id));
  const orderedSet = new Set(input.orderedIds);
  if (orderedSet.size !== activeIds.size || ![...orderedSet].every((id) => activeIds.has(id))) {
    throw new InvalidOperationError(
      'reorder ids must match the set of active requirements exactly',
    );
  }
  const byId = new Map(active.map((r) => [r.id, r]));
  const now = nowIso();
  for (let index = 0; index < input.orderedIds.length; index++) {
    const id = input.orderedIds[index];
    const requirement = id ? byId.get(id) : undefined;
    if (!id || !requirement) {
      throw new InvalidOperationError(`unknown requirement: ${id}`);
    }
    await uow.requirements.update({ ...requirement, displayOrder: index, updatedAt: now });
  }
}

export interface UncheckRequirementInput extends ManualEditActor {
  requirementId: string;
}

export async function uncheckRequirement(
  uow: UnitOfWork,
  input: UncheckRequirementInput,
): Promise<CompletionAudit> {
  const requirement = await uow.requirements.findById(input.requirementId);
  if (!requirement) {
    throw new NotFoundError('requirement', input.requirementId);
  }
  const now = nowIso();
  await uow.requirements.update({ ...requirement, devStatus: 'unchecked', updatedAt: now });
  const audit: CompletionAudit = {
    id: newId(),
    requirementId: requirement.id,
    actorType: input.actorType,
    actorId: input.actorId?.trim() || null,
    note: input.note?.trim() || null,
    action: 'uncheck',
    checkedAt: now,
  };
  await uow.completionAudits.create(audit);
  return audit;
}
