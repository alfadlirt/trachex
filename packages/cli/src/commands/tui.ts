import { readFile } from 'node:fs/promises';
import { request } from 'node:https';
import { cancel, intro, isCancel, multiselect, outro, select, spinner, text } from '@clack/prompts';
import { runExtraction } from '@trachex/agent';
import {
  archiveProject,
  archiveRequirement,
  archiveSubject,
  buildChecklistView,
  type ChecklistItem,
  type ChecklistTree,
  checkRequirement,
  createSubject,
  editRequirementContent,
  permanentlyDeleteProject,
  permanentlyDeleteSubject,
  reorderChecklist,
  supersedeRequirement,
  uncheckRequirement,
} from '@trachex/domain';
import { buildRunAgent } from '../agent-wiring.ts';
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

function renderHistory(
  view: Awaited<ReturnType<typeof buildChecklistView>>,
  enabled: boolean,
): void {
  if (view.superseded.length === 0 && view.archived.length === 0) return;
  print(style(' History', 'dim', enabled));
  for (const entry of view.superseded) {
    print(
      `  ${style('[superseded]', 'yellow', enabled)} ${entry.item.title}${entry.supersededByTitle ? ` → ${entry.supersededByTitle}` : ''}`,
    );
  }
  for (const item of view.archived) {
    print(
      `  ${style('[archived]', 'dim', enabled)} ${item.title}${item.parentId ? ` (parent ${item.parentId})` : ''}`,
    );
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

async function intakeEvidence(ctx: AppContext, projectId: string, ticketId: string): Promise<void> {
  const mode = result(
    await select({
      message: 'Evidence intake',
      options: [
        { value: 'text', label: 'Paste requirement text' },
        { value: 'file', label: 'Read a local file' },
        { value: 'note', label: 'Requirement description or note' },
        { value: 'url', label: 'Snapshot a URL' },
        { value: 'back', label: 'Back' },
      ],
    }),
    'Intake cancelled',
  );
  if (!mode || mode === 'back') return;
  let content: string;
  let relPath: string;
  let location: string | undefined;
  if (mode === 'text' || mode === 'note') {
    const pasted = result(
      await text({
        message: 'Paste requirement text (multiline):',
        validate: (value) => (value?.trim() ? undefined : 'Text is required'),
      }),
      'Text intake cancelled',
    );
    if (!pasted) return;
    content = pasted;
    relPath = mode === 'note' ? 'tui-note.txt' : 'tui-pasted-requirements.txt';
  } else if (mode === 'url') {
    const url = result(await text({ message: 'URL:' }), 'URL intake cancelled');
    if (!url) return;
    try {
      content = await new Promise<string>((resolve, reject) => {
        request(url, (response) => {
          if ((response.statusCode ?? 500) >= 400) {
            reject(new Error(`URL returned HTTP ${response.statusCode ?? 'error'}`));
            response.resume();
            return;
          }
          const chunks: Buffer[] = [];
          response.on('data', (chunk: Buffer) => chunks.push(chunk));
          response.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
        })
          .on('error', reject)
          .end();
      });
    } catch (error) {
      print(`Unable to snapshot URL: ${error instanceof Error ? error.message : String(error)}`);
      return;
    }
    relPath = url;
    location = url;
  } else {
    const path = result(await text({ message: 'Local file path:' }), 'File intake cancelled');
    if (!path) return;
    try {
      content = await readFile(path, 'utf8');
    } catch (error) {
      print(`Unable to read file: ${error instanceof Error ? error.message : String(error)}`);
      return;
    }
    relPath = path;
    location = path;
  }
  const attribution = result(
    await text({ message: 'Attribution (optional):', initialValue: 'TUI user' }),
    'Attribution cancelled',
  );
  if (attribution === null) return;
  const spin = spinner();
  spin.start('Extracting pending checklist proposal');
  try {
    const runAgent = buildRunAgent({ search: ctx.uow.search, env: process.env });
    const result = await runExtraction(
      ctx.uow,
      { runAgent },
      {
        appDir: ctx.appDir,
        projectId,
        ticketId,
        type: 'manual',
        attribution,
        relPath,
        contentKind: mode === 'text' ? 'text/plain' : 'text/plain',
        content,
        ...(location ? { location } : {}),
      },
    );
    spin.stop('Pending proposal created');
    print(
      `Proposal ${result.proposal.id} is pending review; source ${result.source.id} preserved.`,
    );
  } catch (error) {
    spin.stop('Evidence intake failed');
    print(`Error: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export async function tui(ctx: AppContext): Promise<void> {
  const config = readGlobalConfig(ctx.appDir);
  const colorsEnabled = config.theme?.mode !== 'no-color';
  let project = await chooseProject(ctx, config.activeProject);
  let quit = false;
  while (!project && !quit) {
    const action = result(
      await select({
        message: 'Project workspace',
        options: [
          { value: 'create', label: 'Create project' },
          { value: 'select', label: 'Select project' },
          { value: 'settings', label: 'Settings' },
          { value: 'quit', label: 'Quit' },
        ],
      }),
      'Workspace cancelled',
    );
    if (action === 'quit') {
      quit = true;
      continue;
    }
    if (action === 'settings') await updateSettings(ctx);
    if (action === 'create') {
      const name = result(await text({ message: 'Project name:' }), 'Create cancelled');
      if (name) {
        const slug = result(
          await text({
            message: 'Project slug:',
            initialValue: name.toLowerCase().replaceAll(' ', '-'),
          }),
          'Create cancelled',
        );
        if (slug) {
          const { createProject } = await import('@trachex/domain');
          try {
            const created = await createProject(ctx.uow, { name, slug });
            project = await ctx.uow.projects.findById(created.id);
          } catch (error) {
            print(`Error: ${error instanceof Error ? error.message : String(error)}`);
          }
        }
      }
    }
    if (action === 'select') project = await chooseProject(ctx);
  }
  if (quit) {
    outro('TUI closed');
    return;
  }
  if (!project) return;
  let subject = await chooseSubject(ctx, project.id, config.activeSubject);
  while (!subject && !quit) {
    const action = result(
      await select({
        message: 'Subject workspace',
        options: [
          { value: 'create', label: 'Create subject' },
          { value: 'select', label: 'Select subject' },
          { value: 'back', label: 'Back' },
          { value: 'settings', label: 'Settings' },
          { value: 'quit', label: 'Quit' },
        ],
      }),
      'Subject menu cancelled',
    );
    if (action === 'quit') {
      quit = true;
      continue;
    }
    if (action === 'back') {
      project = null;
      break;
    }
    if (action === 'settings') await updateSettings(ctx);
    if (action === 'select' && project) subject = await chooseSubject(ctx, project.id);
    if (action === 'create') {
      const name = result(await text({ message: 'Subject name:' }), 'Subject creation cancelled');
      if (name) {
        try {
          if (project) subject = await createSubject(ctx.uow, { projectId: project.id, name });
        } catch (error) {
          print(`Error: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    }
  }
  if (quit) {
    outro('TUI closed');
    return;
  }
  if (!project || !subject) return;
  const selectedProject = project;
  const selectedSubject = subject;
  writeGlobalConfig(
    { ...config, activeProject: selectedProject.slug, activeSubject: selectedSubject.id },
    ctx.appDir,
  );

  const tickets = await ctx.uow.tickets.listByProject(selectedProject.id);
  // Subjects share their immutable id with the backing ticket row (see
  // entities.Subject), so the subject's checklist is the ticket with the same
  // id. Never fall back to an unrelated ticket — mutating the wrong checklist
  // would be a scope leak.
  const subjectTicket = tickets.find((ticket) => ticket.id === selectedSubject.id) ?? null;
  if (!subjectTicket) {
    print('No checklist is linked to this subject yet.');
    return;
  }

  intro(
    style(`TRACHEX  ${selectedProject.name}  /  ${selectedSubject.name}`, 'cyan', colorsEnabled),
  );
  let running = true;
  while (running) {
    const view = await buildChecklistView(ctx.uow, {
      projectId: selectedProject.id,
      ticketKey: subjectTicket.key,
    });
    print('');
    print(
      style(
        ` Project ${selectedProject.slug}  ·  Subject ${selectedSubject.name} `,
        'blue',
        colorsEnabled,
      ),
    );
    print(style(' Checklist', 'bold', colorsEnabled));
    renderTree(view.tree, colorsEnabled);
    renderHistory(view, colorsEnabled);

    const rows = flattenTree(view.tree);
    const selectedId = result(
      await select({
        message: 'Select an item or workspace action',
        options: [
          { value: '__add__', label: 'Add checklist item', hint: 'form' },
          {
            value: '__intake__',
            label: 'Intake evidence and extract proposal',
            hint: 'text or file',
          },
          { value: '__back__', label: 'Back to subjects' },
          { value: '__archive_project__', label: 'Archive project' },
          {
            value: '__delete_project__',
            label: 'Permanently delete project',
            hint: 'force + exact name',
          },
          { value: '__settings__', label: 'Settings', hint: 'theme and colors' },
          { value: '__archive_subject__', label: 'Archive subject' },
          {
            value: '__delete_subject__',
            label: 'Permanently delete subject',
            hint: 'force + exact name',
          },
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
    if (selectedId === '__quit__') {
      running = false;
      continue;
    }
    if (selectedId === '__back__') return;
    if (!selectedId) continue;
    if (selectedId === '__settings__') {
      await updateSettings(ctx);
      continue;
    }
    if (selectedId === '__archive_subject__') {
      const confirm = result(
        await select({
          message: 'Archive this subject?',
          options: [
            { value: 'yes', label: 'Yes' },
            { value: 'no', label: 'No' },
          ],
        }),
        'Archive cancelled',
      );
      if (confirm === 'yes') {
        await archiveSubject(ctx.uow, selectedSubject.id);
        print('Subject archived.');
        return;
      }
      continue;
    }
    if (selectedId === '__delete_subject__') {
      const exact = result(
        await text({
          message: `Type the exact subject name (${selectedSubject.name}) to permanently delete:`,
        }),
        'Permanent deletion cancelled',
      );
      if (exact === selectedSubject.name) {
        await permanentlyDeleteSubject(ctx.uow, selectedSubject.id, true);
        print('Subject permanently deleted.');
        return;
      }
      if (exact !== null) print('Exact name did not match; nothing was deleted.');
      continue;
    }
    if (selectedId === '__archive_project__') {
      const confirm = result(
        await select({
          message: 'Archive this project?',
          options: [
            { value: 'yes', label: 'Yes' },
            { value: 'no', label: 'No' },
          ],
        }),
        'Archive cancelled',
      );
      if (confirm === 'yes') {
        await archiveProject(ctx.uow, selectedProject.id);
        print('Project archived.');
        return;
      }
      continue;
    }
    if (selectedId === '__delete_project__') {
      const exact = result(
        await text({
          message: `Type the exact project name (${selectedProject.name}) to permanently delete:`,
        }),
        'Permanent deletion cancelled',
      );
      if (exact === selectedProject.name) {
        await permanentlyDeleteProject(ctx.uow, selectedProject.id, true);
        print('Project permanently deleted.');
        return;
      }
      if (exact !== null) print('Exact name did not match; nothing was deleted.');
      continue;
    }
    if (selectedId === '__add__') {
      await addItem(ctx, subjectTicket.id);
      continue;
    }
    if (selectedId === '__intake__') {
      await intakeEvidence(ctx, selectedProject.id, subjectTicket.id);
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
          { value: 'archive', label: 'Archive item and descendants' },
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
      } else if (action === 'archive') {
        await archiveRequirement(ctx.uow, item.id);
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
