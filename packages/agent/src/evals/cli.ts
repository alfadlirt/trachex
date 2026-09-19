import { runEvalHarness } from './harness.ts';

export async function runEvalCli(): Promise<number> {
  const report = await runEvalHarness();
  for (const score of report.scores) {
    console.log(
      `${score.passed ? 'PASS' : 'FAIL'}  [${score.category}] ${score.metric} ` +
        `(${score.score.toFixed(2)}) ${score.detail}`,
    );
  }
  console.log(
    `\n${report.scores.filter((s) => s.passed).length}/${report.scores.length} metrics passed`,
  );
  return report.passed ? 0 : 1;
}
