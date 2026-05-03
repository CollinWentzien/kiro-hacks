/**
 * Context Extractor
 *
 * Parses user messages and profile to extract structured context:
 * - location (city, region, country)
 * - inferred climate zone
 * - constraints (sunlight, water, space, soil)
 * - ecosystem type
 *
 * This context is passed to every agent so prompts are grounded
 * in the user's actual situation rather than generic defaults.
 */

// ─── Location → climate mapping ───────────────────────────────────────────────
// Covers major regions. Extend as needed.
const LOCATION_CLIMATE_MAP = [
  // California
  { pattern: /southern california|los angeles|san diego|santa barbara|riverside|orange county/i, climate: 'Mediterranean', region: 'Southern California', notes: 'Hot dry summers, mild wet winters. Drought-tolerant natives excel. USDA zones 9b–11.' },
  { pattern: /northern california|san francisco|bay area|sacramento|napa|sonoma/i,               climate: 'Mediterranean', region: 'Northern California', notes: 'Cooler summers than SoCal, more fog. Zones 9a–10b.' },
  { pattern: /central valley|fresno|bakersfield|stockton|modesto/i,                              climate: 'Semi-arid',     region: 'California Central Valley', notes: 'Hot dry summers, cold foggy winters. Zones 8b–9b.' },

  // Pacific Northwest
  { pattern: /pacific northwest|seattle|portland|oregon|washington state|tacoma|olympia/i, climate: 'Oceanic',       region: 'Pacific Northwest', notes: 'Mild wet winters, dry summers. Zones 7b–9a.' },

  // Southwest
  { pattern: /arizona|phoenix|tucson|albuquerque|new mexico|nevada|las vegas/i,           climate: 'Desert',        region: 'American Southwest', notes: 'Hot dry summers, mild winters. Zones 7a–10b. Xeriscape essential.' },
  { pattern: /texas|houston|dallas|austin|san antonio/i,                                  climate: 'Subtropical',   region: 'Texas', notes: 'Hot humid summers (east) to semi-arid (west). Zones 7a–9b.' },

  // Southeast / Gulf Coast
  { pattern: /florida|miami|orlando|tampa|jacksonville/i,                                 climate: 'Subtropical',   region: 'Florida', notes: 'Hot humid year-round, hurricane risk. Zones 8b–11.' },
  { pattern: /georgia|south carolina|north carolina|alabama|mississippi|louisiana/i,      climate: 'Humid subtropical', region: 'American Southeast', notes: 'Hot humid summers, mild winters. Zones 7a–9a.' },

  // Northeast / Mid-Atlantic
  { pattern: /new york|new jersey|pennsylvania|connecticut|massachusetts|boston|philadelphia/i, climate: 'Humid continental', region: 'American Northeast', notes: 'Cold winters, warm humid summers. Zones 5b–7b.' },
  { pattern: /new england|vermont|maine|new hampshire|rhode island/i,                          climate: 'Humid continental', region: 'New England', notes: 'Cold winters, short summers. Zones 4a–6b.' },

  // Midwest
  { pattern: /chicago|illinois|ohio|indiana|michigan|wisconsin|minnesota|iowa/i,          climate: 'Humid continental', region: 'American Midwest', notes: 'Cold winters, hot humid summers. Zones 4a–6b.' },
  { pattern: /kansas|nebraska|oklahoma|missouri|arkansas/i,                               climate: 'Continental',   region: 'American Great Plains', notes: 'Extreme temperature swings, variable rainfall. Zones 5a–7b.' },

  // Mountain West
  { pattern: /colorado|denver|boulder|utah|salt lake|idaho|montana|wyoming/i,             climate: 'Semi-arid',     region: 'Mountain West', notes: 'High altitude, low humidity, intense sun. Zones 3b–7a.' },

  // UK / Europe
  { pattern: /london|england|uk|united kingdom|wales|scotland/i,                          climate: 'Oceanic',       region: 'United Kingdom', notes: 'Mild wet climate, rarely freezes. RHS zones H3–H5.' },
  { pattern: /france|paris|germany|berlin|netherlands|belgium/i,                          climate: 'Oceanic',       region: 'Western Europe', notes: 'Mild oceanic to continental. Varied zones.' },
  { pattern: /mediterranean|spain|italy|greece|portugal/i,                                climate: 'Mediterranean', region: 'Mediterranean Europe', notes: 'Hot dry summers, mild wet winters.' },

  // Australia
  { pattern: /sydney|new south wales|victoria|melbourne/i,                                climate: 'Oceanic',       region: 'Southeast Australia', notes: 'Mild oceanic climate. Australian native plants preferred.' },
  { pattern: /queensland|brisbane|cairns|darwin|northern territory/i,                     climate: 'Tropical',      region: 'Tropical Australia', notes: 'Hot wet/dry seasons. Tropical natives.' },
  { pattern: /perth|western australia/i,                                                  climate: 'Mediterranean', region: 'Southwest Australia', notes: 'Hot dry summers, mild wet winters. Unique endemic flora.' },

  // Canada
  { pattern: /toronto|ontario|montreal|quebec|ottawa/i,                                   climate: 'Humid continental', region: 'Eastern Canada', notes: 'Cold winters, warm summers. Zones 4a–6b.' },
  { pattern: /vancouver|british columbia/i,                                               climate: 'Oceanic',       region: 'British Columbia', notes: 'Mild wet climate similar to Pacific Northwest. Zones 7a–9a.' },

  // India
  { pattern: /india|mumbai|delhi|bangalore|chennai|kolkata|hyderabad/i,                   climate: 'Tropical',      region: 'India', notes: 'Tropical monsoon climate. Diverse regional variation.' },

  // Generic fallbacks
  { pattern: /tropical/i,    climate: 'Tropical',      region: 'Tropical region',    notes: 'High heat and humidity year-round.' },
  { pattern: /desert/i,      climate: 'Desert',        region: 'Desert region',      notes: 'Extreme heat, very low rainfall.' },
  { pattern: /temperate/i,   climate: 'Temperate',     region: 'Temperate region',   notes: 'Moderate climate with four seasons.' },
  { pattern: /mediterranean/i, climate: 'Mediterranean', region: 'Mediterranean region', notes: 'Hot dry summers, mild wet winters.' },
];

// ─── Regional plant knowledge (mini-RAG) ─────────────────────────────────────
// Injected into agent prompts as grounding context.
export const REGIONAL_PLANT_KNOWLEDGE = {
  'Southern California': {
    goodPlants: ['Cleveland sage (Salvia clevelandii)', 'Manzanita (Arctostaphylos spp.)', 'Ceanothus (California lilac)', 'Toyon (Heteromeles arbutifolia)', 'Matilija poppy (Romneya coulteri)', 'Buckwheat (Eriogonum spp.)', 'Lemonade berry (Rhus integrifolia)', 'Coffeeberry (Frangula californica)'],
    avoidPlants: ['Lawn grass (high water)', 'Azalea (needs acid soil, humidity)', 'Rhododendron (wrong climate)', 'Hostas (need shade and moisture)'],
    notes: 'Focus on California natives and Mediterranean-climate plants. Avoid anything needing regular summer water. Chaparral and coastal sage scrub species thrive here.',
    pollinators: ['native bees', 'monarch butterflies', 'hummingbirds'],
  },
  'Northern California': {
    goodPlants: ['Coast redwood (Sequoia sempervirens)', 'California poppy (Eschscholzia californica)', 'Blue-eyed grass (Sisyrinchium bellum)', 'Yarrow (Achillea millefolium)', 'Coyote brush (Baccharis pilularis)', 'Sticky monkeyflower (Diplacus aurantiacus)'],
    avoidPlants: ['Tropical plants (frost risk)', 'High-humidity tropicals'],
    notes: 'Bay Area fog belt supports more moisture-loving plants than SoCal. Redwood understory species work well in shaded gardens.',
    pollinators: ['native bees', 'bumble bees', 'hummingbirds'],
  },
  'Pacific Northwest': {
    goodPlants: ['Red flowering currant (Ribes sanguineum)', 'Oregon grape (Mahonia aquifolium)', 'Sword fern (Polystichum munitum)', 'Salal (Gaultheria shallon)', 'Camas (Camassia quamash)', 'Western red cedar (Thuja plicata)', 'Nootka rose (Rosa nutkana)'],
    avoidPlants: ['Desert plants (too wet)', 'Mediterranean plants (too much rain)'],
    notes: 'Embrace the rain — ferns, mosses, and woodland plants thrive. Native conifers provide year-round structure.',
    pollinators: ['bumble bees', 'mason bees', 'hummingbirds'],
  },
  'American Southwest': {
    goodPlants: ['Saguaro cactus (Carnegiea gigantea)', 'Palo verde (Parkinsonia spp.)', 'Desert willow (Chilopsis linearis)', 'Agave (Agave spp.)', 'Ocotillo (Fouquieria splendens)', 'Brittlebush (Encelia farinosa)', 'Fairy duster (Calliandra eriophylla)'],
    avoidPlants: ['Lawn grass (extreme water waste)', 'Tropical plants', 'Moisture-loving perennials'],
    notes: 'Xeriscape is essential. Native Sonoran and Chihuahuan desert plants are adapted to extreme heat and drought. Avoid any plant needing regular irrigation.',
    pollinators: ['native bees', 'hummingbirds', 'bats (night-blooming cacti)'],
  },
  'American Northeast': {
    goodPlants: ['Eastern redbud (Cercis canadensis)', 'Wild columbine (Aquilegia canadensis)', 'Joe-Pye weed (Eutrochium purpureum)', 'Black-eyed Susan (Rudbeckia hirta)', 'Buttonbush (Cephalanthus occidentalis)', 'Spicebush (Lindera benzoin)', 'Serviceberry (Amelanchier spp.)'],
    avoidPlants: ['Tropical plants (frost damage)', 'Mediterranean plants (too cold/wet)'],
    notes: 'Four-season garden. Native woodland edge plants support diverse wildlife. Consider bloom succession from spring ephemerals through fall asters.',
    pollinators: ['monarch butterflies', 'native bees', 'fireflies'],
  },
  'American Southeast': {
    goodPlants: ['Beautyberry (Callicarpa americana)', 'Coral honeysuckle (Lonicera sempervirens)', 'Swamp milkweed (Asclepias incarnata)', 'Buttonbush (Cephalanthus occidentalis)', 'Yaupon holly (Ilex vomitoria)', 'Muhly grass (Muhlenbergia capillaris)', 'Pawpaw (Asimina triloba)'],
    avoidPlants: ['Plants needing cold stratification', 'Alpine plants'],
    notes: 'Heat and humidity are the defining factors. Native plants adapted to the coastal plain and piedmont are most resilient.',
    pollinators: ['monarch butterflies', 'swallowtail butterflies', 'native bees'],
  },
  'American Midwest': {
    goodPlants: ['Purple coneflower (Echinacea purpurea)', 'Prairie dropseed (Sporobolus heterolepis)', 'Wild bergamot (Monarda fistulosa)', 'Compass plant (Silphium laciniatum)', 'Rattlesnake master (Eryngium yuccifolium)', 'Ironweed (Vernonia fasciculata)', 'Blazing star (Liatris spicata)'],
    avoidPlants: ['Tropical plants (harsh winters)', 'Shallow-rooted plants (drought risk)'],
    notes: 'Prairie natives have deep root systems that survive drought and cold. Tallgrass prairie restoration species are ideal.',
    pollinators: ['monarch butterflies', 'native bees', 'bumble bees'],
  },
  'United Kingdom': {
    goodPlants: ['Foxglove (Digitalis purpurea)', 'Hawthorn (Crataegus monogyna)', 'Ox-eye daisy (Leucanthemum vulgare)', 'Knapweed (Centaurea nigra)', 'Teasel (Dipsacus fullonum)', 'Wild garlic (Allium ursinum)', 'Bluebell (Hyacinthoides non-scripta)'],
    avoidPlants: ['Invasive species like Japanese knotweed', 'Rhododendron ponticum (invasive)'],
    notes: 'UK native wildflowers support bees, butterflies, and birds. RHS Plants for Pollinators list is a good reference.',
    pollinators: ['bumble bees', 'honey bees', 'red admiral butterflies'],
  },
  'Tropical': {
    goodPlants: ['Heliconia (Heliconia spp.)', 'Bird of paradise (Strelitzia reginae)', 'Ginger (Zingiber officinale)', 'Banana (Musa spp.)', 'Papaya (Carica papaya)', 'Moringa (Moringa oleifera)', 'Ylang-ylang (Cananga odorata)'],
    avoidPlants: ['Temperate plants needing cold dormancy', 'Alpine plants'],
    notes: 'Year-round growing season. Focus on layered canopy structure: tall trees, understory, shrubs, ground cover.',
    pollinators: ['hummingbirds', 'sunbirds', 'bats', 'tropical bees'],
  },
  'default': {
    goodPlants: ['Lavender (Lavandula spp.)', 'Yarrow (Achillea millefolium)', 'Coneflower (Echinacea spp.)', 'Salvia (Salvia spp.)', 'Ornamental grasses', 'Sedum (Sedum spp.)'],
    avoidPlants: ['Invasive species for your region'],
    notes: 'Without knowing your specific location, I recommend drought-tolerant, pollinator-friendly plants that work across many climates. Share your location for tailored recommendations.',
    pollinators: ['bees', 'butterflies', 'birds'],
  },
};

// ─── Constraint extraction ────────────────────────────────────────────────────
const CONSTRAINT_PATTERNS = {
  sunlight: {
    fullSun:      /full sun|sunny|south.facing|6\+? hours/i,
    partialShade: /partial shade|part shade|dappled|morning sun|afternoon shade/i,
    fullShade:    /full shade|deep shade|no sun|north.facing/i,
  },
  water: {
    low:    /drought|low water|xeriscape|dry|no irrigation|water.wise/i,
    high:   /wet|boggy|pond.edge|riparian|lots of water|moist/i,
    medium: /average water|moderate water|regular water/i,
  },
  space: {
    small:  /small|tiny|container|pot|balcony|window box|limited space|few square/i,
    large:  /large|acre|big yard|field|meadow|lots of space/i,
  },
  soil: {
    clay:     /clay soil|heavy soil|compacted/i,
    sandy:    /sandy soil|fast.draining|poor soil/i,
    loamy:    /loamy|rich soil|good soil|amended/i,
    acidic:   /acidic|acid soil|low pH|ericaceous/i,
    alkaline: /alkaline|chalky|high pH|limestone/i,
  },
  ecosystemType: {
    terrarium: /terrarium|vivarium|paludarium/i,
    aquarium:  /aquarium|fish tank|freshwater tank|reef tank/i,
    pond:      /pond|water garden|bog garden/i,
    indoor:    /indoor|houseplant|inside|apartment/i,
    // Match "garden", "yard", "backyard", "working with a garden", "I have a garden", etc.
    outdoor:   /\bgarden\b|yard|backyard|front yard|outdoor|raised bed|allotment|plot/i,
  },
};

// ─── Goal extraction ──────────────────────────────────────────────────────────
// Detects what the user wants to achieve from their message.
const GOAL_PATTERNS = [
  { pattern: /grow\s+fruit|fruit\s+garden|fruit\s+tree|orchard|berry|apple|pear|plum|cherry|peach|citrus|lemon|orange|fig|grape|strawberr|raspberr|blueberr/i, goal: 'grow fruits' },
  { pattern: /grow\s+veg|vegetable|veggie|tomato|pepper|cucumber|zucchini|squash|carrot|lettuce|kale|spinach|herb|basil|mint|rosemary|edible|food garden|kitchen garden/i, goal: 'grow vegetables' },
  { pattern: /pollinator|attract\s+bee|attract\s+butterfly|bee\s+garden|butterfly\s+garden|nectar/i, goal: 'support pollinators' },
  { pattern: /wildlife|bird|habitat|native|biodiversity|ecosystem/i, goal: 'support wildlife' },
  { pattern: /low.maintenance|easy|beginner|minimal\s+work|no\s+fuss/i, goal: 'low maintenance' },
  { pattern: /privacy|screen|hedge|fence|block/i, goal: 'privacy screening' },
  { pattern: /shade|cool|canopy/i, goal: 'create shade' },
  { pattern: /soil\s+health|compost|improve\s+soil|enrich/i, goal: 'improve soil' },
  { pattern: /water\s+feature|pond|bog|rain\s+garden/i, goal: 'water feature' },
];

/**
 * Extract structured context from a user message + profile.
 *
 * @param {string} message
 * @param {Object} profile
 * @returns {ExtractedContext}
 */
export function extractContext(message, profile) {
  const text = `${message} ${profile?.location || ''}`.toLowerCase();
  const fullText = `${message} ${profile?.location || ''}`;

  // ── Location ──
  let location = profile?.location || null;
  let climate = profile?.climateZone || null;
  let region = null;
  let regionNotes = null;

  // Try to extract location from message if not in profile
  if (!location) {
    const locMatch = message.match(/\b(?:in|near|around|from|at)\s+([A-Z][a-zA-Z\s,]+?)(?:\s*[,.]|\s+(?:area|region|zone|climate)|\s*$)/);
    if (locMatch) location = locMatch[1].trim();
  }

  // Map location to climate
  for (const entry of LOCATION_CLIMATE_MAP) {
    if (entry.pattern.test(fullText)) {
      climate = climate || entry.climate;
      region = entry.region;
      regionNotes = entry.notes;
      break;
    }
  }

  // ── Constraints ──
  const constraints = {
    sunlight: null,
    water: null,
    space: null,
    soil: null,
    ecosystemType: null,
  };

  for (const [key, patterns] of Object.entries(CONSTRAINT_PATTERNS)) {
    for (const [value, pattern] of Object.entries(patterns)) {
      if (pattern.test(text)) {
        constraints[key] = value;
        break;
      }
    }
  }

  // Infer ecosystem type from profile mode if not detected in message
  if (!constraints.ecosystemType && profile?.mode) {
    constraints.ecosystemType = profile.mode;
  }

  // ── Goal extraction ──
  let goal = null;
  for (const { pattern, goal: g } of GOAL_PATTERNS) {
    if (pattern.test(message)) {
      goal = g;
      break;
    }
  }

  // ── Missing context flags ──
  // Only flag location as missing — don't ask for sunlight/ecosystem type
  // if the user hasn't mentioned them (they may not be relevant yet).
  const missingContext = [];
  if (!location && !region) missingContext.push('location');

  // ── Regional plant knowledge ──
  const regionalKnowledge = region
    ? (REGIONAL_PLANT_KNOWLEDGE[region] || REGIONAL_PLANT_KNOWLEDGE['default'])
    : REGIONAL_PLANT_KNOWLEDGE['default'];

  // ── Debug log ──
  console.log(
    `[contextExtractor] ecosystemType="${constraints.ecosystemType ?? 'none'}" ` +
    `goal="${goal ?? 'none'}" ` +
    `location="${location ?? region ?? 'none'}" ` +
    `missing=[${missingContext.join(', ')}]`
  );

  return {
    location,
    climate,
    region,
    regionNotes,
    constraints,
    goal,                                          // ← new field
    missingContext,
    regionalKnowledge,
    needsFollowUp: missingContext.includes('location') && !climate,
  };
}

/**
 * Format extracted context as a string for injection into agent prompts.
 *
 * @param {ExtractedContext} ctx
 * @returns {string}
 */
export function formatContextForPrompt(ctx) {
  const lines = [];

  if (ctx.location) lines.push(`Location: ${ctx.location}`);
  if (ctx.region)   lines.push(`Region: ${ctx.region}`);
  if (ctx.climate)  lines.push(`Climate: ${ctx.climate}`);
  if (ctx.regionNotes) lines.push(`Climate notes: ${ctx.regionNotes}`);

  const c = ctx.constraints;
  if (c.ecosystemType) lines.push(`Ecosystem type: ${c.ecosystemType}`);
  if (ctx.goal)        lines.push(`User goal: ${ctx.goal}`);
  if (c.sunlight)      lines.push(`Sunlight: ${c.sunlight}`);
  if (c.water)         lines.push(`Water availability: ${c.water}`);
  if (c.space)         lines.push(`Space: ${c.space}`);
  if (c.soil)          lines.push(`Soil type: ${c.soil}`);

  if (ctx.regionalKnowledge && ctx.region) {
    lines.push(`\nRegion-specific plant knowledge for ${ctx.region}:`);
    lines.push(`  Recommended: ${ctx.regionalKnowledge.goodPlants.slice(0, 5).join(', ')}`);
    lines.push(`  Avoid: ${ctx.regionalKnowledge.avoidPlants.slice(0, 3).join(', ')}`);
    lines.push(`  Notes: ${ctx.regionalKnowledge.notes}`);
    if (ctx.regionalKnowledge.pollinators?.length) {
      lines.push(`  Key pollinators: ${ctx.regionalKnowledge.pollinators.join(', ')}`);
    }
  }

  // Only surface location as missing — don't ask for sunlight/climate unless critical
  if (ctx.missingContext.includes('location')) {
    lines.push(`\nMissing: location/climate zone — ask the user for this if not already known`);
  }

  return lines.join('\n');
}
