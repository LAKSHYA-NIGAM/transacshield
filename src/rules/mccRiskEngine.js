/**
 * TransacShield Merchant Category Code (MCC) Risk Engine
 * Maps standard ISO-18245 MCC codes to industry risk tiers, identifying high-risk categories
 * (gambling, wire transfers, crypto, adult entertainment) and calculating MCC risk score.
 */

export const MCC_REGISTRY = {
  // High-Risk Tiers (score >= 80)
  '7995': { name: 'Betting & Gambling', riskTier: 'HIGH', riskScore: 90 },
  '6051': { name: 'Quasi-Cash & Crypto Exchanges', riskTier: 'HIGH', riskScore: 85 },
  '4829': { name: 'Wire Transfer Money Orders', riskTier: 'HIGH', riskScore: 85 },
  '5967': { name: 'Direct Marketing - Inbound Telemarketing', riskTier: 'HIGH', riskScore: 80 },

  // Medium-Risk Tiers (score 40 - 70)
  '5732': { name: 'Consumer Electronics Stores', riskTier: 'MEDIUM', riskScore: 50 },
  '5944': { name: 'Jewelry and Watch Stores', riskTier: 'MEDIUM', riskScore: 60 },
  '5511': { name: 'Car and Truck Dealers', riskTier: 'MEDIUM', riskScore: 45 },

  // Low-Risk Tiers (score < 40)
  '5411': { name: 'Grocery Stores and Supermarkets', riskTier: 'LOW', riskScore: 10 },
  '5814': { name: 'Fast Food Restaurants', riskTier: 'LOW', riskScore: 15 },
  '5912': { name: 'Drug Stores and Pharmacies', riskTier: 'LOW', riskScore: 10 },
};

export function evaluateMccRisk(mccCode) {
  const code = String(mccCode || '').trim();
  const entry = MCC_REGISTRY[code];

  if (!entry) {
    return {
      mcc: code,
      name: 'Unclassified Category',
      riskTier: 'MEDIUM',
      riskScore: 40,
      isHighRisk: false,
    };
  }

  return {
    mcc: code,
    name: entry.name,
    riskTier: entry.riskTier,
    riskScore: entry.riskScore,
    isHighRisk: entry.riskTier === 'HIGH',
  };
}
