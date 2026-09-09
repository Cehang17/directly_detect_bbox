/**
 * App Controller - SignForDeaf PDF Reader & JSON Sentence Editor
 */

function initApp() {
  // Application State
  const state = {
    pdfLoaded: false,
    jsonLoaded: false,
    rawJsonData: null,
    parsedBBoxes: [],
    detectedTables: [],
    currentTableFilter: 'ALL',
    selectedBBox: null,
    selectedIndex: 0,
    activePage: 1,
    totalPages: 0,
    zoomScale: 1.5, // 150% as seen in screenshot
    drawMode: false,
    showAllSentences: true,
    sentenceMode: 'create', // 'create' or 'add_existed'
    pdfFileName: '',
    jsonFileName: ''
  };

  // DOM Elements
  const elements = {
    // Drop Zone & Viewport
    dropZone: document.getElementById('drop-zone'),
    pdfScrollView: document.getElementById('pdf-scroll-view'),
    viewportBanner: document.getElementById('viewport-banner'),
    bannerCloseBtn: document.getElementById('banner-close-btn'),

    // Dedicated Button Triggers
    topPdfBtn: document.getElementById('top-pdf-btn'),
    dropPdfBtn: document.getElementById('drop-pdf-btn'),
    topJsonBtn: document.getElementById('top-json-btn'),
    dropJsonBtn: document.getElementById('drop-json-btn'),
    bannerJsonBtn: document.getElementById('banner-json-btn'),

    // Table Inspector Triggers & Modal Elements
    topTablesBtn: document.getElementById('top-tables-btn'),
    tablesBadge: document.getElementById('tables-badge'),
    tablesModal: document.getElementById('tables-modal'),
    tablesModalClose: document.getElementById('tables-modal-close'),
    tablesModalBackdrop: document.getElementById('tables-modal-backdrop'),
    tablesCardsContainer: document.getElementById('tables-cards-container'),
    tablesEmptyState: document.getElementById('tables-empty-state'),
    filterTabs: document.querySelectorAll('.tables-filter-bar .filter-tab'),

    // Counts on tabs
    countAll: document.getElementById('count-all'),
    countMatrix: document.getElementById('count-matrix'),
    countKv: document.getElementById('count-kv'),
    countParallel: document.getElementById('count-parallel'),
    countMerged: document.getElementById('count-merged'),
    countFormula: document.getElementById('count-formula'),
    countHybrid: document.getElementById('count-hybrid'),

    // Hidden Native Inputs
    topPdfInput: document.getElementById('top-pdf-input'),
    dropPdfInput: document.getElementById('drop-pdf-input'),
    topJsonInput: document.getElementById('top-json-input'),
    dropJsonInput: document.getElementById('drop-json-input'),
    bannerJsonInput: document.getElementById('banner-json-input'),

    // Live Status Chips & Hint
    cardStatusPdf: document.getElementById('card-status-pdf'),
    cardPdfDesc: document.getElementById('card-pdf-desc'),
    cardStatusJson: document.getElementById('card-status-json'),
    cardJsonDesc: document.getElementById('card-json-desc'),
    dropHintMsg: document.getElementById('drop-hint-msg'),
    dropPdfBtnText: document.getElementById('drop-pdf-btn-text'),
    dropJsonBtnText: document.getElementById('drop-json-btn-text'),
    topbarStatusTag: document.getElementById('topbar-status-tag'),

    // Topbar Zoom & Page Controls
    zoomOutBtn: document.getElementById('zoom-out-btn'),
    zoomInBtn: document.getElementById('zoom-in-btn'),
    zoomValue: document.getElementById('zoom-value'),
    pageNumberInput: document.getElementById('page-number-input'),
    pageTotalLabel: document.getElementById('page-total-label'),
    exportJsonBtn: document.getElementById('export-json-btn'),

    // Topbar Audio TTS Controls
    ttsPlayBtn: document.getElementById('tts-play-btn'),
    ttsSpeakSelectedBtn: document.getElementById('tts-speak-selected-btn'),
    ttsStopBtn: document.getElementById('tts-stop-btn'),
    ttsSpeedSelect: document.getElementById('tts-speed-select'),

    // Sidebar Action Buttons
    prevBtn: document.getElementById('prev-btn'),
    nextBtn: document.getElementById('next-btn'),
    removeBtn: document.getElementById('remove-btn'),

    // Sidebar Mode Toggles
    drawModeOffBtn: document.getElementById('draw-mode-off-btn'),
    drawModeOnBtn: document.getElementById('draw-mode-on-btn'),
    createSentenceBtn: document.getElementById('create-sentence-btn'),
    addExistedSentenceBtn: document.getElementById('add-existed-sentence-btn'),
    justSelectedBtn: document.getElementById('just-selected-btn'),
    allSentenceBtn: document.getElementById('all-sentence-btn'),

    // Form Inputs & Sidebar Table Info
    bboxIdInput: document.getElementById('bbox-id-input'),
    saveIdBtn: document.getElementById('save-id-btn'),
    sidebarTableInfo: document.getElementById('sidebar-table-info'),
    sidebarTableTypeBadge: document.getElementById('sidebar-table-type-badge'),
    sidebarTableOrderBadge: document.getElementById('sidebar-table-order-badge'),
    sidebarTableTypeSelect: document.getElementById('sidebar-table-type-select'),
    sidebarTableTypeDesc: document.getElementById('sidebar-type-desc'),
    saveTableTypeBtn: document.getElementById('save-table-type-btn'),
    bboxTextInput: document.getElementById('bbox-text-input'),
    saveTextBtn: document.getElementById('save-text-btn'),
    sidebarSpeakBtn: document.getElementById('sidebar-speak-btn'),

    // Toast
    toastContainer: document.getElementById('toast-container')
  };

  // Helper file readers (safe cross-browser)
  function readFileAsArrayBuffer(file) {
    if (file.arrayBuffer) return file.arrayBuffer();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error || new Error('Dosya okunamadı'));
      reader.readAsArrayBuffer(file);
    });
  }

  function readFileAsText(file) {
    if (file.text) return file.text();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error || new Error('Dosya okunamadı'));
      reader.readAsText(file, 'utf-8');
    });
  }

  // Initialize Overlay & PDF Viewer & TTS Reader
  const overlayManager = new BBoxOverlayManager();
  const pdfViewer = new PDFViewer(elements.pdfScrollView, overlayManager);
  const ttsReader = new TTSReader(overlayManager, pdfViewer);
  pdfViewer.scale = state.zoomScale;

  // Sync Overlay Callbacks
  overlayManager.onSelect((bboxItem) => {
    selectSentence(bboxItem, false);
  });

  overlayManager.onNewDrawn((newItem) => {
    state.parsedBBoxes = overlayManager.getAllItems();
    ttsReader.setItems(state.parsedBBoxes);
    updateDetectedTables();
    selectSentence(newItem, false);
    showToast('Yeni BBox oluşturuldu.', 'success');
  });

  pdfViewer.onPageChangeCallback = (curr, total) => {
    state.activePage = curr;
    state.totalPages = total;
    elements.pageNumberInput.value = curr;
    elements.pageTotalLabel.textContent = `/ ${total}`;
  };

  pdfViewer.onScaleChangeCallback = (scale) => {
    state.zoomScale = scale;
    elements.zoomValue.textContent = `%${Math.round(scale * 100)}`;
  };


  function updateTopbarStatus() {
    if (!elements.topbarStatusTag) return;
    const parts = [];
    if (state.pdfFileName) {
      parts.push(`<span class="file-pill"><i class="fa-solid fa-file-pdf"></i> ${state.pdfFileName}</span>`);
    }
    if (state.jsonFileName) {
      parts.push(`<span class="file-pill"><i class="fa-solid fa-file-code"></i> ${state.jsonFileName} (${state.parsedBBoxes.length} BBox)</span>`);
    }
    if (parts.length > 0) {
      elements.topbarStatusTag.innerHTML = parts.join('<span style="color:rgba(255,255,255,0.2)">|</span>');
      elements.topbarStatusTag.classList.remove('hidden');
    }
  }

  // =========================================================================
  // Table Extraction & Classification Aggregator
  // =========================================================================

  // Spatial connected-component clustering to isolate separate tables on the same page
  function clusterTableCells(allItems) {
    const pageMap = new Map();
    (allItems || []).forEach(it => {
      const page = it.page || 1;
      if (!pageMap.has(page)) pageMap.set(page, []);
      pageMap.get(page).push(it);
    });

    const allClusters = [];

    for (const [pageNum, items] of pageMap.entries()) {
      const tableCells = items.filter(it => {
        const cat = String(it.category || it.type || '').toLowerCase();
        if (cat === 'plain text' || cat === 'title' || cat === 'paragraph' || cat === 'header' || cat === 'abandon') {
          if (!it.table_type && (it.table_order_id === null || it.table_order_id === undefined)) return false;
        }
        return it.table_id || it.table_type || (it.table_order_id !== null && it.table_order_id !== undefined) ||
               cat.includes('table') || cat.includes('tablo') || cat.includes('grid') || cat.includes('matrix') ||
               (typeof it.text === 'string' && it.text.includes('|') && it.text.split('\n').length >= 2);
      });

      if (tableCells.length === 0) continue;

      const visited = new Set();
      let clusterCounter = 1;

      // Sort cells by top-to-bottom Y0
      const sortedCells = [...tableCells].sort((a, b) => {
        const aBox = a.rawCoords || a.bbox || [0, 0, 0, 0];
        const bBox = b.rawCoords || b.bbox || [0, 0, 0, 0];
        return aBox[1] - bBox[1];
      });

      sortedCells.forEach(cell => {
        if (visited.has(String(cell.id))) return;

        const cluster = [cell];
        visited.add(String(cell.id));
        let expanded = true;

        while (expanded) {
          expanded = false;
          for (const candidate of sortedCells) {
            if (visited.has(String(candidate.id))) continue;

            // If explicitly belonging to the same distinct table_id
            if (cell.table_id && candidate.table_id && cell.table_id === candidate.table_id && !cell.table_id.endsWith('-tbl')) {
              cluster.push(candidate);
              visited.add(String(candidate.id));
              expanded = true;
              continue;
            }

            // Spatial proximity: must be adjacent within reasonable bounding box gap
            const b = candidate.rawCoords || candidate.bbox || [0, 0, 0, 0];
            const isNearby = cluster.some(member => {
              const mb = member.rawCoords || member.bbox || [0, 0, 0, 0];
              const overlapX = Math.max(0, Math.min(b[2], mb[2]) - Math.max(b[0], mb[0]));
              const overlapY = Math.max(0, Math.min(b[3], mb[3]) - Math.max(b[1], mb[1]));
              const gapX = Math.max(0, Math.max(b[0], mb[0]) - Math.min(b[2], mb[2]));
              const gapY = Math.max(0, Math.max(b[1], mb[1]) - Math.min(b[3], mb[3]));

              // Horizontal row neighbor: high Y overlap, small X gap
              if (overlapY > 5 && gapX < 150) return true;
              // Vertical column neighbor: high X overlap, small Y gap
              if (overlapX > 5 && gapY < 45) return true;
              // Diagonal/grid neighbor
              if (gapX < 75 && gapY < 35) return true;
              return false;
            });

            if (isNearby) {
              cluster.push(candidate);
              visited.add(String(candidate.id));
              expanded = true;
            }
          }
        }

        const clusterTableId = (cell.table_id && !cell.table_id.endsWith('-tbl'))
          ? cell.table_id
          : `table-p${pageNum}-${clusterCounter++}`;

        // Ensure every cell in this cluster has this unique table_id
        cluster.forEach(c => {
          c.table_id = clusterTableId;
          c.category = 'Table Cell';
        });

        allClusters.push({
          id: clusterTableId,
          page: pageNum,
          type: cluster.find(c => c.table_type)?.table_type || 'A_MATRIX',
          cells: cluster
        });
      });
    }

    return allClusters;
  }

  function updateDetectedTables() {
    state.detectedTables = clusterTableCells(state.parsedBBoxes);

    // Auto-classify any table cluster and assign table_order_id / fullSentenceText if needed
    state.detectedTables.forEach((tbl, idx) => {
      const Classifier = (typeof TableClassifier !== 'undefined') ? TableClassifier : null;

      if (Classifier && typeof Classifier.processTable === 'function') {
        const existingType = tbl.cells.find(c => c.table_type)?.table_type;
        const res = Classifier.processTable({
          id: tbl.id,
          page: tbl.page,
          cells: tbl.cells,
          forced_type: existingType || undefined
        }, tbl.page, tbl.cells[0]?.sentence_id || (idx + 1), idx + 1);
        if (res) {
          tbl.type = res.tableType || tbl.type || 'A_MATRIX';
          if (Array.isArray(res.items)) {
            res.items.forEach(tItem => {
              const match = tbl.cells.find(c => String(c.id) === String(tItem.id)) ||
                            tbl.cells.find(c => c.text === tItem.text && c.page === tItem.page);
              if (match) {
                match.table_type = res.tableType;
                match.table_order_id = tItem.table_order_id;
                match.table_order_label = tItem.table_order_label;
                if (tItem.fullSentenceText) match.fullSentenceText = tItem.fullSentenceText;
              }
            });
          }
        }
      }
      tbl.cells.sort((a, b) => (a.table_order_id || 0) - (b.table_order_id || 0));
    });

    // Update Tab Counts
    const counts = {
      ALL: state.detectedTables.length,
      A_MATRIX: 0,
      B_KEY_VALUE: 0,
      C_PARALLEL_TEXT: 0,
      D_MERGED_CELLS: 0,
      E_FORMULA: 0,
      F_HYBRID_NOTE: 0
    };

    state.detectedTables.forEach(t => {
      if (counts[t.type] !== undefined) {
        counts[t.type]++;
      }
    });

    if (elements.countAll) elements.countAll.textContent = counts.ALL;
    if (elements.countMatrix) elements.countMatrix.textContent = counts.A_MATRIX;
    if (elements.countKv) elements.countKv.textContent = counts.B_KEY_VALUE;
    if (elements.countParallel) elements.countParallel.textContent = counts.C_PARALLEL_TEXT;
    if (elements.countMerged) elements.countMerged.textContent = counts.D_MERGED_CELLS;
    if (elements.countFormula) elements.countFormula.textContent = counts.E_FORMULA;
    if (elements.countHybrid) elements.countHybrid.textContent = counts.F_HYBRID_NOTE;

    if (elements.tablesBadge) {
      if (counts.ALL > 0) {
        elements.tablesBadge.textContent = counts.ALL;
        elements.tablesBadge.classList.remove('hidden');
      } else {
        elements.tablesBadge.classList.add('hidden');
      }
    }
  }

  function renderTablesModal() {
    if (!elements.tablesCardsContainer || !elements.tablesEmptyState) return;

    const filtered = state.currentTableFilter === 'ALL'
      ? state.detectedTables
      : state.detectedTables.filter(t => t.type === state.currentTableFilter);

    if (filtered.length === 0) {
      elements.tablesCardsContainer.innerHTML = '';
      elements.tablesCardsContainer.classList.add('hidden');
      elements.tablesEmptyState.classList.remove('hidden');
      return;
    }

    elements.tablesEmptyState.classList.add('hidden');
    elements.tablesCardsContainer.classList.remove('hidden');

    const typeNames = {
      A_MATRIX: '1. Klasik Matris Tablo',
      B_KEY_VALUE: '2. Etiket - Değer / Form Yapısı',
      C_PARALLEL_TEXT: '3. Paralel Paragraf / Sahte Tablo',
      D_MERGED_CELLS: '4. Birleşik Hücreli / Hiyerarşik Tablo',
      E_FORMULA: '5. Formül & Hesaplama Tablosu',
      F_HYBRID_NOTE: '6. Dipnotlu / Açıklamalı Hibrit Tablo'
    };

    elements.tablesCardsContainer.innerHTML = filtered.map((tbl, tIdx) => {
      const typeLabel = typeNames[tbl.type] || tbl.type;
      const rowsHtml = tbl.cells.map(c => `
        <tr class="table-cell-row" data-id="${c.id}">
          <td style="width: 110px;">
            <span class="order-badge-mini" title="Tabloya Özel 2. Okuma Sırası">
              <i class="fa-solid fa-list-ol"></i> #${c.table_order_id !== undefined ? c.table_order_id : '-'}
            </span>
          </td>
          <td style="width: 90px;">
            <span class="global-id-badge-mini" title="Genel Belge Sırası (ID)">
              ID #${c.id_display !== undefined ? c.id_display : c.sentence_id}
            </span>
          </td>
          <td style="font-weight: 500;">${escapeHtml(c.text || '')}</td>
          <td class="speech-text-preview">${escapeHtml(c.fullSentenceText || c.text || '')}</td>
        </tr>
      `).join('');

      return `
        <div class="table-card" id="card-${tbl.id}">
          <div class="table-card-header">
            <div class="table-card-title-wrap">
              <span class="table-card-title"><i class="fa-solid fa-table"></i> ${tbl.id}</span>
              <span class="table-type-tag ${tbl.type}">${typeLabel}</span>
              <span class="table-card-meta-pill">Sayfa ${tbl.page}</span>
              <span class="table-card-meta-pill">${tbl.cells.length} Hücre</span>
            </div>
            <div class="table-card-actions">
              <button type="button" class="table-action-btn play-table-btn" data-table-id="${tbl.id}">
                <i class="fa-solid fa-volume-high"></i> Tabloyu Oku (TTS)
              </button>
              <button type="button" class="table-action-btn focus-table-btn" data-table-id="${tbl.id}">
                <i class="fa-solid fa-eye"></i> PDF'de Göster
              </button>
            </div>
          </div>
          <div class="table-card-content">
            <table class="table-cells-preview-table">
              <thead>
                <tr>
                  <th>Tablo Okuma Sırası</th>
                  <th>Genel ID</th>
                  <th>Hücre Metni</th>
                  <th>Semantik Sesli Okuma İfadesi (fullSentenceText)</th>
                </tr>
              </thead>
              <tbody>
                ${rowsHtml}
              </tbody>
            </table>
          </div>
        </div>
      `;
    }).join('');

    // Attach row click listeners to select cell in main view
    elements.tablesCardsContainer.querySelectorAll('.table-cell-row').forEach(row => {
      row.addEventListener('click', () => {
        const id = row.dataset.id;
        const target = state.parsedBBoxes.find(b => String(b.id) === String(id));
        if (target) {
          elements.tablesModal.classList.add('hidden');
          selectSentence(target, true);
        }
      });
    });

    // Attach speak table button listeners
    elements.tablesCardsContainer.querySelectorAll('.play-table-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const tId = btn.dataset.tableId;
        const tbl = state.detectedTables.find(t => t.id === tId);
        if (tbl && tbl.cells.length > 0) {
          elements.tablesModal.classList.add('hidden');
          ttsReader.play(tbl.cells[0]);
          showToast(`${tbl.id} tablosu seslendiriliyor (${tbl.cells.length} hücre)`, 'info');
        }
      });
    });

    // Attach focus table button listeners
    elements.tablesCardsContainer.querySelectorAll('.focus-table-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const tId = btn.dataset.tableId;
        const tbl = state.detectedTables.find(t => t.id === tId);
        if (tbl && tbl.cells.length > 0) {
          elements.tablesModal.classList.add('hidden');
          selectSentence(tbl.cells[0], true);
        }
      });
    });
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  // Modal Open / Close Handlers
  if (elements.topTablesBtn) {
    elements.topTablesBtn.addEventListener('click', () => {
      updateDetectedTables();
      renderTablesModal();
      if (elements.tablesModal) {
        elements.tablesModal.classList.remove('hidden');
      }
    });
  }

  if (elements.tablesModalClose) {
    elements.tablesModalClose.addEventListener('click', () => {
      if (elements.tablesModal) elements.tablesModal.classList.add('hidden');
    });
  }

  if (elements.tablesModalBackdrop) {
    elements.tablesModalBackdrop.addEventListener('click', () => {
      if (elements.tablesModal) elements.tablesModal.classList.add('hidden');
    });
  }

  // Filter Tabs Listeners
  if (elements.filterTabs) {
    elements.filterTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        elements.filterTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        state.currentTableFilter = tab.dataset.type || 'ALL';
        renderTablesModal();
      });
    });
  }

  // =========================================================================
  // File Loading Logic
  // =========================================================================

  async function loadPDFFile(file) {
    if (!file) return;
    try {
      showToast(`PDF yükleniyor: ${file.name}`, 'info');
      state.pdfFileName = file.name;
      const arrayBuffer = await readFileAsArrayBuffer(file);
      const uint8 = new Uint8Array(arrayBuffer);

      await pdfViewer.loadDocument(uint8);
      
      state.pdfLoaded = true;
      elements.pageNumberInput.disabled = false;

      // Update card status
      if (elements.cardStatusPdf) {
        elements.cardStatusPdf.className = 'status-chip loaded';
      }
      if (elements.cardPdfDesc) {
        elements.cardPdfDesc.textContent = `${file.name} (${state.totalPages} sayfa)`;
      }
      if (elements.dropPdfBtnText) {
        elements.dropPdfBtnText.textContent = 'PDF Değiştir';
      }

      // Switch to scroll view
      elements.dropZone.style.display = 'none';
      elements.dropZone.classList.add('hidden');
      elements.pdfScrollView.style.display = 'flex';
      elements.pdfScrollView.classList.remove('hidden');

      updateTopbarStatus();

      if (state.parsedBBoxes.length > 0) {
        overlayManager.setData(state.parsedBBoxes);
        await pdfViewer.reRenderOverlays();
        if (elements.viewportBanner) elements.viewportBanner.classList.add('hidden');
        showToast(`PDF & JSON hazır (${state.parsedBBoxes.length} BBox)`, 'success');
      } else {
        if (elements.viewportBanner) {
          elements.viewportBanner.classList.remove('hidden');
          const bText = document.getElementById('banner-text');
          if (bText) bText.textContent = `"${file.name}" yüklendi. Cümle kutularını görmek için JSON dosyanızı seçin:`;
        }
        showToast(`PDF yüklendi (${state.totalPages} sayfa). Şimdi JSON dosyasını seçebilirsiniz.`, 'info');
      }
    } catch (err) {
      console.error('PDF Load Error:', err);
      showToast(`PDF yükleme hatası: ${err.message || err}`, 'error');
      if (elements.dropHintMsg) {
        elements.dropHintMsg.className = 'drop-hint-msg error';
        elements.dropHintMsg.textContent = `PDF okunamadı: ${err.message || err}`;
        elements.dropHintMsg.classList.remove('hidden');
      }
    }
  }

  async function loadJSONFile(file) {
    if (!file) return;
    let step = 'Dosya Okuma';
    try {
      showToast('JSON okunuyor...', 'info');
      state.jsonFileName = file.name;
      
      step = 'Metin Okuma';
      let text = await readFileAsText(file);
      text = text.trim();
      let jsonData = null;

      step = 'JSON Ayrıştırma';
      try {
        jsonData = JSON.parse(text);
      } catch {
        try {
          jsonData = JSON.parse(`[${text.replace(/^,/, '').replace(/,$/, '').trim()}]`);
        } catch {
          const matches = text.match(/\{[\s\S]*?\}(?=\s*(?:,|\n|\]|\}|$))/g);
          if (matches) {
            jsonData = matches.map(m => JSON.parse(m));
          } else {
            throw new Error('Geçerli bir JSON verisi bulunamadı.');
          }
        }
      }

      state.rawJsonData = jsonData;

      step = 'BBoxParser.parse';
      let parsedResult = [];
      try {
        // Aşama logları ile parse et
        console.log('[PARSE] Adım 1: _extractDeep başlıyor...');
        const rawItems = BBoxParser._extractDeep(jsonData);
        console.log('[PARSE] Adım 1 bitti. rawItems sayısı:', Array.isArray(rawItems) ? rawItems.length : typeof rawItems);

        console.log('[PARSE] Adım 2: BBoxParser.parse tam çağrılıyor...');
        parsedResult = BBoxParser.parse(jsonData, 'auto', 'top') || [];
        console.log('[PARSE] Adım 2 bitti. parsedResult sayısı:', parsedResult.length);
      } catch (parseErr) {
        console.error('BBoxParser.parse iç hata:', parseErr.stack || parseErr);
        // Temel hata kurtarma: raw json'u minimal şekilde parse et
        const flatItems = Array.isArray(jsonData) ? jsonData : (jsonData && Array.isArray(jsonData.items) ? jsonData.items : (jsonData && Array.isArray(jsonData.blocks) ? jsonData.blocks : (jsonData && Array.isArray(jsonData.sentences) ? jsonData.sentences : [])));
        if (flatItems.length > 0) {
          parsedResult = flatItems.slice(0, 5000).filter(it => it && typeof it === 'object').map((it, idx) => {
            const bboxRaw = it.bbox || it.box || it.coords || it.rawCoords || it.boundingBox || [0, 0, 100, 20];
            let nums = [0, 0, 100, 20];
            if (Array.isArray(bboxRaw) && bboxRaw.length >= 4) {
              nums = bboxRaw.slice(0, 4).map(Number);
            }
            return {
              id: it.id || `bbox-fallback-${idx + 1}`,
              index: idx,
              id_display: idx + 1,
              page: it.page || it.page_number || 1,
              text: it.text || it.content || it.sentence || it.ocr_text || `BBox #${idx + 1}`,
              fullSentenceText: it.fullSentenceText || it.text || it.content || '',
              confidence: it.confidence || 0.98,
              category: it.category || it.type || 'Plain Text',
              rawBox: bboxRaw,
              rawCoords: [Math.min(nums[0]||0, nums[2]||0), Math.min(nums[1]||0, nums[3]||0),
                          Math.max(nums[0]||0, nums[2]||0), Math.max(nums[1]||0, nums[3]||0)],
              coordType: 'abs_points',
              table_id: it.table_id || null,
              table_type: it.table_type || null,
              table_order_id: it.table_order_id !== undefined ? it.table_order_id : null,
              table_order_label: it.table_order_label || null,
              sentence_id: idx + 1,
              layoutProcessed: false
            };
          });
        }
        showToast(`JSON kısmen yüklendi (parse hatası kurtarıldı): ${parseErr.message}`, 'info');
      }
      state.parsedBBoxes = parsedResult;


      step = 'overlayManager.setData';
      overlayManager.setData(state.parsedBBoxes);

      step = 'ttsReader.setItems';
      ttsReader.setItems(state.parsedBBoxes);

      step = 'updateDetectedTables';
      updateDetectedTables();

      step = 'selectSentence';
      if (state.parsedBBoxes && state.parsedBBoxes.length > 0) {
        selectSentence(state.parsedBBoxes[0], false);
      }

      // Update card status
      if (elements.cardStatusJson) {
        elements.cardStatusJson.className = 'status-chip loaded';
      }
      if (elements.cardJsonDesc) {
        elements.cardJsonDesc.textContent = `${file.name} (${state.parsedBBoxes.length} BBox, ${(state.detectedTables || []).length} Tablo)`;
      }
      if (elements.dropJsonBtnText) {
        elements.dropJsonBtnText.textContent = 'JSON Değiştir';
      }

      updateTopbarStatus();

      if (state.pdfLoaded) {
        step = 'pdfViewer.reRenderOverlays';
        elements.dropZone.style.display = 'none';
        elements.dropZone.classList.add('hidden');
        elements.pdfScrollView.style.display = 'flex';
        elements.pdfScrollView.classList.remove('hidden');
        if (elements.viewportBanner) elements.viewportBanner.classList.add('hidden');
        await pdfViewer.reRenderOverlays();
        showToast(`JSON yüklendi (${state.parsedBBoxes.length} BBox, ${(state.detectedTables || []).length} Tablo)`, 'success');
      } else {
        if (elements.dropHintMsg) {
          elements.dropHintMsg.className = 'drop-hint-msg success';
          elements.dropHintMsg.textContent = `✓ "${file.name}" yüklendi (${state.parsedBBoxes.length} cümle). Kutuları görmek için lütfen PDF dosyasını seçin.`;
          elements.dropHintMsg.classList.remove('hidden');
        }
        showToast(`JSON yüklendi (${state.parsedBBoxes.length} BBox). Lütfen şimdi PDF dosyasını seçin.`, 'success');
      }
    } catch (err) {
      console.error(`JSON Load Error at [${step}]:`, err.stack || err);
      showToast(`JSON hatası [${step}]: ${err.message || err}`, 'error');
      if (elements.dropHintMsg) {
        elements.dropHintMsg.className = 'drop-hint-msg error';
        elements.dropHintMsg.textContent = `JSON okunamadı [${step}]: ${err.message || err}`;
        elements.dropHintMsg.classList.remove('hidden');
      }
    }
  }

  // Explicit Button Click Triggers
  if (elements.topPdfBtn && elements.topPdfInput) {
    elements.topPdfBtn.addEventListener('click', () => elements.topPdfInput.click());
  }
  if (elements.dropPdfBtn && elements.dropPdfInput) {
    elements.dropPdfBtn.addEventListener('click', () => elements.dropPdfInput.click());
  }
  if (elements.topJsonBtn && elements.topJsonInput) {
    elements.topJsonBtn.addEventListener('click', () => elements.topJsonInput.click());
  }
  if (elements.dropJsonBtn && elements.dropJsonInput) {
    elements.dropJsonBtn.addEventListener('click', () => elements.dropJsonInput.click());
  }
  if (elements.bannerJsonBtn && elements.bannerJsonInput) {
    elements.bannerJsonBtn.addEventListener('click', () => elements.bannerJsonInput.click());
  }

  // Safe Native File Input Change Listeners
  const pdfInputList = [elements.topPdfInput, elements.dropPdfInput].filter(Boolean);
  pdfInputList.forEach(inp => {
    inp.addEventListener('change', async (e) => {
      const file = e.target.files && e.target.files[0];
      if (file) {
        await loadPDFFile(file);
      }
      inp.value = '';
    });
  });

  const jsonInputList = [elements.topJsonInput, elements.dropJsonInput, elements.bannerJsonInput].filter(Boolean);
  jsonInputList.forEach(inp => {
    inp.addEventListener('change', async (e) => {
      const file = e.target.files && e.target.files[0];
      if (file) {
        await loadJSONFile(file);
      }
      inp.value = '';
    });
  });

  // Safe Drag & Drop on window
  window.addEventListener('dragover', (e) => {
    e.preventDefault();
    e.stopPropagation();
  });

  window.addEventListener('drop', async (e) => {
    e.preventDefault();
    e.stopPropagation();

    const files = Array.from(e.dataTransfer?.files || []);
    if (files.length === 0) return;

    let pdfFile = null;
    let jsonFile = null;

    for (const f of files) {
      const lower = f.name.toLowerCase();
      if (lower.endsWith('.pdf')) pdfFile = f;
      else if (lower.endsWith('.json') || lower.endsWith('.txt')) jsonFile = f;
    }

    if (jsonFile) await loadJSONFile(jsonFile);
    if (pdfFile) await loadPDFFile(pdfFile);
  });

  if (elements.bannerCloseBtn && elements.viewportBanner) {
    elements.bannerCloseBtn.addEventListener('click', () => {
      elements.viewportBanner.classList.add('hidden');
    });
  }

  // =========================================================================
  // Selection & Right Sidebar Sync
  // =========================================================================

  function selectSentence(bboxItem, scrollPdf = true) {
    if (!bboxItem) return;
    state.selectedBBox = bboxItem;
    state.selectedIndex = state.parsedBBoxes.findIndex(b => String(b.id) === String(bboxItem.id));

    // Update overlay active state
    overlayManager.selectBBox(bboxItem.id, false);

    // Update sidebar inputs
    const displayId = (bboxItem.id_display !== undefined && bboxItem.id_display !== null)
      ? bboxItem.id_display
      : ((bboxItem.sentence_id !== undefined && bboxItem.sentence_id !== null) ? bboxItem.sentence_id : bboxItem.index);
    elements.bboxIdInput.value = displayId;

    const TABLE_TYPE_DESCS = {
      A_MATRIX:       '📊 Satır × Sütun matris. Okuma: soldan sağa, yukarıdan aşağıya (Z-yolu).',
      B_KEY_VALUE:    '🏷️ Etiket:Değer çifti. Okuma: her satırda sol=etiket → sağ=değer.',
      C_PARALLEL_TEXT:'📄 Her sütun bağımsız paragraf. Okuma: sütun sütun, yukarıdan aşağıya.',
      D_MERGED_CELLS: '🔀 Birleşik hücreli hiyerarşi. Okuma: önce başlık satırları, sonra veri.',
      E_FORMULA:      '🧮 Matematiksel ifade. Okuma: formül bağlamıyla birlikte sıralanır.',
      F_HYBRID_NOTE:  '📝 Dipnotlu hibrit tablo. Okuma: ana tablo tamamlandıktan sonra dipnotlar okunur.',
      NOT_TABLE:      '🚫 Tablo formatından çıkarıldı.'
    };

    if (elements.sidebarTableInfo) {
      const isTable = !!(bboxItem.table_type || bboxItem.category === 'Table Cell' || (bboxItem.table_order_id !== null && bboxItem.table_order_id !== undefined));
      elements.sidebarTableInfo.style.display = isTable ? 'block' : 'none';
      if (isTable) {
        const curType = bboxItem.table_type || 'A_MATRIX';
        if (elements.sidebarTableTypeBadge) elements.sidebarTableTypeBadge.textContent = curType;
        if (elements.sidebarTableOrderBadge) elements.sidebarTableOrderBadge.textContent = `Tablo Sırası: #${bboxItem.table_order_id !== undefined && bboxItem.table_order_id !== null ? bboxItem.table_order_id : '1'}`;
        if (elements.sidebarTableTypeSelect) elements.sidebarTableTypeSelect.value = curType;
        if (elements.sidebarTableTypeDesc) elements.sidebarTableTypeDesc.textContent = TABLE_TYPE_DESCS[curType] || 'Tablo tipini değiştirerek okuma sırasını yeniden hesaplayabilirsiniz.';

        // Render Table Cell Accessibility (a11y) Panel
        const a11yContainer = document.getElementById('a11y-panel-container');
        if (a11yContainer && typeof renderA11yPanel === 'function') {
          let parentTable = (state.detectedTables || []).find(t => (t.id && t.id === bboxItem.table_id) || (Array.isArray(t.cells) && t.cells.some(c => String(c.id) === String(bboxItem.id))));
          if (!parentTable) {
            const siblings = findConnectedTableCells(bboxItem, state.parsedBBoxes);
            parentTable = {
              id: bboxItem.table_id || `table-p${bboxItem.page || 1}-1`,
              cells: siblings,
              type: curType
            };
          }
          if (typeof enrichTable === 'function') {
            parentTable = enrichTable(parentTable);
          }
          renderA11yPanel(a11yContainer, bboxItem, parentTable, (updatedTable) => {
            if (Array.isArray(state.detectedTables)) {
              const tIdx = state.detectedTables.findIndex(t => t.id === updatedTable.id);
              if (tIdx >= 0) state.detectedTables[tIdx] = updatedTable;
            }
          });
        }
      } else {
        const a11yContainer = document.getElementById('a11y-panel-container');
        if (a11yContainer) a11yContainer.innerHTML = '';
      }
    }

    // Retrieve full sentence text
    let fullText = bboxItem.fullSentenceText || '';
    if (!fullText) {
      const isTable = !!(bboxItem.table_type || bboxItem.category === 'Table Cell' || (bboxItem.table_order_id !== null && bboxItem.table_order_id !== undefined));
      if (isTable) {
        fullText = bboxItem.text || '';
      } else {
        const targetSentenceId = bboxItem.sentence_id !== undefined ? bboxItem.sentence_id : bboxItem.id_display;
        const siblingLines = state.parsedBBoxes.filter(it => {
          const itIsTable = !!(it.table_type || it.category === 'Table Cell' || (it.table_order_id !== null && it.table_order_id !== undefined));
          if (itIsTable) return false;
          const sId = it.sentence_id !== undefined ? it.sentence_id : it.id_display;
          return it.page === bboxItem.page && sId === targetSentenceId;
        });
        if (siblingLines.length > 0) {
          fullText = siblingLines.map(l => l.text).join(' ').trim();
        } else {
          fullText = bboxItem.text || '';
        }
      }
    }
    elements.bboxTextInput.value = fullText;

    // Center PDF view onto box
    if (scrollPdf && state.pdfLoaded) {
      pdfViewer.scrollToBBox(bboxItem);
    }
  }

  // Prev Button
  elements.prevBtn.addEventListener('click', () => {
    if (state.parsedBBoxes.length === 0) return;
    let idx = state.selectedIndex - 1;
    if (idx < 0) idx = state.parsedBBoxes.length - 1;
    selectSentence(state.parsedBBoxes[idx], true);
  });

  // Next Button
  elements.nextBtn.addEventListener('click', () => {
    if (state.parsedBBoxes.length === 0) return;
    let idx = state.selectedIndex + 1;
    if (idx >= state.parsedBBoxes.length) idx = 0;
    selectSentence(state.parsedBBoxes[idx], true);
  });

  // Remove Button
  elements.removeBtn.addEventListener('click', () => {
    if (!state.selectedBBox) {
      showToast('Silinecek BBox seçilmedi.', 'info');
      return;
    }
    const remId = state.selectedBBox.id;
    overlayManager.removeItem(remId);
    state.parsedBBoxes = overlayManager.getAllItems();
    ttsReader.setItems(state.parsedBBoxes);
    updateDetectedTables();

    if (state.parsedBBoxes.length > 0) {
      const nextIdx = Math.min(state.selectedIndex, state.parsedBBoxes.length - 1);
      selectSentence(state.parsedBBoxes[nextIdx], true);
    } else {
      state.selectedBBox = null;
      elements.bboxIdInput.value = '';
      elements.bboxTextInput.value = '';
    }
    showToast('BBox silindi.', 'success');
  });

  // Mode Toggles
  elements.drawModeOffBtn.addEventListener('click', () => {
    state.drawMode = false;
    overlayManager.setDrawMode(false);
    elements.drawModeOffBtn.className = 'sidebar-toggle-btn active-blue';
    elements.drawModeOnBtn.className = 'sidebar-toggle-btn inactive-white';
    showToast('Çizim Modu Kapatıldı.', 'info');
  });

  elements.drawModeOnBtn.addEventListener('click', () => {
    state.drawMode = true;
    overlayManager.setDrawMode(true);
    elements.drawModeOnBtn.className = 'sidebar-toggle-btn active-blue';
    elements.drawModeOffBtn.className = 'sidebar-toggle-btn inactive-white';
    showToast('Çizim Modu Açık: PDF üzerine sürükleyerek yeni BBox çizebilirsiniz.', 'info');
  });

  elements.createSentenceBtn.addEventListener('click', () => {
    state.sentenceMode = 'create';
    elements.createSentenceBtn.className = 'sidebar-toggle-btn active-blue';
    elements.addExistedSentenceBtn.className = 'sidebar-toggle-btn inactive-white';
  });

  elements.addExistedSentenceBtn.addEventListener('click', () => {
    state.sentenceMode = 'add_existed';
    elements.addExistedSentenceBtn.className = 'sidebar-toggle-btn active-blue';
    elements.createSentenceBtn.className = 'sidebar-toggle-btn inactive-white';
  });

  elements.justSelectedBtn.addEventListener('click', () => {
    state.showAllSentences = false;
    overlayManager.setShowAllSentences(false);
    elements.justSelectedBtn.className = 'sidebar-toggle-btn active-blue';
    elements.allSentenceBtn.className = 'sidebar-toggle-btn inactive-white';
  });

  elements.allSentenceBtn.addEventListener('click', () => {
    state.showAllSentences = true;
    overlayManager.setShowAllSentences(true);
    elements.allSentenceBtn.className = 'sidebar-toggle-btn active-blue';
    elements.justSelectedBtn.className = 'sidebar-toggle-btn inactive-white';
  });

  // Save Id & Save Text Handlers
  elements.saveIdBtn.addEventListener('click', () => {
    if (!state.selectedBBox) {
      showToast('Lütfen önce bir BBox seçin.', 'info');
      return;
    }
    const targetIdStr = elements.bboxIdInput.value.trim();
    if (!targetIdStr) return;

    if (state.sentenceMode === 'add_existed') {
      const mergedTarget = overlayManager.mergeToExistingSentence(state.selectedBBox.id, targetIdStr);
      if (mergedTarget) {
        state.parsedBBoxes = overlayManager.getAllItems();
        ttsReader.setItems(state.parsedBBoxes);
        elements.bboxTextInput.value = mergedTarget.text;
        showToast(`BBox, #${targetIdStr} numaralı cümleyle birleştirildi.`, 'success');
      } else {
        showToast(`ID #${targetIdStr} bulunamadı.`, 'error');
      }
    } else {
      const success = overlayManager.reorderBBoxId(state.selectedBBox.id, targetIdStr);
      if (success) {
        state.parsedBBoxes = overlayManager.getAllItems();
        ttsReader.setItems(state.parsedBBoxes);
        const currentItem = state.parsedBBoxes.find(it => String(it.id) === String(state.selectedBBox.id));
        if (currentItem) {
          selectSentence(currentItem, false);
        }
        showToast(`ID #${targetIdStr} konumuna yerleştirildi, sonrakiler (+1) kaydırıldı.`, 'success');
      } else {
        showToast('Geçersiz ID numarası.', 'error');
      }
    }
  });

  elements.saveTextBtn.addEventListener('click', () => {
    if (!state.selectedBBox) {
      showToast('Lütfen önce bir BBox seçin.', 'info');
      return;
    }
    const newText = elements.bboxTextInput.value;
    overlayManager.updateActiveItemData(undefined, newText);
    ttsReader.setItems(overlayManager.getAllItems());
    showToast('Paragraf metni kaydedildi.', 'success');
  });

  // =========================================================================
  // Keyboard Shortcuts (Arrow Keys for ID, Enter to Save, Delete to Remove)
  // =========================================================================
  if (elements.bboxIdInput) {
    elements.bboxIdInput.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        let curVal = parseInt(elements.bboxIdInput.value, 10);
        if (isNaN(curVal)) curVal = 0;
        elements.bboxIdInput.value = curVal + 1;
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        let curVal = parseInt(elements.bboxIdInput.value, 10);
        if (isNaN(curVal)) curVal = 0;
        elements.bboxIdInput.value = Math.max(0, curVal - 1);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        elements.saveIdBtn.click();
      }
    });
  }

  if (elements.bboxTextInput) {
    elements.bboxTextInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        elements.saveTextBtn.click();
      }
    });
  }

  // Global Delete Shortcut for removing selected BBox
  window.addEventListener('keydown', (e) => {
    const activeTag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
    const isEditingText = activeTag === 'input' || activeTag === 'textarea' || (document.activeElement && document.activeElement.isContentEditable);

    if (e.key === 'Delete') {
      if (!isEditingText && state.selectedBBox) {
        e.preventDefault();
        elements.removeBtn.click();
      }
    }
  });

  // Connected component flood fill to find all cells/boxes belonging to the table containing startItem
  function findConnectedTableCells(startItem, allItems) {
    if (!startItem) return [];
    const pageNum = startItem.page || 1;
    const pageItems = (allItems || state.parsedBBoxes).filter(it => (it.page || 1) === pageNum);
    if (pageItems.length <= 1) return [startItem];

    // 1. Explicit table_id match if available and valid
    if (startItem.table_id && !startItem.table_id.endsWith('-tbl')) {
      const byTableId = pageItems.filter(it => it.table_id === startItem.table_id);
      if (byTableId.length > 1) return byTableId;
    }

    // 2. Spatial Connected Component Expansion (Flood Fill on Page)
    const cluster = [startItem];
    const visited = new Set([String(startItem.id)]);
    let expanded = true;

    const getBox = it => it.rawCoords || it.rawBox || it.bbox || [0, 0, 0, 0];

    while (expanded) {
      expanded = false;
      for (const candidate of pageItems) {
        if (visited.has(String(candidate.id))) continue;

        // If candidate explicitly shares the same table_id
        if (startItem.table_id && candidate.table_id && candidate.table_id === startItem.table_id) {
          cluster.push(candidate);
          visited.add(String(candidate.id));
          expanded = true;
          continue;
        }

        const b = getBox(candidate);
        const isNearby = cluster.some(member => {
          const mb = getBox(member);
          const overlapX = Math.max(0, Math.min(b[2], mb[2]) - Math.max(b[0], mb[0]));
          const overlapY = Math.max(0, Math.min(b[3], mb[3]) - Math.max(b[1], mb[1]));
          const gapX = Math.max(0, Math.max(b[0], mb[0]) - Math.min(b[2], mb[2]));
          const gapY = Math.max(0, Math.max(b[1], mb[1]) - Math.min(b[3], mb[3]));

          // Same column neighbor (vertical sequence)
          if (overlapX > 10 && gapY < 45) return true;
          // Same row neighbor (horizontal sequence across columns)
          if (overlapY > 5 && gapX < 140) return true;
          // Diagonal grid cell
          if (gapX < 80 && gapY < 35) return true;
          return false;
        });

        if (isNearby) {
          cluster.push(candidate);
          visited.add(String(candidate.id));
          expanded = true;
        }
      }
    }

    // 3. Convex hull bounding box inclusion: Any item inside the table's overall rectangle
    if (cluster.length > 1) {
      const allB = cluster.map(getBox);
      const minX = Math.min(...allB.map(b => b[0]));
      const minY = Math.min(...allB.map(b => b[1]));
      const maxX = Math.max(...allB.map(b => b[2]));
      const maxY = Math.max(...allB.map(b => b[3]));

      pageItems.forEach(cand => {
        if (visited.has(String(cand.id))) return;
        const cb = getBox(cand);
        const cx = (cb[0] + cb[2]) / 2;
        const cy = (cb[1] + cb[3]) / 2;
        if (cx >= minX - 8 && cx <= maxX + 8 && cy >= minY - 8 && cy <= maxY + 8) {
          cluster.push(cand);
          visited.add(String(cand.id));
        }
      });
    }

    return cluster;
  }

  function showProcessingOverlay(title, desc) {
    const overlay = document.getElementById('table-processing-overlay');
    if (!overlay) return;
    const titleEl = document.getElementById('processing-title');
    const descEl = document.getElementById('processing-desc');
    if (titleEl && title) titleEl.textContent = title;
    if (descEl && desc) descEl.textContent = desc;
    overlay.classList.remove('hidden');
  }

  function hideProcessingOverlay() {
    const overlay = document.getElementById('table-processing-overlay');
    if (!overlay) return;
    overlay.classList.add('hidden');
  }

  // Table Classification & Type Validation / Modification Handlers
  function updateSelectedTableType(newType) {
    let item = state.selectedBBox;
    if (!item) {
      // Otomatik olarak ilk tablo hücresini veya seçili indeksi bul
      item = state.parsedBBoxes.find(b => b.table_id || b.table_type || b.category === 'Table Cell' || (b.table_order_id !== null && b.table_order_id !== undefined)) ||
             state.parsedBBoxes[state.selectedIndex] ||
             state.parsedBBoxes[0];
      if (item) {
        state.selectedBBox = item;
      } else {
        showToast('Lütfen önce bir tablo hücresi seçin.', 'info');
        return;
      }
    }

    const Classifier = (typeof TableClassifier !== 'undefined') ? TableClassifier : null;
    const typeName = TableClassifier ? (TableClassifier.TYPE_NAMES[newType] || newType) : newType;

    try {
      // Tablodaki TÜM hücreleri bul (table_id ve uzamsal cluster birleşimi)
      const sibSet = new Set();
      const tableSiblings = [];

      const addSibling = (b) => {
        const key = String(b.id);
        if (!sibSet.has(key)) {
          sibSet.add(key);
          tableSiblings.push(b);
        }
      };

      if (item.table_id) {
        state.parsedBBoxes
          .filter(b => b.table_id === item.table_id)
          .forEach(addSibling);
      }

      findConnectedTableCells(item, state.parsedBBoxes).forEach(addSibling);

      const assignedTableId = item.table_id && !item.table_id.endsWith('-tbl')
        ? item.table_id
        : `table-p${item.page || 1}-${Date.now()}`;

      if (newType === 'NOT_TABLE') {
        tableSiblings.forEach(sibling => {
          sibling.table_type = null;
          sibling.table_id = null;
          sibling.table_order_id = null;
          sibling.table_order_label = null;
          sibling.category = 'Plain Text';
          sibling.fullSentenceText = sibling.text || '';
        });

        if (elements.sidebarTableTypeBadge) elements.sidebarTableTypeBadge.textContent = 'Normal Metin';
        if (elements.sidebarTableOrderBadge) elements.sidebarTableOrderBadge.textContent = 'Tablo Değil';
        
        showToast(`Tablodaki ${tableSiblings.length} hücrenin tamamından tablo tipi kaldırıldı (Normal Metin).`, 'info');
      } else {
        // 1. Update table_type and table_id EXCLUSIVELY on cells of THIS table!
        tableSiblings.forEach(sibling => {
          sibling.table_type = newType;
          sibling.table_id = assignedTableId;
          sibling.category = 'Table Cell';
          delete sibling.fullSentenceText;
        });

        // 2. Re-calculate reading order & sequential sentence IDs according to new table type
        if (Classifier && typeof Classifier.processTable === 'function' && tableSiblings.length > 0) {
          const siblingIds = new Set(tableSiblings.map(b => String(b.id)));
          const firstIdx = state.parsedBBoxes.findIndex(b => siblingIds.has(String(b.id)));
          const prevItem = firstIdx > 0 ? state.parsedBBoxes[firstIdx - 1] : null;
          const startId = prevItem ? (parseInt(prevItem.sentence_id !== undefined ? prevItem.sentence_id : prevItem.id_display, 10) || 0) + 1 : 1;

          const res = Classifier.processTable({
            id: assignedTableId,
            page: item.page || 1,
            cells: tableSiblings,
            forced_type: newType,
            text: item.text,
            bbox: item.rawCoords || item.rawBox || item.bbox
          }, item.page || 1, startId, 1);

          if (res && res.items && res.items.length > 0) {
            const nonTableBoxes = state.parsedBBoxes.filter(b => !siblingIds.has(String(b.id)));
            const insertPos = firstIdx >= 0 ? firstIdx : nonTableBoxes.length;

            nonTableBoxes.splice(insertPos, 0, ...res.items);
            state.parsedBBoxes = nonTableBoxes;

            // Re-index contiguously preserving table's column NLP sentence groups
            let sCounter = 1;
            const sentenceIdMap = new Map();
            state.parsedBBoxes.forEach((box, bIdx) => {
              const isTable = !!(box.table_type || box.category === 'Table Cell' || (box.table_order_id !== null && box.table_order_id !== undefined));
              const rawSid = box.sentence_id !== undefined ? box.sentence_id : box.id_display;
              const groupKey = isTable
                ? `tbl_${box.table_id || assignedTableId}_s${rawSid !== undefined ? rawSid : bIdx}`
                : `text_p${box.page || 1}_s${rawSid !== undefined ? rawSid : bIdx}`;

              if (!sentenceIdMap.has(groupKey)) {
                sentenceIdMap.set(groupKey, sCounter++);
              }
              const newSid = sentenceIdMap.get(groupKey);
              box.sentence_id = newSid;
              box.id_display = newSid;
            });

            // Yeni tip'e göre hesaplanan ilk item'ı seç
            state._pendingSelectAfterTypeChange = res.items[0];
          }
        }

        if (elements.sidebarTableTypeBadge) {
          elements.sidebarTableTypeBadge.textContent = TableClassifier ? (TableClassifier.TYPE_NAMES[newType] || newType) : newType;
        }
        if (elements.sidebarTableOrderBadge) {
          elements.sidebarTableOrderBadge.textContent = item.table_order_label || `T1.${item.table_order_id || 1}`;
        }
        if (elements.sidebarTableTypeSelect) {
          elements.sidebarTableTypeSelect.value = newType;
        }

        showToast(`Tablo tipi "${TableClassifier ? TableClassifier.TYPE_NAMES[newType] || newType : newType}" olarak güncellendi (${tableSiblings.length} hücre).`, 'success');
      }

      updateDetectedTables();
      overlayManager.setData(state.parsedBBoxes);
      overlayManager.reRenderAllPages();
      ttsReader.setItems(state.parsedBBoxes);

      // Tip değişimi sonrası seçimi güncelle:
      const pendingItem = state._pendingSelectAfterTypeChange;
      delete state._pendingSelectAfterTypeChange;

      const refreshedItem = pendingItem ||
                            state.parsedBBoxes.find(it => String(it.id) === String(item.id)) ||
                            state.parsedBBoxes[Math.min(state.selectedIndex, state.parsedBBoxes.length - 1)] ||
                            item;
      selectSentence(refreshedItem, false);
    } catch (err) {
      console.error('[TableType] Hata:', err);
      showToast('Tablo tipi güncellenirken hata oluştu: ' + err.message, 'error');
    }
  }

  if (elements.saveTableTypeBtn) {
    elements.saveTableTypeBtn.addEventListener('click', () => {
      const selectedType = elements.sidebarTableTypeSelect ? elements.sidebarTableTypeSelect.value : 'A_MATRIX';
      updateSelectedTableType(selectedType);
    });
  }

  if (elements.sidebarTableTypeSelect) {
    elements.sidebarTableTypeSelect.addEventListener('change', () => {
      const selectedType = elements.sidebarTableTypeSelect.value;
      updateSelectedTableType(selectedType);
    });
  }

  // TTS Reader Controls & Audio Callbacks
  ttsReader.onSentenceStart((item, index) => {
    selectSentence(item, false);
  });

  ttsReader.onStateChange((audioState) => {
    if (!elements.ttsPlayBtn) return;
    if (audioState === 'playing') {
      elements.ttsPlayBtn.innerHTML = '<i class="fa-solid fa-pause"></i> <span>Duraklat</span>';
      elements.ttsPlayBtn.classList.add('playing');
      if (elements.ttsStopBtn) elements.ttsStopBtn.classList.remove('hidden');
    } else if (audioState === 'paused') {
      elements.ttsPlayBtn.innerHTML = '<i class="fa-solid fa-play"></i> <span>Devam Et</span>';
      elements.ttsPlayBtn.classList.remove('playing');
      if (elements.ttsStopBtn) elements.ttsStopBtn.classList.remove('hidden');
    } else {
      elements.ttsPlayBtn.innerHTML = '<i class="fa-solid fa-play"></i> <span>Sesli Oku</span>';
      elements.ttsPlayBtn.classList.remove('playing');
      if (elements.ttsStopBtn) elements.ttsStopBtn.classList.add('hidden');
    }
  });

  if (elements.ttsPlayBtn) {
    elements.ttsPlayBtn.addEventListener('click', () => {
      if (state.parsedBBoxes.length === 0) {
        showToast('Seslendirilecek veri bulunamadı. Lütfen önce JSON yükleyin.', 'info');
        return;
      }
      if (ttsReader.isPlaying) {
        ttsReader.pause();
      } else if (ttsReader.isPaused) {
        ttsReader.resume();
      } else {
        const startIdx = state.selectedIndex >= 0 ? state.selectedIndex : 0;
        ttsReader.play(startIdx);
      }
    });
  }

  if (elements.ttsSpeakSelectedBtn) {
    elements.ttsSpeakSelectedBtn.addEventListener('click', () => {
      if (!state.selectedBBox) {
        showToast('Lütfen önce okunacak bir cümle veya hücre seçin.', 'info');
        return;
      }
      ttsReader.speakSingle(state.selectedBBox);
    });
  }

  if (elements.sidebarSpeakBtn) {
    elements.sidebarSpeakBtn.addEventListener('click', () => {
      if (!state.selectedBBox) {
        showToast('Lütfen önce okunacak bir cümle veya hücre seçin.', 'info');
        return;
      }
      ttsReader.speakSingle(state.selectedBBox);
    });
  }

  if (elements.ttsStopBtn) {
    elements.ttsStopBtn.addEventListener('click', () => {
      ttsReader.stop();
    });
  }

  if (elements.ttsSpeedSelect) {
    elements.ttsSpeedSelect.addEventListener('change', (e) => {
      ttsReader.setRate(e.target.value);
    });
  }

  // Topbar Controls (Zoom, Page, Export)
  elements.zoomInBtn.addEventListener('click', () => pdfViewer.zoomIn());
  elements.zoomOutBtn.addEventListener('click', () => pdfViewer.zoomOut());

  elements.pageNumberInput.addEventListener('change', (e) => {
    let p = parseInt(e.target.value, 10);
    if (isNaN(p)) p = 1;
    p = Math.max(1, Math.min(p, state.totalPages));
    pdfViewer.scrollToPage(p);
  });

  elements.exportJsonBtn.addEventListener('click', () => {
    const all = overlayManager.getAllItems();
    if (all.length === 0) {
      showToast('Dışa aktarılacak veri bulunamadı.', 'info');
      return;
    }

    const pagesMap = new Map();
    all.forEach(it => {
      const pageNum = it.page || 1;
      if (!pagesMap.has(pageNum)) pagesMap.set(pageNum, []);
      pagesMap.get(pageNum).push({
        id: it.id,
        id_display: it.id_display !== undefined ? it.id_display : it.sentence_id,
        sentence_id: it.sentence_id,
        type: it.category || 'plain text',
        table_id: it.table_id || null,
        table_type: it.table_type || null,
        table_order_id: it.table_order_id !== undefined ? it.table_order_id : null,
        coords: it.rawCoords || [0, 0, 0, 0],
        confidence: it.confidence || 1.0,
        text: it.text || '',
        fullSentenceText: it.fullSentenceText || it.text || ''
      });
    });

    const exportData = [];
    for (const [pageNum, elementsList] of pagesMap.entries()) {
      exportData.push({
        page: pageNum,
        elements: elementsList
      });
    }

    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(exportData, null, 2));
    const dl = document.createElement('a');
    dl.setAttribute("href", dataStr);
    dl.setAttribute("download", "edited_pdf_sentences_with_table_orders.json");
    document.body.appendChild(dl);
    dl.click();
    dl.remove();
    showToast('Düzenlenmiş ve Tablo Sıralı JSON indirildi!', 'success');
  });

  // Toast Helper
  function showToast(msg, type = 'info') {
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    t.innerHTML = `<span>${msg}</span>`;
    if (elements.toastContainer) {
      elements.toastContainer.appendChild(t);
    } else {
      document.body.appendChild(t);
    }
    setTimeout(() => {
      t.style.opacity = '0';
      setTimeout(() => t.remove(), 250);
    }, 2800);
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}

