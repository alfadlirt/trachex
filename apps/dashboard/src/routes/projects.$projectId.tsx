import { createRoute, Link, useParams } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { api, type Project, type Ticket } from '../lib/api.ts';
import { toSnakeCase } from '../lib/utils.ts';
import { rootRoute } from './__root.tsx';

export const projectTicketsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/projects/$projectId',
  component: ProjectTicketsPage,
});

function ProjectTicketsPage() {
  const { projectId } = useParams({ from: projectTicketsRoute.id });
  const [project, setProject] = useState<Project | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [key, setKey] = useState('');
  const [title, setTitle] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .listTickets(projectId)
      .then((r) => {
        setProject(r.project);
        setTickets(r.tickets);
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
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
        <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-sm">
          <Link to="/projects" className="text-zinc-500 hover:text-zinc-950 hover:underline">
            Projects
          </Link>
          <span aria-hidden="true" className="text-zinc-400">
            /
          </span>
          <span className="font-medium text-zinc-900">{project?.name ?? 'Project'}</span>
        </nav>
        <Link
          to="/projects"
          className="mt-3 inline-flex min-h-10 items-center rounded text-sm text-zinc-500 hover:text-zinc-950 hover:underline"
        >
          ← Back to projects
        </Link>
        <p className="mt-5 text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">
          Project workspace
        </p>
        <div className="mt-2 flex flex-wrap items-baseline justify-between gap-3">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-zinc-950">
              {project?.name ?? 'Project'}
            </h1>
            {project && (
              <p className="mt-1 break-words text-sm text-zinc-500">
                {project.slug}
                {project.description ? ` · ${project.description}` : ''}
              </p>
            )}
          </div>
          {!loading && (
            <span className="text-sm text-zinc-500">
              {tickets.length} {tickets.length === 1 ? 'ticket' : 'tickets'}
            </span>
          )}
        </div>
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
          placeholder="subject name"
          aria-label="Subject name"
          value={title}
          onChange={(e) => {
            const nextTitle = e.target.value;
            setTitle(nextTitle);
            setKey(toSnakeCase(nextTitle));
          }}
        />
        <input
          className="min-h-11 rounded-md border border-zinc-300 bg-white px-3 text-sm"
          placeholder="slug"
          aria-label="Subject slug"
          value={key}
          readOnly
        />
        <button
          type="button"
          className="min-h-11 rounded-md bg-zinc-950 px-4 text-sm font-medium text-white hover:bg-zinc-800"
          onClick={create}
        >
          Create
        </button>
      </div>
      {loading ? (
        <p className="px-5 py-8 text-sm text-zinc-500 sm:px-8" role="status">
          Loading tickets…
        </p>
      ) : (
        tickets.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full table-fixed text-left text-sm">
              <caption className="sr-only">Tickets in {project?.name ?? 'this project'}</caption>
              <thead className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500">
                <tr>
                  <th scope="col" className="w-2/5 px-3 py-3 font-semibold">
                    Title
                  </th>
                  <th scope="col" className="w-1/5 px-3 py-3 font-semibold">
                    Key
                  </th>
                  <th scope="col" className="px-3 py-3 font-semibold sm:pr-8">
                    Description
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200">
                {tickets.map((t) => (
                  <tr
                    key={t.id}
                    className="bg-white align-top transition-colors hover:bg-amber-50/40"
                  >
                    <th scope="row" className="break-words px-5 py-4 font-medium sm:px-8">
                      <Link
                        to="/projects/$projectId/tickets/$ticketKey"
                        params={{ projectId, ticketKey: t.key }}
                        className="rounded hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-500"
                      >
                        {t.title}
                      </Link>
                    </th>
                    <td className="break-words px-3 py-4 text-zinc-600">{t.key}</td>
                    <td className="break-words px-3 py-4 text-zinc-600 sm:pr-8">
                      {t.description ?? 'No description provided.'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}
      {!loading && tickets.length === 0 && !error && (
        <p className="px-5 py-8 text-sm text-zinc-500 sm:px-8">
          No tickets yet. Create the first ticket to start an evidence-backed checklist.
        </p>
      )}
    </div>
  );
}
