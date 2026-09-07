export type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function assertNever(_value: never, message = 'unreachable code path'): never {
  throw new Error(message);
}

export * from './paths.ts';
