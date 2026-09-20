import { buildExtractionPrompt } from '../prompts.ts';

export interface ChecklistFixture {
  id: string;
  source: string;
  concepts: string[];
  output: {
    kind: 'extraction';
    requirements: Array<{
      title: string;
      description?: string;
      implementationItems?: string[];
      successCriteria?: string[];
      impacts?: Array<{ kind: 'service' | 'api' | 'page'; value: string }>;
    }>;
    proposedOrder?: {
      orderedIds: string[];
      rationale: string;
      uncertainty?: string | null;
    } | null;
  };
  expected: 'pass' | 'fail';
  impactExpected?: 'pass' | 'fail';
  languageExpected?: 'pass' | 'fail';
  requiresUncertainty?: boolean;
}

export const CHECKLIST_FIXTURES: ChecklistFixture[] = [
  {
    id: 'pause-subscription-grounded',
    source:
      'Customers can pause an active subscription. A paused subscription must not be charged as active, and the user must see the paused state.',
    concepts: ['pause', 'active subscription', 'charged', 'paused state'],
    output: {
      kind: 'extraction',
      requirements: [
        {
          title: 'Customers can pause an active subscription',
          description: 'Preserve the business rule that only an active subscription can be paused.',
          implementationItems: [
            'Add the pause operation to the subscription application flow.',
            'Validate that only active subscriptions can be paused.',
            'Persist the paused state and pause time.',
            'Update user-facing subscription state and error handling.',
          ],
          successCriteria: [
            'An active subscription can be paused and is shown as paused.',
            'A paused subscription is not charged as active.',
            'Repeated pause requests are handled safely.',
          ],
        },
      ],
    },
    expected: 'pass',
  },
  {
    id: 'invented-implementation',
    source: 'Customers can pause an active subscription.',
    concepts: ['pause', 'active subscription'],
    output: {
      kind: 'extraction',
      requirements: [
        {
          title: 'Pause subscriptions with React and PostgreSQL',
          implementationItems: [
            'Add src/routes/subscriptions.tsx using React.',
            'Create a PostgreSQL subscriptions table and REST endpoint.',
          ],
          successCriteria: ['The React page writes to PostgreSQL.'],
        },
      ],
    },
    expected: 'fail',
  },
  {
    id: 'insufficient-context-explicit-uncertainty',
    source:
      'The product must support regional tax treatment, but no repository, architecture, or technical context is available yet.',
    concepts: ['regional tax', 'tax treatment'],
    output: {
      kind: 'extraction',
      requirements: [
        {
          title: 'The product supports regional tax treatment',
          description:
            'The technical approach is uncertain until the applicable regions and existing tax rules are clarified.',
          implementationItems: [
            'Define the regional tax rules and ownership of the calculation behavior.',
            'Represent the selected regional treatment and expose the resulting customer-visible state.',
          ],
          successCriteria: [
            'A supported region receives the applicable tax treatment.',
            'The applied treatment is visible to the user.',
          ],
        },
      ],
    },
    expected: 'pass',
    requiresUncertainty: true,
  },
  {
    id: 'impact-grounding-and-deduplication',
    source:
      'The checkout flow sends POST /subscriptions and updates the downstream billing service. Customers see the confirmation page after a successful trial conversion.',
    concepts: ['checkout', 'subscriptions', 'downstream billing', 'trial conversion'],
    output: {
      kind: 'extraction',
      requirements: [
        {
          title: 'Trial conversion updates billing',
          implementationItems: ['Schedule trial conversion and update billing state.'],
          successCriteria: ['A converted trial is reflected in downstream billing.'],
          impacts: [
            { kind: 'service', value: 'downstream billing' },
            { kind: 'api', value: 'POST /subscriptions' },
            { kind: 'page', value: 'confirmation page' },
          ],
        },
      ],
    },
    expected: 'pass',
  },
  {
    id: 'impact-inference-and-duplicates',
    source: 'Customers can pause an active subscription.',
    concepts: ['pause', 'active subscription'],
    output: {
      kind: 'extraction',
      requirements: [
        {
          title: 'Pause subscriptions',
          implementationItems: ['Pause an active subscription.'],
          successCriteria: ['The subscription is shown as paused.'],
          impacts: [
            { kind: 'api', value: 'POST /subscriptions' },
            { kind: 'api', value: 'post /subscriptions' },
            { kind: 'page', value: '/checkout' },
          ],
        },
      ],
    },
    expected: 'pass',
    impactExpected: 'fail',
  },
  {
    id: 'multilingual-source-english-output',
    source:
      'Pelanggan dapat membatalkan pesanan sebelum barang dikirim. Pengembalian dana harus diproses secara otomatis ke metode pembayaran awal.',
    concepts: ['cancel', 'order', 'refund', 'payment'],
    output: {
      kind: 'extraction',
      requirements: [
        {
          title: 'Customers can cancel orders before shipment',
          description:
            'Allow customers to cancel an order prior to dispatch and trigger an automatic refund to the original payment method.',
          implementationItems: [
            'Validate order cancellation eligibility based on shipment status.',
            'Trigger automatic refund processing to the original payment method.',
            'Notify the customer about the cancellation and refund outcome.',
          ],
          successCriteria: [
            'Orders cannot be canceled once shipment has begun.',
            'Eligible cancellations automatically issue a refund to the original payment method.',
          ],
        },
      ],
      proposedOrder: {
        orderedIds: ['req-order-cancel'],
        rationale: 'Order cancellation validation must be implemented before refund triggering.',
      },
    },
    expected: 'pass',
  },
  {
    id: 'multilingual-source-non-english-output',
    source:
      'Pelanggan dapat membatalkan pesanan sebelum barang dikirim. Pengembalian dana harus diproses secara otomatis.',
    concepts: ['cancel', 'order', 'refund'],
    output: {
      kind: 'extraction',
      requirements: [
        {
          title: 'Pelanggan dapat membatalkan pesanan',
          description: 'Pengembalian dana harus diproses secara otomatis.',
          implementationItems: [
            'Tambahkan integrasi sistem eksternal tanpa relasi.',
            'Lakukan konfigurasi server manual.',
          ],
          successCriteria: ['Pesanan berhasil dibatalkan dan dana dikembalikan.'],
        },
      ],
      proposedOrder: {
        orderedIds: ['req-batal-pesanan'],
        rationale: 'Validasi pembatalan harus diselesaikan terlebih dahulu.',
      },
    },
    expected: 'fail',
    languageExpected: 'fail',
  },
];

export const PROMPT_ALIGNMENT_SOURCE = 'subscription pause';

export function promptGuardrails(): string {
  return buildExtractionPrompt({ sourceType: 'requirements' });
}
