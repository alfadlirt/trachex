# Technical Design

## Boundaries

The redesign spans the shared domain model, SQLite persistence, CLI command resolution, MCP/API/dashboard terminology, terminal presentation, user configuration, and the new TUI. The current dummy database may be reset instead of migrated.

## Domain model

- Rename ticket-facing entities and repository interfaces to subject-facing names.
- Give each subject a generated immutable ID and required display name; preserve project ownership.
- Replace label-only checklist grouping with `parentId` plus explicit sibling `displayOrder`. Keep append-only requirement history and represent content edits as a new item linked by `supersedes`.
- Keep repository records global to the user/application store. Add many-to-many subject assignments and optional project defaults. Repository identity is separate from service/API/page impact metadata.

## Selection and configuration

- Add a user config store under the platform-appropriate config directory. It contains active project ID, active subject ID, theme/color settings, and optional display defaults.
- Resolve scope in this order: explicit project/subject argument, active selection from config, interactive selection when attached to a terminal, then an actionable error for non-interactive use.
- Subject selection validates ownership and updates active project atomically. Project selection clears an incompatible active subject.
- Centralize scope resolution and human-readable banner rendering so CLI, TUI, and future clients do not duplicate precedence rules.
- Never prepend banners to JSON output; support quiet output for scripts.

## Client contracts

Canonical planned commands include `subject`, `info`, `repo`, `settings`, and `tui`. Existing command behavior should be renamed rather than aliased because data is disposable. MCP tools and API/dashboard payloads use subject terminology consistently.

The TUI uses the same domain/application services as the CLI and dashboard. It must not access SQLite directly or create a parallel mutation path. It opens the active subject, or presents project then subject selection when no active subject exists.

The TUI is a form-driven terminal workspace, not a prompt that parses text commands. Use a focused prompt library for select/input/confirm flows, with a small persistent workspace renderer around it for the checklist tree, selected-item actions, header, panels, and status styling. CRUD actions collect fields through forms and resolve the selected item internally, so users do not type IDs during normal interaction.

## Presentation

The checklist renderer consumes a tree view with stable ordering and renders indentation, status icons, source/provenance, impact, and a superseded history section. Terminal color is a presentation concern controlled by user config and no-color detection/override. The default mode applies Trachex styling without requiring configuration; configured themes override the defaults.

## Repository flow

Global repository commands create and manage reusable repository records. Project defaults are suggestions; explicit subject assignments are the subject's actual scope. Subject summaries show selected repositories separately from services, APIs, pages, and scenarios.

## Rollout and reset

Reset dummy SQLite data and regenerate fixtures. Rename source symbols and serialized fields together, then update clients and tests in one coordinated change. No backward-compatibility alias is required. Keep future cross-repository document/source/Git analysis documented as a later capability only.

## Risks and controls

- Scope leakage: central resolver, ownership validation, and tests for explicit-versus-active precedence.
- Accidental mutations: TUI calls existing human-controlled services; check operations retain confirmation semantics.
- Tree corruption: validate parent ownership, cycles, sibling ordering, and superseded-item visibility.
- Script breakage: JSON mode remains banner-free and deterministic; no-color mode is testable.
- Path portability: repository paths are stored as data, while user config stores only preferences and selections.
