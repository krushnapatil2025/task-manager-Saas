import React from 'react';
import moment from 'moment';
import { LuClock, LuMapPin, LuVideo, LuRefreshCw } from 'react-icons/lu';

const HOURS = Array.from({ length: 24 }, (_, i) => i);

const DayView = ({
  currentDate,
  events = [],
  holidays = [],
  onEventClick
}) => {
  const dayEvents = events.filter((e) => moment(e.start_at).isSame(currentDate, 'day'));
  const dayHolidays = holidays.filter((h) => moment(h.date).isSame(currentDate, 'day'));
  const isToday = moment(currentDate).isSame(moment(), 'day');
  const isSunday = moment(currentDate).day() === 0;

  // Side-by-side positioning algorithm for overlapping events
  const getEventPositioning = (eventsList) => {
    const sorted = [...eventsList].sort((a, b) => new Date(a.start_at) - new Date(b.start_at));
    const columns = [];

    sorted.forEach(evt => {
      let colIdx = columns.findIndex(col => {
        const last = col[col.length - 1];
        return new Date(evt.start_at) >= new Date(last.end_at);
      });

      if (colIdx === -1) {
        columns.push([evt]);
        colIdx = columns.length - 1;
      } else {
        columns[colIdx].push(evt);
      }
      evt.colIdx = colIdx;
    });

    sorted.forEach(evt => {
      let maxCol = evt.colIdx;
      sorted.forEach(other => {
        if (evt.id !== other.id &&
          new Date(evt.start_at) < new Date(other.end_at) &&
          new Date(other.start_at) < new Date(evt.end_at)) {
          maxCol = Math.max(maxCol, other.colIdx);
        }
      });
      evt.totalCols = maxCol + 1;
    });

    return sorted;
  };

  const positionedEvents = getEventPositioning(dayEvents);

  const getEventStyle = (evt) => {
    const start = moment(evt.start_at);
    const end = moment(evt.end_at);
    const startHour = start.hours();
    const startMin = start.minutes();
    const durationHrs = moment.duration(end.diff(start)).asHours();

    const rowHeight = 80; // taller rows for Day view details
    const top = (startHour + startMin / 60) * rowHeight;
    const height = Math.max(durationHrs * rowHeight, 44);

    const colIdx = evt.colIdx ?? 0;
    const totalCols = evt.totalCols ?? 1;

    const widthPct = 94 / totalCols;
    const leftPct = 4 + colIdx * widthPct;

    const eventColor = evt.color || 'var(--brand)';

    return {
      top: `${top}px`,
      height: `${height}px`,
      left: `${leftPct}%`,
      width: `${widthPct - 1}%`,
      borderLeftColor: eventColor,
      backgroundColor: `color-mix(in srgb, ${eventColor} 12%, transparent)`,
      color: eventColor
    };
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-white dark:bg-zinc-950 overflow-hidden">
      {/* Day Header - Clean Monochrome Design */}
      <div className="flex items-center gap-4 p-5 border-b border-slate-150/70 dark:border-zinc-800/80 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md sticky top-0 z-20">
        <span className={`text-xl font-bold w-12 h-12 flex items-center justify-center rounded-2xl ${
          isToday
            ? 'bg-slate-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-sm'
            : isSunday
            ? 'bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/30 text-red-500 font-bold'
            : 'bg-slate-50 dark:bg-zinc-900 border border-slate-200/60 dark:border-zinc-850/60 text-slate-800 dark:text-zinc-300'
        }`}>
          {moment(currentDate).date()}
        </span>
        <div>
          <h3 className={`text-sm font-bold ${isSunday ? 'text-red-500' : 'text-slate-900 dark:text-zinc-100'}`}>
            {moment(currentDate).format('dddd')}
          </h3>
          <p className="text-[10px] font-bold text-slate-400 dark:text-zinc-550 uppercase tracking-widest mt-0.5">
            {moment(currentDate).format('MMMM YYYY')}
          </p>
        </div>
        {isToday && (
          <span className="ml-auto text-[9px] font-bold bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400 px-2.5 py-1 rounded-full uppercase tracking-wider border border-emerald-100 dark:border-emerald-900/30 shadow-sm animate-pulse">
            Live Today
          </span>
        )}
      </div>

      {/* Holiday Alert Banner */}
      {dayHolidays.map(hol => (
        <div
          key={hol.id}
          className="mx-5 mt-4 p-3 rounded-xl border border-red-200/65 dark:border-red-900/30 flex items-center gap-3 select-none shadow-sm bg-red-50/40 dark:bg-rose-950/20 text-red-700 dark:text-rose-350"
        >
          <span className="text-lg">🌴</span>
          <div className="flex-1">
            <p className="text-[9px] font-black uppercase tracking-wider text-red-500 dark:text-red-400">Public Holiday</p>
            <p className="text-xs font-bold mt-0.5">{hol.name}{hol.is_optional ? ' (Optional Holiday)' : ''}</p>
          </div>
        </div>
      ))}

      {/* Timeline Grid */}
      <div className="flex-1 overflow-y-auto custom-scrollbar relative" style={{ height: 'calc(100vh - 210px)' }}>
        <div className="grid grid-cols-[80px_1fr] relative min-h-[1920px]">
          {/* Hour labels */}
          <div className="border-r border-slate-100 dark:border-zinc-800/60 bg-slate-50/20 dark:bg-zinc-900/20 text-center select-none">
            {HOURS.map((hr) => (
              <div
                key={hr}
                className="h-[80px] text-[10px] font-bold text-slate-400 dark:text-zinc-550 pr-4 pt-2 flex justify-end border-b border-slate-50 dark:border-zinc-900/30"
              >
                {moment().hour(hr).minute(0).format('h A')}
              </div>
            ))}
          </div>

          {/* Slots & Event Cards */}
          <div className={`relative ${isSunday ? 'bg-red-50/15 dark:bg-red-950/5' : 'bg-white/40 dark:bg-zinc-900/10'}`}>
            {/* Hour horizontal borders */}
            {HOURS.map((hr) => (
              <div
                key={hr}
                className="h-[80px] border-b border-slate-100/70 dark:border-zinc-800/30"
              />
            ))}

            {/* Live Indicator Bar */}
            {isToday && (
              <div
                style={{
                  top: `${(moment().hours() + moment().minutes() / 60) * 80}px`
                }}
                className="absolute left-0 right-0 border-t border-rose-500 z-10 flex items-center pointer-events-none"
              >
                <span className="w-2 h-2 rounded-full bg-rose-500 -ml-1 shadow-[0_0_8px_rgba(239,68,68,0.8)]" />
                <span className="ml-2 text-[8px] font-bold text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/50 px-1.5 py-0.5 rounded border border-rose-100 dark:border-rose-900/30 uppercase tracking-widest shadow-sm">
                  {moment().format('h:mm A')}
                </span>
              </div>
            )}

            {/* Absolute Positioned Events */}
            {positionedEvents.map((evt) => {
              const start = moment(evt.start_at);
              const end = moment(evt.end_at);
              const isShort = end.diff(start, 'minutes') < 45;
              const hasAttendees = evt.attendees && evt.attendees.length > 0;

              return (
                <button
                  key={evt.id}
                  onClick={() => onEventClick(evt)}
                  style={getEventStyle(evt)}
                  className="absolute rounded-2xl border-l-4 p-3 text-left shadow-[0_2px_8px_rgba(0,0,0,0.015)] dark:shadow-[0_2px_8px_rgba(0,0,0,0.4)] transition-all hover:brightness-95 dark:hover:brightness-110 cursor-pointer select-none overflow-hidden flex flex-col justify-between group"
                >
                  <div className="w-full">
                    <div className="flex items-start justify-between gap-1.5 w-full">
                      <div className="font-bold text-slate-800 dark:text-zinc-150 text-xs truncate flex items-center gap-1.5">
                        {evt.recurrence_rule && (
                          <LuRefreshCw size={11} className="text-slate-400 dark:text-zinc-500 animate-[spin_8s_linear_infinite]" title="Recurring Event" />
                        )}
                        <span>{evt.is_private ? '🔒' : evt.meeting_url ? ' 📞' : (evt.event_type === 'meeting' || evt.title?.toLowerCase().includes('sync') || evt.title?.toLowerCase().includes('standup') || evt.title?.toLowerCase().includes('meeting')) ? '👥' : '📅'} {evt.title}</span>
                      </div>

                      {/* Event Type Badge */}
                      {!isShort && (
                        <span className="text-[9px] font-bold px-2 py-0.5 bg-white/80 dark:bg-zinc-800/80 border border-slate-100 dark:border-zinc-700/50 text-slate-500 dark:text-zinc-300 rounded-full capitalize flex-shrink-0">
                          {evt.event_type}
                        </span>
                      )}
                    </div>

                    {!isShort && evt.description && (
                      <p className="text-[10px] text-slate-550 dark:text-zinc-400 mt-1 line-clamp-2 leading-relaxed">
                        {evt.description}
                      </p>
                    )}
                  </div>

                  {/* Metadata and Attendees stack */}
                  <div className="w-full flex items-center justify-between gap-2 mt-2 pt-1 border-t border-slate-200/30 dark:border-zinc-800/30">
                    <div className="flex items-center gap-2.5 text-[9px] text-slate-500 dark:text-zinc-400 font-bold">
                      <span className="flex items-center gap-0.5">
                        <LuClock size={10} />
                        {start.format('h:mm A')} - {end.format('h:mm A')}
                      </span>
                      {!isShort && evt.location && (
                        <span className="flex items-center gap-0.5 truncate max-w-[100px]" title={evt.location}>
                          <LuMapPin size={10} />
                          {evt.location}
                        </span>
                      )}
                    </div>

                    {/* Attendee Stack */}
                    {hasAttendees && !isShort && (
                      <div className="flex items-center -space-x-1.5 overflow-hidden">
                        {evt.attendees.slice(0, 3).map((att, i) => (
                          <div key={i} className="w-4 h-4 rounded-full border border-white dark:border-zinc-950 overflow-hidden shadow-sm flex-shrink-0">
                            {att.profile_image_url ? (
                              <img src={att.profile_image_url} alt={att.name} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full bg-slate-200 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 text-[7px] font-bold flex items-center justify-center">
                                {att.name?.[0]?.toUpperCase()}
                              </div>
                            )}
                          </div>
                        ))}
                        {evt.attendees.length > 3 && (
                          <div className="w-4 h-4 rounded-full border border-white dark:border-zinc-950 bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-300 text-[7px] font-bold flex items-center justify-center shadow-sm">
                            +{evt.attendees.length - 3}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DayView;

