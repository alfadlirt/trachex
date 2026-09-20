import type { AgentObservabilityOptions, AgentObserver } from '@anvia/core/observability';
import { LensClient } from '@anvia/lens';
import { createConsoleLogger, createLoggerObserver } from '@anvia/logger';

export interface ObservabilityEnv {
  ANVIA_LENS_ENABLED?: string;
  ANVIA_LENS_API_URL?: string;
  ANVIA_LENS_BASE_URL?: string;
  ANVIA_LENS_PUBLIC_KEY?: string;
  ANVIA_LENS_SECRET_KEY?: string;
  ANVIA_LENS_SERVICE_NAME?: string;
}

export function buildObservability(
  env: ObservabilityEnv = process.env,
): AgentObservabilityOptions | undefined {
  const observers: Record<string, AgentObserver> = {};

  if (env.ANVIA_LENS_ENABLED === 'true' || env.ANVIA_LENS_ENABLED === '1') {
    const client = new LensClient({
      baseUrl: env.ANVIA_LENS_API_URL ?? env.ANVIA_LENS_BASE_URL,
      publicKey: env.ANVIA_LENS_PUBLIC_KEY,
      secretKey: env.ANVIA_LENS_SECRET_KEY,
      serviceName: env.ANVIA_LENS_SERVICE_NAME ?? 'trachex',
    });
    observers.lens = client.observer();
  }

  if (Object.keys(observers).length === 0) {
    return undefined;
  }
  return {
    observers,
    primaryTrace: Object.keys(observers)[0] as string,
    errorPolicy: 'ignore',
  };
}

export function buildConsoleObservability(): AgentObservabilityOptions {
  return {
    observers: {
      console: createLoggerObserver({ logger: createConsoleLogger() }),
    },
    primaryTrace: 'console',
    errorPolicy: 'ignore',
  };
}
