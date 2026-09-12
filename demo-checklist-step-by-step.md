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

## 9. Add A Clarification Adjustment

```bash
pnpm run trachex adjustment "Checkout" \
  --project subscription-billing \
  --source clarification \
  --from "Maya Chen, Product Manager" \
  --note "Trial conversion must use the account timezone. Add a 24-hour grace period for failed payment retries. The previous requirement did not cover timezone boundaries or cancellation during the grace period."
```

List proposals again:

```bash
pnpm run trachex proposal list \
  --project subscription-billing
```

Approve the newest reconciliation proposal:

```bash
pnpm run trachex proposal approve <copy-clarification-proposal-id> \
  --project subscription-billing \
  --yes
```

## 10. Verify Requirement History

```bash
pnpm run trachex subject checklist "Checkout" \
  --project subscription-billing \
  --json
```

Verify that:

- The old requirement is superseded, not deleted.
- The replacement requirement is active.
- The replacement requirement is unchecked.
- Unrelated completed items remain checked.

## 11. Add UAT Feedback

```bash
pnpm run trachex adjustment "Checkout" \
  --project subscription-billing \
  --source uat \
  --from "UAT Team" \
  --note "At the user's local midnight, trial conversion can select the wrong billing date. Failed payment retry behavior may create duplicate charges. Add coverage for timezone boundaries, retry idempotency, and cancellation during the grace period."
```

Review and approve the new proposal:

```bash
pnpm run trachex proposal list \
  --project subscription-billing
```

```bash
pnpm run trachex proposal approve <copy-uat-proposal-id> \
  --project subscription-billing \
  --yes
```

## 12. Review Final Progress

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
