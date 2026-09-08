import {
  buildChecklistView,
  type ChecklistItem,
  type ChecklistView,
  NotFoundError,
} from '@trachex/domain';
import type { AppContext } from '../app.ts';
import { print, printJson } from '../io.ts';

export async function checklistList(
  ctx: AppContext,
  args: { key: string; project: string; json: boolean },
) {
  const project = await ctx.uow.projects.findBySlug(args.project);
  if (!project) {
    throw new NotFoundError('project', args.project);
  }
  const view = await buildChecklistView(ctx.uow, { projectId: project.id, ticketKey: args.key });
  if (args.json) {
    printJson(view);
    return;
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
