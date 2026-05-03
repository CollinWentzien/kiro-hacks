/**
 * Frontend Chat API Service
 *
 * Sends chat requests to the /api/chat endpoint served by the Vite dev
 * server middleware (vite.config.js) or a production Node server.
 *
 * Backend code (supabaseClient, ragService, orchestrator, etc.) is NEVER
 * imported here — it runs only on the server side.
 */

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
  console.log(`[chatApi] Sending message: "${message.slice(0, 100)}"`);

  let response;
  try {
    response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, profile, history }),
    });
  } catch (networkErr) {
    return { success: false, error: `Network error: ${networkErr.message}` };
  }

  let body;
  try {
    body = await response.json();
  } catch {
    return { success: false, error: `Server returned non-JSON response (HTTP ${response.status})` };
  }

  if (!response.ok) {
    return { success: false, error: body?.error || `HTTP ${response.status}` };
  }

  return body;
}
