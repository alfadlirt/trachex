export async function retryTransientAgentCall<T>(run: () => Promise<T>, attempts = 3): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await run();
    } catch (error) {
      lastError = error;
      if (attempt === attempts || !isTransientGatewayError(error)) throw error;
      await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
    }
  }
  throw lastError;
}

function isTransientGatewayError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /502|503|504|cloudflare|bad gateway|origin server|retry_after|temporar/i.test(message);
}
