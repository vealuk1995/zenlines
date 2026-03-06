/**
 * storage.js
 * Handles all LocalStorage persistence: progress, saved works,
 * custom palettes, recent colors, last opened artwork, undo/redo.
 */

const Storage = (() => {
  const KEYS = {
    PROGRESS:      'colorbook_progress',      // { [imageId]: canvasDataURL }
    SAVED_WORKS:   'colorbook_saved_works',   // [{ id, imageId, title, thumb, date }]
    CUSTOM_COLORS: 'colorbook_custom_colors', // ['#hex', ...]
    RECENT_COLORS: 'colorbook_recent_colors', // ['#hex', ...] max 10
    LAST_ARTWORK:  'colorbook_last_artwork',  // imageId string
    UNDO_HISTORY:  'colorbook_undo_history',  // { [imageId]: [dataURL, ...] }
  };

  // ── Helpers ────────────────────────────────────────────────────────────────

  function _get(key) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      console.warn('[Storage] read error', key, e);
      return null;
    }
  }

  function _set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.warn('[Storage] write error', key, e);
    }
  }

  // ── Progress ───────────────────────────────────────────────────────────────

  /** Save canvas painting layer as data URL for a specific image */
  function saveProgress(imageId, dataURL) {
    const all = _get(KEYS.PROGRESS) || {};
    all[imageId] = dataURL;
    _set(KEYS.PROGRESS, all);
  }

  /** Load canvas painting layer data URL for a specific image, or null */
  function loadProgress(imageId) {
    const all = _get(KEYS.PROGRESS) || {};
    return all[imageId] || null;
  }

  /** Remove progress for an image (e.g. when user resets) */
  function clearProgress(imageId) {
    const all = _get(KEYS.PROGRESS) || {};
    delete all[imageId];
    _set(KEYS.PROGRESS, all);
  }

  // ── Saved Works (My Works gallery) ────────────────────────────────────────

  function getSavedWorks() {
    return _get(KEYS.SAVED_WORKS) || [];
  }

  /**
   * Save a finished colored image.
   * @param {string} imageId - original artwork id
   * @param {string} title   - artwork title
   * @param {string} dataURL - merged png data url (base + paint)
   */
  function saveWork(imageId, title, dataURL) {
    const works = getSavedWorks();
    // Replace existing save for same imageId to avoid duplicates
    const idx = works.findIndex(w => w.imageId === imageId);
    const entry = {
      id: imageId + '_' + Date.now(),
      imageId,
      title,
      dataURL,
      date: new Date().toISOString(),
    };
    if (idx >= 0) {
      works[idx] = entry;
    } else {
      works.unshift(entry);
    }
    _set(KEYS.SAVED_WORKS, works);
    return entry;
  }

  function deleteSavedWork(id) {
    const works = getSavedWorks().filter(w => w.id !== id);
    _set(KEYS.SAVED_WORKS, works);
  }

  // ── Custom Colors ──────────────────────────────────────────────────────────

  function getCustomColors() {
    return _get(KEYS.CUSTOM_COLORS) || [];
  }

  function addCustomColor(hex) {
    const colors = getCustomColors();
    if (!colors.includes(hex)) {
      colors.unshift(hex);
      if (colors.length > 30) colors.pop();
      _set(KEYS.CUSTOM_COLORS, colors);
    }
  }

  function removeCustomColor(hex) {
    const colors = getCustomColors().filter(c => c !== hex);
    _set(KEYS.CUSTOM_COLORS, colors);
  }

  // ── Recent Colors ──────────────────────────────────────────────────────────

  function getRecentColors() {
    return _get(KEYS.RECENT_COLORS) || [];
  }

  /** Push a color to recents, keeping max 10, most recent first */
  function pushRecentColor(hex) {
    let colors = getRecentColors().filter(c => c !== hex);
    colors.unshift(hex);
    if (colors.length > 10) colors = colors.slice(0, 10);
    _set(KEYS.RECENT_COLORS, colors);
  }

  // ── Last Artwork ───────────────────────────────────────────────────────────

  function setLastArtwork(imageId) {
    _set(KEYS.LAST_ARTWORK, imageId);
  }

  function getLastArtwork() {
    return _get(KEYS.LAST_ARTWORK);
  }

  // ── Undo / Redo History ────────────────────────────────────────────────────
  // We store a history stack per imageId.
  // Each entry is a dataURL snapshot of the paint canvas.
  // We keep max MAX_HISTORY entries to limit memory.

  const MAX_HISTORY = 20;

  function getHistory(imageId) {
    const all = _get(KEYS.UNDO_HISTORY) || {};
    return all[imageId] || { stack: [], pointer: -1 };
  }

  function saveHistory(imageId, historyObj) {
    const all = _get(KEYS.UNDO_HISTORY) || {};
    all[imageId] = historyObj;
    _set(KEYS.UNDO_HISTORY, all);
  }

  function clearHistory(imageId) {
    const all = _get(KEYS.UNDO_HISTORY) || {};
    delete all[imageId];
    _set(KEYS.UNDO_HISTORY, all);
  }

  // ── Public API ─────────────────────────────────────────────────────────────
  return {
    saveProgress, loadProgress, clearProgress,
    getSavedWorks, saveWork, deleteSavedWork,
    getCustomColors, addCustomColor, removeCustomColor,
    getRecentColors, pushRecentColor,
    setLastArtwork, getLastArtwork,
    getHistory, saveHistory, clearHistory,
    MAX_HISTORY,
    KEYS,
  };
})();
