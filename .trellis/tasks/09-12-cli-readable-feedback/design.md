# Readable CLI/TUI Design

## Output Boundary

Command handlers choose a presentation mode and delegate formatting to small CLI presentation helpers. Human mode prints semantic summaries and next actions. JSON mode prints the existing structured payload. MCP remains outside this presentation layer.

## Activation

Creation commands use a TTY-only prompt. The prompt is skipped when either standard input or output is not a TTY. Non-interactive output states that the entity was created and prints the explicit `project use` or `subject use` command.

## Proposal Presentation

Build one review-oriented projection from the pending proposal, source, target requirements, and draft fields. CLI list uses a compact projection; CLI review uses the full semantic diff. The projection is presentation-only and does not alter domain/API contracts.

## TUI

Add a proposal screen/action path using the same review projection concepts. Approval remains an explicit interactive action. The existing checklist renderer continues to show active items, history, and provenance.

## Compatibility

Existing `--json` consumers and MCP callers retain structured data. Human formatting is the default only where the current command is terminal-oriented; file/content exports remain content-oriented.
