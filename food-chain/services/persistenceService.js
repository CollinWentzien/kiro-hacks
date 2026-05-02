import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const CITIES_DIR = join(__dirname, '..', 'data', 'cities');

/**
 * Convert a city name to a safe filename slug.
 * e.g. "San Luis Obispo" → "san-luis-obispo"
 *
 * @param {string} city
 * @param {string} [country]
 * @param {string} [state]
 * @returns {string}
 */
export function citySlug(city, country, state) {
  const parts = [city, state, country].filter(Boolean);
  return parts
    .join('-')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Save an ecosystem result to disk as a JSON file.
 * Writes to food-chain/data/cities/{slug}.json
 *
 * @param {string} slug - filename slug (from citySlug())
 * @param {{ region: object, species: Array, savedAt: string }} data
 * @returns {Promise<void>}
 */
export async function saveCityData(slug, data) {
  await mkdir(CITIES_DIR, { recursive: true });
  const filePath = join(CITIES_DIR, `${slug}.json`);
  await writeFile(filePath, JSON.stringify(data, null, 2), 'utf8');
}

/**
 * Load a previously saved ecosystem result from disk.
 * Returns null if the file does not exist.
 *
 * @param {string} slug
 * @returns {Promise<object|null>}
 */
export async function loadCityData(slug) {
  const filePath = join(CITIES_DIR, `${slug}.json`);
  try {
    const raw = await readFile(filePath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/**
 * List all saved city slugs (filenames without .json extension).
 *
 * @returns {Promise<string[]>}
 */
export async function listSavedCities() {
  try {
    const { readdir } = await import('node:fs/promises');
    const files = await readdir(CITIES_DIR);
    return files
      .filter(f => f.endsWith('.json'))
      .map(f => f.replace(/\.json$/, ''));
  } catch {
    return [];
  }
}
