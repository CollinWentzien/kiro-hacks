/**
 * LLM Service
 *
 * Unified interface for calling language models.
 * Supports: 'ollama' | 'mock'
 * Falls back to mock automatically on any network/parse error.
 *
 * Usage:
 *   import { generateResponse } from '../services/llmService.js';
 *   const text = await generateResponse({ systemPrompt, userPrompt });
 */

import { config } from '../core/config.js';

// ─── Safe JSON parser ─────────────────────────────────────────────────────────

/**
 * Attempt to parse LLM output as JSON.
 * Handles clean JSON, markdown fences, embedded objects, and thinking tags.
 * Never throws. Returns { ok: true, data } or { ok: false, raw: text }.
 *
 * @param {string} text
 * @returns {{ ok: boolean, data?: any, raw?: string }}
 */
export function parseLLMResponse(text) {
  if (!text || typeof text !== 'string') {
    return { ok: false, raw: text ?? '' };
  }

  let cleaned = text
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .replace(/<thinking>[\s\S]*?<\/thinking>/gi, '')
    .trim();

  try { return { ok: true, data: JSON.parse(cleaned) }; } catch (_) { /* continue */ }

  const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch) {
    try { return { ok: true, data: JSON.parse(fenceMatch[1].trim()) }; } catch (_) { /* continue */ }
  }

  const objMatch = cleaned.match(/(\{[\s\S]*\})/);
  if (objMatch) {
    try { return { ok: true, data: JSON.parse(objMatch[1]) }; } catch (_) { /* continue */ }
  }

  const arrMatch = cleaned.match(/(\[[\s\S]*\])/);
  if (arrMatch) {
    try { return { ok: true, data: JSON.parse(arrMatch[1]) }; } catch (_) { /* continue */ }
  }

  return { ok: false, raw: cleaned };
}

// ─── Ollama caller ────────────────────────────────────────────────────────────

async function callOllama({ systemPrompt, userPrompt, temperature }) {
  const url = `${config.ollamaBaseUrl}/api/chat`;
  const body = {
    model: config.ollamaModel,
    stream: false,
    options: {
      temperature: temperature ?? config.llmTemperature,
      num_predict: 1024,
    },
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user',   content: userPrompt   },
    ],
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.llmTimeoutMs);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!res.ok) {
      throw new Error(`Ollama HTTP ${res.status}: ${await res.text()}`);
    }

    const json = await res.json();
    const content = json?.message?.content ?? json?.response ?? '';
    if (!content) throw new Error('Ollama returned empty content');
    return content;

  } finally {
    clearTimeout(timer);
  }
}

// ─── Mock fallback ────────────────────────────────────────────────────────────

/**
 * Question-aware mock response — used ONLY when Ollama is unavailable.
 *
 * CRITICAL: This function must NEVER return onboarding/template text like
 * "I received your question..." or "what type of ecosystem are you working on".
 * It must always attempt to answer the actual question.
 *
 * @param {string} userPrompt
 * @returns {string} JSON string matching the EcoDoctor schema
 */
function mockResponse(userPrompt) {
  const questionMatch = userPrompt.match(/USER SAID:\s*"([^"]+)"/i);
  const question = questionMatch ? questionMatch[1] : userPrompt;
  const q = question.toLowerCase();

  console.log(`[LLM] mock fallback — question: "${question.slice(0, 100)}"`);

  // ── Intent detection ────────────────────────────────────────────
  const isSafety       = /dangerous|poisonous|toxic|unsafe|harmful|invasive|aggressive spread|skin irritat|thorny|avoid|should.not.grow/i.test(q);
  const isDiagnosis    = /yellow|wilt|droop|sick|dying|problem|symptom|brown|spot|mold|pest|rot|crispy|pale|stunted/i.test(q);
  const isPollinator   = /pollinator|bee|butterfly|attract|nectar|monarch/i.test(q);
  const isSustain      = /sustain|water use|water.efficient|score|native ratio|eco score/i.test(q);
  const isBiodiversity = /biodiversity|food chain|trophic|missing|ecosystem health|balance/i.test(q);
  const isWater        = /\bwater\b|drought|dry|irrigation|xeriscape/i.test(q);
  const isSoil         = /soil|compost|fertiliz|nutrient|ph|clay|sandy/i.test(q);
  const isTerrarium    = /terrarium|bioactive|springtail|isopod|vivarium/i.test(q);
  const isAquarium     = /aquarium|fish|tank|freshwater|nitrogen cycle/i.test(q);
  const isPlantRec     = /what plant|which plant|best plant|good plant|grow in|plant.*grow|recommend.*plant|suggest.*plant|native plant/i.test(q);

  // ── Location detection ──────────────────────────────────────────
  const isSoCal = /southern california|los angeles|san diego|socal|so cal/i.test(q);
  const isNoCal = /northern california|san francisco|bay area|sacramento|norcal/i.test(q);
  const isPNW   = /pacific northwest|seattle|portland|oregon|washington state/i.test(q);
  const isUK    = /\buk\b|england|london|britain/i.test(q);
  const isMidwest = /midwest|chicago|illinois|ohio|michigan|minnesota/i.test(q);
  const isNE    = /new england|new york|new jersey|massachusetts|connecticut/i.test(q);
  const isSE    = /southeast|florida|georgia|carolina|alabama|louisiana/i.test(q);
  const isTX    = /texas|houston|dallas|austin/i.test(q);
  const hasLocation = isSoCal || isNoCal || isPNW || isUK || isMidwest || isNE || isSE || isTX;

  const locationName = isSoCal ? 'Southern California'
    : isNoCal  ? 'Northern California'
    : isPNW    ? 'the Pacific Northwest'
    : isUK     ? 'the UK'
    : isMidwest ? 'the Midwest'
    : isNE     ? 'the Northeast'
    : isSE     ? 'the Southeast'
    : isTX     ? 'Texas'
    : null;

  let ui_message;
  let plant_suggestions = [];
  let diagnosis_data    = { possible_issues: [], fixes: [] };
  let next_actions      = [];

  // ── Safety ──────────────────────────────────────────────────────
  if (isSafety) {
    ui_message = `Some plants can be risky depending on your location, pets, and children. ⚠️ ` +
      `Watch out for toxic ornamentals (foxglove, oleander, lily of the valley), invasive spreaders ` +
      `(Japanese knotweed, English ivy, kudzu), aggressive self-seeders, thorny plants near paths, ` +
      `and skin-irritating plants like giant hogweed or euphorbia. ` +
      `The specific risks depend on your region — what's invasive in one area may be fine in another. ` +
      `Do you have pets or young children, and what region are you in?`;
    next_actions = [
      'Check your regional invasive species list before planting anything new',
      'Keep toxic ornamentals away from areas accessible to pets and children',
      'Research any unfamiliar plant before adding it to your garden',
    ];

  // ── Plant recommendations with location ─────────────────────────
  } else if (isPlantRec || hasLocation) {
    if (isSoCal) {
      ui_message = `Southern California's Mediterranean climate — hot dry summers and mild wet winters — is perfect for California natives and drought-tolerant plants. 🌿 ` +
        `Cleveland sage, Ceanothus, Toyon, and Manzanita are all excellent choices that thrive without summer irrigation once established. ` +
        `They also support native bees, hummingbirds, and birds through the year. ` +
        `Avoid anything that needs regular summer water — it'll struggle and waste resources.`;
      plant_suggestions = [
        'Cleveland sage (Salvia clevelandii) — drought-tolerant, fragrant, loved by native bees and hummingbirds',
        'Ceanothus (California lilac) — fast-growing native, spectacular spring bloom, excellent for pollinators',
        'Toyon (Heteromeles arbutifolia) — berries feed birds through winter, fire-resistant',
        'Manzanita (Arctostaphylos spp.) — evergreen native, early nectar for bees, very drought-tolerant',
        'Buckwheat (Eriogonum spp.) — long-blooming, supports dozens of native bee species',
      ];
      next_actions = [
        'Visit a local native plant nursery for SoCal-adapted species',
        'Group plants by water needs to create hydrozones',
        'Mulch heavily to retain moisture and suppress weeds',
      ];
    } else if (isNoCal) {
      ui_message = `Northern California's cooler, foggier climate supports a wider range of plants than SoCal. 🌿 ` +
        `California poppy, yarrow, and coyote brush are reliable natives that need minimal care once established. ` +
        `The Bay Area fog belt also supports more moisture-loving plants like ferns and redwood understory species.`;
      plant_suggestions = [
        'California poppy (Eschscholzia californica) — cheerful native annual, self-seeds freely',
        'Yarrow (Achillea millefolium) — drought-tolerant, long-blooming, excellent for beneficial insects',
        'Coyote brush (Baccharis pilularis) — tough evergreen native, great for slopes and erosion control',
        'Blue-eyed grass (Sisyrinchium bellum) — delicate native perennial, thrives in sun or part shade',
      ];
      next_actions = [
        'Check the Calscape database for plants native to your specific county',
        'Water deeply but infrequently to encourage deep root growth',
      ];
    } else if (isPNW) {
      ui_message = `The Pacific Northwest's mild, wet winters and dry summers suit a wonderful range of native plants. 🌲 ` +
        `Red flowering currant, Oregon grape, and sword fern are all reliable natives that thrive in the region's conditions. ` +
        `Native conifers provide year-round structure and support hundreds of wildlife species.`;
      plant_suggestions = [
        'Red flowering currant (Ribes sanguineum) — first bloom of spring, hummingbird magnet',
        'Oregon grape (Mahonia aquifolium) — evergreen native, early nectar for queen bumblebees',
        'Sword fern (Polystichum munitum) — thrives in shade, very low maintenance',
        'Camas (Camassia quamash) — beautiful spring bulb, historically important to Indigenous peoples',
      ];
      next_actions = [
        'Plant in fall to take advantage of winter rains for establishment',
        'Leave leaf litter in place — it shelters overwintering insects',
      ];
    } else if (isUK) {
      ui_message = `UK gardens benefit enormously from native wildflowers — they support far more wildlife than exotic ornamentals. 🌼 ` +
        `Foxglove, hawthorn, knapweed, and ox-eye daisy are all excellent choices that bees, butterflies, and birds rely on. ` +
        `The RHS Plants for Pollinators list is a great reference for your region.`;
      plant_suggestions = [
        'Foxglove (Digitalis purpurea) — tall spires loved by bumblebees, self-seeds freely',
        'Hawthorn (Crataegus monogyna) — berries for birds, nesting habitat, spring blossom for bees',
        'Knapweed (Centaurea nigra) — top nectar plant for butterflies and bees',
        'Ox-eye daisy (Leucanthemum vulgare) — cheerful native, excellent for pollinators',
      ];
      next_actions = [
        'Create a small wildflower patch from native seed mix',
        'Leave seed heads standing through winter for birds',
      ];
    } else {
      // Has location signal but not matched — give general plant rec answer
      ui_message = `Great question about plants for your area! 🌱 ` +
        `The best plants depend on your specific climate zone, but in general, native plants adapted to your region will need less water, ` +
        `support more local wildlife, and be more resilient than exotic ornamentals. ` +
        `Could you share your city or region so I can give you specific recommendations?`;
      next_actions = [
        'Share your city or region for specific native plant recommendations',
        'Check your local native plant society for region-specific lists',
      ];
    }

  // ── Diagnosis ───────────────────────────────────────────────────
  } else if (isDiagnosis) {
    ui_message = `Let's figure out what's going on. 🔍 The most common causes are overwatering, nutrient deficiency, or a pest issue — check the soil moisture first since that's the quickest thing to rule out. If the soil feels soggy, ease off watering and improve drainage. If it's dry and the leaves are pale, a balanced fertilizer should help.`;
    diagnosis_data = {
      possible_issues: ['Overwatering / root rot', 'Nitrogen deficiency', 'Pest damage'],
      fixes: ['Reduce watering frequency, check drainage holes', 'Apply balanced fertilizer or top-dress with compost', 'Inspect undersides of leaves for insects, treat with neem oil if found'],
    };
    next_actions = ['Check soil moisture before watering again', 'Inspect leaves top and bottom for pests', 'Remove any dead or yellowing leaves to reduce disease spread'];

  // ── Biodiversity ────────────────────────────────────────────────
  } else if (isBiodiversity) {
    ui_message = `A healthy food chain needs producers, consumers, and decomposers — if any layer is missing, the whole system becomes unstable. 🌍 The most commonly missing piece in home ecosystems is decomposers: earthworms, springtails, or fungi that break down organic matter and return nutrients to the soil.`;
    next_actions = ['Add a decomposer species (earthworm, springtail, or isopod)', 'Check which trophic levels are represented in your current ecosystem', 'Aim for at least one species per trophic level'];

  // ── Sustainability ───────────────────────────────────────────────
  } else if (isSustain) {
    ui_message = `Sustainability scores are driven by three things: native species ratio, water efficiency, and trophic completeness. 💧 The biggest quick win is usually replacing high-water plants with drought-tolerant natives — that alone can move your score significantly.`;
    next_actions = ['Replace one high-water plant with a drought-tolerant native', 'Group plants by water needs to reduce waste', 'Add a decomposer to close the nutrient cycle'];

  // ── Pollinator ──────────────────────────────────────────────────
  } else if (isPollinator) {
    const loc = locationName ? `in ${locationName}` : 'in your area';
    ui_message = `Supporting pollinators ${loc} means providing nectar from spring through fall. 🦋 Native plants are your best bet since local bees and butterflies have evolved alongside them. Leaving some bare soil and hollow stems also gives native bees nesting spots.`;
    plant_suggestions = isSoCal
      ? ['Cleveland sage (Salvia clevelandii) — drought-tolerant, loved by native bees', 'Ceanothus (California lilac) — fast-growing native, excellent for pollinators', 'Phacelia (Phacelia tanacetifolia) — top nectar plant for bees']
      : isPNW
      ? ['Red flowering currant (Ribes sanguineum) — first bloom of spring, hummingbird magnet', 'Oregon grape (Mahonia aquifolium) — early nectar for queen bumblebees', 'Phacelia (Phacelia tanacetifolia) — excellent bee plant']
      : ['Purple coneflower (Echinacea purpurea) — long-blooming, attracts bees and goldfinches', 'Wild bergamot (Monarda fistulosa) — fragrant native, excellent for pollinators', 'Anise hyssop (Agastache foeniculum) — top nectar plant, easy to grow'];
    next_actions = ['Plant a succession of natives that bloom in spring, summer, and fall', 'Leave some bare soil patches for ground-nesting bees', 'Avoid pesticides, especially neonicotinoids'];

  // ── Water ───────────────────────────────────────────────────────
  } else if (isWater) {
    ui_message = `Water efficiency starts with plant selection — drought-tolerant natives need little to no irrigation once established. 💧 Drip irrigation cuts water use by 30–50% compared to overhead sprinklers, and mulching dramatically reduces evaporation.`;
    next_actions = ['Switch to drip irrigation or soaker hoses', 'Apply 2–3 inches of mulch around all plants', 'Replace one thirsty plant with a drought-tolerant native'];

  // ── Soil ────────────────────────────────────────────────────────
  } else if (isSoil) {
    ui_message = `Healthy soil is the foundation of a healthy ecosystem. 🪱 Compost improves structure, water retention, and microbial diversity. Avoid tilling — it disrupts the fungal networks that help plants absorb nutrients.`;
    next_actions = ['Add a 1-inch layer of compost as a top dressing', 'Avoid tilling to protect soil fungal networks', 'Test soil pH — most vegetables prefer 6.0–7.0'];

  // ── Terrarium ───────────────────────────────────────────────────
  } else if (isTerrarium) {
    ui_message = `A bioactive terrarium works best with a cleanup crew of springtails and dwarf isopods — they eat mold and break down waste. 🍄 Layer your substrate: drainage layer (LECA), mesh barrier, then bioactive soil mix. Tropical setups need 70–90% humidity.`;
    next_actions = ['Add springtails (Collembola) as your primary cleanup crew', 'Set up a drainage layer to prevent waterlogging', 'Mist daily to maintain 70–90% humidity for tropical species'];

  // ── Aquarium ────────────────────────────────────────────────────
  } else if (isAquarium) {
    ui_message = `The nitrogen cycle is the foundation of aquarium health: fish waste → ammonia → nitrite → nitrate → absorbed by plants. 🐟 Cycle your tank before adding fish (2–4 weeks), and do regular partial water changes (20–30% weekly).`;
    next_actions = ['Test ammonia, nitrite, and nitrate weekly', 'Add live plants to absorb nitrates naturally', 'Do a 20–30% water change weekly'];

  // ── Generic — NEVER return onboarding text ──────────────────────
  } else {
    // Answer the question as best we can without asking for ecosystem type
    ui_message = `That's a great ecosystem question! 🌱 ` +
      `Without more context I can give you general guidance — native plants adapted to your local climate ` +
      `are almost always the best starting point. They need less water, support more wildlife, and are more ` +
      `resilient than exotic ornamentals. What region are you in? That'll help me give you specific recommendations.`;
    next_actions = [
      'Share your city or region for specific native plant recommendations',
      'Check your local native plant society for region-specific lists',
      'Start with one or two natives and observe how they perform',
    ];
  }

  return JSON.stringify({
    ui_message,
    data: {
      plant_suggestions,
      sustainability: { score: null, notes: '' },
      biodiversity:   { score: null, notes: '' },
      diagnosis:      diagnosis_data,
      next_actions,
    },
  });
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Generate a response from the configured LLM provider.
 * Falls back to mock on any error.
 *
 * @param {Object} params
 * @param {string} params.systemPrompt
 * @param {string} params.userPrompt
 * @param {string} [params.context]
 * @param {number} [params.temperature]
 * @returns {Promise<string>} raw LLM output (may be JSON or plain text)
 */
export async function generateResponse({ systemPrompt, userPrompt, context = '', temperature }) {
  const fullPrompt = context
    ? `${userPrompt}\n\n--- Context ---\n${context}`
    : userPrompt;

  // Extract question for logging
  const questionMatch = fullPrompt.match(/USER SAID:\s*"([^"]+)"/i);
  const questionSnip  = questionMatch
    ? questionMatch[1].slice(0, 100)
    : fullPrompt.slice(0, 100).replace(/\n/g, ' ');

  // ── [CHAT] / [LLM] structured logs ──────────────────────────────
  console.log(`[CHAT] received: "${questionSnip}"`);
  console.log(`[LLM] calling model: provider="${config.llmProvider}" model="${config.ollamaModel}" url="${config.ollamaBaseUrl}"`);

  if (config.llmProvider === 'mock') {
    console.log('[LLM] MOCK MODE active — Ollama not called. Set LLM_PROVIDER=ollama in .env to use real model.');
    const result = mockResponse(fullPrompt);
    const preview = JSON.parse(result)?.ui_message?.slice(0, 120) ?? '';
    console.log(`[LLM] response preview (mock): "${preview}"`);
    return result;
  }

  if (config.llmProvider === 'ollama') {
    try {
      console.log(`[LLM] → POST ${config.ollamaBaseUrl}/api/chat model=${config.ollamaModel} timeout=${config.llmTimeoutMs}ms`);

      const result = await callOllama({ systemPrompt, userPrompt: fullPrompt, temperature });

      const preview = result.slice(0, 120).replace(/\n/g, ' ');
      console.log(`[LLM] response preview (ollama): "${preview}"`);
      console.log(`[LLM] response length: ${result.length} chars`);

      return result;
    } catch (err) {
      console.error(`[LLM] Ollama FAILED: ${err.message}`);
      console.warn(`[LLM] Falling back to mock for: "${questionSnip}"`);
      const result = mockResponse(fullPrompt);
      const preview = JSON.parse(result)?.ui_message?.slice(0, 120) ?? '';
      console.log(`[LLM] response preview (mock fallback): "${preview}"`);
      return result;
    }
  }

  // Unknown provider
  console.error(`[LLM] Unknown provider "${config.llmProvider}" — check LLM_PROVIDER in .env`);
  const result = mockResponse(fullPrompt);
  const preview = JSON.parse(result)?.ui_message?.slice(0, 120) ?? '';
  console.log(`[LLM] response preview (mock fallback): "${preview}"`);
  return result;
}
