# Subject-centered checklist workspace redesign

## Goal

Replace ticket terminology with subjects, add active project and subject selection, redesign checklist hierarchy and terminal UX, and introduce a configurable interactive TUI with global repository associations.

## Requirements

- Replace the user-facing `ticket` concept with `subject` across the CLI, domain, storage, API, MCP, dashboard, tests, fixtures, and documentation. Existing dummy data may be reset; no compatibility alias or migration is required.
- Generate an immutable subject ID and require a human-readable subject name. A subject belongs to exactly one project.
- Add active project and subject selection with `trachex project use`, `trachex subject use`, `trachex subject use --clear`, and `trachex info`. Selecting a subject also selects its project; changing project clears an incompatible subject.
- Resolve explicit command arguments before active selections. Interactive commands must prompt to select or create missing project/subject state; non-interactive commands must fail with actionable guidance.
- Show the active project and subject in human-readable project/subject-scoped output. JSON output must remain machine-readable and omit banners; a quiet option may suppress human-readable banners.
- Make the checklist an arbitrary-depth tree with stable item IDs, optional parent IDs, explicit sibling ordering, status, source/provenance, and impact metadata. Content edits supersede prior items and retain history.
- Render checklist and summary output as a compact indented tree with status icons, source/impact details, and a visible active-scope header.
- Add `trachex tui`, an interactive terminal UI for project/subject selection, checklist navigation, expand/collapse, check/uncheck, add/edit/supersede, reorder, proposal review, export, and settings.
- The TUI must be form-driven rather than command-driven: use keyboard navigation, select lists, text inputs, confirmations, and action menus so routine CRUD/check/uncheck operations do not require manually typing IDs or command syntax.
- The TUI must render with a default Trachex visual style out of the box: colored header/context banner, bordered sections, focused/selected rows, status colors, and clear action hints. User theme/accent settings customize this style; `no-color` remains fully usable.
- Make per-user presentation settings configurable through a user config file, including `auto`, `dark`, `light`, and `no-color` modes plus accent/banner colors. Settings must not become canonical requirement data.
- Make repositories optional, globally registered per user, reusable across projects and subjects, and assignable many-to-many. Support repository add/list/show/remove, subject repository assignment, and optional project repository defaults.
- Keep repository scope distinct from explicit service/API/page/scenario impact metadata. Selected repositories must appear in subject summaries.
- Document future agent analysis that cross-checks checklist requirements, ingested documents, source code, and Git history across selected repositories to report uncovered requirements, mismatches, stale documentation, and implementation gaps. Do not claim this verification exists in the initial redesign.

## Acceptance Criteria

- [ ] A fresh/reset database uses subject terminology consistently across domain, persistence, CLI, API, MCP, dashboard, tests, and documentation.
- [ ] A user can create/select a project and subject, inspect active state with `trachex info`, and run scoped commands without repeating context flags when active state exists.
- [ ] Missing required context prompts interactively in a terminal and produces actionable non-interactive errors.
- [ ] Subject selection automatically selects its project, while selecting another project clears an incompatible subject.
- [ ] Checklist items support arbitrary nesting, stable sibling order, check/uncheck, direct edits, superseding, and retained history without silent overwrites.
- [ ] Human-readable status and checklist views display the active scope and tree structure; JSON output has no presentation banners.
- [ ] `trachex tui` supports the agreed checklist workflow and opens the active subject directly when one exists.
- [ ] TUI users can navigate a styled checklist, select an item, invoke CRUD/check/uncheck actions from menus/forms, submit or cancel forms, and return to the workspace without typing command syntax or IDs.
- [ ] A fresh TUI session visibly uses the default Trachex colors/styles; configured accent/theme settings alter presentation and `no-color` removes ANSI styling.
- [ ] User theme and color settings persist in a config file and support no-color output.
- [ ] Repositories can be globally registered, reused, optionally defaulted at project level, and assigned to multiple subjects; subject summaries show selected repositories.
- [ ] Existing validation remains green after the redesign, with focused tests for context resolution, tree operations, repository associations, config settings, and TUI command routing.

## Notes

- Keep `prd.md` focused on requirements, constraints, and acceptance criteria.
- Lightweight tasks can remain PRD-only.
- For complex tasks, add `design.md` for technical design and `implement.md` for execution planning before `task.py start`.
