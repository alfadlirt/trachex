# Specs

Target architecture for **itenirary-assistant** (Travel Itinerary Ideas): a pnpm **Turborepo** app that plans trips with a main Anvia agent and specialized sub-agents, retrieves extra context from **Qdrant** (RAG), streams chat to a React UI, and is scored with **Anvia Lens** evals.

Observability follows TECH2 (**Lens + Pino**), not Langfuse. Package names, chat URLs, and Turbo stay as in this repo. Frontend should move toward TECH2 **feature modules** with thin routes.

## Product

The user describes a trip. A **planner agent** extracts preferences, discovers places (web search), builds a day-by-day schedule, and reviews feasibility. It may also retrieve ingested documents from Qdrant (guides, handbook-style corpus, or uploaded material) so answers stay grounded. Chat sessions persist in PostgreSQL. The UI is a Vite React chat app; the API streams agent events over HTTP.

Planner workflow (prompt-enforced, not a code state machine):

1. Preference (stop and ask if `isComplete` is false)
2. Place discovery (Tavily; optional RAG context)
3. Schedule
4. Reviewer (max 2 revision cycles)
5. User confirmation, then Markdown itinerary

## Tech stack

| Layer | Choice |
| --- | --- |
| Language | TypeScript (ESM, `"type": "module"`; `NodeNext` on Node packages) |
| Package manager | pnpm **11.15.0** |
| Monorepo | **Turborepo 2.x** (`turbo run` over `apps/*` and `packages/*`) |
| Frontend | React **19**, Vite **8**, TanStack Router (file routes) |
| Styling | Tailwind CSS **4**, shadcn/ui (New York), CVA, lucide |
| API | Hono **4** on Node (`@hono/node-server`), JSONL event streams, port **8000** |
| Agents | Anvia (`AgentBuilder`, tools, memory, evals, tracing) |
| LLM | OpenAI-compatible completions via `@anvia/openai` (`OPENAI_BASE_URL` / `OPENAI_API_KEY`); default model `grok-4.3` |
| Embeddings | Local Transformers (`@anvia/transformers`, 384-dim) |
| Vector store | Qdrant (`@anvia/qdrant`) |
| Search | Tavily (`@tavily/core`) — `webSearch` + `webExtract` |
| Relational DB | PostgreSQL + Prisma **7** (`@prisma/adapter-pg`) |
| Agent memory | `@anvia/memory-prisma` (session / message / error tables) |
| Observability | **Anvia Lens** (agent traces + eval reporter) |
| Logging | **Pino** via `@anvia/logger` + `pino-pretty` |
| Validation | Zod **4** (tool inputs + sub-agent `outputSchema`) |
| Lint / format | **Biome 2 at repo root** |
| Local agent studio | `@anvia/studio` + `@anvia/sandbox` (Docker) on port **4021** (`pnpm runner:dev`) |
| Local infra | Docker Compose (`qdrant/qdrant:v1.18.2`) |

Runtime: **Node.js 20+**. Root `.env` is loaded by `dotenv-cli` (`pnpm with-env` in api and agents).

## Workspaces

Defined in `pnpm-workspace.yaml`: `apps/**` and `packages/**`. Workspace packages are not hoisted (`hoistWorkspacePackages: false`).

| Package | Path | npm name | Role |
| --- | --- | --- | --- |
| Root | `/` | `itenirary-assistant` | Turbo scripts, root Biome |
| Platform | `apps/platform` | `platform` | Chat UI (`http://localhost:3000`) |
| API | `apps/api` | `api` | HTTP + Prisma memory + agent wiring |
| Agents | `packages/agents` | `@devscale/agent` | Agent factory, sub-agents, tools, ingest, evals |

API depends on agents as `"@devscale/agent": "workspace:*"`. Agents export TypeScript source: `"exports": { ".": "./src/index.ts" }`.

## Core dependencies

### Root

| Package | Role |
| --- | --- |
| `turbo` | Task runner |
| `dotenv-cli` | Shared `.env` for nested scripts |
| `@biomejs/biome` | Lint and format (repo-wide) |

### `apps/platform`

| Package | Why |
| --- | --- |
| `react`, `react-dom` | UI |
| `@tanstack/react-router` + Vite plugin / CLI | File-based routing, `routeTree.gen.ts` |
| `@anvia/react`, `@anvia/react-ui` | `useChat`, Thread / Composer / Message |
| `tailwindcss`, `@tailwindcss/vite`, `@tailwindcss/typography` | Styling + Markdown prose |
| `radix-ui`, `class-variance-authority`, `clsx`, `tailwind-merge` | shadcn-style primitives (`cn()`) |
| `lucide-react` | Icons |
| `react-dropzone` | PDF dropzone (Kibo UI wrapper) |
| `@tanstack/react-devtools`, router-devtools | Dev overlay |
| `vite` / `@vitejs/plugin-react` | Bundler |

### `apps/api`

| Package | Why |
| --- | --- |
| `hono` / `@hono/node-server` | HTTP server + CORS |
| `@anvia/server` | `createEventStream` (JSONL) |
| `@anvia/memory-prisma` | Load/save chat memory |
| `@anvia/core` | Shared Anvia types/runtime |
| `@devscale/agent` | `createAgent`, sub-agents, tools |
| `prisma` / `@prisma/client` / `@prisma/adapter-pg` / `pg` | Postgres + generated client |

### `packages/agents` (`@devscale/agent`)

| Package | Why |
| --- | --- |
| `@anvia/core` | `AgentBuilder`, `createTool`, `asTool()`, embeddings, eval CLI |
| `@anvia/openai` | Completion models |
| `@anvia/qdrant` | Vector store + search tool |
| `@anvia/transformers` | Local embedding model (384-d) |
| `@anvia/lens` | Tracing and eval reporting |
| `@anvia/logger` | Structured logging observer |
| `@tavily/core` | `webSearch` / `webExtract` |
| `zod` | Tool and sub-agent schemas |
| `pino-pretty` | Dev log formatting |
| `@anvia/studio`, `@anvia/sandbox` | Local Studio + Docker sandbox (runner only) |

pnpm should allow native builds for Prisma, esbuild, onnxruntime, and related packages (same idea as TECH2 Qdrant/ONNX pins).

## Directory map

Current layout plus target additions (`documents/`, Compose, ingest, evals, Qdrant tool, root Biome).

```text
.
├── package.json              # root turbo scripts
├── pnpm-workspace.yaml
├── turbo.json
├── biome.json                # target: root Biome (not platform-only)
├── docker-compose.dev.yml    # target: Qdrant
├── .env.example
├── documents/                # target: RAG corpus (md / html)
├── apps/
│   ├── platform/
│   │   ├── src/
│   │   │   ├── main.tsx
│   │   │   ├── router.tsx
│   │   │   ├── routes/       # thin: __root, index, $sessionId
│   │   │   ├── modules/      # feature modules (chat, attachment)
│   │   │   ├── components/   # ui/ (shadcn), kibo-ui/dropzone
│   │   │   └── lib/utils.ts
│   │   ├── vite.config.ts
│   │   └── components.json
│   └── api/
│       ├── prisma/
│       ├── prisma.config.ts
│       └── src/
│           ├── index.ts
│           ├── modules/chat/
│           └── utils/        # prisma, initAgent
└── packages/
    └── agents/
        └── src/
            ├── index.ts
            ├── agent.ts
            ├── tracing.ts            # Lens (not Langfuse)
            ├── providers/openai.ts
            ├── tools/
            │   ├── web-search.ts
            │   └── handbook-search.ts  # target: Qdrant asTool
            ├── scripts/ingest-handbook.ts
            ├── prompts/
            ├── runner-dev.ts         # Anvia Studio
            ├── evals/                # target: Lens eval CLI
            └── sub-agents/
                ├── preferance/       # spelling as in repo
                ├── place/
                ├── schedule/
                └── reviewer/
```

Generated / local (not source of truth): `apps/api/src/generated/prisma`, `apps/platform/src/routeTree.gen.ts`.

### Platform (target modules)

Keep URLs **`/`** and **`/$sessionId`**. Move chat composition out of fat route files:

```text
apps/platform/src/
├── routes/                 # loaders + compose pages only
└── modules/chat/           # barrel, types, hooks, components
    ├── index.ts
    ├── types.ts
    ├── hooks/
    └── components/         # thread, sidebar/list, composer, tool UI
```

Internal imports: `@/*` and `#/*` → `src/*`. Attachment stays under `modules/attachment`.

### API

Hono on **PORT** (default **8000**). Chat under `modules/chat/` (router + `data/*.repository.ts`). Shared clients in `utils/`.

### Agents

Shared library consumed by the API (`workspace:*`). Sub-agents keep `index.ts` / `prompt.ts` / `schema.ts`. Ingest and evals live next to tools, not in the API.

## Runtime topology

```text
Browser (Vite :3000)
    │  REST + JSONL stream
    ▼
Hono /api/chat  ──► Prisma memory (Postgres)
    │
    ▼
main-agent (Anvia)
    ├── preference_agent (Zod PreferenceSchema)
    ├── place_agent + Tavily tools
    ├── schedule_agent (Zod itinerary)
    ├── reviewer_agent (Zod scores)
    ├── documentSearch ──► Qdrant (ingested chunks)
    └── observers: Pino + Lens traces
```

Optional: `pnpm runner:dev` serves Anvia Studio on **4021** with the same sub-agents plus Docker sandbox tools (not used by HTTP `initAgent` unless wired later).

Chat sessions (this repo’s URLs):

1. `POST /api/chat/new` returns a `sessionId` UUID (no DB row until first message).
2. Platform navigates to `/$sessionId` and streams `POST /api/chat/:sessionId`.
3. API builds an agent with Prisma memory, prompts it, and returns `createEventStream(..., { format: "jsonl" })`.
4. `@anvia/react` `useChat` hydrates via `initialMessagesFromMemory` and renders the stream, including tool parts.

## Patterns

### Monorepo and env

- Turbo filters `./apps/*` for `dev` / `build` / `start`.
- API `build` depends on `db:generate` (`apps/api/turbo.json`).
- Nested packages run Prisma, ingest, evals, and the agent runner with `dotenv -e ../../.env`.
- Apps do not own agent logic. `api` imports `createAgent` from `@devscale/agent`. The platform talks only to HTTP.

### API: Hono modules

- App composes routers: `new Hono().use(cors()).route("/api/chat", chatRouter)`.
- ESM Node: imports use `.js` extensions while sources are `.ts`.

Chat HTTP surface (keep):

| Method | Path | Behavior |
| --- | --- | --- |
| `GET` | `/api/chat` | List recent `AgentMemorySession` rows |
| `GET` | `/api/chat/:sessionId` | Load memory messages for the session |
| `POST` | `/api/chat/new` | Return a new `sessionId` (UUID) |
| `POST` | `/api/chat/:sessionId` | Last user message → `agent.session().prompt().stream()` as JSONL |

Target: implement `POST /api/documents` so the platform dropzone is not a dead client.

### Persistence vs RAG

Prisma is **chat memory**, not the RAG corpus. Models: `AgentMemorySession`, `AgentMemoryMessage`, `AgentMemoryError`. Client generated to `apps/api/src/generated/prisma` with `PrismaPg` + `DATABASE_URL`.

Handbook / guide content lives in **Qdrant**. Ingest is a **script**, not a service: split markdown on `## ` headings, embed locally (384-d), upsert a named collection.

### Agents: factory + sub-agents as tools

`createAgent` wraps `AgentBuilder`: shared base instructions, tools, optional memory, Zod `outputSchema`, **Pino + Lens observers** (Lens `createFromEnv({ optional: true })`).

Sub-agents:

```text
sub-agents/<name>/
  index.ts    # createXAgent(tracing)
  prompt.ts
  schema.ts
```

The main agent does not invent itineraries. It calls sub-agents via `.asTool({ name, description })`. Sub-agents do not share chat history; the planner must pass full JSON in each tool `prompt`.

Place agent owns Tavily (`createWebTools()`). Document search is Qdrant exposed with `.asTool({ name, description, topK })`.

### Streaming + tracing

Chat uses `.stream()`, `.withTrace({ sessionId })`, and `flushAgentTracing()` in `finally`. Evals use `.send()`. Model choice stays in `providers/openai.ts`.

### Frontend: thin routes + feature modules (target)

- File routes stay `__root.tsx`, `index.tsx`, `$sessionId.tsx`.
- Home `loader` lists sessions; session `loader` hydrates memory.
- Pages compose `modules/chat` (list/sidebar, thread, composer, tool-call UI).
- Message parts: reasoning, text (Markdown for assistant), tool, attachment, error, data.
- shadcn New York + Kibo dropzone remain.

### Evals as a CLI target

`pnpm eval` runs `runEvalCli` over itinerary (+ retrieval) cases, filtered by `metadata.metric`. Results go to Lens. The eval agent uses a distinct `agentId` and does **not** attach Prisma memory.

### Local Studio

`pnpm runner:dev` keeps Studio + sandbox for interactive agent work. HTTP chat path stays Prisma memory + Lens/Pino, without requiring Docker sandbox tools.

## Data and evals

**Corpus.** `documents/` — ingestable markdown (destination guides and/or handbook-style material). Treat as grounding context for the planner, not a replacement for preference/place/schedule/reviewer.

**Qdrant.** Vector size **384**, search `topK: 5`. Collection name TBD at ingest (TECH2 used `devscale_employee_handbook`).

**Eval harness (from TECH2, cases adapted to this product).** Metrics: answer relevancy, faithfulness, gEval quality, `contains()`, `exactMatch()`. Judge model: `OPENAI_JUDGE_MODEL` (fallback `OPENAI_MODEL` / default completion model).

Suggested case mix (adjust when writing `evals/cases.ts`):

| Category | Intent |
| --- | --- |
| Preference extraction | Incomplete vs complete trips |
| Place / schedule / review | Tool order and JSON handoff |
| RAG grounding | Answers cite ingested chunks |
| Abstention / guardrails | Missing prefs, bad routes, off-policy |

## Environment and commands

| Variable | Used for |
| --- | --- |
| `DATABASE_URL` | Prisma / memory |
| `OPENAI_BASE_URL`, `OPENAI_API_KEY` | LLM |
| `OPENAI_JUDGE_MODEL` / `OPENAI_MODEL` | Eval judge (optional) |
| `TAVILY_API_KEY` | Place search (optional at runtime) |
| Lens credentials | Tracing + eval reporter (optional; `createFromEnv({ optional: true })`) |
| `NODE_ENV` | Logger / Lens environment |
| `REDIS_*`, `UPLOAD_DIR` | In `.env.example`; wire when documents upload is implemented |

Platform currently hardcodes `http://localhost:8000` for API fetches.

```sh
pnpm install
cp .env.example .env
docker compose -f docker-compose.dev.yml up -d   # Qdrant :6333 / :6334
pnpm db:generate && pnpm db:migrate
pnpm ingest:handbook   # or equivalent ingest script
pnpm dev               # turbo: platform + API
pnpm eval
pnpm runner:dev        # Anvia Studio :4021
```

Postgres must be reachable at `DATABASE_URL`. Compose starts **Qdrant**; Postgres is still external (or add it to Compose later).

## Scripts (root)

| Command | Meaning |
| --- | --- |
| `pnpm dev` | API (tsx watch) + platform (Vite 3000) via Turbo |
| `pnpm build` / `start` / `preview` | App build and serve |
| `pnpm db:generate` / `db:migrate` / `db:deploy` / `db:studio` | Prisma via api package |
| `pnpm ingest:handbook` | Chunk, embed, upsert Qdrant (target) |
| `pnpm eval` | Lens eval CLI (target) |
| `pnpm runner:dev` | Anvia Studio for `@devscale/agent` |

## Gaps vs current repo

- Observability is still **Langfuse** (`@anvia/langfuse`); spec target is **Lens + Pino**.
- No Qdrant, ingest script, `documents/`, or Docker Compose yet.
- No Lens eval package or `pnpm eval`.
- Biome is **platform-only**; spec target is **root** `biome.json`.
- Chat UI posts PDFs to `POST /api/documents`; Hono only mounts `/api/chat`.
- Redis and `UPLOAD_DIR` are unused in TypeScript.
- Docker sandbox tools are wired in `runner-dev.ts` only, not in `initAgent`.
- Session chat UI still lives mostly in `$sessionId.tsx`; spec target is `modules/chat` with thin routes.
