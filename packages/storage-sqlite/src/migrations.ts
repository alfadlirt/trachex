export interface Migration {
  version: number;
  name: string;
  sql: string;
}

export const SCHEMA_VERSION = 9;

export const migrations: Migration[] = [
  {
    version: 1,
    name: 'initial-schema',
    sql: `
CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE repositories (
  id TEXT PRIMARY KEY,
  project_id TEXT REFERENCES projects(id),
  slug TEXT NOT NULL,
  service_name TEXT,
  url TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(project_id, slug)
);

CREATE TABLE repository_paths (
  id TEXT PRIMARY KEY,
  repository_id TEXT NOT NULL REFERENCES repositories(id),
  path TEXT NOT NULL,
  valid_from TEXT NOT NULL,
  valid_to TEXT
);

CREATE TABLE tickets (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  key TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(project_id, key)
);

CREATE TABLE snapshots (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  repository_id TEXT REFERENCES repositories(id),
  rel_path TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  content_kind TEXT NOT NULL,
  size INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE sources (
  id TEXT PRIMARY KEY,
  ticket_id TEXT NOT NULL REFERENCES tickets(id),
  type TEXT NOT NULL,
  attribution TEXT,
  source_event_at TEXT,
  ingested_at TEXT NOT NULL,
  snapshot_id TEXT REFERENCES snapshots(id),
  location TEXT
);

CREATE TABLE chunks (
  id TEXT PRIMARY KEY,
  snapshot_id TEXT NOT NULL REFERENCES snapshots(id),
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  location TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE requirements (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  ticket_id TEXT NOT NULL REFERENCES tickets(id),
  title TEXT NOT NULL,
  description TEXT,
  source_id TEXT REFERENCES sources(id),
  source_location TEXT,
  lifecycle_status TEXT NOT NULL DEFAULT 'active',
  dev_status TEXT NOT NULL DEFAULT 'unchecked',
  parent_label TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE requirement_relationships (
  id TEXT PRIMARY KEY,
  from_requirement_id TEXT NOT NULL REFERENCES requirements(id),
  to_requirement_id TEXT NOT NULL REFERENCES requirements(id),
  type TEXT NOT NULL DEFAULT 'supersedes',
  created_at TEXT NOT NULL
);

CREATE TABLE impacts (
  id TEXT PRIMARY KEY,
  requirement_id TEXT NOT NULL REFERENCES requirements(id),
  kind TEXT NOT NULL,
  value TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE scenarios (
  id TEXT PRIMARY KEY,
  requirement_id TEXT NOT NULL REFERENCES requirements(id),
  text TEXT NOT NULL,
  reviewed INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE proposals (
  id TEXT PRIMARY KEY,
  ticket_id TEXT NOT NULL REFERENCES tickets(id),
  kind TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  source_id TEXT REFERENCES sources(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE proposal_versions (
  id TEXT PRIMARY KEY,
  proposal_id TEXT NOT NULL REFERENCES proposals(id),
  version INTEGER NOT NULL,
  model_output TEXT NOT NULL,
  edited_output TEXT,
  reviewed_at TEXT,
  created_at TEXT NOT NULL,
  UNIQUE(proposal_id, version)
);

CREATE TABLE completion_audits (
  id TEXT PRIMARY KEY,
  requirement_id TEXT NOT NULL REFERENCES requirements(id),
  actor_type TEXT NOT NULL,
  actor_id TEXT,
  note TEXT,
  checked_at TEXT NOT NULL
);

CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  project_id TEXT REFERENCES projects(id),
  ticket_id TEXT REFERENCES tickets(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES sessions(id),
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE errors (
  id TEXT PRIMARY KEY,
  session_id TEXT REFERENCES sessions(id),
  proposal_id TEXT REFERENCES proposals(id),
  message TEXT NOT NULL,
  stack TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE export_artifacts (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  ticket_id TEXT REFERENCES tickets(id),
  format TEXT NOT NULL,
  path TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX idx_repositories_project ON repositories(project_id);
CREATE INDEX idx_tickets_project ON tickets(project_id);
CREATE INDEX idx_snapshots_project ON snapshots(project_id);
CREATE INDEX idx_sources_ticket ON sources(ticket_id);
CREATE INDEX idx_chunks_snapshot ON chunks(snapshot_id);
CREATE INDEX idx_requirements_ticket ON requirements(ticket_id);
CREATE INDEX idx_requirements_project ON requirements(project_id);
CREATE INDEX idx_relationships_from ON requirement_relationships(from_requirement_id);
CREATE INDEX idx_relationships_to ON requirement_relationships(to_requirement_id);
CREATE INDEX idx_impacts_requirement ON impacts(requirement_id);
CREATE INDEX idx_scenarios_requirement ON scenarios(requirement_id);
CREATE INDEX idx_proposals_ticket ON proposals(ticket_id);
CREATE INDEX idx_versions_proposal ON proposal_versions(proposal_id);
CREATE INDEX idx_audits_requirement ON completion_audits(requirement_id);
CREATE INDEX idx_messages_session ON messages(session_id);
CREATE INDEX idx_exports_project ON export_artifacts(project_id);

CREATE VIRTUAL TABLE chunks_fts USING fts5(
  content,
  location,
  rel_path,
  project_id,
  snapshot_id,
  chunk_id,
  tokenize = 'unicode61'
);

CREATE TRIGGER chunks_fts_ai AFTER INSERT ON chunks BEGIN
  INSERT INTO chunks_fts (content, location, rel_path, project_id, snapshot_id, chunk_id)
  VALUES (
    NEW.content,
    NEW.location,
    (SELECT rel_path FROM snapshots WHERE id = NEW.snapshot_id),
    (SELECT project_id FROM snapshots WHERE id = NEW.snapshot_id),
    NEW.snapshot_id,
    NEW.id
  );
END;

CREATE TRIGGER chunks_fts_ad AFTER DELETE ON chunks BEGIN
  DELETE FROM chunks_fts WHERE chunk_id = OLD.id;
END;
`,
  },
  {
    version: 2,
    name: 'checklist-display-order',
    sql: `
ALTER TABLE requirements ADD COLUMN display_order INTEGER NOT NULL DEFAULT 0;

UPDATE requirements
SET display_order = (
  SELECT COUNT(*) FROM requirements r2
  WHERE r2.ticket_id = requirements.ticket_id
    AND (r2.created_at < requirements.created_at
         OR (r2.created_at = requirements.created_at AND r2.id < requirements.id))
);

CREATE INDEX idx_requirements_order ON requirements(ticket_id, display_order, created_at);
`,
  },
  {
    version: 3,
    name: 'completion-audit-action',
    sql: `
ALTER TABLE completion_audits ADD COLUMN action TEXT NOT NULL DEFAULT 'check';
`,
  },
  {
    version: 4,
    name: 'source-note',
    sql: `
ALTER TABLE sources ADD COLUMN note TEXT;
`,
  },
  {
    version: 5,
    name: 'subject-identity-and-tree-parent',
    sql: `
CREATE TABLE subjects (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id),
  name TEXT NOT NULL,
  description TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(project_id, name)
);
ALTER TABLE requirements ADD COLUMN parent_id TEXT REFERENCES requirements(id);
CREATE INDEX idx_subjects_project ON subjects(project_id);
CREATE INDEX idx_requirements_parent ON requirements(ticket_id, parent_id, display_order);
`,
  },
  {
    version: 6,
    name: 'global-repositories-and-subject-assignment',
    sql: `
CREATE TABLE subject_repositories (
  subject_id TEXT NOT NULL REFERENCES subjects(id),
  repository_id TEXT NOT NULL REFERENCES repositories(id),
  created_at TEXT NOT NULL,
  PRIMARY KEY (subject_id, repository_id)
);
CREATE INDEX idx_subject_repositories_repo ON subject_repositories(repository_id);
`,
  },
  {
    version: 7,
    name: 'lifecycle-agent-activity',
    sql: `
ALTER TABLE projects ADD COLUMN lifecycle_status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE subjects ADD COLUMN lifecycle_status TEXT NOT NULL DEFAULT 'active';
CREATE TABLE agent_runs (id TEXT PRIMARY KEY, subject_id TEXT NOT NULL REFERENCES subjects(id), kind TEXT NOT NULL, metadata TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE TABLE review_findings (id TEXT PRIMARY KEY, subject_id TEXT NOT NULL REFERENCES subjects(id), kind TEXT NOT NULL, severity TEXT NOT NULL, confidence REAL NOT NULL, summary TEXT NOT NULL, evidence TEXT NOT NULL, affected_requirement_id TEXT, affected_repository_id TEXT, suggested_action TEXT, status TEXT NOT NULL DEFAULT 'pending', run_id TEXT NOT NULL REFERENCES agent_runs(id), created_at TEXT NOT NULL);
CREATE INDEX idx_agent_runs_subject ON agent_runs(subject_id);
CREATE INDEX idx_review_findings_subject ON review_findings(subject_id);
`,
  },
  {
    version: 8,
    name: 'evidence-references',
    sql: `
CREATE TABLE evidence_references (id TEXT PRIMARY KEY, subject_id TEXT NOT NULL REFERENCES subjects(id), source_id TEXT REFERENCES sources(id), chunk_id TEXT, excerpt TEXT NOT NULL, retrieval_metadata TEXT NOT NULL, created_at TEXT NOT NULL);
CREATE INDEX idx_evidence_references_subject ON evidence_references(subject_id);
`,
  },
  {
    version: 9,
    name: 'semantic-vector-index',
    sql: `
CREATE TABLE vector_chunks (
  chunk_id TEXT PRIMARY KEY REFERENCES chunks(id) ON DELETE CASCADE,
  snapshot_id TEXT NOT NULL REFERENCES snapshots(id) ON DELETE CASCADE,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  embedding BLOB NOT NULL
);
CREATE INDEX idx_vector_chunks_project ON vector_chunks(project_id);
`,
  },
];
