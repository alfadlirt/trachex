# Trial Conversion Clarification

**Author:** Owen Brooks, Product  
**Date:** 2025-01-28  
**Ticket:** BILL-118 (adjusts BILL-101)  

## Conversion

“Seven days” means the end of the customer's **seventh local calendar day**,
using the timezone captured at checkout. Do not calculate conversion as seven
elapsed UTC periods. This clarification supersedes the original BILL-101
conversion interpretation.

## Grace period

If the first conversion charge fails, keep the subscription in a 24-hour grace
period and retry the charge once. The customer should see a recoverable billing
state rather than an immediate cancellation. The retry worker and conversion
endpoint both need an idempotency key.
