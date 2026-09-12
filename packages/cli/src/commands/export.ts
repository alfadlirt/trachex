import { writeFileSync } from 'node:fs';
import { buildExportSummary } from '@trachex/domain';
import type { AppContext } from '../app.ts';
import { serializeJson, serializeMarkdown } from '../export.ts';
import { print } from '../io.ts';
import { resolveSubjectTicket } from '../lib/subject.ts';

export async function exportSummary(
  ctx: AppContext,
  args: {
    subjectId: string;
    project?: string;
    format: 'markdown' | 'json';
    out?: string;
  },
) {
  const { subject, ticket } = await resolveSubjectTicket(ctx.uow, args.subjectId, args.project);
  const summary = await buildExportSummary(ctx.uow, {
    projectId: subject.projectId,
    ticketKey: ticket.key,
  });
  const text = args.format === 'json' ? serializeJson(summary) : serializeMarkdown(summary);
  if (args.out) {
    writeFileSync(args.out, text);
    print(`export written: ${args.out}`);
  } else {
    process.stdout.write(`${text}\n`);
  }
}
