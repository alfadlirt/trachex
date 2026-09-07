import assert from 'node:assert/strict';
import { test } from 'node:test';
import { EXIT_OK, EXIT_USAGE } from './errors.ts';

test('exit code constants are stable', () => {
  assert.equal(EXIT_OK, 0);
  assert.equal(EXIT_USAGE, 2);
});
