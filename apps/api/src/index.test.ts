import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { createApp } from './index.ts';

test('dashboard shell serves assets with browser-correct MIME types and preserves API routes', async () => {
  const appDir = mkdtempSync(join(tmpdir(), 'trachex-api-'));
  const dashboardDist = join(appDir, 'dashboard');
  mkdirSync(join(dashboardDist, 'assets'), { recursive: true });
  writeFileSync(join(dashboardDist, 'index.html'), '<div id="root"></div>');
  writeFileSync(join(dashboardDist, 'assets', 'main.js'), 'console.log("ready");');
  writeFileSync(join(dashboardDist, 'assets', 'main.css'), '#root {}');

  const app = createApp({
    appDir,
    dashboardDist,
    env: { OPENAI_API_KEY: 'test' },
    runAgent: async () => ({ kind: 'reconciliation', create: [] }),
  });

  try {
    const shell = await app.request('/');
    assert.equal(shell.status, 200);
    assert.equal(shell.headers.get('content-type'), 'text/html; charset=UTF-8');
    assert.equal(await shell.text(), '<div id="root"></div>');

    const script = await app.request('/assets/main.js');
    assert.equal(script.status, 200);
    assert.equal(script.headers.get('content-type'), 'text/javascript');

    const stylesheet = await app.request('/assets/main.css');
    assert.equal(stylesheet.status, 200);
    assert.equal(stylesheet.headers.get('content-type'), 'text/css');

    const clientRoute = await app.request('/projects/loyalty');
    assert.equal(clientRoute.status, 200);
    assert.equal(await clientRoute.text(), '<div id="root"></div>');

    const health = await app.request('/api/health');
    assert.equal(health.status, 200);
    assert.equal(health.headers.get('content-type'), 'application/json');
    assert.deepEqual(await health.json(), { ok: true });
  } finally {
    rmSync(appDir, { recursive: true, force: true });
  }
});
