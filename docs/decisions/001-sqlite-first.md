# ADR 001: SQLite-First Local Storage

## Status

Accepted

## Decision

SQLite is the canonical storage engine for the MVP. It stores Trachex domain data and local agent chat memory in the global application directory. Anvia's SQLite memory package is preferred when compatible with the pinned v1 release.

Qdrant is optional and derived. PostgreSQL is deferred to a future explicit server adapter.

## Rationale

The primary user experience is one installable CLI that works without Docker. SQLite supports the global multi-project registry, concurrent local CLI/dashboard use with WAL, portable archives, and simple backup. Requiring PostgreSQL would make the basic workflow harder without solving an MVP requirement.

## Consequences

- Domain repositories must not expose SQLite-specific types.
- A future PostgreSQL adapter remains possible.
- Multi-user remote deployment is not an MVP capability.
- Qdrant indexes must be rebuildable from immutable snapshots.
