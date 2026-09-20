import { createRoute, Link, useParams } from '@tanstack/react-router';
import { CheckCircle2, Circle, Download, History, MessageSquare } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  api,
  type ChatMessage,
  type ChatSession,
  type ProposalReview,
  type ProposalReviewDraft,
  type TicketCanvas,
} from '../lib/api.ts';
import { mergeEvidence, normalizeChatContent } from '../lib/chat-format.ts';
import { rootRoute } from './__root.tsx';

export const ticketCanvasRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/projects/$projectId/tickets/$ticketKey',
  component: TicketCanvasPage,
});

function TicketCanvasPage() {
  const { projectId, ticketKey } = useParams({ from: ticketCanvasRoute.id });
  const [data, setData] = useState<TicketCanvas | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [panel, setPanel] = useState<'context' | 'history' | 'chat'>('context');
  const [note, setNote] = useState('');
  const [source, setSource] = useState('chat');
  const [attribution, setAttribution] = useState('');
  const [file, setFile] = useState<File | undefined>();
  const [adjustmentState, setAdjustmentState] = useState<'idle' | 'submitting' | 'success'>('idle');
  const [adjustmentError, setAdjustmentError] = useState<string | null>(null);
  const [dirtyProposals, setDirtyProposals] = useState<Set<string>>(new Set());
  const [confirmation, setConfirmation] = useState<Confirmation | null>(null);

  const load = useCallback(() => {
    api
      .getCanvas(projectId, ticketKey)
      .then(setData)
      .catch((e) => setError(String(e)));
  }, [projectId, ticketKey]);

  useEffect(load, [load]);
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
      load();
    } catch (e) {
      setAdjustmentState('idle');
      setAdjustmentError(e instanceof Error ? e.message : 'The adjustment could not be submitted.');
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
        <div>
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
          <p className="mt-2 text-sm text-zinc-500">{data.ticket.title}</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            className="flex items-center gap-1 rounded border border-zinc-300 px-2 py-1 text-sm hover:bg-zinc-100"
            onClick={() => download('markdown')}
          >
            <Download className="h-4 w-4" /> MD
          </button>
          <button
            type="button"
            className="flex items-center gap-1 rounded border border-zinc-300 px-2 py-1 text-sm hover:bg-zinc-100"
            onClick={() => download('json')}
          >
            <Download className="h-4 w-4" /> JSON
          </button>
        </div>
      </div>

      <TicketEvidenceSummary data={data} pendingCount={pending.length} />
      <section
        className="border-b border-zinc-200 px-5 py-4 sm:px-8"
        aria-label="Adjustment processing"
      >
        <h2 className="font-semibold text-zinc-950">Adjustment processing</h2>
        <div className="mt-2 space-y-2">
          {data.adjustmentJobs.length === 0 && (
            <p className="text-sm text-zinc-500">No adjustments yet.</p>
          )}
          {data.adjustmentJobs.map((job) => (
            <div
              key={job.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded border border-zinc-200 p-3 text-sm"
            >
              <span>
                {job.sourceType} · {job.status}
              </span>
              {job.error && <span className="text-red-700">{job.error}</span>}
              {job.status === 'failed' && (
                <button
                  type="button"
                  className="rounded bg-zinc-900 px-3 py-2 text-white"
                  onClick={() => api.retryAdjustment(projectId, ticketKey, job.id).then(load)}
                >
                  Retry
                </button>
              )}
            </div>
          ))}
        </div>
      </section>

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
              {data.checklist.filter((r) => r.devStatus === 'checked').length}/
              {data.checklist.length} done
            </span>
          </div>

          <ul className="space-y-3">
            {data.checklist.map((r) => (
              <li
                key={r.id}
                className="rounded-xl border border-zinc-200 bg-white p-4 shadow-[0_1px_0_rgba(24,24,27,0.04)]"
              >
                <div className="flex items-start gap-2">
                  <button
                    type="button"
                    onClick={() => check(r.id)}
                    className="mt-0.5 text-zinc-400 hover:text-zinc-900"
                    title={r.devStatus === 'checked' ? 'Checked' : 'Mark complete'}
                  >
                    {r.devStatus === 'checked' ? (
                      <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                    ) : (
                      <Circle className="h-5 w-5" />
                    )}
                  </button>
                  <div>
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
                      <details className="mt-1">
                        <summary className="text-xs text-zinc-500">Test scenarios</summary>
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
                </div>
              </li>
            ))}
            {data.checklist.length === 0 && (
              <li className="text-sm text-zinc-500">No active requirements yet.</li>
            )}
          </ul>

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
                          <ProposalEditor
                            proposalId={p.id}
                            projectId={projectId}
                            ticketKey={ticketKey}
                            review={review}
                            checklist={data.checklist}
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

          <div className="mt-6 rounded-xl border border-zinc-200 bg-white p-4">
            <h3 className="font-semibold">Add adjustment</h3>
            <p className="mt-1 text-sm text-zinc-500">
              Add local evidence for reconciliation. It creates a proposal for review, never a
              direct checklist change.
            </p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="text-sm font-medium">
                Source type
                <select
                  className="mt-1 block w-full rounded border border-zinc-300 px-2 py-2 text-sm"
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                >
                  {[
                    'fsd',
                    'brd',
                    'chat',
                    'meeting',
                    'clarification',
                    'uat',
                    'manual',
                    'context',
                  ].map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-sm font-medium">
                Attribution <span className="font-normal text-zinc-500">(optional)</span>
                <input
                  className="mt-1 block w-full rounded border border-zinc-300 px-2 py-2 text-sm"
                  placeholder="Who supplied this?"
                  value={attribution}
                  onChange={(e) => setAttribution(e.target.value)}
                />
              </label>
            </div>
            <label className="mt-3 block text-sm font-medium">
              Note{' '}
              <span className="font-normal text-zinc-500">(optional when a file is attached)</span>
              <textarea
                className="mt-1 w-full rounded border border-zinc-300 px-2 py-2 text-sm"
                rows={3}
                placeholder="Note (e.g. discount cap should be 15%, not 20%)"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </label>
            <label className="mt-3 block text-sm font-medium">
              Source document
              <input
                className="mt-1 block w-full rounded border border-dashed border-zinc-300 p-2 text-sm"
                type="file"
                accept=".md,.markdown,.pdf,application/pdf,text/markdown"
                onChange={(e) => setFile(e.target.files?.[0])}
              />
            </label>
            {file && (
              <div className="mt-2 flex items-center justify-between rounded bg-zinc-50 px-3 py-2 text-sm">
                <span>
                  {file.name} · {file.type || 'type not supplied'} · {(file.size / 1024).toFixed(1)}{' '}
                  KB
                </span>
                <button
                  type="button"
                  className="text-red-700 underline"
                  onClick={() => setFile(undefined)}
                >
                  Remove
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
              className="mt-2 rounded bg-zinc-900 px-3 py-1.5 text-sm text-white hover:bg-zinc-700"
              onClick={submitAdjustment}
              disabled={adjustmentState === 'submitting'}
            >
              {adjustmentState === 'submitting' ? 'Processing…' : 'Submit for reconciliation'}
            </button>
          </div>
        </div>

        <aside className="border-t border-zinc-200 bg-zinc-50/60 p-5 sm:p-6 lg:border-l lg:border-t-0">
          <div className="flex gap-2">
            <button
              type="button"
              className={`rounded px-2 py-1 text-sm ${panel === 'context' ? 'bg-zinc-900 text-white' : 'bg-zinc-200'}`}
              onClick={() => setPanel('context')}
            >
              Context
            </button>
            <button
              type="button"
              className={`flex items-center gap-1 rounded px-2 py-1 text-sm ${panel === 'history' ? 'bg-zinc-900 text-white' : 'bg-zinc-200'}`}
              onClick={() => setPanel('history')}
            >
              <History className="h-3 w-3" /> History
            </button>
            <button
              type="button"
              className={`flex items-center gap-1 rounded px-2 py-1 text-sm ${panel === 'chat' ? 'bg-zinc-900 text-white' : 'bg-zinc-200'}`}
              onClick={() => setPanel('chat')}
            >
              <MessageSquare className="h-3 w-3" /> Chat
            </button>
          </div>

          {panel === 'context' && (
            <div className="rounded border border-zinc-200 bg-white p-3">
              <h4 className="mb-2 text-sm font-semibold">Impacts</h4>
              <ul className="space-y-1 text-sm text-zinc-600">
                {data.impacts.map((i) => (
                  <li key={i.id}>
                    <span className="text-zinc-400">{i.kind}:</span> {i.value}
                  </li>
                ))}
                {data.impacts.length === 0 && (
                  <li className="text-zinc-500">No impacts recorded.</li>
                )}
              </ul>
            </div>
          )}

          {panel === 'history' && (
            <div className="rounded border border-zinc-200 bg-white p-3">
              <h4 className="mb-2 text-sm font-semibold">Timeline</h4>
              <ul className="space-y-1 text-xs text-zinc-600">
                {data.timeline.map((e) => (
                  <li key={`${e.at}-${e.description}`} className="border-l-2 border-zinc-200 pl-2">
                    <span className="text-zinc-400">{e.at.slice(0, 10)}</span> — {e.description}
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
  const checked = data.checklist.filter((item) => item.devStatus === 'checked').length;
  const active = data.checklist.filter((item) => item.lifecycleStatus === 'active').length;
  const impacts = { service: 0, api: 0, page: 0 };
  for (const impact of data.impacts) impacts[impact.kind] += 1;
  const metrics = [
    { label: 'Checklist', value: `${checked}/${data.checklist.length}`, detail: 'checked' },
    {
      label: 'Requirements',
      value: `${active} active`,
      detail: 'Superseded requirements are not included in this canvas response',
    },
    { label: 'Review', value: String(pendingCount), detail: 'pending proposals' },
    {
      label: 'Impacts',
      value: `${data.impacts.length}`,
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
  const [log, setLog] = useState<ChatMessage[]>([]);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [chatView, setChatView] = useState<'chat' | 'sessions'>('chat');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
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
    api
      .getChatHistory(projectId, ticketKey)
      .then((result) => {
        setSessions(result.sessions);
        const active =
          result.sessions.find((item) => item.session.id === sessionId) ?? result.sessions[0];
        if (active) {
          setSessionId(active.session.id);
          setLog(active.messages);
        }
      })
      .catch(() => undefined);
  }, [projectId, ticketKey, sessionId]);

  const newChat = async () => {
    const result = await api.createChatSession(projectId, ticketKey);
    setSessionId(result.session.id);
    setLog([]);
    setError(null);
    setChatView('chat');
  };

  const send = async () => {
    const prompt = message.trim();
    if (!prompt || sending) return;
    setSending(true);
    setError(null);
    append('user', prompt);
    setMessage('');
    try {
      const res = await fetch(`/api/chat/${projectId}/${ticketKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: prompt, sessionId }),
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
        };
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
    } catch (cause) {
      const detail = cause instanceof Error ? cause.message : String(cause);
      setError(detail);
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
              onClick={() => {
                setSessionId(item.session.id);
                setLog(item.messages);
                setChatView('chat');
              }}
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
          </p>
          <div className="mb-2 max-h-80 space-y-3 overflow-y-auto text-sm leading-6 text-zinc-600">
            {log.length === 0 && (
              <p className="text-zinc-500">
                No questions yet. The assistant reads this ticket's evidence.
              </p>
            )}
            {log.map((entry) => (
              <div key={entry.id} className={entry.role === 'user' ? 'ml-6 text-zinc-900' : 'mr-3'}>
                {entry.role === 'user' ? (
                  <p className="font-medium">{entry.content}</p>
                ) : (
                  <ChatMarkdown content={entry.content} />
                )}
              </div>
            ))}
          </div>
          {error && <p className="mb-2 text-xs text-red-700">{error}</p>}
          <div className="flex gap-2">
            <input
              className="flex-1 rounded border border-zinc-300 px-2 py-1 text-sm"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && send()}
              placeholder="Ask about this ticket"
              disabled={sending}
            />
            <button
              type="button"
              className="min-w-20 rounded bg-zinc-900 px-2 py-1 text-sm text-white hover:bg-zinc-700"
              onClick={send}
              disabled={sending || !message.trim()}
            >
              {sending ? 'Reading…' : 'Ask'}
            </button>
          </div>
          <p className="mt-2 text-[11px] text-zinc-400">
            Chat only creates pending proposals — never silent changes.
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
