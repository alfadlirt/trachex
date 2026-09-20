import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { createProject } from '@trachex/domain';
import { migrate, openDatabase, SqliteUnitOfWork } from '@trachex/storage-sqlite';
import { startMcpHttpServer } from './http.ts';

test('Streamable HTTP initializes, lists tools, and closes a session', async () => {
  const appDir = await mkdtemp(join(tmpdir(), 'trachex-mcp-http-'));
  const db = openDatabase({ path: join(appDir, 'trachex.db') });
  migrate(db);
  await createProject(new SqliteUnitOfWork(db), { slug: 'demo', name: 'Demo' });
  db.close();

  const handle = await startMcpHttpServer({
    projectSlug: 'demo',
    appDir,
    host: '127.0.0.1',
    port: 0,
    token: 'test-token',
    allowedOrigins: ['https://trusted.example'],
  });
  const endpoint = `http://127.0.0.1:${handle.port}/mcp`;
  const headers = {
    Authorization: 'Bearer test-token',
    Accept: 'application/json, text/event-stream',
    'Content-Type': 'application/json',
  };
  try {
    const initializeResponse = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2025-06-18',
          capabilities: {},
          clientInfo: { name: 'test', version: '1' },
        },
      }),
    });
    assert.equal(initializeResponse.status, 200);
    const sessionId = initializeResponse.headers.get('mcp-session-id');
    assert.ok(sessionId);
    const initialize = (await initializeResponse.json()) as {
      result: { serverInfo: { name: string } };
    };
    assert.equal(initialize.result.serverInfo.name, 'trachex-mcp');

    const listedResponse = await fetch(endpoint, {
      method: 'POST',
      headers: {
        ...headers,
        'Mcp-Session-Id': sessionId,
        'Mcp-Protocol-Version': '2025-06-18',
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} }),
    });
    assert.equal(listedResponse.status, 200);
    const listed = (await listedResponse.json()) as { result: { tools: unknown[] } };
    assert.ok(listed.result.tools.length >= 11);

    const closedResponse = await fetch(endpoint, {
      method: 'DELETE',
      headers: {
        Authorization: 'Bearer test-token',
        Accept: 'application/json, text/event-stream',
        'Mcp-Session-Id': sessionId,
        'Mcp-Protocol-Version': '2025-06-18',
      },
    });
    assert.equal(closedResponse.status, 200);

    const invalidSessionResponse = await fetch(endpoint, {
      method: 'POST',
      headers: {
        ...headers,
        'Mcp-Session-Id': sessionId,
        'Mcp-Protocol-Version': '2025-06-18',
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: 3, method: 'tools/list', params: {} }),
    });
    assert.equal(invalidSessionResponse.status, 404);
  } finally {
    await handle.close();
    await rm(appDir, { recursive: true, force: true });
  }
});

test('HTTP MCP rejects missing or incorrect bearer credentials before MCP handling', async () => {
  const appDir = await mkdtemp(join(tmpdir(), 'trachex-mcp-auth-'));
  const db = openDatabase({ path: join(appDir, 'trachex.db') });
  migrate(db);
  await createProject(new SqliteUnitOfWork(db), { slug: 'demo', name: 'Demo' });
  db.close();
  const handle = await startMcpHttpServer({
    projectSlug: 'demo',
    appDir,
    port: 0,
    token: 'test-token',
    allowedOrigins: ['https://trusted.example'],
  });
  try {
    const response = await fetch(`http://127.0.0.1:${handle.port}/mcp`, {
      method: 'POST',
      headers: {
        Accept: 'application/json, text/event-stream',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2025-06-18',
          capabilities: {},
          clientInfo: { name: 'test', version: '1' },
        },
      }),
    });
    assert.equal(response.status, 401);
    assert.equal(response.headers.get('www-authenticate'), 'Bearer');

    const wrongOrigin = await fetch(`http://127.0.0.1:${handle.port}/mcp`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer test-token',
        Origin: 'https://untrusted.example',
        Accept: 'application/json, text/event-stream',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: 2, method: 'initialize', params: {} }),
    });
    assert.equal(wrongOrigin.status, 403);
  } finally {
    await handle.close();
    await rm(appDir, { recursive: true, force: true });
  }
});

test('HTTP MCP does not treat a configured host and arbitrary port as equivalent', async () => {
  const appDir = await mkdtemp(join(tmpdir(), 'trachex-mcp-host-'));
  const db = openDatabase({ path: join(appDir, 'trachex.db') });
  migrate(db);
  await createProject(new SqliteUnitOfWork(db), { slug: 'demo', name: 'Demo' });
  db.close();
  const handle = await startMcpHttpServer({
    projectSlug: 'demo',
    appDir,
    port: 0,
    token: 'test-token',
    allowedHosts: ['127.0.0.1:443'],
  });
  try {
    const response = await fetch(`http://127.0.0.1:${handle.port}/mcp`, {
      method: 'POST',
      headers: {
        Authorization: 'Bearer test-token',
        Host: '127.0.0.1:8443',
        Accept: 'application/json, text/event-stream',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: {} }),
    });
    assert.equal(response.status, 403);
  } finally {
    await handle.close();
    await rm(appDir, { recursive: true, force: true });
  }
});
