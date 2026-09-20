import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CHECKLIST_FIXTURES, type ChecklistFixture } from './evals/corpus.ts';
import { englishLanguage, runEvalHarness } from './evals/harness.ts';
import { buildExtractionPrompt, buildReconciliationPrompt } from './prompts.ts';

test('prompts include explicit English output instructions', () => {
  const expectedInstruction =
    'All output must be in English. Even if the provided source document or notes are written in another language, translate and express all titles, descriptions, implementationItems, successCriteria, and rationales in English.';

  const extractionPrompt = buildExtractionPrompt({ sourceType: 'document' });
  assert.ok(
    extractionPrompt.includes(expectedInstruction),
    'buildExtractionPrompt must mandate English output',
  );

  const reconciliationPrompt = buildReconciliationPrompt({ sourceType: 'note' });
  assert.ok(
    reconciliationPrompt.includes(expectedInstruction),
    'buildReconciliationPrompt must mandate English output',
  );
});

test('englishLanguage metric identifies English and non-English outputs', () => {
  const englishFixture: ChecklistFixture = {
    id: 'test-english',
    source: 'Qualquer texto',
    concepts: ['cancel'],
    output: {
      kind: 'extraction',
      requirements: [
        {
          title: 'Cancel active order',
          description: 'Allow customers to cancel active orders before shipment.',
          implementationItems: ['Validate cancellation eligibility.'],
          successCriteria: ['Order cancellation is confirmed.'],
        },
      ],
      proposedOrder: {
        orderedIds: ['req-1'],
        rationale: 'Foundations must precede dependents.',
      },
    },
    expected: 'pass',
  };
  const passed = englishLanguage(englishFixture);
  assert.equal(passed.passed, true);
  assert.equal(passed.metric, 'english-output');
  assert.equal(passed.category, 'Prompt alignment');

  // Non-Latin scripts (Chinese)
  const chineseFixture: ChecklistFixture = {
    ...englishFixture,
    output: {
      kind: 'extraction',
      requirements: [
        {
          title: '取消订单',
          description: '允许客户在发货前取消订单。',
          implementationItems: ['验证取消资格。'],
          successCriteria: ['订单取消成功。'],
        },
      ],
    },
    expected: 'fail',
    languageExpected: 'fail',
  };
  const chineseResult = englishLanguage(chineseFixture);
  assert.equal(chineseResult.passed, true); // Expected to fail, so eval score passes assertion
  assert.ok(chineseResult.detail.includes('Non-English output detected'));

  // Non-Latin scripts (Cyrillic)
  const cyrillicFixture: ChecklistFixture = {
    ...englishFixture,
    output: {
      kind: 'extraction',
      requirements: [
        {
          title: 'Отмена заказа',
          description: 'Позволяет клиенту отменить заказ.',
        },
      ],
    },
    expected: 'fail',
    languageExpected: 'fail',
  };
  const cyrillicResult = englishLanguage(cyrillicFixture);
  assert.equal(cyrillicResult.passed, true);
  assert.ok(cyrillicResult.detail.includes('Non-English output detected'));

  // Non-English in proposedOrder rationale
  const rationaleFixture: ChecklistFixture = {
    ...englishFixture,
    output: {
      ...englishFixture.output,
      proposedOrder: {
        orderedIds: ['req-1'],
        rationale: 'Validasi pembatalan harus diselesaikan terlebih dahulu.',
      },
    },
    expected: 'fail',
    languageExpected: 'fail',
  };
  const rationaleResult = englishLanguage(rationaleFixture);
  assert.equal(rationaleResult.passed, true);
  assert.ok(rationaleResult.detail.includes('Non-English output detected'));
});

test('runEvalHarness evaluates all fixtures and invariants successfully', async () => {
  const report = await runEvalHarness();
  assert.equal(report.passed, true);
  assert.ok(report.scores.length > 0);

  // Assert english-output metric is present and passed for every fixture
  const englishScores = report.scores.filter((s) => s.metric === 'english-output');
  assert.equal(englishScores.length, CHECKLIST_FIXTURES.length);
  for (const score of englishScores) {
    assert.equal(
      score.passed,
      true,
      `english-output metric failed for fixture ${score.name}: ${score.detail}`,
    );
  }

  // Verify multilingual fixtures exist
  const passFixtureScore = englishScores.find((s) =>
    s.name.startsWith('multilingual-source-english-output:'),
  );
  assert.ok(passFixtureScore);
  assert.equal(passFixtureScore.passed, true);
  assert.equal(passFixtureScore.detail, 'All evaluated output fields are in English.');

  const failFixtureScore = englishScores.find((s) =>
    s.name.startsWith('multilingual-source-non-english-output:'),
  );
  assert.ok(failFixtureScore);
  assert.equal(failFixtureScore.passed, true);
  assert.ok(failFixtureScore.detail.includes('Non-English output detected'));
});
