import { homedir } from 'node:os';
import { join } from 'node:path';

export type Platform = 'darwin' | 'linux' | 'win32';

function detectPlatform(platform: NodeJS.Platform): Platform {
  switch (platform) {
    case 'darwin':
    case 'linux':
    case 'win32':
      return platform;
    default:
      return 'linux';
  }
}

export interface AppDirEnv {
  TRACHEX_HOME?: string;
  APPDATA?: string;
  HOME?: string;
  XDG_DATA_HOME?: string;
  platform?: NodeJS.Platform;
}

export function trachexAppDir(env: AppDirEnv = process.env): string {
  if (env.TRACHEX_HOME && env.TRACHEX_HOME.length > 0) {
    return env.TRACHEX_HOME;
  }
  const platform = detectPlatform(env.platform ?? process.platform);
  const home = env.HOME ?? homedir();
  switch (platform) {
    case 'darwin':
      return join(home, 'Library', 'Application Support', 'trachex');
    case 'win32':
      return join(env.APPDATA ?? home, 'trachex');
    default:
      return join(env.XDG_DATA_HOME ?? join(home, '.local', 'share'), 'trachex');
  }
}

export function projectDir(appDir: string, projectId: string): string {
  return join(appDir, 'projects', projectId);
}

export function sourcesDir(appDir: string, projectId: string): string {
  return join(projectDir(appDir, projectId), 'sources');
}

export function exportsDir(appDir: string, projectId: string): string {
  return join(projectDir(appDir, projectId), 'exports');
}

export function attachmentsDir(appDir: string, projectId: string): string {
  return join(projectDir(appDir, projectId), 'attachments');
}
