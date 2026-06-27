import React from 'react';
import moment from 'moment';
import EventChip from './EventChip';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const MonthView = ({
  currentDate,
  events = [],
  tasks = [],
  holidays = [],
  onEventClick,
  onTaskClick
}) => {
  const getGridDays = () => {
    const startOfMonth = moment(currentDate).startOf('month');
    const startDayOfWeek = startOfMonth.day();
    const daysInCurrentMonth = currentDate.daysInMonth();
    const days = [];

    // 1. Padding from previous month
    const prevMonth = moment(currentDate).subtract(1, 'month');
    const prevMonthDaysCount = prevMonth.daysInMonth();
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      days.push({ date: moment(prevMonth).date(prevMonthDaysCount - i), isCurrentMonth: false });
    }

    // 2. Current month's days
    for (let i = 1; i <= daysInCurrentMonth; i++) {
      days.push({ date: moment(currentDate).date(i), isCurrentMonth: true });
    }

    // 3. Padding for next month (complete 6-week grid = 42 cells)
    const remainingCells = 42 - days.length;
    const nextMonth = moment(currentDate).add(1, 'month');
    for (let i = 1; i <= remainingCells; i++) {
      days.push({ date: moment(nextMonth).date(i), isCurrentMonth: false });
    }

    return days;
  };

  const gridDays = getGridDays();
  const today = moment();

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50/50 dark:bg-zinc-950">
      {/* Weekdays Headers */}
      <div className="grid grid-cols-7 border-b border-slate-200/50 dark:border-zinc-800/80 bg-white/70 dark:bg-zinc-900/70 backdrop-blur-md py-2 text-center text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
        {WEEKDAYS.map((day, idx) => (
          <div key={day} className={`py-1 ${idx === 0 ? 'text-red-500 dark:text-red-400 font-black' : ''}`}>
            {day}
          </div>
        ))}
      </div>

      {/* Grid cells */}
      <div className="grid grid-cols-7 grid-rows-6 flex-1 min-h-0 bg-slate-200/10 dark:bg-zinc-950 gap-[1px]">
        {gridDays.map((day, idx) => {
          const isToday      = day.date.isSame(today, 'day');
          const isCurrentMonth = day.isCurrentMonth;
          const isSunday     = day.date.day() === 0;

          const cellEvents   = events.filter((e) => moment(e.start_at).isSame(day.date, 'day'));
          const cellTasks    = tasks.filter((t) => moment(t.due_date).isSame(day.date, 'day'));
          const cellHolidays = holidays.filter((h) => moment(h.date).isSame(day.date, 'day'));
          const hasHoliday   = cellHolidays.length > 0;

          return (
            <div
              key={idx}
              className={`flex flex-col p-1.5 min-h-[90px] transition-colors relative group select-none ${
                isCurrentMonth 
                  ? 'text-slate-800 dark:text-zinc-200' 
                  : 'text-slate-350 dark:text-zinc-650'
              } ${
                hasHoliday
                  ? 'bg-rose-50/50 dark:bg-rose-950/20 ring-1 ring-inset ring-rose-200/60 dark:ring-rose-900/30'
                  : isToday
                  ? 'bg-indigo-50/15 dark:bg-indigo-950/20 ring-2 ring-indigo-500/20 dark:ring-indigo-500/30'
                  : isSunday
                  ? 'bg-red-50/20 dark:bg-red-950/10 hover:bg-red-100/10 dark:hover:bg-red-900/15'
                  : 'bg-white dark:bg-zinc-900 hover:bg-slate-50/30 dark:hover:bg-zinc-800/50'
              } ${!isCurrentMonth ? 'bg-slate-50/30 dark:bg-zinc-950/40' : ''}`}
            >
              {/* Day number */}
              <div className="flex items-center justify-between mb-1">
                <span
                  className={`text-xs font-extrabold w-5 h-5 flex items-center justify-center rounded-full ${
                    isToday
                      ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/20'
                      : hasHoliday
                      ? 'text-rose-700 dark:text-rose-400 font-black'
                      : isSunday
                      ? 'text-red-500 dark:text-red-400 font-bold'
                      : 'text-slate-700 dark:text-zinc-300'
                  }`}
                >
                  {day.date.date()}
                </span>
                {isToday && (
                  <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-ping absolute top-2 right-2" />
                )}
              </div>

              {/* Content list */}
              <div className="flex-1 flex flex-col gap-1 overflow-y-auto max-h-[110px] custom-scrollbar pb-1">
                {/* ── Public Holidays first ── */}
                {cellHolidays.map((hol) => (
                  <EventChip key={`hol-${hol.id}`} event={hol} onClick={() => {}} isHoliday />
                ))}

                {/* ── Regular Events ── */}
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

