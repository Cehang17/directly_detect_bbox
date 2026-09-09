/**
 * TableClassifier - Advanced Table Detection, Structural Classification & Accessible Reading Order Engine
 *
 * Implements the 6 Structural Table Categories & Reading Order Pipeline:
 *  1. A_MATRIX: Matrix Data Grid (Row Header + Col Header + Value association)
 *  2. B_KEY_VALUE: Key-Value Form (2-column Label: Value pairs)
 *  3. C_PARALLEL_TEXT: False Table / Parallel Column Paragraphs (Vertical column-by-column flow)
 *  4. D_MERGED_CELLS: Hierarchical Colspan/Rowspan Merged Tables
 *  5. E_FORMULA: Mathematical Formulas & Calculation Tables
 *  6. F_HYBRID_NOTE: Data Table with Bottom Explanation/Footnote Blocks
 */

class TableClassifier {
  static TYPES = {
    A_MATRIX: 'A_MATRIX',
    B_KEY_VALUE: 'B_KEY_VALUE',
    C_PARALLEL_TEXT: 'C_PARALLEL_TEXT',
    D_MERGED_CELLS: 'D_MERGED_CELLS',
    E_FORMULA: 'E_FORMULA',
    F_HYBRID_NOTE: 'F_HYBRID_NOTE'
  };

  static TYPE_NAMES = {
    A_MATRIX: 'Klasik Matris Tablo',
    B_KEY_VALUE: 'Etiket - Değer / Form Tablosu',
    C_PARALLEL_TEXT: 'Paralel Metin / Çok Sütunlu Paragraf',
    D_MERGED_CELLS: 'Birleşik Hücreli / Hiyerarşik Tablo',
    E_FORMULA: 'Matematiksel / Formül Tablosu',
    F_HYBRID_NOTE: 'Dipnotlu / Açıklamalı Hibrit Tablo'
  };

  /**
   * Main entry point to process, classify, and generate accessible reading-ordered BBoxes for any table.
   * @param {Object} tableData - Raw table object or container with cells/words/bbox
   * @param {number} pageNum - Page number
   * @param {number} startSentenceNumber - Starting document sentence number counter
   * @param {number|string} tableIndex - Table sequence identifier
   * @returns {{ items: Array, tableType: string, tableId: string, nextSentenceNumber: number, tableMeta: Object }}
   */
  static processTable(tableData, pageNum = 1, startSentenceNumber = 1, tableIndex = 1) {
    const tableId = tableData.table_id || tableData.id || `table-${tableIndex}`;
    if (!tableData) {
      return { items: [], tableType: this.TYPES.A_MATRIX, tableId, nextSentenceNumber: startSentenceNumber, tableMeta: {} };
    }

    // Step 1: Extract or construct individual cell objects
    const rawCells = this._extractCellsFromTable(tableData);
    if (rawCells.length === 0) {
      return { items: [], tableType: this.TYPES.A_MATRIX, tableId, nextSentenceNumber: startSentenceNumber, tableMeta: {} };
    }

    // Step 2: Grid and coordinate reconstruction
    const tableBox = this._getRect(tableData.bbox || tableData.coords || tableData.box) || this._calculateBounds(rawCells);
    const grid = this.recalculateGridFromBBoxes(rawCells, tableBox);
    // Use grid.cells which have normalized rawCoords guaranteed
    const normalizedCells = grid.cells.length > 0 ? grid.cells : rawCells;

    // Step 3: Calculate structural metrics
    const metrics = this.calculateTableMetrics(grid, normalizedCells, tableBox);

    // Step 4: Classify table type (6 categories)
    const explicitType = (tableData.forced_type && this.TYPES[tableData.forced_type])
      || (tableData.table_type && this.TYPES[tableData.table_type])
      || (tableData.type && this.TYPES[tableData.type])
      || (normalizedCells.find(c => c.table_type && this.TYPES[c.table_type])?.table_type);

    const tableType = explicitType || this.classifyTable(grid, normalizedCells, metrics);

    // Step 5: Structure headers, multi-line mergers, and footer notes
    const structuredData = this.structureTableHeadersAndNotes(grid, normalizedCells, tableType, tableBox, metrics);
    structuredData.rawCells = rawCells;

    // Step 6: Generate accessible reading-ordered BBox items with both global sentence_id and table_order_id
    const { items, nextSentenceNumber, tableMeta } = this.generateAccessibleTableReadingOrder(
      structuredData,
      tableType,
      pageNum,
      startSentenceNumber,
      tableId,
      tableIndex
    );

    return {
      items,
      tableType,
      tableTypeName: this.TYPE_NAMES[tableType] || tableType,
      tableId,
      tableIndex,
      nextSentenceNumber,
      tableMeta
    };
  }

  /**
   * Extract or assemble raw cells from tableData
   */
  static _extractCellsFromTable(tableData) {
    let cells = [];

    const tableBox = this._getRect(tableData.bbox || tableData.coords || tableData.box || tableData.rawCoords) || [50, 50, 450, 250];

    // Check if tableData has 2D row arrays e.g. rows: [["A", "B"], ["1", "2"]] or matrix: [...]
    const rawRows = tableData.rows || tableData.matrix || tableData.grid || tableData.table_data;
    if (Array.isArray(rawRows) && rawRows.length > 0 && Array.isArray(rawRows[0])) {
      const numRows = rawRows.length;
      const numCols = Math.max(...rawRows.map(r => Array.isArray(r) ? r.length : 1), 1);
      const rowH = (tableBox[3] - tableBox[1]) / numRows;
      const colW = (tableBox[2] - tableBox[0]) / numCols;

      rawRows.forEach((rowArr, rIdx) => {
        if (!Array.isArray(rowArr)) return;
        rowArr.forEach((cellVal, cIdx) => {
          const text = (typeof cellVal === 'object' && cellVal !== null)
            ? (cellVal.text || cellVal.content || cellVal.val || '').trim()
            : String(cellVal || '').trim();
          const rect = (typeof cellVal === 'object' && cellVal !== null)
            ? this._getRect(cellVal.bbox || cellVal.rawCoords || cellVal.coords)
            : null;

          const cx0 = rect ? rect[0] : Math.round(tableBox[0] + cIdx * colW);
          const cy0 = rect ? rect[1] : Math.round(tableBox[1] + rIdx * rowH);
          const cx1 = rect ? rect[2] : Math.round(tableBox[0] + (cIdx + 1) * colW);
          const cy1 = rect ? rect[3] : Math.round(tableBox[1] + (rIdx + 1) * rowH);

          cells.push({
            id: `cell-r${rIdx}-c${cIdx}`,
            text,
            rawCoords: [cx0, cy0, cx1, cy1],
            row: rIdx,
            col: cIdx,
            rowspan: (cellVal && cellVal.rowspan) || 1,
            colspan: (cellVal && cellVal.colspan) || 1,
            confidence: (cellVal && cellVal.confidence) || tableData.confidence || 0.98
          });
        });
      });
      if (cells.length > 0) return cells;
    }

    const rawList = tableData.cells || tableData.table_cells || tableData.cell_bboxes || tableData.table_elements || [];
    if (Array.isArray(rawList) && rawList.length > 0) {
      cells = rawList.map((c, idx) => {
        const rect = this._getRect(c.bbox || c.rawCoords || c.abs_coords || c.cell_coords || c.polygon || c.coords || c.box);
        let text = (c.text || c.content || c.ocr_text || c.cell_text || c.val || '').trim();
        if (!text && Array.isArray(c.words) && c.words.length > 0) {
          text = c.words.map(w => w.word || w.text || '').join(' ').trim();
        }
        const rowVal = c.row ?? c.row_index ?? c.row_no ?? c.r;
        const colVal = c.col ?? c.cal ?? c.col_index ?? c.col_no ?? c.column ?? c.c;
        return {
          id: c.id || `cell-${idx + 1}`,
          text,
          rawCoords: rect || [0, 0, 0, 0],
          row: (rowVal !== undefined && rowVal !== null && rowVal !== '') ? Number(rowVal) : undefined,
          col: (colVal !== undefined && colVal !== null && colVal !== '') ? Number(colVal) : undefined,
          rowspan: c.row_span ?? c.rowspan ?? 1,
          colspan: c.col_span ?? c.colspan ?? 1,
          confidence: c.confidence ?? 0.98,
          words: c.words || []
        };
      }).filter(c => c.rawCoords && (c.rawCoords[2] > c.rawCoords[0]));

      // If words are available, associate words with each cell to populate text
      if (cells.length > 0 && Array.isArray(tableData.words) && tableData.words.length > 0) {
        const matchedWords = new Set();
        cells.forEach(c => {
          const [cx0, cy0, cx1, cy1] = c.rawCoords;
          const insideWords = tableData.words.filter(w => {
            const wb = w.bbox || w.coords;
            if (!Array.isArray(wb) || wb.length < 4) return false;
            const wx = (wb[0] + wb[2]) / 2;
            const wy = (wb[1] + wb[3]) / 2;
            return wx >= cx0 - 4 && wx <= cx1 + 4 && wy >= cy0 - 4 && wy <= cy1 + 4;
          });
          if (insideWords.length > 0) {
            insideWords.forEach(w => matchedWords.add(w));
            insideWords.sort((a, b) => {
              const bA = a.bbox || a.coords;
              const bB = b.bbox || b.coords;
              const cyA = (bA[1] + bA[3]) / 2;
              const cyB = (bB[1] + bB[3]) / 2;
              if (Math.abs(cyA - cyB) > 5) return cyA - cyB;
              return bA[0] - bB[0];
            });
            const wordText = insideWords.map(w => w.word || w.text || '').join(' ').trim();
            if (wordText.length > 0) {
              c.text = wordText;
              c.words = insideWords;
            }
          }
        });

        // If there are words in tableData.words not covered by any cell, cluster them into extra cells!
        const uncoveredWords = tableData.words.filter(w => !matchedWords.has(w));
        if (uncoveredWords.length > 0) {
          const extraCells = this._clusterWordsIntoCells(uncoveredWords);
          if (extraCells.length > 0) {
            cells.push(...extraCells);
          }
        }
      }

      // Deduplicate overlapping slice cells (e.g. merged headers split across rows/cols)
      const deduplicatedCells = [];
      cells.forEach(c => {
        const boxC = c.rawCoords || [0, 0, 0, 0];
        const textC = (c.text || '').trim().toLowerCase();
        const existing = deduplicatedCells.find(ex => {
          const boxEx = ex.rawCoords || [0, 0, 0, 0];
          const textEx = (ex.text || '').trim().toLowerCase();
          const interX0 = Math.max(boxC[0], boxEx[0]);
          const interY0 = Math.max(boxC[1], boxEx[1]);
          const interX1 = Math.min(boxC[2], boxEx[2]);
          const interY1 = Math.min(boxC[3], boxEx[3]);
          const interW = Math.max(0, interX1 - interX0);
          const interH = Math.max(0, interY1 - interY0);
          const interArea = interW * interH;
          const minArea = Math.min((boxC[2]-boxC[0])*(boxC[3]-boxC[1]), (boxEx[2]-boxEx[0])*(boxEx[3]-boxEx[1]));
          return (interArea / (minArea || 1) > 0.60) && (textC === textEx || textC.includes(textEx) || textEx.includes(textC));
        });

        if (existing) {
          const boxEx = existing.rawCoords || [0, 0, 0, 0];
          existing.rawCoords = [
            Math.min(boxEx[0], boxC[0]), Math.min(boxEx[1], boxC[1]),
            Math.max(boxEx[2], boxC[2]), Math.max(boxEx[3], boxC[3])
          ];
          if ((c.text || '').length > (existing.text || '').length) {
            existing.text = c.text;
          }
        } else {
          deduplicatedCells.push(c);
        }
      });

      cells = deduplicatedCells.filter(c => (c.text || '').trim().length > 0);
      if (cells.length > 0) return cells;
    }

    if (cells.length === 0) {
      const Splitter = (typeof SentenceSplitter !== 'undefined')
        ? SentenceSplitter
        : (typeof require !== 'undefined' ? (() => { try { return require('./sentence-splitter.js'); } catch (e) { return null; } })() : null);

      if (Splitter && typeof Splitter.extractTableCells === 'function') {
        cells = Splitter.extractTableCells(tableData);
      }
    }

    // Fallback 1: If tableData has words, cluster words into cells
    if (cells.length === 0 && Array.isArray(tableData.words) && tableData.words.length > 0) {
      cells = this._clusterWordsIntoCells(tableData.words);
    }

    // Fallback 2: If tableData has lines / ocr_lines
    if (cells.length === 0 && (Array.isArray(tableData.lines) || Array.isArray(tableData.ocr_lines))) {
      const rawLines = tableData.lines || tableData.ocr_lines;
      cells = rawLines.map((l, rIdx) => {
        const rect = this._getRect(l.bbox || l.coords || l.rawCoords);
        return {
          id: `cell-r${rIdx + 1}`,
          text: (l.text || l.ocr_text || '').trim(),
          rawCoords: rect || [0, 0, 0, 0],
          row: rIdx,
          col: 0,
          rowspan: 1,
          colspan: 1,
          confidence: l.confidence || 0.98
        };
      }).filter(c => c.text.length > 0);
    }

    // Fallback 3: If tableData has multi-line text or tab/pipe delimited table text or HTML
    const rawText = tableData.text || tableData.html || '';
    if (cells.length === 0 && typeof rawText === 'string' && rawText.trim().length > 0) {
      // Check HTML table format
      if (rawText.includes('<table') || rawText.includes('<tr')) {
        const trMatches = rawText.match(/<tr[^>]*>[\s\S]*?<\/tr>/gi) || [];
        if (trMatches.length > 0) {
          const rowH = (tableBox[3] - tableBox[1]) / trMatches.length;
          trMatches.forEach((trHtml, rIdx) => {
            const tdMatches = trHtml.match(/<(?:td|th)[^>]*>([\s\S]*?)<\/(?:td|th)>/gi) || [];
            const colW = (tableBox[2] - tableBox[0]) / Math.max(tdMatches.length, 1);
            tdMatches.forEach((tdHtml, cIdx) => {
              const cellCleanText = tdHtml.replace(/<[^>]+>/g, '').trim();
              const cx0 = Math.round(tableBox[0] + cIdx * colW);
              const cy0 = Math.round(tableBox[1] + rIdx * rowH);
              const cx1 = Math.round(tableBox[0] + (cIdx + 1) * colW);
              const cy1 = Math.round(tableBox[1] + (rIdx + 1) * rowH);
              cells.push({
                id: `cell-r${rIdx}-c${cIdx}`,
                text: cellCleanText,
                rawCoords: [cx0, cy0, cx1, cy1],
                row: rIdx,
                col: cIdx,
                rowspan: 1,
                colspan: 1,
                confidence: tableData.confidence || 0.98
              });
            });
          });
          if (cells.length > 0) return cells;
        }
      }

      // Plaintext / Markdown / TSV parsing
      const rawLines = rawText.split(/\r?\n/)
        .map(l => l.trim())
        .filter(l => l.length > 0 && !/^\|?[-:\s|]+\|?$/.test(l));

      if (rawLines.length > 0) {
        const rowH = (tableBox[3] - tableBox[1]) / Math.max(rawLines.length, 1);
        rawLines.forEach((lineStr, rIdx) => {
          let colTokens = [];
          if (lineStr.includes('|')) {
            colTokens = lineStr.split('|').map(t => t.trim()).filter(t => t.length > 0);
          } else if (lineStr.includes('\t')) {
            colTokens = lineStr.split('\t').map(t => t.trim()).filter(t => t.length > 0);
          } else if (/\s{2,}/.test(lineStr)) {
            colTokens = lineStr.split(/\s{2,}/).map(t => t.trim()).filter(t => t.length > 0);
          } else {
            colTokens = [lineStr];
          }

          const colW = (tableBox[2] - tableBox[0]) / Math.max(colTokens.length, 1);
          colTokens.forEach((token, cIdx) => {
            const cx0 = Math.round(tableBox[0] + cIdx * colW);
            const cy0 = Math.round(tableBox[1] + rIdx * rowH);
            const cx1 = Math.round(tableBox[0] + (cIdx + 1) * colW);
            const cy1 = Math.round(tableBox[1] + (rIdx + 1) * rowH);

            cells.push({
              id: `cell-r${rIdx}-c${cIdx}`,
              text: token,
              rawCoords: [cx0, cy0, cx1, cy1],
              row: rIdx,
              col: cIdx,
              rowspan: 1,
              colspan: 1,
              confidence: tableData.confidence || 0.98
            });
          });
        });
      }
    }

    // Fallback 4: Single cell if everything else fails
    if (cells.length === 0 && tableData.text) {
      cells.push({
        id: 'cell-1',
        text: String(tableData.text).trim(),
        rawCoords: tableBox,
        row: 0,
        col: 0,
        rowspan: 1,
        colspan: 1,
        confidence: tableData.confidence || 0.98
      });
    }

    return cells;
  }

  /**
   * Cluster unstructured OCR words inside a table into distinct (row, col) grid cells
   */
  static _clusterWordsIntoCells(words) {
    if (!words || words.length === 0) return [];
    const validWords = words.filter(w => {
      const b = w.bbox || w.coords;
      return Array.isArray(b) && b.length >= 4;
    });
    if (validWords.length === 0) return [];

    // 1. Group words into horizontal lines (rows)
    const sortedByY = [...validWords].sort((a, b) => {
      const cyA = (a.bbox[1] + a.bbox[3]) / 2;
      const cyB = (b.bbox[1] + b.bbox[3]) / 2;
      return cyA - cyB;
    });

    const lines = [];
    sortedByY.forEach(w => {
      const [wx0, wy0, wx1, wy1] = w.bbox;
      const wcy = (wy0 + wy1) / 2;
      const match = lines.find(l => Math.abs(l.cy - wcy) < 10);
      if (match) {
        match.words.push(w);
        match.x0 = Math.min(match.x0, wx0);
        match.y0 = Math.min(match.y0, wy0);
        match.x1 = Math.max(match.x1, wx1);
        match.y1 = Math.max(match.y1, wy1);
        match.cy = (match.y0 + match.y1) / 2;
      } else {
        lines.push({
          x0: wx0, y0: wy0, x1: wx1, y1: wy1,
          cy: wcy,
          words: [w]
        });
      }
    });

    lines.sort((a, b) => a.y0 - b.y0);

    // 2. Discover global column cut planes from intra-line gaps
    const gapCuts = [];
    lines.forEach(l => {
      l.words.sort((a, b) => a.bbox[0] - b.bbox[0]);
      for (let i = 0; i < l.words.length - 1; i++) {
        const wA = l.words[i];
        const wB = l.words[i + 1];
        const gap = wB.bbox[0] - wA.bbox[2];
        const tA = (wA.word || wA.text || '').trim();
        if (gap >= 22 || ((tA === ':' || tA.endsWith(':')) && gap >= 10)) {
          gapCuts.push((wA.bbox[2] + wB.bbox[0]) / 2);
        }
      }
    });

    gapCuts.sort((a, b) => a - b);
    const colSplits = [];
    gapCuts.forEach(gx => {
      const match = colSplits.find(cl => Math.abs(cl.center - gx) <= 25);
      if (match) {
        match.points.push(gx);
        match.center = match.points.reduce((a, b) => a + b, 0) / match.points.length;
      } else {
        colSplits.push({ center: gx, points: [gx] });
      }
    });
    const globalSplitX = colSplits.map(cl => cl.center).sort((a, b) => a - b);

    // 3. For each line, partition words into cells using gaps and global splits
    const cells = [];
    lines.forEach((l, rIdx) => {
      l.words.sort((a, b) => a.bbox[0] - b.bbox[0]);
      const rowCellWordGroups = [];
      let curGroup = [];

      for (let i = 0; i < l.words.length; i++) {
        const w = l.words[i];
        if (curGroup.length === 0) {
          curGroup.push(w);
          continue;
        }

        const prevW = curGroup[curGroup.length - 1];
        const gap = w.bbox[0] - prevW.bbox[2];
        const prevText = (prevW.word || prevW.text || '').trim();
        const currText = (w.word || w.text || '').trim();

        const crossesGlobalSplit = globalSplitX.some(sx => prevW.bbox[2] <= sx && w.bbox[0] >= sx);
        const isColonBoundary = (prevText === ':' || prevText.endsWith(':')) && gap >= 10;
        const isLargeGap = gap >= 22;

        // Attach standalone ':' to preceding label; do not isolate ':' as its own cell
        const isSplit = (currText !== ':') && (crossesGlobalSplit || isColonBoundary || isLargeGap);

        if (isSplit) {
          rowCellWordGroups.push(curGroup);
          curGroup = [w];
        } else {
          curGroup.push(w);
        }
      }
      if (curGroup.length > 0) {
        rowCellWordGroups.push(curGroup);
      }

      rowCellWordGroups.forEach((wGroup, cIdx) => {
        const cx0 = Math.min(...wGroup.map(w => w.bbox[0]));
        const cy0 = Math.min(...wGroup.map(w => w.bbox[1]));
        const cx1 = Math.max(...wGroup.map(w => w.bbox[2]));
        const cy1 = Math.max(...wGroup.map(w => w.bbox[3]));
        const text = wGroup.map(w => w.word || w.text || '').join(' ').trim();

        if (text) {
          cells.push({
            id: `cell-r${rIdx}-c${cIdx}`,
            text,
            rawCoords: [cx0, cy0, cx1, cy1],
            row: rIdx,
            col: cIdx,
            rowspan: 1,
            colspan: 1,
            confidence: 0.98,
            words: wGroup
          });
        }
      });
    });

    return cells;
  }

  /**
   * Recalculate grid, row, and column boundaries from cell BBoxes with X/Y clustering
   */
  static recalculateGridFromBBoxes(cells, tableBox) {
    if (!cells || cells.length === 0) return { rows: [], cols: [], cells: [] };

    // Helper: safely get [x0, y0, x1, y1] from a cell, regardless of field name
    const getCoords = (c) => {
      const raw = c.rawCoords || c.bbox || c.box || c.coords || c.abs_coords || c.cell_coords || null;
      if (Array.isArray(raw) && raw.length >= 4) {
        const [a, b, cc, d] = raw.map(Number);
        return [Math.min(a, cc), Math.min(b, d), Math.max(a, cc), Math.max(b, d)];
      }
      if (c.x0 !== undefined && c.y0 !== undefined && c.x1 !== undefined && c.y1 !== undefined) {
        return [Number(c.x0), Number(c.y0), Number(c.x1), Number(c.y1)];
      }
      return null;
    };

    const validCells = cells.filter(c => getCoords(c) !== null);
    if (validCells.length === 0) return { rows: [], cols: [], cells: [] };

    // 1. Cluster into Rows by vertical overlap and baseline alignment
    const sortedByY = [...validCells].sort((a, b) => {
      const boxA = getCoords(a);
      const boxB = getCoords(b);
      const midYA = (boxA[1] + boxA[3]) / 2;
      const midYB = (boxB[1] + boxB[3]) / 2;
      return midYA - midYB;
    });

    const rowGroups = [];
    sortedByY.forEach(c => {
      const box = getCoords(c);
      const midY = (box[1] + box[3]) / 2;
      const h = box[3] - box[1];

      const match = rowGroups.find(rg => {
        const vOverlap = Math.max(0, Math.min(rg.maxY1, box[3]) - Math.max(rg.minY0, box[1]));
        const minH = Math.min(rg.maxY1 - rg.minY0, h);
        const centerDiff = Math.abs(rg.midY - midY);
        return (minH > 0 && vOverlap / minH > 0.4) || centerDiff < Math.max(10, h * 0.5);
      });

      if (match) {
        match.cells.push(c);
        match.minY0 = Math.min(match.minY0, box[1]);
        match.maxY1 = Math.max(match.maxY1, box[3]);
        match.midY = (match.minY0 + match.maxY1) / 2;
      } else {
        rowGroups.push({
          minY0: box[1],
          maxY1: box[3],
          midY: midY,
          cells: [c]
        });
      }
    });

    rowGroups.sort((a, b) => a.minY0 - b.minY0);

    // 2. In each row, sort cells strictly left to right
    const structuredCells = [];
    rowGroups.forEach((rg, rIdx) => {
      rg.cells.sort((a, b) => {
        const boxA = getCoords(a);
        const boxB = getCoords(b);
        return boxA[0] - boxB[0];
      });

      rg.cells.forEach((c, cIdx) => {
        const coords = getCoords(c);
        structuredCells.push({
          ...c,
          id: c.id || `cell-${structuredCells.length + 1}`,
          rawCoords: coords,
          row: rIdx,
          col: cIdx,
          rowspan: c.rowspan || 1,
          colspan: c.colspan || 1
        });
      });
    });

    const rowIntervals = rowGroups.map((rg, idx) => ({ row_idx: idx, y0: rg.minY0, y1: rg.maxY1 }));

    return {
      rows: rowIntervals,
      cols: [],
      cells: structuredCells
    };
  }


  /**
   * Calculate structural decision metrics for the table
   */
  static calculateTableMetrics(grid, cells, tableBox) {
    const totalCells = cells.length;
    if (totalCells === 0) return {};

    let totalChars = 0;
    let numericChars = 0;
    let mathEquationChars = 0;
    let longCellCount = 0;
    let mergedCellCount = 0;
    let colonCellCount = 0;
    let equalsCount = 0;

    const mathOperators = new Set(['=', '*', '+', '÷', '×']);

    cells.forEach(c => {
      const txt = (c.text || '').trim();
      const len = txt.length;
      totalChars += len;

      if (len > 35) longCellCount++;
      if (c.rowspan > 1 || c.colspan > 1) mergedCellCount++;
      if (txt === ':' || txt.endsWith(':') || txt.includes(':')) colonCellCount++;
      if (txt === '=' || txt.includes('=')) equalsCount++;

      for (let i = 0; i < len; i++) {
        const ch = txt[i];
        if (/\d/.test(ch)) numericChars++;
        if (mathOperators.has(ch)) {
          mathEquationChars++;
        }
      }
    });

    const uniqueCols = new Set(cells.map(c => c.col)).size;
    const uniqueRows = new Set(cells.map(c => c.row)).size;

    // Check 2 or 3-column key-value / form ratio
    let isKeyValueForm = false;
    if (uniqueCols === 2 || uniqueCols === 3) {
      if (colonCellCount >= Math.min(uniqueRows * 0.5, 2)) {
        isKeyValueForm = true;
      } else if (uniqueCols === 2) {
        const col0Cells = cells.filter(c => c.col === 0);
        const col1Cells = cells.filter(c => c.col === 1);
        const avgLen0 = col0Cells.reduce((sum, c) => sum + (c.text || '').length, 0) / Math.max(col0Cells.length, 1);
        const avgLen1 = col1Cells.reduce((sum, c) => sum + (c.text || '').length, 0) / Math.max(col1Cells.length, 1);
        if (avgLen0 > 0 && avgLen0 <= avgLen1 * 0.8 && avgLen0 < 40) {
          isKeyValueForm = true;
        }
      }
    }

    // Check footnote / note rows at the bottom
    const maxRow = Math.max(...cells.map(c => c.row), 0);
    const bottomCells = cells.filter(c => c.row === maxRow);
    const hasBottomNote = bottomCells.some(c => {
      const t = (c.text || '').toLowerCase();
      const coords = Array.isArray(c.rawCoords) && c.rawCoords.length >= 4 ? c.rawCoords : null;
      const cellWidth = coords ? (coords[2] - coords[0]) : 0;
      const tableWidth = (tableBox && Array.isArray(tableBox) && tableBox.length >= 4) ? (tableBox[2] - tableBox[0]) : 300;
      const isWide = cellWidth > tableWidth * 0.65 || c.colspan >= 2;
      return (t.includes('not:') || t.includes('dipnot') || t.includes('açıklama') || t.startsWith('*') || (t.includes('tutar') && t.includes('geçerli'))) && (isWide || t.length > 25);
    });

    // Check formula equations (cells with explicit '=' or math calculation)
    const hasEquationSyntax = equalsCount >= 1 || cells.some(c => {
      const t = (c.text || '').trim();
      return (t.includes('Net Kar') && t.includes('Brüt Kar')) || (t.includes('Matrah') && t.includes('KDV'));
    });

    // Check multi-level / irregular headers (e.g. top banner or wide level-1 header above sub-headers)
    const tblW = (tableBox && Array.isArray(tableBox) && tableBox.length >= 4) ? (tableBox[2] - tableBox[0]) : 300;
    const hasTopBanner = cells.some(c => {
      const coords = Array.isArray(c.rawCoords) && c.rawCoords.length >= 4 ? c.rawCoords : null;
      const cellW = coords ? (coords[2] - coords[0]) : 0;
      return (c.row === 0) && (cellW > tblW * 0.55 || (c.colspan && c.colspan >= 2));
    });

    const hasMultiLevelHeaders = hasTopBanner || cells.some(c => {
      const coords = Array.isArray(c.rawCoords) && c.rawCoords.length >= 4 ? c.rawCoords : null;
      const cellW = coords ? (coords[2] - coords[0]) : 0;
      return (c.row <= 1) && (cellW > tblW * 0.40 || (c.colspan && c.colspan >= 2) || (c.rowspan && c.rowspan >= 2));
    });

    return {
      numeric_ratio: totalChars > 0 ? numericChars / totalChars : 0,
      math_density: totalChars > 0 ? mathEquationChars / totalChars : 0,
      long_cell_ratio: totalCells > 0 ? longCellCount / totalCells : 0,
      merged_cell_ratio: totalCells > 0 ? mergedCellCount / totalCells : 0,
      n_cols: Math.max(uniqueCols, grid.cols.length, 1),
      n_rows: Math.max(uniqueRows, grid.rows.length, 1),
      is_key_value_form: isKeyValueForm,
      has_bottom_note: hasBottomNote,
      has_equation_syntax: hasEquationSyntax,
      has_multi_level_headers: hasMultiLevelHeaders
    };
  }

  /**
   * Classify table into one of 6 types based on exact structural decision rules
   */
  static classifyTable(grid, cells, metrics) {
    // 1. C_PARALLEL_TEXT (False Table / Multi-column flowing paragraph blocks):
    if (metrics.n_cols <= 1 && metrics.long_cell_ratio >= 0.40) {
      return this.TYPES.C_PARALLEL_TEXT;
    }
    if (metrics.long_cell_ratio >= 0.40 && metrics.numeric_ratio < 0.20 && !metrics.has_equation_syntax) {
      return this.TYPES.C_PARALLEL_TEXT;
    }

    // 2. E_FORMULA (Mathematical Formulas & Calculations):
    if (metrics.has_equation_syntax || metrics.math_density >= 0.04) {
      return this.TYPES.E_FORMULA;
    }

    // 3. F_HYBRID_NOTE (Data Table with Bottom Footnote / Explanation Block):
    if (metrics.has_bottom_note && metrics.n_rows >= 2) {
      return this.TYPES.F_HYBRID_NOTE;
    }

    // 4. B_KEY_VALUE (Form / Key-Value Pair Table):
    if (metrics.is_key_value_form && (metrics.n_cols === 2 || metrics.n_cols === 3)) {
      return this.TYPES.B_KEY_VALUE;
    }

    // 5. D_MERGED_CELLS (Hierarchical / Colspan & Rowspan Merged Table):
    if (metrics.merged_cell_ratio >= 0.12 || metrics.has_multi_level_headers) {
      return this.TYPES.D_MERGED_CELLS;
    }

    // 6. A_MATRIX (Standard Matrix Data Table - Default >= 3x3):
    return this.TYPES.A_MATRIX;
  }

  /**
   * Structure headers, multi-line title mergers, and footer notes
   */
  static structureTableHeadersAndNotes(grid, cells, tableType, tableBox, metrics) {
    const rawList = Array.isArray(cells) ? cells : [];
    const sortedCells = [...rawList].sort((a, b) => {
      if (a.row !== b.row) return (a.row || 0) - (b.row || 0);
      return (a.col || 0) - (b.col || 0);
    });

    const tblW = (tableBox && Array.isArray(tableBox) && tableBox.length >= 4) ? (tableBox[2] - tableBox[0]) : 400;

    // Top Header Banner (Row 0 cell spanning across all columns or width >= 55% of tableBox)
    const topBannerCell = sortedCells.find(c => {
      const box = c.rawCoords || c.bbox || [0, 0, 0, 0];
      const w = box[2] - box[0];
      return (c.row === 0 || c.row === undefined) && (c.colspan >= (metrics.n_cols || 4) - 1 || c.colspan > 2 || w >= tblW * 0.55);
    });
    const topBannerText = topBannerCell ? topBannerCell.text.trim() : '';

    // Determine first data row:
    let firstDataRow = topBannerCell ? 2 : 1;
    const uniqueRows = [...new Set(sortedCells.map(c => c.row || 0))].sort((a, b) => a - b);
    for (const r of uniqueRows) {
      if (topBannerCell && r === topBannerCell.row) continue;
      const rowCells = sortedCells.filter(c => c.row === r && c !== topBannerCell);
      const hasNumbers = rowCells.some(c => /\d{2,}/.test(c.text || ''));
      if (hasNumbers && r > (topBannerCell ? 1 : 0)) {
        firstDataRow = r;
        break;
      }
    }

    // Header Cells (all cells before firstDataRow, excluding top banner)
    const headerCells = sortedCells.filter(c => c.row < firstDataRow && c !== topBannerCell);

    // Column Headers Map: col_idx -> Header Text
    const colHeaders = new Map();
    for (let cIdx = 0; cIdx < (metrics.n_cols + 5); cIdx++) {
      const hCells = headerCells.filter(c => c.col === cIdx);
      if (hCells.length > 0) {
        const mergedHeaderText = hCells.map(c => c.text).join(' - ').trim();
        colHeaders.set(cIdx, mergedHeaderText);
      }
    }

    // Row Headers Map: row_idx -> Row Header Text (Col 0 cell for that row)
    const rowHeaders = new Map();
    sortedCells.filter(c => c.col === 0 && c.row >= firstDataRow).forEach(c => {
      rowHeaders.set(c.row, (c.text || '').trim());
    });

    return {
      cells: sortedCells,
      headerCells,
      colHeaders,
      rowHeaders,
      firstDataRow,
      topBannerText,
      topBannerCell,
      tableBox,
      metrics
    };
  }

  /**
   * Generate accessible reading-ordered BBox items with:
   * 1. Global Document Reading Order (`sentence_id` / `id_display`)
   * 2. Dedicated Table Reading Order (`table_order_id`, `table_order_label`)
   * 3. Accessible Semantic Vocalization (`fullSentenceText`)
   */
  static generateAccessibleTableReadingOrder(structuredData, tableType, pageNum = 1, startSentenceNumber = 1, tableId = 'table-1', tableIndex = 1) {
    const data = structuredData || {};
    const rawCells = Array.isArray(data.cells) ? data.cells : [];
    const colHeaders = data.colHeaders || new Map();
    const rowHeaders = data.rowHeaders || new Map();
    const firstDataRow = data.firstDataRow || 1;
    const topBannerText = data.topBannerText || '';
    const topBannerCell = data.topBannerCell;
    const metrics = data.metrics || { n_rows: 1, n_cols: 1 };
    const items = [];
    let currentSentenceNum = startSentenceNumber;
    let tableOrderCounter = 1;

    // =========================================================================
    // Ön-adım: Aynı (row, col) çiftine sahip OCR satırlarını birleştir
    // (recalculateGridFromBBoxes aynı hücreye birden fazla item atamışsa)
    // NOT: Sadece kesin (row,col) eşleşmesi — C_PARALLEL_TEXT kendi sütun mantığını
    //      C stratejisi içinde yönetir; diğer tipler normal (row,col) sırasını korur.
    // =========================================================================
    const getBox = c => c.rawCoords || c.bbox || [0, 0, 0, 0];

    const cellGroupMap = new Map();
    rawCells.forEach(c => {
      const row = c.row !== undefined ? c.row : 0;
      const col = c.col !== undefined ? c.col : 0;
      const key = `r${row}_c${col}`;
      if (!cellGroupMap.has(key)) cellGroupMap.set(key, []);
      cellGroupMap.get(key).push(c);
    });

    const cells = [];
    for (const [, group] of cellGroupMap) {
      if (group.length === 1) {
        cells.push(group[0]);
        continue;
      }
      group.sort((a, b) => getBox(a)[1] - getBox(b)[1]);
      const mergedText = group.map(c => (c.text || '').trim()).filter(Boolean).join(' ');
      const allBoxes = group.map(c => getBox(c));
      const mergedBox = [
        Math.min(...allBoxes.map(b => b[0])), Math.min(...allBoxes.map(b => b[1])),
        Math.max(...allBoxes.map(b => b[2])), Math.max(...allBoxes.map(b => b[3]))
      ];
      cells.push({ ...group[0], text: mergedText, rawCoords: mergedBox, bbox: mergedBox, rawBox: mergedBox, _sourceLines: group });
    }

    // Normal grid sırası: satır önce, sonra sütun (tüm tipler için)
    cells.sort((a, b) => {
      const rA = a.row !== undefined ? a.row : 0;
      const rB = b.row !== undefined ? b.row : 0;
      if (rA !== rB) return rA - rB;
      const cA = a.col !== undefined ? a.col : 0;
      const cB = b.col !== undefined ? b.col : 0;
      return cA - cB;
    });
    // =========================================================================


    const baseTableMeta = {
      table_id: tableId,
      table_index: tableIndex,
      table_type: tableType,
      table_type_name: this.TYPE_NAMES[tableType] || tableType,
      page: pageNum,
      row_count: metrics.n_rows || 1,
      col_count: metrics.n_cols || 1,
      top_banner: topBannerText
    };

    // =========================================================================
    // Strategy 1: C_PARALLEL_TEXT
    // Sütun bazlı paralel paragraf / akış mantığı:
    //   1. Tablodaki tüm satır ve kutuları X koordinatlarına göre sütunlara ayır.
    //   2. Her sütun içinde yukarıdan aşağıya (Y0) sırala.
    //   3. Alt alta gelen satırları aynı hücre/paragraf olarak gör ve tek metin olarak birleştir.
    //   4. Birleştirilmiş paragrafı Türkçe NLP kurallarıyla cümlelere ayır.
    //   5. Cümleleri ve kapsadığı satır kutularını yukarıdan aşağıya sırayla numaralandır.
    //   6. Bir sütunun tüm paragrafları bitmeden diğer sütuna geçme.
    // =========================================================================
    if (tableType === this.TYPES.C_PARALLEL_TEXT) {
      const Splitter = (typeof SentenceSplitter !== 'undefined')
        ? SentenceSplitter
        : (typeof require !== 'undefined' ? (() => { try { return require('./sentence-splitter.js'); } catch (e) { return null; } })() : null);

      const sourceBoxes = (data.rawCells && data.rawCells.length > 0)
        ? data.rawCells.filter(c => (c.text || '').trim().length > 0)
        : (rawCells || []).filter(c => (c.text || '').trim().length > 0);

      if (sourceBoxes.length === 0) {
        return { items, nextSentenceNumber: currentSentenceNum, tableMeta: baseTableMeta };
      }

      // 1. Check if cells have explicit col/cal property
      const hasExplicitCol = sourceBoxes.some(c => (c.col !== undefined && c.col !== null) || (c.cal !== undefined && c.cal !== null));

      let boxesByCol = [];

      if (hasExplicitCol) {
        // Explicit col / cal provided in JSON cells
        const uniqueCols = [...new Set(sourceBoxes.map(c => {
          const colVal = c.col ?? c.cal ?? c.col_index ?? c.column ?? c.col_no ?? c.c;
          return (colVal !== undefined && colVal !== null) ? Number(colVal) : 0;
        }))].sort((a, b) => a - b);

        boxesByCol = uniqueCols.map(colIdx => {
          return sourceBoxes.filter(c => {
            const colVal = c.col ?? c.cal ?? c.col_index ?? c.column ?? c.col_no ?? c.c;
            return ((colVal !== undefined && colVal !== null) ? Number(colVal) : 0) === colIdx;
          });
        });
      } else {
        // Geometric column separation based on X coordinates
        const allX0 = sourceBoxes.map(b => getBox(b)[0]);
        const allX1 = sourceBoxes.map(b => getBox(b)[2]);
        const minTableX = Math.min(...allX0);
        const maxTableX = Math.max(...allX1);
        const tableSpan = Math.max(maxTableX - minTableX, 1);

        // Group into Connected Horizontal Components
        const n = sourceBoxes.length;
        const parent = Array.from({ length: n }, (_, i) => i);
        const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
        const union = (i, j) => {
          const rI = find(i);
          const rJ = find(j);
          if (rI !== rJ) parent[rI] = rJ;
        };

        for (let i = 0; i < n; i++) {
          const bI = getBox(sourceBoxes[i]);
          for (let j = i + 1; j < n; j++) {
            const bJ = getBox(sourceBoxes[j]);
            const overlap = Math.min(bI[2], bJ[2]) - Math.max(bI[0], bJ[0]);
            if (overlap >= 8) {
              union(i, j);
            }
          }
        }

        const clustersMap = new Map();
        for (let i = 0; i < n; i++) {
          const root = find(i);
          if (!clustersMap.has(root)) clustersMap.set(root, []);
          clustersMap.get(root).push(sourceBoxes[i]);
        }

        const rawCols = Array.from(clustersMap.values()).map(boxes => {
          const minX = Math.min(...boxes.map(b => getBox(b)[0]));
          const maxX = Math.max(...boxes.map(b => getBox(b)[2]));
          return { boxes, minX, maxX };
        });

        rawCols.sort((a, b) => a.minX - b.minX);

        // Merge clusters that overlap or are very close (< 15px)
        const mergedCols = [];
        rawCols.forEach(col => {
          if (mergedCols.length === 0) {
            mergedCols.push(col);
            return;
          }
          const last = mergedCols[mergedCols.length - 1];
          if (col.minX - last.maxX < 15) {
            last.maxX = Math.max(last.maxX, col.maxX);
            last.boxes.push(...col.boxes);
          } else {
            mergedCols.push(col);
          }
        });

        boxesByCol = mergedCols.map(c => c.boxes);
      }

      // 2. Process each column strictly from left to right (Col 0 first, then Col 1...)
      // And in each column, group lines into paragraph cells and apply NLP sentence splitting
      boxesByCol.forEach((colBoxes, colIdx) => {
        if (!colBoxes || colBoxes.length === 0) return;

        // Group lines inside this column into cells/paragraphs:
        const hasExplicitRow = colBoxes.some(c => c.row !== undefined && c.row !== null);
        let paraGroups = [];

        if (hasExplicitRow) {
          const rowMap = new Map();
          colBoxes.forEach(c => {
            const r = (c.row !== undefined && c.row !== null) ? Number(c.row) : 0;
            if (!rowMap.has(r)) rowMap.set(r, []);
            rowMap.get(r).push(c);
          });
          const sortedRowKeys = Array.from(rowMap.keys()).sort((a, b) => a - b);
          paraGroups = sortedRowKeys.map(r => rowMap.get(r));
        } else {
          // Spatial vertical grouping: lines with small vertical gaps belong to the same paragraph
          colBoxes.sort((a, b) => getBox(a)[1] - getBox(b)[1]);
          let curGroup = [];
          for (let i = 0; i < colBoxes.length; i++) {
            const box = colBoxes[i];
            if (curGroup.length === 0) {
              curGroup.push(box);
              continue;
            }
            const prevBox = curGroup[curGroup.length - 1];
            const gapY = getBox(box)[1] - getBox(prevBox)[3];
            if (gapY > 25) {
              paraGroups.push(curGroup);
              curGroup = [box];
            } else {
              curGroup.push(box);
            }
          }
          if (curGroup.length > 0) paraGroups.push(curGroup);
        }

        paraGroups.forEach((paraBoxes, pIdx) => {
          paraBoxes.sort((a, b) => {
            const yA = getBox(a)[1];
            const yB = getBox(b)[1];
            if (Math.abs(yA - yB) > 4) return yA - yB;
            return getBox(a)[0] - getBox(b)[0];
          });

          const mergedText = paraBoxes.map(c => (c.text || '').trim()).filter(Boolean).join(' ');
          if (!mergedText) return;

          const allB = paraBoxes.map(c => getBox(c));
          const mergedB = [
            Math.min(...allB.map(b => b[0])), Math.min(...allB.map(b => b[1])),
            Math.max(...allB.map(b => b[2])), Math.max(...allB.map(b => b[3]))
          ];

          const tOrder = tableOrderCounter++;
          const cellObj = {
            ...paraBoxes[0],
            text: mergedText,
            rawCoords: mergedB,
            bbox: mergedB,
            rawBox: mergedB,
            _sourceLines: paraBoxes,
            row: paraBoxes[0].row !== undefined ? paraBoxes[0].row : pIdx,
            col: colIdx
          };

          const cellItems = this._expandCellIntoSentences(cellObj, pageNum, currentSentenceNum, tOrder, tableId, tableType, tableIndex, mergedText);
          cellItems.forEach(it => {
            it.col = colIdx;
            items.push(it);
          });
          if (cellItems.length > 0) {
            currentSentenceNum = Math.max(...cellItems.map(it => it.sentence_id)) + 1;
          }
        });
      });

      return { items, nextSentenceNumber: currentSentenceNum, tableMeta: baseTableMeta };
    }

    // =========================================================================
    // Strategy 2: B_KEY_VALUE (Row-by-row label:value order)
    // =========================================================================
    if (tableType === this.TYPES.B_KEY_VALUE) {
      const rowsMap = new Map();

      cells.forEach(c => {
        if (!rowsMap.has(c.row)) rowsMap.set(c.row, []);
        rowsMap.get(c.row).push(c);
      });

      const sortedRows = Array.from(rowsMap.keys()).sort((a, b) => a - b);
      for (const rowIdx of sortedRows) {
        const rowCells = rowsMap.get(rowIdx).sort((a, b) => a.col - b.col);

        for (const c of rowCells) {
          const tOrder = tableOrderCounter++;
          const cellText = (c.text || '').trim();
          const cellItems = this._expandCellIntoSentences(c, pageNum, currentSentenceNum, tOrder, tableId, tableType, tableIndex, cellText);
          cellItems.forEach(it => items.push(it));
          if (cellItems.length > 0) {
            currentSentenceNum = Math.max(...cellItems.map(it => it.sentence_id)) + 1;
          }
        }
      }
      return { items, nextSentenceNumber: currentSentenceNum, tableMeta: baseTableMeta };
    }

    // =========================================================================
    // Strategy 3: E_FORMULA (Row-by-row formula equation flow)
    // =========================================================================
    if (tableType === this.TYPES.E_FORMULA) {
      const rowsMap = new Map();
      cells.forEach(c => {
        if (!rowsMap.has(c.row)) rowsMap.set(c.row, []);
        rowsMap.get(c.row).push(c);
      });

      const sortedRows = Array.from(rowsMap.keys()).sort((a, b) => a - b);
      for (const rowIdx of sortedRows) {
        const rowCells = rowsMap.get(rowIdx).sort((a, b) => a.col - b.col);

        for (const c of rowCells) {
          const tOrder = tableOrderCounter++;
          const cellText = (c.text || '').trim();
          const cellItems = this._expandCellIntoSentences(c, pageNum, currentSentenceNum, tOrder, tableId, tableType, tableIndex, cellText);
          cellItems.forEach(it => items.push(it));
          if (cellItems.length > 0) {
            currentSentenceNum = Math.max(...cellItems.map(it => it.sentence_id)) + 1;
          }
        }
      }
      return { items, nextSentenceNumber: currentSentenceNum, tableMeta: baseTableMeta };
    }

    // =========================================================================
    // Strategy 4: F_HYBRID_NOTE (Main data cells first in Z-order, Footnote last)
    // =========================================================================
    if (tableType === this.TYPES.F_HYBRID_NOTE) {
      const footnoteCells = [];
      const dataCells = [];

      for (const c of cells) {
        const lower = (c.text || '').toLowerCase().trim();
        const isFootnote = lower.startsWith('not:') ||
          lower.startsWith('dipnot') ||
          lower.startsWith('*') ||
          lower.startsWith('kaynak:') ||
          (c.colspan >= 2 && c.row >= metrics.n_rows - 1);
        if (isFootnote) {
          footnoteCells.push(c);
        } else {
          dataCells.push(c);
        }
      }

      // Sort data cells by row, then col
      dataCells.sort((a, b) => {
        if (a.row !== b.row) return (a.row || 0) - (b.row || 0);
        return (a.col || 0) - (b.col || 0);
      });

      // Emit main data cells first
      for (const c of dataCells) {
        const tOrder = tableOrderCounter++;
        let fullText = c.text;
        if (c.row < firstDataRow) {
          fullText = colHeaders.get(c.col) || c.text;
        } else if (c.col === 0) {
          fullText = rowHeaders.get(c.row) || c.text;
        } else {
          const rowInfo = (rowHeaders.get(c.row) || '').trim();
          const colInfo = (colHeaders.get(c.col) || '').trim();
          const cellVal = (c.text || '').trim();

          const parts = [];
          if (rowInfo && rowInfo !== cellVal) parts.push(rowInfo);
          if (colInfo && colInfo !== cellVal && colInfo !== rowInfo) parts.push(colInfo);
          if (cellVal) parts.push(cellVal);

          fullText = parts.length > 0 ? parts.join(', ').trim() : cellVal;
        }

        const cellItems = this._expandCellIntoSentences(c, pageNum, currentSentenceNum, tOrder, tableId, tableType, tableIndex, fullText);
        cellItems.forEach(it => items.push(it));
        if (cellItems.length > 0) {
          currentSentenceNum = Math.max(...cellItems.map(it => it.sentence_id)) + 1;
        }
      }

      // Emit footnote cells at the very end
      for (const fn of footnoteCells) {
        const tOrder = tableOrderCounter++;
        const fnText = (fn.text || '').trim();
        const fullText = fnText.toLowerCase().startsWith('not') || fnText.startsWith('*') || fnText.toLowerCase().startsWith('dipnot')
          ? fnText
          : `Dipnot: ${fnText}`;
        const cellItems = this._expandCellIntoSentences(fn, pageNum, currentSentenceNum, tOrder, tableId, tableType, tableIndex, fullText);
        cellItems.forEach(it => {
          it.category = 'Table Footnote';
          items.push(it);
        });
        if (cellItems.length > 0) {
          currentSentenceNum = Math.max(...cellItems.map(it => it.sentence_id)) + 1;
        }
      }

      return { items, nextSentenceNumber: currentSentenceNum, tableMeta: baseTableMeta };
    }

    // =========================================================================
    // Strategy 5: D_MERGED_CELLS (Hierarchical Multi-Level Headers & Merged Grid)
    // =========================================================================
    if (tableType === this.TYPES.D_MERGED_CELLS) {
      const headerCells = data.headerCells || cells.filter(c => c.row < firstDataRow);

      const sortedMergedCells = [...cells].sort((a, b) => {
        if (a.row !== b.row) return (a.row || 0) - (b.row || 0);
        return (a.col || 0) - (b.col || 0);
      });

      for (const c of sortedMergedCells) {
        const tOrder = tableOrderCounter++;
        let fullText = c.text;

        if (c === topBannerCell || (c.row === 0 && topBannerText && c.text === topBannerText)) {
          // Top Banner Header
          fullText = c.text;
        } else if (c.row < firstDataRow) {
          // Header rows (Level 1, Level 2)
          fullText = c.text;
        } else if (c.col === 0) {
          // Row header in first column (e.g. Marmara, İç Anadolu)
          fullText = c.text;
        } else {
          // Data cell (e.g. 500.000, 650.000, Başarılı)
          const rowInfo = (rowHeaders.get(c.row) || '').trim();
          const [cx0, cy0, cx1, cy1] = getBox(c);

          // Find overlapping column headers in header rows by X coordinate overlap
          const colAncestors = headerCells.filter(h => {
            if (h === topBannerCell) return false;
            const [hx0, hy0, hx1, hy1] = getBox(h);
            const xOverlap = Math.min(cx1, hx1) - Math.max(cx0, hx0);
            return xOverlap > 5;
          }).sort((a, b) => (a.row || 0) - (b.row || 0));

          const headerTexts = colAncestors.map(h => (h.text || '').trim()).filter(Boolean);

          const parts = [];
          if (rowInfo && rowInfo !== c.text) parts.push(rowInfo);
          headerTexts.forEach(ht => {
            if (ht && !parts.includes(ht) && ht !== c.text) {
              parts.push(ht);
            }
          });
          if (c.text) parts.push(c.text);

          fullText = parts.length > 0 ? parts.join(', ').trim() : c.text;
        }

        const cellItems = this._expandCellIntoSentences(c, pageNum, currentSentenceNum, tOrder, tableId, tableType, tableIndex, fullText);
        cellItems.forEach(it => items.push(it));
        if (cellItems.length > 0) {
          currentSentenceNum = Math.max(...cellItems.map(it => it.sentence_id)) + 1;
        }
      }

      return { items, nextSentenceNumber: currentSentenceNum, tableMeta: baseTableMeta };
    }

    // =========================================================================
    // Strategy 6: A_MATRIX (Standard Matrix Data Table: Z-order: row by row, col by col)
    // =========================================================================
    const sortedMatrixCells = [...cells].sort((a, b) => {
      if (a.row !== b.row) return (a.row || 0) - (b.row || 0);
      return (a.col || 0) - (b.col || 0);
    });

    for (const c of sortedMatrixCells) {
      const tOrder = tableOrderCounter++;

      let fullText = c.text;
      if (tableType === this.TYPES.A_MATRIX) {
        if (c.row < firstDataRow) {
          // Column header cell in top row
          fullText = colHeaders.get(c.col) || c.text;
        } else if (c.col === 0) {
          // Row header cell in first column
          fullText = rowHeaders.get(c.row) || c.text;
        } else {
          // Data cell: [Satır Değeri], [Sütun Değeri], [Hücre Değeri]
          const rowInfo = (rowHeaders.get(c.row) || '').trim();
          const colInfo = (colHeaders.get(c.col) || '').trim();
          const cellVal = (c.text || '').trim();

          const parts = [];
          if (rowInfo && rowInfo !== cellVal) parts.push(rowInfo);
          if (colInfo && colInfo !== cellVal && colInfo !== rowInfo) parts.push(colInfo);
          if (cellVal) parts.push(cellVal);

          fullText = parts.length > 0 ? parts.join(', ').trim() : cellVal;
        }
      }

      const cellItems = this._expandCellIntoSentences(c, pageNum, currentSentenceNum, tOrder, tableId, tableType, tableIndex, fullText);
      cellItems.forEach(it => items.push(it));
      if (cellItems.length > 0) {
        currentSentenceNum = Math.max(...cellItems.map(it => it.sentence_id)) + 1;
      }
    }

    return { items, nextSentenceNumber: currentSentenceNum, tableMeta: baseTableMeta };
  }

  /**
   * Helper to take a multi-line cell and split its united text into true NLP sentences
   */
  static _expandCellIntoSentences(cell, pageNum, startSentenceId, tOrderId, tableId, tableType, tableIndex, fullTextOverride = null) {
    const cellText = (cell.text || '').trim();
    const cellBox = cell.rawCoords || cell.bbox || cell.box || [0, 0, 0, 0];
    let fullText = fullTextOverride || cell.fullSentenceText || cellText;
    if (tableType === this.TYPES.B_KEY_VALUE && typeof fullText === 'string') {
      fullText = fullText.replace(/^Satır\s+[^,]+,\s*Sütun\s+[^,]+,\s*Değer\s+/i, '');
      fullText = fullText.replace(/^Satır\s+[^,]+,\s*Sütun\s+[^,:]+[:\-]?\s*/i, '');
      fullText = fullText.replace(/^Satır\s+[^,:]+[:\-]?\s*/i, '');
      fullText = fullText.replace(/^Sütun\s+[^,:]+[:\-]?\s*/i, '');
      fullText = fullText.replace(/\[Satır\s+[^\]]+\]\s*/gi, '');
      fullText = fullText.replace(/\[Sütun\s+[^\]]+\]\s*/gi, '');
    }

    const Splitter = (typeof SentenceSplitter !== 'undefined')
      ? SentenceSplitter
      : (typeof require !== 'undefined' ? (() => { try { return require('./sentence-splitter.js'); } catch (e) { return null; } })() : null);

    // _sourceLines: aynı (row,col) içindeki birleştirilmiş OCR satırları
    // Bunları NLP bbox eşlemesi için kullan
    const sourceLines = Array.isArray(cell._sourceLines) && cell._sourceLines.length > 1
      ? cell._sourceLines
      : null;

    // CASE 1: _sourceLines mevcut → doğrudan satırları lineIndices olarak kullan
    if (sourceLines && Splitter && typeof Splitter.splitParagraphIntoSentences === 'function') {
      const lineDefs = sourceLines
        .map(l => {
          const box = l.rawCoords || l.bbox || [0, 0, 0, 0];
          return { text: (l.text || '').trim(), bbox: box };
        })
        .filter(l => l.text.length > 0);

      if (lineDefs.length > 0) {
        const unitedText = lineDefs.map(l => l.text).join(' ');
        const sentences = Splitter.splitParagraphIntoSentences(unitedText);

        if (sentences && sentences.length > 0) {
          const lineIndices = [];
          let searchIdx = 0;
          for (const l of lineDefs) {
            let idx = unitedText.indexOf(l.text, searchIdx);
            if (idx === -1) idx = unitedText.indexOf(l.text);
            if (idx === -1) continue;
            const end = idx + l.text.length;
            lineIndices.push({ text: l.text, start: idx, end, bbox: l.bbox });
            searchIdx = end;
          }

          Splitter.mapSentencesToLines(sentences, lineIndices);
          sentences.forEach(s => Splitter.calculateSentenceBBoxes(s));
          Splitter.fixTinyLeadingBBoxes(sentences);
          const cleaned = Splitter.cleanSentences(sentences);

          const resultItems = [];
          let currSid = startSentenceId;
          cleaned.forEach(s => {
            const sNum = currSid++;
            const sBoxes = s.bboxes || [];
            const sTexts = s.bbox_texts || [];
            if (sBoxes.length === 0) {
              resultItems.push({
                id: `bbox-p${pageNum}-t${tableIndex}-c${tOrderId}-${sNum}-${Math.random().toString(36).substr(2, 6)}`,
                page: pageNum, sentence_id: sNum, id_display: sNum,
                table_id: tableId, table_type: tableType,
                table_order_id: tOrderId, table_order_label: `T${tableIndex}.${tOrderId}`,
                text: s.text.trim(), fullSentenceText: s.text.trim(),
                rawCoords: cellBox, bbox: cellBox, rawBox: cellBox,
                coordType: 'abs_points', category: 'Table Cell',
                confidence: cell.confidence || 0.98, row: cell.row, col: cell.col
              });
            } else {
              sBoxes.forEach((bb, bIdx) => {
                resultItems.push({
                  id: `bbox-p${pageNum}-t${tableIndex}-c${tOrderId}-${sNum}-${bIdx + 1}-${Math.random().toString(36).substr(2, 6)}`,
                  page: pageNum, sentence_id: sNum, id_display: sNum,
                  table_id: tableId, table_type: tableType,
                  table_order_id: tOrderId, table_order_label: `T${tableIndex}.${tOrderId}`,
                  bbox_index: bIdx,
                  text: (sTexts[bIdx] || s.text).trim(), fullSentenceText: s.text.trim(),
                  rawCoords: [Math.round(bb[0] * 10) / 10, Math.round(bb[1] * 10) / 10, Math.round(bb[2] * 10) / 10, Math.round(bb[3] * 10) / 10],
                  bbox: [Math.round(bb[0] * 10) / 10, Math.round(bb[1] * 10) / 10, Math.round(bb[2] * 10) / 10, Math.round(bb[3] * 10) / 10],
                  rawBox: [Math.round(bb[0] * 10) / 10, Math.round(bb[1] * 10) / 10, Math.round(bb[2] * 10) / 10, Math.round(bb[3] * 10) / 10],
                  coordType: 'abs_points', category: 'Table Cell',
                  confidence: cell.confidence || 0.98, row: cell.row, col: cell.col
                });
              });
            }
          });
          if (resultItems.length > 0) return resultItems;
        }
      }
    }

    // CASE 2: words mevcut → word bazlı satır gruplama (eski mantık)
    if (Array.isArray(cell.words) && cell.words.length > 0 && Splitter && typeof Splitter.splitParagraphIntoSentences === 'function') {
      const lineMap = new Map();
      cell.words.forEach(w => {
        const wb = w.bbox || w.coords || [0, 0, 0, 0];
        const midY = Math.round((wb[1] + wb[3]) / 2);
        let matchedLine = null;
        for (const [lineY, lineWords] of lineMap.entries()) {
          if (Math.abs(lineY - midY) <= 6) {
            matchedLine = lineWords;
            break;
          }
        }
        if (matchedLine) {
          matchedLine.push(w);
        } else {
          lineMap.set(midY, [w]);
        }
      });

      const lineList = Array.from(lineMap.values());
      if (lineList.length > 1) {
        const lineDefs = lineList.map(lWords => {
          lWords.sort((a, b) => (a.bbox?.[0] || 0) - (b.bbox?.[0] || 0));
          const lineText = lWords.map(w => w.word || w.text || '').join(' ').trim();
          const allX0 = lWords.map(w => (w.bbox || w.coords)[0]);
          const allY0 = lWords.map(w => (w.bbox || w.coords)[1]);
          const allX1 = lWords.map(w => (w.bbox || w.coords)[2]);
          const allY1 = lWords.map(w => (w.bbox || w.coords)[3]);
          return {
            text: lineText,
            bbox: [Math.min(...allX0), Math.min(...allY0), Math.max(...allX1), Math.max(...allY1)]
          };
        }).filter(l => l.text.length > 0);

        lineDefs.sort((a, b) => a.bbox[1] - b.bbox[1]);
        const unitedText = lineDefs.map(l => l.text).join(' ');
        const sentences = Splitter.splitParagraphIntoSentences(unitedText);

        const lineIndices = [];
        let searchIdx = 0;
        for (const l of lineDefs) {
          let idx = unitedText.indexOf(l.text, searchIdx);
          if (idx === -1) idx = unitedText.indexOf(l.text);
          if (idx === -1) continue;
          const end = idx + l.text.length;
          lineIndices.push({ text: l.text, start: idx, end, bbox: l.bbox });
          searchIdx = end;
        }

        Splitter.mapSentencesToLines(sentences, lineIndices);
        sentences.forEach(s => Splitter.calculateSentenceBBoxes(s));
        Splitter.fixTinyLeadingBBoxes(sentences);
        const cleaned = Splitter.cleanSentences(sentences);

        const items = [];
        let currSid = startSentenceId;
        cleaned.forEach(s => {
          const sNum = currSid++;
          const sBoxes = s.bboxes || [];
          const sTexts = s.bbox_texts || [];
          if (sBoxes.length === 0) {
            items.push({
              id: `bbox-p${pageNum}-t${tableIndex}-c${tOrderId}-${sNum}-${Math.random().toString(36).substr(2, 6)}`,
              page: pageNum,
              sentence_id: sNum,
              id_display: sNum,
              table_id: tableId,
              table_type: tableType,
              table_order_id: tOrderId,
              table_order_label: `T${tableIndex}.${tOrderId}`,
              text: s.text.trim(),
              fullSentenceText: s.text.trim(),
              rawCoords: cellBox,
              bbox: cellBox,
              rawBox: cellBox,
              coordType: 'abs_points',
              category: 'Table Cell',
              confidence: cell.confidence || 0.98,
              row: cell.row,
              col: cell.col
            });
          } else {
            sBoxes.forEach((bb, bIdx) => {
              items.push({
                id: `bbox-p${pageNum}-t${tableIndex}-c${tOrderId}-${sNum}-${bIdx + 1}-${Math.random().toString(36).substr(2, 6)}`,
                page: pageNum,
                sentence_id: sNum,
                id_display: sNum,
                table_id: tableId,
                table_type: tableType,
                table_order_id: tOrderId,
                table_order_label: `T${tableIndex}.${tOrderId}`,
                text: (sTexts[bIdx] || s.text).trim(),
                fullSentenceText: s.text.trim(),
                rawCoords: [Math.round(bb[0] * 10) / 10, Math.round(bb[1] * 10) / 10, Math.round(bb[2] * 10) / 10, Math.round(bb[3] * 10) / 10],
                bbox: [Math.round(bb[0] * 10) / 10, Math.round(bb[1] * 10) / 10, Math.round(bb[2] * 10) / 10, Math.round(bb[3] * 10) / 10],
                rawBox: [Math.round(bb[0] * 10) / 10, Math.round(bb[1] * 10) / 10, Math.round(bb[2] * 10) / 10, Math.round(bb[3] * 10) / 10],
                coordType: 'abs_points',
                category: 'Table Cell',
                confidence: cell.confidence || 0.98,
                row: cell.row,
                col: cell.col
              });
            });
          }
        });
        if (items.length > 0) return items;
      }
    }

    return [{
      id: cell.id || `bbox-p${pageNum}-t${tableIndex}-c${tOrderId}-${startSentenceId}-${Math.random().toString(36).substr(2, 6)}`,
      page: pageNum,
      sentence_id: startSentenceId,
      id_display: startSentenceId,
      table_id: tableId,
      table_type: tableType,
      table_order_id: tOrderId,
      table_order_label: `T${tableIndex}.${tOrderId}`,
      text: cellText,
      fullSentenceText: fullText,
      rawCoords: cellBox,
      bbox: cellBox,
      rawBox: cellBox,
      coordType: 'abs_points',
      category: 'Table Cell',
      confidence: cell.confidence || 0.98,
      row: cell.row,
      col: cell.col
    }];
  }

  static _getRect(polyOrBox) {
    if (!polyOrBox) return null;
    if (Array.isArray(polyOrBox)) {
      if (polyOrBox.length >= 3 && Array.isArray(polyOrBox[0])) {
        const xs = polyOrBox.map(pt => Number(pt[0]) || 0);
        const ys = polyOrBox.map(pt => Number(pt[1]) || 0);
        return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
      }
      if (polyOrBox.length === 4 && typeof polyOrBox[0] === 'number') {
        const [a, b, c, d] = polyOrBox.map(Number);
        return [Math.min(a, c), Math.min(b, d), Math.max(a, c), Math.max(b, d)];
      }
    }
    if (typeof polyOrBox === 'object') {
      const x0 = Number(polyOrBox.xmin ?? polyOrBox.x0 ?? polyOrBox.left ?? 0);
      const y0 = Number(polyOrBox.ymin ?? polyOrBox.y0 ?? polyOrBox.top ?? 0);
      const x1 = Number(polyOrBox.xmax ?? polyOrBox.x1 ?? (x0 + (polyOrBox.width ?? 0)));
      const y1 = Number(polyOrBox.ymax ?? polyOrBox.y1 ?? (y0 + (polyOrBox.height ?? 0)));
      return [Math.min(x0, x1), Math.min(y0, y1), Math.max(x0, x1), Math.max(y0, y1)];
    }
    return null;
  }

  static _calculateBounds(cells) {
    if (!cells || cells.length === 0) return [0, 0, 0, 0];
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    cells.forEach(c => {
      const [x0, y0, x1, y1] = c.rawCoords || [0, 0, 0, 0];
      if (x0 < minX) minX = x0;
      if (y0 < minY) minY = y0;
      if (x1 > maxX) maxX = x1;
      if (y1 > maxY) maxY = y1;
    });
    return [minX, minY, maxX, maxY];
  }
}

// Exports
if (typeof window !== 'undefined') {
  window.TableClassifier = TableClassifier;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = TableClassifier;
}

