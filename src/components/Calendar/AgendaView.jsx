import React, { useState } from 'react';
import moment from 'moment';
import { LuClock, LuMapPin, LuVideo, LuClipboardCheck, LuUser, LuCircleCheck, LuCircleX, LuCircleHelp } from 'react-icons/lu';

const AgendaView = ({
  currentDate,
  events = [],
  tasks = [],
  onEventClick,
  onTaskClick
}) => {
  const [agendaScope, setAgendaScope] = useState('week'); // 'day' | 'week' | 'month'

  const daysList = [];
  const count = agendaScope === 'week' ? 7 : agendaScope === 'month' ? 30 : 1;
  const startOfPeriod = moment(currentDate).startOf(agendaScope === 'day' ? 'day' : 'week');

  for (let i = 0; i < count; i++) {
    daysList.push(moment(startOfPeriod).add(i, 'days'));
  }

  // Filter helper
  const getFilteredItemsForDate = (date) => {
    const listEvents = events.filter(e => moment(e.start_at).isSame(date, 'day'));
    const listTasks = tasks.filter(t => moment(t.due_date).isSame(date, 'day'));
    return { listEvents, listTasks };
  };

  // Helper to render RSVP status icon
  const renderRsvpStatus = (status) => {
    switch (status) {
      case 'accepted':
        return (
          <span className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/20 px-2 py-0.5 rounded-full border border-emerald-100/60 dark:border-emerald-900/30">
            <LuCircleCheck size={11} className="text-emerald-500" />
            Accepted
          </span>
        );
      case 'declined':
        return (
          <span className="flex items-center gap-1.5 text-[10px] font-bold text-rose-700 dark:text-rose-455 bg-rose-50 dark:bg-rose-950/20 px-2 py-0.5 rounded-full border border-rose-100/60 dark:border-rose-900/30">
            <LuCircleX size={11} className="text-rose-500" />
            Declined
          </span>
        );
      case 'maybe':
        return (
          <span className="flex items-center gap-1.5 text-[10px] font-bold text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/20 px-2 py-0.5 rounded-full border border-amber-100/60 dark:border-amber-900/30">
            <LuCircleHelp size={11} className="text-amber-550" />
            Maybe
          </span>
        );
      default:
        return (
          <span className="flex items-center gap-1.5 text-[10px] font-bold text-slate-500 dark:text-zinc-400 bg-slate-50 dark:bg-zinc-800 px-2 py-0.5 rounded-full border border-slate-200/60 dark:border-zinc-700/60">
            <LuUser size={11} className="text-slate-400 dark:text-zinc-500" />
            Pending
          </span>
        );
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-slate-50/20 dark:bg-zinc-950/20 overflow-hidden animate-fade-in">
      {/* View Scope Tabs */}
      <div className="flex items-center justify-between p-4 border-b border-slate-150/70 dark:border-zinc-800/80 bg-white dark:bg-zinc-900 sticky top-0 z-20 shadow-sm">
        <div className="flex bg-slate-100 dark:bg-zinc-950 p-1 rounded-xl border border-slate-200/30 dark:border-zinc-800/50">
          <button
            onClick={() => setAgendaScope('day')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${agendaScope === 'day' ? 'bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 shadow-sm' : 'text-slate-500 dark:text-zinc-450 hover:text-slate-800 dark:hover:text-zinc-200'
              }`}
          >
            Day Sheet
          </button>
          <button
            onClick={() => setAgendaScope('week')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${agendaScope === 'week' ? 'bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 shadow-sm' : 'text-slate-500 dark:text-zinc-450 hover:text-slate-800 dark:hover:text-zinc-200'
              }`}
          >
            7 Days Agenda
          </button>
          <button
            onClick={() => setAgendaScope('month')}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer ${agendaScope === 'month' ? 'bg-white dark:bg-zinc-800 text-slate-900 dark:text-zinc-100 shadow-sm' : 'text-slate-500 dark:text-zinc-450 hover:text-slate-800 dark:hover:text-zinc-200'
              }`}
          >
            30 Days Agenda
          </button>
        </div>
        <div className="text-[11px] font-bold text-slate-400 dark:text-zinc-550 uppercase tracking-widest mr-2 select-none">
          {agendaScope === 'day' ? 'Single Day Sheet' : `${count} Days Timeline`}
        </div>
      </div>

      {/* Main Agenda Feed */}
      <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar" style={{ height: 'calc(100vh - 210px)' }}>
        {daysList.map((day, idx) => {
          const { listEvents, listTasks } = getFilteredItemsForDate(day);
          const isToday = day.isSame(moment(), 'day');

          // If no events/tasks, skip on week/month view for compact aesthetic
          if (listEvents.length === 0 && listTasks.length === 0 && agendaScope !== 'day') {
            return null;
          }

          return (
            <div key={idx} className="grid grid-cols-1 md:grid-cols-[160px_1fr] gap-4 items-start animate-fade-in">
              {/* Day Date Label */}
              <div className="flex md:flex-col items-baseline md:items-start gap-2 md:gap-0.5 p-1 select-none">
                <span className={`text-sm font-bold ${isToday ? 'text-indigo-650 dark:text-indigo-400' : 'text-slate-800 dark:text-zinc-200'}`}>
                  {day.format('dddd')}
                </span>
                <span className="text-xs text-slate-400 dark:text-zinc-500 font-semibold md:mt-0.5">
                  {day.format('MMM D, YYYY')}
                </span>
                {isToday && (
                  <span className="ml-2 md:ml-0 md:mt-2 text-[8px] font-bold bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-150/60 dark:border-indigo-900/30 text-indigo-600 dark:text-indigo-455 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                    Today
                  </span>
                )}
              </div>

              {/* Day Content Card */}
              <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-slate-150/50 dark:border-zinc-800/80 shadow-[0_2px_8px_rgba(0,0,0,0.015)] p-5 space-y-4">
                {listEvents.length === 0 && listTasks.length === 0 && (
                  <p className="text-xs font-semibold text-slate-400 dark:text-zinc-500 py-2">No meetings or task deadlines scheduled.</p>
                )}

                {/* Event timeline items */}
                {listEvents.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="text-[9px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest pb-1 border-b border-slate-100 dark:border-zinc-800/40">Meetings & Events</h4>
                    {listEvents.map(evt => {
                      const hasAttendees = evt.attendees && evt.attendees.length > 0;
                      return (
                        <div
                          key={evt.id}
                          onClick={() => onEventClick(evt)}
                          className="flex items-start gap-4 p-3.5 rounded-xl hover:bg-slate-50/50 dark:hover:bg-zinc-850/40 border border-slate-100 dark:border-zinc-800/50 transition-all cursor-pointer group hover:border-slate-200 dark:hover:border-zinc-700 hover:shadow-sm"
                        >
                          <div style={{ backgroundColor: evt.color }} className="w-1 h-12 rounded-full flex-shrink-0" />
                          <div className="flex-1 min-w-0 text-xs">
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <div className="flex items-center gap-2 truncate">
                                <span className="font-bold text-slate-800 dark:text-zinc-150 truncate group-hover:text-indigo-650 dark:group-hover:text-indigo-400 transition-colors">
                                  {evt.is_private ? '🔒' : evt.meeting_url ? ' 📞' : (evt.event_type === 'meeting' || evt.title?.toLowerCase().includes('sync') || evt.title?.toLowerCase().includes('standup') || evt.title?.toLowerCase().includes('meeting')) ? '👥' : '📅'} {evt.title}
                                </span>
                                <span className="text-[9px] font-bold px-2 py-0.5 bg-slate-100 dark:bg-zinc-950 text-slate-500 dark:text-zinc-400 rounded-full capitalize">
                                  {evt.event_type}
                                </span>
                              </div>
                              {evt.my_rsvp && renderRsvpStatus(evt.my_rsvp)}
                            </div>

                            {evt.description && (
                              <p className="text-slate-500 dark:text-zinc-400 text-[10px] line-clamp-1 mb-2 font-semibold">
                                {evt.description}
                              </p>
                            )}

                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-slate-450 dark:text-zinc-400 font-bold mt-1.5">
                              <span className="flex items-center gap-1 text-[10px]">
                                <LuClock size={11} className="text-slate-400 dark:text-zinc-500" />
                                {moment(evt.start_at).format('h:mm A')} - {moment(evt.end_at).format('h:mm A')}
                              </span>
                              {evt.location && (
                                <span className="flex items-center gap-1 text-[10px] truncate max-w-[150px]">
                                  <LuMapPin size={11} className="text-slate-400 dark:text-zinc-500" />
                                  {evt.location}
                                </span>
                              )}
                              {evt.meeting_url && (
                                <span className="flex items-center gap-1 text-[10px] text-indigo-600 dark:text-indigo-400 font-bold bg-indigo-50 dark:bg-indigo-950/20 px-2 py-0.5 rounded-full border border-indigo-100/60 dark:border-indigo-900/30">
                                  <LuVideo size={11} className="text-indigo-500 dark:text-indigo-400" />
                                  Video Link
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Attendee Stack on Agenda Cards */}
                          {hasAttendees && (
                            <div className="flex items-center -space-x-1.5 overflow-hidden pl-2 select-none">
                              {evt.attendees.slice(0, 3).map((att, i) => (
                                <div key={i} className="w-5 h-5 rounded-full border border-white dark:border-zinc-900 overflow-hidden shadow-sm flex-shrink-0" title={att.name}>
                                  {att.profile_image_url ? (
                                    <img src={att.profile_image_url} alt="" className="w-full h-full object-cover" />
                                  ) : (
                                    <div className="w-full h-full bg-slate-200 dark:bg-zinc-800 text-slate-700 dark:text-zinc-300 text-[8px] font-bold flex items-center justify-center">
                                      {att.name?.[0]?.toUpperCase()}
                                    </div>
                                  )}
                                </div>
                              ))}
                              {evt.attendees.length > 3 && (
                                <div className="w-5 h-5 rounded-full border border-white dark:border-zinc-900 bg-slate-100 dark:bg-zinc-800 text-slate-505 dark:text-zinc-300 text-[8px] font-bold flex items-center justify-center shadow-sm">
                                  +{evt.attendees.length - 3}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Task deadlines items */}
                {listTasks.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="text-[9px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest pb-1 border-b border-slate-100 dark:border-zinc-800/40">Task Deadlines</h4>
                    {listTasks.map(tsk => (
                      <div
                        key={tsk.id}
                        onClick={() => onTaskClick(tsk)}
                        className="flex items-start gap-4 p-3.5 rounded-xl hover:bg-slate-50/50 dark:hover:bg-zinc-850/40 border border-slate-100 dark:border-zinc-800/50 transition-all cursor-pointer group hover:border-slate-200 dark:hover:border-zinc-700 hover:shadow-sm"
                      >
                        <div className="w-1 h-12 bg-amber-550 rounded-full flex-shrink-0" />
                        <div className="flex-1 min-w-0 text-xs">
                          <div className="flex items-center gap-2 mb-1">
                            <LuClipboardCheck size={14} className="text-amber-500 flex-shrink-0" />
                            <span className="font-bold text-slate-800 dark:text-zinc-150 truncate group-hover:text-amber-600 dark:group-hover:text-amber-400 transition-colors">
                              📝 {tsk.title}
                            </span>
                            <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${tsk.priority === 'high'
                                ? 'bg-rose-50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-455 border-rose-100/60 dark:border-rose-900/30'
                                : tsk.priority === 'medium'
                                  ? 'bg-amber-50 dark:bg-amber-955/20 text-amber-700 dark:text-amber-400 border-amber-100/60 dark:border-amber-900/30'
                                  : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-300 border-slate-200/60 dark:border-zinc-700/60'
                              } capitalize`}>
                              {tsk.priority} Priority
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-450 dark:text-zinc-400 font-semibold mt-1.5 flex items-center gap-2">
                            <span>Status: <strong className="text-slate-650 dark:text-zinc-200 font-bold">{tsk.status}</strong></span>
                            <span>•</span>
                            <span>Workspace: <strong className="text-slate-650 dark:text-zinc-200 font-bold">{tsk.project_name || 'General'}</strong></span>
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default AgendaView;
