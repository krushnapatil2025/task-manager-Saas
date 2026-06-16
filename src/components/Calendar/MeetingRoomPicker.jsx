import React from 'react';
import { LuMapPin, LuVideo, LuSparkles } from 'react-icons/lu';

export const MeetingRoomPicker = ({
  location,
  onChangeLocation,
  meetingUrl,
  onChangeMeetingUrl
}) => {
  const generateMeetingLink = () => {
    // Generate a mock unique Jitsi or Google Meet link for convenience
    const randomRoomId = Math.random().toString(36).substring(2, 12);
    onChangeMeetingUrl(`https://meet.jit.si/taskflow-${randomRoomId}`);
  };

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">
            Physical Location / Room
          </label>
          <div className="relative">
            <input
              type="text"
              placeholder="e.g. Conference Room A"
              value={location || ''}
              onChange={(e) => onChangeLocation(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-xs font-semibold text-slate-700"
            />
            <LuMapPin className="absolute left-3.5 top-3 text-slate-400" size={14} />
          </div>
        </div>

        <div>
          <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1">
            Meeting Link (e.g. Teams, Jitsi)
          </label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                type="url"
                placeholder="https://meet.google.com/..."
                value={meetingUrl || ''}
                onChange={(e) => onChangeMeetingUrl(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-xs font-semibold text-slate-700"
              />
              <LuVideo className="absolute left-3.5 top-3 text-slate-400" size={14} />
            </div>
            <button
              type="button"
              onClick={generateMeetingLink}
              className="px-3 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-600 rounded-xl text-xs font-bold transition-all flex items-center gap-1 shadow-sm shrink-0"
              title="Generate Jitsi video meeting link"
            >
              <LuSparkles size={12} />
              <span>Generate</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MeetingRoomPicker;
