/**
 * TransacShield - Frontend Application Controller
 * 
 * Coordinates file upload, configuration updates, validation execution,
 * tabular data rendering, and file downloading/chunking operations.
 */

(function () {
  'use strict';

  // ==========================================
  // STATE MANAGEMENT
  // ==========================================
  const state = {
    file: null,
    rawHeaders: [],
    rawRows: [], // Array of objects parsed directly from the CSV
    mappings: {
      order_id: '',
      product_id: '',
      phone: '',
      country: '',
      datetime: '',
      payment_mode: '',
      amount: ''
    },
    config: {
      countryPhoneRule: 'IN',
      dateFormatRule: 'AUTO',
      allowedPaymentModes: [],
      chunkSize: 1000
    },
    validationResults: {
      errors: [],        // Row-level errors
      warnings: [],      // Row-level warnings (e.g. duplicates)
      normalizedRows: [] // All rows processed and normalized
    },
    columnTypes: {}, // Stores detected type guesses
    cleanedRows: [],     // Valid normalized rows (0 errors)
    filteredErrors: [],  // Errors list after search / filters
    activeTab: 'preview' // 'preview' or 'errors'
  };

  // ==========================================
  // DOM ELEMENT SELECTORS
  // ==========================================
  const elements = {
    // Configuration
    configForm: document.getElementById('config-form'),
    countryPhoneRule: document.getElementById('country-phone-rule'),
    dateFormatRule: document.getElementById('date-format-rule'),
    paymentModesRule: document.getElementById('payment-modes-rule'),
    chunkSizeRule: document.getElementById('chunk-size-rule'),
    
    // Custom mappings
    mapOrderId: document.getElementById('map-order-id'),
    mapProductId: document.getElementById('map-product-id'),
    mapPhone: document.getElementById('map-phone'),
    mapCountry: document.getElementById('map-country'),
    mapDatetime: document.getElementById('map-datetime'),
    mapAmount: document.getElementById('map-amount'),
    mapPayment: document.getElementById('map-payment'),

    // Guess badges
    guessOrderId: document.getElementById('guess-order-id'),
    guessProductId: document.getElementById('guess-product-id'),
    guessPhone: document.getElementById('guess-phone'),
    guessCountry: document.getElementById('guess-country'),
    guessDatetime: document.getElementById('guess-datetime'),
    guessPayment: document.getElementById('guess-payment'),
    guessAmount: document.getElementById('guess-amount'),

    // Warning and bypass
    mappingWarningCard: document.getElementById('mapping-warning-card'),
    bypassRequiredCheck: document.getElementById('bypass-required-check'),

    // Raw Preview
    rawPreviewHeaderRow: document.getElementById('raw-preview-header-row'),
    rawPreviewBodyRows: document.getElementById('raw-preview-body-rows'),

    // Upload
    dropZone: document.getElementById('drop-zone'),
    demoLoaderContainer: document.getElementById('demo-loader-container'),
    fileInput: document.getElementById('file-input'),
    fileInfo: document.getElementById('file-info'),
    fileName: document.getElementById('file-name'),
    fileSize: document.getElementById('file-size'),
    btnReset: document.getElementById('btn-reset'),
    btnLoadSample: document.getElementById('btn-load-sample'),
    uploadError: document.getElementById('upload-error'),
    uploadErrorText: document.getElementById('upload-error-text'),
    infoRowCount: document.getElementById('info-row-count'),
    infoHeaders: document.getElementById('info-headers'),
    btnValidateOnly: document.getElementById('btn-validate-only'),
    btnValidateGenerate: document.getElementById('btn-validate-generate'),
    downloadLockedBanner: document.getElementById('download-locked-banner'),
    
    // Progress
    parsingProgressContainer: document.getElementById('parsing-progress-container'),
    progressStatus: document.getElementById('progress-status'),
    progressPercent: document.getElementById('progress-percent'),
    progressBarFill: document.getElementById('progress-bar-fill'),

    // Dashboard
    dashboardSection: document.getElementById('dashboard-section'),
    
    // Summary metrics
    statTotal: document.getElementById('stat-val-total'),
    statValid: document.getElementById('stat-val-valid'),
    statInvalid: document.getElementById('stat-val-invalid'),
    statWarnings: document.getElementById('stat-val-warnings'),

    // Actions
    btnDownloadCleaned: document.getElementById('btn-download-cleaned'),
    btnDownloadReport: document.getElementById('btn-download-report'),
    chunkDisplayCount: document.getElementById('chunk-display-count'),
    chunkStatusMsg: document.getElementById('chunk-status-msg'),
    chunkButtonsContainer: document.getElementById('chunk-buttons-container'),

    // Tabs
    tabBtnPreview: document.getElementById('tab-btn-preview'),
    tabBtnErrors: document.getElementById('tab-btn-errors'),
    tabContentPreview: document.getElementById('tab-content-preview'),
    tabContentErrors: document.getElementById('tab-content-errors'),
    errorTabCount: document.getElementById('error-tab-count'),

    // Preview table
    previewTableHeader: document.getElementById('preview-table-header'),
    previewTableBody: document.getElementById('preview-table-body'),
    previewEmptyMsg: document.getElementById('preview-empty-msg'),

    // Errors table
    errorSearch: document.getElementById('error-search'),
    errorFilter: document.getElementById('error-filter'),
    errorColumnFilter: document.getElementById('error-column-filter'),
    errorsTableBody: document.getElementById('errors-table-body'),
    errorsEmptyMsg: document.getElementById('errors-empty-msg'),
    errorsCapMsg: document.getElementById('errors-cap-msg'),
    errorsTotalCount: document.getElementById('errors-total-count'),
    noValidRowsMsg: document.getElementById('no-valid-rows-msg')
  };

  // ==========================================
  // DEMO DATA LOADER
  // ==========================================
  function loadSampleData() {
    elements.parsingProgressContainer.classList.remove('hidden');
    updateProgress('Fetching sample dataset...', 20);
    
    fetch('sample_transactions.csv')
      .then(response => {
        if (!response.ok) {
          throw new Error('Network response was not ok');
        }
        return response.text();
      })
      .then(text => {
        updateProgress('Parsing sample records...', 60);
        Papa.parse(text, {
          header: true,
          skipEmptyLines: 'greedy',
          complete: function (results) {
            updateProgress('Sample loaded.', 100);
            setTimeout(() => {
              elements.parsingProgressContainer.classList.add('hidden');
              state.file = { name: 'sample_transactions.csv', size: text.length };
              
              elements.fileName.textContent = state.file.name;
              elements.fileSize.textContent = formatBytes(state.file.size);
              
              state.rawHeaders = results.meta.fields || [];
              state.rawRows = results.data || [];

              // Guess Column Types
              state.columnTypes = window.TransacValidationEngine.guessColumnTypes(state.rawRows, state.rawHeaders);

              // Populate details
              elements.infoRowCount.textContent = state.rawRows.length.toLocaleString();
              elements.infoHeaders.textContent = state.rawHeaders.join(', ');

              autoDetectColumns(state.rawHeaders);
              populateMappingDropdowns();
              updateGuessBadges();
              checkRequiredMappings();
              renderRawPreviewTable();
              
              elements.fileInfo.classList.remove('hidden');
              elements.dropZone.classList.add('hidden');
              if (elements.demoLoaderContainer) {
                elements.demoLoaderContainer.classList.add('hidden');
              }
              clearUploadError();
              
              updateConfigFromUI();
              
              elements.dashboardSection.classList.add('hidden');
            }, 300);
          },
          error: function(err) {
            elements.parsingProgressContainer.classList.add('hidden');
            showUploadError('Parsing Error: ' + err.message);
          }
        });
      })
      .catch(error => {
        elements.parsingProgressContainer.classList.add('hidden');
        showUploadError('Failed to load sample dataset: ' + error.message);
      });
  }

  // ==========================================
  // EVENT LISTENERS INITIALIZATION
  // ==========================================
  function initEvents() {
    // 1. Drag & drop listeners
    ['dragenter', 'dragover'].forEach(eventName => {
      elements.dropZone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        elements.dropZone.classList.add('dragover');
      }, false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
      elements.dropZone.addEventListener(eventName, (e) => {
        e.preventDefault();
        e.stopPropagation();
        elements.dropZone.classList.remove('dragover');
      }, false);
    });

    elements.dropZone.addEventListener('drop', (e) => {
      const dt = e.dataTransfer;
      const files = dt.files;
      if (files && files.length > 0) {
        handleFile(files[0]);
      }
    }, false);

    // 2. Browse file fallback
    elements.fileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files.length > 0) {
        handleFile(e.target.files[0]);
      }
    });

    // 3. Clear file selection
    elements.btnReset.addEventListener('click', resetDashboard);

    // 4. Config changes re-trigger validation automatically (only if validated already)
    const retriggerInputs = [
      elements.countryPhoneRule,
      elements.dateFormatRule,
      elements.paymentModesRule,
      elements.chunkSizeRule,
      elements.mapOrderId,
      elements.mapProductId,
      elements.mapPhone,
      elements.mapCountry,
      elements.mapDatetime,
      elements.mapAmount,
      elements.mapPayment
    ];

    retriggerInputs.forEach(input => {
      input.addEventListener('change', () => {
        updateConfigFromUI();
        if (state.rawRows.length > 0 && !elements.dashboardSection.classList.contains('hidden')) {
          runValidation();
        }
      });
      // Also allow text inputs to trigger on keyup/blur
      if (input.tagName === 'INPUT') {
        input.addEventListener('blur', () => {
          updateConfigFromUI();
          if (state.rawRows.length > 0 && !elements.dashboardSection.classList.contains('hidden')) {
            runValidation();
          }
        });
      }
    });

    // 5. Tabs navigation
    elements.tabBtnPreview.addEventListener('click', () => switchTab('preview'));
    elements.tabBtnErrors.addEventListener('click', () => switchTab('errors'));

    // 6. Search & Filters for errors table
    elements.errorSearch.addEventListener('input', (e) => {
      state.errorSearchQuery = e.target.value;
      renderErrorTable();
    });
    elements.errorFilter.addEventListener('change', (e) => {
      state.errorFilterSeverity = e.target.value;
      renderErrorTable();
    });
    elements.errorColumnFilter.addEventListener('change', (e) => {
      state.errorFilterColumn = e.target.value;
      renderErrorTable();
    });

    // 7. Downloads
    elements.btnDownloadCleaned.addEventListener('click', downloadCleanedCSV);
    elements.btnDownloadReport.addEventListener('click', downloadValidationReport);

    // 8. Demo Loader
    elements.btnLoadSample.addEventListener('click', loadSampleData);

    // 9. Validation Triggers
    elements.btnValidateOnly.addEventListener('click', () => handleValidationTrigger(true));
    elements.btnValidateGenerate.addEventListener('click', () => handleValidationTrigger(false));

    // 10. Central Column Mapping change handlers
    const mappingSelects = [
      { element: elements.mapOrderId, field: 'order_id' },
      { element: elements.mapProductId, field: 'product_id' },
      { element: elements.mapPhone, field: 'phone' },
      { element: elements.mapCountry, field: 'country' },
      { element: elements.mapDatetime, field: 'datetime' },
      { element: elements.mapPayment, field: 'payment_mode' },
      { element: elements.mapAmount, field: 'amount' }
    ];

    mappingSelects.forEach(mapping => {
      mapping.element.addEventListener('change', () => {
        state.mappings[mapping.field] = mapping.element.value;
        updateGuessBadges();
        checkRequiredMappings();
        
        // Re-run validation automatically if dashboard is active
        if (state.rawRows.length > 0 && !elements.dashboardSection.classList.contains('hidden')) {
          runValidation();
        }
      });
    });

    elements.bypassRequiredCheck.addEventListener('change', () => {
      checkRequiredMappings();
    });
  }

  // ==========================================
  // CONTROL LOGIC
  // ==========================================

  /**
   * Reads and parses config options from the UI.
   */
  function updateConfigFromUI() {
    state.config.countryPhoneRule = elements.countryPhoneRule.value;
    state.config.dateFormatRule = elements.dateFormatRule.value;
    
    // Parse payment modes list
    const modesString = elements.paymentModesRule.value || '';
    state.config.allowedPaymentModes = modesString.split(',').map(m => m.trim()).filter(m => m.length > 0);
    
    // Parse chunk size limit
    state.config.chunkSize = parseInt(elements.chunkSizeRule.value) || 5000;
    elements.chunkDisplayCount.textContent = state.config.chunkSize;

    // Load mappings
    state.mappings.order_id = elements.mapOrderId.value;
    state.mappings.product_id = elements.mapProductId.value;
    state.mappings.phone = elements.mapPhone.value;
    state.mappings.country = elements.mapCountry.value;
    state.mappings.datetime = elements.mapDatetime.value;
    state.mappings.payment_mode = elements.mapPayment.value;
    state.mappings.amount = elements.mapAmount.value;
  }

  /**
   * Processes the uploaded file: checks constraints and loads PapaParse.
   */
  function showUploadError(msg) {
    elements.uploadErrorText.textContent = msg;
    elements.uploadError.classList.remove('hidden');
  }

  function clearUploadError() {
    elements.uploadError.classList.add('hidden');
  }

  function handleFile(file) {
    if (!file) return;
    clearUploadError();

    // Check extension
    const extension = file.name.split('.').pop().toLowerCase();
    if (extension !== 'csv') {
      showUploadError('Error: Invalid file format. Please upload a CSV file.');
      return;
    }

    // Check size limit: 50MB
    const maxSize = 50 * 1024 * 1024;
    if (file.size > maxSize) {
      showUploadError('Error: File is too large. The maximum supported size is 50MB.');
      return;
    }

    state.file = file;

    // Reset progress and display parsing container
    elements.parsingProgressContainer.classList.remove('hidden');
    updateProgress('Reading file...', 10);

    parseCSV(file);
  }

  /**
   * Invokes PapaParse client-side to read the CSV file in memory.
   */
  function parseCSV(file) {
    updateProgress('Parsing CSV records...', 30);

    Papa.parse(file, {
      header: true,
      skipEmptyLines: 'greedy',
      encoding: 'UTF-8',
      complete: function (results) {
        updateProgress('File loaded successfully.', 100);
        
        setTimeout(() => {
          elements.parsingProgressContainer.classList.add('hidden');
          
          state.rawHeaders = results.meta.fields || [];
          state.rawRows = results.data || [];

          if (state.rawRows.length === 0) {
            showUploadError('Warning: The CSV file appears to be empty or lacks correct tabular columns.');
            resetDashboard();
            return;
          }

          // Guess Column Types
          state.columnTypes = window.TransacValidationEngine.guessColumnTypes(state.rawRows, state.rawHeaders);

          // Populate details inside info card
          elements.fileName.textContent = file.name;
          elements.fileSize.textContent = formatBytes(file.size);
          elements.infoRowCount.textContent = state.rawRows.length.toLocaleString();
          if (elements.infoHeaders) {
            elements.infoHeaders.textContent = state.rawHeaders.join(', ');
          }

          // Trigger header mapper auto-detection
          autoDetectColumns(state.rawHeaders);

          // Populate selectors and guess badges
          populateMappingDropdowns();
          updateGuessBadges();
          checkRequiredMappings();

          // Render raw preview table
          renderRawPreviewTable();

          elements.fileInfo.classList.remove('hidden');
          elements.dropZone.classList.add('hidden');
          if (elements.demoLoaderContainer) {
            elements.demoLoaderContainer.classList.add('hidden');
          }
          clearUploadError();

          // Pull config
          updateConfigFromUI();
          
          // Hide dashboard until validated
          elements.dashboardSection.classList.add('hidden');
        }, 300);
      },
      error: function (error) {
        elements.parsingProgressContainer.classList.add('hidden');
        showUploadError('Parsing Error: ' + error.message);
        resetDashboard();
      }
    });
  }

  /**
   * Executes validation flow based on user's selected mode trigger.
   */
  function handleValidationTrigger(isValidateOnly) {
    if (state.rawRows.length === 0) return;

    // Run core validation
    runValidation();

    if (isValidateOnly) {
      // Show locked warning banner
      elements.downloadLockedBanner.classList.remove('hidden');
      
      // Disable downloads
      elements.btnDownloadCleaned.disabled = true;
      elements.btnDownloadReport.disabled = true;
      
      // Disable chunking display
      elements.chunkStatusMsg.textContent = 'Exports are locked. Run "Validate and generate cleaned output" to generate chunks.';
      elements.chunkStatusMsg.classList.remove('hidden');
      elements.chunkButtonsContainer.innerHTML = '';
    } else {
      // Hide locked warning banner
      elements.downloadLockedBanner.classList.add('hidden');
      
      // Enable downloads
      elements.btnDownloadCleaned.disabled = false;
      elements.btnDownloadReport.disabled = false;
      
      // Re-trigger chunk output generation
      generateChunks();
    }

    // Reveal dashboard
    elements.dashboardSection.classList.remove('hidden');
  }

  /**
   * Helper to format bytes cleanly (e.g. KB, MB).
   */
  function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  /**
   * Updates parsing progress UI elements.
   */
  function updateProgress(status, percentage) {
    elements.progressStatus.textContent = status;
    elements.progressPercent.textContent = `${percentage}%`;
    elements.progressBarFill.style.width = `${percentage}%`;
  }

  /**
   * Auto-detects columns based on list of common CSV headers.
   */
  function autoDetectColumns(headers) {
    const findMatch = (options) => {
      for (const option of options) {
        const match = headers.find(h => h.trim().toLowerCase() === option.toLowerCase());
        if (match) return match;
      }
      return '';
    };

    // Define dictionary of potential matches
    const mapDict = {
      order_id: ['order_id', 'orderid', 'order', 'ordid', 'txid', 'transaction_id', 'transactionid', 'id'],
      product_id: ['product_id', 'productid', 'product', 'prodid', 'item_id', 'itemid', 'item'],
      phone: ['phone', 'phone_number', 'phonenumber', 'mobile', 'contact', 'customer_phone', 'customer_mobile'],
      country: ['country', 'country_code', 'countrycode', 'nation', 'region'],
      datetime: ['date', 'timestamp', 'time', 'created_at', 'order_date', 'datetime', 'date_time', 'time_stamp'],
      amount: ['amount', 'price', 'total', 'value', 'order_amount', 'cost', 'sales'],
      payment_mode: ['payment_mode', 'paymentmode', 'payment_method', 'paymentmethod', 'payment', 'mode', 'method', 'pay_mode']
    };

    // Assign mapped fields
    state.mappings.order_id = findMatch(mapDict.order_id) || headers[0] || '';
    state.mappings.product_id = findMatch(mapDict.product_id) || '';
    state.mappings.phone = findMatch(mapDict.phone) || '';
    state.mappings.country = findMatch(mapDict.country) || '';
    state.mappings.datetime = findMatch(mapDict.datetime) || findMatch(['date', 'time']) || '';
    state.mappings.amount = findMatch(mapDict.amount) || '';
    
    // Avoid double mapping the order_id if product_id fell back to headers[0]
    if (state.mappings.product_id === state.mappings.order_id) {
      state.mappings.product_id = '';
    }

    state.mappings.payment_mode = findMatch(mapDict.payment_mode) || '';
  }

  /**
   * Populates the mapping dropdown selects with CSV headers options.
   */
  function populateMappingDropdowns() {
    const mappingSelects = [
      elements.mapOrderId,
      elements.mapProductId,
      elements.mapPhone,
      elements.mapCountry,
      elements.mapDatetime,
      elements.mapPayment,
      elements.mapAmount
    ];

    mappingSelects.forEach(select => {
      // Clear options
      select.innerHTML = '';
      
      // Default skip option
      const defaultOpt = document.createElement('option');
      defaultOpt.value = '';
      defaultOpt.textContent = '-- Skip Column --';
      select.appendChild(defaultOpt);

      // Populate headers
      state.rawHeaders.forEach(header => {
        const opt = document.createElement('option');
        opt.value = header;
        opt.textContent = header;
        select.appendChild(opt);
      });
    });

    // Select auto-detected fields
    elements.mapOrderId.value = state.mappings.order_id;
    elements.mapProductId.value = state.mappings.product_id;
    elements.mapPhone.value = state.mappings.phone;
    elements.mapCountry.value = state.mappings.country;
    elements.mapDatetime.value = state.mappings.datetime;
    elements.mapPayment.value = state.mappings.payment_mode;
    elements.mapAmount.value = state.mappings.amount;
  }

  /**
   * Updates the inline guess badges showing data types.
   */
  function updateGuessBadges() {
    const fields = [
      { select: elements.mapOrderId, badge: elements.guessOrderId },
      { select: elements.mapProductId, badge: elements.guessProductId },
      { select: elements.mapPhone, badge: elements.guessPhone },
      { select: elements.mapCountry, badge: elements.guessCountry },
      { select: elements.mapDatetime, badge: elements.guessDatetime },
      { select: elements.mapPayment, badge: elements.guessPayment },
      { select: elements.mapAmount, badge: elements.guessAmount }
    ];

    fields.forEach(f => {
      const selectedCol = f.select.value;
      if (selectedCol) {
        const guessedType = state.columnTypes[selectedCol] || 'Text';
        f.badge.textContent = `Guessed: ${guessedType}`;
        f.badge.style.opacity = '1';
      } else {
        f.badge.textContent = 'Skipped';
        f.badge.style.opacity = '0.5';
      }
    });
  }

  /**
   * Checks mapping requirements (order_id) and locks/unlocks validate buttons.
   */
  function checkRequiredMappings() {
    const orderIdMapped = elements.mapOrderId.value !== '';
    const bypassChecked = elements.bypassRequiredCheck.checked;
    
    const warningCard = elements.mappingWarningCard;

    if (orderIdMapped) {
      warningCard.classList.add('valid-state');
      warningCard.querySelector('.mapping-warning-text').innerHTML = 
        '✅ <strong>Required fields mapped.</strong> Ready to proceed with validation.';
      elements.btnValidateOnly.disabled = false;
      elements.btnValidateGenerate.disabled = false;
    } else if (bypassChecked) {
      warningCard.classList.add('valid-state');
      warningCard.querySelector('.mapping-warning-text').innerHTML = 
        'ℹ️ <strong>Bypassed Order ID mapping.</strong> Order ID format validation will be skipped.';
      elements.btnValidateOnly.disabled = false;
      elements.btnValidateGenerate.disabled = false;
    } else {
      warningCard.classList.remove('valid-state');
      warningCard.querySelector('.mapping-warning-text').innerHTML = 
        '⚠️ <strong>Order ID mapping is required.</strong> Select a column or check the box to confirm it is missing from this file.';
      elements.btnValidateOnly.disabled = true;
      elements.btnValidateGenerate.disabled = true;
    }
  }

  /**
   * Renders the raw parsed data table preview (first 10 rows).
   */
  function renderRawPreviewTable() {
    // 1. Headers
    elements.rawPreviewHeaderRow.innerHTML = '';
    
    // Index indicator column
    const thIdx = document.createElement('th');
    thIdx.textContent = '#';
    elements.rawPreviewHeaderRow.appendChild(thIdx);

    state.rawHeaders.forEach(header => {
      const th = document.createElement('th');
      th.textContent = header;
      elements.rawPreviewHeaderRow.appendChild(th);
    });

    // 2. Body rows
    elements.rawPreviewBodyRows.innerHTML = '';
    const rowsSample = state.rawRows.slice(0, 10);
    
    rowsSample.forEach((row, idx) => {
      const tr = document.createElement('tr');
      
      const tdIdx = document.createElement('td');
      tdIdx.textContent = idx + 1;
      tdIdx.style.fontWeight = '600';
      tdIdx.style.color = 'var(--slate-500)';
      tr.appendChild(tdIdx);

      state.rawHeaders.forEach(header => {
        const td = document.createElement('td');
        const val = row[header];
        td.textContent = val !== undefined && val !== null ? val : '';
        tr.appendChild(td);
      });

      elements.rawPreviewBodyRows.appendChild(tr);
    });
  }

  /**
   * Resets application dashboard to empty initial state.
   */
  function resetDashboard() {
    state.file = null;
    state.rawHeaders = [];
    state.rawRows = [];
    state.validationResults = { errors: [], warnings: [], normalizedRows: [] };
    state.cleanedRows = [];
    state.columnTypes = {};
    
    elements.fileInput.value = '';
    elements.bypassRequiredCheck.checked = false;
    elements.btnValidateOnly.disabled = true;
    elements.btnValidateGenerate.disabled = true;

    elements.fileInfo.classList.add('hidden');
    elements.dropZone.classList.remove('hidden');
    if (elements.demoLoaderContainer) {
      elements.demoLoaderContainer.classList.remove('hidden');
    }
    elements.dashboardSection.classList.add('hidden');
    elements.parsingProgressContainer.classList.add('hidden');
    clearUploadError();

    // Reset inputs values
    elements.configForm.reset();
    updateConfigFromUI();
  }

  // ==========================================
  // VALIDATION & CLEANING RUNNER
  // ==========================================
  function runValidation() {
    const engine = window.TransacValidationEngine;
    const result = engine.validateDataset(state.rawRows, state.mappings, state.config);

    // Store in state
    state.validationResults.errors = result.errors;
    state.validationResults.warnings = result.warnings;
    state.validationResults.normalizedRows = result.rows;
    state.validationResults.summary = result.summary;
    state.cleanedRows = result.cleanedRows;

    // Update UI
    updateSummaryDOM(result.summary);
    populateColumnFilter(result.summary.errorsByColumn);
    renderPreviewTable();
    renderErrorTable();
    generateChunks();

    // Handle no-valid-rows state: disable cleaned CSV button and show warning
    if (state.cleanedRows.length === 0) {
      elements.btnDownloadCleaned.disabled = true;
      if (elements.noValidRowsMsg) elements.noValidRowsMsg.classList.remove('hidden');
    } else {
      elements.btnDownloadCleaned.disabled = false;
      if (elements.noValidRowsMsg) elements.noValidRowsMsg.classList.add('hidden');
    }
  }

  /**
   * Updates validation count cards from the aggregate summary.
   */
  function updateSummaryDOM(summary) {
    elements.statTotal.textContent = summary.totalRows.toLocaleString();
    elements.statValid.textContent = summary.validRows.toLocaleString();
    elements.statInvalid.textContent = summary.invalidRows.toLocaleString();
    elements.statWarnings.textContent = summary.warningCount.toLocaleString();

    // Update count in tab header
    const totalIssues = summary.errorCount + summary.warningCount;
    elements.errorTabCount.textContent = totalIssues;
  }

  /**
   * Populates the column filter dropdown based on which columns have errors.
   */
  function populateColumnFilter(errorsByColumn) {
    const select = elements.errorColumnFilter;
    const currentValue = select.value;
    select.innerHTML = '<option value="ALL">All Columns</option>';

    Object.keys(errorsByColumn)
      .sort()
      .forEach(col => {
        const opt = document.createElement('option');
        opt.value = col;
        opt.textContent = `${col} (${errorsByColumn[col]})`;
        select.appendChild(opt);
      });

    // Restore previous selection if still valid
    if (currentValue && [...select.options].some(o => o.value === currentValue)) {
      select.value = currentValue;
    }
  }

  // ==========================================
  // TABLE RENDERING FUNCTIONS
  // ==========================================

  /**
   * Renders the preview table using the first 10 rows.
   * Highlights cells that failed validations in red/amber.
   */
  function renderPreviewTable() {
    // 1. Build Headers
    elements.previewTableHeader.innerHTML = '';
    
    // Add Row count indicator header
    const thRow = document.createElement('th');
    thRow.textContent = '# Row';
    elements.previewTableHeader.appendChild(thRow);

    state.rawHeaders.forEach(header => {
      const th = document.createElement('th');
      th.textContent = header;
      elements.previewTableHeader.appendChild(th);
    });

    // 2. Build Rows (Limit to first 10)
    elements.previewTableBody.innerHTML = '';
    const previewData = state.validationResults.normalizedRows.slice(0, 10);

    if (previewData.length === 0) {
      elements.previewEmptyMsg.classList.remove('hidden');
      return;
    }
    elements.previewEmptyMsg.classList.add('hidden');

    previewData.forEach(item => {
      const tr = document.createElement('tr');
      
      // Index column cell
      const tdIdx = document.createElement('td');
      tdIdx.textContent = item.rowIndex;
      tdIdx.style.fontWeight = '600';
      tdIdx.style.color = 'var(--slate-500)';
      tr.appendChild(tdIdx);

      // Data cells
      state.rawHeaders.forEach(header => {
        const td = document.createElement('td');
        const val = item.originalRow[header];
        td.textContent = val !== undefined && val !== null ? val : '';

        // Check if this column on this row generated errors or warnings
        const colErrors = item.errors.filter(e => e.column === header);
        const colWarnings = item.warnings.filter(w => w.column === header);

        // Also check composite warnings (order_id + product_id mapping warnings)
        const isOrderIdCol = header === state.mappings.order_id;
        const isProductIdCol = header === state.mappings.product_id;
        const hasCompositeWarning = item.warnings.some(w => w.column.includes(header));

        if (colErrors.length > 0) {
          td.classList.add('cell-error');
          td.title = colErrors.map(e => `${e.type}: ${e.suggestedFix}`).join('\n');
        } else if (colWarnings.length > 0 || ((isOrderIdCol || isProductIdCol) && hasCompositeWarning)) {
          td.classList.add('cell-warning');
          
          const matchingWarnings = item.warnings.filter(w => w.column.includes(header) || w.column === header);
          td.title = matchingWarnings.map(w => `${w.type}: ${w.suggestedFix}`).join('\n');
        }

        tr.appendChild(td);
      });

      elements.previewTableBody.appendChild(tr);
    });
  }

  /**
   * Renders the scrollable validation error logs.
   * Search and filter parameters are applied dynamically.
   */
  function renderErrorTable() {
    elements.errorsTableBody.innerHTML = '';
    
    // Combine all issues
    let allIssues = [
      ...state.validationResults.errors,
      ...state.validationResults.warnings
    ];

    // Sort by row number ascending, then severity
    allIssues.sort((a, b) => {
      if (a.row !== b.row) return a.row - b.row;
      return a.severity === 'ERROR' ? -1 : 1;
    });

    // Apply severity filter
    if (state.errorFilterSeverity && state.errorFilterSeverity !== 'ALL') {
      allIssues = allIssues.filter(i => i.severity === state.errorFilterSeverity);
    }

    // Apply column filter
    if (state.errorFilterColumn && state.errorFilterColumn !== 'ALL') {
      allIssues = allIssues.filter(i => i.column === state.errorFilterColumn || i.column.includes(state.errorFilterColumn));
    }

    // Apply text search filter
    if (state.errorSearchQuery) {
      const q = state.errorSearchQuery.toLowerCase();
      allIssues = allIssues.filter(i => {
        return (
          String(i.row).includes(q) ||
          String(i.column).toLowerCase().includes(q) ||
          String(i.type).toLowerCase().includes(q) ||
          String(i.value).toLowerCase().includes(q) ||
          String(i.suggestedFix).toLowerCase().includes(q) ||
          (i.errorCode && i.errorCode.toLowerCase().includes(q))
        );
      });
    }

    // Show empty state if clean
    if (allIssues.length === 0) {
      elements.errorsEmptyMsg.classList.remove('hidden');
      elements.errorsCapMsg.classList.add('hidden');
      return;
    }
    elements.errorsEmptyMsg.classList.add('hidden');

    // Cap output rendering at 500 rows for rendering speed
    const visibleIssues = allIssues.slice(0, 500);
    
    if (allIssues.length > 500) {
      elements.errorsCapMsg.classList.remove('hidden');
      elements.errorsTotalCount.textContent = allIssues.length.toLocaleString();
    } else {
      elements.errorsCapMsg.classList.add('hidden');
    }

    // Populate rows
    visibleIssues.forEach(issue => {
      const tr = document.createElement('tr');
      
      const tdRow = document.createElement('td');
      tdRow.textContent = issue.row;
      tdRow.style.fontWeight = '600';
      tr.appendChild(tdRow);

      const tdCol = document.createElement('td');
      tdCol.textContent = issue.column;
      tr.appendChild(tdCol);

      const tdSev = document.createElement('td');
      const badge = document.createElement('span');
      badge.className = `badge ${issue.severity === 'ERROR' ? 'badge-error' : 'badge-warning'}`;
      badge.textContent = issue.severity;
      tdSev.appendChild(badge);
      tr.appendChild(tdSev);

      const tdType = document.createElement('td');
      tdType.textContent = issue.type;
      tdType.style.fontWeight = '550';
      tr.appendChild(tdType);

      const tdVal = document.createElement('td');
      tdVal.textContent = issue.value || 'N/A';
      tdVal.style.color = 'var(--slate-600)';
      tr.appendChild(tdVal);

      const tdFix = document.createElement('td');
      tdFix.textContent = issue.suggestedFix;
      tr.appendChild(tdFix);

      elements.errorsTableBody.appendChild(tr);
    });
  }

  /**
   * Switches view between active tab panes.
   */
  function switchTab(tabId) {
    state.activeTab = tabId;
    
    if (tabId === 'preview') {
      elements.tabBtnPreview.classList.add('active');
      elements.tabBtnErrors.classList.remove('active');
      elements.tabContentPreview.classList.add('active');
      elements.tabContentErrors.classList.remove('active');
    } else {
      elements.tabBtnPreview.classList.remove('active');
      elements.tabBtnErrors.classList.add('active');
      elements.tabContentPreview.classList.remove('active');
      elements.tabContentErrors.classList.add('active');
    }
  }

  // ==========================================
  // EXPORT & DOWNLOAD LOGIC
  // ==========================================

  /**
   * Converts data strings/arrays into downloadable files in the browser.
   */
  function triggerDownload(content, filename, contentType = 'text/csv;charset=utf-8;') {
    const blob = new Blob([content], { type: contentType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /**
   * Downloads a CSV file containing only the normalized valid rows.
   */
  function downloadCleanedCSV() {
    if (state.cleanedRows.length === 0) {
      return; // No-valid-rows banner already visible in UI
    }

    const csvContent = Papa.unparse(state.cleanedRows);
    const originalName = state.file.name.replace(/\.[^/.]+$/, "");
    triggerDownload(csvContent, `${originalName}_cleaned.csv`);
  }

  /**
   * Downloads validation report: original CSV data + a column summarizing validation errors.
   */
  function downloadValidationReport() {
    if (state.validationResults.normalizedRows.length === 0) return;

    // Map rows to include verification column at the start or end
    const reportData = state.validationResults.normalizedRows.map(item => {
      const errorsList = item.errors.map(e => `[${e.column}] ${e.type}: ${e.suggestedFix}`).join('; ');
      const warningsList = item.warnings.map(w => `[${w.column}] ${w.type}: ${w.suggestedFix}`).join('; ');
      
      const reportRow = { ...item.originalRow };
      
      // Inject logs columns
      reportRow['Validation_Status'] = item.hasErrors ? 'INVALID' : 'VALID';
      reportRow['Validation_Errors'] = errorsList || 'None';
      reportRow['Validation_Warnings'] = warningsList || 'None';

      return reportRow;
    });

    const csvContent = Papa.unparse(reportData);
    const originalName = state.file.name.replace(/\.[^/.]+$/, "");
    triggerDownload(csvContent, `${originalName}_validation_report.csv`);
  }

  /**
   * Generates downloadable chunk layouts dynamically.
   */
  function generateChunks() {
    elements.chunkButtonsContainer.innerHTML = '';
    
    const validCount = state.cleanedRows.length;
    const chunkSize = state.config.chunkSize;

    if (validCount === 0) {
      elements.chunkStatusMsg.textContent = 'No valid rows available to split.';
      elements.chunkStatusMsg.classList.remove('hidden');
      return;
    }

    if (validCount <= chunkSize) {
      elements.chunkStatusMsg.textContent = `Dataset size (${validCount} rows) is smaller than chunk limit (${chunkSize}). Split unnecessary.`;
      elements.chunkStatusMsg.classList.remove('hidden');
      return;
    }

    elements.chunkStatusMsg.classList.add('hidden');
    
    // Calculate iterations
    const numChunks = Math.ceil(validCount / chunkSize);
    
    for (let i = 0; i < numChunks; i++) {
      const start = i * chunkSize;
      const end = Math.min(start + chunkSize, validCount);
      
      const btn = document.createElement('button');
      btn.className = 'chunk-btn';
      
      const title = document.createElement('span');
      title.className = 'chunk-title';
      title.textContent = `Part ${i + 1}`;
      
      const rowsSpan = document.createElement('span');
      rowsSpan.className = 'chunk-rows';
      rowsSpan.textContent = `Rows ${start + 1} - ${end}`;
      
      btn.appendChild(title);
      btn.appendChild(rowsSpan);
      
      btn.addEventListener('click', () => {
        downloadChunk(start, end, i + 1);
      });
      
      elements.chunkButtonsContainer.appendChild(btn);
    }
  }

  /**
   * Downloads a slice of the cleaned transactions array as a single chunk.
   */
  function downloadChunk(startIndex, endIndex, chunkNumber) {
    const chunkData = state.cleanedRows.slice(startIndex, endIndex);
    const csvContent = Papa.unparse(chunkData);
    
    const originalName = state.file.name.replace(/\.[^/.]+$/, "");
    triggerDownload(csvContent, `${originalName}_cleaned_part_${chunkNumber}.csv`);
  }


  // ==========================================
  // INITIALIZE APP
  // ==========================================
  document.addEventListener('DOMContentLoaded', () => {
    initEvents();
    updateConfigFromUI();
  });

})();
