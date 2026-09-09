/**
 * ============================================================================
 * Table Inspector & X-Ray Visualizer (Tablo Sistem Denetleyicisi ve Yörünge Takipçisi)
 * ============================================================================
 * Yüklenen PDF ve JSON dosyalarındaki tabloların arka planda nasıl algılandığını,
 * hangi kurallarla sınıflandırıldığını, satır/sütun/hiyerarşik başlıkların nasıl
 * eşleştirildiğini ve sesli okuma yörüngesini (trajectory) adım adım görselleştiren
 * interaktif denetleyici motoru.
 */

(function (window) {
  'use strict';

  class TableInspector {
    constructor() {
      this.modal = null;
      this.isOpen = false;
      this.tables = [];
      this.currentTableIndex = 0;
      this.currentStepIndex = 0;
      this.isPlaying = false;
      this.playTimer = null;
      this.playbackSpeed = 1.0;
      this.showTrajectory = true;
      this.showCoords = true;
      this.showBreadcrumbs = true;
      this.activeTab = 'xray'; // 'xray' | 'decision' | 'simulator'

      this._initDom();
    }

    /**
     * DOM elementlerini ve modal iskeletini oluşturur
     */
    _initDom() {
      if (document.getElementById('table-inspector-modal')) {
        this.modal = document.getElementById('table-inspector-modal');
        return;
      }

      const modalHtml = `
      <div id="table-inspector-modal" class="inspector-modal-backdrop hidden" aria-hidden="true">
        <div class="inspector-modal-container">
          <!-- Top Header -->
          <div class="inspector-header">
            <div class="inspector-brand">
              <div class="inspector-icon-wrap">
                <i class="fa-solid fa-microscope"></i>
              </div>
              <div>
                <h2 class="inspector-title">Tablo X-Ray &amp; Karar Denetleyicisi</h2>
                <p class="inspector-subtitle">Tablo Hücreleri, Hiyerarşik Başlık Soy Ağacı ve Sesli Okuma Yörünge Takibi</p>
              </div>
            </div>

            <!-- Table Navigation Dropdown / Buttons -->
            <div class="inspector-header-controls">
              <div class="inspector-table-select-wrap">
                <label for="inspector-table-select"><i class="fa-solid fa-table-cells"></i> Tablo Seç:</label>
                <select id="inspector-table-select" class="inspector-select"></select>
              </div>

              <div class="inspector-header-actions">
                <button type="button" id="inspector-custom-json-btn" class="inspector-btn secondary" title="JSON Yapıştır / Test Et">
                  <i class="fa-solid fa-code"></i> JSON Test
                </button>
                <button type="button" id="inspector-close-btn" class="inspector-btn close-btn" title="Kapat (ESC)">
                  <i class="fa-solid fa-xmark"></i>
                </button>
              </div>
            </div>
          </div>

          <!-- Navigation Tabs -->
          <div class="inspector-tab-bar">
            <button type="button" class="inspector-tab-btn active" data-tab="xray">
              <i class="fa-solid fa-layer-group"></i> <span>1. Görsel X-Ray &amp; Yörünge Haritası</span>
            </button>
            <button type="button" class="inspector-tab-btn" data-tab="decision">
              <i class="fa-solid fa-brain"></i> <span>2. Sistem Karar &amp; Metrik Motoru</span>
            </button>
            <button type="button" class="inspector-tab-btn" data-tab="simulator">
              <i class="fa-solid fa-circle-play"></i> <span>3. Canlı Simülatör &amp; TTS Takibi</span>
            </button>
          </div>

          <!-- Main Body -->
          <div class="inspector-body">
            
            <!-- TAB 1: X-RAY & TRAJECTORY VIEW -->
            <div id="inspector-tab-xray" class="inspector-tab-pane active">
              <div class="xray-layout">
                <!-- Left Visual Stage -->
                <div class="xray-canvas-panel">
                  <div class="xray-toolbar">
                    <div class="xray-legend">
                      <span class="legend-item tag-banner"><i class="fa-solid fa-crown"></i> Üst Başlık</span>
                      <span class="legend-item tag-col-header"><i class="fa-solid fa-heading"></i> Sütun Başlığı</span>
                      <span class="legend-item tag-sub-header"><i class="fa-solid fa-level-down"></i> Alt Başlık</span>
                      <span class="legend-item tag-row-header"><i class="fa-solid fa-tag"></i> Satır Başlığı</span>
                      <span class="legend-item tag-data"><i class="fa-solid fa-cubes"></i> Veri Hücresi</span>
                      <span class="legend-item tag-footnote"><i class="fa-solid fa-note-sticky"></i> Dipnot</span>
                    </div>

                    <div class="xray-view-options">
                      <label class="xray-checkbox-label">
                        <input type="checkbox" id="xray-toggle-trajectory" checked>
                        <span>Yörünge Çizgisi</span>
                      </label>
                      <label class="xray-checkbox-label">
                        <input type="checkbox" id="xray-toggle-coords" checked>
                        <span>Koordinatlar</span>
                      </label>
                    </div>
                  </div>

                  <!-- Table Render Stage Container -->
                  <div class="xray-stage-wrap" id="xray-stage-wrap">
                    <svg id="xray-trajectory-svg" class="xray-trajectory-svg"></svg>
                    <div id="xray-rendered-grid" class="xray-rendered-grid"></div>
                  </div>
                </div>

                <!-- Right Detail Inspector Panel -->
                <div class="xray-detail-panel">
                  <div class="detail-card main-summary-card">
                    <div class="summary-badge-row">
                      <span id="xray-type-badge" class="type-pill">A_MATRIX</span>
                      <span id="xray-confidence-badge" class="conf-pill">%98.5 Güven</span>
                    </div>
                    <h3 id="xray-table-title" class="table-name-title">Tablo #1</h3>
                    <p id="xray-strategy-desc" class="strategy-description">Bu tablo için uygulanan okuma mantığı yükleniyor...</p>
                  </div>

                  <!-- Active Inspected Cell Box -->
                  <div class="detail-card active-cell-card">
                    <div class="card-header-mini">
                      <i class="fa-solid fa-crosshairs"></i> Seçili Hücre Detayları
                      <span id="inspector-active-order-badge" class="order-badge">Adım #1</span>
                    </div>

                    <div class="cell-info-grid">
                      <div class="info-row">
                        <span class="info-label">Konum:</span>
                        <span id="cell-detail-grid-pos" class="info-val">Satır 0, Sütun 0</span>
                      </div>
                      <div class="info-row">
                        <span class="info-label">BBox (X0,Y0,X1,Y1):</span>
                        <span id="cell-detail-coords" class="info-val code-font">[0, 0, 0, 0]</span>
                      </div>
                      <div class="info-row">
                        <span class="info-label">Anlamsal Rolü:</span>
                        <span id="cell-detail-role" class="info-val role-tag">Veri Hücresi</span>
                      </div>
                    </div>

                    <div class="text-comparison-block">
                      <div class="text-block-item">
                        <div class="text-block-title"><i class="fa-solid fa-file-lines"></i> Orijinal Ham OCR Metni:</div>
                        <div id="cell-detail-raw-text" class="text-content-box raw">Seçim bekleniyor...</div>
                      </div>
                      
                      <div class="text-block-item">
                        <div class="text-block-title"><i class="fa-solid fa-sitemap"></i> Başlık Soy Ağacı (Lineage):</div>
                        <div id="cell-detail-lineage" class="lineage-trail-box">-</div>
                      </div>

                      <div class="text-block-item">
                        <div class="text-block-title"><i class="fa-solid fa-volume-high" style="color:#38bdf8;"></i> TTS Seslendirme İfadesi (fullSentenceText):</div>
                        <div id="cell-detail-speech-text" class="text-content-box speech">Seçim bekleniyor...</div>
                      </div>
                    </div>

                    <div class="cell-actions-row">
                      <button type="button" id="inspector-speak-active-cell-btn" class="inspector-btn primary full">
                        <i class="fa-solid fa-volume-high"></i> Bu Hücreyi Dinle
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- TAB 2: DECISION & METRICS VIEW -->
            <div id="inspector-tab-decision" class="inspector-tab-pane">
              <div class="decision-layout">
                <!-- Metrics Grid -->
                <div class="metrics-summary-row">
                  <div class="metric-card">
                    <div class="metric-icon"><i class="fa-solid fa-table"></i></div>
                    <div class="metric-body">
                      <span class="metric-value" id="metric-grid-size">0 × 0</span>
                      <span class="metric-title">Matris Boyutu (Satır × Sütun)</span>
                    </div>
                  </div>

                  <div class="metric-card">
                    <div class="metric-icon"><i class="fa-solid fa-chart-pie"></i></div>
                    <div class="metric-body">
                      <span class="metric-value" id="metric-cell-count">0</span>
                      <span class="metric-title">Toplam Hücre / Parça</span>
                    </div>
                  </div>

                  <div class="metric-card">
                    <div class="metric-icon"><i class="fa-solid fa-code-merge"></i></div>
                    <div class="metric-body">
                      <span class="metric-value" id="metric-merge-ratio">%0</span>
                      <span class="metric-title">Hücre Birleşme Oranı</span>
                    </div>
                  </div>

                  <div class="metric-card">
                    <div class="metric-icon"><i class="fa-solid fa-sitemap"></i></div>
                    <div class="metric-body">
                      <span class="metric-value" id="metric-multi-header">HAYIR</span>
                      <span class="metric-title">Çok Seviyeli Başlık</span>
                    </div>
                  </div>
                </div>

                <!-- Explanation & Rule Trace -->
                <div class="decision-details-grid">
                  <div class="decision-card">
                    <div class="card-title-lg">
                      <i class="fa-solid fa-route"></i> Sınıflandırma Mantığı &amp; Karar Adımları
                    </div>
                    <div id="decision-rule-list" class="decision-rule-list">
                      <!-- Populated dynamically -->
                    </div>
                  </div>

                  <div class="decision-card">
                    <div class="card-title-lg">
                      <i class="fa-solid fa-diagram-project"></i> Başlık ve Hiyerarşi Ağacı
                    </div>
                    <div id="decision-tree-container" class="decision-tree-container">
                      <!-- Tree visualization injected here -->
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <!-- TAB 3: LIVE SIMULATOR VIEW -->
            <div id="inspector-tab-simulator" class="inspector-tab-pane">
              <div class="simulator-layout">
                <!-- Simulator Left Controls & Player -->
                <div class="sim-player-panel">
                  <div class="sim-controls-card">
                    <div class="sim-playback-controls">
                      <button type="button" id="sim-prev-btn" class="sim-btn" title="Önceki Adım">
                        <i class="fa-solid fa-backward-step"></i>
                      </button>
                      <button type="button" id="sim-play-btn" class="sim-btn play-main" title="Oynat / Duraklat">
                        <i class="fa-solid fa-play"></i>
                      </button>
                      <button type="button" id="sim-next-btn" class="sim-btn" title="Sonraki Adım">
                        <i class="fa-solid fa-forward-step"></i>
                      </button>
                      <button type="button" id="sim-reset-btn" class="sim-btn" title="Başa Dön">
                        <i class="fa-solid fa-rotate-left"></i>
                      </button>
                    </div>

                    <div class="sim-speed-wrap">
                      <label><i class="fa-solid fa-gauge-high"></i> Hız:</label>
                      <select id="sim-speed-select" class="sim-speed-select">
                        <option value="0.75">0.75x</option>
                        <option value="1.0" selected>1.0x</option>
                        <option value="1.25">1.25x</option>
                        <option value="1.5">1.5x</option>
                        <option value="2.0">2.0x</option>
                      </select>
                    </div>

                    <div class="sim-progress-wrap">
                      <div class="sim-progress-text">
                        <span>İlerleme:</span>
                        <span id="sim-step-indicator">0 / 0</span>
                      </div>
                      <div class="sim-progress-bar-bg">
                        <div id="sim-progress-bar-fill" class="sim-progress-bar-fill"></div>
                      </div>
                    </div>
                  </div>

                  <!-- Live Speaking Monitor Display -->
                  <div class="sim-speaking-display">
                    <div class="speaking-header-row">
                      <span class="live-dot-pill"><span class="pulse-dot"></span> Canlı Seslendirme Monitörü</span>
                      <span id="sim-current-role-badge" class="role-pill">Veri</span>
                    </div>

                    <div class="waveform-animation" id="sim-waveform">
                      <span></span><span></span><span></span><span></span><span></span>
                      <span></span><span></span><span></span><span></span><span></span>
                    </div>

                    <div id="sim-active-spoken-text" class="active-spoken-text">
                      Oynatmak için "Oynat" butonuna basınız...
                    </div>

                    <div class="sim-reasoning-log" id="sim-reasoning-log">
                      <i class="fa-solid fa-lightbulb"></i> <span id="sim-reasoning-text">Sistem bu hücreyi satır ve sütun hiyerarşisine göre bağlayarak okur.</span>
                    </div>
                  </div>
                </div>

                <!-- Simulator Right Step Queue Stream -->
                <div class="sim-queue-panel">
                  <div class="queue-header">
                    <i class="fa-solid fa-list-ol"></i> Tam Okuma Akışı Sıralaması (<span id="sim-queue-count">0</span>)
                  </div>
                  <div id="sim-queue-list" class="sim-queue-list">
                    <!-- Queue items injected here -->
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
      `;

      document.body.insertAdjacentHTML('beforeend', modalHtml);
      this.modal = document.getElementById('table-inspector-modal');
      this._bindEvents();
    }

    /**
     * Modal olaylarını bağlar
     */
    _bindEvents() {
      if (!this.modal) return;

      // Close button
      const closeBtn = this.modal.querySelector('#inspector-close-btn');
      if (closeBtn) closeBtn.addEventListener('click', () => this.close());

      // Backdrop click closes modal
      this.modal.addEventListener('click', (e) => {
        if (e.target === this.modal) this.close();
      });

      // ESC key closes modal
      document.addEventListener('keydown', (e) => {
        if (this.isOpen && e.key === 'Escape') this.close();
      });

      // Tab switching
      const tabBtns = this.modal.querySelectorAll('.inspector-tab-btn');
      tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          tabBtns.forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          this.activeTab = btn.dataset.tab;

          const panes = this.modal.querySelectorAll('.inspector-tab-pane');
          panes.forEach(p => p.classList.remove('active'));
          const targetPane = this.modal.querySelector(`#inspector-tab-${this.activeTab}`);
          if (targetPane) targetPane.classList.add('active');

          if (this.activeTab === 'xray') {
            this._drawTrajectory();
          }
        });
      });

      // Table selector change
      const tableSelect = this.modal.querySelector('#inspector-table-select');
      if (tableSelect) {
        tableSelect.addEventListener('change', (e) => {
          const idx = parseInt(e.target.value, 10);
          if (!isNaN(idx) && this.tables[idx]) {
            this.switchTable(idx);
          }
        });
      }

      // Trajectory toggle
      const trajectoryToggle = this.modal.querySelector('#xray-toggle-trajectory');
      if (trajectoryToggle) {
        trajectoryToggle.addEventListener('change', (e) => {
          this.showTrajectory = e.target.checked;
          const svg = this.modal.querySelector('#xray-trajectory-svg');
          if (svg) svg.style.display = this.showTrajectory ? 'block' : 'none';
        });
      }

      // Coords toggle
      const coordsToggle = this.modal.querySelector('#xray-toggle-coords');
      if (coordsToggle) {
        coordsToggle.addEventListener('change', (e) => {
          this.showCoords = e.target.checked;
          const badges = this.modal.querySelectorAll('.cell-coord-tag');
          badges.forEach(b => b.style.display = this.showCoords ? 'inline-block' : 'none');
        });
      }

      // Custom JSON test modal trigger
      const customJsonBtn = this.modal.querySelector('#inspector-custom-json-btn');
      if (customJsonBtn) {
        customJsonBtn.addEventListener('click', () => {
          const jsonText = prompt('Test etmek istediğiniz Tablo JSON nesnesini yapıştırın:');
          if (jsonText) {
            try {
              const parsed = JSON.parse(jsonText);
              this.loadCustomTableJson(parsed);
            } catch (err) {
              alert('Geçersiz JSON formatı: ' + err.message);
            }
          }
        });
      }

      // Speak active cell
      const speakBtn = this.modal.querySelector('#inspector-speak-active-cell-btn');
      if (speakBtn) {
        speakBtn.addEventListener('click', () => {
          this._speakActiveCell();
        });
      }

      // Simulator Play / Pause
      const playBtn = this.modal.querySelector('#sim-play-btn');
      if (playBtn) {
        playBtn.addEventListener('click', () => {
          if (this.isPlaying) {
            this.pauseSimulator();
          } else {
            this.playSimulator();
          }
        });
      }

      // Simulator Prev / Next / Reset
      const prevBtn = this.modal.querySelector('#sim-prev-btn');
      if (prevBtn) prevBtn.addEventListener('click', () => this.stepPrev());

      const nextBtn = this.modal.querySelector('#sim-next-btn');
      if (nextBtn) nextBtn.addEventListener('click', () => this.stepNext());

      const resetBtn = this.modal.querySelector('#sim-reset-btn');
      if (resetBtn) resetBtn.addEventListener('click', () => this.resetSimulator());

      // Speed change
      const speedSelect = this.modal.querySelector('#sim-speed-select');
      if (speedSelect) {
        speedSelect.addEventListener('change', (e) => {
          this.playbackSpeed = parseFloat(e.target.value) || 1.0;
        });
      }

      // Window resize adjusts trajectory
      window.addEventListener('resize', () => {
        if (this.isOpen && this.activeTab === 'xray') {
          this._drawTrajectory();
        }
      });
    }

    /**
     * Modal penceresini açar
     */
    open(targetTableOrIndex = 0) {
      this._initDom();
      if (!this.modal) return;

      this.isOpen = true;
      this.modal.classList.remove('hidden');
      this.modal.setAttribute('aria-hidden', 'false');

      // Update table select options
      this._updateTableSelectOptions();

      if (typeof targetTableOrIndex === 'number') {
        this.switchTable(targetTableOrIndex);
      } else if (typeof targetTableOrIndex === 'object' && targetTableOrIndex !== null) {
        const foundIdx = this.tables.findIndex(t => t.id === targetTableOrIndex.id || t === targetTableOrIndex);
        this.switchTable(foundIdx >= 0 ? foundIdx : 0);
      } else {
        this.switchTable(0);
      }
    }

    /**
     * Modal penceresini kapatır
     */
    close() {
      if (!this.modal) return;
      this.isOpen = false;
      this.pauseSimulator();
      this.modal.classList.add('hidden');
      this.modal.setAttribute('aria-hidden', 'true');
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    }

    /**
     * Uygulama genelindeki tabloları ve BBox'ları günceller
     */
    setTables(detectedTables = [], parsedBBoxes = [], activePage = 1) {
      this.tables = detectedTables || [];
      if (this.modal) {
        this._updateTableSelectOptions();
        if (this.isOpen) {
          this.switchTable(Math.min(this.currentTableIndex, Math.max(0, this.tables.length - 1)));
        }
      }
    }

    /**
     * Tablo seçim açılır kutusunu yeniler
     */
    _updateTableSelectOptions() {
      const select = this.modal.querySelector('#inspector-table-select');
      if (!select) return;

      select.innerHTML = '';
      if (this.tables.length === 0) {
        select.innerHTML = '<option value="-1">Tespit Edilen Tablo Yok</option>';
        return;
      }

      this.tables.forEach((tbl, idx) => {
        const opt = document.createElement('option');
        opt.value = idx;
        const typeName = tbl.type || 'TABLO';
        const cellCount = tbl.cells ? tbl.cells.length : 0;
        opt.textContent = `Tablo #${idx + 1}: ${tbl.id || 'Table'} (Sayfa ${tbl.page || 1} • ${cellCount} Hücre • ${typeName})`;
        select.appendChild(opt);
      });
      select.value = this.currentTableIndex;
    }

    /**
     * Aktif incelenen tabloyu değiştirir
     */
    switchTable(index) {
      if (!this.tables || this.tables.length === 0) {
        this._renderEmptyState();
        return;
      }

      this.currentTableIndex = Math.max(0, Math.min(index, this.tables.length - 1));
      const select = this.modal.querySelector('#inspector-table-select');
      if (select) select.value = this.currentTableIndex;

      const table = this.tables[this.currentTableIndex];
      this.currentStepIndex = 0;
      this.pauseSimulator();

      // Ensure classification & reading order are fully generated
      this._enrichTableData(table);

      // Render all three tabs
      this._renderXRayView(table);
      this._renderDecisionView(table);
      this._renderSimulatorView(table);

      // Select first cell by default
      if (table.orderedCells && table.orderedCells.length > 0) {
        this.selectCell(0);
      }
    }

    /**
     * Tablo nesnesine sınıflandırma ve tam okuma sırasını iliştirir
     */
    _enrichTableData(table) {
      const classifier = (typeof TableClassifier !== 'undefined')
        ? (window.tableClassifier || new TableClassifier())
        : null;

      if (!classifier) return;

      // Classify if not already done
      const classification = classifier.classifyTable(table);
      table.classification = classification;
      table.calculatedType = classification.type;
      table.confidence = classification.confidence || 0.98;

      // Generate full accessible reading order
      const readingResult = classifier.generateAccessibleTableReadingOrder(table, table.page || 1, 1, this.currentTableIndex + 1);
      table.orderedCells = readingResult.items || [];
      table.headerStructure = classifier.structureTableHeadersAndNotes(table);
      table.metrics = classification.metrics || {};
      table.strategyName = this._getStrategyName(table.calculatedType);
    }

    _getStrategyName(type) {
      switch (type) {
        case 'A_MATRIX':
          return 'Strateji 1: Klasik Matris Z-Yolu (Satır ve Sütun Başlığı Bağlamalı)';
        case 'B_KEY_VALUE':
          return 'Strateji 2: Satır Satır Etiket-Değer Form Okuması';
        case 'C_PARALLEL_TEXT':
          return 'Strateji 3: Sütun Bazlı Paralel Metin Akışı & NLP Cümle Birleştirme';
        case 'D_MERGED_CELLS':
          return 'Strateji 5: Çok Seviyeli Hiyerarşik Ebeveyn-Çocuk Başlık Eşleştirmesi';
        case 'E_FORMULA':
          return 'Strateji 4: Matematiksel Denklem & Formül Eşitlik Akışı';
        case 'F_HYBRID_NOTE':
          return 'Strateji 6: Ana Tablo Hücreleri İlk, Dipnot En Son Bağımsız';
        default:
          return 'Standart Doğal Izgara Okuması';
      }
    }

    /**
     * Boş durum ekranı gösterir
     */
    _renderEmptyState() {
      const stage = this.modal.querySelector('#xray-rendered-grid');
      if (stage) {
        stage.innerHTML = `
          <div class="empty-state-box">
            <i class="fa-solid fa-table-cells-large" style="font-size:3rem; color:#64748b; margin-bottom:12px;"></i>
            <h3>İncelenecek Tablo Bulunamadı</h3>
            <p>PDF veya JSON belgenizde tablo tespit edilmedi. "JSON Test" butonuna basarak örnek bir tablo yapıştırabilirsiniz.</p>
          </div>
        `;
      }
    }

    /**
     * TAB 1: Görsel X-Ray ve Izgara Render
     */
    _renderXRayView(table) {
      const typeBadge = this.modal.querySelector('#xray-type-badge');
      const confBadge = this.modal.querySelector('#xray-confidence-badge');
      const title = this.modal.querySelector('#xray-table-title');
      const desc = this.modal.querySelector('#xray-strategy-desc');

      if (typeBadge) {
        typeBadge.textContent = table.calculatedType || table.type || 'A_MATRIX';
        typeBadge.className = `type-pill tag-${(table.calculatedType || 'A_MATRIX').toLowerCase()}`;
      }
      if (confBadge) {
        const confPct = Math.round((table.confidence || 0.98) * 100);
        confBadge.textContent = `%${confPct} Güven`;
      }
      if (title) {
        title.textContent = `Tablo #${this.currentTableIndex + 1} (${table.id || 'Table'})`;
      }
      if (desc) {
        desc.textContent = table.strategyName || 'Standart Matris Okuma';
      }

      // Render visual table cells grid
      const gridContainer = this.modal.querySelector('#xray-rendered-grid');
      if (!gridContainer) return;

      const cells = table.orderedCells || [];
      if (cells.length === 0) {
        gridContainer.innerHTML = '<div class="empty-hint">Hücre bulunamadı.</div>';
        return;
      }

      // Group cells by spatial row index for responsive HTML grid rendering
      const rowMap = new Map();
      cells.forEach((c) => {
        const r = c.row !== undefined ? c.row : 0;
        if (!rowMap.has(r)) rowMap.set(r, []);
        rowMap.get(r).push(c);
      });

      const sortedRowIndices = Array.from(rowMap.keys()).sort((a, b) => a - b);
      let html = '<table class="xray-html-table">';

      sortedRowIndices.forEach((rIdx) => {
        const rowCells = rowMap.get(rIdx);
        rowCells.sort((a, b) => (a.col || 0) - (b.col || 0));
        html += '<tr>';
        rowCells.forEach((c) => {
          const roleClass = this._getRoleClass(c.cell_type);
          const orderNum = c.table_order_id || c.sentence_id || 1;
          const coordsText = c.rawCoords ? `[${c.rawCoords.join(',')}]` : '';
          const rowspanAttr = (c.rowspan && c.rowspan > 1) ? ` rowspan="${c.rowspan}"` : '';
          const colspanAttr = (c.colspan && c.colspan > 1) ? ` colspan="${c.colspan}"` : '';

          html += `
            <td class="xray-grid-cell ${roleClass}" data-step-index="${cells.indexOf(c)}" data-order="${orderNum}"${rowspanAttr}${colspanAttr}>
              <span class="cell-order-badge">#${orderNum}</span>
              <div class="cell-content-text">${this._escapeHtml(c.text || '')}</div>
              <span class="cell-coord-tag" style="display:${this.showCoords ? 'inline-block' : 'none'};">${coordsText}</span>
            </td>
          `;
        });
        html += '</tr>';
      });

      html += '</table>';
      gridContainer.innerHTML = html;

      // Attach click handlers to visual cells
      const domCells = gridContainer.querySelectorAll('.xray-grid-cell');
      domCells.forEach(cellDom => {
        cellDom.addEventListener('click', () => {
          const stepIdx = parseInt(cellDom.dataset.stepIndex, 10);
          if (!isNaN(stepIdx)) {
            this.selectCell(stepIdx);
          }
        });
      });

      // Draw Trajectory SVG after DOM layout
      setTimeout(() => this._drawTrajectory(), 60);
    }

    _getRoleClass(cellType) {
      switch (cellType) {
        case 'top_banner': return 'role-banner';
        case 'col_header': return 'role-col-header';
        case 'sub_header': return 'role-sub-header';
        case 'row_header': return 'role-row-header';
        case 'footnote': return 'role-footnote';
        case 'data':
        default: return 'role-data';
      }
    }

    _getRoleLabel(cellType) {
      switch (cellType) {
        case 'top_banner': return '👑 Üst Başlık (Banner)';
        case 'col_header': return '🏷️ Sütun Başlığı';
        case 'sub_header': return '📑 Alt Başlık (Sub-header)';
        case 'row_header': return '📌 Satır Başlığı';
        case 'footnote': return '📝 Dipnot / Açıklama';
        case 'data':
        default: return '📊 Veri Hücresi';
      }
    }

    /**
     * Yörünge (Trajectory) çizgilerini SVG katmanına çizer
     */
    _drawTrajectory() {
      const svg = this.modal.querySelector('#xray-trajectory-svg');
      const stageWrap = this.modal.querySelector('#xray-stage-wrap');
      if (!svg || !stageWrap) return;

      const cells = this.modal.querySelectorAll('.xray-grid-cell');
      if (cells.length < 2 || !this.showTrajectory) {
        svg.innerHTML = '';
        return;
      }

      const stageRect = stageWrap.getBoundingClientRect();
      const points = [];

      cells.forEach(c => {
        const r = c.getBoundingClientRect();
        points.push({
          x: r.left - stageRect.left + r.width / 2,
          y: r.top - stageRect.top + r.height / 2
        });
      });

      let pathData = `M ${points[0].x} ${points[0].y}`;
      for (let i = 1; i < points.length; i++) {
        pathData += ` L ${points[i].x} ${points[i].y}`;
      }

      svg.innerHTML = `
        <defs>
          <linearGradient id="trajGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="#38bdf8"/>
            <stop offset="100%" stop-color="#818cf8"/>
          </linearGradient>
          <marker id="arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M 0 1 L 10 5 L 0 9 z" fill="#38bdf8" />
          </marker>
        </defs>
        <path d="${pathData}" class="trajectory-svg-line" marker-mid="url(#arrow)" />
      `;
    }

    /**
     * TAB 2: Karar ve Metrik Motoru Render
     */
    _renderDecisionView(table) {
      const metrics = table.metrics || {};
      const numRows = metrics.n_rows || (table.headerStructure ? table.headerStructure.firstDataRow + 2 : 4);
      const numCols = metrics.n_cols || 4;
      const cellCount = table.orderedCells ? table.orderedCells.length : 0;
      const mergeRatio = metrics.merge_ratio ? Math.round(metrics.merge_ratio * 100) : 0;
      const multiHeader = metrics.has_multi_level_headers ? 'EVET (Hiyerarşik)' : 'HAYIR (Tek Seviye)';

      const mGrid = this.modal.querySelector('#metric-grid-size');
      const mCount = this.modal.querySelector('#metric-cell-count');
      const mMerge = this.modal.querySelector('#metric-merge-ratio');
      const mMulti = this.modal.querySelector('#metric-multi-header');

      if (mGrid) mGrid.textContent = `${numRows} × ${numCols}`;
      if (mCount) mCount.textContent = `${cellCount}`;
      if (mMerge) mMerge.textContent = `%${mergeRatio}`;
      if (mMulti) {
        mMulti.textContent = multiHeader;
        mMulti.style.color = metrics.has_multi_level_headers ? '#38bdf8' : '#94a3b8';
      }

      // Render Decision Rules trace
      const ruleList = this.modal.querySelector('#decision-rule-list');
      if (ruleList) {
        const rules = [];

        if (metrics.has_multi_level_headers || table.calculatedType === 'D_MERGED_CELLS') {
          rules.push({
            icon: 'fa-sitemap',
            color: '#ec4899',
            title: 'Kural D-1: Çok Seviyeli & Birleştirilmiş Başlık Algılandı',
            desc: 'Üst başlıklar altındaki alt kırılımlar (örn: Satış Rakamları ➔ Ocak-Mart, Nisan-Haziran) X ekseni çakışması ile hiyerarşik ağaca bağlandı.'
          });
        }

        if (table.headerStructure && table.headerStructure.topBannerText) {
          rules.push({
            icon: 'fa-crown',
            color: '#a855f7',
            title: 'Kural T-1: Tablo Üst Başlığı (Banner) Ayrıştırıldı',
            desc: `"${table.headerStructure.topBannerText}" metni tabloyu tanımlayan ana başlık olarak en başta seslendirildi.`
          });
        }

        if (table.calculatedType === 'A_MATRIX') {
          rules.push({
            icon: 'fa-table-cells',
            color: '#0284c7',
            title: 'Kural A-1: Standart Matris Izgara Deseni',
            desc: 'Sütun başlıkları ve satır başlıkları her veri hücresi okunurken dinamik bağlam olarak birleştirildi.'
          });
        } else if (table.calculatedType === 'C_PARALLEL_TEXT') {
          rules.push({
            icon: 'fa-file-lines',
            color: '#8b5cf6',
            title: 'Kural C-1: Paralel Sütun Akışı (Gazete / Çift Dilli Düzen)',
            desc: 'Matris yapısı kaldırılarak sütun içindeki satırlar NLP ile tam paragraflara birleştirildi.'
          });
        } else if (table.calculatedType === 'F_HYBRID_NOTE') {
          rules.push({
            icon: 'fa-note-sticky',
            color: '#06b6d4',
            title: 'Kural F-1: Dipnot ve Kaynak İzolasyonu',
            desc: 'Tablo altındaki not ve dipnotlar veri hücrelerinden ayrıştırılarak en son okundu.'
          });
        }

        rules.push({
          icon: 'fa-brain',
          color: '#10b981',
          title: 'Kural S-1: Doğal Konuşma Duraklaması (Comma Pause Integration)',
          desc: 'TTS motorunun insan kulağına anlaşılır duraklama yapması için başlık ve değerler arasına ", " (virgül + boşluk) eklendi.'
        });

        ruleList.innerHTML = rules.map(r => `
          <div class="rule-item">
            <div class="rule-icon" style="background: ${r.color}22; color: ${r.color};">
              <i class="fa-solid ${r.icon}"></i>
            </div>
            <div class="rule-content">
              <div class="rule-title" style="color:${r.color};">${r.title}</div>
              <div class="rule-desc">${r.desc}</div>
            </div>
          </div>
        `).join('');
      }

      // Render Tree Visualization
      const treeContainer = this.modal.querySelector('#decision-tree-container');
      if (treeContainer) {
        const hs = table.headerStructure || {};
        let treeHtml = '<div class="hierarchy-tree-root">';

        if (hs.topBannerText) {
          treeHtml += `<div class="tree-node banner"><i class="fa-solid fa-crown"></i> [Üst Başlık]: ${this._escapeHtml(hs.topBannerText)}</div>`;
        }

        treeHtml += '<div class="tree-sub-branch">';
        if (hs.colHeaders && hs.colHeaders.size > 0) {
          treeHtml += '<div class="tree-node header-group"><i class="fa-solid fa-heading"></i> Sütun Başlıkları:</div><ul class="tree-list">';
          hs.colHeaders.forEach((val, key) => {
            treeHtml += `<li><span class="tree-chip col">Sütun ${key}:</span> ${this._escapeHtml(val)}</li>`;
          });
          treeHtml += '</ul>';
        }

        if (hs.rowHeaders && hs.rowHeaders.size > 0) {
          treeHtml += '<div class="tree-node header-group" style="margin-top:8px;"><i class="fa-solid fa-tag"></i> Satır Başlıkları:</div><ul class="tree-list">';
          hs.rowHeaders.forEach((val, key) => {
            treeHtml += `<li><span class="tree-chip row">Satır ${key}:</span> ${this._escapeHtml(val)}</li>`;
          });
          treeHtml += '</ul>';
        }
        treeHtml += '</div></div>';

        treeContainer.innerHTML = treeHtml;
      }
    }

    /**
     * TAB 3: Canlı Simülatör ve Okuma Sırası Kuyruğu Render
     */
    _renderSimulatorView(table) {
      const queueList = this.modal.querySelector('#sim-queue-list');
      const queueCount = this.modal.querySelector('#sim-queue-count');
      const stepIndicator = this.modal.querySelector('#sim-step-indicator');

      const cells = table.orderedCells || [];
      if (queueCount) queueCount.textContent = cells.length;
      if (stepIndicator) stepIndicator.textContent = `1 / ${cells.length}`;

      if (queueList) {
        queueList.innerHTML = cells.map((c, idx) => {
          const orderNum = c.table_order_id || c.sentence_id || (idx + 1);
          const roleClass = this._getRoleClass(c.cell_type);
          const speech = c.fullSentenceText || c.text || '';
          return `
            <div class="sim-queue-item ${roleClass}" data-step-index="${idx}">
              <span class="queue-num">#${orderNum}</span>
              <div class="queue-body">
                <div class="queue-speech-text">${this._escapeHtml(speech)}</div>
                <div class="queue-raw-sub">Ham: "${this._escapeHtml(c.text || '')}" • Rol: ${this._getRoleLabel(c.cell_type)}</div>
              </div>
            </div>
          `;
        }).join('');

        // Attach click listeners to queue items
        const items = queueList.querySelectorAll('.sim-queue-item');
        items.forEach(it => {
          it.addEventListener('click', () => {
            const stepIdx = parseInt(it.dataset.stepIndex, 10);
            if (!isNaN(stepIdx)) {
              this.selectCell(stepIdx);
            }
          });
        });
      }
    }

    /**
     * Belirli bir sıradaki hücreyi seçer ve panellerde vurgular
     */
    selectCell(stepIndex) {
      const table = this.tables[this.currentTableIndex];
      if (!table || !table.orderedCells || table.orderedCells.length === 0) return;

      this.currentStepIndex = Math.max(0, Math.min(stepIndex, table.orderedCells.length - 1));
      const cell = table.orderedCells[this.currentStepIndex];

      // Update X-Ray Detail Panel
      const orderBadge = this.modal.querySelector('#inspector-active-order-badge');
      const gridPos = this.modal.querySelector('#cell-detail-grid-pos');
      const coords = this.modal.querySelector('#cell-detail-coords');
      const role = this.modal.querySelector('#cell-detail-role');
      const rawText = this.modal.querySelector('#cell-detail-raw-text');
      const lineage = this.modal.querySelector('#cell-detail-lineage');
      const speechText = this.modal.querySelector('#cell-detail-speech-text');

      if (orderBadge) orderBadge.textContent = `Adım #${cell.table_order_id || this.currentStepIndex + 1}`;
      if (gridPos) gridPos.textContent = `Satır ${cell.row ?? 0}, Sütun ${cell.col ?? 0}`;
      if (coords) coords.textContent = cell.rawCoords ? `[${cell.rawCoords.join(', ')}]` : '-';
      if (role) {
        role.textContent = this._getRoleLabel(cell.cell_type);
        role.className = `info-val role-tag ${this._getRoleClass(cell.cell_type)}`;
      }
      if (rawText) rawText.textContent = cell.text || '(Boş)';

      // Format lineage breadcrumb trail
      if (lineage) {
        const ancestors = cell.header_ancestors || cell.breadcrumb_trail || [];
        if (ancestors.length > 0) {
          lineage.innerHTML = ancestors.map(a => `<span class="lineage-node">${this._escapeHtml(a)}</span>`).join(' <i class="fa-solid fa-arrow-right-long lineage-arrow"></i> ') + ` <i class="fa-solid fa-arrow-right-long lineage-arrow"></i> <span class="lineage-node active-val">${this._escapeHtml(cell.text || '')}</span>`;
        } else if (cell.row_header_text || cell.col_header_text) {
          const parts = [];
          if (cell.row_header_text) parts.push(`<span class="lineage-node">${this._escapeHtml(cell.row_header_text)}</span>`);
          if (cell.col_header_text) parts.push(`<span class="lineage-node">${this._escapeHtml(cell.col_header_text)}</span>`);
          parts.push(`<span class="lineage-node active-val">${this._escapeHtml(cell.text || '')}</span>`);
          lineage.innerHTML = parts.join(' <i class="fa-solid fa-arrow-right-long lineage-arrow"></i> ');
        } else {
          lineage.textContent = 'Bağımsız / Düz Hücre';
        }
      }

      if (speechText) speechText.textContent = cell.fullSentenceText || cell.text || '(Metin yok)';

      // Highlight active cell on X-Ray visual grid
      const domCells = this.modal.querySelectorAll('.xray-grid-cell');
      domCells.forEach((dc, idx) => {
        if (idx === this.currentStepIndex) {
          dc.classList.add('active-inspect-cell');
          dc.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        } else {
          dc.classList.remove('active-inspect-cell');
        }
      });

      // Update Simulator Pane Displays
      const stepIndicator = this.modal.querySelector('#sim-step-indicator');
      const progressBar = this.modal.querySelector('#sim-progress-bar-fill');
      const activeSpoken = this.modal.querySelector('#sim-active-spoken-text');
      const roleBadge = this.modal.querySelector('#sim-current-role-badge');
      const reasonText = this.modal.querySelector('#sim-reasoning-text');

      if (stepIndicator) stepIndicator.textContent = `${this.currentStepIndex + 1} / ${table.orderedCells.length}`;
      if (progressBar) {
        const pct = ((this.currentStepIndex + 1) / table.orderedCells.length) * 100;
        progressBar.style.width = `${pct}%`;
      }
      if (activeSpoken) activeSpoken.textContent = cell.fullSentenceText || cell.text || '';
      if (roleBadge) {
        roleBadge.textContent = this._getRoleLabel(cell.cell_type);
        roleBadge.className = `role-pill ${this._getRoleClass(cell.cell_type)}`;
      }
      if (reasonText) {
        reasonText.textContent = cell.reasoning || `${this._getRoleLabel(cell.cell_type)} için kural tabanlı semantik tamlama uygulandı.`;
      }

      // Highlight queue item
      const queueItems = this.modal.querySelectorAll('.sim-queue-item');
      queueItems.forEach((qi, idx) => {
        if (idx === this.currentStepIndex) {
          qi.classList.add('active');
          qi.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        } else {
          qi.classList.remove('active');
        }
      });
    }

    /**
     * Aktif seçili hücreyi seslendirir
     */
    _speakActiveCell() {
      const table = this.tables[this.currentTableIndex];
      if (!table || !table.orderedCells || !table.orderedCells[this.currentStepIndex]) return;

      const cell = table.orderedCells[this.currentStepIndex];
      const textToSpeak = cell.fullSentenceText || cell.text;
      if (!textToSpeak || !('speechSynthesis' in window)) return;

      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(textToSpeak);
      utterance.lang = 'tr-TR';
      utterance.rate = this.playbackSpeed;

      const waveform = this.modal.querySelector('#sim-waveform');
      if (waveform) waveform.classList.add('active');

      utterance.onend = () => {
        if (waveform) waveform.classList.remove('active');
      };
      utterance.onerror = () => {
        if (waveform) waveform.classList.remove('active');
      };

      window.speechSynthesis.speak(utterance);
    }

    /**
     * Canlı Simülatörü Başlatır
     */
    playSimulator() {
      const table = this.tables[this.currentTableIndex];
      if (!table || !table.orderedCells || table.orderedCells.length === 0) return;

      this.isPlaying = true;
      const playBtn = this.modal.querySelector('#sim-play-btn');
      if (playBtn) {
        playBtn.innerHTML = '<i class="fa-solid fa-pause"></i>';
        playBtn.classList.add('playing');
      }

      this._runSimulatorStep();
    }

    /**
     * Canlı Simülatörü Duraklatır
     */
    pauseSimulator() {
      this.isPlaying = false;
      if (this.playTimer) clearTimeout(this.playTimer);
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();

      const playBtn = this.modal.querySelector('#sim-play-btn');
      if (playBtn) {
        playBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
        playBtn.classList.remove('playing');
      }

      const waveform = this.modal.querySelector('#sim-waveform');
      if (waveform) waveform.classList.remove('active');
    }

    /**
     * Simülatörde tek bir adım işletir ve ses bitince sonrakine geçer
     */
    _runSimulatorStep() {
      if (!this.isPlaying) return;

      const table = this.tables[this.currentTableIndex];
      if (!table || !table.orderedCells || this.currentStepIndex >= table.orderedCells.length) {
        this.pauseSimulator();
        return;
      }

      this.selectCell(this.currentStepIndex);
      const cell = table.orderedCells[this.currentStepIndex];
      const textToSpeak = cell.fullSentenceText || cell.text;

      if (!('speechSynthesis' in window) || !textToSpeak) {
        // Fallback timer if speech not supported
        this.playTimer = setTimeout(() => {
          if (this.currentStepIndex < table.orderedCells.length - 1) {
            this.currentStepIndex++;
            this._runSimulatorStep();
          } else {
            this.pauseSimulator();
          }
        }, 1800 / this.playbackSpeed);
        return;
      }

      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(textToSpeak);
      utterance.lang = 'tr-TR';
      utterance.rate = this.playbackSpeed;

      const waveform = this.modal.querySelector('#sim-waveform');
      if (waveform) waveform.classList.add('active');

      utterance.onend = () => {
        if (waveform) waveform.classList.remove('active');
        if (!this.isPlaying) return;

        // Natural pause before next cell
        this.playTimer = setTimeout(() => {
          if (this.currentStepIndex < table.orderedCells.length - 1) {
            this.currentStepIndex++;
            this._runSimulatorStep();
          } else {
            this.pauseSimulator();
          }
        }, 500 / this.playbackSpeed);
      };

      utterance.onerror = () => {
        if (waveform) waveform.classList.remove('active');
        if (this.isPlaying && this.currentStepIndex < table.orderedCells.length - 1) {
          this.currentStepIndex++;
          this._runSimulatorStep();
        } else {
          this.pauseSimulator();
        }
      };

      window.speechSynthesis.speak(utterance);
    }

    stepNext() {
      this.pauseSimulator();
      const table = this.tables[this.currentTableIndex];
      if (!table || !table.orderedCells) return;
      if (this.currentStepIndex < table.orderedCells.length - 1) {
        this.selectCell(this.currentStepIndex + 1);
        this._speakActiveCell();
      }
    }

    stepPrev() {
      this.pauseSimulator();
      if (this.currentStepIndex > 0) {
        this.selectCell(this.currentStepIndex - 1);
        this._speakActiveCell();
      }
    }

    resetSimulator() {
      this.pauseSimulator();
      this.selectCell(0);
    }

    /**
     * Özel JSON nesnesini anında yükleyip test eder
     */
    loadCustomTableJson(customJson) {
      if (!customJson) return;
      const customTable = {
        id: customJson.id || customJson.table_id || 'custom-test-table',
        type: customJson.type || customJson.forced_type || 'table',
        cells: customJson.cells || customJson.table_cells || [],
        words: customJson.words || [],
        coords: customJson.coords || customJson.bbox || [50, 50, 600, 300],
        page: 1
      };

      this.tables.unshift(customTable);
      this._updateTableSelectOptions();
      this.switchTable(0);
    }

    _escapeHtml(str) {
      if (!str) return '';
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    }
  }

  // Global instance
  window.TableInspector = TableInspector;
  window.tableInspector = new TableInspector();

})(typeof window !== 'undefined' ? window : this);
