import React, { useState } from 'react';
import { LuSparkles, LuLoader, LuChevronDown, LuChevronUp } from 'react-icons/lu';
import useAI from '../hooks/useAI';

// ─────────────────────────────────────────────────────────────────────────────
// AISuggestionBadge
// Drop into CreateTask form — when title + description are filled, user can
// click "✨ Suggest Priority" to get an AI priority recommendation + reason.
//
// Props:
//   title       — current task title string
//   description — current task description string
//   onAccept    — (priority) => void  called when user clicks "Use this"
// ─────────────────────────────────────────────────────────────────────────────

const PRIORITY_COLORS = {
  high:   { bg: 'bg-red-50',    border: 'border-red-200',    text: 'text-red-700',    dot: 'bg-red-500'    },
  medium: { bg: 'bg-amber-50',  border: 'border-amber-200',  text: 'text-amber-700',  dot: 'bg-amber-500'  },
  low:    { bg: 'bg-blue-50',   border: 'border-blue-200',   text: 'text-blue-700',   dot: 'bg-blue-500'   },
};

const AISuggestionBadge = ({ title, description, onAccept }) => {
  const { suggestPriority, loading, error } = useAI();
  const [suggestion, setSuggestion] = useState(null);
  const [expanded,   setExpanded  ] = useState(true);

  const handleSuggest = async () => {
    if (!title?.trim() || !description?.trim()) return;
    setSuggestion(null);
    try {
      const result = await suggestPriority(title, description);
      setSuggestion(result);
      setExpanded(true);
    } catch {
      // error shown via hook
    }
  };

  const handleAccept = () => {
    if (suggestion?.priority) onAccept(suggestion.priority);
    setSuggestion(null);
  };

  const colors = suggestion ? PRIORITY_COLORS[suggestion.priority] || PRIORITY_COLORS.low : null;

  return (
    <div className="ai-suggestion-wrap">
      {/* Trigger button */}
      <button
        type="button"
        onClick={handleSuggest}
        disabled={loading || !title?.trim() || !description?.trim()}
        className="ai-suggest-btn"
        title="Get AI priority suggestion based on title & description"
      >
        {loading
          ? <LuLoader className="ai-spin" />
          : <LuSparkles className="ai-sparkle" />}
        {loading ? 'Analysing…' : '✨ Suggest Priority'}
      </button>

      {/* Error */}
      {error && (
        <p className="ai-error">{error}</p>
      )}

      {/* Suggestion card */}
      {suggestion && (
        <div className={`ai-card ${colors.bg} ${colors.border}`}>
          <div className="ai-card-header">
            <div className="ai-card-left">
              <span className={`ai-dot ${colors.dot}`} />
              <span className={`ai-priority-label ${colors.text}`}>
                {suggestion.priority.toUpperCase()} Priority recommended
              </span>
            </div>
            <button
              type="button"
              className="ai-expand-btn"
              onClick={() => setExpanded(v => !v)}
            >
              {expanded ? <LuChevronUp size={14} /> : <LuChevronDown size={14} />}
            </button>
          </div>

          {expanded && (
            <>
              <p className="ai-reason">🤖 {suggestion.reason}</p>
              <div className="ai-actions">
                <button
                  type="button"
                  className="ai-accept-btn"
                  onClick={handleAccept}
                >
                  ✅ Use {suggestion.priority} priority
                </button>
                <button
                  type="button"
                  className="ai-dismiss-btn"
                  onClick={() => setSuggestion(null)}
                >
                  Dismiss
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default AISuggestionBadge;
