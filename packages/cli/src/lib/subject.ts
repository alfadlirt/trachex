import { NotFoundError, type Subject, type UnitOfWork } from '@trachex/domain';

export function slugifyName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

export async function resolveSubject(
  uow: UnitOfWork,
  value: string,
  projectSlug?: string,
): Promise<Subject> {
  const byId = await uow.subjects.findById(value);
  if (byId) {
    if (projectSlug) {
      const project = await uow.projects.findById(byId.projectId);
      if (!project || project.slug !== projectSlug) {
        throw new NotFoundError('subject', value);
      }
    }
    return byId;
  }
  if (projectSlug) {
    const project = await uow.projects.findBySlug(projectSlug);
    if (!project) throw new NotFoundError('project', projectSlug);
    const byName = await uow.subjects.findByProjectAndName(project.id, value);
    if (byName) return byName;
    const subjects = await uow.subjects.listByProject(project.id);
    const bySlug = subjects.find((s) => slugifyName(s.name) === value.toLowerCase());
    if (bySlug) return bySlug;
    throw new NotFoundError('subject', value);
  }
  // No project scope: search across projects by exact name, then slug.
  const projects = await uow.projects.list();
  const nameMatches: Subject[] = [];
  const slugMatches: Subject[] = [];
  for (const project of projects) {
    const byName = await uow.subjects.findByProjectAndName(project.id, value);
    if (byName) nameMatches.push(byName);
    const subjects = await uow.subjects.listByProject(project.id);
    for (const s of subjects) {
      if (slugifyName(s.name) === value.toLowerCase() && !nameMatches.includes(s)) {
        slugMatches.push(s);
      }
    }
  }
  const all = [...nameMatches, ...slugMatches];
  if (all.length === 1) return all[0] as Subject;
  throw new NotFoundError('subject', value);
}

export async function resolveSubjectTicket(
  uow: UnitOfWork,
  value: string,
  projectSlug?: string,
) {
  const subject = await resolveSubject(uow, value, projectSlug);
  const ticket = await uow.tickets.findById(subject.id);
  if (!ticket) throw new NotFoundError('ticket', subject.id);
  return { subject, ticket };
}
