import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { trachexAppDir } from '@trachex/shared';
import { CliError } from './errors.ts';

export interface GlobalConfig {
  activeProject?: string;
}

export function readGlobalConfig(appDir = trachexAppDir()): GlobalConfig {
  const path = join(appDir, 'config.json');
  if (!existsSync(path)) {
    return {};
  }
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as GlobalConfig;
  } catch {
    return {};
  }
}

export function writeGlobalConfig(config: GlobalConfig, appDir = trachexAppDir()): void {
  mkdirSync(appDir, { recursive: true });
  writeFileSync(join(appDir, 'config.json'), JSON.stringify(config, null, 2));
}

export function resolveProjectSlug(input: { explicit?: string; appDir?: string }): string {
  if (input.explicit && input.explicit.length > 0) {
    return input.explicit;
  }
  const config = readGlobalConfig(input.appDir);
  if (config.activeProject) {
    return config.activeProject;
  }
  throw new CliError(
    'no project selected: pass --project <slug> or run `trachex project use <slug>`',
    3,
    'NO_PROJECT',
  );
}
