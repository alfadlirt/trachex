import type {
  AdjustmentJob,
  AgentRun,
  ChatMessage,
  ChatSession,
  Chunk,
  CompletionAudit,
  ErrorRecord,
  EvidenceReference,
  ExportArtifact,
  Impact,
  Project,
  Proposal,
  ProposalVersion,
  Repository,
  RepositoryPath,
  Requirement,
  RequirementRelationship,
  ReviewFinding,
  Scenario,
  Snapshot,
  Source,
  Subject,
  Ticket,
} from './entities.ts';

export interface ProjectRepository {
  create(project: Project): Promise<Project>;
  findBySlug(slug: string, includeArchived?: boolean): Promise<Project | null>;
  findById(id: string): Promise<Project | null>;
  list(includeArchived?: boolean): Promise<Project[]>;
  update(project: Project): Promise<Project>;
  archive?(id: string): Promise<void>;
  permanentDelete?(id: string, force: boolean): Promise<void>;
}

export interface RepositoryRepository {
  create(repository: Repository): Promise<Repository>;
  addPath(path: RepositoryPath): Promise<RepositoryPath>;
  findById(id: string): Promise<Repository | null>;
  listGlobal(): Promise<Repository[]>;
  listByProject(projectId: string): Promise<Repository[]>;
  findByProjectAndSlug(projectId: string, slug: string): Promise<Repository | null>;
  listPaths(repositoryId: string): Promise<RepositoryPath[]>;
  remove(id: string): Promise<void>;
  listBySubject(subjectId: string): Promise<Repository[]>;
  attachToSubject(subjectId: string, repositoryId: string): Promise<void>;
  detachFromSubject(subjectId: string, repositoryId: string): Promise<void>;
}

export interface TicketRepository {
  create(ticket: Ticket): Promise<Ticket>;
  findByProjectAndKey(projectId: string, key: string): Promise<Ticket | null>;
  findById(id: string): Promise<Ticket | null>;
  listByProject(projectId: string): Promise<Ticket[]>;
  update(ticket: Ticket): Promise<Ticket>;
}

export interface SubjectRepository {
  create(subject: Subject): Promise<Subject>;
  findById(id: string): Promise<Subject | null>;
  findByProjectAndName(projectId: string, name: string): Promise<Subject | null>;
  listByProject(projectId: string, includeArchived?: boolean): Promise<Subject[]>;
  update(subject: Subject): Promise<Subject>;
  archive?(id: string): Promise<void>;
  permanentDelete?(id: string, force: boolean): Promise<void>;
}

export interface SnapshotRepository {
  create(snapshot: Snapshot): Promise<Snapshot>;
  findById(id: string): Promise<Snapshot | null>;
  findByProjectAndHash(projectId: string, contentHash: string): Promise<Snapshot | null>;
  listByProject(projectId: string): Promise<Snapshot[]>;
  listByTicketSource(ticketId: string): Promise<Snapshot[]>;
}

export interface SourceRepository {
  create(source: Source): Promise<Source>;
  findById(id: string): Promise<Source | null>;
  listByTicket(ticketId: string): Promise<Source[]>;
}

export interface AdjustmentJobRepository {
  create(job: AdjustmentJob): Promise<AdjustmentJob>;
  findById(id: string): Promise<AdjustmentJob | null>;
  findActiveByTicket(ticketId: string): Promise<AdjustmentJob | null>;
  listByTicket(ticketId: string): Promise<AdjustmentJob[]>;
  update(job: AdjustmentJob): Promise<AdjustmentJob>;
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
  listSupersededByTicket(ticketId: string): Promise<Requirement[]>;
  listArchivedByTicket?(ticketId: string): Promise<Requirement[]>;
  update(requirement: Requirement): Promise<Requirement>;
  archiveSubtree?(id: string): Promise<void>;
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
  listByTicket?(ticketId: string): Promise<ChatSession[]>;
  update(session: ChatSession): Promise<ChatSession>;
  addMessage(message: ChatMessage): Promise<ChatMessage>;
  listMessages(sessionId: string): Promise<ChatMessage[]>;
  recordError(error: ErrorRecord): Promise<ErrorRecord>;
}

export interface ExportRepository {
  create(artifact: ExportArtifact): Promise<ExportArtifact>;
  listByProject(projectId: string): Promise<ExportArtifact[]>;
}

export interface AgentRepository {
  createRun(run: AgentRun): Promise<AgentRun>;
  listRuns(subjectId: string): Promise<AgentRun[]>;
  createFinding(finding: ReviewFinding): Promise<ReviewFinding>;
  listFindings(subjectId: string): Promise<ReviewFinding[]>;
  updateFinding(finding: ReviewFinding): Promise<ReviewFinding>;
  createEvidenceReference(reference: EvidenceReference): Promise<EvidenceReference>;
  listEvidenceReferences(subjectId: string): Promise<EvidenceReference[]>;
}

export interface SearchRepository {
  search(query: string, projectId: string, limit?: number): Promise<SearchResult[]>;
}

export interface VectorIndexRepository {
  readonly available: boolean;
  indexSnapshot(snapshotId: string): Promise<void>;
  search(query: string, projectId: string, limit?: number): Promise<SearchResult[]>;
}

export interface VectorEmbedder {
  embedTexts(texts: string[]): Promise<Array<{ vector: number[] }>>;
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
  subjects: SubjectRepository;
  snapshots: SnapshotRepository;
  sources: SourceRepository;
  adjustmentJobs?: AdjustmentJobRepository;
  chunks: ChunkRepository;
  requirements: RequirementRepository;
  proposals: ProposalRepository;
  completionAudits: CompletionAuditRepository;
  sessions: SessionRepository;
  exports: ExportRepository;
  search: SearchRepository;
  vectors?: VectorIndexRepository;
  agents?: AgentRepository;
}
