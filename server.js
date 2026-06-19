const express = require('express');
const cors = require('cors');
const compression = require('compression');
const Database = require('better-sqlite3');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const app = express();
const PORT = 3001;

// Middlewares
app.use(cors({
  origin: [
    'http://localhost:8085',
    'https://transacshield.vercel.app',
    'https://transacshield-production.up.railway.app'
  ]
}));
app.use(compression());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve static frontend files from the root directory
app.use(express.static(__dirname));

// Initialize SQLite Database
const db = new Database('transacshield.db');
db.pragma('foreign_keys = ON'); // Enable foreign key constraints for cascade delete

// Database Schema Initialization
db.exec(`
  CREATE TABLE IF NOT EXISTS validation_runs (
    id TEXT PRIMARY KEY,
    filename TEXT,
    file_size_bytes INTEGER,
    total_rows INTEGER,
    valid_rows INTEGER,
    invalid_rows INTEGER,
    warning_count INTEGER,
    error_count INTEGER,
    phone_issue_rows INTEGER,
    date_issue_rows INTEGER,
    duplicate_rows INTEGER,
    data_quality_score REAL,
    processing_time_ms INTEGER,
    country_rule TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS validation_errors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id TEXT,
    row_number INTEGER,
    column_name TEXT,
    severity TEXT,
    error_code TEXT,
    message TEXT,
    invalid_value TEXT,
    suggested_fix TEXT,
    FOREIGN KEY(run_id) REFERENCES validation_runs(id) ON DELETE CASCADE
  );
`);

// Prepared Statements
const insertRun = db.prepare(`
  INSERT INTO validation_runs (
    id, filename, file_size_bytes, total_rows, valid_rows, invalid_rows,
    warning_count, error_count, phone_issue_rows, date_issue_rows,
    duplicate_rows, data_quality_score, processing_time_ms, country_rule
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const insertError = db.prepare(`
  INSERT INTO validation_errors (
    run_id, row_number, column_name, severity, error_code, message, invalid_value, suggested_fix
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
`);

// ═══════════════════════════════════════════
// API ROUTES
// ═══════════════════════════════════════════

// 1. POST /api/runs — Saves a validation run summary and error details
app.post('/api/runs', (req, res) => {
  const { filename, fileSizeBytes, summary, processingTimeMs, countryRule, issues } = req.body;
  
  if (!filename || !summary) {
    return res.status(400).json({ error: 'Missing required validation fields.' });
  }

  const runId = uuidv4();
  const score = summary.totalRows > 0 ? (summary.validRows / summary.totalRows) * 100 : 0;

  // Insert within database transaction to guarantee atomicity
  const saveTransaction = db.transaction(() => {
    insertRun.run(
      runId,
      filename,
      fileSizeBytes || 0,
      summary.totalRows || 0,
      summary.validRows || 0,
      summary.invalidRows || 0,
      summary.warningCount || 0,
      summary.errorCount || 0,
      summary.phoneIssueRows || 0,
      summary.dateIssueRows || 0,
      summary.duplicateRows || 0,
      score,
      processingTimeMs || 0,
      countryRule || 'GLOBAL'
    );

    if (issues && issues.length > 0) {
      for (const issue of issues) {
        insertError.run(
          runId,
          issue.row || 0,
          issue.column || 'General',
          issue.severity || 'ERROR',
          issue.errorCode || 'UNKNOWN',
          issue.type || issue.message || 'Validation error',
          issue.value !== undefined ? String(issue.value) : 'EMPTY',
          issue.suggestedFix || ''
        );
      }
    }
  });

  try {
    saveTransaction();
    res.json({ success: true, runId });
  } catch (err) {
    console.error('Database save error:', err);
    res.status(500).json({ error: 'Failed to save run to history database.' });
  }
});

// 2. GET /api/runs — Returns the 50 most recent runs
app.get('/api/runs', (req, res) => {
  try {
    const rows = db.prepare(`
      SELECT * FROM validation_runs 
      ORDER BY created_at DESC 
      LIMIT 50
    `).all();
    res.json(rows);
  } catch (err) {
    console.error('Database select error:', err);
    res.status(500).json({ error: 'Failed to retrieve validation history.' });
  }
});

// 3. GET /api/runs/:id — Returns a full run with grouped errors
app.get('/api/runs/:id', (req, res) => {
  const { id } = req.params;
  try {
    const run = db.prepare('SELECT * FROM validation_runs WHERE id = ?').get(id);
    if (!run) {
      return res.status(404).json({ error: 'Validation run not found.' });
    }

    const errors = db.prepare('SELECT * FROM validation_errors WHERE run_id = ?').all(id);
    const errorsGrouped = {};
    errors.forEach(err => {
      const col = err.column_name || 'General';
      if (!errorsGrouped[col]) {
        errorsGrouped[col] = [];
      }
      errorsGrouped[col].push({
        row: err.row_number,
        column: err.column_name,
        severity: err.severity,
        errorCode: err.error_code,
        type: err.message,
        value: err.invalid_value,
        suggestedFix: err.suggested_fix
      });
    });

    res.json({ ...run, errors: errorsGrouped });
  } catch (err) {
    console.error('Database select detail error:', err);
    res.status(500).json({ error: 'Failed to retrieve validation run details.' });
  }
});

// 4. DELETE /api/runs/:id — Deletes validation run (errors cascade delete)
app.delete('/api/runs/:id', (req, res) => {
  const { id } = req.params;
  try {
    db.prepare('DELETE FROM validation_runs WHERE id = ?').run(id);
    res.json({ success: true });
  } catch (err) {
    console.error('Database delete error:', err);
    res.status(500).json({ error: 'Failed to delete validation run.' });
  }
});

// 5. GET /api/stats — Returns summary analytics of all runs
app.get('/api/stats', (req, res) => {
  try {
    const runsCount = db.prepare('SELECT COUNT(*) as count FROM validation_runs').get();
    const rowsSum = db.prepare('SELECT SUM(total_rows) as sum FROM validation_runs').get();
    const avgScore = db.prepare('SELECT AVG(data_quality_score) as avg FROM validation_runs').get();

    const commonError = db.prepare(`
      SELECT error_code, COUNT(*) as count
      FROM validation_errors
      GROUP BY error_code
      ORDER BY count DESC
      LIMIT 1
    `).get();

    res.json({
      total_files_processed: runsCount.count || 0,
      total_rows_validated: rowsSum.sum || 0,
      average_quality_score: avgScore.avg || 0,
      most_common_error: commonError ? commonError.error_code : 'None'
    });
  } catch (err) {
    console.error('Database stats error:', err);
    res.status(500).json({ error: 'Failed to compute validation history statistics.' });
  }
});

// Start Server
app.listen(PORT, () => {
  console.log(`[TransacShield Backend] Running on http://localhost:${PORT}`);
});
