import { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import HomePage from './pages/HomePage.jsx';
import ProjectDashboard from './pages/ProjectDashboard.jsx';
import EcosystemBuilder from './pages/EcosystemBuilder.jsx';

let nextId = 1;

function makeProject({ name, mode, city }) {
  return { id: String(nextId++), name, mode, city, speciesCount: 0 };
}

function AnimatedRoutes({ projects, activeId, session, onStart, onCreateProject, onSelectProject, onUpdateProject }) {
  const location = useLocation();
  const [displayLocation, setDisplayLocation] = useState(location);
  const [fadingOut, setFadingOut] = useState(false);

  useEffect(() => {
    if (location.pathname !== displayLocation.pathname) {
      setFadingOut(true);
      const t = setTimeout(() => {
        setDisplayLocation(location);
        setFadingOut(false);
      }, 400);
      return () => clearTimeout(t);
    }
  }, [location, displayLocation]);

  return (
    <div
      key={displayLocation.pathname}
      className={fadingOut ? 'page-fade-out' : 'page-fade'}
      style={{ height: '100%' }}
    >
      <Routes location={displayLocation}>
        <Route path="/" element={<HomePage onStart={onStart} />} />
        <Route path="/builder" element={
          activeId
            ? <EcosystemBuilder projects={projects} activeId={activeId} onUpdateProject={onUpdateProject} />
            : <Navigate to="/" replace />
        } />
        <Route path="/dashboard" element={
          <ProjectDashboard
            projects={projects}
            defaultCity={session.city}
            activeId={activeId}
            onCreateProject={onCreateProject}
            onSelectProject={onSelectProject}
          />
        } />
        <Route path="/project/:id" element={
          <EcosystemBuilder projects={projects} activeId={activeId} onUpdateProject={onUpdateProject} />
        } />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  );
}

export default function App() {
  const [session, setSession] = useState({ city: null, mode: null });
  const [projects, setProjects] = useState([]);
  const [activeId, setActiveId] = useState(null);

  const handleStart = ({ city, mode }) => {
    setSession({ city, mode });
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
    <AnimatedRoutes
      projects={projects}
      activeId={activeId}
      session={session}
      onStart={handleStart}
      onCreateProject={createProject}
      onSelectProject={setActiveId}
      onUpdateProject={updateProject}
    />
  );
}
