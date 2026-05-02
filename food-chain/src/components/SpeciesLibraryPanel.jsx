import { useState, useEffect } from 'react';
import { SPECIES } from '../data/species.js';
import SpeciesPhoto from './SpeciesPhoto.jsx';

const TROPHIC_LABEL = { producer:'Producer', primary:'Primary', secondary:'Secondary', tertiary:'Apex', decomposer:'Decomposer' };

const FILTER_GROUPS = [
  { label: 'Type',    key: 'kind',    options: ['plant','fish','bird','mammal','invertebrate','amphibian','reptile'] },
  { label: 'Climate', key: 'climate', options: ['temperate','tropical','arid'] },
  { label: 'Habitat', key: 'env',     options: ['backyard','terrarium','freshwater','saltwater','pond'] },
];

function DragGhost({ species, pos }) {
  if (!species || !pos) return null;
  return (
    <div style={{
      position: 'fixed', left: pos.x - 30, top: pos.y - 30,
      width: 60, height: 60, borderRadius: 'var(--r-sm)',
      overflow: 'hidden', border: '2px solid var(--tidal)',
      boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
      pointerEvents: 'none', zIndex: 9999, opacity: 0.9,
    }}>
      <img src={species.img} alt={species.name}
        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
        onError={e => { e.target.src = species.fallback; }}
      />
    </div>
  );
}

export default function SpeciesLibraryPanel({ placedIds, onDragStart, onAdd }) {
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState('all');
  const [active, setActive] = useState({});
  const [ghostPos, setGhostPos] = useState(null);
  const [ghostSpecies, setGhostSpecies] = useState(null);

  const toggle = (group, val) => setActive(prev => {
    const cur = new Set(prev[group] || []);
    cur.has(val) ? cur.delete(val) : cur.add(val);
    return { ...prev, [group]: [...cur] };
  });

  const activeCount = Object.values(active).reduce((n, a) => n + (Array.isArray(a) ? a.length : (a ? 1 : 0)), 0);
  const switchTab = (id) => { if (id === 'all') setActive({}); setTab(id); };

  const startDrag = (e, species) => {
    if (placedIds.has(species.id)) return;
    e.preventDefault();
    e.stopPropagation();
    setGhostSpecies(species);
    setGhostPos({ x: e.clientX, y: e.clientY });
    onDragStart(species);

    const onMove = (ev) => { ev.preventDefault(); setGhostPos({ x: ev.clientX, y: ev.clientY }); };
    const onUp = () => {
      setGhostSpecies(null);
      setGhostPos(null);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  };

  const filtered = SPECIES.filter(s => {
    if (tab === 'compatible') return false; // TODO: backend compatibility logic
    if (active.compatible) return false;    // TODO: backend compatibility logic
    if (query) {
      const q = query.toLowerCase();
      if (!s.name.toLowerCase().includes(q) && !s.latin.toLowerCase().includes(q)) return false;
    }
    for (const { key } of FILTER_GROUPS) {
      const sel = active[key] || [];
      if (!sel.length) continue;
      const val = key === 'kind' ? [s.kind] : s[key];
      if (!sel.some(v => val.includes(v))) return false;
    }
    return true;
  });

  return (
    <aside className="sidebar">
      <DragGhost species={ghostSpecies} pos={ghostPos} />
      <div className="sidebar-search-row">
        <input
          className="search-input"
          placeholder="search specimens…"
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
      </div>

      <div className="sidebar-tabs">
        {[
          { id: 'all',        label: 'All' },
          { id: 'compatible', label: 'Compatible' },
          { id: 'filters',    label: `More Filters${activeCount ? ` (${activeCount})` : ''}` },
        ].map(t => (
          <button
            key={t.id}
            className={`sidebar-tab ${tab === t.id ? 'active' : ''}`}
            onClick={() => switchTab(t.id)}
          >{t.label}</button>
        ))}
      </div>

      {tab === 'filters' && (
        <div className="filter-dropdown">
          {FILTER_GROUPS.map(({ label, key, options }) => (
            <div key={key} className="filter-section">
              <div className="filter-section-label">{label}</div>
              <div className="chip-row">
                {options.map(opt => (
                  <button
                    key={opt}
                    className={`chip ${(active[key] || []).includes(opt) ? 'active' : ''}`}
                    onClick={() => toggle(key, opt)}
                  >{opt}</button>
                ))}
              </div>
            </div>
          ))}
          <div className="filter-section">
            <div className="filter-section-label">Compatibility</div>
            <div className="chip-row">
              <button
                className={`chip ${active.compatible ? 'active' : ''}`}
                onClick={() => setActive(prev => ({ ...prev, compatible: !prev.compatible }))}
              >compatible only</button>
            </div>
          </div>
          {activeCount > 0 && (
            <button className="filter-clear" onClick={() => setActive({})}>clear all</button>
          )}
        </div>
      )}

      <div className="sidebar-count">{filtered.length} specimen{filtered.length !== 1 ? 's' : ''}</div>

      <div className="species-list">
        {filtered.map(s => (
          <div
            key={s.id}
            className={`species-card ${placedIds.has(s.id) ? 'placed' : ''}`}
            onPointerDown={e => startDrag(e, s)}
            onDoubleClick={() => !placedIds.has(s.id) && onAdd(s)}
            title={placedIds.has(s.id) ? 'on canvas' : 'drag or double-click to add'}
            style={{ cursor: placedIds.has(s.id) ? 'default' : 'grab' }}
          >
            <SpeciesPhoto species={s} className="species-thumb" />
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
            {tab === 'compatible'
            ? 'add species to your ecosystem to see compatible suggestions.'
            : 'no specimens match.'}
          </div>
        )}
      </div>
    </aside>
  );
}
