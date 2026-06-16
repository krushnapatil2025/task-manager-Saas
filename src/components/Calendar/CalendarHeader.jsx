import React from 'react';
import { LuChevronLeft, LuChevronRight, LuPlus } from 'react-icons/lu';
import moment from 'moment';

const CalendarHeader = ({
  currentDate,
  view,
  onNavigate,
  onViewChange,
  onAddEventClick
}) => {
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
        
        <h2 className="text-base font-extrabold text-slate-800 tracking-tight ml-2">
          {view === 'day' 
            ? moment(currentDate).format('MMMM D, YYYY') 
            : view === 'week' 
              ? `Week of ${moment(currentDate).startOf('week').format('MMM D, YYYY')}`
              : moment(currentDate).format('MMMM YYYY')
          }
        </h2>
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
