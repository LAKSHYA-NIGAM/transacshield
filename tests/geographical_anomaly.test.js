const { test, describe, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const GeographicalAnomalyEngine = require('../src/rules/geographicalAnomaly');

describe('GeographicalAnomalyEngine Rule Tests', () => {
  let engine;

  beforeEach(() => {
    engine = new GeographicalAnomalyEngine({ maxFeasibleSpeedKmh: 800 });
  });

  test('correctly calculates Haversine distance between London and Paris', () => {
    // London: (51.5074, -0.1278), Paris: (48.8566, 2.3522) ~ 343 km
    const dist = GeographicalAnomalyEngine.haversineDistance(51.5074, -0.1278, 48.8566, 2.3522);
    assert.ok(dist >= 340 && dist <= 346, `Expected ~343km, got ${dist}`);
  });

  test('allows normal travel over reasonable duration', () => {
    // Baseline in London at t = 0
    engine.evaluate({
      accountId: 'usr_uk',
      lat: 51.5074,
      lon: -0.1278,
      timestamp: 0,
      locationName: 'London'
    });

    // Transaction in Paris 2 hours later (~343 km in 2h = ~171 km/h by Eurostar/plane)
    const res = engine.evaluate({
      accountId: 'usr_uk',
      lat: 48.8566,
      lon: 2.3522,
      timestamp: 2 * 3600 * 1000,
      locationName: 'Paris'
    });

    assert.equal(res.isFlagged, false);
    assert.equal(res.riskScore, 0);
    assert.ok(res.metrics.speedKmh < 800);
  });

  test('flags impossible travel across continents within 10 minutes', () => {
    // Transaction in New York (40.7128, -74.0060) at t = 0
    engine.evaluate({
      accountId: 'usr_impossible',
      lat: 40.7128,
      lon: -74.0060,
      timestamp: 0,
      locationName: 'New York'
    });

    // Transaction in Tokyo (35.6762, 139.6503) 10 minutes later (~10,850 km away!)
    const res = engine.evaluate({
      accountId: 'usr_impossible',
      lat: 35.6762,
      lon: 139.6503,
      timestamp: 10 * 60 * 1000,
      locationName: 'Tokyo'
    });

    assert.equal(res.isFlagged, true);
    assert.ok(res.riskScore >= 75);
    assert.match(res.reason, /Impossible travel detected/);
    assert.ok(res.metrics.speedKmh > 10000);
  });

  test('safely handles missing coordinates or accountId', () => {
    const resNoCoords = engine.evaluate({ accountId: 'usr_test' });
    assert.equal(resNoCoords.isFlagged, false);
    assert.match(resNoCoords.reason, /No geolocation/);

    const resNoAcc = engine.evaluate(null);
    assert.equal(resNoAcc.isFlagged, false);
  });
});
