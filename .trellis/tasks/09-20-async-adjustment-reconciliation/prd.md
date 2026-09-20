# Async adjustment reconciliation with BullMQ

## Goal

Queue uploaded adjustment reconciliation jobs, show processing state, prevent duplicate pending uploads, and preserve proposal approval.

## Background

- `POST /projects/:projectId/tickets/:ticketKey/adjustments` currently validates the upload, persists source data, runs embeddings/retrieval, calls the LLM, and creates a proposal synchronously.
- The dashboard currently waits for that request and has no durable processing status.
- BullMQ requires Redis. Redis belongs in the local Docker Compose development path; the application must not silently start Docker.
- The duplicate-upload guard applies per ticket: one queued or processing adjustment may exist for a ticket at a time.

## Requirements

- Persist an adjustment job record before enqueueing work, including ticket/project scope, source metadata, source reference, BullMQ job id, status, timestamps, attempt count, error, and resulting proposal id.
- Enqueue reconciliation through BullMQ after source/upload persistence and return `202 Accepted` without waiting for the LLM.
- Add a separate worker that loads the job, reuses the existing reconciliation/vector/agent pipeline, creates one pending proposal, and marks the job complete.
- Mark jobs failed with an actionable safe error after retries are exhausted; never mutate canonical requirements from the worker.
- Show queued/processing/completed/failed job cards in the ticket canvas, including source/file metadata and the completed proposal when available.
- Refresh job state through a typed status endpoint and polling or explicit refresh; WebSockets/SSE are not required for MVP.
- Reject a new adjustment upload while that ticket has a queued or processing job. Return a conflict response identifying the blocking job.
- Allow new uploads after completion or failure. Failed jobs have a deliberate retry action that cannot create two active jobs.
- Preserve JSON compatibility, source provenance, local/vector indexing, and proposal approval behavior.
- Add Redis/BullMQ to the local Compose path with documented worker startup commands.
- Keep synchronous/fake queue injection for deterministic tests.

## Out Of Scope

- WebSockets/SSE.
- Concurrent adjustment jobs for one ticket.
- Queueing extraction, chat, export, or checklist completion.
- Hosted Redis, managed queues, multi-tenant workers, or horizontal orchestration.
- Automatic proposal approval or direct canonical requirement mutation.

## Acceptance Criteria

- [ ] A valid upload returns `202` quickly with a persisted queued job and does not wait for the LLM.
- [ ] The worker transitions `queued -> processing -> completed` and creates exactly one pending proposal.
- [ ] Exhausted worker failures transition to failed with an actionable message after BullMQ retries.
- [ ] A second upload for the same ticket is rejected while an earlier job is queued or processing.
- [ ] Completed or failed jobs no longer block a new upload.
- [ ] The dashboard shows processing state and eventually displays the resulting proposal without losing provenance.
- [ ] Failed jobs expose a retry action and retrying cannot create two active jobs.
- [ ] Redis/BullMQ Compose configuration validates and application startup does not silently launch Redis.
- [ ] Existing proposal approval/rejection/edit/reset behavior remains unchanged.
- [ ] API, worker, storage, dashboard, typecheck, lint, and build checks pass.
