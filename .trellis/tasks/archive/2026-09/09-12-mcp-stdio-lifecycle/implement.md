# Implementation Plan

## Ordered Steps

1. Confirm the active package conventions and current MCP SDK transport lifecycle before editing; preserve the existing `createMcpServer` and tool contracts.
2. Add a dedicated stdio runtime/entrypoint modeled on the Anvia `mcp-stdio.ts` separation, using the current Trachex initialization and project-scoping logic.
3. Make the runtime await transport lifetime rather than returning immediately after connection, with explicit cleanup for database, transport, and process shutdown paths.
4. Wire the documented CLI/published executable to the lifecycle-safe runtime without changing non-MCP CLI commands.
5. Add a process-level stdio handshake test using a temporary database/project and an MCP client or equivalent protocol driver.
6. Add failure-path coverage for an unknown project and ensure diagnostics do not corrupt stdout protocol output.
7. Update MCP usage documentation only if the supported launch command or configuration path changes; retain the clarification that no port is used.
8. Run the full verification set and review the diff for accidental changes to tools, scoping, or Anvia dependencies.

## Validation Commands

```bash
pnpm --filter @trachex/mcp test
pnpm --filter @trachex/mcp typecheck
pnpm typecheck
pnpm test
pnpm lint
```

The process-level test must be run in a way that does not close stdin before the initialize response is observed.

## Risk Points

- A generic `process.exit()` in the composition binary can terminate a valid MCP session if the runtime resolves early.
- A test that only calls `handleToolCall` can pass while the external client still disconnects; the wire-level test is mandatory.
- Human-readable startup logs on stdout corrupt stdio MCP framing.
- Closing the SQLite handle too early can make later tool calls fail; closing it too late can keep the child alive after client disconnect.
- Migrating SDK packages solely to copy the Anvia helper could expand scope unnecessarily; first verify whether the current SDK can implement the required lifecycle.

## Review Gates

- Do not start implementation until this plan and the PRD are explicitly approved.
- Before editing, run the project-specific pre-development guidance for `packages/mcp` and `packages/trachex`.
- After editing, run the MCP quality check and inspect the child-process handshake behavior.
- Do not commit or archive until all acceptance criteria are checked.
