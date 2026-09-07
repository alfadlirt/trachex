export const FSD_LOYALTY = `# FSD: Loyalty Program v1.2

## 4.2 Discount Application
The system MUST validate the customer's loyalty tier before applying any discount.
The discount cap is 20% for all tiers. VIP tier customers are not exempt from the cap.

## 4.3 Receipts
Cashier receipts must display the discount breakdown and the applied tier.
Receipts must use the store's local timezone for the timestamp.

## 4.4 Checkout
The checkout summary page must show the discounted total before payment.
`;

export const ADJUSTMENT_DISCOUNT_CAP = `Discount cap should be 15%, not 20%. VIP tier is exempt from the cap.`;

export const ADJUSTMENT_TIMEZONE = `Cashier receipt timezone lookup should use the store's configured timezone, not the terminal timezone.`;

export const BRD_LOYALTY = `# BRD: Loyalty Program

## Goals
Increase repeat purchases via a tiered loyalty program.

## Requirements
- Customers earn points per purchase.
- Points convert to tier status.
- The front-office service exposes tier validation to checkout.
`;

export interface GoldenExtraction {
  source: string;
  title: string;
  impacts: { kind: 'service' | 'api' | 'page'; value: string }[];
  scenarios: string[];
}

export const GOLDEN_EXTRACTION: GoldenExtraction[] = [
  {
    source: FSD_LOYALTY,
    title: 'Validate loyalty tier before applying discount',
    impacts: [{ kind: 'service', value: 'front-office-service' }],
    scenarios: ['VIP at cap'],
  },
];

export const GOLDEN_RECONCILIATION = {
  source: ADJUSTMENT_DISCOUNT_CAP,
  createTitle: 'Discount cap 15%, VIP tier exempt',
  supersedesTitle: 'Validate loyalty tier before applying discount',
};

export const GOLDEN_IMPACT_KINDS = ['service', 'api', 'page'] as const;
