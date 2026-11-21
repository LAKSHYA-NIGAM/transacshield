/**
 * Geographical Impossible Travel Anomaly Detector
 * Calculates Great-Circle (Haversine) distance and speed between consecutive transactions
 * to detect impossible physical travel fraud.
 */

class GeographicalAnomalyEngine {
  constructor(options = {}) {
    // Maximum feasible human travel speed in km/h (standard commercial aircraft ~900 km/h)
    this.maxFeasibleSpeedKmh = options.maxFeasibleSpeedKmh || 900;
    // Map of accountId -> { lat, lon, timestamp, locationName }
    this.lastLocations = new Map();
  }

  /**
   * Calculates Great-Circle distance using Haversine formula in kilometers.
   */
  static haversineDistance(lat1, lon1, lat2, lon2) {
    const toRad = deg => (deg * Math.PI) / 180;
    const R = 6371; // Earth radius in kilometers

    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Evaluates if a transaction location represents impossible travel relative to prior transaction.
   * @param {Object} tx - { accountId, lat, lon, timestamp, locationName }
   * @returns {Object} - Result { isFlagged, riskScore, reason, metrics }
   */
  evaluate(tx) {
    if (!tx || !tx.accountId) {
      return { isFlagged: false, riskScore: 0, reason: 'Missing accountId' };
    }

    if (tx.lat === undefined || tx.lon === undefined) {
      return { isFlagged: false, riskScore: 0, reason: 'No geolocation coordinates provided' };
    }

    const currentLat = Number(tx.lat);
    const currentLon = Number(tx.lon);
    const currentTime = tx.timestamp !== undefined ? new Date(tx.timestamp).getTime() : Date.now();

    const previous = this.lastLocations.get(tx.accountId);

    // If no prior location, store and return clean
    if (!previous) {
      this.lastLocations.set(tx.accountId, {
        lat: currentLat,
        lon: currentLon,
        timestamp: currentTime,
        locationName: tx.locationName || 'Unknown'
      });
      return {
        isFlagged: false,
        riskScore: 0,
        reason: 'Initial location baseline established',
        metrics: { distanceKm: 0, elapsedHours: 0, speedKmh: 0 }
      };
    }

    const distanceKm = GeographicalAnomalyEngine.haversineDistance(
      previous.lat,
      previous.lon,
      currentLat,
      currentLon
    );

    const elapsedMs = Math.max(1, currentTime - previous.timestamp);
    const elapsedHours = elapsedMs / (1000 * 60 * 60);
    const speedKmh = distanceKm / elapsedHours;

    let isFlagged = false;
    let riskScore = 0;
    let reason = 'Feasible geographical trajectory';

    if (speedKmh > this.maxFeasibleSpeedKmh && distanceKm > 50) {
      isFlagged = true;
      riskScore = Math.min(100, Math.round(50 + (speedKmh / this.maxFeasibleSpeedKmh) * 25));
      reason = `Impossible travel detected: ${distanceKm.toFixed(1)} km in ${(elapsedHours * 60).toFixed(1)} min (${speedKmh.toFixed(0)} km/h exceeds ${this.maxFeasibleSpeedKmh} km/h threshold)`;
    }

    // Update latest location
    this.lastLocations.set(tx.accountId, {
      lat: currentLat,
      lon: currentLon,
      timestamp: currentTime,
      locationName: tx.locationName || 'Unknown'
    });

    return {
      isFlagged,
      riskScore,
      reason,
      metrics: {
        distanceKm: Math.round(distanceKm * 10) / 10,
        elapsedHours: Math.round(elapsedHours * 100) / 100,
        speedKmh: Math.round(speedKmh)
      }
    };
  }

  reset() {
    this.lastLocations.clear();
  }
}

module.exports = GeographicalAnomalyEngine;
