import { useRef, useState, useEffect, useMemo } from 'react';
import { SPECIES_BY_ID } from '../data/species.js';
import SpeciesPhoto from './SpeciesPhoto.jsx';
import HealthScorePanel from './HealthScorePanel.jsx';

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

export default function EcosystemCanvas({ nodes, setNodes, selectedId, setSelectedId, onAdd, onRemove, draggingSpecies, setDraggingSpecies, speciesRegistry = SPECIES_BY_ID, onImprove, groqScore }) {
  const canvasRef = useRef(null);
  const [size, setSize] = useState({ w: 800, h: 600 });
  const [dragOver, setDragOver] = useState(false);
  const [draggingNode, setDraggingNode] = useState(null);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [panning, setPanning] = useState(false);
  const isPanning = useRef(false);
  const panStart = useRef({ x: 0, y: 0, px: 0, py: 0 });

  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      for (const e of entries) setSize({ w: e.contentRect.width, h: e.contentRect.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Auto-fit when a large batch of nodes arrives at once
  useEffect(() => {
    if (nodes.length < 5) return;
    const el = canvasRef.current;
    if (!el) return;
    const xs = nodes.map(n => n.x), ys = nodes.map(n => n.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const contentW = maxX - minX + 160, contentH = maxY - minY + 160;
    const rect = el.getBoundingClientRect();
    const fitZoom = Math.min(rect.width / contentW, rect.height / contentH, 1) * 0.85;
    setZoom(fitZoom);
    setPan({ x: (rect.width - contentW * fitZoom) / 2 - minX * fitZoom, y: (rect.height - contentH * fitZoom) / 2 - minY * fitZoom });
  }, [nodes.length]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const onWheel = (e) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const factor = e.deltaY < 0 ? 1.1 : 0.9;
      setZoom(z => {
        const nz = Math.min(3, Math.max(0.2, z * factor));
        setPan(p => ({
          x: mx - (mx - p.x) * (nz / z),
          y: my - (my - p.y) * (nz / z),
        }));
        return nz;
      });
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

  // Pan on canvas background pointer drag
  const onCanvasPointerDown = (e) => {
    if (draggingNode) return;
    isPanning.current = true;
    setPanning(true);
    panStart.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y };
  };
  const onCanvasPointerMove = (e) => {
    if (!isPanning.current) return;
    setPan({ x: panStart.current.px + e.clientX - panStart.current.x, y: panStart.current.py + e.clientY - panStart.current.y });
  };
  const onCanvasPointerUp = () => { isPanning.current = false; setPanning(false); };
  useEffect(() => {
    if (!draggingSpecies) { setDragOver(false); return; }
    const onMove = (e) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const over = e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom;
      setDragOver(over);
    };
    const onUp = (e) => {
      const rect = canvasRef.current?.getBoundingClientRect();
      if (rect) {
        const over = e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top && e.clientY <= rect.bottom;
        if (over) onAdd(draggingSpecies, {
          x: (e.clientX - rect.left - pan.x) / zoom,
          y: (e.clientY - rect.top - pan.y) / zoom,
        });
      }
      setDragOver(false);
      setDraggingSpecies(null);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); };
  }, [draggingSpecies, onAdd, setDraggingSpecies]);

  const zoomFromCenter = (factor) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mx = rect.width / 2, my = rect.height / 2;
    setZoom(z => {
      const nz = Math.min(3, Math.max(0.2, z * factor));
      setPan(p => ({
        x: mx - (mx - p.x) * (nz / z),
        y: my - (my - p.y) * (nz / z),
      }));
      return nz;
    });
  };

  const onNodePointerDown = (e, node) => {
    e.stopPropagation();
    isPanning.current = false;
    const rect = canvasRef.current.getBoundingClientRect();
    setDraggingNode({
      id: node.id,
      offsetX: (e.clientX - rect.left - pan.x) / zoom - node.x,
      offsetY: (e.clientY - rect.top - pan.y) / zoom - node.y,
    });
    setSelectedId(node.id);
  };

  useEffect(() => {
    if (!draggingNode) return;
    const onMove = (e) => {
      const rect = canvasRef.current.getBoundingClientRect();
      setNodes(ns => ns.map(n => n.id === draggingNode.id
        ? { ...n,
            x: (e.clientX - rect.left - pan.x) / zoom - draggingNode.offsetX,
            y: (e.clientY - rect.top - pan.y) / zoom - draggingNode.offsetY,
          }
        : n));
    };
    const onUp = () => setDraggingNode(null);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [draggingNode, setNodes]);

  const edges = useMemo(() => {
    const idSet = new Set(nodes.map(n => n.id));
    const list = [];
    for (const n of nodes) {
      const s = speciesRegistry[n.id];
      if (!s) continue;
      for (const preyId of (s.eats || [])) {
        if (idSet.has(preyId)) list.push({ from: preyId, to: n.id });
      }
    }
    return list;
  }, [nodes, speciesRegistry]);

  const nodePos = useMemo(() => Object.fromEntries(nodes.map(n => [n.id, n])), [nodes]);

  const relIds = useMemo(() => {
    if (!selectedId) return null;
    const s = speciesRegistry[selectedId];
    if (!s) return new Set([selectedId]);
    const rel = new Set([selectedId]);
    (s.eats || []).forEach(i => rel.add(i));
    (s.eatenBy || []).forEach(i => rel.add(i));
    return rel;
  }, [selectedId, speciesRegistry]);

  return (
    <div className="canvas-wrap">
      <div ref={canvasRef}
        className={`canvas ${dragOver ? 'drag-over' : ''}`}
        style={{ cursor: panning ? 'grabbing' : 'grab' }}
        onClick={() => setSelectedId(null)}
        onPointerDown={onCanvasPointerDown}
        onPointerMove={onCanvasPointerMove}
        onPointerUp={onCanvasPointerUp}
        onPointerLeave={onCanvasPointerUp}>

        {/* Fixed UI — outside transform */}
        <HealthScorePanel nodes={nodes} speciesRegistry={speciesRegistry} onImprove={onImprove} groqScore={groqScore} />

        {/* Pannable/zoomable content */}
        <div style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: '0 0', position: 'absolute', inset: 0, pointerEvents: 'none' }}>
          <div style={{ pointerEvents: 'all' }}>

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

          <svg className="edges-svg" width="4000" height="4000" style={{ position: 'absolute', top: 0, left: 0, overflow: 'visible' }}>
            <defs>
              <marker id="arrowhead" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
                <path d="M0,0 L7,3.5 L0,7 z" fill="var(--ink-soft)" />
              </marker>
              <marker id="arrowhead-hl" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
                <path d="M0,0 L7,3.5 L0,7 z" fill="var(--tidal)" />
              </marker>
            </defs>
            {edges.map((e, i) => {
              const a = nodePos[e.from], b = nodePos[e.to];
              if (!a || !b) return null;
              const dx = b.x - a.x, dy = b.y - a.y;
              const len = Math.sqrt(dx * dx + dy * dy);
              if (len === 0) return null;
              const nx = dx / len, ny = dy / len;
            // Intersect ray with rounded-rect bounding box of node (photo + text)
            // Box: half-width=46, half-height-top=44, half-height-bottom=62, corner-radius=8
            const rrIntersect = (ox, oy, dx, dy, hw, ht) => {
              const tx = dx !== 0 ? (Math.sign(dx) * hw - ox) / dx : Infinity;
              const ty = dy !== 0 ? (Math.sign(dy) * ht - oy) / dy : Infinity;
              return Math.min(Math.abs(tx), Math.abs(ty));
            };
            const hw = 46;
            const htA = ny >= 0 ? 62 : 60;
            const htB = -ny >= 0 ? 62 : 60;
            const tA = rrIntersect(0, 0, nx, ny, hw, htA);
            const tB = rrIntersect(0, 0, -nx, -ny, hw, htB);
            const sx = a.x + nx * tA, sy = a.y + ny * tA;
            const ex = b.x - nx * tB, ey = b.y - ny * tB;
              const mx = (sx + ex) / 2 - ny * Math.min(18, len * 0.12), my = (sy + ey) / 2 + nx * Math.min(18, len * 0.12);
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
            const s = speciesRegistry[n.id];
            if (!s) return null;
            const dimmed = relIds && !relIds.has(n.id);
            return (
              <div key={n.id}
                className={`node ${selectedId === n.id ? 'selected' : ''} ${dimmed ? 'dimmed' : ''} ${draggingNode?.id === n.id ? 'dragging' : ''}`}
                style={{ left: n.x, top: n.y }}
                onPointerDown={e => onNodePointerDown(e, n)}
                onClick={e => { e.stopPropagation(); setSelectedId(n.id); }}>
                <div style={{ position: 'relative', width: 80, margin: '0 auto' }}>
                  <SpeciesPhoto species={s} className="node-photo" />
                  <div className={`node-trophic-dot ${s.trophic}`} />
                  <div className="node-remove"
                    onPointerDown={e => e.stopPropagation()}
                    onClick={e => { e.stopPropagation(); onRemove(n.id); }}>
                    <i className="fa-solid fa-xmark" style={{ display: 'block', lineHeight: 1, transform: 'translate(0.25px, 0.25px)' }} />
                  </div>
                </div>
                <div className="node-label">{s.name}</div>
                <div className="node-latin">{s.latin}</div>
              </div>
            );
          })}

        </div>{/* end pointerEvents wrapper */}
        </div>{/* end transform */}

        {nodes.length > 0 && (
          <div className="legend">
            {[['var(--sage)','Producer'],['var(--mustard)','Primary'],['var(--rust)','Secondary'],['var(--ink)','Apex'],['var(--ink-fade)','Decomposer']].map(([c, l]) => (
              <div key={l} className="legend-item"><span className="legend-dot" style={{ background: c }} />{l}</div>
            ))}
            <div className="legend-item" style={{ color: 'var(--tidal)' }}>→ eaten by</div>
          </div>
        )}

        <div className="zoom-controls">
          <div className="zoom-btns-row">
            <button onClick={e => { e.stopPropagation(); zoomFromCenter(1.2); }}><i className="fa-solid fa-magnifying-glass-plus" /></button>
            <button onClick={e => {
            e.stopPropagation();
            if (!nodes.length) { setZoom(1); setPan({ x: 0, y: 0 }); return; }
            const el = canvasRef.current;
            if (!el) return;
            const xs = nodes.map(n => n.x), ys = nodes.map(n => n.y);
            const minX = Math.min(...xs), maxX = Math.max(...xs);
            const minY = Math.min(...ys), maxY = Math.max(...ys);
            const contentW = maxX - minX + 160, contentH = maxY - minY + 160;
            const rect = el.getBoundingClientRect();
            const fz = Math.min(rect.width / contentW, rect.height / contentH, 1) * 0.85;
            setZoom(fz);
            setPan({ x: (rect.width - contentW * fz) / 2 - minX * fz, y: (rect.height - contentH * fz) / 2 - minY * fz });
          }}><i className="fa-solid fa-arrows-to-dot" /></button>
            <button onClick={e => { e.stopPropagation(); zoomFromCenter(0.8); }}><i className="fa-solid fa-magnifying-glass-minus" /></button>
          </div>
          <button className="sort-btn" title="Sort by trophic level" onClick={e => {
            e.stopPropagation();
            // producers=bottom (high y), apex=top (low y)
            const ORDER = { tertiary: 0, secondary: 1, primary: 2, producer: 3, decomposer: 3 };
            const rect = canvasRef.current?.getBoundingClientRect();
            const W = rect?.width ?? 800, H = rect?.height ?? 600;
            const byLevel = {};
            nodes.forEach(n => {
              const t = speciesRegistry[n.id].trophic;
              (byLevel[t] = byLevel[t] || []).push(n);
            });
            const rows = Object.entries(byLevel).sort((a, b) => ORDER[a[0]] - ORDER[b[0]]);
            const totalRows = rows.length;
            const updated = [];
            rows.forEach(([, group], ri) => {
              const y = (H * 0.1) + (ri / Math.max(totalRows - 1, 1)) * (H * 0.8);
              group.forEach((n, ci) => {
                const x = (W / (group.length + 1)) * (ci + 1);
                updated.push({ ...n, x, y });
              });
            });
            setNodes(updated);
          }}>
            <i className="fa-solid fa-arrow-down-wide-short" /> Sort by level
          </button>
        </div>
      </div>
    </div>
  );
}
