/**
 * TransacShield - Frontend Application Controller
 * 
 * Coordinates file upload, configuration updates, validation execution,
 * tabular data rendering, and file downloading/chunking operations.
 */

(function () {
  'use strict';

  const API_BASE = window.location.hostname === 'localhost' 
    ? 'http://localhost:3001' 
    : 'https://transacshield-production.up.railway.app';

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
      amount: '',
      email: ''
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
    activeTab: 'preview', // 'preview' or 'errors'
    recentJobs: [], // Stores job logs
    historyRuns: [], // Active SQLite history runs list
    historySortField: 'created_at', // default sort field
    historySortAscending: false // default sorting order (descending date)
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
    mapEmail: document.getElementById('map-email'),

    // Guess badges
    guessOrderId: document.getElementById('guess-order-id'),
    guessProductId: document.getElementById('guess-product-id'),
    guessPhone: document.getElementById('guess-phone'),
    guessCountry: document.getElementById('guess-country'),
    guessDatetime: document.getElementById('guess-datetime'),
    guessPayment: document.getElementById('guess-payment'),
    guessAmount: document.getElementById('guess-amount'),
    guessEmail: document.getElementById('guess-email'),

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
    
    // Summary metrics (KPI Summary Row)
    statTotal: document.getElementById('stat-val-total'),
    statValid: document.getElementById('stat-val-valid'),
    statInvalid: document.getElementById('stat-val-invalid'),
    statChunks: document.getElementById('stat-val-chunks'),
    statScore: document.getElementById('stat-val-score'),

    // Detailed results breakdown
    resValChecked: document.getElementById('res-val-checked'),
    resValPassed: document.getElementById('res-val-passed'),
    resValFailed: document.getElementById('res-val-failed'),
    resValWarnings: document.getElementById('res-val-warnings'),
    resValDuplicates: document.getElementById('res-val-duplicates'),
    resValPhoneIssues: document.getElementById('res-val-phone-issues'),
    resValDateIssues: document.getElementById('res-val-date-issues'),

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
    noValidRowsMsg: document.getElementById('no-valid-rows-msg'),
    healthBar: document.getElementById('validation-health-bar'),
    healthBarFill: document.getElementById('validation-health-bar-fill'),
    successBanner: document.getElementById('validation-success-banner'),
    successText: document.getElementById('validation-success-text'),
    timestampContainer: document.getElementById('last-validated-timestamp'),
    timestampVal: document.getElementById('last-validated-time'),

    // Header & actions buttons
    hdrBtnLoadDemo: document.getElementById('hdr-btn-load-demo'),
    hdrBtnValidate: document.getElementById('hdr-btn-validate'),
    workspaceReviewContainer: document.getElementById('workspace-review-container'),
    btnActionLoadDemo: document.getElementById('btn-action-load-demo'),
    btnActionReset: document.getElementById('btn-action-reset'),
    btnActionValidate: document.getElementById('btn-action-validate'),
    btnActionGenerate: document.getElementById('btn-action-generate'),
    recentJobsBody: document.getElementById('recent-jobs-body')
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
              populateSmartChips();
              
              elements.fileInfo.classList.remove('hidden');
              elements.dropZone.classList.add('hidden');
              if (elements.demoLoaderContainer) {
                elements.demoLoaderContainer.classList.add('hidden');
              }
              clearUploadError();
              
              updateConfigFromUI();
              
              elements.dashboardSection.classList.add('hidden');
              if (elements.workspaceReviewContainer) {
                elements.workspaceReviewContainer.classList.remove('hidden');
              }
              if (elements.hdrBtnValidate) {
                elements.hdrBtnValidate.classList.remove('hidden');
              }
              if (elements.hdrBtnLoadDemo) {
                elements.hdrBtnLoadDemo.classList.add('hidden');
              }
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
    if (elements.hdrBtnLoadDemo) elements.hdrBtnLoadDemo.addEventListener('click', loadSampleData);
    if (elements.btnActionLoadDemo) elements.btnActionLoadDemo.addEventListener('click', loadSampleData);

    // 9. Validation Triggers
    elements.btnValidateOnly.addEventListener('click', () => handleValidationTrigger(true));
    elements.btnValidateGenerate.addEventListener('click', () => handleValidationTrigger(false));
    if (elements.hdrBtnValidate) elements.hdrBtnValidate.addEventListener('click', () => handleValidationTrigger(true));
    if (elements.btnActionValidate) elements.btnActionValidate.addEventListener('click', () => handleValidationTrigger(true));
    if (elements.btnActionGenerate) elements.btnActionGenerate.addEventListener('click', () => handleValidationTrigger(false));

    // Reset bindings
    elements.btnReset.addEventListener('click', resetDashboard);
    if (elements.btnActionReset) elements.btnActionReset.addEventListener('click', resetDashboard);

    // 10. Central Column Mapping change handlers
    const mappingSelects = [
      { element: elements.mapOrderId, field: 'order_id' },
      { element: elements.mapProductId, field: 'product_id' },
      { element: elements.mapPhone, field: 'phone' },
      { element: elements.mapCountry, field: 'country' },
      { element: elements.mapDatetime, field: 'datetime' },
      { element: elements.mapPayment, field: 'payment_mode' },
      { element: elements.mapAmount, field: 'amount' },
      { element: elements.mapEmail, field: 'email' }
    ];

    mappingSelects.forEach(mapping => {
      if (mapping.element) {
        mapping.element.addEventListener('change', () => {
          state.mappings[mapping.field] = mapping.element.value;
          updateGuessBadges();
          checkRequiredMappings();
          
          // Re-run validation automatically if dashboard is active
          if (state.rawRows.length > 0 && !elements.dashboardSection.classList.contains('hidden')) {
            runValidation();
          }
        });
      }
    });

    elements.bypassRequiredCheck.addEventListener('change', () => {
      checkRequiredMappings();
    });

    // Details panel close events
    const closeBtn = document.getElementById('panel-close-btn');
    const overlay = document.getElementById('details-overlay');
    const panel = document.getElementById('details-panel');

    if (closeBtn && overlay && panel) {
      const closePanel = () => {
        panel.classList.remove('open');
        overlay.classList.remove('open');
      };
      closeBtn.addEventListener('click', closePanel);
      overlay.addEventListener('click', closePanel);
    }

    // Full-page drag and drop overlay handlers
    let dragCounter = 0;
    const dragOverlay = document.getElementById('full-page-drag-overlay');
    
    document.addEventListener('dragenter', (e) => {
      e.preventDefault();
      dragCounter++;
      if (dragCounter === 1 && dragOverlay) {
        dragOverlay.classList.add('active');
      }
    });
    
    document.addEventListener('dragover', (e) => {
      e.preventDefault();
    });
    
    document.addEventListener('dragleave', (e) => {
      e.preventDefault();
      dragCounter--;
      if (dragCounter === 0 && dragOverlay) {
        dragOverlay.classList.remove('active');
      }
    });
    
    document.addEventListener('drop', (e) => {
      e.preventDefault();
      dragCounter = 0;
      if (dragOverlay) {
        dragOverlay.classList.remove('active');
      }
      const files = e.dataTransfer.files;
      if (files && files.length > 0) {
        handleFile(files[0]);
      }
    });

    // Keyboard shortcut triggers
    document.addEventListener('keydown', (e) => {
      const tag = e.target.tagName.toLowerCase();
      if (tag === 'input' || tag === 'select' || tag === 'textarea' || e.target.isContentEditable) {
        return;
      }
      const key = e.key.toUpperCase();
      if (key === 'V') {
        if (state.rawRows.length > 0 && !elements.btnValidateGenerate.disabled && !elements.workspaceReviewContainer.classList.contains('hidden')) {
          e.preventDefault();
          handleValidationTrigger(false);
        }
      } else if (key === 'R') {
        if (state.file) {
          e.preventDefault();
          resetDashboard();
        }
      } else if (key === 'H') {
        const historySection = document.querySelector('.recent-jobs-section');
        if (historySection) {
          e.preventDefault();
          historySection.scrollIntoView({ behavior: 'smooth' });
        }
      }
    });

    // Row Inspector drawer close events
    const rowInspectorCloseBtn = document.getElementById('row-inspector-close-btn');
    const rowInspectorOverlay = document.getElementById('row-inspector-overlay');
    const rowInspectorPanel = document.getElementById('row-inspector-panel');
    
    if (rowInspectorCloseBtn && rowInspectorOverlay && rowInspectorPanel) {
      const closeRowInspector = () => {
        rowInspectorPanel.classList.remove('open');
        rowInspectorOverlay.classList.remove('open');
      };
      rowInspectorCloseBtn.addEventListener('click', closeRowInspector);
      rowInspectorOverlay.addEventListener('click', closeRowInspector);
    }

    // Bulk actions and Phase 2 download click handlers
    document.getElementById('btn-clear-history')?.addEventListener('click', () => {
      if (confirm('Are you sure you want to clear all validation run history from the database?')) {
        clearAllHistory();
      }
    });
    
    document.getElementById('btn-download-json')?.addEventListener('click', downloadErrorSummaryJSON);
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
    state.mappings.email = elements.mapEmail.value;
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
          populateSmartChips();

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

          if (elements.workspaceReviewContainer) {
            elements.workspaceReviewContainer.classList.remove('hidden');
          }
          if (elements.hdrBtnValidate) {
            elements.hdrBtnValidate.classList.remove('hidden');
          }
          if (elements.hdrBtnLoadDemo) {
            elements.hdrBtnLoadDemo.classList.add('hidden');
          }
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
    elements.progressStatus.textContent = 'Parsing rows...';
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
      payment_mode: ['payment_mode', 'paymentmode', 'payment_method', 'paymentmethod', 'payment', 'mode', 'method', 'pay_mode'],
      email: ['email', 'email_address', 'mail', 'e-mail', 'customer_email', 'contact_email']
    };

    // Assign mapped fields
    state.mappings.order_id = findMatch(mapDict.order_id) || headers[0] || '';
    state.mappings.product_id = findMatch(mapDict.product_id) || '';
    state.mappings.phone = findMatch(mapDict.phone) || '';
    state.mappings.country = findMatch(mapDict.country) || '';
    state.mappings.datetime = findMatch(mapDict.datetime) || findMatch(['date', 'time']) || '';
    state.mappings.amount = findMatch(mapDict.amount) || '';
    state.mappings.email = findMatch(mapDict.email) || '';
    
    // Avoid double mapping the order_id if product_id fell back to headers[0]
    if (state.mappings.product_id === state.mappings.order_id) {
      state.mappings.product_id = '';
    }

    state.mappings.payment_mode = findMatch(mapDict.payment_mode) || '';
  }

  function populateMappingDropdowns() {
    const mappingSelects = [
      elements.mapOrderId,
      elements.mapProductId,
      elements.mapPhone,
      elements.mapCountry,
      elements.mapDatetime,
      elements.mapPayment,
      elements.mapAmount,
      elements.mapEmail
    ];

    mappingSelects.forEach(select => {
      if (select) {
        select.innerHTML = '';
        
        const defaultOpt = document.createElement('option');
        defaultOpt.value = '';
        defaultOpt.textContent = '-- Skip Column --';
        select.appendChild(defaultOpt);

        state.rawHeaders.forEach(header => {
          const opt = document.createElement('option');
          opt.value = header;
          opt.textContent = header;
          select.appendChild(opt);
        });
      }
    });

    elements.mapOrderId.value = state.mappings.order_id;
    elements.mapProductId.value = state.mappings.product_id;
    elements.mapPhone.value = state.mappings.phone;
    elements.mapCountry.value = state.mappings.country;
    elements.mapDatetime.value = state.mappings.datetime;
    elements.mapPayment.value = state.mappings.payment_mode;
    elements.mapAmount.value = state.mappings.amount;
    elements.mapEmail.value = state.mappings.email;
  }

  function updateGuessBadges() {
    const fields = [
      { select: elements.mapOrderId, badge: elements.guessOrderId },
      { select: elements.mapProductId, badge: elements.guessProductId },
      { select: elements.mapPhone, badge: elements.guessPhone },
      { select: elements.mapCountry, badge: elements.guessCountry },
      { select: elements.mapDatetime, badge: elements.guessDatetime },
      { select: elements.mapPayment, badge: elements.guessPayment },
      { select: elements.mapAmount, badge: elements.guessAmount },
      { select: elements.mapEmail, badge: elements.guessEmail }
    ];

    fields.forEach(f => {
      if (f.select && f.badge) {
        const selectedCol = f.select.value;
        if (selectedCol) {
          const guessedType = state.columnTypes[selectedCol] || 'Text';
          f.badge.textContent = `Guessed: ${guessedType}`;
          f.badge.style.opacity = '1';
        } else {
          f.badge.textContent = 'Skipped';
          f.badge.style.opacity = '0.5';
        }
      }
    });
  }

  function checkRequiredMappings() {
    const orderIdMapped = elements.mapOrderId.value !== '';
    const bypassChecked = elements.bypassRequiredCheck.checked;
    
    const warningCard = elements.mappingWarningCard;

    const setDisabled = (val) => {
      if (elements.btnValidateOnly) elements.btnValidateOnly.disabled = val;
      if (elements.btnValidateGenerate) elements.btnValidateGenerate.disabled = val;
      if (elements.hdrBtnValidate) elements.hdrBtnValidate.disabled = val;
      if (elements.btnActionValidate) elements.btnActionValidate.disabled = val;
      if (elements.btnActionGenerate) elements.btnActionGenerate.disabled = val;
    };

    if (orderIdMapped) {
      warningCard.classList.add('valid-state');
      warningCard.querySelector('.mapping-warning-text').innerHTML = 
        '✅ <strong>Required fields mapped.</strong> Ready to proceed with validation.';
      setDisabled(false);
    } else if (bypassChecked) {
      warningCard.classList.add('valid-state');
      warningCard.querySelector('.mapping-warning-text').innerHTML = 
        'ℹ️ <strong>Bypassed Order ID mapping.</strong> Order ID format validation will be skipped.';
      setDisabled(false);
    } else {
      warningCard.classList.remove('valid-state');
      warningCard.querySelector('.mapping-warning-text').innerHTML = 
        '⚠️ <strong>Order ID mapping is required.</strong> Select a column or check the box to confirm it is missing from this file.';
      setDisabled(true);
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
    if (elements.btnValidateOnly) elements.btnValidateOnly.disabled = true;
    if (elements.btnValidateGenerate) elements.btnValidateGenerate.disabled = true;

    elements.fileInfo.classList.add('hidden');
    elements.dropZone.classList.remove('hidden');
    if (elements.demoLoaderContainer) {
      elements.demoLoaderContainer.classList.remove('hidden');
    }
    elements.dashboardSection.classList.add('hidden');
    elements.parsingProgressContainer.classList.add('hidden');
    clearUploadError();

    // Hide Review Workspace
    if (elements.workspaceReviewContainer) {
      elements.workspaceReviewContainer.classList.add('hidden');
    }
    if (elements.hdrBtnValidate) {
      elements.hdrBtnValidate.classList.add('hidden');
    }
    if (elements.hdrBtnLoadDemo) {
      elements.hdrBtnLoadDemo.classList.remove('hidden');
    }

    // Reset inputs values
    elements.configForm.reset();
    updateConfigFromUI();

    if (elements.healthBar) elements.healthBar.classList.add('hidden');
    if (elements.successBanner) elements.successBanner.classList.add('hidden');
    if (elements.timestampContainer) elements.timestampContainer.classList.add('hidden');

    // Phase 2 Hide Insights & Banners
    document.getElementById('dashboard-insights-row')?.classList.add('hidden');
    document.getElementById('smart-insight-banner')?.classList.add('hidden');
    
    const smartChips = document.getElementById('smart-chips-container');
    if (smartChips) {
      smartChips.innerHTML = '';
      smartChips.classList.add('hidden');
    }
    
    document.getElementById('export-card-cleaned')?.classList.remove('disabled');
    document.getElementById('export-card-report')?.classList.remove('disabled');
    document.getElementById('export-card-json')?.classList.remove('disabled');
    
    const btnJson = document.getElementById('btn-download-json');
    if (btnJson) btnJson.disabled = true;

    // Reset KPI Row to 0 values
    animateCount(elements.statTotal, 0);
    animateCount(elements.statValid, 0);
    animateCount(elements.statInvalid, 0);
    animateCount(elements.statChunks, 0);
    animateScore(elements.statScore, 0);
  }

  // ==========================================
  // ANIMATION & POLISH HELPERS
  // ==========================================
  function animateCount(element, targetValue) {
    if (!element) return;
    if (element.animationFrameId) {
      cancelAnimationFrame(element.animationFrameId);
    }
    const duration = 1000;
    const startValue = 0;
    const startTime = performance.now();

    function update(currentTime) {
      const elapsedTime = currentTime - startTime;
      if (elapsedTime >= duration) {
        element.textContent = targetValue.toLocaleString();
        element.animationFrameId = null;
      } else {
        const progress = elapsedTime / duration;
        const easeProgress = progress * (2 - progress);
        const currentValue = Math.floor(startValue + (targetValue - startValue) * easeProgress);
        element.textContent = currentValue.toLocaleString();
        element.animationFrameId = requestAnimationFrame(update);
      }
    }
    element.animationFrameId = requestAnimationFrame(update);
  }

  function animateScore(element, targetValue) {
    if (!element) return;
    if (element.animationFrameId) {
      cancelAnimationFrame(element.animationFrameId);
    }
    const duration = 1000;
    const startValue = 0;
    const startTime = performance.now();

    function update(currentTime) {
      const elapsedTime = currentTime - startTime;
      if (elapsedTime >= duration) {
        element.textContent = `${targetValue.toFixed(1)}%`;
        element.animationFrameId = null;
      } else {
        const progress = elapsedTime / duration;
        const easeProgress = progress * (2 - progress);
        const currentValue = startValue + (targetValue - startValue) * easeProgress;
        element.textContent = `${currentValue.toFixed(1)}%`;
        element.animationFrameId = requestAnimationFrame(update);
      }
    }
    element.animationFrameId = requestAnimationFrame(update);
  }

  function updateHealthBar(summary) {
    if (!elements.healthBar || !elements.healthBarFill) return;

    if (summary.totalRows === 0) {
      elements.healthBar.classList.add('hidden');
      return;
    }

    const healthPct = (summary.validRows / summary.totalRows) * 100;
    elements.healthBarFill.style.width = `${healthPct}%`;

    elements.healthBarFill.classList.remove('health-green', 'health-orange', 'health-red');
    if (healthPct > 80) {
      elements.healthBarFill.classList.add('health-green');
    } else if (healthPct >= 50) {
      elements.healthBarFill.classList.add('health-orange');
    } else {
      elements.healthBarFill.classList.add('health-red');
    }

    elements.healthBar.classList.remove('hidden');
  }

  function updateValidationSuccessBanner(summary) {
    if (!elements.successBanner || !elements.successText) return;
    elements.successText.textContent = `✓ Validation complete — ${summary.validRows} rows passed, ${summary.invalidRows} failed`;
    elements.successBanner.classList.remove('hidden');
  }

  function updateValidationTimestamp() {
    if (!elements.timestampContainer || !elements.timestampVal) return;
    elements.timestampVal.textContent = 'just now';
    elements.timestampContainer.classList.remove('hidden');
  }

  function renderRecentJobs() {
    if (!elements.recentJobsBody) return;
    elements.recentJobsBody.innerHTML = '';

    state.recentJobs.forEach(job => {
      const tr = document.createElement('tr');

      const tdFile = document.createElement('td');
      tdFile.textContent = job.fileName;
      tdFile.style.fontWeight = '600';
      tr.appendChild(tdFile);

      const tdTime = document.createElement('td');
      tdTime.textContent = job.timestamp;
      tdTime.style.color = 'var(--slate-500)';
      tr.appendChild(tdTime);

      const tdRows = document.createElement('td');
      tdRows.textContent = job.rowsProcessed.toLocaleString();
      tr.appendChild(tdRows);

      const tdStatus = document.createElement('td');
      const badge = document.createElement('span');
      badge.className = `job-status-badge ${
        job.validationStatus === 'COMPLETED' ? 'badge-completed' : 'badge-completed-errors'
      }`;
      badge.textContent = job.validationStatus;
      tdStatus.appendChild(badge);
      tr.appendChild(tdStatus);

      const tdRate = document.createElement('td');
      tdRate.textContent = job.successRate;
      tdRate.style.fontWeight = '600';
      tr.appendChild(tdRate);

      elements.recentJobsBody.appendChild(tr);
    });
  }

  // ==========================================
  // VALIDATION & CLEANING RUNNER
  // ==========================================
  function runValidation() {
    const engine = window.TransacValidationEngine;
    const startTime = performance.now();
    const result = engine.validateDataset(state.rawRows, state.mappings, state.config);
    const duration = Math.round(performance.now() - startTime);

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

    // Update Detailed Results Breakdown
    if (elements.resValChecked) elements.resValChecked.textContent = result.summary.totalRows.toLocaleString();
    if (elements.resValPassed) elements.resValPassed.textContent = result.summary.validRows.toLocaleString();
    if (elements.resValFailed) elements.resValFailed.textContent = result.summary.invalidRows.toLocaleString();
    if (elements.resValWarnings) elements.resValWarnings.textContent = result.summary.warningCount.toLocaleString();
    if (elements.resValDuplicates) elements.resValDuplicates.textContent = result.summary.duplicateRows.toLocaleString();
    if (elements.resValPhoneIssues) elements.resValPhoneIssues.textContent = result.summary.phoneIssueRows.toLocaleString();
    if (elements.resValDateIssues) elements.resValDateIssues.textContent = result.summary.dateIssueRows.toLocaleString();

    // Update Polish elements
    updateHealthBar(result.summary);
    updateValidationSuccessBanner(result.summary);
    updateValidationTimestamp();

    // ───────────────────────────────────────────
    // Phase 2 Insights & Animations
    // ───────────────────────────────────────────
    document.getElementById('dashboard-insights-row')?.classList.remove('hidden');
    const successPct = result.summary.totalRows > 0 ? (result.summary.validRows / result.summary.totalRows) * 100 : 0;
    animateQualityRing(successPct);
    renderErrorChart();
    updateSmartInsights(result);

    // Update export card stats text contents
    const cleanedStat = document.getElementById('export-stat-cleaned');
    const reportStat = document.getElementById('export-stat-report');
    const jsonStat = document.getElementById('export-stat-json');
    if (cleanedStat) cleanedStat.textContent = `${result.summary.validRows.toLocaleString()} rows`;
    if (reportStat) reportStat.textContent = `${result.summary.totalRows.toLocaleString()} rows`;
    if (jsonStat) jsonStat.textContent = `${(result.summary.errorCount + result.summary.warningCount).toLocaleString()} issues`;

    // Save validation run details to backend database
    saveRunToBackend(result, duration);

    // Handle no-valid-rows state: disable cleaned CSV button and show warning
    // Handle no-valid-rows state: disable cleaned CSV button and show warning
    if (state.cleanedRows.length === 0) {
      if (elements.btnDownloadCleaned) elements.btnDownloadCleaned.disabled = true;
      if (elements.noValidRowsMsg) elements.noValidRowsMsg.classList.remove('hidden');
    } else {
      if (elements.btnDownloadCleaned) elements.btnDownloadCleaned.disabled = false;
      if (elements.noValidRowsMsg) elements.noValidRowsMsg.classList.add('hidden');
    }
  }

  // ==========================================
  // PHASE 2 HELPER FUNCTIONS
  // ==========================================

  function populateSmartChips() {
    const container = document.getElementById('smart-chips-container');
    if (!container) return;
    container.innerHTML = '';
    
    const headers = state.rawHeaders;
    if (!headers || headers.length === 0) {
      container.classList.add('hidden');
      return;
    }
    
    container.classList.remove('hidden');
    
    headers.forEach((header, idx) => {
      const type = state.columnTypes[header] || 'Text';
      const chip = document.createElement('div');
      chip.className = 'smart-chip';
      chip.style.animationDelay = `${idx * 0.05}s`;
      
      chip.innerHTML = `
        <span class="chip-col-name">${header}</span>
        <span class="chip-type-tag">${type}</span>
      `;
      container.appendChild(chip);
    });
  }

  function startValidationProcessing(isValidateOnly) {
    const modal = document.getElementById('processing-modal-overlay');
    const title = document.getElementById('processing-stage-title');
    const desc = document.getElementById('processing-stage-desc');
    const barFill = document.getElementById('processing-progress-bar-fill');
    const percentage = document.getElementById('processing-progress-percentage');
    
    if (!modal) return;
    modal.classList.remove('hidden');
    
    const stages = [
      { title: "Initializing Engine...", desc: "Preparing datasets and mapping validation constraints.", pct: 0 },
      { title: "Mapping Schema Headers...", desc: "Aligning expected fields with CSV column labels.", pct: 20 },
      { title: "Parsing Transaction Signatures...", desc: "Evaluating telephone formats, amounts, and email syntaxes.", pct: 40 },
      { title: "Validating Country Rules...", desc: "Applying regional phone checks and date-time conversions.", pct: 60 },
      { title: "Running Deduplication Checks...", desc: "Scanning for repeated transaction signatures.", pct: 80 },
      { title: "Compiling Quality Scoring...", desc: "Finalizing data quality ratings and error breakdowns.", pct: 100 }
    ];
    
    let currentStage = 0;
    
    const updateStage = () => {
      if (currentStage < stages.length) {
        const stage = stages[currentStage];
        title.textContent = stage.title;
        desc.textContent = stage.desc;
        barFill.style.width = `${stage.pct}%`;
        percentage.textContent = `${stage.pct}%`;
        currentStage++;
        setTimeout(updateStage, 400);
      } else {
        modal.classList.add('hidden');
        executeValidation(isValidateOnly);
      }
    };
    
    updateStage();
  }

  function executeValidation(isValidateOnly) {
    runValidation();

    const cardCleaned = document.getElementById('export-card-cleaned');
    const cardReport = document.getElementById('export-card-report');
    const cardJson = document.getElementById('export-card-json');
    const btnJson = document.getElementById('btn-download-json');

    if (isValidateOnly) {
      elements.downloadLockedBanner.classList.remove('hidden');
      
      elements.btnDownloadCleaned.disabled = true;
      elements.btnDownloadReport.disabled = true;
      if (btnJson) btnJson.disabled = true;
      
      cardCleaned?.classList.add('disabled');
      cardReport?.classList.add('disabled');
      cardJson?.classList.add('disabled');
      
      elements.chunkStatusMsg.textContent = 'Exports are locked. Run "Validate & Generate Output" to enable file downloads.';
      elements.chunkStatusMsg.classList.remove('hidden');
      elements.chunkButtonsContainer.innerHTML = '';
    } else {
      elements.downloadLockedBanner.classList.add('hidden');
      
      elements.btnDownloadCleaned.disabled = false;
      elements.btnDownloadReport.disabled = false;
      if (btnJson) btnJson.disabled = false;
      
      cardCleaned?.classList.remove('disabled');
      cardReport?.classList.remove('disabled');
      cardJson?.classList.remove('disabled');
      
      generateChunks();
    }

    elements.dashboardSection.classList.remove('hidden');
  }

  function animateQualityRing(targetScore) {
    const circle = document.getElementById('ring-circle');
    const percentageEl = document.getElementById('ring-percentage');
    if (!circle || !percentageEl) return;
    
    circle.setAttribute('stroke', targetScore > 80 ? '#10b981' : (targetScore >= 50 ? '#f59e0b' : '#ef4444'));
    
    const duration = 1500;
    const startTime = performance.now();
    const startOffset = 440;
    const endOffset = 440 - (440 * (targetScore / 100));
    
    function updateRing(currentTime) {
      const elapsed = currentTime - startTime;
      if (elapsed >= duration) {
        circle.style.strokeDashoffset = endOffset;
        percentageEl.textContent = `${targetScore.toFixed(1)}%`;
      } else {
        const progress = elapsed / duration;
        const easeProgress = progress * (2 - progress);
        const currentOffset = startOffset - ((startOffset - endOffset) * easeProgress);
        const currentPercentage = (targetScore * easeProgress);
        circle.style.strokeDashoffset = currentOffset;
        percentageEl.textContent = `${currentPercentage.toFixed(1)}%`;
        requestAnimationFrame(updateRing);
      }
    }
    requestAnimationFrame(updateRing);
  }

  function renderErrorChart() {
    const container = document.getElementById('error-chart-container');
    if (!container) return;
    container.innerHTML = '';
    
    const issues = [...state.validationResults.errors, ...state.validationResults.warnings];
    const categories = [
      { label: "Phone Errors", key: "phone", count: issues.filter(i => i.errorCode === 'INVALID_PHONE').length, barClass: "phone-bar" },
      { label: "Date Errors", key: "date", count: issues.filter(i => i.errorCode === 'INVALID_DATE').length, barClass: "date-bar" },
      { label: "Email Errors", key: "email", count: issues.filter(i => i.errorCode === 'INVALID_EMAIL').length, barClass: "email-bar" },
      { label: "Payment Mode Errors", key: "payment", count: issues.filter(i => i.errorCode === 'INVALID_PAYMENT').length, barClass: "payment-bar" },
      { label: "Missing Fields", key: "missing", count: issues.filter(i => i.errorCode === 'MISSING_ORDER_ID' || i.value === '').length, barClass: "missing-bar" },
      { label: "Duplicates", key: "duplicate", count: issues.filter(i => i.errorCode === 'DUPLICATE_ORDER' || i.errorCode === 'DUPLICATE_PAIR').length, barClass: "duplicate-bar" }
    ];
    
    const activeCategories = categories.filter(c => c.count > 0);
    
    if (activeCategories.length === 0) {
      container.innerHTML = `
        <div style="font-size: 0.8125rem; font-weight: 600; color: var(--success-dark); display: flex; align-items: center; gap: 0.5rem; padding: 0.5rem 0;">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="16" height="16">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
          Your dataset contains no errors or warnings!
        </div>
      `;
      return;
    }
    
    const maxCount = Math.max(...categories.map(c => c.count));
    
    activeCategories.forEach(cat => {
      const pct = maxCount > 0 ? (cat.count / maxCount) * 100 : 0;
      const row = document.createElement('div');
      row.className = 'chart-row';
      row.innerHTML = `
        <span class="chart-label">${cat.label}</span>
        <div class="chart-bar-wrapper">
          <div class="chart-bar ${cat.barClass}" style="width: 0%;"></div>
        </div>
        <span class="chart-count">${cat.count}</span>
      `;
      container.appendChild(row);
      
      setTimeout(() => {
        const bar = row.querySelector('.chart-bar');
        if (bar) bar.style.width = `${pct}%`;
      }, 50);
    });
  }

  function updateSmartInsights(result) {
    const banner = document.getElementById('smart-insight-banner');
    const textEl = document.getElementById('smart-insight-text');
    if (!banner || !textEl) return;
    
    const summary = result.summary;
    const totalIssues = summary.errorCount + summary.warningCount;
    
    if (totalIssues === 0) {
      textEl.innerHTML = "<strong>Congratulations!</strong> Your transaction dataset is 100% clean and ready for immediate downstream processing.";
      banner.classList.remove('hidden');
      return;
    }
    
    let maxErrors = 0;
    let worstCol = '';
    Object.keys(summary.errorsByColumn).forEach(col => {
      if (summary.errorsByColumn[col] > maxErrors) {
        maxErrors = summary.errorsByColumn[col];
        worstCol = col;
      }
    });
    
    let sentence = `<strong>Action Required:</strong> ${summary.errorCount} errors and ${summary.warningCount} warnings detected. `;
    if (worstCol) {
      sentence += `Most validation issues occurred in the <strong>"${worstCol}"</strong> column. `;
    }
    sentence += `We recommend clicking on flagged rows in the preview table below to inspect suggested normalizations.`;
    
    textEl.innerHTML = sentence;
    banner.classList.remove('hidden');
  }

  function downloadErrorSummaryJSON() {
    if (state.validationResults.normalizedRows.length === 0) return;
    
    const summaryData = {
      filename: state.file ? state.file.name : 'sample_transactions.csv',
      summary: state.validationResults.summary,
      errors: state.validationResults.errors,
      warnings: state.validationResults.warnings
    };
    
    const jsonString = JSON.stringify(summaryData, null, 2);
    const originalName = state.file ? state.file.name.replace(/\.[^/.]+$/, "") : 'sample_transactions';
    triggerDownload(jsonString, `${originalName}_validation_errors.json`, 'application/json;charset=utf-8;');
  }

  function openRowInspector(item) {
    const panel = document.getElementById('row-inspector-panel');
    const overlay = document.getElementById('row-inspector-overlay');
    if (!panel || !overlay) return;
    
    panel.classList.add('open');
    overlay.classList.add('open');
    
    document.getElementById('row-inspector-subtitle').textContent = `Row #${item.rowIndex} details & normalization comparison`;
    
    const compareContainer = document.getElementById('row-inspector-compare-container');
    compareContainer.innerHTML = '';
    
    state.rawHeaders.forEach(header => {
      const origVal = item.originalRow[header] !== undefined ? item.originalRow[header] : '';
      const normVal = item.normalizedRow[header] !== undefined ? item.normalizedRow[header] : '';
      
      const colErrors = item.errors.filter(e => e.column === header);
      const isFixed = origVal !== normVal;
      const hasError = colErrors.length > 0;
      
      let fixedClass = '';
      if (isFixed) {
        fixedClass = hasError ? 'fixed was-error' : 'fixed';
      }
      
      const rowDiv = document.createElement('div');
      rowDiv.className = 'compare-row';
      rowDiv.innerHTML = `
        <div class="compare-cell">
          <span class="compare-cell-title">${header} (Original)</span>
          <span class="compare-cell-val">${origVal || '<span class="text-muted">empty</span>'}</span>
        </div>
        <div class="compare-cell">
          <span class="compare-cell-title">${header} (Cleaned)</span>
          <span class="compare-cell-val ${fixedClass}">${normVal || '<span class="text-muted">empty</span>'}</span>
        </div>
      `;
      compareContainer.appendChild(rowDiv);
    });
    
    const issuesContainer = document.getElementById('row-inspector-issues-container');
    issuesContainer.innerHTML = '';
    
    const allIssues = [...item.errors, ...item.warnings];
    if (allIssues.length === 0) {
      issuesContainer.innerHTML = `
        <div class="empty-state-msg empty-state-success" style="margin-top: 0.5rem; padding: 1rem;">
          <svg class="empty-state-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
          </svg>
          No issues on this row!
        </div>
      `;
    } else {
      allIssues.forEach(issue => {
        const itemDiv = document.createElement('div');
        itemDiv.className = `inspector-issue-item severity-${issue.severity.toLowerCase()}`;
        itemDiv.innerHTML = `
          <div class="issue-item-header">
            <span class="issue-item-col">${issue.column}</span>
            <span class="badge ${issue.severity === 'ERROR' ? 'badge-error' : 'badge-warning'}">${issue.severity}</span>
          </div>
          <div class="issue-item-msg">${issue.type}</div>
          <div class="issue-item-fix">Suggested Fix: ${issue.suggestedFix}</div>
        `;
        issuesContainer.appendChild(itemDiv);
      });
    }
    
    const copyBtn = document.getElementById('btn-row-inspector-copy');
    const newCopyBtn = copyBtn.cloneNode(true);
    copyBtn.parentNode.replaceChild(newCopyBtn, copyBtn);
    
    newCopyBtn.addEventListener('click', () => {
      const rowStr = JSON.stringify(item.normalizedRow, null, 2);
      navigator.clipboard.writeText(rowStr)
        .then(() => showToast('Row copied to clipboard!'))
        .catch(err => console.error('Error copying row:', err));
    });
  }

  function clearAllHistory() {
    fetch(API_BASE + '/api/runs', {
      method: 'DELETE'
    })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          showToast('Validation history cleared!');
          loadHistory();
        }
      })
      .catch(err => console.error('Error clearing history:', err));
  }

  /**
   * Updates validation count cards from the aggregate summary.
   */
  function updateSummaryDOM(summary) {
    animateCount(elements.statTotal, summary.totalRows);
    animateCount(elements.statValid, summary.validRows);
    animateCount(elements.statInvalid, summary.invalidRows);
    
    const validCount = summary.validRows;
    const chunkSize = state.config.chunkSize;
    const numChunks = validCount > 0 ? (validCount <= chunkSize ? 1 : Math.ceil(validCount / chunkSize)) : 0;
    animateCount(elements.statChunks, numChunks);

    const successPct = summary.totalRows > 0 ? (summary.validRows / summary.totalRows) * 100 : 0;
    animateScore(elements.statScore, successPct);

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

      tr.addEventListener('click', () => {
        openRowInspector(item);
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

    // Group visible issues by column
    const grouped = {};
    visibleIssues.forEach(issue => {
      const col = issue.column || 'General';
      if (!grouped[col]) {
        grouped[col] = [];
      }
      grouped[col].push(issue);
    });

    // Populate rows by grouped columns
    Object.keys(grouped).forEach(colName => {
      const issues = grouped[colName];
      const count = issues.length;

      // Group header row
      const headerTr = document.createElement('tr');
      headerTr.className = 'error-group-header active';

      const tdHeader = document.createElement('td');
      tdHeader.colSpan = 6;

      const headerContent = document.createElement('div');
      headerContent.className = 'error-group-content';

      const caret = document.createElement('span');
      caret.className = 'group-caret';
      caret.textContent = '▼';

      const label = document.createElement('span');
      label.className = 'group-label';
      label.textContent = colName;

      const badge = document.createElement('span');
      badge.className = 'group-badge';
      badge.textContent = `${count} error${count !== 1 ? 's' : ''}`;

      headerContent.appendChild(caret);
      headerContent.appendChild(label);
      headerContent.appendChild(badge);
      tdHeader.appendChild(headerContent);
      headerTr.appendChild(tdHeader);
      elements.errorsTableBody.appendChild(headerTr);

      const rows = [];
      issues.forEach(issue => {
        const tr = document.createElement('tr');

        const tdRow = document.createElement('td');
        tdRow.textContent = issue.row;
        tdRow.style.fontWeight = '600';
        tr.appendChild(tdRow);

        const tdCol = document.createElement('td');
        tdCol.textContent = issue.column;
        tr.appendChild(tdCol);

        const tdSev = document.createElement('td');
        const badgeSpan = document.createElement('span');
        badgeSpan.className = `badge ${issue.severity === 'ERROR' ? 'badge-error' : 'badge-warning'}`;
        badgeSpan.textContent = issue.severity;
        tdSev.appendChild(badgeSpan);
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
        rows.push(tr);
      });

      // Collapse toggle event listener
      headerTr.addEventListener('click', () => {
        const isActive = headerTr.classList.toggle('active');
        caret.textContent = isActive ? '▼' : '▶';
        rows.forEach(r => {
          if (isActive) {
            r.classList.remove('hidden-row');
          } else {
            r.classList.add('hidden-row');
          }
        });
      });
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
    setupHistorySorting();
    loadHistory(); // Load from local SQLite backend
  });

  // ==========================================
  // BACKEND HISTORY API INTEGRATIONS
  // ==========================================

  function showToast(message, type = 'success') {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      container.className = 'toast-container';
      document.body.appendChild(container);
    }
    
    const toast = document.createElement('div');
    toast.className = `toast-notification ${type}`;
    
    let iconSvg = '';
    if (type === 'success') {
      iconSvg = `
        <svg class="toast-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="16" height="16">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
          <polyline points="22 4 12 14.01 9 11.01"/>
        </svg>
      `;
    } else if (type === 'error') {
      iconSvg = `
        <svg class="toast-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="16" height="16">
          <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
        </svg>
      `;
    } else {
      iconSvg = `
        <svg class="toast-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="16" height="16">
          <circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/>
        </svg>
      `;
    }
    
    toast.innerHTML = `
      ${iconSvg}
      <span>${message}</span>
    `;
    container.appendChild(toast);
    
    setTimeout(() => {
      toast.classList.add('show');
    }, 50);
    
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => {
        toast.remove();
        if (container.childNodes.length === 0) {
          container.remove();
        }
      }, 300);
    }, 3000);
  }

  function saveRunToBackend(result, duration) {
    const filename = state.file ? state.file.name : 'sample_transactions.csv';
    const fileSizeBytes = state.file ? state.file.size : 1018;
    const countryRule = state.config.countryPhoneRule || 'GLOBAL';
    
    const issues = [
      ...result.errors,
      ...result.warnings
    ];

    const payload = {
      filename,
      fileSizeBytes,
      summary: result.summary,
      processingTimeMs: duration,
      countryRule,
      issues
    };

    fetch(API_BASE + '/api/runs', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    })
      .then(response => {
        if (!response.ok) throw new Error('Failed to save to SQLite backend');
        return response.json();
      })
      .then(data => {
        if (data.success) {
          showToast('Saved to history');
          loadHistory();
        }
      })
      .catch(err => {
        console.error('Error saving validation run:', err);
      });
  }

  function loadHistory() {
    const skeleton = document.getElementById('history-loading-skeleton');
    const tableBody = document.getElementById('history-table-body');
    const emptyMsg = document.getElementById('history-empty-msg');
    
    if (skeleton) skeleton.classList.remove('hidden');
    if (tableBody) tableBody.innerHTML = '';
    if (emptyMsg) emptyMsg.classList.add('hidden');

    // 1. Fetch Aggregated statistics
    fetch(API_BASE + '/api/stats')
      .then(res => res.json())
      .then(stats => {
        const filesEl = document.getElementById('history-stat-files');
        const rowsEl = document.getElementById('history-stat-rows');
        const scoreEl = document.getElementById('history-stat-score');
        
        if (filesEl) filesEl.textContent = stats.total_files_processed.toLocaleString();
        if (rowsEl) rowsEl.textContent = stats.total_rows_validated.toLocaleString();
        if (scoreEl) scoreEl.textContent = `${Number(stats.average_quality_score || 0).toFixed(1)}%`;
      })
      .catch(err => console.error('Error loading history statistics:', err));

    // 2. Fetch recent validation runs list
    fetch(API_BASE + '/api/runs')
      .then(res => res.json())
      .then(runs => {
        state.historyRuns = runs || [];
        renderHistoryTable();
      })
      .catch(err => {
        console.error('Error listing history runs:', err);
        if (skeleton) skeleton.classList.add('hidden');
      });
  }

  function renderHistoryTable() {
    const skeleton = document.getElementById('history-loading-skeleton');
    const tableBody = document.getElementById('history-table-body');
    const emptyMsg = document.getElementById('history-empty-msg');
    
    if (skeleton) skeleton.classList.add('hidden');
    if (tableBody) tableBody.innerHTML = '';
    
    const runs = [...state.historyRuns];
    
    if (!runs || runs.length === 0) {
      if (emptyMsg) emptyMsg.classList.remove('hidden');
      return;
    }
    if (emptyMsg) emptyMsg.classList.add('hidden');
    
    // Perform memory sort based on active field and direction
    const field = state.historySortField;
    const asc = state.historySortAscending;
    runs.sort((a, b) => {
      let valA = a[field];
      let valB = b[field];
      
      if (field === 'created_at') {
        valA = new Date(valA).getTime();
        valB = new Date(valB).getTime();
      }
      
      if (typeof valA === 'string') {
        return asc ? valA.localeCompare(valB) : valB.localeCompare(valA);
      } else {
        return asc ? valA - valB : valB - valA;
      }
    });
    
    if (tableBody) {
      runs.forEach(run => {
        const tr = document.createElement('tr');
        
        // Filename
        const tdFilename = document.createElement('td');
        tdFilename.textContent = run.filename;
        tdFilename.style.fontWeight = '700';
        tdFilename.style.color = 'var(--text-heading)';
        tr.appendChild(tdFilename);
        
        // Date
        const tdDate = document.createElement('td');
        const dateObj = new Date(run.created_at);
        tdDate.textContent = dateObj.toLocaleDateString() + ' ' + dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        tdDate.style.color = 'var(--text-muted)';
        tr.appendChild(tdDate);
        
        // Total Rows
        const tdTotal = document.createElement('td');
        tdTotal.textContent = run.total_rows.toLocaleString();
        tr.appendChild(tdTotal);
        
        // Valid Rows
        const tdValid = document.createElement('td');
        tdValid.textContent = run.valid_rows.toLocaleString();
        tdValid.style.color = 'var(--success-dark)';
        tdValid.style.fontWeight = '600';
        tr.appendChild(tdValid);
        
        // Invalid Rows
        const tdInvalid = document.createElement('td');
        tdInvalid.textContent = run.invalid_rows.toLocaleString();
        tdInvalid.style.color = run.invalid_rows > 0 ? 'var(--danger-dark)' : 'var(--text-body)';
        tdInvalid.style.fontWeight = run.invalid_rows > 0 ? '600' : '400';
        tr.appendChild(tdInvalid);
        
        // Quality Score
        const tdScore = document.createElement('td');
        const badge = document.createElement('span');
        const scoreVal = run.data_quality_score;
        if (scoreVal > 80) {
          badge.className = 'badge badge-completed';
        } else if (scoreVal >= 50) {
          badge.className = 'badge badge-completed-errors';
        } else {
          badge.className = 'badge badge-error';
        }
        badge.textContent = `${scoreVal.toFixed(1)}%`;
        tdScore.appendChild(badge);
        tr.appendChild(tdScore);

        // Actions
        const tdActions = document.createElement('td');
        tdActions.style.textAlign = 'right';
        tdActions.style.paddingRight = '1.5rem';
        
        // View Details button
        const btnView = document.createElement('button');
        btnView.className = 'btn btn-secondary btn-small';
        btnView.type = 'button';
        btnView.style.marginRight = '0.5rem';
        btnView.innerHTML = `
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="12" height="12">
            <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>
          </svg>
          View
        `;
        btnView.addEventListener('click', () => viewRunDetails(run.id));
        
        // Delete run button
        const btnDelete = document.createElement('button');
        btnDelete.className = 'btn btn-secondary btn-small';
        btnDelete.type = 'button';
        btnDelete.style.color = 'var(--danger)';
        btnDelete.style.borderColor = 'rgba(239, 68, 68, 0.2)';
        btnDelete.innerHTML = `
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="12" height="12">
            <polyline points="3 6 5 6 21 6"></polyline>
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
          </svg>
          Delete
        `;
        btnDelete.addEventListener('click', (e) => {
          e.stopPropagation();
          if (confirm(`Are you sure you want to delete the run record for "${run.filename}"?`)) {
            deleteRun(run.id);
          }
        });

        tdActions.appendChild(btnView);
        tdActions.appendChild(btnDelete);
        tr.appendChild(tdActions);

        tableBody.appendChild(tr);
      });
    }
  }

  function setupHistorySorting() {
    const historyHeaders = document.querySelectorAll('.history-table th');
    const sortFields = ['filename', 'created_at', 'total_rows', 'valid_rows', 'invalid_rows', 'data_quality_score'];
    const originalHeaderTexts = ['Filename', 'Validated At', 'Total Rows', 'Valid Rows', 'Invalid Rows', 'Quality Score'];
    
    historyHeaders.forEach((th, idx) => {
      if (idx < 6) {
        th.style.cursor = 'pointer';
        th.style.userSelect = 'none';
        th.addEventListener('click', () => {
          const clickedField = sortFields[idx];
          if (state.historySortField === clickedField) {
            state.historySortAscending = !state.historySortAscending;
          } else {
            state.historySortField = clickedField;
            state.historySortAscending = true;
          }
          
          // Update visual sort indicators inline
          historyHeaders.forEach((h, i) => {
            if (i < 6) {
              const field = sortFields[i];
              const baseText = originalHeaderTexts[i];
              if (state.historySortField === field) {
                h.innerHTML = `${baseText} ${state.historySortAscending ? '▲' : '▼'}`;
                h.style.color = 'var(--primary)';
              } else {
                h.innerHTML = baseText;
                h.style.color = '';
              }
            }
          });
          
          renderHistoryTable();
        });
      }
    });
  }

  function viewRunDetails(runId) {
    const panel = document.getElementById('details-panel');
    const overlay = document.getElementById('details-overlay');
    const title = document.getElementById('panel-title');
    const subtitle = document.getElementById('panel-subtitle');
    const scoreVal = document.getElementById('panel-metric-score');
    const totalVal = document.getElementById('panel-metric-total');
    const validVal = document.getElementById('panel-metric-valid');
    const invalidVal = document.getElementById('panel-metric-invalid');
    const container = document.getElementById('panel-errors-container');

    if (title) title.textContent = 'Loading details...';
    if (subtitle) subtitle.textContent = '';
    if (container) container.innerHTML = '<div style="text-align:center; padding: 2rem; color: var(--text-muted);">Fetching detailed logs...</div>';
    
    if (panel) panel.classList.add('open');
    if (overlay) overlay.classList.add('open');

    fetch(API_BASE + '/api/runs/' + runId)
      .then(res => {
        if (!res.ok) throw new Error('Run record not found');
        return res.json();
      })
      .then(run => {
        if (title) title.textContent = run.filename;
        if (subtitle) subtitle.textContent = `Validated on ${new Date(run.created_at).toLocaleString()}`;
        if (scoreVal) scoreVal.textContent = `${Number(run.data_quality_score || 0).toFixed(1)}%`;
        if (totalVal) totalVal.textContent = run.total_rows.toLocaleString();
        if (validVal) validVal.textContent = run.valid_rows.toLocaleString();
        if (invalidVal) invalidVal.textContent = run.invalid_rows.toLocaleString();

        if (container) {
          container.innerHTML = '';
          const keys = Object.keys(run.errors);
          if (keys.length === 0) {
            container.innerHTML = `
              <div class="empty-state-msg empty-state-success" style="margin-top: 1rem;">
                <svg class="empty-state-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
                </svg>
                No errors or warnings found! Your data is 100% clean.
              </div>
            `;
            return;
          }

          keys.sort().forEach(colName => {
            const issues = run.errors[colName];
            
            const groupDiv = document.createElement('div');
            groupDiv.style.marginBottom = '1.5rem';
            
            const titleDiv = document.createElement('div');
            titleDiv.className = 'panel-group-title';
            titleDiv.textContent = `Column: ${colName} (${issues.length} issue${issues.length !== 1 ? 's' : ''})`;
            groupDiv.appendChild(titleDiv);
            
            const table = document.createElement('table');
            table.className = 'panel-error-table';
            
            table.innerHTML = `
              <thead>
                <tr>
                  <th style="width: 50px;">Row</th>
                  <th style="width: 80px;">Severity</th>
                  <th>Error Type</th>
                  <th>Value</th>
                  <th>Suggested Fix</th>
                </tr>
              </thead>
              <tbody></tbody>
            `;
            
            const tbody = table.querySelector('tbody');
            issues.forEach(issue => {
              const tr = document.createElement('tr');
              
              const tdRow = document.createElement('td');
              tdRow.textContent = issue.row;
              tr.appendChild(tdRow);
              
              const tdSev = document.createElement('td');
              const badge = document.createElement('span');
              badge.className = `badge ${issue.severity === 'ERROR' ? 'badge-error' : 'badge-warning'}`;
              badge.textContent = issue.severity;
              tdSev.appendChild(badge);
              tr.appendChild(tdSev);
              
              const tdType = document.createElement('td');
              tdType.textContent = issue.type;
              tdType.style.fontWeight = '600';
              tr.appendChild(tdType);
              
              const tdVal = document.createElement('td');
              tdVal.textContent = issue.value || 'N/A';
              tdVal.style.color = 'var(--text-muted)';
              tr.appendChild(tdVal);
              
              const tdFix = document.createElement('td');
              tdFix.textContent = issue.suggestedFix;
              tr.appendChild(tdFix);
              
              tbody.appendChild(tr);
            });
            
            groupDiv.appendChild(table);
            container.appendChild(groupDiv);
          });
        }
      })
      .catch(err => {
        console.error('Error fetching details:', err);
        if (title) title.textContent = 'Error Loading Details';
        if (container) container.innerHTML = `<div style="text-align:center; padding: 2rem; color: var(--danger);">Failed to load validation details.</div>`;
      });
  }

  function deleteRun(runId) {
    fetch(API_BASE + '/api/runs/' + runId, {
      method: 'DELETE'
    })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          showToast('Run deleted from history');
          loadHistory();
        }
      })
      .catch(err => console.error('Error deleting run:', err));
  }

})();
