# ADR 002: Global Project Registry

## Status

Accepted

## Decision

Projects live in a global Trachex application directory and may contain multiple registered repositories/services. CLI commands support explicit `--project` selection and an optional active-project shortcut.

## Rationale

Trachex tracks a development project rather than one repository. Microservice systems, shared architecture repositories, and frontend/backend repositories need one ticket context. Current working directory inference is too ambiguous for this model.

## Consequences

- Repository paths are metadata, not project identity.
- Users must explicitly register context scope.
- Project archives are required for portability.
- Dashboard navigation starts at projects and tickets, not folders.
