import type {
  ChatMessage,
  ChatSession,
  Chunk,
  CompletionAudit,
  ErrorRecord,
  ExportArtifact,
  Impact,
  Project,
  Proposal,
  ProposalVersion,
  Repository,
  RepositoryPath,
  Requirement,
  RequirementRelationship,
  Scenario,
  Snapshot,
  Source,
  Ticket,
} from './entities.ts';

export interface ProjectRepository {
  create(project: Project): Promise<Project>;
  findBySlug(slug: string): Promise<Project | null>;
  findById(id: string): Promise<Project | null>;
  list(): Promise<Project[]>;
  update(project: Project): Promise<Project>;
}

export interface RepositoryRepository {
  create(repository: Repository): Promise<Repository>;
  addPath(path: RepositoryPath): Promise<RepositoryPath>;
  listByProject(projectId: string): Promise<Repository[]>;
  findByProjectAndSlug(projectId: string, slug: string): Promise<Repository | null>;
  listPaths(repositoryId: string): Promise<RepositoryPath[]>;
}

export interface TicketRepository {
  create(ticket: Ticket): Promise<Ticket>;
  findByProjectAndKey(projectId: string, key: string): Promise<Ticket | null>;
  findById(id: string): Promise<Ticket | null>;
  listByProject(projectId: string): Promise<Ticket[]>;
  update(ticket: Ticket): Promise<Ticket>;
}

export interface SnapshotRepository {
  create(snapshot: Snapshot): Promise<Snapshot>;
  findById(id: string): Promise<Snapshot | null>;
  listByProject(projectId: string): Promise<Snapshot[]>;
  listByTicketSource(ticketId: string): Promise<Snapshot[]>;
}

export interface SourceRepository {
  create(source: Source): Promise<Source>;
  findById(id: string): Promise<Source | null>;
  listByTicket(ticketId: string): Promise<Source[]>;
}

export interface ChunkRepository {
  insertMany(chunks: Chunk[]): Promise<void>;
  listBySnapshot(snapshotId: string): Promise<Chunk[]>;
}

export interface RequirementRepository {
  create(requirement: Requirement): Promise<Requirement>;
  findById(id: string): Promise<Requirement | null>;
  listByTicket(ticketId: string): Promise<Requirement[]>;
  listActiveByTicket(ticketId: string): Promise<Requirement[]>;
  update(requirement: Requirement): Promise<Requirement>;
  addRelationship(relationship: RequirementRelationship): Promise<RequirementRelationship>;
  listRelationshipsByTicket(ticketId: string): Promise<RequirementRelationship[]>;
  addImpact(impact: Impact): Promise<Impact>;
  listImpactsByTicket(ticketId: string): Promise<Impact[]>;
  addScenario(scenario: Scenario): Promise<Scenario>;
  listScenariosByTicket(ticketId: string): Promise<Scenario[]>;
}

export interface ProposalRepository {
  create(proposal: Proposal): Promise<Proposal>;
  findById(id: string): Promise<Proposal | null>;
  listByTicket(ticketId: string): Promise<Proposal[]>;
  listPendingByTicket(ticketId: string): Promise<Proposal[]>;
  update(proposal: Proposal): Promise<Proposal>;
  addVersion(version: ProposalVersion): Promise<ProposalVersion>;
  listVersions(proposalId: string): Promise<ProposalVersion[]>;
}

export interface CompletionAuditRepository {
  create(audit: CompletionAudit): Promise<CompletionAudit>;
  listByRequirement(requirementId: string): Promise<CompletionAudit[]>;
}

export interface SessionRepository {
  create(session: ChatSession): Promise<ChatSession>;
  findById(id: string): Promise<ChatSession | null>;
  update(session: ChatSession): Promise<ChatSession>;
  addMessage(message: ChatMessage): Promise<ChatMessage>;
  listMessages(sessionId: string): Promise<ChatMessage[]>;
  recordError(error: ErrorRecord): Promise<ErrorRecord>;
}

export interface ExportRepository {
  create(artifact: ExportArtifact): Promise<ExportArtifact>;
  listByProject(projectId: string): Promise<ExportArtifact[]>;
}

export interface SearchRepository {
  search(query: string, projectId: string, limit?: number): Promise<SearchResult[]>;
}

export interface SearchResult {
  chunkId: string;
  snapshotId: string;
  projectId: string;
  content: string;
  location: string | null;
  relPath: string | null;
  score: number;
}

export interface UnitOfWork {
  projects: ProjectRepository;
  repositories: RepositoryRepository;
  tickets: TicketRepository;
  snapshots: SnapshotRepository;
  sources: SourceRepository;
  chunks: ChunkRepository;
  requirements: RequirementRepository;
  proposals: ProposalRepository;
  completionAudits: CompletionAuditRepository;
  sessions: SessionRepository;
  exports: ExportRepository;
  search: SearchRepository;
}
