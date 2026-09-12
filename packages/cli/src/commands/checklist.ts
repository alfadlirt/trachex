import {
  buildChecklistView,
  type ChecklistItem,
  type ChecklistTree,
  type ChecklistView,
  NotFoundError,
} from '@trachex/domain';
import type { AppContext } from '../app.ts';
import { banner } from '../context.ts';
import { print, printJson } from '../io.ts';
import { resolveSubjectTicket } from '../lib/subject.ts';

export async function checklistList(
  ctx: AppContext,
  args: { subjectId: string; project?: string; json: boolean; quiet?: boolean },
) {
  const { subject, ticket } = await resolveSubjectTicket(ctx.uow, args.subjectId, args.project);
  const project = await ctx.uow.projects.findById(subject.projectId);
  if (!project) throw new NotFoundError('project', subject.projectId);
  const view = await buildChecklistView(ctx.uow, { projectId: project.id, ticketKey: ticket.key });
  if (args.json) {
    printJson(view);
    return;
  }
  if (!args.quiet) {
    print(banner({ projectName: project.name }));
  }
  print(`Checklist: ${view.ticketKey} — ${view.title}`);
  print('');
  for (const group of view.groups) {
    print(`# ${group.label}`);
    for (const item of group.items) {
      const box = item.devStatus === 'checked' ? '[x]' : '[ ]';
      print(`  ${box} ${item.title}`);
      printItemDetail(item, '      ');
    }
  }
  print('');
  print('Tree:');
  for (const root of view.tree) {
    printTree(root, '');
  }
  if (view.groups.length === 0) {
    print('(no active items — checklist is empty)');
  }
  if (view.superseded.length > 0) {
    print('');
    print('# Superseded');
    for (const entry of view.superseded) {
      const by = entry.supersededByTitle ? ` (superseded by ${entry.supersededByTitle})` : '';
      print(`  ~~${entry.item.title}~~${by}`);
      printItemDetail(entry.item, '      ');
    }
  }
}

function printTree(tree: ChecklistTree, indent: string): void {
  const item = tree.item;
  const box = item.devStatus === 'checked' ? '[x]' : '[ ]';
  print(`${indent}${box} ${item.title}`);
  printItemDetail(item, `${indent}    `);
  for (const child of tree.children) {
    printTree(child, `${indent}    `);
  }
}

function printItemDetail(item: ChecklistItem, indent: string): void {
  if (item.description) {
    print(`${indent}${item.description}`);
  }
  const chips: string[] = [];
  if (item.source) {
    const where = item.source.location ?? '';
    const who = item.source.attribution ? ` (${item.source.attribution})` : '';
    chips.push(`${item.source.type}${who}${where ? ` ${where}` : ''}`);
  }
  for (const impact of item.impacts) {
    chips.push(`${impact.kind}:${impact.value}`);
  }
  for (const scenario of item.scenarios) {
    chips.push(`scenario: ${scenario.text}`);
  }
  if (chips.length > 0) {
    print(`${indent}${chips.join('  ·  ')}`);
  }
}

export type { ChecklistView };

export interface ChecklistAddArgs {
  subjectId: string;
  project?: string;
  title: string;
  description?: string;
  parent?: string;
  parentId?: string;
  from?: string;
  note?: string;
  json: boolean;
}

export async function checklistAdd(ctx: AppContext, args: ChecklistAddArgs) {
  const ticket = await subjectTicket(ctx, args.subjectId, args.project);
  const { addRequirementManual } = await import('@trachex/domain');
  const requirement = await addRequirementManual(ctx.uow, {
    ticketId: ticket.id,
    title: args.title,
    ...(args.description !== undefined ? { description: args.description } : {}),
    ...(args.parent !== undefined ? { parentLabel: args.parent } : {}),
    ...(args.parentId !== undefined ? { parentId: args.parentId } : {}),
    ...(args.from !== undefined ? { actorId: args.from } : {}),
    ...(args.note !== undefined ? { note: args.note } : {}),
    actorType: 'human',
  });
  if (args.json) {
    printJson({ requirement });
    return;
  }
  print(`added ${requirement.id} (${requirement.title})`);
}

export interface ChecklistEditArgs {
  subjectId: string;
  project?: string;
  requirementId: string;
  title?: string;
  description?: string;
  parent?: string;
  from?: string;
  note?: string;
  json: boolean;
}

export async function checklistEdit(ctx: AppContext, args: ChecklistEditArgs) {
  const ticket = await subjectTicket(ctx, args.subjectId, args.project);
  const { editRequirementContent } = await import('@trachex/domain');
  const requirement = await editRequirementContent(ctx.uow, {
    ticketId: ticket.id,
    requirementId: args.requirementId,
    ...(args.title !== undefined ? { title: args.title } : {}),
    ...(args.description !== undefined ? { description: args.description } : {}),
    ...(args.parent !== undefined ? { parentLabel: args.parent } : {}),
    ...(args.from !== undefined ? { actorId: args.from } : {}),
    ...(args.note !== undefined ? { note: args.note } : {}),
    actorType: 'human',
  });
  if (args.json) {
    printJson({ requirement });
    return;
  }
  print(`edited -> ${requirement.id} (${requirement.title}); old superseded`);
}

export interface ChecklistSupersedeArgs {
  subjectId: string;
  project?: string;
  requirementId: string;
  from?: string;
  note?: string;
  json: boolean;
}

export async function checklistSupersede(ctx: AppContext, args: ChecklistSupersedeArgs) {
  const ticket = await subjectTicket(ctx, args.subjectId, args.project);
  const { supersedeRequirement } = await import('@trachex/domain');
  const requirement = await supersedeRequirement(ctx.uow, {
    ticketId: ticket.id,
    requirementId: args.requirementId,
    ...(args.from !== undefined ? { actorId: args.from } : {}),
    ...(args.note !== undefined ? { note: args.note } : {}),
    actorType: 'human',
  });
  if (args.json) {
    printJson({ requirement });
    return;
  }
  print(`superseded ${args.requirementId}`);
}

export interface ChecklistReorderArgs {
  subjectId: string;
  project?: string;
  order: string[];
  json: boolean;
}

export async function checklistReorder(ctx: AppContext, args: ChecklistReorderArgs) {
  const ticket = await subjectTicket(ctx, args.subjectId, args.project);
  const { reorderChecklist } = await import('@trachex/domain');
  await reorderChecklist(ctx.uow, { ticketId: ticket.id, orderedIds: args.order });
  if (args.json) {
    printJson({ subjectId: args.subjectId, order: args.order });
    return;
  }
  print(`reordered ${args.order.length} items`);
}

async function subjectTicket(ctx: AppContext, subjectId: string, project?: string) {
  const { ticket } = await resolveSubjectTicket(ctx.uow, subjectId, project);
  return ticket;
}
