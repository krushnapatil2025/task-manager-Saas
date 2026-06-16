import React from 'react';
import moment from 'moment';

const HOURS = Array.from({ length: 24 }, (_, i) => i);

const DayView = ({
  currentDate,
  events = [],
  onEventClick
}) => {
  const dayEvents = events.filter((e) => moment(e.start_at).isSame(currentDate, 'day'));
  const isToday = moment(currentDate).isSame(moment(), 'day');

  // Helper to calculate event positioning in pixels
  const getEventStyle = (evt) => {
    const start = moment(evt.start_at);
    const end = moment(evt.end_at);
    const startHour = start.hours();
    const startMin = start.minutes();
    const durationHrs = moment.duration(end.diff(start)).asHours();

    const rowHeight = 70; // taller rows for Day view details
    const top = (startHour + startMin / 60) * rowHeight;
    const height = Math.max(durationHrs * rowHeight, 30);

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
      {/* Day header */}
      <div className="flex items-center gap-3 p-4 border-b border-slate-200/60 bg-white/70 backdrop-blur-md sticky top-0 z-20">
        <span className={`text-2xl font-black w-10 h-10 flex items-center justify-center rounded-full ${
          isToday ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/20' : 'bg-slate-100 text-slate-700'
        }`}>
          {moment(currentDate).date()}
        </span>
        <div>
          <h3 className="text-sm font-extrabold text-slate-800">
            {moment(currentDate).format('dddd')}
          </h3>
          <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
            {moment(currentDate).format('MMMM YYYY')}
          </p>
        </div>
      </div>

      {/* Day timeline */}
      <div className="flex-1 overflow-y-auto custom-scrollbar relative h-[500px]">
        <div className="grid grid-cols-[70px_1fr] relative min-h-[1680px]">
          {/* Hour Labels */}
          <div className="border-r border-slate-200/60 bg-slate-50/40 text-center">
            {HOURS.map((hr) => (
              <div 
                key={hr} 
                className="h-[70px] text-[10px] font-bold text-slate-400 pr-3 pt-1.5 flex justify-end border-b border-slate-100"
              >
                {moment().hour(hr).format('h:00 A')}
              </div>
            ))}
          </div>

          {/* Time Slot Columns */}
          <div className="relative bg-white/50">
            {/* Hour horizontal borders */}
            {HOURS.map((hr) => (
              <div 
                key={hr} 
                className="h-[70px] border-b border-slate-100/70"
              />
            ))}

            {/* Current Time indicator line */}
            {isToday && (
              <div 
                style={{ 
                  top: `${(moment().hours() + moment().minutes() / 60) * 70}px` 
                }}
                className="absolute left-0 right-0 border-t-2 border-rose-500 z-10 flex items-center"
              >
                <span className="w-2 h-2 rounded-full bg-rose-500 -ml-1" />
              </div>
            )}

            {/* Absolute Positioned Events */}
            {dayEvents.map((evt) => (
              <button
                key={evt.id}
                onClick={() => onEventClick(evt)}
                style={getEventStyle(evt)}
                className="absolute left-4 right-4 rounded-xl border-l-4 p-3 text-left text-xs font-bold shadow-sm transition-all hover:brightness-95 hover:shadow cursor-pointer select-none overflow-hidden flex flex-col justify-between"
              >
                <div>
                  <div className="font-extrabold truncate text-slate-800 flex items-center gap-1.5">
                    {evt.recurrence_rule && (
                      <span className="text-indigo-550" title="Recurring Event">🔁</span>
                    )}
                    <span>{evt.title}</span>
                  </div>
                  {evt.description && (
                    <div className="text-[10px] opacity-80 mt-0.5 truncate">{evt.description}</div>
                  )}
                </div>
                <div className="text-[9px] opacity-75 mt-1 font-extrabold flex items-center justify-between">
                  <span>
                    {moment(evt.start_at).format('h:mm A')} - {moment(evt.end_at).format('h:mm A')}
                  </span>
                  {evt.location && <span className="truncate max-w-[150px] opacity-90">📍 {evt.location}</span>}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DayView;
