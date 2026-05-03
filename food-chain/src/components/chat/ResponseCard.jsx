/**
 * ResponseCard — displays a structured CoachResponse with sections:
 * - Main recommendation message
 * - Plant / species suggestions
 * - Sustainability score
 * - Biodiversity notes
 * - Diagnosis notes
 * - Next actions
 */

function ScoreBar({ score, label, color }) {
  const pct = Math.max(0, Math.min(100, score));
  const barColor = score >= 70 ? 'var(--sage)' : score >= 40 ? 'var(--mustard)' : 'var(--rust)';

  return (
    <div className="response-card__score-row">
      <div className="response-card__score-label">{label}</div>
      <div className="response-card__score-bar-wrap">
        <div
          className="response-card__score-bar"
          style={{ width: `${pct}%`, background: barColor }}
          role="progressbar"
          aria-valuenow={score}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={`${label}: ${score} out of 100`}
        />
      </div>
      <div className="response-card__score-num">{score}</div>
    </div>
  );
}

function Section({ title, children, icon }) {
  return (
    <div className="response-card__section">
      <div className="response-card__section-title">
        {icon && <span className="response-card__section-icon" aria-hidden="true">{icon}</span>}
        {title}
      </div>
      {children}
    </div>
  );
}

export default function ResponseCard({ response }) {
  if (!response) return null;

  const {
    recommendations = [],
    sustainability,
    biodiversity,
    diagnosis,
    nextActions = [],
    agentsUsed = [],
  } = response;

  const hasStructuredData = recommendations.length > 0 || sustainability || biodiversity || diagnosis || nextActions.length > 0;

  if (!hasStructuredData) return null;

  return (
    <div className="response-card" role="region" aria-label="Ecosystem Coach Analysis">
      {/* Plant Recommendations */}
      {recommendations.length > 0 && (
        <Section title="Species Recommendations" icon="🌿">
          <ol className="response-card__list">
            {recommendations.map((rec, i) => (
              <li key={i} className="response-card__list-item">{rec}</li>
            ))}
          </ol>
        </Section>
      )}

      {/* Scores */}
      {(sustainability || biodiversity) && (
        <Section title="Ecosystem Scores" icon="📊">
          {sustainability?.score !== undefined && (
            <ScoreBar score={sustainability.score} label="Sustainability" />
          )}
          {biodiversity?.score !== undefined && (
            <ScoreBar score={biodiversity.score} label="Biodiversity" />
          )}

          {/* Sustainability details */}
          {sustainability?.suggestions?.length > 0 && (
            <div className="response-card__sub-section">
              <div className="response-card__sub-title">Sustainability Notes</div>
              <ul className="response-card__list">
                {sustainability.suggestions.map((s, i) => (
                  <li key={i} className="response-card__list-item">{s}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Biodiversity details */}
          {biodiversity?.gaps?.length > 0 && (
            <div className="response-card__sub-section">
              <div className="response-card__sub-title">Missing Trophic Levels</div>
              <div className="response-card__tags">
                {biodiversity.gaps.map(gap => (
                  <span key={gap} className="response-card__tag response-card__tag--warning">{gap}</span>
                ))}
              </div>
            </div>
          )}

          {/* Trophic breakdown */}
          {biodiversity?.trophicBreakdown && (
            <div className="response-card__sub-section">
              <div className="response-card__sub-title">Trophic Breakdown</div>
              <div className="response-card__trophic-grid">
                {Object.entries(biodiversity.trophicBreakdown).map(([level, data]) => (
                  <div key={level} className={`response-card__trophic-cell ${data.count > 0 ? 'present' : 'absent'}`}>
                    <div className="response-card__trophic-level">{level}</div>
                    <div className="response-card__trophic-count">{data.count}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Section>
      )}

      {/* Diagnosis */}
      {diagnosis?.causes?.length > 0 && (
        <Section title="Plant Diagnosis" icon="🔍">
          {diagnosis.causes.map((cause, i) => (
            <div key={i} className="response-card__diagnosis-item">
              <div className="response-card__diagnosis-header">
                <span className="response-card__diagnosis-cause">{cause.cause}</span>
                <span className={`response-card__confidence response-card__confidence--${cause.confidence}`}>
                  {cause.confidence}
                </span>
              </div>
              <div className="response-card__diagnosis-desc">{cause.description}</div>
              <div className="response-card__diagnosis-treatment">
                <strong>Treatment:</strong> {cause.treatment}
              </div>
            </div>
          ))}
          {diagnosis.spreadRisk && (
            <div className="response-card__spread-warning">
              ⚠️ {diagnosis.spreadRisk}
            </div>
          )}
          {diagnosis.clarifyingQuestion && (
            <div className="response-card__clarify">
              💬 {diagnosis.clarifyingQuestion}
            </div>
          )}
        </Section>
      )}

      {/* Next Actions */}
      {nextActions.length > 0 && (
        <Section title="Next Actions" icon="✅">
          <ol className="response-card__list response-card__list--actions">
            {nextActions.map((action, i) => (
              <li key={i} className="response-card__list-item">{action}</li>
            ))}
          </ol>
        </Section>
      )}

      {/* Agents used — subtle footer */}
      {agentsUsed.length > 0 && (
        <div className="response-card__footer">
          Analyzed by: {agentsUsed.join(', ')}
        </div>
      )}
    </div>
  );
}
