import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import GlobeScene from '../components/GlobeScene.jsx';

const AMBIENT = [
  { text: 'trophic cascade', style: { top: '12%', left: '8%', transform: 'rotate(-8deg)' } },
  { text: 'biodiversity index', style: { top: '18%', right: '10%', transform: 'rotate(5deg)' } },
  { text: '40 species catalogued', style: { bottom: '28%', left: '6%', transform: 'rotate(3deg)' } },
  { text: 'food web modeling', style: { bottom: '22%', right: '8%', transform: 'rotate(-4deg)' } },
  { text: 'lat 0.000 · lon 0.000', style: { top: '42%', left: '4%' } },
  { text: 'ecosystem health score', style: { top: '38%', right: '5%', transform: 'rotate(2deg)' } },
  { text: 'vol. I · spring \'26', style: { bottom: '12%', left: '50%', transform: 'translateX(-50%)' } },
];

export default function HomePage({ onStart }) {
  const [city, setCity] = useState('');
  const [zooming, setZooming] = useState(false);
  const navigate = useNavigate();
  const pendingRef = useRef(null);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!city.trim() || zooming) return;
    pendingRef.current = { city: city.trim(), mode: 'outdoor' };
    setZooming(true);
    setTimeout(() => {
      onStart(pendingRef.current);
      navigate('/builder');
    }, 1100);
  };

  const handleBypass = () => {
    onStart({ city: null, mode: 'terrarium' });
    navigate('/builder');
  };

  return (
    <div className="home">
      <GlobeScene zooming={zooming} />

      {/* Scattered ambient labels */}
      <div className="home-ambient">
        {AMBIENT.map((a, i) => (
          <div key={i} className="home-ambient-item" style={a.style}>{a.text}</div>
        ))}
      </div>

      {/* Center overlay — fades + scales on zoom */}
      <div className={`home-overlay ${zooming ? 'zooming' : ''}`}>
        <div className="home-eyebrow">Field Guide to Ecosystems · v1</div>
        <div className="home-title">where does it<br />all begin?</div>
        <div className="home-tagline">drop a pin. build a world.</div>

        <form onSubmit={handleSubmit}>
          <div className="home-input-row">
            <input
              className="home-input"
              placeholder="a city, anywhere on earth…"
              value={city}
              onChange={e => setCity(e.target.value)}
              autoFocus
            />
            <button className="home-go-btn" type="submit" aria-label="Begin">→</button>
          </div>
        </form>

        <button className="home-bypass" onClick={handleBypass}>
          building a terrarium or aquarium — skip location
        </button>
      </div>

      {/* Bottom stats */}
      <div className="home-bottom">
        <div className="home-bottom-item">
          <span className="num">40</span>
          <span className="lbl">species</span>
        </div>
        <div className="home-bottom-item">
          <span className="num">5</span>
          <span className="lbl">environments</span>
        </div>
        <div className="home-bottom-item">
          <span className="num">∞</span>
          <span className="lbl">combinations</span>
        </div>
      </div>
    </div>
  );
}
