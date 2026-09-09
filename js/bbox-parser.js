/**
 * BBoxParser - Universal JSON and Bounding Box parsing engine.
 * Handles every known OCR, Document AI, PyMuPDF, LayoutLM, HuggingFace,
 * Azure, AWS, Google, LabelMe, COCO, and arbitrary custom Turkish/English schemas.
 */

class BBoxParser {
  /**
   * Main entry point to parse any raw JSON object/array into standardized BBox items.
   */
  static parse(jsonData, manualFormat = 'auto', yOrigin = 'top') {
    if (!jsonData) return [];

    // Extract all candidate elements deeply
    const rawItems = this._extractDeep(jsonData);

    // Global max coordinate to detect coordinate space
    let globalMax = 0;
    rawItems.forEach(item => {
      const b = this._findBoxInObject(item);
      const nums = this._parseToNumberArray(b);
      if (nums.length > 0) {
        const m = Math.max(...nums.map(Math.abs));
        if (m > globalMax) globalMax = m;
      }
    });

    const Classifier = (typeof TableClassifier !== 'undefined')
      ? TableClassifier
      : (typeof require !== 'undefined' ? (() => { try { return require('./table-classifier.js'); } catch(e) { return null; } })() : null);

    let tableIndexCounter = 1;
    const parsedList = [];

    rawItems.forEach((item, index) => {
      const page = this._findPageInObject(item, 1);
      const text = this._findTextInObject(item, index + 1);
      const rawBox = this._findBoxInObject(item);
      const confidence = this._findConfidenceInObject(item);
      const category = this._findCategoryInObject(item);

      // Check if item is a Table block or table container
      const isTable = this._isTableObject(item) || /table|tablo|grid|matrix/i.test(String(category || item.type || item.label || ''));

      if (isTable && Classifier && typeof Classifier.processTable === 'function' && !item.table_order_id) {
        const tableObj = {
          ...item,
          bbox: rawBox,
          text: text,
          page: page,
          confidence: confidence,
          category: 'Table Cell'
        };

        const tRes = Classifier.processTable(tableObj, page, parsedList.length + 1, tableIndexCounter++);
        if (tRes && tRes.items && tRes.items.length > 0) {
          tRes.items.forEach(tItem => {
            const cellBox = this._findBoxInObject(tItem) || tItem.rawCoords;
            const parsed = this._extractBoxNumbers(cellBox, manualFormat, globalMax, yOrigin);
            parsedList.push({
              id: tItem.id || `bbox-p${page}-t${tableIndexCounter}-${parsedList.length + 1}-${Math.random().toString(36).substr(2, 5)}`,
              index: parsedList.length + 1,
              id_display: parsedList.length + 1,
              page: page,
              text: tItem.text || text,
              fullSentenceText: tItem.fullSentenceText || tItem.text || text,
              confidence: tItem.confidence || confidence || 0.98,
              category: 'Table Cell',
              table_id: tRes.tableId,
              table_type: tRes.tableType,
              table_order_id: tItem.table_order_id,
              table_order_label: tItem.table_order_label,
              rawBox: cellBox,
              layoutProcessed: true,
              layout_id: tRes.tableId,
              ...parsed
            });
          });
          return;
        }
      }

      const parsed = this._extractBoxNumbers(rawBox, manualFormat, globalMax, yOrigin);

      parsedList.push({
        id: item.id || `bbox-p${page}-${parsedList.length + 1}-${Math.random().toString(36).substr(2, 5)}`,
        index: parsedList.length + 1,
        id_display: parsedList.length + 1,
        page: page,
        text: text,
        fullSentenceText: item.fullSentenceText || item.sentenceText || text || '',
        confidence: confidence,
        category: category,
        rawBox: rawBox,
        layoutProcessed: !!(item.layoutProcessed || item.layout_id),
        layout_id: item.layout_id || null,
        table_id: item.table_id || null,
        table_type: item.table_type || null,
        table_order_id: item.table_order_id !== undefined ? item.table_order_id : null,
        table_order_label: item.table_order_label || null,
        sentence_id: item.sentence_id !== undefined ? item.sentence_id : (item.id_display !== undefined ? item.id_display : null),
        ...parsed
      });
    });

    // 1. Split multi-sentence paragraphs into individual sentence bboxes (1 BBox per sentence)
    const Splitter = (typeof SentenceSplitter !== 'undefined')
      ? SentenceSplitter
      : (typeof require !== 'undefined' ? (() => { try { return require('./sentence-splitter.js'); } catch(e) { return null; } })() : null);

    const allLayoutProcessed = parsedList.length > 0 && parsedList.some(it => it.layoutProcessed || it.layout_id);
    
    const sentenceSegmented = (!allLayoutProcessed && Splitter && typeof Splitter.segmentAllParagraphs === 'function')
      ? Splitter.segmentAllParagraphs(parsedList)
      : parsedList;

    // 2. Remove duplicate/container overlaps and redundant macro bounding boxes
    const deduplicatedList = this.removeOverlapsAndDuplicates(sentenceSegmented);

    // 3. Apply Smart Multi-Column Reading Order Sorting
    return this.sortReadingOrder(deduplicatedList);
  }

  /**
   * Detect if a layout or object is structurally a table or key-value form
   */
  static _isLayoutTableOrForm(layout) {
    if (!layout || typeof layout !== 'object') return false;
    if (layout.is_table === true || layout.table === true) return true;
    if (layout.cells && layout.cells.length > 0) return true;
    if (layout.table_cells || layout.cell_bboxes || layout.rows || layout.matrix) return true;

    const lType = String(
      layout.category || layout.type || layout.label || layout.class || layout.class_name || 
      layout.label_type || layout.layout_label || layout.layout_type || layout.element_type || 
      layout.tur || layout.category_name || layout.label_name || layout.tag || layout.name || ''
    ).toLowerCase();

    if (/table|tablo|tabular|matrix|grid|form_table|data_table|key_value|form/i.test(lType)) {
      return true;
    }

    // Check words in layout
    const words = layout.words || [];
    if (words.length >= 4) {
      const validWords = words.filter(w => {
        const b = w.bbox || w.coords;
        return Array.isArray(b) && b.length >= 4;
      });

      if (validWords.length >= 4) {
        const sortedWords = [...validWords].sort((a, b) => {
          const cyA = (a.bbox[1] + a.bbox[3]) / 2;
          const cyB = (b.bbox[1] + b.bbox[3]) / 2;
          return cyA - cyB;
        });

        const lines = [];
        sortedWords.forEach(w => {
          const wcy = (w.bbox[1] + w.bbox[3]) / 2;
          const match = lines.find(l => Math.abs(l.cy - wcy) < 10);
          if (match) {
            match.words.push(w);
            match.cy = match.words.reduce((sum, item) => sum + (item.bbox[1] + item.bbox[3]) / 2, 0) / match.words.length;
          } else {
            lines.push({ cy: wcy, words: [w] });
          }
        });

        if (lines.length >= 2) {
          let colonLineCount = 0;
          let gapSplitLineCount = 0;

          lines.forEach(l => {
            l.words.sort((a, b) => a.bbox[0] - b.bbox[0]);
            const lineText = l.words.map(w => w.word || w.text || '').join(' ').trim();
            
            if (lineText.includes(':') && !lineText.startsWith(':')) {
              colonLineCount++;
            }

            for (let i = 0; i < l.words.length - 1; i++) {
              const gap = l.words[i + 1].bbox[0] - l.words[i].bbox[2];
              if (gap >= 22) {
                gapSplitLineCount++;
                break;
              }
            }
          });

          if ((colonLineCount >= 2 && colonLineCount / lines.length >= 0.3) ||
              (gapSplitLineCount >= 2 && gapSplitLineCount / lines.length >= 0.4)) {
            return true;
          }
        }
      }
    }

    return false;
  }

  /**
   * Helper to check if an arbitrary object represents a table structure
   */
  static _isTableObject(obj) {
    if (!obj || typeof obj !== 'object') return false;
    if (this._isLayoutTableOrForm(obj)) return true;

    // Check if text is a Markdown table or multi-column delimited tabular structure
    if (typeof obj.text === 'string' && obj.text.length > 10) {
      const txt = obj.text.trim();
      if ((txt.includes('|') && txt.split('\n').length >= 2) ||
          (txt.includes('\t') && txt.split('\n').length >= 2) ||
          (txt.includes('<table') && txt.includes('</table>'))) {
        return true;
      }
    }

    return false;
  }

  /**
   * Helper to extract lines from a list of words by baseline proximity
   */
  static _extractLinesFromWords(lWords) {
    if (!lWords || lWords.length === 0) return [];
    lWords.sort((a, b) => {
      const ay = (a.bbox[1] + a.bbox[3]) / 2;
      const by = (b.bbox[1] + b.bbox[3]) / 2;
      if (Math.abs(ay - by) > 10) return ay - by;
      return a.bbox[0] - b.bbox[0];
    });

    const layoutLines = [];
    let currentLine = null;
    lWords.forEach(w => {
      const wcy = (w.bbox[1] + w.bbox[3]) / 2;
      const wh = Math.max(w.bbox[3] - w.bbox[1], 8);
      if (!currentLine || Math.abs(wcy - currentLine.cy) > Math.max(wh * 0.65, 8)) {
        if (currentLine) layoutLines.push(currentLine);
        currentLine = {
          cy: wcy,
          words: [w],
          x0: w.bbox[0],
          y0: w.bbox[1],
          x1: w.bbox[2],
          y1: w.bbox[3]
        };
      } else {
        currentLine.words.push(w);
        currentLine.x0 = Math.min(currentLine.x0, w.bbox[0]);
        currentLine.y0 = Math.min(currentLine.y0, w.bbox[1]);
        currentLine.x1 = Math.max(currentLine.x1, w.bbox[2]);
        currentLine.y1 = Math.max(currentLine.y1, w.bbox[3]);
        currentLine.cy = (currentLine.y0 + currentLine.y1) / 2;
      }
    });
    if (currentLine) layoutLines.push(currentLine);

    layoutLines.forEach(ln => {
      ln.words.sort((a, b) => a.bbox[0] - b.bbox[0]);
      ln.text = ln.words.map(w => w.word || w.text || '').join(' ').trim();
      ln.rawCoords = [ln.x0, ln.y0, ln.x1, ln.y1];
    });

    return layoutLines.filter(ln => ln.text.length > 0);
  }

  /**
   * Stitches lines that lie on the same vertical baseline across split column/box detections.
   */
  static _stitchSameBaselineLines(lines) {
    if (!lines || lines.length <= 1) return lines;

    const sorted = [...lines].sort((a, b) => {
      const aMidY = (a.y0 + a.y1) / 2;
      const bMidY = (b.y0 + b.y1) / 2;
      const aH = Math.max(a.y1 - a.y0, 8);
      const bH = Math.max(b.y1 - b.y0, 8);
      if (Math.abs(aMidY - bMidY) > Math.min(aH, bH) * 0.45) {
        return aMidY - bMidY;
      }
      return a.x0 - b.x0;
    });

    const stitched = [];
    for (let i = 0; i < sorted.length; i++) {
      const curr = sorted[i];
      if (stitched.length === 0) {
        stitched.push({ ...curr });
        continue;
      }

      const prev = stitched[stitched.length - 1];
      const prevH = Math.max(prev.y1 - prev.y0, 8);
      const currH = Math.max(curr.y1 - curr.y0, 8);
      const prevMidY = (prev.y0 + prev.y1) / 2;
      const currMidY = (curr.y0 + curr.y1) / 2;

      const isSameBaseline = Math.abs(prevMidY - currMidY) <= Math.min(prevH, currH) * 0.55 ||
                             (Math.abs(prev.y0 - curr.y0) <= 6 && Math.abs(prev.y1 - curr.y1) <= 6);

      const xGap = curr.x0 - prev.x1;

      if (isSameBaseline && curr.x0 >= prev.x0 - 5 && xGap <= 35 && xGap >= -10) {
        let joinedText = prev.text.trim();
        const currText = curr.text.trim();

        if (joinedText.endsWith('-') || joinedText.endsWith('‐')) {
          joinedText = joinedText.replace(/[-‐]+$/, '') + currText;
        } else if (/[a-zA-ZçÇğĞıİöÖşŞüÜ]$/.test(joinedText) && /^[a-zA-ZçÇğĞıİöÖşŞüÜ]{1,3}$/.test(currText) && xGap < 15) {
          joinedText = joinedText + currText;
        } else {
          joinedText = joinedText + ' ' + currText;
        }

        prev.text = joinedText;
        prev.x0 = Math.min(prev.x0, curr.x0);
        prev.y0 = Math.min(prev.y0, curr.y0);
        prev.x1 = Math.max(prev.x1, curr.x1);
        prev.y1 = Math.max(prev.y1, curr.y1);
        prev.rawCoords = [prev.x0, prev.y0, prev.x1, prev.y1];
        if (prev.words && curr.words) {
          prev.words = [...prev.words, ...curr.words];
        }
      } else {
        stitched.push({ ...curr });
      }
    }
    return stitched;
  }

  /**
   * Non-Maximum Suppression and Hierarchical Container De-duplication.
   * Eliminates redundant giant parent blocks that encompass smaller sentence boxes,
   * removes duplicate overlapping detections, and trims minor vertical overlaps.
   */
  static removeOverlapsAndDuplicates(items) {
    if (!items || items.length <= 1) return items;

    // Group items by page
    const pagesMap = new Map();
    items.forEach(it => {
      const p = it.page || 1;
      if (!pagesMap.has(p)) pagesMap.set(p, []);
      pagesMap.get(p).push(it);
    });

    const cleanedAll = [];

    for (const [pageNum, pageItems] of pagesMap.entries()) {
      const validItems = this._cleanPageOverlaps(pageItems);
      cleanedAll.push(...validItems);
    }

    return cleanedAll;
  }

  /**
   * Public helper to clean duplicates and minor vertical collisions
   */
  static separateOverlappingBoxes(items) {
    return this.removeOverlapsAndDuplicates(items);
  }

  static _cleanPageOverlaps(items) {
    if (items.length <= 1) return items;

    // Keep all candidate items
    let candidates = items.filter(it => {
      const hasText = it.text && String(it.text).trim().length > 0;
      return hasText || (it.rawCoords && it.rawCoords.some(c => c > 0));
    });

    if (candidates.length === 0) candidates = items;

    // Calculate bounding box area and bounds for each candidate
    const boxes = candidates.map(it => {
      const [x0, y0, x1, y1] = it.rawCoords || [0, 0, 0, 0];
      const minX = Math.min(x0, x1);
      const maxX = Math.max(x0, x1);
      const minY = Math.min(y0, y1);
      const maxY = Math.max(y0, y1);
      const w = Math.max(maxX - minX, 0.0001);
      const h = Math.max(maxY - minY, 0.0001);
      const area = w * h;
      return {
        item: it,
        x0: minX, y0: minY, x1: maxX, y1: maxY,
        w, h, area,
        confidence: typeof it.confidence === 'number' ? it.confidence : 0.5,
        textLen: String(it.text || '').length,
        isContainer: false,
        isDuplicate: false
      };
    });

    // Detect if coordinate space is normalized (0..1) or pixel (0..1000+)
    const isNorm = boxes.length > 0 && boxes.every(b => b.x1 <= 1.5 && b.y1 <= 1.5);
    const minHeight = isNorm ? 0.001 : 6;
    const minGap = isNorm ? 0.005 : 10;
    const trimMargin = isNorm ? 0.001 : 2;

    // Step 2: Exact & High-Overlap Duplicate Suppression (IoU > 0.75 or identical text)
    for (let i = 0; i < boxes.length; i++) {
      const boxA = boxes[i];
      if (boxA.isDuplicate) continue;

      for (let j = i + 1; j < boxes.length; j++) {
        const boxB = boxes[j];
        if (boxB.isDuplicate) continue;

        // Never suppress or delete table items
        const isTableA = boxA.item.table_id || boxA.item.table_type || boxA.item.category === 'Table Cell' || boxA.item.category === 'Table';
        const isTableB = boxB.item.table_id || boxB.item.table_type || boxB.item.category === 'Table Cell' || boxB.item.category === 'Table';
        if (isTableA || isTableB) continue;

        const interX0 = Math.max(boxA.x0, boxB.x0);
        const interY0 = Math.max(boxA.y0, boxB.y0);
        const interX1 = Math.min(boxA.x1, boxB.x1);
        const interY1 = Math.min(boxA.y1, boxB.y1);

        if (interX1 > interX0 && interY1 > interY0) {
          const interArea = (interX1 - interX0) * (interY1 - interY0);
          const unionArea = boxA.area + boxB.area - interArea;
          const iou = unionArea > 0 ? (interArea / unionArea) : 0;

          const sameText = boxA.item.text && boxB.item.text && 
            (String(boxA.item.text).trim().toLowerCase() === String(boxB.item.text).trim().toLowerCase());

          if (iou > 0.75 || (sameText && (interArea / Math.min(boxA.area, boxB.area) > 0.55))) {
            if (boxA.confidence >= boxB.confidence) {
              boxB.isDuplicate = true;
            } else {
              boxA.isDuplicate = true;
              break;
            }
          }
        }
      }
    }

    // Step 3: Detect large macro container blocks enclosing smaller sentence/line boxes
    for (let i = 0; i < boxes.length; i++) {
      const boxA = boxes[i];
      if (boxA.isDuplicate || boxA.isContainer) continue;

      // Never suppress or delete table items
      const isTableA = boxA.item.table_id || boxA.item.table_type || boxA.item.category === 'Table Cell' || boxA.item.category === 'Table';
      if (isTableA) continue;

      let containedCount = 0;
      for (let j = 0; j < boxes.length; j++) {
        if (i === j) continue;
        const boxB = boxes[j];
        if (boxB.isDuplicate || boxB.isContainer) continue;

        if (boxA.area > boxB.area * 1.25) {
          const interX0 = Math.max(boxA.x0, boxB.x0);
          const interY0 = Math.max(boxA.y0, boxB.y0);
          const interX1 = Math.min(boxA.x1, boxB.x1);
          const interY1 = Math.min(boxA.y1, boxB.y1);

          if (interX1 > interX0 && interY1 > interY0) {
            const interArea = (interX1 - interX0) * (interY1 - interY0);
            if (boxB.area > 0 && interArea / boxB.area > 0.70) {
              containedCount++;
            }
          }
        }
      }

      // If boxA is an overarching paragraph/section block enclosing smaller sentence boxes
      if (containedCount >= 1) {
        boxA.isContainer = true;
      }
    }

    const finalBoxes = boxes.filter(b => !b.isContainer && !b.isDuplicate);

    // Step 4: Vertical boundary resolution between overlapping boxes
    // When boxA starts above boxB and boxA extends down into boxB:
    // Box A's bottom must stop right above Box B so they become separate non-overlapping boxes!
    for (let i = 0; i < finalBoxes.length; i++) {
      const boxA = finalBoxes[i];
      if (boxA.isDuplicate) continue;

      for (let j = 0; j < finalBoxes.length; j++) {
        if (i === j) continue;
        const boxB = finalBoxes[j];
        if (boxB.isDuplicate) continue;

        // Check horizontal overlap (they share column space)
        const xOverlap = Math.min(boxA.x1, boxB.x1) - Math.max(boxA.x0, boxB.x0);
        const minW = Math.min(boxA.w, boxB.w);

        if (xOverlap > minW * 0.35) {
          // If boxA starts above boxB, and boxA extends into boxB
          if (boxA.y0 < boxB.y0 && boxA.y1 > boxB.y0) {
            // If boxA has meaningful text/height above boxB:
            if (boxB.y0 - boxA.y0 >= minGap) {
              // Trim boxA's bottom so it stops right before boxB starts
              boxA.y1 = isNorm ? (boxB.y0 - trimMargin) : Math.round(boxB.y0 - trimMargin);
              boxA.h = boxA.y1 - boxA.y0;
              if (Array.isArray(boxA.item.rawCoords)) {
                boxA.item.rawCoords[3] = boxA.y1;
              }
            } else {
              // boxA starts almost at the same pixel as boxB, so it's an overlapping duplicate
              if (boxA.confidence < boxB.confidence) {
                boxA.isDuplicate = true;
              } else {
                boxB.isDuplicate = true;
              }
            }
          }
        }
      }
    }

    return finalBoxes.filter(b => !b.isDuplicate && (b.y1 - b.y0 >= minHeight)).map(b => b.item);
  }

  /**
   * Sort bounding boxes by natural document reading order:
   * Header -> Left Column (top to bottom) -> Right Column (top to bottom) -> Footer
   */
  static sortReadingOrder(items) {
    if (!items || items.length <= 1) return items;

    // Group by page number
    const pagesMap = new Map();
    items.forEach(it => {
      const p = it.page || 1;
      if (!pagesMap.has(p)) pagesMap.set(p, []);
      pagesMap.get(p).push(it);
    });

    const sortedAll = [];
    let currentDisplayId = 0;
    let lastSentenceKey = null;

    // Process each page
    const pageNumbers = Array.from(pagesMap.keys()).sort((a, b) => a - b);
    for (const pageNum of pageNumbers) {
      const pageItems = pagesMap.get(pageNum);
      const isAlreadyLayoutOrdered = pageItems.some(it => it.layoutProcessed || it.layout_id);
      const sortedPageItems = isAlreadyLayoutOrdered ? pageItems : this._sortPageItems(pageItems);

      sortedPageItems.forEach((it, idx) => {
        it.index = sortedAll.length;
        const sKey = `${pageNum}_${(it.sentence_id !== undefined && it.sentence_id !== null) ? it.sentence_id : (it.fullSentenceText || it.text || `item_${idx}`)}`;
        if (lastSentenceKey !== null && sKey !== lastSentenceKey) {
          currentDisplayId++;
        }
        lastSentenceKey = sKey;
        it.id_display = currentDisplayId;
        it.sentence_id = currentDisplayId;
        sortedAll.push(it);
      });
    }

    return sortedAll;
  }

  /**
   * Sort items within a single page
   */
  static _sortPageItems(items) {
    if (items.length <= 1) return items;

    // Find bounding box extents for this page
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    items.forEach(it => {
      const [x0, y0, x1, y1] = it.rawCoords || [0, 0, 0, 0];
      if (x0 < minX) minX = x0;
      if (x1 > maxX) maxX = x1;
      if (y0 < minY) minY = y0;
      if (y1 > maxY) maxY = y1;
    });

    const pageSpanX = Math.max(maxX - minX, 1);
    const pageSpanY = Math.max(maxY - minY, 1);

    // Decorate items with normalized spatial positions [0, 1]
    const decorated = items.map(it => {
      const [x0, y0, x1, y1] = it.rawCoords || [0, 0, 0, 0];
      const normX0 = (x0 - minX) / pageSpanX;
      const normX1 = (x1 - minX) / pageSpanX;
      const normY0 = (y0 - minY) / pageSpanY;
      const normY1 = (y1 - minY) / pageSpanY;
      const normMidX = (normX0 + normX1) / 2;
      const normWidth = normX1 - normX0;

      return {
        item: it,
        x0, y0, x1, y1,
        normX0, normX1, normY0, normY1,
        normMidX, normWidth
      };
    });

    // Check if page has a 2-column structure in the body area
    const bodyItems = decorated.filter(d => d.normY0 >= 0.08 && d.normY0 <= 0.88);
    const leftCount = bodyItems.filter(d => d.normMidX < 0.48 && d.normWidth < 0.65).length;
    const rightCount = bodyItems.filter(d => d.normMidX >= 0.52 && d.normWidth < 0.65).length;
    const isTwoColumn = leftCount >= 2 && rightCount >= 2;

    const headers = [];
    const footers = [];
    const leftColumn = [];
    const rightColumn = [];
    const fullWidthBody = [];

    decorated.forEach(d => {
      // 1. Header: near top (normY1 <= 0.10) OR full-width span near top
      if (d.normY1 <= 0.10 || (d.normWidth > 0.65 && d.normY0 < 0.15)) {
        headers.push(d);
      }
      // 2. Footer: near bottom (normY0 >= 0.89) OR address/copyright blocks at the bottom
      else if (d.normY0 >= 0.89) {
        footers.push(d);
      }
      // 3. Body:
      else if (isTwoColumn) {
        if (d.normWidth > 0.65) {
          fullWidthBody.push(d);
        } else if (d.normMidX < 0.50) {
          leftColumn.push(d);
        } else {
          rightColumn.push(d);
        }
      } else {
        // Single column document body
        leftColumn.push(d);
      }
    });

    // Sort Headers: top to bottom, then left to right
    headers.sort((a, b) => {
      if (Math.abs(a.y0 - b.y0) > 15) return a.y0 - b.y0;
      return a.x0 - b.x0;
    });

    // Sort Left Column: strictly top to bottom
    leftColumn.sort((a, b) => a.y0 - b.y0);

    // Sort Right Column: strictly top to bottom
    rightColumn.sort((a, b) => a.y0 - b.y0);

    // Sort Full-width body items: top to bottom
    fullWidthBody.sort((a, b) => a.y0 - b.y0);

    // Sort Footers: top to bottom, then left to right
    footers.sort((a, b) => {
      if (Math.abs(a.y0 - b.y0) > 20) return a.y0 - b.y0;
      return a.x0 - b.x0;
    });

    // Combine in natural reading order:
    // Headers -> Left Column -> Right Column -> Footers
    const result = [
      ...headers.map(d => d.item),
      ...leftColumn.map(d => d.item),
      ...rightColumn.map(d => d.item),
      ...fullWidthBody.map(d => d.item),
      ...footers.map(d => d.item)
    ];

    return result;
  }

  /**
   * Deep recursive search for items across arbitrary JSON structures
   */
  static _extractDeep(data) {
    if (!data) return [];

    // If array of items
    if (Array.isArray(data)) {
      // 1. Check if items contain DocLayout-YOLO elements AND Surya OCR words/lines:
      const hasLayoutsAndWords = data.some(it => it && (Array.isArray(it.elements) || Array.isArray(it.blocks)) && (Array.isArray(it.ocr_words) || Array.isArray(it.words) || Array.isArray(it.ocr_lines)));
      if (hasLayoutsAndWords) {
        const extracted = [];
        let curSentenceIndex = 1;
        data.forEach((sub, pIdx) => {
          if (typeof sub === 'object' && sub !== null) {
            const pageNum = sub.page || sub.page_number || (pIdx + 1);
            const layoutItems = this._processPageLayoutsWithWords(sub, pageNum, curSentenceIndex);
            if (Array.isArray(layoutItems) && layoutItems.length > 0) {
              extracted.push(...layoutItems);
              curSentenceIndex = layoutItems.nextSentenceIndex || (curSentenceIndex + layoutItems.length);
            } else {
              const fallback = this._extractDeep(sub);
              if (Array.isArray(fallback)) {
                fallback.forEach(item => extracted.push({ ...item, page: item.page || pageNum }));
              }
            }
          }
        });
        if (extracted.length > 0) return extracted;
      }

      // 2. Check if items contain sentences, cells, ocr_lines or text_lines:
      const hasSentencesOrCells = data.some(it => it && (Array.isArray(it.sentences) || Array.isArray(it.cells) || Array.isArray(it.table_cells) || Array.isArray(it.ocr_lines) || Array.isArray(it.text_lines)));
      if (hasSentencesOrCells) {
        const extracted = [];
        data.forEach((sub, pIdx) => {
          if (typeof sub === 'object' && sub !== null) {
            const pageNum = sub.page || sub.page_number || (pIdx + 1);
            const subExtracted = this._extractDeep(sub);
            if (Array.isArray(subExtracted)) {
              subExtracted.forEach(item => {
                extracted.push({ ...item, page: item.page || pageNum });
              });
            }
          }
        });
        if (extracted.length > 0) return extracted;
      }

      if (data.length > 0 && typeof data[0] === 'object' && !Array.isArray(data[0])) {
        const firstObj = data[0];

        // Does item look like a PAGE/CONTAINER wrapper?
        const pageWrapperKeys = ['elements', 'blocks', 'sentences', 'cells', 'table_cells', 'ocr_lines', 'ocrLines', 'text_lines', 'lines_data', 'lines', 'words', 'items', 'paragraphs', 'bboxes', 'spans', 'shapes', 'annotations', 'detections', 'res'];
        const isPageWrapper = pageWrapperKeys.some(k => Array.isArray(firstObj[k]));

        if (isPageWrapper) {
          // Extract from sub-arrays, preserving page number
          const items = [];
          let curSentenceIndex = 1;
          data.forEach((pageObj, pageIdx) => {
            const pageNum = pageObj.page || pageObj.page_number || pageObj.page_num || pageObj.page_idx || (pageIdx + 1);
            
            // Check if this page has DocLayout-YOLO elements + Surya OCR words
            const pageLayoutItems = this._processPageLayoutsWithWords(pageObj, pageNum, curSentenceIndex);
            if (Array.isArray(pageLayoutItems) && pageLayoutItems.length > 0) {
              items.push(...pageLayoutItems);
              curSentenceIndex = pageLayoutItems.nextSentenceIndex || (curSentenceIndex + pageLayoutItems.length);
              return;
            }

            for (const k of pageWrapperKeys) {
              if (Array.isArray(pageObj[k]) && pageObj[k].length > 0) {
                const subExtracted = this._extractDeep(pageObj[k]);
                if (Array.isArray(subExtracted)) {
                  subExtracted.forEach(el => {
                    items.push({ ...el, page: el.page || pageNum });
                  });
                }
                break; // use first matching key per page object
              }
            }
          });
          if (items.length > 0) return items;
        }

        // Otherwise treat as a direct list of bbox items: [{ text, bbox }, ...]
        return data;
      }

      // Check if it's PaddleOCR / array-of-arrays format:
      if (data.length > 0 && Array.isArray(data[0])) {
        return data.map((row, idx) => this._convertArrayRowToObject(row, idx));
      }

      // Flatten nested lists
      const flat = [];
      data.forEach(sub => {
        if (typeof sub === 'object' && sub !== null) {
          const subRes = this._extractDeep(sub);
          if (Array.isArray(subRes) && subRes.length > 0) {
            flat.push(...subRes);
          }
        }
      });
      if (flat.length > 0) return flat;
    }

    // If object
    if (typeof data === 'object' && data !== null) {
      const Splitter = (typeof SentenceSplitter !== 'undefined')
        ? SentenceSplitter
        : (typeof require !== 'undefined' ? (() => { try { return require('./sentence-splitter.js'); } catch(e) { return null; } })() : null);

      // 0. TABLE & TABLE CELL HANDLING:
      if (this._isTableObject(data)) {
        const Classifier = (typeof TableClassifier !== 'undefined')
          ? TableClassifier
          : (typeof require !== 'undefined' ? (() => { try { return require('./table-classifier.js'); } catch(e) { return null; } })() : null);

        if (Classifier && typeof Classifier.processTable === 'function') {
          const { items: tableItems } = Classifier.processTable(data, data.page || 1, 1);
          if (tableItems && tableItems.length > 0) {
            return tableItems.map(it => ({
              ...it,
              page: data.page || 1,
              bbox: it.rawCoords,
              layoutProcessed: true
            }));
          }
        }

        if (Splitter) {
          const cells = Splitter.extractTableCells(data);
          if (cells.length > 0) {
            return cells.map((c, idx) => ({
              page: data.page || 1,
              text: c.text,
              bbox: c.rawCoords,
              category: 'Table Cell',
              confidence: 0.99
            }));
          }
        }
      }

      // 0.1 NLP SENTENCE-LEVEL OBJECT (Output format of new_sentence_splitter.py):
      if (Array.isArray(data.sentences) && data.sentences.length > 0) {
        const sentenceItems = [];
        data.sentences.forEach((s, sIdx) => {
          const sText = s.sentence_text || s.text || `Cümle #${sIdx + 1}`;
          const bboxes = s.sentence_bboxes || s.bboxes || s.bbox;
          if (Array.isArray(bboxes) && bboxes.length > 0) {
            if (Array.isArray(bboxes[0])) {
              bboxes.forEach((b, bIdx) => {
                sentenceItems.push({
                  page: data.page || 1,
                  text: (s.bbox_texts && s.bbox_texts[bIdx]) ? s.bbox_texts[bIdx] : sText,
                  bbox: b,
                  sentence_number: s.sentence_number || (sIdx + 1),
                  category: 'Sentence'
                });
              });
            } else {
              sentenceItems.push({
                page: data.page || 1,
                text: sText,
                bbox: bboxes,
                sentence_number: s.sentence_number || (sIdx + 1),
                category: 'Sentence'
              });
            }
          }
        });
        if (sentenceItems.length > 0) return sentenceItems;
      }

      // 0.2 SURYA OCR / OCR_LINES FORMAT: { page: 1, full_text: '...', ocr_lines: [...] }
      if (Array.isArray(data.ocr_lines) && data.ocr_lines.length > 0) {
        const pageNum = data.page || data.page_number || 1;
        return data.ocr_lines.map((l, idx) => ({
          page: pageNum,
          text: l.text,
          bbox: l.bbox,
          confidence: l.confidence,
          category: 'Sentence',
          words: l.words,
          line_idx: l.line_idx !== undefined ? l.line_idx : idx
        }));
      }

      // 1. Check LayoutLM format: { tokens: [...], bboxes: [...] }
      if (Array.isArray(data.bboxes) && (Array.isArray(data.tokens) || Array.isArray(data.texts) || Array.isArray(data.words))) {
        const texts = data.tokens || data.texts || data.words || [];
        return data.bboxes.map((box, idx) => ({
          page: (data.pages && data.pages[idx]) || 1,
          bbox: box,
          text: texts[idx] || `Kelime #${idx + 1}`,
          category: (data.labels && data.labels[idx]) || null
        }));
      }

      // 2. Check { boxes: [...], texts: [...] }
      if (Array.isArray(data.boxes) && Array.isArray(data.texts)) {
        return data.boxes.map((box, idx) => ({
          page: (data.pages && data.pages[idx]) || 1,
          bbox: box,
          text: data.texts[idx] || `Metin #${idx + 1}`
        }));
      }

      // 3. Check for standard container keys (tables, pages, blocks, lines, results, annotations, elements, items, etc.)
      const containerKeys = [
        'tables', 'table_list', 'table_elements', 'table_detections', 'table_cells', 'cells',
        'results', 'annotations', 'elements', 'sentences', 'lines', 'boxes', 'data',
        'predictions', 'documents', 'items', 'blocks', 'paragraphs', 'spans', 'shapes',
        'words', 'readResults', 'analyzeResult', 'detection', 'detections', 'res'
      ];

      for (const key of containerKeys) {
        if (Array.isArray(data[key]) && data[key].length > 0) {
          const extracted = this._extractDeep(data[key]);
          if (extracted.length > 0) return extracted;
        } else if (data[key] && typeof data[key] === 'object') {
          const extracted = this._extractDeep(data[key]);
          if (extracted.length > 0) return extracted;
        }
      }

      // 4. Check if object has "pages": [ { page_number: 1, lines: [...] } ]
      if (Array.isArray(data.pages)) {
        const items = [];
        data.pages.forEach((pageObj, pageIdx) => {
          const pageNum = pageObj.page_number || pageObj.page || pageObj.page_num || (pageIdx + 1);
          const subItems = this._extractDeep(pageObj);
          subItems.forEach(it => {
            items.push({ ...it, page: it.page || pageNum });
          });
        });
        if (items.length > 0) return items;
      }

      // 5. Check if keys are page numbers: { "1": [...], "2": [...] } or { "page_1": [...] }
      const keys = Object.keys(data);
      const numericKeys = keys.filter(k => !isNaN(parseInt(k.replace(/\D/g, ''), 10)));
      if (numericKeys.length > 0 && typeof data[numericKeys[0]] === 'object') {
        const items = [];
        numericKeys.forEach(k => {
          const rawNum = parseInt(k.replace(/\D/g, ''), 10);
          const pageNum = isNaN(rawNum) ? 1 : (rawNum === 0 ? 1 : rawNum);
          const subItems = this._extractDeep(data[k]);
          if (Array.isArray(subItems)) {
            subItems.forEach(it => {
              items.push({ ...it, page: it.page || pageNum });
            });
          }
        });
        if (items.length > 0) return items;
      }

      // 6. If object itself looks like a bounding box item
      if (this._findBoxInObject(data) !== null) {
        return [data];
      }

      // 7. Generic document/container wrapper object recursion (e.g. { "document_name": [...] } or { "result": { ... } })
      const allKeys = Object.keys(data);
      for (const k of allKeys) {
        if (data[k] && typeof data[k] === 'object') {
          const subItems = this._extractDeep(data[k]);
          if (Array.isArray(subItems) && subItems.length > 0) {
            return subItems;
          }
        }
      }
    }

    return [];
  }

  /**
   * Convert array-based rows into objects
   */
  static _convertArrayRowToObject(row, idx) {
    // PaddleOCR format: [ [ [[x1,y1],[x2,y2],[x3,y3],[x4,y4]], ("text", 0.98) ] ]
    if (row.length >= 2 && Array.isArray(row[0])) {
      const box = row[0];
      let text = '';
      let conf = null;
      if (Array.isArray(row[1])) {
        text = row[1][0] || '';
        conf = row[1][1] || null;
      } else if (typeof row[1] === 'string') {
        text = row[1];
      }
      return { page: 1, bbox: box, text: text, confidence: conf };
    }

    // Format: [x0, y0, x1, y1, text, confidence, page]
    if (row.length >= 5 && typeof row[4] === 'string') {
      return {
        page: row[6] || 1,
        bbox: [row[0], row[1], row[2], row[3]],
        text: row[4],
        confidence: row[5] || null
      };
    }

    // Format: [text, [x0, y0, x1, y1]]
    if (row.length >= 2 && typeof row[0] === 'string' && Array.isArray(row[1])) {
      return { page: 1, bbox: row[1], text: row[0] };
    }

    return { page: 1, bbox: row, text: `Metin #${idx + 1}` };
  }

  /**
   * Find bounding box field in any object by checking English and Turkish aliases
   */
  static _findBoxInObject(obj) {
    if (!obj || typeof obj !== 'object') return null;

    // Keys that represent entire page/image canvas dimensions, NOT individual bounding boxes
    const ignorePageKeys = ['image_bbox', 'page_bbox', 'canvas_bbox', 'doc_bbox', 'image_size', 'page_size', 'page_box', 'doc_box'];

    // Explicit bbox keys
    const boxKeys = [
      'bbox', 'box', 'coordinates', 'koordinat', 'konum', 'kutu', 'rect',
      'boundingBox', 'bounding_box', 'bounding_poly', 'poly', 'polygon',
      'quad', 'geometry', 'location', 'position', 'box_2d', 'box2d',
      'bndbox', 'points', 'bounds', 'boundary', 'coords', 'xyxy', 'xywh',
      'points_list', 'segmentation'
    ];

    for (const k of boxKeys) {
      if (obj[k] !== undefined && obj[k] !== null && !ignorePageKeys.includes(k.toLowerCase())) {
        return obj[k];
      }
    }

    // Case-insensitive / partial match for keys containing "box", "coord", "poly", "rect", "konum"
    const objKeys = Object.keys(obj);
    for (const k of objKeys) {
      const lower = k.toLowerCase();
      if (ignorePageKeys.includes(lower)) continue;
      if (
        lower.includes('bbox') ||
        lower.includes('coord') ||
        lower.includes('poly') ||
        lower.includes('rect') ||
        lower.includes('konum') ||
        lower.includes('koordinat') ||
        lower.includes('bound')
      ) {
        return obj[k];
      }
    }

    // Check if object has direct coordinates { xmin, ymin, xmax, ymax } or { x0, y0, x1, y1 } or { x, y, width, height }
    if (
      ('xmin' in obj && 'ymin' in obj) ||
      ('x0' in obj && 'y0' in obj) ||
      ('x1' in obj && 'y1' in obj && 'x2' in obj) ||
      ('left' in obj && 'top' in obj) ||
      ('x' in obj && 'y' in obj && ('width' in obj || 'w' in obj))
    ) {
      return obj;
    }

    // Check if any value is an array of 4+ numbers
    for (const k of objKeys) {
      const val = obj[k];
      if (Array.isArray(val) && val.length >= 4 && typeof val[0] === 'number') {
        return val;
      }
    }

    return null;
  }

  /**
   * Find text/sentence in any object by checking English and Turkish aliases
   */
  static _findTextInObject(obj, fallbackIdx = 1) {
    if (!obj || typeof obj !== 'object') return `Metin #${fallbackIdx}`;

    const textKeys = [
      'text', 'metin', 'cümle', 'cumle', 'sentence', 'content', 'icerik', 'içerik',
      'transcription', 'transkripsiyon', 'words', 'kelimeler', 'label', 'etiket',
      'value', 'değer', 'deger', 'string', 'line', 'satir', 'satır', 'ocr_text',
      'recognized_text', 'pred_text', 'word', 'token', 'title', 'baslik', 'başlık'
    ];

    for (const k of textKeys) {
      if (obj[k] !== undefined && obj[k] !== null && typeof obj[k] === 'string' && obj[k].trim() !== '') {
        return obj[k].trim();
      }
    }

    // Partial key match
    const objKeys = Object.keys(obj);
    for (const k of objKeys) {
      const lower = k.toLowerCase();
      if (
        (lower.includes('text') || lower.includes('metin') || lower.includes('sent') || lower.includes('cumle') || lower.includes('content')) &&
        typeof obj[k] === 'string' && obj[k].trim() !== ''
      ) {
        return obj[k].trim();
      }
    }

    // If any string value is longer than 2 characters
    for (const k of objKeys) {
      if (typeof obj[k] === 'string' && obj[k].trim().length >= 2 && !['id', 'page', 'type', 'category', 'class'].includes(k.toLowerCase())) {
        return obj[k].trim();
      }
    }

    return `Metin #${fallbackIdx}`;
  }

  /**
   * Find page number
   */
  static _findPageInObject(obj, fallbackPage = 1) {
    if (!obj || typeof obj !== 'object') return fallbackPage;
    const pageKeys = ['page', 'sayfa', 'page_number', 'page_idx', 'page_num', 'page_no', 'sayfa_no', 'pageNum'];
    for (const k of pageKeys) {
      if (obj[k] !== undefined && obj[k] !== null) {
        const p = parseInt(obj[k], 10);
        if (!isNaN(p) && p > 0) return p;
      }
    }
    return fallbackPage;
  }

  /**
   * Find confidence score
   */
  static _findConfidenceInObject(obj) {
    if (!obj || typeof obj !== 'object') return null;
    const confKeys = ['confidence', 'score', 'prob', 'probability', 'guven', 'güven', 'accuracy'];
    for (const k of confKeys) {
      if (obj[k] !== undefined && obj[k] !== null) {
        const c = parseFloat(obj[k]);
        if (!isNaN(c)) return Math.round(c * 100) / 100;
      }
    }
    return null;
  }

  /**
   * Find category/type
   */
  static _findCategoryInObject(obj) {
    if (!obj || typeof obj !== 'object') return null;
    const catKeys = ['category', 'type', 'label_type', 'class', 'tur', 'tür', 'kategori', 'tag'];
    for (const k of catKeys) {
      if (obj[k] !== undefined && obj[k] !== null && typeof obj[k] === 'string') {
        return obj[k];
      }
    }
    return null;
  }

  /**
   * Parse various raw box representations into [x0, y0, x1, y1] numbers
   */
  static _extractBoxNumbers(box, manualFormat = 'auto', globalMax = 0, yOrigin = 'top') {
    let x0 = 0, y0 = 0, x1 = 0, y1 = 0;

    // Convert string to array if stringified (e.g. "[54.2, 72.1, 540.3, 95.4]" or "54,72,540,95")
    if (typeof box === 'string') {
      box = this._parseStringToNumbers(box);
    }

    // 1. Polygon [[x1,y1],[x2,y2],[x3,y3],[x4,y4]]
    if (Array.isArray(box) && box.length >= 4 && Array.isArray(box[0])) {
      const xs = box.map(p => Number(p[0]) || 0);
      const ys = box.map(p => Number(p[1]) || 0);
      x0 = Math.min(...xs);
      x1 = Math.max(...xs);
      y0 = Math.min(...ys);
      y1 = Math.max(...ys);
    }
    // 2. Flat 8-point polygon [x1, y1, x2, y2, x3, y3, x4, y4]
    else if (Array.isArray(box) && box.length === 8) {
      const xs = [Number(box[0]), Number(box[2]), Number(box[4]), Number(box[6])];
      const ys = [Number(box[1]), Number(box[3]), Number(box[5]), Number(box[7])];
      x0 = Math.min(...xs);
      x1 = Math.max(...xs);
      y0 = Math.min(...ys);
      y1 = Math.max(...ys);
    }
    // 3. Flat 4-point array [a, b, c, d]
    else if (Array.isArray(box) && box.length >= 4) {
      const [a, b, c, d] = box.map(Number);

      if (manualFormat === 'ymin_xmin') {
        y0 = a; x0 = b; y1 = c; x1 = d;
      } else if (manualFormat === 'xywh_norm' || manualFormat === 'xywh_abs') {
        x0 = a; y0 = b; x1 = a + c; y1 = b + d;
      } else if (manualFormat === 'xyxy_norm' || manualFormat === 'xyxy_1000' || manualFormat === 'xyxy_abs' || manualFormat === 'pdf_points') {
        x0 = a; y0 = b; x1 = c; y1 = d;
      } else {
        // Auto detection: is it [x, y, w, h] or [x0, y0, x1, y1]?
        if (c > a && d > b) {
          x0 = a; y0 = b; x1 = c; y1 = d;
        } else if (c > 0 && d > 0 && (a + c <= (globalMax || 1000) * 1.15)) {
          // [x, y, width, height]
          x0 = a; y0 = b; x1 = a + c; y1 = b + d;
        } else {
          x0 = a; y0 = b; x1 = c; y1 = d;
        }
      }
    }
    // 4. Object format { xmin, ymin, xmax, ymax } or { left, top, width, height }
    else if (typeof box === 'object' && box !== null) {
      if ('xmin' in box && 'ymin' in box) {
        x0 = Number(box.xmin) || 0;
        y0 = Number(box.ymin) || 0;
        x1 = Number(box.xmax) || 0;
        y1 = Number(box.ymax) || 0;
      } else if ('left' in box && 'top' in box) {
        x0 = Number(box.left) || 0;
        y0 = Number(box.top) || 0;
        x1 = 'right' in box ? Number(box.right) : (x0 + (Number(box.width) || 0));
        y1 = 'bottom' in box ? Number(box.bottom) : (y0 + (Number(box.height) || 0));
      } else if ('x0' in box && 'y0' in box) {
        x0 = Number(box.x0) || 0;
        y0 = Number(box.y0) || 0;
        x1 = Number(box.x1) || 0;
        y1 = Number(box.y1) || 0;
      } else if ('x1' in box && 'y1' in box && 'x2' in box && 'y2' in box) {
        x0 = Number(box.x1) || 0;
        y0 = Number(box.y1) || 0;
        x1 = Number(box.x2) || 0;
        y1 = Number(box.y2) || 0;
      } else if ('x' in box && 'y' in box) {
        x0 = Number(box.x) || 0;
        y0 = Number(box.y) || 0;
        x1 = x0 + (Number(box.w || box.width) || 0);
        y1 = y0 + (Number(box.h || box.height) || 0);
      }
    }

    const minX = Math.min(x0, x1);
    const maxX = Math.max(x0, x1);
    const minY = Math.min(y0, y1);
    const maxY = Math.max(y0, y1);

    // Determine coordinate space
    const maxVal = Math.max(Math.abs(minX), Math.abs(minY), Math.abs(maxX), Math.abs(maxY), globalMax);

    let coordType = 'norm_0_1';
    if (manualFormat === 'xyxy_1000' || manualFormat === 'norm_1000') {
      coordType = 'norm_0_1000';
    } else if (manualFormat === 'pdf_points' || manualFormat === 'xyxy_abs' || manualFormat === 'xywh_abs') {
      coordType = 'abs_points';
    } else if (manualFormat === 'image_pixels') {
      coordType = 'image_pixels';
    } else if (manualFormat === 'xyxy_norm' || manualFormat === 'xywh_norm') {
      coordType = 'norm_0_1';
    } else {
      // Auto Mode:
      if (maxVal <= 1.05) {
        coordType = 'norm_0_1';
      } else if (maxVal <= 1000 && maxVal > 850 && globalMax <= 1000) {
        coordType = 'norm_0_1000';
      } else {
        coordType = 'abs_points';
      }
    }

    return {
      rawCoords: [minX, minY, maxX, maxY],
      coordType: coordType,
      yOrigin: yOrigin
    };
  }

  /**
   * Helper to parse stringified numbers: "[54.2, 72.1, 540.3, 95.4]" -> [54.2, 72.1, 540.3, 95.4]
   */
  static _parseStringToNumbers(str) {
    if (!str) return [];
    const matches = str.match(/[-+]?[0-9]*\.?[0-9]+/g);
    return matches ? matches.map(Number) : [];
  }

  /**
   * Helper to flatten any object/array to array of numbers
   */
  /**
   * Helper to extract lines from a list of words by baseline proximity
   */
  static _extractLinesFromWords(lWords) {
    if (!lWords || lWords.length === 0) return [];
    lWords.sort((a, b) => {
      const ay = (a.bbox[1] + a.bbox[3]) / 2;
      const by = (b.bbox[1] + b.bbox[3]) / 2;
      if (Math.abs(ay - by) > 10) return ay - by;
      return a.bbox[0] - b.bbox[0];
    });

    const layoutLines = [];
    let currentLine = null;
    lWords.forEach(w => {
      const wcy = (w.bbox[1] + w.bbox[3]) / 2;
      const wh = Math.max(w.bbox[3] - w.bbox[1], 8);
      if (!currentLine || Math.abs(wcy - currentLine.cy) > Math.max(wh * 0.65, 8)) {
        if (currentLine) layoutLines.push(currentLine);
        currentLine = {
          cy: wcy,
          words: [w],
          x0: w.bbox[0],
          y0: w.bbox[1],
          x1: w.bbox[2],
          y1: w.bbox[3]
        };
      } else {
        currentLine.words.push(w);
        currentLine.x0 = Math.min(currentLine.x0, w.bbox[0]);
        currentLine.y0 = Math.min(currentLine.y0, w.bbox[1]);
        currentLine.x1 = Math.max(currentLine.x1, w.bbox[2]);
        currentLine.y1 = Math.max(currentLine.y1, w.bbox[3]);
        currentLine.cy = (currentLine.y0 + currentLine.y1) / 2;
      }
    });
    if (currentLine) layoutLines.push(currentLine);

    layoutLines.forEach(ln => {
      ln.words.sort((a, b) => a.bbox[0] - b.bbox[0]);
      ln.text = ln.words.map(w => w.word || w.text || '').join(' ').trim();
      ln.rawCoords = [ln.x0, ln.y0, ln.x1, ln.y1];
    });

    return layoutLines.filter(ln => ln.text.length > 0);
  }

  /**
   * Processes DocLayout-YOLO layout regions and maps Surya OCR words into them.
   * Consecutively occurring plain text layouts are merged and processed together with NLP rules.
   * Abandon, Table, and Title layouts are respected with dedicated boundaries.
   */
  static _processPageLayoutsWithWords(pageObj, pageNum = 1, startSentenceIndex = 1) {
    const rawLayouts = pageObj.elements || pageObj.blocks || pageObj.layout_boxes || [];
    if (!Array.isArray(rawLayouts) || rawLayouts.length === 0) return null;

    // Collect all available words on this page
    let allWords = [];
    if (Array.isArray(pageObj.ocr_words) && pageObj.ocr_words.length > 0) {
      allWords = pageObj.ocr_words;
    } else if (Array.isArray(pageObj.words) && pageObj.words.length > 0) {
      allWords = pageObj.words;
    } else if (Array.isArray(pageObj.ocr_lines)) {
      pageObj.ocr_lines.forEach(l => {
        if (Array.isArray(l.words) && l.words.length > 0) {
          allWords.push(...l.words);
        }
      });
    }

    const Splitter = (typeof SentenceSplitter !== 'undefined')
      ? SentenceSplitter
      : (typeof require !== 'undefined' ? (() => { try { return require('./sentence-splitter.js'); } catch(e) { return null; } })() : null);

    // Filter and normalize layout regions
    let maxX = 0, maxY = 0;
    rawLayouts.forEach(l => {
      const box = l.coords || l.bbox || l.box;
      if (Array.isArray(box) && box.length >= 4) {
        if (box[2] > maxX) maxX = box[2];
        if (box[3] > maxY) maxY = box[3];
      }
    });

    const rawCandidateLayouts = [];
    rawLayouts.forEach((l, lIdx) => {
      const box = l.coords || l.bbox || l.box;
      if (!Array.isArray(box) || box.length < 4) return;
      const x0 = Number(box[0]) || 0;
      const y0 = Number(box[1]) || 0;
      const x1 = Number(box[2]) || 0;
      const y1 = Number(box[3]) || 0;
      const w = Math.abs(x1 - x0);
      let t = (l.type || l.category || 'plain text').toLowerCase();

      // Normalize abandon type
      if (t === 'abandon' || t.includes('abandon')) {
        t = 'abandon';
      }

      // Filter out cross-column duplicate elements that span across 2 columns in the middle of the body
      if (y0 > maxY * 0.10 && y1 < maxY * 0.90 && w > maxX * 0.60 && t !== 'table') {
        return;
      }

      rawCandidateLayouts.push({
        id: l.id || `layout-p${pageNum}-${lIdx + 1}`,
        type: t,
        x0: Math.min(x0, x1),
        y0: Math.min(y0, y1),
        x1: Math.max(x0, x1),
        y1: Math.max(y0, y1),
        confidence: typeof l.confidence === 'number' ? l.confidence : 0.95,
        text: l.text || '',
        cells: l.cells || l.table_cells || null,
        words: [],
        rawLayout: l
      });
    });

    // Filter out duplicate near-identical layouts (IoU > 0.80)
    const layouts = [];
    rawCandidateLayouts.forEach(l => {
      const lArea = (l.x1 - l.x0) * (l.y1 - l.y0);
      if (lArea <= 0) return;
      const isNearDup = layouts.some(fl => {
        const oX = Math.max(0, Math.min(l.x1, fl.x1) - Math.max(l.x0, fl.x0));
        const oY = Math.max(0, Math.min(l.y1, fl.y1) - Math.max(l.y0, fl.y0));
        const flArea = (fl.x1 - fl.x0) * (fl.y1 - fl.y0);
        const iou = (oX * oY) / (lArea + flArea - (oX * oY));
        return iou > 0.80;
      });
      if (!isNearDup) layouts.push(l);
    });

    if (layouts.length === 0 && allWords.length === 0) return null;

    // Assign words to their enclosing layout box
    const unassignedWords = [];
    if (allWords.length > 0) {
      allWords.forEach(w => {
        const wBox = w.bbox || w.coords;
        if (!Array.isArray(wBox) || wBox.length < 4) return;
        const wx0 = Number(wBox[0]);
        const wy0 = Number(wBox[1]);
        const wx1 = Number(wBox[2]);
        const wy1 = Number(wBox[3]);
        const cx = (wx0 + wx1) / 2;
        const cy = (wy0 + wy1) / 2;

        let bestLayout = null;
        let minArea = Infinity;

        for (const layout of layouts) {
          if (cx >= layout.x0 - 4 && cx <= layout.x1 + 4 && cy >= layout.y0 - 5 && cy <= layout.y1 + 5) {
            const area = (layout.x1 - layout.x0) * (layout.y1 - layout.y0);
            if (area < minArea) {
              minArea = area;
              bestLayout = layout;
            }
          }
        }

        if (bestLayout) {
          bestLayout.words.push({
            word: w.word || w.text || '',
            bbox: [wx0, wy0, wx1, wy1],
            confidence: typeof w.confidence === 'number' ? w.confidence : 0.98
          });
        } else {
          unassignedWords.push(w);
        }
      });
    }

    // Fallback layouts for unassigned words
    if (unassignedWords.length > 0) {
      const unassignedLines = [];
      unassignedWords.sort((a, b) => a.bbox[1] - b.bbox[1]);
      unassignedWords.forEach(w => {
        const [wx0, wy0, wx1, wy1] = w.bbox;
        const wcy = (wy0 + wy1) / 2;
        const match = unassignedLines.find(ul => Math.abs(ul.cy - wcy) < 14);
        if (match) {
          match.words.push(w);
          match.x0 = Math.min(match.x0, wx0);
          match.y0 = Math.min(match.y0, wy0);
          match.x1 = Math.max(match.x1, wx1);
          match.y1 = Math.max(match.y1, wy1);
          match.cy = (match.y0 + match.y1) / 2;
        } else {
          unassignedLines.push({
            x0: wx0, y0: wy0, x1: wx1, y1: wy1,
            cy: wcy,
            words: [w]
          });
        }
      });

      unassignedLines.forEach((ul, ulIdx) => {
        layouts.push({
          id: `layout-p${pageNum}-unassigned-${ulIdx + 1}`,
          type: (ul.y0 >= maxY * 0.85) ? 'footer' : 'plain text',
          x0: ul.x0,
          y0: ul.y0,
          x1: ul.x1,
          y1: ul.y1,
          confidence: 0.95,
          text: ul.words.map(w => w.word || w.text || '').join(' '),
          cells: null,
          words: ul.words.map(w => ({
            word: w.word || w.text || '',
            bbox: w.bbox,
            confidence: typeof w.confidence === 'number' ? w.confidence : 0.98
          })),
          rawLayout: null
        });
      });
    }

    // Keep active layouts
    const activeLayouts = [];
    layouts.forEach(l => {
      if ((!l.words || l.words.length === 0) && (!l.cells || l.cells.length === 0) && (!l.text || !l.text.trim())) return;
      if (l.words && l.words.length > 0) {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        l.words.forEach(w => {
          if (w.bbox[0] < minX) minX = w.bbox[0];
          if (w.bbox[1] < minY) minY = w.bbox[1];
          if (w.bbox[2] > maxX) maxX = w.bbox[2];
          if (w.bbox[3] > maxY) maxY = w.bbox[3];
        });
        l.x0 = minX;
        l.y0 = minY;
        l.x1 = maxX;
        l.y1 = maxY;
      }
      activeLayouts.push(l);
    });
    if (activeLayouts.length === 0) return null;

    // Sort layouts in natural reading order
    const sortedLayouts = this._sortLayoutsReadingOrder(activeLayouts);

    // Group layouts: Merge consecutive plain text layouts together!
    const layoutGroups = [];
    let currentPlainTextGroup = null;

    for (const layout of sortedLayouts) {
      const lType = (layout.type || 'plain text').toLowerCase();
      const isTable = this._isLayoutTableOrForm(layout);
      const isTitle = !isTable && (lType.includes('title') || lType.includes('header') || lType.includes('heading'));
      const isAbandon = !isTable && lType.includes('abandon');

      if (!isTable && !isTitle && !isAbandon) {
        // Check if layout is in the same column as the previous layout in currentPlainTextGroup
        let isSameColumn = true;
        if (currentPlainTextGroup && currentPlainTextGroup.layouts.length > 0) {
          const prevLayout = currentPlainTextGroup.layouts[currentPlainTextGroup.layouts.length - 1];
          const prevMidX = (prevLayout.x0 + prevLayout.x1) / 2;
          const currMidX = (layout.x0 + layout.x1) / 2;
          const prevW = prevLayout.x1 - prevLayout.x0;
          const currW = layout.x1 - layout.x0;

          // If jumping across columns (e.g. Left column to Right column):
          if (Math.abs(prevMidX - currMidX) > 80 && prevW < maxX * 0.65 && currW < maxX * 0.65) {
            isSameColumn = false;
          }
        }

        if (!currentPlainTextGroup || !isSameColumn) {
          currentPlainTextGroup = {
            type: 'plain text',
            layouts: [layout]
          };
          layoutGroups.push(currentPlainTextGroup);
        } else {
          currentPlainTextGroup.layouts.push(layout);
        }
      } else {
        currentPlainTextGroup = null;
        layoutGroups.push({
          type: isTable ? 'table' : (isTitle ? 'title' : 'abandon'),
          layouts: [layout]
        });
      }
    }

    const pageResultItems = [];
    let sentenceGlobalIndex = startSentenceIndex;
    let tableIndexCounter = 1;

    for (const group of layoutGroups) {
      // 1. TABLE:
      if (group.type === 'table') {
        const layout = group.layouts[0];
        const tableIndex = (layout.table_index !== undefined) ? layout.table_index : tableIndexCounter++;
        const currentTableId = layout.id || `table-p${pageNum}-${tableIndex}`;
        const tWords = layout.words || [];

        let detectedType = 'A_MATRIX';
        const Classifier = (typeof TableClassifier !== 'undefined')
          ? TableClassifier
          : (typeof require !== 'undefined' ? (() => { try { return require('./table-classifier.js'); } catch(e) { return null; } })() : null);

        if (tWords.length > 0) {
          const validWords = tWords.filter(w => {
            const b = w.bbox || w.coords;
            return Array.isArray(b) && b.length >= 4;
          });

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
          const sortedTableCells = [];
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
                sortedTableCells.push({
                  row: rIdx,
                  col: cIdx,
                  text: text,
                  rawCoords: [cx0, cy0, cx1, cy1],
                  confidence: layout.confidence || 0.98,
                  words: wGroup
                });
              }
            });
          });

          // Check if table classifier classifies this table
          if (Classifier && typeof Classifier.classifyStructure === 'function') {
            try {
              const classification = Classifier.classifyStructure({
                cells: sortedTableCells.map((c, i) => ({
                  id: `c_${i}`,
                  row: c.row,
                  col: c.col,
                  text: c.text,
                  rawCoords: c.rawCoords
                }))
              });
              if (classification && classification.type) {
                detectedType = classification.type;
              }
            } catch (e) {
              console.warn('[BboxParser] Table classification failed:', e);
            }
          }

          // If TableClassifier can process the reading order & IDs for these exact cells:
          if (Classifier && typeof Classifier.processTable === 'function') {
            const tableObj = {
              id: currentTableId,
              table_id: currentTableId,
              cells: sortedTableCells,
              forced_type: detectedType
            };
            const tRes = Classifier.processTable(tableObj, pageNum, sentenceGlobalIndex, tableIndex);
            if (tRes && tRes.items && tRes.items.length > 0) {
              tRes.items.forEach(it => {
                pageResultItems.push({
                  ...it,
                  page: pageNum,
                  layoutProcessed: true,
                  layout_id: currentTableId
                });
              });
              sentenceGlobalIndex = tRes.nextSentenceNumber;
              continue;
            }
          }

          // 4. Extract headers for A_MATRIX semantic speech
          const rowHeadersMap = new Map();
          const colHeadersMap = new Map();
          sortedTableCells.filter(c => c.row === 0).forEach(c => colHeadersMap.set(c.col, c.text));
          sortedTableCells.filter(c => c.col === 0).forEach(c => rowHeadersMap.set(c.row, c.text));

          // 5. Emit EVERY cell as an individual BBox
          sortedTableCells.forEach((cell, cellIdx) => {
            const sId = sentenceGlobalIndex++;
            const tOrderId = cellIdx + 1;

            let fullText = cell.text;
            if (detectedType === 'A_MATRIX') {
              if (cell.row === 0) {
                fullText = colHeadersMap.get(cell.col) || cell.text;
              } else if (cell.col === 0) {
                fullText = rowHeadersMap.get(cell.row) || cell.text;
              } else {
                const rowInfo = rowHeadersMap.get(cell.row) || `${cell.row + 1}`;
                const colInfo = colHeadersMap.get(cell.col) || `${cell.col + 1}`;
                fullText = `Satır ${rowInfo}, Sütun ${colInfo}, Değer ${cell.text}`;
              }
            }

            pageResultItems.push({
              id: `${layout.id}-c${cellIdx + 1}-s${sId}`,
              id_display: sId,
              sentence_id: sId,
              page: pageNum,
              text: cell.text,
              fullSentenceText: fullText,
              bbox: [Math.round(cell.rawCoords[0]), Math.round(cell.rawCoords[1]), Math.round(cell.rawCoords[2]), Math.round(cell.rawCoords[3])],
              rawBox: [Math.round(cell.rawCoords[0]), Math.round(cell.rawCoords[1]), Math.round(cell.rawCoords[2]), Math.round(cell.rawCoords[3])],
              rawCoords: [Math.round(cell.rawCoords[0]), Math.round(cell.rawCoords[1]), Math.round(cell.rawCoords[2]), Math.round(cell.rawCoords[3])],
              coordType: 'abs_points',
              category: 'Table Cell',
              confidence: cell.confidence || layout.confidence || 0.98,
              table_id: currentTableId,
              table_type: detectedType,
              table_order_id: tOrderId,
              table_order_label: `T${tOrderId}`,
              layoutProcessed: true,
              layout_id: currentTableId
            });
          });

          continue;
        }

        // Fallback raw cells
        const rawCells = layout.cells || [];
        if (rawCells.length > 0) {
          rawCells.forEach((c, cIdx) => {
            const cBox = c.abs_coords || c.cell_coords || c.bbox || [layout.x0, layout.y0, layout.x1, layout.y1];
            const cText = (c.text || '').trim() || `Hücre #${cIdx + 1}`;
            const sId = sentenceGlobalIndex++;
            pageResultItems.push({
              id: `${currentTableId}-c${cIdx + 1}`,
              id_display: sId,
              sentence_id: sId,
              page: pageNum,
              text: cText,
              fullSentenceText: cText,
              bbox: [Math.round(cBox[0]), Math.round(cBox[1]), Math.round(cBox[2]), Math.round(cBox[3])],
              rawBox: [Math.round(cBox[0]), Math.round(cBox[1]), Math.round(cBox[2]), Math.round(cBox[3])],
              rawCoords: [Math.round(cBox[0]), Math.round(cBox[1]), Math.round(cBox[2]), Math.round(cBox[3])],
              coordType: 'abs_points',
              category: 'Table Cell',
              confidence: c.confidence || layout.confidence || 0.98,
              table_id: currentTableId,
              table_type: detectedType,
              table_order_id: cIdx + 1,
              table_order_label: `T${cIdx + 1}`,
              layoutProcessed: true,
              layout_id: currentTableId
            });
          });
          continue;
        }
        continue;
      }

      // 2. ABANDON LAYOUT:
      if (group.type === 'abandon') {
        for (const layout of group.layouts) {
          const lWords = layout.words || [];
          let layoutLines = (lWords.length > 0) ? this._extractLinesFromWords(lWords) : [];
          if (layoutLines.length === 0) {
            const lText = (layout.text || 'Abandon').trim();
            layoutLines = [{
              text: lText,
              rawCoords: [layout.x0, layout.y0, layout.x1, layout.y1]
            }];
          }
          layoutLines.forEach((ln, lnIdx) => {
            const sId = sentenceGlobalIndex++;
            pageResultItems.push({
              id: `${layout.id}-ab-${sId}-${lnIdx + 1}`,
              id_display: sId,
              sentence_id: sId,
              page: pageNum,
              text: ln.text,
              fullSentenceText: ln.text,
              bbox: [Math.round(ln.rawCoords[0]), Math.round(ln.rawCoords[1]), Math.round(ln.rawCoords[2]), Math.round(ln.rawCoords[3])],
              rawBox: [Math.round(ln.rawCoords[0]), Math.round(ln.rawCoords[1]), Math.round(ln.rawCoords[2]), Math.round(ln.rawCoords[3])],
              rawCoords: [Math.round(ln.rawCoords[0]), Math.round(ln.rawCoords[1]), Math.round(ln.rawCoords[2]), Math.round(ln.rawCoords[3])],
              coordType: 'abs_points',
              category: 'Abandon',
              confidence: layout.confidence || 0.95,
              layoutProcessed: true,
              layout_id: layout.id
            });
          });
        }
        continue;
      }

      // 3. TITLE LAYOUT:
      if (group.type === 'title') {
        for (const layout of group.layouts) {
          const lWords = layout.words || [];
          let layoutLines = (lWords.length > 0) ? this._extractLinesFromWords(lWords) : [];
          if (layoutLines.length === 0) {
            const lText = (layout.text || 'Başlık').trim();
            if (lText) {
              layoutLines = [{
                text: lText,
                rawCoords: [layout.x0, layout.y0, layout.x1, layout.y1]
              }];
            }
          }
          if (layoutLines.length === 0) continue;

          const fullTitleText = layoutLines.map(ln => ln.text).join(' ').trim();
          const sId = sentenceGlobalIndex++;
          layoutLines.forEach((ln, lnIdx) => {
            pageResultItems.push({
              id: `${layout.id}-title-${sId}-${lnIdx + 1}`,
              id_display: sId,
              sentence_id: sId,
              page: pageNum,
              text: ln.text,
              fullSentenceText: fullTitleText,
              bbox: [Math.round(ln.rawCoords[0]), Math.round(ln.rawCoords[1]), Math.round(ln.rawCoords[2]), Math.round(ln.rawCoords[3])],
              rawBox: [Math.round(ln.rawCoords[0]), Math.round(ln.rawCoords[1]), Math.round(ln.rawCoords[2]), Math.round(ln.rawCoords[3])],
              rawCoords: [Math.round(ln.rawCoords[0]), Math.round(ln.rawCoords[1]), Math.round(ln.rawCoords[2]), Math.round(ln.rawCoords[3])],
              coordType: 'abs_points',
              category: 'Title',
              confidence: layout.confidence || 0.98,
              layoutProcessed: true,
              layout_id: layout.id
            });
          });
        }
        continue;
      }

      // 4. PLAIN TEXT (Merge consecutive plain text layouts and process together):
      const allGroupLines = [];
      for (const layout of group.layouts) {
        const lWords = layout.words || [];
        let layoutLines = (lWords.length > 0) ? this._extractLinesFromWords(lWords) : [];
        if (layoutLines.length === 0) {
          const lText = (layout.text || '').trim();
          if (lText) {
            layoutLines = [{
              text: lText,
              rawCoords: [layout.x0, layout.y0, layout.x1, layout.y1]
            }];
          }
        }
        layoutLines.forEach(ln => {
          ln.layout_id = layout.id;
          ln.layout_confidence = layout.confidence;
          allGroupLines.push(ln);
        });
      }

      if (allGroupLines.length === 0) continue;

      // Stitch lines that lie on the same vertical baseline across split layout/column detections
      const processedGroupLines = this._stitchSameBaselineLines(allGroupLines);

      const { text: preprocessedText, processedLines } = (Splitter && typeof Splitter.preprocessLines === 'function')
        ? Splitter.preprocessLines(processedGroupLines, 0.9, [])
        : { text: processedGroupLines.map(ln => ln.text).join(' '), processedLines: processedGroupLines };

      if (!preprocessedText.trim()) continue;

      const sentences = (Splitter && typeof Splitter.splitParagraphIntoSentences === 'function')
        ? Splitter.splitParagraphIntoSentences(preprocessedText)
        : [{ text: preprocessedText, start: 0, end: preprocessedText.length }];

      const lineIndices = [];
      let searchIdx = 0;
      processedLines.forEach(ln => {
        let s = preprocessedText.indexOf(ln.text, searchIdx);
        if (s === -1) s = preprocessedText.indexOf(ln.text);
        if (s === -1) s = 0;
        const e = s + ln.text.length;
        searchIdx = e;
        lineIndices.push({ text: ln.text, start: s, end: e, bbox: ln.bbox || ln.rawCoords, layout_id: ln.layout_id, layout_confidence: ln.layout_confidence });
      });

      if (Splitter && typeof Splitter.mapSentencesToLines === 'function') {
        Splitter.mapSentencesToLines(sentences, lineIndices);
      }

      for (const s of sentences) {
        if (Splitter && typeof Splitter.calculateSentenceBBoxes === 'function') {
          Splitter.calculateSentenceBBoxes(s);
        }
      }

      if (Splitter && typeof Splitter.fixTinyLeadingBBoxes === 'function') {
        Splitter.fixTinyLeadingBBoxes(sentences);
      }

      const cleanedSentences = (Splitter && typeof Splitter.cleanSentences === 'function')
        ? Splitter.cleanSentences(sentences)
        : sentences;

      for (const s of cleanedSentences) {
        const sId = sentenceGlobalIndex++;
        const sText = (s.text || '').trim();
        const sBBoxes = s.bboxes || [];
        const sTexts = s.bbox_texts || [];

        if (sBBoxes.length === 0) {
          const firstLine = allGroupLines[0];
          pageResultItems.push({
            id: `bbox-p${pageNum}-s${sId}`,
            id_display: sId,
            sentence_id: sId,
            page: pageNum,
            text: sText,
            fullSentenceText: sText,
            bbox: firstLine.rawCoords,
            rawBox: firstLine.rawCoords,
            rawCoords: firstLine.rawCoords,
            coordType: 'abs_points',
            category: 'Plain Text',
            confidence: 0.98,
            layoutProcessed: true
          });
        } else {
          sBBoxes.forEach((bb, bi) => {
            const lineBoxText = (sTexts[bi] || sText).trim();
            pageResultItems.push({
              id: `bbox-p${pageNum}-s${sId}-l${bi + 1}`,
              id_display: sId,
              sentence_id: sId,
              page: pageNum,
              text: lineBoxText,
              fullSentenceText: sText,
              bbox: [Math.round(bb[0]), Math.round(bb[1]), Math.round(bb[2]), Math.round(bb[3])],
              rawBox: [Math.round(bb[0]), Math.round(bb[1]), Math.round(bb[2]), Math.round(bb[3])],
              rawCoords: [Math.round(bb[0]), Math.round(bb[1]), Math.round(bb[2]), Math.round(bb[3])],
              coordType: 'abs_points',
              category: 'Plain Text',
              confidence: 0.98,
              layoutProcessed: true
            });
          });
        }
      }
    }

    if (pageResultItems.length > 0) {
      pageResultItems.nextSentenceIndex = sentenceGlobalIndex;
      return pageResultItems;
    }
    return null;
  }

  /**
   * Sort layout regions in multi-column natural Turkish reading order:
   * 1. Top headers / titles
   * 2. Left column layouts (top to bottom)
   * 3. Right column layouts (top to bottom)
   * 4. Footers / bottom notes
   */
  static _sortLayoutsReadingOrder(layouts) {
    if (!layouts || layouts.length <= 1) return layouts;

    const valid = layouts; // Keep all layouts including abandon!
    if (valid.length === 0) return layouts;

    let maxX = 0, maxY = 0;
    valid.forEach(l => {
      if (l.x1 > maxX) maxX = l.x1;
      if (l.y1 > maxY) maxY = l.y1;
    });
    maxX = Math.max(maxX, 100);
    maxY = Math.max(maxY, 100);

    const midX = maxX * 0.50;
    const bodyLayouts = valid.filter(l => l.y0 > maxY * 0.10 && l.y1 < maxY * 0.90 && l.type !== 'table');

    let leftCount = 0, rightCount = 0, spanningCount = 0;
    bodyLayouts.forEach(l => {
      const w = l.x1 - l.x0;
      if (w > maxX * 0.55 || (l.x0 < midX - 50 && l.x1 > midX + 50)) {
        spanningCount++;
      } else if (l.x1 <= midX + 60) {
        leftCount++;
      } else if (l.x0 >= midX - 60) {
        rightCount++;
      } else {
        spanningCount++;
      }
    });

    const isTwoColumn = (leftCount >= 2 && rightCount >= 2 && spanningCount <= (leftCount + rightCount) * 0.3);

    const headers = [];
    const footers = [];
    const body = [];
    const leftCol = [];
    const rightCol = [];

    valid.forEach(l => {
      const midLayoutX = (l.x0 + l.x1) / 2;
      const w = l.x1 - l.x0;

      // Header: ONLY wide top banners across the whole page
      if (w > maxX * 0.50 && l.y0 <= maxY * 0.12) {
        headers.push(l);
      }
      // Footer: bottom region
      else if (l.y0 >= maxY * 0.91 || l.type.includes('footer')) {
        footers.push(l);
      }
      // Single-column body:
      else if (!isTwoColumn) {
        body.push(l);
      }
      // Two-column Left Column:
      else if (midLayoutX < midX) {
        leftCol.push(l);
      }
      // Two-column Right Column:
      else {
        rightCol.push(l);
      }
    });

    headers.sort((a, b) => {
      if (Math.abs(a.y0 - b.y0) > 15) return a.y0 - b.y0;
      return a.x0 - b.x0;
    });

    footers.sort((a, b) => a.y0 - b.y0);

    if (!isTwoColumn) {
      body.sort((a, b) => a.y0 - b.y0);
      return [...headers, ...body, ...footers];
    } else {
      leftCol.sort((a, b) => a.y0 - b.y0);
      rightCol.sort((a, b) => a.y0 - b.y0);
      return [...headers, ...leftCol, ...rightCol, ...footers];
    }
  }

  /**
   * Helper to parse stringified numbers: "[54.2, 72.1, 540.3, 95.4]" -> [54.2, 72.1, 540.3, 95.4]
   */
  static _parseStringToNumbers(str) {
    if (!str) return [];
    const matches = str.match(/[-+]?[0-9]*\.?[0-9]+/g);
    return matches ? matches.map(Number) : [];
  }

  /**
   * Helper to flatten any object/array to array of numbers
   */
  static _parseToNumberArray(val) {
    if (!val) return [];
    if (typeof val === 'string') return this._parseStringToNumbers(val);
    if (Array.isArray(val)) {
      return val.flat(Infinity).map(Number).filter(n => !isNaN(n));
    }
    if (typeof val === 'object') {
      return Object.values(val).map(Number).filter(n => !isNaN(n));
    }
    return [];
  }
}

if (typeof window !== 'undefined') {
  window.BBoxParser = BBoxParser;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = BBoxParser;
}
