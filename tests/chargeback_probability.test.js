import assert from 'node:assert';
import test from 'node:test';
import { estimateChargebackProbability } from '../src/rules/chargebackProbability.js';

test('estimateChargebackProbability: low risk domestic card present', () => {
  const result = estimateChargebackProbability({
    isCardPresent: true,
    isInternational: false,
    billingShippingMismatch: false,
    pastDisputeCount: 0,
    amount: 50,
  });

  assert.strictEqual(result.riskBand, 'LOW');
  assert.ok(result.chargebackProbability < 0.2);
  assert.strictEqual(result.requires3DSecure, false);
});

test('estimateChargebackProbability: flags high risk for international CNP with AVS mismatch', () => {
  const result = estimateChargebackProbability({
    isCardPresent: false,
    isInternational: true,
    billingShippingMismatch: true,
    pastDisputeCount: 2,
    amount: 1200,
  });

  assert.strictEqual(result.riskBand, 'HIGH');
  assert.ok(result.chargebackProbability >= 0.7);
  assert.strictEqual(result.requires3DSecure, true);
});
