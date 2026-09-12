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

async function seedSubject(appDir: string): Promise<string> {
  const fixture = join(appDir, 'fixture.json');
  writeFileSync(
    fixture,
    JSON.stringify({
      kind: 'extraction',
      requirements: [{ title: 'First' }, { title: 'Second' }],
    }),
  );
  await run(['project', 'create', 'loyalty', '--name', 'Loyalty'], appDir);
  const subject = await capture<{ id: string }>(async () =>
    run(['subject', 'new', '--project', 'loyalty', '--name', 'Loyalty checklist'], appDir),
  );
  await run(['subject', 'add-doc', subject.id, '--docs', fixture, '--fixture', fixture], appDir);
  const proposals = await capture<Array<{ proposal: { id: string } }>>(async () =>
    run(['proposal', 'list', '--project', 'loyalty'], appDir),
  );
  const firstProposal = proposals[0]?.proposal;
  assert.ok(firstProposal, 'extraction proposal exists');
  await run(['proposal', 'approve', firstProposal.id, '--project', 'loyalty', '--yes'], appDir);
  return subject.id;
}

async function activeIds(appDir: string, subjectId: string): Promise<string[]> {
  const view = await capture<{ groups: Array<{ items: Array<{ id: string; title: string }> }> }>(
    async () => run(['subject', 'checklist', subjectId, '--json'], appDir),
  );
  return view.groups.flatMap((g) => g.items.map((i) => i.id));
}

test('checklist add/edit/supersede/reorder/uncheck work end-to-end with provenance', async () => {
  const appDir = tempAppDir();
  try {
    const subjectId = await seedSubject(appDir);
    let ids = await activeIds(appDir, subjectId);
    assert.equal(ids.length, 2);

    // add
    await run(
      ['checklist', 'add', subjectId, '--title', 'Manual item', '--from', 'Me'],
      appDir,
    );
    ids = await activeIds(appDir, subjectId);
    assert.equal(ids.length, 3);

    // edit (supersede first item, new in place)
    const firstId = ids[0];
    assert.ok(firstId, 'first id exists');
    await run(
      [
        'checklist',
        'edit',
        subjectId,
        firstId,
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
    }>(async () => run(['subject', 'checklist', subjectId, '--json'], appDir));
    const titles = afterEdit.groups.flatMap((g) => g.items.map((i) => i.title));
    assert.ok(titles.includes('First revised'));
    assert.ok(titles.includes('Manual item'));
    assert.ok(afterEdit.superseded.some((s) => s.item.title === 'First'));
    assert.equal(
      afterEdit.superseded.find((s) => s.item.title === 'First')?.supersededByTitle,
      'First revised',
    );

    // The edit's manual source carries the note (provenance).
    const afterEditSources = await capture<{ tree: unknown[] }>(async () =>
      run(['subject', 'checklist', subjectId, '--json'], appDir),
    );
    assert.ok(afterEditSources.tree.length > 0);

    // supersede the Manual item
    ids = await activeIds(appDir, subjectId);
    const manualId = ids[2];
    assert.ok(manualId, 'manual item id exists');
    await run(
      ['checklist', 'supersede', subjectId, manualId, '--from', 'Me'],
      appDir,
    );
    const afterSupersede = await capture<{
      groups: Array<{ items: Array<{ title: string }> }>;
      superseded: Array<{ item: { title: string } }>;
    }>(async () => run(['subject', 'checklist', subjectId, '--json'], appDir));
    assert.ok(afterSupersede.superseded.some((s) => s.item.title === 'Manual item'));

    // reorder
    ids = await activeIds(appDir, subjectId);
    const reversed = [...ids].reverse();
    await run(
      ['checklist', 'reorder', subjectId, '--order', reversed.join(',')],
      appDir,
    );
    const afterReorder = await capture<{
      tree: Array<{ item: { id: string } }>;
    }>(async () => run(['subject', 'checklist', subjectId, '--json'], appDir));
    assert.deepEqual(
      afterReorder.tree.map((item) => item.item.id),
      reversed,
    );

    // uncheck: check then uncheck, verify audit + export timeline
    const uncheckIds = await activeIds(appDir, subjectId);
    const targetId = uncheckIds[0];
    assert.ok(targetId, 'an active item to uncheck');
    await run(['check', subjectId, targetId, '--yes'], appDir);
    await run(['uncheck', subjectId, targetId, '--from', 'Me'], appDir);
    const show = await capture<{ tree: Array<{ item: { id: string; devStatus: string } }> }>(async () =>
      run(['subject', 'checklist', subjectId, '--json'], appDir),
    );
    assert.equal(show.tree.find((r) => r.item.id === targetId)?.item.devStatus, 'unchecked');

    const summary = await capture<{ timeline: Array<{ description: string }> }>(async () =>
      run(['export', subjectId, '--format', 'json'], appDir),
    );
    assert.ok(summary.timeline.some((e) => e.description.includes('unchecked')));
  } finally {
    rmSync(appDir, { recursive: true, force: true });
  }
});
