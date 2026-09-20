import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getSupersededCompletionState } from './superseded.ts';

function audit(action: string, checkedAt: string) {
  return { action, checkedAt };
}

test('reports a requirement completed before replacement', () => {
  assert.equal(
    getSupersededCompletionState('checked', [audit('check', '2026-09-20T10:00:00Z')]),
    'Completed before replacement',
  );
});

test('reports a requirement completed and then marked incomplete', () => {
  assert.equal(
    getSupersededCompletionState('unchecked', [
      audit('check', '2026-09-20T10:00:00Z'),
      audit('uncheck', '2026-09-20T11:00:00Z'),
    ]),
    'Was completed, then marked incomplete',
  );
});

test('evaluates audits in chronological order', () => {
  assert.equal(
    getSupersededCompletionState('unchecked', [
      audit('uncheck', '2026-09-20T11:00:00Z'),
      audit('check', '2026-09-20T10:00:00Z'),
    ]),
    'Was completed, then marked incomplete',
  );
});

test('reports a requirement that was never completed', () => {
  assert.equal(getSupersededCompletionState('unchecked', []), 'Not completed before replacement');
});

test('does not infer a completion state from an inconsistent record', () => {
  assert.equal(getSupersededCompletionState('checked', []), 'Completion state unavailable');
  assert.equal(
    getSupersededCompletionState('unchecked', [audit('uncheck', '2026-09-20T10:00:00Z')]),
    'Completion state unavailable',
  );
  assert.equal(
    getSupersededCompletionState('unknown', [audit('check', '2026-09-20T10:00:00Z')]),
    'Completion state unavailable',
  );
  assert.equal(
    getSupersededCompletionState('unchecked', [audit('check', 'not-a-timestamp')]),
    'Completion state unavailable',
  );
});
