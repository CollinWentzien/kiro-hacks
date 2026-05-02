# Ecosystem Builder — Project Steering

## What this project is
A desktop-first React web app for designing realistic ecosystems. Users pick a city (outdoor mode) or skip location (terrarium/aquarium mode), then drag-and-drop species onto a canvas to build a food web.

## Tech stack
- React 18 + Vite (no Next.js, no SSR)
- React Router v6 for client-side routing
- Plain CSS (field-guide aesthetic — no Tailwind, no CSS-in-JS, no component libraries)
- No backend — all data is in `src/data/` as JS modules

## Project structure
```
food-chain/
  src/
    main.jsx                  # entry point
    App.jsx                   # routes + shared project state
    styles.css                # all styles — single file, field-guide design system
    data/
      species.js              # 40 species records + SPECIES_BY_ID lookup
      placeholders.js         # SVG placeholder image generator
    pages/
      HomePage.jsx            # globe + city input + terrarium bypass
      ProjectDashboard.jsx    # project grid + new project modal
      EcosystemBuilder.jsx    # 3-column builder layout
    components/
      SpeciesLibraryPanel.jsx # left sidebar: search, filters, draggable species list
      EcosystemCanvas.jsx     # center: drag-drop canvas, SVG food-web edges, nodes
      SpeciesInfoPanel.jsx    # right: species detail, eats/eaten-by
      HealthScorePanel.jsx    # health score + warning pills overlaid on canvas
```

## Design system (do not change these)
- Fonts: Cormorant Garamond (serif), JetBrains Mono (mono), Caveat (handwritten)
- CSS variables: `--paper`, `--ink`, `--sage`, `--rust`, `--mustard`, `--rule`, etc. — all defined in `styles.css`
- Paper texture via CSS background-image on `.paper-bg`
- All styles live in `src/styles.css` — no inline styles except dynamic values (positions, background-image URLs)

## Agent roles
- **UI agent (this agent):** owns all React components, routing, styles, and interaction flows
- **Backend agent (separate):** will own `src/data/` schemas, rule engine, health score logic, recommendation engine
- **AI agent (separate):** will own LLM integration layer

## Key constraints
- Desktop-only — no mobile breakpoints needed
- No persistence — projects are in-session React state only (localStorage/API comes later)
- LLM is not the source of truth for ecological validity — rule engine is
- Species data in `src/data/species.js` is the authoritative dataset for v1
