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
    App.jsx                   # routes + shared project state
    styles.css                # all styles — single file, field-guide design system
    data/
      species.js              # 40 species records + SPECIES_BY_ID lookup
      placeholders.js         # SVG placeholder image generator
      facts.js                # 100 nature facts + getRandomFacts(n) helper
    pages/
      HomePage.jsx            # WebGL globe + pill input + terrarium bypass
      ProjectDashboard.jsx    # project grid + new project modal
      EcosystemBuilder.jsx    # 3-column builder layout
    components/
      GlobeScene.jsx          # Three.js WebGL globe component
      SpeciesLibraryPanel.jsx # left sidebar: search, filters, draggable species list
      EcosystemCanvas.jsx     # center: drag-drop canvas, SVG food-web edges, nodes
      SpeciesInfoPanel.jsx    # right: species detail, eats/eaten-by
      HealthScorePanel.jsx    # health score + warning pills overlaid on canvas
```

## Design system
- Fonts: Cormorant Garamond (serif), JetBrains Mono (mono), Caveat (handwritten)
- Base palette: `--paper` #f4ecd8, `--ink` #2a2520, `--sage` #6b7c5a, `--rust` #a85d3a, `--mustard` #b8893d
- Accent colors: `--tidal` #3a7ca8 (tidal blue), `--sage-light` #a8c090
- Radius tokens: `--r-sm` 8px, `--r-md` 14px, `--r-lg` 22px, `--r-pill` 999px
- All styles in `src/styles.css` — no inline styles except dynamic values (positions, background-image URLs)
- Chips, buttons, modals, project cards all use rounded corners (radius tokens)
- Hover states use tidal blue (`--tidal`) instead of flat ink

## Homepage design (current)
- Full-screen dark background (`#0d1a12`) with Three.js WebGL globe (GlobeScene)
- Globe: NASA Blue Marble texture + bump map, starfield (2200 stars on sphere shell r=8–20), tidal blue rim light, atmosphere glow, auto-spin at 0.12 rad/s
- On submit: overlay fades + scales out, globe spin ramps up (cubic ease-in, max +32 rad/s) while camera zooms in, then navigates to `/builder`
- 4 randomly picked nature facts from `src/data/facts.js` scattered at fixed positions around the globe (no rotation on text)
- Center overlay: title only ("model your ecosystem — don't just imagine it."), frosted glass pill input (45% opacity + backdrop-filter blur), brown go button (#6b4226) with FA arrow icon
- Bottom stat row: 40 species · 5 environments · ∞ combinations — numbers in off-white (#f0ebe0), labels in sage mono
- No eyebrow text, no tagline below title

## App flow
- Homepage city submit → auto-creates project named `"<City> Ecosystem"` → navigates directly to `/builder` (no dashboard step)
- Terrarium bypass → auto-creates `"My Terrarium"` project → navigates directly to `/builder`
- `/dashboard` still exists for managing multiple projects

## Agent roles
- **UI agent (this agent):** owns all React components, routing, styles, and interaction flows
- **Backend agent (separate):** will own `src/data/` schemas, rule engine, health score logic, recommendation engine
- **AI agent (separate):** will own LLM integration layer

## Backend contracts (stubs awaiting implementation)

### 1. Compatible species filter
**Location:** `src/components/SpeciesLibraryPanel.jsx`
**Stub:** `if (tab === 'compatible') return false;` and `if (active.compatible) return false;`
**Expected:** Given the current set of placed species IDs, return a filtered list of species that are ecologically compatible with the existing ecosystem. Compatibility criteria TBD by backend team (suggested: shared habitat/climate, food web fit, no invasive conflicts).
**Interface needed:**
```js
// src/data/compatibility.js (or API call)
getCompatibleSpecies(placedIds: Set<string>): Species[]
```

### 2. Health score engine
**Location:** `src/components/HealthScorePanel.jsx`
**Current:** Rule-based heuristics (no producer = -25, no prey = -15, etc.)
**Expected:** Replace `computeHealth(nodes)` with a proper ecological rule engine. Should return `{ score: number, status: 'healthy'|'developing'|'unstable', warnings: Warning[] }`.
**Interface needed:**
```js
// src/data/healthEngine.js (or API call)
computeHealth(nodes: { id: string }[]): HealthResult
```

### 3. Species data enrichment
**Location:** `src/data/species.js`
**Current:** 40 hand-authored species with `eats[]` / `eatenBy[]` arrays
**Expected:** Backend team to expand dataset, validate ecological relationships, and potentially replace with a structured DB or JSON schema. The `SPECIES` array and `SPECIES_BY_ID` map are the UI's only dependency — keep those exports stable.

### 4. City → ecosystem seeding
**Location:** `src/App.jsx` → `handleStart({ city, mode })`
**Current:** Creates a blank project with just a name
**Expected:** Given a city name, suggest a starter set of species appropriate for that region (e.g. "Austin, TX" → backyard temperate/arid mix). Backend should expose:
```js
getSeedSpecies(city: string, mode: string): string[] // array of species IDs
```

## Key constraints
- Desktop-only — no mobile breakpoints needed
- No persistence — projects are in-session React state only
- LLM is not the source of truth for ecological validity — rule engine is
- Species data in `src/data/species.js` is the authoritative dataset for v1
