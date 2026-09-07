import { mkdirSync } from 'node:fs';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import type { RunAgentFn } from '@trachex/agent';
import { trachexAppDir } from '@trachex/shared';
import { migrate, openDatabase, SqliteUnitOfWork } from '@trachex/storage-sqlite';
import { createMcpServer } from './server.ts';

export interface RunMcpInput {
  projectSlug: string;
  appDir?: string;
  runAgent?: RunAgentFn;
}

export async function runMcpServer(input: RunMcpInput): Promise<void> {
  const appDir = input.appDir ?? trachexAppDir();
  mkdirSync(appDir, { recursive: true });
  const db = openDatabase({ path: `${appDir}/trachex.db` });
  migrate(db);
  const uow = new SqliteUnitOfWork(db);

  const project = await uow.projects.findBySlug(input.projectSlug);
  if (!project) {
    throw new Error(`project not found: ${input.projectSlug}`);
  }

  const server = createMcpServer({
    appDir,
    projectSlug: input.projectSlug,
    projectId: project.id,
    uow,
    runAgent:
      input.runAgent ??
      (() => {
        throw new Error('no agent configured for MCP add_adjustment');
      }),
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
}
