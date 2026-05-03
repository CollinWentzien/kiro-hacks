import { useState, useMemo, useCallback, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { SPECIES_BY_ID } from '../data/species.js';
import SpeciesLibraryPanel from '../components/SpeciesLibraryPanel.jsx';
import EcosystemCanvas, { initialPosition } from '../components/EcosystemCanvas.jsx';
import SpeciesInfoPanel from '../components/SpeciesInfoPanel.jsx';
import HealthScorePanel from '../components/HealthScorePanel.jsx';
import EcosystemChat from '../components/chat/EcosystemChat.jsx';
import ChatToggleButton from '../components/chat/ChatToggleButton.jsx';
import ecosysLogo from '../assets/ecosys-logo.svg';

const MODE_LABELS = { outdoor: 'Outdoor', terrarium: 'Terrarium', aquarium: 'Aquarium' };

export default function EcosystemBuilder({ projects, activeId, onUpdateProject, seedSpecies = [], extraSpecies = [] }) {
  const { id: paramId } = useParams();
  const id = activeId || paramId;
  const project = projects.find(p => p.id === id);

  const [nodes, setNodes] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [chatOpen, setChatOpen] = useState(false);

  // Build profile for the chat coach from current project state
  const chatProfile = useMemo(() => ({
    userId: `project-${id}`,
    location: project?.city || null,
    climateZone: project?.mode === 'outdoor' ? 'temperate' : null,
    placedSpeciesIds: nodes.map(n => n.id),
    preferences: [],
  }), [id, project, nodes]);
  const [draggingSpecies, setDraggingSpecies] = useState(null);
  const [confirmClear, setConfirmClear] = useState(false);

  // Seed canvas when backend species arrive — auto-sorted and auto-fit
  useEffect(() => {
    if (!seedSpecies.length) return;
    const ORDER = { tertiary: 0, secondary: 1, primary: 2, producer: 3, decomposer: 3 };
    const byLevel = {};
    seedSpecies.forEach(s => { (byLevel[s.trophic] = byLevel[s.trophic] || []).push(s); });
    const rows = Object.entries(byLevel).sort((a, b) => ORDER[a[0]] - ORDER[b[0]]);

    const NODE_W = 130, NODE_H = 160, PAD_X = 60, PAD_Y = 80;
    const maxCols = Math.max(...rows.map(([, g]) => g.length));
    const totalW = maxCols * NODE_W + PAD_X * 2;
    const totalH = rows.length * NODE_H + PAD_Y * 2;

    const seeded = [];
    rows.forEach(([, group], ri) => {
      const y = PAD_Y + ri * NODE_H + NODE_H / 2;
      group.forEach((s, ci) => {
        const rowW = group.length * NODE_W;
        const x = (totalW - rowW) / 2 + ci * NODE_W + NODE_W / 2;
        seeded.push({ id: s.id, x, y });
      });
    });
    setNodes(seeded);
    onUpdateProject(id, { speciesCount: seeded.length });
  }, [seedSpecies]); // eslint-disable-line react-hooks/exhaustive-deps

  // Build a registry merging static species + backend-seeded species
  // Build a registry merging static + backend + any dynamically added catalog species
  const [dynamicSpecies, setDynamicSpecies] = useState({});

  const speciesRegistry = useMemo(() => {
    const reg = { ...SPECIES_BY_ID };
    extraSpecies.forEach(s => { reg[s.id] = s; });
    Object.assign(reg, dynamicSpecies);
    return reg;
  }, [extraSpecies, dynamicSpecies]);

  const placedIds = useMemo(() => new Set(nodes.map(n => n.id)), [nodes]);

  const addSpecies = useCallback((species, pos) => {
    // Register species if not already in any registry
    if (!SPECIES_BY_ID[species.id] && !extraSpecies.find(s => s.id === species.id)) {
      setDynamicSpecies(prev => ({ ...prev, [species.id]: species }));
    }
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
          <Link to="/" className="brand-mark" aria-label="EcoSys home">
            <img src={ecosysLogo} alt="EcoSys" className="topbar-logo" />
          </Link>
          <div className="brand-sub">field guide</div>
        </div>
        <div className="meta">
          <span><strong>{project.name}</strong></span>
          <span className="sep">·</span>
          <span><strong>{nodes.length}</strong> species</span>
        </div>
        <div className="actions">
          <Link to="/" className="icon-btn" style={{ textDecoration: 'none' }}>← home</Link>
          {confirmClear ? (
            <span className="confirm-clear">
              <span>clear canvas?</span>
              <button className="icon-btn confirm-yes" onClick={() => { setNodes([]); setSelectedId(null); onUpdateProject(id, { speciesCount: 0 }); setConfirmClear(false); }}>yes</button>
              <button className="icon-btn" onClick={() => setConfirmClear(false)}>no</button>
            </span>
          ) : (
            <button className="icon-btn" onClick={() => setConfirmClear(true)}>clear</button>
          )}
          <button className="icon-btn" disabled title="Save — coming soon"><i className="fa-solid fa-floppy-disk" /> save</button>
        </div>
      </div>

      <SpeciesLibraryPanel
        placedIds={placedIds}
        onDragStart={setDraggingSpecies}
        onAdd={addSpecies}
        extraSpecies={extraSpecies}
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
          speciesRegistry={speciesRegistry}
        />
      </div>

      <SpeciesInfoPanel
        selectedId={selectedId}
        placedIds={placedIds}
        onSelect={setSelectedId}
        onAdd={addSpecies}
        speciesRegistry={speciesRegistry}
      />

      {/* Ecosystem Coach Chat */}
      <ChatToggleButton
        isOpen={chatOpen}
        onClick={() => setChatOpen(o => !o)}
        speciesCount={nodes.length}
      />
      <EcosystemChat
        profile={chatProfile}
        isOpen={chatOpen}
        onClose={() => setChatOpen(false)}
      />

      <div className="corner-mark">— a living index —</div>
    </div>
  );
}
