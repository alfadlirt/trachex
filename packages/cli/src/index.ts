import { PipelineError } from '@trachex/agent';
import { DomainError } from '@trachex/domain';
import { runMcpServer } from '@trachex/mcp';
import { openApp } from './app.ts';
import { parseCommandArgs } from './args.ts';
import { adjustment } from './commands/adjustment.ts';
import { check } from './commands/check.ts';
import { exportSummary } from './commands/export.ts';
import {
  projectCreate,
  projectExport,
  projectList,
  projectUse,
  repoAdd,
} from './commands/project.ts';
import { proposalApprove, proposalList, proposalReject } from './commands/proposal.ts';
import { contextIngest, ticketNew, ticketShow } from './commands/ticket.ts';
import { resolveProjectSlug } from './context.ts';
import { CliError, EXIT_DOMAIN, EXIT_ERROR, EXIT_OK, EXIT_USAGE } from './errors.ts';
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
      print('ticket new <key> --project <slug> --fsd <file>');
      print('ticket show <key> --project <slug>');
      print('adjustment <key> --project <slug> --source <type> --from <actor> --note <text>');
      print('proposal list --project <slug>');
      print('proposal approve <id> --project <slug> [--yes]');
      print('proposal reject <id> --project <slug>');
      print('check <key> <requirement-id> --project <slug> [--yes]');
      print('export <key> --project <slug> --format markdown|json [--out <file>]');
      print('dashboard | mcp | infra');
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
      case 'mcp': {
        const { values } = parseCommandArgs([sub, ...rest].filter(Boolean) as string[], {
          project: { type: 'string' },
        });
        const project = resolveProject(values);
        await runMcpServer({ projectSlug: project, appDir: ctx.appDir });
        return EXIT_OK;
      }
      case 'dashboard':
      case 'infra': {
        print(`${command} is not implemented yet (planned in a later phase)`);
        break;
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
