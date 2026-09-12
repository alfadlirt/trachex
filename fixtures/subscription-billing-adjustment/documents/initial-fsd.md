# Subscription Billing Portal — Initial FSD

**Author:** Maya Chen, Product  
**Date:** 2025-01-07  
**Ticket:** BILL-101  

## Checkout rules

Customers may start a **seven-day free trial**. No charge is made at signup,
but a valid payment method must be collected and tokenized. At the end of the
trial, the subscription converts to the selected paid plan.

The checkout page is `/checkout`; the subscription API is `POST
/subscriptions`. A customer who refreshes the page must not create duplicate
subscriptions or payment-method tokens.

## Acceptance notes

- Reject expired or invalid cards before creating a trial.
- Show the next charge date on the confirmation page.
- Emit one subscription-created event for downstream billing.
