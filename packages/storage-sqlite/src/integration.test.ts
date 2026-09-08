import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import {
  approveProposal,
  createProject,
  createProposal,
  createTicket,
  registerRepository,
  type UnitOfWork,
} from '@trachex/domain';
import type Database from 'better-sqlite3';
import {
  currentSchemaVersion,
  exportProjectArchive,
  importProjectArchive,
  migrate,
  openDatabase,
  SqliteUnitOfWork,
} from './index.ts';

function tempDir(): string {
  return mkdtempSync(join(tmpdir(), 'trachex-test-'));
}

function openDb(dir: string): Database.Database {
  const db = openDatabase({ path: join(dir, 'trachex.db') });
  migrate(db);
  return db;
}

async function seed(uow: UnitOfWork) {
  const project = await createProject(uow, { slug: 'loyalty', name: 'Loyalty' });
  await registerRepository(uow, {
    projectId: project.id,
    slug: 'front-office',
    path: '/repos/front-office',
  });
  await registerRepository(uow, {
    projectId: project.id,
    slug: 'config-service',
    path: '/repos/config-service',
  });
  const ticket = await createTicket(uow, {
    projectId: project.id,
    key: 'TICKET-1234',
    title: 'Loyalty program',
  });
  const proposal = await createProposal(uow, {
    ticketId: ticket.id,
    kind: 'extraction',
    output: {
      kind: 'extraction',
      requirements: [
        {
          title: 'Validate loyalty tier before applying discount',
          impacts: [{ kind: 'service', value: 'front-office-service' }],
        },
      ],
    },
  });
  await approveProposal(uow, { proposalId: proposal.id });
  return { project, ticket };
}

test('migrations apply idempotently and set pragmas', () => {
  const dir = tempDir();
  try {
    const db = openDb(dir);
    assert.equal(currentSchemaVersion(db), 4);
    migrate(db);
    assert.equal(currentSchemaVersion(db), 4);
    const journal = db.pragma('journal_mode', { simple: true }) as unknown as string;
    assert.equal(journal, 'wal');
    const fk = db.pragma('foreign_keys', { simple: true }) as unknown as number;
    assert.equal(fk, 1);
    db.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('project and ticket survive process restart (reopen)', async () => {
  const dir = tempDir();
  try {
    const db = openDb(dir);
    const uow = new SqliteUnitOfWork(db);
    const { project, ticket } = await seed(uow);
    db.close();

    const db2 = openDb(dir);
    const uow2 = new SqliteUnitOfWork(db2);
    const reloaded = await uow2.projects.findById(project.id);
    assert.equal(reloaded?.slug, 'loyalty');
    const repos = await uow2.repositories.listByProject(project.id);
    assert.equal(repos.length, 2);
    const ticketReloaded = await uow2.tickets.findByProjectAndKey(project.id, ticket.key);
    assert.equal(ticketReloaded?.title, 'Loyalty program');
    const reqs = await uow2.requirements.listByTicket(ticket.id);
    assert.equal(reqs.length, 1);
    db2.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('two connections read/write safely under WAL', async () => {
  const dir = tempDir();
  try {
    const db1 = openDb(dir);
    const db2 = openDb(dir);
    const uow1 = new SqliteUnitOfWork(db1);
    const uow2 = new SqliteUnitOfWork(db2);

    const project = await createProject(uow1, { slug: 'shared', name: 'Shared' });
    await createTicket(uow2, {
      projectId: project.id,
      key: 'K-1',
      title: 'from second connection',
    });
    const readBack = await uow1.tickets.findByProjectAndKey(project.id, 'K-1');
    assert.equal(readBack?.title, 'from second connection');
    db1.close();
    db2.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('duplicate project slug and ticket key are rejected by the DB', async () => {
  const dir = tempDir();
  try {
    const db = openDb(dir);
    const uow = new SqliteUnitOfWork(db);
    await createProject(uow, { slug: 'dup', name: 'A' });
    await assert.rejects(() => createProject(uow, { slug: 'dup', name: 'B' }));
    const project = await uow.projects.findBySlug('dup');
    assert.ok(project);
    await createTicket(uow, { projectId: project.id, key: 'K', title: 't' });
    await assert.rejects(() => createTicket(uow, { projectId: project.id, key: 'K', title: 't' }));
    db.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('project archive round-trips without secrets', async () => {
  const dir = tempDir();
  try {
    const db = openDb(dir);
    const uow = new SqliteUnitOfWork(db);
    const { project, ticket } = await seed(uow);

    const sourcesRoot = join(dir, 'sources');
    mkdirSync(sourcesRoot, { recursive: true });
    writeFileSync(join(sourcesRoot, 'fsd.md'), '# FSD loyalty v1.2\n');

    const archiveDir = join(dir, 'archive');
    exportProjectArchive(db, {
      projectId: project.id,
      sourcesRoot,
      outDir: archiveDir,
    });

    const manifestText = readFileSync(join(archiveDir, 'manifest.json'), 'utf8');
    assert.ok(!manifestText.includes('OPENAI_API_KEY'));
    assert.ok(!manifestText.includes('secret'));

    const db2 = openDb(join(dir, 'restored.db'));
    const importedId = importProjectArchive(db2, {
      archiveDir,
      sourcesRoot: join(dir, 'restored-sources'),
    });
    assert.equal(importedId, project.id);
    const uow2 = new SqliteUnitOfWork(db2);
    const restoredProject = await uow2.projects.findById(project.id);
    assert.equal(restoredProject?.slug, 'loyalty');
    const restoredTicket = await uow2.tickets.findByProjectAndKey(project.id, ticket.key);
    assert.equal(restoredTicket?.title, 'Loyalty program');
    const reqs = await uow2.requirements.listByTicket(ticket.id);
    assert.equal(reqs.length, 1);
    assert.equal(reqs[0]?.title, 'Validate loyalty tier before applying discount');
    const impacts = await uow2.requirements.listImpactsByTicket(ticket.id);
    assert.equal(impacts.length, 1);
    assert.ok(existsSync(join(dir, 'restored-sources', 'fsd.md')));
    db.close();
    db2.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('FTS5 search returns provenance', async () => {
  const dir = tempDir();
  try {
    const db = openDb(dir);
    const uow = new SqliteUnitOfWork(db);
    const { project } = await seed(uow);
    const snapshot = await uow.snapshots.create({
      id: 'snap-1',
      projectId: project.id,
      repositoryId: null,
      relPath: 'docs/fsd.md',
      contentHash: 'abc',
      contentKind: 'markdown',
      size: 10,
      createdAt: new Date().toISOString(),
    });
    await uow.chunks.insertMany([
      {
        id: 'chunk-1',
        snapshotId: snapshot.id,
        chunkIndex: 0,
        content: 'Discount cap should be 15 percent for loyalty tier',
        location: 'docs/fsd.md:12',
        createdAt: new Date().toISOString(),
      },
    ]);
    const results = await uow.search.search('discount cap', project.id);
    assert.equal(results.length, 1);
    assert.equal(results[0]?.relPath, 'docs/fsd.md');
    assert.equal(results[0]?.location, 'docs/fsd.md:12');
    assert.ok(results[0]?.content.includes('15 percent'));
    db.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('requirements keep explicit display_order and superseded items are listable', async () => {
  const dir = tempDir();
  try {
    const db = openDb(dir);
    const uow = new SqliteUnitOfWork(db);
    const project = await createProject(uow, { slug: 'order', name: 'Order' });
    const ticket = await createTicket(uow, { projectId: project.id, key: 'K', title: 't' });
    const p1 = await createProposal(uow, {
      ticketId: ticket.id,
      kind: 'extraction',
      output: {
        kind: 'extraction',
        requirements: [{ title: 'First' }, { title: 'Second' }, { title: 'Third' }],
      },
    });
    await approveProposal(uow, { proposalId: p1.id });

    const active = await uow.requirements.listActiveByTicket(ticket.id);
    assert.deepEqual(
      active.map((r) => r.title),
      ['First', 'Second', 'Third'],
    );
    assert.deepEqual(
      active.map((r) => r.displayOrder),
      [0, 1, 2],
    );

    const old = active[0];
    assert.ok(old, 'first requirement exists');
    const p2 = await createProposal(uow, {
      ticketId: ticket.id,
      kind: 'reconciliation',
      output: {
        kind: 'reconciliation',
        create: [{ title: 'First (revised)', supersedes: [old.id] }],
      },
    });
    await approveProposal(uow, { proposalId: p2.id });

    const activeAfter = await uow.requirements.listActiveByTicket(ticket.id);
    assert.deepEqual(
      activeAfter.map((r) => r.title).sort(),
      ['First (revised)', 'Second', 'Third'].sort(),
    );
    const superseded = await uow.requirements.listSupersededByTicket(ticket.id);
    assert.equal(superseded.length, 1);
    assert.equal(superseded[0]?.title, 'First');
    db.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('completion audit action is persisted (check/uncheck)', async () => {
  const dir = tempDir();
  try {
    const db = openDb(dir);
    const uow = new SqliteUnitOfWork(db);
    const project = await createProject(uow, { slug: 'audit', name: 'Audit' });
    const ticket = await createTicket(uow, { projectId: project.id, key: 'K', title: 't' });
    const { addRequirementManual, uncheckRequirement } = await import('@trachex/domain');
    const req = await addRequirementManual(uow, {
      ticketId: ticket.id,
      title: 'A',
      actorType: 'human',
      actorId: 'budi',
    });
    const { checkRequirement } = await import('@trachex/domain');
    await checkRequirement(uow, { requirementId: req.id, actorType: 'human' });
    await uncheckRequirement(uow, { requirementId: req.id, actorType: 'human' });

    const audits = await uow.completionAudits.listByRequirement(req.id);
    assert.deepEqual(audits.map((a) => a.action).sort(), ['check', 'uncheck']);
    const updated = await uow.requirements.findById(req.id);
    assert.equal(updated?.devStatus, 'unchecked');
    db.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
