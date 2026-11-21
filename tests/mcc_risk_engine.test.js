import assert from 'node:assert';
import test from 'node:test';
import { evaluateMccRisk } from '../src/rules/mccRiskEngine.js';

test('evaluateMccRisk: identifies high-risk gambling and quasi-cash MCCs', () => {
  const gambling = evaluateMccRisk('7995');
  assert.strictEqual(gambling.riskTier, 'HIGH');
  assert.strictEqual(gambling.isHighRisk, true);
  assert.strictEqual(gambling.riskScore, 90);

  const crypto = evaluateMccRisk('6051');
  assert.strictEqual(crypto.riskTier, 'HIGH');
  assert.strictEqual(crypto.isHighRisk, true);
});

test('evaluateMccRisk: identifies low-risk grocery and pharmacy MCCs', () => {
  const grocery = evaluateMccRisk('5411');
  assert.strictEqual(grocery.riskTier, 'LOW');
  assert.strictEqual(grocery.isHighRisk, false);
  assert.strictEqual(grocery.riskScore, 10);
});

test('evaluateMccRisk: handles unclassified or empty MCC codes', () => {
  const unclassified = evaluateMccRisk('9999');
  assert.strictEqual(unclassified.name, 'Unclassified Category');
  assert.strictEqual(unclassified.riskTier, 'MEDIUM');
  assert.strictEqual(unclassified.isHighRisk, false);
});
