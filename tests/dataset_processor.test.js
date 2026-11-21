const test = require('node:test');
const assert = require('node:assert/strict');
const engine = require('../validation.js');

test('guessColumnTypes: accurately infers column headers for transaction data', () => {
  const headers = ['Order_ID', 'Customer_Phone', 'User_Email', 'Txn_Date', 'Amount_Paid', 'Payment_Mode'];
  const sampleRows = [
    { Order_ID: 'ORD1', Customer_Phone: '+91-9876543210', User_Email: 'a@b.com', Txn_Date: '2025-01-01', Amount_Paid: '100.50', Payment_Mode: 'UPI' }
  ];
  const mapping = engine.guessColumnTypes(sampleRows, headers);

  assert.ok(mapping, 'Mapping should be returned');
  assert.equal(mapping['Customer_Phone'], 'Phone');
  assert.equal(mapping['User_Email'], 'Email');
  assert.equal(mapping['Amount_Paid'], 'Numeric');
  assert.equal(mapping['Payment_Mode'], 'Payment Mode');
});

test('validateRow: detects valid transaction row and applies normalized values', () => {
  const row = {
    order_id: 'ORD-1001',
    phone: '+91-9876543210',
    email: 'ALICE@EXAMPLE.COM',
    date: '2025-06-15',
    amount: '1,500.00',
    payment_mode: 'UPI'
  };

  const colMapping = {
    orderId: 'order_id',
    phone: 'phone',
    email: 'email',
    date: 'date',
    amount: 'amount',
    paymentMode: 'payment_mode'
  };

  const config = {
    countryPhoneRule: 'IN',
    dateFormatRule: 'YYYY-MM-DD',
    allowedPaymentModes: ['UPI', 'Card', 'COD']
  };

  const seenOrderIds = new Set();
  const seenPairs = new Set();

  const result = engine.validateRow(row, 1, colMapping, config, seenOrderIds, seenPairs);
  assert.equal(result.errors.length, 0, 'Valid row should have 0 errors');
  assert.equal(result.normalizedRow.phone, '9876543210');
  assert.equal(result.normalizedRow.email, 'alice@example.com');
  assert.equal(result.normalizedRow.amount, '1500.00');
});

test('validateRow: captures errors for invalid phone, negative amount, and malformed email', () => {
  const row = {
    order_id: 'ORD-1002',
    phone: '12345',
    email: 'invalid-email-address',
    date: '2024-02-31', // invalid calendar date
    amount: '-500',
    payment_mode: 'UNKNOWN_METHOD'
  };

  const colMapping = {
    orderId: 'order_id',
    phone: 'phone',
    email: 'email',
    date: 'date',
    amount: 'amount',
    paymentMode: 'payment_mode'
  };

  const config = {
    countryPhoneRule: 'IN',
    dateFormatRule: 'YYYY-MM-DD',
    allowedPaymentModes: ['UPI', 'Card']
  };

  const result = engine.validateRow(row, 2, colMapping, config, new Set(), new Set());
  assert.ok(result.errors.length >= 3, 'Should catch multiple column errors');

  const errorCodes = result.errors.map(e => e.errorCode);
  assert.ok(errorCodes.includes('INVALID_PHONE'), 'Should detect invalid phone');
  assert.ok(errorCodes.includes('INVALID_EMAIL'), 'Should detect invalid email');
  assert.ok(errorCodes.includes('INVALID_AMOUNT'), 'Should detect invalid amount');
});

test('validateDataset: calculates aggregate stats, valid/invalid counts, and deduplication', () => {
  const dataset = [
    { order_id: 'ORD-1', phone: '9876543210', email: 'a@test.com', date: '2025-01-01', amount: '100', payment_mode: 'UPI' },
    { order_id: 'ORD-2', phone: '9876543211', email: 'b@test.com', date: '2025-01-01', amount: '200', payment_mode: 'Card' },
    { order_id: 'ORD-3', phone: '98765', email: 'bad-email', date: 'bad-date', amount: '-1', payment_mode: 'XYZ' }
  ];

  const colMapping = {
    orderId: 'order_id',
    phone: 'phone',
    email: 'email',
    date: 'date',
    amount: 'amount',
    paymentMode: 'payment_mode'
  };

  const config = {
    countryPhoneRule: 'IN',
    dateFormatRule: 'YYYY-MM-DD',
    allowedPaymentModes: ['UPI', 'Card']
  };

  const output = engine.validateDataset(dataset, colMapping, config);
  assert.equal(output.summary.totalRows, 3);
  assert.equal(output.summary.validRows, 2);
  assert.equal(output.summary.invalidRows, 1);
  assert.equal(output.summary.errorCount > 0, true);
  assert.equal(output.cleanedRows.length, 2);
});
