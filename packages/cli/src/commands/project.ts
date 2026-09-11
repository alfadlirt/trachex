import {
  createProject,
  NotFoundError,
  permanentlyDeleteProject,
  registerRepository,
  type UnitOfWork,
} from '@trachex/domain';
import { exportProjectArchive } from '@trachex/storage-sqlite';
import type { AppContext } from '../app.ts';
import { readGlobalConfig, writeGlobalConfig } from '../context.ts';
import { CliError } from '../errors.ts';
import { print, printJson } from '../io.ts';

export async function projectCreate(uow: UnitOfWork, args: { slug: string; name: string }) {
  const result = await createProject(uow, { slug: args.slug, name: args.name });
  printJson({ id: result.id, slug: result.slug });
}

export async function projectUse(ctx: AppContext, args: { slug: string }) {
  const project = await ctx.uow.projects.findBySlug(args.slug);
  if (!project) {
    throw new NotFoundError('project', args.slug);
  }
  const config = readGlobalConfig(ctx.appDir);
  let activeSubject = config.activeSubject;
  if (activeSubject) {
    const subject = await ctx.uow.subjects.findById(activeSubject);
    if (subject && subject.projectId !== project.id) {
      activeSubject = undefined;
    }
  }
  writeGlobalConfig(
    { ...config, activeProject: args.slug, ...(activeSubject ? { activeSubject } : {}) },
    ctx.appDir,
  );
  print(`active project: ${args.slug}`);
}

export async function projectList(uow: UnitOfWork) {
  const projects = await uow.projects.list();
  printJson(projects);
}

export async function projectDelete(
  ctx: AppContext,
  args: { slug: string; force: boolean; confirmName?: string },
) {
  const project = await ctx.uow.projects.findBySlug(args.slug, true);
  if (!project) throw new NotFoundError('project', args.slug);
  if (!args.force) throw new CliError('permanent project deletion requires --force', 2, 'USAGE');
  if (args.confirmName !== project.name) {
    throw new CliError(
      'permanent project deletion requires --confirm-name <exact project name>',
      2,
      'USAGE',
    );
  }
  await permanentlyDeleteProject(ctx.uow, project.id, true);
  print(`Project permanently deleted: ${project.slug}`);
}

export async function repoAdd(
  uow: UnitOfWork,
  args: {
    project: string;
    name: string;
    path: string;
  },
) {
  const project = await uow.projects.findBySlug(args.project);
  if (!project) {
    throw new NotFoundError('project', args.project);
  }
  await registerRepository(uow, {
    projectId: project.id,
    slug: args.name,
    path: args.path,
  });
  print(`repository ${args.name} added to ${args.project}`);
}

export async function projectExport(ctx: AppContext, args: { slug: string; out: string }) {
  const project = await ctx.uow.projects.findBySlug(args.slug);
  if (!project) {
    throw new NotFoundError('project', args.slug);
  }
  const manifest = exportProjectArchive(ctx.db, {
    projectId: project.id,
    sourcesRoot: `${ctx.appDir}/projects/${project.id}/sources`,
    outDir: args.out,
  });
  print(`archive written: ${manifest}`);
}
