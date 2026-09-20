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
  const app = createApp({ appDir, env: { OPENAI_API_KEY: 'test' }, runAgent });
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
    };
    assert.ok(Array.isArray(body.checklist));
    assert.ok(Array.isArray(body.timeline));
    assert.ok(Array.isArray(body.proposalReviews));
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
    assert.equal(res.status, 201);
    const body = (await res.json()) as { proposal: { status: string } };
    assert.equal(body.proposal.status, 'pending');
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
    assert.equal(res.status, 201);
    const body = (await res.json()) as {
      proposal: { status: string };
      source: { location: string | null };
    };
    assert.equal(body.proposal.status, 'pending');
    assert.equal(body.source.location, 'clarification.md');
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
    const first = JSON.parse(lines[0] ?? '{}') as { type: string };
    assert.equal(first.type, 'start');
  } finally {
    ctx.db.close();
    rmSync(appDir, { recursive: true, force: true });
  }
});
