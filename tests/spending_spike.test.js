import assert from 'node:assert';
import test from 'node:test';
import { detectSpendingSpike } from '../src/rules/spendingSpikeAnomaly.js';

test('detectSpendingSpike: flags severe spending outlier', () => {
  // Average around $50, stdDev ~ $10. Current transaction is $500 (Z-score ~ 45)
  const history = [45, 50, 55, 48, 52, 50];
  const res = detectSpendingSpike(500, history, 3.0);
  assert.strictEqual(res.isSpike, true);
  assert.ok(res.zScore > 3.0);
  assert.ok(res.reason.includes('standard deviations above baseline'));
});

test('detectSpendingSpike: normal transaction within baseline tolerance', () => {
  const history = [45, 50, 55, 48, 52, 50];
  const res = detectSpendingSpike(53, history, 3.0);
  assert.strictEqual(res.isSpike, false);
  assert.strictEqual(res.reason, 'Normal');
});

test('detectSpendingSpike: handles insufficient history gracefully', () => {
  const res = detectSpendingSpike(100, [50, 50]);
  assert.strictEqual(res.isSpike, false);
  assert.strictEqual(res.reason, 'Insufficient historical baseline');
});
