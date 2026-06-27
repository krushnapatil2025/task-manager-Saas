import React from 'react';
import moment from 'moment';

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const WeekView = ({
  currentDate,
  events = [],
  holidays = [],
  onEventClick
}) => {
  const startOfWeek = moment(currentDate).startOf('week');
  const days = Array.from({ length: 7 }, (_, i) => moment(startOfWeek).add(i, 'days'));
  const today = moment();

  // Helper to calculate event positioning in pixels
  const getEventStyle = (evt) => {
    const start = moment(evt.start_at);
    const end = moment(evt.end_at);
    const startHour = start.hours();
    const startMin = start.minutes();
    const durationHrs = moment.duration(end.diff(start)).asHours();

    const rowHeight = 60; // height of one hour slot in pixels
    const top = (startHour + startMin / 60) * rowHeight;
    const height = Math.max(durationHrs * rowHeight, 25); // min height of 25px

    const eventColor = evt.color || 'var(--brand)';

    return {
      top: `${top}px`,
      height: `${height}px`,
      borderLeftColor: eventColor,
      backgroundColor: `color-mix(in srgb, ${eventColor} 12%, transparent)`,
      color: eventColor
    };
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-white dark:bg-zinc-950 overflow-hidden">
      {/* Header columns */}
      <div className="grid grid-cols-[60px_1fr] border-b border-slate-200/60 dark:border-zinc-800/80 bg-white/70 dark:bg-zinc-900/70 backdrop-blur-md sticky top-0 z-20">
        <div className="py-3 text-[10px] font-extrabold text-slate-400 dark:text-zinc-500 text-center uppercase tracking-wider">
          Time
        </div>
        <div className="grid grid-cols-7 gap-[1px] bg-slate-200/10 dark:bg-zinc-950">
          {days.map((day, idx) => {
            const isToday = day.isSame(today, 'day');
            const isSunday = idx === 0;
            const hasHoliday = holidays.some(h => moment(h.date).isSame(day, 'day'));
            const isRedDay = isSunday || hasHoliday;
            return (
              <div
                key={idx}
                className={`py-2 text-center flex flex-col items-center gap-0.5 border-r border-slate-200/30 dark:border-zinc-800/40 ${
                  isToday ? 'bg-indigo-50/15 dark:bg-indigo-950/10' : isRedDay ? 'bg-red-50/20 dark:bg-red-950/10' : ''
                }`}
              >
                <span className={`text-[10px] font-extrabold uppercase ${isRedDay ? 'text-red-500 dark:text-red-400 font-black' : 'text-slate-400 dark:text-zinc-500'}`}>
                  {WEEKDAYS[idx]}
                </span>
                <span className={`text-xs font-black w-6 h-6 flex items-center justify-center rounded-full ${
                  isToday
                    ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/20'
                    : isRedDay
                    ? 'text-red-500 dark:text-red-400 font-bold'
                    : 'text-slate-700 dark:text-zinc-300'
                }`}>
                  {day.date()}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* All-Day / Holidays Row */}
      {days.some(day => holidays.some(h => moment(h.date).isSame(day, 'day'))) && (
        <div className="grid grid-cols-[60px_1fr] border-b border-slate-200/60 dark:border-zinc-800/80 bg-slate-50/30 dark:bg-zinc-900/30">
          <div className="py-2 text-[9px] font-extrabold text-red-550 dark:text-red-400 text-center uppercase tracking-widest flex items-center justify-center border-r border-slate-200/40 dark:border-zinc-800/40">
            Holidays
          </div>
          <div className="grid grid-cols-7 gap-[1px] bg-slate-200/10 dark:bg-zinc-950">
            {days.map((day, idx) => {
              const dayHolidays = holidays.filter(h => moment(h.date).isSame(day, 'day'));
              const isSunday = idx === 0;
              const hasHoliday = dayHolidays.length > 0;
              const isRedDay = isSunday || hasHoliday;
              return (
                <div key={idx} className={`p-1.5 flex flex-col gap-1 border-r border-slate-200/30 dark:border-zinc-800/40 ${isRedDay ? 'bg-red-50/30 dark:bg-rose-950/10' : 'bg-white/80 dark:bg-zinc-900/80'}`}>
                  {dayHolidays.map(hol => (
                    <div
                      key={hol.id}
                      className="text-[9px] font-bold px-1.5 py-0.5 rounded border-l-2 border-l-red-500 bg-red-50/40 dark:bg-rose-950/20 text-red-700 dark:text-rose-350 flex items-center gap-1 truncate select-none shadow-sm"
                      title={`🌴 Public Holiday: ${hol.name}${hol.is_optional ? ' (Optional)' : ''}`}
                    >
                      <span className="truncate">🌴 {hol.name}</span>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Grid timelines */}
      <div className="flex-1 overflow-y-auto custom-scrollbar relative h-[500px]">
        <div className="grid grid-cols-[60px_1fr] relative min-h-[1440px]">
          {/* Hour Labels */}
          <div className="border-r border-slate-200/60 dark:border-zinc-800/65 bg-slate-50/40 dark:bg-zinc-900/40 text-center">
            {HOURS.map((hr) => (
              <div
                key={hr}
                className="h-[60px] text-[9px] font-bold text-slate-400 dark:text-zinc-550 pr-2 pt-1 flex justify-end border-b border-slate-100 dark:border-zinc-900/40"
              >
                {moment().hour(hr).format('h A')}
              </div>
            ))}
          </div>

          {/* Time Slot Columns */}
          <div className="grid grid-cols-7 relative divide-x divide-slate-100 dark:divide-zinc-800/40">
            {days.map((day, dayIdx) => {
              // Filter events for this specific day
              const dayEvents = events.filter((e) => moment(e.start_at).isSame(day, 'day'));
              const isSunday = dayIdx === 0;
              const hasHoliday = holidays.some(h => moment(h.date).isSame(day, 'day'));
              const isRedDay = isSunday || hasHoliday;

              return (
                <div key={dayIdx} className={`relative h-full ${isRedDay ? 'bg-red-50/15 dark:bg-red-950/5' : 'bg-white/50 dark:bg-zinc-900/20'}`}>
                  {/* Hour horizontal borders */}
                  {HOURS.map((hr) => (
                    <div
                      key={hr}
                      className="h-[60px] border-b border-slate-100/70 dark:border-zinc-800/30"
                    />
                  ))}

                  {/* Absolute Positioned Events */}
                  {dayEvents.map((evt) => {
                    const eventEmoji = evt.is_private ? '🔒' : evt.meeting_url ? ' 📞' : (evt.event_type === 'meeting' || evt.title?.toLowerCase().includes('sync') || evt.title?.toLowerCase().includes('standup') || evt.title?.toLowerCase().includes('meeting')) ? '👥' : '📅';
                    return (
                      <button
                        key={evt.id}
                        onClick={() => onEventClick(evt)}
                        style={getEventStyle(evt)}
                        className="absolute left-1 right-1 rounded-lg border-l-3 p-1.5 text-left text-[9px] font-extrabold shadow-sm hover:shadow dark:shadow-zinc-950/50 transition-all hover:brightness-95 dark:hover:brightness-110 cursor-pointer select-none overflow-hidden"
                      >
                        <div className="truncate mb-0.5 flex items-center gap-1">
                          {evt.recurrence_rule && (
                            <span className="text-indigo-500 mr-1" title="Recurring Event">🔁</span>
                          )}
                          <span className="text-slate-800 dark:text-zinc-200">{eventEmoji} {evt.title}</span>
                        </div>
                        <div className="text-[8px] opacity-75 text-slate-500 dark:text-zinc-400">
                          {moment(evt.start_at).format('h:mm A')} - {moment(evt.end_at).format('h:mm A')}
                        </div>
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default WeekView;
