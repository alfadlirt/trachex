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

## 9. Add A Clarification Adjustment (Deterministic Primary Path)

The adjustment is on the single `Checkout`/`BILL-101` ticket. Free-text notes
do not force an agent to emit `supersedes`, so use the provider-free fixture.

```bash
OLD_ID=$(pnpm run trachex subject checklist "Checkout" --project subscription-billing --json \
  | jq -r '.groups[].items[] | select(.title == "Start a seven-day free trial") | .id')
test -n "$OLD_ID" && test "$OLD_ID" != "null"
jq --arg target "$OLD_ID" '.create[0].supersedes = [$target]' \
  fixtures/subscription-billing-adjustment/reconciliation-clarification.json \
  > /tmp/trachex-clarification-reconciliation.json
pnpm run trachex adjustment "Checkout" \
  --project subscription-billing \
  --source clarification \
  --from "Maya Chen, Product Manager" \
  --note "Trial conversion must use the account timezone. Add a 24-hour grace period for failed payment retries. The previous requirement did not cover timezone boundaries or cancellation during the grace period." \
  --fixture /tmp/trachex-clarification-reconciliation.json
```

Assert the pending proposal JSON before approving:

```bash
PROPOSAL_ID=$(pnpm run trachex proposal list --project subscription-billing \
  | jq -r '[.[] | select(.proposal.kind == "reconciliation" and .proposal.status == "pending")][-1].proposal.id')
pnpm run trachex proposal list --project subscription-billing \
  | jq --arg id "$PROPOSAL_ID" '.[] | select(.proposal.id == $id) | .versions[-1].editedOutput | fromjson | {kind, supersedes: [.create[].supersedes[]]}'
```

Expected output includes `{"kind":"reconciliation","supersedes":["<OLD_ID>"]}`.
Approve only after that assertion passes:

```bash
pnpm run trachex proposal approve "$PROPOSAL_ID" \
  --project subscription-billing \
  --yes
```

## 10. Assert Superseded Requirement History

```bash
pnpm run trachex subject checklist "Checkout" \
  --project subscription-billing \
  --json > /tmp/trachex-checklist-after-clarification.json
jq -e --arg old "$OLD_ID" '
  (.superseded | length) == 1 and .[0].item.id == $old and
  .[0].item.lifecycleStatus == "superseded" and
  .[0].supersededByTitle == "Convert at the end of the local seventh day" and
  .[0].replacement.source.type == "clarification" and
  .[0].replacement.source.attribution == "Maya Chen, Product Manager" and
  .[0].replacement.source.location != null and .[0].replacement.source.note != null and
  .[0].replacement.source.ingestedAt != null and
  .[0].replacement.devStatus == "unchecked"
' /tmp/trachex-checklist-after-clarification.json
```

Expected result is `true`. Also check the JSON fields `lifecycleStatus`,
`supersededByTitle`, `oldAudits`, and `replacement.source` (type, attribution,
location, and note). The replacement must be active/unchecked and unrelated
completed items must remain checked.

### Repair branch: missing `supersedes`

If `.superseded` is empty, do not approve. Inspect the proposal output, then
rerun the deterministic fixture with an explicit replacement note (or use a
proposal editor, if one is available, to set `create[0].supersedes` to
`$OLD_ID`). Refresh `PROPOSAL_ID`, rerun the assertion, then approve:

```bash
pnpm run trachex proposal list --project subscription-billing \
  | jq --arg id "$PROPOSAL_ID" '.[] | select(.proposal.id == $id) | .versions[-1]'
pnpm run trachex adjustment "Checkout" --project subscription-billing \
  --source clarification --from "Maya Chen, Product Manager" \
  --note "Explicit replacement: supersede requirement $OLD_ID (Start a seven-day free trial) with local seventh-day conversion; add a 24-hour grace period." \
  --fixture /tmp/trachex-clarification-reconciliation.json
PROPOSAL_ID=$(pnpm run trachex proposal list --project subscription-billing \
  | jq -r '[.[] | select(.proposal.kind == "reconciliation" and .proposal.status == "pending")][-1].proposal.id')
```

Approve the repaired pending proposal only after its JSON contains
`supersedes: ["$OLD_ID"]`. Repeat step 10; it must show `# Superseded`.

## 11. Add UAT Feedback

```bash
pnpm run trachex adjustment "Checkout" \
  --project subscription-billing \
  --source uat \
  --from "UAT Team" \
  --note "At the user's local midnight, trial conversion can select the wrong billing date. Failed payment retry behavior may create duplicate charges. Add coverage for timezone boundaries, retry idempotency, and cancellation during the grace period." \
  --fixture fixtures/subscription-billing-adjustment/reconciliation-uat.json
```

Review and assert the new proposal, then approve:

```bash
pnpm run trachex proposal list \
  --project subscription-billing
```

```bash
PROPOSAL_ID=$(pnpm run trachex proposal list --project subscription-billing \
  | jq -r '[.[] | select(.proposal.kind == "reconciliation" and .proposal.status == "pending")][-1].proposal.id')
pnpm run trachex proposal list --project subscription-billing \
  | jq -e --arg id "$PROPOSAL_ID" '.[] | select(.proposal.id == $id) | .versions[-1].editedOutput | fromjson | (.kind == "reconciliation" and (.create | length) == 2)'
pnpm run trachex proposal approve "$PROPOSAL_ID" \
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
