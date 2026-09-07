# Error Handling

> How errors are handled in this project.

---

## Overview

Domain errors are typed (`packages/domain/src/errors.ts`):

- `DomainError` base with a `code`.
- `NotFoundError` (`NOT_FOUND`), `ConflictError` (`CONFLICT`), `InvalidOperationError` (`INVALID_OPERATION`), `ScopingError` (`SCOPING`).

Pipeline errors (`packages/agent/src/pipeline.ts`) wrap agent failures as
`PipelineError` with an optional `cause`. Agent/model failures never corrupt
canonical data: the pipeline writes an `ErrorRecord` (via
`uow.sessions.recordError`) and rethrows.

---

## Propagation

- Domain services throw typed errors; callers (CLI/MCP/API) map them to exit
  codes / structured responses.
- The agent layer (`runExtraction`/`runReconciliation`) catches model failures,
  records an error row, and rethrows `PipelineError`. The already-created
  `Source` row is kept; no requirement rows are touched.
- No transaction is ever held across an LLM call (ADR 001 / architecture).

---

## Validation & Error Matrix

| Condition | Error |
| --- | --- |
| Project slug already exists | `ConflictError` |
| Ticket key already exists in project | `ConflictError` |
| Entity not found | `NotFoundError` |
| Proposal not pending (approve/reject/edit) | `InvalidOperationError` |
| Ticket belongs to another project (ingest) | `ScopingError` |
| Agent threw / malformed output | `ErrorRecord` written + `PipelineError` |
| Unsupported archive schema version | `Error` (archive.ts) |

---

## Common Mistakes

- **Catching agent errors and swallowing them**: always record an `ErrorRecord`
  and rethrow a typed `PipelineError` so failures are auditable.
- **Holding a DB transaction across a model call**: never wrap an LLM run in a
  `db.transaction`; keep transactions short and per-repository.
