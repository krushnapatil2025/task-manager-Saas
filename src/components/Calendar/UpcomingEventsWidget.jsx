import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import moment from 'moment';
import { calendarService } from '../../services/calendarService';
import { LuCalendarDays, LuClock3, LuMapPin } from 'react-icons/lu';

const UpcomingEventsWidget = () => {
  const navigate = useNavigate();
  const [upcoming, setUpcoming] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUpcoming = async () => {
      try {
        const data = await calendarService.getUpcomingEvents(5);
        setUpcoming(data || []);
      } catch (err) {
        console.error('Failed to load upcoming events:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchUpcoming();
  }, []);

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center py-8">
        <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (upcoming.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-8 text-center gap-2">
        <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/30 flex items-center justify-center">
          <LuCalendarDays size={22} className="text-indigo-400" />
        </div>
        <p className="text-xs font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">No upcoming events</p>
        <button
          onClick={() => navigate('/calendar')}
          className="text-[11px] font-bold text-indigo-500 hover:text-indigo-700 transition-colors"
        >
          + Schedule one →
        </button>
      </div>
    );
  }

  const getRelativeDay = (dateStr) => {
    const today = moment().startOf('day');
    const eventDay = moment(dateStr).startOf('day');
    const diff = eventDay.diff(today, 'days');
    if (diff === 0) return { label: 'Today', color: 'text-emerald-600 bg-emerald-50' };
    if (diff === 1) return { label: 'Tomorrow', color: 'text-amber-600 bg-amber-50' };
    return null;
  };

  return (
    <div className="flex-1 overflow-y-auto space-y-2.5 max-h-[280px] pr-0.5 custom-scrollbar">
      {upcoming.map((evt) => {
        const relative = getRelativeDay(evt.start_at);
        const accentColor = evt.color || '#6366f1';

        return (
          <div
            key={evt.id}
            onClick={() => navigate('/calendar')}
            className="group relative flex items-start gap-3 p-3 rounded-xl border border-slate-100 dark:border-zinc-800 hover:border-indigo-200 dark:hover:border-indigo-800 bg-white dark:bg-zinc-900 hover:bg-indigo-50/30 dark:hover:bg-indigo-950/20 transition-all duration-200 cursor-pointer overflow-hidden"
          >
            {/* Left color accent bar */}
            <div
              className="w-1 self-stretch rounded-full flex-shrink-0 opacity-80"
              style={{ backgroundColor: accentColor }}
            />

            {/* Content */}
            <div className="min-w-0 flex-1">
              {/* Title row */}
              <div className="flex items-start justify-between gap-2">
                <h6 className="text-[13px] font-bold text-slate-800 dark:text-zinc-100 truncate leading-tight group-hover:text-indigo-700 dark:group-hover:text-indigo-300 transition-colors">
                  {evt.title}
                </h6>
                {relative && (
                  <span className={`text-[9px] font-extrabold uppercase tracking-wider px-1.5 py-0.5 rounded-full flex-shrink-0 ${relative.color}`}>
                    {relative.label}
                  </span>
                )}
              </div>

              {/* Time & location row */}
              <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                <span className="flex items-center gap-1 text-[11px] font-semibold text-slate-400 dark:text-zinc-500">
                  <LuClock3 size={10} className="flex-shrink-0" />
                  {moment(evt.start_at).format('MMM D · h:mm A')}
                </span>
                {evt.location && (
                  <span className="flex items-center gap-1 text-[11px] font-semibold text-slate-350 dark:text-zinc-600 truncate max-w-[100px]">
                    <LuMapPin size={10} className="flex-shrink-0" />
                    {evt.location}
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default UpcomingEventsWidget;
