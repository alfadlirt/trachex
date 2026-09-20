import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import type { RunAgentFn } from '@trachex/agent';
import { createProject, createTicket } from '@trachex/domain';
import { openApiContext } from './context.ts';
import { createApp } from './index.ts';

function tempAppDir(): string {
  return mkdtempSync(join(tmpdir(), 'trachex-api-'));
}

const runAgent: RunAgentFn = async ({ instructions }) =>
  instructions.includes('ticket-context assistant')
    ? { answer: 'The ticket baseline is available for review.', evidence: [] }
    : {
        kind: 'reconciliation',
        create: [{ title: 'Discount cap 15%' }],
      };

async function setup() {
  const appDir = tempAppDir();
  const ctx = openApiContext(appDir);
  const project = await createProject(ctx.uow, { slug: 'loyalty', name: 'Loyalty' });
  const ticket = await createTicket(ctx.uow, {
    projectId: project.id,
    key: 'TICKET-1',
    title: 'Loyalty',
  });
  const app = createApp({
    appDir,
    env: { OPENAI_API_KEY: 'test' },
    runAgent,
    enqueueAdjustment: async (jobId) => `test-queue-${jobId}`,
  });
  return { appDir, ctx, project, ticket, app };
}

test('GET /api/projects lists projects', async () => {
  const { appDir, ctx, app } = await setup();
  try {
    const res = await app.request('/api/projects');
    assert.equal(res.status, 200);
    const body = (await res.json()) as { projects: unknown[] };
    assert.equal(body.projects.length, 1);
  } finally {
    ctx.db.close();
    rmSync(appDir, { recursive: true, force: true });
  }
});

test('POST /api/projects creates a project and rejects duplicate slug', async () => {
  const { appDir, ctx, app } = await setup();
  try {
    const res = await app.request('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: 'newproj', name: 'New' }),
    });
    assert.equal(res.status, 201);
    const body = (await res.json()) as {
      project: {
        id: string;
        slug: string;
        name: string;
        description: string | null;
        createdAt: string;
        updatedAt: string;
      };
    };
    assert.deepEqual(body.project, {
      id: body.project.id,
      slug: 'newproj',
      name: 'New',
      description: null,
      createdAt: body.project.createdAt,
      updatedAt: body.project.updatedAt,
    });
    const dup = await app.request('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: 'loyalty', name: 'Dup' }),
    });
    assert.equal(dup.status, 409);
  } finally {
    ctx.db.close();
    rmSync(appDir, { recursive: true, force: true });
  }
});

test('GET ticket canvas returns checklist, proposals, timeline', async () => {
  const { appDir, ctx, project, ticket, app } = await setup();
  try {
    const res = await app.request(`/api/projects/${project.id}/tickets/${ticket.key}`);
    assert.equal(res.status, 200);
    const body = (await res.json()) as {
      checklist: unknown[];
      timeline: unknown[];
      proposalReviews: unknown[];
      superseded: unknown[];
    };
    assert.ok(Array.isArray(body.checklist));
    assert.ok(Array.isArray(body.timeline));
    assert.ok(Array.isArray(body.proposalReviews));
    assert.ok(Array.isArray(body.superseded));
  } finally {
    ctx.db.close();
    rmSync(appDir, { recursive: true, force: true });
  }
});

test('POST adjustments creates a pending proposal', async () => {
  const { appDir, ctx, project, ticket, app } = await setup();
  try {
    const res = await app.request(`/api/projects/${project.id}/tickets/${ticket.key}/adjustments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source: 'chat', attribution: 'Budi', note: 'cap 15%' }),
    });
    assert.equal(res.status, 202);
    const body = (await res.json()) as { job: { status: string; queueJobId: string } };
    assert.equal(body.job.status, 'queued');
    assert.equal(body.job.queueJobId.startsWith('test-queue-'), true);
  } finally {
    ctx.db.close();
    rmSync(appDir, { recursive: true, force: true });
  }
});

test('POST multipart adjustment ingests a Markdown upload', async () => {
  const { appDir, ctx, project, ticket, app } = await setup();
  try {
    const form = new FormData();
    form.set('source', 'clarification');
    form.set('attribution', 'Budi');
    form.set(
      'file',
      new File(['The cap is 15 percent.'], 'clarification.md', { type: 'text/markdown' }),
    );
    const res = await app.request(`/api/projects/${project.id}/tickets/${ticket.key}/adjustments`, {
      method: 'POST',
      body: form,
    });
    assert.equal(res.status, 202);
    const body = (await res.json()) as {
      job: { status: string; fileName: string | null; fileKind: string | null };
      source: { location: string | null; note: string | null };
    };
    assert.equal(body.job.status, 'queued');
    assert.equal(body.source.location, 'clarification.md');
    assert.equal(body.job.fileName, 'clarification.md');
    assert.equal(body.job.fileKind, 'text/markdown');

    const canvas = await app.request(`/api/projects/${project.id}/tickets/${ticket.key}`);
    assert.equal(canvas.status, 200);
    const canvasBody = (await canvas.json()) as {
      adjustmentJobs: Array<{ id: string }>;
      adjustmentJobDetails: Array<{
        job: { id: string; attribution: string | null };
        source: { note: string | null; location: string | null } | null;
      }>;
    };
    assert.equal(canvasBody.adjustmentJobs.length, 1);
    assert.equal(canvasBody.adjustmentJobDetails.length, 1);
    assert.equal(canvasBody.adjustmentJobDetails[0]?.job.attribution, 'Budi');
    assert.equal(canvasBody.adjustmentJobDetails[0]?.source?.location, 'clarification.md');
  } finally {
    ctx.db.close();
    rmSync(appDir, { recursive: true, force: true });
  }
});

test('POST multipart adjustment rejects unsupported files without creating a proposal', async () => {
  const { appDir, ctx, project, ticket, app } = await setup();
  try {
    const form = new FormData();
    form.set('source', 'manual');
    form.set('file', new File(['not supported'], 'notes.txt', { type: 'text/plain' }));
    const res = await app.request(`/api/projects/${project.id}/tickets/${ticket.key}/adjustments`, {
      method: 'POST',
      body: form,
    });
    assert.equal(res.status, 400);
    const body = (await res.json()) as { error: { code: string } };
    assert.equal(body.error.code, 'INVALID_UPLOAD');
    assert.equal((await ctx.uow.proposals.listByTicket(ticket.id)).length, 0);
  } finally {
    ctx.db.close();
    rmSync(appDir, { recursive: true, force: true });
  }
});

test('POST requirements/check requires confirm:true', async () => {
  const { appDir, ctx, app } = await setup();
  try {
    const res = await app.request('/api/requirements/none/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    assert.equal(res.status, 400);
    const body = (await res.json()) as { error: { code: string } };
    assert.equal(body.error.code, 'INVALID_INPUT');
  } finally {
    ctx.db.close();
    rmSync(appDir, { recursive: true, force: true });
  }
});

test('POST requirements/uncheck marks a checked requirement incomplete', async () => {
  const { appDir, ctx, ticket, app } = await setup();
  try {
    const { addRequirementManual, checkRequirement } = await import('@trachex/domain');
    const requirement = await addRequirementManual(ctx.uow, {
      ticketId: ticket.id,
      title: 'Verify checkout total',
      actorType: 'human',
    });
    await checkRequirement(ctx.uow, { requirementId: requirement.id, actorType: 'human' });

    const res = await app.request(`/api/requirements/${requirement.id}/uncheck`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirm: true }),
    });

    assert.equal(res.status, 200);
    const body = (await res.json()) as { status: string };
    assert.equal(body.status, 'unchecked');
    assert.equal((await ctx.uow.requirements.findById(requirement.id))?.devStatus, 'unchecked');
  } finally {
    ctx.db.close();
    rmSync(appDir, { recursive: true, force: true });
  }
});

test('GET export returns markdown summary', async () => {
  const { appDir, ctx, project, ticket, app } = await setup();
  try {
    const res = await app.request(
      `/api/projects/${project.id}/tickets/${ticket.key}/export?format=markdown`,
    );
    assert.equal(res.status, 200);
    const text = await res.text();
    assert.ok(text.includes('## Current Checklist'));
  } finally {
    ctx.db.close();
    rmSync(appDir, { recursive: true, force: true });
  }
});

test('PATCH project renames name and slug', async () => {
  const { appDir, ctx, project, app } = await setup();
  try {
    const res = await app.request(`/api/projects/${project.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Loyalty Program', slug: 'loyalty-program' }),
    });
    assert.equal(res.status, 200);
    const body = (await res.json()) as { project: { name: string; slug: string } };
    assert.equal(body.project.name, 'Loyalty Program');
    assert.equal(body.project.slug, 'loyalty-program');
  } finally {
    ctx.db.close();
    rmSync(appDir, { recursive: true, force: true });
  }
});

test('DELETE project requires the exact project name', async () => {
  const { appDir, ctx, project, ticket, app } = await setup();
  try {
    const wrong = await app.request(`/api/projects/${project.id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirmName: 'Wrong name' }),
    });
    assert.equal(wrong.status, 400);
    assert.ok((await ctx.uow.projects.findById(project.id)) !== null);
    const deleted = await app.request(`/api/projects/${project.id}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirmName: project.name }),
    });
    assert.equal(deleted.status, 200);
    assert.equal(await ctx.uow.projects.findById(project.id), null);
    assert.equal(await ctx.uow.tickets.findById(ticket.id), null);
  } finally {
    ctx.db.close();
    rmSync(appDir, { recursive: true, force: true });
  }
});

test('PATCH ticket renames title and key', async () => {
  const { appDir, ctx, project, ticket, app } = await setup();
  try {
    const res = await app.request(`/api/projects/${project.id}/tickets/${ticket.key}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Loyalty subject', key: 'LOYALTY-RENAMED' }),
    });
    assert.equal(res.status, 200);
    const body = (await res.json()) as { ticket: { title: string; key: string } };
    assert.equal(body.ticket.title, 'Loyalty subject');
    assert.equal(body.ticket.key, 'LOYALTY-RENAMED');
  } finally {
    ctx.db.close();
    rmSync(appDir, { recursive: true, force: true });
  }
});

test('DELETE ticket requires the exact subject title', async () => {
  const { appDir, ctx, project, ticket, app } = await setup();
  try {
    const wrong = await app.request(`/api/projects/${project.id}/tickets/${ticket.key}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirmName: 'Wrong name' }),
    });
    assert.equal(wrong.status, 400);
    const deleted = await app.request(`/api/projects/${project.id}/tickets/${ticket.key}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirmName: ticket.title }),
    });
    assert.equal(deleted.status, 200);
    assert.equal(await ctx.uow.tickets.findById(ticket.id), null);
    assert.equal(await ctx.uow.subjects.findById(ticket.id), null);
  } finally {
    ctx.db.close();
    rmSync(appDir, { recursive: true, force: true });
  }
});

test('POST checklist reorder persists the new order', async () => {
  const { appDir, ctx, project, ticket, app } = await setup();
  try {
    const { addRequirementManual } = await import('@trachex/domain');
    const first = await addRequirementManual(ctx.uow, {
      ticketId: ticket.id,
      title: 'First',
      actorType: 'human',
    });
    const second = await addRequirementManual(ctx.uow, {
      ticketId: ticket.id,
      title: 'Second',
      actorType: 'human',
    });
    const res = await app.request(
      `/api/projects/${project.id}/tickets/${ticket.key}/checklist/reorder`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderedIds: [second.id, first.id] }),
      },
    );
    assert.equal(res.status, 200);
    const body = (await res.json()) as { checklist: Array<{ id: string }> };
    assert.deepEqual(
      body.checklist.map((item) => item.id),
      [second.id, first.id],
    );
  } finally {
    ctx.db.close();
    rmSync(appDir, { recursive: true, force: true });
  }
});

test('POST chat streams JSONL events', async () => {
  const { appDir, ctx, project, ticket, app } = await setup();
  try {
    const res = await app.request(`/api/chat/${project.id}/${ticket.key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'hello' }),
    });
    assert.equal(res.status, 200);
    const text = await res.text();
    const lines = text.trim().split('\n');
    assert.ok(lines.length >= 2);
    const first = JSON.parse(lines[0] ?? '{}') as { type: string; sessionId?: string };
    assert.equal(first.type, 'start');
    assert.ok(typeof first.sessionId === 'string' && first.sessionId.length > 0);
  } finally {
    ctx.db.close();
    rmSync(appDir, { recursive: true, force: true });
  }
});
