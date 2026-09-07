// @trachex/agent
//
// Phase 3 adds the Anvia agent here: provider configuration resolver, agent
// factory with typed schemas and bounded turns, extraction/reconciliation
// prompts and output schemas, impact classification, test-scenario generation,
// context search tool, SQLite-backed Anvia memory, and optional Lens/Pino
// observers. Agent output is always persisted as pending proposals; it never
// mutates canonical requirements (ADR 003).
