# TransacShield — High-Throughput Transaction Validation & Normalization Engine 🛡️

[![CI](https://github.com/LAKSHYA-NIGAM/transacshield/actions/workflows/ci.yml/badge.svg)](https://github.com/LAKSHYA-NIGAM/transacshield/actions/workflows/ci.yml)
[![Node Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen.svg)](https://nodejs.org/)
[![Database](https://img.shields.io/badge/database-SQLite3-blue.svg)](https://www.sqlite.org/)
[![License: ISC](https://img.shields.io/badge/License-ISC-blue.svg)](LICENSE)

TransacShield is a high-performance transaction data ingestion, validation, and normalization platform built to process CSV datasets with strict schema enforcement, multi-country phone and currency normalization, calendar-accurate date parsing, duplicate order detection, and persistent audit logging via SQLite.

---

## 🎯 Problem Statement

Financial and e-commerce transactions ingested from external vendors or legacy systems frequently contain malformed data:
- Inconsistent phone formatting across countries (`+91`, `91`, leading `0`, punctuation).
- Unescaped currency symbols (`$`, `€`, `₹`) and thousand separators causing numeric coercion failures.
- Impossible calendar dates (e.g. `2024-02-31` or non-leap-year February 29ths).
- Duplicate transaction pairs (`order_id` + `product_id`) leading to double-billing.

TransacShield solves this with a **zero-dependency, pure-function validation engine** that validates rows without short-circuiting, collecting granular row/column error diagnostics with suggested automated fixes.

---

## 🏗️ Architecture & Processing Lifecycle

```
[ Uploaded CSV File ]
         │
         ▼
[ Ingestion & Header Guesser ] ─── (Infers types: Phone, Email, Amount, Date, Mode)
         │
         ▼
[ TransacValidationEngine ] ────── Pure Function Normalizers & Rule Maps
         │                           ├── Phone Normalization (IN, SG, US, UK, Global)
         │                           ├── Currency / Amount Strip & Format
         │                           ├── ISO / Calendar Boundary Date Validator
         │                           └── Duplicate ID & Pair Detection
         ▼
[ Aggregated Results & Scoring ]
         │
         ├───► Cleaned Rows (Normalized Output)
         ├───► Diagnostics & Suggested Fixes (Row/Col errors)
         └───► SQLite Audit Run Log (Persisted validation history)
```

---

## 🌟 Key Features

1. **Pure Function Architecture:** Core business rules in `validation.js` are decoupled from I/O and UI, enabling execution in both browser frontends and backend Node.js services.
2. **Multi-Region Phone Rules:** Normalizes international phone formats with prefix stripping for India (`+91`), Singapore (`+65`), United States (`+1`), United Kingdom (`+44`), and E.164 Global format.
3. **Robust Date & Calendar Verification:** Evaluates calendar boundaries across 5 date-time formats including leap-year February rules and day-count checks for 30-day months.
4. **Duplicate Detection:** In-memory `Set` lookups track duplicate order IDs and composite `order_id` + `product_id` keys in $O(1)$ time per row.
5. **Quality Score Calculation:** Computes an aggregate data health index ($0-100\%$) weighting errors, warnings, and unresolvable formats.
6. **Persistent SQLite Audit Storage:** Tracks history runs, error distributions, and overall quality scores across uploaded batches.
7. **Production Express Backend:** Equipped with `/api/health`, Gzip compression, CORS whitelisting, and centralized error handling middleware.

---


---

## ⚡ Real-Time Fraud & Anomaly Detection Rules

In addition to schema validation, TransacShield provides a modular fraud detection rule suite in `src/rules/`:

1. **Velocity Check Engine (`src/rules/velocityCheck.js`)**:
   - Implements sliding-window frequency and cumulative volume monitoring per account.
   - Flags rapid micro-transaction bursts and sudden volume spikes within sub-minute intervals.

2. **Geographical Impossible Travel Anomaly Detector (`src/rules/geographicalAnomaly.js`)**:
   - Calculates Great-Circle distance via Haversine formula between consecutive geolocation coordinates.
   - Flags physically impossible travel velocities (e.g. transactions across continents within minutes exceeding commercial airline speeds).

3. **Sanctions & Blacklist Screening (`src/rules/blacklistRule.js`)**:
   - Screen transactions against sanctioned jurisdictions (ISO-3166-1 alpha-2), flagged BIN ranges, and compromised account/email sets in $O(1)$ time.

## 🔌 API Reference

### Health Check
`GET /api/health`
Returns system health, server uptime, and database connectivity.
```json
{
  "status": "healthy",
  "uptime_seconds": 124,
  "timestamp": "2026-11-21T08:00:00.000Z",
  "database": "connected"
}
```

### Save Validation Run
`POST /api/runs`
Persists a completed CSV validation run into SQLite.
- **Payload:** File metadata, row counts, data quality score, error summary array.
- **Response:** `201 Created` with generated run UUID.

### Fetch Run History
`GET /api/runs`
Returns paginated list of past validation runs.

### Fetch Run Details
`GET /api/runs/:id`
Returns full diagnostic errors and warnings for a specific validation run.

### Global Aggregate Statistics
`GET /api/stats`
Returns total files processed, total rows validated, and the most common validation error across all uploads.

---

## 🚀 Getting Started

### Prerequisites
- Node.js v18.0.0 or higher
- npm

### Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/LAKSHYA-NIGAM/transacshield.git
   cd transacshield
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the backend server:
   ```bash
   npm start
   ```
   Server starts at `http://localhost:3001`.

---

## 🧪 Running Automated Tests

TransacShield uses Node.js native test runner (`node:test`) for zero-overhead unit testing:

```bash
npm test
```

### Test Coverage Highlights
- ✅ **Trim & Normalization:** Whitespace stripping, null-safe string coercions, lowercase RFC emails.
- ✅ **Phone Rules:** Country prefix stripping and digit count verification across `IN`, `SG`, `US`, `UK`.
- ✅ **Calendar Boundaries:** Leap-year logic, February 29th boundary checks, and 30-day month limits.
- ✅ **Dataset Validator:** Multi-row batch processing, deduplication, and quality score computation.
- ✅ **Header Type Guesser:** Automatic semantic type inference across arbitrary CSV column headers.

---

## 📄 License
This project is licensed under the ISC License.
