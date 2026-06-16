import React from 'react';
import moment from 'moment';
import EventChip from './EventChip';
import { LuClipboardCheck } from 'react-icons/lu';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const MonthView = ({
  currentDate,
  events = [],
  tasks = [],
  onEventClick,
  onTaskClick
}) => {
  const getGridDays = () => {
    const startOfMonth = moment(currentDate).startOf('month');
    const endOfMonth = moment(currentDate).endOf('month');
    const startDayOfWeek = startOfMonth.day();
    const daysInCurrentMonth = currentDate.daysInMonth();
    
    const days = [];

    // 1. Padding from previous month
    const prevMonth = moment(currentDate).subtract(1, 'month');
    const prevMonthDaysCount = prevMonth.daysInMonth();
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      days.push({
        date: moment(prevMonth).date(prevMonthDaysCount - i),
        isCurrentMonth: false
      });
    }

    // 2. Current month's days
    for (let i = 1; i <= daysInCurrentMonth; i++) {
      days.push({
        date: moment(currentDate).date(i),
        isCurrentMonth: true
      });
    }

    // 3. Padding for next month to complete 6 weeks grid (42 cells)
    const remainingCells = 42 - days.length;
    const nextMonth = moment(currentDate).add(1, 'month');
    for (let i = 1; i <= remainingCells; i++) {
      days.push({
        date: moment(nextMonth).date(i),
        isCurrentMonth: false
      });
    }

    return days;
  };

  const gridDays = getGridDays();
  const today = moment();

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50/50">
      {/* Weekdays Headers */}
      <div className="grid grid-cols-7 border-b border-slate-200/50 bg-white/70 backdrop-blur-md py-2 text-center text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
        {WEEKDAYS.map((day) => (
          <div key={day} className="py-1">
            {day}
          </div>
        ))}
      </div>

      {/* Grid cells */}
      <div className="grid grid-cols-7 grid-rows-6 flex-1 min-h-0 bg-slate-200/10 gap-[1px]">
        {gridDays.map((day, idx) => {
          const isToday = day.date.isSame(today, 'day');
          const isCurrentMonth = day.isCurrentMonth;
          
          // Filter events & tasks for this date
          const cellEvents = events.filter((e) => moment(e.start_at).isSame(day.date, 'day'));
          const cellTasks = tasks.filter((t) => moment(t.due_date).isSame(day.date, 'day'));

          return (
            <div
              key={idx}
              className={`flex flex-col bg-white p-1.5 min-h-[90px] transition-colors relative group select-none ${
                isCurrentMonth ? 'text-slate-800' : 'text-slate-350 bg-slate-50/30'
              } ${isToday ? 'ring-2 ring-indigo-500/20 bg-indigo-50/15' : 'hover:bg-slate-50/30'}`}
            >
              {/* Header inside cell */}
              <div className="flex items-center justify-between mb-1">
                <span
                  className={`text-xs font-extrabold w-5 h-5 flex items-center justify-center rounded-full ${
                    isToday
                      ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/20'
                      : ''
                  }`}
                >
                  {day.date.date()}
                </span>
                
                {isToday && (
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-ping absolute top-2 right-2" />
                )}
              </div>

              {/* Event/Task list container */}
              <div className="flex-1 flex flex-col gap-1 overflow-y-auto max-h-[110px] custom-scrollbar pb-1">
                {/* ── Events ── */}
                {cellEvents.map((evt) => (
                  <EventChip key={evt.id} event={evt} onClick={onEventClick} />
                ))}

                {/* ── Tasks ── */}
                {cellTasks.map((tsk) => (
                  <EventChip key={tsk.id} event={tsk} onClick={onTaskClick} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default MonthView;
