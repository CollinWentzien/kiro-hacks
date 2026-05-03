/**
 * RAG Knowledge Base — Ecosystem Coach
 *
 * A curated set of horticultural and ecological knowledge documents.
 * Each document has an id, tags, and content string.
 *
 * In production: replace with pgvector similarity search.
 * For MVP: simple keyword scoring is used.
 */

export const KNOWLEDGE_DOCS = [
  {
    id: 'companion-planting-basics',
    tags: ['companion', 'planting', 'garden', 'compatibility', 'synergy'],
    title: 'Companion Planting Fundamentals',
    content: `Companion planting is the practice of growing different plants near each other for mutual benefit.
Classic pairings include the Three Sisters (corn, beans, squash): corn provides a trellis, beans fix nitrogen, squash shades the soil.
Basil repels aphids and improves tomato flavor. Marigolds deter nematodes and whiteflies.
Avoid planting fennel near most vegetables — it inhibits growth in many species.
Alliums (onions, garlic) deter aphids and carrot flies but can inhibit legumes.`,
  },
  {
    id: 'native-plants-temperate',
    tags: ['native', 'temperate', 'pollinator', 'wildlife', 'habitat'],
    title: 'Native Plants for Temperate Gardens',
    content: `Native plants are adapted to local climate, soil, and wildlife. They require less water and maintenance than non-natives.
Top temperate natives: Purple Coneflower (Echinacea purpurea), Black-eyed Susan (Rudbeckia hirta), Wild Bergamot (Monarda fistulosa),
Butterfly Weed (Asclepias tuberosa), Joe-Pye Weed (Eutrochium purpureum), Wild Columbine (Aquilegia canadensis).
Native oaks support over 500 caterpillar species — more than any other genus.
Aim for at least 70% native species to meaningfully support local wildlife.`,
  },
  {
    id: 'water-use-classification',
    tags: ['water', 'drought', 'irrigation', 'sustainability', 'xeriscape'],
    title: 'Plant Water Use Classification',
    content: `Low water use (drought-tolerant): lavender, sedum, yarrow, coneflower, ornamental grasses, most succulents.
Medium water use: tomatoes, peppers, most perennials, shrubs, fruit trees once established.
High water use: lettuce, spinach, celery, most annuals, lawns, water-loving perennials like astilbe.
Grouping plants by water needs (hydrozoning) reduces waste by 30–50%.
Drip irrigation reduces water use by 30–50% compared to overhead sprinklers.`,
  },
  {
    id: 'biodiversity-trophic-levels',
    tags: ['biodiversity', 'trophic', 'food chain', 'ecosystem', 'health'],
    title: 'Trophic Levels and Ecosystem Health',
    content: `A healthy ecosystem requires representation across all trophic levels:
- Producers (plants, algae): form the energy base
- Primary consumers (herbivores, plant-eaters): transfer energy upward
- Secondary consumers (insectivores, omnivores): regulate primary consumers
- Tertiary consumers (apex predators): regulate secondary consumers
- Decomposers (fungi, bacteria, earthworms, springtails): recycle nutrients
Missing trophic levels create instability. A garden without decomposers loses nutrient cycling.
A garden without predators risks herbivore population explosions.`,
  },
  {
    id: 'plant-diagnosis-yellowing',
    tags: ['diagnosis', 'yellowing', 'leaves', 'chlorosis', 'nitrogen', 'overwatering'],
    title: 'Diagnosing Yellowing Leaves',
    content: `Yellowing leaves (chlorosis) have several common causes:
1. Nitrogen deficiency: uniform yellowing starting from older leaves. Fix: balanced fertilizer or compost.
2. Overwatering: yellowing with soft, mushy stems. Fix: reduce watering, improve drainage.
3. Iron deficiency: yellowing between veins (interveinal chlorosis) on new growth. Fix: acidify soil, chelated iron.
4. Root rot (Phytophthora): yellowing with wilting despite moist soil. Fix: improve drainage, fungicide.
5. Natural senescence: lower leaves yellow as plant ages — normal.
Check soil moisture before diagnosing. Most yellowing is caused by overwatering.`,
  },
  {
    id: 'plant-diagnosis-wilting',
    tags: ['diagnosis', 'wilting', 'drought', 'root rot', 'stem rot'],
    title: 'Diagnosing Wilting Plants',
    content: `Wilting can indicate:
1. Underwatering: wilting in dry soil. Fix: water deeply and consistently.
2. Overwatering/root rot: wilting despite moist soil, yellowing, mushy roots. Fix: reduce water, repot if severe.
3. Heat stress: temporary midday wilting in full sun. Fix: shade cloth, mulch, water in morning.
4. Fusarium wilt: one-sided wilting, brown vascular tissue. Fix: remove affected plants, rotate crops.
5. Verticillium wilt: similar to Fusarium, affects many species. Fix: soil solarization, resistant varieties.`,
  },
  {
    id: 'pollinator-support',
    tags: ['pollinator', 'bee', 'butterfly', 'habitat', 'native', 'nectar'],
    title: 'Supporting Pollinators in the Garden',
    content: `To support pollinators, provide: nectar sources, pollen sources, larval host plants, nesting habitat, and water.
Best nectar plants: lavender, borage, phacelia, catmint, anise hyssop, goldenrod, asters.
Monarch butterfly host plant: milkweed (Asclepias spp.) — the only plant monarchs will lay eggs on.
Native bees nest in bare soil, hollow stems, and wood cavities. Leave some areas unmulched.
Bloom succession: plant species that flower in spring, summer, and fall to support pollinators all season.
Avoid pesticides, especially neonicotinoids, which are highly toxic to bees.`,
  },
  {
    id: 'sustainability-scoring',
    tags: ['sustainability', 'score', 'native', 'water', 'ecological', 'impact'],
    title: 'Ecosystem Sustainability Scoring',
    content: `Sustainability score factors (0–100):
- Native species ratio (40 pts): 100% native = 40 pts, 0% native = 0 pts
- Water efficiency (30 pts): all low-water = 30 pts, all high-water = 0 pts
- Trophic completeness (20 pts): all 5 levels present = 20 pts
- Decomposer presence (10 pts): at least one decomposer = 10 pts
A score above 70 indicates a sustainable, ecologically sound ecosystem.
Below 40 suggests significant improvements are needed.`,
  },
  {
    id: 'soil-health',
    tags: ['soil', 'compost', 'organic', 'microbiome', 'fertility'],
    title: 'Soil Health and Fertility',
    content: `Healthy soil contains billions of microorganisms per teaspoon. Soil health drives plant health.
Compost improves soil structure, water retention, and microbial diversity.
Avoid tilling — it disrupts fungal networks (mycorrhizae) that help plants absorb nutrients.
Cover crops (clover, rye, buckwheat) prevent erosion, fix nitrogen, and feed soil life.
Mulch suppresses weeds, retains moisture, and feeds soil organisms as it breaks down.
Soil pH affects nutrient availability: most vegetables prefer 6.0–7.0.`,
  },
  {
    id: 'invasive-species',
    tags: ['invasive', 'native', 'warning', 'spread', 'ecosystem'],
    title: 'Common Invasive Species to Avoid',
    content: `Invasive plants outcompete natives and reduce biodiversity. Common invasives to avoid:
- English Ivy (Hedera helix): smothers ground cover and climbs trees
- Japanese Knotweed (Reynoutria japonica): extremely aggressive, damages structures
- Purple Loosestrife (Lythrum salicaria): invades wetlands, displaces native plants
- Kudzu (Pueraria montana): covers and kills trees in southeastern US
- Burning Bush (Euonymus alatus): spreads into forests from gardens
Always check your regional invasive species list before planting.`,
  },
  {
    id: 'terrarium-ecosystem',
    tags: ['terrarium', 'bioactive', 'springtail', 'isopod', 'humidity', 'tropical'],
    title: 'Building a Bioactive Terrarium Ecosystem',
    content: `A bioactive terrarium mimics a natural ecosystem with a cleanup crew of springtails and isopods.
Springtails (Collembola) eat mold, fungi, and decaying matter. They prevent mold outbreaks.
Dwarf isopods (Trichorhina tomentosa) break down waste and leaf litter.
Substrate layers: drainage layer (LECA), mesh barrier, bioactive soil mix (coconut coir, topsoil, sand).
Tropical terrariums need 70–90% humidity. Use a fogger or mist daily.
Live plants (pothos, ferns, mosses, bromeliads) provide oxygen and humidity regulation.`,
  },
  {
    id: 'aquarium-ecosystem',
    tags: ['aquarium', 'freshwater', 'fish', 'plants', 'nitrogen cycle', 'water quality'],
    title: 'Freshwater Aquarium Ecosystem Balance',
    content: `The nitrogen cycle is the foundation of aquarium health: fish waste → ammonia → nitrite → nitrate → removed by plants/water changes.
Live plants absorb nitrates and CO2, produce oxygen, and provide habitat.
Stocking density: 1 inch of fish per gallon is a rough guide, but body shape and behavior matter more.
Avoid mixing aggressive and peaceful species. Bettas will attack most other fish.
Cherry shrimp are vulnerable to most fish — keep in species-only or with very small, peaceful fish.
Nerite snails are excellent algae cleaners and won't overpopulate in freshwater.`,
  },
];

/**
 * Simple keyword-based relevance scoring.
 * Returns a score 0–1 based on tag and content matches.
 *
 * @param {Object} doc - Knowledge document
 * @param {string} query - User query string
 * @returns {number} relevance score
 */
function scoreDocument(doc, query) {
  const q = query.toLowerCase();
  const words = q.split(/\s+/).filter(w => w.length > 2);
  let score = 0;

  // Tag matches are weighted higher
  for (const tag of doc.tags) {
    if (q.includes(tag)) score += 0.3;
    for (const word of words) {
      if (tag.includes(word) || word.includes(tag)) score += 0.15;
    }
  }

  // Content matches
  const content = doc.content.toLowerCase();
  for (const word of words) {
    if (content.includes(word)) score += 0.05;
  }

  return Math.min(score, 1);
}

/**
 * Retrieve the top-K most relevant documents for a query.
 *
 * @param {string} query
 * @param {number} topK
 * @param {number} minScore
 * @returns {{ doc: Object, score: number }[]}
 */
export function retrieveDocuments(query, topK = 5, minScore = 0.1) {
  const scored = KNOWLEDGE_DOCS.map(doc => ({
    doc,
    score: scoreDocument(doc, query),
  }));

  return scored
    .filter(r => r.score >= minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

/**
 * Format retrieved documents into a context string for agents.
 *
 * @param {string} query
 * @returns {string}
 */
export function buildRagContext(query) {
  const results = retrieveDocuments(query);
  if (results.length === 0) {
    return 'No specific knowledge base documents matched this query.';
  }

  return results
    .map(r => `[${r.doc.title}]\n${r.doc.content}`)
    .join('\n\n---\n\n');
}
