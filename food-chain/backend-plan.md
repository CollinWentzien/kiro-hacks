# Backend Implementation Plan

This document lists every stub in the UI that needs a backend implementation. Each entry includes the exact location, current stub behavior, and the interface the UI expects.

---

## 1. Compatible Species Filter

**File:** `src/components/SpeciesLibraryPanel.jsx`

**Current stub:**
```js
if (tab === 'compatible') return false;    // "Compatible" tab shows nothing
if (active.compatible) return false;       // "Compatible only" chip in More Filters shows nothing
```

**What it should do:**
Given the set of species IDs currently on the canvas, return a filtered list of species that are ecologically compatible with the existing ecosystem.

**Interface needed:**
```js
// src/data/compatibility.js
export function getCompatibleSpecies(placedIds: Set<string>): Species[]
```

**How the UI will use it:**
```js
// In SpeciesLibraryPanel filtered array:
if (tab === 'compatible') return getCompatibleSpecies(placedIds).some(s => s.id === species.id);
if (active.compatible)    return getCompatibleSpecies(placedIds).some(s => s.id === species.id);
```

**Suggested compatibility criteria (backend decides):**
- Shares at least one habitat (`env`) with the dominant habitat in the ecosystem
- Shares at least one climate with existing species
- Has a food web role that fills a gap (e.g. no decomposer → suggest decomposers)
- Not already placed

---

## 2. Health Score Engine

**File:** `src/components/HealthScorePanel.jsx`

**Current stub:** Rule-based heuristics in `computeHealth(nodes)`:
- No producers → -25
- Predator with no prey → -15 per species
- Arid + tropical mix → -10

**What it should do:**
Replace the heuristic function with a proper ecological rule engine.

**Interface needed:**
```js
// src/data/healthEngine.js
export function computeHealth(nodes: { id: string }[]): {
  score: number,           // 0–100
  status: 'healthy' | 'developing' | 'unstable',
  warnings: {
    badge: string,         // short label e.g. "STARVE", "GAP", "HABITAT"
    text: string           // human-readable description
  }[]
}
```

**Notes:**
- The UI renders warnings as pills with a `fa-triangle-exclamation` icon
- Keep `badge` short (≤8 chars) — it's displayed in a small mono label
- `status` drives the color of the score ring (sage=healthy, mustard=developing, rust=unstable)

---

## 3. City → Ecosystem Seeding

**File:** `src/App.jsx` → `handleStart({ city, mode })`

**Current stub:** Creates a blank project with no species pre-populated.

**What it should do:**
Given a city name and mode, return a starter set of species IDs appropriate for that region.

**Interface needed:**
```js
// src/data/seeding.js
export async function getSeedSpecies(city: string, mode: string): Promise<string[]>
// Returns array of species IDs from src/data/species.js
```

**How the UI will use it:**
```js
const seedIds = await getSeedSpecies(city, mode);
seedIds.forEach(id => addSpecies(SPECIES_BY_ID[id]));
```

**Notes:**
- Species IDs must exist in `SPECIES_BY_ID` — unknown IDs will be silently ignored
- Return empty array if city is unrecognized (graceful fallback)
- Mode values: `'outdoor'` | `'terrarium'` | `'aquarium'`

---

## 4. Save Project

**File:** `src/pages/EcosystemBuilder.jsx` — topbar save button (currently `disabled`)

**Current stub:**
```jsx
<button className="icon-btn" disabled title="Save — coming soon">
  <i className="fa-solid fa-floppy-disk" /> save
</button>
```

**What it should do:**
Persist the current project (name, mode, city) and its canvas nodes (species IDs + x/y positions) to storage.

**Interface needed:**
```js
// src/data/persistence.js
export async function saveProject(project: Project, nodes: Node[]): Promise<void>
export async function loadProject(id: string): Promise<{ project: Project, nodes: Node[] }>
export async function listProjects(): Promise<Project[]>
```

**Notes:**
- For v1, localStorage is acceptable
- The UI will enable the button and call `saveProject` on click once this is implemented

---

## 5. Improve Ecosystem (AI)

**File:** `src/components/HealthScorePanel.jsx` — "Improve Ecosystem" button

**Current stub:**
```jsx
<button className="hp-action-btn" onClick={() => {}}>
  <i className="fa-solid fa-wand-magic-sparkles" />
  <span>Improve<br/>Ecosystem</span>
</button>
```

**What it should do:**
Call an AI/LLM endpoint with the current ecosystem state and return actionable recommendations (e.g. "Add a decomposer", "Remove the lionfish — it will eat everything").

**Interface needed:**
```js
// src/data/aiAgent.js
export async function getEcosystemFeedback(nodes: { id: string }[]): Promise<{
  summary: string,
  suggestions: { action: 'add' | 'remove', speciesId: string, reason: string }[]
}>
```

**How the UI will use it:**
- Opens a panel/modal with the summary and suggestion list
- Each suggestion has an "Apply" button that adds/removes the species

---

## Species Data Stability Contract

The backend team may expand `src/data/species.js` but **must keep these exports stable**:

```js
export const SPECIES: Species[]         // array of all species
export const SPECIES_BY_ID: Record<string, Species>  // lookup map

// Each Species object must have:
{
  id: string,
  name: string,
  latin: string,
  kind: string,
  env: string[],
  climate: string[],
  trophic: 'producer' | 'primary' | 'secondary' | 'tertiary' | 'decomposer',
  eats: string[],
  eatenBy: string[],
  blurb: string,
  img: string,        // URL (Wikimedia or other)
  fallback: string,   // SVG data URI fallback
}
```
