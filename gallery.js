/**
 * gallery.js
 * Two-level navigation:
 *   Level 1 — category list screen
 *   Level 2 — artwork grid for selected category  (with Back button)
 *   Level 3 — My Works screen  (with Back button)
 */

const Gallery = (() => {

  // ── Artwork Catalog ────────────────────────────────────────────────────────

  const CATALOG = [
    // ── Mandalas ──────────────────────────────────────────────────────────────
    {
      id: 'flowers1',
      category: 'flowers',
      title: 'Sun Mandala',
      src: 'assets/flowers/flowers1.png',
      thumb: 'assets/flowers/flowers1.png',
      difficulty: 'Easy',
    },
    {
      id: 'flowers2',
      category: 'flowers',
      title: 'Sun Mandala',
      src: 'assets/flowers/flowers2.png',
      thumb: 'assets/flowers/flowers2.png',
      difficulty: 'Easy',
    },
    {
      id: 'flowers3',
      category: 'flowers',
      title: 'Sun Mandala',
      src: 'assets/flowers/flowers3.png',
      thumb: 'assets/flowers/flowers3.png',
      difficulty: 'Easy',
    },
    {
      id: 'flowers4',
      category: 'flowers',
      title: 'Sun Mandala',
      src: 'assets/flowers/flowers4.png',
      thumb: 'assets/flowers/flowers4.png',
      difficulty: 'Easy',
    },
    {
      id: 'doodle1',
      category: 'doodle',
      title: 'doodle',
      src: 'assets/doodle/doodle1.png',
      thumb: 'assets/doodle/doodle1.png',
      difficulty: 'Hard',
    },
    {
      id: 'doodle2',
      category: 'doodle',
      title: 'doodle',
      src: 'assets/doodle/doodle2.png',
      thumb: 'assets/doodle/doodle2.png',
      difficulty: 'Hard',
    },
    {
      id: 'doodle3',
      category: 'doodle',
      title: 'doodle',
      src: 'assets/doodle/doodle3.png',
      thumb: 'assets/doodle/doodle3.png',
      difficulty: 'Hard',
    },
    {
      id: 'doodle4',
      category: 'doodle',
      title: 'doodle',
      src: 'assets/doodle/doodle4.png',
      thumb: 'assets/doodle/doodle4.png',
      difficulty: 'Hard',
    },
        {
      id: 'doodle5',
      category: 'doodle',
      title: 'doodle',
      src: 'assets/doodle/doodle5.png',
      thumb: 'assets/doodle/doodle5.png',
      difficulty: 'Hard',
    },
    {
      id: 'doodle6',
      category: 'doodle',
      title: 'doodle',
      src: 'assets/doodle/doodle6.png',
      thumb: 'assets/doodle/doodle6.png',
      difficulty: 'Hard',
    },
    {
      id: 'myth1',
      category: 'myth',
      title: 'myth',
      src: 'assets/myth/myth1.png',
      thumb: 'assets/myth/myth1.png',
      difficulty: 'Hard',
    },
    {
      id: 'myth2',
      category: 'myth',
      title: 'myth',
      src: 'assets/myth/myth2.png',
      thumb: 'assets/myth/myth2.png',
      difficulty: 'Hard',
    },   
    {
      id: 'myth3',
      category: 'myth',
      title: 'myth',
      src: 'assets/myth/myth3.png',
      thumb: 'assets/myth/myth3.png',
      difficulty: 'Hard',
    },
  ];

  const CATEGORIES = [
    { id: 'flowers', label: 'flowers', icon: '☸️' },
    { id: 'doodle',    label: 'doodle',    icon: '🌌' },
    { id: 'myth',    label: 'myth',    icon: '🌌' },


  ];

  // ── State ──────────────────────────────────────────────────────────────────

  // 'categories' | 'artworks' | 'myworks'
  let currentView    = 'categories';
  let activeCategoryId = null;
  let onSelect       = null;
  let rootEl         = null;

  // ── Init ───────────────────────────────────────────────────────────────────

  function init(container, selectCallback) {
    rootEl   = container;
    onSelect = selectCallback;
    render();
  }

  // ── Main render dispatcher ─────────────────────────────────────────────────

  function render() {
    if (!rootEl) return;
    rootEl.innerHTML = '';

    if (currentView === 'categories') {
      _renderCategoryList();
    } else if (currentView === 'artworks') {
      _renderArtworkGrid();
    } else if (currentView === 'myworks') {
      _renderMyWorks();
    }
  }

  // ── Level 1: Category list ─────────────────────────────────────────────────

  function _renderCategoryList() {
    // Header
    const header = document.createElement('div');
    header.className = 'gallery-header';
    header.innerHTML = `
      <h1 class="gallery-title">Color Book</h1>
      <p class="gallery-subtitle">Anti-stress coloring for adults</p>
    `;
    rootEl.appendChild(header);

    const content = document.createElement('div');
    content.className = 'gallery-content';

    // Category cards
    const grid = document.createElement('div');
    grid.className = 'category-grid';

    CATEGORIES.forEach(cat => {
      const count = CATALOG.filter(a => a.category === cat.id).length;
      const inProgress = CATALOG.filter(a =>
        a.category === cat.id && Storage.loadProgress(a.id)
      ).length;

      const card = document.createElement('button');
      card.className = 'category-card';
      card.innerHTML = `
        <span class="category-card-icon">${cat.icon}</span>
        <span class="category-card-label">${cat.label}</span>
        <span class="category-card-meta">${count} images${inProgress ? ` · ${inProgress} in progress` : ''}</span>
      `;
      card.addEventListener('click', () => {
        activeCategoryId = cat.id;
        currentView = 'artworks';
        render();
      });
      grid.appendChild(card);
    });

    // My Works card
    const myWorksCount = Storage.getSavedWorks().length;
    const myCard = document.createElement('button');
    myCard.className = 'category-card category-card-myworks';
    myCard.innerHTML = `
      <span class="category-card-icon">🎨</span>
      <span class="category-card-label">My Works</span>
      <span class="category-card-meta">${myWorksCount} saved</span>
    `;
    myCard.addEventListener('click', () => {
      currentView = 'myworks';
      render();
    });
    grid.appendChild(myCard);

    content.appendChild(grid);
    rootEl.appendChild(content);
  }

  // ── Level 2: Artwork grid ──────────────────────────────────────────────────

  function _renderArtworkGrid() {
    const cat = CATEGORIES.find(c => c.id === activeCategoryId);

    // Toolbar with back button
    const toolbar = _buildBackToolbar(cat ? `${cat.icon} ${cat.label}` : 'Back', () => {
      currentView = 'categories';
      render();
    });
    rootEl.appendChild(toolbar);

    const content = document.createElement('div');
    content.className = 'gallery-content';

    const items = CATALOG.filter(a => a.category === activeCategoryId);

    if (items.length === 0) {
      content.innerHTML = '<p class="gallery-empty">No images yet.</p>';
    } else {
      const grid = document.createElement('div');
      grid.className = 'artwork-grid';
      items.forEach(artwork => grid.appendChild(_buildArtworkCard(artwork)));
      content.appendChild(grid);
    }

    rootEl.appendChild(content);
  }

  // ── Level 2: My Works ──────────────────────────────────────────────────────

  function _renderMyWorks() {
    const toolbar = _buildBackToolbar('🎨 My Works', () => {
      currentView = 'categories';
      render();
    });
    rootEl.appendChild(toolbar);

    const content = document.createElement('div');
    content.className = 'gallery-content';

    const works = Storage.getSavedWorks();

    if (works.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'gallery-empty';
      empty.innerHTML = `
        <div class="empty-icon">🎨</div>
        <p>No saved works yet.</p>
        <p class="empty-sub">Color an image and tap Save to see it here.</p>
      `;
      content.appendChild(empty);
    } else {
      const grid = document.createElement('div');
      grid.className = 'artwork-grid';
      works.forEach(work => grid.appendChild(_buildSavedWorkCard(work)));
      content.appendChild(grid);
    }

    rootEl.appendChild(content);
  }

  // ── Shared helpers ─────────────────────────────────────────────────────────

  function _buildBackToolbar(title, onBack) {
    const toolbar = document.createElement('div');
    toolbar.className = 'gallery-toolbar';

    const backBtn = document.createElement('button');
    backBtn.className = 'gallery-back-btn';
    backBtn.innerHTML = '&#8592; Back';
    backBtn.addEventListener('click', onBack);

    const titleEl = document.createElement('span');
    titleEl.className = 'gallery-toolbar-title';
    titleEl.textContent = title;

    toolbar.appendChild(backBtn);
    toolbar.appendChild(titleEl);
    return toolbar;
  }

  function _buildArtworkCard(artwork) {
    const card = document.createElement('div');
    card.className = 'artwork-card';

    const hasProgress = !!Storage.loadProgress(artwork.id);
    if (hasProgress) card.classList.add('has-progress');

    const thumbWrap = document.createElement('div');
    thumbWrap.className = 'artwork-thumb';

    const thumbCanvas = document.createElement('canvas');
    thumbCanvas.width  = 200;
    thumbCanvas.height = 200;
    thumbWrap.appendChild(thumbCanvas);
    _drawThumbCanvas(thumbCanvas, artwork);

    const badge = document.createElement('span');
    badge.className = `difficulty-badge difficulty-${artwork.difficulty.toLowerCase()}`;
    badge.textContent = artwork.difficulty;
    thumbWrap.appendChild(badge);

    if (hasProgress) {
      const prog = document.createElement('span');
      prog.className = 'progress-dot';
      prog.title = 'In progress';
      thumbWrap.appendChild(prog);
    }

    card.appendChild(thumbWrap);

    const label = document.createElement('div');
    label.className = 'artwork-label';
    label.textContent = artwork.title;
    card.appendChild(label);

    card.addEventListener('click', () => { if (onSelect) onSelect(artwork); });
    return card;
  }

  function _drawThumbCanvas(canvas, artwork) {
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, W, H);

    const drawImg = (url) => new Promise(resolve => {
      const img = new Image();
      img.onload  = () => { ctx.drawImage(img, 0, 0, W, H); resolve(); };
      img.onerror = () => resolve();
      img.src = url;
    });

    const progressURL = Storage.loadProgress(artwork.id);
    if (progressURL) {
      drawImg(progressURL).then(() => drawImg(artwork.thumb));
    } else {
      drawImg(artwork.thumb);
    }
  }

  function _buildSavedWorkCard(work) {
    const card = document.createElement('div');
    card.className = 'artwork-card saved-work-card';

    const thumbWrap = document.createElement('div');
    thumbWrap.className = 'artwork-thumb';

    const img = document.createElement('img');
    img.src = work.dataURL;
    img.alt = work.title;
    img.style.cssText = 'width:100%;height:100%;object-fit:cover;border-radius:8px;';
    thumbWrap.appendChild(img);

    const del = document.createElement('button');
    del.className = 'card-delete-btn';
    del.innerHTML = '✕';
    del.addEventListener('click', e => {
      e.stopPropagation();
      if (confirm('Delete this saved work?')) {
        Storage.deleteSavedWork(work.id);
        render();
      }
    });
    thumbWrap.appendChild(del);
    card.appendChild(thumbWrap);

    const label = document.createElement('div');
    label.className = 'artwork-label';
    const date = new Date(work.date);
    label.innerHTML = `<span>${work.title}</span><span class="work-date">${date.toLocaleDateString()}</span>`;
    card.appendChild(label);

    card.addEventListener('click', () => {
      const artwork = CATALOG.find(a => a.id === work.imageId);
      if (artwork && onSelect) onSelect(artwork);
    });

    return card;
  }

  // ── Public ─────────────────────────────────────────────────────────────────

  function getArtwork(id) { return CATALOG.find(a => a.id === id) || null; }
  function getCatalog()   { return CATALOG; }

  function refreshMyWorks() {
    if (currentView === 'myworks') render();
  }

  // Navigate back to category list (called by app.js Telegram BackButton)
  function navigateBack() {
    if (currentView === 'artworks' || currentView === 'myworks') {
      currentView = 'categories';
      render();
      return true; // handled
    }
    return false; // nothing to go back to
  }

  function isAtRoot() {
    return currentView === 'categories';
  }

  return { init, render, getArtwork, getCatalog, refreshMyWorks, navigateBack, isAtRoot };
})();
