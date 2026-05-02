import { useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import HomePage from './pages/HomePage.jsx';
import ProjectDashboard from './pages/ProjectDashboard.jsx';
import EcosystemBuilder from './pages/EcosystemBuilder.jsx';

let nextId = 1;

export default function App() {
  const [session, setSession] = useState({ city: null, mode: null });
  const [projects, setProjects] = useState([]);

  const handleStart = ({ city, mode }) => setSession({ city, mode });

  const createProject = ({ name, mode, city }) => {
    const id = String(nextId++);
    setProjects(ps => [...ps, { id, name, mode, city, speciesCount: 0 }]);
    return id;
  };

  const updateProject = (id, patch) => {
    setProjects(ps => ps.map(p => p.id === id ? { ...p, ...patch } : p));
  };

  return (
    <Routes>
      <Route path="/" element={<HomePage onStart={handleStart} />} />
      <Route path="/dashboard" element={
        <ProjectDashboard
          projects={projects}
          defaultCity={session.city}
          onCreateProject={createProject}
        />
      } />
      <Route path="/project/:id" element={
        <EcosystemBuilder projects={projects} onUpdateProject={updateProject} />
      } />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
