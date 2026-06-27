import React, { useState, useEffect } from 'react';
import { LuClock, LuX, LuCalendar, LuZap } from 'react-icons/lu';
import moment from 'moment';

// Quick-select presets
const PRESETS = [
  { label: 'In 30 minutes', getValue: () => moment().add(30, 'minutes').toISOString() },
  { label: 'In 1 hour',     getValue: () => moment().add(1, 'hour').toISOString() },
  { label: 'In 3 hours',    getValue: () => moment().add(3, 'hours').toISOString() },
  { label: 'Tomorrow 9 AM', getValue: () => moment().add(1, 'day').startOf('day').hour(9).toISOString() },
  { label: 'Monday 9 AM',   getValue: () => {
    const next = moment();
    const daysUntilMonday = (8 - next.day()) % 7 || 7;
    return next.add(daysUntilMonday, 'days').startOf('day').hour(9).toISOString();
  }},
];

export const ScheduleSendModal = ({ message, onSchedule, onClose }) => {
  const [selectedPreset, setSelectedPreset] = useState(null);
  const [customDateTime, setCustomDateTime] = useState('');
  const [error, setError] = useState('');

  // Build the min value for datetime-local input (now + 1 minute)
  const minDateTime = moment().add(1, 'minute').format('YYYY-MM-DDTHH:mm');

  const handlePresetClick = (preset, idx) => {
    setSelectedPreset(idx);
    setCustomDateTime('');
    setError('');
  };

  const handleCustomChange = (e) => {
    setCustomDateTime(e.target.value);
    setSelectedPreset(null);
    setError('');
  };

  const handleConfirm = () => {
    let scheduledAt = null;

    if (selectedPreset !== null) {
      scheduledAt = PRESETS[selectedPreset].getValue();
    } else if (customDateTime) {
      scheduledAt = new Date(customDateTime).toISOString();
    }

    if (!scheduledAt) {
      setError('Please select a time to schedule your message.');
      return;
    }
    if (new Date(scheduledAt) <= new Date()) {
      setError('Scheduled time must be in the future.');
      return;
    }

    onSchedule(scheduledAt);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-zinc-950 rounded-3xl shadow-2xl border border-slate-200 dark:border-zinc-800 w-full max-w-sm p-6 animate-scale-in">
        
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-indigo-100 dark:bg-indigo-950 flex items-center justify-center">
              <LuClock size={18} className="text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 dark:text-zinc-100 text-sm">Schedule Message</h3>
              <p className="text-[10px] text-slate-400 dark:text-zinc-500">Pick when this message should be sent</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-slate-100 dark:hover:bg-zinc-900 rounded-xl text-slate-400 transition-colors"
          >
            <LuX size={15} />
          </button>
        </div>

        {/* Message Preview */}
        <div className="bg-slate-50 dark:bg-zinc-900 rounded-2xl p-3 mb-4 border border-slate-100 dark:border-zinc-800">
          <p className="text-[10px] uppercase font-bold text-slate-400 mb-1.5">Message to schedule</p>
          <p className="text-xs text-slate-700 dark:text-zinc-200 line-clamp-3 leading-relaxed">
            {message || <span className="italic text-slate-400">No message content</span>}
          </p>
        </div>

        {/* Quick Presets */}
        <div className="flex flex-col gap-1.5 mb-4">
          <label className="text-[10px] uppercase font-bold text-slate-400 dark:text-zinc-500 flex items-center gap-1.5">
            <LuZap size={10} />
            Quick Schedule
          </label>
          <div className="grid grid-cols-2 gap-1.5">
            {PRESETS.map((preset, idx) => (
              <button
                key={preset.label}
                onClick={() => handlePresetClick(preset, idx)}
                className={`text-left px-3 py-2 rounded-xl text-[11px] font-semibold border transition-all cursor-pointer ${
                  selectedPreset === idx
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-200'
                    : 'border-slate-200 dark:border-zinc-800 text-slate-600 dark:text-zinc-300 hover:border-indigo-300 hover:bg-indigo-50/50 dark:hover:bg-indigo-950/30'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        {/* Custom Date/Time */}
        <div className="mb-5">
          <label className="text-[10px] uppercase font-bold text-slate-400 dark:text-zinc-500 mb-1.5 flex items-center gap-1.5 block">
            <LuCalendar size={10} />
            Custom Date & Time
          </label>
          <input
            type="datetime-local"
            min={minDateTime}
            value={customDateTime}
            onChange={handleCustomChange}
            className={`w-full px-3 py-2.5 rounded-xl border text-xs text-slate-700 dark:text-zinc-200 bg-white dark:bg-zinc-900 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition-all ${
              selectedPreset === null && customDateTime
                ? 'border-indigo-400 ring-2 ring-indigo-500/20'
                : 'border-slate-200 dark:border-zinc-800'
            }`}
          />
        </div>

        {/* Error */}
        {error && (
          <p className="text-[11px] text-rose-600 bg-rose-50 border border-rose-200 rounded-xl px-3 py-2 mb-3">
            {error}
          </p>
        )}

        {/* Selected time display */}
        {(selectedPreset !== null || customDateTime) && (
          <div className="bg-indigo-50/60 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-950 rounded-xl px-3 py-2 mb-4 flex items-center gap-2">
            <LuClock size={13} className="text-indigo-600 dark:text-indigo-400 flex-shrink-0" />
            <span className="text-[11px] font-semibold text-indigo-700 dark:text-indigo-300">
              Will send: {moment(
                selectedPreset !== null
                  ? PRESETS[selectedPreset].getValue()
                  : customDateTime ? new Date(customDateTime).toISOString() : null
              ).format('ddd, MMM D [at] h:mm A')}
            </span>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-800 text-xs font-semibold text-slate-600 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-900 transition-colors cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={selectedPreset === null && !customDateTime}
            className="flex-1 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-extrabold transition-all shadow-md shadow-indigo-200 flex items-center justify-center gap-2 cursor-pointer"
          >
            <LuClock size={13} />
            Schedule
          </button>
        </div>
      </div>
    </div>
  );
};

export default ScheduleSendModal;
