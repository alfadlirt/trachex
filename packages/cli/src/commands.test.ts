import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { runCli } from './index.ts';
import { setConfirmImpl } from './io.ts';

function tempAppDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'trachex-cli-'));
  return dir;
}

function writeFixture(dir: string): string {
  const path = join(dir, 'fixture.json');
  writeFileSync(
    path,
    JSON.stringify({
      kind: 'extraction',
      requirements: [
        {
          title: 'Validate loyalty tier before applying discount',
          impacts: [{ kind: 'service', value: 'front-office-service' }],
          scenarios: ['VIP at cap'],
        },
      ],
    }),
  );
  return path;
}

function writeFsd(dir: string): string {
  const path = join(dir, 'fsd.md');
  writeFileSync(path, '# FSD\nDiscount cap should be 15 percent for loyalty tier.\n');
  return path;
}

async function run(args: string[], appDir: string): Promise<number> {
  return runCli({ argv: args, appDir });
}

test('full MVP workflow via CLI (project → repo → ticket → approve → check → export)', async () => {
  const appDir = tempAppDir();
  try {
    const fixture = writeFixture(appDir);
    const fsd = writeFsd(appDir);

    assert.equal(await run(['project', 'create', 'loyalty', '--name', 'Loyalty'], appDir), 0);
    assert.equal(
      await run(
        ['project', 'repo', 'add', 'loyalty', '--name', 'front-office', '--path', '/repos/fo'],
        appDir,
      ),
      0,
    );
    assert.equal(
      await run(
        ['ticket', 'new', 'TICKET-1', '--project', 'loyalty', '--fsd', fsd, '--fixture', fixture],
        appDir,
      ),
      0,
    );

    const proposalsOut = await captureJson<
      Array<{ proposal: { kind: string; status: string; id: string } }>
    >(async () => run(['proposal', 'list', '--project', 'loyalty'], appDir));
    assert.equal(proposalsOut[0]?.proposal?.kind, 'extraction');
    assert.equal(proposalsOut[0]?.proposal?.status, 'pending');
    const proposalId = proposalsOut[0]?.proposal?.id as string;

    assert.equal(
      await run(['proposal', 'approve', proposalId, '--project', 'loyalty', '--yes'], appDir),
      0,
    );

    const showOut = await captureJson<{
      checklist: Array<{ id: string; devStatus: string }>;
    }>(async () => run(['ticket', 'show', 'TICKET-1', '--project', 'loyalty'], appDir));
    assert.equal(showOut.checklist?.length, 1);
    assert.equal(showOut.checklist[0]?.devStatus, 'unchecked');
    const requirementId = showOut.checklist[0]?.id as string;

    assert.equal(
      await run(['check', 'TICKET-1', requirementId, '--project', 'loyalty', '--yes'], appDir),
      0,
    );

    const exportOut = await captureText(async () =>
      run(['export', 'TICKET-1', '--project', 'loyalty', '--format', 'markdown'], appDir),
    );
    assert.ok(exportOut.includes('## Current Checklist'));
    assert.ok(exportOut.includes('[x] Validate loyalty tier before applying discount'));

    const jsonOut = await captureText(async () =>
      run(['export', 'TICKET-1', '--project', 'loyalty', '--format', 'json'], appDir),
    );
    const parsed = JSON.parse(jsonOut) as { checklist: { devStatus: string }[] };
    assert.equal(parsed.checklist[0]?.devStatus, 'checked');
  } finally {
    rmSync(appDir, { recursive: true, force: true });
  }
});

test('unknown command exits with usage code and machine-readable error', async () => {
  const appDir = tempAppDir();
  try {
    const code = await run(['bogus'], appDir);
    assert.equal(code, 2);
  } finally {
    rmSync(appDir, { recursive: true, force: true });
  }
});

test('project use sets active project and --project wins', async () => {
  const appDir = tempAppDir();
  try {
    await run(['project', 'create', 'a', '--name', 'A'], appDir);
    await run(['project', 'create', 'b', '--name', 'B'], appDir);
    assert.equal(await run(['project', 'use', 'a'], appDir), 0);
    const list = await captureJson<unknown[]>(async () => run(['project', 'list'], appDir));
    assert.equal(list.length, 2);
  } finally {
    rmSync(appDir, { recursive: true, force: true });
  }
});

test('active-project fallback: ticket show works without --project after project use', async () => {
  const appDir = tempAppDir();
  try {
    const fixture = writeFixture(appDir);
    const fsd = writeFsd(appDir);
    await run(['project', 'create', 'loyalty', '--name', 'Loyalty'], appDir);
    await run(['project', 'use', 'loyalty'], appDir);
    await run(['ticket', 'new', 'TICKET-1', '--fsd', fsd, '--fixture', fixture], appDir);
    const showOut = await captureJson<{ ticket: { key: string } }>(async () =>
      run(['ticket', 'show', 'TICKET-1'], appDir),
    );
    assert.equal(showOut.ticket.key, 'TICKET-1');
  } finally {
    rmSync(appDir, { recursive: true, force: true });
  }
});

test('context ingest ingests files into the reserved context ticket', async () => {
  const appDir = tempAppDir();
  try {
    const ctxFile = join(appDir, 'AGENTS.md');
    writeFileSync(ctxFile, '# Project conventions\n');
    await run(['project', 'create', 'loyalty', '--name', 'Loyalty'], appDir);
    const code = await run(['context', 'ingest', 'loyalty', '--include', ctxFile], appDir);
    assert.equal(code, 0);
    const showOut = await captureJson<{ checklist: unknown[] }>(async () =>
      run(['ticket', 'show', '__context__', '--project', 'loyalty'], appDir),
    );
    assert.ok(Array.isArray(showOut.checklist));
  } finally {
    rmSync(appDir, { recursive: true, force: true });
  }
});

test('check without --yes aborts when confirmation is declined', async () => {
  const appDir = tempAppDir();
  try {
    setConfirmImpl(async () => false);
    const fixture = writeFixture(appDir);
    const fsd = writeFsd(appDir);
    await run(['project', 'create', 'loyalty', '--name', 'Loyalty'], appDir);
    await run(
      ['ticket', 'new', 'TICKET-1', '--project', 'loyalty', '--fsd', fsd, '--fixture', fixture],
      appDir,
    );
    const p = await captureJson<Array<{ proposal: { id: string } }>>(async () =>
      run(['proposal', 'list', '--project', 'loyalty'], appDir),
    );
    await run(
      ['proposal', 'approve', p[0]?.proposal.id as string, '--project', 'loyalty', '--yes'],
      appDir,
    );
    const s = await captureJson<{ checklist: Array<{ id: string }> }>(async () =>
      run(['ticket', 'show', 'TICKET-1', '--project', 'loyalty'], appDir),
    );
    const rid = s.checklist[0]?.id as string;
    const code = await run(['check', 'TICKET-1', rid, '--project', 'loyalty'], appDir);
    assert.equal(code, 0);
    const after = await captureJson<{ checklist: Array<{ devStatus: string }> }>(async () =>
      run(['ticket', 'show', 'TICKET-1', '--project', 'loyalty'], appDir),
    );
    assert.equal(after.checklist[0]?.devStatus, 'unchecked');
  } finally {
    rmSync(appDir, { recursive: true, force: true });
  }
});

test('subject lifecycle: new, use, info, and active-scope banner', async () => {
  const appDir = tempAppDir();
  try {
    await run(['project', 'create', 'loyalty', '--name', 'Loyalty'], appDir);
    const created = await captureJson<{ id: string }>(async () =>
      run(['subject', 'new', '--project', 'loyalty', '--name', 'Discount cap'], appDir),
    );
    assert.ok(created.id.length > 0);
    assert.equal(await run(['subject', 'use', created.id], appDir), 0);

    const infoOut = await captureText(async () => run(['info'], appDir));
    assert.ok(infoOut.includes('active project: loyalty'));
    assert.ok(infoOut.includes('active subject: Discount cap'));

    const infoJson = await captureJson<{
      project: { slug: string };
      subject: { name: string };
    }>(async () => run(['info', '--json'], appDir));
    assert.equal(infoJson.project.slug, 'loyalty');
    assert.equal(infoJson.subject.name, 'Discount cap');

    assert.equal(await run(['subject', 'use', '--clear'], appDir), 0);
    const afterClear = await captureText(async () => run(['info'], appDir));
    assert.ok(afterClear.includes('active subject: (none)'));
  } finally {
    rmSync(appDir, { recursive: true, force: true });
  }
});

test('project use clears an incompatible active subject', async () => {
  const appDir = tempAppDir();
  try {
    await run(['project', 'create', 'a', '--name', 'A'], appDir);
    await run(['project', 'create', 'b', '--name', 'B'], appDir);
    const subject = await captureJson<{ id: string }>(async () =>
      run(['subject', 'new', '--project', 'a', '--name', 'In A'], appDir),
    );
    await run(['subject', 'use', subject.id], appDir);
    await run(['project', 'use', 'b'], appDir);
    const infoOut = await captureText(async () => run(['info'], appDir));
    assert.ok(infoOut.includes('active subject: (none)'));
  } finally {
    rmSync(appDir, { recursive: true, force: true });
  }
});

test('global repo registry and subject assignment', async () => {
  const appDir = tempAppDir();
  try {
    await run(['project', 'create', 'loyalty', '--name', 'Loyalty'], appDir);
    await run(['repo', 'add', '--name', 'front-office', '--path', '/repos/fo'], appDir);
    await run(['repo', 'add', '--name', 'config-service', '--path', '/repos/cfg'], appDir);

    const repos = await captureJson<Array<{ slug: string; id: string }>>(async () =>
      run(['repo', 'list', '--json'], appDir),
    );
    assert.equal(repos.length, 2);
    const fo = repos.find((r) => r.slug === 'front-office') as { id: string };

    const subject = await captureJson<{ id: string }>(async () =>
      run(['subject', 'new', '--project', 'loyalty', '--name', 'S1'], appDir),
    );
    await run(['subject', 'repo', 'add', subject.id, fo.id], appDir);

    const assigned = await captureJson<Array<{ id: string }>>(async () =>
      run(['subject', 'repo', 'list', subject.id, '--json'], appDir),
    );
    assert.equal(assigned.length, 1);
    assert.equal(assigned[0]?.id, fo.id);

    await run(['subject', 'repo', 'remove', subject.id, fo.id], appDir);
    const after = await captureJson<unknown[]>(async () =>
      run(['subject', 'repo', 'list', subject.id, '--json'], appDir),
    );
    assert.equal(after.length, 0);
  } finally {
    rmSync(appDir, { recursive: true, force: true });
  }
});

test('settings set theme persists and validates', async () => {
  const appDir = tempAppDir();
  try {
    assert.equal(await run(['settings', 'set', 'theme', 'dark'], appDir), 0);
    assert.equal(await run(['settings', 'set', 'accent', 'cyan'], appDir), 0);
    const shown = await captureText(async () => run(['settings', 'show'], appDir));
    assert.ok(shown.includes('"mode":"dark"'));
    assert.ok(shown.includes('"accent":"cyan"'));
    const bad = await run(['settings', 'set', 'theme', 'rainbow'], appDir);
    assert.equal(bad, 2);
  } finally {
    rmSync(appDir, { recursive: true, force: true });
  }
});

test('checklist tree: parent-id child nests under parent in the view', async () => {
  const appDir = tempAppDir();
  try {
    const fixture = writeFixture(appDir);
    const fsd = writeFsd(appDir);
    await run(['project', 'create', 'loyalty', '--name', 'Loyalty'], appDir);
    await run(
      ['ticket', 'new', 'TICKET-1', '--project', 'loyalty', '--fsd', fsd, '--fixture', fixture],
      appDir,
    );
    const p = await captureJson<Array<{ proposal: { id: string } }>>(async () =>
      run(['proposal', 'list', '--project', 'loyalty'], appDir),
    );
    await run(
      ['proposal', 'approve', p[0]?.proposal.id as string, '--project', 'loyalty', '--yes'],
      appDir,
    );

    const show = await captureJson<{ checklist: Array<{ id: string }> }>(async () =>
      run(['ticket', 'show', 'TICKET-1', '--project', 'loyalty'], appDir),
    );
    const parentId = show.checklist[0]?.id as string;
    await run(
      [
        'checklist',
        'add',
        'TICKET-1',
        '--project',
        'loyalty',
        '--title',
        'child item',
        '--parent-id',
        parentId,
      ],
      appDir,
    );

    const view = await captureJson<{ tree: Array<{ item: { id: string }; children: unknown[] }> }>(
      async () => run(['checklist', 'list', 'TICKET-1', '--project', 'loyalty', '--json'], appDir),
    );
    const root = view.tree.find((t) => t.item.id === parentId);
    assert.ok(root, 'parent should be a root');
    assert.equal(root?.children.length, 1);
  } finally {
    rmSync(appDir, { recursive: true, force: true });
  }
});

async function captureJson<T>(fn: () => Promise<number>): Promise<T> {
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

async function captureText(fn: () => Promise<number>): Promise<string> {
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
