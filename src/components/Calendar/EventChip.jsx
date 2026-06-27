import React from 'react';
import moment from 'moment';
import { LuClipboardCheck, LuSunMedium } from 'react-icons/lu';

export const EventChip = ({ event, onClick, isHoliday = false }) => {
  const isTask = !event.start_at && !isHoliday; // Tasks use due_date instead of start_at

  // ── Public Holiday chip ─────────────────────────────────────────────────────
  if (isHoliday) {
    return (
      <div
        className="w-full text-left text-[9px] font-bold px-1.5 py-0.5 rounded border-l-2 border-l-red-500 bg-red-50/40 dark:bg-rose-950/20 text-red-700 dark:text-rose-350 flex items-center gap-1 truncate select-none"
        title={`🌴 Public Holiday: ${event.name}${event.is_optional ? ' (Optional)' : ''}`}
      >
        <LuSunMedium size={9} className="flex-shrink-0 text-red-500 dark:text-rose-455" />
        <span className="truncate">🌴 {event.name}</span>
        {event.is_optional && (
          <span className="ml-auto text-[8px] opacity-60 font-normal flex-shrink-0">opt</span>
        )}
      </div>
    );
  }

  if (isTask) {
    return (
      <button
        onClick={(e) => {
          e.stopPropagation();
          onClick(event);
        }}
        className="w-full text-left text-[9px] font-bold px-1.5 py-0.5 border-l-2 border-amber-500 bg-amber-50/40 hover:bg-amber-100/30 dark:bg-amber-950/20 dark:text-amber-350 dark:border-amber-900/30 rounded transition-all truncate text-amber-800 shadow-sm border border-amber-200/20 flex items-center gap-1 cursor-pointer"
        title={`Task: ${event.title} (Due today)`}
      >
        <LuClipboardCheck size={9} className="text-amber-500 flex-shrink-0" />
        <span>📝 {event.title}</span>
      </button>
    );
  }

  const getEventEmoji = () => {
    if (event.is_private) return '🔒';
    if (event.meeting_url) return ' 📞';
    if (
      event.event_type === 'meeting' ||
      event.title?.toLowerCase().includes('sync') ||
      event.title?.toLowerCase().includes('standup') ||
      event.title?.toLowerCase().includes('meeting')
    ) {
      return '👥';
    }
    return '📅';
  };

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick(event);
      }}
      style={{ borderLeftColor: event.color }}
      className="w-full text-left text-[9px] font-bold px-1.5 py-0.5 border-l-2 bg-slate-50/80 hover:bg-slate-100/70 dark:bg-zinc-900/60 dark:hover:bg-zinc-800/80 rounded transition-all truncate text-slate-700 dark:text-zinc-200 shadow-sm border border-slate-150/40 dark:border-zinc-800/80 cursor-pointer"
      title={`${event.title} (${moment(event.start_at).format('h:mm A')})`}
    >
      <span className="text-slate-400 mr-1 text-[8px]">
        {moment(event.start_at).format('h:mm A')}
      </span>
      {event.recurrence_rule && (
        <span className="text-indigo-500 mr-1" title="Recurring Event">🔁</span>
      )}
      {getEventEmoji()} {event.title}
    </button>
  );
};

export default EventChip;

