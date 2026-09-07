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

const runAgent: RunAgentFn = async () => ({
  kind: 'reconciliation',
  create: [{ title: 'Discount cap 15%' }],
});

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
    const body = (await res.json()) as { checklist: unknown[]; timeline: unknown[] };
    assert.ok(Array.isArray(body.checklist));
    assert.ok(Array.isArray(body.timeline));
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
