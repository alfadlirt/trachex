import { createRoute, Link } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { api, type Project } from '../lib/api.ts';
import { rootRoute } from './__root.tsx';

export const projectsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/projects',
  component: ProjectsPage,
});

function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [slug, setSlug] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .listProjects()
      .then((r) => setProjects(r.projects))
      .catch((e) => setError(String(e)));
  }, []);

  const create = async () => {
    setError(null);
    try {
      const r = await api.createProject({ slug, name: name || slug });
      setProjects((prev) => [...prev, r.project]);
      setSlug('');
      setName('');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  return (
    <div className="dashboard-paper overflow-hidden rounded-2xl">
      <div className="border-b border-zinc-200 px-5 py-6 sm:px-8">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">
          Workspace index
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-950">Projects</h1>
        <p className="mt-2 max-w-xl text-sm leading-6 text-zinc-600">
          Choose a project to return to its requirements, changes, and open human decisions.
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
          placeholder="slug"
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
        />
        <input
          className="min-h-11 rounded-md border border-zinc-300 bg-white px-3 text-sm"
          placeholder="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
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
        {projects.map((p) => (
          <li
            key={p.id}
            className="bg-white px-5 py-4 transition-colors hover:bg-amber-50/40 sm:px-8"
          >
            <Link
              to="/projects/$projectId"
              params={{ projectId: p.id }}
              className="font-medium hover:underline"
            >
              {p.name}
            </Link>
            <span className="ml-2 text-sm text-zinc-500">{p.slug}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
