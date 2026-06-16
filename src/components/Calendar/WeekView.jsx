import React from 'react';
import moment from 'moment';

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const WeekView = ({
  currentDate,
  events = [],
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

    return {
      top: `${top}px`,
      height: `${height}px`,
      borderLeftColor: evt.color,
      backgroundColor: `${evt.color}15`,
      color: evt.color
    };
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-white overflow-hidden">
      {/* Header columns */}
      <div className="grid grid-cols-[60px_1fr] border-b border-slate-200/60 bg-white/70 backdrop-blur-md sticky top-0 z-20">
        <div className="py-3 text-[10px] font-extrabold text-slate-400 text-center uppercase tracking-wider">
          Time
        </div>
        <div className="grid grid-cols-7 gap-[1px] bg-slate-200/10">
          {days.map((day, idx) => {
            const isToday = day.isSame(today, 'day');
            return (
              <div 
                key={idx} 
                className={`py-2 text-center flex flex-col items-center gap-0.5 border-r border-slate-200/30 ${
                  isToday ? 'bg-indigo-50/15' : ''
                }`}
              >
                <span className="text-[10px] font-extrabold text-slate-400 uppercase">
                  {WEEKDAYS[idx]}
                </span>
                <span className={`text-xs font-black w-6 h-6 flex items-center justify-center rounded-full ${
                  isToday ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/20' : 'text-slate-700'
                }`}>
                  {day.date()}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Grid timelines */}
      <div className="flex-1 overflow-y-auto custom-scrollbar relative h-[500px]">
        <div className="grid grid-cols-[60px_1fr] relative min-h-[1440px]">
          {/* Hour Labels */}
          <div className="border-r border-slate-200/60 bg-slate-50/40 text-center">
            {HOURS.map((hr) => (
              <div 
                key={hr} 
                className="h-[60px] text-[9px] font-bold text-slate-400 pr-2 pt-1 flex justify-end border-b border-slate-100"
              >
                {moment().hour(hr).format('h A')}
              </div>
            ))}
          </div>

          {/* Time Slot Columns */}
          <div className="grid grid-cols-7 relative divide-x divide-slate-100">
            {days.map((day, dayIdx) => {
              // Filter events for this specific day
              const dayEvents = events.filter((e) => moment(e.start_at).isSame(day, 'day'));

              return (
                <div key={dayIdx} className="relative h-full bg-white/50">
                  {/* Hour horizontal borders */}
                  {HOURS.map((hr) => (
                    <div 
                      key={hr} 
                      className="h-[60px] border-b border-slate-100/70"
                    />
                  ))}

                  {/* Absolute Positioned Events */}
                  {dayEvents.map((evt) => (
                    <button
                      key={evt.id}
                      onClick={() => onEventClick(evt)}
                      style={getEventStyle(evt)}
                      className="absolute left-1 right-1 rounded-lg border-l-3 p-1.5 text-left text-[9px] font-extrabold shadow-sm transition-all hover:brightness-95 hover:shadow cursor-pointer select-none overflow-hidden"
                    >
                      <div className="truncate mb-0.5 flex items-center gap-1">
                        {evt.recurrence_rule && (
                          <span className="text-indigo-500 mr-1" title="Recurring Event">🔁</span>
                        )}
                        <span>{evt.title}</span>
                      </div>
                      <div className="text-[8px] opacity-75">
                        {moment(evt.start_at).format('h:mm A')} - {moment(evt.end_at).format('h:mm A')}
                      </div>
                    </button>
                  ))}
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
