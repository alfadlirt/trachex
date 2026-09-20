import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolveVectorBackend } from './backend.ts';

test('defaults to the local sqlite vector backend', () => {
  assert.deepEqual(resolveVectorBackend({}), { backend: 'sqlite' });
});

test('builds the configured qdrant backend without starting docker', () => {
  const config = resolveVectorBackend({
    TRACHEX_VECTOR_BACKEND: 'qdrant',
    QDRANT_URL: 'http://localhost:6333',
    QDRANT_API_KEY: 'test-key',
    QDRANT_COLLECTION: 'local-test',
  });

  assert.equal(config.backend, 'qdrant');
  assert.ok(config.qdrantClient);
});
