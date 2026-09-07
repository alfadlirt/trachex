# Phase 8: Evaluation and Hardening

## Goal

Deliver the release gate: a fixed evaluation corpus + Lens eval CLI, golden extraction/reconciliation cases, direct-conflict tests (e.g. discount cap changes), impact-classification scoring, FTS5 grounding/citation checks, a performance measurement (extraction < 2 minutes on a representative document), and a security review. Then run the real-ticket acceptance test end-to-end.

Source of truth: `docs/implementation-plan.md` Phase 8 + Release gate, `docs/architecture.md` Testing Strategy.

## Requirements

- Fixed evaluation corpus (representative FSD/BRD documents + adjustment notes).
- Golden extraction/reconciliation cases (expected requirements/impacts/scenarios).
- Direct-conflict tests such as discount cap changes (supersession detection).
- Impact-classification scoring (service/api/page).
- FTS5 grounding and source-citation checks (search results carry provenance).
- Performance measurement: extraction under two minutes on a representative document.
- Security review: source handling, logs, archives, local API binding, provider keys.
- Lens eval CLI (Anvia Lens eval reporter) OR a deterministic eval harness (fixture-based) that scores the pipeline without a real LLM.

## Acceptance Criteria (Release Gate)

- [ ] One real ticket completes the full flow (project → ticket → extraction → approve → checklist → adjustment → approve → check → export).
- [ ] All adjustments have source and timestamps.
- [ ] Direct conflicts are detected and require approval.
- [ ] Human completion is never inferred.
- [ ] Export includes timeline, current checklist, impacts, scenarios, and history.
- [ ] Eval harness runs and reports scores for extraction/reconciliation/impact/grounding.
- [ ] Performance measurement recorded (extraction < 2 min).

## Dependency order

- Depends on Phases 0-7 (packaged CLI + all services).

## Notes

- The eval harness uses fixtures (no real LLM) so it runs in CI deterministically; Lens integration is optional and documented.
- Security review is a checklist run against the codebase (no separate tool).
