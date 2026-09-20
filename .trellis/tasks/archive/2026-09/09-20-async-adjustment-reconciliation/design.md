# Async Adjustment Reconciliation Design

## Data Flow

```text
Dashboard upload -> API validates/stores source -> adjustment_jobs(queued)
  -> BullMQ/Redis -> worker(processing)
  -> existing runReconciliation() -> pending proposal
  -> adjustment_jobs(completed/failed) -> dashboard polling
```

The request path never waits for an LLM call. Source persistence and job-record
creation happen before enqueueing. Enqueue failure must be visible and must not
claim that the job was accepted.

## Persistence Contract

Add an `adjustment_jobs` table containing `id`, project/ticket scope, source id,
BullMQ job id, status (`queued | processing | completed | failed`), source
metadata, timestamps, attempts, error, and proposal id. SQLite is the source of
truth for dashboard state; Redis is only execution transport.

Enforce at most one queued/processing job per ticket with a repository/service
guard and a partial unique index where supported.

## Queue Contract

- Queue name: `trachex-adjustments`.
- Payload: `{ adjustmentJobId: string }`, never document text or secrets.
- Bounded attempts with exponential backoff.
- Completed jobs may be removed; failed job state remains in SQLite.
- Worker is idempotent: completed jobs are no-ops and retries cannot create a second proposal.

## API Contract

- `POST /projects/:projectId/tickets/:ticketKey/adjustments` returns `202` with `{ job, source }`.
- `GET /projects/:projectId/tickets/:ticketKey/adjustments/jobs` returns newest-first job cards.
- `POST /projects/:projectId/tickets/:ticketKey/adjustments/jobs/:jobId/retry` retries only failed, correctly scoped jobs.
- Existing proposal endpoints remain unchanged.

## Runtime And Failure

Queue mode is enabled when Redis/BullMQ configuration is present. The worker is
a separate process. Tests inject a fake queue/runner and do not require Redis.
If Redis is unavailable, the API returns a clear service/configuration error and
does not claim the job was queued. Canonical source/proposal behavior remains
safe during worker failure.
