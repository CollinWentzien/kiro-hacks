import { useMemo } from 'react';
import { SPECIES_BY_ID } from '../data/species.js';

const TROPHIC_ORDER = ['producer', 'primary', 'secondary', 'tertiary', 'decomposer'];
const TROPHIC_LABEL = { producer: 'Producers', primary: 'Primary', secondary: 'Secondary', tertiary: 'Apex', decomposer: 'Decomposers' };
const TROPHIC_COLOR = { producer: 'var(--sage)', primary: 'var(--mustard)', secondary: 'var(--rust)', tertiary: 'var(--ink)', decomposer: 'var(--ink-fade)' };

function computeHealth(nodes, reg) {
  if (nodes.length === 0) return null;
  const idSet = new Set(nodes.map(n => n.id));
  const warnings = [];
  let score = 100;

  const hasProducer = nodes.some(n => reg[n.id]?.trophic === 'producer');
  const allSeeded = nodes.every(n => reg[n.id]?._fromBackend || reg[n.id]?._fromCatalog);
  if (!hasProducer && nodes.length > 1 && !allSeeded) {
    warnings.push({ badge: 'GAP', text: 'No producers — primary consumers will starve.' });
    score -= 25;
  }

  for (const n of nodes) {
    const s = reg[n.id];
    if (!s) continue;
    if (s._fromBackend || s._fromCatalog) continue; // seeded species — skip prey warnings
    if ((s.trophic === 'secondary' || s.trophic === 'tertiary') && !s.eats.some(p => idSet.has(p))) {
      warnings.push({ badge: 'STARVE', text: `${s.name} has no prey present.` });
      score -= 15;
    }
  }

  const climates = new Set();
  nodes.forEach(n => reg[n.id]?.climate?.forEach(c => climates.add(c)));
  if (climates.has('arid') && climates.has('tropical')) {
    warnings.push({ badge: 'HABITAT', text: 'Mixing arid and tropical species.' });
    score -= 10;
  }

  score = Math.max(0, score);
  const status = score >= 75 ? 'healthy' : score >= 45 ? 'developing' : 'unstable';

  const byTrophic = {};
  for (const t of TROPHIC_ORDER) byTrophic[t] = nodes.filter(n => reg[n.id]?.trophic === t).length;

  let edges = 0;
  for (const n of nodes) {
    edges += (reg[n.id]?.eats || []).filter(id => idSet.has(id)).length;
  }

  return { score, status, warnings, byTrophic, edges, total: nodes.length };
}

export default function HealthScorePanel({ nodes, speciesRegistry = SPECIES_BY_ID, onImprove, groqScore }) {
  const data = useMemo(() => computeHealth(nodes, speciesRegistry), [nodes, speciesRegistry]);
  if (!data) return null;

  const { status: localStatus, warnings, byTrophic, edges, total } = data;
  // Use Groq score if available, otherwise show pending state
  const score = groqScore;
  const arcPct = groqScore != null ? groqScore / 100 : 0;
  const status = groqScore != null
    ? (groqScore >= 75 ? 'healthy' : groqScore >= 45 ? 'developing' : 'unstable')
    : localStatus;
  const arc = (pct) => {
    const r = 28, cx = 36, cy = 36;
    const angle = pct * 2 * Math.PI - Math.PI / 2;
    const x = cx + r * Math.cos(angle), y = cy + r * Math.sin(angle);
    const large = pct > 0.5 ? 1 : 0;
    return pct >= 1
      ? `M ${cx} ${cy - r} A ${r} ${r} 0 1 1 ${cx - 0.01} ${cy - r}`
      : `M ${cx} ${cy - r} A ${r} ${r} 0 ${large} 1 ${x} ${y}`;
  };

  const statusColor = { healthy: 'var(--sage-dark)', developing: 'var(--mustard)', unstable: 'var(--rust)' }[status];

  return (
    <div className="health-panel-v2">
      <div className="hp-main-row">
        {/* Score ring */}
        <div className="hp-ring-wrap">
          <svg width="72" height="72">
            <circle cx="36" cy="36" r="28" fill="none" stroke="var(--rule)" strokeWidth="5" />
            <path d={arc(arcPct)} fill="none" stroke={statusColor} strokeWidth="5" strokeLinecap="round" />
          </svg>
          <div className="hp-ring-num" style={{ color: statusColor, transform: 'translateY(-2px)' }}>
            {groqScore != null ? groqScore : '--'}
          </div>
        </div>

        {/* Stats column */}
        <div className="hp-stats">
          <div className="hp-status" style={{ color: statusColor }}>{status}</div>
          <div className="hp-stat-row">
            <span className="hp-stat-val">{total}</span>
            <span className="hp-stat-lbl">species</span>
            <span className="hp-stat-val" style={{ marginLeft: 10 }}>{edges}</span>
            <span className="hp-stat-lbl">links</span>
          </div>
          <div className="hp-trophic-bar">
            {TROPHIC_ORDER.filter(t => byTrophic[t] > 0).map(t => (
              <div key={t} title={`${TROPHIC_LABEL[t]}: ${byTrophic[t]}`}
                style={{ flex: byTrophic[t], background: TROPHIC_COLOR[t], height: '100%', borderRadius: 2 }} />
            ))}
          </div>
          <div className="hp-trophic-legend">
            {TROPHIC_ORDER.filter(t => byTrophic[t] > 0).map(t => (
              <span key={t} className="hp-trophic-item">
                <span style={{ background: TROPHIC_COLOR[t] }} className="hp-trophic-dot" />
                {byTrophic[t]} {TROPHIC_LABEL[t]}
              </span>
            ))}
          </div>
        </div>

        {/* Action button */}
        <div className="hp-actions">
          <button className="hp-action-btn" onClick={() => onImprove?.(data)}>
            <i className="fa-solid fa-wand-magic-sparkles" />
            <span>Improve<br/>Ecosystem</span>
          </button>
        </div>
      </div>

      {/* Warnings row */}
      {warnings.length > 0 && (
        <div className="hp-warnings-row">
          {warnings.map((w, i) => (
            <div key={i} className="hp-warning">
              <i className="fa-solid fa-triangle-exclamation" style={{ color: 'var(--rust)', fontSize: 10, flexShrink: 0 }} />
              <span className="hp-badge">{w.badge}</span>
              <span>{w.text}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
