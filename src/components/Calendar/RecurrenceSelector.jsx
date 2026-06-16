import React from 'react';
import { LuRepeat } from 'react-icons/lu';

export const RecurrenceSelector = ({ value, onChange }) => {
  return (
    <div className="relative">
      <select
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-xs font-bold text-slate-700 appearance-none bg-white"
      >
        <option value="">Does not repeat</option>
        <option value="daily">Daily</option>
        <option value="weekly">Weekly</option>
        <option value="monthly">Monthly</option>
        <option value="custom">Custom (RRULE)</option>
      </select>
      <LuRepeat className="absolute left-3.5 top-3.5 text-slate-400" size={14} />
    </div>
  );
};

export default RecurrenceSelector;
