// Main app — Food Chain
const { useState, useEffect, useRef, useMemo, useCallback } = React;

const ENVS = [
  { id: "backyard", label: "Backyard" },
  { id: "terrarium", label: "Terrarium" },
  { id: "freshwater", label: "Freshwater" },
  { id: "saltwater", label: "Saltwater" },
  { id: "pond", label: "Pond" },
];
const CLIMATES = [
  { id: "temperate", label: "Temperate" },
  { id: "tropical", label: "Tropical" },
  { id: "arid", label: "Arid" },
];
const KINDS = ["plant", "invertebrate", "fish", "amphibian", "reptile", "bird", "mammal"];

const TROPHIC_LABEL = {
  producer: "Producer",
  primary: "Primary",
  secondary: "Secondary",
  tertiary: "Apex",
  decomposer: "Decomposer",
};

// Smart initial layout: producers low, predators high
function initialPosition(species, existing, canvasW, canvasH) {
  const yByTrophic = {
    producer: 0.85,
    decomposer: 0.85,
    primary: 0.62,
    secondary: 0.38,
    tertiary: 0.15,
  };
  const baseY = (yByTrophic[species.trophic] ?? 0.5) * canvasH;
  // distribute x: pick least-crowded slot at this y
  const sameRow = existing.filter(n => Math.abs(n.y - baseY) < 80);
  const cols = Math.max(4, Math.floor(canvasW / 160));
  let bestX = canvasW / 2;
  let bestDist = -1;
  for (let i = 0; i < cols; i++) {
    const x = (i + 0.5) * (canvasW / cols);
    const minDist = sameRow.length === 0 ? Infinity : Math.min(...sameRow.map(n => Math.abs(n.x - x)));
    if (minDist > bestDist) { bestDist = minDist; bestX = x; }
  }
  return {
    x: bestX + (Math.random() - 0.5) * 30,
    y: baseY + (Math.random() - 0.5) * 30,
  };
}

function Topbar({ placedCount, onClear }) {
  return (
    <div className="topbar">
      <div className="brand">
        <div className="brand-mark">Food Chain</div>
        <div className="brand-sub">— a field guide to ecosystems</div>
      </div>
      <div className="meta">
        <span><strong>{placedCount}</strong>&nbsp;species on canvas</span>
        <span>vol. I · spring '26</span>
      </div>
      <div className="actions">
        <button className="icon-btn" onClick={onClear}>Clear canvas</button>
      </div>
    </div>
  );
}

function Sidebar({ species, placedIds, filters, setFilters, onDragStart, onAdd, query, setQuery }) {
  const toggle = (key, val) => {
    setFilters(f => {
      const set = new Set(f[key]);
      if (set.has(val)) set.delete(val); else set.add(val);
      return { ...f, [key]: [...set] };
    });
  };

  const filtered = species.filter(s => {
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
        <div className="sidebar-sub">drag onto canvas · {filtered.length} of {species.length}</div>
      </div>
      <div className="filter-group">
        <div className="filter-label">Search</div>
        <input
          className="search-input"
          placeholder="by common or latin name…"
          value={query}
          onChange={e => setQuery(e.target.value)}
        />
      </div>
      <div className="filter-group">
        <div className="filter-label">Environment</div>
        <div className="chip-row">
          {ENVS.map(e => (
            <button
              key={e.id}
              className={`chip ${filters.envs.includes(e.id) ? "active" : ""}`}
              onClick={() => toggle("envs", e.id)}
            >{e.label}</button>
          ))}
        </div>
      </div>
      <div className="filter-group">
        <div className="filter-label">Climate</div>
        <div className="chip-row">
          {CLIMATES.map(c => (
            <button
              key={c.id}
              className={`chip ${filters.climates.includes(c.id) ? "active" : ""}`}
              onClick={() => toggle("climates", c.id)}
            >{c.label}</button>
          ))}
        </div>
      </div>
      <div className="filter-group">
        <div className="filter-label">Kingdom</div>
        <div className="chip-row">
          {KINDS.map(k => (
            <button
              key={k}
              className={`chip ${filters.kinds.includes(k) ? "active" : ""}`}
              onClick={() => toggle("kinds", k)}
            >{k}</button>
          ))}
        </div>
      </div>
      <div className="species-list">
        {filtered.map(s => (
          <div
            key={s.id}
            className={`species-card ${placedIds.has(s.id) ? "placed" : ""}`}
            draggable={!placedIds.has(s.id)}
            onDragStart={e => onDragStart(e, s)}
            onDoubleClick={() => !placedIds.has(s.id) && onAdd(s)}
            title="drag to canvas (or double-click)"
          >
            <div
              className="species-thumb"
              style={{ backgroundImage: `url(${s.img})` }}
            />
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
          <div style={{padding: '24px 12px', fontFamily: 'var(--serif)', fontStyle: 'italic', color: 'var(--ink-fade)', fontSize: 14}}>
            no specimens match these filters.
          </div>
        )}
      </div>
    </aside>
  );
}

function Canvas({ nodes, setNodes, selectedId, setSelectedId, onAdd, onRemove }) {
  const canvasRef = useRef(null);
  const [size, setSize] = useState({ w: 800, h: 600 });
  const [dragOver, setDragOver] = useState(false);
  const [draggingNode, setDraggingNode] = useState(null); // { id, offsetX, offsetY }

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        setSize({ w: entry.contentRect.width, h: entry.contentRect.height });
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const onCanvasDragOver = (e) => {
    e.preventDefault();
    setDragOver(true);
  };
  const onCanvasDragLeave = (e) => {
    if (e.target === canvasRef.current) setDragOver(false);
  };
  const onCanvasDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const id = e.dataTransfer.getData("species/id");
    if (!id) return;
    const species = window.SPECIES_BY_ID[id];
    if (!species) return;
    const rect = canvasRef.current.getBoundingClientRect();
    onAdd(species, { x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  // Node dragging
  const onNodePointerDown = (e, node) => {
    e.stopPropagation();
    const rect = canvasRef.current.getBoundingClientRect();
    setDraggingNode({
      id: node.id,
      offsetX: e.clientX - rect.left - node.x,
      offsetY: e.clientY - rect.top - node.y,
    });
    setSelectedId(node.id);
  };
  useEffect(() => {
    if (!draggingNode) return;
    const onMove = (e) => {
      const rect = canvasRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left - draggingNode.offsetX;
      const y = e.clientY - rect.top - draggingNode.offsetY;
      setNodes(ns => ns.map(n => n.id === draggingNode.id ? { ...n, x, y } : n));
    };
    const onUp = () => setDraggingNode(null);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, [draggingNode, setNodes]);

  // Compute edges between currently placed species
  const edges = useMemo(() => {
    const idSet = new Set(nodes.map(n => n.id));
    const list = [];
    for (const n of nodes) {
      const s = window.SPECIES_BY_ID[n.id];
      for (const preyId of s.eats) {
        if (idSet.has(preyId)) list.push({ from: preyId, to: n.id }); // energy flows prey -> predator
      }
    }
    return list;
  }, [nodes]);

  const nodePos = useMemo(() => Object.fromEntries(nodes.map(n => [n.id, n])), [nodes]);

  // Highlight set
  const relIds = useMemo(() => {
    if (!selectedId) return null;
    const s = window.SPECIES_BY_ID[selectedId];
    const rel = new Set([selectedId]);
    s.eats.forEach(i => rel.add(i));
    s.eatenBy.forEach(i => rel.add(i));
    return rel;
  }, [selectedId]);

  // Warnings
  const warnings = useMemo(() => {
    const out = [];
    const idSet = new Set(nodes.map(n => n.id));
    if (nodes.length === 0) return out;
    // No producers
    const hasProducer = nodes.some(n => window.SPECIES_BY_ID[n.id].trophic === "producer");
    if (!hasProducer && nodes.length > 1) {
      out.push({ kind: "warning", badge: "GAP", text: "No producers — primary consumers will starve." });
    }
    // Predator without prey
    for (const n of nodes) {
      const s = window.SPECIES_BY_ID[n.id];
      if (s.trophic === "secondary" || s.trophic === "tertiary") {
        const hasFood = s.eats.some(p => idSet.has(p));
        if (!hasFood) out.push({ kind: "warning", badge: "STARVE", text: `${s.name} has no prey present.` });
      }
    }
    // Will eat its tankmate
    for (const n of nodes) {
      const s = window.SPECIES_BY_ID[n.id];
      const willEat = s.eats.filter(p => idSet.has(p)).map(p => window.SPECIES_BY_ID[p].name);
      if (willEat.length && (s.trophic === "secondary" || s.trophic === "tertiary")) {
        out.push({ kind: "warning", badge: "PREDATION", text: `${s.name} will hunt: ${willEat.join(", ")}.` });
      }
    }
    // Climate mismatch
    const climates = new Set();
    nodes.forEach(n => window.SPECIES_BY_ID[n.id].climate.forEach(c => climates.add(c)));
    if (climates.has("arid") && climates.has("tropical")) {
      out.push({ kind: "info", badge: "MIX", text: "Mixing arid and tropical species — verify habitat." });
    }
    return out.slice(0, 4);
  }, [nodes]);

  return (
    <div className="canvas-wrap">
      <div
        ref={canvasRef}
        className={`canvas ${dragOver ? "drag-over" : ""}`}
        onDragOver={onCanvasDragOver}
        onDragLeave={onCanvasDragLeave}
        onDrop={onCanvasDrop}
        onClick={() => setSelectedId(null)}
      >
        <div className="canvas-overlay-text canvas-title">My Ecosystem</div>

        {nodes.length === 0 && (
          <div className="canvas-empty">
            <svg className="arrow" viewBox="0 0 80 60" fill="none">
              <path d="M70 30 Q40 10 12 35" stroke="currentColor" strokeWidth="1.2" opacity="0.5"/>
              <path d="M18 28 L10 36 L20 40" stroke="currentColor" strokeWidth="1.2" fill="none" opacity="0.5"/>
            </svg>
            <div className="hand">drag a specimen here</div>
            <div className="sub">— or double-click —</div>
          </div>
        )}

        <svg className="edges-svg" width={size.w} height={size.h}>
          <defs>
            <marker id="arrowhead" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
              <path d="M0,0 L8,4 L0,8 z" fill="var(--ink-soft)" />
            </marker>
            <marker id="arrowhead-hl" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
              <path d="M0,0 L8,4 L0,8 z" fill="var(--rust)" />
            </marker>
          </defs>
          {edges.map((e, i) => {
            const a = nodePos[e.from];
            const b = nodePos[e.to];
            if (!a || !b) return null;
            const dx = b.x - a.x, dy = b.y - a.y;
            const len = Math.sqrt(dx*dx + dy*dy);
            if (len === 0) return null;
            const nx = dx/len, ny = dy/len;
            const startX = a.x + nx * 44;
            const startY = a.y + ny * 44;
            const endX = b.x - nx * 50;
            const endY = b.y - ny * 50;
            const mx = (startX + endX) / 2 - ny * 18;
            const my = (startY + endY) / 2 + nx * 18;
            const highlighted = selectedId && (e.from === selectedId || e.to === selectedId);
            const dimmed = selectedId && !highlighted;
            return (
              <path
                key={`${e.from}-${e.to}-${i}`}
                d={`M ${startX} ${startY} Q ${mx} ${my} ${endX} ${endY}`}
                className={`edge-line ${highlighted ? "highlight" : ""} ${dimmed ? "dim" : ""}`}
                markerEnd={highlighted ? "url(#arrowhead-hl)" : "url(#arrowhead)"}
              />
            );
          })}
        </svg>

        {nodes.map(n => {
          const s = window.SPECIES_BY_ID[n.id];
          const dimmed = relIds && !relIds.has(n.id);
          return (
            <div
              key={n.id}
              className={`node ${selectedId === n.id ? "selected" : ""} ${dimmed ? "dimmed" : ""} ${draggingNode?.id === n.id ? "dragging" : ""}`}
              style={{ left: n.x, top: n.y }}
              onPointerDown={e => onNodePointerDown(e, n)}
              onClick={e => { e.stopPropagation(); setSelectedId(n.id); }}
            >
              <div className="node-photo" style={{ backgroundImage: `url(${s.img})` }}>
                <div className={`node-trophic-dot ${s.trophic}`} />
              </div>
              <div
                className="node-remove"
                onPointerDown={e => e.stopPropagation()}
                onClick={e => { e.stopPropagation(); onRemove(n.id); }}
                title="remove"
              >×</div>
              <div className="node-label">{s.name}</div>
              <div className="node-latin">{s.latin}</div>
            </div>
          );
        })}

        {nodes.length > 0 && (
          <div className="legend">
            <div className="legend-item"><span className="legend-dot" style={{background: 'var(--sage)'}}/>Producer</div>
            <div className="legend-item"><span className="legend-dot" style={{background: 'var(--mustard)'}}/>Primary</div>
            <div className="legend-item"><span className="legend-dot" style={{background: 'var(--rust)'}}/>Secondary</div>
            <div className="legend-item"><span className="legend-dot" style={{background: 'var(--ink)'}}/>Apex</div>
            <div className="legend-item">→ eaten by</div>
          </div>
        )}

        {warnings.length > 0 && (
          <div className="warnings">
            {warnings.map((w, i) => (
              <div key={i} className={`warning ${w.kind === "info" ? "info" : ""}`}>
                <span className="badge">{w.badge}</span>
                <span>{w.text}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Detail({ selectedId, placedIds, onSelect, onAdd }) {
  if (!selectedId) {
    return (
      <aside className="detail">
        <div className="detail-empty">
          <div className="seal">F.G.</div>
          <h3>The Field Guide</h3>
          <p>An empty page awaits. Drag a specimen from the index onto the canvas to begin building your ecosystem.</p>
          <p>Click any specimen — on the canvas or in the list — to read its entry here, see its predators, and study what it eats.</p>
          <div className="meta">
            tip · arrows show the<br/>direction of energy flow
          </div>
        </div>
      </aside>
    );
  }
  const s = window.SPECIES_BY_ID[selectedId];
  const eats = s.eats.map(id => window.SPECIES_BY_ID[id]).filter(Boolean);
  const eatenBy = s.eatenBy.map(id => window.SPECIES_BY_ID[id]).filter(Boolean);

  const RelRow = ({ sp }) => (
    <div className="rel-row" onClick={() => {
      if (placedIds.has(sp.id)) onSelect(sp.id);
      else onAdd(sp);
    }}>
      <div className="thumb" style={{ backgroundImage: `url(${sp.img})` }} />
      <div className="name">{sp.name}</div>
      <div className="arrow">{placedIds.has(sp.id) ? "→ view" : "+ add"}</div>
    </div>
  );

  return (
    <aside className="detail">
      <div className="detail-card">
        <div className="detail-photo" style={{ backgroundImage: `url(${s.img})` }} />
        <div className="detail-body">
          <div className="detail-name">{s.name}</div>
          <div className="detail-latin">{s.latin}</div>
          <div className="detail-meta">
            <span className={`tag trophic-${s.trophic}`}>{TROPHIC_LABEL[s.trophic]}</span>
            <span className="tag">{s.kind}</span>
            {s.env.map(e => <span key={e} className="tag">{e}</span>)}
            {s.climate.map(c => <span key={c} className="tag">{c}</span>)}
          </div>
          <div className="detail-blurb">{s.blurb}</div>

          <div className="rel-section">
            <div className="rel-title">Eats</div>
            <div className="rel-list">
              {eats.length === 0 && <div className="rel-empty">— produces its own energy —</div>}
              {eats.map(p => <RelRow key={p.id} sp={p} />)}
            </div>
          </div>

          <div className="rel-section">
            <div className="rel-title">Eaten by</div>
            <div className="rel-list">
              {eatenBy.length === 0 && <div className="rel-empty">— no natural predators in this guide —</div>}
              {eatenBy.map(p => <RelRow key={p.id} sp={p} />)}
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
}

function App() {
  const [filters, setFilters] = useState({ envs: [], climates: [], kinds: [] });
  const [query, setQuery] = useState("");
  const [nodes, setNodes] = useState([]);
  const [selectedId, setSelectedId] = useState(null);

  const placedIds = useMemo(() => new Set(nodes.map(n => n.id)), [nodes]);

  const onDragStart = (e, species) => {
    e.dataTransfer.setData("species/id", species.id);
    e.dataTransfer.effectAllowed = "copy";
  };

  const addSpecies = useCallback((species, pos) => {
    setNodes(ns => {
      if (ns.some(n => n.id === species.id)) return ns;
      const canvasEl = document.querySelector(".canvas");
      const rect = canvasEl.getBoundingClientRect();
      const p = pos || initialPosition(species, ns, rect.width, rect.height);
      return [...ns, { id: species.id, x: p.x, y: p.y }];
    });
    setSelectedId(species.id);
  }, []);

  const removeNode = useCallback((id) => {
    setNodes(ns => ns.filter(n => n.id !== id));
    setSelectedId(s => s === id ? null : s);
  }, []);

  const clearCanvas = () => {
    setNodes([]);
    setSelectedId(null);
  };

  // Seed: empty canvas — we want the user to start from scratch.

  return (
    <div className="app paper-bg">
      <Topbar placedCount={nodes.length} onClear={clearCanvas} />
      <Sidebar
        species={window.SPECIES}
        placedIds={placedIds}
        filters={filters}
        setFilters={setFilters}
        query={query}
        setQuery={setQuery}
        onDragStart={onDragStart}
        onAdd={addSpecies}
      />
      <Canvas
        nodes={nodes}
        setNodes={setNodes}
        selectedId={selectedId}
        setSelectedId={setSelectedId}
        onAdd={addSpecies}
        onRemove={removeNode}
      />
      <Detail
        selectedId={selectedId}
        placedIds={placedIds}
        onSelect={setSelectedId}
        onAdd={addSpecies}
      />
      <div className="corner-mark">— a living index —</div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<App />);
