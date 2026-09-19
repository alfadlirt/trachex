import { createRoute, Link } from '@tanstack/react-router';
import { X } from 'lucide-react';
import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import { cn } from '../lib/utils.ts';
import { rootRoute } from './__root.tsx';

export const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: LandingPage,
});

type TimelineEvent = {
  id: string;
  label: string;
  source: string;
  timestamp: string;
  status: 'Active' | 'Superseded';
  note: string;
};

const TIMELINE_EVENTS: TimelineEvent[] = [
  {
    id: 'fsd-baseline',
    label: 'FSD seeds the baseline',
    source: 'BRD/FSD v2.1, section 4.3',
    timestamp: 'Mon, 12 Aug 2024, 09:12',
    status: 'Superseded',
    note: 'Checklist item generated from the FSD: discount cap set at 20%, VIP members exempt. The chat adjustment later moved the cap to 15%, so this item is superseded but kept as evidence.',
  },
  {
    id: 'chat-adjustment',
    label: 'Budi (BA) adjusts the cap',
    source: 'Budi (BA), chat message',
    timestamp: 'Wed, 14 Aug 2024, 16:40',
    status: 'Active',
    note: 'One-line adjustment logged the new requirement: the discount cap should be 15%, not 20%, and VIP members stay exempt. The old FSD item was flagged superseded, never deleted.',
  },
  {
    id: 'mom-confirmation',
    label: 'MoM confirms VIP exemption',
    source: 'Sprint review, meeting minutes',
    timestamp: 'Fri, 16 Aug 2024, 11:05',
    status: 'Active',
    note: 'A MoM line confirms the VIP exemption applies and that the 15% cap targets everyone else. The checklist keeps the confirmation attached to the same ticket.',
  },
  {
    id: 'uat-flag',
    label: 'UAT note flags a contradiction',
    source: 'UAT note, chat message',
    timestamp: 'Mon, 19 Aug 2024, 10:22',
    status: 'Active',
    note: 'UAT spotted the FSD appendix still quoting a 20% cap. The stale appendix-based item was flagged superseded, never deleted, still evidence.',
  },
];

const STEPS = [
  {
    label: 'Seed from your BRD/FSD',
    text: 'Every ticket gets one checklist, seeded from your documents and grounded in your coding standards.',
  },
  {
    label: 'Log changes as they happen',
    text: 'A one-line adjustment records what changed, from whom, and when. No re-typing the whole context into a doc.',
  },
  {
    label: 'Contradictions get flagged',
    text: 'When a revision or adjustment conflicts with an earlier item, the old item is superseded but never deleted. It stays as evidence.',
  },
  {
    label: 'One command, one summary',
    text: 'A Development Summary with the full timeline, impacted services and APIs, and test scenarios, without writing it by hand.',
  },
];

const VALUES = [
  {
    label: 'Evidence over memory',
    text: 'Every change has a source, a timestamp, and if it came from a person, a name.',
  },
  {
    label: 'Context survives interruption',
    text: 'Go on leave, switch tickets, come back weeks later. The checklist is exactly where you left it.',
  },
  {
    label: 'One clean artifact at the end',
    text: 'A Development Summary that answers what happened on this ticket, without writing it by hand.',
  },
  {
    label: 'Your data, your model',
    text: 'Bring your own API key, run it locally with SQLite, and skip subscriptions and vendor lock-in.',
  },
  {
    label: 'Works with what you use',
    text: 'MCP-native from day one, so it plugs into your agent harness instead of demanding a new one.',
  },
];

function LandingPage() {
  const [selectedId, setSelectedId] = useState(TIMELINE_EVENTS[0]?.id ?? '');
  const [stayTunedOpen, setStayTunedOpen] = useState(false);
  const selectedEvent =
    TIMELINE_EVENTS.find((event) => event.id === selectedId) ?? TIMELINE_EVENTS[0];

  if (!selectedEvent) {
    return null;
  }

  const openStayTuned = () => setStayTunedOpen(true);

  return (
    <div className="landing min-h-screen bg-zinc-950 text-zinc-100">
      <LandingHeader onStayTuned={openStayTuned} />
      <main>
        <Hero onStayTuned={openStayTuned} />
        <Reveal>
          <PainSection />
        </Reveal>
        <Reveal>
          <EvidenceSection
            events={TIMELINE_EVENTS}
            selectedId={selectedId}
            selectedEvent={selectedEvent}
            onSelect={setSelectedId}
          />
        </Reveal>
        <Reveal>
          <HowItWorks />
        </Reveal>
        <Reveal>
          <HumanTouch />
        </Reveal>
        <Reveal>
          <ClosingCta onStayTuned={openStayTuned} />
        </Reveal>
      </main>
      <LandingFooter />
      <StayTunedDialog open={stayTunedOpen} onClose={() => setStayTunedOpen(false)} />
    </div>
  );
}

function Reveal({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.12 },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className={visible ? 'landing-reveal landing-reveal-visible' : 'landing-reveal'}>
      {children}
    </div>
  );
}

function StayTunedButton({ onClick, className }: { onClick: () => void; className?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-md bg-amber-400 font-semibold text-zinc-950 transition-colors hover:bg-amber-300 motion-reduce:transition-none',
        className,
      )}
    >
      Stay tuned
    </button>
  );
}

function LandingHeader({ onStayTuned }: { onStayTuned: () => void }) {
  return (
    <header className="sticky top-0 z-40 border-b border-zinc-800 bg-zinc-950">
      <div className="mx-auto flex h-16 w-full max-w-6xl items-center justify-between px-4 sm:px-6">
        <span className="text-lg font-semibold tracking-tight text-zinc-100">Trachex</span>
        <nav className="flex items-center gap-6">
          <Link
            to="/projects"
            className="hidden text-sm text-zinc-400 hover:text-zinc-100 sm:block"
          >
            Open dashboard
          </Link>
          <StayTunedButton onClick={onStayTuned} className="px-4 py-3 text-sm" />
        </nav>
      </div>
    </header>
  );
}

function Hero({ onStayTuned }: { onStayTuned: () => void }) {
  return (
    <section className="border-b border-zinc-800">
      <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6 sm:py-28 lg:py-32">
        <div className="landing-rise max-w-3xl">
          <p className="text-sm font-medium text-amber-400">Development tracking that remembers</p>
          <h1 className="mt-4 text-4xl font-bold leading-tight tracking-tight text-zinc-100 sm:text-5xl lg:text-6xl">
            Stop reconstructing "who changed this" from memory.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-zinc-400">
            Trachex turns your BRD/FSD and every Slack-message-shaped requirement change into one
            evidence-backed checklist, so you always know what was asked, what changed, and who said
            so.
          </p>
          <div className="mt-8 flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:gap-6">
            <StayTunedButton onClick={onStayTuned} className="px-6 py-3 text-base" />
            <a
              href="#how-it-works"
              className="text-sm font-medium text-zinc-400 hover:text-zinc-100"
            >
              How it works
            </a>
          </div>
          <p className="mt-6 text-sm text-zinc-400">
            No Docker, no account, bring your own API key.
          </p>
        </div>
      </div>
    </section>
  );
}

function PainSection() {
  return (
    <section className="border-b border-zinc-800">
      <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
        <h2 className="text-2xl font-semibold tracking-tight text-zinc-100 sm:text-3xl">
          You've been here before.
        </h2>
        <ul className="mt-8 space-y-4">
          <li className="border-l-2 border-zinc-600 pl-4 text-lg text-zinc-300">
            "That's not what the requirement said."
          </li>
          <li className="border-l-2 border-zinc-600 pl-4 text-lg text-zinc-300">
            "Who approved this change?"
          </li>
          <li className="border-l-2 border-zinc-600 pl-4 text-lg text-zinc-300">
            "I never said that."
          </li>
        </ul>
        <div className="mt-10 max-w-3xl space-y-5 text-zinc-400">
          <p>
            Requirements don't drift because people are careless. They drift because most of the
            actual change happens in a Teams message, a MoM line, or a "quick UAT note", never in a
            document, never versioned, never attributed. By the time something breaks in production,
            the only record left is memory, and memory loses every time.
          </p>
          <p>
            You go on leave for a week. You come back to five tickets, half-remembered context, and
            a Slack thread you have to re-read top to bottom just to remember what you already
            decided.
          </p>
          <p className="font-medium text-zinc-100">
            This isn't a tooling gap you can fix with more meetings. It's a tracking gap.
          </p>
        </div>
      </div>
    </section>
  );
}

function EvidenceSection({
  events,
  selectedId,
  selectedEvent,
  onSelect,
}: {
  events: TimelineEvent[];
  selectedId: string;
  selectedEvent: TimelineEvent;
  onSelect: (id: string) => void;
}) {
  return (
    <section className="border-b border-zinc-800">
      <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
        <div className="max-w-3xl">
          <h2 className="text-2xl font-semibold tracking-tight text-zinc-100 sm:text-3xl">
            Every change, with a source and a timestamp.
          </h2>
          <p className="mt-4 text-zinc-400">
            The checklist grows every time something changes. Contradictions get flagged, and
            superseded items are never deleted, so the evidence stays behind the final answer.
          </p>
          <p className="mt-3 text-sm text-zinc-400">Example walkthrough, not real project data.</p>
        </div>
        <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:items-start">
          <div>
            <div className="flex gap-3 overflow-x-auto overscroll-x-contain pb-2 lg:flex-col lg:overflow-visible lg:pb-0">
              {events.map((event) => {
                const isSelected = event.id === selectedId;
                return (
                  <button
                    key={event.id}
                    type="button"
                    aria-current={isSelected ? 'true' : 'false'}
                    onClick={() => onSelect(event.id)}
                    className={cn(
                      'shrink-0 rounded-lg px-4 py-3 text-left transition-colors motion-reduce:transition-none lg:w-full',
                      isSelected ? 'bg-amber-400' : 'hover:bg-zinc-900',
                    )}
                  >
                    <span
                      className={cn(
                        'block text-sm font-medium',
                        isSelected ? 'text-zinc-950' : 'text-zinc-300',
                      )}
                    >
                      {event.label}
                    </span>
                    <span
                      className={cn(
                        'mt-1 block text-xs',
                        isSelected ? 'text-zinc-900' : 'text-zinc-400',
                      )}
                    >
                      {event.status}
                    </span>
                  </button>
                );
              })}
            </div>
            <pre className="mt-6 whitespace-pre-wrap break-words rounded-lg border border-zinc-800 bg-zinc-900/60 px-4 py-3 font-mono text-xs leading-relaxed text-zinc-300 sm:text-sm">
              {`trachex adjustment TICKET-1234 --from "Budi (BA)" --source chat \\\n  --note "discount cap should be 15%, not 20%, VIP exempt"`}
            </pre>
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 lg:mt-14">
            <div aria-live="polite">
              <div key={selectedEvent.id} className="landing-select p-6 sm:p-8">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h3 className="text-lg font-semibold tracking-tight text-zinc-100">
                    {selectedEvent.label}
                  </h3>
                  <span
                    className={cn(
                      'rounded-full px-2.5 py-1 text-xs font-semibold',
                      selectedEvent.status === 'Active'
                        ? 'bg-amber-400 text-zinc-950'
                        : 'bg-zinc-900 text-zinc-400 ring-1 ring-zinc-700',
                    )}
                  >
                    {selectedEvent.status}
                  </span>
                </div>
                <dl className="mt-6 space-y-4 text-sm">
                  <div>
                    <dt className="text-zinc-400">Source</dt>
                    <dd className="mt-1 font-medium text-zinc-100">{selectedEvent.source}</dd>
                  </div>
                  <div>
                    <dt className="text-zinc-400">Timestamp</dt>
                    <dd className="mt-1 font-medium text-zinc-100">{selectedEvent.timestamp}</dd>
                  </div>
                  <div>
                    <dt className="text-zinc-400">Note</dt>
                    <dd className="mt-1 leading-relaxed text-zinc-100">{selectedEvent.note}</dd>
                  </div>
                </dl>
                {selectedEvent.status === 'Superseded' && (
                  <p className="mt-5 border-t border-zinc-800 pt-4 text-xs text-zinc-400">
                    Never deleted. It stays in the timeline as evidence of what was asked before.
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  return (
    <section id="how-it-works" className="scroll-mt-20 border-b border-zinc-800">
      <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
        <h2 className="text-2xl font-semibold tracking-tight text-zinc-100 sm:text-3xl">
          How it works
        </h2>
        <ol className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((step, index) => (
            <li key={step.label}>
              <span className="text-sm font-semibold text-zinc-400">
                {String(index + 1).padStart(2, '0')}
              </span>
              <h3 className="mt-2 font-semibold text-zinc-100">{step.label}</h3>
              <p className="mt-1 text-sm leading-relaxed text-zinc-400">{step.text}</p>
            </li>
          ))}
        </ol>
        <div className="mt-12 rounded-xl border border-zinc-800 bg-zinc-900/60 p-6 sm:p-8">
          <h3 className="text-lg font-semibold tracking-tight text-zinc-100">Ask it anything</h3>
          <p className="mt-2 text-zinc-400">
            From your terminal, your agent harness, or the web UI.
          </p>
          <ul className="mt-5 space-y-2 text-zinc-100">
            <li>"What changed since last week?"</li>
            <li>"Why does this task exist?"</li>
            <li>"Which APIs are affected?"</li>
          </ul>
          <p className="mt-5 text-sm text-zinc-400">
            You get a grounded answer with a source and a timestamp, not a guess.
          </p>
        </div>
      </div>
    </section>
  );
}

function HumanTouch() {
  return (
    <section className="border-b border-zinc-800">
      <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
        <div className="max-w-3xl">
          <h2 className="text-2xl font-semibold tracking-tight text-zinc-100 sm:text-3xl">
            The human touch
          </h2>
          <div className="mt-6 space-y-5 text-zinc-400">
            <p>
              Trachex doesn't write your code. It doesn't decide anything for you. Every checklist
              item is checked off by a human, always, because a tracking tool that quietly marks
              things "done" on your behalf isn't a tracking tool anymore. It's a liability.
            </p>
            <p>
              What Trachex actually does is smaller and more useful than "AI automation": it
              remembers precisely, so your brain doesn't have to, freeing you up to think about the
              engineering problem instead of reconstructing what was asked six different times
              across six different threads.
            </p>
            <p>
              This is also not surveillance. The audit trail exists to protect you, the developer,
              with a record of exactly what was asked and when it changed. It's evidence for you,
              not a leash.
            </p>
          </div>
          <h3 className="mt-12 text-lg font-semibold tracking-tight text-zinc-100">
            Value, plainly
          </h3>
          <ul className="mt-5 grid gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-3">
            {VALUES.map((value) => (
              <li key={value.label}>
                <p className="font-semibold text-zinc-100">{value.label}</p>
                <p className="mt-1 text-sm leading-relaxed text-zinc-400">{value.text}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

function ClosingCta({ onStayTuned }: { onStayTuned: () => void }) {
  return (
    <section className="border-b border-zinc-800">
      <div className="mx-auto w-full max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
        <div className="max-w-3xl">
          <h2 className="text-2xl font-semibold tracking-tight text-zinc-100 sm:text-3xl">
            You already do the work of tracking requirement changes in your head.
          </h2>
          <p className="mt-3 text-lg text-zinc-400">Let something else hold that memory for you.</p>
          <StayTunedButton onClick={onStayTuned} className="mt-8 px-6 py-3 text-base" />
        </div>
      </div>
    </section>
  );
}

function LandingFooter() {
  return (
    <footer className="border-t border-zinc-800">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p className="text-sm text-zinc-400">
          <span className="font-semibold text-zinc-100">Trachex</span>. A development checklist that
          remembers, so you don't have to.
        </p>
        <Link to="/projects" className="text-sm text-zinc-400 hover:text-zinc-100">
          Open dashboard
        </Link>
      </div>
    </footer>
  );
}

function StayTunedDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }
    if (open && !dialog.open) {
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }
    const handleClose = () => onClose();
    dialog.addEventListener('close', handleClose);
    return () => dialog.removeEventListener('close', handleClose);
  }, [onClose]);

  return (
    <dialog
      ref={dialogRef}
      aria-modal="true"
      aria-labelledby="stay-tuned-title"
      className="w-[calc(100%-2rem)] max-w-md rounded-xl border border-zinc-500 bg-zinc-950 p-6 text-zinc-100"
    >
      <div className="flex items-start justify-between gap-4">
        <h2 id="stay-tuned-title" className="text-xl font-semibold tracking-tight text-zinc-100">
          Stay tuned. It's coming soon.
        </h2>
        <button
          type="button"
          aria-label="Close"
          onClick={() => dialogRef.current?.close()}
          className="rounded p-3 text-zinc-400 hover:text-zinc-100"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>
      <div className="mt-4 space-y-3 text-sm text-zinc-400">
        <p>
          The trachex package isn't published yet. The CLI and dashboard are still being prepared
          for the first release.
        </p>
        <p>Once it ships, a single command gets you running:</p>
        <pre className="overflow-x-auto rounded-lg border border-zinc-800 bg-zinc-900/60 px-3 py-2 font-mono text-xs text-zinc-300">
          npx trachex init
        </pre>
        <p>No account, no email list, no vendor lock-in.</p>
      </div>
      <button
        type="button"
        onClick={() => dialogRef.current?.close()}
        className="mt-6 w-full rounded-md bg-amber-400 px-4 py-2.5 text-sm font-semibold text-zinc-950 transition-colors hover:bg-amber-300 motion-reduce:transition-none"
      >
        Close
      </button>
    </dialog>
  );
}
