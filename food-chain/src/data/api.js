const BASE = 'http://localhost:3000';

// Genera that are reliably herbivores regardless of GloBI interaction data
const HERBIVORE_GENERA = new Set([
  'otospermophilus', 'spermophilus', 'sciurus', 'tamiasciurus', 'tamias',
  'marmota', 'cynomys', 'neotoma', 'peromyscus', 'microtus', 'ondatra',
  'castor', 'thomomys', 'lepus', 'sylvilagus', 'odocoileus', 'cervus',
  'antilocapra', 'bison', 'ovis', 'capra',
]);

function mapTrophic(species) {
  // Genus-based override for known herbivores with missing taxonomy
  const genus = (species.scientificName || '').split(' ')[0].toLowerCase();
  if (HERBIVORE_GENERA.has(genus)) return 'primary';

  const label = (species.trophicLabel || '').toLowerCase();
  if (label.includes('producer') || species.category === 'plant') return 'producer';
  if (label.includes('decompos')) return 'decomposer';

  // Cap null-taxonomy animals at secondary — GloBI misclassifies insects/invertebrates as apex
  const hasNullTaxonomy = !species.taxonomy?.order && !species.taxonomy?.family;
  if ((label.includes('apex') || species.trophicLevel >= 4) && hasNullTaxonomy) return 'secondary';

  if (label.includes('apex') || species.trophicLevel >= 4) return 'tertiary';
  if (label.includes('secondary') || species.trophicLevel === 3) return 'secondary';
  return 'primary';
}

function mapKind(species) {
  const cls = (species.taxonomy?.class || '').toLowerCase();
  const kingdom = (species.taxonomy?.kingdom || '').toLowerCase();
  if (kingdom === 'plantae' || species.category === 'plant') return 'plant';
  if (cls === 'aves') return 'bird';
  if (cls === 'mammalia') return 'mammal';
  if (cls === 'reptilia') return 'reptile';
  if (cls === 'amphibia') return 'amphibian';
  if (cls === 'actinopterygii' || cls === 'chondrichthyes') return 'fish';
  return 'invertebrate';
}

function parseInteractionNames(val) {
  if (Array.isArray(val)) return val;
  if (val && Array.isArray(val.value)) return val.value;
  if (typeof val === 'string') return val.split(' ').filter(Boolean);
  return [];
}

export function mapBackendSpecies(s, allRaw = []) {
  const myId = s.scientificName.toLowerCase().replace(/\s+/g, '-');
  const nameToId = {}, genusToId = {};
  allRaw.forEach(r => {
    const id = r.scientificName.toLowerCase().replace(/\s+/g, '-');
    nameToId[r.scientificName.toLowerCase()] = id;
    genusToId[r.scientificName.split(' ')[0].toLowerCase()] = id;
  });
  const resolve = names => [...new Set(
    names.map(n => nameToId[n.toLowerCase()] || genusToId[n.toLowerCase()])
      .filter(id => id && id !== myId)
  )];

  return {
    id: myId,
    name: s.commonName || s.scientificName,
    latin: s.scientificName,
    kind: mapKind(s),
    env: ['backyard'],
    climate: ['temperate'],
    trophic: mapTrophic(s),
    eats: resolve(parseInteractionNames(s.interactions?.eats)),
    eatenBy: resolve(parseInteractionNames(s.interactions?.eatenBy)),
    blurb: s.observationSummary || '',
    img: s.photoUrl || '',
    fallback: '',
    nativeStatus: s.nativeStatus,
    _fromBackend: true,
  };
}

export async function fetchEcosystem(city) {
  const res = await fetch(`${BASE}/api/ecosystem?city=${encodeURIComponent(city)}&limit=40`);
  if (!res.ok) throw new Error(`API error ${res.status}`);
  const data = await res.json();
  const species = (data.species || []).map(s => mapBackendSpecies(s, data.species));
  return { region: data.region, species };
}

export async function searchCatalog({ q = '', category, kingdom, limit = 30, page = 1, city } = {}) {
  const params = new URLSearchParams({ limit, page });
  if (q) params.set('q', q);
  if (category) params.set('category', category);
  if (kingdom) params.set('kingdom', kingdom);
  if (city) params.set('city', city);
  const res = await fetch(`${BASE}/api/catalog/search?${params}`);
  if (!res.ok) throw new Error(`Catalog API error ${res.status}`);
  const data = await res.json();
  return {
    results: (data.results || []).map(s => mapCatalogSpecies(s)),
    total: data.totalResults || 0,
    page: data.page || 1,
  };
}

function mapCatalogSpecies(s) {
  return {
    id: `cat-${s.inatTaxonId || s.scientificName?.toLowerCase().replace(/\s+/g, '-')}`,
    name: s.commonName || s.scientificName,
    latin: s.scientificName,
    kind: mapKindFromIconic(s.iconicTaxonName),
    env: ['backyard'],
    climate: ['temperate'],
    trophic: 'primary',
    eats: [], eatenBy: [],
    blurb: '',
    wikipediaUrl: s.wikipediaUrl || '',
    observationCount: s.observationCount || null,
    img: s.photoUrl || '',
    fallback: '',
    compatibilityScore: s.compatibilityScore,
    compatibilityLabel: s.compatibilityLabel,
    _fromCatalog: true,
  };
}

function mapKindFromIconic(iconic) {
  const i = (iconic || '').toLowerCase();
  if (i === 'plantae' || i === 'fungi') return 'plant';
  if (i === 'aves') return 'bird';
  if (i === 'mammalia') return 'mammal';
  if (i === 'reptilia') return 'reptile';
  if (i === 'amphibia') return 'amphibian';
  if (i === 'actinopterygii') return 'fish';
  return 'invertebrate';
}
