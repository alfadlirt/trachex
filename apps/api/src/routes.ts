import type { RunAgentFn } from '@trachex/agent';
import type { ProposalOutput } from '@trachex/domain';
import {
  approveProposal,
  buildExportSummary,
  buildProposalReviews,
  checkRequirement,
  createProject,
  createTicket,
  editProposal,
  NotFoundError,
  rejectProposal,
  resetProposal,
  serializeJson,
  serializeMarkdown,
} from '@trachex/domain';
import { Hono } from 'hono';
import type { ApiContext } from './context.ts';
import { errorPayload, statusForError } from './errors.ts';
import { UploadError, validateAndReadUpload } from './uploads.ts';
import {
  adjustmentSchema,
  checkSchema,
  createProjectSchema,
  createTicketSchema,
  proposalEditSchema,
} from './validation.ts';

export interface RouteDeps {
  ctx: ApiContext;
  runAgent: RunAgentFn;
  enqueueAdjustment?: (jobId: string) => Promise<string>;
}

export function createRoutes(deps: RouteDeps): Hono {
  const app = new Hono();
  const { ctx } = deps;
  if (!ctx.uow.adjustmentJobs) throw new Error('Adjustment queue storage is unavailable.');
  const adjustmentJobs = ctx.uow.adjustmentJobs;
  const enqueue = deps.enqueueAdjustment;

  app.get('/projects', async (c) => {
    const projects = await ctx.uow.projects.list();
    return c.json({ projects });
  });

  app.post('/projects', async (c) => {
    try {
      const body = createProjectSchema.parse(await c.req.json());
      const result = await createProject(ctx.uow, {
        slug: body.slug,
        name: body.name,
        ...(body.description !== undefined ? { description: body.description } : {}),
      });
      return c.json({ project: result }, 201);
    } catch (error) {
      return c.json(errorPayload(error), statusForError(error));
    }
  });

  app.get('/projects/:projectId/tickets', async (c) => {
    const project = await ctx.uow.projects.findById(c.req.param('projectId'));
    if (!project) {
      return c.json(errorPayload(new NotFoundError('project', c.req.param('projectId'))), 404);
    }
    const tickets = await ctx.uow.tickets.listByProject(project.id);
    return c.json({ project, tickets });
  });

  app.post('/projects/:projectId/tickets', async (c) => {
    try {
      const project = await ctx.uow.projects.findById(c.req.param('projectId'));
      if (!project) {
        return c.json(errorPayload(new NotFoundError('project', c.req.param('projectId'))), 404);
      }
      const body = createTicketSchema.parse(await c.req.json());
      const ticket = await createTicket(ctx.uow, {
        projectId: project.id,
        key: body.key,
        title: body.title,
        ...(body.description !== undefined ? { description: body.description } : {}),
      });
      return c.json({ ticket }, 201);
    } catch (error) {
      return c.json(errorPayload(error), statusForError(error));
    }
  });

  app.get('/projects/:projectId/tickets/:ticketKey', async (c) => {
    const project = await ctx.uow.projects.findById(c.req.param('projectId'));
    if (!project) {
      return c.json(errorPayload(new NotFoundError('project', c.req.param('projectId'))), 404);
    }
    const ticket = await ctx.uow.tickets.findByProjectAndKey(project.id, c.req.param('ticketKey'));
    if (!ticket) {
      return c.json(errorPayload(new NotFoundError('ticket', c.req.param('ticketKey'))), 404);
    }
    const checklist = await ctx.uow.requirements.listActiveByTicket(ticket.id);
    const proposals = await ctx.uow.proposals.listByTicket(ticket.id);
    const proposalReviews = await buildProposalReviews(ctx.uow, ticket.id);
    const sources = await ctx.uow.sources.listByTicket(ticket.id);
    const impacts = await ctx.uow.requirements.listImpactsByTicket(ticket.id);
    const scenarios = await ctx.uow.requirements.listScenariosByTicket(ticket.id);
    const summary = await buildExportSummary(ctx.uow, {
      projectId: project.id,
      ticketKey: ticket.key,
    });
    return c.json({
      project,
      ticket,
      checklist,
      proposals,
      proposalReviews,
      sources,
      impacts,
      scenarios,
      timeline: summary.timeline,
      adjustmentJobs: (await ctx.uow.adjustmentJobs?.listByTicket(ticket.id)) ?? [],
    });
  });

  app.post('/projects/:projectId/tickets/:ticketKey/adjustments', async (c) => {
    try {
      const project = await ctx.uow.projects.findById(c.req.param('projectId'));
      if (!project) {
        return c.json(errorPayload(new NotFoundError('project', c.req.param('projectId'))), 404);
      }
      const ticket = await ctx.uow.tickets.findByProjectAndKey(
        project.id,
        c.req.param('ticketKey'),
      );
      if (!ticket) {
        return c.json(errorPayload(new NotFoundError('ticket', c.req.param('ticketKey'))), 404);
      }
      const isMultipart = c.req.header('content-type')?.includes('multipart/form-data') ?? false;
      let body: {
        source: 'fsd' | 'brd' | 'chat' | 'meeting' | 'clarification' | 'uat' | 'manual' | 'context';
        attribution?: string | undefined;
        note?: string | undefined;
        file?: File | undefined;
      };
      if (isMultipart) {
        const form = await c.req.formData();
        const source = form.get('source');
        const file = form.get('file');
        if (typeof source !== 'string') throw new UploadError('Choose a source type.');
        body = { source: adjustmentSchema.shape.source.parse(source) };
        const attribution = form.get('attribution');
        const note = form.get('note');
        if (typeof attribution === 'string' && attribution.trim())
          body.attribution = attribution.trim();
        if (typeof note === 'string' && note.trim()) body.note = note.trim();
        if (file instanceof File && file.size > 0) body.file = file;
        if (!body.note && !body.file)
          throw new UploadError('Add a note or attach a Markdown/PDF file.');
      } else body = adjustmentSchema.parse(await c.req.json());
      let content = body.note ?? '';
      let relPath = 'note';
      let contentKind = 'text';
      if (body.file) {
        const upload = await validateAndReadUpload(body.file, ctx.appDir);
        content = [content, upload.content].filter(Boolean).join('\n\n');
        relPath = upload.displayName.replace(/[^a-zA-Z0-9._-]/g, '_');
        contentKind = upload.extension === '.pdf' ? 'pdf-text' : 'markdown';
      }
      if (!ctx.uow.adjustmentJobs) throw new Error('Adjustment queue storage is unavailable.');
      const existing = await adjustmentJobs.findActiveByTicket(ticket.id);
      if (existing)
        return c.json(
          {
            error: {
              code: 'CONFLICT',
              message: `Adjustment job ${existing.id} is already ${existing.status}.`,
            },
            job: existing,
          },
          409,
        );
      const sourceResult = await import('@trachex/storage-sqlite').then(({ ingestFile }) =>
        ingestFile(ctx.uow, {
          appDir: ctx.appDir,
          projectId: project.id,
          ticketId: ticket.id,
          type: body.source,
          ...(body.attribution !== undefined ? { attribution: body.attribution } : {}),
          relPath,
          contentKind,
          content,
          ...(body.file ? { location: relPath } : {}),
          ...(body.note ? { note: body.note } : {}),
        }),
      );
      const now = new Date().toISOString();
      const job = await adjustmentJobs.create({
        id: crypto.randomUUID(),
        projectId: project.id,
        ticketId: ticket.id,
        sourceId: sourceResult.source.id,
        queueJobId: null,
        status: 'queued',
        sourceType: body.source,
        attribution: body.attribution ?? null,
        sourceLocation: relPath,
        createdAt: now,
        updatedAt: now,
        startedAt: null,
        completedAt: null,
        attempts: 0,
        error: null,
        proposalId: null,
      });
      if (!enqueue) throw new Error('Adjustment queue is not configured. Set TRACHEX_REDIS_URL.');
      let queueJobId: string;
      try {
        queueJobId = await enqueue(job.id);
      } catch (error) {
        await ctx.uow.adjustmentJobs.update({
          ...job,
          status: 'failed',
          error: `Adjustment queue unavailable. Retry this upload. ${error instanceof Error ? error.message : String(error)}`,
          updatedAt: new Date().toISOString(),
        });
        throw error;
      }
      const queued = await adjustmentJobs.update({
        ...job,
        queueJobId,
        updatedAt: new Date().toISOString(),
      });
      return c.json({ job: queued, source: sourceResult.source }, 202);
    } catch (error) {
      process.stderr.write(
        `[trachex] adjustment failed: ${JSON.stringify(inspectRouteError(error))}\n`,
      );
      return c.json(errorPayload(error), statusForError(error));
    }
  });

  app.get('/projects/:projectId/tickets/:ticketKey/adjustments/jobs', async (c) => {
    const ticket = await findTicket(ctx, c.req.param('projectId'), c.req.param('ticketKey'));
    if (!ticket)
      return c.json(errorPayload(new NotFoundError('ticket', c.req.param('ticketKey'))), 404);
    return c.json({ jobs: (await ctx.uow.adjustmentJobs?.listByTicket(ticket.id)) ?? [] });
  });

  app.post('/projects/:projectId/tickets/:ticketKey/adjustments/jobs/:jobId/retry', async (c) => {
    const ticket = await findTicket(ctx, c.req.param('projectId'), c.req.param('ticketKey'));
    const job = await adjustmentJobs.findById(c.req.param('jobId'));
    if (!ticket || !job || job.ticketId !== ticket.id)
      return c.json(errorPayload(new NotFoundError('adjustment job', c.req.param('jobId'))), 404);
    if (job.status !== 'failed')
      return c.json(
        { error: { code: 'INVALID_OPERATION', message: 'Only failed jobs can be retried.' } },
        409,
      );
    const active = await adjustmentJobs.findActiveByTicket(ticket.id);
    if (active)
      return c.json(
        {
          error: { code: 'CONFLICT', message: `Adjustment job ${active.id} is already active.` },
          job: active,
        },
        409,
      );
    const queued = await adjustmentJobs.update({
      ...job,
      status: 'queued',
      error: null,
      proposalId: null,
      updatedAt: new Date().toISOString(),
    });
    if (!enqueue) throw new Error('Adjustment queue is not configured. Set TRACHEX_REDIS_URL.');
    try {
      const queueJobId = await enqueue(queued.id);
      const enqueued = await adjustmentJobs.update({
        ...queued,
        queueJobId,
        updatedAt: new Date().toISOString(),
      });
      return c.json({ job: enqueued }, 202);
    } catch (error) {
      await adjustmentJobs.update({
        ...queued,
        status: 'failed',
        error: `Adjustment queue unavailable. Retry this job. ${error instanceof Error ? error.message : String(error)}`,
        updatedAt: new Date().toISOString(),
      });
      throw error;
    }
  });

  app.post('/proposals/:proposalId/approve', async (c) => {
    try {
      await approveProposal(ctx.uow, { proposalId: c.req.param('proposalId') });
      return c.json({ proposalId: c.req.param('proposalId'), status: 'approved' });
    } catch (error) {
      return c.json(errorPayload(error), statusForError(error));
    }
  });

  app.post('/projects/:projectId/tickets/:ticketKey/proposals/:proposalId/edit', async (c) => {
    try {
      const body = proposalEditSchema.parse(await c.req.json());
      const proposal = await ctx.uow.proposals.findById(c.req.param('proposalId'));
      if (!proposal)
        return c.json(errorPayload(new NotFoundError('proposal', c.req.param('proposalId'))), 404);
      const ticket = await ctx.uow.tickets.findById(proposal.ticketId);
      if (!ticket) return c.json(errorPayload(new NotFoundError('ticket', proposal.ticketId)), 404);
      if (
        ticket.projectId !== c.req.param('projectId') ||
        ticket.key !== c.req.param('ticketKey')
      ) {
        return c.json(errorPayload(new NotFoundError('proposal', c.req.param('proposalId'))), 404);
      }
      const version = await editProposal(ctx.uow, {
        proposalId: proposal.id,
        editedOutput: body.editedOutput as unknown as ProposalOutput,
      });
      return c.json({ proposalId: proposal.id, version });
    } catch (error) {
      return c.json(errorPayload(error), statusForError(error));
    }
  });

  app.post('/projects/:projectId/tickets/:ticketKey/proposals/:proposalId/reset', async (c) => {
    try {
      const proposal = await ctx.uow.proposals.findById(c.req.param('proposalId'));
      if (!proposal)
        return c.json(errorPayload(new NotFoundError('proposal', c.req.param('proposalId'))), 404);
      const ticket = await ctx.uow.tickets.findById(proposal.ticketId);
      if (!ticket) return c.json(errorPayload(new NotFoundError('ticket', proposal.ticketId)), 404);
      if (
        ticket.projectId !== c.req.param('projectId') ||
        ticket.key !== c.req.param('ticketKey')
      ) {
        return c.json(errorPayload(new NotFoundError('proposal', c.req.param('proposalId'))), 404);
      }
      const version = await resetProposal(ctx.uow, { proposalId: proposal.id });
      return c.json({ proposalId: proposal.id, version });
    } catch (error) {
      return c.json(errorPayload(error), statusForError(error));
    }
  });

  app.post('/proposals/:proposalId/reject', async (c) => {
    try {
      await rejectProposal(ctx.uow, { proposalId: c.req.param('proposalId') });
      return c.json({ proposalId: c.req.param('proposalId'), status: 'rejected' });
    } catch (error) {
      return c.json(errorPayload(error), statusForError(error));
    }
  });

  app.post('/requirements/:requirementId/check', async (c) => {
    try {
      const body = checkSchema.parse(await c.req.json());
      void body;
      const audit = await checkRequirement(ctx.uow, {
        requirementId: c.req.param('requirementId'),
        actorType: 'human',
      });
      return c.json({ requirementId: c.req.param('requirementId'), status: 'checked', audit });
    } catch (error) {
      return c.json(errorPayload(error), statusForError(error));
    }
  });

  app.get('/projects/:projectId/tickets/:ticketKey/export', async (c) => {
    const project = await ctx.uow.projects.findById(c.req.param('projectId'));
    if (!project) {
      return c.json(errorPayload(new NotFoundError('project', c.req.param('projectId'))), 404);
    }
    const format = c.req.query('format') === 'json' ? 'json' : 'markdown';
    const summary = await buildExportSummary(ctx.uow, {
      projectId: project.id,
      ticketKey: c.req.param('ticketKey'),
    });
    const text = format === 'json' ? serializeJson(summary) : serializeMarkdown(summary);
    c.header('Content-Type', format === 'json' ? 'application/json' : 'text/markdown');
    return c.body(text);
  });

  return app;
}

async function findTicket(ctx: ApiContext, projectId: string, ticketKey: string) {
  const project = await ctx.uow.projects.findById(projectId);
  return project ? ctx.uow.tickets.findByProjectAndKey(project.id, ticketKey) : null;
}

function inspectRouteError(error: unknown) {
  return {
    name: error instanceof Error ? error.name : 'UnknownError',
    message: error instanceof Error ? error.message : String(error),
    cause: error instanceof Error && error.cause instanceof Error ? error.cause.message : undefined,
  };
}
