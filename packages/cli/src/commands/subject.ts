import {
  buildChecklistView,
  buildExportSummary,
  checkRequirement,
  createSubject,
  NotFoundError,
  permanentlyDeleteSubject,
  type Subject,
  type UnitOfWork,
} from '@trachex/domain';
import type { AppContext } from '../app.ts';
import { readGlobalConfig, writeGlobalConfig } from '../context.ts';
import { CliError } from '../errors.ts';
import { print, printJson } from '../io.ts';
import { writeFileSync } from 'node:fs';
import { serializeJson, serializeMarkdown } from '../export.ts';
import { resolveSubject, resolveSubjectTicket } from '../lib/subject.ts';

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

export async function subjectShow(uow: UnitOfWork, args: { id: string; project?: string; json: boolean }) {
  const subject = await resolveSubject(uow, args.id, args.project);
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

async function subjectTicket(ctx: AppContext, id: string, project?: string) {
  return resolveSubjectTicket(ctx.uow, id, project);
}

export async function subjectChecklist(
  ctx: AppContext,
  args: { id: string; project?: string; json: boolean },
) {
  const { subject, ticket } = await subjectTicket(ctx, args.id, args.project);
  const view = await buildChecklistView(ctx.uow, {
    projectId: subject.projectId,
    ticketKey: ticket.key,
  });
  if (args.json) {
    printJson(view);
    return;
  }
  print(`Checklist: ${subject.name}`);
  for (const group of view.groups) {
    print(`# ${group.label}`);
    for (const item of group.items) {
      print(`  ${item.devStatus === 'checked' ? '[x]' : '[ ]'} ${item.title}`);
    }
  }
  if (view.superseded.length > 0) {
    print('');
    print('# Superseded');
    for (const entry of view.superseded) {
      const by = entry.supersededByTitle ? ` (superseded by ${entry.supersededByTitle})` : '';
      print(`  ~~${entry.item.title}~~${by}`);
      for (const impact of entry.item.impacts) print(`      ${impact.kind}:${impact.value}`);
    }
  }
}

export async function subjectCheck(
  ctx: AppContext,
  args: { id: string; project?: string; requirementId: string; yes?: boolean },
) {
  const { ticket } = await subjectTicket(ctx, args.id, args.project);
  const requirement = await ctx.uow.requirements.findById(args.requirementId);
  if (!requirement) throw new NotFoundError('requirement', args.requirementId);
  if (requirement.ticketId !== ticket.id) {
    throw new CliError('requirement does not belong to the given subject', 2, 'USAGE');
  }
  if (!args.yes) {
    const { confirm } = await import('../io.ts');
    if (!(await confirm(`Mark requirement ${requirement.id} (${requirement.title}) as complete?`))) {
      printJson({ id: requirement.id, status: 'aborted' });
      return;
    }
  }
  const audit = await checkRequirement(ctx.uow, { requirementId: requirement.id, actorType: 'human' });
  printJson({ id: requirement.id, status: 'checked', audit });
}

export async function subjectExport(
  ctx: AppContext,
  args: { id: string; project?: string; format: 'markdown' | 'json'; out?: string },
) {
  const { subject, ticket } = await subjectTicket(ctx, args.id, args.project);
  const summary = await buildExportSummary(ctx.uow, {
    projectId: subject.projectId,
    ticketKey: ticket.key,
  });
  const output = args.format === 'json' ? serializeJson(summary) : serializeMarkdown(summary);
  if (args.out) {
    writeFileSync(args.out, output);
    print(`export written: ${args.out}`);
  } else {
    process.stdout.write(`${output}\n`);
  }
}

export async function subjectDelete(
  ctx: AppContext,
  args: { id: string; project?: string; force: boolean; confirmName?: string },
) {
  const subject = await resolveSubject(ctx.uow, args.id, args.project);
  if (!subject) throw new NotFoundError('subject', args.id);
  if (!args.force) throw new CliError('permanent subject deletion requires --force', 2, 'USAGE');
  if (args.confirmName !== subject.name) {
    throw new CliError(
      'permanent subject deletion requires --confirm-name <exact subject name>',
      2,
      'USAGE',
    );
  }
  await permanentlyDeleteSubject(ctx.uow, subject.id, true);
  print(`Subject permanently deleted: ${subject.name}`);
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
  const subject = await resolveSubject(ctx.uow, args.id, args.project);
  const project = await ctx.uow.projects.findById(subject.projectId);
  if (!project) {
    throw new NotFoundError('project', subject.projectId);
  }
  const config = readGlobalConfig(ctx.appDir);
  writeGlobalConfig(
    { ...config, activeProject: project.slug, activeSubject: subject.id },
    ctx.appDir,
  );
  print(`active subject: ${subject.name} (${project.slug})`);
}

export type { Subject };
