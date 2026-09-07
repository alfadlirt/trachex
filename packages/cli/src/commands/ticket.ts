import { readFileSync } from 'node:fs';
import { runExtraction } from '@trachex/agent';
import { createTicket, NotFoundError, type SourceType } from '@trachex/domain';
import { ingestFile } from '@trachex/storage-sqlite';
import { buildRunAgent } from '../agent-wiring.ts';
import type { AppContext } from '../app.ts';
import { print, printJson } from '../io.ts';

const CONTEXT_TICKET_KEY = '__context__';

export async function contextIngest(
  ctx: AppContext,
  args: {
    project: string;
    repo?: string;
    include: string[];
  },
) {
  const project = await ctx.uow.projects.findBySlug(args.project);
  if (!project) {
    throw new NotFoundError('project', args.project);
  }
  if (args.repo) {
    const repo = await ctx.uow.repositories.findByProjectAndSlug(project.id, args.repo);
    if (!repo) {
      throw new NotFoundError('repository', args.repo);
    }
  }
  let contextTicket = await ctx.uow.tickets.findByProjectAndKey(project.id, CONTEXT_TICKET_KEY);
  if (!contextTicket) {
    contextTicket = await createTicket(ctx.uow, {
      projectId: project.id,
      key: CONTEXT_TICKET_KEY,
      title: 'Project context',
    });
  }
  for (const path of args.include) {
    const content = readFileSync(path, 'utf8');
    const result = await ingestFile(ctx.uow, {
      appDir: ctx.appDir,
      projectId: project.id,
      ticketId: contextTicket.id,
      type: 'context',
      relPath: path,
      contentKind: 'text',
      content,
    });
    print(`ingested ${path} (snapshot ${result.snapshot.id})`);
  }
}

export async function ticketNew(
  ctx: AppContext,
  args: {
    key: string;
    project: string;
    fsd?: string;
    note?: string;
    fixture?: string;
  },
) {
  const project = await ctx.uow.projects.findBySlug(args.project);
  if (!project) {
    throw new NotFoundError('project', args.project);
  }
  const content = args.fsd ? readFileSync(args.fsd, 'utf8') : (args.note ?? '');
  const ticket = await createTicket(ctx.uow, {
    projectId: project.id,
    key: args.key,
    title: args.key,
  });
  const runAgent = buildRunAgent({
    search: ctx.uow.search,
    ...(args.fixture !== undefined ? { fixturePath: args.fixture } : {}),
  });
  const result = await runExtraction(
    ctx.uow,
    { runAgent },
    {
      appDir: ctx.appDir,
      projectId: project.id,
      ticketId: ticket.id,
      type: args.fsd ? 'fsd' : ('manual' as SourceType),
      relPath: args.fsd ?? 'note',
      contentKind: args.fsd ? 'markdown' : 'text',
      content,
    },
  );
  printJson({
    ticket: { id: ticket.id, key: ticket.key },
    source: result.source,
    proposal: {
      id: result.proposal.id,
      kind: result.proposal.kind,
      status: result.proposal.status,
    },
  });
}

export async function ticketShow(ctx: AppContext, args: { key: string; project: string }) {
  const project = await ctx.uow.projects.findBySlug(args.project);
  if (!project) {
    throw new NotFoundError('project', args.project);
  }
  const ticket = await ctx.uow.tickets.findByProjectAndKey(project.id, args.key);
  if (!ticket) {
    throw new NotFoundError('ticket', args.key);
  }
  const checklist = await ctx.uow.requirements.listActiveByTicket(ticket.id);
  const proposals = await ctx.uow.proposals.listByTicket(ticket.id);
  const sources = await ctx.uow.sources.listByTicket(ticket.id);
  printJson({ ticket, checklist, proposals, sources });
}
