import { useState } from 'react';
import { SPECIES } from '../data/species.js';

const ENVS = ['backyard','terrarium','freshwater','saltwater','pond'];
const CLIMATES = ['temperate','tropical','arid'];
const KINDS = ['plant','invertebrate','fish','amphibian','reptile','bird','mammal'];
const TROPHIC_LABEL = { producer:'Producer', primary:'Primary', secondary:'Secondary', tertiary:'Apex', decomposer:'Decomposer' };

export default function SpeciesLibraryPanel({ placedIds, onDragStart, onAdd }) {
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState({ envs: [], climates: [], kinds: [] });

  const toggle = (key, val) => setFilters(f => {
    const s = new Set(f[key]);
    s.has(val) ? s.delete(val) : s.add(val);
    return { ...f, [key]: [...s] };
  });

  const filtered = SPECIES.filter(s => {
    if (filters.envs.length && !filters.envs.some(e => s.env.includes(e))) return false;
    if (filters.climates.length && !filters.climates.some(c => s.climate.includes(c))) return false;
    if (filters.kinds.length && !filters.kinds.includes(s.kind)) return false;
    if (query) {
      const q = query.toLowerCase();
      if (!s.name.toLowerCase().includes(q) && !s.latin.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  return (
    <aside className="sidebar">
      <div className="sidebar-head">
        <div className="sidebar-title">Specimens</div>
        <div className="sidebar-sub">drag onto canvas · {filtered.length} of {SPECIES.length}</div>
      </div>
      <div className="filter-group">
        <div className="filter-label">Search</div>
        <input className="search-input" placeholder="by common or latin name…"
          value={query} onChange={e => setQuery(e.target.value)} />
      </div>
      <div className="filter-group">
        <div className="filter-label">Environment</div>
        <div className="chip-row">
          {ENVS.map(e => (
            <button key={e} className={`chip ${filters.envs.includes(e) ? 'active' : ''}`}
              onClick={() => toggle('envs', e)}>{e}</button>
          ))}
        </div>
      </div>
      <div className="filter-group">
        <div className="filter-label">Climate</div>
        <div className="chip-row">
          {CLIMATES.map(c => (
            <button key={c} className={`chip ${filters.climates.includes(c) ? 'active' : ''}`}
              onClick={() => toggle('climates', c)}>{c}</button>
          ))}
        </div>
      </div>
      <div className="filter-group">
        <div className="filter-label">Kingdom</div>
        <div className="chip-row">
          {KINDS.map(k => (
            <button key={k} className={`chip ${filters.kinds.includes(k) ? 'active' : ''}`}
              onClick={() => toggle('kinds', k)}>{k}</button>
          ))}
        </div>
      </div>
      <div className="species-list">
        {filtered.map(s => (
          <div key={s.id}
            className={`species-card ${placedIds.has(s.id) ? 'placed' : ''}`}
            draggable={!placedIds.has(s.id)}
            onDragStart={e => onDragStart(e, s)}
            onDoubleClick={() => !placedIds.has(s.id) && onAdd(s)}
            title="drag to canvas or double-click">
            <div className="species-thumb" style={{ backgroundImage: `url(${s.img})` }} />
            <div className="species-info">
              <div className="species-name">{s.name}</div>
              <div className="species-latin">{s.latin}</div>
              <div className="species-tags">
                <span className={`tag trophic-${s.trophic}`}>{TROPHIC_LABEL[s.trophic]}</span>
                <span className="tag">{s.kind}</span>
              </div>
            </div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div style={{ padding: '24px 12px', fontFamily: 'var(--serif)', fontStyle: 'italic', color: 'var(--ink-fade)', fontSize: 14 }}>
            no specimens match these filters.
          </div>
        )}
      </div>
    </aside>
  );
}
