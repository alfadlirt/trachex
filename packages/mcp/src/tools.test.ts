import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import type { RunAgentFn } from '@trachex/agent';
import {
  approveProposal,
  createProject,
  createProposal,
  createTicket,
  type UnitOfWork,
} from '@trachex/domain';
import { migrate, openDatabase, SqliteUnitOfWork } from '@trachex/storage-sqlite';
import type Database from 'better-sqlite3';
import { getTool, type ToolContext, tools } from './tools.ts';

function tempAppDir(): string {
  return mkdtempSync(join(tmpdir(), 'trachex-mcp-'));
}

function openDb(dir: string): Database.Database {
  const db = openDatabase({ path: join(dir, 'trachex.db') });
  migrate(db);
  return db;
}

async function seedProjectTicket(uow: UnitOfWork) {
  const project = await createProject(uow, { slug: 'loyalty', name: 'Loyalty' });
  const ticket = await createTicket(uow, {
    projectId: project.id,
    key: 'TICKET-1',
    title: 'Loyalty',
  });
  return { project, ticket };
}

async function makeCtx(uow: UnitOfWork, projectId: string, appDir: string): Promise<ToolContext> {
  const runAgent: RunAgentFn = async () => ({
    kind: 'reconciliation',
    create: [{ title: 'Discount cap 15%', supersedes: [] }],
  });
  return { uow, appDir, projectId, projectSlug: 'loyalty', runAgent };
}

async function callTool(ctx: ToolContext, name: string, input: unknown): Promise<unknown> {
  const tool = getTool(name);
  assert.ok(tool, `tool ${name} exists`);
  const parsed = tool.inputSchema.parse(input);
  return tool.handler(ctx, parsed);
}

test('all contract tools are registered', () => {
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
    assert.ok(names.includes(expected), `missing tool ${expected}`);
  }
});

test('get_baseline returns checklist, history, impacts, scenarios, timeline, open proposals', async () => {
  const dir = tempAppDir();
  try {
    const db = openDb(dir);
    const uow = new SqliteUnitOfWork(db);
    const { project, ticket } = await seedProjectTicket(uow);
    const proposal = await createProposal(uow, {
      ticketId: ticket.id,
      kind: 'extraction',
      output: {
        kind: 'extraction',
        requirements: [
          {
            title: 'Validate loyalty tier',
            impacts: [{ kind: 'service', value: 'front-office-service' }],
            scenarios: ['VIP at cap'],
          },
        ],
      },
    });
    await approveProposal(uow, { proposalId: proposal.id });
    const ctx = await makeCtx(uow, project.id, dir);
    const result = (await callTool(ctx, 'get_baseline', { ticketKey: 'TICKET-1' })) as {
      checklist: unknown[];
      openProposals: unknown[];
    };
    assert.equal(result.checklist.length, 1);
    assert.equal(result.openProposals.length, 0);
    db.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('add_adjustment creates a pending reconciliation proposal', async () => {
  const dir = tempAppDir();
  try {
    const db = openDb(dir);
    const uow = new SqliteUnitOfWork(db);
    const { project, ticket } = await seedProjectTicket(uow);
    const ctx = await makeCtx(uow, project.id, dir);
    const result = (await callTool(ctx, 'add_adjustment', {
      ticketKey: 'TICKET-1',
      source: 'chat',
      attribution: 'Budi (BA)',
      note: 'Discount cap should be 15%, not 20%.',
    })) as { proposal: { kind: string; status: string } };
    assert.equal(result.proposal.kind, 'reconciliation');
    assert.equal(result.proposal.status, 'pending');
    const proposals = await uow.proposals.listByTicket(ticket.id);
    assert.equal(proposals.length, 1);
    const requirements = await uow.requirements.listByTicket(ticket.id);
    assert.equal(requirements.length, 0);
    db.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('check_item without confirm:true is rejected by the schema', async () => {
  const dir = tempAppDir();
  try {
    const db = openDb(dir);
    const uow = new SqliteUnitOfWork(db);
    const { ticket } = await seedProjectTicket(uow);
    const proposal = await createProposal(uow, {
      ticketId: ticket.id,
      kind: 'extraction',
      output: { kind: 'extraction', requirements: [{ title: 'R' }] },
    });
    await approveProposal(uow, { proposalId: proposal.id });
    const requirement = (await uow.requirements.listByTicket(ticket.id))[0];
    assert.ok(requirement);
    const tool = getTool('check_item');
    assert.ok(tool);
    assert.throws(() => tool.inputSchema.parse({ requirementId: requirement.id, confirm: false }));
    assert.throws(() => tool.inputSchema.parse({ requirementId: requirement.id }));
    db.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('check_item with confirm:true records a human completion audit', async () => {
  const dir = tempAppDir();
  try {
    const db = openDb(dir);
    const uow = new SqliteUnitOfWork(db);
    const { project, ticket } = await seedProjectTicket(uow);
    const proposal = await createProposal(uow, {
      ticketId: ticket.id,
      kind: 'extraction',
      output: { kind: 'extraction', requirements: [{ title: 'R' }] },
    });
    await approveProposal(uow, { proposalId: proposal.id });
    const requirement = (await uow.requirements.listByTicket(ticket.id))[0];
    assert.ok(requirement);
    const ctx = await makeCtx(uow, project.id, dir);
    const result = (await callTool(ctx, 'check_item', {
      requirementId: requirement.id,
      confirm: true,
    })) as { status: string };
    assert.equal(result.status, 'checked');
    const audits = await uow.completionAudits.listByRequirement(requirement.id);
    assert.equal(audits.length, 1);
    assert.equal(audits[0]?.actorType, 'human');
    db.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('scoping: a requirement from another project is rejected', async () => {
  const dir = tempAppDir();
  try {
    const db = openDb(dir);
    const uow = new SqliteUnitOfWork(db);
    const { project } = await seedProjectTicket(uow);
    const other = await createProject(uow, { slug: 'other', name: 'Other' });
    const otherTicket = await createTicket(uow, {
      projectId: other.id,
      key: 'OTHER-1',
      title: 'Other',
    });
    const proposal = await createProposal(uow, {
      ticketId: otherTicket.id,
      kind: 'extraction',
      output: { kind: 'extraction', requirements: [{ title: 'Other req' }] },
    });
    await approveProposal(uow, { proposalId: proposal.id });
    const otherRequirement = (await uow.requirements.listByTicket(otherTicket.id))[0];
    assert.ok(otherRequirement);

    const ctx = await makeCtx(uow, project.id, dir);
    await assert.rejects(
      () => callTool(ctx, 'get_requirement', { requirementId: otherRequirement.id }),
      (e: unknown) => e instanceof Error && e.message.includes('does not belong'),
    );
    db.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('export_summary returns markdown and json', async () => {
  const dir = tempAppDir();
  try {
    const db = openDb(dir);
    const uow = new SqliteUnitOfWork(db);
    const { project } = await seedProjectTicket(uow);
    const ctx = await makeCtx(uow, project.id, dir);
    const md = (await callTool(ctx, 'export_summary', {
      ticketKey: 'TICKET-1',
      format: 'markdown',
    })) as { content: string };
    assert.ok(md.content.includes('## Current Checklist'));
    const js = (await callTool(ctx, 'export_summary', {
      ticketKey: 'TICKET-1',
      format: 'json',
    })) as { content: string };
    assert.equal(JSON.parse(js.content).ticketKey, 'TICKET-1');
    db.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
