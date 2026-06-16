import React from 'react';
import moment from 'moment';
import { LuClipboardCheck } from 'react-icons/lu';

export const EventChip = ({ event, onClick }) => {
  const isTask = !event.start_at; // Tasks use due_date instead of start_at

  if (isTask) {
    return (
      <button
        onClick={(e) => {
          e.stopPropagation();
          onClick(event);
        }}
        className="w-full text-left text-[9px] font-bold px-1.5 py-0.5 border-l-2 border-amber-500 bg-amber-50/45 hover:bg-amber-100/35 rounded transition-all truncate text-amber-800 shadow-sm border border-amber-200/20 flex items-center gap-1 cursor-pointer"
        title={`Task: ${event.title} (Due today)`}
      >
        <LuClipboardCheck size={9} className="text-amber-500 flex-shrink-0" />
        <span>{event.title}</span>
      </button>
    );
  }

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onClick(event);
      }}
      style={{ borderLeftColor: event.color }}
      className="w-full text-left text-[9px] font-bold px-1.5 py-0.5 border-l-2 bg-slate-50/90 hover:bg-slate-100/80 rounded transition-all truncate text-slate-700 shadow-sm border border-slate-150/45 cursor-pointer"
      title={`${event.title} (${moment(event.start_at).format('h:mm A')})`}
    >
      <span className="text-slate-400 mr-1 text-[8px]">
        {moment(event.start_at).format('h:mm A')}
      </span>
      {event.recurrence_rule && (
        <span className="text-indigo-500 mr-1" title="Recurring Event">🔁</span>
      )}
      {event.title}
    </button>
  );
};

export default EventChip;
