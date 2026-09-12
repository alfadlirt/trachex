# Demo Checklist: Step By Step

This runbook exercises the subscription billing scenario in
`fixtures/subscription-billing-adjustment/`.

It intentionally does **not** set `TRACHEX_HOME`. Trachex uses its normal
default data directory:

- macOS: `~/Library/Application Support/trachex`
- Linux: `~/.local/share/trachex`
- Windows: `%APPDATA%/trachex`

Run every command from the repository root.

## 1. Validate The Fixture

```bash
node fixtures/subscription-billing-adjustment/validate.mjs
```

Expected output:

```text
Validated subscription billing fixture: 3 tickets, 6 requirements, 5 active.
```

## 2. Create The Demo Project

```bash
pnpm run trachex project create subscription-billing \
  --name "Subscription Billing"
```

If the project already exists, either continue with it or remove it using the
project deletion command shown by `pnpm run trachex --help`.

Confirm it exists:

```bash
pnpm run trachex project list
```

## 3. Create The Initial Subject

```bash
pnpm run trachex subject new \
  --project subscription-billing \
  --name "Checkout"
```

The sample subject name is `Checkout`. The commands below use that name with
`--project subscription-billing`; the CLI also accepts the subject ID or the
slug `checkout`.

## 4. Add The Initial Document

```bash
pnpm run trachex subject add-doc "Checkout" \
  --project subscription-billing \
  --docs fixtures/subscription-billing-adjustment/documents/initial-fsd.md
```

This creates:

- Subject `Checkout`
- A source with type `document`
- A snapshot and searchable chunks
- A pending extraction proposal

## 5. Review The Pending Proposal

```bash
pnpm run trachex proposal list \
  --project subscription-billing
```

Copy the proposal ID for the subject.

## 6. Approve The Initial Checklist

```bash
pnpm run trachex proposal approve <copy-initial-proposal-id> \
  --project subscription-billing \
  --yes
```

## 7. Inspect The Initial Checklist

Human-readable:

```bash
pnpm run trachex subject checklist "Checkout" \
  --project subscription-billing
```

Machine-readable:

```bash
pnpm run trachex subject checklist "Checkout" \
  --project subscription-billing \
  --json
```

At this stage the generated requirements should be active and unchecked.

## 8. Check Completed Development Work

Get requirement IDs:

```bash
pnpm run trachex subject checklist "Checkout" \
  --project subscription-billing \
  --json
```

Mark the first completed item:

```bash
pnpm run trachex subject check "Checkout" <copy-requirement-id> \
  --yes
```

Mark another completed item:

```bash
pnpm run trachex subject check "Checkout" <copy-another-requirement-id> \
  --yes
```

Review progress:

```bash
pnpm run trachex status \
  --project subscription-billing \
  --json
```

## 9. Ask Trachex To Reconcile A Clarification

The adjustment is on the single `Checkout`/`BILL-101` ticket. This is the real
agentic path: Trachex gives the current checklist and the clarification to the
LLM, and the LLM returns a pending reconciliation plan. Nothing in the active
checklist changes yet.

```bash
pnpm run trachex adjustment "Checkout" \
  --project subscription-billing \
  --source clarification \
  --from "Maya Chen, Product Manager" \
  --note "Trial conversion must use the account timezone. Add a 24-hour grace period for failed payment retries. The previous requirement did not cover timezone boundaries or cancellation during the grace period."
```

The LLM should recognize that the clarification changes the meaning of the
original seven-day trial requirement. Its pending proposal should therefore
contain:

- A replacement for the original trial-conversion requirement, linked through
  `supersedes`.
- The new 24-hour payment grace-period requirement.
- Source type `clarification`.
- Attribution `Maya Chen, Product Manager`.
- The adjustment note as the source cause.
- Impacts and test scenarios for human review.

Find the pending proposal ID in the normal Trachex listing, then review it with
Trachex. Do not extract requirement IDs or proposal fields with shell tools.

```bash
pnpm run trachex proposal list \
  --project subscription-billing

pnpm run trachex proposal review <pending-clarification-proposal-id> \
  --project subscription-billing
```

The review result is the agent's recommendation. It should explain which
existing requirement is superseded, what replaces it, what new work is added,
and why the clarification caused the change. Reviewing the proposal does not
change the checklist.

If the proposal does not recommend superseding the original trial requirement,
do not approve it just to complete the demo. Ask Trachex to rerun the
adjustment with the same clarification or leave it pending and ask the BA for
clarification. The LLM must make the recommendation from the source and
current checklist; the runbook must not manufacture the supersede decision.

## 10. Human Review, Confirmation, And Superseded History

The human owns the final plan. Before approval, review the complete proposal:

- Confirm the original seven-day behavior is actually being replaced.
- Confirm the replacement uses the customer's local timezone.
- Confirm the 24-hour grace-period item is separate new work.
- Confirm the source, author, adjustment note, impacts, and scenarios.
- Edit the proposal if any title, description, scenario, impact, or supersede
  decision is wrong.

If the proposal needs changes, create a complete edited proposal JSON and let
Trachex store it as a new pending version:

```bash
pnpm run trachex proposal edit <pending-clarification-proposal-id> \
  --project subscription-billing \
  --output /path/to/reviewed-clarification-plan.json
```

Review the proposal again after editing. The active checklist is still
unchanged. Only explicit human confirmation applies the plan:

```bash
pnpm run trachex proposal approve <pending-clarification-proposal-id> \
  --project subscription-billing \
  --yes
```

Now inspect the normal human-readable checklist. No JSON filtering or manual
requirement lookup is needed:

```bash
pnpm run trachex subject checklist "Checkout" \
  --project subscription-billing
```

The `# Superseded` section should show the original checked requirement with its
old completion audit, the replacement requirement, and the clarification
source/attribution/note. The active section should show the replacement and the
new grace-period work as unchecked. Unrelated completed work remains checked.

If the human does not approve, or rejects the proposal, the active checklist
must remain exactly as it was before the adjustment. Deterministic fixtures and
field-level assertions belong to automated evals, not this user-facing demo.

## 11. Add UAT Feedback

```bash
pnpm run trachex adjustment "Checkout" \
  --project subscription-billing \
  --source uat \
  --from "UAT Team" \
  --note "At the user's local midnight, trial conversion can select the wrong billing date. Failed payment retry behavior may create duplicate charges. Add coverage for timezone boundaries, retry idempotency, and cancellation during the grace period."
```

Review the pending proposal, optionally edit its complete output, and approve
only with explicit human confirmation. The active checklist remains unchanged
until approval:

```bash
pnpm run trachex proposal list \
  --project subscription-billing
```

```bash
pnpm run trachex proposal list \
  --project subscription-billing
pnpm run trachex proposal review <pending-uat-proposal-id> \
  --project subscription-billing
pnpm run trachex proposal approve <pending-uat-proposal-id> \
  --project subscription-billing \
  --yes
```

## 12. Review Final Progress And Drift Counts

```bash
pnpm run trachex status \
  --project subscription-billing \
  --json
```

```bash
pnpm run trachex subject show checkout \
  --project subscription-billing
```

```bash
pnpm run trachex subject checklist checkout \
  --project subscription-billing
```

Final timeline assertion: **2 initial requirements; 4 additions (2
clarification + 2 UAT); 1 superseded; 5 active; 4 active/unchecked**. The
replacement chain is `Start a seven-day free trial` → `Convert at the end of
the local seventh day`, with clarification source/author/date evidence. The
single-ticket checklist is the source of truth; there is no three-ticket
history to reconcile.

For every drift question, distinguish stored checklist, relationship, source,
and audit evidence from inference. If any required evidence is missing or
contradictory, use this exact response:

> We can't confirm that from the available context. Please ask your BA immediately, then add the clarification with `subject add-doc` before relying on this answer.

Ask MCP/your AI agent these questions, which must be answered only from the
single-ticket checklist, sources, relationships, audits, and documents:

```text
How many requirements were in the initial baseline, how many were added by clarification and UAT, how many were superseded, and how many active requirements remain unchecked?
For every confirmed adjustment, what are the source type, author, date, note, and replacement chain?
Which requirement is the superseded predecessor, what replaced it, and what completion work is now stale?
What is the current meaning compared with the original baseline?
```

The answer must report confirmed evidence and explicitly label unknowns. It must
not invent a cause, owner, date, or requirement change. If the stored checklist,
source, relationship, or audit evidence is missing or contradictory, respond
exactly: **We can't confirm that from the available context. Please ask your BA
immediately, then add the clarification with `subject add-doc` before relying
on this answer.**

## 13. Export The Development Summary

```bash
pnpm run trachex subject export checkout \
  --project subscription-billing \
  --format markdown \
  --out fixtures/subscription-billing-adjustment/subscription-billing-summary.md
```

```bash
pnpm run trachex subject export checkout \
  --project subscription-billing \
  --format json \
  --out fixtures/subscription-billing-adjustment/subscription-billing-summary.json
```

## 14. Open The TUI

The TUI reads the same default database:

```bash
pnpm run trachex tui
```

## 15. Ask MCP Or Another Agent

Useful questions:

```text
What is the current progress of the Checkout subject?
```

```text
Which requirements are currently checked?
```

```text
What changed after the clarification?
```

```text
Which checked requirement was superseded?
```

```text
Which active requirements remain unchecked?
```

```text
Which active requirements have no scenarios?
```

```text
What UAT risks are not covered by the current checklist?
```

```text
Could the retry behavior create duplicate charges?
```

```text
What happens when trial conversion occurs at the user's local midnight?
```

## 16. Run Against A Real Provider

Configure the provider in the root `.env` or your shell. Do not commit secrets.

Example:

```env
TRACHEX_PROVIDER=openai
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_API_KEY=your-key
TRACHEX_MODEL=gpt-4o-mini
```

Inspect the resolved configuration without exposing the API key:

```bash
pnpm run trachex info --json
```

If extraction fails, rerun `subject add-doc` with the same or corrected
document. The existing subject remains available, and each attempt is recorded
as its own source and pending proposal. The CLI includes the underlying
provider or model error instead of only reporting `extraction failed`.

## 17. Reset The Demo Data

The Trachex database remains in the default OS data directory. To reset the
entire local Trachex database, remove the default application directory for
your operating system, then repeat this runbook from step 2.
