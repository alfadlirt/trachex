# Add root Trachex landing page

## Goal

Replace the dashboard root redirect with a responsive minimalist Trachex landing page based on copy.md, including an interactive evidence timeline and an honest coming-soon CTA while preserving /projects.

## Requirements

- Replace the current `/` redirect with a public-facing Trachex landing page. Keep the existing dashboard reachable at `/projects`.
- Target software engineers who reconstruct requirement changes from BRDs/FSDs, chat messages, meeting notes, and UAT feedback.
- Use `copy.md` as the source of truth for product claims and terminology, with light editing for a concise landing-page flow.
- Present a short-scroll story: hero, requirement-tracking pain, interactive evidence timeline, how Trachex works, human/local-first positioning, and a coming-soon close.
- Use a near-black, editorial, minimalist visual direction with generous spacing, a restrained warm amber accent, and a text-only Trachex wordmark.
- Use the hero direction “Stop reconstructing who changed this from memory.” and explain that Trachex is a development checklist that remembers requirement changes with evidence.
- Include a quiet `Open dashboard` navigation link to `/projects`; do not add an unavailable GitHub link.
- Include one clickable evidence timeline based on the real concepts in `copy.md`. Selecting an example event must reveal its source, timestamp, and superseded status.
- Mark timeline content as illustrative example content and do not imply real customer, usage, or package-publication data.
- The primary CTA must open an accessible stay-tuned panel. The panel must state that the package is not published yet and use the polished message “Stay tuned. It’s coming soon.”
- Use restrained motion only: one-time entrance reveal, timeline selection transition, and CTA/panel transitions. Respect `prefers-reduced-motion` and avoid endless decorative loops.
- Reflow mobile-first into a single column. Keep the evidence interaction usable on narrow screens and keep the CTA comfortably tappable.
- Maintain keyboard access, visible focus states, sufficient contrast, semantic headings, and accessible dialog/panel behavior.

## Acceptance Criteria

- [ ] Visiting `/` renders the Trachex landing page without redirecting, while `/projects` still renders the existing dashboard.
- [ ] The page uses only claims and product behavior supported by `copy.md`; it contains no fabricated customers, testimonials, metrics, or availability claims.
- [ ] The page communicates the problem, Trachex’s evidence-backed checklist solution, and the human-controlled/local-first positioning in a concise short-scroll flow.
- [ ] The visual treatment is near-black and minimalist, uses amber as a restrained accent, and avoids generic gradient, glow, glass, fake-terminal, and decorative status-dot patterns.
- [ ] The evidence timeline has multiple keyboard-operable selectable events; selection visibly updates the detail area with source, timestamp, and superseded status.
- [ ] The primary CTA opens and closes a keyboard-accessible stay-tuned panel, including Escape and visible close control behavior, and does not pretend the package is published.
- [ ] The dashboard link points to the real `/projects` route and no navigation item is dead.
- [ ] The layout remains readable and usable on mobile and desktop, including horizontal timeline overflow where needed.
- [ ] Motion is limited to purposeful transitions and is disabled or reduced for users who prefer reduced motion.
- [ ] Text and interactive controls meet the project’s accessibility expectations: semantic structure, keyboard operation, visible focus, and checked contrast.
- [ ] Dashboard package typecheck, tests, and production build pass after implementation.

## Notes

- Keep `prd.md` focused on requirements, constraints, and acceptance criteria.
- Lightweight tasks can remain PRD-only.
- For complex tasks, add `design.md` for technical design and `implement.md` for execution planning before `task.py start`.
