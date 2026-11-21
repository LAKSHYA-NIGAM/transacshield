/**
 * TransacShield Chargeback Probability Estimator
 * Computes heuristic chargeback risk probability (0.0 to 1.0) based on
 * Card-Not-Present (CNP) status, billing/shipping mismatch, dispute history, and transaction amount.
 */

export function estimateChargebackProbability({
  isCardPresent = false,
  isInternational = false,
  billingShippingMismatch = false,
  pastDisputeCount = 0,
  amount = 0,
} = {}) {
  let score = 0.05; // 5% baseline e-commerce risk

  // 1. Channel risk
  if (!isCardPresent) {
    score += 0.15; // CNP transactions carry inherently higher dispute exposure
  }

  // 2. Cross-border risk
  if (isInternational) {
    score += 0.12;
  }

  // 3. Address verification (AVS) mismatch
  if (billingShippingMismatch) {
    score += 0.25;
  }

  // 4. Past dispute track record
  const disputes = Math.max(0, Number(pastDisputeCount) || 0);
  if (disputes > 0) {
    score += Math.min(0.35, disputes * 0.15);
  }

  // 5. High-ticket liability factor
  const numAmount = Number(amount) || 0;
  if (numAmount > 1000) {
    score += 0.1;
  } else if (numAmount > 500) {
    score += 0.05;
  }

  // Clamp probability to [0.01, 0.99]
  const probability = Math.min(0.99, Math.max(0.01, Number(score.toFixed(2))));

  return {
    chargebackProbability: probability,
    riskBand: probability >= 0.6 ? 'HIGH' : probability >= 0.3 ? 'MEDIUM' : 'LOW',
    requires3DSecure: probability >= 0.3,
  };
}
