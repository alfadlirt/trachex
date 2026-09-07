# Phase 8: Evaluation and Hardening — Design

## Eval harness (deterministic, fixture-based)

Create `packages/agent/src/evals/` (or a root `evals/` dir) with:

- `src/evals/corpus.ts` — fixed corpus: a representative FSD (loyalty program) + a BRD + adjustment notes (discount cap change, VIP exemption, timezone).
- `src/evals/golden.ts` — golden expected outputs: for each corpus doc, expected requirement titles, impacts (service/api/page), scenarios, and supersedes targets.
- `src/evals/harness.ts` — runs the pipeline with a **fixture runAgent** (not a real LLM) against a temp app dir + SQLite, then scores:
  - extraction: requirement recall/precision vs golden (title match, impact match).
  - reconciliation: supersede detection (direct conflict → proposal `supersedes` target correct).
  - impact classification: per-kind accuracy (service/api/page).
  - grounding: search results carry `relPath`/`location` provenance (FTS5).
- `src/evals/cli.ts` — `trachex eval` command (or a root script) that prints a score report and exits non-zero on failure thresholds.

## Direct-conflict test

- Corpus includes the discount-cap example: FSD says cap 20%, adjustment says cap 15% + VIP exempt.
- Harness asserts the reconciliation fixture output supersedes the original requirement (relationship `supersedes`), and that approving requires an explicit action (already covered by domain tests).

## Performance measurement

- `src/evals/perf.ts` — times a fixture extraction run over the representative FSD (chunking + FTS5 + proposal persistence, no LLM) and asserts < 2 minutes (generous; expected ms).

## Security review

- A checklist (in `docs/security.md` or the eval report):
  - Provider keys never in browser local storage (grep dashboard for localStorage/keys).
  - Env override for CI; keychain stub documented.
  - Dashboard binds localhost by default (host default 127.0.0.1).
  - MCP stdio + project-scoped (ADR 005).
  - Logs avoid raw source/secrets (pipeline error records store messages only).
  - Archives exclude provider secrets/embeddings (archive manifest has no key fields; test asserts no `OPENAI_API_KEY`).

## Real-ticket acceptance test

- `src/evals/acceptance.ts` (or a CLI script) — uses the packaged CLI (`packages/trachex/bin/trachex.mjs`) against a temp app dir:
  - `project create` → `ticket new` (fixture) → `proposal list` → `proposal approve` → `check` → `adjustment` (fixture) → `proposal approve` → `check` → `export`.
  - Asserts: checklist current, history has superseded item, export contains Timeline/Checklist/Impacts/Scenarios/History, adjustment has source+timestamp, completion never inferred (audit actor human).

## Rollout / rollback

- Phase 8 builds on Phases 0-7. Failure = revert phase-8 commit(s). This is the final phase; the parent task integration review runs after.
