import { useState, useRef, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import GlobeScene from '../components/GlobeScene.jsx';
import { getRandomFacts } from '../data/facts.js';

const POSITIONS = [
  { top: '12%',  left: '5%',  maxWidth: '200px' },
  { top: '18%',  right: '5%', maxWidth: '210px' },
  { bottom: '22%', left: '5%', maxWidth: '195px' },
  { bottom: '18%', right: '5%', maxWidth: '205px' },
];

export default function HomePage({ onStart }) {
  const [city, setCity] = useState('');
  const [zooming, setZooming] = useState(false);
  const navigate = useNavigate();
  const pendingRef = useRef(null);
  const facts = useMemo(() => getRandomFacts(4), []);

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

      <div className="home-ambient">
        {facts.map((fact, i) => (
          <div key={i} className="home-ambient-item" style={POSITIONS[i]}>{fact}</div>
        ))}
      </div>

      <div className={`home-overlay ${zooming ? 'zooming' : ''}`}>
        <div className="home-title">model your ecosystem —<br />don't just imagine it.</div>

        <form onSubmit={handleSubmit}>
          <div className="home-input-row">
            <input
              className="home-input"
              placeholder="a city, anywhere on earth…"
              value={city}
              onChange={e => setCity(e.target.value)}
              autoFocus
            />
            <button className="home-go-btn" type="submit" aria-label="Begin">
              <i className="fa-solid fa-arrow-right" style={{ position: 'relative', top: '1px' }} />
            </button>
          </div>
        </form>

        <button className="home-bypass" onClick={handleBypass}>
          building a terrarium or aquarium — skip location
        </button>

        <Link to="/coach" className="home-coach-link">
          or talk to the Ecosystem Coach →
        </Link>
      </div>

      <div className="home-bottom">
        <div className="home-bottom-item"><span className="num">40</span><span className="lbl">species</span></div>
        <div className="home-bottom-item"><span className="num">5</span><span className="lbl">environments</span></div>
        <div className="home-bottom-item"><span className="num">∞</span><span className="lbl">combinations</span></div>
      </div>
    </div>
  );
}
