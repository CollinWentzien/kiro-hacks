/**
 * Diagnosis Agent
 *
 * Diagnoses plant problems from symptom descriptions.
 * Grounded in the user's specific ecosystem and location context.
 */

import { SPECIES_BY_ID } from '../../data/species.js';
import { generateResponse, parseLLMResponse } from '../services/llmService.js';
import { formatContextForPrompt } from '../core/contextExtractor.js';

const SYSTEM_PROMPT = `You are a specialized plant diagnosis AI with expertise in horticulture and plant pathology.

You MUST:
- Diagnose based on the specific symptoms described, not generic possibilities
- Consider the user's climate and location when assessing likely causes (e.g., fungal issues are more common in humid climates)
- Rank causes by likelihood given the specific symptoms
- Provide treatment recommendations that are practical and specific
- Note if a problem is likely to spread to other species in the ecosystem

You MUST NOT:
- List every possible cause — focus on the 2-3 most likely given the symptoms
- Give generic advice that ignores the specific symptoms described
- Hallucinate disease names or treatments

If symptoms are too vague: ask ONE specific clarifying question.

Return ONLY valid JSON:
{
  "summary": "one sentence diagnosis specific to the described symptoms",
  "reasoning": "2-3 sentences explaining your diagnostic logic",
  "recommendations": [
    "Most likely cause: specific treatment for this cause",
    "Second possibility: specific treatment"
  ],
  "next_actions": ["immediate step 1", "immediate step 2"],
  "follow_up_question": null
}`;

const DIAGNOSIS_RULES = [
  { id: 'overwatering',        keywords: ['yellow','yellowing','soft','mushy','soggy','drooping','wilting','wet soil'],   cause: 'Overwatering / root rot',          confidence: 'high',   description: 'Yellowing with soft stems, mushy roots, or wilting despite moist soil.',                    treatment: 'Reduce watering. Improve drainage. Remove mushy roots if repotting.',                                    spreadRisk: false },
  { id: 'underwatering',       keywords: ['wilting','drooping','dry','crispy','brown edges','dry soil','curling'],        cause: 'Underwatering / drought stress',    confidence: 'high',   description: 'Wilting, crispy leaf edges, or curling in dry soil.',                                         treatment: 'Water deeply and consistently. Mulch to retain moisture.',                                               spreadRisk: false },
  { id: 'nitrogen-deficiency', keywords: ['yellow','yellowing','pale','light green','older leaves'],                     cause: 'Nitrogen deficiency',               confidence: 'medium', description: 'Uniform yellowing from older leaves upward.',                                                  treatment: 'Apply balanced fertilizer (10-10-10) or top-dress with compost.',                                        spreadRisk: false },
  { id: 'aphids',              keywords: ['sticky','honeydew','ants','small insects','curling leaves','distorted','aphid'], cause: 'Aphid infestation',               confidence: 'high',   description: 'Soft-bodied insects on new growth, sticky residue, distorted leaves.',                         treatment: 'Strong water jet, then insecticidal soap or neem oil.',                                                  spreadRisk: true,  spreadNote: 'Aphids spread rapidly to neighboring plants.' },
  { id: 'powdery-mildew',      keywords: ['white powder','white coating','powdery','mildew','white spots'],              cause: 'Powdery mildew',                    confidence: 'high',   description: 'White powdery coating on leaf surfaces.',                                                      treatment: 'Improve air circulation. Baking soda solution (1 tsp/quart) or potassium bicarbonate.',                 spreadRisk: true,  spreadNote: 'Spreads via airborne spores to nearby plants.' },
  { id: 'spider-mites',        keywords: ['webbing','tiny dots','stippling','bronze','mites','spider mite'],             cause: 'Spider mite infestation',           confidence: 'high',   description: 'Fine webbing on leaf undersides, stippled or bronzed foliage.',                                treatment: 'Increase humidity. Neem oil or insecticidal soap.',                                                      spreadRisk: true,  spreadNote: 'Spread quickly in dry, warm conditions.' },
  { id: 'root-rot',            keywords: ['wilting','despite watering','brown roots','mushy roots','root rot'],          cause: 'Root rot (Phytophthora/Pythium)',   confidence: 'medium', description: 'Wilting despite moisture, brown/mushy roots.',                                                 treatment: 'Improve drainage. Remove affected roots. Treat with hydrogen peroxide solution.',                        spreadRisk: true,  spreadNote: 'Pathogens spread through shared soil and water.' },
  { id: 'sunburn',             keywords: ['brown patches','bleached','scorched','sun damage','white patches'],           cause: 'Sunscald / sunburn',                confidence: 'medium', description: 'Bleached or brown patches on sun-exposed leaves.',                                             treatment: 'Move to partial shade or add shade cloth (30–50%). Acclimate gradually.',                               spreadRisk: false },
];

export async function runDiagnosisAgent(input) {
  try {
    const { message, profile, extractedContext } = input;
    const msg = message.toLowerCase();

    const isDiagnosisRequest = /yellow|wilt|droop|spot|brown|white|mold|pest|sick|dying|problem|diagnos|symptom|disease|bug|insect|rot|crispy|pale|stunted/.test(msg);
    if (!isDiagnosisRequest) {
      return { agentId: 'diagnosis', success: true, data: { applicable: false }, error: null };
    }

    const ruleResults = computeRuleBasedDiagnosis(msg, profile);
    const placed = (profile.placedSpeciesIds || []).map(id => SPECIES_BY_ID[id]?.name).filter(Boolean);

    const userPrompt = [
      `USER DESCRIBES: "${message}"`,
      '',
      '── CONTEXT ─────────────────────────────────────────────',
      formatContextForPrompt(extractedContext || {}),
      '',
      `Ecosystem species present: ${placed.length ? placed.join(', ') : 'none'}`,
      '',
      `Rule-based pre-analysis: ${ruleResults.causes.map(c => c.cause).join(', ') || 'unclear from keywords alone'}`,
      '',
      'Diagnose the most likely cause(s) of the described symptoms.',
      'Consider the climate/location when assessing likelihood (e.g., fungal diseases are more common in humid climates).',
    ].join('\n');

    console.log(`\n[DiagnosisAgent] ── Prompt ──────────────────────────`);
    console.log(userPrompt);
    console.log(`[DiagnosisAgent] ─────────────────────────────────────\n`);

    const raw = await generateResponse({ systemPrompt: SYSTEM_PROMPT, userPrompt, temperature: 0.3 });

    console.log(`[DiagnosisAgent] ── Raw LLM response ───────────────`);
    console.log(raw);
    console.log(`[DiagnosisAgent] ─────────────────────────────────────\n`);

    const parsed = parseLLMResponse(raw);

    if (parsed.ok && parsed.data) {
      const d = parsed.data;

      if (d.follow_up_question && !d.recommendations?.length) {
        return {
          agentId: 'diagnosis', success: true,
          data: { applicable: true, causes: [], needsMoreInfo: true, clarifyingQuestion: d.follow_up_question, llmSummary: d.follow_up_question },
          error: null,
        };
      }

      const causes = buildCausesFromLLM(d, ruleResults.causes);
      return {
        agentId: 'diagnosis', success: true,
        data: {
          applicable: true,
          causes,
          llmSummary: d.summary || '',
          spreadRisk: ruleResults.spreadRisk,
          atRiskSpecies: ruleResults.atRiskSpecies,
          nextActions: d.next_actions || [],
          needsMoreInfo: causes.length === 0,
          clarifyingQuestion: causes.length === 0
            ? 'Could you describe the symptoms in more detail? Which leaves are affected, what does the discoloration look like, and is the soil wet or dry?'
            : null,
        },
        error: null,
      };
    }

    return {
      agentId: 'diagnosis', success: true,
      data: { ...ruleResults, applicable: true, llmSummary: parsed.raw || '' },
      error: null,
    };

  } catch (err) {
    console.error(`[DiagnosisAgent] Error:`, err);
    return { agentId: 'diagnosis', success: false, data: {}, error: err.message };
  }
}

function computeRuleBasedDiagnosis(msg, profile) {
  const scored = DIAGNOSIS_RULES
    .map(rule => ({ rule, score: rule.keywords.reduce((s, kw) => s + (msg.includes(kw) ? (kw.includes(' ') ? 2 : 1) : 0), 0) }))
    .filter(r => r.score > 0)
    .sort((a, b) => b.score - a.score);

  const top = scored.slice(0, 3);
  const causes = top.map(({ rule, score }) => ({
    cause: rule.cause,
    confidence: score >= 2 ? 'high' : 'medium',
    description: rule.description,
    treatment: rule.treatment,
  }));

  const spreadRisk = top.find(({ rule }) => rule.spreadRisk)?.rule?.spreadNote || null;
  const atRiskSpecies = top.some(({ rule }) => rule.spreadRisk)
    ? (profile.placedSpeciesIds || []).map(id => SPECIES_BY_ID[id]).filter(s => s?.kind === 'plant').map(s => s.name)
    : [];

  return { causes, spreadRisk, atRiskSpecies, needsMoreInfo: causes.length === 0 };
}

function buildCausesFromLLM(llmData, ruleCauses) {
  const llmRecs = llmData.recommendations || [];
  if (llmRecs.length === 0) return ruleCauses;
  return llmRecs.slice(0, 3).map((rec, i) => {
    if (typeof rec === 'string') {
      const [causePart, ...treatParts] = rec.split(':');
      return {
        cause: causePart?.trim() || rec,
        confidence: i === 0 ? 'high' : i === 1 ? 'medium' : 'low',
        description: ruleCauses[i]?.description || '',
        treatment: treatParts.join(':').trim() || ruleCauses[i]?.treatment || '',
      };
    }
    return { ...ruleCauses[i], ...rec };
  });
}
