# Implementation Plan: Ecosystem Builder Backend

## Overview

Implement a Hono-based Node.js HTTP API server that fetches real species and location data from public external APIs (Nominatim, GBIF, iNaturalist, POWO, NatureServe). The server exposes five REST endpoints and an internal service layer with in-memory caching.

Implementation proceeds in dependency order: scaffolding → internal services (bottom-up) → route handlers → server wiring → tests.

## Tasks

- [x] 1. Project scaffolding and configuration
  - Update `food-chain/package.json` to add `hono` and `@hono/node-server` as production dependencies; keep `vitest` and `fast-check` as dev dependencies
  - Create `food-chain/routes/` directory
  - Update `food-chain/index.js` stub to be filled in by Task 8
  - _Requirements: 1.1, 15.1–15.6_

- [x] 2. Implement `CacheService`
  - [x] 2.1 Implement `food-chain/services/cacheService.js` with `get(key)`, `set(key, value, ttlMs?)`, and `clear()` methods using an in-memory Map. Each entry stores `{ value, expiresAt }`. `get` returns `null` on miss or expired entry. Default TTLs: geocode = 3 600 000 ms, observed = 1 800 000 ms, nativity = 86 400 000 ms, enrichment = 86 400 000 ms, ecosystem = 900 000 ms
    - _Requirements: 9.1–9.7_
  - [x] 2.2 Write unit tests for `CacheService` covering: set and get hit, get miss, TTL expiry, clear, and default TTL constants
    - _Requirements: 9.1–9.7_

- [x] 3. Implement `GeocodingService`
  - [x] 3.1 Implement `food-chain/services/geocodingService.js` with `geocodeCity({ city, state, country })` and `normalizePlace(nominatimResult)`. Query `https://nominatim.openstreetmap.org/search` with `format=jsonv2&addressdetails=1&limit=5`. Set `User-Agent: ecosystem-builder/1.0`. Select the result with the highest `importance`. Return `{ city, state, country, county, lat, lng }` on success, `{ notFound: true }` when empty, `{ error, message }` on network/HTTP failure. All errors are returned as values — no thrown exceptions
    - _Requirements: 10.1–10.7_
  - [x] 3.2 Write unit tests for `GeocodingService` covering: successful resolution with multiple results (picks highest importance), empty result returns notFound, HTTP error returns structured error, network error returns structured error, User-Agent header is set, country/state params included in query
    - _Requirements: 10.1–10.7_

- [x] 4. Implement `ObservationService`
  - [x] 4.1 Implement `food-chain/services/observationService.js` with `getGbifObservedSpecies({ lat, lng, radiusKm, limit })`, `getINatObservedSpecies({ lat, lng, radiusKm, limit })`, and `mergeObservedSpecies(gbifResults, inatResults)`. GBIF: query `https://api.gbif.org/v1/occurrence/search` with `decimalLatitude`, `decimalLongitude`, `radius` (km), `limit`. iNaturalist: query `https://api.inaturalist.org/v1/observations` with `lat`, `lng`, `radius` (km), `per_page`. Normalize each result to `{ scientificName, category, observedNearby: true, observationCount, sources }`. Category is `plant` if kingdom is Plantae, otherwise `animal`. Merge deduplicates on lowercased scientific name, retaining higher observationCount and combining sources. If one source fails, return partial results with `partialFailure: true`. If both fail, return `{ error, message }`
    - _Requirements: 11.1–11.8_
  - [x] 4.2 Write unit tests for `ObservationService` covering: parallel fetch, deduplication keeps higher count, both-sources success merges sources array, one-source failure returns partialFailure flag, both-sources failure returns error, category normalization for Plantae vs other kingdoms
    - _Requirements: 11.1–11.8_

- [x] 5. Implement `EnrichmentService`
  - [x] 5.1 Implement `food-chain/services/enrichmentService.js` with `getTaxonMetadata(scientificName)`, `getPhoto(inatTaxon)`, and `getCommonName(inatTaxon)`. Primary: query `https://api.inaturalist.org/v1/taxa?q={name}&rank=species` and extract `commonName`, `photoUrl` (first taxon photo medium URL), `taxonomy` (kingdom/phylum/class/order/family/genus), `observationSummary`, and `sourceLinks`. Fallback: query `https://api.gbif.org/v1/species/match?name={name}` and extract `scientificName`, `commonName` (vernacularName if present), `kingdom`. Return `{ notFound: true }` when both sources return no match. Return `{ error, message }` when both sources error. Always include `sources` array
    - _Requirements: 13.1–13.7_
  - [x] 5.2 Write unit tests for `EnrichmentService` covering: iNaturalist hit returns full metadata, iNaturalist miss falls back to GBIF, GBIF fallback hit returns partial metadata, both miss returns notFound, both error returns error, sources array reflects which APIs contributed
    - _Requirements: 13.1–13.7_

- [x] 6. Implement `NativityService`
  - [x] 6.1 Implement `food-chain/services/nativityService.js` with `getPlantNativity({ scientificName, country })`, `getAnimalNativity({ scientificName, country, state })`, `getNatureServeStatus({ scientificName, state })`, and `scoreNativeConfidence(result)`. For plants: query POWO `https://powo.science.kew.org/api/2/taxon/search?q={name}&f=species_name` then check native distribution. For US/Canada animals: query NatureServe `https://explorer.natureserve.org/api/data/speciesSearch` with scientific name, map `G1–G3` ranks to `native/high`, `G4–G5` to `native/medium`. Outside US/Canada non-plants: return `{ nativeStatus: 'unknown', confidence: 'unknown' }` immediately. All API failures return `{ nativeStatus: 'unknown', confidence: 'unknown', sourceError: message }` — no thrown exceptions
    - _Requirements: 12.1–12.8_
  - [x] 6.2 Write unit tests for `NativityService` covering: plant routes to POWO, US animal routes to NatureServe, Canadian animal routes to NatureServe, non-US/CA animal returns unknown without API call, POWO native returns high confidence, POWO non-native returns high confidence non-native, NatureServe failure returns unknown with sourceError, kingdom determined from enrichment data when available
    - _Requirements: 12.1–12.8_

- [x] 7. Implement `MergeService`
  - [x] 7.1 Implement `food-chain/services/mergeService.js` with `mergeSpeciesRecords(observedList, nativityMap, enrichmentMap)` and `buildFinalSpeciesRecord(observed, nativity, enrichment)`. Merge key is `scientificName.trim().toLowerCase()`. `buildFinalSpeciesRecord` produces `{ scientificName, commonName, category, nativeStatus, confidence, observedNearby, photoUrl, sources }`. When nativity is absent: `nativeStatus = 'unknown'`, `confidence = 'unknown'`. When enrichment is absent: `commonName = null`, `photoUrl = null`. `sources` is the union of all contributing API names
    - _Requirements: 8.1–8.8_
  - [x] 7.2 Write unit tests for `MergeService` covering: merge on scientific name (case-insensitive), both-source observation merges sources, nativity attached when present, enrichment attached when present, missing nativity defaults to unknown, missing enrichment nulls commonName and photoUrl, sources union is correct
    - _Requirements: 8.1–8.8_

- [x] 8. Implement route handlers
  - [x] 8.1 Implement `food-chain/routes/geocode.js` exporting a Hono router. Validate `city` param (400 if missing). Check cache. Call `GeocodingService.geocodeCity()`. On `notFound` return 404. On `error` return 502. On success store in cache and return region JSON
    - _Requirements: 2.1–2.7, 7.4_
  - [x] 8.2 Implement `food-chain/routes/observed.js` exporting a Hono router. Validate `lat` and `lng` params (400 if missing). Parse `radiusKm` (default 50), `categories` (comma-split), `limit` (default 100). Check cache. Call `ObservationService`. Apply category filter and limit. On both-sources error return 502. Return `{ species }` JSON
    - _Requirements: 3.1–3.9, 7.5_
  - [x] 8.3 Implement `food-chain/routes/native.js` exporting a Hono router. Validate `scientificName` and `country` params (400 if missing). Check cache. Call `NativityService`. Store result in cache. Return `{ scientificName, nativeStatus, confidence, sources }` JSON — always 200 even on unknown (sourceError included when present)
    - _Requirements: 4.1–4.8, 7.6_
  - [x] 8.4 Implement `food-chain/routes/enrich.js` exporting a Hono router. Validate `scientificName` param (400 if missing). Check cache. Call `EnrichmentService`. On `notFound` return 404. On `error` return 502. On success store in cache and return enrichment JSON
    - _Requirements: 5.1–5.8, 7.7_
  - [x] 8.5 Implement `food-chain/routes/ecosystem.js` exporting a Hono router. Validate `city` param (400 if missing). Check ecosystem cache. Execute the full pipeline: geocode → observe → nativity (parallel per species) → enrich (parallel per species) → merge → filter (`nativeOnly`, `observedOnly`, `confidence`, `categories`, `limit`) → cache result → return `{ region, species }` JSON. On geocode notFound return 404. On unrecoverable pipeline error return 502. Empty species list returns 200 with empty array
    - _Requirements: 6.1–6.12, 7.1–7.3_

- [x] 9. Wire server entry point
  - Implement `food-chain/index.js` to create a Hono app, mount all five route handlers under `/api`, add a global error handler that returns HTTP 500 with `{ message: 'Internal server error' }` (no stack trace), initialize CacheService, and start the `@hono/node-server` on `process.env.PORT ?? 3000`. Log the port on startup
  - _Requirements: 1.1–1.5, 14.7_

- [x] 10. Write integration tests
  - [x] 10.1 Write integration test for `GET /api/geocode` using a real Nominatim call for "San Luis Obispo" — assert region shape, lat/lng are numbers, city/country present
    - _Requirements: 2.1–2.7_
  - [x] 10.2 Write integration test for `GET /api/ecosystem` using a real pipeline call for a known city — assert response has `region` and `species` array, each species has required fields, no unhandled exceptions thrown
    - _Requirements: 6.1–6.12_

- [x] 11. Final checkpoint
  - Run `npm test` in `food-chain/`, ensure all unit tests pass. Confirm server starts with `node index.js`. Ask the user if questions arise.

## Notes

- All service functions return structured result values — never throw for expected error conditions
- External API calls use the native `fetch` (Node 18+) — no additional HTTP client needed
- Tests mock `fetch` using `vi.stubGlobal` / `vi.fn()` so no real network calls are made in unit tests
- Integration tests (tasks 10.1–10.2) make real network calls and may be skipped in CI
- Cache TTL defaults are defined as named constants in `cacheService.js`
- The `@hono/node-server` adapter is required to run Hono on Node.js
