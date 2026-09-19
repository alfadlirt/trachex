import { createRoute, Link, useParams } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { api, type Ticket } from '../lib/api.ts';
import { rootRoute } from './__root.tsx';

export const projectTicketsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/projects/$projectId',
  component: ProjectTicketsPage,
});

function ProjectTicketsPage() {
  const { projectId } = useParams({ from: projectTicketsRoute.id });
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [key, setKey] = useState('');
  const [title, setTitle] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .listTickets(projectId)
      .then((r) => setTickets(r.tickets))
      .catch((e) => setError(String(e)));
  }, [projectId]);

  const create = async () => {
    setError(null);
    try {
      const r = await fetch(`/api/projects/${projectId}/tickets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, title: title || key }),
      });
      if (!r.ok) throw new Error((await r.json()).error?.message ?? 'failed');
      const body = (await r.json()) as { ticket: Ticket };
      setTickets((prev) => [...prev, body.ticket]);
      setKey('');
      setTitle('');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div className="dashboard-paper overflow-hidden rounded-2xl">
      <div className="border-b border-zinc-200 px-5 py-6 sm:px-8">
        <Link to="/projects" className="text-sm text-zinc-500 hover:text-zinc-950 hover:underline">
          Projects / back to index
        </Link>
        <p className="mt-5 text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">
          Project workspace
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-950">Tickets</h1>
        <p className="mt-2 text-sm text-zinc-600">
          Open a ticket to inspect what must be built, what changed, and what still needs
          confirmation.
        </p>
      </div>
      {error && (
        <p className="mb-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      <div className="flex flex-col gap-3 border-b border-zinc-200 bg-zinc-50/70 px-5 py-4 sm:flex-row sm:items-end sm:px-8">
        <input
          className="min-h-11 rounded-md border border-zinc-300 bg-white px-3 text-sm"
          placeholder="key"
          value={key}
          onChange={(e) => setKey(e.target.value)}
        />
        <input
          className="min-h-11 rounded-md border border-zinc-300 bg-white px-3 text-sm"
          placeholder="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <button
          type="button"
          className="min-h-11 rounded-md bg-zinc-950 px-4 text-sm font-medium text-white hover:bg-zinc-800"
          onClick={create}
        >
          Create
        </button>
      </div>
      <ul className="divide-y divide-zinc-200">
        {tickets.map((t) => (
          <li
            key={t.id}
            className="bg-white px-5 py-4 transition-colors hover:bg-amber-50/40 sm:px-8"
          >
            <Link
              to="/projects/$projectId/tickets/$ticketKey"
              params={{ projectId, ticketKey: t.key }}
              className="font-medium hover:underline"
            >
              {t.key}
            </Link>
            <span className="ml-2 text-sm text-zinc-500">{t.title}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
