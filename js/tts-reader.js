/**
 * TTSReader - Advanced Accessible Document Text-to-Speech Engine
 * 
 * Features:
 * - Natural Turkish Speech Synthesis (tr-TR).
 * - Automatic Deduplication: Sentences spanning multiple line bounding boxes (same ID)
 *   are grouped and read exactly ONCE, avoiding repeated speech.
 * - Anti-Clipping Audio Engine:
 *     * Web Audio stream priming eliminates audio device latency.
 *     * 200ms natural inter-sentence breathing pause ensures audio buffer drains cleanly.
 *     * Chromium 14-second heartbeat keep-alive prevents mid-document freezing.
 *     * GC-safe persistent buffer keeps utterances alive across the entire document.
 * - Multi-BBox Karaoke Highlighting: Highlights all line boxes of the active sentence.
 * - Table & Math Accessible Vocalization: Pronounces table row/col relations and math symbols clearly.
 * - Controls: Play, Pause, Resume, Stop, Next, Prev, Speak Single, Rate Adjustment.
 */

class TTSReader {
  constructor(overlayManager, pdfViewer) {
    this.overlayManager = overlayManager;
    this.pdfViewer = pdfViewer;
    this.items = [];
    this.speechUnits = [];
    this.currentUnitIndex = 0;
    this.isPlaying = false;
    this.isPaused = false;
    this.rate = 1.0;
    this.pitch = 1.0;
    this.selectedVoice = null;
    this.currentUtterance = null;
    this._audioCtx = null;
    this._heartbeat = null;
    this._nextSentenceTimer = null;

    // Callbacks
    this.onStateChangeCallback = null;
    this.onSentenceStartCallback = null;
    this.onSentenceEndCallback = null;

    this.synth = (typeof window !== 'undefined' && 'speechSynthesis' in window) ? window.speechSynthesis : null;
    this._initVoices();
  }

  _initVoices() {
    if (!this.synth) return;

    const loadVoices = () => {
      const voices = this.synth.getVoices();
      if (!voices || voices.length === 0) return;

      // Prioritize Turkish voices
      const trVoices = voices.filter(v => v.lang && (v.lang.startsWith('tr') || v.lang.includes('TR')));
      if (trVoices.length > 0) {
        // Preferred natural voices first (Edge Natural, Google, Tolga, Emel)
        const preferred = trVoices.find(v => 
          v.name.includes('Natural') || 
          v.name.includes('Google') || 
          v.name.includes('Tolga') || 
          v.name.includes('Emel') ||
          v.name.includes('Turkish')
        );
        this.selectedVoice = preferred || trVoices[0];
      } else {
        this.selectedVoice = voices[0];
      }
    };

    loadVoices();
    if (this.synth.onvoiceschanged !== undefined) {
      this.synth.onvoiceschanged = loadVoices;
    }
  }

  /**
   * Pre-primes the browser's Web Audio pipeline to eliminate audio hardware unmuting/ramping latency
   */
  _primeAudio() {
    try {
      if (typeof window === 'undefined') return;
      if (!this._audioCtx) {
        const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
        if (AudioCtxClass) {
          this._audioCtx = new AudioCtxClass();
        }
      }
      if (this._audioCtx && this._audioCtx.state === 'suspended') {
        this._audioCtx.resume();
      }
      if (this._audioCtx) {
        const buffer = this._audioCtx.createBuffer(1, 1, 22050);
        const source = this._audioCtx.createBufferSource();
        source.buffer = buffer;
        source.connect(this._audioCtx.destination);
        source.start(0);
      }
    } catch (e) {
      // AudioContext fallback ignored
    }
  }

  /**
   * Chromium Keep-Alive Heartbeat: Prevents Chromium speech synthesis from freezing after 14-15s
   */
  _startHeartbeat() {
    this._stopHeartbeat();
    if (!this.synth) return;

    this._heartbeat = setInterval(() => {
      if (this.isPlaying && !this.isPaused && this.synth) {
        this.synth.pause();
        this.synth.resume();
      }
    }, 4000);
  }

  _stopHeartbeat() {
    if (this._heartbeat) {
      clearInterval(this._heartbeat);
      this._heartbeat = null;
    }
    if (this._nextSentenceTimer) {
      clearTimeout(this._nextSentenceTimer);
      this._nextSentenceTimer = null;
    }
  }

  /**
   * Set raw BBox items and automatically group/deduplicate them into distinct unique sentences
   */
  setItems(items) {
    this.items = items || [];
    this._buildSpeechUnits();
  }

  /**
   * Group multi-line bounding boxes belonging to the same sentence into a single SpeechUnit
   */
  _buildSpeechUnits() {
    this.speechUnits = [];
    if (!this.items || this.items.length === 0) return;

    const map = new Map();
    const orderedUnits = [];

    for (const item of this.items) {
      const pageNum = item.page || 1;
      const sId = item.sentence_id !== undefined ? item.sentence_id : (item.id_display !== undefined ? item.id_display : item.id);
      const key = `${pageNum}_${sId}`;

      if (!map.has(key)) {
        const unit = {
          key: key,
          page: pageNum,
          sentence_id: sId,
          id_display: item.id_display !== undefined ? item.id_display : item.index,
          primaryItem: item,
          memberBoxes: [item],
          table_type: item.table_type || null,
          text: item.fullSentenceText || item.text || ''
        };
        map.set(key, unit);
        orderedUnits.push(unit);
      } else {
        const unit = map.get(key);
        unit.memberBoxes.push(item);
        if (item.table_type && !unit.table_type) {
          unit.table_type = item.table_type;
        }
        // If fullSentenceText was missing, combine line pieces
        if (!unit.text && item.text) {
          unit.text = (unit.text ? unit.text + ' ' : '') + item.text;
        }
      }
    }

    this.speechUnits = orderedUnits;
    if (this.currentUnitIndex >= this.speechUnits.length) {
      this.currentUnitIndex = 0;
    }
  }

  setRate(rate) {
    this.rate = parseFloat(rate) || 1.0;
  }

  onStateChange(callback) {
    this.onStateChangeCallback = callback;
  }

  onSentenceStart(callback) {
    this.onSentenceStartCallback = callback;
  }

  onSentenceEnd(callback) {
    this.onSentenceEndCallback = callback;
  }

  _notifyState(state) {
    if (this.onStateChangeCallback) {
      const activeUnit = this.speechUnits[this.currentUnitIndex] || null;
      this.onStateChangeCallback(state, this.currentUnitIndex, activeUnit ? activeUnit.primaryItem : null);
    }
  }

  /**
   * Speak a single item/sentence once (without looping over sibling lines)
   */
  speakSingle(item) {
    if (!this.synth || !item) return;
    this.stop();
    this._primeAudio();

    // Find the speech unit that contains this item
    const targetUnit = this._findUnitForItem(item);
    if (!targetUnit) return;

    this.currentUnitIndex = this.speechUnits.indexOf(targetUnit);
    if (this.currentUnitIndex === -1) this.currentUnitIndex = 0;

    this._highlightSpeakingUnit(targetUnit);

    this.isPlaying = true;
    this.isPaused = false;
    this._notifyState('playing');
    this._startHeartbeat();

    if (this.onSentenceStartCallback) {
      this.onSentenceStartCallback(targetUnit.primaryItem, this.currentUnitIndex);
    }

    this._speakText(
      targetUnit,
      () => {},
      () => {
        this.isPlaying = false;
        this.isPaused = false;
        this._stopHeartbeat();
        this._removeHighlight();
        this._notifyState('stopped');
        if (this.onSentenceEndCallback) {
          this.onSentenceEndCallback(targetUnit.primaryItem, this.currentUnitIndex);
        }
      },
      () => {
        this.isPlaying = false;
        this.isPaused = false;
        this._stopHeartbeat();
        this._removeHighlight();
        this._notifyState('stopped');
      }
    );
  }

  /**
   * Start sequential continuous reading of document sentences
   */
  play(startItemOrIndex = null) {
    if (!this.synth || this.speechUnits.length === 0) return;
    this._primeAudio();

    if (this.isPaused && startItemOrIndex === null) {
      this.resume();
      return;
    }

    if (typeof startItemOrIndex === 'object' && startItemOrIndex !== null) {
      const unit = this._findUnitForItem(startItemOrIndex);
      if (unit) {
        this.currentUnitIndex = this.speechUnits.indexOf(unit);
      }
    } else if (typeof startItemOrIndex === 'number' && startItemOrIndex >= 0) {
      if (this.items[startItemOrIndex]) {
        const unit = this._findUnitForItem(this.items[startItemOrIndex]);
        if (unit) {
          this.currentUnitIndex = this.speechUnits.indexOf(unit);
        }
      } else if (startItemOrIndex < this.speechUnits.length) {
        this.currentUnitIndex = startItemOrIndex;
      }
    }

    if (this.currentUnitIndex < 0 || this.currentUnitIndex >= this.speechUnits.length) {
      this.currentUnitIndex = 0;
    }

    this.isPlaying = true;
    this.isPaused = false;
    this._notifyState('playing');
    this._startHeartbeat();
    this._speakNextInSequence();
  }

  /**
   * Pause speech
   */
  pause() {
    if (!this.synth || !this.isPlaying) return;
    this.synth.pause();
    this.isPlaying = false;
    this.isPaused = true;
    this._stopHeartbeat();
    this._notifyState('paused');
  }

  /**
   * Resume paused speech
   */
  resume() {
    if (!this.synth || !this.isPaused) return;
    this._primeAudio();
    this.synth.resume();
    this.isPlaying = true;
    this.isPaused = false;
    this._startHeartbeat();
    this._notifyState('playing');
  }

  /**
   * Stop speech synthesis completely
   */
  stop() {
    this._stopHeartbeat();
    if (this.synth) {
      this.synth.cancel();
    }
    this.isPlaying = false;
    this.isPaused = false;
    this.currentUtterance = null;
    this._removeHighlight();
    this._notifyState('stopped');
  }

  /**
   * Skip to next distinct sentence
   */
  next() {
    if (this.currentUnitIndex < this.speechUnits.length - 1) {
      this.currentUnitIndex++;
      const unit = this.speechUnits[this.currentUnitIndex];
      this._highlightSpeakingUnit(unit);
      if (this.onSentenceStartCallback) {
        this.onSentenceStartCallback(unit.primaryItem, this.currentUnitIndex);
      }
      if (this.isPlaying) {
        this.synth.cancel();
        this._speakNextInSequence();
      }
    } else {
      this.stop();
    }
  }

  /**
   * Skip to previous distinct sentence
   */
  prev() {
    if (this.currentUnitIndex > 0) {
      this.currentUnitIndex--;
      const unit = this.speechUnits[this.currentUnitIndex];
      this._highlightSpeakingUnit(unit);
      if (this.onSentenceStartCallback) {
        this.onSentenceStartCallback(unit.primaryItem, this.currentUnitIndex);
      }
      if (this.isPlaying) {
        this.synth.cancel();
        this._speakNextInSequence();
      }
    }
  }

  /**
   * Sequential speech step with natural inter-sentence breathing pause
   */
  _speakNextInSequence() {
    if (!this.isPlaying || this.currentUnitIndex >= this.speechUnits.length) {
      this.stop();
      return;
    }

    const unit = this.speechUnits[this.currentUnitIndex];
    if (!unit || !unit.text) {
      this.currentUnitIndex++;
      this._speakNextInSequence();
      return;
    }

    this._highlightSpeakingUnit(unit);

    if (this.onSentenceStartCallback) {
      this.onSentenceStartCallback(unit.primaryItem, this.currentUnitIndex);
    }

    this._speakText(
      unit,
      () => {},
      () => {
        if (this.onSentenceEndCallback) {
          this.onSentenceEndCallback(unit.primaryItem, this.currentUnitIndex);
        }
        this.currentUnitIndex++;

        // 200ms natural breathing delay: Lets browser audio channel reset cleanly between sentences
        if (this.isPlaying) {
          this._nextSentenceTimer = setTimeout(() => {
            if (this.isPlaying) {
              this._speakNextInSequence();
            }
          }, 200);
        }
      },
      (err) => {
        console.warn('TTS step error, skipping to next:', err);
        this.currentUnitIndex++;
        if (this.isPlaying) {
          this._nextSentenceTimer = setTimeout(() => {
            if (this.isPlaying) {
              this._speakNextInSequence();
            }
          }, 200);
        }
      }
    );
  }

  /**
   * Core speech synthesis invoker with garbage collection protection & clean pronunciation
   */
  _speakText(unitOrItemOrText, onStart, onEnd, onError) {
    if (!this.synth) return;

    // Wake up synth if stuck in paused state
    if (this.synth.paused) {
      this.synth.resume();
    }

    const cleanText = this._getAccessibleText(unitOrItemOrText);
    if (!cleanText) {
      if (onEnd) onEnd();
      return;
    }

    const utterance = new SpeechSynthesisUtterance(cleanText);
    utterance.lang = 'tr-TR';
    utterance.rate = this.rate;
    utterance.pitch = this.pitch;
    if (!this.selectedVoice) {
      this._initVoices();
    }
    if (this.selectedVoice) utterance.voice = this.selectedVoice;

    // Global persistent array to prevent Chromium V8 garbage collection
    if (typeof window !== 'undefined') {
      window.__ttsKeepAlive = window.__ttsKeepAlive || [];
      window.__ttsKeepAlive.push(utterance);
      // Keep only the last 20 utterances in memory
      if (window.__ttsKeepAlive.length > 20) {
        window.__ttsKeepAlive.shift();
      }
    }
    this.currentUtterance = utterance;

    utterance.onstart = () => {
      if (onStart) onStart();
    };

    utterance.onend = () => {
      if (onEnd) onEnd();
    };

    utterance.onerror = (e) => {
      if (e.error === 'interrupted' || e.error === 'canceled') return;
      console.warn('TTS speech error:', e);
      if (onError) onError(e);
    };

    this.synth.speak(utterance);
  }

  /**
   * Clean accessible spoken text for Turkish speech synthesis
   */
  _getAccessibleText(itemOrText) {
    let text = typeof itemOrText === 'string' ? itemOrText : (itemOrText?.fullSentenceText || itemOrText?.text || '');
    
    // Check if item or unit belongs to B_KEY_VALUE
    const isBKeyValue = (typeof itemOrText === 'object' && itemOrText !== null && (
      itemOrText.table_type === 'B_KEY_VALUE' ||
      itemOrText.primaryItem?.table_type === 'B_KEY_VALUE' ||
      (Array.isArray(itemOrText.memberBoxes) && itemOrText.memberBoxes.some(b => b && b.table_type === 'B_KEY_VALUE'))
    ));

    // Remove matrix table "Satır X, Sütun Y, Değer Z" prefixes if in B_KEY_VALUE
    if (isBKeyValue) {
      text = text.replace(/^Satır\s+[^,]+,\s*Sütun\s+[^,]+,\s*Değer\s+/i, '');
      text = text.replace(/^Satır\s+[^,]+,\s*Sütun\s+[^,:]+[:\-]?\s*/i, '');
      text = text.replace(/^Satır\s+[^,:]+[:\-]?\s*/i, '');
      text = text.replace(/^Sütun\s+[^,:]+[:\-]?\s*/i, '');
      text = text.replace(/\[Satır\s+[^\]]+\]\s*/gi, '');
      text = text.replace(/\[Sütun\s+[^\]]+\]\s*/gi, '');
    }

    // Remove table contextual brackets
    text = text.replace(/\[/g, '').replace(/\]/g, '');

    // Pronounce mathematical and financial symbols clearly in Turkish as per spec:
    // = eşittir · × çarpı · + artı · - eksi · / bölü · % yüzde · Σ toplamı
    text = text
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
      .replace(/\s+/g, ' ')
      .trim();

    // Strip only leading bullets/dashes, leave all letters/numbers/quotes intact
    text = text.replace(/^[\s\-_•–—*#]+/, '').trim();

    return text;
  }

  /**
   * Find corresponding SpeechUnit for a given bbox item
   */
  _findUnitForItem(item) {
    if (!item) return null;
    const pageNum = item.page || 1;
    const sId = item.sentence_id !== undefined ? item.sentence_id : (item.id_display !== undefined ? item.id_display : item.id);
    const key = `${pageNum}_${sId}`;

    return this.speechUnits.find(u => u.key === key || u.memberBoxes.some(b => String(b.id) === String(item.id))) || null;
  }

  /**
   * Highlight all member BBoxes belonging to this speech unit simultaneously
   */
  _highlightSpeakingUnit(unit) {
    this._removeHighlight();
    if (!unit || !unit.memberBoxes || unit.memberBoxes.length === 0) return;

    const memberIds = new Set(unit.memberBoxes.map(b => String(b.id)));
    const allBoxEls = document.querySelectorAll('.bbox-rect');

    allBoxEls.forEach(el => {
      if (memberIds.has(el.dataset.id)) {
        el.classList.add('speaking-active');
      }
    });

    // Auto-scroll viewport to primary box
    if (this.pdfViewer && typeof this.pdfViewer.scrollToBBox === 'function') {
      this.pdfViewer.scrollToBBox(unit.primaryItem);
    }
  }

  _removeHighlight() {
    if (typeof document !== 'undefined') {
      document.querySelectorAll('.bbox-rect.speaking-active').forEach(el => {
        el.classList.remove('speaking-active');
      });
    }
  }
}

// Exports
if (typeof window !== 'undefined') {
  window.TTSReader = TTSReader;
}
if (typeof module !== 'undefined' && module.exports) {
  module.exports = TTSReader;
}
