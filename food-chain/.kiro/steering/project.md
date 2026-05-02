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

## Key constraints
- Desktop-only — no mobile breakpoints needed
- No persistence — projects are in-session React state only
- LLM is not the source of truth for ecological validity — rule engine is
- Species data in `src/data/species.js` is the authoritative dataset for v1
