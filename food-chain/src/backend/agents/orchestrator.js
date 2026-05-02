/**
 * Orchestrator Agent
 *
 * The central coordinator of the multi-agent system.
 * Responsibilities:
 * 1. Receive user message + profile
 * 2. Detect intent(s) from the message
 * 3. Build shared state (RAG context, memory summary)
 * 4. Invoke relevant specialist agents (in parallel where possible)
 * 5. Merge agent outputs via the decision engine
 * 6. Pass merged data to the LLM Coach for natural-language response
 * 7. Return a structured CoachResponse
 *
 * Data flow:
 * ChatRequest → Orchestrator → [Memory, RAG, Agents] → DecisionEngine → LLMCoach → CoachResponse
 */

import { buildRagContext } from '../rag/knowledgeBase.js';
import { buildMemorySummary, saveRecommendation, saveDiagnosis, getMemory } from '../db/memoryStore.js';
import { runPlantPlanningAgent } from './plantPlanningAgent.js';
import { runSustainabilityAgent } from './sustainabilityAgent.js';
import { runBiodiversityAgent } from './biodiversityAgent.js';
import { runDiagnosisAgent } from './diagnosisAgent.js';
import { runMemoryAgent } from './memoryAgent.js';
import { runLLMCoach } from './llmCoach.js';
import { createDefaultResponse } from '../schemas/index.js';
import { config } from '../core/config.js';

/**
 * Intent detection patterns.
 * Maps intent names to keyword patterns.
 */
const INTENT_PATTERNS = {
  planning: /plant|recommend|suggest|grow|garden|add|what should|species|ecosystem|build|design|pollinator|native|companion/i,
  sustainability: /sustain|water|native|eco|green|impact|score|efficient|drought|environment/i,
  biodiversity: /biodiversity|health|trophic|food chain|balance|diversity|score|ecosystem health|missing/i,
  diagnosis: /yellow|wilt|droop|spot|brown|white|mold|pest|sick|dying|problem|diagnos|symptom|disease|bug|insect|rot|crispy|pale|stunted|help my plant/i,
  memory: /remember|history|before|last time|previous|recommend|planted|what did|recall/i,
  general: /.*/,
};

/**
 * Detect intents from a user message.
 * Returns an array of intent strings, ordered by relevance.
 *
 * @param {string} message
 * @returns {string[]}
 */
function detectIntents(message) {
  const intents = [];

  for (const [intent, pattern] of Object.entries(INTENT_PATTERNS)) {
    if (intent === 'general') continue;
    if (pattern.test(message)) {
      intents.push(intent);
    }
  }

  // Always include general as fallback
  if (intents.length === 0) intents.push('general');

  return intents;
}

/**
 * Run an agent with a timeout.
 * Returns the agent output or an error output if it times out.
 *
 * @param {Function} agentFn
 * @param {Object} input
 * @param {string} agentId
 * @returns {Promise<Object>}
 */
async function runWithTimeout(agentFn, input, agentId) {
  const timeout = new Promise((_, reject) =>
    setTimeout(() => reject(new Error(`Agent ${agentId} timed out`)), config.agentTimeout)
  );

  try {
    return await Promise.race([agentFn(input), timeout]);
  } catch (err) {
    console.warn(`[Orchestrator] Agent ${agentId} failed:`, err.message);
    return {
      agentId,
      success: false,
      data: {},
      error: err.message,
    };
  }
}

/**
 * Merge all agent outputs into a single structured data object.
 * This is the Decision Engine layer.
 *
 * @param {Object[]} agentOutputs
 * @param {string[]} intents
 * @returns {Object}
 */
function mergeAgentOutputs(agentOutputs, intents) {
  const merged = {
    intents,
    planning: null,
    sustainability: null,
    biodiversity: null,
    diagnosis: null,
    memory: null,
    errors: [],
  };

  for (const output of agentOutputs) {
    if (!output.success) {
      merged.errors.push({ agent: output.agentId, error: output.error });
      continue;
    }

    switch (output.agentId) {
      case 'plant-planning':
        merged.planning = output.data;
        break;
      case 'sustainability':
        merged.sustainability = output.data;
        break;
      case 'biodiversity':
        merged.biodiversity = output.data;
        break;
      case 'diagnosis':
        if (output.data.applicable !== false) {
          merged.diagnosis = output.data;
        }
        break;
      case 'memory':
        merged.memory = output.data;
        break;
    }
  }

  return merged;
}

/**
 * Build the final structured CoachResponse from merged agent data.
 *
 * @param {string} naturalLanguageResponse
 * @param {Object} mergedData
 * @param {string[]} agentsUsed
 * @returns {import('../schemas/index.js').CoachResponse}
 */
function buildCoachResponse(naturalLanguageResponse, mergedData, agentsUsed) {
  const response = createDefaultResponse();

  response.message = naturalLanguageResponse;
  response.agentsUsed = agentsUsed;

  // Recommendations from planning agent
  if (mergedData.planning?.recommendations) {
    response.recommendations = mergedData.planning.recommendations.map(r =>
      `${r.name} (${r.latin}) — ${r.reason}`
    );
  }

  // Reasoning summary
  const reasoningParts = [];
  if (mergedData.intents.length > 0) {
    reasoningParts.push(`Detected intents: ${mergedData.intents.join(', ')}`);
  }
  if (mergedData.planning?.totalCandidatesEvaluated) {
    reasoningParts.push(`Evaluated ${mergedData.planning.totalCandidatesEvaluated} candidate species`);
  }
  if (mergedData.sustainability?.score !== undefined) {
    reasoningParts.push(`Sustainability score: ${mergedData.sustainability.score}/100`);
  }
  if (mergedData.biodiversity?.score !== undefined) {
    reasoningParts.push(`Biodiversity score: ${mergedData.biodiversity.score}/100`);
  }
  response.reasoningSummary = reasoningParts.join('. ');

  // Sustainability data
  if (mergedData.sustainability && mergedData.sustainability.score !== undefined) {
    response.sustainability = {
      score: mergedData.sustainability.score,
      nativeRatio: mergedData.sustainability.nativeRatio,
      waterSummary: mergedData.sustainability.waterSummary,
      suggestions: mergedData.sustainability.suggestions || [],
      breakdown: mergedData.sustainability.breakdown,
    };
  }

  // Biodiversity data
  if (mergedData.biodiversity && mergedData.biodiversity.score !== undefined) {
    response.biodiversity = {
      score: mergedData.biodiversity.score,
      trophicBreakdown: mergedData.biodiversity.trophicBreakdown,
      gaps: mergedData.biodiversity.gaps || [],
      recommendations: mergedData.biodiversity.recommendations || [],
      warnings: mergedData.biodiversity.predatorWarnings || [],
    };
  }

  // Diagnosis data
  if (mergedData.diagnosis?.causes?.length > 0) {
    response.diagnosis = {
      causes: mergedData.diagnosis.causes,
      spreadRisk: mergedData.diagnosis.spreadRisk,
      atRiskSpecies: mergedData.diagnosis.atRiskSpecies || [],
      needsMoreInfo: mergedData.diagnosis.needsMoreInfo,
      clarifyingQuestion: mergedData.diagnosis.clarifyingQuestion,
    };
  }

  // Next actions
  const nextActions = [];
  if (mergedData.planning?.recommendations?.length > 0) {
    nextActions.push(`Consider adding ${mergedData.planning.recommendations[0].name} to your ecosystem`);
  }
  if (mergedData.sustainability?.suggestions?.length > 0) {
    nextActions.push(mergedData.sustainability.suggestions[0]);
  }
  if (mergedData.biodiversity?.recommendations?.length > 0) {
    nextActions.push(mergedData.biodiversity.recommendations[0]);
  }
  if (mergedData.diagnosis?.causes?.length > 0) {
    nextActions.push(`Treatment: ${mergedData.diagnosis.causes[0].treatment}`);
  }
  response.nextActions = nextActions.slice(0, 4);

  return response;
}

/**
 * Main orchestrator function.
 * Entry point for all chat requests.
 *
 * @param {import('../schemas/index.js').ChatRequest} request
 * @returns {Promise<import('../schemas/index.js').CoachResponse>}
 */
export async function orchestrate(request) {
  const { message, profile, history = [] } = request;
  const userId = profile?.userId || 'anonymous';

  console.log(`[Orchestrator] Processing message for user ${userId}: "${message.slice(0, 80)}..."`);

  // Step 1: Detect intents
  const intents = detectIntents(message);
  console.log(`[Orchestrator] Detected intents: ${intents.join(', ')}`);

  // Step 2: Build RAG context
  const ragContext = buildRagContext(message);

  // Step 3: Get memory summary
  const memorySummary = buildMemorySummary(userId);
  const memory = getMemory(userId);

  // Step 4: Build shared agent input
  const agentInput = {
    message,
    profile: profile || { userId, placedSpeciesIds: [] },
    intents,
    ragContext,
    memory,
    history,
  };

  // Step 5: Determine which agents to invoke
  const agentsToRun = [];
  const agentsUsed = [];

  // Memory agent always runs
  agentsToRun.push({ fn: runMemoryAgent, id: 'memory' });
  agentsUsed.push('memory');

  if (intents.includes('planning') || intents.includes('general')) {
    agentsToRun.push({ fn: runPlantPlanningAgent, id: 'plant-planning' });
    agentsUsed.push('plant-planning');
  }

  if (intents.includes('sustainability')) {
    agentsToRun.push({ fn: runSustainabilityAgent, id: 'sustainability' });
    agentsUsed.push('sustainability');
  }

  if (intents.includes('biodiversity')) {
    agentsToRun.push({ fn: runBiodiversityAgent, id: 'biodiversity' });
    agentsUsed.push('biodiversity');
  }

  if (intents.includes('diagnosis')) {
    agentsToRun.push({ fn: runDiagnosisAgent, id: 'diagnosis' });
    agentsUsed.push('diagnosis');
  }

  // If ecosystem has species, always run sustainability + biodiversity for context
  if (profile?.placedSpeciesIds?.length > 0) {
    if (!agentsUsed.includes('sustainability')) {
      agentsToRun.push({ fn: runSustainabilityAgent, id: 'sustainability' });
      agentsUsed.push('sustainability');
    }
    if (!agentsUsed.includes('biodiversity')) {
      agentsToRun.push({ fn: runBiodiversityAgent, id: 'biodiversity' });
      agentsUsed.push('biodiversity');
    }
  }

  // Step 6: Run agents in parallel
  console.log(`[Orchestrator] Running agents: ${agentsUsed.join(', ')}`);
  const agentOutputs = await Promise.all(
    agentsToRun.map(({ fn, id }) => runWithTimeout(fn, agentInput, id))
  );

  // Step 7: Merge outputs (Decision Engine)
  const mergedData = mergeAgentOutputs(agentOutputs, intents);

  // Step 8: Generate natural-language response via LLM Coach
  const naturalLanguageResponse = await runLLMCoach({
    userMessage: message,
    structuredData: mergedData,
    ragContext,
    memorySummary,
  });

  // Step 9: Persist to memory
  if (mergedData.planning?.recommendations?.length > 0) {
    const speciesNames = mergedData.planning.recommendations.map(r => r.name);
    const summary = `Recommended ${speciesNames.slice(0, 3).join(', ')} for your ecosystem`;
    saveRecommendation(userId, 'planning', speciesNames, summary);
  }

  if (mergedData.diagnosis?.causes?.length > 0) {
    saveDiagnosis(userId, message, mergedData.diagnosis.causes[0].cause);
  }

  // Step 10: Build and return final response
  const coachResponse = buildCoachResponse(naturalLanguageResponse, mergedData, agentsUsed);

  console.log(`[Orchestrator] Response built. Agents used: ${agentsUsed.join(', ')}`);

  return coachResponse;
}
