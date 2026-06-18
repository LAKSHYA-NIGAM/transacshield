/**
 * TransacShield — Validation & Normalization Engine (v2)
 *
 * Design principles:
 *   1. Every validator is a standalone, pure function — easy to unit-test
 *      and easy to explain in an interview.
 *   2. Country-specific rules live in a config map, not in if/else branches.
 *   3. All rows are validated; errors are collected, never short-circuited.
 *   4. Each error carries: row, column, errorCode, message, suggestedFix.
 *   5. The engine returns both row-level results AND an aggregate summary.
 */

const TransacValidationEngine = (function () {
  'use strict';

  // ═══════════════════════════════════════════
  // 1. CONFIGURATION MAPS
  // ═══════════════════════════════════════════

  /**
   * Phone validation rules keyed by ISO country code.
   * Add new countries here — no code changes needed elsewhere.
   */
  const PHONE_RULES = {
    IN: {
      digits: 10,
      label: 'India',
      prefixes: ['91'],           // stripped when normalizing
      description: 'exactly 10 digits'
    },
    SG: {
      digits: 8,
      label: 'Singapore',
      prefixes: ['65'],
      description: 'exactly 8 digits'
    },
    GLOBAL: {
      minDigits: 7,
      maxDigits: 15,
      label: 'Global',
      prefixes: [],
      description: '7–15 digits (E.164)'
    }
  };

  /** Supported datetime formats with named regex captures. */
  const DATE_PATTERNS = [
    {
      name: 'YYYY-MM-DD',
      regex: /^(\d{4})-(\d{2})-(\d{2})$/,
      parse: (m) => ({ y: +m[1], m: +m[2], d: +m[3] })
    },
    {
      name: 'DD/MM/YYYY',
      regex: /^(\d{2})\/(\d{2})\/(\d{4})$/,
      parse: (m) => ({ d: +m[1], m: +m[2], y: +m[3] })
    },
    {
      name: 'MM/DD/YYYY',
      regex: /^(\d{2})\/(\d{2})\/(\d{4})$/,
      parse: (m) => ({ m: +m[1], d: +m[2], y: +m[3] })
    },
    {
      name: 'YYYY-MM-DD HH:mm:ss',
      regex: /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2}):(\d{2})$/,
      parse: (m) => ({ y: +m[1], m: +m[2], d: +m[3], h: +m[4], min: +m[5], s: +m[6] })
    },
    {
      name: 'DD/MM/YYYY HH:mm:ss',
      regex: /^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2}):(\d{2})$/,
      parse: (m) => ({ d: +m[1], m: +m[2], y: +m[3], h: +m[4], min: +m[5], s: +m[6] })
    }
  ];

  const DEFAULT_PAYMENT_MODES = ['UPI', 'Card', 'NetBanking', 'Wallet', 'COD'];

  // ═══════════════════════════════════════════
  // 2. NORMALIZERS  (trim, clean, standardize)
  // ═══════════════════════════════════════════

  function trimValue(val) {
    if (val === null || val === undefined) return '';
    return String(val).trim();
  }

  function normalizeEmail(val) {
    return trimValue(val).toLowerCase();
  }

  /**
   * Strip all non-digit characters, then remove known country prefix
   * if the result matches (prefix + expected national length).
   */
  function normalizePhone(val, countryCode) {
    const digits = trimValue(val).replace(/\D/g, '');
    const rule = PHONE_RULES[countryCode] || PHONE_RULES.GLOBAL;

    if (rule.prefixes && rule.digits) {
      for (const prefix of rule.prefixes) {
        if (digits.startsWith(prefix) && digits.length === rule.digits + prefix.length) {
          return digits.substring(prefix.length);
        }
      }
    }
    // India-specific: leading zero removal
    if (countryCode === 'IN' && digits.length === 11 && digits.startsWith('0')) {
      return digits.substring(1);
    }
    return digits;
  }

  function normalizeAmount(val) {
    return trimValue(val).replace(/[$,₹€]/g, '');
  }

  // ═══════════════════════════════════════════
  // 3. VALIDATORS  (each returns true/false)
  // ═══════════════════════════════════════════

  /** Check that a value is non-empty after trimming. */
  function isRequired(val) {
    return trimValue(val).length > 0;
  }

  /** RFC-5322 simplified email regex. */
  function isValidEmail(email) {
    if (!email) return false;
    return /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(email);
  }

  /** Country-aware phone length check against PHONE_RULES. */
  function isValidPhone(normalizedDigits, countryCode) {
    if (!normalizedDigits || !/^\d+$/.test(normalizedDigits)) return false;
    const rule = PHONE_RULES[countryCode] || PHONE_RULES.GLOBAL;

    if (rule.digits) {
      return normalizedDigits.length === rule.digits;
    }
    return normalizedDigits.length >= (rule.minDigits || 7)
        && normalizedDigits.length <= (rule.maxDigits || 15);
  }

  /**
   * Strict calendar checker — rejects Feb 30, respects leap years, etc.
   */
  function isValidCalendarDate(y, m, d, h = 0, min = 0, s = 0) {
    if (m < 1 || m > 12 || d < 1 || d > 31) return false;
    if (h < 0 || h > 23 || min < 0 || min > 59 || s < 0 || s > 59) return false;
    const days = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    if (m === 2) {
      const isLeap = (y % 4 === 0 && y % 100 !== 0) || (y % 400 === 0);
      if (isLeap) days[1] = 29;
    }
    return d <= days[m - 1];
  }

  /**
   * Parse a date string against known patterns.
   * @param {string} dateStr
   * @param {string} formatRule - 'AUTO' or a specific pattern name
   * @returns {{ isValid: boolean, detectedFormat: string|null }}
   */
  function validateDate(dateStr, formatRule = 'AUTO') {
    const s = trimValue(dateStr);
    if (!s) return { isValid: false, detectedFormat: null };

    const check = (pattern) => {
      const match = s.match(pattern.regex);
      if (!match) return null;
      const p = pattern.parse(match);
      return isValidCalendarDate(p.y, p.m, p.d, p.h || 0, p.min || 0, p.s || 0)
        ? pattern.name : null;
    };

    if (formatRule !== 'AUTO') {
      const target = DATE_PATTERNS.find(p => p.name === formatRule);
      if (!target) return { isValid: false, detectedFormat: null };
      const det = check(target);
      return { isValid: det !== null, detectedFormat: det };
    }
    for (const p of DATE_PATTERNS) {
      const det = check(p);
      if (det) return { isValid: true, detectedFormat: det };
    }
    return { isValid: false, detectedFormat: null };
  }

  /** Case-insensitive membership test. */
  function isValidPaymentMode(val, allowedModes) {
    if (!val) return false;
    const upper = trimValue(val).toUpperCase();
    return allowedModes.some(m => m.trim().toUpperCase() === upper);
  }

  /** Numeric and non-negative. */
  function isValidAmount(val) {
    if (val === null || val === undefined || val === '') return false;
    const n = Number(val);
    return !isNaN(n) && n >= 0;
  }

  // ═══════════════════════════════════════════
  // 4. ERROR FACTORY
  // ═══════════════════════════════════════════

  /**
   * Build a standardized error/warning object.
   */
  function makeIssue(row, column, severity, errorCode, message, value, suggestedFix) {
    return { row, column, severity, errorCode, type: message, value: value || 'EMPTY', suggestedFix };
  }

  // ═══════════════════════════════════════════
  // 5. ROW-LEVEL VALIDATOR
  // ═══════════════════════════════════════════

  /**
   * Resolve which phone country rule applies for a single row.
   * If a `country` column is mapped AND has a value, we use per-row logic;
   * otherwise we fall back to the global config setting.
   */
  function resolveCountryRule(rawCountry, fallback) {
    if (!rawCountry) return fallback;
    const c = trimValue(rawCountry).toUpperCase();
    if (c === 'IN' || c === 'IND' || c === 'INDIA') return 'IN';
    if (c === 'SG' || c === 'SGP' || c === 'SINGAPORE') return 'SG';
    return 'GLOBAL';
  }

  /**
   * Validate and normalize one CSV row.
   *
   * @param {Object}  row           - Raw row object keyed by CSV header.
   * @param {number}  rowIndex      - 1-indexed row number.
   * @param {Object}  mappings      - Logical field → CSV header map.
   * @param {Object}  config        - { countryPhoneRule, dateFormatRule, allowedPaymentModes }
   * @param {Set}     seenOrderIds  - Tracks order_id values for single-key duplicate detection.
   * @param {Set}     seenPairs     - Tracks order_id+product_id for pair duplicate detection.
   * @returns {{ errors: Array, warnings: Array, normalizedRow: Object }}
   */
  function validateRow(row, rowIndex, mappings, config, seenOrderIds, seenPairs) {
    const errors = [];
    const warnings = [];
    const normalizedRow = { ...row };

    // Resolve mapped column names (fall back to field name if not mapped)
    const col = {
      orderId:     mappings.order_id     || '',
      productId:   mappings.product_id   || '',
      phone:       mappings.phone        || '',
      country:     mappings.country      || '',
      email:       mappings.email        || '',
      datetime:    mappings.datetime     || mappings.date || '',
      amount:      mappings.amount       || '',
      paymentMode: mappings.payment_mode || ''
    };

    // ── 1. Required: Order ID ────────────────────────────
    if (col.orderId) {
      const raw = row[col.orderId];
      if (!isRequired(raw)) {
        errors.push(makeIssue(
          rowIndex, col.orderId, 'ERROR', 'MISSING_ORDER_ID',
          'Missing Order ID', raw,
          'Provide a unique transaction/order identifier.'
        ));
        normalizedRow[col.orderId] = '';
      } else {
        normalizedRow[col.orderId] = trimValue(raw);
      }
    }

    // ── 2. Product ID (optional, just normalize) ─────────
    if (col.productId && row[col.productId] !== undefined) {
      normalizedRow[col.productId] = trimValue(row[col.productId]);
    }

    // ── 3. Duplicate detection ───────────────────────────
    const normOrderId = normalizedRow[col.orderId] || '';
    const normProductId = col.productId ? (normalizedRow[col.productId] || '') : '';

    if (col.orderId && normOrderId) {
      // 3a. Single-key duplicate (order_id alone)
      if (!col.productId || !normProductId) {
        if (seenOrderIds.has(normOrderId)) {
          warnings.push(makeIssue(
            rowIndex, col.orderId, 'WARNING', 'DUPLICATE_ORDER',
            'Duplicate Order ID', normOrderId,
            'This order_id appeared before. Verify it is not a duplicate submission.'
          ));
        } else {
          seenOrderIds.add(normOrderId);
        }
      }

      // 3b. Composite duplicate (order_id + product_id)
      if (col.productId && normProductId) {
        const pairKey = `${normOrderId}||${normProductId}`;
        if (seenPairs.has(pairKey)) {
          warnings.push(makeIssue(
            rowIndex, `${col.orderId} + ${col.productId}`, 'WARNING', 'DUPLICATE_PAIR',
            'Duplicate Record', `Order: ${normOrderId}, Product: ${normProductId}`,
            'This order + product pair already exists. It will be retained but flagged.'
          ));
        } else {
          seenPairs.add(pairKey);
        }
      }
    }

    // ── 4. Email validation ──────────────────────────────
    if (col.email && row[col.email] !== undefined && row[col.email] !== null) {
      const raw = row[col.email];
      const norm = normalizeEmail(raw);
      normalizedRow[col.email] = norm;
      if (trimValue(raw) !== '' && !isValidEmail(norm)) {
        errors.push(makeIssue(
          rowIndex, col.email, 'ERROR', 'INVALID_EMAIL',
          'Invalid Email Format', raw,
          'Use a standard email format, e.g. name@domain.com.'
        ));
      }
    }

    // ── 5. Country normalization ─────────────────────────
    if (col.country && row[col.country] !== undefined) {
      normalizedRow[col.country] = trimValue(row[col.country]);
    }

    // ── 6. Phone validation ──────────────────────────────
    if (col.phone && row[col.phone] !== undefined && row[col.phone] !== null) {
      const raw = row[col.phone];
      const countryCode = resolveCountryRule(
        col.country ? row[col.country] : null,
        config.countryPhoneRule || 'GLOBAL'
      );
      const norm = normalizePhone(raw, countryCode);
      normalizedRow[col.phone] = norm;

      if (trimValue(raw) !== '' && !isValidPhone(norm, countryCode)) {
        const rule = PHONE_RULES[countryCode] || PHONE_RULES.GLOBAL;
        errors.push(makeIssue(
          rowIndex, col.phone, 'ERROR', 'INVALID_PHONE',
          'Invalid Phone Number', raw,
          `Expected ${rule.description} for ${rule.label}.`
        ));
      }
    }

    // ── 7. Datetime validation ───────────────────────────
    if (col.datetime && row[col.datetime] !== undefined && row[col.datetime] !== null) {
      const raw = row[col.datetime];
      normalizedRow[col.datetime] = trimValue(raw);
      if (trimValue(raw) !== '') {
        const result = validateDate(raw, config.dateFormatRule || 'AUTO');
        if (!result.isValid) {
          const accepted = DATE_PATTERNS.map(p => p.name).join(', ');
          errors.push(makeIssue(
            rowIndex, col.datetime, 'ERROR', 'INVALID_DATE',
            'Invalid Date/Time Value', raw,
            `Could not parse. Accepted formats: ${accepted}. Also check calendar boundaries (e.g. Feb 30 is invalid).`
          ));
        }
      }
    }

    // ── 8. Payment mode validation ───────────────────────
    if (col.paymentMode && row[col.paymentMode] !== undefined && row[col.paymentMode] !== null) {
      const raw = row[col.paymentMode];
      normalizedRow[col.paymentMode] = trimValue(raw);
      if (trimValue(raw) !== '') {
        const allowed = config.allowedPaymentModes || DEFAULT_PAYMENT_MODES;
        if (!isValidPaymentMode(raw, allowed)) {
          errors.push(makeIssue(
            rowIndex, col.paymentMode, 'ERROR', 'INVALID_PAYMENT',
            'Unsupported Payment Mode', raw,
            `Allowed modes: ${allowed.join(', ')}.`
          ));
        } else {
          // Normalize casing to match config
          const match = allowed.find(m => m.trim().toUpperCase() === raw.trim().toUpperCase());
          if (match) normalizedRow[col.paymentMode] = match.trim();
        }
      }
    }

    // ── 9. Amount validation ─────────────────────────────
    if (col.amount && row[col.amount] !== undefined && row[col.amount] !== null) {
      const raw = row[col.amount];
      const norm = normalizeAmount(raw);
      normalizedRow[col.amount] = norm;
      if (trimValue(raw) !== '' && !isValidAmount(norm)) {
        errors.push(makeIssue(
          rowIndex, col.amount, 'ERROR', 'INVALID_AMOUNT',
          'Invalid Amount', raw,
          'Must be a non-negative number (e.g. 99.50).'
        ));
      }
    }

    return { errors, warnings, normalizedRow };
  }

  // ═══════════════════════════════════════════
  // 6. DATASET-LEVEL VALIDATOR  (aggregate)
  // ═══════════════════════════════════════════

  /**
   * Validate every row and return both row-level detail and a summary.
   *
   * @param {Array}  rows     - Parsed CSV row objects.
   * @param {Object} mappings - { order_id, product_id, phone, ... }
   * @param {Object} config   - Engine configuration.
   * @returns {{ rows: Array, summary: Object }}
   */
  function validateDataset(rows, mappings, config) {
    const allErrors = [];
    const allWarnings = [];
    const normalizedRows = [];
    const cleanedRows = [];
    const seenOrderIds = new Set();
    const seenPairs = new Set();

    for (let i = 0; i < rows.length; i++) {
      const rowIndex = i + 1;
      const result = validateRow(rows[i], rowIndex, mappings, config, seenOrderIds, seenPairs);

      allErrors.push(...result.errors);
      allWarnings.push(...result.warnings);

      const entry = {
        rowIndex,
        originalRow: rows[i],
        normalizedRow: result.normalizedRow,
        hasErrors: result.errors.length > 0,
        errors: result.errors,
        warnings: result.warnings
      };
      normalizedRows.push(entry);

      if (!entry.hasErrors) {
        cleanedRows.push(result.normalizedRow);
      }
    }

    // Build aggregate summary
    const uniqueInvalidRows = new Set(allErrors.map(e => e.row));
    const errorsByColumn = {};
    allErrors.forEach(e => {
      errorsByColumn[e.column] = (errorsByColumn[e.column] || 0) + 1;
    });

    const summary = {
      totalRows: rows.length,
      validRows: cleanedRows.length,
      invalidRows: uniqueInvalidRows.size,
      warningCount: allWarnings.length,
      errorCount: allErrors.length,
      errorsByColumn
    };

    return {
      rows: normalizedRows,
      errors: allErrors,
      warnings: allWarnings,
      cleanedRows,
      summary
    };
  }

  // ═══════════════════════════════════════════
  // 7. TYPE GUESSER  (used by the mapping UI)
  // ═══════════════════════════════════════════

  /**
   * Sample the first N rows and guess each column's predominant data type.
   */
  function guessColumnTypes(rows, headers) {
    const guesses = {};
    if (!rows || rows.length === 0) {
      headers.forEach(h => { guesses[h] = 'Text/ID'; });
      return guesses;
    }

    const sampleSize = Math.min(rows.length, 50);
    const emailRe = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    const paymentUpper = DEFAULT_PAYMENT_MODES.map(m => m.toUpperCase());

    headers.forEach(header => {
      let counts = { numeric: 0, date: 0, email: 0, phone: 0, payment: 0, empty: 0 };

      for (let i = 0; i < sampleSize; i++) {
        const val = trimValue(rows[i][header]);
        if (val === '') { counts.empty++; continue; }

        if (!isNaN(Number(val.replace(/[$,₹€]/g, '')))) counts.numeric++;
        if (emailRe.test(val))                           counts.email++;
        if (validateDate(val, 'AUTO').isValid)            counts.date++;
        const digits = val.replace(/\D/g, '');
        if (digits.length >= 7 && digits.length <= 15)   counts.phone++;
        if (paymentUpper.includes(val.toUpperCase()))     counts.payment++;
      }

      const active = sampleSize - counts.empty;
      if (active === 0)                          guesses[header] = 'Empty';
      else if (counts.email   / active > 0.6)    guesses[header] = 'Email';
      else if (counts.payment / active > 0.6)    guesses[header] = 'Payment Mode';
      else if (counts.date    / active > 0.6)    guesses[header] = 'Date/Time';
      else if (counts.numeric / active > 0.6)    guesses[header] = 'Numeric';
      else if (counts.phone   / active > 0.6)    guesses[header] = 'Phone';
      else                                       guesses[header] = 'Text/ID';
    });

    return guesses;
  }

  // ═══════════════════════════════════════════
  // PUBLIC API
  // ═══════════════════════════════════════════

  return {
    // Config references (read-only for UI)
    PHONE_RULES,
    DATE_PATTERNS,
    DEFAULT_PAYMENT_MODES,

    // Normalizers
    trimValue,
    normalizeEmail,
    normalizePhone,
    normalizeAmount,

    // Validators
    isRequired,
    isValidEmail,
    isValidPhone,
    isValidCalendarDate,
    validateDate,
    isValidPaymentMode,
    isValidAmount,

    // Row & dataset processors
    validateRow,
    validateDataset,

    // Helpers
    guessColumnTypes,
    resolveCountryRule
  };

})();

// Expose globally for other scripts
window.TransacValidationEngine = TransacValidationEngine;
