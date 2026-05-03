/**
 * config.js — Unified configuration for browser and Node.js
 *
 * Browser (Vite build):  reads VITE_* from import.meta.env (injected at build time)
 * Node.js (middleware):  reads non-VITE_ keys from process.env via dotenv
 *
 * WHY TWO SETS OF KEYS:
 * Vite only injects VITE_* vars into import.meta.env, not into process.env.
 * In the Vite dev-server middleware (Node.js), process.env.VITE_* is always
 * undefined even after dotenv.config() runs. We use plain LLM_PROVIDER,
 * OLLAMA_BASE_URL etc. as the Node.js-readable copies.
 *
 * All getters are lazy so they always read the current process.env value,
 * even after dotenv.config() runs inside the middleware.
 */

const isBrowser =
  typeof import.meta !== 'undefined' &&
  typeof import.meta.env !== 'undefined' &&
  import.meta.env.MODE !== undefined;

/**
 * Read a config value.
 * Browser: import.meta.env[viteKey]
 * Node.js: process.env[nodeKey] (lazy — always current after dotenv)
 */
function get(viteKey, nodeKey, fallback = '') {
  if (isBrowser) {
    return import.meta.env[viteKey] ?? fallback;
  }
  // Node.js: prefer the plain key, fall back to the VITE_ key, then the default
  const val = process.env[nodeKey] ?? process.env[viteKey] ?? fallback;
  return val;
}

export const config = {
  // ── LLM ──────────────────────────────────────────────────────────────────
  // Browser reads VITE_LLM_PROVIDER; Node.js reads LLM_PROVIDER
  get llmProvider()    { return get('VITE_LLM_PROVIDER',   'LLM_PROVIDER',   'ollama'); },
  get ollamaBaseUrl()  { return get('VITE_OLLAMA_BASE_URL', 'OLLAMA_BASE_URL', 'http://localhost:11434'); },
  get ollamaModel()    { return get('VITE_OLLAMA_MODEL',    'OLLAMA_MODEL',    'qwen2.5:3b'); },
  get llmTemperature() { return Number(get('VITE_LLM_TEMPERATURE', 'LLM_TEMPERATURE', '0.4')); },
  get llmTimeoutMs()   { return Number(get('VITE_LLM_TIMEOUT_MS',  'LLM_TIMEOUT_MS',  '60000')); },

  // ── Timeouts (derived) ────────────────────────────────────────────────────
  get agentTimeout()        { return this.llmTimeoutMs; },
  get orchestratorTimeout() { return this.llmTimeoutMs + 5000; },

  // ── RAG ──────────────────────────────────────────────────────────────────
  ragTopK:     5,
  ragMinScore: 0.1,

  // ── Memory ────────────────────────────────────────────────────────────────
  memoryStore: 'memory', // 'memory' | 'postgres'

  // ── Feature flags ─────────────────────────────────────────────────────────
  enableDiagnosis:      true,
  enableSustainability: true,
  enableBiodiversity:   true,
  enableMemory:         true,
};
