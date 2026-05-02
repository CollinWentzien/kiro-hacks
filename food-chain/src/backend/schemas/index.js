/**
 * Shared type/schema definitions for the AI Ecosystem Coach.
 * These are plain JS objects used as documentation and runtime validation helpers.
 * Replace with Zod or JSON Schema when adding a real validation layer.
 */

/**
 * @typedef {Object} UserProfile
 * @property {string} userId
 * @property {string|null} location       - e.g. "Portland, Oregon"
 * @property {string|null} climateZone    - e.g. "temperate"
 * @property {string|null} hardiness      - USDA zone, e.g. "8b"
 * @property {string|null} soilType       - e.g. "loamy"
 * @property {string|null} sunExposure    - "full sun" | "partial shade" | "full shade"
 * @property {string|null} gardenSize     - e.g. "20x30 ft"
 * @property {string[]} preferences       - ["organic-only","native-only","low-water","pollinator-focus"]
 * @property {string[]} placedSpeciesIds  - IDs from the ecosystem canvas
 */

/**
 * @typedef {Object} ChatMessage
 * @property {'user'|'assistant'} role
 * @property {string} content
 * @property {number} timestamp
 */

/**
 * @typedef {Object} ChatRequest
 * @property {string} message
 * @property {UserProfile} profile
 * @property {ChatMessage[]} history
 */

/**
 * @typedef {Object} AgentInput
 * @property {string} message
 * @property {UserProfile} profile
 * @property {string[]} intents
 * @property {string} ragContext
 * @property {Object} memory
 */

/**
 * @typedef {Object} AgentOutput
 * @property {string} agentId
 * @property {boolean} success
 * @property {Object} data
 * @property {string|null} error
 */

/**
 * @typedef {Object} CoachResponse
 * @property {string} message              - Main natural-language response
 * @property {string[]} recommendations    - Ranked list of plant/species suggestions
 * @property {string} reasoningSummary     - Why these recommendations were made
 * @property {Object|null} sustainability  - { score, notes, suggestions }
 * @property {Object|null} biodiversity    - { score, trophicBreakdown, gaps }
 * @property {Object|null} diagnosis       - { causes, treatments, spreadRisk }
 * @property {string[]} nextActions        - Concrete next steps for the user
 * @property {string[]} agentsUsed         - Which agents contributed
 */

/** Creates a default empty UserProfile */
export function createDefaultProfile(userId = 'anonymous') {
  return {
    userId,
    location: null,
    climateZone: null,
    hardiness: null,
    soilType: null,
    sunExposure: null,
    gardenSize: null,
    preferences: [],
    placedSpeciesIds: [],
  };
}

/** Creates a default empty CoachResponse */
export function createDefaultResponse() {
  return {
    message: '',
    recommendations: [],
    reasoningSummary: '',
    sustainability: null,
    biodiversity: null,
    diagnosis: null,
    nextActions: [],
    agentsUsed: [],
  };
}
