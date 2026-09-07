import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveBundledDashboardDist } from '@trachex/shared';

export { resolveBundledDashboardDist };

export function resolveComposeFile(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  const candidates = [
    join(here, '..', '..', '..', 'docker-compose.dev.yml'),
    join(here, '..', 'docker-compose.dev.yml'),
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }
  return join(here, '..', '..', '..', 'docker-compose.dev.yml');
}
