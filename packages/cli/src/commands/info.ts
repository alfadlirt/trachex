import type { AppContext } from '../app.ts';
import { readGlobalConfig } from '../context.ts';
import { print, printJson } from '../io.ts';

export async function info(ctx: AppContext, args: { json: boolean }) {
  const config = readGlobalConfig(ctx.appDir);
  const projectSlug = config.activeProject;
  const subjectId = config.activeSubject;
  let project: { id: string; name: string } | null = null;
  let subject: { id: string; name: string; projectId: string } | null = null;

  if (projectSlug) {
    project = await ctx.uow.projects.findBySlug(projectSlug);
  }
  if (subjectId) {
    subject = await ctx.uow.subjects.findById(subjectId);
    if (subject && project && subject.projectId !== project.id) {
      subject = null;
    }
  }

  if (args.json) {
    printJson({
      project: project ? { slug: projectSlug, name: project.name } : null,
      subject: subject ? { id: subject.id, name: subject.name } : null,
      theme: config.theme ?? { mode: 'auto' },
    });
    return;
  }
  print(`active project: ${project ? `${projectSlug} (${project.name})` : '(none)'}`);
  print(`active subject: ${subject ? `${subject.name} (${subject.id})` : '(none)'}`);
  print(`theme: ${JSON.stringify(config.theme ?? { mode: 'auto' })}`);
}
