import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ADJUSTMENT_QUEUE, createAdjustmentQueue } from './index.ts';

test('adjustment queue uses the stable queue name', async () => {
  assert.equal(ADJUSTMENT_QUEUE, 'trachex-adjustments');
  const owned = createAdjustmentQueue('redis://localhost:6379');
  try {
    assert.equal(owned.queue.name, ADJUSTMENT_QUEUE);
  } finally {
    await owned.close();
  }
});
