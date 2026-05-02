# Implementation Plan: Ecosystem Builder Backend

## Overview

Implement a pure JavaScript service layer for the Ecosystem Builder application. All data is loaded from JSON files at initialization and held in memory. The backend exposes independent service modules consumed directly by the UI layer — no server, no database, no shared mutable state between modules.

Implementation proceeds in dependency order: scaffolding → data files → data loading utilities → individual service modules → public API surface → tests.

## Tasks

- [x] 1. Project scaffolding and configuration
  - Create the `food-chain/data/`, `food-chain/services/`, and `food-chain/utils/` directory structure
  - Create `package.json` with `"type": "module"`, `jest` (or `vitest`) as the test runner, and `fast-check` as a dev dependency
  - Create `jest.config.js` (or `vitest.config.js`) configured for ESM
  - Create stub `index.js` at `food-chain/index.js` that will be filled in later
  - _Requirements: 10.1_

- [ ] 2. Seed JSON data files
  - [x] 2.1 Create `food-chain/data/climateProfiles.json` with at least 6 realistic biome profiles (tropical-rainforest, temperate-deciduous, desert, boreal-forest, mediterranean, tundra) containing all required fields: `id`, `biomeName`, `tempRangeMin`, `tempRangeMax`, `precipRangeMin`, `precipRangeMax`, `humidityRangeMin`, `humidityRangeMax`
    - _Requirements: 2.1, 9.1_

  - [x] 2.2 Create `food-chain/data/habitats.json` with at least 8 habitat records covering forest, grassland, wetland, desert, freshwater, marine, urban, and alpine, each with `id`, `name`, `compatibleBiomes`, and `projectModes`
    - _Requirements: 5.5, 9.1_

  - [x] 2.3 Create `food-chain/data/locations.json` with at least 10 city records spanning multiple biomes and regions, each with `id`, `cityName`, `countryCode`, `regionId`, `biomeId`, `nativeSpeciesIds`, and `aliases`
    - _Requirements: 2.1, 2.2, 2.3, 9.1_

  - [ ] 2.4 Create `food-chain/data/species.json` with at least 30 realistic species records covering all `kingdomCategory` values (plants, mammals, birds, reptiles, amphibians, fish, insects, fungi, decomposers), multiple trophic levels (1–4), and a mix of `supportedProjectModes`. Each record must include all required fields plus `ecosystemRoles`, `predators`, `prey`, `conflictsWith`, `dependencies`, `similarSpecies`, `nearbySpecies`, `invasiveRegions`, `nativeRegions`, and `maxDensityHint`
    - _Requirements: 1.1–1.9, 9.1, 9.3_

  - [ ] 2.5 Create `food-chain/data/interactions.json` with at least 20 interaction records covering all `relationshipType` values (predation, competition, symbiosis, mutualism, parasitism, pollination), each with `id`, `sourceSpeciesId`, `targetSpeciesId`, `relationshipType`, `directionality`, and `notes`
    - _Requirements: 4.2–4.5, 9.1, 9.4_

  - [ ] 2.6 Create `food-chain/data/ecosystemRules.json` with at least 10 rule records covering trophic-imbalance, invasive-species, habitat-mismatch, missing-producer, missing-decomposer, missing-pollinator, coexistence-conflict, missing-dependency, overcrowding, and climate-incompatibility rule types, each with `id`, `type`, `severity`, `message`, `appliesTo`, and `conditions`
    - _Requirements: 5.1–5.12, 9.1, 9.5_

  - [ ] 2.7 Create `food-chain/data/recommendationRules.json` with 4 records — one per `reasonCode` (`fills-gap`, `native-match`, `similar-species`, `improves-balance`) — each with `id`, `reasonCode`, `priority`, and `description`
    - _Requirements: 7.7, 9.1_

- [ ] 3. Data loading and validation utilities
  - [ ] 3.1 Implement `food-chain/utils/resultFactory.js` exporting `ok(data)` and `err(message, code)` helper functions that produce the standard `{ success, data }` / `{ success, error }` result objects
    - _Requirements: 10.2, 10.3_

  - [ ] 3.2 Implement `food-chain/utils/validators.js` exporting per-file required-field validators: `validateSpeciesRecord`, `validateLocationRecord`, `validateInteractionRecord`, `validateRuleRecord`, `validateHabitatRecord`, `validateClimateProfileRecord`, `validateRecommendationRuleRecord`. Each validator throws a descriptive `DataLoadError` if a required field is missing, identifying the field name, file name, and record index
    - _Requirements: 9.1, 9.3, 9.4, 9.5_

  - [ ] 3.3 Implement `food-chain/services/dataLoader.js` exporting `loadAll(dataDir)` that reads and parses all seven JSON files, runs per-record validation via `validators.js`, deduplicates species by `id` (emitting `console.warn` for duplicates and retaining the first occurrence), and returns a `dataStore` object keyed by filename. Throws `DataLoadError` with descriptive messages for missing files, invalid JSON, or missing required fields
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6_

  - [ ] 3.4 Write property test for `resultFactory` — Property 37: result object contract
    - **Property 37: Result Object Contract**
    - **Validates: Requirements 10.1, 10.2, 10.3**

  - [ ] 3.5 Write property test for `dataLoader` — Property 34: data validation rejects missing required fields
    - **Property 34: Data Validation Rejects Missing Required Fields**
    - **Validates: Requirements 9.1, 9.3, 9.4, 9.5**

  - [ ] 3.6 Write property test for `dataLoader` — Property 35: missing or malformed file throws descriptive error
    - **Property 35: Missing or Malformed File Throws Descriptive Error**
    - **Validates: Requirements 9.2**

  - [ ] 3.7 Write property test for `dataLoader` — Property 36: species deduplication retains first occurrence
    - **Property 36: Species Deduplication Retains First Occurrence**
    - **Validates: Requirements 9.6**

  - [ ] 3.8 Write unit tests for `dataLoader` covering: successful load of all seven files, each individual missing-file error message, each individual invalid-JSON error message, duplicate species ID deduplication with console.warn, and missing required field errors for each file type
    - _Requirements: 9.1–9.6_

- [ ] 4. Checkpoint — data layer complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 5. Implement `speciesService.js`
  - [ ] 5.1 Implement `food-chain/services/speciesService.js` with `initialize(speciesArray)`, `getAll()`, `getById(id)`, `filterByKingdom(kingdomCategory)`, `filterByHabitat(habitatType)`, `filterByClimate(climateProfile)`, `filterByProjectMode(mode)`, `filterByNativeRegion(regionId)`, and `filter(criteria)`. All query functions return `ok(array)` or `ok(species)` / `err(...)` result objects. `filter(criteria)` applies all provided keys as an AND conjunction. Climate filtering checks that the species `climateNeeds` ranges overlap the profile's temperature, precipitation, and humidity ranges
    - _Requirements: 1.1–1.9_

  - [ ] 5.2 Write property test for `speciesService` — Property 1: species filter correctness
    - **Property 1: Species Filter Correctness**
    - **Validates: Requirements 1.2, 1.3, 1.5, 1.6**

  - [ ] 5.3 Write property test for `speciesService` — Property 2: multi-criteria filter conjunction
    - **Property 2: Multi-Criteria Filter Conjunction**
    - **Validates: Requirements 1.7**

  - [ ] 5.4 Write property test for `speciesService` — Property 3: species lookup round-trip
    - **Property 3: Species Lookup Round-Trip**
    - **Validates: Requirements 1.8**

  - [ ] 5.5 Write property test for `speciesService` — Property 4: climate compatibility filter
    - **Property 4: Climate Compatibility Filter**
    - **Validates: Requirements 1.4**

  - [ ] 5.6 Write unit tests for `speciesService` covering: load and getAll, getById found and not-found, each individual filter function with matching and non-matching inputs, multi-criteria filter with overlapping and non-overlapping criteria, empty result returns empty array not error
    - _Requirements: 1.1–1.9_

- [ ] 6. Implement `locationService.js`
  - [ ] 6.1 Implement `food-chain/services/locationService.js` with `initialize(locationsArray, climateProfilesArray)`, `resolveCity(cityName)`, `resolveByBiome(biomeId)`, and `getRegionId(cityName)`. City name matching is case-insensitive and trims whitespace; aliases are checked. Returns `err('City not found', 'CITY_NOT_FOUND')` for unknown cities. `resolveCity` returns `{ climateProfile, regionId, nativeSpeciesIds }`
    - _Requirements: 2.1–2.6_

  - [ ] 6.2 Write property test for `locationService` — Property 5: city resolution completeness
    - **Property 5: City Resolution Completeness**
    - **Validates: Requirements 2.1, 2.2, 2.3**

  - [ ] 6.3 Write property test for `locationService` — Property 6: unknown city returns structured error
    - **Property 6: Unknown City Returns Structured Error**
    - **Validates: Requirements 2.4**

  - [ ] 6.4 Write property test for `locationService` — Property 7: biome direct lookup
    - **Property 7: Biome Direct Lookup**
    - **Validates: Requirements 2.6**

  - [ ] 6.5 Write unit tests for `locationService` covering: case-insensitive city name matching, alias resolution, whitespace trimming, unknown city error, biome direct lookup, and all required fields present in resolved climate profile
    - _Requirements: 2.1–2.6_

- [ ] 7. Implement `ecosystemEngine.js`
  - [ ] 7.1 Implement `food-chain/services/ecosystemEngine.js` with `initialize(speciesService, locationService)`, `createSession({ mode, cityName? })`, `addSpecies(session, speciesId)`, `removeSpecies(session, speciesId)`, `getFullSpeciesList(session)`, and `evaluate(session)`. Sessions are immutable plain objects — each mutation returns a new session. `createSession` for outdoor mode resolves the city and populates `preExistingSpeciesIds`. `addSpecies` validates the species exists and is not already placed. `getFullSpeciesList` returns the deduplicated union of pre-existing and placed species. `evaluate` delegates to `foodWebEngine`, `warningEngine`, and `healthScoreEngine` and returns `{ foodWeb, warnings, healthScore }`
    - _Requirements: 3.1–3.8, 10.4, 10.5_

  - [ ] 7.2 Write property test for `ecosystemEngine` — Property 8: session initialization shape
    - **Property 8: Session Initialization Shape**
    - **Validates: Requirements 3.1**

  - [ ] 7.3 Write property test for `ecosystemEngine` — Property 9: species add/remove round-trip
    - **Property 9: Species Add/Remove Round-Trip**
    - **Validates: Requirements 3.2, 3.3**

  - [ ] 7.4 Write property test for `ecosystemEngine` — Property 10: full species list is union of pre-existing and placed
    - **Property 10: Full Species List Is Union of Pre-Existing and Placed**
    - **Validates: Requirements 3.4, 3.8, 10.4**

  - [ ] 7.5 Write property test for `ecosystemEngine` — Property 11: mode compatibility invariant
    - **Property 11: Mode Compatibility Invariant**
    - **Validates: Requirements 3.5, 3.6**

  - [ ] 7.6 Write property test for `ecosystemEngine` — Property 12: invalid species add returns error without mutation
    - **Property 12: Invalid Species Add Returns Error Without Mutation**
    - **Validates: Requirements 3.7**

  - [ ] 7.7 Write property test for `ecosystemEngine` — Property 38: outdoor session without location rejects location-dependent operations
    - **Property 38: Outdoor Session Without Location Rejects Location-Dependent Operations**
    - **Validates: Requirements 10.5**

  - [ ] 7.8 Write unit tests for `ecosystemEngine` covering: createSession for each mode, addSpecies success and duplicate-species error, removeSpecies success and not-found behavior, getFullSpeciesList deduplication, evaluate pipeline delegation, outdoor mode without location error
    - _Requirements: 3.1–3.8, 10.4, 10.5_

- [ ] 8. Checkpoint — session management complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 9. Implement `foodWebEngine.js`
  - [ ] 9.1 Implement `food-chain/services/foodWebEngine.js` with `initialize(interactionsArray)` and `compute(speciesList)`. The computation: (1) groups species by `trophicLevel`; (2) identifies predator-prey pairs from species `prey`/`predators` fields and from interaction records with `relationshipType: 'predation'`; (3) identifies competition, symbiotic, and pollination pairs from interaction records; (4) computes trophic ratios as `count(level L+1) / max(1, count(level L))` for each adjacent level pair; (5) sets `hasProducer` and `hasDecomposer` flags; (6) builds a `gaps` array of human-readable descriptions. Returns `ok(FoodWebResult)`
    - _Requirements: 4.1–4.10_

  - [ ] 9.2 Write property test for `foodWebEngine` — Property 13: trophic level assignment completeness
    - **Property 13: Trophic Level Assignment Completeness**
    - **Validates: Requirements 4.1**

  - [ ] 9.3 Write property test for `foodWebEngine` — Property 14: predator-prey and relationship detection
    - **Property 14: Predator-Prey and Relationship Detection**
    - **Validates: Requirements 4.2, 4.3, 4.4, 4.5**

  - [ ] 9.4 Write property test for `foodWebEngine` — Property 15: trophic ratio computation
    - **Property 15: Trophic Ratio Computation**
    - **Validates: Requirements 4.6**

  - [ ] 9.5 Write property test for `foodWebEngine` — Property 16: gap detection flags
    - **Property 16: Gap Detection Flags**
    - **Validates: Requirements 4.7, 4.8**

  - [ ] 9.6 Write unit tests for `foodWebEngine` covering: empty species list, single-species list, all relationship types detected, trophic ratio with and without each level, hasProducer and hasDecomposer flags, gaps array content
    - _Requirements: 4.1–4.10_

- [ ] 10. Implement `warningEngine.js`
  - [ ] 10.1 Implement `food-chain/services/warningEngine.js` with `initialize(rulesArray)` and `evaluate({ speciesList, foodWeb, climateProfile, mode, regionId })`. Implement the five-stage warning pipeline: (1) missing foundational species (no producer → critical, no decomposer → major, missing pollinator → major); (2) per-species compatibility (habitat mismatch → minor, climate incompatibility → minor, invasive in region for outdoor → major); (3) inter-species conflicts (conflictsWith match → major, missing dependency → minor); (4) trophic balance (ratio > threshold → major); (5) density checks (count > maxDensityHint → minor). Returns `ok(Warning[])` sorted critical → major → minor. Rule records from `ecosystemRules.json` are matched by `type` and filtered by `appliesTo`
    - _Requirements: 5.1–5.12_

  - [ ] 10.2 Write property test for `warningEngine` — Property 17: warning structural completeness
    - **Property 17: Warning Structural Completeness**
    - **Validates: Requirements 5.2**

  - [ ] 10.3 Write property test for `warningEngine` — Property 18: invasive species warning coverage
    - **Property 18: Invasive Species Warning Coverage**
    - **Validates: Requirements 5.3**

  - [ ] 10.4 Write property test for `warningEngine` — Property 19: per-species compatibility warnings
    - **Property 19: Per-Species Compatibility Warnings**
    - **Validates: Requirements 5.5, 5.6**

  - [ ] 10.5 Write property test for `warningEngine` — Property 20: missing foundational species warnings
    - **Property 20: Missing Foundational Species Warnings**
    - **Validates: Requirements 5.7, 5.11**

  - [ ] 10.6 Write property test for `warningEngine` — Property 21: conflict and dependency warnings
    - **Property 21: Conflict and Dependency Warnings**
    - **Validates: Requirements 5.8, 5.9**

  - [ ] 10.7 Write property test for `warningEngine` — Property 22: warning severity ordering
    - **Property 22: Warning Severity Ordering**
    - **Validates: Requirements 5.12**

  - [ ] 10.8 Write unit tests for `warningEngine` covering: each warning type emitted with a concrete species set, invasive species warning only in outdoor mode, no warnings for a fully compatible ecosystem, severity sort order, empty species list produces no warnings
    - _Requirements: 5.1–5.12_

- [ ] 11. Checkpoint — food web and warnings complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 12. Implement `healthScoreEngine.js`
  - [ ] 12.1 Implement `food-chain/services/healthScoreEngine.js` with `compute({ speciesList, foodWeb, warnings, mode, climateProfile, regionId })`. Implement all 11 dimension score formulas from the design: producer sufficiency, prey/predator balance, biodiversity, pollination support, habitat compatibility, climate/location suitability, invasive species penalty, resource competition penalty, decomposer presence, aquatic/terrestrial fit, and dependency satisfaction. Apply mode-specific weight redistribution (aquarium excludes terrestrial-fit; terrarium excludes aquatic-fit). Return `ok(HealthScoreResult)` with `score`, `label`, and `breakdown`. Empty ecosystem returns score 0 and label `'unstable'`
    - _Requirements: 6.1–6.9_

  - [ ] 12.2 Write property test for `healthScoreEngine` — Property 23: health score range invariant
    - **Property 23: Health Score Range Invariant**
    - **Validates: Requirements 6.1**

  - [ ] 12.3 Write property test for `healthScoreEngine` — Property 24: health label determinism
    - **Property 24: Health Label Determinism**
    - **Validates: Requirements 6.3**

  - [ ] 12.4 Write property test for `healthScoreEngine` — Property 25: health score breakdown completeness
    - **Property 25: Health Score Breakdown Completeness**
    - **Validates: Requirements 6.2, 6.4**

  - [ ] 12.5 Write property test for `healthScoreEngine` — Property 26: invasive species penalty monotonicity
    - **Property 26: Invasive Species Penalty Monotonicity**
    - **Validates: Requirements 6.5**

  - [ ] 12.6 Write property test for `healthScoreEngine` — Property 27: decomposer absence zeroes dimension
    - **Property 27: Decomposer Absence Zeroes Dimension**
    - **Validates: Requirements 6.6**

  - [ ] 12.7 Write unit tests for `healthScoreEngine` covering: empty ecosystem returns 0/unstable, label boundary values (score 39 → unstable, 40 → developing, 59 → developing, 60 → healthy, 79 → healthy, 80 → highly resilient), each dimension score formula with a concrete input, mode-specific weight redistribution for aquarium and terrarium, breakdown contributions sum to total score
    - _Requirements: 6.1–6.9_

- [ ] 13. Implement `recommendationEngine.js`
  - [ ] 13.1 Implement `food-chain/services/recommendationEngine.js` with `initialize(recommendationRulesArray)` and `recommend({ session, speciesList, warnings, foodWeb })`. Build the candidate pool by: removing already-placed and pre-existing species; removing species conflicting with any placed species; filtering to mode/habitat/climate-compatible species. Score each candidate by summing matched reason codes (fills-gap: 40, native-match: 30, similar-species: 20, improves-balance: 10). Exclude candidates with score 0. Sort descending by score. Each result carries the highest-priority `reasonCode`, a `reasonDetail` string, and the `score`. Return `ok([])` when no candidates qualify
    - _Requirements: 7.1–7.8_

  - [ ] 13.2 Write property test for `recommendationEngine` — Property 28: recommendation exclusion invariants
    - **Property 28: Recommendation Exclusion Invariants**
    - **Validates: Requirements 7.5, 7.6**

  - [ ] 13.3 Write property test for `recommendationEngine` — Property 29: recommendation compatibility
    - **Property 29: Recommendation Compatibility**
    - **Validates: Requirements 7.1**

  - [ ] 13.4 Write property test for `recommendationEngine` — Property 30: gap-filling recommendations
    - **Property 30: Gap-Filling Recommendations**
    - **Validates: Requirements 7.2**

  - [ ] 13.5 Write property test for `recommendationEngine` — Property 31: similar/nearby species inclusion
    - **Property 31: Similar/Nearby Species Inclusion**
    - **Validates: Requirements 7.3**

  - [ ] 13.6 Write property test for `recommendationEngine` — Property 32: recommendation reason code validity
    - **Property 32: Recommendation Reason Code Validity**
    - **Validates: Requirements 7.7**

  - [ ] 13.7 Write unit tests for `recommendationEngine` covering: already-placed species excluded, conflicting species excluded, gap-filling species included with fills-gap reason, native species prioritized in outdoor mode, similar/nearby species included, empty result when no candidates qualify, reason codes are valid enum values
    - _Requirements: 7.1–7.8_

- [ ] 14. Checkpoint — scoring and recommendations complete
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 15. Implement `llmService.js`
  - [ ] 15.1 Implement `food-chain/services/llmService.js` with `configure({ provider, apiKey?, options? })`, `explainWarning({ warning, affectedSpecies, ecosystemContext })`, `summarizeSpecies(speciesRecord)`, and `narrateRecommendation({ recommendation, ecosystemContext })`. Implement a `mock` provider that returns deterministic placeholder strings. Implement provider dispatch so that `openai` and `anthropic` providers can be added without changing the calling interface. All functions return `ok(string)` on success or `err(message, 'LLM_PROVIDER_ERROR' | 'LLM_UNAVAILABLE')` on failure — no unhandled exceptions
    - _Requirements: 8.1–8.6_

  - [ ] 15.2 Write property test for `llmService` — Property 33: LLM provider error returns structured result
    - **Property 33: LLM Provider Error Returns Structured Result**
    - **Validates: Requirements 8.5**

  - [ ] 15.3 Write unit tests for `llmService` covering: mock provider returns non-empty strings for all three call types, provider error returns structured error not thrown exception, unavailable provider returns LLM_UNAVAILABLE code, configure sets the active provider, calling without configure uses mock provider
    - _Requirements: 8.1–8.6_

- [ ] 16. Wire public API surface (`index.js`)
  - [ ] 16.1 Implement `food-chain/index.js` to export a single `initialize(dataDir)` async function that calls `dataLoader.loadAll(dataDir)`, initializes all service modules with the loaded data store, and returns an object exposing `speciesService`, `locationService`, `ecosystemEngine`, `foodWebEngine`, `warningEngine`, `healthScoreEngine`, `recommendationEngine`, and `llmService`. Re-export all service module types and result factory helpers
    - _Requirements: 1.1, 2.5, 3.1, 4.9, 5.1, 9.1, 10.1_

  - [ ] 16.2 Write integration test for the full `ecosystemEngine.evaluate()` pipeline using the seed data files: initialize from disk, create an outdoor session for a known city, add several species, call evaluate, and assert that `foodWeb`, `warnings`, and `healthScore` are all present and structurally valid
    - _Requirements: 3.1–3.8, 4.1–4.10, 5.1–5.12, 6.1–6.9_

  - [ ] 16.3 Write integration test for `dataLoader.loadAll` reading all seven seed files from disk and returning a complete data store with no thrown errors
    - _Requirements: 9.1–9.6_

- [ ] 17. Final checkpoint — full pipeline complete
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Property tests use **fast-check** and are tagged with `// Feature: ecosystem-builder-backend, Property N: <property text>`
- Each property test runs a minimum of 100 iterations
- Checkpoints ensure incremental validation at each major layer boundary
- The `mock` LLM provider enables full offline testing of the recommendation and warning narrative flows
- All service functions return `{ success, data }` or `{ success, error }` — never throw for expected error conditions
