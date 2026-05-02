/**
 * ChatToggleButton — floating action button to open/close the Ecosystem Coach chat.
 * Shows a badge when the ecosystem has species (coach has context to work with).
 */

export default function ChatToggleButton({ isOpen, onClick, speciesCount = 0 }) {
  return (
    <button
      className={`chat-toggle-btn ${isOpen ? 'chat-toggle-btn--open' : ''}`}
      onClick={onClick}
      aria-label={isOpen ? 'Close Ecosystem Coach' : 'Open Ecosystem Coach'}
      aria-expanded={isOpen}
      title={isOpen ? 'Close Coach' : 'Ask the Ecosystem Coach'}
    >
      <span className="chat-toggle-btn__icon" aria-hidden="true">
        {isOpen ? '×' : '🌿'}
      </span>
      {!isOpen && speciesCount > 0 && (
        <span className="chat-toggle-btn__badge" aria-label={`${speciesCount} species in ecosystem`}>
          {speciesCount}
        </span>
      )}
      {!isOpen && (
        <span className="chat-toggle-btn__label">Coach</span>
      )}
    </button>
  );
}
