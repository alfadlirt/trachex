# Implementation Plan

## Ordered work

1. Inventory and reset the dummy data model; rename ticket-facing domain, storage, API, MCP, dashboard, fixture, and test symbols to subject.
2. Add generated subject IDs, names, project ownership, and subject lookup/create flows.
3. Implement user config persistence, active project/subject commands, scope precedence, interactive prompts, banners, `--quiet`, and banner-free JSON output.
4. Replace checklist label grouping with arbitrary parent IDs and sibling ordering; update repositories, services, migrations/reset setup, tree views, and history rendering.
5. Update CLI read/mutation commands and MCP/API/dashboard contracts to use subjects and the new checklist tree.
6. Add global repository registry, project defaults, subject many-to-many assignments, CLI commands, and subject summary rendering.
7. Add configurable theme/color settings with `auto`, `dark`, `light`, and `no-color` modes.
8. Add a focused terminal prompt dependency and implement `trachex tui` as a styled, form-driven workspace on top of shared application services, including selection, tree navigation, selected-item action menus, CRUD/check/uncheck forms, proposal review, export, and settings.
9. Update README and supporting documentation with current behavior, planned redesign status, repository scope, and future cross-repository analysis.

## Validation

- Run focused domain/storage tests after model and tree changes.
- Run CLI tests for scope resolution, interactive missing context, JSON/banner behavior, settings, repository associations, and command routing.
- Run dashboard/API/MCP tests after contract renames.
- Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, and `pnpm build`.
- Run `pnpm eval` and the real-ticket acceptance test after integration.
- Manually verify a fresh install: create project, create subject, select subject, inspect info, view/edit/check/reorder the nested checklist, assign repositories, launch TUI, change colors, and export.
- Manually verify TUI keyboard/select/input/confirm navigation, form cancel/submit behavior, default Trachex colors, configured accent/theme colors, no-color output, and that normal CRUD/check/uncheck flows require no typed IDs or command strings.

## Review gates

- Do not start TUI implementation until subject identity, active scope, and tree contracts are stable.
- TUI styling and form behavior must be verified independently from the underlying domain mutations; prompt cancellation must not mutate data.
- Do not claim cross-repository implementation verification; only persist repository scope and document the future capability.
- Confirm README examples distinguish implemented commands from planned redesign commands.
