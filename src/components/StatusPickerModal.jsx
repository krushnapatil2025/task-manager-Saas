import React, { useState, useEffect } from 'react';
import { LuX, LuSparkles, LuBellOff, LuBell, LuClock } from 'react-icons/lu';
import { toast } from 'react-hot-toast';
import moment from 'moment';

const QUICK_STATUSES = [
  { emoji: '🟢', text: 'Active / Available', dnd: false, duration: null },
  { emoji: '📅', text: 'In a meeting', dnd: true, duration: 60 }, // 1 hour
  { emoji: '🍔', text: 'Out to lunch', dnd: false, duration: 60 }, // 1 hour
  { emoji: '🏠', text: 'Working from home', dnd: false, duration: 480 }, // 8 hours
  { emoji: '🤒', text: 'Out sick', dnd: true, duration: 1440 }, // 1 day
  { emoji: '🚀', text: 'Focusing / Deep work', dnd: true, duration: 120 }, // 2 hours
];

const EMOJI_OPTIONS = ['🟢', '🌙', '📅', '🍔', '🤒', '🏠', '🚀', '💻', '🌴', '🎧', '⚠️'];

export const StatusPickerModal = ({ userProfile, onSave, onClose }) => {
  const [emoji, setEmoji] = useState('🟢');
  const [text, setText] = useState('');
  const [duration, setDuration] = useState('none'); // 'none', '30m', '1h', '4h', 'today'
  const [dndDuration, setDndDuration] = useState('none'); // 'none', '30m', '1h', '2h', '8h', '24h'

  // Initialize status state from userProfile
  useEffect(() => {
    if (userProfile) {
      setEmoji(userProfile.statusEmoji || '🟢');
      setText(userProfile.statusText || '');
      
      // Determine DND remaining time
      if (userProfile.dndUntil && moment(userProfile.dndUntil).isAfter(moment())) {
        setDndDuration('active');
      } else {
        setDndDuration('none');
      }
    }
  }, [userProfile]);

  const selectQuickStatus = (item) => {
    setEmoji(item.emoji);
    setText(item.text);
    if (item.duration) {
      if (item.duration === 60) setDuration('1h');
      else if (item.duration === 120) setDuration('2h');
      else if (item.duration === 480) setDuration('4h');
      else if (item.duration === 1440) setDuration('today');
    } else {
      setDuration('none');
    }

    if (item.dnd) {
      setDndDuration('1h');
    } else {
      setDndDuration('none');
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    let expiresAt = null;
    if (duration !== 'none') {
      const now = moment();
      if (duration === '30m') expiresAt = now.add(30, 'minutes').toISOString();
      else if (duration === '1h') expiresAt = now.add(1, 'hour').toISOString();
      else if (duration === '2h') expiresAt = now.add(2, 'hours').toISOString();
      else if (duration === '4h') expiresAt = now.add(4, 'hours').toISOString();
      else if (duration === 'today') expiresAt = now.endOf('day').toISOString();
    }

    let dndUntil = null;
    if (dndDuration !== 'none' && dndDuration !== 'active') {
      const now = moment();
      if (dndDuration === '30m') dndUntil = now.add(30, 'minutes').toISOString();
      else if (dndDuration === '1h') dndUntil = now.add(1, 'hour').toISOString();
      else if (dndDuration === '2h') dndUntil = now.add(2, 'hours').toISOString();
      else if (dndDuration === '8h') dndUntil = now.add(8, 'hours').toISOString();
      else if (dndDuration === '24h') dndUntil = now.add(24, 'hours').toISOString();
    } else if (dndDuration === 'active') {
      // Keep existing DND
      dndUntil = userProfile.dndUntil;
    }

    onSave({
      status_emoji: emoji,
      status_text: text.trim(),
      status_expires_at: expiresAt,
      dnd_until: dndUntil,
    });
  };

  const handleClearStatus = () => {
    onSave({
      status_emoji: '🟢',
      status_text: '',
      status_expires_at: null,
      dnd_until: null,
    });
  };

  const isDndActive = userProfile?.dndUntil && moment(userProfile.dndUntil).isAfter(moment());

  return (
    <div className="modal-overlay flex items-center justify-center p-4 z-50">
      <div className="modal-card max-w-md w-full animate-fade-in bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-zinc-900">
          <div className="flex items-center gap-2">
            <LuSparkles className="text-indigo-600" size={18} />
            <h3 className="font-bold text-sm text-slate-800 dark:text-zinc-100">Set a Status</h3>
          </div>
          <button 
            onClick={onClose} 
            className="p-1 hover:bg-slate-100 dark:hover:bg-zinc-900 rounded-lg text-slate-400 dark:text-zinc-500 transition-colors"
          >
            <LuX size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 flex flex-col gap-4">
          
          {/* Custom Status Input Row */}
          <div>
            <label className="text-[10px] uppercase font-bold text-slate-400 dark:text-zinc-500 block mb-1.5">
              What's your status?
            </label>
            <div className="flex gap-2">
              {/* Emoji Selector Grid Trigger */}
              <div className="relative">
                <select
                  value={emoji}
                  onChange={(e) => setEmoji(e.target.value)}
                  className="px-2 py-2 border border-slate-200 dark:border-zinc-800 rounded-xl bg-slate-50 dark:bg-zinc-900 outline-none text-base cursor-pointer hover:bg-slate-100 transition-colors h-10"
                >
                  {EMOJI_OPTIONS.map(emo => (
                    <option key={emo} value={emo}>{emo}</option>
                  ))}
                </select>
              </div>

              {/* Text Input */}
              <input
                type="text"
                placeholder="What is your current status?"
                className="flex-1 text-xs px-3.5 py-2 border border-slate-200 dark:border-zinc-800 rounded-xl bg-slate-50/50 dark:bg-zinc-900 outline-none focus:border-indigo-500 text-slate-800 dark:text-zinc-150 h-10"
                value={text}
                onChange={e => setText(e.target.value)}
                maxLength={100}
              />
            </div>
          </div>

          {/* Quick status recommendations */}
          <div>
            <label className="text-[10px] uppercase font-bold text-slate-400 dark:text-zinc-500 block mb-2">
              Quick Suggestions
            </label>
            <div className="grid grid-cols-2 gap-2">
              {QUICK_STATUSES.map((item, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => selectQuickStatus(item)}
                  className="flex items-center gap-2 p-2 border border-slate-100 dark:border-zinc-900 hover:border-indigo-100 dark:hover:border-indigo-950 rounded-xl text-[11px] text-left text-slate-650 hover:bg-indigo-50/20 dark:text-zinc-300 transition-all active:scale-95"
                >
                  <span className="text-base select-none">{item.emoji}</span>
                  <span className="truncate">{item.text}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Expiration Duration */}
          <div>
            <label className="text-[10px] uppercase font-bold text-slate-400 dark:text-zinc-500 block mb-1.5">
              Clear status after...
            </label>
            <div className="relative">
              <select
                value={duration}
                onChange={e => setDuration(e.target.value)}
                className="w-full text-xs px-3.5 py-2.5 border border-slate-200 dark:border-zinc-800 rounded-xl bg-slate-50 dark:bg-zinc-900 outline-none focus:border-indigo-500 text-slate-700 dark:text-zinc-300 cursor-pointer"
              >
                <option value="none">Don't clear automatically</option>
                <option value="30m">30 minutes</option>
                <option value="1h">1 hour</option>
                <option value="2h">2 hours</option>
                <option value="4h">4 hours</option>
                <option value="today">Today</option>
              </select>
            </div>
          </div>

          {/* Do Not Disturb (DND) Setup */}
          <div className="border-t border-slate-100 dark:border-zinc-900 pt-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <LuBellOff size={15} className="text-amber-500" />
                <span className="text-xs font-bold text-slate-700 dark:text-zinc-200">Do Not Disturb (DND)</span>
              </div>
              {isDndActive && (
                <span className="text-[9px] bg-amber-100 dark:bg-amber-950/40 text-amber-700 dark:text-amber-400 px-2 py-0.5 rounded-full font-bold">
                  Active until {moment(userProfile.dndUntil).format('h:mm A')}
                </span>
              )}
            </div>
            <select
              value={dndDuration}
              onChange={e => setDndDuration(e.target.value)}
              className="w-full text-xs px-3.5 py-2.5 border border-slate-200 dark:border-zinc-800 rounded-xl bg-slate-50 dark:bg-zinc-900 outline-none focus:border-indigo-500 text-slate-700 dark:text-zinc-300 cursor-pointer"
            >
              {isDndActive && <option value="active">Keep DND active</option>}
              <option value="none">Notifications On (Normal)</option>
              <option value="30m">Pause for 30 minutes</option>
              <option value="1h">Pause for 1 hour</option>
              <option value="2h">Pause for 2 hours</option>
              <option value="8h">Pause for 8 hours</option>
              <option value="24h">Pause for 24 hours</option>
            </select>
            <p className="text-[9px] text-slate-400 mt-1">
              While DND is enabled, browser push notifications will be fully muted.
            </p>
          </div>

          {/* Footer Actions */}
          <div className="border-t border-slate-100 dark:border-zinc-900 pt-4 flex justify-between gap-2 mt-1">
            <button
              type="button"
              onClick={handleClearStatus}
              className="text-xs text-red-650 hover:bg-red-50 dark:hover:bg-red-950/20 px-3.5 py-2 rounded-xl transition-colors font-semibold"
            >
              Clear Current Status
            </button>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-zinc-900 px-3.5 py-2 rounded-xl transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="text-xs bg-indigo-650 hover:bg-indigo-750 text-white px-5 py-2 rounded-xl font-bold transition-colors shadow-sm cursor-pointer"
              >
                Save
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};

export default StatusPickerModal;
