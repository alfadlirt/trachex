export interface Project {
  id: string;
  slug: string;
  name: string;
  description: string | null;
}

export interface Ticket {
  id: string;
  projectId: string;
  key: string;
  title: string;
  description: string | null;
}

export interface Requirement {
  id: string;
  projectId: string;
  ticketId: string;
  title: string;
  description: string | null;
  sourceLocation: string | null;
  lifecycleStatus: 'active' | 'superseded';
  devStatus: 'unchecked' | 'checked';
  parentLabel: string | null;
}

export interface Proposal {
  id: string;
  ticketId: string;
  kind: string;
  status: 'pending' | 'approved' | 'rejected';
}

export interface ProposalReviewDraft {
  title: string;
  description: string | null;
  sourceLocation: string | null;
  implementationItems: string[];
  successCriteria: string[];
  impacts: { kind: 'service' | 'api' | 'page'; value: string }[];
  scenarios: string[];
  supersedes: string[];
}

export interface ProposalReview {
  proposalId: string;
  kind: string;
  status: Proposal['status'];
  source: {
    type: string;
    attribution: string | null;
    location: string | null;
    sourceEventAt: string | null;
    ingestedAt: string;
  } | null;
  drafts: ProposalReviewDraft[];
  originalDrafts: ProposalReviewDraft[];
  isEdited: boolean;
  version: number;
  supersessionTargets: { id: string; title: string; status: string }[];
  error: string | null;
}

export interface Impact {
  id: string;
  requirementId: string;
  kind: 'service' | 'api' | 'page';
  value: string;
}

export interface Scenario {
  id: string;
  requirementId: string;
  text: string;
  reviewed: boolean;
}

export interface TimelineEvent {
  at: string;
  kind: string;
  description: string;
}

export interface TicketCanvas {
  project: Project;
  ticket: Ticket;
  checklist: Requirement[];
  proposals: Proposal[];
  proposalReviews: ProposalReview[];
  impacts: Impact[];
  scenarios: Scenario[];
  timeline: TimelineEvent[];
}

export interface ChatMessage {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant' | 'tool';
  content: string;
  createdAt: string;
}

export interface ChatSession {
  session: { id: string; updatedAt: string };
  messages: ChatMessage[];
  title: string;
  preview: string;
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
    throw new Error(body.error?.message ?? `request failed: ${res.status}`);
  }
  return (await res.json()) as T;
}

export const api = {
  listProjects: () => request<{ projects: Project[] }>('/api/projects'),
  createProject: (input: { slug: string; name: string }) =>
    request<{ project: Project }>('/api/projects', {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  listTickets: (projectId: string) =>
    request<{ project: Project; tickets: Ticket[] }>(`/api/projects/${projectId}/tickets`),
  getCanvas: (projectId: string, ticketKey: string) =>
    request<TicketCanvas>(`/api/projects/${projectId}/tickets/${ticketKey}`),
  getChatHistory: (projectId: string, ticketKey: string) =>
    request<{ sessions: ChatSession[] }>(`/api/chat/${projectId}/${ticketKey}/history`),
  createChatSession: (projectId: string, ticketKey: string) =>
    request<{ session: { id: string; updatedAt: string } }>(
      `/api/chat/${projectId}/${ticketKey}/sessions`,
      { method: 'POST' },
    ),
  addAdjustment: (
    projectId: string,
    ticketKey: string,
    input: { source: string; attribution?: string; note: string },
  ) =>
    request<{ proposal: Proposal }>(`/api/projects/${projectId}/tickets/${ticketKey}/adjustments`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  approveProposal: (proposalId: string) =>
    request<{ status: string }>(`/api/proposals/${proposalId}/approve`, { method: 'POST' }),
  rejectProposal: (proposalId: string) =>
    request<{ status: string }>(`/api/proposals/${proposalId}/reject`, { method: 'POST' }),
  editProposal: (
    projectId: string,
    ticketKey: string,
    proposalId: string,
    editedOutput: ProposalReviewOutput,
  ) =>
    request<{ version: unknown }>(
      `/api/projects/${projectId}/tickets/${ticketKey}/proposals/${proposalId}/edit`,
      {
        method: 'POST',
        body: JSON.stringify({ editedOutput }),
      },
    ),
  resetProposal: (projectId: string, ticketKey: string, proposalId: string) =>
    request<{ version: unknown }>(
      `/api/projects/${projectId}/tickets/${ticketKey}/proposals/${proposalId}/reset`,
      { method: 'POST' },
    ),
  checkRequirement: (requirementId: string) =>
    request<{ status: string }>(`/api/requirements/${requirementId}/check`, {
      method: 'POST',
      body: JSON.stringify({ confirm: true }),
    }),
  exportSummary: (projectId: string, ticketKey: string, format: 'markdown' | 'json') =>
    fetch(`/api/projects/${projectId}/tickets/${ticketKey}/export?format=${format}`).then((r) =>
      r.text(),
    ),
};

export interface ProposalReviewOutput {
  kind: 'extraction' | 'reconciliation';
  requirements?: ProposalReviewDraft[];
  create?: ProposalReviewDraft[];
}
