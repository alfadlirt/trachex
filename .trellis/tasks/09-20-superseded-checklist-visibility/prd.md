# Make superseded checklist changes obvious

## Goal

Make checklist replacement decisions obvious before approval and understandable later in the evidence history. A reviewer should be able to answer three questions without parsing a sentence: which existing requirement is being replaced, what will replace it, and whether the old requirement had been completed.

## Confirmed Current Behavior

- Pending proposal review renders each replacement as an inline `Replaces: ...` sentence in `apps/dashboard/src/routes/projects.$projectId.tickets.$ticketKey.tsx:1450-1458`.
- The review data already contains the target requirement IDs and the active checklist contains their titles and current `devStatus`.
- The superseded section is collapsed by default in `apps/dashboard/src/routes/projects.$projectId.tickets.$ticketKey.tsx:876-947`.
- Superseded entries already contain the retired item, its replacement item, and `oldAudits`, but the UI currently renders the replacement and audit information as a low-emphasis definition list.
- Completion history is auditable through `oldAudits`, whose actions distinguish `check` and `uncheck`; the retired requirement also retains its final `devStatus`.

## Design Direction

- Use an explicit replacement map rather than relying on color, shadow, or a long sentence: a retired requirement card on the left/top and a proposed replacement card on the right/bottom, connected by a labelled `Replaced by` relationship.
- Use amber for the pending proposal state and a restrained rose/red treatment for the retired requirement. Pair every color treatment with visible status text so color is reinforcement, not the only signal.
- Keep the replacement map stacked on narrow screens and side by side when the available width supports it. Preserve 44px controls and visible keyboard focus styles.
- Open superseded history when entries exist, while retaining the native `<details>` toggle so users can collapse evidence after reviewing it.
- Show a plain-language completion state in every superseded entry: `Completed before replacement`, `Was completed, then marked incomplete`, or `Not completed before replacement`.
- Show the replacement title as a distinct destination block, with a clear fallback when no replacement relationship is available.

## Requirements

- Pending reconciliation and extraction proposals with `supersedes` targets must render each target as a visually distinct replacement relationship, not comma-separated inline text.
- Each pending replacement relationship must show the existing requirement title, its current checked/unchecked state, the proposed replacement title, and that approval is required before the replacement takes effect.
- The existing proposal editor behavior, edit controls, save/reset behavior, and approval gating must remain unchanged.
- The superseded history section must be open by default when it contains entries and remain collapsible with a keyboard-operable native details control.
- Each superseded entry must show the retired requirement title, a human-readable completion state derived from its final status and audit history, and the replacement title or an explicit missing-replacement state.
- Completion state must not depend on color alone and must remain understandable to screen readers and at narrow widths.
- Do not change the API contract, persistence model, proposal semantics, or audit records.

## Acceptance Criteria

- [x] A pending proposal that replaces one or more active requirements shows an explicit old-to-new replacement map for every target.
- [x] The replacement map makes `approval required`, the old requirement's current checked state, and the proposed replacement visually and textually apparent.
- [x] The replacement map reflows without horizontal overflow on narrow screens and all existing controls remain keyboard accessible.
- [x] Superseded history is expanded by default when entries exist and can still be collapsed and reopened with keyboard input.
- [x] A superseded item with a check audit and final checked status says `Completed before replacement`.
- [x] A superseded item with a check audit followed by an uncheck audit says `Was completed, then marked incomplete`.
- [x] A superseded item with no check audit and final unchecked status says `Not completed before replacement`.
- [x] Each superseded item visibly identifies its replacement, or says `No replacement linked` when the relationship is missing.
- [x] Existing proposal editing, approval, rejection, checklist rendering, and raw audit data remain behaviorally unchanged.
- [x] Regression tests cover completion-state wording and the build/type/lint checks pass for the touched frontend files.

## Out Of Scope

- Changing the agent prompt or how supersession targets are selected.
- Adding API fields or changing domain/storage contracts.
- Adding navigation from historical requirements to another route.
- Redesigning unrelated proposal fields, checklist rows, impact summaries, or adjustment processing.
