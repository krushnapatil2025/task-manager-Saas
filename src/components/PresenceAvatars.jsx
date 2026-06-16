import React from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// PresenceAvatars — shows who is currently viewing this task (live)
// Props:
//   users   Array<{ id, name, avatar }>
// ─────────────────────────────────────────────────────────────────────────────

const COLORS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f59e0b',
  '#22c55e', '#14b8a6', '#f97316', '#3b82f6',
];

const PresenceAvatars = ({ users = [] }) => {
  if (!users.length) return null;

  return (
    <div className="presence-wrap" title={`${users.length} viewing now`}>
      <span className="presence-label">👁</span>
      <div className="presence-avatars">
        {users.slice(0, 5).map((u, i) => (
          u.avatar
            ? (
              <img
                key={u.id}
                src={u.avatar}
                alt={u.name}
                className="presence-avatar"
                style={{ zIndex: 10 - i }}
                title={u.name}
              />
            ) : (
              <div
                key={u.id}
                className="presence-avatar presence-avatar--fallback"
                style={{ zIndex: 10 - i, background: COLORS[i % COLORS.length] }}
                title={u.name}
              >
                {u.name?.[0]?.toUpperCase()}
              </div>
            )
        ))}
        {users.length > 5 && (
          <div className="presence-avatar presence-avatar--more">
            +{users.length - 5}
          </div>
        )}
      </div>
    </div>
  );
};

export default PresenceAvatars;
