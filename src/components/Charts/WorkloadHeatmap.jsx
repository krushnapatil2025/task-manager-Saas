import React from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from 'recharts';

// ─────────────────────────────────────────────────────────────────────────────
// WorkloadHeatmap — horizontal bar chart showing active task count per member
// Props:
//   data  Array<{ name, count, avatar? }>
// ─────────────────────────────────────────────────────────────────────────────

const COLORS = [
  '#6366f1', '#8b5cf6', '#a78bfa', '#c4b5fd',
  '#818cf8', '#93c5fd', '#7dd3fc', '#6ee7b7',
];

const getBarColor = (count) => {
  if (count >= 8) return '#ef4444';
  if (count >= 5) return '#f59e0b';
  return '#6366f1';
};

const CustomTip = ({ active, payload }) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="analytics-tooltip">
      <p className="analytics-tooltip-label">{d.name}</p>
      <p className="analytics-tooltip-row" style={{ color: getBarColor(d.count) }}>
        Active tasks: <strong>{d.count}</strong>
      </p>
      {d.count >= 8 && (
        <p style={{ color: '#ef4444', fontSize: 11 }}>⚠️ Overloaded</p>
      )}
    </div>
  );
};

const WorkloadHeatmap = ({ data = [] }) => {
  if (!data.length) return (
    <div className="analytics-empty">No active task assignments found.</div>
  );

  return (
    <ResponsiveContainer width="100%" height={Math.max(200, data.length * 44)}>
      <BarChart
        layout="vertical"
        data={data}
        margin={{ top: 4, right: 24, left: 8, bottom: 4 }}
      >
        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
        <XAxis
          type="number"
          tick={{ fontSize: 11, fill: '#94a3b8' }}
          stroke="none"
          allowDecimals={false}
        />
        <YAxis
          type="category"
          dataKey="name"
          tick={{ fontSize: 12, fill: '#475569', fontWeight: 600 }}
          stroke="none"
          width={100}
        />
        <Tooltip content={<CustomTip />} cursor={{ fill: 'rgba(99,102,241,0.04)' }} />
        <Bar dataKey="count" radius={[0, 8, 8, 0]} maxBarSize={28}>
          {data.map((entry, i) => (
            <Cell key={i} fill={getBarColor(entry.count)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
};

export default WorkloadHeatmap;
