import React, { useState } from 'react';
import { LuX, LuBell, LuBellOff, LuAtSign } from 'react-icons/lu';

export const NotificationPreferencesModal = ({ roomName, initialLevel = 'all', onSave, onClose }) => {
  const [level, setLevel] = useState(initialLevel);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(level);
  };

  const OPTIONS = [
    {
      id: 'all',
      title: 'All Messages',
      desc: 'Get notified for every new message in this room.',
      icon: <LuBell size={18} className="text-indigo-650" />
    },
    {
      id: 'mentions',
      title: 'Mentions Only',
      desc: 'Only get notified when you are @mentioned directly.',
      icon: <LuAtSign size={18} className="text-amber-500" />
    },
    {
      id: 'none',
      title: 'Nothing / Muted',
      desc: 'Turn off all notifications for this room.',
      icon: <LuBellOff size={18} className="text-slate-400" />
    }
  ];

  const displayName = roomName?.startsWith('#') ? roomName.substring(2) : roomName || 'this channel';

  return (
    <div className="modal-overlay flex items-center justify-center p-4 z-50">
      <div className="modal-card max-w-md w-full animate-fade-in bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-2xl shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-zinc-900">
          <div className="flex items-center gap-2">
            <LuBell className="text-indigo-600" size={18} />
            <h3 className="font-bold text-sm text-slate-800 dark:text-zinc-100">Notification Settings</h3>
          </div>
          <button 
            onClick={onClose} 
            className="p-1 hover:bg-slate-100 dark:hover:bg-zinc-900 rounded-lg text-slate-400 dark:text-zinc-500 transition-colors"
          >
            <LuX size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 flex flex-col gap-4">
          <div>
            <p className="text-xs text-slate-500 dark:text-zinc-400 mb-4">
              Choose how you want to be notified about activity in <strong className="text-indigo-650 dark:text-indigo-400">#{displayName}</strong>.
            </p>

            <div className="flex flex-col gap-3">
              {OPTIONS.map(opt => (
                <label 
                  key={opt.id}
                  onClick={() => setLevel(opt.id)}
                  className={`flex items-start gap-3.5 p-3.5 border rounded-2xl cursor-pointer transition-all active:scale-99 ${
                    level === opt.id 
                      ? 'border-indigo-500 bg-indigo-50/20 dark:bg-indigo-950/20 ring-1 ring-indigo-500' 
                      : 'border-slate-100 dark:border-zinc-900 hover:border-slate-200 dark:hover:border-zinc-800 bg-slate-50/30 dark:bg-zinc-900/30'
                  }`}
                >
                  <div className="mt-0.5">{opt.icon}</div>
                  <div className="flex-1 flex flex-col text-left">
                    <span className="text-xs font-bold text-slate-700 dark:text-zinc-200">{opt.title}</span>
                    <span className="text-[10px] text-slate-400 dark:text-zinc-500 mt-0.5">{opt.desc}</span>
                  </div>
                  <input
                    type="radio"
                    name="notification-level"
                    value={opt.id}
                    checked={level === opt.id}
                    onChange={() => setLevel(opt.id)}
                    className="mt-1 accent-indigo-650"
                  />
                </label>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="border-t border-slate-100 dark:border-zinc-900 pt-4 flex justify-end gap-2 mt-2">
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
              Save Preferences
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default NotificationPreferencesModal;
