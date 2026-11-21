/**
 * Sanctions and High-Risk Blacklist Rule Checker
 * Performs O(1) set-based screening of Bank Identification Numbers (BIN),
 * sanctioned country ISO codes, and compromised merchant/recipient accounts.
 */

class BlacklistRuleEngine {
  constructor(options = {}) {
    this.sanctionedCountries = new Set(
      (options.sanctionedCountries || ['KP', 'IR', 'SY', 'CU']).map(c => c.toUpperCase())
    );
    this.blacklistedBins = new Set(
      (options.blacklistedBins || ['411111', '555555', '378282']).map(String)
    );
    this.blacklistedAccounts = new Set(
      (options.blacklistedAccounts || []).map(a => String(a).toLowerCase())
    );
    this.blacklistedEmails = new Set(
      (options.blacklistedEmails || []).map(e => String(e).toLowerCase().trim())
    );
  }

  /**
   * Adds an account identifier to the live blacklist.
   */
  addAccount(accountId) {
    if (accountId) this.blacklistedAccounts.add(String(accountId).toLowerCase());
  }

  /**
   * Adds a BIN to the live blacklist.
   */
  addBin(bin) {
    if (bin) this.blacklistedBins.add(String(bin));
  }

  /**
   * Evaluates transaction against sanctions and blacklist records.
   * @param {Object} tx - { accountId, email, country, cardNumber, bin }
   * @returns {Object} - Result { isFlagged, riskScore, reason, flags }
   */
  evaluate(tx) {
    if (!tx) {
      return { isFlagged: false, riskScore: 0, reason: 'Empty transaction payload', flags: [] };
    }

    const flags = [];
    let riskScore = 0;

    // 1. Sanctioned country check
    if (tx.country) {
      const countryCode = String(tx.country).toUpperCase().trim();
      if (this.sanctionedCountries.has(countryCode)) {
        flags.push(`Sanctioned jurisdiction (${countryCode})`);
        riskScore = 100;
      }
    }

    // 2. Blacklisted Account check
    if (tx.accountId) {
      const acc = String(tx.accountId).toLowerCase().trim();
      if (this.blacklistedAccounts.has(acc)) {
        flags.push(`Blacklisted account identifier (${acc})`);
        riskScore = 100;
      }
    }

    // 3. Blacklisted Email check
    if (tx.email) {
      const email = String(tx.email).toLowerCase().trim();
      if (this.blacklistedEmails.has(email)) {
        flags.push(`Blacklisted email address (${email})`);
        riskScore = Math.max(riskScore, 90);
      }
    }

    // 4. Blacklisted BIN check
    const bin = tx.bin || (tx.cardNumber ? String(tx.cardNumber).replace(/\D/g, '').slice(0, 6) : null);
    if (bin && this.blacklistedBins.has(bin)) {
      flags.push(`High-risk flagged BIN (${bin})`);
      riskScore = Math.max(riskScore, 85);
    }

    const isFlagged = flags.length > 0;
    return {
      isFlagged,
      riskScore,
      reason: isFlagged ? flags.join('; ') : 'Passed blacklist screening',
      flags
    };
  }
}

module.exports = BlacklistRuleEngine;
