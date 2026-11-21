/**
 * Transaction Velocity Check Rule
 * Detects rapid automated micro-transactions or velocity bursts within sliding time windows.
 */

class VelocityCheckEngine {
  constructor(options = {}) {
    this.maxTransactionsPerWindow = options.maxTransactionsPerWindow || 5;
    this.windowSeconds = options.windowSeconds || 60;
    this.maxCumulativeAmount = options.maxCumulativeAmount || 50000;
    // Map of accountId -> Array of { timestamp: Date, amount: number }
    this.history = new Map();
  }

  /**
   * Evaluates an incoming transaction against prior history for the account.
   * @param {Object} tx - { accountId, amount, timestamp }
   * @returns {Object} - Evaluation result { isFlagged, riskScore, reason, metrics }
   */
  evaluate(tx) {
    if (!tx || !tx.accountId) {
      return { isFlagged: false, riskScore: 0, reason: 'Invalid transaction or missing accountId' };
    }

    const txTime = tx.timestamp ? new Date(tx.timestamp).getTime() : Date.now();
    const amount = Number(tx.amount) || 0;
    const windowMs = this.windowSeconds * 1000;
    const cutoffTime = txTime - windowMs;

    let records = this.history.get(tx.accountId) || [];
    // Prune entries outside sliding window
    records = records.filter(r => r.timestamp >= cutoffTime);

    // Calculate velocity
    const recentCount = records.length + 1; // including current tx
    const recentVolume = records.reduce((sum, r) => sum + r.amount, 0) + amount;

    let isFlagged = false;
    let riskScore = 0;
    const reasons = [];

    if (recentCount > this.maxTransactionsPerWindow) {
      isFlagged = true;
      riskScore = Math.min(100, riskScore + 60 + (recentCount - this.maxTransactionsPerWindow) * 10);
      reasons.push(`Velocity threshold exceeded: ${recentCount} txs in ${this.windowSeconds}s (max: ${this.maxTransactionsPerWindow})`);
    }

    if (recentVolume > this.maxCumulativeAmount) {
      isFlagged = true;
      riskScore = Math.min(100, riskScore + 40);
      reasons.push(`Cumulative amount threshold exceeded: ${recentVolume.toFixed(2)} in ${this.windowSeconds}s (max: ${this.maxCumulativeAmount})`);
    }

    // Record the current transaction
    records.push({ timestamp: txTime, amount });
    this.history.set(tx.accountId, records);

    return {
      isFlagged,
      riskScore,
      reason: reasons.join('; ') || 'Normal velocity',
      metrics: {
        recentCount,
        recentVolume,
        windowSeconds: this.windowSeconds
      }
    };
  }

  /**
   * Resets internal history cache.
   */
  reset() {
    this.history.clear();
  }
}

module.exports = VelocityCheckEngine;
