import React from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// UnreadBadge — red dot / count badge for sidebar chat items
// Props:
//   count  number
// ─────────────────────────────────────────────────────────────────────────────

const UnreadBadge = ({ count = 0 }) => {
  if (!count || count <= 0) return null;
  return (
    <span className="unread-badge">
      {count > 99 ? '99+' : count}
    </span>
  );
};

export default UnreadBadge;
