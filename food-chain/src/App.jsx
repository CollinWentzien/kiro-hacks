import { useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import HomePage from './pages/HomePage.jsx';
import ProjectDashboard from './pages/ProjectDashboard.jsx';
import EcosystemBuilder from './pages/EcosystemBuilder.jsx';

let nextId = 1;

function makeProject({ name, mode, city }) {
  return { id: String(nextId++), name, mode, city, speciesCount: 0 };
}

export default function App() {
  const [session, setSession] = useState({ city: null, mode: null });
  const [projects, setProjects] = useState([]);
  const [activeId, setActiveId] = useState(null);

  const handleStart = ({ city, mode }) => {
    setSession({ city, mode });
    // Auto-create a project using the city as name
    const name = city ? `${city} Ecosystem` : 'My Terrarium';
    const p = makeProject({ name, mode, city });
    setProjects(ps => [...ps, p]);
    setActiveId(p.id);
  };

  const createProject = ({ name, mode, city }) => {
    const p = makeProject({ name, mode, city });
    setProjects(ps => [...ps, p]);
    setActiveId(p.id);
    return p.id;
  };

  const updateProject = (id, patch) => {
    setProjects(ps => ps.map(p => p.id === id ? { ...p, ...patch } : p));
  };

  return (
    <Routes>
      <Route path="/" element={<HomePage onStart={handleStart} />} />
      <Route path="/builder" element={
        activeId
          ? <EcosystemBuilder projects={projects} activeId={activeId} onUpdateProject={updateProject} />
          : <Navigate to="/" replace />
      } />
      <Route path="/dashboard" element={
        <ProjectDashboard
          projects={projects}
          defaultCity={session.city}
          activeId={activeId}
          onCreateProject={createProject}
          onSelectProject={setActiveId}
        />
      } />
      <Route path="/project/:id" element={
        <EcosystemBuilder projects={projects} activeId={activeId} onUpdateProject={updateProject} />
      } />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
