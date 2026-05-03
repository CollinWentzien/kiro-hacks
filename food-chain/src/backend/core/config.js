/**
 * Core configuration for the AI Ecosystem Coach backend.
 * All environment-specific values live here so they're easy to swap.
 */

export const config = {
  // LLM provider — set to 'mock' until a real key is available
  llmProvider: 'mock', // 'mock' | 'openai' | 'qwen' | 'local'
  llmModel: 'gpt-4o',
  llmApiKey: typeof process !== 'undefined' ? process.env?.OPENAI_API_KEY : null,

  // RAG settings
  ragTopK: 5,
  ragMinScore: 0.3, // keyword relevance threshold (0–1)

  // Orchestrator timeouts (ms)
  agentTimeout: 8000,
  orchestratorTimeout: 12000,

  // Memory store — 'memory' | 'json' | 'postgres'
  memoryStore: 'memory',

  // Feature flags
  enableDiagnosis: true,
  enableSustainability: true,
  enableBiodiversity: true,
  enableMemory: true,
};
