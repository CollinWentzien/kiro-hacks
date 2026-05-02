# Requirements Document

## Introduction

The Ecosystem Builder Backend is a rule-based, data-driven service layer for a desktop-first React application that lets users design realistic ecosystems. Users can either anchor their ecosystem to a real-world city (outdoor/location mode) or build a curated terrarium or aquarium setup (curated mode). The backend is responsible for all ecological validity: species data access, location resolution, ecosystem state management, food web modeling, warning generation, health scoring, species recommendations, and a thin abstraction layer for LLM-generated plain-language content.

All data is JSON-backed in v1. The backend exposes pure JavaScript service modules consumed by the UI layer. Persistence and saving are out of scope for v1.

---

## Glossary

- **Ecosystem**: A user-assembled collection of species placed into a shared environment, defined by a project mode and optional location.
- **Project Mode**: One of three operating modes — `outdoor` (location-anchored), `terrarium` (curated land enclosure), or `aquarium` (curated aquatic enclosure).
- **Species Record**: A structured data object describing a single species, including ecological roles, trophic level, habitat needs, climate needs, diet, relationships, and care notes.
- **Interaction Record**: A structured data object describing a directional ecological relationship between two species (e.g., predation, pollination, competition).
- **Rule Record**: A structured data object encoding a single ecological validation rule with severity, message template, and applicability conditions.
- **Climate Profile**: A data object describing the temperature range, precipitation, humidity, and biome type associated with a location or habitat.
- **Trophic Level**: A numeric classification of a species' position in the food chain (e.g., 1 = producer, 2 = primary consumer, 3 = secondary consumer).
- **Health Score**: A numeric value from 0 to 100 representing the overall ecological balance of the current ecosystem, computed across multiple dimensions.
- **Health Label**: A categorical descriptor derived from the Health Score — one of: `unstable`, `developing`, `healthy`, or `highly resilient`.
- **Warning**: A per-species or ecosystem-level diagnostic message emitted when a rule is violated, carrying a severity level and human-readable message.
- **Pre-existing Species**: Species automatically included in an outdoor ecosystem based on the resolved location, representing the native environment before user additions.
- **LLM Service**: An abstraction layer that sends structured context to a large language model and returns plain-language text. It is not the source of truth for ecological validity.
- **Species_Service**: The service module responsible for querying and filtering species data.
- **Location_Service**: The service module responsible for resolving a city name to a climate profile, biome, and native species list.
- **Ecosystem_Engine**: The service module responsible for managing the placed species collection and validating compatibility.
- **Food_Web_Engine**: The service module responsible for modeling trophic relationships and ecological dependencies.
- **Warning_Engine**: The service module responsible for evaluating rules against ecosystem state and emitting warnings.
- **Health_Score_Engine**: The service module responsible for computing the Health Score and Health Label.
- **Recommendation_Engine**: The service module responsible for suggesting species that improve or complement the ecosystem.
- **LLM_Service**: The service module that abstracts communication with a large language model.

---

## Requirements

### Requirement 1: Species Data Access

**User Story:** As a backend consumer, I want to query and filter the species catalog, so that the UI can present relevant species choices based on the user's context.

#### Acceptance Criteria

1. THE Species_Service SHALL load species data from `species.json` at initialization and make it available for querying without re-reading the file on each call.
2. WHEN a query is made by kingdom category (e.g., plants, mammals, birds, reptiles, amphibians, fish, insects, fungi, decomposers), THE Species_Service SHALL return only species whose `kingdomCategory` matches the requested value.
3. WHEN a query is made by habitat, THE Species_Service SHALL return only species whose `habitats` array includes the requested habitat type.
4. WHEN a query is made by climate profile, THE Species_Service SHALL return only species whose `climateNeeds` are compatible with the provided climate profile parameters.
5. WHEN a query is made by project mode, THE Species_Service SHALL return only species whose `supportedProjectModes` array includes the requested mode (`outdoor`, `terrarium`, or `aquarium`).
6. WHEN a query is made by native region, THE Species_Service SHALL return only species whose `nativeRegions` array includes the requested region identifier.
7. WHEN multiple filter criteria are provided simultaneously, THE Species_Service SHALL return only species that satisfy all provided criteria.
8. WHEN a species ID is provided, THE Species_Service SHALL return the single matching Species Record, or a structured not-found result if no match exists.
9. IF a query produces no matching species, THEN THE Species_Service SHALL return an empty array rather than an error.

---

### Requirement 2: Location Resolution

**User Story:** As a backend consumer, I want to resolve a city name to ecological context, so that outdoor ecosystems are grounded in real-world climate and native species data.

#### Acceptance Criteria

1. WHEN a city name is provided, THE Location_Service SHALL resolve it to a Climate Profile containing biome type, temperature range, precipitation range, and humidity range.
2. WHEN a city name is provided, THE Location_Service SHALL return the list of pre-existing native species IDs associated with that location's biome and region.
3. WHEN a city name is provided, THE Location_Service SHALL return the geographic region identifier used for invasive species evaluation.
4. IF a city name cannot be matched to a known location entry, THEN THE Location_Service SHALL return a structured error indicating the city was not found, without throwing an unhandled exception.
5. THE Location_Service SHALL load location data from `locations.json` and climate data from `climateProfiles.json` at initialization.
6. WHEN a biome identifier is provided directly, THE Location_Service SHALL return the corresponding Climate Profile without requiring a city name.

---

### Requirement 3: Ecosystem State Management

**User Story:** As a backend consumer, I want to create and modify an ecosystem session, so that the UI can track which species have been placed and in what context.

#### Acceptance Criteria

1. WHEN a project mode and optional location are provided, THE Ecosystem_Engine SHALL initialize a new ecosystem session object containing the mode, resolved climate profile, pre-existing species list (for outdoor mode), and an empty user-placed species collection.
2. WHEN a species ID is added to an ecosystem session, THE Ecosystem_Engine SHALL append the species to the placed species collection and return the updated session state.
3. WHEN a species ID is removed from an ecosystem session, THE Ecosystem_Engine SHALL remove the species from the placed species collection and return the updated session state.
4. WHEN a species is added to an outdoor ecosystem session, THE Ecosystem_Engine SHALL include pre-existing native species in all compatibility evaluations.
5. WHEN a species is added to a terrarium session, THE Ecosystem_Engine SHALL restrict compatibility evaluation to species whose `supportedProjectModes` includes `terrarium`.
6. WHEN a species is added to an aquarium session, THE Ecosystem_Engine SHALL restrict compatibility evaluation to species whose `supportedProjectModes` includes `aquarium`.
7. IF a species ID that does not exist in the species catalog is added, THEN THE Ecosystem_Engine SHALL return a structured error and leave the session state unchanged.
8. THE Ecosystem_Engine SHALL expose the current full species list (pre-existing plus user-placed) as a single merged collection for use by other engines.

---

### Requirement 4: Food Web Modeling

**User Story:** As a backend consumer, I want to model the trophic and dependency relationships among placed species, so that ecological balance can be evaluated accurately.

#### Acceptance Criteria

1. WHEN the food web is computed for an ecosystem session, THE Food_Web_Engine SHALL assign each species to its trophic level using the `trophicLevel` field from its Species Record.
2. WHEN the food web is computed, THE Food_Web_Engine SHALL identify all predator-prey pairs by cross-referencing each species' `predators` and `prey` fields against the placed species collection.
3. WHEN the food web is computed, THE Food_Web_Engine SHALL identify pollination dependencies by detecting species with pollinator roles and species that require pollination.
4. WHEN the food web is computed, THE Food_Web_Engine SHALL identify resource competition pairs using Interaction Records with `relationshipType` of `competition`.
5. WHEN the food web is computed, THE Food_Web_Engine SHALL identify symbiotic and beneficial relationships using Interaction Records with `relationshipType` of `symbiosis` or `mutualism`.
6. WHEN the food web is computed, THE Food_Web_Engine SHALL compute the ratio of predator biomass support to prey biomass availability at each trophic level transition.
7. WHEN the food web is computed, THE Food_Web_Engine SHALL identify missing foundational species — specifically, whether at least one producer (trophic level 1) is present in the ecosystem.
8. WHEN the food web is computed, THE Food_Web_Engine SHALL identify decomposer presence by checking whether at least one species with an `ecosystemRoles` value of `decomposer` is present.
9. THE Food_Web_Engine SHALL load interaction data from `interactions.json` at initialization.
10. WHEN the food web is computed, THE Food_Web_Engine SHALL return a structured food web object containing trophic level assignments, identified relationship pairs, computed ratios, and gap flags.

---

### Requirement 5: Warning Generation

**User Story:** As a backend consumer, I want to receive structured warnings about ecological problems in the current ecosystem, so that the UI can surface actionable feedback to the user.

#### Acceptance Criteria

1. WHEN the warning evaluation is triggered for an ecosystem session, THE Warning_Engine SHALL evaluate all applicable Rule Records from `ecosystemRules.json` against the current ecosystem state.
2. WHEN a rule's conditions are met, THE Warning_Engine SHALL emit a Warning object containing the rule ID, severity level, a human-readable message, and the IDs of the species involved.
3. WHEN an invasive species is present in the ecosystem and the project mode is `outdoor`, THE Warning_Engine SHALL emit a warning for each species whose `invasiveRegions` array includes the resolved geographic region.
4. WHEN the predator-to-prey ratio at any trophic level exceeds the threshold defined in the applicable Rule Record, THE Warning_Engine SHALL emit a warning identifying the imbalanced trophic level and the species involved.
5. WHEN a species is placed whose `habitats` array does not include the ecosystem's resolved habitat type, THE Warning_Engine SHALL emit a habitat mismatch warning for that species.
6. WHEN a species is placed whose `climateNeeds` are incompatible with the ecosystem's resolved Climate Profile, THE Warning_Engine SHALL emit a climate incompatibility warning for that species.
7. WHEN no producer species (trophic level 1) is present in the ecosystem, THE Warning_Engine SHALL emit a missing-producer warning at the ecosystem level.
8. WHEN a species in the placed collection has a `conflictsWith` entry that matches another species in the placed collection, THE Warning_Engine SHALL emit a coexistence conflict warning identifying both species.
9. WHEN a species' `dependencies` list includes a species ID that is not present in the placed collection, THE Warning_Engine SHALL emit a missing-dependency warning for that species.
10. WHEN the number of species of a given type exceeds the `maxDensityHint` for that species, THE Warning_Engine SHALL emit an overcrowding warning.
11. WHEN a pollinator-dependent species is present but no pollinator species is present, THE Warning_Engine SHALL emit a missing-pollinator warning.
12. THE Warning_Engine SHALL return all emitted warnings as an array, ordered by severity (highest first), with each warning carrying a `severity` field of `critical`, `major`, or `minor`.

---

### Requirement 6: Health Score Computation

**User Story:** As a backend consumer, I want a numeric health score and label for the current ecosystem, so that the UI can give users a clear summary of ecological balance.

#### Acceptance Criteria

1. WHEN the health score is computed, THE Health_Score_Engine SHALL produce a numeric score in the range 0 to 100 inclusive.
2. WHEN the health score is computed, THE Health_Score_Engine SHALL evaluate the following dimensions and combine them into the final score: producer sufficiency, prey/predator balance, biodiversity, pollination support, habitat compatibility, climate/location suitability, invasive species penalties, resource competition penalties, decomposer presence, aquatic/terrestrial fit, and dependency satisfaction.
3. WHEN the health score is computed, THE Health_Score_Engine SHALL assign a Health Label based on the score: a score below 40 SHALL produce `unstable`, 40–59 SHALL produce `developing`, 60–79 SHALL produce `healthy`, and 80–100 SHALL produce `highly resilient`.
4. WHEN the health score is computed, THE Health_Score_Engine SHALL return a breakdown object containing the individual score contribution and weight for each dimension, in addition to the total score and label.
5. WHEN an invasive species is present in an outdoor ecosystem, THE Health_Score_Engine SHALL apply a penalty to the invasive species dimension score proportional to the number of invasive species present.
6. WHEN no decomposer species is present, THE Health_Score_Engine SHALL assign a score of 0 to the decomposer presence dimension.
7. WHEN the project mode is `aquarium`, THE Health_Score_Engine SHALL exclude the terrestrial-fit dimension from scoring and weight the aquatic-fit dimension accordingly.
8. WHEN the project mode is `terrarium`, THE Health_Score_Engine SHALL exclude the aquatic-fit dimension from scoring and weight the terrestrial-fit dimension accordingly.
9. WHEN the ecosystem contains zero species, THE Health_Score_Engine SHALL return a score of 0 and a label of `unstable`.

---

### Requirement 7: Species Recommendations

**User Story:** As a backend consumer, I want species recommendations tailored to the current ecosystem state, so that the UI can guide users toward a more balanced and realistic ecosystem.

#### Acceptance Criteria

1. WHEN recommendations are requested for an ecosystem session, THE Recommendation_Engine SHALL return species that are ecologically compatible with the current ecosystem's project mode, habitat, and climate profile.
2. WHEN recommendations are requested, THE Recommendation_Engine SHALL include species that fill identified ecological gaps — specifically, missing producers, missing decomposers, or missing pollinators flagged by the Warning_Engine.
3. WHEN recommendations are requested, THE Recommendation_Engine SHALL include species from the `similarSpecies` and `nearbySpecies` fields of already-placed species that are not already in the ecosystem.
4. WHEN recommendations are requested for an outdoor ecosystem, THE Recommendation_Engine SHALL prioritize species whose `nativeRegions` includes the resolved region over non-native species.
5. WHEN recommendations are requested, THE Recommendation_Engine SHALL exclude species already present in the placed species collection.
6. WHEN recommendations are requested, THE Recommendation_Engine SHALL exclude species whose `conflictsWith` list includes any species already in the placed collection.
7. WHEN recommendations are requested, THE Recommendation_Engine SHALL return each recommendation with a reason code indicating why it was suggested (e.g., `fills-gap`, `native-match`, `similar-species`, `improves-balance`).
8. IF no recommendations can be generated for the current ecosystem state, THEN THE Recommendation_Engine SHALL return an empty array rather than an error.

---

### Requirement 8: LLM Service Abstraction

**User Story:** As a backend consumer, I want a consistent interface for requesting plain-language content from a large language model, so that the UI can display educational and explanatory text without coupling to a specific LLM provider.

#### Acceptance Criteria

1. WHEN a warning explanation is requested, THE LLM_Service SHALL accept a structured context object containing the warning data and relevant species information, and return a plain-language explanation string.
2. WHEN an educational summary is requested for a species, THE LLM_Service SHALL accept the Species Record as input and return a plain-language educational summary string.
3. WHEN a recommendation narrative is requested, THE LLM_Service SHALL accept the recommendation object and ecosystem context as input and return a plain-language narrative string.
4. THE LLM_Service SHALL NOT make any ecological validity decisions — all rule evaluation, scoring, and recommendations SHALL be determined by the rule-based engines before being passed to the LLM_Service as context.
5. IF the LLM provider returns an error or is unavailable, THEN THE LLM_Service SHALL return a structured error object without throwing an unhandled exception, allowing the UI to fall back to non-narrative display.
6. THE LLM_Service SHALL expose a provider-agnostic interface so that the underlying LLM provider can be swapped without changes to the calling code.

---

### Requirement 9: Data Integrity and Rule Loading

**User Story:** As a backend consumer, I want all data files to be validated at load time, so that malformed data does not cause silent failures during ecosystem evaluation.

#### Acceptance Criteria

1. WHEN any JSON data file (`species.json`, `locations.json`, `interactions.json`, `ecosystemRules.json`, `habitats.json`, `climateProfiles.json`, `recommendationRules.json`) is loaded, THE data loading layer SHALL validate that the file is parseable JSON and that required top-level fields are present.
2. IF a required data file is missing or unparseable, THEN THE data loading layer SHALL throw a descriptive initialization error identifying the file and the nature of the problem.
3. WHEN species records are loaded, THE data loading layer SHALL validate that each record contains the required fields: `id`, `commonName`, `scientificName`, `kingdomCategory`, `trophicLevel`, `supportedProjectModes`, `habitats`, and `climateNeeds`.
4. WHEN interaction records are loaded, THE data loading layer SHALL validate that each record contains `sourceSpeciesId`, `targetSpeciesId`, and `relationshipType`.
5. WHEN rule records are loaded, THE data loading layer SHALL validate that each record contains `id`, `type`, `severity`, `message`, and `appliesTo`.
6. THE data loading layer SHALL deduplicate species records by `id` and emit a warning to the console if duplicate IDs are detected, retaining the first occurrence.

---

### Requirement 11: Project Root Directory Structure

**User Story:** As a developer, I want all backend files to be organized under a single root folder, so that the project has a clear, predictable layout that is easy to navigate and maintain.

#### Acceptance Criteria

1. THE backend implementation SHALL place all files — including JSON data files, service modules, utility modules, and the public API entry point — under a `food-chain/` directory at the root of the workspace.
2. THE JSON data files (`species.json`, `locations.json`, `interactions.json`, `ecosystemRules.json`, `habitats.json`, `climateProfiles.json`, `recommendationRules.json`) SHALL reside under `food-chain/data/`.
3. THE service modules (`Species_Service`, `Location_Service`, `Ecosystem_Engine`, `Food_Web_Engine`, `Warning_Engine`, `Health_Score_Engine`, `Recommendation_Engine`, `LLM_Service`) SHALL reside under `food-chain/services/`.
4. THE public API entry point that re-exports all service modules SHALL reside at `food-chain/index.js`.
5. THE backend implementation SHALL NOT place any source files, data files, or configuration files outside the `food-chain/` directory tree.

---

### Requirement 10: Cross-Cutting Concerns

**User Story:** As a backend consumer, I want all service modules to follow consistent error handling and output contracts, so that the UI layer can handle responses uniformly.

#### Acceptance Criteria

1. THE Species_Service, Location_Service, Ecosystem_Engine, Food_Web_Engine, Warning_Engine, Health_Score_Engine, and Recommendation_Engine SHALL each return structured result objects rather than throwing exceptions for expected error conditions.
2. WHEN a service call succeeds, THE result object SHALL contain a `success` field set to `true` and a `data` field containing the result payload.
3. WHEN a service call fails due to an expected error condition, THE result object SHALL contain a `success` field set to `false` and an `error` field containing a human-readable message and an error code string.
4. THE Ecosystem_Engine SHALL treat the combined set of pre-existing species and user-placed species as the authoritative species list for all engine evaluations, ensuring pre-existing species participate in food web, warning, and health score computations.
5. WHEN the project mode is `outdoor` and no location has been resolved, THE Ecosystem_Engine SHALL return an error if any location-dependent operation (invasive species check, native species list, climate compatibility) is attempted.
