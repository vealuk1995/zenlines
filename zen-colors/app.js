/**
 * app.js
 * Application entry point.
 * Manages screen navigation between Gallery and Coloring views.
 * Initializes Telegram WebApp integration.
 */

const App = (() => {

  // ── Screens ────────────────────────────────────────────────────────────────

  const SCREEN_GALLERY  = 'gallery';
  const SCREEN_COLORING = 'coloring';

  let currentScreen = null;

  // ── DOM refs ───────────────────────────────────────────────────────────────

  let galleryScreen  = null;
  let coloringScreen = null;

  // ── Init ───────────────────────────────────────────────────────────────────

  function init() {
    _initTelegram();
    _buildLayout();
    _applyTheme();
    _navigateToGallery();
    _handleLastArtwork();
  }

  // ── Telegram Integration ───────────────────────────────────────────────────

  function _initTelegram() {
    if (!window.Telegram || !window.Telegram.WebApp) return;

    const tg = window.Telegram.WebApp;
    tg.ready();
    tg.expand();

    // Apply Telegram theme colors
    const root = document.documentElement;
    if (tg.themeParams) {
      const p = tg.themeParams;
      if (p.bg_color)         root.style.setProperty('--tg-bg',      p.bg_color);
      if (p.text_color)       root.style.setProperty('--tg-text',    p.text_color);
      if (p.button_color)     root.style.setProperty('--tg-accent',  p.button_color);
      if (p.secondary_bg_color) root.style.setProperty('--tg-surface', p.secondary_bg_color);
    }

    // Use Telegram back button
    tg.BackButton.onClick(() => {
      if (currentScreen === SCREEN_COLORING) {
        _navigateToGallery();
      } else if (currentScreen === SCREEN_GALLERY) {
        // Navigate back within gallery levels
        const handled = Gallery.navigateBack();
        if (!handled) tg.BackButton.hide();
      }
    });
  }

  // ── Layout ─────────────────────────────────────────────────────────────────

  function _buildLayout() {
    const app = document.getElementById('app');

    galleryScreen = document.createElement('div');
    galleryScreen.id = 'screen-gallery';
    galleryScreen.className = 'screen screen-gallery';
    app.appendChild(galleryScreen);

    coloringScreen = document.createElement('div');
    coloringScreen.id = 'screen-coloring';
    coloringScreen.className = 'screen screen-coloring hidden';
    app.appendChild(coloringScreen);

    // Init gallery
    Gallery.init(galleryScreen, (artwork) => {
      _navigateToColoring(artwork);
    });
  }

  // ── Theme ──────────────────────────────────────────────────────────────────

  function _applyTheme() {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const tgColorScheme = window.Telegram?.WebApp?.colorScheme;

    const isDark = tgColorScheme === 'dark' || (!tgColorScheme && prefersDark);
    document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');

    // Listen for system changes
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
      if (!window.Telegram?.WebApp?.colorScheme) {
        document.documentElement.setAttribute('data-theme', e.matches ? 'dark' : 'light');
      }
    });
  }

  // ── Navigation ─────────────────────────────────────────────────────────────

  function _navigateToGallery() {
    if (currentScreen === SCREEN_COLORING) {
      Coloring.close();
    }

    galleryScreen.classList.remove('hidden');
    coloringScreen.classList.add('hidden');
    currentScreen = SCREEN_GALLERY;

    Gallery.render();

    // Hide Telegram back button on gallery
    if (window.Telegram?.WebApp?.BackButton) {
      window.Telegram.WebApp.BackButton.hide();
    }
  }

  function _navigateToColoring(artwork) {
    galleryScreen.classList.add('hidden');
    coloringScreen.classList.remove('hidden');
    currentScreen = SCREEN_COLORING;

    // Show Telegram back button
    if (window.Telegram?.WebApp?.BackButton) {
      window.Telegram.WebApp.BackButton.show();
    }

    Coloring.open(coloringScreen, artwork, () => {
      _navigateToGallery();
    });
  }

  function _handleLastArtwork() {
    // Auto-restore last opened artwork
    const lastId = Storage.getLastArtwork();
    if (lastId) {
      const artwork = Gallery.getArtwork(lastId);
      if (artwork && Storage.loadProgress(lastId)) {
        // Show resume prompt
        setTimeout(() => {
          _showResumePrompt(artwork);
        }, 400);
      }
    }
  }

  function _showResumePrompt(artwork) {
    const banner = document.createElement('div');
    banner.className = 'resume-banner';
    banner.innerHTML = `
      <div class="resume-banner-inner">
        <span>Continue <strong>${artwork.title}</strong>?</span>
        <button class="resume-yes">Resume</button>
        <button class="resume-no">✕</button>
      </div>
    `;

    banner.querySelector('.resume-yes').addEventListener('click', () => {
      document.body.removeChild(banner);
      _navigateToColoring(artwork);
    });
    banner.querySelector('.resume-no').addEventListener('click', () => {
      document.body.removeChild(banner);
    });

    document.body.appendChild(banner);
    setTimeout(() => banner.classList.add('resume-banner-show'), 50);

    // Auto dismiss after 5s
    setTimeout(() => {
      if (banner.parentNode) {
        banner.classList.remove('resume-banner-show');
        setTimeout(() => {
          if (banner.parentNode) document.body.removeChild(banner);
        }, 300);
      }
    }, 5000);
  }

  // ── Public ─────────────────────────────────────────────────────────────────

  return { init };
})();

// ── Bootstrap ────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  App.init();
});
