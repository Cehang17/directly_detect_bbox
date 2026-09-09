/**
 * BBoxOverlayManager - Handles rendering, interactive selection, resizing handles,
 * and mouse-draw creation matching SignForDeaf PDF editor.
 */

class BBoxOverlayManager {
  constructor() {
    this.bboxesByPage = new Map(); // pageNum -> Array<BBoxItem>
    this.activeBBoxId = null;
    this.onBBoxSelectCallback = null;
    this.onBBoxChangeCallback = null;
    this.onNewBBoxDrawnCallback = null;
    
    // Visibility & Mode State
    this.showAllSentences = true; // true = "All Sentence", false = "Just Selected"
    this.drawMode = false;        // true = "Draw Mode On", false = "Draw Mode Off"
    
    // Page Viewport Cache for active pages
    this.pageRenderCache = new Map(); // pageNum -> { pageWrapper, pageWidth, pageHeight, origSize }

    this.isDragging = false;
    this.isResizing = false;
    this.resizeHandleType = null;
    this.dragStartPos = { x: 0, y: 0 };
    this.elementStartBounds = { left: 0, top: 0, width: 0, height: 0 };
    this.currentDragItem = null;
    this.currentDragPageNum = null;

    this._setupGlobalMouseEvents();
  }

  setData(bboxes) {
    this.bboxesByPage.clear();
    const seenIds = new Set();
    let autoCounter = 1;
    (bboxes || []).forEach((item, idx) => {
      if (!item.id || seenIds.has(String(item.id))) {
        item.id = `bbox-p${item.page || 1}-${idx + 1}-${Date.now()}-${autoCounter++}-${Math.random().toString(36).substr(2, 6)}`;
      }
      seenIds.add(String(item.id));
      const pageNum = parseInt(item.page, 10) || 1;
      if (!this.bboxesByPage.has(pageNum)) {
        this.bboxesByPage.set(pageNum, []);
      }
      this.bboxesByPage.get(pageNum).push(item);
    });
  }

  setBBoxes(bboxes) {
    this.setData(bboxes);
    this.reRenderAllPages();
  }

  getAllItems() {
    const all = [];
    for (const items of this.bboxesByPage.values()) {
      all.push(...items);
    }
    return all;
  }

  onSelect(callback) {
    this.onBBoxSelectCallback = callback;
  }

  onChange(callback) {
    this.onBBoxChangeCallback = callback;
  }

  onNewDrawn(callback) {
    this.onNewBBoxDrawnCallback = callback;
  }

  setDrawMode(enabled) {
    this.drawMode = enabled;
    document.querySelectorAll('.pdf-page-wrapper').forEach(wrapper => {
      wrapper.classList.toggle('draw-mode', enabled);
    });
  }

  setShowAllSentences(showAll) {
    this.showAllSentences = showAll;
    this.updateVisibility();
  }

  updateVisibility() {
    document.querySelectorAll('.bbox-rect').forEach(el => {
      const isThisActive = el.dataset.id === String(this.activeBBoxId);
      if (this.showAllSentences) {
        el.style.display = 'block';
      } else {
        el.style.display = isThisActive ? 'block' : 'none';
      }
    });
  }

  /**
   * Render overlay bounding boxes on a specific page
   */
  renderPageOverlay(pageWrapper, pageNum, pageWidth, pageHeight, pdfPageOriginalSize) {
    this.pageRenderCache.set(pageNum, { pageWrapper, pageWidth, pageHeight, pdfPageOriginalSize });

    pageWrapper.querySelectorAll('.bbox-overlay-layer').forEach(el => el.remove());

    const overlayLayer = document.createElement('div');
    overlayLayer.className = 'bbox-overlay-layer';
    pageWrapper.appendChild(overlayLayer);

    // Setup interactive drawing listener on wrapper
    this._attachDrawListeners(pageWrapper, pageNum);

    const items = this.bboxesByPage.get(pageNum) || [];
    if (items.length === 0) return;

    // Detect max extents across items on this page
    let maxPageX = 0;
    let maxPageY = 0;
    items.forEach(it => {
      const [x0, y0, x1, y1] = it.rawCoords || [0, 0, 0, 0];
      if (x1 > maxPageX) maxPageX = x1;
      if (y1 > maxPageY) maxPageY = y1;
    });

    const origW = (pdfPageOriginalSize && pdfPageOriginalSize.width) || 595.28;
    const origH = (pdfPageOriginalSize && pdfPageOriginalSize.height) || 841.89;

    let refW = origW;
    let refH = origH;

    if (maxPageX > origW * 1.25 || maxPageY > origH * 1.25) {
      const aspect = origW / origH;
      const dpi150W = origW * (150 / 72); // ~1240
      const dpi200W = origW * (200 / 72); // ~1654
      const dpi300W = origW * (300 / 72); // ~2480

      if (maxPageX <= dpi200W * 1.02 && maxPageX > dpi150W * 0.95) {
        refW = dpi200W;
        refH = origH * (200 / 72);
      } else if (maxPageX <= dpi150W * 1.02 && maxPageX > origW * 1.25) {
        refW = dpi150W;
        refH = origH * (150 / 72);
      } else if (maxPageX > dpi200W && maxPageX <= dpi300W * 1.05) {
        refW = dpi300W;
        refH = origH * (300 / 72);
      } else {
        refW = Math.max(maxPageX * 1.06, maxPageY * aspect);
        refH = refW / aspect;
      }
    }

    const scaleX = pageWidth / refW;
    const scaleY = pageHeight / refH;

    this.pageRenderCache.set(pageNum, { pageWrapper, pageWidth, pageHeight, pdfPageOriginalSize, refW, refH, scaleX, scaleY });

    items.forEach((item, idx) => {
      if (!item.id) {
        item.id = `bbox-p${pageNum}-${idx + 1}-${Math.random().toString(36).substr(2, 6)}`;
      }
      const boxElem = document.createElement('div');
      const isActive = Boolean(this.activeBBoxId) && String(this.activeBBoxId) === String(item.id);
      boxElem.className = `bbox-rect ${isActive ? 'active' : ''}`;
      boxElem.dataset.id = item.id;
      const sentenceIdVal = (item.id_display !== undefined && item.id_display !== null)
        ? item.id_display
        : ((item.sentence_id !== undefined && item.sentence_id !== null) ? item.sentence_id : item.index);
      boxElem.dataset.sentenceId = String(sentenceIdVal);

      // Visibility filter
      if (!this.showAllSentences && !isActive) {
        boxElem.style.display = 'none';
      }

      const [x0, y0, x1, y1] = item.rawCoords || [0, 0, 0, 0];
      const yOrigin = item.yOrigin || 'top';
      let left = 0, top = 0, width = 0, height = 0;

      if (item.coordType === 'norm_0_1') {
        left = x0 * pageWidth;
        width = (x1 - x0) * pageWidth;
        top = yOrigin === 'bottom' ? (1.0 - y1) * pageHeight : y0 * pageHeight;
        height = (y1 - y0) * pageHeight;
      } else if (item.coordType === 'norm_0_1000') {
        left = (x0 / 1000) * pageWidth;
        width = ((x1 - x0) / 1000) * pageWidth;
        top = yOrigin === 'bottom' ? (1.0 - (y1 / 1000)) * pageHeight : (y0 / 1000) * pageHeight;
        height = ((y1 - y0) / 1000) * pageHeight;
      } else if (item.coordType === 'pdf_points' || (refW <= origW * 1.25 && (x1 <= origW * 1.25 && y1 <= origH * 1.25))) {
        // Direct PDF points (72 DPI standard)
        const pdfScaleX = pageWidth / origW;
        const pdfScaleY = pageHeight / origH;
        left = x0 * pdfScaleX;
        width = (x1 - x0) * pdfScaleX;
        top = yOrigin === 'bottom' ? (origH - y1) * pdfScaleY : y0 * pdfScaleY;
        height = (y1 - y0) * pdfScaleY;
      } else {
        // High DPI (e.g. 200/300 DPI image pixels from Surya OCR / DocLayout-YOLO)
        left = x0 * scaleX;
        width = (x1 - x0) * scaleX;
        top = yOrigin === 'bottom' ? (refH - y1) * scaleY : y0 * scaleY;
        height = (y1 - y0) * scaleY;
      }

      width = Math.max(width, 8);
      height = Math.max(height, 8);

      boxElem.style.left = `${Math.round(left)}px`;
      boxElem.style.top = `${Math.round(top)}px`;
      boxElem.style.width = `${Math.round(width)}px`;
      boxElem.style.height = `${Math.round(height)}px`;

      // Red ID badge at the top-right / right side
      const badge = document.createElement('span');
      badge.className = 'bbox-tag-badge';
      badge.textContent = sentenceIdVal;
      boxElem.appendChild(badge);

      if (item.table_type) {
        const tableBadge = document.createElement('span');
        tableBadge.className = 'bbox-table-type-badge';
        tableBadge.textContent = item.table_type;
        tableBadge.title = `Tablo Tipi: ${item.table_type} | Okuma Sırası: #${item.table_order_id || 1}`;
        boxElem.appendChild(tableBadge);
      }

      // 8 Resize Handles (nw, n, ne, e, se, s, sw, w)
      ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'].forEach(dir => {
        const handle = document.createElement('div');
        handle.className = `bbox-handle ${dir}`;
        handle.dataset.dir = dir;
        boxElem.appendChild(handle);
      });

      // Box click & drag listeners
      boxElem.addEventListener('mousedown', (e) => {
        if (this.drawMode) return;
        e.stopPropagation();

        if (e.target.classList.contains('bbox-handle')) {
          // Resize start
          this.isResizing = true;
          this.resizeHandleType = e.target.dataset.dir;
          this.currentDragItem = item;
          this.currentDragPageNum = pageNum;
          this.dragStartPos = { x: e.clientX, y: e.clientY };
          this.elementStartBounds = {
            left: parseFloat(boxElem.style.left),
            top: parseFloat(boxElem.style.top),
            width: parseFloat(boxElem.style.width),
            height: parseFloat(boxElem.style.height)
          };
        } else {
          // Move / select start
          this.selectBBox(item.id, true);
          this.isDragging = true;
          this.currentDragItem = item;
          this.currentDragPageNum = pageNum;
          this.dragStartPos = { x: e.clientX, y: e.clientY };
          this.elementStartBounds = {
            left: parseFloat(boxElem.style.left),
            top: parseFloat(boxElem.style.top),
            width: parseFloat(boxElem.style.width),
            height: parseFloat(boxElem.style.height)
          };
        }
      });

      overlayLayer.appendChild(boxElem);
    });
  }

  /**
   * Set active bounding box and sync
   */
  selectBBox(bboxId, triggerCallback = false) {
    this.activeBBoxId = bboxId;

    if (!bboxId) {
      document.querySelectorAll('.bbox-rect').forEach(el => {
        el.classList.remove('active', 'same-sentence');
      });
      return null;
    }

    let foundItem = null;
    for (const items of this.bboxesByPage.values()) {
      const match = items.find(it => String(it.id) === String(bboxId));
      if (match) {
        foundItem = match;
        break;
      }
    }

    const sId = foundItem
      ? String((foundItem.id_display !== undefined && foundItem.id_display !== null)
          ? foundItem.id_display
          : ((foundItem.sentence_id !== undefined && foundItem.sentence_id !== null) ? foundItem.sentence_id : foundItem.index))
      : null;

    document.querySelectorAll('.bbox-rect').forEach(el => {
      const isExactMatch = Boolean(bboxId) && el.dataset.id === String(bboxId);
      const isSentenceMatch = Boolean(sId) && el.dataset.sentenceId === sId;

      el.classList.toggle('active', isExactMatch);
      el.classList.toggle('same-sentence', isSentenceMatch && !isExactMatch);

      if (isExactMatch && foundItem) {
        let badge = el.querySelector('.bbox-table-type-badge');
        if (foundItem.table_type) {
          if (!badge) {
            badge = document.createElement('span');
            badge.className = 'bbox-table-type-badge';
            el.appendChild(badge);
          }
          badge.textContent = foundItem.table_type;
          badge.title = `Tablo Tipi: ${foundItem.table_type} | Okuma Sırası: #${foundItem.table_order_id || 1}`;
          badge.style.display = '';
        } else if (badge) {
          badge.remove();
        }
      } else {
        const badge = el.querySelector('.bbox-table-type-badge');
        if (badge) {
          badge.style.display = '';
        }
      }

      if (!this.showAllSentences) {
        el.style.display = (isExactMatch || isSentenceMatch) ? 'block' : 'none';
      }
    });

    if (foundItem && triggerCallback && this.onBBoxSelectCallback) {
      this.onBBoxSelectCallback(foundItem);
    }

    return foundItem;
  }

  /**
   * Remove a bbox and shift/decrement all subsequent IDs
   */
  removeItem(bboxId) {
    let removed = false;
    for (const [pageNum, items] of this.bboxesByPage.entries()) {
      const idx = items.findIndex(it => String(it.id) === String(bboxId));
      if (idx !== -1) {
        items.splice(idx, 1);
        removed = true;
        break;
      }
    }

    if (removed) {
      // Re-index all remaining items across pages sequentially
      this.reindexAllItems();

      // Re-render all active cached pages so all red badges update immediately
      for (const [pNum, cache] of this.pageRenderCache.entries()) {
        if (cache && cache.pageWrapper) {
          this.renderPageOverlay(cache.pageWrapper, pNum, cache.pageWidth, cache.pageHeight, cache.pdfPageOriginalSize);
        }
      }
      return true;
    }
    return false;
  }

  /**
   * Re-assign sequential sentence IDs to all items across all pages without resetting per page
   */
  /**
   * Re-assign sequential sentence IDs to all items across all pages without resetting per page
   */
  reindexAllItems() {
    let globalIndex = 0;
    let globalSentenceCounter = 0;
    let lastSentenceKey = null;

    const pageNumbers = Array.from(this.bboxesByPage.keys()).sort((a, b) => Number(a) - Number(b));
    for (const pNum of pageNumbers) {
      const items = this.bboxesByPage.get(pNum) || [];
      items.forEach((it, idx) => {
        it.index = globalIndex;
        globalIndex++;

        // Sibling line matching key: belongs to same page and sentence ID / group key
        const sKey = `${pNum}_${(it.sentence_group !== undefined && it.sentence_group !== null) ? it.sentence_group : ((it.sentence_id !== undefined && it.sentence_id !== null) ? it.sentence_id : (it.fullSentenceText || it.text || `item_${idx}`))}`;

        if (lastSentenceKey !== null && sKey !== lastSentenceKey) {
          globalSentenceCounter++;
        }
        lastSentenceKey = sKey;

        it.sentence_id = globalSentenceCounter;
        it.id_display = globalSentenceCounter;
        it.sentence_group = null;
      });
    }
  }

  /**
   * Re-render all cached pages in the DOM
   */
  reRenderAllPages() {
    for (const [pNum, cache] of this.pageRenderCache.entries()) {
      if (cache && cache.pageWrapper) {
        this.renderPageOverlay(cache.pageWrapper, pNum, cache.pageWidth, cache.pageHeight, cache.pdfPageOriginalSize);
      }
    }
  }

  /**
   * Move / Insert BBox at target ID and shift all subsequent items up by 1.
   * If a middle box in a multi-box sentence has its ID changed:
   *  - Prior sibling boxes before it keep their old ID.
   *  - Selected box and any following sibling boxes with the same ID change to the new ID.
   */
  reorderBBoxId(bboxId, targetIdStr) {
    const targetId = parseInt(targetIdStr, 10);
    if (isNaN(targetId)) return false;

    const allItems = this.getAllItems();
    const currentItem = allItems.find(it => String(it.id) === String(bboxId));
    if (!currentItem) return false;

    const sourcePageItems = this.bboxesByPage.get(currentItem.page) || [];
    const currentIdx = sourcePageItems.findIndex(it => String(it.id) === String(bboxId));
    if (currentIdx === -1) return false;

    const currentSentenceId = (currentItem.sentence_id !== undefined && currentItem.sentence_id !== null)
      ? currentItem.sentence_id
      : currentItem.id_display;

    // 1. Separate preceding sibling boxes (before currentIdx) and moving sibling boxes (currentIdx and after)
    const precGroupKey = `prec_grp_${Date.now()}_${Math.random()}`;
    for (let i = 0; i < currentIdx; i++) {
      const it = sourcePageItems[i];
      const itSId = (it.sentence_id !== undefined && it.sentence_id !== null) ? it.sentence_id : it.id_display;
      if (itSId === currentSentenceId) {
        it.sentence_group = precGroupKey;
      }
    }

    // Identify moving items: currentItem AND all sibling items that appear AFTER currentItem with the same sentence_id
    const movingGroupKey = `split_grp_${Date.now()}_${Math.random()}`;
    const movingItems = [currentItem];
    currentItem.sentence_group = movingGroupKey;

    for (let i = currentIdx + 1; i < sourcePageItems.length; i++) {
      const it = sourcePageItems[i];
      const itSId = (it.sentence_id !== undefined && it.sentence_id !== null) ? it.sentence_id : it.id_display;
      if (itSId === currentSentenceId) {
        it.sentence_group = movingGroupKey;
        movingItems.push(it);
      } else {
        break;
      }
    }

    // Remove moving items from their current page list
    movingItems.forEach(mIt => {
      const idx = sourcePageItems.findIndex(it => String(it.id) === String(mIt.id));
      if (idx !== -1) sourcePageItems.splice(idx, 1);
    });

    // Find the target location based on targetId (sentence ID / id_display)
    const remainingItems = this.getAllItems();
    
    // Find all items belonging to the target sentence ID
    const targetSiblings = remainingItems.filter(it => it.id_display === targetId || it.sentence_id === targetId);

    if (targetSiblings.length > 0) {
      const targetItem = targetSiblings[0];
      const targetPageNum = targetItem.page;
      const targetPageItems = this.bboxesByPage.get(targetPageNum) || [];

      movingItems.forEach(mIt => mIt.page = targetPageNum);

      // Insert right BEFORE the target sentence so movingItems take the exact targetId
      const firstIdx = targetPageItems.findIndex(it => String(it.id) === String(targetItem.id));
      const insertPos = (firstIdx !== -1) ? firstIdx : 0;
      targetPageItems.splice(insertPos, 0, ...movingItems);
    } else {
      // Target ID does not currently exist: find closest position or boundary
      const pageNumbers = Array.from(this.bboxesByPage.keys()).sort((a, b) => Number(a) - Number(b));
      if (pageNumbers.length === 0) {
        pageNumbers.push(1);
        this.bboxesByPage.set(1, []);
      }

      if (targetId <= 0) {
        // Insert at the very start of page 1
        const firstPage = pageNumbers[0];
        const firstPageItems = this.bboxesByPage.get(firstPage) || [];
        movingItems.forEach(mIt => mIt.page = firstPage);
        firstPageItems.unshift(...movingItems);
      } else {
        // Find closest preceding item with id_display < targetId
        let bestPrecedingItem = null;
        for (const it of remainingItems) {
          const itId = it.id_display !== undefined ? it.id_display : it.sentence_id;
          if (itId !== undefined && itId < targetId) {
            if (!bestPrecedingItem || itId > (bestPrecedingItem.id_display !== undefined ? bestPrecedingItem.id_display : bestPrecedingItem.sentence_id)) {
              bestPrecedingItem = it;
            }
          }
        }

        if (bestPrecedingItem) {
          const targetPageNum = bestPrecedingItem.page;
          const targetPageItems = this.bboxesByPage.get(targetPageNum) || [];
          movingItems.forEach(mIt => mIt.page = targetPageNum);
          const pIdx = targetPageItems.findIndex(it => String(it.id) === String(bestPrecedingItem.id));
          const insertPos = (pIdx !== -1) ? pIdx + 1 : targetPageItems.length;
          targetPageItems.splice(insertPos, 0, ...movingItems);
        } else {
          // Insert at the very end of the last page
          const lastPage = pageNumbers[pageNumbers.length - 1];
          const lastPageItems = this.bboxesByPage.get(lastPage) || [];
          movingItems.forEach(mIt => mIt.page = lastPage);
          lastPageItems.push(...movingItems);
        }
      }
    }

    // Re-index all items consecutively across pages
    this.reindexAllItems();
    this.reRenderAllPages();
    return true;
  }

  /**
   * Merge selected BBox into an existing sentence (Add Existed Sentence mode)
   */
  mergeToExistingSentence(bboxId, targetIdStr) {
    const targetId = parseInt(targetIdStr, 10);
    if (isNaN(targetId)) return false;

    const allItems = this.getAllItems();
    const currentItem = allItems.find(it => String(it.id) === String(bboxId));
    if (!currentItem) return false;

    const targetItem = allItems.find(it => (it.id_display === targetId || it.sentence_id === targetId) && String(it.id) !== String(bboxId));
    if (!targetItem) return false;

    // Both currentItem and targetItem belong to the same sentence now:
    const targetSentenceId = (targetItem.sentence_id !== undefined && targetItem.sentence_id !== null)
      ? targetItem.sentence_id
      : targetItem.id_display;

    currentItem.sentence_id = targetSentenceId;
    currentItem.id_display = targetItem.id_display;

    // Merge fullSentenceText: combine texts of target and current item
    const targetFullText = (targetItem.fullSentenceText || targetItem.text || '').trim();
    const currentText = (currentItem.text || '').trim();
    let joinedText = targetFullText;
    if (currentText && currentText !== 'Yeni Cümle / Paragraf') {
      if (!targetFullText) {
        joinedText = currentText;
      } else if (!targetFullText.includes(currentText)) {
        joinedText = `${targetFullText} ${currentText}`.trim();
      }
    }
    targetItem.fullSentenceText = joinedText;
    currentItem.fullSentenceText = joinedText;

    // Inherit table metadata if targetItem belongs to a table
    if (targetItem.table_id || targetItem.category === 'Table Cell') {
      currentItem.table_id = targetItem.table_id || null;
      currentItem.table_type = targetItem.table_type || null;
      currentItem.table_order_id = targetItem.table_order_id !== undefined ? targetItem.table_order_id : null;
      currentItem.table_order_label = targetItem.table_order_label || null;
      currentItem.category = 'Table Cell';
      currentItem.isTableCell = true;
    }

    // Place currentItem adjacent to targetItem on that page
    const sourcePageItems = this.bboxesByPage.get(currentItem.page) || [];
    const currIdx = sourcePageItems.findIndex(it => String(it.id) === String(bboxId));
    if (currIdx !== -1) sourcePageItems.splice(currIdx, 1);

    currentItem.page = targetItem.page;
    const targetPageItems = this.bboxesByPage.get(targetItem.page) || [];
    const tIdx = targetPageItems.findIndex(it => String(it.id) === String(targetItem.id));
    const insertPos = (tIdx !== -1) ? tIdx + 1 : targetPageItems.length;
    targetPageItems.splice(insertPos, 0, currentItem);

    // Unify fullSentenceText on ALL sibling items with targetSentenceId on that page
    targetPageItems.forEach(it => {
      const itSId = it.sentence_id !== undefined ? it.sentence_id : it.id_display;
      if (itSId === targetSentenceId) {
        it.fullSentenceText = joinedText;
      }
    });

    this.reindexAllItems();
    this.reRenderAllPages();
    return targetItem;
  }

  /**
   * Update text on current item
   */
  updateActiveItemData(newId, newText) {
    if (!this.activeBBoxId) return;

    for (const [pageNum, items] of this.bboxesByPage.entries()) {
      const match = items.find(it => String(it.id) === String(this.activeBBoxId));
      if (match) {
        if (newText !== undefined) {
          match.text = newText;
          match.fullSentenceText = newText;
          const sId = match.sentence_id !== undefined ? match.sentence_id : match.id_display;
          items.forEach(it => {
            const itSId = it.sentence_id !== undefined ? it.sentence_id : it.id_display;
            if (itSId === sId) {
              it.fullSentenceText = newText;
            }
          });
        }
        break;
      }
    }
  }

  /**
   * Interactive Drawing Mode setup
   */
  _attachDrawListeners(pageWrapper, pageNum) {
    if (pageWrapper._drawListenersAttached) {
      pageWrapper._drawPageNum = pageNum;
      return;
    }
    pageWrapper._drawListenersAttached = true;
    pageWrapper._drawPageNum = pageNum;

    let isDrawing = false;
    let drawStartX = 0;
    let drawStartY = 0;
    let previewBox = null;

    pageWrapper.addEventListener('mousedown', (e) => {
      if (!this.drawMode) return;
      if (e.button !== 0) return; // Only left click
      if (e.target.closest('.bbox-rect')) return;

      isDrawing = true;
      const rect = pageWrapper.getBoundingClientRect();
      drawStartX = e.clientX - rect.left;
      drawStartY = e.clientY - rect.top;

      pageWrapper.querySelectorAll('.draw-preview-box').forEach(b => b.remove());

      previewBox = document.createElement('div');
      previewBox.className = 'bbox-draw-preview';
      previewBox.style.left = `${drawStartX}px`;
      previewBox.style.top = `${drawStartY}px`;
      previewBox.style.width = '0px';
      previewBox.style.height = '0px';
      pageWrapper.appendChild(previewBox);

      const onMouseMove = (moveEv) => {
        if (!isDrawing || !previewBox) return;
        const curX = moveEv.clientX - rect.left;
        const curY = moveEv.clientY - rect.top;

        const left = Math.min(drawStartX, curX);
        const top = Math.min(drawStartY, curY);
        const width = Math.abs(curX - drawStartX);
        const height = Math.abs(curY - drawStartY);

        previewBox.style.left = `${left}px`;
        previewBox.style.top = `${top}px`;
        previewBox.style.width = `${width}px`;
        previewBox.style.height = `${height}px`;
      };

      const onMouseUp = (upEv) => {
        if (!isDrawing) return;
        isDrawing = false;
        window.removeEventListener('mousemove', onMouseMove);
        window.removeEventListener('mouseup', onMouseUp);

        if (previewBox && previewBox.parentNode) {
          const finalW = parseFloat(previewBox.style.width) || 0;
          const finalH = parseFloat(previewBox.style.height) || 0;
          const finalL = parseFloat(previewBox.style.left) || 0;
          const finalT = parseFloat(previewBox.style.top) || 0;
          previewBox.parentNode.removeChild(previewBox);
          previewBox = null;

          if (finalW >= 10 && finalH >= 8) {
            const curPage = pageWrapper._drawPageNum || pageNum;
            this._createNewBoxFromDrawnPixels(curPage, finalL, finalT, finalW, finalH);
          }
        }
      };

      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    });
  }

  _createNewBoxFromDrawnPixels(pageNum, left, top, width, height) {
    const cache = this.pageRenderCache.get(pageNum);
    if (!cache) return;

    const allItems = this.getAllItems();
    const newIdx = allItems.length + 1;
    const newId = `bbox-custom-${Date.now()}`;

    // Normalize coordinates back to reference space
    const origW = (cache.pdfPageOriginalSize && cache.pdfPageOriginalSize.width) || 595.28;
    const origH = (cache.pdfPageOriginalSize && cache.pdfPageOriginalSize.height) || 841.89;
    const dpi200W = origW * (200 / 72); // 1654
    const dpi200H = origH * (200 / 72); // 2338

    const scaleX = dpi200W / cache.pageWidth;
    const scaleY = dpi200H / cache.pageHeight;

    const x0 = Math.round(left * scaleX);
    const y0 = Math.round(top * scaleY);
    const x1 = Math.round((left + width) * scaleX);
    const y1 = Math.round((top + height) * scaleY);

    let maxSentenceId = -1;
    allItems.forEach(it => {
      const sId = it.sentence_id !== undefined && it.sentence_id !== null ? it.sentence_id : it.id_display;
      if (typeof sId === 'number' && !isNaN(sId) && sId > maxSentenceId) {
        maxSentenceId = sId;
      }
    });
    const nextSentenceId = maxSentenceId >= 0 ? maxSentenceId + 1 : (allItems.length + 1);

    // Check if newly drawn box is inside any existing table on this page
    const pageItems = (this.bboxesByPage.get(pageNum) || []);
    const tableItems = pageItems.filter(it => it.table_id || it.table_type || it.category === 'Table Cell' || (it.table_order_id !== null && it.table_order_id !== undefined));

    let matchedTable = null;
    if (tableItems.length > 0) {
      const tableMap = new Map();
      tableItems.forEach(it => {
        const tId = it.table_id || 'default_table';
        if (!tableMap.has(tId)) tableMap.set(tId, []);
        tableMap.get(tId).push(it);
      });

      for (const [tId, tblCells] of tableMap.entries()) {
        const allXs = tblCells.map(c => (c.rawCoords || c.bbox || [0,0,0,0])[0]).concat(tblCells.map(c => (c.rawCoords || c.bbox || [0,0,0,0])[2]));
        const allYs = tblCells.map(c => (c.rawCoords || c.bbox || [0,0,0,0])[1]).concat(tblCells.map(c => (c.rawCoords || c.bbox || [0,0,0,0])[3]));
        const tblMinX = Math.min(...allXs) - 15;
        const tblMaxX = Math.max(...allXs) + 15;
        const tblMinY = Math.min(...allYs) - 15;
        const tblMaxY = Math.max(...allYs) + 15;

        const boxMidX = (x0 + x1) / 2;
        const boxMidY = (y0 + y1) / 2;

        const isInside = (boxMidX >= tblMinX && boxMidX <= tblMaxX && boxMidY >= tblMinY && boxMidY <= tblMaxY) ||
                         (Math.max(x0, tblMinX) < Math.min(x1, tblMaxX) && Math.max(y0, tblMinY) < Math.min(y1, tblMaxY));

        if (isInside) {
          const sample = tblCells[0];
          const maxTOrder = Math.max(...tblCells.map(c => Number(c.table_order_id) || 0), 0);
          matchedTable = {
            table_id: tId !== 'default_table' ? tId : sample.table_id || `table-p${pageNum}-1`,
            table_type: sample.table_type || 'A_MATRIX',
            table_order_id: maxTOrder + 1,
            table_order_label: `T1.${maxTOrder + 1}`
          };
          break;
        }
      }
    }

    const newItem = {
      id: newId,
      index: newIdx,
      id_display: nextSentenceId,
      sentence_id: nextSentenceId,
      page: pageNum,
      text: "Yeni Cümle / Paragraf",
      fullSentenceText: "Yeni Cümle / Paragraf",
      rawCoords: [x0, y0, x1, y1],
      coordType: 'image_pixels',
      yOrigin: 'top',
      confidence: 1.0,
      category: matchedTable ? 'Table Cell' : 'plain text',
      ...(matchedTable ? {
        table_id: matchedTable.table_id,
        table_type: matchedTable.table_type,
        table_order_id: matchedTable.table_order_id,
        table_order_label: matchedTable.table_order_label,
        isTableCell: true
      } : {})
    };

    if (!this.bboxesByPage.has(pageNum)) {
      this.bboxesByPage.set(pageNum, []);
    }
    this.bboxesByPage.get(pageNum).push(newItem);

    // Re-render page
    this.renderPageOverlay(cache.pageWrapper, pageNum, cache.pageWidth, cache.pageHeight, cache.pdfPageOriginalSize);
    this.selectBBox(newId, true);

    if (this.onNewBBoxDrawnCallback) {
      this.onNewBBoxDrawnCallback(newItem);
    }
  }

  /**
   * Handle dragging and resizing of existing bounding boxes
   */
  _setupGlobalMouseEvents() {
    if (typeof window === 'undefined') return;
    window.addEventListener('mousemove', (e) => {
      if (!this.isDragging && !this.isResizing) return;
      if (!this.currentDragItem || !this.currentDragPageNum) return;

      const cache = this.pageRenderCache.get(this.currentDragPageNum);
      if (!cache) return;

      const boxElem = document.querySelector(`.bbox-rect[data-id="${this.currentDragItem.id}"]`);
      if (!boxElem) return;

      const dx = e.clientX - this.dragStartPos.x;
      const dy = e.clientY - this.dragStartPos.y;

      if (this.isDragging) {
        const newLeft = Math.max(0, Math.min(cache.pageWidth - this.elementStartBounds.width, this.elementStartBounds.left + dx));
        const newTop = Math.max(0, Math.min(cache.pageHeight - this.elementStartBounds.height, this.elementStartBounds.top + dy));
        boxElem.style.left = `${Math.round(newLeft)}px`;
        boxElem.style.top = `${Math.round(newTop)}px`;
      } else if (this.isResizing) {
        let { left, top, width, height } = this.elementStartBounds;
        const dir = this.resizeHandleType;

        if (dir.includes('e')) width = Math.max(10, width + dx);
        if (dir.includes('s')) height = Math.max(10, height + dy);
        if (dir.includes('w')) {
          const possibleW = width - dx;
          if (possibleW > 10) {
            left = left + dx;
            width = possibleW;
          }
        }
        if (dir.includes('n')) {
          const possibleH = height - dy;
          if (possibleH > 10) {
            top = top + dy;
            height = possibleH;
          }
        }

        boxElem.style.left = `${Math.round(left)}px`;
        boxElem.style.top = `${Math.round(top)}px`;
        boxElem.style.width = `${Math.round(width)}px`;
        boxElem.style.height = `${Math.round(height)}px`;
      }
    });

    window.addEventListener('mouseup', () => {
      if (this.isDragging || this.isResizing) {
        if (this.currentDragItem && this.currentDragPageNum) {
          const cache = this.pageRenderCache.get(this.currentDragPageNum);
          const boxElem = document.querySelector(`.bbox-rect[data-id="${this.currentDragItem.id}"]`);
          if (cache && boxElem) {
            const currentLeft = parseFloat(boxElem.style.left);
            const currentTop = parseFloat(boxElem.style.top);
            const currentWidth = parseFloat(boxElem.style.width);
            const currentHeight = parseFloat(boxElem.style.height);

            this._updateItemCoordsFromElement(this.currentDragItem, currentLeft, currentTop, currentWidth, currentHeight, cache);
          }
        }
        this.isDragging = false;
        this.isResizing = false;
        this.currentDragItem = null;
        this.currentDragPageNum = null;
      }
    });
  }

  _updateItemCoordsFromElement(item, left, top, width, height, cache) {
    const { pageWidth, pageHeight, scaleX, scaleY, refH } = cache;
    const yOrigin = item.yOrigin || 'top';

    if (item.coordType === 'norm_0_1') {
      const x0 = left / pageWidth;
      const x1 = (left + width) / pageWidth;
      let y0, y1;
      if (yOrigin === 'bottom') {
        y1 = 1.0 - (top / pageHeight);
        y0 = 1.0 - ((top + height) / pageHeight);
      } else {
        y0 = top / pageHeight;
        y1 = (top + height) / pageHeight;
      }
      item.rawCoords = [x0, y0, x1, y1];
    } else if (item.coordType === 'norm_0_1000') {
      const x0 = (left / pageWidth) * 1000;
      const x1 = ((left + width) / pageWidth) * 1000;
      let y0, y1;
      if (yOrigin === 'bottom') {
        y1 = (1.0 - (top / pageHeight)) * 1000;
        y0 = (1.0 - ((top + height) / pageHeight)) * 1000;
      } else {
        y0 = (top / pageHeight) * 1000;
        y1 = ((top + height) / pageHeight) * 1000;
      }
      item.rawCoords = [Math.round(x0), Math.round(y0), Math.round(x1), Math.round(y1)];
    } else {
      const sX = scaleX || (pageWidth / 595.28);
      const sY = scaleY || (pageHeight / 841.89);
      const rH = refH || 841.89;

      const x0 = left / sX;
      const x1 = (left + width) / sX;
      let y0, y1;
      if (yOrigin === 'bottom') {
        y1 = rH - (top / sY);
        y0 = rH - ((top + height) / sY);
      } else {
        y0 = top / sY;
        y1 = (top + height) / sY;
      }
      item.rawCoords = [Math.round(x0), Math.round(y0), Math.round(x1), Math.round(y1)];
    }

    if (this.onBBoxChangeCallback) {
      this.onBBoxChangeCallback(item);
    }
  }
}

if (typeof window !== 'undefined') {
  window.BBoxOverlayManager = BBoxOverlayManager;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = BBoxOverlayManager;
}
