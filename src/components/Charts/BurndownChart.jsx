import React from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from 'recharts';

// ─────────────────────────────────────────────────────────────────────────────
// BurndownChart — Ideal vs Actual remaining tasks over time
// Props:
//   data  Array<{ date, ideal, actual }>
// ─────────────────────────────────────────────────────────────────────────────

const CustomTip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="analytics-tooltip">
      <p className="analytics-tooltip-label">{label}</p>
      {payload.map(p => (
        <p key={p.dataKey} style={{ color: p.color }} className="analytics-tooltip-row">
          {p.name}: <strong>{p.value}</strong>
        </p>
      ))}
    </div>
  );
};

const BurndownChart = ({ data = [] }) => (
  <ResponsiveContainer width="100%" height={280}>
    <LineChart data={data} margin={{ top: 8, right: 16, left: -10, bottom: 0 }}>
      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
      <XAxis
        dataKey="date"
        tick={{ fontSize: 11, fill: '#94a3b8' }}
        stroke="none"
        interval="preserveStartEnd"
      />
      <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} stroke="none" />
      <Tooltip content={<CustomTip />} />
      <Legend
        wrapperStyle={{ fontSize: 12, color: '#64748b', paddingTop: 8 }}
      />
      <Line
        type="monotone"
        dataKey="ideal"
        name="Ideal"
        stroke="#c7d2fe"
        strokeWidth={2}
        strokeDasharray="6 3"
        dot={false}
      />
      <Line
        type="monotone"
        dataKey="actual"
        name="Actual"
        stroke="#6366f1"
        strokeWidth={2.5}
        dot={{ r: 3, fill: '#6366f1', strokeWidth: 0 }}
        activeDot={{ r: 5 }}
      />
    </LineChart>
  </ResponsiveContainer>
);

export default BurndownChart;
