# Human-readable CLI and TUI workflow feedback

## Goal

Make the terminal experience understandable without sacrificing automation: default CLI output explains what changed and suggests the next useful command; interactive activation choices prompt only in a TTY; `--json` and MCP remain stable machine-readable interfaces; TUI proposal/checklist screens expose the same semantic workflow.

## Confirmed Facts

- Project and subject creation currently print JSON unconditionally (`packages/cli/src/commands/project.ts:14-17`, `packages/cli/src/commands/subject.ts:19-33`).
- Proposal list/review/edit/approve/reject currently print JSON unconditionally (`packages/cli/src/commands/proposal.ts:13-119`).
- `--json` already exists for several list/status/checklist commands, but not consistently across mutations.
- `packages/cli/src/io.ts` owns printing and confirmation; it can provide TTY-aware activation prompts without changing MCP.
- The TUI already renders readable checklist progress and history, but has no proposal review screen.

## Requirements

- Human-readable output is the default for terminal CLI commands; JSON output is available via explicit `--json` where command output is consumed by scripts/agents.
- JSON mode preserves the existing response shapes unless a new field is required for the human workflow.
- Project creation reports name, slug, ID, active state, and next commands. In an interactive TTY it asks whether to set the project active; non-TTY execution never blocks and prints `project use` guidance.
- Subject creation follows the same TTY-only active-subject choice and prints next commands for adding a document and viewing the checklist.
- CRUD/mutation commands report entity, operation, provenance/status where relevant, whether canonical checklist state changed, and a useful next command.
- Proposal list renders a compact human workflow summary grouped by status/ticket, including source attribution and proposed additions/supersessions. `--json` returns structured proposal records.
- Proposal review renders a semantic diff: source/cause, existing targets, replacements, additions, impacts, scenarios, pending state, and review/edit/approve/reject commands. It explicitly says no checklist changes were applied.
- Proposal edit/approve/reject render human-readable outcomes by default; approval summarizes applied changes and review/edit leaves state pending.
- Checklist, adjustment, check/uncheck, repository, export, and project/subject lifecycle feedback use the same actionable style without changing their domain behavior.
- TUI adds or improves proposal review/action presentation using the same semantic fields as CLI; checklist history remains readable.
- MCP responses remain structured JSON and do not receive terminal prose.
- Color is optional and must respect existing theme/no-color settings; plain text remains legible.

## Acceptance Criteria

- [ ] `project create` and `subject new` provide IDs and next actions; interactive activation prompts occur only when stdin/stdout are TTYs.
- [ ] Piped/non-interactive create commands complete without waiting for input.
- [ ] Human `proposal list` and `proposal review` output is readable without `jq` and explains the pending agentic workflow.
- [ ] Proposal review clearly distinguishes proposed changes from applied changes.
- [ ] Human mutation feedback exists for the available CRUD commands and includes at least one relevant next command.
- [ ] `--json` output remains parseable and MCP tool responses remain structured JSON.
- [ ] TUI presents proposal/checklist state with readable status, provenance, and available actions.
- [ ] Existing tests pass and new tests cover TTY/non-TTY activation, human/JSON output, proposal rendering, and MCP compatibility.

## Notes

- Keep `prd.md` focused on requirements, constraints, and acceptance criteria.
- Lightweight tasks can remain PRD-only.
- For complex tasks, add `design.md` for technical design and `implement.md` for execution planning before `task.py start`.
