import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { loadTrachexEnv } from './env.ts';

test('loadTrachexEnv preserves explicitly provided values', () => {
  const env: NodeJS.ProcessEnv = { TRACHEX_PROVIDER: 'shell' };
  assert.equal(loadTrachexEnv(env, '/path/that/does/not/exist').TRACHEX_PROVIDER, 'shell');
});
