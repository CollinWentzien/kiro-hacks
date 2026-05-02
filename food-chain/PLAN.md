# Ecosystem Builder — UI Implementation Plan

## Role
UI agent only. No backend logic, no LLM integration. Owns all visual components, routing, and interaction flows.

## Source
Design handoff: `Food Chain-handoff.zip` → `project/` folder.
Primary reference files: `app.jsx`, `styles.css`, `species.js`, `placeholders.js`.

## Stack
- React 18 + Vite
- React Router v6 (routing between Home → Dashboard → Builder)
- No external UI libraries — match the handoff's hand-rolled CSS exactly

## Design Language
Field-guide / naturalist journal aesthetic:
- Fonts: Cormorant Garamond (serif), JetBrains Mono (mono), Caveat (handwritten)
- Palette: `--paper` #f4ecd8, `--ink` #2a2520, `--sage` #6b7c5a, `--rust` #a85d3a, `--mustard` #b8893d
- Paper texture via SVG noise + radial gradients
- Dashed rule dividers, italic headings, monospace labels

---

## File Structure

```
food-chain/
  src/
    main.jsx                  # ReactDOM.createRoot, Router
    App.jsx                   # Route definitions
    styles.css                # Full port of handoff styles.css + new page styles
    data/
      species.js              # Port of handoff species.js (all 40 species)
      placeholders.js         # Port of handoff placeholders.js (SVG generator)
    pages/
      HomePage.jsx            # Globe + city input + terrarium bypass
      ProjectDashboard.jsx    # Project cards + new project modal
      EcosystemBuilder.jsx    # Main 3-column builder layout
    components/
      Topbar.jsx              # Brand + project meta + actions
      SpeciesLibraryPanel.jsx # Left sidebar: search, filters, species list
      EcosystemCanvas.jsx     # Center: drag-drop canvas, SVG edges, nodes
      SpeciesInfoPanel.jsx    # Right: detail card, eats/eaten-by, recommendations
      HealthScorePanel.jsx    # Health score + warnings overlay
      GlobeHero.jsx           # SVG/CSS animated globe for homepage
```

---

## Pages

### 1. HomePage (`/`)
- Full-screen paper background
- Center: `GlobeHero` — decorative SVG globe (lat/lon grid lines, continents as paths)
- Overlaid card:
  - Italic heading: *"Where is your ecosystem?"*
  - City text input (serif italic, underline style)
  - Primary button: "Begin →"
  - Secondary link-button: "I'm building a terrarium / aquarium — skip location"
- On submit: navigate to `/dashboard` passing `{ city, mode: 'outdoor' }`
- On bypass: navigate to `/dashboard` passing `{ mode: 'terrarium' }`

### 2. ProjectDashboard (`/dashboard`)
- Topbar with brand + "New Project" button
- Grid of `ProjectCard` components (project name, mode badge, species count, last edited)
- Empty state: hand-lettered prompt to create first project
- "New Project" opens a modal:
  - Project name input
  - Mode selector: Outdoor / Terrarium / Aquarium
  - If Outdoor: city input (pre-filled from homepage if coming from there)
  - "Create" → navigate to `/project/:id`
- Projects stored in `useState` (in-session only, no persistence)

### 3. EcosystemBuilder (`/project/:id`)
- 3-column layout matching handoff exactly:
  - Left 320px: `SpeciesLibraryPanel`
  - Center flex: `EcosystemCanvas`
  - Right 340px: `SpeciesInfoPanel`
- Fixed `Topbar` at top (56px)
- `HealthScorePanel` overlaid top-right of canvas

---

## Components

### GlobeHero
- SVG globe: circle + latitude/longitude grid lines (every 30°) + simplified continent outlines
- Slow CSS rotation animation on the grid layer
- Warm paper tones, ink stroke lines

### Topbar
- Brand mark "Food Chain" italic + subtitle "— a field guide to ecosystems"
- Center meta: project name, mode badge, species count
- Right actions: "Clear Canvas", "← Projects"

### SpeciesLibraryPanel
- Search input (serif italic)
- Filter chips: Environment (Backyard, Terrarium, Freshwater, Saltwater, Pond), Climate (Temperate, Tropical, Arid), Kingdom (plant, invertebrate, fish, amphibian, reptile, bird, mammal)
- Scrollable species list
- Each card: SVG placeholder thumbnail + common name + latin name + trophic tag + kind tag
- Draggable (`draggable` + `onDragStart`); double-click to add
- "✓ ON CANVAS" badge when placed

### EcosystemCanvas
- Drop target (`onDragOver` + `onDrop`)
- Grid background (24px × 24px lines via CSS)
- SVG layer for food-web edges (curved quadratic bezier, arrowheads)
- Placed species as absolutely-positioned `.node` divs
- Node: circular photo (88px), trophic color dot, label, latin, remove button (×)
- Node dragging via `onPointerDown` + `pointermove`
- Selected node: rust outline; related nodes highlighted, others dimmed
- Empty state: hand-lettered "drag a specimen here" with arrow SVG
- Trophic legend bottom-left when nodes present

### SpeciesInfoPanel
- Empty state: "F.G." seal + field guide intro text
- Selected state:
  - Full-width photo header (220px)
  - Common name (28px serif), latin (italic), tag row
  - Blurb paragraph
  - "Eats" section with clickable species rows (→ view / + add)
  - "Eaten by" section
  - (v1 stub) "Recommended additions" section

### HealthScorePanel
- Positioned top-right of canvas, z-index above nodes
- Warning pills: `WARN` badge + message text, rust background
- Info pills: `INFO` badge, sage background
- Rules evaluated:
  - No producers present
  - Predator with no prey on canvas
  - Active predation relationships (will hunt X)
  - Climate mismatch (arid + tropical mix)
  - (stub) Health score 0–100 with label

---

## State Shape (EcosystemBuilder)

```js
{
  project: { id, name, mode, city },
  nodes: [{ id, x, y }],          // placed species
  selectedId: string | null,
  filters: { envs: [], climates: [], kinds: [] },
  query: string,
}
```

Projects list lives in a top-level context or App state, passed down.

---

## Tasks (in order)

1. `npm create vite@latest food-chain -- --template react` — scaffold
2. Install `react-router-dom`
3. Port `styles.css` in full + add homepage/dashboard styles
4. Port `species.js` + `placeholders.js` to `src/data/`
5. Build `GlobeHero` SVG component
6. Build `HomePage`
7. Build `ProjectDashboard` + project modal
8. Build `Topbar`
9. Build `SpeciesLibraryPanel`
10. Build `EcosystemCanvas` (nodes + drag + edges)
11. Build `SpeciesInfoPanel`
12. Build `HealthScorePanel` (warnings + score stub)
13. Wire `App.jsx` routes + shared project state
14. `npm run build` — verify zero errors

---

## Out of Scope (this agent)
- Backend/rule engine logic beyond what's in the handoff's `useMemo` warnings
- LLM integration
- Persistence / save/load
- Mobile layout
