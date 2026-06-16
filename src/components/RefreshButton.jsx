import React, { useState } from 'react';
import { LuRefreshCcw } from 'react-icons/lu';

// ─────────────────────────────────────────────────────────────────────────────
// RefreshButton — reusable refresh trigger with spin animation
// Props:
//   onRefresh  async () => void
//   label      string (optional)
//   size       'sm' | 'md' (default 'md')
// ─────────────────────────────────────────────────────────────────────────────

const RefreshButton = ({ onRefresh, label = 'Refresh', size = 'md', id }) => {
  const [spinning, setSpinning] = useState(false);

  const handleClick = async () => {
    if (spinning) return;
    setSpinning(true);
    try {
      await onRefresh();
    } finally {
      setTimeout(() => setSpinning(false), 600);
    }
  };

  return (
    <button
      id={id}
      onClick={handleClick}
      disabled={spinning}
      className={`refresh-btn ${spinning ? 'spin' : ''}`}
      title="Refresh data"
      style={size === 'sm' ? { padding: '3px 8px', fontSize: '11px' } : undefined}
    >
      <LuRefreshCcw
        className="refresh-icon"
        style={spinning ? { animation: 'ai-spin 0.6s linear' } : undefined}
        size={size === 'sm' ? 12 : 13}
      />
      {label && <span>{label}</span>}
    </button>
  );
};

export default RefreshButton;
