import assert from 'node:assert/strict';
import { test } from 'node:test';
import { extractionOutputSchema, reconciliationOutputSchema } from './schemas.ts';

test('extraction output parses valid requirements', () => {
  const parsed = extractionOutputSchema.parse({
    kind: 'extraction',
    requirements: [
      {
        title: 'Validate loyalty tier before applying discount',
        impacts: [{ kind: 'service', value: 'front-office-service' }],
        scenarios: ['VIP at cap'],
      },
    ],
  });
  assert.equal(parsed.kind, 'extraction');
  assert.equal(parsed.requirements[0]?.title, 'Validate loyalty tier before applying discount');
});

test('reconciliation output parses with supersedes targets', () => {
  const parsed = reconciliationOutputSchema.parse({
    kind: 'reconciliation',
    create: [
      {
        title: 'Discount cap 15%',
        supersedes: ['item-001'],
      },
    ],
  });
  assert.equal(parsed.create[0]?.supersedes?.[0], 'item-001');
});

test('malformed output is rejected', () => {
  assert.throws(() =>
    extractionOutputSchema.parse({
      kind: 'extraction',
      requirements: [],
    }),
  );
  assert.throws(() =>
    extractionOutputSchema.parse({
      kind: 'reconciliation',
      create: [],
    }),
  );
});
