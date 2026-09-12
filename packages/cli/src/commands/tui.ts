import { readFile } from 'node:fs/promises';
import { request } from 'node:https';
import { isCancel, multiselect, outro, select, spinner, text } from '@clack/prompts';
import { runExtraction } from '@trachex/agent';
import {
  archiveProject,
  archiveRequirement,
  archiveSubject,
  approveProposal,
  buildChecklistView,
  buildProjectStatus,
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
  rejectProposal,
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

type Screen = 'home' | 'project' | 'subject' | 'checklist' | 'quit';
const bannerUrl = new URL('../lib/banner.txt', import.meta.url);
let bannerText: string | undefined;

function clearTerminal(): void {
  if (process.stdout.isTTY) {
    process.stdout.write('\u001b[2J\u001b[H');
  }
}

async function renderBanner(enabled: boolean): Promise<void> {
  bannerText ??= await readFile(bannerUrl, 'utf8');
  for (const line of bannerText.trimEnd().split('\n')) {
    print(style(line, 'cyan', enabled));
  }
  print('');
}

function renderContext(
  screen: Screen,
  project?: { name: string },
  subject?: { name: string },
): void {
  const labels: Record<Screen, string> = {
    home: 'Home',
    project: 'Project',
    subject: 'Subject',
    checklist: 'Checklist',
    quit: 'Quit',
  };
  const parts = [`Workspace: ${labels[screen]}`];
  if (project) parts.push(`Project: ${project.name}`);
  if (subject) parts.push(`Subject: ${subject.name}`);
  print(parts.join('  |  '));
}

const CANCEL = Symbol('cancel');

function result<T>(value: T | symbol, label: string): T | typeof CANCEL {
  if (isCancel(value)) {
    print(`Cancelled: ${label}`);
    return CANCEL;
  }
  return value as T;
}

function valueOrCancel<T>(value: T | typeof CANCEL): T | undefined {
  return value === CANCEL ? undefined : value;
}

function isQuit(value: unknown): value is 'quit' {
  return value === 'quit';
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

function renderChecklistProgress(
  view: Awaited<ReturnType<typeof buildChecklistView>>,
  enabled: boolean,
): void {
  const latest = flattenTree(view.tree)
    .map(({ item }) => item)
    .slice()
    .sort((a, b) => b.displayOrder - a.displayOrder)
    .slice(0, 10);
  print(style(' Checklist progress', 'bold', enabled));
  if (latest.length === 0) {
    print(style('  No pending checklist items.', 'dim', enabled));
    return;
  }
  for (const item of latest) {
    const status = item.devStatus === 'checked' ? '[checked]' : '[unchecked]';
    const color = item.devStatus === 'checked' ? 'green' : 'yellow';
    print(`  ${style(status, color, enabled)} ${item.title}`);
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
    const name = valueOrCancel(
      result(
        await text({ message: 'No subjects yet. Subject name:' }),
        'Subject creation cancelled',
      ),
    );
    if (!name) return null;
    return createSubject(ctx.uow, { projectId, name });
  }
  const selected = valueOrCancel(
    result(
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
    ),
  );
  return selected ? (subjects.find((subject) => subject.id === selected) ?? null) : null;
}

async function addItem(ctx: AppContext, ticketId: string, parentId?: string): Promise<void> {
  const title = valueOrCancel(
    result(await text({ message: 'Checklist item title:' }), 'Add cancelled'),
  );
  if (!title) return;
  const description = valueOrCancel(
    result(await text({ message: 'Description (optional):' }), 'Add cancelled'),
  );
  if (description === undefined) return;
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
  const title = valueOrCancel(
    result(await text({ message: 'Title:', initialValue: item.title }), 'Edit cancelled'),
  );
  if (!title) return;
  const description = valueOrCancel(
    result(
      await text({ message: 'Description:', initialValue: item.description ?? '' }),
      'Edit cancelled',
    ),
  );
  if (description === undefined) return;
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
  const selected = valueOrCancel(
    result(
      await multiselect({
        message: 'Select items in the desired order, then press enter',
        options: items.map((item) => ({ value: item.id, label: item.title })),
        required: true,
      }),
      'Reorder cancelled',
    ),
  );
  if (!selected) return;
  await reorderChecklist(ctx.uow, { ticketId, orderedIds: selected });
}

async function updateSettings(ctx: AppContext): Promise<void> {
  const config = readGlobalConfig(ctx.appDir);
  const mode = valueOrCancel(
    result(
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
    ),
  );
  if (!mode) return;
  const accent = valueOrCancel(
    result(
      await text({
        message: 'Accent color name (optional):',
        initialValue: config.theme?.accent ?? '',
      }),
      'Settings cancelled',
    ),
  );
  if (accent === undefined) return;
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

async function intakeEvidence(
  ctx: AppContext,
  projectId: string,
  ticketId: string,
  env: NodeJS.ProcessEnv = process.env,
): Promise<void> {
  const mode = valueOrCancel(
    result(
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
    ),
  );
  if (!mode || mode === 'back') return;
  let content: string;
  let relPath: string;
  let location: string | undefined;
  if (mode === 'text' || mode === 'note') {
    const pasted = valueOrCancel(
      result(
        await text({
          message: 'Paste requirement text (multiline):',
          validate: (value) => (value?.trim() ? undefined : 'Text is required'),
        }),
        'Text intake cancelled',
      ),
    );
    if (!pasted) return;
    content = pasted;
    relPath = mode === 'note' ? 'tui-note.txt' : 'tui-pasted-requirements.txt';
  } else if (mode === 'url') {
    const url = valueOrCancel(result(await text({ message: 'URL:' }), 'URL intake cancelled'));
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
    const path = valueOrCancel(
      result(await text({ message: 'Local file path:' }), 'File intake cancelled'),
    );
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
  const attribution = valueOrCancel(
    result(
      await text({ message: 'Attribution (optional):', initialValue: 'TUI user' }),
      'Attribution cancelled',
    ),
  );
  if (attribution === undefined) return;
  const spin = spinner();
  spin.start('Extracting pending checklist proposal');
  try {
    const runAgent = buildRunAgent({ search: ctx.uow.search, env });
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

async function reviewPendingProposal(ctx: AppContext, ticketId: string): Promise<void> {
  const pending = (await ctx.uow.proposals.listByTicket(ticketId)).filter(
    (item) => item.status === 'pending',
  );
  if (pending.length === 0) {
    print('No pending proposals. Intake evidence to create one.');
    return;
  }
  const chosen = valueOrCancel(
    result(
      await select({
        message: 'Pending proposal to review',
        options: [
          ...pending.map((item) => ({ value: item.id, label: `${item.id} — ${item.kind}` })),
          { value: '__back__', label: 'Back' },
        ],
      }),
      'Proposal review cancelled',
    ),
  );
  if (!chosen || chosen === '__back__') return;
  const proposal = pending.find((item) => item.id === chosen);
  if (!proposal) return;
  const versions = await ctx.uow.proposals.listVersions(proposal.id);
  const version = versions.at(-1);
  const output = version
    ? (JSON.parse(version.editedOutput ?? version.modelOutput) as {
        kind: string;
        create?: Array<{
          title: string;
          description?: string;
          supersedes?: string[];
          impacts?: Array<{ kind: string; value: string }>;
          scenarios?: string[];
        }>;
        requirements?: Array<{
          title: string;
          description?: string;
          supersedes?: string[];
          impacts?: Array<{ kind: string; value: string }>;
          scenarios?: string[];
        }>;
      })
    : undefined;
  const source = proposal.sourceId ? await ctx.uow.sources.findById(proposal.sourceId) : undefined;
  print(`Proposal ${proposal.id} — pending`);
  print(
    `Source: ${source?.type ?? 'unknown'}${source?.attribution ? ` (${source.attribution})` : ''}`,
  );
  print(`Cause/note: ${source?.note ?? source?.location ?? 'not specified'}`);
  print('Proposed changes (not applied):');
  for (const draft of output?.kind === 'extraction'
    ? (output.requirements ?? [])
    : (output?.create ?? [])) {
    print(`  + ${draft.title}`);
    if (draft.description) print(`    ${draft.description}`);
    if (draft.supersedes?.length) print(`    replaces: ${draft.supersedes.join(', ')}`);
    for (const impact of draft.impacts ?? []) print(`    impact: ${impact.kind}:${impact.value}`);
    for (const scenario of draft.scenarios ?? []) print(`    scenario: ${scenario}`);
  }
  print('Checklist state changed: no — approval is required.');
  const action = valueOrCancel(
    result(
      await select({
        message: 'Proposal action',
        options: [
          { value: 'approve', label: 'Approve and apply changes' },
          { value: 'edit', label: 'Edit externally (use CLI proposal edit)' },
          { value: 'reject', label: 'Reject proposal' },
          { value: 'back', label: 'Back' },
        ],
      }),
      'Proposal action cancelled',
    ),
  );
  if (action === 'approve') {
    const confirmation = valueOrCancel(
      result(
        await select({
          message: 'Apply this proposal?',
          options: [
            { value: 'yes', label: 'Yes' },
            { value: 'no', label: 'No' },
          ],
        }),
        'Approval cancelled',
      ),
    );
    if (confirmation === 'yes') {
      await approveProposal(ctx.uow, { proposalId: proposal.id });
      print('Proposal approved. Checklist state changed: applied.');
    }
  } else if (action === 'reject') {
    await rejectProposal(ctx.uow, { proposalId: proposal.id });
    print('Proposal rejected. Checklist state changed: no.');
  } else if (action === 'edit') {
    print(`Next: proposal edit ${proposal.id} --project <project> --output <file>`);
  }
}

export async function tui(ctx: AppContext, env: NodeJS.ProcessEnv = process.env): Promise<void> {
  const config = readGlobalConfig(ctx.appDir);
  const colorsEnabled = config.theme?.mode !== 'no-color';
  clearTerminal();
  await renderBanner(colorsEnabled);
  let screen: Screen = 'home';
  let project: NonNullable<Awaited<ReturnType<typeof ctx.uow.projects.findById>>> | undefined;
  let subject: NonNullable<Awaited<ReturnType<typeof ctx.uow.subjects.findById>>> | undefined;
  let subjectTicket: Awaited<ReturnType<typeof ctx.uow.tickets.listByProject>>[number] | undefined;
  // Restore the last valid workspace without allowing stale config to leak
  // into a different project or subject.
  if (config.activeProject) {
    const restoredProject = await ctx.uow.projects.findBySlug(config.activeProject);
    if (restoredProject) {
      project = restoredProject;
      if (config.activeSubject) {
        const restoredSubject = await ctx.uow.subjects.findById(config.activeSubject);
        if (restoredSubject?.projectId === restoredProject.id) {
          subject = restoredSubject;
          screen = 'checklist';
          print(`Resuming ${restoredProject.name} / ${restoredSubject.name}.`);
        } else {
          const { activeSubject: _staleSubject, ...withoutSubject } = config;
          writeGlobalConfig(withoutSubject, ctx.appDir);
          print('Saved subject context was stale or mismatched; it was cleared.');
        }
      }
      if (!subject) screen = 'project';
    } else {
      const {
        activeProject: _staleProject,
        activeSubject: _staleSubject,
        ...withoutContext
      } = config;
      writeGlobalConfig(withoutContext, ctx.appDir);
      print('Saved project context was stale; it was cleared.');
    }
  }
  const safe = async (work: () => Promise<void>) => {
    try {
      await work();
    } catch (error) {
      print(`Error: ${error instanceof Error ? error.message : String(error)}`);
    }
  };
  const handleSigint = () => {
    screen = 'quit';
  };
  process.once('SIGINT', handleSigint);
  try {
    while (screen !== 'quit') {
      clearTerminal();
      await renderBanner(colorsEnabled);
      renderContext(screen, project ?? undefined, subject ?? undefined);
      if (screen === 'home') {
        const projects = await ctx.uow.projects.list();
        const action = result(
          await select({
            message: 'Project workspace',
            options: [
              { value: 'create', label: 'Create project' },
              { value: 'select', label: 'Select project' },
              { value: 'refresh', label: 'Refresh' },
              { value: 'settings', label: 'Settings' },
              { value: 'danger', label: 'Danger zone' },
              { value: 'quit', label: 'Quit' },
            ],
          }),
          'Home cancelled',
        );
        if (action === CANCEL || action === 'refresh') continue;
        if (isQuit(action)) {
          screen = 'quit';
          continue;
        }
        if (action === 'settings') {
          await safe(() => updateSettings(ctx));
          continue;
        }
        if (action === 'danger') {
          const dangerAction = result(
            await select({
              message: 'Home > Danger zone',
              options: [
                { value: 'archive_project', label: 'Archive project' },
                {
                  value: 'delete_project',
                  label: 'Permanently delete project',
                  hint: 'force + exact name',
                },
                { value: 'back', label: 'Back' },
              ],
            }),
            'Danger menu cancelled',
          );
          if (dangerAction === 'archive_project') {
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
            if (confirm === 'yes' && project) {
              await safe(async () => {
                await archiveProject(ctx.uow, project!.id);
                print('Project archived.');
                const nextConfig = readGlobalConfig(ctx.appDir);
                const {
                  activeProject: _activeProject,
                  activeSubject: _activeSubject,
                  ...withoutContext
                } = nextConfig;
                writeGlobalConfig(withoutContext, ctx.appDir);
                screen = 'home';
                project = undefined;
                subject = undefined;
              });
            }
          } else if (dangerAction === 'delete_project') {
            if (project) {
              const exact = result(
                await text({
                  message: `Type the exact project name (${project.name}) to permanently delete:`,
                }),
                'Permanent deletion cancelled',
              );
              if (exact === project.name) {
                await safe(async () => {
                  await permanentlyDeleteProject(ctx.uow, project!.id, true);
                  print('Project permanently deleted.');
                  const nextConfig = readGlobalConfig(ctx.appDir);
                  const {
                    activeProject: _activeProject,
                    activeSubject: _activeSubject,
                    ...withoutContext
                  } = nextConfig;
                  writeGlobalConfig(withoutContext, ctx.appDir);
                  screen = 'home';
                  project = undefined;
                  subject = undefined;
                });
              } else if (exact !== CANCEL) {
                print('Exact name did not match; nothing was deleted.');
              }
            }
          }
          continue;
        }
        if (action === 'create') {
          await safe(async () => {
            const name = valueOrCancel(
              result(await text({ message: 'Project name:' }), 'Create cancelled'),
            );
            if (!name) return;
            const slug = valueOrCancel(
              result(
                await text({
                  message: 'Project slug:',
                  initialValue: name.toLowerCase().replaceAll(' ', '-'),
                }),
                'Create cancelled',
              ),
            );
            if (!slug) return;
            const { createProject } = await import('@trachex/domain');
            const created = await createProject(ctx.uow, { name, slug });
            project = (await ctx.uow.projects.findById(created.id)) ?? undefined;
            if (project) screen = 'project';
          });
          continue;
        }
        if (action === 'select' && projects.length) {
          const chosen = await chooseProject(ctx, config.activeProject);
          if (chosen) {
            project = chosen;
            screen = 'project';
          }
          continue;
        }
        if (action === 'select') {
          print('No projects yet. Choose Create project to get started.');
        }
        continue;
      }
      if (!project) {
        screen = 'home';
        continue;
      }
      if (screen === 'project') {
        const subjects = await ctx.uow.subjects.listByProject(project.id);
        const projectStatus = await buildProjectStatus(ctx.uow, project.id);
        const subjectStatus = new Map(projectStatus.tickets.map((ticket) => [ticket.key, ticket]));
        print(style(' Subjects and checklist status', 'bold', colorsEnabled));
        if (subjects.length === 0) {
          print(style('  No subjects yet.', 'dim', colorsEnabled));
        } else {
          for (const currentSubject of subjects) {
            const status = subjectStatus.get(currentSubject.id);
            if (!status) {
              print(`  ${currentSubject.name}  ${style('[no checklist]', 'dim', colorsEnabled)}`);
              continue;
            }
            print(
              `  ${currentSubject.name}  ${style(`[${status.checked}/${status.active} checked]`, status.remaining === 0 ? 'green' : 'yellow', colorsEnabled)}${status.openProposals > 0 ? `  ${status.openProposals} pending proposal${status.openProposals === 1 ? '' : 's'}` : ''}`,
            );
          }
        }
        const action = result(
          await select({
            message: 'Project workspace',
            options: [
              ...(subjects.length > 0
                ? [{ value: 'select', label: 'Select subject' }]
                : [{ value: 'select', label: 'Select subject', hint: 'No subjects yet' }]),
              { value: 'create', label: 'Create subject' },
              { value: 'refresh', label: 'Refresh' },
              { value: 'settings', label: 'Settings' },
              { value: 'danger', label: 'Danger zone' },
              { value: 'back', label: 'Back' },
              { value: 'quit', label: 'Quit' },
            ],
          }),
          'Project cancelled',
        );
        if (action === CANCEL || action === 'refresh') continue;
        if (action === 'back') {
          project = undefined;
          screen = 'home';
          continue;
        }
        if (isQuit(action)) {
          screen = 'quit';
          continue;
        }
        if (action === 'settings') {
          await safe(() => updateSettings(ctx));
          continue;
        }
        if (action === 'danger') {
          const dangerAction = result(
            await select({
              message: 'Project > Danger zone',
              options: [
                { value: 'archive_project', label: 'Archive project' },
                {
                  value: 'delete_project',
                  label: 'Permanently delete project',
                  hint: 'force + exact name',
                },
                { value: 'back', label: 'Back' },
              ],
            }),
            'Danger menu cancelled',
          );
          if (dangerAction === 'archive_project') {
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
              await safe(async () => {
                await archiveProject(ctx.uow, project!.id);
                print('Project archived.');
                const nextConfig = readGlobalConfig(ctx.appDir);
                const {
                  activeProject: _activeProject,
                  activeSubject: _activeSubject,
                  ...withoutContext
                } = nextConfig;
                writeGlobalConfig(withoutContext, ctx.appDir);
                screen = 'home';
                project = undefined;
                subject = undefined;
              });
            }
          } else if (dangerAction === 'delete_project') {
            const exact = result(
              await text({
                message: `Type the exact project name (${project.name}) to permanently delete:`,
              }),
              'Permanent deletion cancelled',
            );
            if (exact === project.name) {
              await safe(async () => {
                await permanentlyDeleteProject(ctx.uow, project!.id, true);
                print('Project permanently deleted.');
                const nextConfig = readGlobalConfig(ctx.appDir);
                const {
                  activeProject: _activeProject,
                  activeSubject: _activeSubject,
                  ...withoutContext
                } = nextConfig;
                writeGlobalConfig(withoutContext, ctx.appDir);
                screen = 'home';
                project = undefined;
                subject = undefined;
              });
            } else if (exact !== CANCEL) {
              print('Exact name did not match; nothing was deleted.');
            }
          }
          continue;
        }
        if (action === 'create') {
          await safe(async () => {
            const name = result(
              await text({ message: 'Subject name:' }),
              'Subject creation cancelled',
            );
            if (name !== CANCEL) {
              const currentProject = project;
              if (currentProject) {
                subject = await createSubject(ctx.uow, { projectId: currentProject.id, name });
                screen = 'subject';
              }
            }
          });
          continue;
        }
        if (action === 'select') {
          if (subjects.length === 0) {
            print('No subjects yet. Choose Create subject to get started.');
            continue;
          }
          const chosen = await chooseSubject(ctx, project.id, config.activeSubject);
          if (chosen) {
            subject = chosen;
            screen = 'subject';
          }
          continue;
        }
      }
      if (!subject) {
        screen = 'project';
        continue;
      }
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
      subjectTicket = tickets.find((ticket) => ticket.id === selectedSubject.id);
      if (!subjectTicket) {
        print('No checklist is linked to this subject yet.');
        screen = 'subject';
        continue;
      }
      const currentSubjectTicket = subjectTicket;

      print(
        style(
          `Project ${selectedProject.name}  /  Subject ${selectedSubject.name}`,
          'cyan',
          colorsEnabled,
        ),
      );
      if (screen === 'subject') {
        const subjectView = await buildChecklistView(ctx.uow, {
          projectId: selectedProject.id,
          ticketKey: currentSubjectTicket.key,
        });
        renderChecklistProgress(subjectView, colorsEnabled);
        const action = result(
          await select({
            message: 'Subject workspace',
            options: [
              { value: 'open', label: 'Open checklist' },
              { value: 'add', label: 'Add checklist item' },
              { value: 'intake', label: 'Intake evidence' },
              { value: 'proposals', label: 'Review pending proposals' },
              { value: 'refresh', label: 'Refresh' },
              { value: 'settings', label: 'Settings' },
              { value: 'danger', label: 'Danger zone' },
              { value: 'back', label: 'Back' },
              { value: 'quit', label: 'Quit' },
            ],
          }),
          'Subject cancelled',
        );
        if (action === CANCEL || action === 'refresh') continue;
        if (action === 'back') {
          subject = undefined;
          screen = 'project';
          continue;
        }
        if (isQuit(action)) {
          screen = 'quit';
          continue;
        }
        if (action === 'settings') {
          await safe(() => updateSettings(ctx));
          continue;
        }
        if (action === 'danger') {
          const dangerAction = result(
            await select({
              message: 'Subject > Danger zone',
              options: [
                { value: 'archive_subject', label: 'Archive subject' },
                {
                  value: 'delete_subject',
                  label: 'Permanently delete subject',
                  hint: 'force + exact name',
                },
                { value: 'archive_project', label: 'Archive project' },
                {
                  value: 'delete_project',
                  label: 'Permanently delete project',
                  hint: 'force + exact name',
                },
                { value: 'back', label: 'Back' },
              ],
            }),
            'Danger menu cancelled',
          );
          if (dangerAction === 'archive_subject') {
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
              await safe(async () => {
                await archiveSubject(ctx.uow, subject!.id);
                print('Subject archived.');
                const nextConfig = readGlobalConfig(ctx.appDir);
                const { activeSubject: _activeSubject, ...withoutSubject } = nextConfig;
                writeGlobalConfig(withoutSubject, ctx.appDir);
                subject = undefined;
                screen = 'project';
              });
            }
          } else if (dangerAction === 'delete_subject') {
            const exact = result(
              await text({
                message: `Type the exact subject name (${subject.name}) to permanently delete:`,
              }),
              'Permanent deletion cancelled',
            );
            if (exact === subject.name) {
              await safe(async () => {
                await permanentlyDeleteSubject(ctx.uow, subject!.id, true);
                print('Subject permanently deleted.');
                const nextConfig = readGlobalConfig(ctx.appDir);
                const { activeSubject: _activeSubject, ...withoutSubject } = nextConfig;
                writeGlobalConfig(withoutSubject, ctx.appDir);
                subject = undefined;
                screen = 'project';
              });
            } else if (exact !== CANCEL) {
              print('Exact name did not match; nothing was deleted.');
            }
          } else if (dangerAction === 'archive_project') {
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
              await safe(async () => {
                await archiveProject(ctx.uow, project!.id);
                print('Project archived.');
                const nextConfig = readGlobalConfig(ctx.appDir);
                const {
                  activeProject: _activeProject,
                  activeSubject: _activeSubject,
                  ...withoutContext
                } = nextConfig;
                writeGlobalConfig(withoutContext, ctx.appDir);
                screen = 'home';
                project = undefined;
                subject = undefined;
              });
            }
          } else if (dangerAction === 'delete_project') {
            const exact = result(
              await text({
                message: `Type the exact project name (${project.name}) to permanently delete:`,
              }),
              'Permanent deletion cancelled',
            );
            if (exact === project.name) {
              await safe(async () => {
                await permanentlyDeleteProject(ctx.uow, project!.id, true);
                print('Project permanently deleted.');
                const nextConfig = readGlobalConfig(ctx.appDir);
                const {
                  activeProject: _activeProject,
                  activeSubject: _activeSubject,
                  ...withoutContext
                } = nextConfig;
                writeGlobalConfig(withoutContext, ctx.appDir);
                screen = 'home';
                project = undefined;
                subject = undefined;
              });
            } else if (exact !== CANCEL) {
              print('Exact name did not match; nothing was deleted.');
            }
          }
          continue;
        }
        if (action === 'add') {
          const currentTicket = subjectTicket;
          if (!currentTicket) continue;
          await safe(() => addItem(ctx, currentTicket.id));
          continue;
        }
        if (action === 'intake') {
          const currentTicket = subjectTicket;
          if (!currentTicket) continue;
          await safe(() => intakeEvidence(ctx, selectedProject.id, currentTicket.id, env));
          continue;
        }
        if (action === 'proposals') {
          const currentTicket = subjectTicket;
          if (currentTicket) await safe(() => reviewPendingProposal(ctx, currentTicket.id));
          continue;
        }
        if (action === 'open') {
          screen = 'checklist';
          continue;
        }
      }
      if (screen !== 'checklist') continue;
      {
        const view = await buildChecklistView(ctx.uow, {
          projectId: selectedProject.id,
          ticketKey: currentSubjectTicket.key,
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
        if (view.tree.length === 0) {
          print(style(' No active checklist items yet.', 'dim', colorsEnabled));
          print(' Add an item manually or intake evidence to generate a pending proposal.');
        }
        renderTree(view.tree, colorsEnabled);
        renderHistory(view, colorsEnabled);

        const rows = flattenTree(view.tree);
        let selectedId: string | typeof CANCEL = result(
          await select({
            message: 'Checklist workspace',
            options: [
              { value: '__actions__', label: 'Checklist actions' },
              { value: '__workspace__', label: 'Workspace' },
              { value: '__settings__', label: 'Settings' },
              { value: '__danger__', label: 'Danger zone' },
              { value: '__back__', label: 'Back to subject' },
              { value: '__quit__', label: 'Quit' },
            ],
          }),
          'TUI cancelled',
        );
        if (selectedId === CANCEL) {
          continue;
        }
        if (selectedId === '__workspace__') {
          const action = result(
            await select({
              message: 'Checklist > Workspace',
              options: [
                { value: '__back__', label: 'Back to subject' },
                { value: '__quit__', label: 'Quit' },
                { value: '__menu_back__', label: 'Back' },
              ],
            }),
            'Navigation cancelled',
          );
          if (action === '__back__') screen = 'subject';
          if (action === '__quit__') screen = 'quit';
          continue;
        }
        if (selectedId === '__danger__') {
          const action = result(
            await select({
              message: 'Checklist > Danger zone',
              options: [
                { value: '__archive_subject__', label: 'Archive subject' },
                {
                  value: '__delete_subject__',
                  label: 'Permanently delete subject',
                  hint: 'force + exact name',
                },
                { value: '__archive_project__', label: 'Archive project' },
                {
                  value: '__delete_project__',
                  label: 'Permanently delete project',
                  hint: 'force + exact name',
                },
                { value: '__back__', label: 'Back' },
              ],
            }),
            'Danger menu cancelled',
          );
          if (!action || action === '__back__') continue;
          selectedId = action;
        }
        if (selectedId === '__actions__') {
          const action = result(
            await select({
              message: 'Checklist > Actions',
              options: [
                { value: '__add__', label: 'Add item' },
                { value: '__items__', label: 'Select item' },
                { value: '__reorder__', label: 'Reorder checklist' },
                { value: '__intake__', label: 'Intake evidence' },
                { value: '__back__', label: 'Back' },
              ],
            }),
            'Routine actions cancelled',
          );
          if (action === CANCEL || action === '__back__') continue;
          selectedId = action;
        }
        if (selectedId === '__items__') {
          const action = result(
            await select({
              message: 'Checklist > Item',
              options: [
                ...rows.map(({ item, depth }) => ({
                  value: item.id,
                  label: `${'  '.repeat(depth)}${item.devStatus === 'checked' ? '✓' : '○'} ${item.title}`,
                  hint: item.id,
                })),
                { value: '__back__', label: 'Back' },
              ],
            }),
            'Item selection cancelled',
          );
          if (action === CANCEL || action === '__back__') continue;
          selectedId = action;
        }
        if (selectedId === '__back__') {
          screen = 'subject';
          continue;
        }
        if (selectedId === '__quit__') {
          screen = 'quit';
          continue;
        }
        if (selectedId === CANCEL || !selectedId) continue;
        if (selectedId === '__settings__') {
          await safe(() => updateSettings(ctx));
          continue;
        }
        if (selectedId === '__reorder__') {
          await safe(() =>
            reorderItems(
              ctx,
              currentSubjectTicket.id,
              rows.map(({ item }) => item),
            ),
          );
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
            const nextConfig = readGlobalConfig(ctx.appDir);
            const { activeSubject: _activeSubject, ...withoutSubject } = nextConfig;
            writeGlobalConfig(withoutSubject, ctx.appDir);
            subject = undefined;
            screen = 'project';
            continue;
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
            const nextConfig = readGlobalConfig(ctx.appDir);
            const { activeSubject: _activeSubject, ...withoutSubject } = nextConfig;
            writeGlobalConfig(withoutSubject, ctx.appDir);
            subject = undefined;
            screen = 'project';
            continue;
          }
          if (exact !== CANCEL) print('Exact name did not match; nothing was deleted.');
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
            const nextConfig = readGlobalConfig(ctx.appDir);
            const {
              activeProject: _activeProject,
              activeSubject: _activeSubject,
              ...withoutContext
            } = nextConfig;
            writeGlobalConfig(withoutContext, ctx.appDir);
            screen = 'home';
            project = undefined;
            subject = undefined;
            continue;
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
            const nextConfig = readGlobalConfig(ctx.appDir);
            const {
              activeProject: _activeProject,
              activeSubject: _activeSubject,
              ...withoutContext
            } = nextConfig;
            writeGlobalConfig(withoutContext, ctx.appDir);
            screen = 'home';
            project = undefined;
            subject = undefined;
            continue;
          }
          if (exact !== CANCEL) print('Exact name did not match; nothing was deleted.');
          continue;
        }
        if (selectedId === '__add__') {
          await safe(() => addItem(ctx, currentSubjectTicket.id));
          continue;
        }
        if (selectedId === '__intake__') {
          await safe(() => intakeEvidence(ctx, selectedProject.id, currentSubjectTicket.id, env));
          continue;
        }
        const item = rows.find(({ item: candidate }) => candidate.id === selectedId)?.item;
        if (!item) continue;
        const action = result(
          await select({
            message: `Checklist > Item > ${item.title}`,
            options: [
              { value: 'toggle', label: item.devStatus === 'checked' ? 'Uncheck' : 'Check' },
              { value: 'edit', label: 'Edit', hint: 'form' },
              { value: 'add-child', label: 'Add child', hint: 'form' },
              { value: 'supersede', label: 'Supersede', hint: 'keep history' },
              { value: 'archive', label: 'Archive item and descendants' },
              { value: 'back', label: 'Back' },
            ],
          }),
          'Action cancelled',
        );
        if (action === CANCEL || action === 'back') continue;
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
            await safe(() => editItem(ctx, item, currentSubjectTicket.id));
            continue;
          } else if (action === 'add-child') {
            spin.stop('Opening add form');
            await safe(() => addItem(ctx, currentSubjectTicket.id, item.id));
            continue;
          } else if (action === 'supersede') {
            await supersedeRequirement(ctx.uow, {
              ticketId: currentSubjectTicket.id,
              requirementId: item.id,
              actorType: 'human',
            });
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
    }
  } finally {
    process.removeListener('SIGINT', handleSigint);
  }
  outro('TUI closed');
}
