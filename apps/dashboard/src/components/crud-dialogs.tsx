import { useEffect, useRef, useState } from 'react';
import { cn } from '../lib/utils.ts';

export interface DangerConfirmDialogProps {
  open: boolean;
  title: string;
  expectedName: string;
  cascadeLines: string[];
  confirmLabel: string;
  error: string | null;
  busy: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export function DangerConfirmDialog({
  open,
  title,
  expectedName,
  cascadeLines,
  confirmLabel,
  error,
  busy,
  onClose,
  onConfirm,
}: DangerConfirmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [typed, setTyped] = useState('');

  useEffect(() => {
    if (open) setTyped('');
  }, [open]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const handleClose = () => onClose();
    dialog.addEventListener('close', handleClose);
    return () => dialog.removeEventListener('close', handleClose);
  }, [onClose]);

  const matches = typed === expectedName;

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="danger-title"
      className="m-auto w-[min(calc(100%-2rem),30rem)] rounded-2xl border border-red-200 bg-[#fffdf8] p-0 text-zinc-950 shadow-2xl"
    >
      <div className="p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-red-700">
          Danger zone
        </p>
        <h2 id="danger-title" className="mt-2 text-xl font-semibold tracking-tight">
          {title}
        </h2>
        <p className="mt-3 text-sm leading-6 text-zinc-600">
          This permanently deletes <strong>{expectedName}</strong> and everything below:
        </p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-zinc-700">
          {cascadeLines.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
        <label className="mt-4 block text-sm font-medium text-zinc-800">
          Type <span className="font-semibold text-zinc-950">{expectedName}</span> to confirm
          <input
            aria-label={`Type ${expectedName} to confirm deletion`}
            className="mt-1 min-h-11 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-red-700"
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            autoComplete="off"
          />
        </label>
        {error && (
          <p className="mt-2 text-sm text-red-700" role="alert">
            {error}
          </p>
        )}
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            className="min-h-11 rounded-md px-4 text-sm font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-50"
            onClick={onClose}
            disabled={busy}
          >
            Cancel
          </button>
          <button
            type="button"
            className={cn(
              'min-h-11 rounded-md px-4 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50',
              matches ? 'bg-red-700 hover:bg-red-600' : 'bg-zinc-400',
            )}
            onClick={onConfirm}
            disabled={!matches || busy}
          >
            {busy ? 'Deleting…' : confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}

export interface SimpleEditDialogProps {
  open: boolean;
  title: string;
  nameLabel: string;
  slugLabel: string;
  initialName: string;
  initialSlug: string;
  error: string | null;
  busy: boolean;
  onClose: () => void;
  onSave: (input: { name: string; slug: string }) => void;
}

export function SimpleEditDialog({
  open,
  title,
  nameLabel,
  slugLabel,
  initialName,
  initialSlug,
  error,
  busy,
  onClose,
  onSave,
}: SimpleEditDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [name, setName] = useState(initialName);
  const [slug, setSlug] = useState(initialSlug);

  useEffect(() => {
    if (open) {
      setName(initialName);
      setSlug(initialSlug);
    }
  }, [open, initialName, initialSlug]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const handleClose = () => onClose();
    dialog.addEventListener('close', handleClose);
    return () => dialog.removeEventListener('close', handleClose);
  }, [onClose]);

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="edit-dialog-title"
      className="m-auto w-[min(calc(100%-2rem),28rem)] rounded-2xl border border-zinc-200 bg-[#fffdf8] p-0 text-zinc-950 shadow-2xl"
    >
      <div className="p-6">
        <h2 id="edit-dialog-title" className="text-xl font-semibold tracking-tight">
          {title}
        </h2>
        <label className="mt-4 block text-sm font-medium text-zinc-800">
          {nameLabel}
          <input
            className="mt-1 min-h-11 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <label className="mt-3 block text-sm font-medium text-zinc-800">
          {slugLabel}
          <input
            className="mt-1 min-h-11 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm"
            value={slug}
            onChange={(event) => setSlug(event.target.value)}
          />
        </label>
        {error && (
          <p className="mt-2 text-sm text-red-700" role="alert">
            {error}
          </p>
        )}
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            className="min-h-11 rounded-md px-4 text-sm font-medium text-zinc-700 hover:bg-zinc-100 disabled:opacity-50"
            onClick={onClose}
            disabled={busy}
          >
            Cancel
          </button>
          <button
            type="button"
            className="min-h-11 rounded-md bg-zinc-950 px-4 text-sm font-medium text-white hover:bg-zinc-800 disabled:cursor-wait disabled:opacity-60"
            onClick={() => onSave({ name, slug })}
            disabled={busy || !name.trim() || !slug.trim()}
          >
            {busy ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>
    </dialog>
  );
}
