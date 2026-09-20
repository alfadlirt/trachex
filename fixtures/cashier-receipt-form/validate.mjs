import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

const dir = new URL('.', import.meta.url);
const load = async (name) => JSON.parse(await readFile(new URL(name, dir), 'utf8'));

const projectBundle = await load('project.json');
const project = projectBundle.project;
const tickets = projectBundle.tickets;
const sources = await load('sources.json');
const requirements = await load('requirements.json');
const impacts = await load('impacts.json');
const scenarios = await load('scenarios.json');
const audits = await load('completion-audits.json');
const proposals = await load('proposals.json');
const findings = await load('expected-findings.json');
const fixture = await load('fixture.json');

const fail = (message) => {
  throw new Error(message);
};

const ids = (rows, label) => {
  const seen = new Set();
  for (const row of rows) {
    if (!row.id || seen.has(row.id)) fail(`duplicate or missing ${label} id: ${row?.id}`);
    seen.add(row.id);
  }
  return seen;
};

const ticketIds = ids(tickets, 'ticket');
const requirementIds = ids(requirements, 'requirement');
const sourceIds = ids(sources, 'source');

for (const ticket of tickets) {
  if (ticket.projectId !== project.id) fail(`ticket ${ticket.id} has wrong project`);
}

for (const source of sources) {
  if (!ticketIds.has(source.ticketId)) fail(`source ${source.id} references missing ticket`);
}

for (const requirement of requirements) {
  if (requirement.projectId !== project.id || !ticketIds.has(requirement.ticketId))
    fail(`invalid requirement reference: ${requirement.id}`);
  if (!sourceIds.has(requirement.sourceId))
    fail(`requirement ${requirement.id} references missing source`);
  if (!['active', 'superseded', 'archived'].includes(requirement.lifecycleStatus))
    fail(`invalid lifecycle: ${requirement.id}`);
  if (!['unchecked', 'checked'].includes(requirement.devStatus))
    fail(`invalid dev status: ${requirement.id}`);
  if (requirement.parentId !== null && !requirementIds.has(requirement.parentId))
    fail(`missing parent: ${requirement.id}`);
}

for (const row of impacts) {
  if (!requirementIds.has(row.requirementId) || !['service', 'api', 'page'].includes(row.kind))
    fail(`invalid impact: ${row.id}`);
}

for (const row of scenarios) {
  if (!requirementIds.has(row.requirementId) || typeof row.reviewed !== 'boolean')
    fail(`invalid scenario: ${row.id}`);
}

for (const row of audits) {
  if (!requirementIds.has(row.requirementId) || !['check', 'uncheck'].includes(row.action))
    fail(`invalid audit: ${row.id}`);
}

for (const proposal of proposals) {
  if (
    !ticketIds.has(proposal.ticketId) ||
    !['extraction', 'reconciliation', 'impact', 'scenario'].includes(proposal.kind)
  )
    fail(`invalid proposal: ${proposal.id}`);
  if (!['pending', 'approved', 'rejected'].includes(proposal.status))
    fail(`invalid proposal status: ${proposal.id}`);
  if (proposal.kind === 'reconciliation') {
    const targets = proposal.output?.create?.flatMap((draft) => draft.supersedes ?? []) ?? [];
    for (const targetId of targets) {
      const target = requirements.find((requirement) => requirement.id === targetId);
      if (!target) fail(`reconciliation ${proposal.id} supersedes missing requirement ${targetId}`);
      if (target.ticketId !== proposal.ticketId)
        fail(`reconciliation ${proposal.id} crosses ticket boundary for ${targetId}`);
    }
  }
}

for (const finding of findings) {
  if (
    !['info', 'low', 'medium', 'high', 'critical'].includes(finding.severity) ||
    !['pending', 'accepted', 'rejected'].includes(finding.status)
  )
    fail(`invalid finding: ${finding.id}`);
}

// Validasi Chain of Superseding khusus (7d -> 14d -> 10d)
const req7d = requirements.find((r) => r.id === 'req-crf-correction-window-7d');
const req14d = requirements.find((r) => r.id === 'req-crf-correction-window-14d');
const req10d = requirements.find((r) => r.id === 'req-crf-correction-window-10d');

if (!req7d || req7d.lifecycleStatus !== 'superseded') fail('req-crf-correction-window-7d must be superseded');
if (!req14d || req14d.lifecycleStatus !== 'superseded') fail('req-crf-correction-window-14d must be superseded');
if (!req10d || req10d.lifecycleStatus !== 'active') fail('req-crf-correction-window-10d must be active');

// Verifikasi file dokumen yang terdaftar pada fixture.json
for (const doc of fixture.documents) {
  const docUrl = new URL(doc, dir);
  if (!existsSync(docUrl)) fail(`fixture references missing document: ${doc}`);
}

const active = requirements.filter((r) => r.lifecycleStatus === 'active');
const superseded = requirements.filter((r) => r.lifecycleStatus === 'superseded');

console.log('------------------------------------------------------------');
console.log('✓ Validated Cashier Receipt Form (CRF) Fixture:');
console.log(`  Project: ${project.name} (${project.id})`);
console.log(`  Tickets: ${tickets.length} tickets (${tickets.map((t) => t.key).join(', ')})`);
console.log(`  Documents: ${fixture.documents.length} files (including PDF & Markdown)`);
console.log(`  Requirements: ${requirements.length} total (${active.length} active, ${superseded.length} superseded)`);
console.log(`  Scenarios: ${scenarios.length} scenarios`);
console.log(`  Audits: ${audits.length} check audits`);
console.log(`  Proposals: ${proposals.length} extraction/reconciliation proposals`);
console.log(`  Expected Findings: ${findings.length} findings`);
console.log('------------------------------------------------------------');
