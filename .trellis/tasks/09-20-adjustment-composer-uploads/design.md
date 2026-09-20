# Adjustment Composer And Upload Design

## Data Flow

```text
Dashboard composer
  -> multipart adjustment request
API validation
  -> upload validation + storage adapter
  -> Markdown decode or PDF text extraction
  -> chunking + FTS5/vector indexing
  -> existing runReconciliation()
  -> source snapshot + pending proposal
```

The existing JSON request remains supported:

```json
{
  "source": "chat",
  "attribution": "Budi",
  "note": "The cap should be 15%."
}
```

The multipart request uses fields `source`, optional `attribution`, optional
`note`, and optional `file`. The file field is limited to one document. The
server creates one reconciliation source from the combined text, preserving
the current source attribution and pending proposal behavior.

## Local Storage

MVP 1 writes uploaded bytes into the existing application directory with
generated safe keys and never uses the raw client filename as a path. Keep this
local file-writing code isolated for path safety and testability, but do not
introduce a cloud-provider storage interface, SDK, credentials, or signed URL
flow. The source snapshot remains the canonical ingest artifact.

R2/S3, PostgreSQL, Qdrant, authentication, tenant isolation, and hosted
retention are deferred to a separate future SaaS/B2B architecture task. They
must not become hidden runtime requirements for the `npx` local installation.

## Retrieval Backends And Agent Tool

The assignment reference uses the intended agent pattern: a vector store is
wrapped as a search tool, and the agent calls that tool when it needs source
context. A future semantic-RAG task should expose one backend-neutral
`vectorSearch` tool over
the existing `SearchRepository` interface. The repository implementation is
selected at startup/configuration time, not by changing prompts or agent code.

- Default local backend: SQLite plus sqlite-vec, with FTS5 retained for exact
  identifiers and lexical fallback.
- Optional backend: Qdrant through the existing `vector` Docker Compose
  profile, selected explicitly by the user after Docker availability is
  detected.
- No automatic Docker startup, network requirement, or Qdrant-only path.
- Both backends use the same `@anvia/transformers` embedding integration. The
  package's built-in default (`Xenova/all-MiniLM-L6-v2`) is the single source
  of truth, so Trachex must not add a duplicate model constant or environment
  setting.
- Both backends return the existing `SearchResult` provenance fields.
- Uploaded documents are indexed after immutable snapshots/chunks are created;
  failed indexing must not mutate canonical requirements.

The current implementation does not yet satisfy that indexing step. The vector
table/search seam is present, but ingestion must still own a tested upsert path
for each chunk and application startup must still select/configure Qdrant or
sqlite-vec. Until then, FTS5 is the only verified retrieval backend.

Embedding generation is fixed for MVP 1: use `@anvia/transformers` and invoke
its default embedding model without overriding it. The implementation must
document model download size, first-run latency, local cache location, offline
behavior, and license. The model runs locally, so source text does not need to
leave the user's machine for embedding generation.

## Vector Tool Contract

The agent-facing tool name is `vectorSearch`, independent of the selected
backend. Its input is conceptually:

```ts
{
  query: string;
  projectId: string;
  limit?: number;
}
```

It returns ranked chunks with `SearchResult` provenance. The tool must not
expose Qdrant URLs, SQLite handles, collection names, or backend-specific
filters to the model. Backend selection belongs to application configuration.

## File Validation And Extraction

- Normalize the extension from the basename and allow only `.md`, `.markdown`,
  and `.pdf`.
- Enforce a server-side byte limit before reading the full payload into memory.
- Require PDF magic bytes (`%PDF-`) for PDF uploads; decode Markdown as UTF-8.
- Use a maintained PDF text extraction package on the server. Image-only PDFs
  are rejected as unreadable in this task rather than silently OCRed.
- Sanitize display names and never interpolate them into filesystem paths.

The exact parser package should be chosen from the current Node 20/ESM and
license-compatible ecosystem during implementation; it is not currently in
the lockfile, so dependency review is a required implementation step.

## Composer UX

The card should have a clear heading and helper text, a source type control,
attribution field, note field, dropzone/file picker, selected-file row, and
submit action. The note and file are complementary. File processing state
must disable duplicate submission and preserve the selected file until success
or explicit removal.

## MVP Boundary And Rollback

Do not alter the domain repository interfaces or proposal approval semantics.
If PDF extraction or multipart support must be rolled back, the JSON text-only
endpoint and existing composer remain usable. Local upload files should be
treated as disposable implementation artifacts; source snapshots remain the
auditable record. A future hosted deployment must be designed separately
instead of silently changing the local storage contract.
