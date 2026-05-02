/**
 * Merge observed species records with nativity and enrichment data.
 *
 * @param {Array} observedList - Array of observed species records
 * @param {Map} nativityMap - Map<lowerScientificName, nativity>
 * @param {Map} enrichmentMap - Map<lowerScientificName, enrichment>
 * @returns {Array} Array of merged species records
 */
export function mergeSpeciesRecords(observedList, nativityMap, enrichmentMap) {
  return observedList.map(obs =>
    buildFinalSpeciesRecord(
      obs,
      nativityMap.get(obs.scientificName.trim().toLowerCase()),
      enrichmentMap.get(obs.scientificName.trim().toLowerCase())
    )
  );
}

/**
 * Build a final species record by combining observed, nativity, and enrichment data.
 *
 * @param {object} observed - Observed species record
 * @param {object|undefined} nativity - Nativity data (may be undefined)
 * @param {object|undefined} enrichment - Enrichment data (may be undefined)
 * @returns {object} Final species record
 */
export function buildFinalSpeciesRecord(observed, nativity, enrichment) {
  const sources = new Set(observed.sources ?? []);
  if (nativity?.sources) nativity.sources.forEach(s => sources.add(s));
  if (enrichment?.sources) enrichment.sources.forEach(s => sources.add(s));

  return {
    scientificName: observed.scientificName,
    // Prefer enrichment data, fall back to what came directly from iNaturalist species_counts
    commonName: enrichment?.commonName ?? observed.commonName ?? null,
    category: observed.category,
    nativeStatus: nativity?.nativeStatus ?? 'unknown',
    confidence: nativity?.confidence ?? 'unknown',
    observedNearby: observed.observedNearby ?? true,
    photoUrl: enrichment?.photoUrl ?? observed.photoUrl ?? null,
    taxonomy: enrichment?.taxonomy ?? null,
    observationSummary: enrichment?.observationSummary ?? (observed.observationCount ? `${observed.observationCount.toLocaleString()} observations` : null),
    sourceLinks: enrichment?.sourceLinks ?? [],
    sources: [...sources],
  };
}
