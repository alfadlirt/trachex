# HTTPS MCP Transport Design

## Architecture

`packages/mcp` remains the owner of MCP server composition and transport runners:

- `createMcpServer` continues to register the shared tool handlers and project-scoped context.
- `runMcpServer` continues to serve stdio and is not changed into an HTTP abstraction.
- A new HTTP runner starts a Node HTTP listener, authenticates requests, routes `/mcp`, and manages stateful Streamable HTTP sessions.
- The CLI selects stdio by default and HTTP only when `--transport http` is explicit.

The HTTP runner creates one `StreamableHTTPServerTransport` and one `createMcpServer` instance for the first initialize request. It stores the pair by the transport-generated session ID. Later requests use the `Mcp-Session-Id` header to locate that pair. DELETE closes and removes the session. Server shutdown closes every session and the SQLite database.

## Request Flow

```text
HTTP request
  -> path/method check
  -> bearer-token check
  -> host/origin check
  -> initialize request: create session transport + shared project server
  -> existing session request: look up Mcp-Session-Id
  -> StreamableHTTPServerTransport.handleRequest
  -> createMcpServer request handlers
  -> project-scoped domain repositories
```

The fixed project is resolved before the listener starts, matching stdio. No request can select a different project. The SDK transport owns MCP framing, content negotiation, session headers, and JSON/SSE response behavior.

## Configuration Contract

| Setting | Source | Default | Contract |
| --- | --- | --- | --- |
| transport | CLI `--transport` | `stdio` | `stdio` or `http` |
| project | CLI `--project` or active project | none | Required resolved project slug |
| host | CLI `--host` | `127.0.0.1` | Listener bind address |
| port | CLI `--port` | `8001` | HTTP listener port |
| token | `TRACHEX_MCP_TOKEN` | none | Required in HTTP mode; bearer secret |
| endpoint | fixed route | `/mcp` | MCP Streamable HTTP endpoint |
| allowed hosts | `TRACHEX_MCP_ALLOWED_HOSTS` | listener host and port | Comma-separated Host values; reverse-proxy host must be configured |
| allowed origins | `TRACHEX_MCP_ALLOWED_ORIGINS` | none | Comma-separated origins; absent Origin is allowed for server-to-server clients |

HTTP mode fails before listening if the project does not exist or the bearer token is absent. Authentication failures return `401` with `WWW-Authenticate: Bearer` and do not reach MCP handlers. Invalid or missing session IDs are handled as HTTP errors by the SDK transport or the runner.

## Security and Operations

- The token is compared in memory and is never included in diagnostics.
- The default listener is localhost. A container deployment can bind `0.0.0.0` only when Dokploy/network policy and the bearer token protect the public route.
- TLS is terminated by Dokploy's reverse proxy; the application does not load certificates.
- Host and origin allowlists prevent DNS rebinding and unexpected browser origins.
- SQLite remains canonical and is mounted on persistent storage in Dokploy.
- Session state is process memory. A restart invalidates active MCP sessions; clients must reconnect and initialize again.
- Horizontal scaling is out of scope because session affinity/shared session state is not implemented.

## Compatibility

The stdio command and its wire behavior remain unchanged. HTTP uses MCP Streamable HTTP, not the deprecated HTTP+SSE transport. Existing tools, schemas, project scoping, and error payloads are shared through `createMcpServer`.

## Rollback

The feature is isolated behind the explicit `--transport http` flag. Rolling back the new HTTP runner, CLI options, and documentation restores the existing stdio-only behavior without changing the database schema or tool contract.
