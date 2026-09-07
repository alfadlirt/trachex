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
    <div>
      <h1 className="mb-4 text-xl font-semibold">Projects</h1>
      {error && (
        <p className="mb-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      <div className="mb-6 flex gap-2">
        <input
          className="rounded border border-zinc-300 px-3 py-1.5 text-sm"
          placeholder="slug"
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
        />
        <input
          className="rounded border border-zinc-300 px-3 py-1.5 text-sm"
          placeholder="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
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
        {projects.map((p) => (
          <li key={p.id} className="rounded border border-zinc-200 bg-white p-3">
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
