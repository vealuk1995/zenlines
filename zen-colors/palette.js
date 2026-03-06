/**
 * palette.js
 * Manages color palettes, custom colors, recent colors,
 * and the color picker UI rendered inside the coloring screen.
 */

const Palette = (() => {

  // ── Built-in palette definitions ──────────────────────────────────────────

  const PALETTES = {
    pastel: {
      label: 'Pastel',
      colors: [
        '#FFB3BA','#FFDFBA','#FFFFBA','#BAFFC9','#BAE1FF',
        '#E8BAFF','#FFB3E6','#B3FFF0','#FFF4BA','#D4BAFF',
        '#FFCCE0','#CCF2FF','#CCFFEA','#FFF0CC','#E0CCFF',
      ],
    },
    vintage: {
      label: 'Vintage',
      colors: [
        '#8B4513','#A0522D','#CD853F','#D2B48C','#DEB887',
        '#F5DEB3','#2F4F4F','#556B2F','#8FBC8F','#BC8F8F',
        '#696969','#808080','#A9A9A9','#C0C0C0','#DCDCDC',
      ],
    },
    nature: {
      label: 'Nature',
      colors: [
        '#2D5016','#4A7C2F','#6B9E3F','#8BBF55','#A8D66D',
        '#3B7D4E','#52A86B','#78C990','#1A5276','#2E86AB',
        '#52B788','#74C69D','#95D5B2','#B7E4C7','#D8F3DC',
      ],
    },
    neon: {
      label: 'Neon',
      colors: [
        '#FF0080','#FF0040','#FF4000','#FF8000','#FFFF00',
        '#80FF00','#00FF80','#00FFFF','#0080FF','#8000FF',
        '#FF00FF','#FF80FF','#80FFFF','#FFFF80','#FF8080',
      ],
    },
    basic: {
      label: 'Basic',
      colors: [
        '#000000','#FFFFFF','#FF0000','#00FF00','#0000FF',
        '#FFFF00','#FF00FF','#00FFFF','#FF8C00','#800080',
        '#008000','#800000','#000080','#808000','#008080',
      ],
    },
  };

  // ── State ──────────────────────────────────────────────────────────────────

  let selectedColor   = '#FF6B6B';
  let activePalette   = 'pastel';
  let onColorChange   = null;  // callback(hex)
  let paletteEl       = null;  // root DOM element

  // ── Init ───────────────────────────────────────────────────────────────────

  /**
   * Render the palette UI into a container element.
   * @param {HTMLElement} container
   * @param {function} onChange  called with hex string when color changes
   */
  function init(container, onChange) {
    onColorChange = onChange;
    paletteEl = container;
    _render();
  }

  // ── Rendering ──────────────────────────────────────────────────────────────

  function _render() {
    if (!paletteEl) return;
    paletteEl.innerHTML = '';

    // Recent colors row
    const recentSection = _buildRecentSection();
    paletteEl.appendChild(recentSection);

    // Palette tabs
    const tabBar = _buildTabBar();
    paletteEl.appendChild(tabBar);

    // Color swatches
    const swatchGrid = _buildSwatchGrid();
    paletteEl.appendChild(swatchGrid);

    // Custom colors + picker
    const customSection = _buildCustomSection();
    paletteEl.appendChild(customSection);
  }

  function _buildRecentSection() {
    const section = document.createElement('div');
    section.className = 'palette-section palette-recent';

    const label = document.createElement('span');
    label.className = 'palette-label';
    label.textContent = 'Recent';
    section.appendChild(label);

    const row = document.createElement('div');
    row.className = 'recent-colors-row';

    const recents = Storage.getRecentColors();
    if (recents.length === 0) {
      const empty = document.createElement('span');
      empty.className = 'palette-empty';
      empty.textContent = 'No recent colors';
      row.appendChild(empty);
    } else {
      recents.forEach(hex => {
        row.appendChild(_makeSwatch(hex, true));
      });
    }

    section.appendChild(row);
    return section;
  }

  function _buildTabBar() {
    const bar = document.createElement('div');
    bar.className = 'palette-tabs';

    Object.entries(PALETTES).forEach(([key, pal]) => {
      const tab = document.createElement('button');
      tab.className = 'palette-tab' + (key === activePalette ? ' active' : '');
      tab.textContent = pal.label;
      tab.addEventListener('click', () => {
        activePalette = key;
        _render();
      });
      bar.appendChild(tab);
    });

    return bar;
  }

  function _buildSwatchGrid() {
    const grid = document.createElement('div');
    grid.className = 'swatch-grid';

    const palette = PALETTES[activePalette];
    palette.colors.forEach(hex => {
      grid.appendChild(_makeSwatch(hex, false));
    });

    return grid;
  }

  function _buildCustomSection() {
    const section = document.createElement('div');
    section.className = 'palette-section palette-custom';

    const label = document.createElement('span');
    label.className = 'palette-label';
    label.textContent = 'My Colors';
    section.appendChild(label);

    const row = document.createElement('div');
    row.className = 'custom-colors-row';

    // Add-color button (opens native color picker)
    const addBtn = document.createElement('button');
    addBtn.className = 'swatch swatch-add';
    addBtn.title = 'Add custom color';
    addBtn.innerHTML = '<span>+</span>';

    // Hidden color input
    const colorInput = document.createElement('input');
    colorInput.type = 'color';
    colorInput.value = selectedColor;
    colorInput.style.cssText = 'position:absolute;width:0;height:0;opacity:0;pointer-events:none';
    addBtn.appendChild(colorInput);

    addBtn.addEventListener('click', () => {
      colorInput.click();
    });
    colorInput.addEventListener('change', () => {
      const hex = colorInput.value.toUpperCase();
      Storage.addCustomColor(hex);
      _selectColor(hex);
      _render();
    });

    row.appendChild(addBtn);

    // Existing custom colors
    Storage.getCustomColors().forEach(hex => {
      const sw = _makeSwatch(hex, false, true);
      row.appendChild(sw);
    });

    section.appendChild(row);
    return section;
  }

  function _makeSwatch(hex, isRecent, isCustom) {
    const sw = document.createElement('button');
    sw.className = 'swatch' + (hex === selectedColor ? ' swatch-selected' : '');
    sw.style.backgroundColor = hex;
    sw.title = hex;

    sw.addEventListener('click', () => {
      _selectColor(hex);
    });

    // Long press to remove custom colors
    if (isCustom) {
      let timer;
      sw.addEventListener('touchstart', () => {
        timer = setTimeout(() => {
          if (confirm('Remove this color?')) {
            Storage.removeCustomColor(hex);
            _render();
          }
        }, 700);
      }, { passive: true });
      sw.addEventListener('touchend', () => clearTimeout(timer), { passive: true });
    }

    return sw;
  }

  function _selectColor(hex) {
    selectedColor = hex;
    Storage.pushRecentColor(hex);
    if (onColorChange) onColorChange(hex);
    _render();
  }

  // ── Public ─────────────────────────────────────────────────────────────────

  function getSelectedColor() {
    return selectedColor;
  }

  function setSelectedColor(hex) {
    _selectColor(hex);
  }

  function refresh() {
    _render();
  }

  return {
    init,
    getSelectedColor,
    setSelectedColor,
    refresh,
    PALETTES,
  };
})();
