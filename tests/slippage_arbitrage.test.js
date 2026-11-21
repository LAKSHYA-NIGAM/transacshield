import assert from 'node:assert';
import test from 'node:test';
import { detectFxSlippage } from '../src/rules/slippageArbitrageDetector.js';

test('detectFxSlippage: detects abnormal 5% FX rate slippage', () => {
  const result = detectFxSlippage({
    sourceCurrency: 'USD',
    targetCurrency: 'EUR',
    quotedRate: 0.95,
    marketReferenceRate: 0.90, // ~5.5% slippage
    maxAllowedSlippagePct: 0.025,
  });

  assert.strictEqual(result.hasAbnormalSlippage, true);
  assert.ok(result.slippagePct > 0.05);
  assert.ok(result.reason.includes('exceeds policy threshold'));
});

test('detectFxSlippage: accepts rate within 1% standard deviation spread', () => {
  const result = detectFxSlippage({
    sourceCurrency: 'USD',
    targetCurrency: 'GBP',
    quotedRate: 0.795,
    marketReferenceRate: 0.790, // < 1% slippage
    maxAllowedSlippagePct: 0.025,
  });

  assert.strictEqual(result.hasAbnormalSlippage, false);
  assert.strictEqual(result.reason, 'Normal');
});
