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
    <div>
      <Link to="/projects" className="text-sm text-zinc-500 hover:underline">
        ← Projects
      </Link>
      <h1 className="mb-4 mt-2 text-xl font-semibold">Tickets</h1>
      {error && (
        <p className="mb-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      <div className="mb-6 flex gap-2">
        <input
          className="rounded border border-zinc-300 px-3 py-1.5 text-sm"
          placeholder="key"
          value={key}
          onChange={(e) => setKey(e.target.value)}
        />
        <input
          className="rounded border border-zinc-300 px-3 py-1.5 text-sm"
          placeholder="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <button
          type="button"
          className="rounded bg-zinc-900 px-3 py-1.5 text-sm text-white hover:bg-zinc-700"
          onClick={create}
        >
          Create
        </button>
      </div>
      <ul className="space-y-2">
        {tickets.map((t) => (
          <li key={t.id} className="rounded border border-zinc-200 bg-white p-3">
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
