import { createRoute, Link, useParams } from '@tanstack/react-router';
import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Circle,
  Download,
  GripVertical,
  History,
  MessageSquare,
  Pencil,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { DangerConfirmDialog } from '../components/crud-dialogs.tsx';
import {
  type AdjustmentJobDetail,
  api,
  type ChatMessage,
  type ChatSession,
  type ProposalReview,
  type ProposalReviewDraft,
  type SupersededEntry,
  type TicketCanvas,
} from '../lib/api.ts';
import { mergeEvidence, normalizeChatContent } from '../lib/chat-format.ts';
import { uniqueTicketImpacts } from '../lib/impacts.ts';
import { cn } from '../lib/utils.ts';
import { rootRoute } from './__root.tsx';

export const ticketCanvasRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/projects/$projectId/tickets/$ticketKey',
  component: TicketCanvasPage,
});

const ADJUSTMENT_SOURCES = [
  { value: 'fsd', label: 'FSD' },
  { value: 'brd', label: 'BRD' },
  { value: 'chat', label: 'Chat' },
  { value: 'meeting', label: 'Meeting' },
  { value: 'clarification', label: 'Clarification' },
  { value: 'uat', label: 'UAT Feedback' },
  { value: 'manual', label: 'Manual' },
  { value: 'context', label: 'Context' },
] as const;

const CHECKLIST_PAGE_SIZE = 10;
const QUEUED_MODAL_AUTO_CLOSE_MS = 4000;

function titleCase(value: string) {
  return value
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

function formatDateTime(value: string | null) {
  if (!value) return 'Not recorded';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

function TicketCanvasPage() {
  const { projectId, ticketKey } = useParams({ from: ticketCanvasRoute.id });
  const [data, setData] = useState<TicketCanvas | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [panel, setPanel] = useState<'context' | 'history' | 'chat'>('context');
  const [note, setNote] = useState('');
  const [source, setSource] = useState<string>('fsd');
  const [attribution, setAttribution] = useState('');
  const [file, setFile] = useState<File | undefined>();
  const [fileDragActive, setFileDragActive] = useState(false);
  const [adjustmentState, setAdjustmentState] = useState<'idle' | 'submitting' | 'success'>('idle');
  const [adjustmentError, setAdjustmentError] = useState<string | null>(null);
  const [queuedModal, setQueuedModal] = useState<{ sourceLabel: string } | null>(null);
  const [page, setPage] = useState(1);
  const [dragId, setDragId] = useState<string | null>(null);
  const [reorderError, setReorderError] = useState<string | null>(null);
  const [reorderBusy, setReorderBusy] = useState(false);
  const [dirtyProposals, setDirtyProposals] = useState<Set<string>>(new Set());
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);
  const [deletingSubject, setDeletingSubject] = useState(false);
  const [subjectDeleteError, setSubjectDeleteError] = useState<string | null>(null);
  const [subjectDeleteBusy, setSubjectDeleteBusy] = useState(false);

  const load = useCallback(() => {
    api
      .getCanvas(projectId, ticketKey)
      .then((canvas) => {
        setData(canvas);
        setPage((current) => {
          const pages = Math.max(1, Math.ceil(canvas.checklist.length / CHECKLIST_PAGE_SIZE));
          return Math.min(current, pages);
        });
      })
      .catch((e) => setError(String(e)));
  }, [projectId, ticketKey]);

  useEffect(load, [load]);
  useEffect(() => {
    if (!queuedModal) return;
    const timer = window.setTimeout(() => setQueuedModal(null), QUEUED_MODAL_AUTO_CLOSE_MS);
    return () => window.clearTimeout(timer);
  }, [queuedModal]);
  useEffect(() => {
    if (!data?.adjustmentJobs.some((job) => job.status === 'queued' || job.status === 'processing'))
      return;
    const timer = window.setInterval(load, 2500);
    return () => window.clearInterval(timer);
  }, [data?.adjustmentJobs, load]);

  const setProposalDirty = useCallback((proposalId: string, dirty: boolean) => {
    setDirtyProposals((current) => {
      const next = new Set(current);
      if (dirty) next.add(proposalId);
      else next.delete(proposalId);
      return next;
    });
  }, []);

  if (error) return <p className="text-red-700">{error}</p>;
  if (!data) return <p className="text-zinc-500">Loading…</p>;

  const sourceLabel = ADJUSTMENT_SOURCES.find((item) => item.value === source)?.label ?? source;
  const uniqueImpacts = uniqueTicketImpacts(data.impacts);

  const orderedChecklist = [...data.checklist].sort((a, b) => a.displayOrder - b.displayOrder);
  const totalPages = Math.max(1, Math.ceil(orderedChecklist.length / CHECKLIST_PAGE_SIZE));
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const visibleChecklist = orderedChecklist.slice(
    (safePage - 1) * CHECKLIST_PAGE_SIZE,
    safePage * CHECKLIST_PAGE_SIZE,
  );

  const reorder = async (orderedIds: string[]) => {
    setReorderError(null);
    setReorderBusy(true);
    try {
      const result = await api.reorderChecklist(projectId, ticketKey, orderedIds);
      setData((current) => (current ? { ...current, checklist: result.checklist } : current));
    } catch (e) {
      setReorderError(e instanceof Error ? e.message : 'The checklist order could not be saved.');
    } finally {
      setReorderBusy(false);
    }
  };

  const moveChecklistItem = (id: string, direction: -1 | 1) => {
    const index = orderedChecklist.findIndex((item) => item.id === id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= orderedChecklist.length) return;
    const next = [...orderedChecklist];
    const [moved] = next.splice(index, 1);
    if (moved) {
      next.splice(target, 0, moved);
      void reorder(next.map((item) => item.id));
    }
  };

  const check = async (requirementId: string) => {
    setConfirmation({
      title: 'Mark requirement complete?',
      message:
        'This records a human completion action and keeps the requirement in the audit history.',
      confirmLabel: 'Mark complete',
      onConfirm: async () => {
        await api.checkRequirement(requirementId);
        load();
      },
    });
  };

  const uncheck = async (requirementId: string) => {
    setConfirmation({
      title: 'Mark requirement incomplete?',
      message: 'This records a human change and keeps the uncheck action in the audit history.',
      confirmLabel: 'Mark incomplete',
      onConfirm: async () => {
        await api.uncheckRequirement(requirementId);
        load();
      },
    });
  };

  const approve = async (proposalId: string) => {
    setConfirmation({
      title: 'Approve this proposal?',
      message:
        'This will create or supersede canonical checklist requirements. Review the proposal before continuing.',
      confirmLabel: 'Approve proposal',
      onConfirm: async () => {
        await api.approveProposal(proposalId);
        load();
      },
    });
  };

  const reject = async (proposalId: string) => {
    await api.rejectProposal(proposalId);
    load();
  };

  const refreshAfterProposal = () => load();

  const setFileFromInput = (next: File | undefined) => {
    if (!next) {
      setFile(undefined);
      return;
    }
    const accepted =
      next.name.toLowerCase().endsWith('.md') ||
      next.name.toLowerCase().endsWith('.markdown') ||
      next.name.toLowerCase().endsWith('.pdf') ||
      next.type === 'application/pdf' ||
      next.type === 'text/markdown';
    if (!accepted) {
      setAdjustmentError('Only Markdown (.md) or PDF files are accepted.');
      return;
    }
    setAdjustmentError(null);
    setFile(next);
  };

  const submitAdjustment = async () => {
    if (!note.trim() && !file) {
      setAdjustmentError('Add a note or choose a Markdown/PDF file.');
      return;
    }
    setAdjustmentState('submitting');
    setAdjustmentError(null);
    try {
      await api.addAdjustmentUpload(projectId, ticketKey, {
        source,
        ...(attribution ? { attribution } : {}),
        ...(note ? { note } : {}),
        ...(file ? { file } : {}),
      });
      setNote('');
      setAttribution('');
      setFile(undefined);
      setAdjustmentState('success');
      setQueuedModal({ sourceLabel });
      load();
    } catch (e) {
      setAdjustmentState('idle');
      setAdjustmentError(e instanceof Error ? e.message : 'The adjustment could not be submitted.');
    }
  };

  const confirmSubjectDelete = async () => {
    setSubjectDeleteError(null);
    setSubjectDeleteBusy(true);
    try {
      await api.deleteTicket(projectId, ticketKey, data.ticket.title);
      setDeletingSubject(false);
      window.location.assign(`/projects/${projectId}`);
    } catch (e) {
      setSubjectDeleteError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubjectDeleteBusy(false);
    }
  };

  const download = async (format: 'markdown' | 'json') => {
    const text = await api.exportSummary(projectId, ticketKey, format);
    const blob = new Blob([text], {
      type: format === 'json' ? 'application/json' : 'text/markdown',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${ticketKey}.${format === 'json' ? 'json' : 'md'}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const pending = data.proposals.filter((p) => p.status === 'pending');

  return (
    <div className="dashboard-paper overflow-hidden rounded-2xl">
      <div className="border-b border-zinc-200 bg-zinc-50/70 px-5 py-5 sm:px-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0">
            <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-sm">
              <Link to="/projects" className="text-zinc-500 hover:text-zinc-950 hover:underline">
                Projects
              </Link>
              <span aria-hidden="true" className="text-zinc-400">
                /
              </span>
              <Link
                to="/projects/$projectId"
                params={{ projectId }}
                className="text-zinc-500 hover:text-zinc-950 hover:underline"
              >
                {data.project.name}
              </Link>
              <span aria-hidden="true" className="text-zinc-400">
                /
              </span>
              <span className="font-semibold text-zinc-950">{data.ticket.key}</span>
            </nav>
            <Link
              to="/projects/$projectId"
              params={{ projectId }}
              className="mt-3 inline-flex min-h-10 items-center rounded text-sm text-zinc-500 hover:text-zinc-950 hover:underline"
            >
              ← Back to {data.project.name} tickets
            </Link>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight text-zinc-950">
              {data.ticket.title}
            </h1>
            <p className="mt-1 break-all font-mono text-xs text-zinc-500">{data.ticket.key}</p>
            {data.ticket.description && (
              <p className="mt-1 max-w-2xl break-words text-sm text-zinc-600">
                {data.ticket.description}
              </p>
            )}
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <button
              type="button"
              aria-label={`Edit ${data.ticket.title}`}
              className="inline-flex min-h-11 items-center gap-1 rounded-md border border-zinc-300 px-3 text-sm text-zinc-700 hover:bg-zinc-100"
            >
              <Pencil className="h-4 w-4" aria-hidden="true" />
              Edit
            </button>
            <button
              type="button"
              aria-label={`Delete ${data.ticket.title}`}
              className="inline-flex min-h-11 items-center gap-1 rounded-md border border-red-200 px-3 text-sm text-red-700 hover:bg-red-50"
              onClick={() => {
                setSubjectDeleteError(null);
                setDeletingSubject(true);
              }}
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              Delete
            </button>
            <button
              type="button"
              className="inline-flex min-h-11 items-center gap-1 rounded-md border border-zinc-300 px-3 text-sm hover:bg-zinc-100"
              onClick={() => download('markdown')}
            >
              <Download className="h-4 w-4" aria-hidden="true" /> MD
            </button>
            <button
              type="button"
              className="inline-flex min-h-11 items-center gap-1 rounded-md border border-zinc-300 px-3 text-sm hover:bg-zinc-100"
              onClick={() => download('json')}
            >
              <Download className="h-4 w-4" aria-hidden="true" /> JSON
            </button>
          </div>
        </div>
      </div>

      <TicketEvidenceSummary data={data} pendingCount={pending.length} />

      <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 px-5 py-6 sm:px-8">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">
                The work surface
              </p>
              <h2 className="mt-1 text-2xl font-semibold tracking-tight text-zinc-950">
                Current Checklist
              </h2>
            </div>
            <span className="text-sm text-zinc-500">
              {orderedChecklist.filter((r) => r.devStatus === 'checked').length}/
              {orderedChecklist.length} done
            </span>
          </div>

          <ol className="space-y-3">
            {visibleChecklist.map((r, position) => (
              <li
                key={r.id}
                draggable
                onDragStart={(event) => {
                  event.dataTransfer.effectAllowed = 'move';
                  event.dataTransfer.setData('text/plain', r.id);
                  setDragId(r.id);
                }}
                onDragEnd={() => setDragId(null)}
                onDragOver={(event) => {
                  event.preventDefault();
                  event.dataTransfer.dropEffect = 'move';
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  const dragged = event.dataTransfer.getData('text/plain') || dragId;
                  setDragId(null);
                  if (!dragged || dragged === r.id) return;
                  const next = orderedChecklist.filter((item) => item.id !== dragged);
                  const targetIndex = next.findIndex((item) => item.id === r.id);
                  const draggedItem = orderedChecklist.find((item) => item.id === dragged);
                  if (!draggedItem || targetIndex < 0) return;
                  next.splice(targetIndex, 0, draggedItem);
                  void reorder(next.map((item) => item.id));
                }}
                className={cn(
                  'rounded-xl border border-zinc-200 bg-white p-4 shadow-[0_1px_0_rgba(24,24,27,0.04)]',
                  dragId === r.id && 'border-amber-500 bg-amber-50/60',
                )}
              >
                <div className="flex items-start gap-2">
                  <span
                    className="inline-flex min-h-11 min-w-8 shrink-0 cursor-grab items-center justify-center text-zinc-400 active:cursor-grabbing"
                    aria-hidden="true"
                    title="Drag to reorder"
                  >
                    <GripVertical className="h-5 w-5" />
                  </span>
                  <span className="inline-flex min-h-11 min-w-7 shrink-0 items-center justify-end text-xs font-semibold text-zinc-400">
                    {(safePage - 1) * CHECKLIST_PAGE_SIZE + position + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => (r.devStatus === 'checked' ? uncheck(r.id) : check(r.id))}
                    className="flex min-h-11 min-w-11 shrink-0 items-center justify-center text-zinc-400 hover:text-zinc-900"
                    title={r.devStatus === 'checked' ? 'Mark incomplete' : 'Mark complete'}
                    aria-label={
                      r.devStatus === 'checked'
                        ? `Mark incomplete: ${r.title}`
                        : `Mark complete: ${r.title}`
                    }
                  >
                    {r.devStatus === 'checked' ? (
                      <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                    ) : (
                      <Circle className="h-5 w-5" />
                    )}
                  </button>
                  <div className="min-w-0 flex-1 pt-2.5">
                    <p className="font-medium">{r.title}</p>
                    {r.sourceLocation && (
                      <p className="text-xs text-zinc-500">Source: {r.sourceLocation}</p>
                    )}
                    <div className="mt-1 flex flex-wrap gap-1">
                      {data.impacts
                        .filter((i) => i.requirementId === r.id)
                        .map((i) => (
                          <span
                            key={i.id}
                            className="rounded bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-600"
                          >
                            {i.value}
                          </span>
                        ))}
                    </div>
                    {data.scenarios.filter((s) => s.requirementId === r.id).length > 0 && (
                      <details className="mt-2">
                        <summary className="inline-flex min-h-11 cursor-pointer items-center text-xs font-medium text-zinc-500">
                          Test scenarios
                        </summary>
                        <ul className="mt-1 list-inside list-disc text-xs text-zinc-600">
                          {data.scenarios
                            .filter((s) => s.requirementId === r.id)
                            .map((s) => (
                              <li key={s.id}>{s.text}</li>
                            ))}
                        </ul>
                      </details>
                    )}
                  </div>
                  <div className="flex shrink-0 items-start gap-1 pt-1.5">
                    <button
                      type="button"
                      aria-label={`Move ${r.title} up`}
                      className="inline-flex min-h-8 min-w-8 items-center justify-center rounded-md border border-zinc-300 text-zinc-700 hover:bg-zinc-100 disabled:opacity-40"
                      onClick={() => moveChecklistItem(r.id, -1)}
                      disabled={
                        reorderBusy || orderedChecklist.findIndex((item) => item.id === r.id) === 0
                      }
                    >
                      <ArrowUp className="h-4 w-4" aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      aria-label={`Move ${r.title} down`}
                      className="inline-flex min-h-8 min-w-8 items-center justify-center rounded-md border border-zinc-300 text-zinc-700 hover:bg-zinc-100 disabled:opacity-40"
                      onClick={() => moveChecklistItem(r.id, 1)}
                      disabled={
                        reorderBusy ||
                        orderedChecklist.findIndex((item) => item.id === r.id) ===
                          orderedChecklist.length - 1
                      }
                    >
                      <ArrowDown className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              </li>
            ))}
            {orderedChecklist.length === 0 && (
              <li className="text-sm text-zinc-500">No active requirements yet.</li>
            )}
          </ol>

          {orderedChecklist.length > CHECKLIST_PAGE_SIZE && (
            <nav
              aria-label="Checklist pages"
              className="mt-4 flex flex-wrap items-center justify-between gap-3"
            >
              <p className="text-xs text-zinc-500">
                Page {safePage} of {totalPages} · showing {visibleChecklist.length} of{' '}
                {orderedChecklist.length} active items
              </p>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="min-h-11 rounded-md border border-zinc-300 px-3 text-sm disabled:opacity-40"
                  onClick={() => setPage(safePage - 1)}
                  disabled={safePage <= 1}
                >
                  Previous
                </button>
                <button
                  type="button"
                  className="min-h-11 rounded-md border border-zinc-300 px-3 text-sm disabled:opacity-40"
                  onClick={() => setPage(safePage + 1)}
                  disabled={safePage >= totalPages}
                >
                  Next
                </button>
              </div>
            </nav>
          )}

          {reorderError && (
            <p className="mt-2 text-sm text-red-700" role="alert">
              {reorderError}
            </p>
          )}

          {pending.length > 0 && (
            <div className="mt-6">
              <h3 className="mb-2 text-lg font-semibold">Pending Proposals</h3>
              <ul className="space-y-2">
                {pending.map((p) => (
                  <li key={p.id} className="rounded border border-amber-200 bg-amber-50 p-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-zinc-900">{p.kind} proposal</span>
                      <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-800">
                        Needs review
                      </span>
                    </div>
                    {(() => {
                      const review = data.proposalReviews.find((item) => item.proposalId === p.id);
                      if (!review)
                        return (
                          <p className="mt-2 text-sm text-red-700">Review data unavailable.</p>
                        );
                      if (review.error) {
                        return (
                          <p className="mt-2 text-sm text-red-700">Review error: {review.error}</p>
                        );
                      }
                      return (
                        <div className="mt-3 space-y-3 text-sm">
                          {review.source && (
                            <p className="text-xs text-zinc-600">
                              Source: {review.source.type}
                              {review.source.attribution && ` · ${review.source.attribution}`}
                              {review.source.location && ` · ${review.source.location}`}
                              {review.source.sourceEventAt &&
                                ` · occurred ${review.source.sourceEventAt.slice(0, 10)}`}
                              {' · ingested '}
                              {review.source.ingestedAt.slice(0, 10)}
                            </p>
                          )}
                          <ProposedOrderPanel review={review} checklist={orderedChecklist} />
                          <ProposalEditor
                            proposalId={p.id}
                            projectId={projectId}
                            ticketKey={ticketKey}
                            review={review}
                            checklist={orderedChecklist}
                            onSaved={refreshAfterProposal}
                            onDirty={(dirty) => setProposalDirty(p.id, dirty)}
                          />
                        </div>
                      );
                    })()}
                    <div className="mt-2 flex gap-2">
                      <button
                        type="button"
                        className="rounded bg-emerald-600 px-2 py-1 text-xs text-white hover:bg-emerald-500"
                        onClick={() => approve(p.id)}
                        disabled={
                          !data.proposalReviews.find((item) => item.proposalId === p.id) ||
                          Boolean(
                            data.proposalReviews.find((item) => item.proposalId === p.id)?.error,
                          ) ||
                          dirtyProposals.has(p.id)
                        }
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        className="rounded bg-zinc-200 px-2 py-1 text-xs hover:bg-zinc-300"
                        onClick={() => reject(p.id)}
                      >
                        Reject
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <SupersededSection entries={data.superseded} />

          <AdjustmentComposer
            source={source}
            sourceLabel={sourceLabel}
            note={note}
            attribution={attribution}
            file={file}
            fileDragActive={fileDragActive}
            adjustmentState={adjustmentState}
            adjustmentError={adjustmentError}
            onSourceChange={setSource}
            onNoteChange={setNote}
            onAttributionChange={setAttribution}
            onFileChange={setFileFromInput}
            onDragActiveChange={setFileDragActive}
            onSubmit={submitAdjustment}
          />

          <AdjustmentQueue
            details={data.adjustmentJobDetails}
            onRetry={(jobId) => api.retryAdjustment(projectId, ticketKey, jobId).then(load)}
          />
        </div>

        <aside className="border-t border-zinc-200 bg-zinc-50/60 p-5 sm:p-6 lg:border-l lg:border-t-0">
          <div className="flex gap-2">
            <button
              type="button"
              className={`min-h-11 rounded px-3 py-1 text-sm ${panel === 'context' ? 'bg-zinc-900 text-white' : 'bg-zinc-200'}`}
              onClick={() => setPanel('context')}
            >
              Context
            </button>
            <button
              type="button"
              className={`flex min-h-11 items-center gap-1 rounded px-3 py-1 text-sm ${panel === 'history' ? 'bg-zinc-900 text-white' : 'bg-zinc-200'}`}
              onClick={() => setPanel('history')}
            >
              <History className="h-3 w-3" /> History
            </button>
            <button
              type="button"
              className={`flex min-h-11 items-center gap-1 rounded px-3 py-1 text-sm ${panel === 'chat' ? 'bg-zinc-900 text-white' : 'bg-zinc-200'}`}
              onClick={() => setPanel('chat')}
            >
              <MessageSquare className="h-3 w-3" /> Chat
            </button>
          </div>

          {panel === 'context' && (
            <div className="mt-3 rounded border border-zinc-200 bg-white p-3">
              <h4 className="mb-2 text-sm font-semibold">Impacts</h4>
              <ul className="space-y-1 text-sm text-zinc-600">
                {uniqueImpacts.map((i) => (
                  <li key={i.id}>
                    <span className="text-zinc-400">{i.kind}:</span> {i.value}
                  </li>
                ))}
                {uniqueImpacts.length === 0 && (
                  <li className="text-zinc-500">No impacts recorded.</li>
                )}
              </ul>
            </div>
          )}

          {panel === 'history' && (
            <div className="mt-3 rounded border border-zinc-200 bg-white p-3">
              <h4 className="mb-2 text-sm font-semibold">Timeline</h4>
              <ul className="space-y-1 text-xs text-zinc-600">
                {data.timeline.map((e) => (
                  <li key={`${e.at}-${e.description}`} className="border-l-2 border-zinc-200 pl-2">
                    <span className="text-zinc-400">{e.at.slice(0, 10)}</span> · {e.description}
                  </li>
                ))}
                {data.timeline.length === 0 && <li className="text-zinc-500">No events yet.</li>}
              </ul>
            </div>
          )}

          {panel === 'chat' && <ChatPanel projectId={projectId} ticketKey={ticketKey} />}
        </aside>
      </div>
      <ConfirmationDialog confirmation={confirmation} onClose={() => setConfirmation(null)} />
      <QueuedModal info={queuedModal} onClose={() => setQueuedModal(null)} />
      <DangerConfirmDialog
        open={deletingSubject}
        title={`Delete ${data.ticket.title}?`}
        expectedName={data.ticket.title}
        cascadeLines={[
          'Its checklist requirements and completion history',
          'Proposals, sources, and evidence',
          'Chats and adjustment jobs for this subject',
        ]}
        confirmLabel="Delete subject"
        error={subjectDeleteError}
        busy={subjectDeleteBusy}
        onClose={() => setDeletingSubject(false)}
        onConfirm={() => void confirmSubjectDelete()}
      />
    </div>
  );
}

function TicketEvidenceSummary({
  data,
  pendingCount,
}: {
  data: TicketCanvas;
  pendingCount: number;
}) {
  const ordered = [...data.checklist].sort((a, b) => a.displayOrder - b.displayOrder);
  const checked = ordered.filter((item) => item.devStatus === 'checked').length;
  const active = ordered.filter((item) => item.lifecycleStatus === 'active').length;
  const uniqueImpacts = uniqueTicketImpacts(data.impacts);
  const impacts = { service: 0, api: 0, page: 0 };
  for (const impact of uniqueImpacts) impacts[impact.kind] += 1;
  const metrics = [
    { label: 'Checklist', value: `${checked}/${ordered.length}`, detail: 'checked' },
    {
      label: 'Requirements',
      value: `${active} active`,
      detail: 'Superseded requirements live in the evidence section below',
    },
    { label: 'Review', value: String(pendingCount), detail: 'pending proposals' },
    {
      label: 'Impacts',
      value: `${uniqueImpacts.length}`,
      detail: `${impacts.service} services · ${impacts.api} APIs · ${impacts.page} pages`,
    },
    { label: 'Evidence', value: String(data.timeline.length), detail: 'timeline events' },
  ];

  return (
    <dl className="grid grid-cols-2 gap-px border-b border-zinc-200 bg-zinc-200 sm:grid-cols-3 lg:grid-cols-5">
      {metrics.map((metric) => (
        <div key={metric.label} className="bg-white px-4 py-4 sm:px-5">
          <dt className="text-[11px] font-semibold uppercase tracking-[0.14em] text-zinc-400">
            {metric.label}
          </dt>
          <dd className="mt-1 text-lg font-semibold tracking-tight text-zinc-950">
            {metric.value}
          </dd>
          <dd className="mt-1 text-xs leading-4 text-zinc-500">{metric.detail}</dd>
        </div>
      ))}
    </dl>
  );
}

function AdjustmentQueue({
  details,
  onRetry,
}: {
  details: AdjustmentJobDetail[];
  onRetry: (jobId: string) => void;
}) {
  return (
    <section
      className="mt-6 rounded-xl border border-zinc-200 bg-white p-4"
      aria-label="Adjustment processing"
    >
      <h2 className="font-semibold text-zinc-950">Adjustment processing</h2>
      <div className="mt-2 space-y-3">
        {details.length === 0 && <p className="text-sm text-zinc-500">No adjustments yet.</p>}
        {details.map(({ job, source }) => (
          <article
            key={job.id}
            className="rounded-lg border border-zinc-200 bg-zinc-50/60 p-3 text-sm"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-medium text-zinc-900">
                {titleCase(job.sourceType)}{' '}
                <span
                  className={cn(
                    'ml-1 rounded-full px-2 py-0.5 text-[11px] font-medium',
                    job.status === 'failed' && 'bg-red-100 text-red-800',
                    job.status === 'completed' && 'bg-emerald-100 text-emerald-800',
                    (job.status === 'queued' || job.status === 'processing') &&
                      'bg-amber-100 text-amber-800',
                  )}
                >
                  {job.status}
                </span>
              </p>
              <p className="text-xs text-zinc-500">Queued {formatDateTime(job.createdAt)}</p>
            </div>
            <dl className="mt-2 space-y-1 text-xs text-zinc-600">
              <div className="flex flex-wrap gap-x-2">
                <dt className="font-medium text-zinc-800">From:</dt>
                <dd>{job.attribution ?? source?.attribution ?? 'Not recorded'}</dd>
              </div>
              <div className="flex flex-wrap gap-x-2">
                <dt className="font-medium text-zinc-800">Note:</dt>
                <dd>{source?.note?.trim() ? source.note : 'No note supplied'}</dd>
              </div>
              <div className="flex flex-wrap gap-x-2">
                <dt className="font-medium text-zinc-800">File:</dt>
                <dd>
                  {job.fileName ?? job.sourceLocation ?? source?.location ?? 'No file attached'}
                  {job.fileKind ? ` (${job.fileKind})` : ''}
                </dd>
              </div>
              <div className="flex flex-wrap gap-x-2">
                <dt className="font-medium text-zinc-800">Updated:</dt>
                <dd>{formatDateTime(job.updatedAt)}</dd>
              </div>
              {job.startedAt && (
                <div className="flex flex-wrap gap-x-2">
                  <dt className="font-medium text-zinc-800">Started:</dt>
                  <dd>{formatDateTime(job.startedAt)}</dd>
                </div>
              )}
              {job.completedAt && (
                <div className="flex flex-wrap gap-x-2">
                  <dt className="font-medium text-zinc-800">Finished:</dt>
                  <dd>{formatDateTime(job.completedAt)}</dd>
                </div>
              )}
              {job.attempts > 0 && (
                <div className="flex flex-wrap gap-x-2">
                  <dt className="font-medium text-zinc-800">Attempts:</dt>
                  <dd>{job.attempts}</dd>
                </div>
              )}
              {job.proposalId && (
                <div className="flex flex-wrap gap-x-2">
                  <dt className="font-medium text-zinc-800">Proposal:</dt>
                  <dd className="break-all font-mono">{job.proposalId}</dd>
                </div>
              )}
            </dl>
            {job.error && (
              <p className="mt-2 text-xs text-red-700" role="alert">
                {job.error}
              </p>
            )}
            {job.status === 'failed' && (
              <button
                type="button"
                className="mt-2 min-h-11 rounded-md bg-zinc-900 px-3 py-2 text-xs font-medium text-white hover:bg-zinc-700"
                onClick={() => onRetry(job.id)}
              >
                Retry adjustment
              </button>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}

function SupersededSection({ entries }: { entries: SupersededEntry[] }) {
  return (
    <details className="group mt-6 rounded-xl border border-zinc-200 bg-white" open={false}>
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 rounded-xl px-4 py-3 text-sm font-semibold text-zinc-900 [&::-webkit-details-marker]:hidden">
        <span>
          Superseded{' '}
          <span className="ml-1 rounded-full bg-zinc-100 px-2 py-0.5 text-xs font-medium text-zinc-600">
            {entries.length}
          </span>
        </span>
        <span aria-hidden="true" className="text-zinc-400 group-open:rotate-180">
          ▾
        </span>
      </summary>
      <div className="border-t border-zinc-200 px-4 py-4">
        {entries.length === 0 ? (
          <p className="text-sm text-zinc-500">
            Nothing has been superseded yet. Replaced requirements stay here as evidence.
          </p>
        ) : (
          <ul className="space-y-4">
            {entries.map((entry) => (
              <li key={entry.item.id} className="rounded-lg bg-zinc-50 p-4 text-sm">
                <p className="font-medium text-zinc-900">{entry.item.title}</p>
                {entry.item.description && (
                  <p className="mt-1 text-zinc-600">{entry.item.description}</p>
                )}
                <dl className="mt-3 space-y-1.5 text-xs text-zinc-600">
                  <div className="flex flex-wrap gap-x-2">
                    <dt className="font-medium text-zinc-800">Superseded by:</dt>
                    <dd>{entry.supersededByTitle ?? 'Not linked to a replacement'}</dd>
                  </div>
                  <div className="flex flex-wrap gap-x-2">
                    <dt className="font-medium text-zinc-800">Recorded:</dt>
                    <dd>{formatDateTime(entry.item.createdAt)}</dd>
                  </div>
                  <div className="flex flex-wrap gap-x-2">
                    <dt className="font-medium text-zinc-800">Superseded:</dt>
                    <dd>{formatDateTime(entry.item.updatedAt)}</dd>
                  </div>
                  <div className="flex flex-wrap gap-x-2">
                    <dt className="font-medium text-zinc-800">Source:</dt>
                    <dd>
                      {entry.item.source
                        ? [
                            entry.item.source.type,
                            entry.item.source.attribution,
                            entry.item.source.location,
                            entry.item.source.note,
                          ]
                            .filter(Boolean)
                            .join(' · ') || 'Source recorded without details'
                        : 'Source not recorded'}
                    </dd>
                  </div>
                  <div className="flex flex-wrap gap-x-2">
                    <dt className="font-medium text-zinc-800">Evidence ingested:</dt>
                    <dd>{formatDateTime(entry.item.source?.ingestedAt ?? null)}</dd>
                  </div>
                  {entry.item.source?.note && (
                    <div>
                      <dt className="font-medium text-zinc-800">Reason:</dt>
                      <dd className="mt-0.5">{entry.item.source.note}</dd>
                    </div>
                  )}
                </dl>
              </li>
            ))}
          </ul>
        )}
      </div>
    </details>
  );
}

function QueuedModal({
  info,
  onClose,
}: {
  info: { sourceLabel: string } | null;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (info && !dialog.open) dialog.showModal();
    if (!info && dialog.open) dialog.close();
  }, [info]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const handleClose = () => onClose();
    dialog.addEventListener('close', handleClose);
    return () => dialog.removeEventListener('close', handleClose);
  }, [onClose]);

  if (!info) return <dialog ref={dialogRef} aria-hidden="true" />;

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="queued-title"
      className="m-auto w-[min(calc(100%-2rem),26rem)] rounded-2xl border border-zinc-200 bg-[#fffdf8] p-0 text-zinc-950 shadow-2xl"
    >
      <div className="p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">
          Adjustment queued
        </p>
        <h2 id="queued-title" className="mt-2 text-xl font-semibold tracking-tight">
          Sent for reconciliation
        </h2>
        <p className="mt-3 text-sm leading-6 text-zinc-600">
          Your {info.sourceLabel} adjustment is queued and will become a proposal for human review.
          Nothing on the checklist changes until you approve it.
        </p>
        <div className="mt-6 flex justify-end">
          <button
            type="button"
            className="min-h-11 rounded-md bg-zinc-950 px-4 text-sm font-medium text-white hover:bg-zinc-800"
            onClick={onClose}
          >
            Got it
          </button>
        </div>
      </div>
    </dialog>
  );
}

function ProposedOrderPanel({
  review,
  checklist,
}: {
  review: ProposalReview;
  checklist: TicketCanvas['checklist'];
}) {
  if (!review.proposedOrder) return null;
  const order = review.proposedOrder;
  const titles = order.orderedIds.map(
    (id, index) =>
      `${index + 1}. ${checklist.find((item) => item.id === id)?.title ?? `Unknown item (${id.slice(0, 8)})`}`,
  );
  return (
    <div className="rounded-md border border-amber-200 bg-white p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-700">
        Suggested build order{' '}
        {review.orderState === 'stale' && (
          <span className="ml-1 rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium normal-case text-zinc-600">
            Stale, checklist changed
          </span>
        )}
      </p>
      <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-zinc-700">
        {titles.map((title) => (
          <li key={title}>{title}</li>
        ))}
      </ol>
      <p className="mt-2 text-xs leading-5 text-zinc-600">
        <span className="font-medium text-zinc-800">Why this order:</span> {order.rationale}
      </p>
      {order.uncertainty && (
        <p className="mt-1 text-xs leading-5 text-zinc-600">
          <span className="font-medium text-zinc-800">Uncertain:</span> {order.uncertainty}
        </p>
      )}
      <p className="mt-1 text-[11px] text-zinc-500">
        Approving applies this order to the items above; items the agent did not rank keep their
        current spots afterward.
      </p>
    </div>
  );
}

function AdjustmentComposer({
  source,
  sourceLabel,
  note,
  attribution,
  file,
  fileDragActive,
  adjustmentState,
  adjustmentError,
  onSourceChange,
  onNoteChange,
  onAttributionChange,
  onFileChange,
  onDragActiveChange,
  onSubmit,
}: {
  source: string;
  sourceLabel: string;
  note: string;
  attribution: string;
  file: File | undefined;
  fileDragActive: boolean;
  adjustmentState: 'idle' | 'submitting' | 'success';
  adjustmentError: string | null;
  onSourceChange: (value: string) => void;
  onNoteChange: (value: string) => void;
  onAttributionChange: (value: string) => void;
  onFileChange: (next: File | undefined) => void;
  onDragActiveChange: (active: boolean) => void;
  onSubmit: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="mt-6 rounded-xl border border-zinc-200 bg-white p-4">
      <h3 className="font-semibold">Add adjustment</h3>
      <p className="mt-1 text-sm text-zinc-500">
        Add local evidence for reconciliation. It creates a proposal for review, never a direct
        checklist change.
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="space-y-1">
          <label className="block text-sm font-medium leading-5" htmlFor="adjustment-source">
            Source category
          </label>

          <div className="relative">
            <select
              id="adjustment-source"
              className="block h-11 w-full appearance-none rounded-md border border-zinc-300 bg-white px-3 pr-9 text-sm shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-600"
              value={source}
              onChange={(e) => onSourceChange(e.target.value)}
            >
              {ADJUSTMENT_SOURCES.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>

            <span
              aria-hidden="true"
              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500"
            >
              ▾
            </span>
          </div>
        </div>

        <div className="space-y-1">
          <label className="block text-sm font-medium leading-5" htmlFor="adjustment-attribution">
            Attribution <span className="font-normal text-zinc-500">(optional)</span>
          </label>

          <input
            id="adjustment-attribution"
            className="block h-11 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-600"
            placeholder="Who supplied this?"
            value={attribution}
            onChange={(e) => onAttributionChange(e.target.value)}
          />
        </div>
      </div>
      <p className="mt-1 text-xs text-zinc-500" aria-live="polite">
        Selected: {sourceLabel}. This label is display only; the original category is sent to the
        API.
      </p>
      <label className="mt-3 block text-sm font-medium" htmlFor="adjustment-note">
        Note <span className="font-normal text-zinc-500">(optional when a file is attached)</span>
        <textarea
          id="adjustment-note"
          className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm"
          rows={3}
          placeholder="Note (e.g. discount cap should be 15%, not 20%)"
          value={note}
          onChange={(e) => onNoteChange(e.target.value)}
        />
      </label>
      <div className="mt-3">
        <span className="block text-sm font-medium" id="adjustment-file-label">
          Source document
        </span>
        <button
          type="button"
          aria-labelledby="adjustment-file-label"
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(event) => {
            event.preventDefault();
            onDragActiveChange(true);
          }}
          onDragLeave={() => onDragActiveChange(false)}
          onDrop={(event) => {
            event.preventDefault();
            onDragActiveChange(false);
            const dropped = event.dataTransfer.files?.[0];
            onFileChange(dropped);
          }}
          className={cn(
            'mt-1 flex min-h-24 w-full flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed px-4 py-5 text-center transition-colors',
            fileDragActive
              ? 'border-amber-500 bg-amber-50'
              : 'border-zinc-300 bg-zinc-50/60 hover:border-amber-500 hover:bg-amber-50/60',
          )}
        >
          <Upload className="h-5 w-5 text-zinc-500" aria-hidden="true" />
          <span className="text-sm font-medium text-zinc-800">
            Drop a Markdown or PDF file here, or click to choose one
          </span>
          <span className="text-xs text-zinc-500">Accepted: .md, .markdown, .pdf</span>
        </button>
        <input
          ref={fileInputRef}
          className="sr-only"
          type="file"
          accept=".md,.markdown,.pdf,application/pdf,text/markdown"
          aria-label="Source document"
          onChange={(e) => {
            onFileChange(e.target.files?.[0]);
            e.target.value = '';
          }}
        />
      </div>
      {file && (
        <div className="mt-2 flex items-center justify-between gap-3 rounded bg-zinc-50 px-3 py-2 text-sm">
          <span className="min-w-0 break-words">
            {file.name} · {file.type || 'type not supplied'} · {(file.size / 1024).toFixed(1)} KB
          </span>
          <button
            type="button"
            aria-label={`Remove ${file.name}`}
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md text-red-700 hover:bg-red-50"
            onClick={() => onFileChange(undefined)}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      )}
      {adjustmentError && (
        <p className="mt-2 text-sm text-red-700" role="alert">
          {adjustmentError}
        </p>
      )}
      {adjustmentState === 'success' && (
        <p className="mt-2 text-sm text-emerald-700">Submitted for review.</p>
      )}
      <button
        type="button"
        className="mt-3 min-h-11 rounded-md bg-zinc-900 px-4 text-sm font-medium text-white hover:bg-zinc-700 disabled:cursor-wait disabled:opacity-60"
        onClick={onSubmit}
        disabled={adjustmentState === 'submitting'}
      >
        {adjustmentState === 'submitting' ? 'Processing…' : 'Submit for reconciliation'}
      </button>
    </div>
  );
}

type Confirmation = {
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => Promise<void>;
};

function ConfirmationDialog({
  confirmation,
  onClose,
}: {
  confirmation: Confirmation | null;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (confirmation && !dialog.open) dialog.showModal();
    if (!confirmation && dialog.open) dialog.close();
  }, [confirmation]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const handleClose = () => {
      if (!submitting) onClose();
    };
    dialog.addEventListener('close', handleClose);
    return () => dialog.removeEventListener('close', handleClose);
  }, [onClose, submitting]);

  if (!confirmation) return <dialog ref={dialogRef} aria-hidden="true" />;

  const confirm = async () => {
    setSubmitting(true);
    try {
      await confirmation.onConfirm();
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="confirmation-title"
      aria-describedby="confirmation-message"
      className="m-auto w-[min(calc(100%-2rem),28rem)] rounded-2xl border border-zinc-200 bg-[#fffdf8] p-0 text-zinc-950 shadow-2xl"
    >
      <div className="p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">
          Human decision
        </p>
        <h2 id="confirmation-title" className="mt-2 text-xl font-semibold tracking-tight">
          {confirmation.title}
        </h2>
        <p id="confirmation-message" className="mt-3 text-sm leading-6 text-zinc-600">
          {confirmation.message}
        </p>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            className="min-h-11 rounded-md px-4 text-sm font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-50"
            onClick={onClose}
            disabled={submitting}
          >
            Cancel
          </button>
          <button
            type="button"
            className="min-h-11 rounded-md bg-zinc-950 px-4 text-sm font-medium text-white hover:bg-zinc-800 disabled:cursor-wait disabled:opacity-60"
            onClick={confirm}
            disabled={submitting}
          >
            {submitting ? 'Working…' : confirmation.confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}

function ProposalEditor({
  proposalId,
  projectId,
  ticketKey,
  review,
  checklist,
  onSaved,
  onDirty,
}: {
  proposalId: string;
  projectId: string;
  ticketKey: string;
  review: ProposalReview;
  checklist: TicketCanvas['checklist'];
  onSaved: () => void;
  onDirty: (dirty: boolean) => void;
}) {
  const [drafts, setDrafts] = useState<ProposalReviewDraft[]>(review.drafts);
  const [editing, setEditing] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const dirty = JSON.stringify(drafts) !== JSON.stringify(review.drafts);
  const valid =
    drafts.length > 0 &&
    drafts.every(
      (draft) =>
        draft.title.trim() &&
        draft.implementationItems.every(Boolean) &&
        draft.successCriteria.every(Boolean),
    );
  useEffect(() => {
    setDrafts(review.drafts);
    onDirty(false);
  }, [review.drafts, onDirty]);

  useEffect(() => {
    onDirty(dirty);
  }, [dirty, onDirty]);

  const update = (index: number, patch: Partial<ProposalReviewDraft>) => {
    setDrafts((current) =>
      current.map((draft, i) => (i === index ? { ...draft, ...patch } : draft)),
    );
  };
  const toggleEditing = (index: number) => {
    setEditing((current) => {
      const next = new Set(current);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };
  const split = (value: string) =>
    value
      .split('\n')
      .map((item) => item.trim())
      .filter(Boolean);
  const save = async () => {
    if (!valid) return;
    setSaving(true);
    setMessage(null);
    try {
      const output = {
        kind:
          review.kind === 'reconciliation' ? ('reconciliation' as const) : ('extraction' as const),
        ...(review.kind === 'reconciliation' ? { create: drafts } : { requirements: drafts }),
        ...(review.proposedOrder ? { proposedOrder: review.proposedOrder } : {}),
      };
      await api.editProposal(projectId, ticketKey, proposalId, output);
      onDirty(false);
      setMessage('Saved as a new proposal version.');
      onSaved();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to save edits.');
    } finally {
      setSaving(false);
    }
  };
  const reset = async () => {
    setSaving(true);
    setMessage(null);
    try {
      await api.resetProposal(projectId, ticketKey, proposalId);
      onDirty(false);
      setMessage('Reset to the original model draft.');
      onSaved();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to reset draft.');
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-semibold text-zinc-900">Review proposal</p>
        <span className="text-xs text-zinc-500" aria-live="polite">
          {review.isEdited ? 'Edited draft' : 'Original model draft'}
        </span>
      </div>
      <p className="mb-4 text-xs leading-5 text-zinc-600">
        Review the proposed work first. Edit only the points that need correction, then save before
        approval.
      </p>
      {drafts.map((draft, index) => (
        <div
          key={`${proposalId}-${draft.title}`}
          className="mb-4 border-t border-zinc-200 pt-4 last:mb-0"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                Business requirement
              </p>
              <p className="mt-1 font-medium leading-6 text-zinc-900">{draft.title}</p>
            </div>
            <button
              type="button"
              className="min-h-11 shrink-0 rounded-md px-3 text-xs font-medium text-zinc-700 underline decoration-zinc-300 underline-offset-4 hover:bg-zinc-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900"
              onClick={() => toggleEditing(index)}
            >
              {editing.has(index) ? 'Close edit' : 'Edit'}
            </button>
          </div>
          {draft.description && (
            <p className="mt-2 text-sm leading-6 text-zinc-600">{draft.description}</p>
          )}
          <ReviewList label="Developer work" items={draft.implementationItems} />
          <ReviewList label="Success criteria" items={draft.successCriteria} />
          {draft.impacts.length > 0 && (
            <p className="mt-3 text-xs text-zinc-600">
              <span className="font-medium text-zinc-800">Impacts:</span>{' '}
              {draft.impacts.map((impact) => `${impact.kind}: ${impact.value}`).join(', ')}
            </p>
          )}
          {draft.supersedes.length > 0 && (
            <p className="mt-2 text-xs text-zinc-600">
              <span className="font-medium text-zinc-800">Replaces:</span>{' '}
              {draft.supersedes
                .map(
                  (id) => checklist.find((item) => item.id === id)?.title ?? 'Unknown requirement',
                )
                .join(', ')}
            </p>
          )}
          {editing.has(index) && (
            <div className="mt-4 space-y-3 rounded-md bg-zinc-50 p-3">
              <label className="block text-xs font-medium text-zinc-700">
                Business requirement
                <input
                  aria-label="Business requirement"
                  className="mt-1 min-h-11 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-zinc-900"
                  value={draft.title}
                  onChange={(event) => update(index, { title: event.target.value })}
                />
              </label>
              <label className="block text-xs font-medium text-zinc-700">
                Description
                <textarea
                  aria-label="Business requirement description"
                  className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-zinc-900"
                  rows={2}
                  value={draft.description ?? ''}
                  onChange={(event) => update(index, { description: event.target.value || null })}
                />
              </label>
              <label className="block text-xs font-medium text-zinc-700">
                Developer work
                <textarea
                  aria-label="Developer implementation items"
                  className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-zinc-900"
                  rows={4}
                  value={draft.implementationItems.join('\n')}
                  onChange={(event) =>
                    update(index, { implementationItems: split(event.target.value) })
                  }
                  placeholder="One environment-agnostic action per line"
                />
              </label>
              <label className="block text-xs font-medium text-zinc-700">
                Success criteria
                <textarea
                  aria-label="Success criteria"
                  className="mt-1 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-zinc-900"
                  rows={4}
                  value={draft.successCriteria.join('\n')}
                  onChange={(event) =>
                    update(index, { successCriteria: split(event.target.value) })
                  }
                  placeholder="One observable outcome per line"
                />
              </label>
              <label className="block text-xs font-medium text-zinc-700">
                Supersedes checklist items
                <span className="mt-1 block font-normal text-zinc-500">
                  Hold Command or Control to select more than one.
                </span>
                <select
                  aria-label="Supersedes checklist items"
                  multiple
                  className="mt-2 min-h-24 w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-zinc-900"
                  value={draft.supersedes}
                  onChange={(event) =>
                    update(index, {
                      supersedes: Array.from(
                        event.target.selectedOptions,
                        (option) => option.value,
                      ),
                    })
                  }
                  disabled={checklist.length === 0}
                >
                  {checklist.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.title}
                    </option>
                  ))}
                </select>
                {checklist.length === 0 && (
                  <span className="mt-1 block text-xs text-zinc-500">
                    No active checklist items are available to supersede.
                  </span>
                )}
              </label>
            </div>
          )}
        </div>
      ))}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="rounded bg-zinc-900 px-3 py-1.5 text-xs text-white disabled:opacity-50"
          onClick={save}
          disabled={!dirty || !valid || saving}
        >
          Save edits
        </button>
        <button
          type="button"
          className="rounded border border-zinc-400 px-3 py-1.5 text-xs disabled:opacity-50"
          onClick={reset}
          disabled={!review.isEdited || saving}
        >
          Reset to original
        </button>
        {dirty && <span className="text-xs text-amber-700">Unsaved edits</span>}
        {!valid && dirty && (
          <span className="text-xs text-red-700">Title and list items cannot be empty.</span>
        )}
        {message && <span className="text-xs text-zinc-600">{message}</span>}
      </div>
    </div>
  );
}

function ReviewList({ label, items }: { label: string; items: string[] }) {
  return (
    <div className="mt-3">
      <p className="text-xs font-medium text-zinc-800">{label}</p>
      {items.length > 0 ? (
        <ul className="mt-1 list-disc space-y-1 pl-5 text-sm leading-6 text-zinc-700">
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : (
        <p className="mt-1 text-xs text-zinc-500">None proposed.</p>
      )}
    </div>
  );
}

function ChatPanel({ projectId, ticketKey }: { projectId: string; ticketKey: string }) {
  const [message, setMessage] = useState('');
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [log, setLog] = useState<ChatMessage[]>([]);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [chatView, setChatView] = useState<'chat' | 'sessions'>('chat');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const nextId = useRef(0);
  const append = (role: ChatMessage['role'], text: string) =>
    setLog((prev) => [
      ...prev,
      {
        id: `local-${nextId.current++}`,
        sessionId: 'local',
        role,
        content: text,
        createdAt: new Date().toISOString(),
      },
    ]);
  const appendEvidence = (source: string) =>
    setLog((prev) => {
      const last = prev.at(-1);
      if (last?.role !== 'assistant') {
        return [
          ...prev,
          {
            id: `local-${nextId.current++}`,
            sessionId: 'local',
            role: 'assistant',
            content: mergeEvidence('', source),
            createdAt: new Date().toISOString(),
          },
        ];
      }
      return [...prev.slice(0, -1), { ...last, content: mergeEvidence(last.content, source) }];
    });

  useEffect(() => {
    setLoadingHistory(true);
    api
      .getChatHistory(projectId, ticketKey)
      .then((result) => {
        setSessions(result.sessions);
        const first = result.sessions[0];
        if (first) {
          setSessionId(first.session.id);
          setLog(first.messages);
          setMessage('');
        } else {
          setLog([]);
          setMessage('');
        }
      })
      .catch(() => undefined)
      .finally(() => setLoadingHistory(false));
  }, [projectId, ticketKey]);

  const selectSession = (id: string, messages: ChatMessage[]) => {
    setDrafts((current) => ({
      ...current,
      ...(sessionId ? { [sessionId]: message } : { pending: message }),
    }));
    setSessionId(id);
    setLog(messages);
    setMessage(drafts[id] ?? '');
    setError(null);
    setChatView('chat');
  };

  const newChat = async () => {
    try {
      const result = await api.createChatSession(projectId, ticketKey);
      selectSession(result.session.id, []);
      const history = await api.getChatHistory(projectId, ticketKey);
      setSessions(history.sessions);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not start a new conversation.');
    }
  };

  const send = async () => {
    const prompt = message.trim();
    if (!prompt || sending) return;
    setSending(true);
    setError(null);
    append('user', prompt);
    setMessage('');
    if (sessionId) {
      setDrafts((current) => {
        const next = { ...current };
        delete next[sessionId];
        return next;
      });
    } else {
      setDrafts((current) => {
        const next = { ...current };
        delete next.pending;
        return next;
      });
    }
    try {
      const res = await fetch(`/api/chat/${projectId}/${ticketKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: prompt, ...(sessionId ? { sessionId } : {}) }),
      });
      if (!res.ok) throw new Error(`Chat request failed (${res.status})`);
      const reader = res.body?.getReader();
      if (!reader) throw new Error('Chat response did not include a stream.');
      const decoder = new TextDecoder();
      let buffer = '';
      const consume = (line: string) => {
        if (!line.trim()) return;
        const ev = JSON.parse(line) as {
          type: string;
          text?: string;
          error?: string;
          source?: string;
          sessionId?: string;
        };
        // The first message lazily creates the session; adopt it so the reply
        // lands in history and follow-up questions stay in one thread.
        if (ev.type === 'start' && ev.sessionId) {
          setSessionId(ev.sessionId);
          setLog((prev) =>
            prev.map((entry) => ({ ...entry, sessionId: ev.sessionId ?? entry.sessionId })),
          );
        }
        if (ev.type === 'error') throw new Error(ev.error ?? 'The assistant could not answer.');
        if (ev.type === 'text' && ev.text) append('assistant', ev.text);
        if (ev.type === 'evidence' && ev.source?.trim()) appendEvidence(ev.source);
      };
      while (true) {
        const { done, value } = await reader.read();
        buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';
        for (const line of lines) consume(line);
        if (done) break;
      }
      if (buffer.trim()) consume(buffer);
      api
        .getChatHistory(projectId, ticketKey)
        .then((result) => setSessions(result.sessions))
        .catch(() => undefined);
    } catch (cause) {
      const detail = cause instanceof Error ? cause.message : String(cause);
      setError(
        detail.includes('session')
          ? `${detail} Choose "New Chat" and ask again.`
          : `${detail} Check the connection and send again.`,
      );
      append('assistant', `Error: ${detail}`);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="rounded border border-zinc-200 bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <h4 className="text-sm font-semibold">Ticket assistant</h4>
        {chatView === 'chat' && (
          <button
            type="button"
            className="min-h-11 rounded-md border border-zinc-300 px-3 text-xs font-medium hover:bg-zinc-100"
            onClick={newChat}
          >
            New Chat
          </button>
        )}
      </div>
      <div className="mt-3 flex border-b border-zinc-200 text-xs font-medium">
        <button
          type="button"
          className={`min-h-10 border-b-2 px-3 ${chatView === 'chat' ? 'border-amber-600 text-zinc-950' : 'border-transparent text-zinc-500 hover:text-zinc-900'}`}
          onClick={() => setChatView('chat')}
          aria-pressed={chatView === 'chat'}
        >
          Chat
        </button>
        <button
          type="button"
          className={`min-h-10 border-b-2 px-3 ${chatView === 'sessions' ? 'border-amber-600 text-zinc-950' : 'border-transparent text-zinc-500 hover:text-zinc-900'}`}
          onClick={() => setChatView('sessions')}
          aria-pressed={chatView === 'sessions'}
        >
          Sessions{sessions.length > 0 ? ` (${sessions.length})` : ''}
        </button>
      </div>
      {chatView === 'sessions' ? (
        <div className="mt-3 max-h-[28rem] space-y-2 overflow-y-auto pr-1">
          <button
            type="button"
            className="min-h-11 w-full rounded-md border border-dashed border-zinc-300 px-3 text-left text-xs font-medium text-zinc-700 hover:border-amber-500 hover:bg-amber-50"
            onClick={newChat}
          >
            + Start a new conversation
          </button>
          {sessions.length === 0 && (
            <p className="px-1 py-4 text-xs leading-5 text-zinc-500">
              No previous conversations for this ticket.
            </p>
          )}
          {sessions.map((item) => (
            <button
              key={item.session.id}
              type="button"
              className={`min-h-16 w-full rounded-md border p-3 text-left ${sessionId === item.session.id ? 'border-amber-500 bg-amber-50' : 'border-zinc-200 hover:bg-zinc-50'}`}
              onClick={() => selectSession(item.session.id, item.messages)}
            >
              <span className="block truncate text-xs font-medium text-zinc-900">{item.title}</span>
              <span className="mt-1 block line-clamp-2 text-[11px] leading-4 text-zinc-500">
                {item.preview || 'No messages yet'}
              </span>
            </button>
          ))}
        </div>
      ) : (
        <>
          <p className="mb-3 text-xs leading-5 text-zinc-500">
            Ask what changed, what remains, or which evidence supports a requirement.
            {sessionId ? '' : ' Your first message starts a new conversation automatically.'}
          </p>
          <div
            className="mb-2 max-h-80 space-y-3 overflow-y-auto text-sm leading-6 text-zinc-600"
            aria-live="polite"
            aria-busy={loadingHistory || sending}
          >
            {loadingHistory ? (
              <p className="text-zinc-500" role="status">
                Loading conversation…
              </p>
            ) : (
              <>
                {log.length === 0 && (
                  <p className="text-zinc-500">
                    No questions yet. The assistant reads this ticket's evidence.
                  </p>
                )}
                {log.map((entry) => (
                  <div
                    key={entry.id}
                    className={entry.role === 'user' ? 'ml-6 text-zinc-900' : 'mr-3'}
                  >
                    {entry.role === 'user' ? (
                      <p className="font-medium">{entry.content}</p>
                    ) : (
                      <ChatMarkdown content={entry.content} />
                    )}
                  </div>
                ))}
              </>
            )}
          </div>
          {error && (
            <p className="mb-2 text-xs text-red-700" role="alert">
              {error}
            </p>
          )}
          <div className="flex gap-2">
            <input
              className="min-h-11 flex-1 rounded-md border border-zinc-300 px-3 text-sm"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && send()}
              placeholder={
                sessionId ? 'Ask about this ticket' : 'Ask anything, a chat starts automatically'
              }
              disabled={sending || loadingHistory}
              aria-label="Ask about this ticket"
            />
            <button
              type="button"
              className="min-h-11 min-w-20 rounded-md bg-zinc-900 px-3 text-sm text-white hover:bg-zinc-700 disabled:opacity-60"
              onClick={send}
              disabled={sending || loadingHistory || !message.trim()}
            >
              {sending ? 'Reading…' : 'Ask'}
            </button>
          </div>
          <p className="mt-2 text-[11px] text-zinc-400">
            Chat only creates pending proposals, never silent changes.
          </p>
        </>
      )}
    </div>
  );
}

function ChatMarkdown({ content }: { content: string }) {
  const normalized = normalizeChatContent(content);
  const blocks: Array<{ kind: 'paragraph' | 'list' | 'heading'; lines: string[] }> = [];
  let paragraph: string[] = [];
  let list: string[] = [];
  const flushParagraph = () => {
    if (paragraph.length > 0) {
      blocks.push({ kind: 'paragraph', lines: [paragraph.join(' ')] });
      paragraph = [];
    }
  };
  const flushList = () => {
    if (list.length > 0) {
      blocks.push({ kind: 'list', lines: list });
      list = [];
    }
  };

  for (const line of normalized.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) {
      flushParagraph();
      flushList();
    } else if (trimmed.startsWith('- ')) {
      flushParagraph();
      list.push(trimmed.slice(2));
    } else if (/^#{2,3} /.test(trimmed)) {
      flushParagraph();
      flushList();
      blocks.push({ kind: 'heading', lines: [trimmed] });
    } else {
      flushList();
      paragraph.push(trimmed);
    }
  }
  flushParagraph();
  flushList();

  return (
    <div className="space-y-3">
      {blocks.map((block, blockIndex) => {
        const blockKey = `${block.kind}-${blockIndex}`;
        if (block.kind === 'list') {
          const listItemKeys = new Map<string, number>();
          return (
            <ul key={blockKey} className="list-disc space-y-1 pl-5">
              {block.lines.map((line) => {
                const occurrence = listItemKeys.get(line) ?? 0;
                listItemKeys.set(line, occurrence + 1);
                return <li key={`${blockKey}-${line}-${occurrence}`}>{inlineMarkdown(line)}</li>;
              })}
            </ul>
          );
        }
        const value = block.lines[0] ?? '';
        if (block.kind === 'heading') {
          return (
            <h4 key={blockKey} className="font-semibold text-zinc-900">
              {inlineMarkdown(value.replace(/^#{2,3} /, ''))}
            </h4>
          );
        }
        return <p key={blockKey}>{inlineMarkdown(value)}</p>;
      })}
    </div>
  );
}

function inlineMarkdown(value: string) {
  const parts = value.split(/(`[^`]+`|\*\*[^*]+\*\*)/g);
  return parts.map((part) => {
    if (part.startsWith('`') && part.endsWith('`'))
      return (
        <code key={`code-${part}`} className="rounded bg-zinc-100 px-1 text-xs text-zinc-900">
          {part.slice(1, -1)}
        </code>
      );
    if (part.startsWith('**') && part.endsWith('**'))
      return <strong key={`strong-${part}`}>{part.slice(2, -2)}</strong>;
    return part;
  });
}
