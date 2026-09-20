# Fix MCP stdio lifecycle

## Goal

Keep the Trachex MCP process alive for the lifetime of an external stdio MCP client, so Claude and other MCP hosts complete the protocol handshake and can call tools reliably.

## Background

The reference `mcp-anvia` repository separates the MCP runtime into `src/mcp-stdio.ts` and starts it with `serveStdio(() => createMcpServer())`. Its Anvia agent connects to that runtime as a stdio client; Anvia is not required for the server implementation.

Trachex currently creates `StdioServerTransport` in `packages/mcp/src/run.ts`, calls `server.connect(transport)`, returns from the CLI `mcp` branch, and then exits from `packages/trachex/bin/trachex.mjs`. The observed result is an immediate clean process exit and an external-client error of `Server disconnected` before a usable MCP session is established.

## Requirements

### R1. Preserve stdio MCP behavior

The server must communicate exclusively through the MCP stdio transport. It must not require a port, HTTP server, background daemon, or Anvia runtime in order to be launched by an MCP host.

### R2. Own the process lifecycle

The MCP runtime must remain alive after startup and must not return control to a caller that immediately invokes `process.exit(0)` until the transport has closed or a fatal startup/runtime error occurs.

### R3. Keep project scoping and startup behavior

The existing explicit `--project <slug>` contract, app-directory selection, SQLite migration, project lookup, tool registration, structured errors, and project boundary enforcement must remain unchanged.

### R4. Provide an external-client verification path

Tests or a deterministic probe must exercise the actual stdio boundary, including startup, `initialize`, initialized notification handling where applicable, `tools/list`, clean disconnect, and startup failure behavior.

### R5. Keep the Anvia comparison bounded

Use the Anvia repository as a lifecycle and entrypoint reference only. Do not add Anvia agent/client dependencies or change Trachex into an agent that consumes another MCP server.

### R6. Preserve safe cleanup

Transport closure, process signals, and startup failures must not leave the SQLite handle open or emit non-protocol logs to stdout. Diagnostics must remain compatible with stdio MCP framing.

## Acceptance Criteria

- [ ] Launching the supported Trachex MCP command with a valid project keeps the process alive while its stdin remains connected.
- [ ] A real MCP stdio client completes `initialize` and can retrieve the registered tools without receiving `Server disconnected`.
- [ ] The server remains project-scoped and exposes the existing tool contract; no HTTP port is introduced.
- [ ] Closing the client stdin/transport terminates the server cleanly and releases opened resources.
- [ ] Missing or invalid project startup fails clearly and does not write non-MCP content to stdout.
- [ ] The test suite covers the transport boundary rather than only direct tool-handler calls.
- [ ] Existing package tests, type checks, and lint remain green.
- [ ] No Anvia runtime dependency or unrelated CLI behavior is introduced.

## Out Of Scope

- HTTP, SSE, or Streamable HTTP MCP transport.
- A long-running background daemon or port-based MCP service.
- Anvia agent integration into Trachex.
- Changes to tool schemas, project scoping rules, domain operations, or database schema.

## Open Questions

None blocking planning. The implementation should prefer a dedicated stdio entrypoint/lifecycle equivalent to the Anvia `mcp-stdio.ts` pattern while retaining the current MCP SDK unless verification shows the SDK version cannot support the required lifecycle safely.
