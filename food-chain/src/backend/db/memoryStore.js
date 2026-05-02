/**
 * Memory Store — Ecosystem Coach
 *
 * Persists user ecosystem profiles, planted species, care history,
 * prior recommendations, and diagnoses across sessions.
 *
 * MVP: in-memory Map (data lives for the browser session).
 * Production path: swap `store` for a Postgres/Supabase client.
 * The public API (getMemory, updateMemory, etc.) stays the same.
 */

/** @type {Map<string, UserMemory>} */
const store = new Map();

/**
 * @typedef {Object} UserMemory
 * @property {string} userId
 * @property {string|null} location
 * @property {string|null} climateZone
 * @property {PlantRecord[]} plantedSpecies
 * @property {FailureRecord[]} failedSpecies
 * @property {RecommendationRecord[]} priorRecommendations
 * @property {DiagnosisRecord[]} diagnosisHistory
 * @property {number} lastUpdated
 */

/**
 * @typedef {Object} PlantRecord
 * @property {string} speciesId
 * @property {string} speciesName
 * @property {string|null} plantedDate
 * @property {string|null} location
 * @property {string} status  - 'active' | 'removed' | 'failed'
 */

/**
 * @typedef {Object} FailureRecord
 * @property {string} speciesId
 * @property {string} speciesName
 * @property {string|null} failedDate
 * @property {string|null} reason
 */

/**
 * @typedef {Object} RecommendationRecord
 * @property {string} id
 * @property {string} topic
 * @property {string[]} species
 * @property {string} summary
 * @property {number} timestamp
 */

/**
 * @typedef {Object} DiagnosisRecord
 * @property {string} id
 * @property {string} symptoms
 * @property {string} diagnosis
 * @property {number} timestamp
 */

/** Returns a blank memory object for a new user */
function createEmptyMemory(userId) {
  return {
    userId,
    location: null,
    climateZone: null,
    plantedSpecies: [],
    failedSpecies: [],
    priorRecommendations: [],
    diagnosisHistory: [],
    lastUpdated: Date.now(),
  };
}

/**
 * Get memory for a user. Creates a blank record if none exists.
 * @param {string} userId
 * @returns {UserMemory}
 */
export function getMemory(userId) {
  if (!store.has(userId)) {
    store.set(userId, createEmptyMemory(userId));
  }
  return { ...store.get(userId) };
}

/**
 * Merge a partial update into a user's memory.
 * @param {string} userId
 * @param {Partial<UserMemory>} patch
 * @returns {UserMemory}
 */
export function updateMemory(userId, patch) {
  const current = getMemory(userId);
  const updated = { ...current, ...patch, lastUpdated: Date.now() };
  store.set(userId, updated);
  return { ...updated };
}

/**
 * Add a planted species record.
 * @param {string} userId
 * @param {PlantRecord} record
 */
export function addPlantedSpecies(userId, record) {
  const mem = getMemory(userId);
  // Avoid duplicates
  const exists = mem.plantedSpecies.some(p => p.speciesId === record.speciesId);
  if (!exists) {
    mem.plantedSpecies.push({ ...record, status: 'active' });
    store.set(userId, { ...mem, lastUpdated: Date.now() });
  }
}

/**
 * Mark a species as failed.
 * @param {string} userId
 * @param {string} speciesId
 * @param {string} speciesName
 * @param {string|null} reason
 */
export function markSpeciesFailed(userId, speciesId, speciesName, reason = null) {
  const mem = getMemory(userId);
  // Update planted record
  mem.plantedSpecies = mem.plantedSpecies.map(p =>
    p.speciesId === speciesId ? { ...p, status: 'failed' } : p
  );
  // Add failure record
  mem.failedSpecies.push({
    speciesId,
    speciesName,
    failedDate: new Date().toISOString().split('T')[0],
    reason,
  });
  store.set(userId, { ...mem, lastUpdated: Date.now() });
}

/**
 * Save a recommendation to memory.
 * @param {string} userId
 * @param {string} topic
 * @param {string[]} species
 * @param {string} summary
 */
export function saveRecommendation(userId, topic, species, summary) {
  const mem = getMemory(userId);
  mem.priorRecommendations.push({
    id: `rec_${Date.now()}`,
    topic,
    species,
    summary,
    timestamp: Date.now(),
  });
  // Keep last 50 recommendations
  if (mem.priorRecommendations.length > 50) {
    mem.priorRecommendations = mem.priorRecommendations.slice(-50);
  }
  store.set(userId, { ...mem, lastUpdated: Date.now() });
}

/**
 * Save a diagnosis to memory.
 * @param {string} userId
 * @param {string} symptoms
 * @param {string} diagnosis
 */
export function saveDiagnosis(userId, symptoms, diagnosis) {
  const mem = getMemory(userId);
  mem.diagnosisHistory.push({
    id: `diag_${Date.now()}`,
    symptoms,
    diagnosis,
    timestamp: Date.now(),
  });
  store.set(userId, { ...mem, lastUpdated: Date.now() });
}

/**
 * Delete all data for a user (GDPR compliance).
 * @param {string} userId
 */
export function deleteUserData(userId) {
  store.delete(userId);
}

/**
 * Build a concise memory summary string for agent context.
 * @param {string} userId
 * @returns {string}
 */
export function buildMemorySummary(userId) {
  const mem = getMemory(userId);
  const lines = [];

  if (mem.location) lines.push(`Location: ${mem.location}`);
  if (mem.climateZone) lines.push(`Climate zone: ${mem.climateZone}`);

  if (mem.plantedSpecies.length > 0) {
    const active = mem.plantedSpecies.filter(p => p.status === 'active');
    lines.push(`Currently planted: ${active.map(p => p.speciesName).join(', ') || 'none'}`);
  }

  if (mem.failedSpecies.length > 0) {
    lines.push(`Previously failed: ${mem.failedSpecies.map(p => p.speciesName).join(', ')}`);
  }

  if (mem.priorRecommendations.length > 0) {
    const last = mem.priorRecommendations[mem.priorRecommendations.length - 1];
    lines.push(`Last recommendation (${new Date(last.timestamp).toLocaleDateString()}): ${last.summary}`);
  }

  return lines.length > 0 ? lines.join('\n') : 'No prior history for this user.';
}
