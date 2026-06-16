import React from 'react';
import moment from 'moment';
import { LuChevronLeft, LuChevronRight } from 'react-icons/lu';

const MiniCalendar = ({ currentDate, onChangeDate }) => {
  const [activeMonth, setActiveMonth] = React.useState(moment(currentDate));

  const startOfMonth = moment(activeMonth).startOf('month');
  const startDayOfWeek = startOfMonth.day();
  const daysInMonth = activeMonth.daysInMonth();
  
  const days = [];
  // Fill empty spaces before start of month
  for (let i = 0; i < startDayOfWeek; i++) {
    days.push(null);
  }
  // Fill dates of the month
  for (let i = 1; i <= daysInMonth; i++) {
    days.push(moment(activeMonth).date(i));
  }

  const navigateMonth = (direction) => {
    if (direction === 'prev') {
      setActiveMonth(moment(activeMonth).subtract(1, 'month'));
    } else {
      setActiveMonth(moment(activeMonth).add(1, 'month'));
    }
  };

  return (
    <div className="bg-white border border-slate-200/60 rounded-xl p-3 shadow-sm w-[210px] select-none text-[11px]">
      <div className="flex items-center justify-between mb-2 pb-1.5 border-b border-slate-100">
        <span className="font-extrabold text-slate-800">
          {activeMonth.format('MMMM YYYY')}
        </span>
        <div className="flex items-center gap-1">
          <button 
            type="button"
            onClick={() => navigateMonth('prev')}
            className="p-1 hover:bg-slate-100 rounded text-slate-500"
          >
            <LuChevronLeft size={12} />
          </button>
          <button 
            type="button"
            onClick={() => navigateMonth('next')}
            className="p-1 hover:bg-slate-100 rounded text-slate-500"
          >
            <LuChevronRight size={12} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center font-extrabold text-slate-400 mb-1 text-[9px]">
        {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
          <div key={i}>{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {days.map((day, idx) => {
          if (!day) return <div key={idx} />;

          const isSelected = day.isSame(currentDate, 'day');
          const isToday = day.isSame(moment(), 'day');

          return (
            <button
              key={idx}
              type="button"
              onClick={() => onChangeDate(day)}
              className={`w-6 h-6 rounded-full flex items-center justify-center font-bold transition-all ${
                isSelected 
                  ? 'bg-indigo-600 text-white shadow-sm' 
                  : isToday 
                    ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' 
                    : 'hover:bg-slate-100 text-slate-700'
              }`}
            >
              {day.date()}
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default MiniCalendar;
