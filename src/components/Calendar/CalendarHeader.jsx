import React from 'react';
import { LuChevronLeft, LuChevronRight, LuPlus } from 'react-icons/lu';
import moment from 'moment';

const CalendarHeader = ({
  currentDate,
  view,
  onNavigate,
  onViewChange,
  onMonthChange,
  onYearChange,
  onAddEventClick
}) => {
  const months = moment.months();
  const currentYear = moment().year();
  const years = Array.from({ length: 11 }, (_, i) => currentYear - 5 + i); // 5 years back and 5 years forward

  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-5 bg-white/70 backdrop-blur-md border-b border-slate-200/50 sticky top-0 z-10">
      {/* Navigation Controls */}
      <div className="flex items-center gap-3">
        <div className="flex items-center bg-slate-100/80 p-0.5 rounded-xl border border-slate-200/30">
          <button
            onClick={() => onNavigate('prev')}
            className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-white rounded-lg transition-all"
            title="Previous"
          >
            <LuChevronLeft size={16} />
          </button>
          <button
            onClick={() => onNavigate('today')}
            className="px-3 py-1 text-xs font-bold text-slate-600 hover:text-slate-900 hover:bg-white rounded-lg transition-all"
          >
            Today
          </button>
          <button
            onClick={() => onNavigate('next')}
            className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-white rounded-lg transition-all"
            title="Next"
          >
            <LuChevronRight size={16} />
          </button>
        </div>
        
        {/* Month & Year Select Jump Dropdowns */}
        <div className="flex items-center gap-1.5 ml-2">
          <select
            value={moment(currentDate).month()}
            onChange={(e) => onMonthChange(parseInt(e.target.value))}
            className="bg-slate-100/85 hover:bg-slate-150/90 border border-slate-200/40 text-slate-700 text-xs font-extrabold rounded-xl px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer transition-all"
          >
            {months.map((m, idx) => (
              <option key={idx} value={idx}>{m}</option>
            ))}
          </select>
          <select
            value={moment(currentDate).year()}
            onChange={(e) => onYearChange(parseInt(e.target.value))}
            className="bg-slate-100/85 hover:bg-slate-150/90 border border-slate-200/40 text-slate-700 text-xs font-extrabold rounded-xl px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 cursor-pointer transition-all"
          >
            {years.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </div>

      {/* View Switcher and Action Button */}
      <div className="flex items-center gap-3 self-end sm:self-auto">
        <div className="flex items-center bg-slate-100/80 p-0.5 rounded-xl border border-slate-200/30">
          {['month', 'week', 'day', 'agenda'].map((v) => (
            <button
              key={v}
              onClick={() => onViewChange(v)}
              className={`px-3 py-1 text-xs font-bold capitalize rounded-lg transition-all ${
                view === v
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-850 hover:bg-white/50'
              }`}
            >
              {v}
            </button>
          ))}
        </div>

        <button
          onClick={onAddEventClick}
          className="flex items-center gap-1.5 px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-indigo-600/15 hover:-translate-y-0.5"
        >
          <LuPlus size={14} />
          <span>New Event</span>
        </button>
      </div>
    </div>
  );
};

export default CalendarHeader;
