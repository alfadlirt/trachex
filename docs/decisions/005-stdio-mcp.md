# ADR 005: Explicitly Scoped Stdio MCP

## Status

Accepted

## Decision

The MVP exposes MCP through a local stdio process launched as `trachex mcp --project <slug>`. HTTP MCP is deferred.

## Rationale

Stdio is the simplest secure integration for local coding agents. Explicit project scope prevents an agent from accidentally reading or mutating another project. A remote transport can be added when a concrete deployment need exists.

## Consequences

- MCP configuration is process-based.
- Tool descriptions and schemas must remain stable and narrow.
- Remote agents need a later transport or a local bridge.
