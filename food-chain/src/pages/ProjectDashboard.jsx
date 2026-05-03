import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import ecosysLogo from '../assets/ecosys-logo.svg';

const MODE_LABELS = { outdoor: 'Outdoor', terrarium: 'Terrarium', aquarium: 'Aquarium' };

function NewProjectModal({ defaultCity, onClose, onCreate }) {
  const [name, setName] = useState('');
  const [mode, setMode] = useState('outdoor');
  const [city, setCity] = useState(defaultCity || '');

  const handleCreate = (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    onCreate({ name: name.trim(), mode, city: mode === 'outdoor' ? city.trim() : null });
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-title">New Project</div>
        <form onSubmit={handleCreate}>
          <div className="modal-field">
            <label className="modal-label">Project Name</label>
            <input className="modal-input" placeholder="My Backyard Ecosystem…" value={name}
              onChange={e => setName(e.target.value)} autoFocus />
          </div>
          <div className="modal-field">
            <label className="modal-label">Mode</label>
            <div className="modal-mode-row">
              {['outdoor','terrarium','aquarium'].map(m => (
                <button key={m} type="button"
                  className={`modal-mode-btn ${mode === m ? 'active' : ''}`}
                  onClick={() => setMode(m)}>
                  {MODE_LABELS[m]}
                </button>
              ))}
            </div>
          </div>
          {mode === 'outdoor' && (
            <div className="modal-field">
              <label className="modal-label">City</label>
              <input className="modal-input" placeholder="e.g. Austin, Texas" value={city}
                onChange={e => setCity(e.target.value)} />
            </div>
          )}
          <div className="modal-actions">
            <button type="button" className="icon-btn" onClick={onClose}>Cancel</button>
            <button type="submit" className="icon-btn" style={{ background: 'var(--ink)', color: 'var(--paper)', borderColor: 'var(--ink)' }}>
              Create →
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function ProjectDashboard({ projects, defaultCity, onCreateProject }) {
  const [showModal, setShowModal] = useState(false);
  const navigate = useNavigate();

  const handleCreate = (data) => {
    const id = onCreateProject(data);
    setShowModal(false);
    navigate(`/project/${id}`);
  };

  return (
    <div className="dashboard paper-bg">
      <div className="topbar">
        <div className="brand">
          <Link to="/" className="brand-mark" aria-label="EcoSys home">
            <img src={ecosysLogo} alt="EcoSys" className="topbar-logo" />
          </Link>
          <div className="brand-sub">— a field guide to ecosystems</div>
        </div>
        <div className="actions">
          <button className="icon-btn" onClick={() => setShowModal(true)}>+ New Project</button>
        </div>
      </div>

      <div className="dashboard-body">
        <div className="dashboard-header">
          <div>
            <div className="dashboard-title">Your Projects</div>
            <div className="dashboard-sub">{projects.length} ecosystem{projects.length !== 1 ? 's' : ''} · in-session</div>
          </div>
          <button className="icon-btn" onClick={() => setShowModal(true)}>+ New Project</button>
        </div>

        {projects.length === 0 ? (
          <div className="dashboard-empty">
            <span className="hand">no projects yet</span>
            <p>Create your first ecosystem to begin.</p>
          </div>
        ) : (
          <div className="project-grid">
            {projects.map(p => (
              <div key={p.id} className="project-card" onClick={() => navigate(`/project/${p.id}`)}>
                <div className="project-card-mode">{MODE_LABELS[p.mode]}{p.city ? ` · ${p.city}` : ''}</div>
                <div className="project-card-name">{p.name}</div>
                <div className="project-card-meta">{p.speciesCount} species on canvas</div>
                <div className="project-card-arrow">→</div>
              </div>
            ))}
            <div className="new-project-card" onClick={() => setShowModal(true)}>
              <span>+ new ecosystem</span>
            </div>
          </div>
        )}
      </div>

      {showModal && (
        <NewProjectModal
          defaultCity={defaultCity}
          onClose={() => setShowModal(false)}
          onCreate={handleCreate}
        />
      )}
    </div>
  );
}
