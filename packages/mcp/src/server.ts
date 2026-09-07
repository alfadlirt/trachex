import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import {
  CallToolRequestSchema,
  type CallToolResult,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import type { RunAgentFn } from '@trachex/agent';
import { NotFoundError } from '@trachex/domain';
import { getTool, type ToolContext, tools } from './tools.ts';

export interface McpServerDeps {
  appDir: string;
  projectSlug: string;
  projectId: string;
  uow: ToolContext['uow'];
  runAgent: RunAgentFn;
}

export function handleToolCall(
  ctx: ToolContext,
  name: string,
  args: unknown,
): Promise<CallToolResult> {
  const tool = getTool(name);
  if (!tool) {
    return Promise.resolve({
      isError: true,
      content: [
        {
          type: 'text' as const,
          text: JSON.stringify({ code: 'UNKNOWN_TOOL', message: `unknown tool: ${name}` }),
        },
      ],
    } as CallToolResult);
  }
  return Promise.resolve()
    .then(() => tool.inputSchema.parse(args ?? {}))
    .then((parsed) => tool.handler(ctx, parsed))
    .then(
      (result) =>
        ({
          isError: false,
          content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
        }) as CallToolResult,
    )
    .catch(
      (error) =>
        ({
          isError: true,
          content: [
            {
              type: 'text' as const,
              text: JSON.stringify({ code: errorCode(error), message: errorMessage(error) }),
            },
          ],
        }) as CallToolResult,
    );
}

export function createMcpServer(deps: McpServerDeps) {
  const server = new Server(
    { name: 'trachex-mcp', version: '0.1.0' },
    { capabilities: { tools: {} } },
  );

  const ctx: ToolContext = {
    uow: deps.uow,
    appDir: deps.appDir,
    projectId: deps.projectId,
    projectSlug: deps.projectSlug,
    runAgent: deps.runAgent,
  };

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
    })),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request, _extra) => {
    const { name, arguments: args } = request.params;
    return handleToolCall(ctx, name, args);
  });

  return server;
}

function errorCode(error: unknown): string {
  if (error instanceof NotFoundError) return 'NOT_FOUND';
  if (error instanceof Error && 'code' in error) {
    const code = (error as { code?: string }).code;
    if (code) return code;
  }
  if (error instanceof Error && error.name === 'ZodError') return 'INVALID_INPUT';
  return 'INTERNAL';
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
