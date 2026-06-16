import React, { useState } from 'react';
import { LuSmile } from 'react-icons/lu';
import FullEmojiPicker from './FullEmojiPicker';

// ─────────────────────────────────────────────────────────────────────────────
// ReactionBar — emoji reaction strip under chat messages
// Props:
//   messageId   string
//   reactions   object  { "👍": 3, "🔥": 1, ... }  (aggregated counts)
//   onReact     (messageId, emoji) => void
// ─────────────────────────────────────────────────────────────────────────────

const ReactionBar = ({ messageId, reactions = {}, onReact }) => {
  const [pickerOpen, setPickerOpen] = useState(false);

  const hasReactions = Object.keys(reactions).some(k => reactions[k] > 0);

  return (
    <div className="reaction-bar">
      {/* Existing reactions */}
      {hasReactions && (
        <div className="reaction-pills">
          {Object.entries(reactions)
            .filter(([, count]) => count > 0)
            .map(([emoji, count]) => (
              <button
                key={emoji}
                className="reaction-pill"
                onClick={() => onReact && onReact(messageId, emoji)}
                title={`React with ${emoji}`}
              >
                {emoji} <span className="reaction-count">{count}</span>
              </button>
            ))}
        </div>
      )}

      {/* Add reaction button */}
      <div className="reaction-add-wrap">
        <button
          className="reaction-add-btn"
          onClick={() => setPickerOpen(v => !v)}
          title="Add reaction"
        >
          <LuSmile size={12} />
        </button>

        {pickerOpen && (
          <div className="absolute bottom-full left-0 z-50 mb-2">
            <FullEmojiPicker
              onSelect={(emoji) => {
                onReact && onReact(messageId, emoji);
                setPickerOpen(false);
              }}
              onClose={() => setPickerOpen(false)}
            />
          </div>
        )}
      </div>
    </div>
  );
};

export default ReactionBar;
