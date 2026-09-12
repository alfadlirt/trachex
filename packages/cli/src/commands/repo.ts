import {
  attachRepositoryToSubject,
  detachRepositoryFromSubject,
  NotFoundError,
  registerRepository,
  removeRepository,
  type UnitOfWork,
} from '@trachex/domain';
import type { AppContext } from '../app.ts';
import { print, printJson } from '../io.ts';
import { resolveSubject } from '../lib/subject.ts';

export async function repoAdd(
  uow: UnitOfWork,
  args: { name: string; path: string; project?: string; json?: boolean },
) {
  let projectId: string | undefined;
  if (args.project) {
    const project = await uow.projects.findBySlug(args.project);
    if (!project) {
      throw new NotFoundError('project', args.project);
    }
    projectId = project.id;
  }
  await registerRepository(uow, {
    slug: args.name,
    path: args.path,
    ...(projectId ? { projectId } : {}),
  });
  if (args.json) {
    const repo = await uow.repositories.findByProjectAndSlug(projectId ?? '', args.name);
    printJson(repo ?? { slug: args.name, path: args.path });
  } else
    print(
      projectId
        ? `repository ${args.name} registered for project ${args.project}`
        : `repository ${args.name} registered globally`,
    );
}

export async function repoList(uow: UnitOfWork, args: { json: boolean }) {
  const repos = await uow.repositories.listGlobal();
  if (args.json) {
    printJson(repos);
    return;
  }
  if (repos.length === 0) {
    print('(no repositories registered)');
    return;
  }
  for (const repo of repos) {
    const paths = await uow.repositories.listPaths(repo.id);
    const path = paths.at(-1)?.path ?? '(no path)';
    print(`${repo.id}  ${repo.slug}  ${path}`);
  }
}

export async function repoRemove(uow: UnitOfWork, args: { id: string; json?: boolean }) {
  await removeRepository(uow, args.id);
  if (args.json) printJson({ id: args.id, status: 'removed' });
  else print(`removed repository ${args.id}`);
}

export async function subjectRepoList(
  uow: UnitOfWork,
  args: { subjectId: string; project?: string; json: boolean },
) {
  const subject = await resolveSubject(uow, args.subjectId, args.project);
  const repos = await uow.repositories.listBySubject(subject.id);
  if (args.json) {
    printJson(repos);
    return;
  }
  if (repos.length === 0) {
    print(`(no repositories assigned to subject ${subject.name})`);
    return;
  }
  for (const repo of repos) {
    print(`${repo.id}  ${repo.slug}`);
  }
}

export async function subjectRepoAdd(
  ctx: AppContext,
  args: { subjectId: string; project?: string; repoId: string; json?: boolean },
) {
  const subject = await resolveSubject(ctx.uow, args.subjectId, args.project);
  await attachRepositoryToSubject(ctx.uow, subject.id, args.repoId);
  if (args.json)
    printJson({ subjectId: subject.id, repositoryId: args.repoId, status: 'assigned' });
  else print(`assigned repository ${args.repoId} to subject ${subject.id}`);
}

export async function subjectRepoRemove(
  ctx: AppContext,
  args: { subjectId: string; project?: string; repoId: string; json?: boolean },
) {
  const subject = await resolveSubject(ctx.uow, args.subjectId, args.project);
  await detachRepositoryFromSubject(ctx.uow, subject.id, args.repoId);
  if (args.json) printJson({ subjectId: subject.id, repositoryId: args.repoId, status: 'removed' });
  else print(`removed repository ${args.repoId} from subject ${subject.id}`);
}
