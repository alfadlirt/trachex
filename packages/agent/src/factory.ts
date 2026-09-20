import { Agent, type AgentMemoryOptions, createTool } from '@anvia/core';
import type { AgentObservabilityOptions } from '@anvia/core/observability';
import { OpenAIClient } from '@anvia/openai';
import type { SearchRepository, SearchResult } from '@trachex/domain';
import { z } from 'zod';
import type { ProviderConfig } from './provider.ts';

export interface AgentDeps {
  provider: ProviderConfig;
  search: SearchRepository;
  observability?: AgentObservabilityOptions | undefined;
  memory?: AgentMemoryOptions | undefined;
}

export type RunAgentFn = (input: {
  instructions: string;
  userContent: string;
  projectId?: string;
  subjectId?: string;
  outputSchema: z.ZodSchema<unknown>;
}) => Promise<unknown>;

export function createSearchTool(search: SearchRepository) {
  return createTool({
    name: 'vectorSearch',
    description:
      'Search indexed project context and return chunk text with provenance. Uses semantic retrieval when configured and an explicit lexical fallback when it is unavailable.',
    inputSchema: z.object({
      query: z.string().min(1),
      projectId: z.string().min(1),
      limit: z.number().int().min(1).max(20).optional(),
      subjectId: z.string().min(1).optional(),
    }),
    execute: async (input): Promise<SearchResult[]> => {
      return search.search(input.query, input.projectId, input.limit ?? 10, input.subjectId);
    },
  });
}

export function createTrachexAgent(
  deps: AgentDeps,
  instructions: string,
  outputSchema: z.ZodSchema<unknown>,
): Agent<unknown> {
  const client = new OpenAIClient({
    baseUrl: deps.provider.baseUrl,
    ...(deps.provider.apiKey !== null ? { apiKey: deps.provider.apiKey } : {}),
  });
  const model = client.completionModel({ modelId: deps.provider.modelId });
  return new Agent({
    id: 'trachex',
    name: 'Trachex',
    model,
    instructions,
    outputSchema,
    tools: [createSearchTool(deps.search)],
    maxTurns: 5,
    observability: deps.observability,
    memory: deps.memory,
  });
}

export async function runAgentWithSchema(
  agent: Agent<unknown>,
  input: { prompt: string },
): Promise<unknown> {
  // Use the same streaming provider path as the verified gateway integration.
  const stream = agent.stream({ prompt: input.prompt });
  for await (const _event of stream) {
    // Drain the stream so tool calls and the final structured response execute.
  }
  const outcome = await stream.result;
  if (outcome.type !== 'response') {
    throw new Error(`agent did not produce a response: ${outcome.type}`);
  }
  return outcome.output;
}
