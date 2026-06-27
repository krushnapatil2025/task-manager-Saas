import React, { useState, useContext, useEffect } from 'react';
import { HiOutlineMenu, HiOutlineX } from 'react-icons/hi';
import { LuSparkles, LuMessageSquare, LuSun, LuMoon, LuSearch } from 'react-icons/lu';
import { useNavigate } from 'react-router-dom';
import SideMenu from './SideMenu';
import WorkspaceSwitcher from '../WorkspaceSwitcher';
import NotificationBell from '../NotificationBell';
import AICommandBar from '../AICommandBar';
import SearchModal from '../SearchModal';
import { UserContext } from '../../context/userContext';
import { getUnreadCounts, pollAndPublishDueMessages } from '../../services/chatService';
import { supabase } from '../../utils/supabaseClient';
import { playUserPrefSound } from '../../utils/audioSynthesizer';
import {
  notificationsSupported,
  requestNotificationPermission,
  showBrowserNotification,
} from '../../utils/browserNotify';
import { useTheme } from '../../context/ThemeContext';
import { useBrand } from '../../context/BrandContext';

// ─────────────────────────────────────────────────────────────────────────────
// Navbar — top bar: brand | workspace switcher | AI button | notification bell
// ─────────────────────────────────────────────────────────────────────────────

const Navbar = ({ activeMenu }) => {
  const [openSideMenu, setOpenSideMenu] = useState(false);
  const [aiOpen,       setAiOpen      ] = useState(false);
  const [searchOpen,   setSearchOpen  ] = useState(false);
  const [totalUnread,  setTotalUnread  ] = useState(0);
  const { user } = useContext(UserContext);
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const { brand } = useBrand();

  // ── Request browser notification permission once ────────────────────────
  useEffect(() => {
    if (!notificationsSupported()) return;
    // Request on first meaningful user interaction (satisfies browser policy)
    const ask = () => {
      requestNotificationPermission();
      window.removeEventListener('click', ask);
    };
    window.addEventListener('click', ask, { once: true });
    return () => window.removeEventListener('click', ask);
  }, []);

  // ── Live chat unread count + WhatsApp-style browser notifications ────────
  useEffect(() => {
    if (!user?.id) return;
    const refresh = async () => {
      try {
        const counts = await getUnreadCounts(user.id);
        setTotalUnread(Object.values(counts).reduce((s, c) => s + c, 0));
      } catch { /* ignore */ }
    };
    refresh();
    const ch = supabase
      .channel('navbar-unread')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' },
        async (payload) => {
          if (payload.new && payload.new.sender_id !== user?.id) {
            try {
              // 1. Check Do Not Disturb (DND)
              const { data: currentProfile } = await supabase
                .from('profiles')
                .select('dnd_until')
                .eq('id', user.id)
                .single();

              const dndUntil = currentProfile?.dnd_until;
              if (dndUntil && new Date(dndUntil) > new Date()) {
                refresh();
                return;
              }

              // 2. Check channel notification preference
              const { data: pref } = await supabase
                .from('chat_notification_prefs')
                .select('level')
                .eq('user_id', user.id)
                .eq('room_id', payload.new.room_id)
                .maybeSingle();

              const level = pref?.level || 'all';
              if (level === 'none') {
                refresh();
                return;
              }
              if (level === 'mentions') {
                const mentions = payload.new.mentions || [];
                if (!mentions.includes(user.id)) {
                  refresh();
                  return;
                }
              }

              // Play notification sound
              playUserPrefSound();

              // Fetch sender profile
              const { data: sender } = await supabase
                .from('profiles')
                .select('name, profile_image_url')
                .eq('id', payload.new.sender_id)
                .single();

              const senderName = sender?.name || 'Someone';
              const avatar     = sender?.profile_image_url || undefined;
              const preview    = payload.new.content
                ? (payload.new.content.startsWith('{') && payload.new.type === 'poll')
                  ? '📊 Created a new poll'
                  : payload.new.content.slice(0, 80) + (payload.new.content.length > 80 ? '…' : '')
                : '📎 Attachment';

              // Show WhatsApp-style browser notification
              showBrowserNotification({
                title:      `${brand.companyName} · ${senderName}`,
                body:       preview,
                icon:       avatar,
                tag:        `chat-${payload.new.room_id}`,
                navigateTo: '/chat',
              });
            } catch (err) {
              console.warn('Navbar notification processing warning:', err);
            }
          }
          refresh();
        })
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [user?.id, brand.companyName]);

  // ── Schedule poller — runs every 60 seconds, publishes due messages ────────
  useEffect(() => {
    if (!user?.id) return;

    const publish = async () => {
      try {
        const count = await pollAndPublishDueMessages(user.id);
        if (count > 0) {
          playUserPrefSound();
        }
      } catch (err) {
        console.warn('Schedule poller error:', err);
      }
    };

    // Run immediately on mount, then every 60s
    publish();
    const interval = setInterval(publish, 60_000);
    return () => clearInterval(interval);
  }, [user?.id]);

  React.useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (user) setAiOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [user]);

  // ── Ctrl+P / Ctrl+Shift+F global shortcut for search ───────────────────────
  React.useEffect(() => {
    const handler = (e) => {
      const isSearchShortcut = 
        ((e.metaKey || e.ctrlKey) && e.key === 'p') || 
        ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === 'f' || e.key === 'F'));
      if (isSearchShortcut) {
        e.preventDefault();
        if (user) setSearchOpen((v) => !v);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [user]);

  // ── When AI parses a NLP task → go to CreateTask with prefill state ──────
  const handleTaskParsed = (parsed) => {
    const dueDate = parsed.dueDateOffset > 0
      ? new Date(Date.now() + parsed.dueDateOffset * 86_400_000)
          .toISOString().split('T')[0]
      : '';
    navigate('/admin/create-task', {
      state: {
        aiPrefill: {
          title:       parsed.title       || '',
          description: parsed.description || '',
          priority:    parsed.priority    || 'low',
          dueDate,
        },
      },
    });
  };

  return (
    <>
      <div className="flex items-center justify-between gap-4 bg-white dark:bg-zinc-950 border-b border-gray-150 dark:border-zinc-800/80 h-[52px] px-6 sticky top-0 z-30 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
        {/* ── Left: hamburger + brand ── */}
        <div className="flex items-center gap-4">
          <button
            className="block lg:hidden text-slate-500 hover:text-slate-800 dark:text-zinc-400 dark:hover:text-zinc-200 transition"
            onClick={() => setOpenSideMenu((o) => !o)}
            aria-label="Toggle menu"
          >
            {openSideMenu
              ? <HiOutlineX    className="text-xl" />
              : <HiOutlineMenu className="text-xl" />}
          </button>

          <div className="flex items-center gap-2.5 select-none">
            {brand.companyLogo ? (
              <img
                src={brand.companyLogo}
                alt="Logo"
                className="w-[30px] h-[30px] rounded-lg object-contain border border-slate-200/40 shadow-sm"
              />
            ) : (
              <div 
                style={{ backgroundColor: brand.brandColor }}
                className="w-[30px] h-[30px] rounded-lg flex items-center justify-center shadow-sm text-white font-black text-xs"
              >
                {brand.companyName?.[0]?.toUpperCase() || 'T'}
              </div>
            )}
            <div className="flex flex-col min-w-0">
              <span className="text-slate-900 dark:text-zinc-100 font-black text-xs leading-none tracking-tight truncate">
                {brand.companyName}
              </span>
              <span className="text-[8px] text-slate-400 dark:text-zinc-500 font-extrabold uppercase tracking-wider leading-none mt-1">
                Workspace
              </span>
            </div>
          </div>
        </div>

        {/* ── Centre: workspace switcher ── */}
        <WorkspaceSwitcher />

        {/* ── Right: AI button + chat badge + notification bell ── */}
        <div className="flex items-center gap-3">
          {user && (
            <button
              id="global-search-trigger"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600 hover:text-indigo-650 bg-slate-50 hover:bg-indigo-50/50 border border-slate-200/60 dark:bg-zinc-900/60 dark:hover:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-800/80 cursor-pointer transition-all duration-200"
              onClick={() => setSearchOpen(true)}
              title="Global Smart Search (Ctrl+P)"
            >
              <LuSearch className="text-slate-400" size={14} />
              <span className="hidden md:inline">Search</span>
              <span className="text-[10px] text-slate-450 bg-slate-100 dark:bg-zinc-800 dark:text-zinc-400 px-1.5 py-0.5 rounded font-mono">Ctrl+P</span>
            </button>
          )}

          {user && (
            <button
              id="ai-command-bar-trigger"
              className="ai-nav-btn"
              onClick={() => setAiOpen(true)}
              title="Open AI Assistant (Ctrl+K)"
            >
              <LuSparkles className="ai-nav-sparkle" />
              <span className="hidden sm:inline">AI Assistant</span>
              <span className="ai-nav-kbd">Ctrl+K</span>
            </button>
          )}

          {/* Chat icon with unread badge */}
          {user && (
            <button
              id="navbar-chat-btn"
              onClick={() => navigate('/chat')}
              title="Team Chat"
              className="relative p-2 rounded-xl text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 dark:text-zinc-400 dark:hover:text-zinc-200 dark:hover:bg-zinc-800/60 transition"
            >
              <LuMessageSquare size={18} />
              {totalUnread > 0 && (
                <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[8px] font-extrabold rounded-full min-w-[14px] h-3.5 flex items-center justify-center px-0.5">
                  {totalUnread > 99 ? '99+' : totalUnread}
                </span>
              )}
            </button>
          )}

          <NotificationBell />

          {/* Theme Switcher */}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-xl text-slate-500 hover:text-indigo-655 hover:bg-indigo-50/50 dark:text-zinc-400 dark:hover:text-zinc-200 dark:hover:bg-zinc-800/60 transition cursor-pointer"
            title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
          >
            {theme === 'dark' ? <LuSun size={18} className="text-amber-500" /> : <LuMoon size={18} />}
          </button>
        </div>

        {/* ── Mobile slide-down side menu ── */}
        {openSideMenu && (
          <div className="fixed top-[52px] left-0 bg-white dark:bg-zinc-950 shadow-xl z-40 lg:hidden">
            <SideMenu activeMenu={activeMenu} />
          </div>
        )}
      </div>

      {/* ── Global AI Command Bar overlay ── */}
      <AICommandBar
        isOpen={aiOpen}
        onClose={() => setAiOpen(false)}
        onTaskParsed={handleTaskParsed}
        tasks={[]}
      />

      {/* ── Global Search overlay ── */}
      <SearchModal
        isOpen={searchOpen}
        onClose={() => setSearchOpen(false)}
      />
    </>
  );
};

export default Navbar;