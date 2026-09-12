import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  approveProposal,
  buildChecklistView,
  checkRequirement,
  createProject,
  createTicket,
} from '@trachex/domain';
import { migrate, openDatabase, SqliteUnitOfWork } from '@trachex/storage-sqlite';
import { type RunAgentFn, runExtraction, runReconciliation } from '../index.ts';
import {
  ADJUSTMENT_DISCOUNT_CAP,
  ADJUSTMENT_TIMEZONE,
  BRD_LOYALTY,
  FSD_LOYALTY,
  GOLDEN_EXTRACTION,
  GOLDEN_IMPACT_KINDS,
  GOLDEN_RECONCILIATION,
} from './corpus.ts';

export interface EvalScore {
  name: string;
  passed: boolean;
  detail: string;
}

export interface EvalReport {
  scores: EvalScore[];
  passed: boolean;
}

function tempAppDir(): string {
  return mkdtempSync(join(tmpdir(), 'trachex-eval-'));
}

function openDb(dir: string) {
  const db = openDatabase({ path: join(dir, 'trachex.db') });
  migrate(db);
  return db;
}

function fixtureExtraction(): RunAgentFn {
  return async () => ({
    kind: 'extraction',
    requirements: [
      {
        title: 'Validate loyalty tier before applying discount',
        impacts: [{ kind: 'service', value: 'front-office-service' }],
        scenarios: ['VIP at cap'],
      },
      {
        title: 'Display discount breakdown on cashier receipt',
        impacts: [{ kind: 'page', value: 'cashier-receipt' }],
        scenarios: ['Receipt after discount'],
      },
    ],
  });
}

function fixtureReconciliation(title = 'Discount cap 15%, VIP tier exempt'): RunAgentFn {
  return async () => ({
    kind: 'reconciliation',
    create: [
      {
        title,
        supersedes: ['__supersede_target__'],
      },
    ],
  });
}

export async function runEvalHarness(): Promise<EvalReport> {
  const scores: EvalScore[] = [];
  const dir = tempAppDir();
  try {
    const db = openDb(dir);
    const uow = new SqliteUnitOfWork(db);
    const project = await createProject(uow, { slug: 'loyalty', name: 'Loyalty' });
    const ticket = await createTicket(uow, {
      projectId: project.id,
      key: 'TICKET-EVAL',
      title: 'Loyalty eval',
    });

    // Extraction scoring
    const extraction = await runExtraction(
      uow,
      { runAgent: fixtureExtraction() },
      {
        appDir: dir,
        projectId: project.id,
        ticketId: ticket.id,
        type: 'fsd',
        relPath: 'docs/fsd.md',
        contentKind: 'markdown',
        content: FSD_LOYALTY,
      },
    );
    const golden = GOLDEN_EXTRACTION[0];
    const extractionVersions = await uow.proposals.listVersions(extraction.proposal.id);
    const firstVersion = extractionVersions[0];
    assert.ok(firstVersion, 'proposal has a version');
    const proposalOutput = JSON.parse(firstVersion.modelOutput) as {
      kind: string;
      requirements: { title: string; impacts?: { kind: string }[] }[];
    };
    const req = proposalOutput.requirements[0];
    const titleMatch = req?.title === golden?.title;
    const impactMatch =
      (req?.impacts?.some((i) => i.kind === 'service') ?? false) &&
      req?.impacts?.length === golden?.impacts?.length;
    scores.push({
      name: 'extraction-title',
      passed: titleMatch,
      detail: `expected "${golden?.title}", got "${req?.title}"`,
    });
    scores.push({
      name: 'extraction-impacts',
      passed: impactMatch,
      detail: `expected ${golden?.impacts.length} service impact(s)`,
    });

    // Approve extraction, then reconciliation with supersede
    await approveProposal(uow, { proposalId: extraction.proposal.id });
    const initialRequirements = await uow.requirements.listByTicket(ticket.id);
    const original = initialRequirements[0];
    assert.ok(original, 'original requirement exists');
    const checkAudit = await checkRequirement(uow, {
      requirementId: original.id,
      actorType: 'human',
      actorId: 'budi-ba',
      note: 'Verified against the initial baseline.',
    });

    const reconciliation = await runReconciliation(
      uow,
      { runAgent: fixtureReconciliation() },
      {
        appDir: dir,
        projectId: project.id,
        ticketId: ticket.id,
        type: 'chat',
        attribution: 'Budi (BA)',
        relPath: 'note',
        contentKind: 'text',
        content: ADJUSTMENT_DISCOUNT_CAP,
        sourceEventAt: '2026-09-10T09:00:00.000Z',
      },
    );
    // Patch the fixture's supersede target to the real requirement id.
    const reconVersions = await uow.proposals.listVersions(reconciliation.proposal.id);
    const latest = reconVersions.at(-1);
    assert.ok(latest, 'reconciliation proposal has a version');
    const output = JSON.parse(latest.modelOutput) as {
      kind: string;
      create: { title: string; supersedes?: string[] }[];
    };
    const createDraft = output.create[0];
    assert.ok(createDraft, 'reconciliation has a create draft');
    assert.ok(createDraft.supersedes?.length, 'reconciliation output must carry supersedes');
    createDraft.supersedes = [original.id];
    await uow.proposals.addVersion({
      id: crypto.randomUUID(),
      proposalId: reconciliation.proposal.id,
      version: reconVersions.length + 1,
      modelOutput: JSON.stringify(output),
      editedOutput: JSON.stringify(output),
      reviewedAt: null,
      createdAt: new Date().toISOString(),
    });
    await approveProposal(uow, { proposalId: reconciliation.proposal.id });

    const requirements = await uow.requirements.listByTicket(ticket.id);
    const superseded = requirements.filter((r) => r.lifecycleStatus === 'superseded');
    const active = requirements.filter((r) => r.lifecycleStatus === 'active');
    const rels = await uow.requirements.listRelationshipsByTicket(ticket.id);
    scores.push({
      name: 'reconciliation-supersede',
      passed:
        superseded.length === 1 &&
        active.some((r) => r.title === GOLDEN_RECONCILIATION.createTitle),
      detail: `superseded=${superseded.length}, active=${active.length}, rels=${rels.length}`,
    });
    scores.push({
      name: 'reconciliation-conflict-requires-approval',
      passed: reconciliation.proposal.status === 'pending',
      detail: `reconciliation proposal status was ${reconciliation.proposal.status} before approval (must be pending)`,
    });

    const requirementsAfterFirst = await uow.requirements.listByTicket(ticket.id);
    const supersededAfterFirst = requirementsAfterFirst.filter(
      (r) => r.lifecycleStatus === 'superseded',
    );
    const replacement = requirementsAfterFirst.find(
      (r) => r.title === GOLDEN_RECONCILIATION.createTitle,
    );
    const relationshipsAfterFirst = (
      await uow.requirements.listRelationshipsByTicket(ticket.id)
    ).filter((r) => r.type === 'supersedes');
    const audits = await uow.completionAudits.listByRequirement(original.id);
    const source = (await uow.sources.listByTicket(ticket.id)).find(
      (s) => s.id === replacement?.sourceId,
    );
    scores.push({
      name: 'supersede-audit-relation-and-attribution',
      passed:
        supersededAfterFirst.length === 1 &&
        relationshipsAfterFirst.length === 1 &&
        relationshipsAfterFirst[0]?.fromRequirementId === replacement?.id &&
        relationshipsAfterFirst[0]?.toRequirementId === original.id &&
        audits.length === 1 &&
        audits[0]?.id === checkAudit.id &&
        audits[0]?.actorId === 'budi-ba' &&
        replacement?.devStatus === 'unchecked' &&
        source?.attribution === 'Budi (BA)' &&
        source.sourceEventAt === '2026-09-10T09:00:00.000Z',
      detail: `superseded=${supersededAfterFirst.length}, relations=${relationshipsAfterFirst.length}, audits=${audits.length}`,
    });
    const view = await buildChecklistView(uow, { projectId: project.id, ticketKey: ticket.key });
    const entry = view.superseded.find((item) => item.item.id === original.id);
    scores.push({
      name: 'checklist-view-superseded-entry',
      passed:
        view.superseded.length === 1 &&
        !view.groups.some((group) => group.items.some((item) => item.id === original.id)) &&
        entry?.supersededByTitle === GOLDEN_RECONCILIATION.createTitle &&
        entry.oldAudits.length === 1 &&
        entry.replacement?.devStatus === 'unchecked',
      detail: `groups=${view.groups.length}, superseded=${view.superseded.length}`,
    });

    // Impact classification scoring (per-kind accuracy vs golden).
    const impacts = await uow.requirements.listImpactsByTicket(ticket.id);
    const kinds = new Set(impacts.map((i) => i.kind));
    const expectedKinds = new Set(GOLDEN_IMPACT_KINDS.filter((k) => k !== 'api' && k !== 'page'));
    const impactOk = expectedKinds.size > 0 && [...expectedKinds].every((k) => kinds.has(k));
    scores.push({
      name: 'impact-classification',
      passed: impactOk,
      detail: `kinds=${[...kinds].join(',')}, expected service`,
    });

    // FTS5 grounding
    const search = await uow.search.search('discount cap', project.id);
    const grounded =
      search.length > 0 && search.every((r) => r.relPath !== null && r.location !== null);
    scores.push({
      name: 'fts5-grounding',
      passed: grounded,
      detail: `results=${search.length}, provenance=${grounded}`,
    });

    // Corpus breadth: ingest the BRD and the timezone adjustment, then verify
    // FTS5 grounds the timezone note with provenance.
    await runExtraction(
      uow,
      { runAgent: fixtureExtraction() },
      {
        appDir: dir,
        projectId: project.id,
        ticketId: ticket.id,
        type: 'brd',
        relPath: 'docs/brd.md',
        contentKind: 'markdown',
        content: BRD_LOYALTY,
      },
    );
    const tzReconciliation = await runReconciliation(
      uow,
      { runAgent: fixtureReconciliation('Receipt timezone uses store configuration') },
      {
        appDir: dir,
        projectId: project.id,
        ticketId: ticket.id,
        type: 'clarification',
        attribution: 'QA',
        relPath: 'note-timezone',
        contentKind: 'text',
        content: ADJUSTMENT_TIMEZONE,
      },
    );
    const secondVersions = await uow.proposals.listVersions(tzReconciliation.proposal.id);
    const secondOutput = JSON.parse(secondVersions.at(-1)?.modelOutput ?? '{}') as {
      kind?: string;
      create?: { title: string; supersedes?: string[] }[];
    };
    const secondDraft = secondOutput.create?.[0];
    assert.ok(secondDraft, 'second reconciliation has a draft');
    assert.ok(secondDraft.supersedes?.length, 'second reconciliation output must carry supersedes');
    assert.ok(initialRequirements[1], 'second initial requirement exists');
    secondDraft.supersedes = [initialRequirements[1].id];
    await uow.proposals.addVersion({
      id: crypto.randomUUID(),
      proposalId: tzReconciliation.proposal.id,
      version: secondVersions.length + 1,
      modelOutput: JSON.stringify(secondOutput),
      editedOutput: JSON.stringify(secondOutput),
      reviewedAt: null,
      createdAt: new Date().toISOString(),
    });
    await approveProposal(uow, { proposalId: tzReconciliation.proposal.id });
    const finalRequirements = await uow.requirements.listByTicket(ticket.id);
    const finalSuperseded = finalRequirements.filter((r) => r.lifecycleStatus === 'superseded');
    const finalActiveUnchecked = finalRequirements.filter(
      (r) => r.lifecycleStatus === 'active' && r.devStatus === 'unchecked',
    );
    const finalView = await buildChecklistView(uow, {
      projectId: project.id,
      ticketKey: ticket.key,
    });
    const escalation =
      "We can't confirm that from the available context. Please ask your BA immediately, then add the clarification with `subject add-doc` before relying on this answer.";
    scores.push({
      name: 'drift-summary-evidence-and-uncertainty',
      passed:
        initialRequirements.length === 2 &&
        finalSuperseded.length === 2 &&
        finalActiveUnchecked.length === 2 &&
        finalView.superseded.length === 2 &&
        escalation.includes('ask your BA immediately') &&
        escalation.includes('subject add-doc'),
      detail: `initial=${initialRequirements.length}, superseded=${finalSuperseded.length}, activeUnchecked=${finalActiveUnchecked.length}; unsupported answers escalate`,
    });
    const tzSearch = await uow.search.search('timezone', project.id);
    const tzGrounded = tzSearch.length > 0 && tzSearch.some((r) => r.relPath === 'note-timezone');
    scores.push({
      name: 'corpus-breadth-grounding',
      passed: tzGrounded,
      detail: `timezone results=${tzSearch.length}, grounded=${tzGrounded}`,
    });

    // Performance (fixture extraction is ms-scale; assert < 2 min)
    const start = performance.now();
    await runExtraction(
      uow,
      { runAgent: fixtureExtraction() },
      {
        appDir: dir,
        projectId: project.id,
        ticketId: ticket.id,
        type: 'fsd',
        relPath: 'docs/fsd.md',
        contentKind: 'markdown',
        content: FSD_LOYALTY,
      },
    );
    const elapsedMs = performance.now() - start;
    scores.push({
      name: 'performance-under-2min',
      passed: elapsedMs < 120_000,
      detail: `extraction took ${Math.round(elapsedMs)}ms`,
    });

    db.close();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }

  return { scores, passed: scores.every((s) => s.passed) };
}
