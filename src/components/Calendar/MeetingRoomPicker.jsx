import React, { useState } from 'react';
import { LuMapPin, LuVideo, LuSparkles, LuLoaderCircle, LuCheckCircle, LuAlertCircle } from 'react-icons/lu';
import { generateGoogleMeetLink } from '../../services/googleCalendarService';

// ─────────────────────────────────────────────────────────────────────────────
// MeetingRoomPicker — one-click real Google Meet link generation
//
// Uses Google Identity Services (GIS) + Calendar API to create a real
// meet.google.com/xxx-xxxx-xxx link directly inside the app.
// First click may show a Google sign-in popup (one time per session).
// ─────────────────────────────────────────────────────────────────────────────

export const MeetingRoomPicker = ({
  location,
  onChangeLocation,
  meetingUrl,
  onChangeMeetingUrl,
  // Pass these from the event form for a properly pre-titled meeting room
  eventTitle = 'Team Meeting',
  eventStart = null,
  eventEnd = null,
}) => {
  const [status, setStatus] = useState('idle'); // idle | loading | success | error
  const [errorMsg, setErrorMsg] = useState('');

  const handleGenerateMeet = async () => {
    setStatus('loading');
    setErrorMsg('');
    try {
      const link = await generateGoogleMeetLink({
        title: eventTitle,
        start: eventStart || new Date(),
        end: eventEnd || null,
      });
      onChangeMeetingUrl(link);
      setStatus('success');
      // Reset to idle after 3 seconds
      setTimeout(() => setStatus('idle'), 3000);
    } catch (err) {
      console.error('Google Meet generation failed:', err);
      setErrorMsg(err.message || 'Failed to generate link. Please try again.');
      setStatus('error');
      setTimeout(() => setStatus('idle'), 5000);
    }
  };

  const buttonLabel = {
    idle: 'Generate',
    loading: 'Generating…',
    success: 'Generated!',
    error: 'Try Again',
  }[status];

  const buttonIcon = {
    idle: <LuSparkles size={12} />,
    loading: <LuLoaderCircle size={12} className="animate-spin" />,
    success: <LuCheckCircle size={12} />,
    error: <LuAlertCircle size={12} />,
  }[status];

  const buttonStyle = {
    idle: 'bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/40 border-indigo-200 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400',
    loading: 'bg-indigo-50 dark:bg-indigo-950/40 border-indigo-200 dark:border-indigo-800 text-indigo-400 dark:text-indigo-500 cursor-not-allowed',
    success: 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-600 dark:text-emerald-400',
    error: 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-800 text-rose-600 dark:text-rose-400',
  }[status];

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">

        {/* Physical Location */}
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
              className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-slate-700 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-xs font-semibold"
            />
            <LuMapPin className="absolute left-3.5 top-3 text-slate-400" size={14} />
          </div>
        </div>

        {/* Google Meet Link */}
        <div>
          <label className="block text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-1.5">
            {/* Google Meet branded icon */}
            <svg viewBox="0 0 87.5 72" className="w-3 h-3" xmlns="http://www.w3.org/2000/svg">
              <path d="M50 26.2v19.6l12.5 9.4 12.5-9.4v-7l12.5 9.4V23.8L75 33.2v-7L62.5 16.8z" fill="#00832d" />
              <path d="M0 51.5V66c0 3.3 2.7 6 6 6h14.5l3-10.3-3-10.2H0z" fill="#0066da" />
              <path d="M20.5 0 0 20.5v31h20.5V20.5L41 0z" fill="#e94235" />
              <path d="M20.5 20.5H41V0L20.5 0z" fill="#ff4131" />
              <path d="M20.5 51.5H0v14.5h20.5l3.3-7.3z" fill="#00ac47" />
              <path d="M41 20.5H20.5v31H41l12.5-15.5z" fill="#2684fc" />
              <path d="M41 51.5H20.5V66h20.5z" fill="#00832d" />
              <path d="M41 66h9.5l12.5-9.4V35.6L50 45.8V66H41z" fill="#0066da" />
            </svg>
            Google Meet Link
          </label>

          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                type="url"
                placeholder="Click Generate → real Meet link appears here"
                value={meetingUrl || ''}
                onChange={(e) => onChangeMeetingUrl(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 text-slate-700 dark:text-zinc-200 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all text-xs font-semibold"
              />
              <LuVideo className="absolute left-3.5 top-3 text-slate-400" size={14} />
            </div>

            {/* One-click Generate button */}
            <button
              type="button"
              onClick={handleGenerateMeet}
              disabled={status === 'loading'}
              className={`px-3 py-2 border rounded-xl text-[10px] font-bold transition-all flex items-center gap-1.5 shadow-sm shrink-0 ${buttonStyle}`}
              title="Generate a real Google Meet link using your Google account"
            >
              {buttonIcon}
              <span>{buttonLabel}</span>
            </button>
          </div>

          {/* Status messages */}
          {status === 'error' && errorMsg && (
            <p className="text-[10px] text-rose-500 dark:text-rose-400 mt-1.5 leading-relaxed flex items-start gap-1">
              <LuAlertCircle size={10} className="mt-0.5 flex-shrink-0" />
              {errorMsg}
            </p>
          )}
          {status === 'idle' && !meetingUrl && (
            <p className="text-[10px] text-slate-400 dark:text-zinc-600 mt-1.5 leading-relaxed">
              💡 Click <strong>Generate</strong> — a real <code className="bg-slate-100 dark:bg-zinc-800 px-1 rounded">meet.google.com</code> link will appear instantly after a quick Google sign-in (first time only).
            </p>
          )}
          {status === 'success' && meetingUrl && (
            <p className="text-[10px] text-emerald-600 dark:text-emerald-400 mt-1.5 font-semibold flex items-center gap-1">
              <LuCheckCircle size={10} />
              Real Google Meet link generated and saved!
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default MeetingRoomPicker;
