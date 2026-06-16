import React from 'react';
import { LuCheck, LuX, LuClock, LuHelpCircle } from 'react-icons/lu';

const STATUS_ICONS = {
  accepted: <LuCheck className="text-emerald-500" size={12} />,
  declined: <LuX className="text-rose-500" size={12} />,
  maybe: <LuHelpCircle className="text-amber-500" size={12} />,
  pending: <LuClock className="text-slate-400" size={12} />,
};

const STATUS_CLASSES = {
  accepted: 'bg-emerald-50 text-emerald-700 border-emerald-150',
  declined: 'bg-rose-50 text-rose-700 border-rose-150',
  maybe: 'bg-amber-50 text-amber-700 border-amber-150',
  pending: 'bg-slate-50 text-slate-600 border-slate-150',
};

export const AttendeeList = ({ attendees = [] }) => {
  if (attendees.length === 0) {
    return <p className="text-xs font-semibold text-slate-400 py-1">No attendees selected.</p>;
  }

  return (
    <div className="space-y-2">
      {attendees.map((att) => (
        <div 
          key={att.id || att.user_id} 
          className="flex items-center justify-between p-2 rounded-xl border border-slate-100 bg-white/70"
        >
          <div className="flex items-center gap-2 min-w-0">
            {att.profile_image_url || att.profiles?.profile_image_url ? (
              <img
                src={att.profile_image_url || att.profiles?.profile_image_url}
                alt={att.name || att.profiles?.name}
                className="w-6 h-6 rounded-full object-cover border border-slate-100"
              />
            ) : (
              <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center justify-center text-[10px] text-slate-600 font-bold">
                {(att.name || att.profiles?.name)?.[0]?.toUpperCase() || '?'}
              </div>
            )}
            <span className="text-xs font-bold text-slate-700 truncate">
              {att.name || att.profiles?.name || 'Unknown User'}
            </span>
          </div>

          <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full border flex items-center gap-1 capitalize ${
            STATUS_CLASSES[att.status] || STATUS_CLASSES.pending
          }`}>
            {STATUS_ICONS[att.status] || STATUS_ICONS.pending}
            {att.status || 'pending'}
          </span>
        </div>
      ))}
    </div>
  );
};

export default AttendeeList;
