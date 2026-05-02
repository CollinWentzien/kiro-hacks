import { useRef, useState, useEffect, useMemo } from 'react';
import { SPECIES_BY_ID } from '../data/species.js';

export function initialPosition(species, existing, canvasW, canvasH) {
  const yByTrophic = { producer: 0.85, decomposer: 0.85, primary: 0.62, secondary: 0.38, tertiary: 0.15 };
  const baseY = (yByTrophic[species.trophic] ?? 0.5) * canvasH;
  const sameRow = existing.filter(n => Math.abs(n.y - baseY) < 80);
  const cols = Math.max(4, Math.floor(canvasW / 160));
  let bestX = canvasW / 2, bestDist = -1;
  for (let i = 0; i < cols; i++) {
    const x = (i + 0.5) * (canvasW / cols);
    const minDist = sameRow.length === 0 ? Infinity : Math.min(...sameRow.map(n => Math.abs(n.x - x)));
    if (minDist > bestDist) { bestDist = minDist; bestX = x; }
  }
  return { x: bestX + (Math.random() - 0.5) * 30, y: baseY + (Math.random() - 0.5) * 30 };
}

export default function EcosystemCanvas({ nodes, setNodes, selectedId, setSelectedId, onAdd, onRemove }) {
  const canvasRef = useRef(null);
  const [size, setSize] = useState({ w: 800, h: 600 });
  const [dragOver, setDragOver] = useState(false);
  const [draggingNode, setDraggingNode] = useState(null);

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      for (const e of entries) setSize({ w: e.contentRect.width, h: e.contentRect.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const onCanvasDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const id = e.dataTransfer.getData('species/id');
    if (!id) return;
    const species = SPECIES_BY_ID[id];
    if (!species) return;
    const rect = canvasRef.current.getBoundingClientRect();
    onAdd(species, { x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  const onNodePointerDown = (e, node) => {
    e.stopPropagation();
    const rect = canvasRef.current.getBoundingClientRect();
    setDraggingNode({ id: node.id, offsetX: e.clientX - rect.left - node.x, offsetY: e.clientY - rect.top - node.y });
    setSelectedId(node.id);
  };

  useEffect(() => {
    if (!draggingNode) return;
    const onMove = (e) => {
      const rect = canvasRef.current.getBoundingClientRect();
      setNodes(ns => ns.map(n => n.id === draggingNode.id
        ? { ...n, x: e.clientX - rect.left - draggingNode.offsetX, y: e.clientY - rect.top - draggingNode.offsetY }
        : n));
    };
    const onUp = () => setDraggingNode(null);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); };
  }, [draggingNode, setNodes]);

  const edges = useMemo(() => {
    const idSet = new Set(nodes.map(n => n.id));
    const list = [];
    for (const n of nodes) {
      const s = SPECIES_BY_ID[n.id];
      for (const preyId of s.eats) {
        if (idSet.has(preyId)) list.push({ from: preyId, to: n.id });
      }
    }
    return list;
  }, [nodes]);

  const nodePos = useMemo(() => Object.fromEntries(nodes.map(n => [n.id, n])), [nodes]);

  const relIds = useMemo(() => {
    if (!selectedId) return null;
    const s = SPECIES_BY_ID[selectedId];
    const rel = new Set([selectedId]);
    s.eats.forEach(i => rel.add(i));
    s.eatenBy.forEach(i => rel.add(i));
    return rel;
  }, [selectedId]);

  return (
    <div className="canvas-wrap">
      <div ref={canvasRef}
        className={`canvas ${dragOver ? 'drag-over' : ''}`}
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={e => { if (e.target === canvasRef.current) setDragOver(false); }}
        onDrop={onCanvasDrop}
        onClick={() => setSelectedId(null)}>

        <div className="canvas-overlay-text canvas-title">My Ecosystem</div>

        {nodes.length === 0 && (
          <div className="canvas-empty">
            <svg className="arrow" viewBox="0 0 80 60" fill="none">
              <path d="M70 30 Q40 10 12 35" stroke="currentColor" strokeWidth="1.2" opacity="0.5" />
              <path d="M18 28 L10 36 L20 40" stroke="currentColor" strokeWidth="1.2" fill="none" opacity="0.5" />
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
            const a = nodePos[e.from], b = nodePos[e.to];
            if (!a || !b) return null;
            const dx = b.x - a.x, dy = b.y - a.y;
            const len = Math.sqrt(dx * dx + dy * dy);
            if (len === 0) return null;
            const nx = dx / len, ny = dy / len;
            const sx = a.x + nx * 44, sy = a.y + ny * 44;
            const ex = b.x - nx * 50, ey = b.y - ny * 50;
            const mx = (sx + ex) / 2 - ny * 18, my = (sy + ey) / 2 + nx * 18;
            const hl = selectedId && (e.from === selectedId || e.to === selectedId);
            const dim = selectedId && !hl;
            return (
              <path key={`${e.from}-${e.to}-${i}`}
                d={`M ${sx} ${sy} Q ${mx} ${my} ${ex} ${ey}`}
                className={`edge-line ${hl ? 'highlight' : ''} ${dim ? 'dim' : ''}`}
                markerEnd={hl ? 'url(#arrowhead-hl)' : 'url(#arrowhead)'} />
            );
          })}
        </svg>

        {nodes.map(n => {
          const s = SPECIES_BY_ID[n.id];
          const dimmed = relIds && !relIds.has(n.id);
          return (
            <div key={n.id}
              className={`node ${selectedId === n.id ? 'selected' : ''} ${dimmed ? 'dimmed' : ''} ${draggingNode?.id === n.id ? 'dragging' : ''}`}
              style={{ left: n.x, top: n.y }}
              onPointerDown={e => onNodePointerDown(e, n)}
              onClick={e => { e.stopPropagation(); setSelectedId(n.id); }}>
              <div className="node-photo" style={{ backgroundImage: `url(${s.img})` }}>
                <div className={`node-trophic-dot ${s.trophic}`} />
              </div>
              <div className="node-remove"
                onPointerDown={e => e.stopPropagation()}
                onClick={e => { e.stopPropagation(); onRemove(n.id); }}>×</div>
              <div className="node-label">{s.name}</div>
              <div className="node-latin">{s.latin}</div>
            </div>
          );
        })}

        {nodes.length > 0 && (
          <div className="legend">
            {[['var(--sage)','Producer'],['var(--mustard)','Primary'],['var(--rust)','Secondary'],['var(--ink)','Apex'],].map(([c, l]) => (
              <div key={l} className="legend-item"><span className="legend-dot" style={{ background: c }} />{l}</div>
            ))}
            <div className="legend-item">→ eaten by</div>
          </div>
        )}
      </div>
    </div>
  );
}
