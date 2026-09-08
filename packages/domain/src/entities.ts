export type IsoDateTime = string;

export type SourceType =
  | 'fsd'
  | 'brd'
  | 'chat'
  | 'meeting'
  | 'clarification'
  | 'uat'
  | 'manual'
  | 'context';

export type RequirementLifecycleStatus = 'active' | 'superseded';
export type RequirementDevStatus = 'unchecked' | 'checked';
export type ImpactKind = 'service' | 'api' | 'page';
export type RelationshipType = 'supersedes';
export type ProposalKind = 'extraction' | 'reconciliation' | 'impact' | 'scenario';
export type ProposalStatus = 'pending' | 'approved' | 'rejected';
export type ActorType = 'human' | 'agent';
export type MessageRole = 'user' | 'assistant' | 'tool';

export interface Project {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface Repository {
  id: string;
  projectId: string;
  slug: string;
  serviceName: string | null;
  url: string | null;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface RepositoryPath {
  id: string;
  repositoryId: string;
  path: string;
  validFrom: IsoDateTime;
  validTo: IsoDateTime | null;
}

export interface Ticket {
  id: string;
  projectId: string;
  key: string;
  title: string;
  description: string | null;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface Snapshot {
  id: string;
  projectId: string;
  repositoryId: string | null;
  relPath: string;
  contentHash: string;
  contentKind: string;
  size: number;
  createdAt: IsoDateTime;
}

export interface Source {
  id: string;
  ticketId: string;
  type: SourceType;
  attribution: string | null;
  sourceEventAt: IsoDateTime | null;
  ingestedAt: IsoDateTime;
  snapshotId: string | null;
  location: string | null;
  note: string | null;
}

export interface Chunk {
  id: string;
  snapshotId: string;
  chunkIndex: number;
  content: string;
  location: string | null;
  createdAt: IsoDateTime;
}

export interface Requirement {
  id: string;
  projectId: string;
  ticketId: string;
  title: string;
  description: string | null;
  sourceId: string | null;
  sourceLocation: string | null;
  lifecycleStatus: RequirementLifecycleStatus;
  devStatus: RequirementDevStatus;
  parentLabel: string | null;
  displayOrder: number;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface RequirementRelationship {
  id: string;
  fromRequirementId: string;
  toRequirementId: string;
  type: RelationshipType;
  createdAt: IsoDateTime;
}

export interface Impact {
  id: string;
  requirementId: string;
  kind: ImpactKind;
  value: string;
  createdAt: IsoDateTime;
}

export interface Scenario {
  id: string;
  requirementId: string;
  text: string;
  reviewed: boolean;
  createdAt: IsoDateTime;
}

export interface Proposal {
  id: string;
  ticketId: string;
  kind: ProposalKind;
  status: ProposalStatus;
  sourceId: string | null;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface ProposalVersion {
  id: string;
  proposalId: string;
  version: number;
  modelOutput: string;
  editedOutput: string | null;
  reviewedAt: IsoDateTime | null;
  createdAt: IsoDateTime;
}

export interface CompletionAudit {
  id: string;
  requirementId: string;
  actorType: ActorType;
  actorId: string | null;
  note: string | null;
  action: 'check' | 'uncheck';
  checkedAt: IsoDateTime;
}

export interface ChatSession {
  id: string;
  projectId: string | null;
  ticketId: string | null;
  createdAt: IsoDateTime;
  updatedAt: IsoDateTime;
}

export interface ChatMessage {
  id: string;
  sessionId: string;
  role: MessageRole;
  content: string;
  createdAt: IsoDateTime;
}

export interface ErrorRecord {
  id: string;
  sessionId: string | null;
  proposalId: string | null;
  message: string;
  stack: string | null;
  createdAt: IsoDateTime;
}

export interface ExportArtifact {
  id: string;
  projectId: string;
  ticketId: string | null;
  format: string;
  path: string;
  createdAt: IsoDateTime;
}
