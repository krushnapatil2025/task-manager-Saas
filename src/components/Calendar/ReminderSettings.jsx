import React from 'react';
import { LuBell } from 'react-icons/lu';

const REMINDER_PRESETS = [
  { label: 'At time of event', value: '0' },
  { label: '5 minutes before', value: '5' },
  { label: '15 minutes before', value: '15' },
  { label: '30 minutes before', value: '30' },
  { label: '1 hour before', value: '60' },
  { label: '2 hours before', value: '120' },
  { label: '1 day before', value: '1440' },
];

export const ReminderSettings = ({ value, onChange }) => {
  return (
    <div className="relative">
      <select
        value={value || '15'}
        onChange={(e) => onChange(e.target.value)}
        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-xs font-bold text-slate-700 appearance-none bg-white"
      >
        {REMINDER_PRESETS.map(p => (
          <option key={p.value} value={p.value}>
            {p.label}
          </option>
        ))}
      </select>
      <LuBell className="absolute left-3.5 top-3.5 text-slate-400" size={14} />
    </div>
  );
};

export default ReminderSettings;
