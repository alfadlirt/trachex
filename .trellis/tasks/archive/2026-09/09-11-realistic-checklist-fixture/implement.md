# Implementation Plan

1. Create the fixture directory and canonical Markdown source documents.
2. Add deterministic project/ticket metadata and normalized source, requirement, impact, scenario, and audit JSON files.
3. Add representative extraction/reconciliation proposal payloads, expected structured findings, and the derived combined bundle.
4. Add the README and insight prompt pack describing the expected current checklist, history, and deliberate gaps.
5. Add a dependency-free Node validator for cross-file references and structural plus scenario-shape invariants.
6. Run the validator, parse all JSON documents, and run the existing package tests/type checks.
7. Review the final diff for accidental production-code changes and verify the fixture exercises initial extraction, human completion, reconciliation, supersession, UAT feedback, reset/reload use, and AI review.

## Validation Commands

- `node fixtures/subscription-billing-adjustment/validate.mjs`
- `pnpm test`
- `pnpm typecheck`

## Review Gates

- Do not start implementation until this plan and the PRD are approved.
- Keep fixture-only changes separate from application behavior.
- Treat intentionally missing coverage as documented test data, not a validation failure.
