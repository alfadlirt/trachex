# Improve adjustment composer and uploads

## Goal

Make the ticket adjustment composer feel like a deliberate local evidence-ingestion surface and allow users to attach Markdown or PDF source documents without weakening the existing approval workflow or Trachex's local-first installation promise.

## Confirmed Context

- The current composer is a basic source select, attribution input, note textarea, and submit button in `apps/dashboard/src/routes/projects.$projectId.tickets.$ticketKey.tsx`.
- The current API accepts JSON only at `POST /projects/:projectId/tickets/:ticketKey/adjustments`; it sends the note through reconciliation and persists a source snapshot.
- `@trachex/storage-sqlite` already writes immutable source snapshots under the local application directory through `ingestFile`.
- No upload, multipart, PDF parser, or object-storage dependency is currently installed.
- SQLite-first local storage is the accepted MVP architecture; public multi-user deployment is explicitly not an MVP capability.
- The sibling `assignment-w8d2-rag-evals` project demonstrates the target semantic-RAG pattern: an embedding model indexes document chunks into Qdrant, and an agent receives a vector-search tool that returns grounded chunks with provenance.

## Requirements

- Replace the plain adjustment form treatment with a clear composer component that explains what the adjustment does, groups source/attribution/note fields, and exposes useful validation and submission states.
- Support selecting one `.md`, `.markdown`, or `.pdf` file from the composer in addition to a typed note.
- Show the selected filename, type, size, remove action, upload/processing state, and actionable validation errors.
- Accept a typed note, an uploaded file, or both; reject an empty submission.
- Validate uploads server-side by extension and MIME/content signature where practical, with a configurable maximum size and no trust in the client-provided filename or MIME type.
- Ingest Markdown directly as UTF-8 source content through the existing reconciliation flow.
- Extract readable text from PDFs before reconciliation using a maintained server-side parser; if extraction fails, return an actionable error and do not create a proposal.
- Keep uploaded bytes and snapshots on the server filesystem for the local MVP. Do not use browser local storage for source files.
- Keep upload storage local to the Trachex application directory. A future hosted product may introduce a separate storage adapter, but that abstraction is not part of MVP 1.
- Uploaded Markdown/PDF content must enter the same chunking and retrieval pipeline as existing sources so the agent can search it through its context tool.
- The future semantic-RAG implementation must support a local embedded vector backend using SQLite plus sqlite-vec and an optional Qdrant backend exposed through the Docker Compose vector profile.
- The future semantic-RAG implementation must expose one backend-neutral `vectorSearch` tool; the selected backend must be invisible to the agent prompt and tool contract.
- If Docker is available, future setup may offer Qdrant as an explicit opt-in. It must never silently start Docker or make Qdrant required.
- Preserve append-only source provenance, pending-proposal approval, attribution, source type, and existing text-only adjustment behavior.
- Do not expose provider keys or storage credentials to the browser.

## Deployment Recommendation

- Local filesystem storage is the correct choice for MVP 1 because Trachex is installed with `npx` and runs on the user's computer.
- Do not add R2/S3, PostgreSQL, accounts, cloud credentials, or hosted-service assumptions to MVP 1. Qdrant is optional infrastructure; sqlite-vec is the no-Docker fallback.
- Local files are not intended to provide public durability, sharing, horizontal scaling, or multi-user access.
- If Trachex later becomes SaaS/B2B hosted, create a separate architecture task for object storage, hosted database/search, authentication, tenant isolation, and background processing.

## Out Of Scope

- Public object-storage provisioning, signed download URLs, virus-scanning service integration, OCR for image-only PDFs, or asynchronous job infrastructure.
- Browser local-storage persistence for uploaded documents.
- Changing canonical requirements directly from an upload; uploads still create pending proposals only.
- Supporting arbitrary office/archive formats in this task.

## Acceptance Criteria

- [ ] The adjustment composer has a structured, readable UI with labels, helper copy, validation, disabled/submitting states, and clear success/error feedback.
- [ ] A user can submit a Markdown file, a text-based PDF, a typed note, or a combination of note and file.
- [ ] Empty note-plus-file submissions are rejected; valid file types and configured size limits are enforced server-side.
- [ ] The selected file can be removed before submit and its name/type/size are visible.
- [ ] Markdown and PDF content become one attributed source and one pending reconciliation proposal through the existing approval flow.
- [ ] Invalid, oversized, unreadable, or unsupported files create no proposal and return an actionable error.
- [ ] Existing JSON-only adjustment requests remain compatible.
- [ ] Uploaded content is stored server-side through a local storage implementation, with no browser local-storage usage.
- [ ] Focused API/dashboard tests, typecheck, lint, and build pass.
- [ ] Semantic RAG remains a follow-up deliverable: vector upsert during ingestion, sqlite-vec search, Qdrant selection, and `vectorSearch` provenance tests must pass before it is claimed complete.

## Technical Decisions

- Use a multipart form endpoint for new uploads while retaining the existing JSON endpoint behavior for text-only callers.
- Keep local file writing isolated for path safety and testability; keep PDF extraction separate from persistence. Do not introduce a cloud storage interface or SDK in MVP 1.
- Use a conservative initial upload size limit documented in the API contract; make it configurable before public deployment.
- Use Anvia's local Transformers integration with `@anvia/transformers` for both Qdrant and sqlite-vec. Use the package's built-in default model (`Xenova/all-MiniLM-L6-v2`) as the single source of truth; do not duplicate the model name in Trachex code, environment variables, or user configuration.
- Preserve Anvia's default model behavior and document only its operational consequences: first-run model download, local cache, offline availability after caching, and package/model licensing.

## Current Implementation Boundary

- Upload and multipart adjustment ingestion are implemented with local filesystem storage and PDF/Markdown validation.
- The agent's existing `search_context` tool remains backed by verified SQLite FTS5 retrieval.
- Full semantic indexing is deferred: the current ingestion path has no vector upsert lifecycle, and Qdrant runtime selection is not wired. FTS5 results must not be presented as embeddings-based retrieval.
