import assert from 'node:assert/strict';
import { test } from 'node:test';
import { assertNever, isRecord } from '@trachex/shared';

test('isRecord narrows plain objects', () => {
  assert.equal(isRecord({ a: 1 }), true);
  assert.equal(isRecord(null), false);
  assert.equal(isRecord([]), false);
  assert.equal(isRecord('x'), false);
});

test('assertNever throws on unexpected branch', () => {
  assert.throws(() => assertNever('bad' as never), /unreachable/);
});
