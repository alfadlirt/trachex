import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { ExportSummary } from '@trachex/domain';
import { serializeJson, serializeMarkdown } from './export.ts';

const summary: ExportSummary = {
  projectSlug: 'loyalty',
  ticketKey: 'TICKET-1234',
  ticketTitle: 'Loyalty program',
  timeline: [
    {
      at: '2026-09-07T00:00:00.000Z',
      kind: 'proposal',
      description: 'proposal extraction pending',
    },
    {
      at: '2026-09-07T00:01:00.000Z',
      kind: 'approval',
      description: 'approved proposal extraction',
    },
  ],
  checklist: [
    {
      id: 'r2',
      projectId: 'p1',
      ticketId: 't1',
      title: 'Discount cap 15%',
      description: null,
      sourceId: null,
      sourceLocation: 'chat, Budi (BA)',
      lifecycleStatus: 'active',
      devStatus: 'checked',
      parentLabel: null,
      parentId: null,
      displayOrder: 0,
      createdAt: '2026-09-07T00:00:00.000Z',
      updatedAt: '2026-09-07T00:00:00.000Z',
    },
  ],
  impacts: [
    {
      id: 'i1',
      requirementId: 'r2',
      kind: 'service',
      value: 'front-office-service',
      createdAt: '',
    },
  ],
  scenarios: [
    { id: 's1', requirementId: 'r2', text: 'VIP at cap', reviewed: false, createdAt: '' },
  ],
  history: [
    {
      id: 'r1',
      projectId: 'p1',
      ticketId: 't1',
      title: 'Discount cap 20%',
      description: null,
      sourceId: null,
      sourceLocation: 'FSD v1.2',
      lifecycleStatus: 'superseded',
      devStatus: 'unchecked',
      parentLabel: null,
      parentId: null,
      displayOrder: 0,
      createdAt: '2026-09-07T00:00:00.000Z',
      updatedAt: '2026-09-07T00:00:00.000Z',
    },
  ],
};

test('markdown export contains all PRD sections', () => {
  const md = serializeMarkdown(summary);
  for (const section of [
    '## Timeline',
    '## Current Checklist',
    '## Services Impacted',
    '## APIs Changed',
    '## Pages Impacted',
    '## Test Scenarios',
    '## Requirement History',
  ]) {
    assert.ok(md.includes(section), `missing section ${section}`);
  }
  assert.ok(md.includes('[x] Discount cap 15%'));
  assert.ok(md.includes('r1 — Discount cap 20%'));
  assert.ok(md.includes('front-office-service'));
  assert.ok(md.includes('VIP at cap'));
});

test('json export round-trips the summary', () => {
  const parsed = JSON.parse(serializeJson(summary)) as ExportSummary;
  assert.equal(parsed.ticketKey, 'TICKET-1234');
  assert.equal(parsed.checklist.length, 1);
  assert.equal(parsed.history.length, 1);
  assert.equal(parsed.timeline.length, 2);
});
