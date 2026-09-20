# Support HTTPS MCP transport via Anvia

## Goal

Extend Trachex's MCP integration to support HTTPS while preserving the existing local stdio workflow.

## Confirmed Background

- The published workflow is `trachex mcp --project <slug>`.
- `packages/mcp/src/run.ts` creates the MCP server with the official MCP SDK's `StdioServerTransport`.
- The MCP server is explicitly scoped to one project before the protocol connection is opened.
- The repository has no `@anvia/mcp` dependency and no Anvia `McpClient` integration today.
- Anvia's current `@anvia/mcp` API documents `streamableHttp` as a client transport with a URL, exact-endpoint headers or an auth provider, session/reconnection settings, and SSRF protection.
- The existing ADR explicitly deferred HTTP MCP and requires narrow, stable, project-scoped tools.

## Requirements

- Preserve the current stdio MCP command and its project-scoping behavior.
- Add Streamable HTTP without duplicating MCP tool definitions or domain behavior.
- Keep the selected project fixed for the lifetime of each server process.
- Require a configured bearer token for HTTP MCP requests; never log the token.
- Validate host and origin boundaries for HTTP requests and provide safe local defaults.
- Define startup, connection, authentication, invalid-session, and shutdown failure behavior.
- Add automated coverage for the HTTP protocol path and regression coverage for stdio.
- Update public usage, architecture, security, and the ADR that deferred HTTP MCP.

## Confirmed Scope

- Implement option 1: expose Trachex's own MCP server over Streamable HTTP so remote MCP clients can connect to it.
- Keep the current stdio server unchanged as the default local integration.
- Both transports use the same `createMcpServer` implementation and project-scoped tool context; no second tool registry or domain path is introduced.
- The HTTPS endpoint must be deployable behind Dokploy's domain and TLS reverse proxy on a VPS.
- Remote Claude and OpenAI API integrations require a publicly reachable HTTPS endpoint; they cannot launch Trachex's local stdio process.
- ChatGPT custom MCP apps require supported Business or Enterprise/Edu workspace capabilities and connect to a remote endpoint; local/private endpoints require a tunnel or equivalent public ingress.
- The current fixed `--project <slug>` process model is suitable for one deployed project instance, but a shared multi-project public service would require an explicit authenticated project-selection design and is not assumed for this MVP.

## Deployment Recommendation

Recommended MVP: extend the existing `mcp` command with an explicit HTTP transport flag, keep the selected project fixed for the process, bind to `127.0.0.1` by default, require a bearer token when non-local access is configured, and terminate TLS at Dokploy's reverse proxy. Direct certificate handling inside Trachex is a larger operational surface; an unauthenticated public listener is not acceptable.

Example deployment shape:

```text
Claude / OpenAI / ChatGPT
        |
        | https://mcp.example.com/mcp
        v
Dokploy TLS reverse proxy
        |
        | localhost:8001
        v
trachex mcp --transport http --project loyalty --host 127.0.0.1 --port 8001
        |
        v
SQLite volume mounted as persistent VPS storage
```

## Acceptance Criteria

- [ ] The selected HTTPS direction is documented with an observable invocation/configuration example.
- [ ] Existing stdio MCP behavior remains compatible and project-scoped.
- [ ] HTTPS transport behavior is covered by automated tests, including failure handling and credential boundaries relevant to the selected direction.
- [ ] `pnpm lint`, `pnpm typecheck`, and `pnpm test` pass.
- [ ] Documentation and ADR/spec references describe the resulting transport contract.

## Planning Decisions

- Command shape: `trachex mcp --transport http --project <slug> [--host <host>] [--port <port>]`.
- HTTP endpoint: `/mcp`, supporting MCP Streamable HTTP `POST`, `GET`, and `DELETE` through the official SDK transport.
- Authentication: `TRACHEX_MCP_TOKEN` is required for HTTP mode and must match a bearer token on every request.
- Defaults: host `127.0.0.1`, port `8001`; Dokploy deployments may override the host for container ingress and terminate TLS at the reverse proxy.
- Session scope: one in-memory stateful transport and one MCP server instance per MCP session; all sessions share the process's fixed project context.
- Out of scope: OAuth, multi-project selection within one public process, direct certificate management, SSE-only legacy transport, and Anvia `McpClient` integration for consuming third-party MCP servers.
