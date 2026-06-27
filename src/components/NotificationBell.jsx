import React, { useState, useEffect, useRef, useContext, useCallback } from 'react';
import {
  LuBell, LuCheckCheck, LuLoaderCircle,
  LuClipboardCheck, LuMessageSquare, LuUserPlus, LuX, LuCalendar
} from 'react-icons/lu';
import { useNavigate } from 'react-router-dom';
import moment from 'moment';
import { UserContext } from '../context/userContext';
import { getNotifications, getUnreadCount, markAsRead, markAllAsRead } from '../services/notificationService';
import { useRealtimeNotifications } from '../hooks/useRealtimeTasks';
import { playUserPrefSound } from '../utils/audioSynthesizer';

// ─────────────────────────────────────────────────────────────────────────────
// NotificationBell — navbar bell icon with dropdown panel and real-time badge
// ─────────────────────────────────────────────────────────────────────────────

const TYPE_ICON = {
  task_assigned: <LuUserPlus      className="text-blue-500"   />,
  task_comment:  <LuMessageSquare className="text-purple-500" />,
  task_status:   <LuClipboardCheck className="text-lime-500"  />,
  mention:       <LuMessageSquare className="text-amber-500"  />,
  calendar_event:<LuCalendar      className="text-indigo-500" />,
};

const NotificationBell = () => {
  const { user }    = useContext(UserContext);
  const navigate    = useNavigate();

  const [open, setOpen]             = useState(false);
  const [notifications, setNotifs]  = useState([]);
  const [unread, setUnread]         = useState(0);
  const [loading, setLoading]       = useState(false);
  const panelRef = useRef(null);

  // Close on outside click
  useEffect(() => {
    const h = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  const loadNotifications = useCallback(async () => {
    if (!user?.id) return;
    try {
      setLoading(true);
      const [data, cnt] = await Promise.all([
        getNotifications(user.id, 20),
        getUnreadCount(user.id),
      ]);
      setNotifs(data);
      setUnread(cnt);
    } catch (err) {
      console.error('Notifications error:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  // Real-time: re-fetch when a new notification arrives
  useRealtimeNotifications(user?.id, () => {
    loadNotifications();
    playUserPrefSound();
  });

  useEffect(() => { loadNotifications(); }, [loadNotifications]);

  const handleOpen = () => {
    setOpen((o) => !o);
    if (!open) loadNotifications();
  };

  const handleClick = async (notif) => {
    try {
      await markAsRead(notif.id);
      setNotifs((prev) => prev.map((n) => n.id === notif.id ? { ...n, is_read: true } : n));
      setUnread((n) => Math.max(0, n - 1));
    } catch {}
    if (notif.link) navigate(notif.link);
    setOpen(false);
  };

  const handleMarkAll = async () => {
    try {
      await markAllAsRead(user.id);
      setNotifs((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnread(0);
    } catch (err) {
      console.error('Mark all error:', err);
    }
  };

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell button */}
      <button
        onClick={handleOpen}
        className="relative w-9 h-9 flex items-center justify-center rounded-xl hover:bg-gray-100 transition text-gray-500 hover:text-gray-800"
        aria-label="Notifications"
      >
        <LuBell className="text-xl" />
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4.5 h-4.5 min-w-[18px] px-0.5 flex items-center justify-center text-[9px] font-bold text-white bg-red-500 rounded-full border-2 border-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {/* Dropdown panel */}
      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-white rounded-2xl shadow-2xl border border-gray-100 z-50 animate-fade-in overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <LuBell className="text-gray-500 text-sm" />
              <h3 className="font-semibold text-sm text-gray-800">Notifications</h3>
              {unread > 0 && (
                <span className="bg-red-100 text-red-600 text-[10px] font-bold px-2 py-0.5 rounded-full">
                  {unread} new
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {unread > 0 && (
                <button
                  onClick={handleMarkAll}
                  className="flex items-center gap-1 text-[11px] text-blue-600 hover:text-blue-800 font-medium"
                >
                  <LuCheckCheck className="text-xs" /> All read
                </button>
              )}
              <button onClick={() => setOpen(false)} className="text-gray-400 hover:text-gray-700 ml-2">
                <LuX className="text-sm" />
              </button>
            </div>
          </div>

          {/* List */}
          <div className="max-h-96 overflow-y-auto divide-y divide-gray-50">
            {loading ? (
              <div className="flex justify-center py-8">
                <LuLoaderCircle className="animate-spin text-blue-500 text-xl" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="py-10 text-center">
                <LuBell className="text-gray-300 text-3xl mx-auto mb-2" />
                <p className="text-xs text-gray-400">You're all caught up!</p>
              </div>
            ) : (
              notifications.map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleClick(n)}
                  className={`w-full flex items-start gap-3 px-4 py-3 hover:bg-gray-50 transition text-left ${
                    !n.is_read ? 'bg-blue-50/40' : ''
                  }`}
                >
                  <div className="w-8 h-8 rounded-xl bg-gray-100 flex items-center justify-center flex-shrink-0 text-base">
                    {TYPE_ICON[n.type] || <LuBell className="text-gray-400" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-semibold truncate ${!n.is_read ? 'text-gray-900' : 'text-gray-600'}`}>
                      {n.title}
                    </p>
                    {n.body && (
                      <p className="text-[11px] text-gray-400 truncate mt-0.5">{n.body}</p>
                    )}
                    <p className="text-[10px] text-gray-300 mt-1">
                      {moment(n.created_at).fromNow()}
                    </p>
                  </div>
                  {!n.is_read && (
                    <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0 mt-1" />
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
