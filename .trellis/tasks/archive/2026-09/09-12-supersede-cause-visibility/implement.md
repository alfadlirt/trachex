# Implementation Plan

1. Tighten the reconciliation prompt with explicit evidence-based supersession criteria and human-review language.
2. Add proposal review/edit command and MCP tool using the existing proposal-version domain service.
3. Require explicit confirmation for CLI/MCP proposal approval and preserve pending-state behavior.
4. Return review data containing source, attribution, note, proposed additions, supersede targets, impacts, and scenarios.
5. Add provider-free domain, CLI, MCP, and agent eval coverage for pending, edit, confirm, reject, and apply behavior.
6. Update the demo to use the real LLM path as primary, with fixture fallback, and show review/edit/confirm checkpoints.
7. Run `pnpm typecheck`, `pnpm test`, fixture validation, targeted lint/format, and `git diff --check`.

## Review Gates

- No proposal review or agent output may mutate canonical requirements.
- Missing CLI `--yes` or MCP `confirm: true` must fail before approval.
- The edited version must be the version applied.
- Supersession must remain same-ticket and preserve old completion audits.
