/**
 * Diagnosis Agent
 *
 * Diagnoses plant problems from described symptoms.
 * Returns ranked probable causes with confidence levels and treatment recommendations.
 *
 * Input: AgentInput (message contains symptom description)
 * Output: AgentOutput with diagnosis data
 */

import { SPECIES_BY_ID } from '../../data/species.js';

const SYSTEM_PROMPT = `You are the Diagnosis Agent. You diagnose plant problems from symptom descriptions.
You provide ranked probable causes with confidence levels (high/medium/low) and specific treatment recommendations.
You identify spread risk to other species in the ecosystem.
When uncertain, you ask for more information rather than guessing.`;

/**
 * Symptom-to-diagnosis knowledge base.
 * Each entry maps symptom keywords to probable causes.
 */
const DIAGNOSIS_RULES = [
  {
    id: 'nitrogen-deficiency',
    keywords: ['yellow', 'yellowing', 'pale', 'light green', 'older leaves'],
    cause: 'Nitrogen deficiency',
    confidence: 'medium',
    description: 'Uniform yellowing starting from older/lower leaves, progressing upward.',
    treatment: 'Apply balanced fertilizer (10-10-10) or top-dress with compost. For quick fix, use liquid fish emulsion.',
    spreadRisk: false,
    additionalInfo: 'Check if yellowing starts from older leaves — if new growth is yellow, suspect iron deficiency instead.',
  },
  {
    id: 'overwatering',
    keywords: ['yellow', 'yellowing', 'soft', 'mushy', 'soggy', 'drooping', 'wilting', 'wet soil'],
    cause: 'Overwatering / root rot',
    confidence: 'high',
    description: 'Yellowing with soft stems, mushy roots, or wilting despite moist soil.',
    treatment: 'Reduce watering frequency. Improve drainage by adding perlite or repotting. Remove affected roots if severe.',
    spreadRisk: false,
    additionalInfo: 'Check soil moisture before watering — stick finger 2 inches into soil. Water only when dry.',
  },
  {
    id: 'underwatering',
    keywords: ['wilting', 'drooping', 'dry', 'crispy', 'brown edges', 'dry soil', 'curling'],
    cause: 'Underwatering / drought stress',
    confidence: 'high',
    description: 'Wilting, crispy leaf edges, or curling in dry soil.',
    treatment: 'Water deeply and consistently. Mulch around the base to retain moisture. Consider drip irrigation.',
    spreadRisk: false,
    additionalInfo: 'Water in the morning to reduce evaporation. Avoid wetting foliage.',
  },
  {
    id: 'iron-deficiency',
    keywords: ['yellow between veins', 'interveinal', 'new growth yellow', 'green veins', 'pale new leaves'],
    cause: 'Iron deficiency (chlorosis)',
    confidence: 'medium',
    description: 'Yellowing between leaf veins on new growth, while veins remain green.',
    treatment: 'Acidify soil with sulfur or acidic fertilizer. Apply chelated iron as foliar spray or soil drench.',
    spreadRisk: false,
    additionalInfo: 'Common in alkaline soils. Test soil pH — iron becomes unavailable above pH 7.0.',
  },
  {
    id: 'aphids',
    keywords: ['sticky', 'honeydew', 'ants', 'small insects', 'curling leaves', 'distorted', 'aphid'],
    cause: 'Aphid infestation',
    confidence: 'high',
    description: 'Clusters of small soft-bodied insects on new growth, sticky honeydew residue, distorted leaves.',
    treatment: 'Spray with strong water jet to dislodge. Apply insecticidal soap or neem oil. Introduce ladybugs as biological control.',
    spreadRisk: true,
    spreadNote: 'Aphids spread rapidly to neighboring plants. Inspect all nearby species.',
    additionalInfo: 'Ants farming aphids protect them from predators — control ants too.',
  },
  {
    id: 'powdery-mildew',
    keywords: ['white powder', 'white coating', 'powdery', 'mildew', 'white spots', 'fungal'],
    cause: 'Powdery mildew',
    confidence: 'high',
    description: 'White powdery coating on leaf surfaces, typically starting on upper sides.',
    treatment: 'Improve air circulation. Apply baking soda solution (1 tsp/quart water) or potassium bicarbonate. Remove severely affected leaves.',
    spreadRisk: true,
    spreadNote: 'Powdery mildew spreads via airborne spores to susceptible plants nearby.',
    additionalInfo: 'Avoid overhead watering. Ensure good spacing between plants.',
  },
  {
    id: 'root-rot',
    keywords: ['wilting', 'despite watering', 'brown roots', 'mushy roots', 'root rot', 'phytophthora'],
    cause: 'Root rot (Phytophthora or Pythium)',
    confidence: 'medium',
    description: 'Wilting despite adequate moisture, brown/mushy roots, yellowing foliage.',
    treatment: 'Improve drainage immediately. Remove affected roots and treat with hydrogen peroxide solution. Repot in fresh, well-draining mix.',
    spreadRisk: true,
    spreadNote: 'Root rot pathogens can spread through shared soil and water.',
    additionalInfo: 'Prevention is key — never let plants sit in standing water.',
  },
  {
    id: 'sunburn',
    keywords: ['brown patches', 'bleached', 'scorched', 'sun damage', 'white patches', 'crispy patches'],
    cause: 'Sunscald / sunburn',
    confidence: 'medium',
    description: 'Bleached, white, or brown patches on leaves exposed to intense direct sun.',
    treatment: 'Move to partial shade or provide shade cloth (30–50%). Gradually acclimate plants to higher light levels.',
    spreadRisk: false,
    additionalInfo: 'Most common when moving plants from low to high light suddenly.',
  },
  {
    id: 'spider-mites',
    keywords: ['webbing', 'tiny dots', 'stippling', 'bronze', 'mites', 'spider mite', 'dusty'],
    cause: 'Spider mite infestation',
    confidence: 'high',
    description: 'Fine webbing on undersides of leaves, tiny moving dots, stippled or bronzed foliage.',
    treatment: 'Increase humidity (mites thrive in dry conditions). Apply neem oil or insecticidal soap. Introduce predatory mites.',
    spreadRisk: true,
    spreadNote: 'Spider mites spread quickly in dry, warm conditions to all nearby plants.',
    additionalInfo: 'Check undersides of leaves with a magnifying glass. Mites are tiny but visible.',
  },
];

/**
 * @param {import('../schemas/index.js').AgentInput} input
 * @returns {Promise<import('../schemas/index.js').AgentOutput>}
 */
export async function runDiagnosisAgent(input) {
  try {
    const { message, profile } = input;
    const msg = message.toLowerCase();

    // Check if this is actually a diagnosis request
    const isDiagnosisRequest = /yellow|wilt|droop|spot|brown|white|mold|pest|sick|dying|problem|diagnos|symptom|disease|bug|insect|rot|crispy|pale|stunted/.test(msg);

    if (!isDiagnosisRequest) {
      return {
        agentId: 'diagnosis',
        success: true,
        data: { applicable: false },
        error: null,
      };
    }

    // Score each diagnosis rule against the message
    const scored = DIAGNOSIS_RULES.map(rule => ({
      rule,
      score: scoreRule(rule, msg),
    })).filter(r => r.score > 0);

    scored.sort((a, b) => b.score - a.score);
    const topCauses = scored.slice(0, 3);

    if (topCauses.length === 0) {
      return {
        agentId: 'diagnosis',
        success: true,
        data: {
          applicable: true,
          causes: [],
          needsMoreInfo: true,
          clarifyingQuestion: 'Could you describe the symptoms in more detail? For example: which leaves are affected (old or new), what the discoloration looks like, whether the soil is wet or dry, and how long the symptoms have been present.',
        },
        error: null,
      };
    }

    // Build cause list
    const causes = topCauses.map(({ rule, score }) => ({
      cause: rule.cause,
      confidence: score >= 2 ? 'high' : score >= 1 ? 'medium' : 'low',
      description: rule.description,
      treatment: rule.treatment,
      additionalInfo: rule.additionalInfo,
    }));

    // Assess spread risk
    const spreadRisks = topCauses
      .filter(({ rule }) => rule.spreadRisk)
      .map(({ rule }) => rule.spreadNote);

    // Identify at-risk species in the ecosystem
    const atRiskSpecies = getAtRiskSpecies(profile.placedSpeciesIds || [], topCauses);

    return {
      agentId: 'diagnosis',
      success: true,
      data: {
        applicable: true,
        causes,
        spreadRisk: spreadRisks.length > 0 ? spreadRisks[0] : null,
        atRiskSpecies,
        needsMoreInfo: topCauses[0].score < 1,
        clarifyingQuestion: topCauses[0].score < 1
          ? 'Could you provide more details about the symptoms? Specifically: which part of the plant is affected, the color and texture of the affected areas, and recent changes in watering or light.'
          : null,
      },
      error: null,
    };
  } catch (err) {
    return {
      agentId: 'diagnosis',
      success: false,
      data: {},
      error: err.message,
    };
  }
}

/** Score a diagnosis rule against the user message */
function scoreRule(rule, message) {
  let score = 0;
  for (const keyword of rule.keywords) {
    if (message.includes(keyword)) {
      score += keyword.split(' ').length > 1 ? 2 : 1; // multi-word matches score higher
    }
  }
  return score;
}

/** Identify species in the ecosystem that might be at risk */
function getAtRiskSpecies(placedIds, topCauses) {
  const hasSpreadRisk = topCauses.some(({ rule }) => rule.spreadRisk);
  if (!hasSpreadRisk || placedIds.length === 0) return [];

  // All plants in the ecosystem are potentially at risk from spreading diseases
  return placedIds
    .map(id => SPECIES_BY_ID[id])
    .filter(s => s && s.kind === 'plant')
    .map(s => s.name);
}
