# Trachex Security Review

Checklist applied to the codebase (Phases 0-8).

## Provider keys

- [x] Provider keys never go to browser local storage — the dashboard (`apps/dashboard/src/lib/api.ts`) only calls `/api/*`; no `localStorage`/key handling exists in the browser.
- [x] Environment variables override provider settings for CI (`packages/agent/src/provider.ts` `resolveProviderConfig`).
- [x] Keychain-backed profiles are a documented stub (`loadKeychainProfile` returns null); MVP uses env + global non-secret config.
- [x] Keys never stored in SQLite or archives (archive manifest has no key fields; `packages/storage-sqlite/src/archive.ts`).

## Local API binding

- [x] Dashboard binds localhost by default (`TRACHEX_DASHBOARD_HOST` default `127.0.0.1` in `apps/api/src/index.ts`).
- [x] Browser never opens SQLite directly; all reads/writes go through the Hono API.

## MCP

- [x] MCP is stdio by default and explicitly project-scoped (`trachex mcp --project <slug>`, ADR 005).
- [x] Opt-in HTTP MCP requires `TRACHEX_MCP_TOKEN` on every request; the token
  is compared in memory and never logged or returned.
- [x] HTTP MCP validates the configured Host and Origin allowlists, defaults to
  `127.0.0.1:8001`, and delegates TLS termination to the Dokploy reverse proxy.
- [x] HTTP sessions are fixed to the startup project and stored only in
  process memory. Invalid or restarted sessions must initialize again.
- [x] OAuth, multi-project selection, direct certificate management, and the
  deprecated HTTP+SSE transport are not enabled.
- [x] No generic command-execution tool exposed; `check_item` requires `confirm: true`.

## Source handling and logs

- [x] Source snapshots may contain proprietary code; logs avoid raw source — pipeline error records store only error messages (`packages/agent/src/pipeline.ts` `recordPipelineError`), never source content.
- [x] Export archives exclude provider secrets and embeddings by default (archive manifest + no embedding storage).

## Verification commands

```bash
grep -rn "localStorage" apps/dashboard/src || echo "no localStorage in browser"
grep -rn "OPENAI_API_KEY" packages/trachex/dist apps/dashboard/dist 2>/dev/null || echo "no keys in package output"
```
