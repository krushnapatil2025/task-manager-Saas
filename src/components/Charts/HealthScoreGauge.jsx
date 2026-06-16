import React from 'react';

// ─────────────────────────────────────────────────────────────────────────────
// HealthScoreGauge — SVG arc gauge showing workspace health 0-100
// Props:
//   score  number (0-100)
// ─────────────────────────────────────────────────────────────────────────────

const getColor = (score) => {
  if (score >= 75) return '#22c55e';  // green
  if (score >= 50) return '#f59e0b';  // amber
  if (score >= 25) return '#f97316';  // orange
  return '#ef4444';                    // red
};

const getLabel = (score) => {
  if (score >= 75) return 'Excellent';
  if (score >= 50) return 'Good';
  if (score >= 25) return 'Fair';
  return 'At Risk';
};

const polarToCartesian = (cx, cy, r, deg) => {
  const rad = ((deg - 90) * Math.PI) / 180;
  return {
    x: cx + r * Math.cos(rad),
    y: cy + r * Math.sin(rad),
  };
};

const arcPath = (cx, cy, r, start, end) => {
  const s   = polarToCartesian(cx, cy, r, start);
  const e   = polarToCartesian(cx, cy, r, end);
  const big = end - start > 180 ? 1 : 0;
  return `M ${s.x} ${s.y} A ${r} ${r} 0 ${big} 1 ${e.x} ${e.y}`;
};

const HealthScoreGauge = ({ score = 0 }) => {
  const clampedScore = Math.max(0, Math.min(100, score));
  const color        = getColor(clampedScore);
  const label        = getLabel(clampedScore);

  // Arc: -135° to +135° = 270° sweep
  const START = -135;
  const END   = 135;
  const sweep = START + (clampedScore / 100) * 270;

  const CX = 100, CY = 100, R = 75;

  return (
    <div className="health-gauge-wrap">
      <svg viewBox="0 0 200 160" className="health-gauge-svg">
        {/* Background arc */}
        <path
          d={arcPath(CX, CY, R, START, END)}
          fill="none"
          stroke="#f1f5f9"
          strokeWidth={14}
          strokeLinecap="round"
        />
        {/* Filled arc */}
        {clampedScore > 0 && (
          <path
            d={arcPath(CX, CY, R, START, sweep)}
            fill="none"
            stroke={color}
            strokeWidth={14}
            strokeLinecap="round"
            style={{ transition: 'all 0.8s cubic-bezier(0.34,1.56,0.64,1)' }}
          />
        )}
        {/* Score text */}
        <text
          x={CX}
          y={CY + 10}
          textAnchor="middle"
          fontSize="32"
          fontWeight="800"
          fill={color}
          fontFamily="'Plus Jakarta Sans', sans-serif"
        >
          {clampedScore}
        </text>
        <text
          x={CX}
          y={CY + 28}
          textAnchor="middle"
          fontSize="10"
          fill="#94a3b8"
          fontFamily="'Plus Jakarta Sans', sans-serif"
          fontWeight="600"
          textTransform="uppercase"
          letterSpacing="1"
        >
          / 100
        </text>
      </svg>

      {/* Label */}
      <div className="health-gauge-label">
        <span className="health-gauge-status" style={{ color }}>
          {label}
        </span>
        <span className="health-gauge-desc">Workspace Health</span>
      </div>

      {/* Tick labels */}
      <div className="health-gauge-ticks">
        <span style={{ color: '#ef4444' }}>0</span>
        <span style={{ color: '#f59e0b' }}>50</span>
        <span style={{ color: '#22c55e' }}>100</span>
      </div>
    </div>
  );
};

export default HealthScoreGauge;
