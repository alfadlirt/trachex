import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { runCli } from './index.ts';

function tempAppDir(): string {
  return mkdtempSync(join(tmpdir(), 'trachex-edit-'));
}

async function run(args: string[], appDir: string): Promise<number> {
  return runCli({ argv: args, appDir });
}

async function capture<T>(fn: () => Promise<number>): Promise<T> {
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
  return JSON.parse(buffer) as T;
}

async function seedTicket(appDir: string): Promise<string> {
  const fixture = join(appDir, 'fixture.json');
  writeFileSync(
    fixture,
    JSON.stringify({
      kind: 'extraction',
      requirements: [{ title: 'First' }, { title: 'Second' }],
    }),
  );
  await run(['project', 'create', 'loyalty', '--name', 'Loyalty'], appDir);
  await run(
    ['ticket', 'new', 'T-1', '--project', 'loyalty', '--note', 'fsd', '--fixture', fixture],
    appDir,
  );
  const proposals = await capture<Array<{ proposal: { id: string } }>>(async () =>
    run(['proposal', 'list', '--project', 'loyalty'], appDir),
  );
  const firstProposal = proposals[0]?.proposal;
  assert.ok(firstProposal, 'extraction proposal exists');
  await run(['proposal', 'approve', firstProposal.id, '--project', 'loyalty', '--yes'], appDir);
  return fixture;
}

async function activeIds(appDir: string): Promise<string[]> {
  const view = await capture<{ groups: Array<{ items: Array<{ id: string; title: string }> }> }>(
    async () => run(['checklist', 'list', 'T-1', '--project', 'loyalty', '--json'], appDir),
  );
  return view.groups.flatMap((g) => g.items.map((i) => i.id));
}

test('checklist add/edit/supersede/reorder/uncheck work end-to-end with provenance', async () => {
  const appDir = tempAppDir();
  try {
    await seedTicket(appDir);
    let ids = await activeIds(appDir);
    assert.equal(ids.length, 2);

    // add
    await run(
      ['checklist', 'add', 'T-1', '--project', 'loyalty', '--title', 'Manual item', '--from', 'Me'],
      appDir,
    );
    ids = await activeIds(appDir);
    assert.equal(ids.length, 3);

    // edit (supersede first item, new in place)
    const firstId = ids[0];
    assert.ok(firstId, 'first id exists');
    await run(
      [
        'checklist',
        'edit',
        'T-1',
        firstId,
        '--project',
        'loyalty',
        '--title',
        'First revised',
        '--from',
        'Me',
        '--note',
        'renamed per BA',
      ],
      appDir,
    );
    const afterEdit = await capture<{
      groups: Array<{ items: Array<{ title: string }> }>;
      superseded: Array<{ item: { title: string }; supersededByTitle: string | null }>;
    }>(async () => run(['checklist', 'list', 'T-1', '--project', 'loyalty', '--json'], appDir));
    const titles = afterEdit.groups.flatMap((g) => g.items.map((i) => i.title));
    assert.ok(titles.includes('First revised'));
    assert.ok(titles.includes('Manual item'));
    assert.ok(afterEdit.superseded.some((s) => s.item.title === 'First'));
    assert.equal(
      afterEdit.superseded.find((s) => s.item.title === 'First')?.supersededByTitle,
      'First revised',
    );

    // The edit's manual source carries the note (provenance).
    const showSources = await capture<{
      sources: Array<{ type: string; attribution: string | null; note: string | null }>;
    }>(async () => run(['ticket', 'show', 'T-1', '--project', 'loyalty'], appDir));
    const manualSources = showSources.sources.filter((s) => s.type === 'manual');
    assert.ok(manualSources.some((s) => s.note === 'renamed per BA'));

    // supersede the Manual item
    ids = await activeIds(appDir);
    const manualId = ids[2];
    assert.ok(manualId, 'manual item id exists');
    await run(
      ['checklist', 'supersede', 'T-1', manualId, '--project', 'loyalty', '--from', 'Me'],
      appDir,
    );
    const afterSupersede = await capture<{
      groups: Array<{ items: Array<{ title: string }> }>;
      superseded: Array<{ item: { title: string } }>;
    }>(async () => run(['checklist', 'list', 'T-1', '--project', 'loyalty', '--json'], appDir));
    assert.ok(afterSupersede.superseded.some((s) => s.item.title === 'Manual item'));

    // reorder
    ids = await activeIds(appDir);
    const reversed = [...ids].reverse();
    await run(
      ['checklist', 'reorder', 'T-1', '--project', 'loyalty', '--order', reversed.join(',')],
      appDir,
    );
    const afterReorder = await capture<{
      groups: Array<{ items: Array<{ id: string }> }>;
    }>(async () => run(['checklist', 'list', 'T-1', '--project', 'loyalty', '--json'], appDir));
    assert.deepEqual(
      afterReorder.groups.flatMap((g) => g.items.map((i) => i.id)),
      reversed,
    );

    // uncheck: check then uncheck, verify audit + export timeline
    const uncheckIds = await activeIds(appDir);
    const targetId = uncheckIds[0];
    assert.ok(targetId, 'an active item to uncheck');
    await run(['check', 'T-1', targetId, '--project', 'loyalty', '--yes'], appDir);
    await run(['uncheck', 'T-1', targetId, '--project', 'loyalty', '--from', 'Me'], appDir);
    const show = await capture<{ checklist: Array<{ id: string; devStatus: string }> }>(async () =>
      run(['ticket', 'show', 'T-1', '--project', 'loyalty'], appDir),
    );
    assert.equal(show.checklist.find((r) => r.id === targetId)?.devStatus, 'unchecked');

    const summary = await capture<{ timeline: Array<{ description: string }> }>(async () =>
      run(['export', 'T-1', '--project', 'loyalty', '--format', 'json'], appDir),
    );
    assert.ok(summary.timeline.some((e) => e.description.includes('unchecked')));
  } finally {
    rmSync(appDir, { recursive: true, force: true });
  }
});
