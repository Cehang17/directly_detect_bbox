/**
 * Table Tester Controller - Interactive Table Reading Order Playground
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
      name: 'Ürün Fiyat Listesi & Dipnot',
      type: 'F_HYBRID_NOTE',
      typeName: 'Dipnotlu Hibrit Tablo',
      desc: 'Ana veri tablosu bittikten sonra en alttaki dipnot bloğu okunur.',
      data: {
        table_id: 'table-f-hybrid',
        forced_type: 'F_HYBRID_NOTE',
        cells: [
          { row: 0, col: 0, text: 'Ürün Adı' },
          { row: 0, col: 1, text: 'Stok Miktarı' },
          { row: 0, col: 2, text: 'Birim Fiyat' },
          { row: 1, col: 0, text: 'Bulut Sunucu Paketi' },
          { row: 1, col: 1, text: '15 Adet' },
          { row: 1, col: 2, text: '$1.500' },
          { row: 2, col: 0, text: 'Veritabanı Lisansı' },
          { row: 2, col: 1, text: '8 Adet' },
          { row: 2, col: 2, text: '$3.200' },
          { row: 3, col: 0, text: '* Not: Fiyatlara KDV dahil değildir. Güncel TCMB satış kuru geçerlidir.', colspan: 3 }
        ]
      }
    }
  ];

  // App State
  let activeSample = SAMPLE_TABLES[0];
  let processedResult = null;
  let currentStepIndex = 0;
  let isPlaying = false;
  let speechRate = 1.0;
  let synth = ('speechSynthesis' in window) ? window.speechSynthesis : null;
  let selectedVoice = null;
  let showTrajectory = true;

  // DOM Elements
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

  // Render Sample Tables in Left Sidebar
  function renderSampleList() {
    sampleContainer.innerHTML = '';
    SAMPLE_TABLES.forEach(s => {
      const card = document.createElement('div');
      card.className = `sample-table-card ${s.id === activeSample.id ? 'active' : ''}`;
      
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
        loadTable(s.data, s.type, s.name);
      });
      sampleContainer.appendChild(card);
    });
  }

  // Load and Process Table
  function loadTable(tableData, forcedType = null, customTitle = null) {
    if (forcedType) {
      tableData.forced_type = forcedType;
    }

    const type = tableData.forced_type || tableData.type || 'A_MATRIX';
    stageBadge.textContent = type;
    stageBadge.className = `table-type-tag tag-${type.split('_')[0].toLowerCase()}`;
    stageTitle.textContent = customTitle || activeSample.name;
    stageTypeSelect.value = type;

    // Process via TableClassifier
    processedResult = TableClassifier.processTable(tableData, 1, 1, 1);
    const items = processedResult.items || [];
    currentStepIndex = 0;

    stageMeta.textContent = `${processedResult.tableMeta.row_count || 1} Satır × ${processedResult.tableMeta.col_count || 1} Sütun • ${TableClassifier.TYPE_NAMES[type] || type}`;

    // Render Table Grid
    renderTableGrid(tableData.cells || [], items);

    // Render Queue in Right Sidebar
    renderQueueList(items);

    // Render SVG Trajectory Lines
    setTimeout(renderTrajectoryLines, 50);
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

    const wrapRect = document.getElementById('table-canvas-wrap').getBoundingClientRect();
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
    }

    const stepEl = document.getElementById(`step-item-${stepIdx}`);
    if (stepEl) {
      stepEl.classList.add('active');
      stepEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  // TTS Speech Player
  function speakCurrentSequence() {
    if (!synth || !processedResult || !processedResult.items) return;
    if (currentStepIndex >= processedResult.items.length) {
      stopSpeech();
      return;
    }

    const item = processedResult.items[currentStepIndex];
    highlightStep(currentStepIndex);

    let textToSpeak = item.fullSentenceText || item.text || '';
    const isBKeyValue = (item.table_type === 'B_KEY_VALUE' || processedResult?.tableType === 'B_KEY_VALUE');
    if (isBKeyValue) {
      textToSpeak = textToSpeak.replace(/^Satır\s+[^,]+,\s*Sütun\s+[^,]+,\s*Değer\s+/i, '');
      textToSpeak = textToSpeak.replace(/^Satır\s+[^,]+,\s*Sütun\s+[^,:]+[:\-]?\s*/i, '');
      textToSpeak = textToSpeak.replace(/^Satır\s+[^,:]+[:\-]?\s*/i, '');
      textToSpeak = textToSpeak.replace(/^Sütun\s+[^,:]+[:\-]?\s*/i, '');
      textToSpeak = textToSpeak.replace(/\[Satır\s+[^\]]+\]\s*/gi, '');
      textToSpeak = textToSpeak.replace(/\[Sütun\s+[^\]]+\]\s*/gi, '');
    }

    textToSpeak = textToSpeak
      .replace(/=/g, ' eşittir ')
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

    if (!textToSpeak) {
      currentStepIndex++;
      speakCurrentSequence();
      return;
    }

    const utterance = new SpeechSynthesisUtterance(textToSpeak);
    utterance.lang = 'tr-TR';
    utterance.rate = speechRate;
    if (selectedVoice) utterance.voice = selectedVoice;

    utterance.onend = () => {
      if (isPlaying) {
        currentStepIndex++;
        setTimeout(() => {
          if (isPlaying) speakCurrentSequence();
        }, 180);
      }
    };

    utterance.onerror = (e) => {
      if (isPlaying) {
        currentStepIndex++;
        setTimeout(() => {
          if (isPlaying) speakCurrentSequence();
        }, 180);
      }
    };

    synth.speak(utterance);
  }

  function speakSingleItem(item) {
    if (!synth || !item) return;
    stopSpeech();

    const idx = processedResult.items.indexOf(item);
    if (idx !== -1) {
      currentStepIndex = idx;
      highlightStep(idx);
    }

    let textToSpeak = item.fullSentenceText || item.text || '';
    const isBKeyValue = (item.table_type === 'B_KEY_VALUE' || processedResult?.tableType === 'B_KEY_VALUE');
    if (isBKeyValue) {
      textToSpeak = textToSpeak.replace(/^Satır\s+[^,]+,\s*Sütun\s+[^,]+,\s*Değer\s+/i, '');
      textToSpeak = textToSpeak.replace(/^Satır\s+[^,]+,\s*Sütun\s+[^,:]+[:\-]?\s*/i, '');
      textToSpeak = textToSpeak.replace(/^Satır\s+[^,:]+[:\-]?\s*/i, '');
      textToSpeak = textToSpeak.replace(/^Sütun\s+[^,:]+[:\-]?\s*/i, '');
      textToSpeak = textToSpeak.replace(/\[Satır\s+[^\]]+\]\s*/gi, '');
      textToSpeak = textToSpeak.replace(/\[Sütun\s+[^\]]+\]\s*/gi, '');
    }

    textToSpeak = textToSpeak
      .replace(/=/g, ' eşittir ')
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
      const customTableObj = {
        id: 'custom-user-table',
        name: parsed.name || parsed.table_id || 'Özel Yapıştırılan Tablo',
        type: parsed.forced_type || parsed.type || 'A_MATRIX',
        typeName: TableClassifier.TYPE_NAMES[parsed.forced_type || 'A_MATRIX'] || 'Özel Tablo',
        desc: 'Kullanıcı tarafından yapıştırılan özel JSON tablosu.',
        data: parsed
      };

      SAMPLE_TABLES.unshift(customTableObj);
      activeSample = customTableObj;
      renderSampleList();
      loadTable(customTableObj.data, customTableObj.type, customTableObj.name);

      customModal.style.display = 'none';
    } catch (err) {
      alert('Geçersiz JSON formatı: ' + err.message);
    }
  });

  window.addEventListener('resize', () => {
    setTimeout(renderTrajectoryLines, 100);
  });

  // Initial Load
  renderSampleList();
  loadTable(activeSample.data, activeSample.type, activeSample.name);

})();
