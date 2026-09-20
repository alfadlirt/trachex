import type { Impact } from './api.ts';

export function uniqueTicketImpacts(impacts: readonly Impact[]): Impact[] {
  const seen = new Map<Impact['kind'], Set<string>>();
  const unique: Impact[] = [];

  for (const impact of impacts) {
    const value = impact.value.trim();
    const values = seen.get(impact.kind);
    if (values?.has(value)) continue;
    if (values) values.add(value);
    else seen.set(impact.kind, new Set([value]));
    unique.push({ ...impact, value });
  }

  return unique;
}
