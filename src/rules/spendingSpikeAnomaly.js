/**
 * TransacShield Spending Spike Anomaly Detector
 * Computes cardholder historical spending mean and standard deviation,
 * evaluating whether a current transaction is an abnormal statistical outlier (Z-Score > threshold).
 */

export function detectSpendingSpike(currentAmount, historicalAmounts = [], zScoreThreshold = 3.0) {
  const amount = Number(currentAmount);
  if (isNaN(amount) || amount <= 0) {
    return { isSpike: false, zScore: 0, reason: 'Invalid transaction amount' };
  }

  const validHistory = (historicalAmounts || []).map(Number).filter((n) => !isNaN(n) && n > 0);

  // Insufficient history to determine standard deviation
  if (validHistory.length < 3) {
    return {
      isSpike: false,
      zScore: 0,
      mean: validHistory.length ? validHistory.reduce((a, b) => a + b, 0) / validHistory.length : amount,
      reason: 'Insufficient historical baseline',
    };
  }

  const n = validHistory.length;
  const mean = validHistory.reduce((a, b) => a + b, 0) / n;
  const variance = validHistory.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / n;
  const stdDev = Math.sqrt(variance);

  // If variance is near-zero (all past transactions were identical)
  if (stdDev < 0.01) {
    const isSpike = amount > mean * 2.5;
    return {
      isSpike,
      zScore: isSpike ? 99 : 0,
      mean: Number(mean.toFixed(2)),
      stdDev: 0,
      reason: isSpike ? 'Extreme deviation from flat historical spending' : 'Normal',
    };
  }

  const zScore = (amount - mean) / stdDev;
  const isSpike = zScore >= zScoreThreshold;

  return {
    isSpike,
    zScore: Number(zScore.toFixed(2)),
    mean: Number(mean.toFixed(2)),
    stdDev: Number(stdDev.toFixed(2)),
    reason: isSpike
      ? `Transaction is ${zScore.toFixed(1)} standard deviations above baseline average of $${mean.toFixed(2)}`
      : 'Normal',
  };
}
