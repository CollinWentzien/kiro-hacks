/**
 * Core configuration for the AI Ecosystem Coach backend.
 */

const apiKey = typeof import.meta !== 'undefined'
  ? import.meta.env?.VITE_OPENAI_API_KEY
  : (typeof process !== 'undefined' ? process.env?.OPENAI_API_KEY : null);

export const config = {
  llmProvider: apiKey ? 'openai' : 'mock',
  llmModel: 'gpt-4o-mini',
  llmApiKey: apiKey,

  ragTopK: 5,
  ragMinScore: 0.3,

  agentTimeout: 8000,
  orchestratorTimeout: 12000,

  memoryStore: 'memory',

  enableDiagnosis: true,
  enableSustainability: true,
  enableBiodiversity: true,
  enableMemory: true,
};
