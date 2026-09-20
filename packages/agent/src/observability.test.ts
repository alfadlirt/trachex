import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildObservability } from './observability.ts';

test('Lens observability uses a default service name when none is configured', () => {
  assert.doesNotThrow(() =>
    buildObservability({
      ANVIA_LENS_ENABLED: 'true',
      ANVIA_LENS_BASE_URL: 'http://localhost',
      ANVIA_LENS_PUBLIC_KEY: 'public',
      ANVIA_LENS_SECRET_KEY: 'secret',
    }),
  );
});
