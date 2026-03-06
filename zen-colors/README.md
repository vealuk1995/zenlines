# 🎨 Color Book — Anti-Stress Coloring Telegram Mini App

A fully client-side, mobile-first coloring book app built with HTML, CSS, and Vanilla JavaScript.
Designed as a Telegram Mini App. No frameworks, no backend, no build step required.

---

## Project Structure

```
/project
  index.html       Main HTML entry point
  styles.css       All styles (mobile-first, dark mode)
  app.js           App init, screen navigation, Telegram integration
  gallery.js       Gallery screen, artwork catalog
  coloring.js      Canvas engine, fill, undo/redo, autosave
  zoom.js          Pinch-to-zoom and pan gestures
  palette.js       Color palettes and custom color picker
  storage.js       All LocalStorage read/write logic

  /assets
    /mandalas      mandala_01.png … mandala_03.png
    /cities        city_01.png … city_04.png
    /space         space_01.png … space_03.png
    README.md      Instructions for adding images
```

---

## How to Host the App

### Option 1 — Static file hosting (simplest)

Any static host works:
- **GitHub Pages**: Push the project folder to a repo, enable Pages.
- **Netlify / Vercel**: Drag and drop the folder.
- **Your own VPS**: Serve with nginx or any web server.

The app requires no server-side logic. Just serve `index.html` and all files.

### Option 2 — Local testing

Open `index.html` in a browser directly (`file://` path).

> ⚠️ Some browsers block `getImageData()` on local files due to CORS.  
> Use a local server instead: `python3 -m http.server 8080` then open `http://localhost:8080`

---

## How to Connect to Telegram as a Mini App

1. **Create or open your bot** with [@BotFather](https://t.me/BotFather).
2. Send `/newapp` to BotFather (or `/editapp` for existing bots).
3. Follow the prompts and paste your hosted HTTPS URL (e.g. `https://yoursite.com/colorbook/`).
4. BotFather gives you a direct link like `https://t.me/YourBot/colorbook`.
5. Share this link — users open it inside Telegram as a Mini App.

> **HTTPS is required.** Telegram rejects non-secure URLs.  
> For testing during development use [ngrok](https://ngrok.com): `ngrok http 8080`

The app auto-calls `Telegram.WebApp.ready()` and `Telegram.WebApp.expand()` on launch.  
It reads `Telegram.WebApp.themeParams` to apply the user's Telegram color scheme.

---

## How to Add New PNG Coloring Images

1. Prepare your PNG file (see requirements below).
2. Drop the file in the right folder:
   - `assets/mandalas/` for mandalas
   - `assets/cities/` for city scenes
   - `assets/space/` for space images
3. Open `gallery.js` and add an entry to the `CATALOG` array:

```js
{
  id: 'mandala_04',           // unique string — used as the LocalStorage key
  category: 'mandalas',       // 'mandalas' | 'cities' | 'space'
  title: 'Forest Mandala',
  src:   'assets/mandalas/mandala_04.png',
  thumb: 'assets/mandalas/mandala_04.png',
  difficulty: 'Medium',       // 'Easy' | 'Medium' | 'Hard'
},
```

No other changes needed. The gallery and coloring engine will handle everything else.

### PNG File Requirements

| Requirement | Detail |
|---|---|
| Line color | Solid black `#000000` |
| Line thickness | At least 3–5 pixels |
| Regions | Must be completely closed (no gaps) |
| Background | Transparent or white |
| Fillable areas | White or transparent |
| Recommended size | 800×800px – 1200×1200px |

---

## How LocalStorage Saves Progress

All state is stored in `localStorage` under these keys:

| Key | What it stores |
|---|---|
| `colorbook_progress` | JSON object: `{ [imageId]: dataURL }` — the paint canvas as a PNG data URL for each artwork |
| `colorbook_saved_works` | Array of finished colored images saved by the user (title, date, merged PNG) |
| `colorbook_custom_colors` | Array of hex strings the user added via the color picker |
| `colorbook_recent_colors` | Last 10 hex colors used (most recent first) |
| `colorbook_last_artwork` | The `id` of the last opened artwork |
| `colorbook_undo_history` | Lightweight history markers per image |

**Auto-save triggers:**
- Every 8 seconds while coloring
- When the user taps "Back"
- When the browser tab loses focus (`visibilitychange` event)

On next launch, the app detects the last opened artwork and shows a "Resume?" banner.  
The progress is automatically restored from the saved paint canvas data URL.

---

## How the PNG Fill Detection Works

The coloring engine uses a **Region Map** system for fast, mobile-optimized flood filling.

### Step 1 — Build the region map (once per image load)

When the PNG loads onto `baseCanvas`, the app calls `_buildRegionMap()`:

```
For every pixel (x, y) in the canvas:
  If pixel brightness < threshold → it's a border (black line)
  Else → it's a fillable area
```

A BFS (breadth-first search) flood fill assigns a unique integer `regionId`
to every contiguous group of non-border pixels.

The result is a flat `Uint32Array` of size `width × height`, where each cell
contains the `regionId` of the pixel at that position (0 = border).

### Step 2 — User taps

```
tapX, tapY → look up regionMap[y * W + x] → get regionId
```

### Step 3 — Fill the region

Instead of a slow per-tap flood fill, the engine iterates the pre-built `regionMap`
and collects all pixels with matching `regionId`. These are painted all at once
with a short staggered animation (200ms, 8 batches) to simulate color spreading.

### Why this is fast

- Region map is computed **once** per image (cached in memory for the session).
- Filling is a single array scan — O(n) where n = canvas pixels.
- No recursive flood fill on every tap.
- Works correctly at any zoom level (coordinates are converted back to canvas space).

### Border detection threshold

```js
const BORDER_THRESHOLD = 80; // pixels with brightness < 80 are treated as borders
```

Adjust this in `coloring.js` if your PNGs have lighter/darker lines.

---

## Sharing

**In Telegram:** The Share button calls `Telegram.WebApp.shareToStory()` if available.  
**Fallback:** A modal appears with the merged image. Users can long-press to save, or tap Download PNG.

The exported image is a flat merge of the paint layer + line art layer on a white background.

---

## Browser Compatibility

Tested on:
- Safari iOS 15+
- Chrome Android 90+
- Firefox Android 110+
- Chrome Desktop (for testing)

Requires Canvas API + LocalStorage (supported in all modern browsers).
