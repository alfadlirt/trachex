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
  sourceId: string | null;
  sourceLocation: string | null;
  lifecycleStatus: 'active' | 'superseded';
  devStatus: 'unchecked' | 'checked';
  parentLabel: string | null;
  parentId: string | null;
  displayOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface Proposal {
  id: string;
  ticketId: string;
  kind: string;
  status: 'pending' | 'approved' | 'rejected';
}
export interface AdjustmentJob {
  id: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  sourceType: string;
  attribution: string | null;
  sourceLocation: string | null;
  createdAt: string;
  updatedAt: string;
  startedAt: string | null;
  completedAt: string | null;
  attempts: number;
  error: string | null;
  proposalId: string | null;
  fileName: string | null;
  fileKind: string | null;
}

export interface AdjustmentJobDetail {
  job: AdjustmentJob;
  source: {
    id: string;
    type: string;
    attribution: string | null;
    location: string | null;
    note: string | null;
    sourceEventAt: string | null;
    ingestedAt: string;
  } | null;
}

export interface SupersededEntry {
  item: SupersededItem;
  supersededById: string | null;
  supersededByTitle: string | null;
  replacement: SupersededItem | null;
  oldAudits: Array<{ id: string; action: string; actorType: string; checkedAt: string }>;
}

export interface SupersededItem {
  id: string;
  title: string;
  description: string | null;
  devStatus: string;
  lifecycleStatus: string;
  source: {
    type: string;
    attribution: string | null;
    location: string | null;
    note: string | null;
    sourceEventAt: string | null;
    ingestedAt: string;
  } | null;
  createdAt: string;
  updatedAt: string;
}

export interface ProposedOrderView {
  orderedIds: string[];
  rationale: string;
  uncertainty: string | null;
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
  proposedOrder: ProposedOrderView | null;
  orderState: 'none' | 'valid' | 'stale';
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
  superseded: SupersededEntry[];
  adjustmentJobs: AdjustmentJob[];
  adjustmentJobDetails: AdjustmentJobDetail[];
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
  const headers = new Headers(init?.headers);
  if (typeof init?.body === 'string') headers.set('Content-Type', 'application/json');
  const res = await fetch(path, {
    headers,
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
  updateProject: (projectId: string, input: { name?: string; slug?: string }) =>
    request<{ project: Project }>(`/api/projects/${projectId}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    }),
  deleteProject: (projectId: string, confirmName: string) =>
    request<{ projectId: string; status: string }>(`/api/projects/${projectId}`, {
      method: 'DELETE',
      body: JSON.stringify({ confirmName }),
    }),
  listTickets: (projectId: string) =>
    request<{ project: Project; tickets: Ticket[] }>(`/api/projects/${projectId}/tickets`),
  createTicket: (projectId: string, input: { key: string; title: string }) =>
    request<{ ticket: Ticket }>(`/api/projects/${projectId}/tickets`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  updateTicket: (projectId: string, ticketKey: string, input: { title?: string; key?: string }) =>
    request<{ ticket: Ticket }>(`/api/projects/${projectId}/tickets/${ticketKey}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    }),
  deleteTicket: (projectId: string, ticketKey: string, confirmName: string) =>
    request<{ ticketId: string; status: string }>(
      `/api/projects/${projectId}/tickets/${ticketKey}`,
      {
        method: 'DELETE',
        body: JSON.stringify({ confirmName }),
      },
    ),
  reorderChecklist: (projectId: string, ticketKey: string, orderedIds: string[]) =>
    request<{ ticketId: string; checklist: Requirement[] }>(
      `/api/projects/${projectId}/tickets/${ticketKey}/checklist/reorder`,
      { method: 'POST', body: JSON.stringify({ orderedIds }) },
    ),
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
    request<{ job: AdjustmentJob }>(`/api/projects/${projectId}/tickets/${ticketKey}/adjustments`, {
      method: 'POST',
      body: JSON.stringify(input),
    }),
  addAdjustmentUpload: (
    projectId: string,
    ticketKey: string,
    input: { source: string; attribution?: string; note?: string; file?: File },
  ) => {
    const form = new FormData();
    form.set('source', input.source);
    if (input.attribution) form.set('attribution', input.attribution);
    if (input.note) form.set('note', input.note);
    if (input.file) form.set('file', input.file);
    return request<{ job: AdjustmentJob }>(
      `/api/projects/${projectId}/tickets/${ticketKey}/adjustments`,
      { method: 'POST', body: form },
    );
  },
  listAdjustmentJobs: (projectId: string, ticketKey: string) =>
    request<{ jobs: AdjustmentJob[] }>(
      `/api/projects/${projectId}/tickets/${ticketKey}/adjustments/jobs`,
    ),
  retryAdjustment: (projectId: string, ticketKey: string, jobId: string) =>
    request<{ job: AdjustmentJob }>(
      `/api/projects/${projectId}/tickets/${ticketKey}/adjustments/jobs/${jobId}/retry`,
      { method: 'POST' },
    ),
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
  uncheckRequirement: (requirementId: string) =>
    request<{ status: string }>(`/api/requirements/${requirementId}/uncheck`, {
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
  proposedOrder?: { orderedIds: string[]; rationale: string; uncertainty?: string | null } | null;
}
