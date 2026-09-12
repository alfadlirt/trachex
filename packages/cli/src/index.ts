import { PipelineError } from '@trachex/agent';
import { startDashboard } from '@trachex/api';
import { DomainError } from '@trachex/domain';
import { runMcpServer } from '@trachex/mcp';
import { loadTrachexEnv, resolveBundledDashboardDist } from '@trachex/shared';
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
  projectDelete,
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
import {
  subjectDelete,
  subjectCheck,
  subjectChecklist,
  subjectExport,
  subjectList,
  subjectNew,
  subjectShow,
  subjectUse,
} from './commands/subject.ts';
import { contextIngest, subjectAddDocument } from './commands/ticket.ts';
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
  const runtimeEnv = loadTrachexEnv(env.env ?? process.env);
  const [command, sub, ...rest] = argv;
  const ctx = openApp(env.appDir, runtimeEnv);
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
      print('project delete <slug> --force --confirm-name <exact name>');
      print('project list');
      print('project repo add <project> --name <slug> --path <path>');
      print('project export <slug> --out <archive>');
      print('context ingest <project> --include <paths>');
      print('info [--json]');
      print('subject new --project <slug> --name <name> [--description <d>]');
      print('subject list --project <slug>');
      print('subject show <subject-id>');
       print('subject use <subject-id> | --clear');
       print('subject add-doc <subject-id> --docs <file> [--fixture <proposal.json>]');
       print('subject checklist <subject-id> [--json]');
       print('subject check <subject-id> <requirement-id> [--yes]');
       print('subject export <subject-id> --format markdown|json [--out <file>]');
      print('subject delete <subject-id> --force --confirm-name <exact name>');
      print(
        'settings show | settings set theme auto|dark|light|no-color | settings set accent <color>',
      );
      print('repo add --name <slug> --path <path>');
      print('repo list | repo remove <repo-id>');
      print('subject repo <add|list|remove> <subject-id> [<repo-id>]');
       print('subject adjustment <subject-id> --source <type> --from <actor> --note <text>');
      print('proposal list --project <slug>');
      print('proposal approve <id> --project <slug> [--yes]');
      print('proposal reject <id> --project <slug>');
       print('subject check <subject-id> <requirement-id> [--yes]');
       print('subject export <subject-id> --format markdown|json [--out <file>]');
      print('status [--project <slug>] [--json]');
       print('subject checklist <subject-id> [list|add|edit|supersede|reorder]');
       print('subject uncheck <subject-id> <requirement-id>');
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
        } else if (sub === 'delete') {
          const { positionals, values } = parseCommandArgs(rest, {
            force: { type: 'boolean' },
            'confirm-name': { type: 'string' },
          });
          const slug = positionals[0];
          if (!slug) throw new CliError('project delete requires <slug>', EXIT_USAGE, 'USAGE');
          await projectDelete(ctx, {
            slug,
            force: values.force === true,
            ...(typeof values['confirm-name'] === 'string'
              ? { confirmName: values['confirm-name'] }
              : {}),
          });
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
          docs: { type: 'string' },
          fixture: { type: 'string' },
          yes: { type: 'boolean', short: 'y' },
          format: { type: 'string' },
          out: { type: 'string' },
          subject: { type: 'string' },
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
        } else if (sub === 'add-doc') {
          const subject = positionals[0];
          const document = typeof values.docs === 'string' ? values.docs : undefined;
          const project = typeof values.project === 'string' ? values.project : undefined;
          if (!subject || !document) {
            throw new CliError('subject add-doc requires <subject-id|name|slug> --docs <file>', EXIT_USAGE, 'USAGE');
          }
          await subjectAddDocument(ctx, {
            subject,
            ...(project ? { project } : {}),
            document,
            ...(typeof values.fixture === 'string' ? { fixture: values.fixture } : {}),
          });
        } else if (sub === 'checklist') {
          const id = positionals[0];
          if (!id) throw new CliError('subject checklist requires <subject-id>', EXIT_USAGE, 'USAGE');
          const explicitProject = projectFlag(values);
          await subjectChecklist(ctx, {
            id,
            ...(explicitProject ? { project: explicitProject } : {}),
            json: values.json === true,
          });
        } else if (sub === 'check') {
          const id = positionals[0];
          const requirementId = positionals[1];
          if (!id || !requirementId) {
            throw new CliError('subject check requires <subject-id> <requirement-id>', EXIT_USAGE, 'USAGE');
          }
          const explicitProject = projectFlag(values);
          await subjectCheck(ctx, {
            id,
            ...(explicitProject ? { project: explicitProject } : {}),
            requirementId,
            yes: values.yes === true,
          });
        } else if (sub === 'export') {
          const id = positionals[0];
          const format = values.format;
          if (!id || (format !== 'markdown' && format !== 'json')) {
            throw new CliError('subject export requires <subject-id> --format markdown|json', EXIT_USAGE, 'USAGE');
          }
          const explicitProject = projectFlag(values);
          await subjectExport(ctx, {
            id,
            ...(explicitProject ? { project: explicitProject } : {}),
            format,
            ...(typeof values.out === 'string' ? { out: values.out } : {}),
          });
        } else if (sub === 'list') {
          const project = resolveProject(values);
          await subjectList(ctx.uow, { project, json: values.json === true });
        } else if (sub === 'show') {
          const id = positionals[0];
          if (!id) throw new CliError('subject show requires <subject-id>', EXIT_USAGE, 'USAGE');
          const explicitProject = projectFlag(values);
          await subjectShow(ctx.uow, {
            id,
            ...(explicitProject ? { project: explicitProject } : {}),
            json: values.json === true,
          });
        } else if (sub === 'delete') {
          const { positionals, values } = parseCommandArgs(rest, {
            force: { type: 'boolean' },
            'confirm-name': { type: 'string' },
            project: { type: 'string' },
          });
          const explicitDeleteProject =
            typeof values.project === 'string' ? values.project : undefined;
          const id = positionals[0];
          if (!id) throw new CliError('subject delete requires <subject-id>', EXIT_USAGE, 'USAGE');
          await subjectDelete(ctx, {
            id,
            ...(typeof explicitDeleteProject === 'string' ? { project: explicitDeleteProject } : {}),
            force: values.force === true,
            ...(typeof values['confirm-name'] === 'string'
              ? { confirmName: values['confirm-name'] }
              : {}),
          });
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
            await subjectRepoList(ctx.uow, { subjectId, ...(typeof values.project === "string" ? { project: values.project } : {}), json: values.json === true });
          } else if (repoSub === 'add') {
            if (!repoId) {
              throw new CliError(
                'subject repo add requires <subject-id> <repo-id>',
                EXIT_USAGE,
                'USAGE',
              );
            }
            await subjectRepoAdd(ctx, { subjectId, ...(typeof values.project === "string" ? { project: values.project } : {}), repoId });
          } else if (repoSub === 'remove') {
            if (!repoId) {
              throw new CliError(
                'subject repo remove requires <subject-id> <repo-id>',
                EXIT_USAGE,
                'USAGE',
              );
            }
            await subjectRepoRemove(ctx, { subjectId, ...(typeof values.project === "string" ? { project: values.project } : {}), repoId });
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
        const subjectId = positionals[0];
        const source = typeof values.source === 'string' ? values.source : undefined;
        const note = typeof values.note === 'string' ? values.note : undefined;
        if (!subjectId || !source || !note) {
          throw new CliError(
            'adjustment requires <subject-id> --source <type> --note <text>',
            EXIT_USAGE,
            'USAGE',
          );
        }
        await adjustment(ctx, {
          subjectId,
          ...(typeof values.project === "string" ? { project: values.project } : {}),
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
        const subjectId = positionals[0];
        const requirementId = positionals[1];
        if (!subjectId || !requirementId) {
          throw new CliError(
            'check requires <subject-id> <requirement-id>',
            EXIT_USAGE,
            'USAGE',
          );
        }
        await check(ctx, { subjectId, ...(typeof values.project === "string" ? { project: values.project } : {}), requirementId, yes: values.yes === true });
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
        const subjectId = positionals[0];
        const format = typeof values.format === 'string' ? values.format : 'markdown';
        if (!subjectId) {
          throw new CliError('export requires <subject-id>', EXIT_USAGE, 'USAGE');
        }
        if (format !== 'markdown' && format !== 'json') {
          throw new CliError('--format must be markdown or json', EXIT_USAGE, 'USAGE');
        }
        await exportSummary(ctx, {
          subjectId,
          ...(typeof values.project === "string" ? { project: values.project } : {}),
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
          const subjectId = positionals[0];
          if (!subjectId) {
            throw new CliError(
              'checklist list requires <subject-id>',
              EXIT_USAGE,
              'USAGE',
            );
          }
          await checklistList(ctx, {
            subjectId,
            ...(typeof values.project === "string" ? { project: values.project } : {}),
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
          const subjectId = positionals[0];
          const title = typeof values.title === 'string' ? values.title : undefined;
          if (!subjectId || !title) {
            throw new CliError(
              'checklist add requires <subject-id> --title <t>',
              EXIT_USAGE,
              'USAGE',
            );
          }
          await checklistAdd(ctx, {
            subjectId,
            ...(typeof values.project === "string" ? { project: values.project } : {}),
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
          const subjectId = positionals[0];
          const requirementId = positionals[1];
          if (!subjectId || !requirementId) {
            throw new CliError(
              'checklist edit requires <subject-id> <requirement-id>',
              EXIT_USAGE,
              'USAGE',
            );
          }
          await checklistEdit(ctx, {
            subjectId,
            ...(typeof values.project === "string" ? { project: values.project } : {}),
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
          const subjectId = positionals[0];
          const requirementId = positionals[1];
          if (!subjectId || !requirementId) {
            throw new CliError(
              'checklist supersede requires <subject-id> <requirement-id>',
              EXIT_USAGE,
              'USAGE',
            );
          }
          await checklistSupersede(ctx, {
            subjectId,
            ...(typeof values.project === "string" ? { project: values.project } : {}),
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
          const subjectId = positionals[0];
          const orderRaw = typeof values.order === 'string' ? values.order : '';
          const order = orderRaw.split(',').filter((id) => id.length > 0);
          if (!subjectId || order.length === 0) {
            throw new CliError(
              'checklist reorder requires <subject-id> --order <id1,id2,...>',
              EXIT_USAGE,
              'USAGE',
            );
          }
          await checklistReorder(ctx, { subjectId, ...(typeof values.project === "string" ? { project: values.project } : {}), order, json: values.json === true });
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
        const subjectId = positionals[0];
        const requirementId = positionals[1];
        if (!subjectId || !requirementId) {
          throw new CliError(
            'uncheck requires <subject-id> <requirement-id>',
            EXIT_USAGE,
            'USAGE',
          );
        }
        await uncheck(ctx, {
          subjectId,
          ...(typeof values.project === "string" ? { project: values.project } : {}),
          requirementId,
          ...(typeof values.from === 'string' ? { from: values.from } : {}),
          ...(typeof values.note === 'string' ? { note: values.note } : {}),
          json: values.json === true,
        });
        break;
      }
      case 'tui': {
        await tui(ctx, runtimeEnv);
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
            await subjectRepoList(ctx.uow, { subjectId, ...(typeof values.project === "string" ? { project: values.project } : {}), json: values.json === true });
          } else if (repoSub === 'add') {
            if (!repoId) {
              throw new CliError(
                'repo subject add requires <subject-id> <repo-id>',
                EXIT_USAGE,
                'USAGE',
              );
            }
            await subjectRepoAdd(ctx, { subjectId, ...(typeof values.project === "string" ? { project: values.project } : {}), repoId });
          } else if (repoSub === 'remove') {
            if (!repoId) {
              throw new CliError(
                'repo subject remove requires <subject-id> <repo-id>',
                EXIT_USAGE,
                'USAGE',
              );
            }
            await subjectRepoRemove(ctx, { subjectId, ...(typeof values.project === "string" ? { project: values.project } : {}), repoId });
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
