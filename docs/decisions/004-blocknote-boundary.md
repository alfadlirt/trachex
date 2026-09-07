# ADR 004: BlockNote Only For Source Notes

## Status

Accepted

## Decision

Use BlockNote for adjustment and source-note editing where rich pasted content improves the workflow. Store requirements as structured domain records and render them with custom components.

## Rationale

Requirements need typed statuses, provenance, impact relations, supersession links, and completion audits. A generic block document would make those invariants harder to enforce and query. BlockNote still provides a good editing experience where content is naturally document-like.

## Consequences

- Checklist item editing must use explicit fields and revision commands.
- BlockNote content needs immutable revisions and source linkage.
- The UI gets a focused editor without becoming a general-purpose document product.
