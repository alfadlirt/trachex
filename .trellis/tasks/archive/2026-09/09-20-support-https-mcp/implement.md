# HTTPS MCP Implementation Plan

## Ordered Checklist

1. Add HTTP transport runner and shared runtime/session lifecycle in `packages/mcp`.
2. Add explicit `--transport`, `--host`, and `--port` parsing to the CLI while preserving stdio defaults.
3. Add bearer authentication, host/origin validation, safe error responses, and shutdown cleanup.
4. Add protocol-level tests for initialize, tools/list, authentication rejection, project scoping, and session cleanup.
5. Update package descriptions, README, usage, architecture, security review, ADR 005, and `.env.example`.
6. Run package and repository quality checks; inspect the final diff for unrelated changes.

## Validation Commands

```bash
pnpm --filter @trachex/mcp typecheck
pnpm --filter @trachex/mcp test
pnpm --filter @trachex/cli typecheck
pnpm --filter @trachex/cli test
pnpm lint
pnpm typecheck
pnpm test
```

## Risk Points

- Stateful Streamable HTTP requires a distinct transport/server pair per session; reusing a stateless transport across requests is invalid.
- The HTTP runner must not close the SQLite database while active sessions are serving requests.
- CLI `--transport` parsing must not alter the existing command's default stdio behavior.
- Proxy host/origin configuration must not log or expose the bearer token.
- Dokploy may require `0.0.0.0` inside a container even though the local default remains `127.0.0.1`.

## Review Gate

Before implementation starts, confirm `prd.md`, `design.md`, and this checklist contain no unresolved product decisions. Before completion, verify both transport modes and document the exact remote endpoint configuration for Claude, OpenAI, and supported ChatGPT custom MCP apps.
