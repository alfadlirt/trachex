# Phase 8: Evaluation and Hardening — Implement

## Execution order

1. `packages/agent/src/evals/corpus.ts` + `golden.ts` (fixed corpus + golden outputs).
2. `packages/agent/src/evals/harness.ts` — fixture-based scoring (extraction recall/precision, reconciliation supersede, impact accuracy, FTS5 grounding).
3. `packages/agent/src/evals/perf.ts` — timing assertion (< 2 min).
4. `packages/agent/src/evals/cli.ts` — `trachex eval` (or root script) printing a score report.
5. `packages/agent/src/evals/acceptance.ts` — real-ticket acceptance test via the packaged CLI.
6. `docs/security.md` — security review checklist.
7. Wire `trachex eval` into the CLI router.
8. Validate: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm eval` green.

## Validation commands

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm eval   # runs the eval harness + acceptance
```

## Acceptance review checklist

- [ ] Real ticket completes the full flow via the packaged CLI.
- [ ] All adjustments have source + timestamps.
- [ ] Direct conflicts detected and require approval.
- [ ] Human completion never inferred (audit actor human).
- [ ] Export includes timeline, checklist, impacts, scenarios, history.
- [ ] Eval harness reports scores.
- [ ] Performance < 2 min recorded.

## Review gate

Run trellis-check; then finish (spec update + commit + archive). Then run the parent task integration review.

## Rollback

Revert phase-8 commit(s); Phases 0-7 base stays.
