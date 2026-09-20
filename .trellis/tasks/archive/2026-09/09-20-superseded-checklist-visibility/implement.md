# Implementation Plan

1. Add a small pure helper that derives superseded completion wording from final `devStatus` and chronological `oldAudits`.
2. Add unit tests for completed, completed-then-unchecked, not-completed, and unavailable/inconsistent states.
3. Replace proposal review's inline supersession sentence with an explicit responsive old-to-new replacement map.
4. Update superseded history to open when populated, show completion status text, and make the replacement relationship visually distinct from secondary source metadata.
5. Keep checklist row rendering and proposal mutation behavior unchanged.
6. Run focused dashboard tests, dashboard typecheck, production build, Biome on touched frontend files, and `git diff --check`.
7. Review the final UI against the antislop human, UI, copy, and mobile checklists, including text contrast, keyboard semantics, narrow layout, and reduced-motion behavior.

## Risk and Rollback

- Risk: changing the superseded section's default open state increases initial page height. Rollback by restoring `open={false}` without changing the card content.
- Risk: status wording may misrepresent unusual audit sequences. The helper must return an unavailable state rather than infer completion.
- Rollback: revert the dashboard route, helper, tests, and frontend spec update. No persisted or API data changes are involved.
