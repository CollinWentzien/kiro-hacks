/**
 * Frontend Chat API Service
 *
 * Bridges the React frontend to the backend chat service.
 * In this Vite-only setup, we import the backend directly (no HTTP round-trip).
 * When moving to a real server, replace the direct import with fetch('/api/chat').
 */

import { handleChatRequest } from '../../backend/api/chatService.js';

/**
 * Send a message to the Ecosystem Coach.
 *
 * @param {Object} params
 * @param {string} params.message
 * @param {Object} params.profile  - UserProfile
 * @param {Array}  params.history  - ChatMessage[]
 * @returns {Promise<{ success: boolean, data?: CoachResponse, error?: string }>}
 */
export async function sendChatMessage({ message, profile, history = [] }) {
  // Direct call for Vite dev mode (no server needed)
  return handleChatRequest({ message, profile, history });

  // ── Production HTTP path (uncomment when adding a real server) ──
  // const response = await fetch('/api/chat', {
  //   method: 'POST',
  //   headers: { 'Content-Type': 'application/json' },
  //   body: JSON.stringify({ message, profile, history }),
  // });
  // if (!response.ok) {
  //   const err = await response.json().catch(() => ({}));
  //   return { success: false, error: err.error || 'Network error' };
  // }
  // return response.json();
}
