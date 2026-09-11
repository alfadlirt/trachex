import { PipelineError } from '@trachex/agent';
import { startDashboard } from '@trachex/api';
import { DomainError } from '@trachex/domain';
import { runMcpServer } from '@trachex/mcp';
import { resolveBundledDashboardDist } from '@trachex/shared';
import { openApp } from './app.ts';
import { parseCommandArgs } from './args.ts';
import { adjustment } from './commands/adjustment.ts';
import { check } from './commands/check.ts';
import {
  checklistAdd,
  checklistEdit,
  checklistList,
  checklistReorder,
  checklistSupersede,
} from './commands/checklist.ts';
import { exportSummary } from './commands/export.ts';
import { info } from './commands/info.ts';
import {
  projectCreate,
  projectExport,
  projectList,
  projectUse,
  repoAdd,
} from './commands/project.ts';
import { proposalApprove, proposalList, proposalReject } from './commands/proposal.ts';
import {
  repoAdd as repoAddGlobal,
  repoList,
  repoRemove,
  subjectRepoAdd,
  subjectRepoList,
  subjectRepoRemove,
} from './commands/repo.ts';
import { settingsSet, settingsShow } from './commands/settings.ts';
import { statusProject } from './commands/status.ts';
import { subjectList, subjectNew, subjectShow, subjectUse } from './commands/subject.ts';
import { contextIngest, ticketNew, ticketShow } from './commands/ticket.ts';
import { tui } from './commands/tui.ts';
import { uncheck } from './commands/uncheck.ts';
import { resolveProjectSlug } from './context.ts';
import { CliError, EXIT_DOMAIN, EXIT_ERROR, EXIT_OK, EXIT_USAGE } from './errors.ts';
import { resolveComposeFile } from './infra.ts';
import { print, printJson } from './io.ts';

export interface CliEnv {
  argv: string[];
  env?: NodeJS.ProcessEnv;
  appDir?: string;
}

export async function runCli(env: CliEnv): Promise<number> {
  const argv = env.argv;
  const [command, sub, ...rest] = argv;
  const ctx = openApp(env.appDir);
  const projectFlag = (values: Record<string, string | boolean | undefined>) =>
    typeof values.project === 'string' ? values.project : undefined;
  const resolveProject = (values: Record<string, string | boolean | undefined>) => {
    const explicit = projectFlag(values);
    return resolveProjectSlug({
      ...(explicit !== undefined ? { explicit } : {}),
      appDir: ctx.appDir,
    } as { explicit?: string; appDir?: string });
  };

  try {
    if (command === '--help' || command === '-h' || command === 'help') {
      print('trachex — local-first development traceability');
      print('');
      print('project create <slug> --name <name>');
      print('project use <slug>');
      print('project list');
      print('project repo add <project> --name <slug> --path <path>');
      print('project export <slug> --out <archive>');
      print('context ingest <project> --include <paths>');
      print('info [--json]');
      print('subject new --project <slug> --name <name> [--description <d>]');
      print('subject list --project <slug>');
      print('subject show <subject-id>');
      print('subject use <subject-id> | --clear');
      print(
        'settings show | settings set theme auto|dark|light|no-color | settings set accent <color>',
      );
      print('repo add --name <slug> --path <path>');
      print('repo list | repo remove <repo-id>');
      print('subject repo <add|list|remove> <subject-id> [<repo-id>]');
      print('ticket new <key> --project <slug> --fsd <file>');
      print('ticket show <key> --project <slug>');
      print('adjustment <key> --project <slug> --source <type> --from <actor> --note <text>');
      print('proposal list --project <slug>');
      print('proposal approve <id> --project <slug> [--yes]');
      print('proposal reject <id> --project <slug>');
      print('check <key> <requirement-id> --project <slug> [--yes]');
      print('export <key> --project <slug> --format markdown|json [--out <file>]');
      print('status [--project <slug>] [--json]');
      print('checklist list <ticketKey> --project <slug> [--json]');
      print('checklist add <ticketKey> --project <slug> --title <t> [--from <actor>]');
      print('checklist edit <ticketKey> <requirement-id> --project <slug> --title <t>');
      print('checklist supersede <ticketKey> <requirement-id> --project <slug>');
      print('checklist reorder <ticketKey> --project <slug> --order <id1,id2,...>');
      print('uncheck <ticketKey> <requirement-id> --project <slug>');
      print('dashboard | mcp | infra | eval | tui');
      return EXIT_OK;
    }

    switch (command) {
      case 'project': {
        if (sub === 'create') {
          const { positionals, values } = parseCommandArgs(rest, {
            name: { type: 'string', short: 'n' },
          });
          const slug = positionals[0];
          if (!slug) throw new CliError('project create requires a slug', EXIT_USAGE, 'USAGE');
          const name = typeof values.name === 'string' ? values.name : slug;
          await projectCreate(ctx.uow, { slug, name });
        } else if (sub === 'use') {
          const { positionals } = parseCommandArgs(rest, {});
          const slug = positionals[0];
          if (!slug) throw new CliError('project use requires a slug', EXIT_USAGE, 'USAGE');
          await projectUse(ctx, { slug });
        } else if (sub === 'list') {
          await projectList(ctx.uow);
        } else if (sub === 'repo') {
          const [repoSub, ...repoRest] = rest;
          if (repoSub !== 'add') {
            throw new CliError(`unknown repo subcommand: ${repoSub}`, EXIT_USAGE, 'USAGE');
          }
          const { positionals, values } = parseCommandArgs(repoRest, {
            name: { type: 'string', short: 'n' },
            path: { type: 'string', short: 'p' },
          });
          const project = positionals[0];
          const name = typeof values.name === 'string' ? values.name : undefined;
          const path = typeof values.path === 'string' ? values.path : undefined;
          if (!project || !name || !path) {
            throw new CliError(
              'repo add requires <project> --name <slug> --path <path>',
              EXIT_USAGE,
              'USAGE',
            );
          }
          await repoAdd(ctx.uow, { project, name, path });
        } else if (sub === 'export') {
          const { positionals, values } = parseCommandArgs(rest, {
            out: { type: 'string', short: 'o' },
          });
          const slug = positionals[0];
          const out = typeof values.out === 'string' ? values.out : undefined;
          if (!slug || !out) {
            throw new CliError(
              'project export requires <slug> --out <archive>',
              EXIT_USAGE,
              'USAGE',
            );
          }
          await projectExport(ctx, { slug, out });
        } else {
          throw new CliError(`unknown project subcommand: ${sub}`, EXIT_USAGE, 'USAGE');
        }
        break;
      }
      case 'context': {
        if (sub === 'ingest') {
          const { positionals, values } = parseCommandArgs(rest, {
            repo: { type: 'string' },
            include: { type: 'string' },
          });
          const project = positionals[0];
          const includeRaw = typeof values.include === 'string' ? values.include : '';
          const include = includeRaw.split(',').filter((p) => p.length > 0);
          if (!project || include.length === 0) {
            throw new CliError(
              'context ingest requires <project> --include <paths>',
              EXIT_USAGE,
              'USAGE',
            );
          }
          await contextIngest(ctx, {
            project,
            ...(typeof values.repo === 'string' ? { repo: values.repo } : {}),
            include,
          });
        } else {
          throw new CliError(`unknown context subcommand: ${sub}`, EXIT_USAGE, 'USAGE');
        }
        break;
      }
      case 'info': {
        const { values } = parseCommandArgs([sub, ...rest].filter(Boolean) as string[], {
          json: { type: 'boolean' },
        });
        await info(ctx, { json: values.json === true });
        break;
      }
      case 'subject': {
        const { positionals, values } = parseCommandArgs(rest, {
          project: { type: 'string' },
          name: { type: 'string' },
          description: { type: 'string' },
          clear: { type: 'boolean' },
          json: { type: 'boolean' },
        });
        if (sub === 'new') {
          const project = resolveProject(values);
          const name = typeof values.name === 'string' ? values.name : undefined;
          if (!project || !name) {
            throw new CliError(
              'subject new requires --project <slug> --name <name>',
              EXIT_USAGE,
              'USAGE',
            );
          }
          await subjectNew(ctx.uow, {
            project,
            name,
            ...(typeof values.description === 'string' ? { description: values.description } : {}),
          });
        } else if (sub === 'list') {
          const project = resolveProject(values);
          await subjectList(ctx.uow, { project, json: values.json === true });
        } else if (sub === 'show') {
          const id = positionals[0];
          if (!id) throw new CliError('subject show requires <subject-id>', EXIT_USAGE, 'USAGE');
          await subjectShow(ctx.uow, { id, json: values.json === true });
        } else if (sub === 'use') {
          const id = positionals[0];
          const clear = values.clear === true;
          const explicitProject = projectFlag(values);
          await subjectUse(ctx, {
            ...(typeof id === 'string' ? { id } : {}),
            ...(typeof explicitProject === 'string' ? { project: explicitProject } : {}),
            clear,
          });
        } else if (sub === 'repo') {
          const repoSub = positionals[0];
          const subjectId = positionals[1];
          const repoId = positionals[2];
          if (!subjectId) {
            throw new CliError(
              'subject repo requires <add|list|remove> <subject-id>',
              EXIT_USAGE,
              'USAGE',
            );
          }
          if (repoSub === 'list') {
            await subjectRepoList(ctx.uow, { subjectId, json: values.json === true });
          } else if (repoSub === 'add') {
            if (!repoId) {
              throw new CliError(
                'subject repo add requires <subject-id> <repo-id>',
                EXIT_USAGE,
                'USAGE',
              );
            }
            await subjectRepoAdd(ctx, { subjectId, repoId });
          } else if (repoSub === 'remove') {
            if (!repoId) {
              throw new CliError(
                'subject repo remove requires <subject-id> <repo-id>',
                EXIT_USAGE,
                'USAGE',
              );
            }
            await subjectRepoRemove(ctx, { subjectId, repoId });
          } else {
            throw new CliError(`unknown subject repo subcommand: ${repoSub}`, EXIT_USAGE, 'USAGE');
          }
        } else {
          throw new CliError(`unknown subject subcommand: ${sub}`, EXIT_USAGE, 'USAGE');
        }
        break;
      }
      case 'settings': {
        const { positionals, values } = parseCommandArgs(rest, {
          json: { type: 'boolean' },
        });
        if (sub === 'show') {
          await settingsShow(ctx, { json: values.json === true });
        } else if (sub === 'set') {
          const key = positionals[0];
          const value = positionals[1];
          if (!key || !value) {
            throw new CliError('settings set requires <key> <value>', EXIT_USAGE, 'USAGE');
          }
          await settingsSet(ctx, { key, value, json: values.json === true });
        } else {
          throw new CliError(`unknown settings subcommand: ${sub}`, EXIT_USAGE, 'USAGE');
        }
        break;
      }
      case 'ticket': {
        if (sub === 'new') {
          const { positionals, values } = parseCommandArgs(rest, {
            project: { type: 'string' },
            fsd: { type: 'string' },
            note: { type: 'string' },
            fixture: { type: 'string' },
          });
          const key = positionals[0];
          const project = resolveProject(values);
          if (!key || !project) {
            throw new CliError('ticket new requires <key> --project <slug>', EXIT_USAGE, 'USAGE');
          }
          await ticketNew(ctx, {
            key,
            project,
            ...(typeof values.fsd === 'string' ? { fsd: values.fsd } : {}),
            ...(typeof values.note === 'string' ? { note: values.note } : {}),
            ...(typeof values.fixture === 'string' ? { fixture: values.fixture } : {}),
          });
        } else if (sub === 'show') {
          const { positionals, values } = parseCommandArgs(rest, {
            project: { type: 'string' },
          });
          const key = positionals[0];
          const project = resolveProject(values);
          if (!key || !project) {
            throw new CliError('ticket show requires <key> --project <slug>', EXIT_USAGE, 'USAGE');
          }
          await ticketShow(ctx, { key, project });
        } else {
          throw new CliError(`unknown ticket subcommand: ${sub}`, EXIT_USAGE, 'USAGE');
        }
        break;
      }
      case 'adjustment': {
        const { positionals, values } = parseCommandArgs(
          [sub, ...rest].filter(Boolean) as string[],
          {
            project: { type: 'string' },
            source: { type: 'string' },
            from: { type: 'string' },
            note: { type: 'string' },
            fixture: { type: 'string' },
          },
        );
        const key = positionals[0];
        const project = resolveProject(values);
        const source = typeof values.source === 'string' ? values.source : undefined;
        const note = typeof values.note === 'string' ? values.note : undefined;
        if (!key || !project || !source || !note) {
          throw new CliError(
            'adjustment requires <key> --project <slug> --source <type> --note <text>',
            EXIT_USAGE,
            'USAGE',
          );
        }
        await adjustment(ctx, {
          key,
          project,
          source,
          ...(typeof values.from === 'string' ? { from: values.from } : {}),
          note,
          ...(typeof values.fixture === 'string' ? { fixture: values.fixture } : {}),
        });
        break;
      }
      case 'proposal': {
        const { positionals, values } = parseCommandArgs(rest, {
          project: { type: 'string' },
          yes: { type: 'boolean', short: 'y' },
        });
        const project = resolveProject(values);
        if (!project) {
          throw new CliError('proposal requires --project <slug>', EXIT_USAGE, 'USAGE');
        }
        if (sub === 'list') {
          await proposalList(ctx, { project });
        } else if (sub === 'approve') {
          const id = positionals[0];
          if (!id) throw new CliError('proposal approve requires <id>', EXIT_USAGE, 'USAGE');
          await proposalApprove(ctx, { id, project, yes: values.yes === true });
        } else if (sub === 'reject') {
          const id = positionals[0];
          if (!id) throw new CliError('proposal reject requires <id>', EXIT_USAGE, 'USAGE');
          await proposalReject(ctx, { id, project });
        } else {
          throw new CliError(`unknown proposal subcommand: ${sub}`, EXIT_USAGE, 'USAGE');
        }
        break;
      }
      case 'check': {
        const { positionals, values } = parseCommandArgs(
          [sub, ...rest].filter(Boolean) as string[],
          {
            project: { type: 'string' },
            yes: { type: 'boolean', short: 'y' },
          },
        );
        const key = positionals[0];
        const requirementId = positionals[1];
        const project = resolveProject(values);
        if (!key || !requirementId || !project) {
          throw new CliError(
            'check requires <key> <requirement-id> --project <slug>',
            EXIT_USAGE,
            'USAGE',
          );
        }
        await check(ctx, { key, requirementId, project, yes: values.yes === true });
        break;
      }
      case 'export': {
        const { positionals, values } = parseCommandArgs(
          [sub, ...rest].filter(Boolean) as string[],
          {
            project: { type: 'string' },
            format: { type: 'string' },
            out: { type: 'string', short: 'o' },
          },
        );
        const key = positionals[0];
        const project = resolveProject(values);
        const format = typeof values.format === 'string' ? values.format : 'markdown';
        if (!key || !project) {
          throw new CliError('export requires <key> --project <slug>', EXIT_USAGE, 'USAGE');
        }
        if (format !== 'markdown' && format !== 'json') {
          throw new CliError('--format must be markdown or json', EXIT_USAGE, 'USAGE');
        }
        await exportSummary(ctx, {
          key,
          project,
          format,
          ...(typeof values.out === 'string' ? { out: values.out } : {}),
        });
        break;
      }
      case 'status': {
        const { values } = parseCommandArgs([sub, ...rest].filter(Boolean) as string[], {
          project: { type: 'string' },
          json: { type: 'boolean' },
        });
        const project = resolveProject(values);
        await statusProject(ctx, { project, json: values.json === true });
        break;
      }
      case 'checklist': {
        if (sub === 'list') {
          const { positionals, values } = parseCommandArgs(rest, {
            project: { type: 'string' },
            json: { type: 'boolean' },
            quiet: { type: 'boolean' },
          });
          const key = positionals[0];
          const project = resolveProject(values);
          if (!key || !project) {
            throw new CliError(
              'checklist list requires <ticketKey> --project <slug>',
              EXIT_USAGE,
              'USAGE',
            );
          }
          await checklistList(ctx, {
            key,
            project,
            json: values.json === true,
            quiet: values.quiet === true,
          });
        } else if (sub === 'add') {
          const { positionals, values } = parseCommandArgs(rest, {
            project: { type: 'string' },
            title: { type: 'string' },
            description: { type: 'string' },
            parent: { type: 'string' },
            'parent-id': { type: 'string' },
            from: { type: 'string' },
            note: { type: 'string' },
            json: { type: 'boolean' },
          });
          const key = positionals[0];
          const project = resolveProject(values);
          const title = typeof values.title === 'string' ? values.title : undefined;
          if (!key || !project || !title) {
            throw new CliError(
              'checklist add requires <ticketKey> --project <slug> --title <t>',
              EXIT_USAGE,
              'USAGE',
            );
          }
          await checklistAdd(ctx, {
            key,
            project,
            title,
            ...(typeof values.description === 'string' ? { description: values.description } : {}),
            ...(typeof values.parent === 'string' ? { parent: values.parent } : {}),
            ...(typeof values['parent-id'] === 'string' ? { parentId: values['parent-id'] } : {}),
            ...(typeof values.from === 'string' ? { from: values.from } : {}),
            ...(typeof values.note === 'string' ? { note: values.note } : {}),
            json: values.json === true,
          });
        } else if (sub === 'edit') {
          const { positionals, values } = parseCommandArgs(rest, {
            project: { type: 'string' },
            title: { type: 'string' },
            description: { type: 'string' },
            parent: { type: 'string' },
            from: { type: 'string' },
            note: { type: 'string' },
            json: { type: 'boolean' },
          });
          const key = positionals[0];
          const requirementId = positionals[1];
          const project = resolveProject(values);
          if (!key || !requirementId || !project) {
            throw new CliError(
              'checklist edit requires <ticketKey> <requirement-id> --project <slug>',
              EXIT_USAGE,
              'USAGE',
            );
          }
          await checklistEdit(ctx, {
            key,
            project,
            requirementId,
            ...(typeof values.title === 'string' ? { title: values.title } : {}),
            ...(typeof values.description === 'string' ? { description: values.description } : {}),
            ...(typeof values.parent === 'string' ? { parent: values.parent } : {}),
            ...(typeof values.from === 'string' ? { from: values.from } : {}),
            ...(typeof values.note === 'string' ? { note: values.note } : {}),
            json: values.json === true,
          });
        } else if (sub === 'supersede') {
          const { positionals, values } = parseCommandArgs(rest, {
            project: { type: 'string' },
            from: { type: 'string' },
            note: { type: 'string' },
            json: { type: 'boolean' },
          });
          const key = positionals[0];
          const requirementId = positionals[1];
          const project = resolveProject(values);
          if (!key || !requirementId || !project) {
            throw new CliError(
              'checklist supersede requires <ticketKey> <requirement-id> --project <slug>',
              EXIT_USAGE,
              'USAGE',
            );
          }
          await checklistSupersede(ctx, {
            key,
            project,
            requirementId,
            ...(typeof values.from === 'string' ? { from: values.from } : {}),
            ...(typeof values.note === 'string' ? { note: values.note } : {}),
            json: values.json === true,
          });
        } else if (sub === 'reorder') {
          const { positionals, values } = parseCommandArgs(rest, {
            project: { type: 'string' },
            order: { type: 'string' },
            json: { type: 'boolean' },
          });
          const key = positionals[0];
          const project = resolveProject(values);
          const orderRaw = typeof values.order === 'string' ? values.order : '';
          const order = orderRaw.split(',').filter((id) => id.length > 0);
          if (!key || !project || order.length === 0) {
            throw new CliError(
              'checklist reorder requires <ticketKey> --project <slug> --order <id1,id2,...>',
              EXIT_USAGE,
              'USAGE',
            );
          }
          await checklistReorder(ctx, { key, project, order, json: values.json === true });
        } else {
          throw new CliError(`unknown checklist subcommand: ${sub}`, EXIT_USAGE, 'USAGE');
        }
        break;
      }
      case 'uncheck': {
        const { positionals, values } = parseCommandArgs(
          [sub, ...rest].filter(Boolean) as string[],
          {
            project: { type: 'string' },
            from: { type: 'string' },
            note: { type: 'string' },
            json: { type: 'boolean' },
          },
        );
        const key = positionals[0];
        const requirementId = positionals[1];
        const project = resolveProject(values);
        if (!key || !requirementId || !project) {
          throw new CliError(
            'uncheck requires <ticketKey> <requirement-id> --project <slug>',
            EXIT_USAGE,
            'USAGE',
          );
        }
        await uncheck(ctx, {
          key,
          requirementId,
          project,
          ...(typeof values.from === 'string' ? { from: values.from } : {}),
          ...(typeof values.note === 'string' ? { note: values.note } : {}),
          json: values.json === true,
        });
        break;
      }
      case 'tui': {
        await tui(ctx);
        return EXIT_OK;
      }
      case 'repo': {
        const { positionals, values } = parseCommandArgs(rest, {
          name: { type: 'string', short: 'n' },
          path: { type: 'string', short: 'p' },
          project: { type: 'string' },
          json: { type: 'boolean' },
        });
        if (sub === 'add') {
          const name = typeof values.name === 'string' ? values.name : undefined;
          const path = typeof values.path === 'string' ? values.path : undefined;
          if (!name || !path) {
            throw new CliError(
              'repo add requires --name <slug> --path <path>',
              EXIT_USAGE,
              'USAGE',
            );
          }
          const repoProject = projectFlag(values);
          await repoAddGlobal(ctx.uow, {
            name,
            path,
            ...(typeof repoProject === 'string' ? { project: repoProject } : {}),
          });
        } else if (sub === 'list') {
          await repoList(ctx.uow, { json: values.json === true });
        } else if (sub === 'remove') {
          const id = positionals[0];
          if (!id) throw new CliError('repo remove requires <repo-id>', EXIT_USAGE, 'USAGE');
          await repoRemove(ctx.uow, { id });
        } else if (sub === 'subject') {
          const repoSub = positionals[0];
          const subjectId = positionals[1];
          const repoId = positionals[2];
          if (!subjectId) {
            throw new CliError(
              'repo subject requires <add|list|remove> <subject-id>',
              EXIT_USAGE,
              'USAGE',
            );
          }
          if (repoSub === 'list') {
            await subjectRepoList(ctx.uow, { subjectId, json: values.json === true });
          } else if (repoSub === 'add') {
            if (!repoId) {
              throw new CliError(
                'repo subject add requires <subject-id> <repo-id>',
                EXIT_USAGE,
                'USAGE',
              );
            }
            await subjectRepoAdd(ctx, { subjectId, repoId });
          } else if (repoSub === 'remove') {
            if (!repoId) {
              throw new CliError(
                'repo subject remove requires <subject-id> <repo-id>',
                EXIT_USAGE,
                'USAGE',
              );
            }
            await subjectRepoRemove(ctx, { subjectId, repoId });
          } else {
            throw new CliError(`unknown repo subject subcommand: ${repoSub}`, EXIT_USAGE, 'USAGE');
          }
        } else {
          throw new CliError(`unknown repo subcommand: ${sub}`, EXIT_USAGE, 'USAGE');
        }
        break;
      }
      case 'mcp': {
        const { values } = parseCommandArgs([sub, ...rest].filter(Boolean) as string[], {
          project: { type: 'string' },
        });
        const project = resolveProject(values);
        await runMcpServer({ projectSlug: project, appDir: ctx.appDir });
        return EXIT_OK;
      }
      case 'dashboard': {
        const { values } = parseCommandArgs([sub, ...rest].filter(Boolean) as string[], {
          project: { type: 'string' },
          port: { type: 'string' },
        });
        void resolveProject(values);
        const port = typeof values.port === 'string' ? Number(values.port) : undefined;
        const dashboardDist = resolveBundledDashboardDist();
        await startDashboard({
          appDir: ctx.appDir,
          ...(port !== undefined ? { port } : {}),
          ...(dashboardDist !== undefined ? { dashboardDist } : {}),
        });
        return EXIT_OK;
      }
      case 'infra': {
        const action = sub;
        if (action !== 'up' && action !== 'down') {
          throw new CliError('infra requires up or down', EXIT_USAGE, 'USAGE');
        }
        const composeFile = resolveComposeFile();
        const { spawnSync } = await import('node:child_process');
        const result = spawnSync(
          'docker',
          [
            'compose',
            '-f',
            composeFile,
            action === 'up' ? 'up' : 'down',
            ...(action === 'up' ? ['-d'] : []),
          ],
          { stdio: 'inherit' },
        );
        if (result.status !== 0) {
          throw new CliError(
            `docker compose ${action} failed (exit ${result.status})`,
            EXIT_ERROR,
            'INFRA',
          );
        }
        print(`infra ${action} complete (Qdrant via ${composeFile})`);
        break;
      }
      case 'eval': {
        const { runEvalCli } = await import('@trachex/agent');
        const { runAcceptanceTest } = await import('./evals/acceptance.ts');
        const evalCode = await runEvalCli();
        print('');
        const acceptance = await runAcceptanceTest();
        print(`ACCEPTANCE ${acceptance.passed ? 'PASS' : 'FAIL'}`);
        for (const line of acceptance.detail) {
          print(`  - ${line}`);
        }
        return evalCode === 0 && acceptance.passed ? EXIT_OK : EXIT_ERROR;
      }
      case undefined: {
        print('trachex — local-first development traceability');
        print('run `trachex --help` for usage');
        break;
      }
      default: {
        throw new CliError(`unknown command: ${command}`, EXIT_USAGE, 'USAGE');
      }
    }
    return EXIT_OK;
  } catch (error) {
    if (error instanceof CliError) {
      printJson({ error: { code: error.code, message: error.message } });
      return error.exitCode;
    }
    if (error instanceof DomainError) {
      printJson({ error: { code: error.code, message: error.message } });
      return EXIT_DOMAIN;
    }
    if (error instanceof PipelineError) {
      printJson({ error: { code: 'PIPELINE', message: error.message } });
      return EXIT_ERROR;
    }
    printJson({
      error: {
        code: 'INTERNAL',
        message: error instanceof Error ? error.message : String(error),
      },
    });
    return EXIT_ERROR;
  } finally {
    ctx.db.close();
  }
}

export * from './export.ts';
