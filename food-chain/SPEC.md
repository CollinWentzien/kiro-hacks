# Ecosystem Builder Backend — Specification

## Overview

A Hono-based Node.js HTTP API server that fetches real species and ecological data from public external APIs. No database, no static species files. All data is fetched live, cached in memory, and persisted to disk per city.

**Runtime:** Node.js 18+ (ESM), Hono framework, `@hono/node-server`  
**Port:** `process.env.PORT` or `3000`  
**Start:** `npm start` from `food-chain/`  
**Test:** `npm test` from `food-chain/`

---

## Public API

### `GET /api/ecosystem`

Main endpoint. Geocodes a city, fetches the top observed species nearby, enriches each with taxonomy/photos/nativity/interactions/trophic level/climate compatibility, and saves the result to disk.

**Query params:**

| Param | Required | Default | Description |
|---|---|---|---|
| `city` | yes | — | City name |
| `country` | no | — | Country name (improves geocoding accuracy) |
| `state` | no | — | State/province (improves geocoding accuracy) |
| `radiusKm` | no | 50 | Search radius in km |
| `limit` | no | 500 | Max species to return |
| `categories` | no | all | Comma-separated: `plants,animals` |
| `nativeOnly` | no | false | `true` = exclude non-native species |
| `observedOnly` | no | false | `true` = exclude species not observed nearby |
| `confidence` | no | all | Comma-separated: `high,medium,low,unknown` |
| `refresh` | no | false | `true` = bypass disk cache and re-fetch |

**Response:**
```json
{
  "region": {
    "city": "Austin",
    "state": "Texas",
    "country": "United States",
    "county": "Travis County",
    "lat": 30.2711,
    "lng": -97.7437
  },
  "climateProfile": {
    "tempMin": -16.4,
    "tempMax": 44.1,
    "tempMeanMin": 12.3,
    "tempMeanMax": 26.8,
    "annualPrecipMm": 761,
    "biome": "temperate-deciduous",
    "label": "Temperate Deciduous Forest"
  },
  "species": [
    {
      "scientificName": "Bubo virginianus",
      "commonName": "Great Horned Owl",
      "category": "animal",
      "nativeStatus": "native",
      "confidence": "high",
      "observedNearby": true,
      "photoUrl": "https://...",
      "taxonomy": {
        "kingdom": "Animalia",
        "phylum": "Chordata",
        "class": "Aves",
        "order": "Strigiformes",
        "family": "Strigidae",
        "genus": "Bubo"
      },
      "observationSummary": "84,615 observations",
      "trophicLevel": 4,
      "trophicLabel": "apex predator",
      "trophicNote": "Eats 95 species, no known predators",
      "climateCompatibility": "compatible",
      "climateNote": "Generally compatible with Temperate Deciduous Forest climate",
      "interactions": {
        "eats": ["Sylvilagus floridanus", "Sciurus niger", "..."],
        "eatenBy": [],
        "pollinates": [],
        "pollinatedBy": [],
        "parasitizes": [],
        "parasitizedBy": [],
        "competesWidth": []
      },
      "sourceLinks": [
        { "source": "iNaturalist", "url": "https://www.inaturalist.org/taxa/20044" }
      ],
      "sources": ["iNaturalist", "POWO"]
    }
  ],
  "savedAt": "2026-05-02T21:00:00.000Z"
}
```

**Caching:** Results are cached in memory (15 min) and saved to `food-chain/data/cities/{city-slug}.json`. Subsequent requests serve from disk until `?refresh=true` is passed.

---

### `GET /api/ecosystem/saved`

Lists all city slugs that have been saved to disk.

**Response:** `{ "cities": ["austin-texas-united-states", "london-england-united-kingdom"] }`

---

### `GET /api/ecosystem/climate`

Returns the saved climate profile for a city without re-fetching.

**Query params:** `city` (required), `country`, `state`

**Response:** `{ "region": {...}, "climateProfile": {...} }`

---

### `GET /api/ecosystem/gaps`
### `POST /api/ecosystem/gaps`

Analyzes an ecosystem and returns a gap profile — what trophic roles, taxonomic groups, and interaction types are missing.

**GET params:** `city` (required), `country`, `state`  
**POST body:** `{ "species": [...] }` — for custom-built ecosystems not tied to a city

**Response:**
```json
{
  "gapProfile": {
    "total": 472,
    "plantCount": 199,
    "animalCount": 273,
    "plantRatio": 0.42,
    "gaps": [],
    "neededRoles": [],
    "trophicRoles": {
      "hasProducer": true,
      "hasDecomposer": true,
      "hasPollinator": true,
      "hasTopPredator": true,
      "hasHerbivore": true
    },
    "trophicDistribution": { "0": 3, "1": 199, "2": 180, "3": 62, "4": 28 },
    "taxonomicCoverage": {
      "familiesPresent": ["Strigidae", "Fagaceae", "..."],
      "ordersPresent": ["Strigiformes", "Fagales", "..."],
      "iconicGroupsPresent": ["Aves", "Plantae", "Mammalia", "..."]
    },
    "interactionDensity": 0.82,
    "ecosystemNames": ["bubo virginianus", "quercus virginiana", "..."]
  }
}
```

**Gap flags:** `missing_producer`, `missing_decomposer`, `missing_pollinator`, `missing_top_predator`, `missing_herbivore`, `missing_primary_consumer`, `missing_apex_predator`, `too_few_plants`, `too_few_animals`, `low_interaction_density`

---

### `GET /api/geocode`

Resolves a city name to geographic metadata.

**Query params:** `city` (required), `country`, `state`

**Response:**
```json
{
  "city": "Austin",
  "state": "Texas",
  "country": "United States",
  "county": "Travis County",
  "lat": 30.2711,
  "lng": -97.7437
}
```

---

### `GET /api/geocode/autocomplete`

City search autocomplete for the home page search bar. Returns city suggestions for a partial query string. Powered by Photon (OpenStreetMap-based, purpose-built for autocomplete).

**Query params:**

| Param | Required | Default | Description |
|---|---|---|---|
| `q` | yes | — | Partial city name (min 2 characters) |
| `limit` | no | 8 | Max suggestions (max 15) |

**Response:**
```json
[
  {
    "city": "Los Angeles",
    "state": "California",
    "country": "United States",
    "displayName": "Los Angeles, California, United States",
    "lat": 34.0537,
    "lng": -118.2428
  },
  {
    "city": "Los Santos",
    "state": "Castilla y León",
    "country": "España",
    "displayName": "Los Santos, Castilla y León, España",
    "lat": 40.5449,
    "lng": -5.7972
  }
]
```

**Usage:** Debounce calls on the frontend (300ms). When the user selects a suggestion, pass `city`, `state`, and `country` to `GET /api/ecosystem` for accurate results.

**Caching:** Results cached 1 hour in memory.

---

### `GET /api/species/observed`

Returns species observed near a lat/lng from GBIF and iNaturalist.

**Query params:** `lat` (required), `lng` (required), `radiusKm` (default 50), `categories`, `limit` (default 500)

**Response:** `{ "species": [...], "partialFailure"?: true }`

---

### `GET /api/species/native`

Returns native status for a single species in a region.

**Query params:** `scientificName` (required), `country` (required), `state`, `county`, `lat`, `lng`

**Response:**
```json
{
  "scientificName": "Quercus agrifolia",
  "nativeStatus": "native",
  "confidence": "high",
  "sources": ["POWO"]
}
```

---

### `GET /api/species/enrich`

Returns metadata for a single species.

**Query params:** `scientificName` (required)

**Response:**
```json
{
  "scientificName": "Quercus agrifolia",
  "commonName": "Coast Live Oak",
  "photoUrl": "https://...",
  "taxonomy": { "kingdom": "Plantae", "family": "Fagaceae", "..." },
  "observationSummary": "76,290 observations",
  "sourceLinks": [{ "source": "iNaturalist", "url": "https://..." }],
  "sources": ["iNaturalist"]
}
```

---

### `GET /api/catalog/search`
### `POST /api/catalog/search`

Search the global species catalog (iNaturalist, ~500K observable species). Optionally scores each result for compatibility against a city ecosystem or custom species list.

**GET params:**

| Param | Description |
|---|---|
| `q` | Free text (common or scientific name) |
| `category` | `plant` or `animal` |
| `kingdom` | iNaturalist iconic taxon: `Plantae`, `Aves`, `Mammalia`, `Reptilia`, `Amphibia`, `Actinopterygii`, `Insecta`, `Arachnida`, `Fungi` |
| `limit` | Max results (default 30, max 200) |
| `page` | Page number (default 1) |
| `city` | Score against a saved city ecosystem (fast, no GloBI calls) |
| `country` | Used with `city` |
| `state` | Used with `city` |
| `deepScore` | `true` = also fetch GloBI interactions per candidate (slower, more accurate) |

**POST body:** `{ "q", "category", "kingdom", "limit", "page", "deepScore", "species": [...] }` — `species` is the user's current custom ecosystem list.

**Response:**
```json
{
  "results": [
    {
      "scientificName": "Canis latrans",
      "commonName": "Coyote",
      "category": "animal",
      "photoUrl": "https://...",
      "observationCount": 148231,
      "inatTaxonId": 42051,
      "wikipediaUrl": "https://...",
      "iconicTaxonName": "Mammalia",
      "compatibilityScore": 45,
      "compatibilityLabel": "compatible",
      "compatibilityReasons": [
        "Eats 7 species already in this ecosystem",
        "Adds new family: Canidae"
      ]
    }
  ],
  "totalResults": 619,
  "page": 1,
  "limit": 30
}
```

**Compatibility labels:** `highly compatible` (70–100), `compatible` (45–69), `low compatibility` (20–44), `not recommended` (0–19)

---

### `GET /api/catalog/species/:inatTaxonId`

Full detail for a single species by iNaturalist taxon ID. Includes taxonomy, photo, all GloBI interactions, and optionally a deep compatibility score.

**Query params:** `city`, `country`, `state` (optional — adds compatibility score)

---

## Internal Services

### GeocodingService
- Source: Nominatim (OpenStreetMap)
- Sets `User-Agent: ecosystem-builder/1.0` (required by Nominatim policy)
- Picks result with highest importance score when multiple results returned
- Returns `{ notFound: true }` or `{ error: true, message }` — never throws

### ObservationService
- Sources: iNaturalist `species_counts` endpoint (unique species, sorted by observation count) + GBIF occurrence search (bounding box)
- iNaturalist returns photos and common names directly — no separate enrichment needed
- GBIF uses lat/lng bounding box (not radius parameter)
- Deduplicates on scientific name (case-insensitive); iNaturalist data takes priority
- Partial failure: if one source fails, returns results from the other with `partialFailure: true`

### NativityService
- Plants: POWO (Plants of the World Online, Kew Gardens)
- Animals in US/Canada: NatureServe (maps G1–G3 ranks to `native/high`, G4–G5 to `native/medium`)
- Animals outside US/Canada: returns `unknown` without API call
- All failures return `{ nativeStatus: 'unknown', confidence: 'unknown', sourceError }` — never throws

### EnrichmentService
- Primary: iNaturalist taxa search — extracts `commonName`, `photoUrl` (from `default_photo.medium_url`), `taxonomy` (from ancestors endpoint), `observationSummary`, `sourceLinks`
- Fallback: GBIF species match — extracts `canonicalName`, `vernacularName`, `kingdom`
- Returns `{ notFound: true }` or `{ error: true, message }` — never throws

### InteractionService
- Source: GloBI (Global Biotic Interactions)
- Fetches: `eats`, `eatenBy`, `pollinates`, `pollinatedBy`, `parasitizes`, `parasitizedBy`, `competesWidth`
- Bulk fetch with concurrency limit of 10 parallel requests
- Failures return empty arrays — non-blocking

### TrophicService
- Derives trophic level from interaction data and taxonomy
- Level 0: Decomposer (Fungi, bacteria, detritivores)
- Level 1: Producer (plants, Plantae, Chromista)
- Level 2: Primary Consumer (herbivores — eats plants)
- Level 3: Secondary Consumer (eats animals, has predators)
- Level 4: Apex Predator (eats animals, no known predators)
- Fallback: animals with no interaction data → level 2

### ClimateService
- Source: Open-Meteo climate API (2000–2020 historical data, EC_Earth3P_HR model)
- Computes: `tempMin`, `tempMax`, `tempMeanMin`, `tempMeanMax`, `annualPrecipMm`
- Classifies biome: tropical-rainforest, tropical-savanna, desert, mediterranean, temperate-grassland, temperate-deciduous, boreal-forest, tundra, temperate
- Classifies species climate compatibility: compatible / marginal / incompatible based on taxonomy and common name heuristics

### MergeService
- Merges observed + nativity + enrichment data into unified species records
- Merge key: `scientificName.trim().toLowerCase()` — never merges on common name
- Missing nativity → `nativeStatus: 'unknown'`, `confidence: 'unknown'`
- Missing enrichment → `commonName: null`, `photoUrl: null`
- `sources` array is union of all contributing APIs

### CacheService
- In-memory Map with TTL per entry type
- TTLs: geocode 1hr, observed 30min, nativity 24hr, enrichment 24hr, ecosystem 15min
- Methods: `get(key)`, `set(key, value, ttlMs)`, `clear()`
- Expired entries are evicted on access

### PersistenceService
- Saves city ecosystem results to `food-chain/data/cities/{city-slug}.json`
- City slug: `{city}-{state}-{country}` lowercased, spaces replaced with hyphens
- `loadCityData(slug)` returns `null` if file doesn't exist
- `listSavedCities()` returns array of all saved slugs

### GapAnalysisService
- `analyzeGaps(species)` — produces a gap profile from a species list
- `scoreAgainstGaps(candidate, gapProfile)` — fast compatibility scoring without GloBI calls
- Used by catalog search for live scoring during user search

### CatalogService
- `searchCatalog({ q, category, kingdom, limit, page })` — queries iNaturalist taxa API
- `scoreCompatibility(candidate, ecosystemSpecies, interactions)` — deep scoring using GloBI interaction data

---

## Request Pipeline — `/api/ecosystem`

1. Validate `city` param (400 if missing)
2. Check memory cache → serve if hit
3. Check disk cache → serve if hit
4. Geocode city via Nominatim
5. Fetch observed species (iNaturalist species_counts + GBIF bounding box, in parallel)
6. Merge and deduplicate observed species
7. Fetch nativity + enrichment per species (in parallel)
8. Merge into full species records
9. Fetch GloBI interactions per species (batched, concurrency 10)
10. Assign trophic levels (synchronous, from interaction data)
11. Fetch city climate profile from Open-Meteo
12. Classify climate compatibility per species
13. Save to disk + warm memory cache
14. Apply filters (nativeOnly, observedOnly, confidence, categories, limit)
15. Return response

---

## Error Handling

| Condition | Response |
|---|---|
| Missing required param | HTTP 400 `{ message: "Missing required parameter: {name}" }` |
| City not found | HTTP 404 `{ message: "City not found" }` |
| Species not found | HTTP 404 `{ message: "Species not found" }` |
| External API failure (required step) | HTTP 502 `{ message: "..." }` |
| External API failure (enrichment) | Partial result with null fields, HTTP 200 |
| One of two observation sources fails | Partial result with `partialFailure: true`, HTTP 200 |
| Nativity API failure | `nativeStatus: "unknown"`, `sourceError` field, HTTP 200 |
| Unexpected internal error | HTTP 500 `{ message: "Internal server error" }` (no stack trace) |

---

## Data Sources

| Source | Used for | Auth |
|---|---|---|
| Nominatim (OpenStreetMap) | Geocoding | None (User-Agent required) |
| Photon (komoot) | City autocomplete | None |
| iNaturalist | Observed species, enrichment, catalog search | None |
| GBIF | Observed species (fallback), enrichment (fallback) | None |
| POWO (Kew Gardens) | Plant native status | None |
| NatureServe | US/Canada animal native status | None |
| GloBI | Predator/prey/pollination/parasitism interactions | None |
| Open-Meteo | City climate profile (historical) | None |

---

## Project Structure

```
food-chain/
  data/
    cities/          ← populated at runtime, one JSON per queried city
  routes/
    catalog.js       ← GET/POST /api/catalog/search, GET /api/catalog/species/:id
    ecosystem.js     ← GET /api/ecosystem, /gaps, /climate, /saved
    enrich.js        ← GET /api/species/enrich
    geocode.js       ← GET /api/geocode, GET /api/geocode/autocomplete
    native.js        ← GET /api/species/native
    observed.js      ← GET /api/species/observed
  services/
    cacheService.js
    catalogService.js
    climateService.js
    enrichmentService.js
    gapAnalysisService.js
    geocodingService.js
    interactionService.js
    mergeService.js
    nativityService.js
    observationService.js
    persistenceService.js
    trophicService.js
    *.test.js        ← unit tests for each service
    integration.test.js
  index.js           ← Hono app, route mounting, server start
  package.json
  vitest.config.js
```
