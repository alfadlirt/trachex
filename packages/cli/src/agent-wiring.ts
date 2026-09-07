import { readFileSync } from 'node:fs';
import type { ProposalOutput } from '@trachex/agent';
import {
  buildObservability,
  createTrachexAgent,
  extractionOutputSchema,
  type RunAgentFn,
  reconciliationOutputSchema,
  resolveProviderConfig,
  runAgentWithSchema,
} from '@trachex/agent';
import type { SearchRepository } from '@trachex/domain';

export function buildRealRunAgent(input: {
  search: SearchRepository;
  env?: NodeJS.ProcessEnv;
}): RunAgentFn {
  const config = resolveProviderConfig(input.env ?? process.env);
  if (!config.apiKey) {
    throw new Error(
      'no provider API key configured: set OPENAI_API_KEY (or use --fixture <fixture.json>)',
    );
  }
  return async (args) => {
    const schema =
      args.outputSchema === extractionOutputSchema
        ? extractionOutputSchema
        : args.outputSchema === reconciliationOutputSchema
          ? reconciliationOutputSchema
          : args.outputSchema;
    const agent = createTrachexAgent(
      {
        provider: config,
        search: input.search,
        observability: buildObservability(input.env ?? process.env),
      },
      args.instructions,
      schema,
    );
    return runAgentWithSchema(agent, { prompt: args.userContent });
  };
}

export function buildFixtureRunAgent(fixturePath: string): RunAgentFn {
  const fixture = JSON.parse(readFileSync(fixturePath, 'utf8')) as ProposalOutput;
  return async () => fixture;
}

export function buildRunAgent(input: {
  search: SearchRepository;
  fixturePath?: string;
  env?: NodeJS.ProcessEnv;
}): RunAgentFn {
  if (input.fixturePath) {
    return buildFixtureRunAgent(input.fixturePath);
  }
  return buildRealRunAgent({
    search: input.search,
    ...(input.env !== undefined ? { env: input.env } : {}),
  });
}
