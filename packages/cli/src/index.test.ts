import assert from 'node:assert/strict';
import { test } from 'node:test';
import { cliName, isKnownCliArg } from '@trachex/cli';

test('cli imports shared workspace source', () => {
  assert.equal(cliName, 'trachex');
});

test('isKnownCliArg recognizes explicit project args', () => {
  assert.equal(isKnownCliArg({ project: 'loyalty' }), true);
  assert.equal(isKnownCliArg({}), false);
});
