import React, { useState, useContext, useEffect } from 'react';
import { HiOutlineMenu, HiOutlineX } from 'react-icons/hi';
import { LuSparkles, LuMessageSquare } from 'react-icons/lu';
import { useNavigate } from 'react-router-dom';
import SideMenu from './SideMenu';
import WorkspaceSwitcher from '../WorkspaceSwitcher';
import NotificationBell from '../NotificationBell';
import AICommandBar from '../AICommandBar';
import { UserContext } from '../../context/userContext';
import { getUnreadCounts } from '../../services/chatService';
import { supabase } from '../../utils/supabaseClient';

// ─────────────────────────────────────────────────────────────────────────────
// Navbar — top bar: brand | workspace switcher | AI button | notification bell
// ─────────────────────────────────────────────────────────────────────────────

const Navbar = ({ activeMenu }) => {
  const [openSideMenu, setOpenSideMenu] = useState(false);
  const [aiOpen,       setAiOpen      ] = useState(false);
  const [totalUnread,  setTotalUnread  ] = useState(0);
  const { user } = useContext(UserContext);
  const navigate = useNavigate();

  // ── Live chat unread count ───────────────────────────────────────────────
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
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, refresh)
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [user?.id]);

  // ── Ctrl+K global shortcut ───────────────────────────────────────────────
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
      <div className="flex items-center justify-between gap-4 bg-white/85 backdrop-blur-lg border-b border-slate-200/50 py-3 px-6 sticky top-0 z-30 shadow-[0_2px_12px_rgba(0,0,0,0.02)]">
        {/* ── Left: hamburger + brand ── */}
        <div className="flex items-center gap-4">
          <button
            className="block lg:hidden text-slate-500 hover:text-slate-800 transition"
            onClick={() => setOpenSideMenu((o) => !o)}
            aria-label="Toggle menu"
          >
            {openSideMenu
              ? <HiOutlineX    className="text-2xl" />
              : <HiOutlineMenu className="text-2xl" />}
          </button>

          <h2 className="text-base font-extrabold text-slate-900 tracking-tight select-none flex items-center gap-2">
            <span className="w-2.5 h-5 bg-gradient-to-b from-indigo-500 to-violet-600 rounded-sm inline-block shadow-sm shadow-indigo-500/30"></span>
            Task<span className="text-indigo-600">Flow</span>
          </h2>
        </div>

        {/* ── Centre: workspace switcher ── */}
        <WorkspaceSwitcher />

        {/* ── Right: AI button + chat badge + notification bell ── */}
        <div className="flex items-center gap-3">
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
              className="relative p-2 rounded-xl text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 transition"
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
        </div>

        {/* ── Mobile slide-down side menu ── */}
        {openSideMenu && (
          <div className="fixed top-[57px] left-0 bg-white shadow-xl z-40 lg:hidden">
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
    </>
  );
};

export default Navbar;