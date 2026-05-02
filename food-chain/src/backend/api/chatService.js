/**
 * Chat Service — Backend API Layer
 *
 * Handles the POST /api/chat request.
 * Validates input, calls the orchestrator, and returns the CoachResponse.
 *
 * This is a pure JavaScript module (no Express/Fastify) so it works
 * in both a Vite dev server context and a standalone Node server.
 * To add Express: wrap handleChatRequest in an Express route handler.
 */

import { orchestrate } from '../agents/orchestrator.js';
import { createDefaultProfile } from '../schemas/index.js';

/**
 * Validate and normalize a chat request.
 *
 * @param {Object} body - Raw request body
 * @returns {{ valid: boolean, data?: Object, error?: string }}
 */
function validateRequest(body) {
  if (!body || typeof body !== 'object') {
    return { valid: false, error: 'Request body must be a JSON object' };
  }

  const { message, profile, history } = body;

  if (!message || typeof message !== 'string') {
    return { valid: false, error: 'message is required and must be a string' };
  }

  if (message.length > 4000) {
    return { valid: false, error: 'message must be 4000 characters or fewer' };
  }

  if (message.trim().length === 0) {
    return { valid: false, error: 'message cannot be empty' };
  }

  return {
    valid: true,
    data: {
      message: message.trim(),
      profile: normalizeProfile(profile),
      history: Array.isArray(history) ? history.slice(-20) : [], // keep last 20 messages
    },
  };
}

/**
 * Normalize and fill defaults for a user profile.
 *
 * @param {Object|null} profile
 * @returns {Object}
 */
function normalizeProfile(profile) {
  const defaults = createDefaultProfile('anonymous');

  if (!profile || typeof profile !== 'object') return defaults;

  return {
    userId: profile.userId || defaults.userId,
    location: profile.location || defaults.location,
    climateZone: profile.climateZone || defaults.climateZone,
    hardiness: profile.hardiness || defaults.hardiness,
    soilType: profile.soilType || defaults.soilType,
    sunExposure: profile.sunExposure || defaults.sunExposure,
    gardenSize: profile.gardenSize || defaults.gardenSize,
    preferences: Array.isArray(profile.preferences) ? profile.preferences : defaults.preferences,
    placedSpeciesIds: Array.isArray(profile.placedSpeciesIds) ? profile.placedSpeciesIds : defaults.placedSpeciesIds,
  };
}

/**
 * Main chat request handler.
 * Call this from any HTTP framework or directly from the frontend service.
 *
 * @param {Object} body - { message, profile, history }
 * @returns {Promise<{ success: boolean, data?: Object, error?: string }>}
 */
export async function handleChatRequest(body) {
  const validation = validateRequest(body);

  if (!validation.valid) {
    return {
      success: false,
      error: validation.error,
    };
  }

  try {
    const response = await orchestrate(validation.data);
    return {
      success: true,
      data: response,
    };
  } catch (err) {
    console.error('[ChatService] Orchestrator error:', err);
    return {
      success: false,
      error: 'The ecosystem coach encountered an error. Please try again.',
      details: err.message,
    };
  }
}
