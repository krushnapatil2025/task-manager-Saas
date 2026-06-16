import React, { useState, useEffect } from 'react';
import { LuX, LuCalendar, LuClock, LuMapPin, LuVideo, LuCheck, LuTag, LuRepeat } from 'react-icons/lu';
import moment from 'moment';

const COLORS = [
  { value: '#6366f1', label: 'Indigo' },
  { value: '#ec4899', label: 'Rose' },
  { value: '#10b981', label: 'Emerald' },
  { value: '#f59e0b', label: 'Amber' },
  { value: '#06b6d4', label: 'Sky' },
  { value: '#8b5cf6', label: 'Violet' },
  { value: '#f97316', label: 'Orange' },
  { value: '#14b8a6', label: 'Teal' }
];

const EVENT_TYPES = [
  { value: 'meeting', label: '🤝 Meeting' },
  { value: 'reminder', label: '⏰ Reminder' },
  { value: 'deadline', label: '🎯 Deadline' },
  { value: 'sprint', label: '🏃 Sprint Event' }
];

const EventFormModal = ({
  isOpen,
  onClose,
  onSubmit,
  initialData = null,
  members = [],
  activeUserId,
  tasks = [],
  prefilledTaskId = ''
}) => {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [startAt, setStartAt] = useState('');
  const [endAt, setEndAt] = useState('');
  const [color, setColor] = useState('#6366f1');
  const [eventType, setEventType] = useState('meeting');
  const [meetingUrl, setMeetingUrl] = useState('');
  const [attendeeIds, setAttendeeIds] = useState([]);
  const [showAttendeesList, setShowAttendeesList] = useState(false);
  const [linkedTaskId, setLinkedTaskId] = useState('');
  const [recurrenceRule, setRecurrenceRule] = useState('');

  useEffect(() => {
    if (initialData) {
      setTitle(initialData.title || '');
      setDescription(initialData.description || '');
      setLocation(initialData.location || '');
      setStartAt(moment(initialData.start_at).format('YYYY-MM-DDTHH:mm'));
      setEndAt(moment(initialData.end_at).format('YYYY-MM-DDTHH:mm'));
      setColor(initialData.color || '#6366f1');
      setEventType(initialData.event_type || 'meeting');
      setMeetingUrl(initialData.meeting_url || '');
      setAttendeeIds(
        initialData.attendees 
          ? initialData.attendees.map(a => a.user_id) 
          : []
      );
      setLinkedTaskId(initialData.tasks?.[0]?.id || '');
      setRecurrenceRule(initialData.recurrence_rule || '');
    } else {
      // Setup smart defaults
      setTitle('');
      setDescription('');
      setLocation('');
      const now = moment().startOf('hour').add(1, 'hour');
      setStartAt(now.format('YYYY-MM-DDTHH:mm'));
      setEndAt(now.add(1, 'hour').format('YYYY-MM-DDTHH:mm'));
      setColor('#6366f1');
      setEventType('meeting');
      setMeetingUrl('');
      setAttendeeIds([]);
      setLinkedTaskId(prefilledTaskId || '');
      setRecurrenceRule('');
    }
  }, [initialData, isOpen, prefilledTaskId]);

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!title.trim() || !startAt || !endAt) return;

    const data = {
      title,
      description,
      location,
      start_at: new Date(startAt).toISOString(),
      end_at: new Date(endAt).toISOString(),
      color,
      event_type: eventType,
      meeting_url: meetingUrl,
      recurrence_rule: recurrenceRule || null
    };

    onSubmit(data, attendeeIds, linkedTaskId);
  };

  const handleToggleAttendee = (userId) => {
    if (attendeeIds.includes(userId)) {
      setAttendeeIds(attendeeIds.filter(id => id !== userId));
    } else {
      setAttendeeIds([...attendeeIds, userId]);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl flex flex-col max-h-[90vh] overflow-hidden border border-slate-100 animate-in fade-in zoom-in duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-150/60">
          <div className="flex items-center gap-2 text-slate-800">
            <LuCalendar className="text-indigo-600" size={18} />
            <h3 className="font-extrabold text-sm uppercase tracking-wider">
              {initialData ? 'Edit Event' : 'Create Event'}
            </h3>
          </div>
          <button 
            onClick={onClose} 
            className="p-1.5 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-700 transition-colors"
          >
            <LuX size={16} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Title */}
          <div>
            <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">
              Event Title *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Weekly Sync Meeting"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-xs font-semibold text-slate-800"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">
              Description
            </label>
            <textarea
              rows={2}
              placeholder="Provide a summary of the meeting topics..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-xs font-semibold text-slate-700 resize-none"
            />
          </div>

          {/* Dates & Times */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">
                Start Time
              </label>
              <div className="relative">
                <input
                  type="datetime-local"
                  required
                  value={startAt}
                  onChange={(e) => setStartAt(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-xs font-bold text-slate-700"
                />
                <LuClock className="absolute left-3.5 top-3.5 text-slate-400" size={14} />
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">
                End Time
              </label>
              <div className="relative">
                <input
                  type="datetime-local"
                  required
                  value={endAt}
                  onChange={(e) => setEndAt(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-xs font-bold text-slate-700"
                />
                <LuClock className="absolute left-3.5 top-3.5 text-slate-400" size={14} />
              </div>
            </div>
          </div>

          {/* Location & Video Link */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">
                Location / Room
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="e.g. Conference Room A"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-xs font-semibold text-slate-700"
                />
                <LuMapPin className="absolute left-3.5 top-3.5 text-slate-400" size={14} />
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">
                Meeting URL
              </label>
              <div className="relative">
                <input
                  type="url"
                  placeholder="e.g. Google Meet Link"
                  value={meetingUrl}
                  onChange={(e) => setMeetingUrl(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-xs font-semibold text-slate-700"
                />
                <LuVideo className="absolute left-3.5 top-3.5 text-slate-400" size={14} />
              </div>
            </div>
          </div>

          {/* Event Type & Colors */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">
                Event Type
              </label>
              <div className="relative">
                <select
                  value={eventType}
                  onChange={(e) => setEventType(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-xs font-bold text-slate-700 appearance-none bg-white"
                >
                  {EVENT_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
                <LuTag className="absolute left-3.5 top-3.5 text-slate-400" size={14} />
              </div>
            </div>
            
            {/* Color presets */}
            <div>
              <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-2">
                Event Color
              </label>
              <div className="flex flex-wrap gap-2 pt-1">
                {COLORS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => setColor(c.value)}
                    style={{ backgroundColor: c.value }}
                    className="w-5 h-5 rounded-full flex items-center justify-center cursor-pointer transition-transform hover:scale-110 shadow-sm border border-black/10"
                    title={c.label}
                  >
                    {color === c.value && (
                      <LuCheck size={10} className="text-white drop-shadow-[0_1px_1px_rgba(0,0,0,0.5)]" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Recurrence */}
          <div>
            <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">
              Recurrence
            </label>
            <div className="relative">
              <select
                value={recurrenceRule}
                onChange={(e) => setRecurrenceRule(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-xs font-bold text-slate-700 appearance-none bg-white"
              >
                <option value="">Does not repeat</option>
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
                <option value="custom">Custom (RRULE)</option>
              </select>
              <LuRepeat className="absolute left-3.5 top-3.5 text-slate-400" size={14} />
            </div>
          </div>

          {/* Attendees */}
          <div className="relative">
            <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">
              Attendees
            </label>
            
            <button
              type="button"
              onClick={() => setShowAttendeesList(!showAttendeesList)}
              className="w-full text-left px-4 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 transition-colors flex items-center justify-between text-xs font-semibold text-slate-700"
            >
              <span>
                {attendeeIds.length > 0 
                  ? `${attendeeIds.length} attendee(s) selected` 
                  : 'Select team members...'
                }
              </span>
              <span className="text-[10px] text-indigo-500 font-bold">Manage</span>
            </button>

            {showAttendeesList && (
              <div className="absolute top-full left-0 right-0 mt-1.5 bg-white border border-slate-200 rounded-xl shadow-lg z-20 max-h-[160px] overflow-y-auto p-2 space-y-1 animate-in slide-in-from-top-2 duration-150">
                {members.length === 0 ? (
                  <div className="text-center py-4 text-xs font-semibold text-slate-400">
                    No workspace members found
                  </div>
                ) : (
                  members.map((mem) => {
                    const isSelected = attendeeIds.includes(mem.user_id);
                    return (
                      <button
                        key={mem.user_id}
                        type="button"
                        onClick={() => handleToggleAttendee(mem.user_id)}
                        className={`w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-xs font-bold transition-all text-left ${
                          isSelected 
                            ? 'bg-indigo-50 text-indigo-700' 
                            : 'hover:bg-slate-50 text-slate-700'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          {mem.profile_image_url ? (
                            <img
                              src={mem.profile_image_url}
                              alt={mem.name}
                              className="w-5 h-5 rounded-full object-cover"
                            />
                          ) : (
                            <div className="w-5 h-5 rounded-full bg-slate-200 flex items-center justify-center text-[9px] text-slate-600 font-bold">
                              {mem.name?.[0]?.toUpperCase()}
                            </div>
                          )}
                          <span>{mem.name}</span>
                        </div>
                        {isSelected && <LuCheck size={12} className="text-indigo-600" />}
                      </button>
                    );
                  })
                )}
              </div>
            )}
          </div>

          {/* Link Task */}
          <div>
            <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">
              Link Workspace Task
            </label>
            <select
              value={linkedTaskId}
              onChange={(e) => setLinkedTaskId(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-xs font-semibold text-slate-700 bg-white"
            >
              <option value="">-- No linked task --</option>
              {tasks.map((task) => (
                <option key={task.id} value={task.id}>
                  {task.title} ({task.status})
                </option>
              ))}
            </select>
          </div>
        </form>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-150/60 flex items-center justify-end gap-3 bg-slate-50/50">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition-all"
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all shadow-md shadow-indigo-600/10"
          >
            {initialData ? 'Save Changes' : 'Create Event'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default EventFormModal;
