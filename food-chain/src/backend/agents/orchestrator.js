/**
 * Orchestrator Agent
 *
 * The central coordinator of the multi-agent system.
 *
 * Data flow:
 * ChatRequest → extractContext → [Memory, RAG, Agents] → DecisionEngine → LLMCoach → CoachResponse
 */

import { retrieveRelevantChunks, buildRagContext } from '../rag/ragService.js';
import { buildMemorySummary, saveRecommendation, saveDiagnosis, getMemory } from '../db/memoryStore.js';
import { extractContext } from '../core/contextExtractor.js';
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
 * Order matters — more specific intents are checked first.
 */
const INTENT_PATTERNS = {
  safety:       /dangerous|poisonous|toxic|unsafe|harmful|invasive|aggressive spread|skin irritat|thorny|avoid planting|should.not.grow|bad.*plant|plant.*bad/i,
  diagnosis:    /yellow|wilt|droop|spot|brown|white|mold|pest|sick|dying|problem|diagnos|symptom|disease|bug|insect|rot|crispy|pale|stunted|help my plant/i,
  planning:     /plant|recommend|suggest|grow|garden|add|what should|species|ecosystem|build|design|pollinator|native|companion/i,
  sustainability: /sustain|water|native|eco|green|impact|score|efficient|drought|environment/i,
  biodiversity: /biodiversity|health|trophic|food chain|balance|diversity|score|ecosystem health|missing/i,
  memory:       /remember|history|before|last time|previous|recommend|planted|what did|recall/i,
  general:      /.*/,
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
 * @param {Object|null} coachJson  - parsed LLM Coach JSON output
 * @returns {import('../schemas/index.js').CoachResponse}
 */
function buildCoachResponse(naturalLanguageResponse, mergedData, agentsUsed, coachJson = null) {
  const response = createDefaultResponse();

  response.message = naturalLanguageResponse;
  response.agentsUsed = agentsUsed;

  // coachData is the structured `data` block from EcoDoctor
  const coachData = coachJson?.data || {};

  // ── Recommendations ──
  // ONLY use plant_suggestions from the LLM coach — never fall back to
  // rule-based species (White Oak, Milkweed, etc.) which are hardcoded defaults.
  if (coachData.plant_suggestions?.length > 0) {
    response.recommendations = coachData.plant_suggestions;
  }
  // If LLM returned nothing, leave recommendations empty — the ui_message is enough.

  // ── Reasoning summary (internal only — not shown in UI) ──
  response.reasoningSummary = (() => {
    const parts = [];
    if (mergedData.intents?.length > 0) parts.push(`Intents: ${mergedData.intents.join(', ')}`);
    if (mergedData.sustainability?.score !== undefined) parts.push(`Sustainability: ${mergedData.sustainability.score}/100`);
    if (mergedData.biodiversity?.score !== undefined) parts.push(`Biodiversity: ${mergedData.biodiversity.score}/100`);
    if (mergedData.extractedContext?.region) parts.push(`Region: ${mergedData.extractedContext.region}`);
    return parts.join(' · ');
  })();

  // ── Sustainability ──
  // Score always comes from rule-based engine (reliable); notes from EcoDoctor
  if (mergedData.sustainability?.score !== undefined) {
    response.sustainability = {
      score: mergedData.sustainability.score,
      nativeRatio: mergedData.sustainability.nativeRatio,
      waterSummary: mergedData.sustainability.waterSummary,
      suggestions: mergedData.sustainability.suggestions || [],
      breakdown: mergedData.sustainability.breakdown,
      notes: coachData.sustainability?.notes || mergedData.sustainability.llmSummary || '',
    };
  }

  // ── Biodiversity ──
  if (mergedData.biodiversity?.score !== undefined) {
    response.biodiversity = {
      score: mergedData.biodiversity.score,
      trophicBreakdown: mergedData.biodiversity.trophicBreakdown,
      gaps: mergedData.biodiversity.gaps || [],
      recommendations: mergedData.biodiversity.recommendations || [],
      warnings: mergedData.biodiversity.predatorWarnings || [],
      notes: coachData.biodiversity?.notes || mergedData.biodiversity.llmSummary || '',
    };
  }

  // ── Diagnosis ──
  if (mergedData.diagnosis?.applicable && mergedData.diagnosis?.causes?.length > 0) {
    // Merge rule-based causes with EcoDoctor's plain-language fixes
    const fixes = coachData.diagnosis?.fixes || [];
    response.diagnosis = {
      causes: mergedData.diagnosis.causes.map((c, i) => ({
        ...c,
        // Override treatment with EcoDoctor's plain-language version if available
        treatment: fixes[i] || c.treatment,
      })),
      spreadRisk: mergedData.diagnosis.spreadRisk,
      atRiskSpecies: mergedData.diagnosis.atRiskSpecies || [],
      needsMoreInfo: mergedData.diagnosis.needsMoreInfo,
      clarifyingQuestion: mergedData.diagnosis.clarifyingQuestion,
    };
  }

  // ── Next actions ──
  // Prefer EcoDoctor's next_actions (plain language, specific)
  if (coachData.next_actions?.length > 0) {
    response.nextActions = coachData.next_actions.slice(0, 4);
  } else {
    // Build from agent outputs — never reference hardcoded species names
    const actions = [];
    if (mergedData.sustainability?.suggestions?.[0])   actions.push(mergedData.sustainability.suggestions[0]);
    if (mergedData.biodiversity?.recommendations?.[0]) actions.push(mergedData.biodiversity.recommendations[0]);
    if (mergedData.diagnosis?.causes?.[0])             actions.push(mergedData.diagnosis.causes[0].treatment);
    response.nextActions = actions.slice(0, 4);
  }

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
  const { message, profile, history = [], isFirstMessage = false } = request;
  const userId = profile?.userId || 'anonymous';

  console.log(`\n${'═'.repeat(60)}`);
  console.log(`[Orchestrator] New request — user: ${userId}`);
  console.log(`[Orchestrator] Message: "${message}"`);

  // Step 1: Extract structured context from message + profile
  const extractedContext = extractContext(message, profile);
  console.log(`[Orchestrator] Extracted context:`, JSON.stringify(extractedContext, null, 2));

  // Merge extracted context back into profile for agents
  const enrichedProfile = {
    ...profile,
    location:    extractedContext.location    || profile?.location,
    climateZone: extractedContext.climate     || profile?.climateZone,
    region:      extractedContext.region      || null,
    regionNotes: extractedContext.regionNotes || null,
    constraints: extractedContext.constraints,
    regionalKnowledge: extractedContext.regionalKnowledge,
  };

  // Step 2: Detect intents
  const intents = detectIntents(message);
  const ecosystemType = extractedContext?.constraints?.ecosystemType ?? 'unknown';
  const goal          = extractedContext?.goal ?? 'none';
  console.log(`[Orchestrator] Detected intents: ${intents.join(', ')} | ecosystemType: ${ecosystemType} | goal: ${goal}`);

  // Step 3: Build RAG context — semantic vector search over ingested knowledge base
  let ragChunks = [];
  let ragContext = 'NO_CHUNKS_RETRIEVED';
  try {
    ragChunks = await retrieveRelevantChunks(message);
    ragContext = buildRagContext(ragChunks);

    // ── [RAG] structured debug log ───────────────────────────────
    console.log(`[RAG] user query: ${message}`);
    console.log(`[RAG] chunks retrieved: ${ragChunks.length}`);
    if (ragChunks.length > 0) {
      const titles = ragChunks.map(c => c.metadata?.title ?? c.metadata?.source ?? 'unknown');
      const scores = ragChunks.map(c =>
        typeof c.similarity === 'number' ? `${(c.similarity * 100).toFixed(1)}%` : 'n/a'
      );
      console.log(`[RAG] source titles: [${titles.map(t => `"${t}"`).join(', ')}]`);
      console.log(`[RAG] similarity scores: [${scores.join(', ')}]`);
      console.log(`[RAG] context length: ${ragContext.length} chars`);
    } else {
      console.log(`[RAG] source titles: []`);
      console.log(`[RAG] similarity scores: []`);
      console.log(`[RAG] context length: 0 chars (no chunks above threshold)`);
    }
  } catch (ragErr) {
    // Non-fatal — continue without RAG context rather than failing the whole request
    console.warn('[RAG] retrieval failed (non-fatal):', ragErr.message);
    console.log(`[RAG] user query: ${message}`);
    console.log(`[RAG] chunks retrieved: 0 (error)`);
  }

  // Step 4: Get memory
  const memorySummary = buildMemorySummary(userId);
  const memory = getMemory(userId);

  // Step 5: Build shared agent input — includes extracted context
  const agentInput = {
    message,
    profile: enrichedProfile,
    intents,
    ragContext,
    memory,
    history,
    extractedContext, // full context object available to all agents
  };

  // Step 6: Determine which agents to invoke
  const agentsToRun = [];
  const agentsUsed = [];

  agentsToRun.push({ fn: runMemoryAgent, id: 'memory' });
  agentsUsed.push('memory');

  // Safety questions (dangerous/toxic/invasive plants) go straight to LLM coach —
  // no planning agent needed, which prevents hardcoded species from appearing.
  const isSafetyQuestion = intents.includes('safety');
  console.log(`[Orchestrator] isSafetyQuestion: ${isSafetyQuestion} | onboarding suppressed: ${isSafetyQuestion || !!ecosystemType}`);

  if (!isSafetyQuestion && (intents.includes('planning') || intents.includes('general'))) {
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

  if (enrichedProfile?.placedSpeciesIds?.length > 0) {
    if (!agentsUsed.includes('sustainability')) {
      agentsToRun.push({ fn: runSustainabilityAgent, id: 'sustainability' });
      agentsUsed.push('sustainability');
    }
    if (!agentsUsed.includes('biodiversity')) {
      agentsToRun.push({ fn: runBiodiversityAgent, id: 'biodiversity' });
      agentsUsed.push('biodiversity');
    }
  }

  // Step 7: Run agents in parallel
  console.log(`[Orchestrator] Running agents in parallel: ${agentsUsed.join(', ')}`);
  const agentOutputs = await Promise.all(
    agentsToRun.map(({ fn, id }) => runWithTimeout(fn, agentInput, id))
  );

  // Step 8: Merge outputs
  const mergedData = mergeAgentOutputs(agentOutputs, intents);
  mergedData.extractedContext = extractedContext;

  // Step 9: LLM Coach synthesis
  // isFirstMessage = no prior non-welcome messages in history
  const isFirstMsg = isFirstMessage || !history || history.length === 0;

  const coachRaw = await runLLMCoach({
    userMessage: message,
    structuredData: mergedData,
    ragContext,
    memorySummary,
    extractedContext,
    isFirstMessage: isFirstMsg,
  });

  // Parse the coach output — expects { ui_message, data }
  let coachJson = null;
  try {
    coachJson = typeof coachRaw === 'string' ? JSON.parse(coachRaw) : coachRaw;
  } catch (_) {
    coachJson = { ui_message: coachRaw, data: {} };
  }

  // ui_message is what the user sees; data populates the structured cards
  const naturalLanguageResponse = coachJson?.ui_message
    || coachJson?.message  // backward compat
    || coachRaw
    || 'I was unable to generate a response. Please try again.';

  // Step 10: Persist to memory
  if (mergedData.planning?.recommendations?.length > 0) {
    const speciesNames = mergedData.planning.recommendations.map(r => r.name).filter(Boolean);
    saveRecommendation(userId, 'planning', speciesNames, `Recommended ${speciesNames.slice(0, 3).join(', ')}`);
  }
  if (mergedData.diagnosis?.causes?.length > 0) {
    saveDiagnosis(userId, message, mergedData.diagnosis.causes[0].cause);
  }

  // Step 11: Build final response
  const coachResponse = buildCoachResponse(naturalLanguageResponse, mergedData, agentsUsed, coachJson);

  console.log(`[Orchestrator] Done. Response length: ${naturalLanguageResponse.length} chars`);
  console.log(`${'═'.repeat(60)}\n`);

  return coachResponse;
}
