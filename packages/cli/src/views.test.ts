import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { approveProposal, createProject, createProposal, createSubject } from '@trachex/domain';
import { openApp } from './app.ts';
import { runCli } from './index.ts';

function tempAppDir(): string {
  return mkdtempSync(join(tmpdir(), 'trachex-view-'));
}

async function seed(appDir: string) {
  const ctx = openApp(appDir);
  const project = await createProject(ctx.uow, { slug: 'loyalty', name: 'Loyalty' });
  const subject = await createSubject(ctx.uow, { projectId: project.id, name: 'Loyalty' });
  const ticket = await ctx.uow.tickets.findById(subject.id);
  assert.ok(ticket, 'subject backing record exists');
  const p1 = await createProposal(ctx.uow, {
    ticketId: ticket.id,
    kind: 'extraction',
    output: {
      kind: 'extraction',
      requirements: [
        {
          title: 'Validate tier before discount',
          parentLabel: 'Discounting',
          impacts: [{ kind: 'service', value: 'front-office-service' }],
          scenarios: ['VIP at cap'],
        },
        {
          title: 'Timezone on receipts',
          parentLabel: 'Receipts',
          impacts: [{ kind: 'service', value: 'receipt-service' }],
        },
      ],
    },
  });
  await approveProposal(ctx.uow, { proposalId: p1.id });
  const old = (await ctx.uow.requirements.listActiveByTicket(ticket.id))[0];
  assert.ok(old, 'seed requirement exists');
  const p2 = await createProposal(ctx.uow, {
    ticketId: ticket.id,
    kind: 'reconciliation',
    output: {
      kind: 'reconciliation',
      create: [
        { title: 'Validate tier (revised)', parentLabel: 'Discounting', supersedes: [old.id] },
      ],
    },
  });
  await approveProposal(ctx.uow, { proposalId: p2.id });
  ctx.db.close();
  return { project, subject };
}

async function run(args: string[], appDir: string): Promise<number> {
  return runCli({ argv: args, appDir });
}

async function capture(fn: () => Promise<number>): Promise<string> {
  const original = process.stdout.write;
  let buffer = '';
  process.stdout.write = (chunk: string | Uint8Array) => {
    buffer += String(chunk);
    return true;
  };
  try {
    await fn();
  } finally {
    process.stdout.write = original;
  }
  return buffer;
}

test('trachex status shows project rollup totals', async () => {
  const appDir = tempAppDir();
  try {
    const { project, subject } = await seed(appDir);
    const text = await capture(async () =>
      run(['status', '--project', project.slug, '--json'], appDir),
    );
    const parsed = JSON.parse(text) as {
      totals: { tickets: number; active: number; checked: number; remaining: number };
      tickets: Array<{ key: string; remaining: number }>;
    };
    assert.equal(parsed.totals.tickets, 1);
    assert.equal(parsed.totals.active, 2);
    assert.equal(parsed.totals.remaining, 2);
    assert.equal(parsed.tickets[0]?.key, subject.id);

    const readable = await capture(async () => run(['status', '--project', project.slug], appDir));
    assert.ok(readable.includes('project loyalty (Loyalty)'));
    assert.ok(readable.includes('remaining: 2'));
  } finally {
    rmSync(appDir, { recursive: true, force: true });
  }
});

test('trachex checklist list shows groups and struck-through superseded', async () => {
  const appDir = tempAppDir();
  try {
    const { subject } = await seed(appDir);
    const json = await capture(async () =>
      run(['subject', 'checklist', subject.id, '--json'], appDir),
    );
    const parsed = JSON.parse(json) as {
      groups: Array<{ label: string; items: unknown[] }>;
      superseded: Array<{
        item: { title: string; impacts: Array<{ kind: string; value: string }> };
        supersededByTitle: string | null;
      }>;
    };
    const labels = parsed.groups.map((g) => g.label).sort();
    assert.deepEqual(labels, ['Discounting', 'Receipts']);
    assert.equal(parsed.superseded.length, 1);
    assert.equal(parsed.superseded[0]?.item.title, 'Validate tier before discount');
    assert.equal(parsed.superseded[0]?.supersededByTitle, 'Validate tier (revised)');
    assert.equal(parsed.superseded[0]?.item.impacts.length, 1);

    const readable = await capture(async () =>
      run(['subject', 'checklist', subject.id], appDir),
    );
    assert.ok(readable.includes('# Discounting'));
    assert.ok(readable.includes('Validate tier (revised)'));
    assert.ok(readable.includes('~~Validate tier before discount~~'));
  } finally {
    rmSync(appDir, { recursive: true, force: true });
  }
});
