import { type RunAgentFn, runReconciliation } from '@trachex/agent';
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
}

export function createRoutes(deps: RouteDeps): Hono {
  const app = new Hono();
  const { ctx, runAgent } = deps;

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
      const body = adjustmentSchema.parse(await c.req.json());
      const result = await runReconciliation(
        ctx.uow,
        { runAgent },
        {
          appDir: ctx.appDir,
          projectId: project.id,
          ticketId: ticket.id,
          type: body.source,
          ...(body.attribution !== undefined ? { attribution: body.attribution } : {}),
          relPath: 'note',
          contentKind: 'text',
          content: body.note,
        },
      );
      return c.json(
        {
          proposal: {
            id: result.proposal.id,
            kind: result.proposal.kind,
            status: result.proposal.status,
          },
          source: result.source,
        },
        201,
      );
    } catch (error) {
      return c.json(errorPayload(error), statusForError(error));
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
