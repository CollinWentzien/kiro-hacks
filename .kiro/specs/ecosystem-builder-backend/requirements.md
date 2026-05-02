# Requirements Document

## Introduction

The Ecosystem Builder Backend is a Hono-based Node.js HTTP API server that fetches real species and location data from public external APIs. It exposes five REST endpoints that allow clients to geocode cities, discover observed and native species, enrich species metadata, and retrieve a fully merged ecosystem view for any city in the world.

All external data sources are public and require no API keys. The server is implemented as an ESM Node.js module using the Hono framework. Persistence, user accounts, and authentication are out of scope.

---

## Glossary

- **Server**: The Hono Node.js HTTP server that handles all incoming requests.
- **GeocodingService**: The internal service that resolves a city name to geographic metadata (lat/lng, bounding box, county, state, country, region flags) using Nominatim.
- **ObservationService**: The internal service that fetches species observed near a geographic location from GBIF and iNaturalist.
- **NativityService**: The internal service that determines whether a species is native to a given region using POWO (plants) and NatureServe (US/Canada animals).
- **EnrichmentService**: The internal service that fetches common name, taxonomy, photo URL, observation summary, and source links for a species using iNaturalist (primary) and GBIF (fallback).
- **MergeService**: The internal service that combines observed species records with nativity and enrichment data into unified species records, merging on scientific name only.
- **CacheService**: The internal in-memory cache (Map or LRU) that stores geocode results, observed-species queries, nativity lookups, enrichment lookups, and final ecosystem responses to reduce repeated external API calls.
- **Species_Record**: A unified output object representing a single species with scientific name, common name, category, native status, confidence, observation flag, photo URL, and source list.
- **Region**: A normalized geographic object containing city, state, country, county, latitude, and longitude.
- **NativeStatus**: One of `native`, `non-native`, or `unknown`, representing the nativity determination for a species in a given region.
- **Confidence**: One of `high`, `medium`, `low`, or `unknown`, representing the reliability of the nativity determination.
- **Nominatim**: The public OpenStreetMap geocoding API used as the sole geocoding source.
- **GBIF**: The Global Biodiversity Information Facility public API, used as a source for observed species and enrichment fallback.
- **iNaturalist**: The public iNaturalist API, used as a source for observed species and primary enrichment data.
- **POWO**: Plants of the World Online, the public Kew Gardens API used to determine native status for plant species.
- **NatureServe**: The public NatureServe API used to determine native status for animal species in the US and Canada.

---

## Requirements

### Requirement 1: HTTP Server Initialization

**User Story:** As a developer, I want the backend to start as a standard Node.js HTTP server, so that clients can connect to it over HTTP.

#### Acceptance Criteria

1. THE Server SHALL be implemented using the Hono framework targeting the Node.js runtime with `"type": "module"` in `package.json`.
2. WHEN the server starts, THE Server SHALL listen on a configurable port, defaulting to `3000` if no `PORT` environment variable is set.
3. WHEN the server starts, THE Server SHALL initialize the CacheService before accepting any requests.
4. IF the server fails to start due to a port conflict or initialization error, THEN THE Server SHALL log a descriptive error message and exit with a non-zero exit code.
5. THE Server SHALL respond to all requests with `Content-Type: application/json`.

---

### Requirement 2: GET /api/geocode Endpoint

**User Story:** As a client, I want to resolve a city name to normalized geographic metadata, so that I can use the coordinates and region information in subsequent requests.

#### Acceptance Criteria

1. THE Server SHALL expose a `GET /api/geocode` endpoint that accepts the following query parameters: `city` (required), `country` (optional), `state` (optional).
2. WHEN a valid `city` query parameter is provided, THE GeocodingService SHALL query Nominatim to resolve the city to a Region object containing `city`, `state`, `country`, `county`, `lat`, and `lng`.
3. WHEN the geocode result is available in the CacheService, THE Server SHALL return the cached result without making an external API call.
4. IF the `city` query parameter is missing, THEN THE Server SHALL return HTTP 400 with a JSON error body containing a `message` field describing the missing parameter.
5. IF Nominatim returns no results for the provided city, THEN THE Server SHALL return HTTP 404 with a JSON error body containing `message: "City not found"`.
6. IF the Nominatim API call fails due to a network error or non-2xx response, THEN THE Server SHALL return HTTP 502 with a JSON error body containing a `message` field describing the upstream failure.
7. WHEN a successful geocode result is returned, THE Server SHALL store it in the CacheService keyed by the normalized query parameters.

---

### Requirement 3: GET /api/species/observed Endpoint

**User Story:** As a client, I want to retrieve species observed near a geographic location, so that I can see what organisms have been recorded in that area.

#### Acceptance Criteria

1. THE Server SHALL expose a `GET /api/species/observed` endpoint that accepts the following query parameters: `lat` (required), `lng` (required), `radiusKm` (optional, default 50), `categories` (optional, comma-separated subset of `plants,animals`), `limit` (optional, default 100).
2. WHEN valid `lat` and `lng` parameters are provided, THE ObservationService SHALL query both GBIF and iNaturalist in parallel and merge the results into a deduplicated list of observed species records.
3. WHEN merging results from GBIF and iNaturalist, THE ObservationService SHALL deduplicate on scientific name (case-insensitive), retaining the record with the higher observation count when duplicates exist.
4. WHEN the `categories` parameter is provided, THE Server SHALL filter the merged results to include only species whose category matches one of the requested values.
5. WHEN the `limit` parameter is provided, THE Server SHALL return at most that many species records.
6. WHEN the observed-species result for a given lat/lng/radiusKm/categories combination is available in the CacheService, THE Server SHALL return the cached result without making external API calls.
7. IF the `lat` or `lng` query parameter is missing, THEN THE Server SHALL return HTTP 400 with a JSON error body describing the missing parameter.
8. IF both GBIF and iNaturalist return errors, THEN THE Server SHALL return HTTP 502 with a JSON error body describing the upstream failure.
9. IF one of GBIF or iNaturalist returns an error but the other succeeds, THEN THE Server SHALL return the partial results from the successful source without returning an error status.

---

### Requirement 4: GET /api/species/native Endpoint

**User Story:** As a client, I want to determine whether a specific species is native to a given region, so that I can classify species by their nativity status.

#### Acceptance Criteria

1. THE Server SHALL expose a `GET /api/species/native` endpoint that accepts the following query parameters: `scientificName` (required), `country` (required), `state` (optional), `county` (optional), `lat` (optional), `lng` (optional).
2. WHEN the `scientificName` and `country` parameters are provided, THE NativityService SHALL determine the native status of the species in the specified region and return a result containing `nativeStatus` and `confidence`.
3. WHEN the species is a plant (kingdom Plantae), THE NativityService SHALL query POWO to determine native status.
4. WHEN the species is an animal and the `country` is the United States or Canada, THE NativityService SHALL query NatureServe to determine native status.
5. WHEN the species is an animal and the `country` is neither the United States nor Canada, THE NativityService SHALL return `nativeStatus: "unknown"` and `confidence: "unknown"` without making an external API call.
6. WHEN the nativity result for a given scientificName/country/state combination is available in the CacheService, THE Server SHALL return the cached result without making an external API call.
7. IF the `scientificName` or `country` query parameter is missing, THEN THE Server SHALL return HTTP 400 with a JSON error body describing the missing parameter.
8. IF the POWO or NatureServe API call fails, THEN THE Server SHALL return `nativeStatus: "unknown"` and `confidence: "unknown"` rather than returning an HTTP error, and SHALL include a `sourceError` field in the response describing the failure.

---

### Requirement 5: GET /api/species/enrich Endpoint

**User Story:** As a client, I want to retrieve enriched metadata for a species, so that I can display its common name, photo, taxonomy, and links to external sources.

#### Acceptance Criteria

1. THE Server SHALL expose a `GET /api/species/enrich` endpoint that accepts the following query parameters: `scientificName` (required).
2. WHEN the `scientificName` parameter is provided, THE EnrichmentService SHALL query iNaturalist for common name, taxonomy, photo URL, observation summary, and source links.
3. IF iNaturalist returns no result for the scientific name, THEN THE EnrichmentService SHALL fall back to querying GBIF for the same metadata fields.
4. WHEN the enrichment result for a given scientificName is available in the CacheService, THE Server SHALL return the cached result without making an external API call.
5. IF the `scientificName` query parameter is missing, THEN THE Server SHALL return HTTP 400 with a JSON error body describing the missing parameter.
6. IF both iNaturalist and GBIF return no result for the scientific name, THEN THE Server SHALL return HTTP 404 with a JSON error body containing `message: "Species not found"`.
7. IF both iNaturalist and GBIF return errors, THEN THE Server SHALL return HTTP 502 with a JSON error body describing the upstream failure.
8. WHEN a successful enrichment result is returned, THE Server SHALL store it in the CacheService keyed by the normalized scientific name.

---

### Requirement 6: GET /api/ecosystem Endpoint

**User Story:** As a client, I want to retrieve a fully merged ecosystem view for a city, so that I can display observed and native species with enriched metadata in a single response.

#### Acceptance Criteria

1. THE Server SHALL expose a `GET /api/ecosystem` endpoint that accepts the following query parameters: `city` (required), `country` (optional), `state` (optional), `radiusKm` (optional, default 50), `categories` (optional, comma-separated subset of `plants,animals`), `nativeOnly` (optional, `true` or `false`, default `false`), `observedOnly` (optional, `true` or `false`, default `false`), `confidence` (optional, comma-separated subset of `high,medium,low,unknown`), `limit` (optional, default 100).
2. WHEN a valid `city` parameter is provided, THE Server SHALL execute the request pipeline in the following order: (1) validate query parameters, (2) geocode the city via GeocodingService, (3) fetch observed species via ObservationService using the resolved lat/lng, (4) fetch nativity for each observed species via NativityService, (5) enrich each species via EnrichmentService, (6) merge all results via MergeService, (7) apply filters, (8) return the normalized response.
3. WHEN the `nativeOnly` parameter is `true`, THE Server SHALL exclude species whose `nativeStatus` is not `native` from the response.
4. WHEN the `observedOnly` parameter is `true`, THE Server SHALL exclude species whose `observedNearby` field is `false` from the response.
5. WHEN the `confidence` parameter is provided, THE Server SHALL exclude species whose `confidence` value is not in the provided list.
6. WHEN the `categories` parameter is provided, THE Server SHALL exclude species whose `category` is not in the provided list.
7. WHEN the `limit` parameter is provided, THE Server SHALL return at most that many species records in the response.
8. WHEN the final ecosystem response for a given city/country/state/radiusKm/categories combination is available in the CacheService, THE Server SHALL return the cached result without re-executing the pipeline.
9. IF the `city` query parameter is missing, THEN THE Server SHALL return HTTP 400 with a JSON error body describing the missing parameter.
10. IF the city cannot be geocoded, THEN THE Server SHALL return HTTP 404 with a JSON error body containing `message: "City not found"`.
11. IF the ObservationService returns no species for the resolved location, THEN THE Server SHALL return a valid response with an empty `species` array rather than an error.
12. IF any step in the pipeline fails with an unrecoverable error, THEN THE Server SHALL return HTTP 502 with a JSON error body describing the failure.

---

### Requirement 7: Response Model

**User Story:** As a client, I want all API responses to follow a consistent, documented structure, so that I can reliably parse and display the data.

#### Acceptance Criteria

1. THE Server SHALL return all successful `/api/ecosystem` responses as a JSON object with a `region` field and a `species` array.
2. THE `region` field SHALL contain: `city` (string), `state` (string or null), `country` (string), `county` (string or null), `lat` (number), `lng` (number).
3. EACH object in the `species` array SHALL contain: `scientificName` (string), `commonName` (string or null), `category` (string), `nativeStatus` (one of `native`, `non-native`, `unknown`), `confidence` (one of `high`, `medium`, `low`, `unknown`), `observedNearby` (boolean), `photoUrl` (string or null), `sources` (array of strings).
4. THE Server SHALL return all successful `/api/geocode` responses as a JSON object matching the `region` shape defined in Requirement 7.2.
5. THE Server SHALL return all successful `/api/species/observed` responses as a JSON object with a `species` array, where each element contains at minimum `scientificName`, `category`, `observedNearby: true`, and `sources`.
6. THE Server SHALL return all successful `/api/species/native` responses as a JSON object containing `scientificName`, `nativeStatus`, `confidence`, and `sources`.
7. THE Server SHALL return all successful `/api/species/enrich` responses as a JSON object containing `scientificName`, `commonName`, `photoUrl`, `taxonomy`, `observationSummary`, and `sourceLinks`.
8. THE Server SHALL return all error responses as a JSON object containing at minimum a `message` field (string) and an optional `code` field (string).

---

### Requirement 8: MergeService

**User Story:** As a backend developer, I want a dedicated merge step that combines observation, nativity, and enrichment data into unified species records, so that the ecosystem endpoint returns coherent, non-duplicated results.

#### Acceptance Criteria

1. WHEN merging species data, THE MergeService SHALL merge records on scientific name only, never on common name.
2. WHEN a species appears in both GBIF and iNaturalist observation results, THE MergeService SHALL produce a single merged record that includes both sources in the `sources` array.
3. WHEN nativity data is available for a species, THE MergeService SHALL attach the `nativeStatus` and `confidence` fields to the merged record.
4. WHEN enrichment data is available for a species, THE MergeService SHALL attach `commonName`, `photoUrl`, `taxonomy`, and `observationSummary` to the merged record.
5. WHEN nativity data is not available for a species, THE MergeService SHALL set `nativeStatus` to `unknown` and `confidence` to `unknown` on the merged record.
6. WHEN enrichment data is not available for a species, THE MergeService SHALL set `commonName` to `null` and `photoUrl` to `null` on the merged record.
7. THE MergeService SHALL preserve per-source metadata in the `sources` array, listing all external APIs that contributed data for that species.
8. WHEN merging scientific names, THE MergeService SHALL treat names as equal if they match case-insensitively after trimming whitespace.

---

### Requirement 9: CacheService

**User Story:** As a backend developer, I want an in-memory cache to reduce repeated external API calls, so that the server responds faster for repeated or similar queries.

#### Acceptance Criteria

1. THE CacheService SHALL store cached entries in memory using a Map or LRU structure.
2. THE CacheService SHALL cache the following result types: geocode results (keyed by normalized city/country/state), observed-species results (keyed by lat/lng/radiusKm/categories), nativity results (keyed by scientificName/country/state), enrichment results (keyed by normalized scientificName), and final ecosystem responses (keyed by city/country/state/radiusKm/categories).
3. WHEN a cache entry is requested and present, THE CacheService SHALL return the cached value without triggering an external API call.
4. WHEN a cache entry is requested and absent, THE CacheService SHALL return a cache-miss signal so the caller proceeds with the external API call.
5. THE CacheService SHALL support a configurable TTL (time-to-live) per entry type, defaulting to 1 hour for geocode results, 30 minutes for observed-species results, 24 hours for nativity results, 24 hours for enrichment results, and 15 minutes for ecosystem responses.
6. WHEN a cache entry's TTL has expired, THE CacheService SHALL treat it as a cache miss and allow the caller to refresh it.
7. THE CacheService SHALL expose `get(key)`, `set(key, value, ttlMs?)`, and `clear()` methods.

---

### Requirement 10: GeocodingService

**User Story:** As a backend developer, I want a dedicated geocoding service that resolves city names to geographic coordinates and metadata, so that all other services can operate on precise location data.

#### Acceptance Criteria

1. THE GeocodingService SHALL use Nominatim as its sole geocoding source.
2. WHEN a city name is provided, THE GeocodingService SHALL query the Nominatim search API and extract `lat`, `lng`, `city`, `state`, `country`, and `county` from the response.
3. WHEN `country` or `state` parameters are provided alongside `city`, THE GeocodingService SHALL include them in the Nominatim query to improve result accuracy.
4. WHEN Nominatim returns multiple results, THE GeocodingService SHALL select the result with the highest importance score.
5. IF Nominatim returns an empty result set, THEN THE GeocodingService SHALL return a structured not-found result without throwing an exception.
6. IF the Nominatim API returns a non-2xx HTTP status or a network error, THEN THE GeocodingService SHALL return a structured error result without throwing an exception.
7. THE GeocodingService SHALL set a `User-Agent` header on all Nominatim requests as required by the Nominatim usage policy.

---

### Requirement 11: ObservationService

**User Story:** As a backend developer, I want a dedicated observation service that fetches species sightings from GBIF and iNaturalist, so that the ecosystem endpoint reflects real-world biodiversity data.

#### Acceptance Criteria

1. THE ObservationService SHALL query both GBIF and iNaturalist in parallel for each observation request.
2. WHEN querying GBIF, THE ObservationService SHALL use the GBIF occurrence search API with the provided lat/lng and radius parameters.
3. WHEN querying iNaturalist, THE ObservationService SHALL use the iNaturalist observations API with the provided lat/lng and radius parameters.
4. WHEN both sources return results, THE ObservationService SHALL merge and deduplicate the results on scientific name (case-insensitive).
5. WHEN deduplicating, THE ObservationService SHALL retain the record with the higher observation count and include both source names in the `sources` array.
6. IF one source fails and the other succeeds, THE ObservationService SHALL return the partial results from the successful source and include a `partialFailure` flag in the response metadata.
7. IF both sources fail, THE ObservationService SHALL return a structured error result without throwing an exception.
8. THE ObservationService SHALL normalize species category to `plant` or `animal` based on the kingdom returned by each source API.

---

### Requirement 12: NativityService

**User Story:** As a backend developer, I want a dedicated nativity service that determines whether a species is native to a region, so that the ecosystem endpoint can classify species accurately.

#### Acceptance Criteria

1. WHEN the species kingdom is Plantae, THE NativityService SHALL query POWO to determine native status.
2. WHEN the species kingdom is not Plantae and the country is the United States or Canada, THE NativityService SHALL query NatureServe to determine native status.
3. WHEN the species kingdom is not Plantae and the country is neither the United States nor Canada, THE NativityService SHALL return `nativeStatus: "unknown"` and `confidence: "unknown"` without making an external API call.
4. WHEN POWO confirms the species is native to the specified country or region, THE NativityService SHALL return `nativeStatus: "native"` and `confidence: "high"`.
5. WHEN POWO indicates the species is not in its native range for the specified region, THE NativityService SHALL return `nativeStatus: "non-native"` and `confidence: "high"`.
6. WHEN NatureServe returns a native status for the species in the specified US or Canadian jurisdiction, THE NativityService SHALL map the NatureServe status to `native`, `non-native`, or `unknown` and set `confidence` to `high` or `medium` based on the NatureServe rank.
7. IF POWO or NatureServe returns an error or no result, THEN THE NativityService SHALL return `nativeStatus: "unknown"` and `confidence: "unknown"` without throwing an exception.
8. THE NativityService SHALL determine the species kingdom from the enrichment data when available, and fall back to querying GBIF taxonomy when enrichment data is not available.

---

### Requirement 13: EnrichmentService

**User Story:** As a backend developer, I want a dedicated enrichment service that fetches species metadata from iNaturalist and GBIF, so that the ecosystem endpoint can display common names, photos, and taxonomy.

#### Acceptance Criteria

1. WHEN a scientific name is provided, THE EnrichmentService SHALL first query iNaturalist for common name, taxonomy, photo URL, observation summary, and source links.
2. IF iNaturalist returns no result for the scientific name, THEN THE EnrichmentService SHALL query GBIF as a fallback for the same metadata fields.
3. WHEN iNaturalist returns a result, THE EnrichmentService SHALL extract the primary photo URL from the taxon photo data.
4. WHEN GBIF returns a result as fallback, THE EnrichmentService SHALL extract the accepted scientific name, common name (if available), and kingdom from the GBIF species match API.
5. IF both iNaturalist and GBIF return no result, THEN THE EnrichmentService SHALL return a structured not-found result without throwing an exception.
6. IF both iNaturalist and GBIF return errors, THEN THE EnrichmentService SHALL return a structured error result without throwing an exception.
7. THE EnrichmentService SHALL include a `sources` array in all results, listing which APIs contributed data.

---

### Requirement 14: Error Handling and Resilience

**User Story:** As a client, I want the server to handle external API failures gracefully, so that partial data is returned when possible and errors are clearly communicated when not.

#### Acceptance Criteria

1. WHEN an external API call fails with a network error, THE Server SHALL not propagate an unhandled exception to the client.
2. WHEN an external API call fails with a non-2xx HTTP status, THE Server SHALL treat it as a service error and follow the degradation rules defined for that service.
3. IF all external API calls for a required pipeline step fail, THEN THE Server SHALL return HTTP 502 with a descriptive JSON error body.
4. IF an external API call for an optional enrichment step fails, THEN THE Server SHALL return partial results with null fields for the missing enrichment data rather than returning an error.
5. THE Server SHALL return HTTP 400 for all requests with missing required query parameters, with a JSON error body identifying the missing parameter by name.
6. THE Server SHALL return HTTP 404 when a city cannot be geocoded or a species cannot be found.
7. THE Server SHALL return HTTP 500 for unexpected internal errors, with a JSON error body containing a generic `message` field and no internal stack trace details.
8. WHEN a request times out waiting for an external API, THE Server SHALL treat it as a service error after a configurable timeout (default 10 seconds per external call).

---

### Requirement 15: Project Structure

**User Story:** As a developer, I want all backend files to be organized under a single root folder with a clear layout, so that the project is easy to navigate and maintain.

#### Acceptance Criteria

1. THE backend implementation SHALL place all source files under a `food-chain/` directory at the root of the workspace.
2. THE server entry point SHALL reside at `food-chain/index.js` and be responsible for creating and starting the Hono server.
3. THE service modules (`GeocodingService`, `ObservationService`, `NativityService`, `EnrichmentService`, `MergeService`, `CacheService`) SHALL reside under `food-chain/services/`.
4. THE route handler modules SHALL reside under `food-chain/routes/`.
5. THE `package.json` SHALL include `"type": "module"` and list `hono` as a production dependency.
6. THE backend implementation SHALL NOT place any source files or configuration files outside the `food-chain/` directory tree.
