import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import process from 'node:process';
import { test } from 'node:test';
import { createProject } from '@trachex/domain';
import { migrate, openDatabase, SqliteUnitOfWork } from '@trachex/storage-sqlite';

const entrypoint = decodeURIComponent(
  new URL('../../trachex/bin/trachex.mjs', import.meta.url).pathname,
);

test('the published stdio command completes initialize and tools/list before disconnect', async () => {
  const appDir = await mkdtemp(join(process.env.TMPDIR ?? '/tmp', 'trachex-mcp-'));
  const env = { ...process.env, TRACHEX_HOME: appDir };
  try {
    const db = openDatabase({ path: join(appDir, 'trachex.db') });
    migrate(db);
    await createProject(new SqliteUnitOfWork(db), { slug: 'demo', name: 'Demo' });
    db.close();

    const child = spawn(process.execPath, [entrypoint, 'mcp', '--project', 'demo'], {
      env,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    const output = readFrames(child.stdout);
    let stderr = '';
    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });
    child.stdin.write(
      frame({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2025-06-18',
          capabilities: {},
          clientInfo: { name: 'test', version: '1' },
        },
      }),
    );
    const initialize = await output.next();
    assert.equal(initialize.done, false, stderr);
    assert.equal(initialize.value.id, 1);
    child.stdin.write(frame({ jsonrpc: '2.0', method: 'notifications/initialized' }));
    child.stdin.write(frame({ jsonrpc: '2.0', id: 2, method: 'tools/list', params: {} }));
    const listed = await output.next();
    assert.equal(child.exitCode, null, 'MCP process must remain alive while stdin is open');
    assert.equal(listed.value.id, 2);
    assert.ok(listed.value.result.tools.length >= 11);

    child.stdin.end();
    const [exitCode] = await once(child, 'exit');
    assert.equal(exitCode, 0);
  } finally {
    await rm(appDir, { recursive: true, force: true });
  }
});

test('invalid project startup reports diagnostics on stderr only', async () => {
  const appDir = await mkdtemp(join(process.env.TMPDIR ?? '/tmp', 'trachex-mcp-invalid-'));
  try {
    const child = spawn(process.execPath, [entrypoint, 'mcp', '--project', 'missing'], {
      env: { ...process.env, TRACHEX_HOME: appDir },
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (chunk) => (stdout += chunk.toString()));
    child.stderr.on('data', (chunk) => (stderr += chunk.toString()));
    const [exitCode] = await once(child, 'exit');
    assert.notEqual(exitCode, 0);
    assert.equal(stdout, '');
    assert.match(stderr, /project not found/);
  } finally {
    await rm(appDir, { recursive: true, force: true });
  }
});

function frame(message: unknown): string {
  return `${JSON.stringify(message)}\n`;
}

interface JsonRpcFrame {
  id?: number;
  result?: { tools: Array<unknown> };
}

async function* readFrames(stream: NodeJS.ReadableStream): AsyncGenerator<JsonRpcFrame> {
  let buffer = '';
  for await (const chunk of stream) {
    buffer += chunk.toString();
    while (true) {
      const end = buffer.indexOf('\n');
      if (end < 0) break;
      const body = buffer.slice(0, end);
      buffer = buffer.slice(end + 1);
      yield JSON.parse(body) as JsonRpcFrame;
    }
  }
}
