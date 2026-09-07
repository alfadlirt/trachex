import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolveBundledDashboardDist, resolveComposeFile } from './index.ts';

test('resolveBundledDashboardDist returns a path or undefined (never throws)', () => {
  const dist = resolveBundledDashboardDist();
  assert.ok(dist === undefined || typeof dist === 'string');
});

test('resolveComposeFile returns an absolute path to a compose file', () => {
  const compose = resolveComposeFile();
  assert.ok(compose.endsWith('docker-compose.dev.yml'));
});
