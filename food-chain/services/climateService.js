/**
 * ClimateService
 *
 * Fetches a city's historical climate profile from Open-Meteo's climate API
 * and classifies species climate compatibility against it.
 *
 * Source: https://open-meteo.com/en/docs/climate-api (free, no API key)
 */

const CLIMATE_API_URL = 'https://climate-api.open-meteo.com/v1/climate';

/**
 * Fetch and summarize a city's climate profile from 20 years of historical data.
 *
 * @param {number} lat
 * @param {number} lng
 * @returns {Promise<ClimateProfile | { error: true, message: string }>}
 */
export async function getCityClimate(lat, lng) {
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lng),
    start_date: '2000-01-01',
    end_date: '2020-12-31',
    models: 'EC_Earth3P_HR',
    daily: 'temperature_2m_max,temperature_2m_min,precipitation_sum',
  });

  try {
    const response = await fetch(`${CLIMATE_API_URL}?${params.toString()}`);
    if (!response.ok) {
      return { error: true, message: `Open-Meteo returned ${response.status}` };
    }

    const data = await response.json();
    const maxTemps = data.daily?.temperature_2m_max ?? [];
    const minTemps = data.daily?.temperature_2m_min ?? [];
    const precip = data.daily?.precipitation_sum ?? [];

    if (maxTemps.length === 0) {
      return { error: true, message: 'Open-Meteo returned no climate data for this location' };
    }

    // Filter out nulls
    const validMax = maxTemps.filter(v => v != null);
    const validMin = minTemps.filter(v => v != null);
    const validPrecip = precip.filter(v => v != null);

    const tempMax = Math.max(...validMax);
    const tempMin = Math.min(...validMin);
    const tempMeanMax = validMax.reduce((a, b) => a + b, 0) / validMax.length;
    const tempMeanMin = validMin.reduce((a, b) => a + b, 0) / validMin.length;
    const totalPrecip = validPrecip.reduce((a, b) => a + b, 0);
    const annualPrecipMm = Math.round(totalPrecip / 21); // 21 years

    const biome = classifyBiome({ tempMin, tempMeanMax, annualPrecipMm });
    const label = buildClimateLabel({ tempMin, tempMax, tempMeanMax, annualPrecipMm, biome });

    return {
      tempMin: Math.round(tempMin * 10) / 10,
      tempMax: Math.round(tempMax * 10) / 10,
      tempMeanMin: Math.round(tempMeanMin * 10) / 10,
      tempMeanMax: Math.round(tempMeanMax * 10) / 10,
      annualPrecipMm,
      biome,
      label,
    };
  } catch (err) {
    return { error: true, message: err.message };
  }
}

/**
 * Classify biome from climate stats.
 */
function classifyBiome({ tempMin, tempMeanMax, annualPrecipMm }) {
  if (tempMeanMax < 10) return 'tundra';
  if (tempMin < -20 && annualPrecipMm >= 300 && annualPrecipMm <= 900) return 'boreal-forest';
  if (tempMin > 18 && annualPrecipMm > 2000) return 'tropical-rainforest';
  if (tempMin > 18 && annualPrecipMm >= 500) return 'tropical-savanna';
  if (annualPrecipMm < 250) return 'desert';
  if (tempMin > 0 && annualPrecipMm >= 250 && annualPrecipMm <= 900 && tempMeanMax > 20) return 'mediterranean';
  if (tempMin < -5 && annualPrecipMm >= 250 && annualPrecipMm <= 750) return 'temperate-grassland';
  if (tempMin < 0 && annualPrecipMm >= 600 && annualPrecipMm <= 1500) return 'temperate-deciduous';
  return 'temperate';
}

/**
 * Build a human-readable climate label.
 */
function buildClimateLabel({ tempMin, tempMax, tempMeanMax, annualPrecipMm, biome }) {
  const biomeLabels = {
    'tundra': 'Arctic/Alpine Tundra',
    'boreal-forest': 'Boreal Forest (Taiga)',
    'tropical-rainforest': 'Tropical Rainforest',
    'tropical-savanna': 'Tropical Savanna',
    'desert': 'Desert/Arid',
    'mediterranean': 'Mediterranean',
    'temperate-grassland': 'Temperate Grassland/Steppe',
    'temperate-deciduous': 'Temperate Deciduous Forest',
    'temperate': 'Temperate',
  };
  return biomeLabels[biome] ?? 'Temperate';
}

/**
 * Classify a species' climate compatibility against a city climate profile.
 *
 * Uses broad heuristics based on taxonomy and common name since per-species
 * climate range data isn't available from public APIs without per-species calls.
 *
 * @param {object} species      - species record
 * @param {object} cityClimate  - output of getCityClimate()
 * @returns {{ climateCompatibility: string, climateNote: string }}
 */
export function classifySpeciesClimateCompatibility(species, cityClimate) {
  if (!cityClimate || cityClimate.error) {
    return { climateCompatibility: 'unknown', climateNote: 'No climate data available' };
  }

  const name = (species.commonName ?? species.scientificName ?? '').toLowerCase();
  const iconic = species.iconicTaxonName ?? '';
  const family = species.taxonomy?.family ?? '';
  const kingdom = species.taxonomy?.kingdom ?? '';

  // --- Arctic / polar / tundra species ---
  if (/arctic|polar|tundra|alpine|snow|glacier|permafrost/i.test(name)) {
    if (cityClimate.tempMeanMax > 20) {
      return {
        climateCompatibility: 'incompatible',
        climateNote: `Cold-adapted species — city summers (avg ${cityClimate.tempMeanMax.toFixed(1)}°C) are too warm`,
      };
    }
    return { climateCompatibility: 'compatible', climateNote: 'Cold-adapted species suits this climate' };
  }

  // --- Tropical species (amphibians are highly temperature-sensitive) ---
  if (iconic === 'Amphibia') {
    if (cityClimate.tempMin < -5) {
      return {
        climateCompatibility: 'marginal',
        climateNote: `Most amphibians struggle with hard freezes — city minimum is ${cityClimate.tempMin.toFixed(1)}°C`,
      };
    }
    if (cityClimate.tempMin < -15) {
      return {
        climateCompatibility: 'incompatible',
        climateNote: `Amphibians cannot survive extreme cold — city minimum is ${cityClimate.tempMin.toFixed(1)}°C`,
      };
    }
  }

  // --- Tropical plants (palms, bromeliads, orchids, etc.) ---
  if (/palm|bromeliad|orchid|mango|banana|cacao|tropical/i.test(name) ||
      /Arecaceae|Bromeliaceae|Orchidaceae|Musaceae/i.test(family)) {
    if (cityClimate.tempMin < 0) {
      return {
        climateCompatibility: 'marginal',
        climateNote: `Frost-sensitive tropical plant — city minimum is ${cityClimate.tempMin.toFixed(1)}°C`,
      };
    }
    if (cityClimate.tempMin < -5) {
      return {
        climateCompatibility: 'incompatible',
        climateNote: `Tropical plant cannot survive freezing — city minimum is ${cityClimate.tempMin.toFixed(1)}°C`,
      };
    }
  }

  // --- Desert / xeric species ---
  if (/cactus|cactaceae|agave|succulent|desert|xeric|dryland/i.test(name) ||
      /Cactaceae|Agavaceae|Crassulaceae/i.test(family)) {
    if (cityClimate.annualPrecipMm > 1200) {
      return {
        climateCompatibility: 'marginal',
        climateNote: `Drought-adapted species — city receives ${cityClimate.annualPrecipMm}mm/yr (may be too wet)`,
      };
    }
    return { climateCompatibility: 'compatible', climateNote: 'Drought-tolerant species suits this climate' };
  }

  // --- Aquatic / wetland species need sufficient precipitation ---
  if (/aquatic|wetland|marsh|swamp|riparian|mangrove/i.test(name) ||
      iconic === 'Actinopterygii') {
    if (cityClimate.annualPrecipMm < 300) {
      return {
        climateCompatibility: 'marginal',
        climateNote: `Water-dependent species — city is very dry (${cityClimate.annualPrecipMm}mm/yr)`,
      };
    }
  }

  // Default — most species are broadly adaptable
  return {
    climateCompatibility: 'compatible',
    climateNote: `Generally compatible with ${cityClimate.label} climate`,
  };
}
