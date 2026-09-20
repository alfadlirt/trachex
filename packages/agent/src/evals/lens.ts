import { randomUUID } from 'node:crypto';
import {
  type EvalCase,
  type EvalMetricDescriptor,
  EvalOutcome,
  type EvalReportArgs,
  type EvalRunContext,
  type EvalTotals,
} from '@anvia/core/evals';
import { LensClient } from '@anvia/lens';
import type { EvalReport, EvalScore } from './harness.ts';

export interface EvalLensEnv {
  ANVIA_LENS_ENABLED?: string;
  ANVIA_LENS_BASE_URL?: string;
  ANVIA_LENS_PUBLIC_KEY?: string;
  ANVIA_LENS_SECRET_KEY?: string;
  ANVIA_LENS_SERVICE_NAME?: string;
}

const SUITE_NAME = 'trachex-checklist-evals';

function metricFor(score: EvalScore): EvalMetricDescriptor<number> {
  return {
    name: score.metric,
    dataType: 'NUMERIC',
    direction: 'higher_is_better',
    threshold: 0.5,
  };
}

function outcomeFor(score: EvalScore) {
  const options = {
    comment: score.detail,
    metadata: { ...score.metadata },
  };
  return score.passed
    ? EvalOutcome.pass(score.score, options)
    : EvalOutcome.fail(score.score, options);
}

function caseFor(score: EvalScore): EvalCase<string> {
  const fixture = (score.metadata.fixture as string | undefined) ?? 'unknown';
  return { id: fixture, input: fixture, metadata: { category: score.category } };
}

function totals(scores: EvalScore[]): EvalTotals {
  const passed = scores.filter((score) => score.passed).length;
  return { total: scores.length, passed, failed: scores.length - passed, invalid: 0 };
}

export async function reportToLens(
  report: EvalReport,
  env: EvalLensEnv = process.env,
): Promise<void> {
  const enabled =
    env.ANVIA_LENS_ENABLED === 'true' ||
    env.ANVIA_LENS_ENABLED === '1' ||
    env.ANVIA_LENS_BASE_URL !== undefined;
  if (!enabled) return;

  const client = new LensClient({
    baseUrl: env.ANVIA_LENS_BASE_URL,
    publicKey: env.ANVIA_LENS_PUBLIC_KEY,
    secretKey: env.ANVIA_LENS_SECRET_KEY,
    serviceName: env.ANVIA_LENS_SERVICE_NAME ?? 'trachex',
  });
  if (!client.enabled) return;

  try {
    const reporter = client.evalReporter({
      includeMetadata: true,
      includePayloads: true,
      onMissingTrace: 'emit',
    });

    const run: EvalRunContext = {
      id: randomUUID(),
      startedAt: new Date().toISOString(),
      datasetName: 'trachex-checklist',
    };
    const metricNames = report.scores.map((score) => score.metric);

    await reporter.onRunStart?.({
      run,
      suiteName: SUITE_NAME,
      caseCount: report.scores.length,
      metricNames,
    });

    for (const score of report.scores) {
      const args: EvalReportArgs<string, string, number> = {
        run,
        suiteName: SUITE_NAME,
        case: caseFor(score),
        output: score.detail,
        targetStatus: 'succeeded',
        metric: metricFor(score),
        outcome: outcomeFor(score),
      };
      await reporter.report(args);
    }

    await reporter.onRunEnd?.({
      run,
      suiteName: SUITE_NAME,
      caseCount: report.scores.length,
      metricNames,
      status: 'completed',
      completedAt: new Date().toISOString(),
      durationMs: 0,
      metrics: totals(report.scores),
      cases: totals(report.scores),
    });

    await client.flush();
  } catch (error) {
    console.warn(`[trachex/agent] failed to publish eval report to Lens: ${String(error)}`);
  } finally {
    client.close().catch(() => {});
  }
}
