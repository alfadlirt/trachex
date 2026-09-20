# ADR 005: Explicitly Scoped MCP Transports

## Status

Accepted

## Decision

Trachex exposes MCP through a local stdio process launched as
`trachex mcp --project <slug>` and, when explicitly selected, through the
official Streamable HTTP server transport:
`trachex mcp --transport http --project <slug>`.

HTTP mode listens on `127.0.0.1:8001` by default, requires the
`TRACHEX_MCP_TOKEN` bearer token, and serves `/mcp`. TLS is terminated by the
Dokploy reverse proxy in remote deployments. Every process remains fixed to
the project selected at startup; project selection is never accepted from an
HTTP request.

## Rationale

Stdio remains the simplest secure integration for local coding agents. HTTP is
needed by remote Claude, OpenAI, and supported ChatGPT custom MCP clients that
cannot launch a local process. Explicit project scope prevents an agent from
accidentally reading or mutating another project. A bearer token plus host and
origin boundaries protect the HTTP listener; OAuth, multi-project selection,
and direct certificate management are intentionally out of scope.

## Consequences

- MCP configuration is process-based for stdio and process/project based for HTTP.
- Tool descriptions and schemas must remain stable and narrow.
- HTTP session state is in memory, so clients must initialize again after a
  process restart. Horizontal scaling requires a future shared session design.
