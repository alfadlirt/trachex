# Investigation prompts

## MCP / baseline questions

1. How many requirements were in the initial BILL-101 baseline, how many were
   added by clarification and UAT, how many were superseded, and how many are
   active and unchecked now?
2. Which checked requirement was superseded, when, by whom, from which source,
   and by what replacement meaning?
3. What work remains unchecked, and which source document introduced each item?
4. What are the source, author, date, and replacement chain for every confirmed
   adjustment? Do not infer a cause, owner, or requirement change that is not
   recorded in the checklist, relationship, source, or audit evidence.
5. What does the current requirement mean differently from the original one?

## AI review rubric

- **Timezone edge case:** verify local seventh-day conversion across UTC
  midnight and confirm the captured timezone survives into invoice display.
- **Stale completion / contradiction:** the original checked seven-day item is
  superseded, but its audit remains. Ensure consumers do not report it as
  current completion and compare the old UTC interpretation with clarification.
- **Missing UAT coverage:** replaying the same provider event and the final
  failed retry state must be added to UAT.
- **Intentional gap:** `req-invoice-timezone-display` has no scenario. Treat
  this as a review finding, not as an accidental completed requirement.
- **Uncovered edge case:** no fixture scenario covers cancellation during the
  24-hour grace period; investigate whether cancellation and retry ordering is
  defined.

If the checklist, source, relationship, or audit records cannot confirm an
answer, use this exact response: "We can't confirm that from the available
context. Please ask your BA immediately, then add the clarification with
`subject add-doc` before relying on this answer."
