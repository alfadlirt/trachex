import { runEvalHarness } from './harness.ts';

export async function runEvalCli(): Promise<number> {
  const report = await runEvalHarness();
  for (const score of report.scores) {
    console.log(`${score.passed ? 'PASS' : 'FAIL'}  ${score.name}: ${score.detail}`);
  }
  console.log(
    `\n${report.scores.filter((s) => s.passed).length}/${report.scores.length} checks passed`,
  );
  return report.passed ? 0 : 1;
}
