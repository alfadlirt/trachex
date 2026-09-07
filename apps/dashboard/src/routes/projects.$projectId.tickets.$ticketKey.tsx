import { createRoute, Link, useParams } from '@tanstack/react-router';
import { CheckCircle2, Circle, Download, History, MessageSquare } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { api, type TicketCanvas } from '../lib/api.ts';
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

  const load = () => {
    api
      .getCanvas(projectId, ticketKey)
      .then(setData)
      .catch((e) => setError(String(e)));
  };

  useEffect(load, [projectId, ticketKey]);

  if (error) return <p className="text-red-700">{error}</p>;
  if (!data) return <p className="text-zinc-500">Loading…</p>;

  const check = async (requirementId: string) => {
    if (!window.confirm('Mark this requirement as complete? This is a human action.')) return;
    await api.checkRequirement(requirementId);
    load();
  };

  const approve = async (proposalId: string) => {
    if (
      !window.confirm('Approve this proposal? It will create or supersede canonical requirements.')
    )
      return;
    await api.approveProposal(proposalId);
    load();
  };

  const reject = async (proposalId: string) => {
    await api.rejectProposal(proposalId);
    load();
  };

  const submitAdjustment = async () => {
    if (!note.trim()) return;
    await api.addAdjustment(projectId, ticketKey, {
      source,
      ...(attribution ? { attribution } : {}),
      note,
    });
    setNote('');
    setAttribution('');
    load();
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
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <Link
            to="/projects/$projectId"
            params={{ projectId }}
            className="text-sm text-zinc-500 hover:underline"
          >
            {data.project.name}
          </Link>
          <span className="mx-2 text-zinc-400">/</span>
          <span className="font-semibold">{data.ticket.key}</span>
          <span className="ml-2 text-sm text-zinc-500">{data.ticket.title}</span>
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

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-lg font-semibold">Current Checklist</h2>
            <span className="text-sm text-zinc-500">
              {data.checklist.filter((r) => r.devStatus === 'checked').length}/
              {data.checklist.length} done
            </span>
          </div>

          <ul className="space-y-2">
            {data.checklist.map((r) => (
              <li key={r.id} className="rounded border border-zinc-200 bg-white p-3">
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
                    <p className="text-sm font-medium">{p.kind} proposal</p>
                    <p className="text-xs text-zinc-500">{p.id}</p>
                    <div className="mt-2 flex gap-2">
                      <button
                        type="button"
                        className="rounded bg-emerald-600 px-2 py-1 text-xs text-white hover:bg-emerald-500"
                        onClick={() => approve(p.id)}
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

          <div className="mt-6 rounded border border-zinc-200 bg-white p-3">
            <h3 className="mb-2 font-semibold">Add Adjustment</h3>
            <div className="mb-2 flex gap-2">
              <select
                className="rounded border border-zinc-300 px-2 py-1 text-sm"
                value={source}
                onChange={(e) => setSource(e.target.value)}
              >
                {['fsd', 'brd', 'chat', 'meeting', 'clarification', 'uat', 'manual', 'context'].map(
                  (s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ),
                )}
              </select>
              <input
                className="rounded border border-zinc-300 px-2 py-1 text-sm"
                placeholder="attribution"
                value={attribution}
                onChange={(e) => setAttribution(e.target.value)}
              />
            </div>
            <textarea
              className="w-full rounded border border-zinc-300 px-2 py-1 text-sm"
              rows={3}
              placeholder="Note (e.g. discount cap should be 15%, not 20%)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            <button
              type="button"
              className="mt-2 rounded bg-zinc-900 px-3 py-1.5 text-sm text-white hover:bg-zinc-700"
              onClick={submitAdjustment}
            >
              Submit for reconciliation
            </button>
          </div>
        </div>

        <aside className="space-y-4">
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
    </div>
  );
}

function ChatPanel({ projectId, ticketKey }: { projectId: string; ticketKey: string }) {
  const [message, setMessage] = useState('');
  const [log, setLog] = useState<{ id: number; text: string }[]>([]);
  const nextId = useRef(0);
  const append = (text: string) => setLog((prev) => [...prev, { id: nextId.current++, text }]);

  const send = async () => {
    if (!message.trim()) return;
    const res = await fetch(`/api/chat/${projectId}/${ticketKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message }),
    });
    const reader = res.body?.getReader();
    if (!reader) return;
    const decoder = new TextDecoder();
    append(`> ${message}`);
    setMessage('');
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const text = decoder.decode(value);
      for (const line of text.trim().split('\n')) {
        if (!line) continue;
        try {
          const ev = JSON.parse(line) as { type: string; text?: string; error?: string };
          if (ev.type === 'error') append(`error: ${ev.error}`);
          else if (ev.text) {
            const text = ev.text;
            append(text);
          }
        } catch {
          append(line);
        }
      }
    }
  };

  return (
    <div className="rounded border border-zinc-200 bg-white p-3">
      <h4 className="mb-2 text-sm font-semibold">Assistant</h4>
      <div className="mb-2 max-h-64 space-y-1 overflow-y-auto text-xs text-zinc-600">
        {log.map((entry) => (
          <p key={entry.id}>{entry.text}</p>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          className="flex-1 rounded border border-zinc-300 px-2 py-1 text-sm"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
          placeholder="Ask about this ticket"
        />
        <button
          type="button"
          className="rounded bg-zinc-900 px-2 py-1 text-sm text-white hover:bg-zinc-700"
          onClick={send}
        >
          Send
        </button>
      </div>
      <p className="mt-2 text-[11px] text-zinc-400">
        Chat only creates pending proposals — never silent changes.
      </p>
    </div>
  );
}
