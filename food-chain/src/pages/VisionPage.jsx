/**
 * VisionPage — Ecosystem Photo Insights
 * Route: /vision
 *
 * Users upload a photo; the app identifies the subject and returns
 * structured ecosystem insights powered by a local Ollama vision model.
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import PhotoUpload from '../components/vision/PhotoUpload.jsx';
import VisionInsightCard from '../components/vision/VisionInsightCard.jsx';

export default function VisionPage() {
  const [result,   setResult]   = useState(null);
  const [imageUrl, setImageUrl] = useState(null);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState(null);

  const handleResult = (data) => {
    setResult(data);
    setImageUrl(data.imageUrl ?? null);
    setError(null);
    setLoading(false);
  };

  const handleError = (msg) => {
    setError(msg);
    setResult(null);
    setLoading(false);
  };

  const handleReset = () => {
    setResult(null);
    setImageUrl(null);
    setError(null);
    setLoading(false);
  };

  return (
    <div className="vision-page paper-bg">

      {/* Top bar */}
      <header className="cp-topbar">
        <div className="cp-topbar__brand">
          <Link to="/" className="cp-topbar__logo">Food Chain</Link>
          <span className="cp-topbar__sep">—</span>
          <span className="cp-topbar__name">Photo Insights</span>
        </div>
        <nav className="cp-topbar__right">
          <Link to="/coach"   className="icon-btn">EcoDoctor</Link>
          <Link to="/builder" className="icon-btn">Builder</Link>
          <Link to="/"        className="icon-btn">Home</Link>
        </nav>
      </header>

      {/* Body */}
      <div className="vision-page__body">

        {/* Left column — upload */}
        <section className="vision-page__upload-col">
          <div className="vision-page__section-head">
            <h2 className="vision-page__title">Identify from photo</h2>
            <p className="vision-page__subtitle">
              Upload a photo of a plant, animal, insect, fungus, soil, or fish.
              The AI will identify it and give you ecosystem insights.
            </p>
          </div>

          <PhotoUpload
            onResult={handleResult}
            onError={handleError}
            disabled={loading}
          />

          {(result || error) && (
            <button className="vision-page__reset icon-btn" onClick={handleReset}>
              ↺ Analyse another photo
            </button>
          )}

          {/* How it works */}
          <div className="vision-page__how">
            <div className="vision-page__how-title">How it works</div>
            <ol className="vision-page__how-list">
              <li>Upload or drag a photo from your device</li>
              <li>The image is sent to a local Ollama vision model</li>
              <li>The model identifies the subject and returns ecosystem insights</li>
              <li>Results are saved to your Supabase database</li>
            </ol>
            <div className="vision-page__how-note">
              Requires Ollama running locally with a vision model:<br />
              <code>ollama pull llava</code> then <code>ollama serve</code>
            </div>
          </div>
        </section>

        {/* Right column — result card */}
        <section className="vision-page__result-col" aria-live="polite">
          <VisionInsightCard
            data={result}
            imageUrl={imageUrl}
            loading={loading}
            error={error}
          />
        </section>

      </div>
    </div>
  );
}
