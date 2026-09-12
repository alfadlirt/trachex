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
import { confirmIfInteractive, print, printJson } from '../io.ts';

export async function projectCreate(
  ctx: AppContext,
  args: { slug: string; name: string; json?: boolean },
) {
  const result = await createProject(ctx.uow, { slug: args.slug, name: args.name });
  if (args.json) {
    printJson({ id: result.id, slug: result.slug });
    return;
  }
  const activate = await confirmIfInteractive(`Set project ${result.slug} as active?`);
  if (activate) {
    const config = readGlobalConfig(ctx.appDir);
    const { activeSubject: _activeSubject, ...withoutSubject } = config;
    void _activeSubject;
    writeGlobalConfig({ ...withoutSubject, activeProject: result.slug }, ctx.appDir);
  }
  print(`Created project ${args.name}`);
  print(`  slug: ${result.slug}`);
  print(`  id: ${result.id}`);
  print(`  active: ${activate === true ? 'yes' : 'no'}`);
  if (activate !== true) print(`Next: project use ${result.slug}`);
  print(`Next: subject new --project ${result.slug} --name <name>`);
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

export async function projectList(uow: UnitOfWork, args: { json: boolean }) {
  const projects = await uow.projects.list();
  if (args.json) {
    printJson(projects);
    return;
  }
  if (projects.length === 0) print('(no projects)');
  for (const project of projects) print(`${project.slug}  ${project.name}  (${project.id})`);
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
