import assert from 'node:assert/strict';
import { test } from 'node:test';
import { uniqueTicketImpacts } from './impacts.ts';

function impact(
  id: string,
  requirementId: string,
  kind: 'service' | 'api' | 'page',
  value: string,
) {
  return { id, requirementId, kind, value };
}

test('deduplicates ticket impacts by kind and trimmed value', () => {
  const impacts = uniqueTicketImpacts([
    impact('service-1', 'requirement-1', 'service', ' checkout-service '),
    impact('service-2', 'requirement-2', 'service', 'checkout-service'),
    impact('api-1', 'requirement-1', 'api', ' checkout-service '),
    impact('page-1', 'requirement-2', 'page', ' Checkout '),
  ]);

  assert.deepEqual(impacts, [
    impact('service-1', 'requirement-1', 'service', 'checkout-service'),
    impact('api-1', 'requirement-1', 'api', 'checkout-service'),
    impact('page-1', 'requirement-2', 'page', 'Checkout'),
  ]);
});

test('does not mutate the requirement-level impact associations', () => {
  const impacts = [
    impact('service-1', 'requirement-1', 'service', ' checkout-service '),
    impact('service-2', 'requirement-2', 'service', 'checkout-service'),
  ];

  uniqueTicketImpacts(impacts);

  assert.deepEqual(impacts, [
    impact('service-1', 'requirement-1', 'service', ' checkout-service '),
    impact('service-2', 'requirement-2', 'service', 'checkout-service'),
  ]);
});
