# ADR 003: AI Proposals Before Canonical Mutation

## Status

Accepted

## Decision

All model-generated extraction, reconciliation, impact, and scenario output is persisted as a pending proposal. Canonical requirements change only after explicit approval. Human completion is a separate direct action.

## Rationale

The product's value is trustworthy traceability. Automatic model writes would make conflicts, attribution, and accidental changes difficult to audit. Proposal review also gives CLI, MCP, and UI one consistent safety model.

## Consequences

- `ticket new` is not complete until extraction proposals are reviewed.
- Chat and MCP can be productive without receiving unrestricted write access.
- Proposal/version tables are part of the core schema.
- The UI must make pending work visible rather than hiding it.
