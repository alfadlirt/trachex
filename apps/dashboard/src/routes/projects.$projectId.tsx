import { createRoute, Link, useNavigate, useParams } from '@tanstack/react-router';
import { Pencil, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { DangerConfirmDialog, SimpleEditDialog } from '../components/crud-dialogs.tsx';
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
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [title, setTitle] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Ticket | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [editBusy, setEditBusy] = useState(false);
  const [deleting, setDeleting] = useState<Ticket | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [editingProject, setEditingProject] = useState(false);
  const [projectEditError, setProjectEditError] = useState<string | null>(null);
  const [projectEditBusy, setProjectEditBusy] = useState(false);
  const [deletingProject, setDeletingProject] = useState(false);
  const [projectDeleteError, setProjectDeleteError] = useState<string | null>(null);
  const [projectDeleteBusy, setProjectDeleteBusy] = useState(false);

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
    const trimmed = title.trim();
    if (!trimmed) {
      setError('Give the subject a title first.');
      return;
    }
    try {
      const slug = toSnakeCase(trimmed);
      if (!slug) throw new Error('That title cannot form a key. Add letters or numbers.');
      const body = await api.createTicket(projectId, { key: slug, title: trimmed });
      setTickets((prev) => [...prev, body.ticket]);
      setTitle('');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const saveEdit = async (input: { name: string; slug: string }) => {
    if (!editing) return;
    setEditError(null);
    setEditBusy(true);
    try {
      const r = await api.updateTicket(projectId, editing.key, {
        title: input.name,
        key: input.slug,
      });
      setTickets((prev) => prev.map((t) => (t.id === editing.id ? r.ticket : t)));
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
      await api.deleteTicket(projectId, deleting.key, deleting.title);
      setTickets((prev) => prev.filter((t) => t.id !== deleting.id));
      setDeleting(null);
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : String(e));
    } finally {
      setDeleteBusy(false);
    }
  };

  const saveProjectEdit = async (input: { name: string; slug: string }) => {
    if (!project) return;
    setProjectEditError(null);
    setProjectEditBusy(true);
    try {
      const r = await api.updateProject(project.id, { name: input.name, slug: input.slug });
      setProject(r.project);
      setEditingProject(false);
    } catch (e) {
      setProjectEditError(e instanceof Error ? e.message : String(e));
    } finally {
      setProjectEditBusy(false);
    }
  };

  const confirmProjectDelete = async () => {
    if (!project) return;
    setProjectDeleteError(null);
    setProjectDeleteBusy(true);
    try {
      await api.deleteProject(project.id, project.name);
      void navigate({ to: '/projects' });
    } catch (e) {
      setProjectDeleteError(e instanceof Error ? e.message : String(e));
    } finally {
      setProjectDeleteBusy(false);
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
              <p className="mt-1 break-all font-mono text-xs text-zinc-500">{project.slug}</p>
            )}
            {project?.description && (
              <p className="mt-1 break-words text-sm text-zinc-500">{project.description}</p>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {!loading && (
              <span className="mr-1 text-sm text-zinc-500">
                {tickets.length} {tickets.length === 1 ? 'ticket' : 'tickets'}
              </span>
            )}
            {project && (
              <>
                <button
                  type="button"
                  aria-label={`Edit ${project.name}`}
                  className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md border border-zinc-300 px-3 text-sm text-zinc-700 hover:bg-zinc-100"
                  onClick={() => {
                    setProjectEditError(null);
                    setEditingProject(true);
                  }}
                >
                  <Pencil className="h-4 w-4" aria-hidden="true" />
                  <span className="ml-1 hidden sm:inline">Edit</span>
                </button>
                <button
                  type="button"
                  aria-label={`Delete ${project.name}`}
                  className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md border border-red-200 px-3 text-sm text-red-700 hover:bg-red-50"
                  onClick={() => {
                    setProjectDeleteError(null);
                    setDeletingProject(true);
                  }}
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                  <span className="ml-1 hidden sm:inline">Delete</span>
                </button>
              </>
            )}
          </div>
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
      <div className="border-b border-zinc-200 bg-zinc-50/70 px-5 py-4 sm:px-8">
        <label className="block max-w-xl text-sm font-medium text-zinc-800" htmlFor="subject-title">
          New subject title
        </label>
        <div className="mt-1 flex max-w-xl flex-col gap-3 sm:flex-row">
          <input
            id="subject-title"
            className="min-h-11 flex-1 rounded-md border border-zinc-300 bg-white px-3 text-sm"
            placeholder="Billing adjustment"
            aria-label="Subject title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
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
        {title.trim() && (
          <p className="mt-1 text-xs text-zinc-500">
            Key preview: <span className="font-mono">{toSnakeCase(title.trim())}</span>
          </p>
        )}
      </div>
      {loading ? (
        <p className="px-5 py-8 text-sm text-zinc-500 sm:px-8" role="status">
          Loading tickets…
        </p>
      ) : (
        tickets.length > 0 && (
          <ul className="divide-y divide-zinc-200">
            {tickets.map((t) => (
              <li
                key={t.id}
                className="flex flex-wrap items-start justify-between gap-3 bg-white px-5 py-5 transition-colors hover:bg-amber-50/40 sm:px-8"
              >
                <div className="min-w-0">
                  <Link
                    to="/projects/$projectId/tickets/$ticketKey"
                    params={{ projectId, ticketKey: t.key }}
                    className="rounded text-base font-semibold text-zinc-950 hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-500"
                  >
                    {t.title}
                  </Link>
                  <p className="mt-0.5 break-all font-mono text-xs text-zinc-500">{t.key}</p>
                  <p className="mt-1 break-words text-sm text-zinc-600">
                    {t.description ?? 'No description provided.'}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    aria-label={`Edit ${t.title}`}
                    className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md border border-zinc-300 px-3 text-sm text-zinc-700 hover:bg-zinc-100"
                    onClick={() => {
                      setEditError(null);
                      setEditing(t);
                    }}
                  >
                    <Pencil className="h-4 w-4" aria-hidden="true" />
                    <span className="ml-1 hidden sm:inline">Edit</span>
                  </button>
                  <button
                    type="button"
                    aria-label={`Delete ${t.title}`}
                    className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md border border-red-200 px-3 text-sm text-red-700 hover:bg-red-50"
                    onClick={() => {
                      setDeleteError(null);
                      setDeleting(t);
                    }}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                    <span className="ml-1 hidden sm:inline">Delete</span>
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )
      )}
      {!loading && tickets.length === 0 && !error && (
        <p className="px-5 py-8 text-sm text-zinc-500 sm:px-8">
          No tickets yet. Create the first ticket to start an evidence-backed checklist.
        </p>
      )}
      <SimpleEditDialog
        open={editing !== null}
        title={`Edit ${editing?.title ?? 'subject'}`}
        nameLabel="Subject title"
        slugLabel="Subject key"
        initialName={editing?.title ?? ''}
        initialSlug={editing?.key ?? ''}
        error={editError}
        busy={editBusy}
        onClose={() => setEditing(null)}
        onSave={saveEdit}
      />
      <DangerConfirmDialog
        open={deleting !== null}
        title={`Delete ${deleting?.title ?? 'subject'}?`}
        expectedName={deleting?.title ?? ''}
        cascadeLines={[
          'Its checklist requirements and completion history',
          'Proposals, sources, and evidence',
          'Chats and adjustment jobs for this subject',
        ]}
        confirmLabel="Delete subject"
        error={deleteError}
        busy={deleteBusy}
        onClose={() => setDeleting(null)}
        onConfirm={() => void confirmDelete()}
      />
      <SimpleEditDialog
        open={editingProject}
        title={`Edit ${project?.name ?? 'project'}`}
        nameLabel="Project name"
        slugLabel="Project slug"
        initialName={project?.name ?? ''}
        initialSlug={project?.slug ?? ''}
        error={projectEditError}
        busy={projectEditBusy}
        onClose={() => setEditingProject(false)}
        onSave={saveProjectEdit}
      />
      <DangerConfirmDialog
        open={deletingProject}
        title={`Delete ${project?.name ?? 'project'}?`}
        expectedName={project?.name ?? ''}
        cascadeLines={[
          'Its subjects and tickets',
          'Checklist data, proposals, and sources',
          'Chats and adjustment history',
        ]}
        confirmLabel="Delete project"
        error={projectDeleteError}
        busy={projectDeleteBusy}
        onClose={() => setDeletingProject(false)}
        onConfirm={() => void confirmProjectDelete()}
      />
    </div>
  );
}
