# Design: Superseded Checklist Visibility

## Boundary

This is a dashboard-only presentation change. The API already supplies enough data to render the relationship and completion state:

- `ProposalReviewDraft.supersedes` identifies targets in a pending proposal.
- `TicketCanvas.checklist` supplies active target titles and current `devStatus`.
- `SupersededEntry` supplies the retired item, replacement item, final `devStatus`, and `oldAudits`.

No API, domain, persistence, or proposal contract changes are required.

## Proposal Review

Replace the inline `Replaces:` paragraph in `ProposalEditor` with a semantic relationship block for each target:

```text
REPLACEMENT PROPOSED
Existing requirement              Proposed replacement
<old title>                       <draft title>
Currently checked                Pending approval

Approval is required to retire the existing requirement.
```

Use a rose-tinted border/background for the existing requirement and an amber-tinted border/background for the pending replacement. Both cards retain explicit labels and text states. Use a directional icon only as a supporting relationship cue, with a text label for clarity.

On small screens the blocks stack. On wider screens they use a two-column grid. The component remains static, so there is no new interaction or motion to test.

## Superseded Evidence

Change the section summary to `Superseded history` and include a short explanation. Set the native details element open when `entries.length > 0`, preserving the user's ability to collapse it.

Each entry becomes a bordered evidence card with:

- A visible `Retired checklist item` label and the old title.
- A completion state block with text and a neutral/green/amber status treatment.
- A `Replaced by` block containing the replacement title, or `No replacement linked`.
- Existing source, reason, and recorded/superseded timestamps in a secondary evidence area.

The completion state uses the final requirement status plus the chronological audit actions:

| Final status / audit history | Display |
| --- | --- |
| `checked` | `Completed before replacement` |
| final action `uncheck` after any `check` | `Was completed, then marked incomplete` |
| `unchecked` with no `check` audit | `Not completed before replacement` |

If an unusual or incomplete record does not match these cases, use `Completion state unavailable` rather than guessing.

## Accessibility and Responsive Constraints

- Status words remain in text and are not communicated by color alone.
- The relationship uses headings/labels and ordinary DOM order, so screen readers read old item, relationship, new item, and approval state in sequence.
- The native `<summary>` remains the only toggle for the evidence section and keeps its visible focus treatment.
- No new hover-only behavior, tooltip, fixed width, or horizontal-only layout is introduced.
- The rose/amber surfaces use existing dashboard palette values and must retain WCAG AA text contrast.

## Files

- `apps/dashboard/src/routes/projects.$projectId.tickets.$ticketKey.tsx`: render the replacement map and richer superseded evidence.
- `apps/dashboard/src/lib/superseded.ts`: pure completion-state projection for testable wording.
- `apps/dashboard/src/lib/superseded.test.ts`: completion-state regression tests.
- `.trellis/spec/frontend/directory-structure.md`: record the relationship/status presentation convention if implementation confirms it is reusable.
