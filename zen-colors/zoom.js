/**
 * zoom.js
 * Handles pinch-to-zoom and pan gestures for the coloring canvas.
 *
 * Coordinate conversion (clientToCanvas):
 *   The wrapper sits centered in the container and is transformed as:
 *   translate(offsetX, offsetY) scale(scale)  — transformOrigin: center center
 *
 *   Transformed top-left of canvas in screen space:
 *     tOriginX = containerCenterX + offsetX - (cssW / 2) * scale
 *     tOriginY = containerCenterY + offsetY - (cssH / 2) * scale
 *
 *   Canvas pixel coords:
 *     localCSS = (client - tOrigin) / scale
 *     pixel    = localCSS * (canvasEl.width / cssW)
 */

const Zoom = (() => {

  const MIN_SCALE = 1.0;
  const MAX_SCALE = 5.0;

  let state = { scale: 1, offsetX: 0, offsetY: 0 };

  let wrapper     = null;
  let containerEl = null;
  let onTransform = null;

  // Touch tracking
  let lastTouchDist = 0;
  let lastMidX      = 0;
  let lastMidY      = 0;
  let isPanning     = false;
  let panStartX     = 0;
  let panStartY     = 0;
  let panStartOffX  = 0;
  let panStartOffY  = 0;

  // ── Init ───────────────────────────────────────────────────────────────────

  function init(wrapEl, container, onChange) {
    wrapper     = wrapEl;
    containerEl = container;
    onTransform = onChange;

    state = { scale: 1, offsetX: 0, offsetY: 0 };
    _applyTransform();

    container.addEventListener('touchstart',  _onTouchStart, { passive: false });
    container.addEventListener('touchmove',   _onTouchMove,  { passive: false });
    container.addEventListener('touchend',    _onTouchEnd,   { passive: true });
    container.addEventListener('touchcancel', _onTouchEnd,   { passive: true });
  }

  function destroy() {
    if (!containerEl) return;
    containerEl.removeEventListener('touchstart',  _onTouchStart);
    containerEl.removeEventListener('touchmove',   _onTouchMove);
    containerEl.removeEventListener('touchend',    _onTouchEnd);
    containerEl.removeEventListener('touchcancel', _onTouchEnd);
    wrapper     = null;
    containerEl = null;
  }

  // ── Touch handlers ─────────────────────────────────────────────────────────

  function _onTouchStart(e) {
    if (e.touches.length === 2) {
      e.preventDefault();
      lastTouchDist = _getTouchDist(e.touches);
      const mid = _getTouchMid(e.touches);
      lastMidX  = mid.x;
      lastMidY  = mid.y;
      isPanning = false;
    } else if (e.touches.length === 1 && state.scale > 1) {
      isPanning    = true;
      panStartX    = e.touches[0].clientX;
      panStartY    = e.touches[0].clientY;
      panStartOffX = state.offsetX;
      panStartOffY = state.offsetY;
    }
  }

  function _onTouchMove(e) {
    if (e.touches.length === 2) {
      e.preventDefault();

      const dist = _getTouchDist(e.touches);
      const mid  = _getTouchMid(e.touches);

      const scaleDelta = dist / lastTouchDist;
      const newScale   = Math.min(MAX_SCALE, Math.max(MIN_SCALE, state.scale * scaleDelta));

      // Pan by midpoint movement
      state.offsetX += (mid.x - lastMidX);
      state.offsetY += (mid.y - lastMidY);

      // Scale around the pinch midpoint
      const cRect   = containerEl.getBoundingClientRect();
      const centerX = cRect.left + cRect.width  / 2;
      const centerY = cRect.top  + cRect.height / 2;

      const relX = mid.x - centerX - state.offsetX;
      const relY = mid.y - centerY - state.offsetY;
      const sf   = newScale / state.scale;

      state.offsetX -= relX * (sf - 1);
      state.offsetY -= relY * (sf - 1);
      state.scale    = newScale;

      lastTouchDist = dist;
      lastMidX = mid.x;
      lastMidY = mid.y;

      _clampOffset();
      _applyTransform();

    } else if (e.touches.length === 1 && isPanning) {
      e.preventDefault();
      state.offsetX = panStartOffX + (e.touches[0].clientX - panStartX);
      state.offsetY = panStartOffY + (e.touches[0].clientY - panStartY);
      _clampOffset();
      _applyTransform();
    }
  }

  function _onTouchEnd(e) {
    if (e.touches.length < 2) lastTouchDist = 0;
    if (e.touches.length === 0) {
      isPanning = false;
      if (state.scale < 1.05) {
        state = { scale: 1, offsetX: 0, offsetY: 0 };
        _applyTransform();
      }
    }
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  function _getTouchDist(touches) {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy) || 1;
  }

  function _getTouchMid(touches) {
    return {
      x: (touches[0].clientX + touches[1].clientX) / 2,
      y: (touches[0].clientY + touches[1].clientY) / 2,
    };
  }

  function _clampOffset() {
    if (!wrapper || !containerEl) return;
    const cw = containerEl.clientWidth;
    const ch = containerEl.clientHeight;
    const ww = wrapper.offsetWidth  * state.scale;
    const wh = wrapper.offsetHeight * state.scale;
    const maxX = Math.max(0, (ww - cw) / 2 + cw * 0.25);
    const maxY = Math.max(0, (wh - ch) / 2 + ch * 0.25);
    state.offsetX = Math.min(maxX, Math.max(-maxX, state.offsetX));
    state.offsetY = Math.min(maxY, Math.max(-maxY, state.offsetY));
  }

  function _applyTransform() {
    if (!wrapper) return;
    wrapper.style.transform =
      `translate(${state.offsetX}px, ${state.offsetY}px) scale(${state.scale})`;
    wrapper.style.transformOrigin = 'center center';
    if (onTransform) onTransform({ ...state });
  }

  // ── Public ─────────────────────────────────────────────────────────────────

  /**
   * Convert screen coords to canvas pixel coords,
   * accounting for translate + scale transform on the wrapper.
   *
   * Transform model (transformOrigin = center center):
   *   Transformed canvas top-left in screen space:
   *     tOriginX = containerCenterX + offsetX - (cssW / 2) * scale
   *     tOriginY = containerCenterY + offsetY - (cssH / 2) * scale
   *
   *   Canvas pixel:
   *     px = ((clientX - tOriginX) / scale) * (canvasEl.width / cssW)
   */
  function clientToCanvas(clientX, clientY, canvasEl) {
    if (!containerEl) return { x: 0, y: 0 };

    const cRect   = containerEl.getBoundingClientRect();
    const centerX = cRect.left + cRect.width  / 2;
    const centerY = cRect.top  + cRect.height / 2;

    const cssW = canvasEl.offsetWidth;
    const cssH = canvasEl.offsetHeight;

    // Top-left of the canvas as it appears on screen after transform
    const tOriginX = centerX + state.offsetX - (cssW / 2) * state.scale;
    const tOriginY = centerY + state.offsetY - (cssH / 2) * state.scale;

    // Position within the canvas in CSS pixels (un-scaled)
    const localX = (clientX - tOriginX) / state.scale;
    const localY = (clientY - tOriginY) / state.scale;

    // Convert CSS pixels → canvas buffer pixels
    const px = Math.round(localX * (canvasEl.width  / cssW));
    const py = Math.round(localY * (canvasEl.height / cssH));

    return { x: px, y: py };
  }

  function getScale() { return state.scale; }
  function getState() { return { ...state }; }

  function reset() {
    state = { scale: 1, offsetX: 0, offsetY: 0 };
    _applyTransform();
  }

  return { init, destroy, clientToCanvas, getScale, getState, reset };
})();
