const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const VelocityCheckEngine = require('../src/rules/velocityCheck');

describe('VelocityCheckEngine Rule Tests', () => {
  let engine;

  beforeEach(() => {
    engine = new VelocityCheckEngine({
      maxTransactionsPerWindow: 3,
      windowSeconds: 30,
      maxCumulativeAmount: 1000
    });
  });

  test('allows transactions within frequency and amount limits', () => {
    const res1 = engine.evaluate({ accountId: 'acc_01', amount: 100, timestamp: 1000 });
    assert.equal(res1.isFlagged, false);
    assert.equal(res1.riskScore, 0);

    const res2 = engine.evaluate({ accountId: 'acc_01', amount: 200, timestamp: 2000 });
    assert.equal(res2.isFlagged, false);
    assert.equal(res2.metrics.recentCount, 2);
  });

  test('flags when transaction frequency exceeds maximum threshold', () => {
    engine.evaluate({ accountId: 'acc_02', amount: 50, timestamp: 1000 });
    engine.evaluate({ accountId: 'acc_02', amount: 50, timestamp: 2000 });
    engine.evaluate({ accountId: 'acc_02', amount: 50, timestamp: 3000 });

    // 4th transaction within 30s window (limit is 3)
    const res4 = engine.evaluate({ accountId: 'acc_02', amount: 50, timestamp: 4000 });
    assert.equal(res4.isFlagged, true);
    assert.ok(res4.riskScore >= 60);
    assert.match(res4.reason, /Velocity threshold exceeded/);
  });

  test('flags when cumulative amount exceeds maximum threshold', () => {
    engine.evaluate({ accountId: 'acc_03', amount: 600, timestamp: 1000 });
    const res2 = engine.evaluate({ accountId: 'acc_03', amount: 500, timestamp: 2000 });

    assert.equal(res2.isFlagged, true);
    assert.ok(res2.riskScore >= 40);
    assert.match(res2.reason, /Cumulative amount threshold exceeded/);
  });

  test('prunes expired entries outside sliding window', () => {
    engine.evaluate({ accountId: 'acc_04', amount: 100, timestamp: 1000 });
    engine.evaluate({ accountId: 'acc_04', amount: 100, timestamp: 2000 });

    // Next transaction occurs 35 seconds later (> 30s window)
    const res = engine.evaluate({ accountId: 'acc_04', amount: 100, timestamp: 37000 });
    assert.equal(res.isFlagged, false);
    assert.equal(res.metrics.recentCount, 1);
  });

  test('isolates transaction histories across accounts', () => {
    engine.evaluate({ accountId: 'acc_05', amount: 200, timestamp: 1000 });
    engine.evaluate({ accountId: 'acc_05', amount: 200, timestamp: 2000 });
    engine.evaluate({ accountId: 'acc_05', amount: 200, timestamp: 3000 });

    // Account 6 makes a transaction; should not be affected by Account 5's count
    const res = engine.evaluate({ accountId: 'acc_06', amount: 200, timestamp: 4000 });
    assert.equal(res.isFlagged, false);
    assert.equal(res.metrics.recentCount, 1);
  });
});
