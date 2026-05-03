import { SPECIES_BY_ID } from '../data/species.js';
import SpeciesPhoto from './SpeciesPhoto.jsx';

const TROPHIC_LABEL = { producer:'Producer', primary:'Primary', secondary:'Secondary', tertiary:'Apex', decomposer:'Decomposer' };

function RelRow({ sp, placedIds, onSelect, onAdd }) {
  return (
    <div className="rel-row" onClick={() => placedIds.has(sp.id) ? onSelect(sp.id) : onAdd(sp)}>
      <SpeciesPhoto species={sp} className="thumb" />
      <div className="name">{sp.name}</div>
      <div className="arrow">{placedIds.has(sp.id) ? '→ view' : '+ add'}</div>
    </div>
  );
}

export default function SpeciesInfoPanel({ selectedId, placedIds, onSelect, onAdd, speciesRegistry = SPECIES_BY_ID }) {
  if (!selectedId) {
    return (
      <aside className="detail">
        <div className="detail-empty">
          <div className="seal">F.G.</div>
          <h3>The Field Guide</h3>
          <p>An empty page awaits. Drag a specimen from the index onto the canvas to begin building your ecosystem.</p>
          <p>Click any specimen — on the canvas or in the list — to read its entry here, see its predators, and study what it eats.</p>
          <div className="meta">tip · arrows show the<br />direction of energy flow</div>
        </div>
      </aside>
    );
  }

  const s = speciesRegistry[selectedId];
  if (!s) return null;
  const eats = (s.eats || []).map(id => speciesRegistry[id]).filter(Boolean);
  const eatenBy = (s.eatenBy || []).map(id => speciesRegistry[id]).filter(Boolean);

  return (
    <aside className="detail">
      <div className="detail-card">
        <SpeciesPhoto species={s} className="detail-photo" />
        <div className="detail-body">
          <div className="detail-name">{s.name}</div>
          <div className="detail-latin">{s.latin}</div>
          <div className="detail-meta">
            <span className={`tag trophic-${s.trophic}`}>{TROPHIC_LABEL[s.trophic]}</span>
            <span className="tag">{s.kind}</span>
            {(s.env || []).map(e => <span key={e} className="tag">{e}</span>)}
            {(s.climate || []).map(c => <span key={c} className="tag">{c}</span>)}
          </div>
          <div className="detail-blurb">
            {s.blurb || (s.wikipediaUrl
              ? <a href={s.wikipediaUrl} target="_blank" rel="noreferrer" style={{color:'var(--tidal)'}}>Read on Wikipedia ↗</a>
              : <span style={{opacity:0.45}}>No description available.</span>)}
          </div>
          {s.observationCount && (
            <div className="detail-meta" style={{marginTop:6}}>
              <span className="tag">{s.observationCount.toLocaleString()} iNat observations</span>
            </div>
          )}

          <div className="rel-section">
            <div className="rel-title">Eats</div>
            <div className="rel-list">
              {eats.length === 0
                ? <div className="rel-empty">— produces its own energy —</div>
                : eats.map(p => <RelRow key={p.id} sp={p} placedIds={placedIds} onSelect={onSelect} onAdd={onAdd} />)}
            </div>
          </div>

          <div className="rel-section">
            <div className="rel-title">Eaten by</div>
            <div className="rel-list">
              {eatenBy.length === 0
                ? <div className="rel-empty">— no natural predators in this guide —</div>
                : eatenBy.map(p => <RelRow key={p.id} sp={p} placedIds={placedIds} onSelect={onSelect} onAdd={onAdd} />)}
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}
