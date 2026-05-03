# Ecosystem Builder — Project Steering

## What this project is
A desktop-first React web app for designing realistic ecosystems. Users pick a city (outdoor mode) or skip location (terrarium/aquarium mode), then drag-and-drop species onto a canvas to build a food web.

## Tech stack
- React 18 + Vite (no Next.js, no SSR)
- React Router v6 for client-side routing
- Three.js (`three@0.176.0`) for the WebGL globe on the homepage
- Font Awesome 6 (CDN in index.html) for icons
- Plain CSS (field-guide aesthetic — no Tailwind, no CSS-in-JS, no component libraries)
- No backend — all data is in `src/data/` as JS modules

## Project structure
```
food-chain/
  index.html                  # Vite entry — loads FA CDN + Google Fonts
  src/
    main.jsx                  # entry point
    App.jsx                   # routes + shared project state (fade transitions)
    styles.css                # all styles — single file, field-guide design system
    data/
      species.js              # 40 species + real Wikimedia photo URLs + SVG fallbacks
      placeholders.js         # SVG placeholder generator (fallback only)
      facts.js                # 100 nature facts + getRandomFacts(n)
    pages/
      HomePage.jsx            # WebGL globe + pill input + terrarium bypass
      ProjectDashboard.jsx    # project grid + new project modal
      EcosystemBuilder.jsx    # 3-column builder layout + topbar
    components/
      GlobeScene.jsx          # Three.js WebGL globe
      SpeciesLibraryPanel.jsx # left sidebar: search + 3 tabs + filter dropdown
      EcosystemCanvas.jsx     # center: pan/zoom canvas, SVG edges, nodes, health panel
      SpeciesInfoPanel.jsx    # right: species detail, eats/eaten-by
      HealthScorePanel.jsx    # health score ring + trophic bar + warnings + improve button
      SpeciesPhoto.jsx        # img wrapper with onError fallback to SVG placeholder
```

## Design system
- Fonts: Cormorant Garamond (serif), JetBrains Mono (mono), Caveat (handwritten)
- Base palette: `--paper` #f4ecd8, `--ink` #2a2520, `--sage` #6b7c5a, `--rust` #a85d3a, `--mustard` #b8893d
- Accent colors: `--tidal` #3a7ca8 (tidal blue), `--sage-light` #a8c090
- Radius tokens: `--r-sm` 8px, `--r-md` 14px, `--r-lg` 22px, `--r-pill` 999px
- All styles in `src/styles.css`
- Hover states: tidal blue for most UI, brown (#6b4226) for primary actions and zoom controls

## Accent color usage
- **Tidal blue** (`--tidal`): active chips, icon-btn hover, edge highlights, sidebar tab active
- **Brown** (#6b4226): go button on homepage, zoom button hover, sidebar tab active fill, "Improve Ecosystem" button hover

## Homepage design
- Full-screen dark background (`#0d1a12`) with Three.js WebGL globe
- Globe: NASA Blue Marble + bump map, 2200 stars, tidal rim light, atmosphere glow, auto-spin 0.12 rad/s
- On submit: overlay fades + scales out, globe spin ramps to +32 rad/s (cubic ease-in), camera zooms in, navigates to `/builder`
- 4 random nature facts at fixed positions around globe
- Title: "model your ecosystem — don't just imagine it." — frosted glass pill input, brown go button (FA arrow, no movement on hover)
- Bottom stats: 40 species · 5 environments · ∞ combinations

## App flow
- Homepage submit → auto-creates `"<City> Ecosystem"` project → `/builder`
- Terrarium bypass → auto-creates `"My Terrarium"` → `/builder`
- Route transitions: 0.4s fade-out old page, 0.4s fade-in new page

## Builder layout
- 3-column grid: `300px sidebar | 1fr canvas | 320px detail panel`
- Topbar (52px, frosted glass): brand · ecosystem name · species count · home / clear (inline confirm) / save (stub)
- Left: SpeciesLibraryPanel
- Center: EcosystemCanvas + HealthScorePanel (fixed overlay)
- Right: SpeciesInfoPanel

## Sidebar (SpeciesLibraryPanel)
- Search input always visible at top
- 3 pill tabs below: **All** (resets filters) | **Compatible** (stub) | **More Filters** (dropdown)
- More Filters dropdown: Type / Climate / Habitat / Compatibility sections with chip filters
- Species list: photo (rounded rect, overflow hidden) + name + latin + trophic tag
- Drag uses pointer events (no HTML5 drag API) — floating ghost image follows cursor
- Double-click also adds to canvas

## Canvas (EcosystemCanvas)
- Pan: pointer-drag on background
- Zoom: scroll wheel (toward cursor) or buttons (from center), range 0.2×–3×
- Zoom controls (bottom-right): `fa-magnifying-glass-plus` | `fa-arrows-to-dot` (reset) | `fa-magnifying-glass-minus` — horizontal row
- Sort button below zoom: `fa-arrow-down-wide-short` + "Sort by level" — arranges nodes apex→top, producers→bottom
- Fixed overlays (outside transform): health panel, legend, zoom/sort controls
- Transformed content: nodes, SVG edges (4000×4000, overflow visible), empty state
- Node remove button: top-right corner of photo, `fa-xmark`, appears on hover
- Edge clearance: asymmetric rounded-rect intersection (hw=46, ht_top=60, ht_bottom=62)
- Edge curve: bezier with offset capped at `min(18, len*0.12)`

## Health Score Panel (HealthScorePanel)
- Fixed at top-center of canvas, outside pan/zoom transform
- Two-row layout: top row = score ring + stats + improve button; bottom row = warnings (if any)
- Score ring: SVG arc colored by status (healthy=sage, developing=mustard, unstable=rust)
- Stats: species count, food web link count, trophic breakdown bar + legend
- Warnings: rust-colored pills with `fa-triangle-exclamation` icon + BADGE label + text
- "Improve Ecosystem" button: stacked icon (`fa-wand-magic-sparkles`) + text, outlined style, brown on hover — **stub for AI agent**

## Backend contracts (stubs awaiting implementation)

### 1. Compatible species filter
**Location:** `src/components/SpeciesLibraryPanel.jsx`
**Stub:** `if (tab === 'compatible') return false;` and `if (active.compatible) return false;`
**Interface needed:**
```js
getCompatibleSpecies(placedIds: Set<string>): Species[]
```

### 2. Health score engine
**Location:** `src/components/HealthScorePanel.jsx`
**Current:** Rule-based heuristics (no producer = -25, no prey = -15, habitat mismatch = -10)
**Interface needed:**
```js
computeHealth(nodes: { id: string }[]): { score: number, status: string, warnings: Warning[] }
```

### 3. Species data enrichment
**Location:** `src/data/species.js`
**Current:** 40 species, real Wikimedia photo URLs, SVG fallbacks
**Keep stable:** `SPECIES` array export and `SPECIES_BY_ID` map

### 4. City → ecosystem seeding
**Location:** `src/App.jsx` → `handleStart({ city, mode })`
**Interface needed:**
```js
getSeedSpecies(city: string, mode: string): string[] // species IDs
```

### 5. Save project
**Location:** `EcosystemBuilder.jsx` topbar save button (currently disabled stub)
**Interface needed:** persist project + nodes to backend/storage

### 6. Improve Ecosystem (AI)
**Location:** `HealthScorePanel.jsx` — "Improve Ecosystem" button
**Expected:** AI agent provides feedback/recommendations based on current ecosystem state

## Key constraints
- Desktop-only — no mobile breakpoints
- No persistence yet — in-session React state only (until save is implemented)
- LLM is not the source of truth for ecological validity — rule engine is
- Species data in `src/data/species.js` is the authoritative dataset for v1
