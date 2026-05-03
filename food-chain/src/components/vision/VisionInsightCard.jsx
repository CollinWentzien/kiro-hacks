/**
 * VisionInsightCard.jsx — Displays structured ecosystem vision results
 *
 * Props:
 *   data     — vision result object from /api/vision-insights
 *   imageUrl — URL of the analysed image (optional, shown as preview)
 *   loading  — show skeleton state
 *   error    — show error state (string)
 */

export default function VisionInsightCard({ data, imageUrl, loading, error }) {
  // ── Loading skeleton ───────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="vic vic--loading" aria-busy="true" aria-label="Analysing image">
        <div className="vic__skeleton vic__skeleton--img"  />
        <div className="vic__skeleton vic__skeleton--h1"   />
        <div className="vic__skeleton vic__skeleton--line" />
        <div className="vic__skeleton vic__skeleton--line vic__skeleton--short" />
      </div>
    );
  }

  // ── Error state ────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className="vic vic--error" role="alert">
        <div className="vic__error-icon" aria-hidden="true">⚠️</div>
        <div className="vic__error-title">Analysis failed</div>
        <div className="vic__error-msg">{error}</div>
        <div className="vic__error-hint">
          Make sure Ollama is running with a vision model:<br />
          <code>ollama pull moondream &amp;&amp; ollama serve</code>
        </div>
      </div>
    );
  }

  // ── Empty state ────────────────────────────────────────────────────────────
  if (!data) {
    return (
      <div className="vic vic--empty">
        <span className="vic__empty-icon" aria-hidden="true">🔍</span>
        <p className="vic__empty-text">
          Upload a photo to identify plants, animals, insects, fungi, and more.
        </p>
      </div>
    );
  }

  // ── Confidence colour ──────────────────────────────────────────────────────
  const conf = data.confidence ?? 0;
  const confClass = conf >= 75 ? 'vic__conf--high'
                  : conf >= 45 ? 'vic__conf--mid'
                  :              'vic__conf--low';

  // ── Category emoji ─────────────────────────────────────────────────────────
  const CATEGORY_EMOJI = {
    plant:     '🌿',
    animal:    '🦊',
    insect:    '🦋',
    fungus:    '🍄',
    fish:      '🐟',
    soil:      '🪱',
    water:     '💧',
    ecosystem: '🌍',
    unknown:   '❓',
  };
  const catEmoji = CATEGORY_EMOJI[data.category] ?? '🔍';

  return (
    <article className="vic" aria-label={`Vision insight: ${data.common_name}`}>

      {/* Image preview */}
      {(imageUrl || data.imageUrl) && (
        <div className="vic__img-wrap">
          <img
            src={imageUrl || data.imageUrl}
            alt={`Photo of ${data.common_name}`}
            className="vic__img"
          />
        </div>
      )}

      {/* Identity header */}
      <div className="vic__header">
        <div className="vic__category">
          <span aria-hidden="true">{catEmoji}</span>
          {data.category ?? 'Unknown'}
        </div>
        <h3 className="vic__common-name">{data.common_name}</h3>
        {data.scientific_name && (
          <div className="vic__scientific-name">{data.scientific_name}</div>
        )}
        <div className={`vic__conf ${confClass}`}>
          Confidence: {conf}%
        </div>
      </div>

      {/* Health status */}
      {data.health_status && (
        <div className="vic__section">
          <div className="vic__section-label">Health</div>
          <div className="vic__health">{data.health_status}</div>
        </div>
      )}

      {/* Ecosystem role */}
      {data.ecosystem_role && (
        <div className="vic__section">
          <div className="vic__section-label">Ecosystem role</div>
          <div className="vic__role">{data.ecosystem_role}</div>
        </div>
      )}

      {/* Insights */}
      {data.insights?.length > 0 && (
        <div className="vic__section">
          <div className="vic__section-label">Insights</div>
          <ul className="vic__list">
            {data.insights.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Recommendations */}
      {data.recommendations?.length > 0 && (
        <div className="vic__section">
          <div className="vic__section-label">Recommended actions</div>
          <ul className="vic__list vic__list--actions">
            {data.recommendations.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Safety warning */}
      {data.warning && (
        <div className="vic__warning" role="alert">
          <span className="vic__warning-icon" aria-hidden="true">⚠️</span>
          <span>{data.warning}</span>
        </div>
      )}

      {/* Disclaimer — always shown */}
      <div className="vic__disclaimer">
        <strong>Disclaimer:</strong> AI image identification can be wrong.
        Verify before eating, touching, or removing anything.
      </div>
    </article>
  );
}
