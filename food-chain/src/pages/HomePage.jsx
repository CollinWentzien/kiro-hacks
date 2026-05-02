import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

function GlobeHero() {
  const cx = 300, cy = 300, r = 260;
  // latitude lines every 30deg
  const latLines = [-60,-30,0,30,60].map(lat => {
    const ry = r * Math.cos(lat * Math.PI / 180);
    const y = cy + r * Math.sin(lat * Math.PI / 180);
    return <ellipse key={lat} cx={cx} cy={y} rx={ry} ry={ry * 0.18} fill="none" stroke="#2a2520" strokeWidth="0.8" />;
  });
  // longitude lines every 30deg
  const lonLines = [0,30,60,90,120,150].map(lon => {
    const angle = lon * Math.PI / 180;
    return (
      <ellipse key={lon} cx={cx} cy={cy} rx={r * Math.abs(Math.cos(angle))} ry={r}
        fill="none" stroke="#2a2520" strokeWidth="0.8"
        transform={`rotate(${lon} ${cx} ${cy})`} />
    );
  });

  return (
    <div className="globe-wrap">
      <svg className="globe-svg" width="600" height="600" viewBox="0 0 600 600">
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#2a2520" strokeWidth="1.2" />
        <g className="globe-grid">
          {latLines}
          {lonLines}
        </g>
        {/* simplified continent blobs */}
        <g fill="#2a2520" opacity="0.35">
          <ellipse cx="260" cy="240" rx="55" ry="70" transform="rotate(-10 260 240)" />
          <ellipse cx="310" cy="310" rx="40" ry="55" transform="rotate(15 310 310)" />
          <ellipse cx="380" cy="220" rx="65" ry="50" transform="rotate(-5 380 220)" />
          <ellipse cx="420" cy="300" rx="30" ry="45" transform="rotate(20 420 300)" />
          <ellipse cx="200" cy="330" rx="25" ry="35" />
          <ellipse cx="460" cy="370" rx="35" ry="28" transform="rotate(-15 460 370)" />
        </g>
      </svg>
    </div>
  );
}

export default function HomePage({ onStart }) {
  const [city, setCity] = useState('');
  const navigate = useNavigate();

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!city.trim()) return;
    onStart({ city: city.trim(), mode: 'outdoor' });
    navigate('/dashboard');
  };

  const handleBypass = () => {
    onStart({ city: null, mode: 'terrarium' });
    navigate('/dashboard');
  };

  return (
    <div className="home paper-bg">
      <GlobeHero />
      <div className="home-card">
        <div className="home-eyebrow">Food Chain · Field Guide to Ecosystems</div>
        <div className="home-title">Where is your ecosystem?</div>
        <div className="home-sub">Enter a city to build a location-aware outdoor ecosystem.</div>
        <form onSubmit={handleSubmit}>
          <div className="home-input-wrap">
            <input
              className="home-input"
              placeholder="e.g. Portland, Oregon"
              value={city}
              onChange={e => setCity(e.target.value)}
              autoFocus
            />
          </div>
          <button className="home-btn" type="submit">Begin →</button>
        </form>
        <button className="home-bypass" onClick={handleBypass}>
          I'm building a terrarium / aquarium — skip location
        </button>
      </div>
    </div>
  );
}
