import { cancel, intro, isCancel, multiselect, outro, select, spinner, text } from '@clack/prompts';
import {
  buildChecklistView,
  type ChecklistItem,
  type ChecklistTree,
  checkRequirement,
  createSubject,
  editRequirementContent,
  reorderChecklist,
  supersedeRequirement,
  uncheckRequirement,
} from '@trachex/domain';
import type { AppContext } from '../app.ts';
import { readGlobalConfig, writeGlobalConfig } from '../context.ts';
import { print } from '../io.ts';

const ansi = {
  reset: '\u001b[0m',
  bold: '\u001b[1m',
  cyan: '\u001b[36m',
  blue: '\u001b[34m',
  green: '\u001b[32m',
  yellow: '\u001b[33m',
  red: '\u001b[31m',
  dim: '\u001b[2m',
};

function style(value: string, color: keyof typeof ansi, enabled: boolean): string {
  return enabled ? `${ansi[color]}${value}${ansi.reset}` : value;
}

function result<T>(value: T | symbol, label: string): T | null {
  if (isCancel(value)) {
    cancel(label);
    return null;
  }
  return value as T;
}

function flattenTree(
  tree: ChecklistTree[],
  depth = 0,
): Array<{ item: ChecklistItem; depth: number }> {
  const rows: Array<{ item: ChecklistItem; depth: number }> = [];
  for (const node of tree) {
    rows.push({ item: node.item, depth });
    rows.push(...flattenTree(node.children, depth + 1));
  }
  return rows;
}

function renderTree(tree: ChecklistTree[], enabled: boolean): void {
  for (const node of tree) {
    const checked = node.item.devStatus === 'checked';
    const marker = checked ? style('●', 'green', enabled) : style('○', 'yellow', enabled);
    const title = checked
      ? style(node.item.title, 'dim', enabled)
      : style(node.item.title, 'bold', enabled);
    print(`${'  '.repeat(node.item.parentId ? 2 : 1)}${marker} ${title}`);
    renderTree(node.children, enabled);
  }
}

async function chooseProject(ctx: AppContext, active?: string) {
  const projects = await ctx.uow.projects.list();
  if (projects.length === 0) return null;
  const selected = result(
    await select({
      message: 'Choose a project',
      initialValue: active,
      options: projects.map((project) => ({
        value: project.slug,
        label: project.name,
        hint: project.slug,
      })),
    }),
    'TUI cancelled',
  );
  return selected ? (projects.find((project) => project.slug === selected) ?? null) : null;
}

async function chooseSubject(ctx: AppContext, projectId: string, active?: string) {
  const subjects = await ctx.uow.subjects.listByProject(projectId);
  if (subjects.length === 0) {
    const name = result(
      await text({ message: 'No subjects yet. Subject name:' }),
      'Subject creation cancelled',
    );
    if (!name) return null;
    return createSubject(ctx.uow, { projectId, name });
  }
  const selected = result(
    await select({
      message: 'Choose a subject',
      initialValue: active,
      options: subjects.map((subject) => ({
        value: subject.id,
        label: subject.name,
        hint: subject.id,
      })),
    }),
    'TUI cancelled',
  );
  return selected ? (subjects.find((subject) => subject.id === selected) ?? null) : null;
}

async function addItem(ctx: AppContext, ticketId: string, parentId?: string): Promise<void> {
  const title = result(await text({ message: 'Checklist item title:' }), 'Add cancelled');
  if (!title) return;
  const description = result(await text({ message: 'Description (optional):' }), 'Add cancelled');
  if (description === null) return;
  const { addRequirementManual } = await import('@trachex/domain');
  await addRequirementManual(ctx.uow, {
    ticketId,
    title,
    ...(description ? { description } : {}),
    ...(parentId ? { parentId } : {}),
    actorType: 'human',
  });
}

async function editItem(ctx: AppContext, item: ChecklistItem, ticketId: string): Promise<void> {
  const title = result(
    await text({ message: 'Title:', initialValue: item.title }),
    'Edit cancelled',
  );
  if (!title) return;
  const description = result(
    await text({ message: 'Description:', initialValue: item.description ?? '' }),
    'Edit cancelled',
  );
  if (description === null) return;
  await editRequirementContent(ctx.uow, {
    ticketId,
    requirementId: item.id,
    title,
    description,
    actorType: 'human',
  });
}

async function reorderItems(
  ctx: AppContext,
  ticketId: string,
  items: ChecklistItem[],
): Promise<void> {
  const selected = result(
    await multiselect({
      message: 'Select items in the desired order, then press enter',
      options: items.map((item) => ({ value: item.id, label: item.title })),
      required: true,
    }),
    'Reorder cancelled',
  );
  if (!selected) return;
  await reorderChecklist(ctx.uow, { ticketId, orderedIds: selected as string[] });
}

async function updateSettings(ctx: AppContext): Promise<void> {
  const config = readGlobalConfig(ctx.appDir);
  const mode = result(
    await select({
      message: 'Terminal color mode',
      initialValue: config.theme?.mode ?? 'auto',
      options: [
        { value: 'auto', label: 'Auto', hint: 'use terminal capabilities' },
        { value: 'dark', label: 'Dark' },
        { value: 'light', label: 'Light' },
        { value: 'no-color', label: 'No color' },
      ],
    }),
    'Settings cancelled',
  );
  if (!mode) return;
  const accent = result(
    await text({
      message: 'Accent color name (optional):',
      initialValue: config.theme?.accent ?? '',
    }),
    'Settings cancelled',
  );
  if (accent === null) return;
  writeGlobalConfig(
    {
      ...config,
      theme: {
        mode: mode as 'auto' | 'dark' | 'light' | 'no-color',
        ...(accent ? { accent } : {}),
      },
    },
    ctx.appDir,
  );
}

export async function tui(ctx: AppContext): Promise<void> {
  const config = readGlobalConfig(ctx.appDir);
  const colorsEnabled = config.theme?.mode !== 'no-color';
  const project = await chooseProject(ctx, config.activeProject);
  if (!project) return;
  const subject = await chooseSubject(ctx, project.id, config.activeSubject);
  if (!subject) return;
  writeGlobalConfig(
    { ...config, activeProject: project.slug, activeSubject: subject.id },
    ctx.appDir,
  );

  const tickets = await ctx.uow.tickets.listByProject(project.id);
  // Subjects share their immutable id with the backing ticket row (see
  // entities.Subject), so the subject's checklist is the ticket with the same
  // id. Never fall back to an unrelated ticket — mutating the wrong checklist
  // would be a scope leak.
  const subjectTicket = tickets.find((ticket) => ticket.id === subject.id) ?? null;
  if (!subjectTicket) {
    outro('No checklist is linked to this subject yet.');
    return;
  }

  intro(style(`TRACHEX  ${project.name}  /  ${subject.name}`, 'cyan', colorsEnabled));
  let running = true;
  while (running) {
    const view = await buildChecklistView(ctx.uow, {
      projectId: project.id,
      ticketKey: subjectTicket.key,
    });
    print('');
    print(style(` Project ${project.slug}  ·  Subject ${subject.name} `, 'blue', colorsEnabled));
    print(style(' Checklist', 'bold', colorsEnabled));
    renderTree(view.tree, colorsEnabled);

    const rows = flattenTree(view.tree);
    const selectedId = result(
      await select({
        message: 'Select an item or workspace action',
        options: [
          { value: '__add__', label: 'Add checklist item', hint: 'form' },
          { value: '__settings__', label: 'Settings', hint: 'theme and colors' },
          { value: '__quit__', label: 'Exit TUI' },
          ...rows.map(({ item, depth }) => ({
            value: item.id,
            label: `${'  '.repeat(depth)}${item.devStatus === 'checked' ? '✓' : '○'} ${item.title}`,
            hint: item.id,
          })),
        ],
      }),
      'TUI cancelled',
    );
    if (!selectedId || selectedId === '__quit__') {
      running = false;
      continue;
    }
    if (selectedId === '__settings__') {
      await updateSettings(ctx);
      continue;
    }
    if (selectedId === '__add__') {
      await addItem(ctx, subjectTicket.id);
      continue;
    }
    const item = rows.find(({ item: candidate }) => candidate.id === selectedId)?.item;
    if (!item) continue;
    const action = result(
      await select({
        message: `${item.title}`,
        options: [
          { value: 'toggle', label: item.devStatus === 'checked' ? 'Uncheck' : 'Check' },
          { value: 'edit', label: 'Edit', hint: 'form' },
          { value: 'add-child', label: 'Add child', hint: 'form' },
          { value: 'supersede', label: 'Supersede', hint: 'keep history' },
          { value: 'reorder', label: 'Reorder checklist', hint: 'select order' },
          { value: 'back', label: 'Back' },
        ],
      }),
      'Action cancelled',
    );
    if (!action || action === 'back') continue;
    const spin = spinner();
    spin.start('Updating checklist');
    try {
      if (action === 'toggle') {
        if (item.devStatus === 'checked') {
          await uncheckRequirement(ctx.uow, { requirementId: item.id, actorType: 'human' });
        } else {
          await checkRequirement(ctx.uow, { requirementId: item.id, actorType: 'human' });
        }
      } else if (action === 'edit') {
        spin.stop('Opening edit form');
        await editItem(ctx, item, subjectTicket.id);
        continue;
      } else if (action === 'add-child') {
        spin.stop('Opening add form');
        await addItem(ctx, subjectTicket.id, item.id);
        continue;
      } else if (action === 'supersede') {
        await supersedeRequirement(ctx.uow, {
          ticketId: subjectTicket.id,
          requirementId: item.id,
          actorType: 'human',
        });
      } else if (action === 'reorder') {
        spin.stop('Opening reorder form');
        await reorderItems(
          ctx,
          subjectTicket.id,
          rows.map(({ item: rowItem }) => rowItem),
        );
        continue;
      }
      spin.stop('Checklist updated');
    } catch (error) {
      spin.stop('Checklist update failed');
      const message = error instanceof Error ? error.message : String(error);
      print(style(`Error: ${message}`, 'red', colorsEnabled));
    }
  }
  outro('TUI closed');
}
