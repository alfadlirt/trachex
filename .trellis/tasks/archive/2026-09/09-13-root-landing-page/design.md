# Technical Design: Root Landing Page

## Scope

Implement the landing page in `apps/dashboard` without changing the existing project and ticket routes. The current TanStack Router root index redirect becomes the landing-page route; `/projects` remains the dashboard entry point.

## Structure

- Keep `apps/dashboard/src/routes/index.tsx` as the root route and render the landing page there instead of throwing a redirect.
- Keep the existing root shell compatible with dashboard pages. The root route may provide the landing page’s full-bleed visual shell through route-level classes, but dashboard route styling must remain readable and unchanged.
- Put landing-page-only interactive state in the root route or a small colocated component. Avoid a new global state layer for a local timeline selection and CTA panel.
- Continue using Tailwind v4 through `src/index.css`. Add only small global rules needed for the landing page, such as reduced-motion handling and a deliberate focus treatment.

## Interaction Contracts

- Timeline events are represented by a stable typed array containing an id, label, source, timestamp, status, and detail. The selected id is local React state.
- Each event is a real button with `type="button"`, an accessible name, selected state, and visible focus state. The detail panel is updated from the selected event, not from hover.
- The stay-tuned CTA opens a modal-like dialog or an inline disclosure with a real close button. If a dialog is used, it must have an accessible label, Escape handling, and focus behavior that does not strand keyboard users.
- The CTA must not copy or execute `npx trachex init`, because the package is not published yet.

## Visual System

- Base: near-black background and high-contrast warm-white text.
- Supporting text: a verified muted neutral that remains readable on the base.
- Accent: warm amber reserved for the primary CTA, selected timeline state, and a small number of evidence cues.
- Typography: use the existing system stack unless an already-installed project font supports the editorial direction. Avoid adding a font dependency for this page.
- Use borders and spacing to create hierarchy. Do not use page-wide gradients, glass effects, repeated glow, fake terminal chrome, decorative status dots, or an always-moving background.

## Responsive and Motion Behavior

- Desktop uses a restrained asymmetric composition with the evidence demo offset from the hero/content flow.
- Mobile collapses to one column. The timeline’s event rail may scroll horizontally without clipping event labels or detail content.
- Entrance and selection transitions use CSS transitions/keyframes with a reduced-motion override. No infinite animation is required.
- Focus styles must remain visible on the dark surface and meet non-text contrast expectations.

## Compatibility and Rollback

- No API, storage, or domain changes are required.
- Rollback is limited to restoring the root route redirect and removing the landing-page styles/components; `/projects` and its API contracts are unaffected.
