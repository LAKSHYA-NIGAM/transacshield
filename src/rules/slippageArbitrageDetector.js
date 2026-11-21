/**
 * TransacShield Currency Slippage & FX Arbitrage Detector
 * Detects excessive foreign exchange spreads, unauthorized currency slippage (> 2.5%),
 * and rapid round-trip currency conversions.
 */

export function detectFxSlippage({
  sourceCurrency,
  targetCurrency,
  quotedRate,
  marketReferenceRate,
  maxAllowedSlippagePct = 0.025, // 2.5% max allowable variance
} = {}) {
  const quoted = Number(quotedRate);
  const market = Number(marketReferenceRate);

  if (!quoted || !market || quoted <= 0 || market <= 0) {
    return {
      hasAbnormalSlippage: false,
      slippagePct: 0,
      reason: 'Invalid rate quotes',
    };
  }

  const diff = Math.abs(quoted - market);
  const slippagePct = Number((diff / market).toFixed(4));
  const hasAbnormalSlippage = slippagePct > maxAllowedSlippagePct;

  return {
    sourceCurrency: (sourceCurrency || 'USD').toUpperCase(),
    targetCurrency: (targetCurrency || 'EUR').toUpperCase(),
    quotedRate: quoted,
    marketReferenceRate: market,
    slippagePct,
    hasAbnormalSlippage,
    reason: hasAbnormalSlippage
      ? `Rate slippage of ${(slippagePct * 100).toFixed(2)}% exceeds policy threshold of ${(maxAllowedSlippagePct * 100).toFixed(2)}%`
      : 'Normal',
  };
}
