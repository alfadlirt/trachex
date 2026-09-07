import { isRecord } from '@trachex/shared';

export const cliName = 'trachex';

export function isKnownCliArg(value: unknown): boolean {
  return isRecord(value) && typeof value.project === 'string';
}
