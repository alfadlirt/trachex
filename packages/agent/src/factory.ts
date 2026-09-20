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
  outputSchema: z.ZodSchema<unknown>;
}) => Promise<unknown>;

export function createSearchTool(search: SearchRepository) {
  return createTool({
    name: 'search_context',
    description:
      'Search ingested project context (sources, notes, documents) using verified lexical retrieval and return chunk text with provenance. Semantic vector retrieval is not enabled yet.',
    inputSchema: z.object({
      query: z.string().min(1),
      projectId: z.string().min(1),
      limit: z.number().int().min(1).max(20).optional(),
    }),
    execute: async (input): Promise<SearchResult[]> => {
      return search.search(input.query, input.projectId, input.limit ?? 10);
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
  const outcome = await agent.generate({ prompt: input.prompt });
  if (outcome.type !== 'response') {
    throw new Error(`agent did not produce a response: ${outcome.type}`);
  }
  return outcome.output;
}
