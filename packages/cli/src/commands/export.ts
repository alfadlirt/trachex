import { writeFileSync } from 'node:fs';
import { buildExportSummary, NotFoundError } from '@trachex/domain';
import type { AppContext } from '../app.ts';
import { serializeJson, serializeMarkdown } from '../export.ts';
import { print } from '../io.ts';

export async function exportSummary(
  ctx: AppContext,
  args: {
    key: string;
    project: string;
    format: 'markdown' | 'json';
    out?: string;
  },
) {
  const project = await ctx.uow.projects.findBySlug(args.project);
  if (!project) {
    throw new NotFoundError('project', args.project);
  }
  const summary = await buildExportSummary(ctx.uow, {
    projectId: project.id,
    ticketKey: args.key,
  });
  const text = args.format === 'json' ? serializeJson(summary) : serializeMarkdown(summary);
  if (args.out) {
    writeFileSync(args.out, text);
    print(`export written: ${args.out}`);
  } else {
    process.stdout.write(`${text}\n`);
  }
}
