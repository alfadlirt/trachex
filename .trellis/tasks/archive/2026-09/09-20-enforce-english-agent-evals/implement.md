# Implementation Plan: Enforce English Output in Agent Prompts and Evals

## Execution Checklist

- [x] 1. Update `packages/agent/src/prompts.ts`:
  - Add explicit English-only output system instruction to both `buildExtractionPrompt` and `buildReconciliationPrompt`.
- [x] 2. Update `packages/agent/src/evals/corpus.ts`:
  - Add a multilingual source fixture (e.g. Indonesian) with expected English output (`expected: 'pass'`).
  - Add a failing fixture where output is in non-English (`expected: 'fail'`).
- [x] 3. Update `packages/agent/src/evals/harness.ts`:
  - Update `promptAlignment` to check for the English output instruction in guardrails.
  - Implement `englishLanguageMetric(fixture)` eval checking that output requirement fields are in English and free of non-English text.
  - Include the new metric in `runEvalHarness()`.
- [x] 4. Add test coverage:
  - Add `packages/agent/src/evals.test.ts` to test the evals harness directly, including the new English metric and multilingual fixtures.
- [x] 5. Verification:
  - Run `pnpm --filter @trachex/agent test`
  - Run `pnpm --filter @trachex/agent typecheck`
  - Run evals harness check to confirm all metrics pass as expected.
