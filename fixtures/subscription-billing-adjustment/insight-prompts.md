# Investigation prompts

## MCP / baseline questions

1. What is the current checklist for `BILL-101` and its related adjustment tickets?
2. Which checked requirement was superseded, when, and by what new meaning?
3. What work remains unchecked, and which source document introduced it?
4. Why is `req-idempotent-charge-retry` present, and what API does it affect?

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
