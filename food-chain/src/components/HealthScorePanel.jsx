import { useMemo } from 'react';
import { SPECIES_BY_ID } from '../data/species.js';

function computeHealth(nodes) {
  if (nodes.length === 0) return { score: 0, status: 'empty', warnings: [] };
  const idSet = new Set(nodes.map(n => n.id));
  const warnings = [];
  let score = 100;

  const hasProducer = nodes.some(n => SPECIES_BY_ID[n.id].trophic === 'producer');
  if (!hasProducer && nodes.length > 1) {
    warnings.push({ kind: 'warning', badge: 'GAP', text: 'No producers — primary consumers will starve.' });
    score -= 25;
  }

  for (const n of nodes) {
    const s = SPECIES_BY_ID[n.id];
    if (s.trophic === 'secondary' || s.trophic === 'tertiary') {
      const hasFood = s.eats.some(p => idSet.has(p));
      if (!hasFood) {
        warnings.push({ kind: 'warning', badge: 'STARVE', text: `${s.name} has no prey present.` });
        score -= 15;
      }
    }
  }

  for (const n of nodes) {
    const s = SPECIES_BY_ID[n.id];
    if (s.trophic === 'secondary' || s.trophic === 'tertiary') {
      const willEat = s.eats.filter(p => idSet.has(p)).map(p => SPECIES_BY_ID[p].name);
      if (willEat.length) {
        warnings.push({ kind: 'warning', badge: 'PREDATION', text: `${s.name} will hunt: ${willEat.join(', ')}.` });
      }
    }
  }

  const climates = new Set();
  nodes.forEach(n => SPECIES_BY_ID[n.id].climate.forEach(c => climates.add(c)));
  if (climates.has('arid') && climates.has('tropical')) {
    warnings.push({ kind: 'info', badge: 'MIX', text: 'Mixing arid and tropical species — verify habitat.' });
    score -= 10;
  }

  const hasDecomposer = nodes.some(n => SPECIES_BY_ID[n.id].trophic === 'decomposer');
  if (!hasDecomposer && nodes.length >= 4) {
    warnings.push({ kind: 'info', badge: 'TIP', text: 'No decomposers — add earthworms or springtails for nutrient cycling.' });
    score -= 5;
  }

  score = Math.max(0, score);
  const status = score >= 75 ? 'healthy' : score >= 45 ? 'developing' : 'unstable';
  return { score, status, warnings: warnings.slice(0, 5) };
}

export default function HealthScorePanel({ nodes }) {
  const { score, status, warnings } = useMemo(() => computeHealth(nodes), [nodes]);

  if (nodes.length === 0) return null;

  return (
    <>
      <div className="health-panel">
        <div>
          <div className="health-score-label">Health Score</div>
          <div className="health-score-num">{score}</div>
        </div>
        <div>
          <div className={`health-score-status ${status}`}>{status}</div>
          <div className="health-score-label">{nodes.length} species</div>
        </div>
      </div>
      {warnings.length > 0 && (
        <div className="warnings">
          {warnings.map((w, i) => (
            <div key={i} className={`warning ${w.kind === 'info' ? 'info' : ''}`}>
              <span className="badge">{w.badge}</span>
              <span>{w.text}</span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
