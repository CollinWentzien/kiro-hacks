import { useState, useMemo, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { SPECIES_BY_ID } from '../data/species.js';
import SpeciesLibraryPanel from '../components/SpeciesLibraryPanel.jsx';
import EcosystemCanvas, { initialPosition } from '../components/EcosystemCanvas.jsx';
import SpeciesInfoPanel from '../components/SpeciesInfoPanel.jsx';
import HealthScorePanel from '../components/HealthScorePanel.jsx';

const MODE_LABELS = { outdoor: 'Outdoor', terrarium: 'Terrarium', aquarium: 'Aquarium' };

export default function EcosystemBuilder({ projects, activeId, onUpdateProject }) {
  const { id: paramId } = useParams();
  const id = activeId || paramId;
  const project = projects.find(p => p.id === id);

  const [nodes, setNodes] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [draggingSpecies, setDraggingSpecies] = useState(null);

  const placedIds = useMemo(() => new Set(nodes.map(n => n.id)), [nodes]);

  const addSpecies = useCallback((species, pos) => {
    setNodes(ns => {
      if (ns.some(n => n.id === species.id)) return ns;
      const canvasEl = document.querySelector('.canvas');
      const rect = canvasEl ? canvasEl.getBoundingClientRect() : { width: 800, height: 600 };
      const p = pos || initialPosition(species, ns, rect.width, rect.height);
      const updated = [...ns, { id: species.id, x: p.x, y: p.y }];
      onUpdateProject(id, { speciesCount: updated.length });
      return updated;
    });
    setSelectedId(species.id);
  }, [id, onUpdateProject]);

  const removeNode = useCallback((nodeId) => {
    setNodes(ns => {
      const updated = ns.filter(n => n.id !== nodeId);
      onUpdateProject(id, { speciesCount: updated.length });
      return updated;
    });
    setSelectedId(s => s === nodeId ? null : s);
  }, [id, onUpdateProject]);

  if (!project) {
    return (
      <div className="paper-bg" style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: 22, color: 'var(--ink-fade)' }}>
          Project not found. <Link to="/" style={{ color: 'var(--tidal)' }}>← Start over</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="app paper-bg">
      <div className="topbar">
        <div className="brand">
          <Link to="/" className="brand-mark">Food Chain</Link>
          <div className="brand-sub">field guide</div>
        </div>
        <div className="meta">
          <span><strong>{project.name}</strong></span>
          <span className="sep">·</span>
          <span>{MODE_LABELS[project.mode]}{project.city ? ` · ${project.city}` : ''}</span>
          <span className="sep">·</span>
          <span><strong>{nodes.length}</strong> species</span>
        </div>
        <div className="actions">
          <Link to="/" className="icon-btn" style={{ textDecoration: 'none' }}>← home</Link>
          <button className="icon-btn" onClick={() => { setNodes([]); setSelectedId(null); onUpdateProject(id, { speciesCount: 0 }); }}>
            clear
          </button>
        </div>
      </div>

      <SpeciesLibraryPanel
        placedIds={placedIds}
        onDragStart={setDraggingSpecies}
        onAdd={addSpecies}
      />

      <div style={{ position: 'relative', height: '100%' }}>
        <EcosystemCanvas
          nodes={nodes}
          setNodes={setNodes}
          selectedId={selectedId}
          setSelectedId={setSelectedId}
          onAdd={addSpecies}
          onRemove={removeNode}
          draggingSpecies={draggingSpecies}
          setDraggingSpecies={setDraggingSpecies}
        />
        <HealthScorePanel nodes={nodes} />
      </div>

      <SpeciesInfoPanel
        selectedId={selectedId}
        placedIds={placedIds}
        onSelect={setSelectedId}
        onAdd={addSpecies}
      />

      <div className="corner-mark">— a living index —</div>
    </div>
  );
}
