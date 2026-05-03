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

export default function SpeciesInfoPanel({ selectedId, placedIds, onSelect, onAdd, speciesRegistry = SPECIES_BY_ID, aiResult, aiLoading }) {
  if (aiLoading) {
    return (
      <aside className="detail">
        <div className="detail-empty">
          <div className="seal">✦</div>
          <h3>Analyzing Ecosystem…</h3>
          <p style={{opacity:0.6}}>Consulting the ecological record.</p>
        </div>
      </aside>
    );
  }

  if (aiResult && !selectedId) {
    if (aiResult.error) {
      return (
        <aside className="detail">
          <div className="detail-empty">
            <div className="seal">✕</div>
            <h3>Analysis Failed</h3>
            <p style={{color:'var(--rust)', fontSize:13}}>{aiResult.error}</p>
            <div className="meta" style={{marginTop:16}}>click any species to return to field guide</div>
          </div>
        </aside>
      );
    }
    return (
      <aside className="detail">
        <div className="detail-card">
          <div className="detail-body" style={{padding:'18px 20px'}}>
            <div className="detail-name" style={{marginBottom:6}}>Ecosystem Review</div>
            <div className="detail-blurb" style={{marginBottom:16}}>{aiResult.message}</div>

            {aiResult.recommendations?.length > 0 && (
              <div className="rel-section">
                <div className="rel-title">Add to ecosystem</div>
                <ul style={{margin:'6px 0 0',paddingLeft:18,fontSize:13,lineHeight:1.6}}>
                  {aiResult.recommendations.map((r, i) => <li key={i}>{r}</li>)}
                </ul>
              </div>
            )}

            {aiResult.removals?.length > 0 && (
              <div className="rel-section">
                <div className="rel-title">Consider removing</div>
                <ul style={{margin:'6px 0 0',paddingLeft:18,fontSize:13,lineHeight:1.6}}>
                  {aiResult.removals.map((r, i) => <li key={i}>{r}</li>)}
                </ul>
              </div>
            )}

            {aiResult.nextActions?.length > 0 && (
              <div className="rel-section">
                <div className="rel-title">Next steps</div>
                <ol style={{margin:'6px 0 0',paddingLeft:18,fontSize:13,lineHeight:1.6}}>
                  {aiResult.nextActions.map((a, i) => <li key={i}>{a}</li>)}
                </ol>
              </div>
            )}

            <div className="meta" style={{marginTop:20}}>click any species to return to field guide</div>
          </div>
        </div>
      </aside>
    );
  }

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
