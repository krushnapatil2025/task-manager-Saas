// ─────────────────────────────────────────────────────────────────────────────
// SessionWarningModal.jsx
//
// Premium countdown modal shown 5 minutes before auto-logout.
// Design: dark glass-morphism overlay, consistent with the Strideo brand system.
// ─────────────────────────────────────────────────────────────────────────────

import React, { useEffect, useRef } from 'react';

const formatTime = (totalSeconds) => {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
};

const SessionWarningModal = ({ secondsLeft, onStayLoggedIn, onLogoutNow }) => {
  const progressRef = useRef(null);
  const TOTAL_SECONDS = 5 * 60; // 5 minutes

  useEffect(() => {
    if (progressRef.current) {
      const pct = (secondsLeft / TOTAL_SECONDS) * 100;
      progressRef.current.style.width = `${pct}%`;
    }
  }, [secondsLeft]);

  const isUrgent = secondsLeft <= 60; // last 60 seconds — turns red

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="session-warning-title"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem',
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(6px)',
        WebkitBackdropFilter: 'blur(6px)',
        animation: 'sessionFadeIn 0.3s ease',
      }}
    >
      <style>{`
        @keyframes sessionFadeIn {
          from { opacity: 0; transform: scale(0.95); }
          to   { opacity: 1; transform: scale(1); }
        }
        @keyframes sessionPulse {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.6; }
        }
        .session-modal-card {
          background: linear-gradient(145deg, rgba(30, 30, 50, 0.95), rgba(15, 15, 30, 0.98));
          border: 1px solid rgba(99, 102, 241, 0.3);
          border-radius: 20px;
          box-shadow: 0 24px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.04) inset;
          padding: 2rem 2.5rem;
          max-width: 420px;
          width: 100%;
          text-align: center;
          position: relative;
          overflow: hidden;
        }
        .session-modal-card::before {
          content: '';
          position: absolute;
          top: 0; left: 0; right: 0;
          height: 2px;
          background: linear-gradient(90deg, transparent, rgba(99, 102, 241, 0.8), transparent);
        }
        .session-progress-bar {
          height: 4px;
          background: rgba(255,255,255,0.08);
          border-radius: 2px;
          overflow: hidden;
          margin: 1.5rem 0;
        }
        .session-progress-fill {
          height: 100%;
          border-radius: 2px;
          transition: width 1s linear, background-color 0.5s ease;
        }
        .session-stay-btn {
          background: linear-gradient(135deg, #6366f1, #4f46e5);
          color: #fff;
          border: none;
          border-radius: 10px;
          padding: 0.75rem 1.5rem;
          font-size: 0.925rem;
          font-weight: 600;
          cursor: pointer;
          transition: transform 0.15s, box-shadow 0.15s;
          flex: 1;
        }
        .session-stay-btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 6px 20px rgba(99, 102, 241, 0.5);
        }
        .session-stay-btn:active { transform: translateY(0); }
        .session-logout-btn {
          background: transparent;
          color: rgba(255,255,255,0.5);
          border: 1px solid rgba(255,255,255,0.12);
          border-radius: 10px;
          padding: 0.75rem 1.25rem;
          font-size: 0.875rem;
          font-weight: 500;
          cursor: pointer;
          transition: color 0.2s, border-color 0.2s;
          flex: 0;
          white-space: nowrap;
        }
        .session-logout-btn:hover {
          color: rgba(255, 100, 100, 0.9);
          border-color: rgba(255, 100, 100, 0.3);
        }
      `}</style>

      <div className="session-modal-card">
        {/* Icon */}
        <div style={{
          width: 64,
          height: 64,
          borderRadius: '50%',
          background: isUrgent
            ? 'radial-gradient(circle, rgba(239,68,68,0.2), rgba(239,68,68,0.05))'
            : 'radial-gradient(circle, rgba(99,102,241,0.2), rgba(99,102,241,0.05))',
          border: `2px solid ${isUrgent ? 'rgba(239,68,68,0.4)' : 'rgba(99,102,241,0.4)'}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 1.25rem',
          fontSize: '1.75rem',
          animation: isUrgent ? 'sessionPulse 1s ease-in-out infinite' : 'none',
        }}>
          ⏱️
        </div>

        {/* Title */}
        <h2
          id="session-warning-title"
          style={{
            color: '#fff',
            fontSize: '1.2rem',
            fontWeight: 700,
            margin: '0 0 0.5rem',
            letterSpacing: '-0.01em',
          }}
        >
          Session Expiring Soon
        </h2>

        {/* Subtitle */}
        <p style={{
          color: 'rgba(255,255,255,0.55)',
          fontSize: '0.875rem',
          margin: '0 0 0.25rem',
          lineHeight: 1.5,
        }}>
          You have been inactive. You'll be logged out in
        </p>

        {/* Countdown */}
        <div style={{
          fontSize: '3rem',
          fontWeight: 800,
          letterSpacing: '-0.03em',
          color: isUrgent ? '#f87171' : '#a5b4fc',
          fontVariantNumeric: 'tabular-nums',
          lineHeight: 1.1,
          transition: 'color 0.5s ease',
          animation: isUrgent ? 'sessionPulse 1s ease-in-out infinite' : 'none',
        }}>
          {formatTime(secondsLeft)}
        </div>

        {/* Progress bar */}
        <div className="session-progress-bar">
          <div
            ref={progressRef}
            className="session-progress-fill"
            style={{
              width: `${(secondsLeft / TOTAL_SECONDS) * 100}%`,
              backgroundColor: isUrgent ? '#ef4444' : '#6366f1',
            }}
          />
        </div>

        {/* Body text */}
        <p style={{
          color: 'rgba(255,255,255,0.4)',
          fontSize: '0.8rem',
          margin: '0 0 1.5rem',
        }}>
          Any interaction will keep you signed in automatically.
        </p>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <button className="session-stay-btn" onClick={onStayLoggedIn} autoFocus>
            Stay Logged In
          </button>
          <button className="session-logout-btn" onClick={onLogoutNow}>
            Log Out
          </button>
        </div>
      </div>
    </div>
  );
};

export default SessionWarningModal;
