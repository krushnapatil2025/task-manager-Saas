import React from 'react';
import { LuX, LuCalendar, LuClock, LuMapPin, LuVideo, LuTrash, LuPencil, LuCopy } from 'react-icons/lu';
import moment from 'moment';
import toast from 'react-hot-toast';

const CheckIcon = (props) => (
  <svg stroke="currentColor" fill="none" strokeWidth="2.5" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" height="1em" width="1em" {...props}>
    <polyline points="20 6 9 17 4 12"></polyline>
  </svg>
);

const DeclineIcon = (props) => (
  <svg stroke="currentColor" fill="none" strokeWidth="2.5" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" height="1em" width="1em" {...props}>
    <line x1="18" y1="6" x2="6" y2="18"></line>
    <line x1="6" y1="6" x2="18" y2="18"></line>
  </svg>
);

const MaybeIcon = (props) => (
  <svg stroke="currentColor" fill="none" strokeWidth="2.5" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" height="1em" width="1em" {...props}>
    <circle cx="12" cy="12" r="10"></circle>
    <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"></path>
    <line x1="12" y1="17" x2="12.01" y2="17"></line>
  </svg>
);

const EventDetailPanel = ({
  event,
  activeUserId,
  onClose,
  onEditClick,
  onDeleteClick,
  onRsvpChange
}) => {
  if (!event) return null;

  const isCreator = event.created_by === activeUserId;
  const userRsvp = event.attendees?.find(a => a.user_id === activeUserId);
  const userRsvpStatus = userRsvp?.status || 'pending';

  return (
    <div className="fixed inset-y-0 right-0 w-full sm:w-[400px] bg-white border-l border-slate-200/50 shadow-2xl flex flex-col z-40 animate-in slide-in-from-right duration-250">
      
      {/* Top Bar / Header */}
      <div className="flex items-center justify-between px-6 py-5 border-b border-slate-150/60 bg-slate-50/45">
        <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
          Event Details
        </span>
        <div className="flex items-center gap-2">
          {isCreator && (
            <>
              <button
                onClick={() => onEditClick(event)}
                className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50/65 rounded-lg transition-colors cursor-pointer"
                title="Edit Event"
              >
                <LuPencil size={15} />
              </button>
              <button
                onClick={() => onDeleteClick(event.id)}
                className="p-2 text-slate-500 hover:text-rose-600 hover:bg-rose-50/65 rounded-lg transition-colors cursor-pointer"
                title="Delete Event"
              >
                <LuTrash size={15} />
              </button>
            </>
          )}
          <button 
            onClick={onClose} 
            className="p-2 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
          >
            <LuX size={16} />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        
        {/* Title & Badge */}
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span 
              style={{ backgroundColor: event.color }} 
              className="w-2.5 h-2.5 rounded-full inline-block"
            />
            <span className="text-[9px] font-extrabold uppercase bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full tracking-wider">
              {event.event_type || 'Meeting'}
            </span>
          </div>
          <h2 className="text-base font-extrabold text-slate-800 leading-tight">
            {event.title}
          </h2>
        </div>

        {/* Date Time info */}
        <div className="flex items-start gap-3 bg-slate-50 border border-slate-100 rounded-2xl p-4">
          <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
            <LuCalendar size={16} />
          </div>
          <div className="text-xs">
            <p className="font-extrabold text-slate-700 mb-0.5">
              {moment(event.start_at).format('dddd, MMMM Do YYYY')}
            </p>
            <p className="font-semibold text-slate-450 flex items-center gap-1">
              <LuClock size={12} />
              {moment(event.start_at).format('h:mm A')} - {moment(event.end_at).format('h:mm A')}
            </p>
          </div>
        </div>

        {/* Location & Meeting Link */}
        <div className="space-y-3">
          {event.location && (
            <div className="flex items-start gap-3 text-xs">
              <LuMapPin className="text-slate-450 mt-0.5 flex-shrink-0" size={14} />
              <div>
                <p className="font-extrabold text-slate-700">Location</p>
                <p className="font-semibold text-slate-500">{event.location}</p>
              </div>
            </div>
          )}

          {event.meeting_url && (
            <div className="mt-4 p-4 bg-indigo-50/70 border border-indigo-100/60 rounded-2xl flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold text-indigo-700">
                  <LuVideo size={15} className="text-indigo-500 fill-indigo-500/10" />
                  <span>Virtual Video Meeting</span>
                </div>
                <button 
                  onClick={() => {
                    navigator.clipboard.writeText(event.meeting_url);
                    toast.success('Meeting link copied!');
                  }}
                  className="p-1 hover:bg-indigo-100/80 rounded text-indigo-600 transition-colors cursor-pointer"
                  title="Copy Meeting Link"
                >
                  <LuCopy size={13} />
                </button>
              </div>
              
              <button 
                onClick={() => {
                  window.open(event.meeting_url, '_blank', 'noopener,noreferrer');
                }}
                className="w-full bg-indigo-650 hover:bg-indigo-700 text-white py-2 rounded-xl text-xs font-bold shadow-sm shadow-indigo-650/15 cursor-pointer transition-all text-center flex items-center justify-center gap-1.5"
              >
                <LuVideo size={13} />
                <span>Join Video Meeting</span>
              </button>
            </div>
          )}
        </div>

        {/* Description */}
        {event.description && (
          <div className="space-y-1.5 border-t border-slate-100 pt-4">
            <h4 className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
              Description
            </h4>
            <p className="text-xs font-semibold text-slate-600 whitespace-pre-wrap leading-relaxed">
              {event.description}
            </p>
          </div>
        )}

        {/* RSVP Status Selection for current user */}
        <div className="border-t border-slate-100 pt-4 space-y-2.5">
          <h4 className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
            Your Response
          </h4>
          <div className="grid grid-cols-3 gap-2">
            {[
              { status: 'accepted', label: 'Going', icon: CheckIcon, color: 'text-emerald-600 bg-emerald-50 border-emerald-200/50 hover:bg-emerald-100/30' },
              { status: 'declined', label: 'Decline', icon: DeclineIcon, color: 'text-rose-600 bg-rose-50 border-rose-200/50 hover:bg-rose-100/30' },
              { status: 'maybe', label: 'Maybe', icon: MaybeIcon, color: 'text-amber-600 bg-amber-50 border-amber-200/50 hover:bg-amber-100/30' }
            ].map((opt) => {
              const isActive = userRsvpStatus === opt.status;
              return (
                <button
                  key={opt.status}
                  onClick={() => onRsvpChange(event.id, opt.status)}
                  className={`flex items-center justify-center gap-1.5 py-2 px-3 border rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    isActive 
                      ? opt.color + ' ring-2 ring-indigo-500/10' 
                      : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                  }`}
                >
                  <opt.icon size={13} />
                  <span>{opt.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Attendees RSVP list */}
        <div className="border-t border-slate-100 pt-4 space-y-3">
          <h4 className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
            Attendees ({event.attendees?.length || 0})
          </h4>
          <div className="space-y-2 max-h-[220px] overflow-y-auto custom-scrollbar">
            {event.attendees?.map((att) => {
              const statusColors = {
                accepted: 'bg-emerald-100 text-emerald-700',
                declined: 'bg-rose-100 text-rose-700',
                maybe: 'bg-amber-100 text-amber-700',
                pending: 'bg-slate-100 text-slate-600'
              };

              return (
                <div key={att.user_id} className="flex items-center justify-between text-xs py-1">
                  <div className="flex items-center gap-2">
                    {att.profile_image_url ? (
                      <img
                        src={att.profile_image_url}
                        alt={att.name}
                        className="w-6 h-6 rounded-full object-cover"
                      />
                    ) : (
                      <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center text-[9px] text-slate-600 font-extrabold">
                        {att.name?.[0]?.toUpperCase()}
                      </div>
                    )}
                    <span className="font-bold text-slate-700">{att.name}</span>
                  </div>
                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full capitalize ${statusColors[att.status] || statusColors.pending}`}>
                    {att.status}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Linked Tasks */}
        {event.tasks && event.tasks.length > 0 && (
          <div className="border-t border-slate-100 pt-4 space-y-3">
            <h4 className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider">
              Linked Tasks
            </h4>
            <div className="space-y-2">
              {event.tasks.map((task) => {
                const statusColors = {
                  'Pending': 'bg-violet-100 text-violet-750 border-violet-200',
                  'In Progress': 'bg-cyan-100 text-cyan-750 border-cyan-200',
                  'Completed': 'bg-lime-100 text-lime-750 border-lime-200'
                };
                return (
                  <a
                    key={task.id}
                    href={`/user/task-details/${task.id}`}
                    className="flex items-center justify-between p-2.5 rounded-xl border border-slate-100 hover:border-indigo-150 hover:bg-indigo-50/20 transition-all text-xs font-semibold text-slate-700 cursor-pointer"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span className="text-indigo-500 flex-shrink-0">📋</span>
                      <span className="truncate hover:text-indigo-600 font-extrabold">{task.title}</span>
                    </div>
                    <span className={`text-[8px] font-extrabold px-2 py-0.5 rounded-full border capitalize ${statusColors[task.status] || 'bg-slate-100 text-slate-600'}`}>
                      {task.status}
                    </span>
                  </a>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default EventDetailPanel;
