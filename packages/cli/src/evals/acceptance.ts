import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runCli } from '@trachex/cli';

export interface AcceptanceResult {
  passed: boolean;
  detail: string[];
}

function tempAppDir(): string {
  return mkdtempSync(join(tmpdir(), 'trachex-accept-'));
}

async function run(args: string[], appDir: string): Promise<number> {
  return runCli({ argv: args, appDir });
}

async function captureJson<T>(fn: () => Promise<number>): Promise<T> {
  const original = process.stdout.write;
  let buffer = '';
  process.stdout.write = (chunk: string | Uint8Array) => {
    buffer += String(chunk);
    return true;
  };
  try {
    await fn();
  } finally {
    process.stdout.write = original;
  }
  return JSON.parse(buffer) as T;
}

async function captureText(fn: () => Promise<number>): Promise<string> {
  const original = process.stdout.write;
  let buffer = '';
  process.stdout.write = (chunk: string | Uint8Array) => {
    buffer += String(chunk);
    return true;
  };
  try {
    await fn();
  } finally {
    process.stdout.write = original;
  }
  return buffer;
}

export async function runAcceptanceTest(): Promise<AcceptanceResult> {
  const detail: string[] = [];
  const appDir = tempAppDir();
  try {
    const fsd = join(appDir, 'fsd.md');
    writeFileSync(fsd, '# FSD\nDiscount cap should be 20 percent for loyalty tier.\n');
    const extractionFixture = join(appDir, 'extraction.json');
    writeFileSync(
      extractionFixture,
      JSON.stringify({
        kind: 'extraction',
        requirements: [
          {
            title: 'Discount cap 20%',
            impacts: [{ kind: 'service', value: 'config-service' }],
            scenarios: ['Non-VIP at cap'],
          },
        ],
      }),
    );
    const reconciliationFixture = join(appDir, 'reconciliation.json');

    const steps: [string[], number][] = [
      [['project', 'create', 'loyalty', '--name', 'Loyalty'], 0],
      [
        [
          'ticket',
          'new',
          'TICKET-1',
          '--project',
          'loyalty',
          '--fsd',
          fsd,
          '--fixture',
          extractionFixture,
        ],
        0,
      ],
    ];
    for (const [args, expected] of steps) {
      const code = await run(args, appDir);
      if (code !== expected) {
        detail.push(`step failed (exit ${code}): ${args.join(' ')}`);
      }
    }

    const proposals = await captureJson<Array<{ proposal: { id: string; status: string } }>>(
      async () => run(['proposal', 'list', '--project', 'loyalty'], appDir),
    );
    const extractionProposal = proposals[0]?.proposal;
    if (extractionProposal?.status !== 'pending') {
      detail.push('extraction proposal not pending');
    } else {
      await run(
        ['proposal', 'approve', extractionProposal.id, '--project', 'loyalty', '--yes'],
        appDir,
      );
    }

    const show1 = await captureJson<{ checklist: Array<{ id: string; devStatus: string }> }>(
      async () => run(['ticket', 'show', 'TICKET-1', '--project', 'loyalty'], appDir),
    );
    const req = show1.checklist[0];
    if (req?.devStatus !== 'unchecked') {
      detail.push('checklist not populated after approval');
    } else {
      await run(['check', 'TICKET-1', req.id, '--project', 'loyalty', '--yes'], appDir);
    }

    // Write the reconciliation fixture with the real requirement id as the supersede target.
    if (req) {
      writeFileSync(
        reconciliationFixture,
        JSON.stringify({
          kind: 'reconciliation',
          create: [
            {
              title: 'Discount cap 15%, VIP tier exempt',
              supersedes: [req.id],
            },
          ],
        }),
      );
    }

    await run(
      [
        'adjustment',
        'TICKET-1',
        '--project',
        'loyalty',
        '--source',
        'chat',
        '--from',
        'Budi (BA)',
        '--note',
        'cap 15%',
        '--fixture',
        reconciliationFixture,
      ],
      appDir,
    );
    const proposals2 = await captureJson<
      Array<{ proposal: { id: string; kind: string; status: string } }>
    >(async () => run(['proposal', 'list', '--project', 'loyalty'], appDir));
    const recon = proposals2.find((p) => p.proposal.kind === 'reconciliation');
    if (recon?.proposal.status !== 'pending') {
      detail.push('reconciliation proposal not pending');
    } else {
      await run(
        ['proposal', 'approve', recon.proposal.id, '--project', 'loyalty', '--yes'],
        appDir,
      );
    }

    const show2 = await captureJson<{
      checklist: Array<{ id: string; title: string; devStatus: string }>;
    }>(async () => run(['ticket', 'show', 'TICKET-1', '--project', 'loyalty'], appDir));
    const reconciled = show2.checklist.find((r) => r.title === 'Discount cap 15%, VIP tier exempt');
    if (!reconciled) {
      detail.push('reconciled requirement not in checklist');
    } else {
      // Release gate: human completion after the adjustment approval.
      const checkOut = await captureJson<{ audit: { actorType: string } }>(async () =>
        run(['check', 'TICKET-1', reconciled.id, '--project', 'loyalty', '--yes'], appDir),
      );
      if (checkOut.audit?.actorType !== 'human') {
        detail.push('completion actor is not human (completion must never be inferred)');
      }
    }

    // Adjustment source + timestamp: the reconciliation source must carry attribution and ingestedAt.
    const showSources = await captureJson<{
      sources: Array<{ type: string; attribution: string | null; ingestedAt: string }>;
    }>(async () => run(['ticket', 'show', 'TICKET-1', '--project', 'loyalty'], appDir));
    const adjustmentSource = showSources.sources?.find((s) => s.type === 'chat');
    if (adjustmentSource?.attribution !== 'Budi (BA)' || !adjustmentSource?.ingestedAt) {
      detail.push('adjustment source missing attribution or timestamp');
    }

    const exportMd = await captureText(async () =>
      run(['export', 'TICKET-1', '--project', 'loyalty', '--format', 'markdown'], appDir),
    );
    for (const section of [
      '## Timeline',
      '## Current Checklist',
      '## Services Impacted',
      '## Test Scenarios',
      '## Requirement History',
    ]) {
      if (!exportMd.includes(section)) {
        detail.push(`export missing section: ${section}`);
      }
    }
    // History must contain the superseded original requirement, not just the header.
    if (!exportMd.includes('Discount cap 20%')) {
      detail.push('export history missing superseded requirement');
    }

    return { passed: detail.length === 0, detail };
  } finally {
    rmSync(appDir, { recursive: true, force: true });
  }
}
