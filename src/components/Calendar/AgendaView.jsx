import React from 'react';
import moment from 'moment';
import { LuClock, LuMapPin, LuVideo, LuClipboardCheck } from 'react-icons/lu';

const AgendaView = ({
  currentDate,
  events = [],
  tasks = [],
  view = 'week',
  onEventClick,
  onTaskClick
}) => {
  const daysList = [];
  const count = view === 'week' ? 7 : 1;
  const startOfPeriod = moment(currentDate).startOf(view === 'week' ? 'week' : 'day');

  for (let i = 0; i < count; i++) {
    daysList.push(moment(startOfPeriod).add(i, 'days'));
  }

  // Filter helper
  const getFilteredItemsForDate = (date) => {
    const listEvents = events.filter(e => moment(e.start_at).isSame(date, 'day'));
    const listTasks = tasks.filter(t => moment(t.due_date).isSame(date, 'day'));
    return { listEvents, listTasks };
  };

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-slate-50/50">
      {daysList.map((day, idx) => {
        const { listEvents, listTasks } = getFilteredItemsForDate(day);
        const isToday = day.isSame(moment(), 'day');

        if (listEvents.length === 0 && listTasks.length === 0 && view === 'week') {
          return null; // compact view for week agenda
        }

        return (
          <div key={idx} className="bg-white rounded-2xl p-5 border border-slate-150/50 shadow-sm space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
              <span className={`text-xs font-extrabold px-3 py-1 rounded-full ${
                isToday 
                  ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/20' 
                  : 'bg-slate-100 text-slate-500'
              }`}>
                {day.format('dddd, MMM D')}
              </span>
              {isToday && (
                <span className="text-[10px] text-indigo-500 font-extrabold uppercase tracking-wide">Today</span>
              )}
            </div>

            {listEvents.length === 0 && listTasks.length === 0 && (
              <p className="text-xs font-semibold text-slate-400 py-2">No meetings or tasks scheduled.</p>
            )}

            {/* Events */}
            <div className="space-y-3">
              {listEvents.map(evt => (
                <div 
                  key={evt.id} 
                  onClick={() => onEventClick(evt)}
                  className="flex items-start gap-4 p-3 rounded-xl hover:bg-slate-50 border border-slate-100 transition-all cursor-pointer group"
                >
                  <div style={{ backgroundColor: evt.color }} className="w-1 h-10 rounded-full flex-shrink-0" />
                  <div className="flex-1 min-w-0 text-xs">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-extrabold text-slate-700 truncate group-hover:text-indigo-600 transition-colors">
                        {evt.title}
                      </span>
                      <span className="text-[9px] font-bold px-2 py-0.5 bg-slate-100 text-slate-500 rounded-full capitalize">
                        {evt.event_type}
                      </span>
                    </div>
                    <div className="flex items-center gap-4 text-slate-400 font-semibold mt-1">
                      <span className="flex items-center gap-1">
                        <LuClock size={12} />
                        {moment(evt.start_at).format('h:mm A')} - {moment(evt.end_at).format('h:mm A')}
                      </span>
                      {evt.location && (
                        <span className="flex items-center gap-1 truncate max-w-[120px]">
                          <LuMapPin size={12} />
                          {evt.location}
                        </span>
                      )}
                      {evt.meeting_url && (
                        <span className="flex items-center gap-1 text-indigo-500">
                          <LuVideo size={12} />
                          Video
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}

              {/* Tasks */}
              {listTasks.map(tsk => (
                <div 
                  key={tsk.id}
                  onClick={() => onTaskClick(tsk)}
                  className="flex items-start gap-4 p-3 rounded-xl hover:bg-slate-50 border border-slate-100 transition-all cursor-pointer group"
                >
                  <div className="w-1 h-10 bg-amber-500 rounded-full flex-shrink-0" />
                  <div className="flex-1 min-w-0 text-xs">
                    <div className="flex items-center gap-2 mb-1">
                      <LuClipboardCheck size={14} className="text-amber-500 flex-shrink-0" />
                      <span className="font-extrabold text-slate-700 truncate group-hover:text-amber-600 transition-colors">
                        Task Deadline: {tsk.title}
                      </span>
                      <span className="text-[9px] font-bold px-2 py-0.5 bg-amber-50 text-amber-700 rounded-full capitalize">
                        Deadline
                      </span>
                    </div>
                    <p className="text-[10px] text-slate-400 font-semibold mt-1">
                      Priority: <span className="capitalize">{tsk.priority}</span> · Status: {tsk.status}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default AgendaView;
