import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

function findWorkspaceRoot(start = dirname(fileURLToPath(import.meta.url))): string | null {
  let current = start;
  while (true) {
    if (existsSync(join(current, 'pnpm-workspace.yaml'))) return current;
    const parent = dirname(current);
    if (parent === current) return null;
    current = parent;
  }
}

function parseEnvFile(content: string): Record<string, string> {
  const values: Record<string, string> = {};
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const separator = line.indexOf('=');
    if (separator <= 0) continue;
    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if (
      value.length >= 2 &&
      ((value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'")))
    )
      value = value.slice(1, -1);
    values[key] = value;
  }
  return values;
}

export function loadTrachexEnv(
  env: NodeJS.ProcessEnv = process.env,
  workspaceRoot = findWorkspaceRoot() ?? process.cwd(),
): NodeJS.ProcessEnv {
  const path = join(workspaceRoot, '.env');
  if (!existsSync(path)) return env;
  for (const [key, value] of Object.entries(parseEnvFile(readFileSync(path, 'utf8')))) {
    if (env[key] === undefined) env[key] = value;
  }
  return env;
}
