/**
 * Memory Agent
 *
 * Manages user memory: retrieves relevant history, saves new interactions,
 * and provides context about the user's ecosystem journey.
 *
 * Input: AgentInput
 * Output: AgentOutput with memory data
 */

import {
  getMemory,
  updateMemory,
  saveRecommendation,
  saveDiagnosis,
  buildMemorySummary,
} from '../db/memoryStore.js';
import { SPECIES_BY_ID } from '../../data/species.js';

const SYSTEM_PROMPT = `You are the Memory Agent. You retrieve and manage the user's ecosystem history.
You surface relevant past recommendations, planted species, and failures to provide continuity.
You ensure the Coach never recommends species the user has previously marked as failed.`;

/**
 * @param {import('../schemas/index.js').AgentInput} input
 * @returns {Promise<import('../schemas/index.js').AgentOutput>}
 */
export async function runMemoryAgent(input) {
  try {
    const { message, profile } = input;
    const userId = profile.userId || 'anonymous';
    const msg = message.toLowerCase();

    const memory = getMemory(userId);

    // Update memory with current profile data
    if (profile.location && !memory.location) {
      updateMemory(userId, { location: profile.location });
    }
    if (profile.climateZone && !memory.climateZone) {
      updateMemory(userId, { climateZone: profile.climateZone });
    }

    // Sync placed species from canvas to memory
    if (profile.placedSpeciesIds?.length > 0) {
      syncPlacedSpecies(userId, profile.placedSpeciesIds, memory);
    }

    // Check if user is asking about history
    const isHistoryQuery = /remember|history|before|last time|previous|recommend|planted|what did/.test(msg);

    let recalled = null;
    if (isHistoryQuery) {
      recalled = buildRecallResponse(memory, msg);
    }

    // Build summary for other agents
    const summary = buildMemorySummary(userId);

    // Get failed species IDs to pass to planning agent
    const failedSpeciesIds = memory.failedSpecies.map(f => f.speciesId);

    return {
      agentId: 'memory',
      success: true,
      data: {
        summary,
        recalled,
        failedSpeciesIds,
        plantedCount: memory.plantedSpecies.filter(p => p.status === 'active').length,
        priorRecommendationCount: memory.priorRecommendations.length,
        hasHistory: memory.plantedSpecies.length > 0 || memory.priorRecommendations.length > 0,
        memory: {
          plantedSpecies: memory.plantedSpecies,
          failedSpecies: memory.failedSpecies,
          recentRecommendations: memory.priorRecommendations.slice(-3),
        },
      },
      error: null,
    };
  } catch (err) {
    return {
      agentId: 'memory',
      success: false,
      data: {},
      error: err.message,
    };
  }
}

/** Sync canvas species to memory store */
function syncPlacedSpecies(userId, placedIds, memory) {
  const existingIds = new Set(memory.plantedSpecies.map(p => p.speciesId));

  for (const id of placedIds) {
    if (!existingIds.has(id)) {
      const species = SPECIES_BY_ID[id];
      if (species) {
        const mem = getMemory(userId);
        mem.plantedSpecies.push({
          speciesId: id,
          speciesName: species.name,
          plantedDate: new Date().toISOString().split('T')[0],
          location: null,
          status: 'active',
        });
        updateMemory(userId, { plantedSpecies: mem.plantedSpecies });
      }
    }
  }
}

/** Build a natural-language recall response */
function buildRecallResponse(memory, message) {
  const parts = [];

  if (memory.plantedSpecies.length > 0) {
    const active = memory.plantedSpecies.filter(p => p.status === 'active');
    if (active.length > 0) {
      parts.push(`You currently have ${active.map(p => p.speciesName).join(', ')} in your ecosystem.`);
    }
  }

  if (memory.failedSpecies.length > 0) {
    parts.push(`Previously, ${memory.failedSpecies.map(p => p.speciesName).join(', ')} didn't work out.`);
  }

  if (memory.priorRecommendations.length > 0) {
    const last = memory.priorRecommendations[memory.priorRecommendations.length - 1];
    const date = new Date(last.timestamp).toLocaleDateString();
    parts.push(`Last recommendation (${date}): ${last.summary}`);
  }

  return parts.length > 0 ? parts.join(' ') : null;
}
