# UAT Billing Feedback

**Author:** Priya Nair, QA  
**Date:** 2025-02-12  
**Ticket:** BILL-127 (reports BILL-101 and BILL-118)  

## Findings

1. A customer in `America/Los_Angeles` saw conversion on the wrong date when
   the seventh local day crossed midnight UTC. The account history displayed a
   UTC date instead of the timezone selected at checkout.
2. Replaying the payment-provider webhook is not covered by the current UAT
   script. Product requires duplicate delivery to produce at most one charge.
3. The retry behavior is unclear in the UI: the grace-period message and the
   final failed-retry state need explicit coverage.

## Reproduction location

Use `/account/billing` after a trial created near a timezone boundary. Replay
`POST /webhooks/payment` with the same provider event ID.
