import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { trachexAppDir } from '@trachex/shared';
import { CliError } from './errors.ts';

export type ThemeMode = 'auto' | 'dark' | 'light' | 'no-color';

export interface ThemeConfig {
  mode: ThemeMode;
  accent?: string;
}

export interface GlobalConfig {
  activeProject?: string;
  activeSubject?: string;
  theme?: ThemeConfig;
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

export interface Scope {
  projectSlug: string;
  subjectId?: string;
  subjectName?: string;
}

/**
 * Resolve project/subject scope with this precedence:
 * explicit argument → active selection from config.
 * A resolved subject is validated to belong to the resolved project.
 */
export async function resolveScope(input: {
  explicitProject?: string;
  explicitSubject?: string;
  appDir?: string;
  uow: {
    projects: {
      findBySlug(slug: string): Promise<{ id: string; name: string } | null>;
    };
    subjects: {
      findById(id: string): Promise<{ id: string; projectId: string; name: string } | null>;
    };
  };
}): Promise<Scope> {
  const config = readGlobalConfig(input.appDir);
  const projectSlug = input.explicitProject ?? config.activeProject;
  if (!projectSlug) {
    throw new CliError(
      'no project selected: pass --project <slug> or run `trachex project use <slug>`',
      3,
      'NO_PROJECT',
    );
  }
  const project = await input.uow.projects.findBySlug(projectSlug);
  if (!project) {
    throw new CliError(`project not found: ${projectSlug}`, 3, 'PROJECT_NOT_FOUND');
  }
  const subjectId = input.explicitSubject ?? config.activeSubject;
  if (!subjectId) {
    return { projectSlug };
  }
  const subject = await input.uow.subjects.findById(subjectId);
  if (!subject || subject.projectId !== project.id) {
    if (input.explicitSubject) {
      throw new CliError(`subject not found in project: ${subjectId}`, 3, 'SUBJECT_NOT_FOUND');
    }
    return { projectSlug };
  }
  return { projectSlug, subjectId: subject.id, subjectName: subject.name };
}

export function banner(scope: { projectName?: string; subjectName?: string } | undefined): string {
  if (!scope) return '';
  const parts: string[] = [];
  if (scope.projectName) parts.push(`Project: ${scope.projectName}`);
  if (scope.subjectName) parts.push(`Subject: ${scope.subjectName}`);
  return parts.length > 0 ? parts.join(' · ') : '';
}
