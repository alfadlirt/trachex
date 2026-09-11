import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import type { RunAgentFn } from '@trachex/agent';
import { createProject, createTicket } from '@trachex/domain';
import { migrate, openDatabase, SqliteUnitOfWork } from '@trachex/storage-sqlite';
import { handleToolCall } from './server.ts';
import { type ToolContext, tools } from './tools.ts';

function tempAppDir(): string {
  return mkdtempSync(join(tmpdir(), 'trachex-mcp-srv-'));
}

const runAgent: RunAgentFn = async () => ({ kind: 'reconciliation', create: [] });

async function makeCtx(): Promise<{
  ctx: ToolContext;
  dir: string;
  db: ReturnType<typeof openDatabase>;
}> {
  const dir = tempAppDir();
  const db = openDatabase({ path: join(dir, 'trachex.db') });
  migrate(db);
  const uow = new SqliteUnitOfWork(db);
  const project = await createProject(uow, { slug: 'loyalty', name: 'Loyalty' });
  await createTicket(uow, { projectId: project.id, key: 'T-1', title: 'T' });
  const ctx: ToolContext = {
    uow,
    appDir: dir,
    projectId: project.id,
    projectSlug: 'loyalty',
    runAgent,
  };
  return { ctx, dir, db };
}

test('tool registry exposes all contract tools', () => {
  assert.equal(tools.length, 12);
  const names = tools.map((t) => t.name);
  for (const expected of [
    'get_checklist',
    'get_baseline',
    'get_history',
    'list_tickets',
    'get_requirement',
    'create_ticket',
    'add_adjustment',
    'approve_proposal',
    'reject_proposal',
    'check_item',
    'export_summary',
  ]) {
    assert.ok(names.includes(expected), `missing ${expected}`);
  }
});

test('tools/call dispatches and returns structured JSON', async () => {
  const { ctx, dir, db } = await makeCtx();
  try {
    const result = await handleToolCall(ctx, 'list_tickets', {});
    assert.equal(result.isError, false);
    const part = result.content[0];
    assert.equal(part?.type, 'text');
    const payload = JSON.parse((part as { text: string }).text) as { tickets: unknown[] };
    assert.equal(payload.tickets.length, 1);
  } finally {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test('tools/call returns a structured error for an unknown tool', async () => {
  const { ctx, dir, db } = await makeCtx();
  try {
    const result = await handleToolCall(ctx, 'nope', {});
    assert.equal(result.isError, true);
    const part = result.content[0];
    assert.equal(part?.type, 'text');
    const payload = JSON.parse((part as { text: string }).text) as { code: string };
    assert.equal(payload.code, 'UNKNOWN_TOOL');
  } finally {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test('tools/call returns SCOPING for cross-project access', async () => {
  const { ctx, dir, db } = await makeCtx();
  try {
    const result = await handleToolCall(ctx, 'get_requirement', { requirementId: 'missing' });
    assert.equal(result.isError, true);
    const part = result.content[0];
    assert.equal(part?.type, 'text');
    const payload = JSON.parse((part as { text: string }).text) as { code: string };
    assert.equal(payload.code, 'NOT_FOUND');
  } finally {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
