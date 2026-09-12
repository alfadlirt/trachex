# Implementation Plan

1. Add shared TTY-aware prompt and human presentation helpers.
2. Convert project/subject lifecycle and mutation commands to human output with explicit JSON branches.
3. Implement readable proposal list/review/edit/approve/reject summaries and next-action guidance.
4. Add actionable feedback to adjustment/checklist/check/uncheck/repository commands where currently terse or raw.
5. Add TUI proposal review/action presentation using the same semantic fields.
6. Add focused CLI/TUI tests for output modes, activation prompts, proposal diff, and no mutation before approval.
7. Run typecheck, full tests, fixture validation, targeted lint/format, and `git diff --check`.

## Review Gates

- Never prompt in non-TTY execution.
- Never change JSON/MCP response contracts unintentionally.
- Human proposal output must say whether checklist state changed.
- Suggestions must be valid commands for the current scope.
