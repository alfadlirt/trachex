# Technical Design

## Reference Comparison

The Anvia example has two separate concerns:

1. `src/mcp-stdio.ts` is the server entrypoint. `serveStdio(() => createMcpServer())` owns startup and keeps the process attached to the stdio transport.
2. `src/index.ts` is an Anvia agent that creates an `McpClient` with `{ type: "stdio", command, args }`, uses the exposed server, and closes the client in `finally`.

Trachex needs concern 1. It does not need concern 2 because Claude or another external MCP host is the client.

## Current Failure Boundary

The current flow is:

```text
trachex.mjs
  -> runCli()
  -> mcp case
  -> runMcpServer()
  -> server.connect(new StdioServerTransport())
  -> return EXIT_OK
  -> process.exit(0)
```

The general CLI entrypoint is appropriate for finite commands, but it is a poor lifecycle boundary for a long-lived stdio protocol unless the MCP branch remains pending until transport closure. Direct tool-handler tests do not detect this failure because they bypass the process and wire protocol.

## Preferred Boundary

Introduce a dedicated MCP stdio runtime boundary that:

- performs the existing app-directory/database/project initialization;
- constructs the existing `createMcpServer` instance;
- connects the existing `StdioServerTransport`;
- keeps the owning async operation pending for the transport lifetime;
- handles transport close, fatal transport errors, signals, and database cleanup;
- writes only MCP protocol messages to stdout;
- uses stderr or structured process errors for diagnostics.

The existing CLI command may delegate to the same runtime, but it must not cause the runtime to return immediately while the client is connected. The published executable/configuration must point to a runtime that can be spawned directly by an external MCP host, analogous to the Anvia example's `src/mcp-stdio.ts`.

## Compatibility

- Continue using the current `@modelcontextprotocol/sdk` transport unless a verified SDK incompatibility requires a dependency change.
- Keep `trachex mcp --project <slug>` as the documented command.
- Keep `--project` explicit and preserve the current default active-project behavior if supported by the CLI.
- Do not introduce a network listener or change the database location contract.
- Do not add Anvia packages; Anvia is only the reference for separating the stdio entrypoint from an agent consumer.

## Data And Resource Flow

```text
MCP host stdin
  -> stdio transport
  -> server request handlers
  -> scoped ToolContext
  -> SQLite UnitOfWork
  -> MCP response on stdout
MCP host disconnect/signal
  -> transport close
  -> database close
  -> process exit
```

Startup failures occur before the transport is usable. They must exit nonzero and must not contaminate stdout with human-readable CLI output. Tool failures continue to use the existing structured `CallToolResult` error format.

## Verification Design

Add a process-level test/probe that spawns the supported runtime with a temporary app directory containing a known project, sends a valid MCP initialize request, waits for the response, sends `tools/list`, and then closes stdin. Assert:

- the child remains alive before stdin closes;
- initialize succeeds;
- tools are returned;
- the child exits cleanly after disconnect;
- invalid project startup exits nonzero;
- stdout contains only MCP frames.

The test should use the repository's installed MCP client SDK where practical instead of reproducing framing manually. Existing direct server/tool tests remain useful for business behavior but do not replace this boundary test.

## Rollback

If the lifecycle change causes regressions, revert only the runtime/entrypoint and boundary-test changes. Tool handlers, domain behavior, and database schema remain independent and should not require rollback.
