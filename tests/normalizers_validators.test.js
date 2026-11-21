const test = require('node:test');
const assert = require('node:assert/strict');
const engine = require('../validation.js');

test('trimValue: removes leading and trailing whitespace and handles non-string types', () => {
  assert.equal(engine.trimValue('  hello  '), 'hello');
  assert.equal(engine.trimValue(''), '');
  assert.equal(engine.trimValue(null), '');
  assert.equal(engine.trimValue(undefined), '');
  assert.equal(engine.trimValue(12345), '12345');
});

test('normalizeEmail: trims and lowercases email address', () => {
  assert.equal(engine.normalizeEmail('  USER@Domain.COM '), 'user@domain.com');
  assert.equal(engine.normalizeEmail(''), '');
  assert.equal(engine.normalizeEmail(null), '');
});

test('isValidEmail: accurately validates RFC-compliant email formats', () => {
  assert.equal(engine.isValidEmail('test@example.com'), true);
  assert.equal(engine.isValidEmail('first.last+tag@sub.domain.co'), true);
  assert.equal(engine.isValidEmail('invalid-email'), false);
  assert.equal(engine.isValidEmail('@missinguser.com'), false);
  assert.equal(engine.isValidEmail('missingdomain@'), false);
  assert.equal(engine.isValidEmail(''), false);
});

test('normalizeAmount: strips currency symbols and commas, returning clean numerical string', () => {
  assert.equal(engine.normalizeAmount('$1,250.50'), '1250.50');
  assert.equal(engine.normalizeAmount('€ 450.00'), '450.00');
  assert.equal(engine.normalizeAmount('₹999'), '999');
});

test('isValidAmount: validates positive and zero numeric amounts', () => {
  assert.equal(engine.isValidAmount(100.5), true);
  assert.equal(engine.isValidAmount('250'), true);
  assert.equal(engine.isValidAmount(0), true);
  assert.equal(engine.isValidAmount(-50), false);
  assert.equal(engine.isValidAmount('invalid'), false);
});

test('normalizePhone: strips country prefixes, hyphens, and whitespace based on country rules', () => {
  // India rule: strips '91' prefix if 12 digits, exactly 10 digits
  assert.equal(engine.normalizePhone('+91 98765 43210', 'IN'), '9876543210');
  assert.equal(engine.normalizePhone('98765-43210', 'IN'), '9876543210');

  // Singapore rule: strips '65' prefix, exactly 8 digits
  assert.equal(engine.normalizePhone('+65 8123 4567', 'SG'), '81234567');

  // US rule: strips '1' prefix, exactly 10 digits
  assert.equal(engine.normalizePhone('+1 (555) 234-5678', 'US'), '5552345678');
});

test('isValidPhone: verifies normalized length according to configured country rules', () => {
  assert.equal(engine.isValidPhone('9876543210', 'IN'), true);
  assert.equal(engine.isValidPhone('12345', 'IN'), false);
  assert.equal(engine.isValidPhone('81234567', 'SG'), true);
  assert.equal(engine.isValidPhone('8123456', 'SG'), false);
  assert.equal(engine.isValidPhone('5552345678', 'US'), true);
});

test('isValidCalendarDate: correctly validates calendar boundary days including leap years', () => {
  // Valid leap year day
  assert.equal(engine.isValidCalendarDate(2024, 2, 29), true);
  // Non-leap year day
  assert.equal(engine.isValidCalendarDate(2023, 2, 29), false);
  // April has 30 days
  assert.equal(engine.isValidCalendarDate(2024, 4, 31), false);
  assert.equal(engine.isValidCalendarDate(2024, 4, 30), true);
});

test('isValidPaymentMode: validates accepted payment method strings', () => {
  const allowed = ['UPI', 'Card', 'NetBanking', 'Wallet', 'COD'];
  assert.equal(engine.isValidPaymentMode('UPI', allowed), true);
  assert.equal(engine.isValidPaymentMode('upi', allowed), true); // case-insensitive check
  assert.equal(engine.isValidPaymentMode('CRYPTO_COIN', allowed), false);
});
