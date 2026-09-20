import { createRoute, Link } from '@tanstack/react-router';
import { Pencil, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { DangerConfirmDialog, SimpleEditDialog } from '../components/crud-dialogs.tsx';
import { api, type Project } from '../lib/api.ts';
import { toSnakeCase } from '../lib/utils.ts';
import { rootRoute } from './__root.tsx';

export const projectsRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/projects',
  component: ProjectsPage,
});

function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Project | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [editBusy, setEditBusy] = useState(false);
  const [deleting, setDeleting] = useState<Project | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);

  useEffect(() => {
    api
      .listProjects()
      .then((r) => {
        setProjects(r.projects);
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, []);

  const create = async () => {
    setError(null);
    const trimmed = name.trim();
    if (!trimmed) {
      setError('Give the project a name first.');
      return;
    }
    try {
      const slug = toSnakeCase(trimmed);
      if (!slug) throw new Error('That name cannot form a slug. Add letters or numbers.');
      const r = await api.createProject({ slug, name: trimmed });
      setProjects((prev) => [...prev, r.project]);
      setName('');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const saveEdit = async (input: { name: string; slug: string }) => {
    if (!editing) return;
    setEditError(null);
    setEditBusy(true);
    try {
      const r = await api.updateProject(editing.id, { name: input.name, slug: input.slug });
      setProjects((prev) => prev.map((p) => (p.id === editing.id ? r.project : p)));
      setEditing(null);
    } catch (e) {
      setEditError(e instanceof Error ? e.message : String(e));
    } finally {
      setEditBusy(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setDeleteError(null);
    setDeleteBusy(true);
    try {
      await api.deleteProject(deleting.id, deleting.name);
      setProjects((prev) => prev.filter((p) => p.id !== deleting.id));
      setDeleting(null);
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : String(e));
    } finally {
      setDeleteBusy(false);
    }
  };

  return (
    <div className="dashboard-paper overflow-hidden rounded-2xl">
      <div className="border-b border-zinc-200 px-5 py-6 sm:px-8">
        <Link
          to="/"
          className="inline-flex min-h-10 items-center rounded text-sm text-zinc-500 hover:text-zinc-950 hover:underline"
        >
          ← Back to overview
        </Link>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">
          Workspace index
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-950">Projects</h1>
        <p className="mt-2 max-w-xl text-sm leading-6 text-zinc-600">
          Choose a project to return to its requirements, changes, and open human decisions.
        </p>
        {!loading && (
          <p className="mt-4 text-xs font-medium uppercase tracking-[0.14em] text-zinc-400">
            {projects.length} {projects.length === 1 ? 'project' : 'projects'} in this workspace
          </p>
        )}
      </div>
      {error && (
        <p className="mb-3 rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      <div className="border-b border-zinc-200 bg-zinc-50/70 px-5 py-4 sm:px-8">
        <label className="block max-w-xl text-sm font-medium text-zinc-800" htmlFor="project-name">
          New project name
        </label>
        <div className="mt-1 flex max-w-xl flex-col gap-3 sm:flex-row">
          <input
            id="project-name"
            className="min-h-11 flex-1 rounded-md border border-zinc-300 bg-white px-3 text-sm"
            placeholder="Customer portal"
            aria-label="Project name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && create()}
          />
          <button
            type="button"
            className="min-h-11 rounded-md bg-zinc-950 px-4 text-sm font-medium text-white hover:bg-zinc-800"
            onClick={create}
          >
            Create
          </button>
        </div>
        {name.trim() && (
          <p className="mt-1 text-xs text-zinc-500">
            Slug preview: <span className="font-mono">{toSnakeCase(name.trim())}</span>
          </p>
        )}
      </div>
      {loading ? (
        <p className="px-5 py-8 text-sm text-zinc-500 sm:px-8" role="status">
          Loading projects…
        </p>
      ) : projects.length > 0 ? (
        <ul className="divide-y divide-zinc-200">
          {projects.map((p) => (
            <li
              key={p.id}
              className="flex flex-wrap items-start justify-between gap-3 bg-white px-5 py-5 transition-colors hover:bg-amber-50/40 sm:px-8"
            >
              <div className="min-w-0">
                <Link
                  to="/projects/$projectId"
                  params={{ projectId: p.id }}
                  className="rounded text-base font-semibold text-zinc-950 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-500"
                >
                  {p.name}
                </Link>
                <p className="mt-0.5 break-all font-mono text-xs text-zinc-500">{p.slug}</p>
                <p className="mt-1 break-words text-sm text-zinc-600">
                  {p.description ?? 'No description provided.'}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  aria-label={`Edit ${p.name}`}
                  className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md border border-zinc-300 px-3 text-sm text-zinc-700 hover:bg-zinc-100"
                  onClick={() => {
                    setEditError(null);
                    setEditing(p);
                  }}
                >
                  <Pencil className="h-4 w-4" aria-hidden="true" />
                  <span className="ml-1 hidden sm:inline">Edit</span>
                </button>
                <button
                  type="button"
                  aria-label={`Delete ${p.name}`}
                  className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md border border-red-200 px-3 text-sm text-red-700 hover:bg-red-50"
                  onClick={() => {
                    setDeleteError(null);
                    setDeleting(p);
                  }}
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                  <span className="ml-1 hidden sm:inline">Delete</span>
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="px-5 py-8 text-sm text-zinc-500 sm:px-8">
          No projects yet. Create a project to start an evidence-backed workspace.
        </p>
      )}
      <SimpleEditDialog
        open={editing !== null}
        title={`Edit ${editing?.name ?? 'project'}`}
        nameLabel="Project name"
        slugLabel="Project slug"
        initialName={editing?.name ?? ''}
        initialSlug={editing?.slug ?? ''}
        error={editError}
        busy={editBusy}
        onClose={() => setEditing(null)}
        onSave={saveEdit}
      />
      <DangerConfirmDialog
        open={deleting !== null}
        title={`Delete ${deleting?.name ?? 'project'}?`}
        expectedName={deleting?.name ?? ''}
        cascadeLines={[
          'Its subjects and tickets',
          'Checklist data, proposals, and sources',
          'Chats and adjustment history',
        ]}
        confirmLabel="Delete project"
        error={deleteError}
        busy={deleteBusy}
        onClose={() => setDeleting(null)}
        onConfirm={() => void confirmDelete()}
      />
    </div>
  );
}
