import { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import GlobeScene from '../components/GlobeScene.jsx';
import { getRandomFacts } from '../data/facts.js';

const POSITIONS = [
  { top: '12%',  left: '5%',  maxWidth: '200px' },
  { top: '18%',  right: '5%', maxWidth: '210px' },
  { bottom: '22%', left: '5%', maxWidth: '195px' },
  { bottom: '18%', right: '5%', maxWidth: '205px' },
];

export default function HomePage({ onStart }) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [zooming, setZooming] = useState(false);
  const navigate = useNavigate();
  const pendingRef = useRef(null);
  const debounceRef = useRef(null);
  const facts = useMemo(() => getRandomFacts(4), []);

  useEffect(() => {
    if (query.length < 2 || selected) { setSuggestions([]); setShowDropdown(false); return; }
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`http://localhost:3000/api/geocode/autocomplete?q=${encodeURIComponent(query)}&limit=6`);
        if (res.ok) {
          const data = await res.json();
          const list = Array.isArray(data) ? data : [];
          setSuggestions(list);
          setShowDropdown(list.length > 0);
          setActiveIdx(-1);
        }
      } catch { /* backend not running */ }
    }, 250);
    return () => clearTimeout(debounceRef.current);
  }, [query, selected]);

  const handleSelect = useCallback((s) => {
    setSelected(s);
    setQuery(s.displayName);
    setSuggestions([]);
    setShowDropdown(false);
    setActiveIdx(-1);
  }, []);

  const handleChange = (e) => {
    setQuery(e.target.value);
    setSelected(null);
  };

  const handleKeyDown = (e) => {
    if (!showDropdown || suggestions.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx(i => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' && activeIdx >= 0) {
      e.preventDefault();
      handleSelect(suggestions[activeIdx]);
    } else if (e.key === 'Escape') {
      setShowDropdown(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!selected || zooming) return;
    pendingRef.current = { city: selected.displayName, mode: 'outdoor' };
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
          <div className="home-input-row" style={{ position: 'relative', zIndex: 10 }}>
            <input
              className="home-input"
              placeholder="a city, anywhere on earth…"
              value={query}
              onChange={handleChange}
              onKeyDown={handleKeyDown}
              onFocus={() => suggestions.length > 0 && setShowDropdown(true)}
              onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
              autoFocus
              autoComplete="off"
            />
            <button
              className="home-go-btn"
              type="submit"
              aria-label="Begin"
              disabled={!selected}
              style={{ opacity: selected ? 1 : 0.35, cursor: selected ? 'pointer' : 'not-allowed' }}
            >
              <i className="fa-solid fa-arrow-right" style={{ position: 'relative', top: '1px' }} />
            </button>

            {showDropdown && suggestions.length > 0 && (
              <ul className="city-suggestions">
                {suggestions.map((s, i) => (
                  <li
                    key={i}
                    className={i === activeIdx ? 'active' : ''}
                    onMouseDown={() => handleSelect(s)}
                    onMouseEnter={() => setActiveIdx(i)}
                  >
                    <span className="city-suggestions__name">{s.city}</span>
                    {(s.state || s.country) && (
                      <span className="city-suggestions__sub">{[s.state, s.country].filter(Boolean).join(', ')}</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </form>

        <button className="home-bypass" onClick={handleBypass}>
          skip location — i want to start from scratch
        </button>
      </div>

      <div className="home-bottom">
        <div className="home-bottom-item"><span className="num">40</span><span className="lbl">species</span></div>
        <div className="home-bottom-item"><span className="num">5</span><span className="lbl">environments</span></div>
        <div className="home-bottom-item"><span className="num">∞</span><span className="lbl">combinations</span></div>
      </div>
    </div>
  );
}
