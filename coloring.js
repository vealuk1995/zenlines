/**
 * coloring.js
 * Core coloring engine:
 *  - Two-layer canvas (baseCanvas = line art, paintCanvas = colors)
 *  - Flood-fill with region map cache
 *  - Fill animation
 *  - Undo / Redo history
 *  - Auto-save every 8 seconds + on blur
 *  - Long-press precision fill
 *  - Save / export
 *  - Telegram sharing
 */
const SHARE_API_URL = 'https://colorbook-share.vealuk1995.workers.dev'; // ← ваш URL
const Coloring = (() => {

  // ── Constants ──────────────────────────────────────────────────────────────

  const BORDER_THRESHOLD   = 230;   // 0–255: pixels darker than this are borders
  const FILL_TOLERANCE     = 40;   // flood-fill color match tolerance
  const AUTOSAVE_INTERVAL  = 8000; // ms
  const LONG_PRESS_MS      = 550;  // ms to trigger precision mode
  const MAX_HISTORY        = 20;

  // ── State ──────────────────────────────────────────────────────────────────

  let artwork        = null;   // current artwork object from catalog
  let baseCanvas     = null;   // line art layer (never redrawn)
  let paintCanvas    = null;   // color layer
  let baseCtx        = null;
  let paintCtx       = null;
  let canvasWrapper  = null;   // wraps both canvases for zoom
  let screenEl       = null;   // coloring screen root element

  let canvasW        = 0;
  let canvasH        = 0;

  // Region map: Uint32Array where each cell = regionId (0 = border/unset)
  let regionMap      = null;
  let regionMapReady = false;
  // regionColors: Map<regionId, hex>
  let regionColors   = new Map();

  // Undo/Redo
  let history        = [];     // array of ImageData snapshots
  let historyPointer = -1;

  // Touch
  let longPressTimer  = null;
  let touchStartX     = 0;
  let touchStartY     = 0;
  let precisionMode   = false;
  let touchMoved      = false;
  let wasZooming      = false; // ← добавить


  // Autosave
  let autosaveTimer   = null;

  // Navigation callback
  let onBack          = null;

  // ── Init / Open ────────────────────────────────────────────────────────────

  /**
   * Open the coloring screen for a given artwork.
   * @param {HTMLElement} screen   - the coloring screen DOM node
   * @param {object}      art      - artwork from catalog
   * @param {function}    backCb   - called when user presses back
   */
  function open(screen, art, backCb) {
    screenEl  = screen;
    artwork   = art;
    onBack    = backCb;

    Storage.setLastArtwork(art.id);

    _buildUI();
    _initCanvases();
    _loadImage();
    _startAutosave();
    _attachVisibilityListener();
  }

  function close() {
    _stopAutosave();
    _save();
    Zoom.destroy();
    document.removeEventListener('visibilitychange', _onVisibilityChange);
    screenEl = null;
    artwork  = null;
    regionMap = null;
    regionMapReady = false;
    regionColors.clear();
    history = [];
    historyPointer = -1;
  }

  // ── UI Build ───────────────────────────────────────────────────────────────

  function _buildUI() {
    screenEl.innerHTML = '';

    // ── Top toolbar ────────────────────────────────────────────────────────
    const toolbar = document.createElement('div');
    toolbar.className = 'coloring-toolbar';

    const backBtn = document.createElement('button');
    backBtn.className = 'toolbar-btn';
    backBtn.innerHTML = '&#8592; Back';
    backBtn.addEventListener('click', () => {
      _save();
      if (onBack) onBack();
    });

    const titleEl = document.createElement('span');
    titleEl.className = 'toolbar-title';
    titleEl.textContent = artwork.title;

    const saveBtn = document.createElement('button');
    saveBtn.className = 'toolbar-btn toolbar-btn-primary';
    saveBtn.innerHTML = '💾 Save';
    saveBtn.addEventListener('click', _saveWork);

    toolbar.appendChild(backBtn);
    toolbar.appendChild(titleEl);
    toolbar.appendChild(saveBtn);
    screenEl.appendChild(toolbar);

    // ── Canvas area ────────────────────────────────────────────────────────
    const canvasContainer = document.createElement('div');
    canvasContainer.className = 'canvas-container';
    canvasContainer.id = 'canvas-container';

    canvasWrapper = document.createElement('div');
    canvasWrapper.className = 'canvas-wrapper';
    canvasWrapper.id = 'canvas-wrapper';

    // Paint canvas (bottom)
    paintCanvas = document.createElement('canvas');
    paintCanvas.className = 'paint-canvas';
    paintCanvas.id = 'paint-canvas';

    // Base canvas (top — line art, pointer-events:none)
    baseCanvas = document.createElement('canvas');
    baseCanvas.className = 'base-canvas';
    baseCanvas.id = 'base-canvas';

    canvasWrapper.appendChild(paintCanvas);
    canvasWrapper.appendChild(baseCanvas);
    canvasContainer.appendChild(canvasWrapper);
    screenEl.appendChild(canvasContainer);

    // ── Bottom action bar ──────────────────────────────────────────────────
    const actionBar = document.createElement('div');
    actionBar.className = 'action-bar';

    const undoBtn = document.createElement('button');
    undoBtn.className = 'action-btn';
    undoBtn.id = 'undo-btn';
    undoBtn.innerHTML = '↩ Undo';
    undoBtn.addEventListener('click', undo);

    const redoBtn = document.createElement('button');
    redoBtn.className = 'action-btn';
    redoBtn.id = 'redo-btn';
    redoBtn.innerHTML = 'Redo ↪';
    redoBtn.addEventListener('click', redo);

    const resetBtn = document.createElement('button');
    resetBtn.className = 'action-btn action-btn-danger';
    resetBtn.innerHTML = '🗑 Reset';
    resetBtn.addEventListener('click', _resetCanvas);

    const shareBtn = document.createElement('button');
    shareBtn.className = 'action-btn action-btn-share';
    shareBtn.innerHTML = '✈️ Share';
    shareBtn.addEventListener('click', _share);

    actionBar.appendChild(undoBtn);
    actionBar.appendChild(redoBtn);
    actionBar.appendChild(resetBtn);
    actionBar.appendChild(shareBtn);
    screenEl.appendChild(actionBar);

    // ── Palette panel ──────────────────────────────────────────────────────
    const palettePanel = document.createElement('div');
    palettePanel.className = 'palette-panel';
    palettePanel.id = 'palette-panel';
    screenEl.appendChild(palettePanel);

    // Init palette
    Palette.init(palettePanel, (hex) => {
      // Color selected — nothing extra needed, fills use Palette.getSelectedColor()
    });
  }

  // ── Canvas Init ────────────────────────────────────────────────────────────

function _initCanvases() {
  const vw = window.innerWidth;
  const areaH = window.innerHeight - 56 - 52 - 220;
  const size = Math.min(vw, Math.max(areaH, 300));

  // Рендерим в 3× разрешении — чётко до scale 3.0 без размытия
  const RENDER_SCALE = 3;

  canvasW = size * RENDER_SCALE;
  canvasH = size * RENDER_SCALE;

  [baseCanvas, paintCanvas].forEach(c => {
    c.width  = canvasW;
    c.height = canvasH;
    // CSS-размер остаётся прежним — canvas просто плотнее
    c.style.width  = size + 'px';
    c.style.height = size + 'px';
  });

  canvasWrapper.style.width  = size + 'px';
  canvasWrapper.style.height = size + 'px';

  // ...остальное без изменений
    baseCtx  = baseCanvas.getContext('2d');
    paintCtx = paintCanvas.getContext('2d');

    // White background on paint canvas
    paintCtx.fillStyle = '#FFFFFF';
    paintCtx.fillRect(0, 0, canvasW, canvasH);

    // Init zoom
    const container = document.getElementById('canvas-container');
    Zoom.init(canvasWrapper, container, null);

    // Touch events on canvas container
    _attachCanvasEvents(container);
  }

  // ── Image Loading ──────────────────────────────────────────────────────────

  function _loadImage() {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      // Draw line art centered/fitted
      const scale = Math.min(canvasW / img.width, canvasH / img.height);
      const dw = img.width  * scale;
      const dh = img.height * scale;
      const dx = (canvasW - dw) / 2;
      const dy = (canvasH - dh) / 2;

      baseCtx.clearRect(0, 0, canvasW, canvasH);
      baseCtx.drawImage(img, dx, dy, dw, dh);

      // Restore saved progress
      const saved = Storage.loadProgress(artwork.id);
      if (saved) {
        _restoreProgress(saved, () => _buildRegionMap());
      } else {
        _buildRegionMap();
      }

      // Restore undo history
      _restoreHistory();
    };
    img.onerror = () => {
      // If image fails to load (no file yet), draw a placeholder
      _drawPlaceholder();
      _buildRegionMap();
    };
    img.src = artwork.src;
  }

  function _drawPlaceholder() {
    baseCtx.clearRect(0, 0, canvasW, canvasH);
    baseCtx.strokeStyle = '#000000';
    baseCtx.lineWidth = 3;

    // Draw a simple mandala-like placeholder
    const cx = canvasW / 2, cy = canvasH / 2;
    const r1 = canvasW * 0.4;
    const r2 = canvasW * 0.25;
    const r3 = canvasW * 0.1;

    baseCtx.beginPath();
    baseCtx.arc(cx, cy, r1, 0, Math.PI * 2);
    baseCtx.stroke();

    baseCtx.beginPath();
    baseCtx.arc(cx, cy, r2, 0, Math.PI * 2);
    baseCtx.stroke();

    baseCtx.beginPath();
    baseCtx.arc(cx, cy, r3, 0, Math.PI * 2);
    baseCtx.stroke();

    // Petals
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2;
      const bx = cx + Math.cos(angle) * r2;
      const by = cy + Math.sin(angle) * r2;
      baseCtx.beginPath();
      baseCtx.arc(bx, by, r3, 0, Math.PI * 2);
      baseCtx.stroke();
    }

    // Add text hint
    baseCtx.fillStyle = '#AAAAAA';
    baseCtx.font = '14px sans-serif';
    baseCtx.textAlign = 'center';
    baseCtx.fillText('Add PNG to: ' + artwork.src, cx, canvasH - 20);
  }

  function _restoreProgress(dataURL, callback) {
    const img = new Image();
    img.onload = () => {
      paintCtx.clearRect(0, 0, canvasW, canvasH);
      paintCtx.fillStyle = '#FFFFFF';
      paintCtx.fillRect(0, 0, canvasW, canvasH);
      paintCtx.drawImage(img, 0, 0, canvasW, canvasH);
      if (callback) callback();
    };
    img.onerror = () => { if (callback) callback(); };
    img.src = dataURL;
  }

  // ── Region Map ─────────────────────────────────────────────────────────────

  /**
   * Scan the base canvas and assign a unique integer ID to every
   * contiguous non-border region using a flood-fill queue.
   * regionMap[y * W + x] = regionId  (0 = border)
   */
  function _buildRegionMap() {
    regionMapReady = false;
    regionMap = new Uint32Array(canvasW * canvasH);

    const imageData = baseCtx.getImageData(0, 0, canvasW, canvasH);
    const data = imageData.data;

    let nextId = 1;
    const W = canvasW, H = canvasH;

    const isBorder = (idx4) => {
      const r = data[idx4], g = data[idx4 + 1], b = data[idx4 + 2], a = data[idx4 + 3];
      // Transparent pixel = fillable region (treat as white)
      if (a < 50) return false;
      const brightness = (r + g + b) / 3;
      return brightness < BORDER_THRESHOLD;
    };

    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const idx = y * W + x;
        if (regionMap[idx] !== 0) continue;
        const idx4 = idx * 4;
        if (isBorder(idx4)) {
          regionMap[idx] = 0; // keep as border
          continue;
        }
        // BFS flood fill to assign region id
        const queue = [idx];
        regionMap[idx] = nextId;
        let head = 0;
        while (head < queue.length) {
          const cur = queue[head++];
          const cx = cur % W;
          const cy = (cur - cx) / W;
          const neighbors = [
            cy > 0     ? cur - W : -1,
            cy < H - 1 ? cur + W : -1,
            cx > 0     ? cur - 1 : -1,
            cx < W - 1 ? cur + 1 : -1,
          ];
          for (const n of neighbors) {
            if (n < 0 || regionMap[n] !== 0) continue;
            const n4 = n * 4;
            if (isBorder(n4)) continue;
            regionMap[n] = nextId;
            queue.push(n);
          }
        }
        nextId++;
      }
    }

    regionMapReady = true;
    // Restore regionColors from existing paint (if resumed)
    _detectExistingColors();
  }

  /**
   * After restoring progress, sample region colors from paint canvas.
   */
  function _detectExistingColors() {
    if (!regionMap) return;
    const paintData = paintCtx.getImageData(0, 0, canvasW, canvasH).data;
    const W = canvasW;
    const sampled = new Map();

    for (let i = 0; i < regionMap.length; i++) {
      const rid = regionMap[i];
      if (rid === 0 || sampled.has(rid)) continue;
      const r = paintData[i * 4], g = paintData[i * 4 + 1], b = paintData[i * 4 + 2];
      if (r === 255 && g === 255 && b === 255) continue; // white = uncolored
      const hex = '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('').toUpperCase();
      sampled.set(rid, hex);
    }
    regionColors = sampled;
  }

  // ── Canvas Touch Events ────────────────────────────────────────────────────

  function _attachCanvasEvents(container) {
    container.addEventListener('touchstart',  _onTouchStart, { passive: false });
    container.addEventListener('touchmove',   _onTouchMove,  { passive: false });
    container.addEventListener('touchend',    _onTouchEnd,   { passive: false });
    container.addEventListener('touchcancel', _onTouchEnd,   { passive: false });

    // Mouse support for desktop/testing
    container.addEventListener('mousedown', _onMouseDown);
  }

function _onTouchStart(e) {
  if (e.touches.length === 2) {
    // Пинч начался — запоминаем
    wasZooming = true;
    clearTimeout(longPressTimer);
    return;
  }
  if (e.touches.length > 2) return;

  // Одиночное касание
  touchMoved = false;
  const t = e.touches[0];
  touchStartX = t.clientX;
  touchStartY = t.clientY;
  precisionMode = false;

  longPressTimer = setTimeout(() => {
    if (!touchMoved) {
      precisionMode = true;
      _vibrate(30);
      _showPrecisionIndicator(touchStartX, touchStartY);
    }
  }, LONG_PRESS_MS);
}

function _onTouchMove(e) {
  if (e.touches.length > 1) return;
  const t = e.touches[0];
  const dx = t.clientX - touchStartX;
  const dy = t.clientY - touchStartY;
  if (Math.sqrt(dx * dx + dy * dy) > 10) {
    touchMoved = true;
    clearTimeout(longPressTimer);
  }
}

function _onTouchEnd(e) {
  clearTimeout(longPressTimer);

  // Если ещё есть касания — пинч продолжается
  if (e.touches.length > 0) return;

  // Если был зум — сбрасываем флаг, заливку не делаем
  if (wasZooming) {
    wasZooming = false;
    return;
  }

  if (e.changedTouches.length === 0) return;
  const t = e.changedTouches[0];

  if (touchMoved) return;

  const pos = Zoom.clientToCanvas(t.clientX, t.clientY, paintCanvas);
  _fillAt(pos.x, pos.y);
}

  function _onMouseDown(e) {
    const pos = Zoom.clientToCanvas(e.clientX, e.clientY, paintCanvas);
    _fillAt(pos.x, pos.y);
  }

  // ── Fill Logic ─────────────────────────────────────────────────────────────

  function _fillAt(x, y) {
    if (!regionMapReady) return;
    if (x < 0 || y < 0 || x >= canvasW || y >= canvasH) return;

    const idx = Math.floor(y) * canvasW + Math.floor(x);
    const regionId = regionMap[idx];
    if (regionId === 0) return; // tapped on border

    const color = Palette.getSelectedColor();
    _fillRegion(regionId, color);
  }

  function _fillRegion(regionId, color) {
    // Push undo snapshot BEFORE painting
    _pushHistory();

    regionColors.set(regionId, color);

    // Parse color to RGB
    const r = parseInt(color.slice(1, 3), 16);
    const g = parseInt(color.slice(3, 5), 16);
    const b = parseInt(color.slice(5, 7), 16);

    // Collect all pixels for this region
    const pixels = [];
    for (let i = 0; i < regionMap.length; i++) {
      if (regionMap[i] === regionId) pixels.push(i);
    }

    // Single getImageData / putImageData — instant fill
    const imageData = paintCtx.getImageData(0, 0, canvasW, canvasH);
    const idata = imageData.data;

    for (let i = 0; i < pixels.length; i++) {
      const pIdx = pixels[i] * 4;
      idata[pIdx]     = r;
      idata[pIdx + 1] = g;
      idata[pIdx + 2] = b;
      idata[pIdx + 3] = 255;
    }

    paintCtx.putImageData(imageData, 0, 0);
  }

  // ── Undo / Redo ────────────────────────────────────────────────────────────

  function _pushHistory() {
    // Trim redo branch
    if (historyPointer < history.length - 1) {
      history = history.slice(0, historyPointer + 1);
    }
    const snapshot = paintCtx.getImageData(0, 0, canvasW, canvasH);
    history.push(snapshot);
    if (history.length > MAX_HISTORY) history.shift();
    historyPointer = history.length - 1;
    _updateHistoryButtons();
  }

  function undo() {
    if (historyPointer <= 0) return;
    historyPointer--;
    paintCtx.putImageData(history[historyPointer], 0, 0);
    _updateHistoryButtons();
    _saveHistoryToStorage();
  }

  function redo() {
    if (historyPointer >= history.length - 1) return;
    historyPointer++;
    paintCtx.putImageData(history[historyPointer], 0, 0);
    _updateHistoryButtons();
    _saveHistoryToStorage();
  }

  function _updateHistoryButtons() {
    const undoBtn = document.getElementById('undo-btn');
    const redoBtn = document.getElementById('redo-btn');
    if (undoBtn) undoBtn.disabled = historyPointer <= 0;
    if (redoBtn) redoBtn.disabled = historyPointer >= history.length - 1;
  }

  function _restoreHistory() {
    const stored = Storage.getHistory(artwork.id);
    // We store lightweight: just push initial snapshot as first history entry
    const snapshot = paintCtx.getImageData(0, 0, canvasW, canvasH);
    history = [snapshot];
    historyPointer = 0;
    _updateHistoryButtons();
  }

  function _saveHistoryToStorage() {
    // Save current paint as snapshot
    _save();
  }

  // ── Autosave ───────────────────────────────────────────────────────────────

  function _startAutosave() {
    _stopAutosave();
    autosaveTimer = setInterval(_save, AUTOSAVE_INTERVAL);
  }

  function _stopAutosave() {
    if (autosaveTimer) {
      clearInterval(autosaveTimer);
      autosaveTimer = null;
    }
  }

  function _save() {
    if (!artwork || !paintCanvas) return;
    const dataURL = paintCanvas.toDataURL('image/png');
    Storage.saveProgress(artwork.id, dataURL);
  }

  function _attachVisibilityListener() {
    document.addEventListener('visibilitychange', _onVisibilityChange);
  }

  function _onVisibilityChange() {
    if (document.visibilityState === 'hidden') _save();
  }

  // ── Save Work ──────────────────────────────────────────────────────────────

  function _saveWork() {
    _save(); // save progress first

    // Merge base + paint onto a temp canvas
    const merged = document.createElement('canvas');
    merged.width  = canvasW;
    merged.height = canvasH;
    const mCtx = merged.getContext('2d');

    // White bg
    mCtx.fillStyle = '#FFFFFF';
    mCtx.fillRect(0, 0, canvasW, canvasH);

    // Paint layer
    mCtx.drawImage(paintCanvas, 0, 0);

    // Line art on top
    mCtx.drawImage(baseCanvas, 0, 0);

    const dataURL = merged.toDataURL('image/png');
    Storage.saveWork(artwork.id, artwork.title, dataURL);

    _showToast('✅ Saved to My Works!');
  }

  // ── Reset ──────────────────────────────────────────────────────────────────

  function _resetCanvas() {
    if (!confirm('Reset all coloring? This cannot be undone.')) return;
    _pushHistory();
    paintCtx.fillStyle = '#FFFFFF';
    paintCtx.fillRect(0, 0, canvasW, canvasH);
    regionColors.clear();
    Storage.clearProgress(artwork.id);
    _showToast('🗑 Canvas reset.');
  }

  // ── Share ──────────────────────────────────────────────────────────────────

// ── Share ──────────────────────────────────────────────────────────────────

// Вставьте URL вашего Cloudflare Worker после деплоя.
// Пока пусто — будет показываться модальное окно.
function _share() {
  // Экспортируем в уменьшенном размере чтобы не превысить лимит Worker
  const exportSize = Math.min(canvasW, 800);
  const merged = document.createElement('canvas');
  merged.width  = exportSize;
  merged.height = exportSize;
  const mCtx = merged.getContext('2d');
  mCtx.fillStyle = '#FFFFFF';
  mCtx.fillRect(0, 0, exportSize, exportSize);
  mCtx.drawImage(paintCanvas, 0, 0, exportSize, exportSize);
  mCtx.drawImage(baseCanvas,  0, 0, exportSize, exportSize);
  // ... остальное без изменений

  const dataURL = merged.toDataURL('image/png');
const tg = window.Telegram?.WebApp;
let chatId = null;
try {
  const user = tg?.initDataUnsafe?.user
            || JSON.parse(new URLSearchParams(tg?.initData || '').get('user') || 'null');
  chatId = user?.id || null;
} catch (e) {}
    alert(
    'initData: ' + (tg?.initData ? tg.initData.slice(0, 60) : 'EMPTY') + '\n' +
    'user.id: ' + (tg?.initDataUnsafe?.user?.id || 'NOT FOUND') + '\n' +
    'SHARE_API_URL: ' + (SHARE_API_URL || 'EMPTY')
  );
  console.log('[Share] chat_id:', chatId, '| initData:', tg?.initData?.slice(0, 80));
  
  if (chatId && SHARE_API_URL) {
    _shareViaBot(dataURL, chatId);
  } else {
    merged.toBlob(blob => _showShareModal(dataURL, blob), 'image/png');
  }
}

function _shareViaBot(dataURL, chatId) {
  _showToast('📤 Отправляем...');

  fetch(SHARE_API_URL, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id:      chatId,
      image_base64: dataURL,
      title:        artwork.title,
    }),
  })
  .then(r => r.json())
  .then(result => {
    if (result.ok) {
      _showToast('✅ Фото отправлено в Telegram!');
    } else {
      _showToast('❌ Ошибка отправки');
    }
  })
  .catch(() => {
    _showToast('❌ Нет соединения');
  });
}

function _showShareModal(dataURL, blob) {
  const modal = document.createElement('div');
  modal.className = 'share-modal';

  const inner = document.createElement('div');
  inner.className = 'share-modal-inner';

  inner.innerHTML = `
    <h3>Сохранить работу</h3>
    <img src="${dataURL}" alt="Your coloring"
         style="max-width:100%;border-radius:8px;margin:12px 0;display:block"/>
    <p class="share-hint">Зажмите изображение чтобы сохранить его в галерею.</p>
  `;

  const closeBtn = document.createElement('button');
  closeBtn.className = 'share-close-btn';
  closeBtn.textContent = 'Закрыть';
  closeBtn.addEventListener('click', () => document.body.removeChild(modal));

  modal.addEventListener('click', e => {
    if (e.target === modal) document.body.removeChild(modal);
  });

  inner.appendChild(closeBtn);
  modal.appendChild(inner);
  document.body.appendChild(modal);
}

  // ── Helpers ────────────────────────────────────────────────────────────────

  function _showToast(msg) {
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => t.classList.add('toast-show'), 10);
    setTimeout(() => {
      t.classList.remove('toast-show');
      setTimeout(() => document.body.removeChild(t), 300);
    }, 2200);
  }

  function _showPrecisionIndicator(x, y) {
    // Brief visual feedback for precision mode
    const dot = document.createElement('div');
    dot.className = 'precision-dot';
    dot.style.left = x + 'px';
    dot.style.top  = y + 'px';
    document.body.appendChild(dot);
    setTimeout(() => {
      if (dot.parentNode) dot.parentNode.removeChild(dot);
    }, 600);
    _showToast('🎯 Precision fill');
  }

  function _vibrate(ms) {
    if (navigator.vibrate) navigator.vibrate(ms);
  }

  // ── Public ─────────────────────────────────────────────────────────────────

  return { open, close, undo, redo };
})();
