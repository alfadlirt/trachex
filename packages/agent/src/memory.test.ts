import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { migrate, openDatabase } from '@trachex/storage-sqlite';
import { BetterSqliteMemoryStore } from './memory.ts';

function openTempDb() {
  const dir = mkdtempSync(join(tmpdir(), 'trachex-mem-'));
  const db = openDatabase({ path: join(dir, 'mem.db') });
  migrate(db);
  return { db, dir };
}

test('memory store appends, loads, and clears messages', async () => {
  const { db, dir } = openTempDb();
  try {
    const store = new BetterSqliteMemoryStore({ db });
    const scope = { sessionId: 'session-1' };
    db.prepare(
      'INSERT INTO sessions (id, project_id, ticket_id, created_at, updated_at) VALUES (?, NULL, NULL, ?, ?)',
    ).run(scope.sessionId, new Date().toISOString(), new Date().toISOString());
    await store.append({
      scope,
      runId: 'run-1',
      turn: 1,
      messages: [
        { role: 'user', content: 'hello' },
        { role: 'assistant', content: 'hi' },
      ],
    });
    const messages = await store.load({ scope });
    assert.equal(messages.length, 2);
    assert.equal(messages[0]?.role, 'user');
    assert.equal(messages[0]?.content, 'hello');
    await store.clear({ scope });
    const after = await store.load({ scope });
    assert.equal(after.length, 0);
  } finally {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test('memory store records errors', async () => {
  const { db, dir } = openTempDb();
  try {
    const store = new BetterSqliteMemoryStore({ db });
    const scope = { sessionId: 'session-2' };
    db.prepare(
      'INSERT INTO sessions (id, project_id, ticket_id, created_at, updated_at) VALUES (?, NULL, NULL, ?, ?)',
    ).run(scope.sessionId, new Date().toISOString(), new Date().toISOString());
    await store.recordError({ scope, error: new Error('boom') });
    const row = db.prepare('SELECT message FROM errors WHERE session_id = ?').get('session-2') as
      | { message: string }
      | undefined;
    assert.equal(row?.message, 'boom');
  } finally {
    db.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
