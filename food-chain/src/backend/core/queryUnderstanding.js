/**
 * Query Understanding
 *
 * Extracts structured intent and context from a user message BEFORE
 * calling any agents. This is the "understand first, then act" layer.
 *
 * Returns:
 *   location      — exact string the user wrote (e.g. "New Jersey", "Seattle")
 *   region        — mapped region key for knowledge base lookup
 *   intent        — primary intent category
 *   questionType  — more specific description of what was asked
 *   season        — if mentioned
 *   constraints   — array of detected constraints
 *   wantsPollinators — only true if user explicitly asked about pollinators
 */

// ─── Intent classification ────────────────────────────────────────────────────

const INTENT_RULES = [
  {
    intent: 'diagnosis',
    patterns: [/yellow|wilt|droop|spot|brown|white powder|mold|pest|sick|dying|problem|diagnos|symptom|disease|bug|insect|rot|crispy|pale|stunted|help.*plant|what.*wrong/i],
    questionType: 'plant problem diagnosis',
  },
  {
    intent: 'sustainability',
    patterns: [/sustain|water use|water.efficient|native.*ratio|eco.*score|green.*score|environmental.*impact/i],
    questionType: 'sustainability evaluation',
  },
  {
    intent: 'biodiversity',
    patterns: [/biodiversity|food chain|trophic|missing.*species|ecosystem.*health|balance.*ecosystem/i],
    questionType: 'biodiversity assessment',
  },
  {
    intent: 'pollinator',
    patterns: [/pollinator|attract.*bee|attract.*butterfly|monarch|nectar.*plant|bee.*garden|butterfly.*garden/i],
    questionType: 'pollinator support',
  },
  {
    intent: 'plant_recommendation',
    patterns: [/what.*plant|which.*plant|grow.*in|plant.*in|recommend.*plant|suggest.*plant|good.*plant|best.*plant|native.*plant|plant.*grow|what.*grow|what.*can.*grow/i],
    questionType: 'regional plant suitability',
  },
  {
    intent: 'general',
    patterns: [/.*/],
    questionType: 'general ecosystem question',
  },
];

// ─── Location extraction ──────────────────────────────────────────────────────
// Ordered from most specific to least specific.
// Each entry: { pattern, location, region, climate, notes }

const LOCATION_DB = [
  // ── New Jersey / Mid-Atlantic ──
  { pattern: /\bnew jersey\b|\bnj\b/i,           location: 'New Jersey',        region: 'New Jersey',          climate: 'Humid continental', notes: 'USDA zones 6a–7b. Cold winters, hot humid summers. Four distinct seasons. Good rainfall year-round.' },
  { pattern: /\bphiladelphia\b|\bphilly\b/i,      location: 'Philadelphia',      region: 'Mid-Atlantic',        climate: 'Humid continental', notes: 'USDA zone 7a. Warm humid summers, cold winters. Urban heat island effect.' },
  { pattern: /\bmaryland\b|\bbaltimore\b/i,       location: 'Maryland',          region: 'Mid-Atlantic',        climate: 'Humid subtropical', notes: 'USDA zones 6b–8a. Hot humid summers, mild winters in south.' },
  { pattern: /\bvirginia\b|\brichmond\b|\bnorfolk\b/i, location: 'Virginia',    region: 'Mid-Atlantic',        climate: 'Humid subtropical', notes: 'USDA zones 5b–8a. Hot humid summers, mild to cold winters.' },
  { pattern: /\bdelaware\b/i,                     location: 'Delaware',          region: 'Mid-Atlantic',        climate: 'Humid continental', notes: 'USDA zones 6b–7b. Similar to New Jersey.' },
  { pattern: /\bconnecticut\b|\bct\b/i,           location: 'Connecticut',       region: 'New England',         climate: 'Humid continental', notes: 'USDA zones 5b–7a. Cold winters, warm humid summers.' },
  { pattern: /\bmassachusetts\b|\bboston\b|\bma\b/i, location: 'Massachusetts', region: 'New England',         climate: 'Humid continental', notes: 'USDA zones 5a–7a. Cold winters, warm summers.' },
  { pattern: /\brhode island\b|\bri\b/i,          location: 'Rhode Island',      region: 'New England',         climate: 'Humid continental', notes: 'USDA zones 6a–7a.' },
  { pattern: /\bvermont\b|\bvt\b/i,               location: 'Vermont',           region: 'New England',         climate: 'Humid continental', notes: 'USDA zones 3b–6a. Very cold winters.' },
  { pattern: /\bmaine\b|\bme\b/i,                 location: 'Maine',             region: 'New England',         climate: 'Humid continental', notes: 'USDA zones 3b–6a. Cold winters, short summers.' },
  { pattern: /\bnew hampshire\b|\bnh\b/i,         location: 'New Hampshire',     region: 'New England',         climate: 'Humid continental', notes: 'USDA zones 3b–6b.' },
  { pattern: /\bnew york city\b|\bnyc\b|\bmanhattan\b|\bbrooklyn\b|\bqueens\b/i, location: 'New York City', region: 'American Northeast', climate: 'Humid continental', notes: 'USDA zone 7b. Urban heat island. Warm summers, cold winters.' },
  { pattern: /\bnew york\b|\bny\b(?!c)/i,         location: 'New York',          region: 'American Northeast',  climate: 'Humid continental', notes: 'USDA zones 3b–7b depending on area. Cold winters, warm humid summers.' },
  { pattern: /\bpennsylvania\b|\bpa\b/i,          location: 'Pennsylvania',      region: 'Mid-Atlantic',        climate: 'Humid continental', notes: 'USDA zones 5a–7a. Cold winters, hot humid summers.' },

  // ── Southeast ──
  { pattern: /\bflorida\b|\bmiami\b|\borlando\b|\btampa\b|\bjacksonville\b/i, location: 'Florida', region: 'Florida', climate: 'Subtropical', notes: 'USDA zones 8b–11. Hot humid year-round, hurricane risk, no frost in south.' },
  { pattern: /\bgeorgia\b|\batlanta\b/i,          location: 'Georgia',           region: 'American Southeast',  climate: 'Humid subtropical', notes: 'USDA zones 6a–9a. Hot humid summers, mild winters.' },
  { pattern: /\bsouth carolina\b|\bsc\b/i,        location: 'South Carolina',    region: 'American Southeast',  climate: 'Humid subtropical', notes: 'USDA zones 7a–9a.' },
  { pattern: /\bnorth carolina\b|\bnc\b/i,        location: 'North Carolina',    region: 'American Southeast',  climate: 'Humid subtropical', notes: 'USDA zones 5b–8b. Mountains to coast.' },
  { pattern: /\balabama\b|\bal\b/i,               location: 'Alabama',           region: 'American Southeast',  climate: 'Humid subtropical', notes: 'USDA zones 7a–8b.' },
  { pattern: /\bmississippi\b|\bms\b/i,           location: 'Mississippi',       region: 'American Southeast',  climate: 'Humid subtropical', notes: 'USDA zones 7a–9a.' },
  { pattern: /\blouisiana\b|\bnew orleans\b/i,    location: 'Louisiana',         region: 'American Southeast',  climate: 'Humid subtropical', notes: 'USDA zones 8a–9b. Very hot and humid.' },
  { pattern: /\btennessee\b|\bnashville\b/i,      location: 'Tennessee',         region: 'American Southeast',  climate: 'Humid subtropical', notes: 'USDA zones 5b–8a.' },

  // ── California ──
  { pattern: /\blos angeles\b|\bla\b(?=\s|,|$)|\bsan diego\b|\bsanta barbara\b|\briverside\b|\borange county\b|\bsocal\b|\bsouthern california\b/i, location: 'Southern California', region: 'Southern California', climate: 'Mediterranean', notes: 'USDA zones 9b–11. Hot dry summers, mild wet winters. Drought is the defining challenge.' },
  { pattern: /\bsan francisco\b|\bsf\b|\bbay area\b|\bsacramento\b|\bnapa\b|\bsonoma\b|\bnorcal\b|\bnorthern california\b/i, location: 'Northern California', region: 'Northern California', climate: 'Mediterranean', notes: 'USDA zones 9a–10b. Cooler and foggier than SoCal.' },
  { pattern: /\bfresno\b|\bbakersfield\b|\bstockton\b|\bmodesto\b|\bcentral valley\b/i, location: 'California Central Valley', region: 'California Central Valley', climate: 'Semi-arid', notes: 'USDA zones 8b–9b. Extreme heat in summer, cold foggy winters.' },
  { pattern: /\bcalifornia\b|\bca\b(?=\s|,|$)/i, location: 'California',         region: 'Northern California', climate: 'Mediterranean', notes: 'USDA zones 5a–11 depending on area.' },

  // ── Pacific Northwest ──
  { pattern: /\bseattle\b|\btacoma\b|\bolympia\b|\bwashington state\b|\bwa\b(?=\s|,|$)/i, location: 'Washington State', region: 'Pacific Northwest', climate: 'Oceanic', notes: 'USDA zones 7b–9a. Mild wet winters, dry summers.' },
  { pattern: /\bportland\b|\boregon\b|\bor\b(?=\s|,|$)/i, location: 'Oregon',   region: 'Pacific Northwest', climate: 'Oceanic', notes: 'USDA zones 6a–9b. Mild wet winters, dry summers.' },
  { pattern: /\bpacific northwest\b|\bpnw\b/i,   location: 'Pacific Northwest',  region: 'Pacific Northwest', climate: 'Oceanic', notes: 'USDA zones 7b–9a. Mild wet winters, dry summers.' },

  // ── Southwest ──
  { pattern: /\barizona\b|\bphoenix\b|\btucson\b|\baz\b(?=\s|,|$)/i, location: 'Arizona', region: 'American Southwest', climate: 'Desert', notes: 'USDA zones 7a–11. Extreme heat, very low rainfall. Xeriscape essential.' },
  { pattern: /\bnew mexico\b|\balbuquerque\b|\bnm\b(?=\s|,|$)/i, location: 'New Mexico', region: 'American Southwest', climate: 'Semi-arid', notes: 'USDA zones 4a–9a. High desert, cold winters at elevation.' },
  { pattern: /\bnevada\b|\blas vegas\b|\bnv\b(?=\s|,|$)/i, location: 'Nevada', region: 'American Southwest', climate: 'Desert', notes: 'USDA zones 4a–10a. Very dry, extreme temperature swings.' },
  { pattern: /\butah\b|\bsalt lake\b|\but\b(?=\s|,|$)/i, location: 'Utah',     region: 'Mountain West', climate: 'Semi-arid', notes: 'USDA zones 3b–9a. High desert, cold winters.' },
  { pattern: /\bcolorado\b|\bdenver\b|\bboulder\b|\bco\b(?=\s|,|$)/i, location: 'Colorado', region: 'Mountain West', climate: 'Semi-arid', notes: 'USDA zones 3b–7a. High altitude, intense sun, low humidity.' },

  // ── Texas ──
  { pattern: /\btexas\b|\bhouston\b|\bdallas\b|\baustin\b|\bsan antonio\b|\btx\b(?=\s|,|$)/i, location: 'Texas', region: 'Texas', climate: 'Subtropical', notes: 'USDA zones 6a–9b. Hot summers, mild winters in south, cold in north.' },

  // ── Midwest ──
  { pattern: /\bchicago\b|\billinois\b|\bil\b(?=\s|,|$)/i, location: 'Illinois', region: 'American Midwest', climate: 'Humid continental', notes: 'USDA zones 5a–6b. Cold winters, hot humid summers.' },
  { pattern: /\bohio\b|\bcleveland\b|\bcolumbus\b|\boh\b(?=\s|,|$)/i, location: 'Ohio', region: 'American Midwest', climate: 'Humid continental', notes: 'USDA zones 5a–6b.' },
  { pattern: /\bindiana\b|\bindianapolis\b|\bin\b(?=\s|,|$)/i, location: 'Indiana', region: 'American Midwest', climate: 'Humid continental', notes: 'USDA zones 5a–6b.' },
  { pattern: /\bmichigan\b|\bdetroit\b|\bmi\b(?=\s|,|$)/i, location: 'Michigan', region: 'American Midwest', climate: 'Humid continental', notes: 'USDA zones 4a–6b.' },
  { pattern: /\bwisconsin\b|\bmilwaukee\b|\bwi\b(?=\s|,|$)/i, location: 'Wisconsin', region: 'American Midwest', climate: 'Humid continental', notes: 'USDA zones 3b–5b.' },
  { pattern: /\bminnesota\b|\bminneapolis\b|\bmn\b(?=\s|,|$)/i, location: 'Minnesota', region: 'American Midwest', climate: 'Humid continental', notes: 'USDA zones 3a–5a. Very cold winters.' },
  { pattern: /\biowa\b|\bdes moines\b|\bia\b(?=\s|,|$)/i, location: 'Iowa',     region: 'American Midwest', climate: 'Humid continental', notes: 'USDA zones 4a–6a.' },
  { pattern: /\bmissouri\b|\bst\.? louis\b|\bkansas city\b|\bmo\b(?=\s|,|$)/i, location: 'Missouri', region: 'American Great Plains', climate: 'Continental', notes: 'USDA zones 4b–7a.' },

  // ── UK / Europe ──
  { pattern: /\blondon\b|\bengland\b|\buk\b|\bunited kingdom\b|\bwales\b|\bscotland\b/i, location: 'United Kingdom', region: 'United Kingdom', climate: 'Oceanic', notes: 'RHS zones H3–H5. Mild wet climate, rarely freezes hard.' },
  { pattern: /\bireland\b|\bdublin\b/i,           location: 'Ireland',           region: 'United Kingdom', climate: 'Oceanic', notes: 'Very mild and wet. Similar to UK.' },
  { pattern: /\bfrance\b|\bparis\b/i,             location: 'France',            region: 'Western Europe', climate: 'Oceanic', notes: 'Varied — oceanic in north, Mediterranean in south.' },
  { pattern: /\bgermany\b|\bberlin\b/i,           location: 'Germany',           region: 'Western Europe', climate: 'Oceanic', notes: 'Continental in east, oceanic in west.' },
  { pattern: /\bspain\b|\bmadrid\b|\bbarcelona\b/i, location: 'Spain',           region: 'Mediterranean Europe', climate: 'Mediterranean', notes: 'Hot dry summers, mild wet winters.' },
  { pattern: /\bitaly\b|\brome\b|\bmilan\b/i,     location: 'Italy',             region: 'Mediterranean Europe', climate: 'Mediterranean', notes: 'Mediterranean in south, continental in north.' },

  // ── Australia ──
  { pattern: /\bsydney\b|\bnew south wales\b|\bnsw\b/i, location: 'Sydney',     region: 'Southeast Australia', climate: 'Oceanic', notes: 'Mild oceanic. Australian native plants preferred.' },
  { pattern: /\bmelbourne\b|\bvictoria\b|\bvic\b/i, location: 'Melbourne',      region: 'Southeast Australia', climate: 'Oceanic', notes: 'Four seasons, mild. Australian natives.' },
  { pattern: /\bbrisbane\b|\bqueensland\b|\bqld\b/i, location: 'Queensland',    region: 'Tropical Australia', climate: 'Tropical', notes: 'Subtropical to tropical. Wet/dry seasons.' },
  { pattern: /\bperth\b|\bwestern australia\b|\bwa\b(?=\s|,|$)/i, location: 'Perth', region: 'Southwest Australia', climate: 'Mediterranean', notes: 'Hot dry summers, mild wet winters. Unique endemic flora.' },

  // ── Canada ──
  { pattern: /\btoronto\b|\bontario\b|\bon\b(?=\s|,|$)/i, location: 'Ontario', region: 'Eastern Canada', climate: 'Humid continental', notes: 'USDA zones 4a–6b. Cold winters, warm summers.' },
  { pattern: /\bmontreal\b|\bquebec\b|\bqc\b(?=\s|,|$)/i, location: 'Quebec', region: 'Eastern Canada', climate: 'Humid continental', notes: 'USDA zones 3b–5b. Very cold winters.' },
  { pattern: /\bvancouver\b|\bbritish columbia\b|\bbc\b(?=\s|,|$)/i, location: 'British Columbia', region: 'British Columbia', climate: 'Oceanic', notes: 'USDA zones 7a–9a. Mild wet climate.' },

  // ── India ──
  { pattern: /\bmumbai\b|\bbombay\b/i,            location: 'Mumbai',            region: 'India', climate: 'Tropical', notes: 'Tropical monsoon. Hot and humid.' },
  { pattern: /\bdelhi\b|\bnew delhi\b/i,          location: 'Delhi',             region: 'India', climate: 'Semi-arid', notes: 'Hot dry summers, cold winters, monsoon season.' },
  { pattern: /\bbangalore\b|\bbengaluru\b/i,      location: 'Bangalore',         region: 'India', climate: 'Tropical', notes: 'Mild tropical highland climate.' },
  { pattern: /\bindia\b/i,                        location: 'India',             region: 'India', climate: 'Tropical', notes: 'Diverse climate. Specify city for better advice.' },
];

// ─── Season extraction ────────────────────────────────────────────────────────

const SEASON_PATTERNS = [
  { pattern: /\bspring\b/i,  season: 'spring' },
  { pattern: /\bsummer\b/i,  season: 'summer' },
  { pattern: /\bfall\b|\bautumn\b/i, season: 'fall' },
  { pattern: /\bwinter\b/i,  season: 'winter' },
  { pattern: /\bnow\b|\bcurrently\b|\bthis year\b/i, season: 'current' },
];

// ─── Constraint extraction ────────────────────────────────────────────────────

const CONSTRAINT_PATTERNS = [
  { pattern: /full sun|sunny|south.facing/i,          constraint: 'full sun' },
  { pattern: /partial shade|part shade|dappled light/i, constraint: 'partial shade' },
  { pattern: /full shade|deep shade|no direct sun/i,  constraint: 'full shade' },
  { pattern: /drought|low water|xeriscape|water.wise/i, constraint: 'drought tolerant' },
  { pattern: /wet|boggy|moist soil|rain garden/i,     constraint: 'moisture tolerant' },
  { pattern: /container|pot|balcony|small space/i,    constraint: 'container/small space' },
  { pattern: /deer.resistant|deer proof/i,            constraint: 'deer resistant' },
  { pattern: /clay soil|heavy soil/i,                 constraint: 'clay soil' },
  { pattern: /sandy soil|fast.drain/i,                constraint: 'sandy soil' },
  { pattern: /edible|food|vegetable|herb|fruit/i,     constraint: 'edible plants' },
  { pattern: /low maintenance|easy|beginner/i,        constraint: 'low maintenance' },
  { pattern: /fast.growing|quick/i,                   constraint: 'fast growing' },
  { pattern: /native|indigenous|local/i,              constraint: 'native plants preferred' },
  { pattern: /indoor|houseplant|inside/i,             constraint: 'indoor' },
];

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Understand a user query before calling agents.
 *
 * @param {string} message
 * @param {Object} profile
 * @returns {QueryUnderstanding}
 */
export function understandQuery(message, profile) {
  const text = message;
  const lower = message.toLowerCase();

  // ── Location ──
  let location = null;
  let region = null;
  let climate = null;
  let locationNotes = null;

  // Check profile first
  if (profile?.location) {
    location = profile.location;
  }

  // Scan message against location DB (more specific patterns first)
  for (const entry of LOCATION_DB) {
    if (entry.pattern.test(text)) {
      // Use the exact string from the message if possible, otherwise use DB name
      const match = text.match(entry.pattern);
      location = location || (match ? match[0].trim() : entry.location);
      // Always use the canonical location name for display
      location = entry.location;
      region = entry.region;
      climate = entry.climate;
      locationNotes = entry.notes;
      break;
    }
  }

  // Fallback: try to extract location from "in X" / "near X" patterns
  if (!location) {
    const locMatch = message.match(/\b(?:in|near|around|from|for)\s+([A-Z][a-zA-Z\s]+?)(?:\s*[,.]|\s+(?:area|region|zone|garden|yard)|\s*$)/);
    if (locMatch) {
      location = locMatch[1].trim();
      // Try to match extracted location against DB
      for (const entry of LOCATION_DB) {
        if (entry.pattern.test(location)) {
          region = entry.region;
          climate = entry.climate;
          locationNotes = entry.notes;
          break;
        }
      }
    }
  }

  // ── Intent ──
  let intent = 'general';
  let questionType = 'general ecosystem question';
  let wantsPollinators = false;

  for (const rule of INTENT_RULES) {
    if (rule.patterns.some(p => p.test(text))) {
      intent = rule.intent;
      questionType = rule.questionType;
      if (rule.intent === 'pollinator') wantsPollinators = true;
      break;
    }
  }

  // ── Season ──
  let season = null;
  for (const s of SEASON_PATTERNS) {
    if (s.pattern.test(text)) { season = s.season; break; }
  }

  // ── Constraints ──
  const constraints = [];
  for (const c of CONSTRAINT_PATTERNS) {
    if (c.pattern.test(text)) constraints.push(c.constraint);
  }

  // ── Missing context ──
  const missingContext = [];
  if (!location && !region) missingContext.push('location');

  console.log(`[QueryUnderstanding] location="${location}" region="${region}" intent="${intent}" questionType="${questionType}" constraints=[${constraints.join(', ')}]`);

  return {
    location,       // exact canonical name, e.g. "New Jersey"
    region,         // knowledge base key, e.g. "New Jersey"
    climate,        // e.g. "Humid continental"
    locationNotes,  // USDA zone info, climate description
    intent,
    questionType,
    season,
    constraints,
    wantsPollinators,
    missingContext,
    hasLocation: !!(location || region),
  };
}
