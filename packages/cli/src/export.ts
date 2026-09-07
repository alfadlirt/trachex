import type { ExportSummary } from '@trachex/domain';

export function serializeMarkdown(summary: ExportSummary): string {
  const lines: string[] = [];
  lines.push(`# Development Summary: ${summary.ticketKey}`);
  lines.push('');
  lines.push(`> ${summary.ticketTitle}`);
  lines.push('');

  lines.push('## Timeline');
  lines.push('');
  for (const event of summary.timeline) {
    lines.push(`- ${event.at} — ${event.description}`);
  }
  lines.push('');

  lines.push('## Current Checklist');
  lines.push('');
  for (const requirement of summary.checklist) {
    const box = requirement.devStatus === 'checked' ? '[x]' : '[ ]';
    lines.push(`- ${box} ${requirement.title}`);
    if (requirement.sourceLocation) {
      lines.push(`  - Source: ${requirement.sourceLocation}`);
    }
  }
  lines.push('');

  lines.push('## Services Impacted');
  lines.push('');
  for (const impact of summary.impacts.filter((i) => i.kind === 'service')) {
    lines.push(`- ${impact.value}`);
  }
  lines.push('');

  lines.push('## APIs Changed');
  lines.push('');
  for (const impact of summary.impacts.filter((i) => i.kind === 'api')) {
    lines.push(`- ${impact.value}`);
  }
  lines.push('');

  lines.push('## Pages Impacted');
  lines.push('');
  for (const impact of summary.impacts.filter((i) => i.kind === 'page')) {
    lines.push(`- ${impact.value}`);
  }
  lines.push('');

  lines.push('## Test Scenarios');
  lines.push('');
  for (const scenario of summary.scenarios) {
    lines.push(`- ${scenario.text}`);
  }
  lines.push('');

  lines.push('## Requirement History');
  lines.push('');
  for (const requirement of summary.history) {
    lines.push(`- ${requirement.id} — ${requirement.title}`);
    lines.push(`  - Status: Superseded`);
    if (requirement.sourceLocation) {
      lines.push(`  - Source: ${requirement.sourceLocation}`);
    }
  }

  return lines.join('\n');
}

export function serializeJson(summary: ExportSummary): string {
  return JSON.stringify(summary, null, 2);
}
