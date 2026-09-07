import type { Message } from '@anvia/core';
import type { MemoryScope, MemoryStore } from '@anvia/core/memory';
import { newId, nowIso } from '@trachex/domain';
import type Database from 'better-sqlite3';

export interface MemoryStoreOptions {
  db: Database.Database;
  tablePrefix?: string;
}

const DEFAULT_TABLES = {
  sessions: 'sessions',
  messages: 'messages',
  errors: 'errors',
};

type StoredRole = 'system' | 'user' | 'assistant';

export class BetterSqliteMemoryStore implements MemoryStore {
  private readonly db: Database.Database;
  private readonly messagesTable: string;
  private readonly errorsTable: string;

  constructor(options: MemoryStoreOptions) {
    this.db = options.db;
    const prefix = options.tablePrefix ? `${options.tablePrefix}_` : '';
    this.messagesTable = `${prefix}${DEFAULT_TABLES.messages}`;
    this.errorsTable = `${prefix}${DEFAULT_TABLES.errors}`;
  }

  async load(options: { scope: MemoryScope }): Promise<Message[]> {
    const sessionId = options.scope.sessionId;
    const rows = this.db
      .prepare(
        `SELECT role, content FROM ${this.messagesTable} WHERE session_id = ? ORDER BY created_at`,
      )
      .all(sessionId) as { role: string; content: string }[];
    return rows.map((row): Message => {
      const role = row.role as StoredRole;
      if (role === 'user') {
        return { role: 'user', content: row.content };
      }
      if (role === 'assistant') {
        return { role: 'assistant', content: row.content };
      }
      return { role: 'system', content: row.content };
    });
  }

  async append(options: {
    scope: MemoryScope;
    runId: string;
    turn: number;
    messages: Message[];
  }): Promise<void> {
    const sessionId = options.scope.sessionId;
    const insert = this.db.prepare(
      `INSERT INTO ${this.messagesTable} (id, session_id, role, content, created_at) VALUES (?, ?, ?, ?, ?)`,
    );
    const now = nowIso();
    for (const message of options.messages) {
      insert.run(newId(), sessionId, message.role, textContentOf(message), now);
    }
  }

  async clear(options: { scope: MemoryScope }): Promise<void> {
    this.db
      .prepare(`DELETE FROM ${this.messagesTable} WHERE session_id = ?`)
      .run(options.scope.sessionId);
  }

  async recordError(options: { scope: MemoryScope; error: unknown }): Promise<void> {
    const message = options.error instanceof Error ? options.error.message : String(options.error);
    this.db
      .prepare(
        `INSERT INTO ${this.errorsTable} (id, session_id, message, created_at) VALUES (?, ?, ?, ?)`,
      )
      .run(newId(), options.scope.sessionId, message, nowIso());
  }
}

function textContentOf(message: Message): string {
  const content = message.content;
  if (typeof content === 'string') {
    return content;
  }
  if (Array.isArray(content)) {
    return JSON.stringify(content);
  }
  return String(content);
}
