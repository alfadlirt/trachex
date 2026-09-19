import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mergeEvidence, normalizeChatContent } from './chat-format.ts';

test('normalizes compact bullets and removes duplicate evidence lines', () => {
  assert.equal(
    normalizeChatContent(
      'It covers: - Creating the trial. - Rejecting invalid cards.\n\nEvidence: Ticket baseline\nEvidence: Ticket baseline',
    ),
    'It covers:\n- Creating the trial.\n- Rejecting invalid cards.\n\nEvidence: Ticket baseline',
  );
});

test('merges an evidence event only once', () => {
  const answer = 'The baseline is approved.\n\nEvidence: Ticket baseline';
  assert.equal(mergeEvidence(answer, 'Ticket baseline'), answer);
  assert.equal(
    mergeEvidence('The baseline is approved.', 'Ticket baseline'),
    'The baseline is approved.\n\nEvidence: Ticket baseline',
  );
  assert.equal(mergeEvidence(answer, 'ticket BASELINE'), answer);
});

test('keeps ordinary hyphenated prose intact while expanding compact bullets', () => {
  assert.equal(
    normalizeChatContent('It covers: - Set up pre-paid cards - Review follow-up'),
    'It covers:\n- Set up pre-paid cards\n- Review follow-up',
  );
});
