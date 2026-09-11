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

export async function repoAdd(
  uow: UnitOfWork,
  args: { name: string; path: string; project?: string },
) {
  await registerRepository(uow, {
    slug: args.name,
    path: args.path,
    ...(args.project ? { projectId: args.project } : {}),
  });
  print(`repository ${args.name} registered globally`);
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

export async function repoRemove(uow: UnitOfWork, args: { id: string }) {
  await removeRepository(uow, args.id);
  print(`removed repository ${args.id}`);
}

export async function subjectRepoList(uow: UnitOfWork, args: { subjectId: string; json: boolean }) {
  const subject = await uow.subjects.findById(args.subjectId);
  if (!subject) {
    throw new NotFoundError('subject', args.subjectId);
  }
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

export async function subjectRepoAdd(ctx: AppContext, args: { subjectId: string; repoId: string }) {
  await attachRepositoryToSubject(ctx.uow, args.subjectId, args.repoId);
  print(`assigned repository ${args.repoId} to subject ${args.subjectId}`);
}

export async function subjectRepoRemove(
  ctx: AppContext,
  args: { subjectId: string; repoId: string },
) {
  await detachRepositoryFromSubject(ctx.uow, args.subjectId, args.repoId);
  print(`removed repository ${args.repoId} from subject ${args.subjectId}`);
}
