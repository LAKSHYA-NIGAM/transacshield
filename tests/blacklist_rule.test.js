const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const BlacklistRuleEngine = require('../src/rules/blacklistRule');

describe('BlacklistRuleEngine Rule Tests', () => {
  let engine;

  beforeEach(() => {
    engine = new BlacklistRuleEngine({
      sanctionedCountries: ['KP', 'IR'],
      blacklistedBins: ['411111', '555555'],
      blacklistedAccounts: ['fraud_user_99'],
      blacklistedEmails: ['scammer@darkweb.org']
    });
  });

  test('approves clean non-blacklisted transaction', () => {
    const res = engine.evaluate({
      accountId: 'legit_user_1',
      email: 'john@example.com',
      country: 'US',
      cardNumber: '4000123456789010'
    });

    assert.equal(res.isFlagged, false);
    assert.equal(res.riskScore, 0);
    assert.equal(res.flags.length, 0);
  });

  test('flags sanctioned jurisdiction with maximum risk score', () => {
    const res = engine.evaluate({
      accountId: 'legit_user_2',
      country: 'IR'
    });

    assert.equal(res.isFlagged, true);
    assert.equal(res.riskScore, 100);
    assert.match(res.flags[0], /Sanctioned jurisdiction \(IR\)/);
  });

  test('flags blacklisted account identifier', () => {
    const res = engine.evaluate({
      accountId: 'FRAUD_USER_99',
      country: 'CA'
    });

    assert.equal(res.isFlagged, true);
    assert.equal(res.riskScore, 100);
    assert.match(res.flags[0], /Blacklisted account identifier/);
  });

  test('flags blacklisted email and BIN', () => {
    const res = engine.evaluate({
      accountId: 'user_xyz',
      email: 'scammer@darkweb.org',
      cardNumber: '4111 1122 3344 5566'
    });

    assert.equal(res.isFlagged, true);
    assert.ok(res.flags.length >= 2);
    assert.ok(res.riskScore >= 90);
  });

  test('supports dynamic addition of flagged accounts and BINs at runtime', () => {
    engine.addAccount('new_bad_actor');
    engine.addBin('601100');

    const res = engine.evaluate({
      accountId: 'new_bad_actor',
      cardNumber: '6011 0012 3456 7890'
    });

    assert.equal(res.isFlagged, true);
    assert.ok(res.flags.length >= 2);
  });
});
