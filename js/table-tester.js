/**
 * Table Tester Controller - Interactive Table Reading Order Playground
 * Yüklenen PDF ve JSON verileriyle tam entegre çalışan özerk tablo denetleyicisi.
 */

(function () {
  'use strict';

  // =========================================================================
  // Built-in Realistic Datasets for all 6 Table Categories
  // =========================================================================
  const SAMPLE_TABLES = [
    {
      id: 'sample-matrix',
      name: 'Gider & Bütçe Cetveli',
      type: 'A_MATRIX',
      typeName: 'Klasik Matris Tablo',
      desc: 'Sütun başlıkları ve satır başlıklarının kesiştiği Z-yolu ızgarası.',
      data: {
        table_id: 'table-a-matrix',
        forced_type: 'A_MATRIX',
        cells: [
          { row: 0, col: 0, text: 'Gider Türü' },
          { row: 0, col: 1, text: 'Ocak' },
          { row: 0, col: 2, text: 'Şubat' },
          { row: 0, col: 3, text: 'Mart' },
          { row: 1, col: 0, text: 'Elektrik' },
          { row: 1, col: 1, text: '1.250 TL' },
          { row: 1, col: 2, text: '1.400 TL' },
          { row: 1, col: 3, text: '1.300 TL' },
          { row: 2, col: 0, text: 'Su & Isıtma' },
          { row: 2, col: 1, text: '450 TL' },
          { row: 2, col: 2, text: '500 TL' },
          { row: 2, col: 3, text: '420 TL' },
          { row: 3, col: 0, text: 'İnternet' },
          { row: 3, col: 1, text: '600 TL' },
          { row: 3, col: 2, text: '600 TL' },
          { row: 3, col: 3, text: '650 TL' }
        ]
      }
    },
    {
      id: 'sample-kv',
      name: 'Kredi Başvuru Formu',
      type: 'B_KEY_VALUE',
      typeName: 'Etiket : Değer / Form Tablosu',
      desc: 'İki sütunlu etiket ve değer çiftleri; satır satır okunur.',
      data: {
        table_id: 'table-b-kv',
        forced_type: 'B_KEY_VALUE',
        cells: [
          { row: 0, col: 0, text: 'Müşteri Adı Soyadı' },
          { row: 0, col: 1, text: 'Hasan Yılmaz' },
          { row: 1, col: 0, text: 'T.C. Kimlik Numarası' },
          { row: 1, col: 1, text: '12345678901' },
          { row: 2, col: 0, text: 'Başvuru Tarihi' },
          { row: 2, col: 1, text: '07 Eylül 2026' },
          { row: 3, col: 0, text: 'Talep Edilen Kredi' },
          { row: 3, col: 1, text: '250.000 TL' },
          { row: 4, col: 0, text: 'Vade Süresi' },
          { row: 4, col: 1, text: '36 Ay' }
        ]
      }
    },
    {
      id: 'sample-parallel',
      name: 'Çift Dilli Sözleşme Maddeleri',
      type: 'C_PARALLEL_TEXT',
      typeName: 'Paralel Metin / Sahte Tablo',
      desc: 'Yan yana gazete veya çok dilli sütunlar; 1. sütun biter, sonra 2. sütun başlar.',
      data: {
        table_id: 'table-c-parallel',
        forced_type: 'C_PARALLEL_TEXT',
        cells: [
          { row: 0, col: 0, text: 'Madde 1: İşbu sözleşme tarafların haklarını korur.' },
          { row: 0, col: 1, text: 'Article 1: This contract protects the rights of the parties.' },
          { row: 1, col: 0, text: 'Madde 2: Ödemeler her ayın ilk iş günü yapılır.' },
          { row: 1, col: 1, text: 'Article 2: Payments shall be made on the first business day of each month.' },
          { row: 2, col: 0, text: 'Madde 3: Uyuşmazlıklarda İstanbul Mahkemeleri yetkilidir.' },
          { row: 2, col: 1, text: 'Article 3: Istanbul Courts have jurisdiction over disputes.' }
        ]
      }
    },
    {
      id: 'sample-merged',
      name: 'Departman Performans Raporu',
      type: 'D_MERGED_CELLS',
      typeName: 'Birleşik Hücreli / Hiyerarşik Tablo',
      desc: 'Genişletilmiş üst başlık (2025 Yılı) altındaki Gelir/Gider alt kırılımları.',
      data: {
        table_id: 'table-d-merged',
        forced_type: 'D_MERGED_CELLS',
        cells: [
          { row: 0, col: 0, text: 'Departman' },
          { row: 0, col: 1, text: '2025 Yılı Performans Göstergeleri', colspan: 2 },
          { row: 1, col: 0, text: 'Alt Kırılım' },
          { row: 1, col: 1, text: 'Gelir' },
          { row: 1, col: 2, text: 'Gider' },
          { row: 2, col: 0, text: 'Yazılım Geliştirme' },
          { row: 2, col: 1, text: '850.000 TL' },
          { row: 2, col: 2, text: '320.000 TL' },
          { row: 3, col: 0, text: 'Pazarlama & Satış' },
          { row: 3, col: 1, text: '1.200.000 TL' },
          { row: 3, col: 2, text: '600.000 TL' }
        ]
      }
    },
    {
      id: 'sample-d-user-sales',
      name: '2024 Yarıyıl Satış & Hedef Raporu',
      type: 'D_MERGED_CELLS',
      typeName: 'Çok Seviyeli & Hiyerarşik Rapor',
      desc: 'Üst Başlık + Satış Rakamları (₺) altındaki Ocak-Mart ve Nisan-Haziran alt kırılımları.',
      data: {
        table_id: 'table-d-user-sales',
        forced_type: 'D_MERGED_CELLS',
        coords: [233, 318, 1436, 510],
        cells: [
          { row: 0, col: 0, cell_coords: [18, 40, 255, 75], abs_coords: [251, 358, 488, 393], text: "Bölge" },
          { row: 0, col: 1, cell_coords: [252, 40, 866, 75], abs_coords: [485, 358, 1099, 393], text: "Satış Rakamları (₺)", colspan: 2 },
          { row: 0, col: 3, cell_coords: [866, 40, 1132, 75], abs_coords: [1099, 358, 1365, 393], text: "Durum" },
          { row: 1, col: 1, cell_coords: [252, 76, 547, 113], abs_coords: [485, 394, 780, 431], text: "Ocak - Mart" },
          { row: 1, col: 2, cell_coords: [551, 76, 866, 113], abs_coords: [784, 394, 1099, 431], text: "Nisan - Haziran" },
          { row: 2, col: 0, cell_coords: [18, 115, 255, 150], abs_coords: [251, 433, 488, 468], text: "Marmara" },
          { row: 2, col: 1, cell_coords: [252, 115, 547, 150], abs_coords: [485, 433, 780, 468], text: "500.000" },
          { row: 2, col: 2, cell_coords: [551, 115, 866, 150], abs_coords: [784, 433, 1099, 468], text: "650.000" },
          { row: 2, col: 3, cell_coords: [866, 115, 1132, 150], abs_coords: [1099, 433, 1365, 468], text: "Başarılı" },
          { row: 3, col: 0, cell_coords: [18, 152, 255, 188], abs_coords: [251, 470, 488, 506], text: "İç Anadolu" },
          { row: 3, col: 1, cell_coords: [252, 152, 547, 188], abs_coords: [485, 470, 780, 506], text: "300.000" },
          { row: 3, col: 2, cell_coords: [551, 152, 866, 188], abs_coords: [784, 470, 1099, 506], text: "320.000" },
          { row: 3, col: 3, cell_coords: [866, 152, 1132, 188], abs_coords: [1099, 470, 1365, 506], text: "Beklentinin Altında" }
        ],
        words: [
          { word: "2024 Yılı Yarıyıl Satış ve Hedef Gerçekleşme Raporu", bbox: [497, 321, 1173, 357] }
        ]
      }
    },
    {
      id: 'sample-formula',
      name: 'KDV & Fatura Hesap Cetveli',
      type: 'E_FORMULA',
      typeName: 'Matematiksel / Formül Tablosu',
      desc: 'İşlem sembolleri içeren matematiksel eşitlik cetveli.',
      data: {
        table_id: 'table-e-formula',
        forced_type: 'E_FORMULA',
        cells: [
          { row: 0, col: 0, text: 'Matrah' },
          { row: 0, col: 1, text: 'İşlem' },
          { row: 0, col: 2, text: 'KDV Oranı' },
          { row: 0, col: 3, text: 'Eşittir' },
          { row: 0, col: 4, text: 'KDV Tutarı' },
          { row: 1, col: 0, text: '10.000 TL' },
          { row: 1, col: 1, text: '×' },
          { row: 1, col: 2, text: '%20' },
          { row: 1, col: 3, text: '=' },
          { row: 1, col: 4, text: '2.000 TL' },
          { row: 2, col: 0, text: '50.000 TL' },
          { row: 2, col: 1, text: '×' },
          { row: 2, col: 2, text: '%10' },
          { row: 2, col: 3, text: '=' },
          { row: 2, col: 4, text: '5.000 TL' }
        ]
      }
    },
    {
      id: 'sample-hybrid',
      name: 'Personel Hakları & Dipnot (F_HYBRID_NOTE)',
      type: 'F_HYBRID_NOTE',
      typeName: 'Dipnotlu Hibrit Tablo',
      desc: 'Ana veri matrisi (Personel, Yemek, Yol) bittikten sonra en alttaki dipnot bloğu izole olarak okunur.',
      data: {
        table_id: 'table-f-hybrid-personel',
        forced_type: 'F_HYBRID_NOTE',
        cells: [
          { row: 0, col: 0, text: 'Personel Unvanı' },
          { row: 0, col: 1, text: 'Günlük Yemek Ücreti' },
          { row: 0, col: 2, text: 'Yol Yardımı' },
          { row: 1, col: 0, text: 'Uzman' },
          { row: 1, col: 1, text: '180 ₺' },
          { row: 1, col: 2, text: 'Yok' },
          { row: 2, col: 0, text: 'Müdür' },
          { row: 2, col: 1, text: '250 ₺' },
          { row: 2, col: 2, text: 'Var (Araç Tahsisi)' },
          { row: 3, col: 0, text: '* Dipnot: Yukarıda belirtilen yol yardımı ve yemek ücretleri 1 Ocak 2024 itibarıyla geçerli olan brüt tutarlardır. Vergi kesintileri uygulanacaktır.', colspan: 3 }
        ]
      }
    }
  ];

  // App State
  let userUploadedTables = [];
  let activeSample = SAMPLE_TABLES[0];
  let processedResult = null;
  let currentStepIndex = 0;
  let isPlaying = false;
  let speechRate = 1.0;
  let synth = ('speechSynthesis' in window) ? window.speechSynthesis : null;
  let selectedVoice = null;
  let showTrajectory = true;

  // DOM Elements
  const uploadedBlock = document.getElementById('uploaded-tables-block');
  const userTablesContainer = document.getElementById('user-tables-container');
  const userTablesCount = document.getElementById('user-tables-count');
  const sampleContainer = document.getElementById('sample-tables-container');

  const stageBadge = document.getElementById('stage-badge');
  const stageTitle = document.getElementById('stage-title');
  const stageMeta = document.getElementById('stage-meta');
  const stageTypeSelect = document.getElementById('stage-type-select');
  const tableContainer = document.getElementById('rendered-table-container');
  const trajectorySvg = document.getElementById('trajectory-svg');
  const queueContainer = document.getElementById('order-queue-container');
  const queueCount = document.getElementById('queue-count');
  const footnoteContainer = document.getElementById('stage-footnote-container');

  const playBtn = document.getElementById('tts-play-btn');
  const prevBtn = document.getElementById('tts-prev-btn');
  const nextBtn = document.getElementById('tts-next-btn');
  const stopBtn = document.getElementById('tts-stop-btn');
  const speedSelect = document.getElementById('tts-speed-select');
  const trajectoryCheckbox = document.getElementById('show-trajectory-checkbox');

  const labPdfBtn = document.getElementById('lab-pdf-btn');
  const labPdfInput = document.getElementById('lab-pdf-input');
  const labJsonBtn = document.getElementById('lab-json-btn');
  const labJsonInput = document.getElementById('lab-json-input');
  const labSyncBtn = document.getElementById('lab-sync-main-btn');

  const customJsonBtn = document.getElementById('custom-json-btn');
  const customModal = document.getElementById('custom-json-modal');
  const modalCancelBtn = document.getElementById('modal-cancel-btn');
  const modalLoadBtn = document.getElementById('modal-load-btn');
  const modalTextarea = document.getElementById('custom-json-textarea');

  // Initialize Voices
  function initVoices() {
    if (!synth) return;
    const load = () => {
      const voices = synth.getVoices() || [];
      const tr = voices.find(v => v.lang && (v.lang.startsWith('tr') || v.lang.includes('TR')));
      selectedVoice = tr || voices[0] || null;
    };
    load();
    if (synth.onvoiceschanged !== undefined) synth.onvoiceschanged = load;
  }
  initVoices();

  // Helper file reader
  function readFileAsText(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsText(file, 'utf-8');
    });
  }

  // Universal helper to extract table structures from any arbitrary JSON format
  function extractTablesFromAny(jsonData) {
    if (!jsonData) return [];
    const tables = [];

    // Case 1: JSON object is directly a table (e.g. { type: "table", coords: [...], cells: [...] })
    if (typeof jsonData === 'object' && jsonData !== null) {
      const isDirectTable = jsonData.type === 'table' || 
                            jsonData.category === 'Table' || 
                            jsonData.is_table === true ||
                            Array.isArray(jsonData.cells) || 
                            Array.isArray(jsonData.table_cells) ||
                            Array.isArray(jsonData.cell_bboxes) ||
                            Array.isArray(jsonData.rows) ||
                            Array.isArray(jsonData.matrix);

      if (isDirectTable && (Array.isArray(jsonData.cells) || Array.isArray(jsonData.table_cells) || Array.isArray(jsonData.rows) || Array.isArray(jsonData.words))) {
        tables.push({
          id: jsonData.id || jsonData.table_id || 'table-1',
          page: jsonData.page || 1,
          type: (jsonData.forced_type && jsonData.forced_type !== 'table') ? jsonData.forced_type : (jsonData.type && jsonData.type !== 'table' ? jsonData.type : 'A_MATRIX'),
          coords: jsonData.coords || jsonData.bbox || [50, 50, 600, 300],
          cells: jsonData.cells || jsonData.table_cells || jsonData.cell_bboxes || [],
          words: jsonData.words || []
        });
        return tables;
      }
    }

    // Case 2: JSON is an array of items or array of tables
    const list = Array.isArray(jsonData) ? jsonData : (jsonData.tables || jsonData.table_list || jsonData.elements || jsonData.items || jsonData.results || jsonData.blocks || jsonData.sentences || []);

    if (Array.isArray(list) && list.length > 0) {
      list.forEach((item, idx) => {
        if (!item || typeof item !== 'object') return;
        const isTbl = item.type === 'table' || item.category === 'Table' || item.is_table === true || Array.isArray(item.cells) || Array.isArray(item.table_cells) || Array.isArray(item.rows);
        if (isTbl) {
          tables.push({
            id: item.id || item.table_id || `table-${idx + 1}`,
            page: item.page || 1,
            type: (item.forced_type && item.forced_type !== 'table') ? item.forced_type : (item.type && item.type !== 'table' ? item.type : 'A_MATRIX'),
            coords: item.coords || item.bbox || [50, 50, 600, 300],
            cells: item.cells || item.table_cells || item.cell_bboxes || [],
            words: item.words || []
          });
        }
      });
      if (tables.length > 0) return tables;
    }

    // Case 3: Recursive search through pages or container objects
    if (typeof jsonData === 'object' && jsonData !== null) {
      for (const k of Object.keys(jsonData)) {
        if (typeof jsonData[k] === 'object' && jsonData[k] !== null) {
          const sub = extractTablesFromAny(jsonData[k]);
          if (sub.length > 0) tables.push(...sub);
        }
      }
    }

    return tables;
  }

  // =========================================================================
  // Sync Data with Main Editor (index.html)
  // =========================================================================
  function syncFromMainEditor() {
    try {
      const rawStored = localStorage.getItem('directly_detect_bbox_shared_data');
      if (!rawStored) {
        // Fallback check other storage keys
        const fallbackJson = localStorage.getItem('directly_detect_bbox_raw_json');
        if (fallbackJson) {
          try {
            const parsed = JSON.parse(fallbackJson);
            const extTables = extractTablesFromAny(parsed);
            if (extTables.length > 0) {
              populateUserTables(extTables, 'Aktif JSON');
              return;
            }
          } catch (e) {}
        }
        return;
      }

      const parsedData = JSON.parse(rawStored);
      let detected = Array.isArray(parsedData.detectedTables) ? parsedData.detectedTables : [];

      // If detectedTables is empty, try extracting from rawJsonData
      if (detected.length === 0 && parsedData.rawJsonData) {
        detected = extractTablesFromAny(parsedData.rawJsonData);
      }

      if (detected.length > 0) {
        populateUserTables(detected, parsedData.jsonFileName || 'Belge');
      }
    } catch (err) {
      console.warn('[Sync] Sync error:', err);
    }
  }

  function populateUserTables(tablesList, sourceLabel = 'Belge') {
    if (!tablesList || tablesList.length === 0) return;

    userUploadedTables = tablesList.map((t, idx) => ({
      id: `user-tbl-${t.id || idx + 1}`,
      name: `${sourceLabel.replace('.json', '')} Tablosu #${idx + 1} (Sayfa ${t.page || 1})`,
      type: (t.type && t.type !== 'table') ? t.type : (t.forced_type && t.forced_type !== 'table' ? t.forced_type : 'A_MATRIX'),
      typeName: TableClassifier.TYPE_NAMES[t.type] || t.type || 'Tablo',
      desc: `${t.cells ? t.cells.length : 0} Hücre • Sayfa ${t.page || 1} • Ana Editörden Aktarıldı`,
      isUserUploaded: true,
      data: t
    }));

    renderUserUploadedTables();

    // Automatically switch to the first uploaded user table
    if (userUploadedTables.length > 0) {
      activeSample = userUploadedTables[0];
      renderSampleList();
      renderUserUploadedTables();
      loadTable(activeSample.data, activeSample.type, activeSample.name);
    }
  }

  // BroadcastChannel listener
  if ('BroadcastChannel' in window) {
    const bc = new BroadcastChannel('directly_detect_bbox_sync');
    bc.onmessage = (ev) => {
      if (ev.data) {
        syncFromMainEditor();
      }
    };
  }

  window.addEventListener('storage', (e) => {
    if (e.key === 'directly_detect_bbox_shared_data' || e.key === 'directly_detect_bbox_raw_json') {
      syncFromMainEditor();
    }
  });

  // Render User Uploaded Tables
  function renderUserUploadedTables() {
    if (!uploadedBlock || !userTablesContainer) return;

    if (userUploadedTables.length === 0) {
      uploadedBlock.style.display = 'none';
      return;
    }

    uploadedBlock.style.display = 'block';
    if (userTablesCount) userTablesCount.textContent = userUploadedTables.length;

    userTablesContainer.innerHTML = '';
    userUploadedTables.forEach(s => {
      const card = document.createElement('div');
      card.className = `sample-table-card ${activeSample && s.id === activeSample.id ? 'active' : ''}`;
      card.style.borderColor = 'rgba(56, 189, 248, 0.4)';
      card.style.background = (activeSample && s.id === activeSample.id) ? 'rgba(2, 132, 199, 0.25)' : 'rgba(15, 23, 42, 0.9)';

      const tagClass = `tag-${(s.type || 'A_MATRIX').split('_')[0].toLowerCase()}`;
      card.innerHTML = `
        <div class="card-badge-row">
          <span class="table-type-tag ${tagClass}">${s.type || 'A_MATRIX'}</span>
          <span style="font-size:0.68rem; color:#38bdf8; font-weight:600;"><i class="fa-solid fa-file-invoice"></i> Aktif Belge</span>
        </div>
        <div class="card-name" style="color:#38bdf8;">${s.name}</div>
        <div class="card-desc">${s.desc}</div>
      `;
      card.addEventListener('click', () => {
        stopSpeech();
        activeSample = s;
        renderSampleList();
        renderUserUploadedTables();
        loadTable(s.data, s.type, s.name);
      });
      userTablesContainer.appendChild(card);
    });
  }

  // Render Sample Tables in Left Sidebar
  function renderSampleList() {
    sampleContainer.innerHTML = '';
    SAMPLE_TABLES.forEach(s => {
      const card = document.createElement('div');
      card.className = `sample-table-card ${activeSample && s.id === activeSample.id ? 'active' : ''}`;
      
      const tagClass = `tag-${s.type.split('_')[0].toLowerCase()}`;
      card.innerHTML = `
        <div class="card-badge-row">
          <span class="table-type-tag ${tagClass}">${s.type}</span>
        </div>
        <div class="card-name">${s.name}</div>
        <div class="card-desc">${s.desc}</div>
      `;
      card.addEventListener('click', () => {
        stopSpeech();
        activeSample = s;
        renderSampleList();
        renderUserUploadedTables();
        loadTable(s.data, s.type, s.name);
      });
      sampleContainer.appendChild(card);
    });
  }

  // Load and Process Table
  function loadTable(tableData, forcedType = null, customTitle = null) {
    if (!tableData) return;
    if (forcedType) {
      tableData.forced_type = forcedType;
    }

    const type = tableData.forced_type || tableData.type || 'A_MATRIX';
    stageBadge.textContent = type;
    stageBadge.className = `table-type-tag tag-${type.split('_')[0].toLowerCase()}`;
    stageTitle.textContent = customTitle || (activeSample ? activeSample.name : 'Tablo');
    stageTypeSelect.value = type;

    // Process via TableClassifier
    processedResult = TableClassifier.processTable(tableData, tableData.page || 1, 1, 1);
    const items = processedResult.items || [];
    currentStepIndex = 0;

    const rowCount = processedResult.tableMeta ? processedResult.tableMeta.row_count : 1;
    const colCount = processedResult.tableMeta ? processedResult.tableMeta.col_count : 1;
    stageMeta.textContent = `${rowCount} Satır × ${colCount} Sütun • ${TableClassifier.TYPE_NAMES[type] || type}`;

    // Render Table Grid
    renderTableGrid(tableData.cells || [], items);

    // Render Queue in Right Sidebar
    renderQueueList(items);

    // Render SVG Trajectory Lines
    setTimeout(renderTrajectoryLines, 60);
  }

  // Render HTML Table with numbered Badges
  function renderTableGrid(rawCells, orderedItems) {
    tableContainer.innerHTML = '';
    footnoteContainer.style.display = 'none';
    footnoteContainer.innerHTML = '';

    if (!rawCells || rawCells.length === 0) {
      tableContainer.innerHTML = '<div style="padding:20px; color:#94a3b8;">Hücre verisi bulunamadı.</div>';
      return;
    }

    // Determine grid bounds
    const maxRow = Math.max(...rawCells.map(c => c.row || 0), 0);
    const maxCol = Math.max(...rawCells.map(c => (c.col || 0) + (c.colspan || 1) - 1), 0);

    const table = document.createElement('table');
    table.className = 'rendered-lab-table';

    // Map orderedItems to cell indices
    const cellOrderMap = new Map();
    orderedItems.forEach((it, idx) => {
      const key = `${it.row}_${it.col}`;
      cellOrderMap.set(key, { order: it.table_order_id || (idx + 1), item: it });
    });

    const occupied = new Set();

    for (let r = 0; r <= maxRow; r++) {
      const tr = document.createElement('tr');
      for (let c = 0; c <= maxCol; c++) {
        const occKey = `${r}_${c}`;
        if (occupied.has(occKey)) continue;

        const cellData = rawCells.find(cell => cell.row === r && cell.col === c);
        if (!cellData) continue;

        const isHeader = r === 0 && cellData.colspan !== maxCol + 1;
        const cellEl = isHeader ? document.createElement('th') : document.createElement('td');

        const rSpan = cellData.rowspan || 1;
        const cSpan = cellData.colspan || 1;

        if (rSpan > 1) cellEl.setAttribute('rowspan', rSpan);
        if (cSpan > 1) cellEl.setAttribute('colspan', cSpan);

        // Mark occupied
        for (let ro = 0; ro < rSpan; ro++) {
          for (let co = 0; co < cSpan; co++) {
            occupied.add(`${r + ro}_${c + co}`);
          }
        }

        cellEl.textContent = cellData.text;
        cellEl.dataset.row = r;
        cellEl.dataset.col = c;
        cellEl.id = `cell-el-${r}-${c}`;

        const orderInfo = cellOrderMap.get(occKey);
        if (orderInfo) {
          const badge = document.createElement('span');
          badge.className = 'cell-order-badge';
          badge.textContent = `#${orderInfo.order}`;
          cellEl.appendChild(badge);
          cellEl.dataset.orderId = orderInfo.order;
        }

        cellEl.addEventListener('click', () => {
          if (orderInfo) {
            speakSingleItem(orderInfo.item);
          }
        });

        tr.appendChild(cellEl);
      }
      if (tr.children.length > 0) {
        table.appendChild(tr);
      }
    }

    tableContainer.appendChild(table);
  }

  // Render SVG Trajectory Lines between sequenced cells
  function renderTrajectoryLines() {
    trajectorySvg.innerHTML = '';
    if (!showTrajectory || !processedResult || !processedResult.items) return;

    const items = processedResult.items;
    if (items.length < 2) return;

    const wrap = document.getElementById('table-canvas-wrap');
    if (!wrap) return;

    const wrapRect = wrap.getBoundingClientRect();
    const points = [];

    items.forEach(it => {
      const el = document.getElementById(`cell-el-${it.row}-${it.col}`);
      if (el) {
        const r = el.getBoundingClientRect();
        const x = r.left - wrapRect.left + r.width / 2;
        const y = r.top - wrapRect.top + r.height / 2;
        points.push({ x, y, id: it.table_order_id });
      }
    });

    if (points.length < 2) return;

    let d = `M ${points[0].x} ${points[0].y}`;
    for (let i = 1; i < points.length; i++) {
      d += ` L ${points[i].x} ${points[i].y}`;
    }

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', d);
    path.setAttribute('class', 'trajectory-path');
    trajectorySvg.appendChild(path);
  }

  // Render Step Queue List in Right Sidebar
  function renderQueueList(items) {
    queueContainer.innerHTML = '';
    queueCount.textContent = items.length;

    items.forEach((it, idx) => {
      const step = document.createElement('div');
      step.className = `order-step-item ${idx === currentStepIndex && isPlaying ? 'active' : ''}`;
      step.id = `step-item-${idx}`;

      const spoken = it.fullSentenceText || it.text;

      step.innerHTML = `
        <span class="step-number">#${it.table_order_id || (idx + 1)}</span>
        <div class="step-content">
          <div class="step-spoken-text">${spoken}</div>
          <div class="step-original-tag">[R${it.row !== undefined ? it.row : '-'} : C${it.col !== undefined ? it.col : '-'}] • ID: ${it.id}</div>
        </div>
      `;

      step.addEventListener('click', () => {
        currentStepIndex = idx;
        speakSingleItem(it);
      });

      queueContainer.appendChild(step);
    });
  }

  // Highlight Active Cell & Active Queue Step
  function highlightStep(stepIdx) {
    document.querySelectorAll('.cell-speaking-active').forEach(el => el.classList.remove('cell-speaking-active'));
    document.querySelectorAll('.order-step-item.active').forEach(el => el.classList.remove('active'));

    if (!processedResult || !processedResult.items || stepIdx >= processedResult.items.length) return;
    const item = processedResult.items[stepIdx];

    const cellEl = document.getElementById(`cell-el-${item.row}-${item.col}`);
    if (cellEl) {
      cellEl.classList.add('cell-speaking-active');
      cellEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }

    const queueEl = document.getElementById(`step-item-${stepIdx}`);
    if (queueEl) {
      queueEl.classList.add('active');
      queueEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  // Speech Sequencing
  function speakCurrentSequence() {
    if (!synth || !isPlaying || !processedResult || !processedResult.items) return;
    if (currentStepIndex >= processedResult.items.length) {
      stopSpeech();
      return;
    }

    const item = processedResult.items[currentStepIndex];
    highlightStep(currentStepIndex);

    let textToSpeak = item.fullSentenceText || item.text || '';
    textToSpeak = textToSpeak
      .replace(/×/g, ' çarpı ')
      .replace(/\*/g, ' çarpı ')
      .replace(/\+/g, ' artı ')
      .replace(/%/g, ' yüzde ')
      .replace(/Σ|∑/g, ' toplamı ')
      .replace(/÷/g, ' bölü ')
      .replace(/₺/g, ' Türk Lirası ')
      .replace(/\$/g, ' Dolar ')
      .replace(/€/g, ' Euro ')
      .trim();

    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    utterance.lang = 'tr-TR';
    utterance.rate = speechRate;
    if (selectedVoice) utterance.voice = selectedVoice;

    utterance.onend = () => {
      if (!isPlaying) return;
      currentStepIndex++;
      setTimeout(speakCurrentSequence, 350);
    };

    utterance.onerror = () => {
      if (!isPlaying) return;
      currentStepIndex++;
      speakCurrentSequence();
    };

    synth.speak(utterance);
  }

  function speakSingleItem(item) {
    if (!synth) return;
    synth.cancel();

    if (processedResult && processedResult.items) {
      const idx = processedResult.items.indexOf(item);
      if (idx >= 0) highlightStep(idx);
    }

    let textToSpeak = item.fullSentenceText || item.text || '';
    textToSpeak = textToSpeak
      .replace(/×/g, ' çarpı ')
      .replace(/\*/g, ' çarpı ')
      .replace(/\+/g, ' artı ')
      .replace(/%/g, ' yüzde ')
      .replace(/Σ|∑/g, ' toplamı ')
      .replace(/÷/g, ' bölü ')
      .replace(/₺/g, ' Türk Lirası ')
      .replace(/\$/g, ' Dolar ')
      .replace(/€/g, ' Euro ')
      .trim();

    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    utterance.lang = 'tr-TR';
    utterance.rate = speechRate;
    if (selectedVoice) utterance.voice = selectedVoice;

    utterance.onend = () => {
      document.querySelectorAll('.cell-speaking-active').forEach(el => el.classList.remove('cell-speaking-active'));
      document.querySelectorAll('.order-step-item.active').forEach(el => el.classList.remove('active'));
    };

    synth.speak(utterance);
  }

  function stopSpeech() {
    isPlaying = false;
    if (synth) synth.cancel();
    playBtn.innerHTML = '<i class="fa-solid fa-play"></i> <span>Sırayla Oku</span>';
    playBtn.classList.remove('playing');
    document.querySelectorAll('.cell-speaking-active').forEach(el => el.classList.remove('cell-speaking-active'));
    document.querySelectorAll('.order-step-item.active').forEach(el => el.classList.remove('active'));
  }

  // =========================================================================
  // File Upload Handlers (Direct JSON and PDF in Lab & Drag-and-Drop)
  // =========================================================================
  async function handleJsonFile(file) {
    if (!file) return;
    try {
      const text = await readFileAsText(file);
      let parsed = null;
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = JSON.parse(`[${text.replace(/^,/, '').replace(/,$/, '').trim()}]`);
      }

      const tables = extractTablesFromAny(parsed);

      if (tables.length > 0) {
        populateUserTables(tables, file.name || 'Yüklenen Belge');
      } else {
        const singleObj = {
          id: 'uploaded-single-table',
          name: (file.name || 'Yüklenen Tablo').replace('.json', ''),
          type: (parsed && parsed.type && parsed.type !== 'table') ? parsed.type : 'A_MATRIX',
          typeName: TableClassifier.TYPE_NAMES[parsed.type] || 'Yüklenen Tablo',
          desc: 'Yüklenen JSON dosyası.',
          cells: (parsed && (parsed.cells || parsed.table_cells)) ? (parsed.cells || parsed.table_cells) : []
        };
        populateUserTables([singleObj], file.name || 'Yüklenen Tablo');
      }

      const jsonLabel = document.getElementById('lab-json-label');
      if (jsonLabel) jsonLabel.textContent = file.name;
    } catch (err) {
      alert('JSON yükleme hatası: ' + err.message);
    }
  }

  if (labJsonBtn && labJsonInput) {
    labJsonBtn.addEventListener('click', () => labJsonInput.click());
    labJsonInput.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (file) await handleJsonFile(file);
    });
  }

  if (labPdfBtn && labPdfInput) {
    labPdfBtn.addEventListener('click', () => labPdfInput.click());
    labPdfInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        const label = document.getElementById('lab-pdf-label');
        if (label) label.textContent = file.name;
      }
    });
  }

  // Drag & Drop anywhere on Lab Window
  window.addEventListener('dragover', (e) => { e.preventDefault(); });
  window.addEventListener('drop', async (e) => {
    e.preventDefault();
    const files = e.dataTransfer ? e.dataTransfer.files : [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.name.endsWith('.json')) {
        await handleJsonFile(file);
      } else if (file.name.endsWith('.pdf')) {
        const label = document.getElementById('lab-pdf-label');
        if (label) label.textContent = file.name;
      }
    }
  });

  if (labSyncBtn) {
    labSyncBtn.addEventListener('click', () => {
      syncFromMainEditor();
      if (userUploadedTables.length > 0) {
        alert(`Ana editörden ${userUploadedTables.length} adet tablo başarıyla çekildi ve listelendi!`);
      } else {
        alert('Ana editörde henüz yüklenmiş bir tablo bulunamadı. Lütfen ana sayfada JSON yükleyiniz veya bu sayfada "JSON Yükle" butonunu kullanınız.');
      }
    });
  }

  // Event Listeners
  playBtn.addEventListener('click', () => {
    if (isPlaying) {
      stopSpeech();
    } else {
      isPlaying = true;
      playBtn.innerHTML = '<i class="fa-solid fa-pause"></i> <span>Durdur</span>';
      playBtn.classList.add('playing');
      speakCurrentSequence();
    }
  });

  stopBtn.addEventListener('click', stopSpeech);

  nextBtn.addEventListener('click', () => {
    if (!processedResult || !processedResult.items) return;
    if (currentStepIndex < processedResult.items.length - 1) {
      currentStepIndex++;
    } else {
      currentStepIndex = 0;
    }
    speakSingleItem(processedResult.items[currentStepIndex]);
  });

  prevBtn.addEventListener('click', () => {
    if (!processedResult || !processedResult.items) return;
    if (currentStepIndex > 0) {
      currentStepIndex--;
    } else {
      currentStepIndex = processedResult.items.length - 1;
    }
    speakSingleItem(processedResult.items[currentStepIndex]);
  });

  speedSelect.addEventListener('change', (e) => {
    speechRate = parseFloat(e.target.value) || 1.0;
  });

  trajectoryCheckbox.addEventListener('change', (e) => {
    showTrajectory = e.target.checked;
    trajectorySvg.style.display = showTrajectory ? 'block' : 'none';
    if (showTrajectory) renderTrajectoryLines();
  });

  stageTypeSelect.addEventListener('change', (e) => {
    stopSpeech();
    const newType = e.target.value;
    loadTable(activeSample.data, newType, activeSample.name);
  });

  // Custom JSON Modal Handlers
  customJsonBtn.addEventListener('click', () => {
    customModal.style.display = 'flex';
  });

  modalCancelBtn.addEventListener('click', () => {
    customModal.style.display = 'none';
  });

  modalLoadBtn.addEventListener('click', () => {
    const rawVal = modalTextarea.value.trim();
    if (!rawVal) return;

    try {
      const parsed = JSON.parse(rawVal);
      const tables = extractTablesFromAny(parsed);

      if (tables.length > 0) {
        populateUserTables(tables, 'Özel JSON');
      } else {
        const customTableObj = {
          id: 'custom-user-table',
          name: parsed.name || parsed.table_id || 'Özel Yapıştırılan Tablo',
          type: (parsed.forced_type && parsed.forced_type !== 'table') ? parsed.forced_type : (parsed.type && parsed.type !== 'table' ? parsed.type : 'A_MATRIX'),
          typeName: TableClassifier.TYPE_NAMES[parsed.forced_type || 'A_MATRIX'] || 'Özel Tablo',
          desc: 'Kullanıcı tarafından yapıştırılan özel JSON tablosu.',
          cells: parsed.cells || parsed.table_cells || []
        };
        populateUserTables([customTableObj], 'Özel Tablo');
      }

      customModal.style.display = 'none';
    } catch (err) {
      alert('Geçersiz JSON formatı: ' + err.message);
    }
  });

  window.addEventListener('resize', () => {
    setTimeout(renderTrajectoryLines, 100);
  });

  // Initial Load & Automatic Multi-interval Sync from Main Editor
  renderSampleList();
  syncFromMainEditor();

  setTimeout(syncFromMainEditor, 150);
  setTimeout(syncFromMainEditor, 500);

  if (!activeSample || !activeSample.isUserUploaded) {
    loadTable(activeSample.data, activeSample.type, activeSample.name);
  }

})();
