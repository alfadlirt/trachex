import { createSubject, NotFoundError, type Subject, type UnitOfWork } from '@trachex/domain';
import type { AppContext } from '../app.ts';
import { readGlobalConfig, writeGlobalConfig } from '../context.ts';
import { CliError } from '../errors.ts';
import { print, printJson } from '../io.ts';

export async function subjectNew(
  uow: UnitOfWork,
  args: { project: string; name: string; description?: string },
) {
  const project = await uow.projects.findBySlug(args.project);
  if (!project) {
    throw new NotFoundError('project', args.project);
  }
  const subject = await createSubject(uow, {
    projectId: project.id,
    name: args.name,
    ...(args.description !== undefined ? { description: args.description } : {}),
  });
  printJson({ id: subject.id, projectSlug: args.project, name: subject.name });
}

export async function subjectList(uow: UnitOfWork, args: { project: string; json: boolean }) {
  const project = await uow.projects.findBySlug(args.project);
  if (!project) {
    throw new NotFoundError('project', args.project);
  }
  const subjects = await uow.subjects.listByProject(project.id);
  if (args.json) {
    printJson(subjects);
    return;
  }
  if (subjects.length === 0) {
    print(`(no subjects in project ${args.project})`);
    return;
  }
  for (const subject of subjects) {
    print(`${subject.id}  ${subject.name}`);
  }
}

export async function subjectShow(uow: UnitOfWork, args: { id: string; json: boolean }) {
  const subject = await uow.subjects.findById(args.id);
  if (!subject) {
    throw new NotFoundError('subject', args.id);
  }
  const project = await uow.projects.findById(subject.projectId);
  if (args.json) {
    printJson({ subject, project: project ? { slug: project.slug, name: project.name } : null });
    return;
  }
  print(`id: ${subject.id}`);
  print(`name: ${subject.name}`);
  print(`project: ${project?.slug ?? subject.projectId}`);
  if (subject.description) {
    print(`description: ${subject.description}`);
  }
}

export async function subjectUse(
  ctx: AppContext,
  args: { id?: string; project?: string; clear: boolean },
) {
  if (args.clear) {
    const config = readGlobalConfig(ctx.appDir);
    const { activeSubject: _drop, ...rest } = config;
    void _drop;
    writeGlobalConfig(rest, ctx.appDir);
    print('active subject cleared');
    return;
  }
  if (!args.id) {
    throw new CliError('subject use requires <subject-id> or --clear', 2, 'USAGE');
  }
  const subject = await ctx.uow.subjects.findById(args.id);
  if (!subject) {
    throw new NotFoundError('subject', args.id);
  }
  const project = await ctx.uow.projects.findById(subject.projectId);
  if (!project) {
    throw new NotFoundError('project', subject.projectId);
  }
  if (args.project && args.project !== project.slug) {
    throw new CliError(
      `subject ${args.id} belongs to project ${project.slug}, not ${args.project}`,
      2,
      'USAGE',
    );
  }
  const config = readGlobalConfig(ctx.appDir);
  writeGlobalConfig(
    { ...config, activeProject: project.slug, activeSubject: subject.id },
    ctx.appDir,
  );
  print(`active subject: ${subject.name} (${project.slug})`);
}

export type { Subject };
