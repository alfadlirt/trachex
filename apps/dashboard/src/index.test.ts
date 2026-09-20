import assert from 'node:assert/strict';
import { test } from 'node:test';
import { toSnakeCase } from './lib/utils.ts';

test('@trachex/dashboard package loads', () => {});

test('toSnakeCase creates lowercase underscore-separated identifiers', () => {
  assert.equal(toSnakeCase('Customer Portal v2'), 'customer_portal_v2');
  assert.equal(toSnakeCase('  Café / Billing  '), 'cafe_billing');
  assert.equal(toSnakeCase('Already_snake_case'), 'already_snake_case');
});
