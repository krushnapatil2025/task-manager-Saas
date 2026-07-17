import React, { useEffect, useState } from 'react';
import { NavLink, useNavigate, Outlet } from 'react-router-dom';
import { superAdminLogout, getSuperAdminSession } from '../../utils/superAdminSession';
import { getPendingRegistrationCount } from '../../services/superAdminService';
import {
  LuShield, LuLayoutDashboard, LuBuilding2,
  LuUsers, LuActivity, LuLogOut, LuChevronRight,
  LuChevronLeft, LuClipboardCheck, LuMail, LuSettings,
  LuLock, LuMenu, LuServer
} from 'react-icons/lu';
import { toast } from 'react-hot-toast';

// ─────────────────────────────────────────────────────────────────────────────
// SuperAdminLayout — Collapsible glassmorphic dark sidebar console layout
// ─────────────────────────────────────────────────────────────────────────────

const SuperAdminLayout = ({ title = 'Super Admin' }) => {
  const session = getSuperAdminSession();
  const navigate = useNavigate();
  const [pendingCount, setPendingCount] = useState(0);

  // Collapse state persisted in localStorage
  const [isCollapsed, setIsCollapsed] = useState(() => {
    const saved = localStorage.getItem('sa_sidebar_collapsed');
    return saved === 'true';
  });

  // Load pending count for the sidebar badge and update periodically
  useEffect(() => {
    const fetchPending = () => {
      getPendingRegistrationCount()
        .then(setPendingCount)
        .catch(() => { });
    };
    fetchPending();
    const interval = setInterval(fetchPending, 30000); // refresh every 30s
    return () => clearInterval(interval);
  }, []);

  const handleLogout = () => {
    superAdminLogout();
    toast.success('Successfully logged out!');
    navigate('/');
  };

  const toggleSidebar = () => {
    setIsCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('sa_sidebar_collapsed', String(next));
      return next;
    });
  };

  const NAV_ITEMS = [
    { label: 'Overview', icon: LuLayoutDashboard, path: '/super-admin/dashboard', badge: null },
    { label: 'Approvals', icon: LuClipboardCheck, path: '/super-admin/registrations', badge: pendingCount },
    { label: 'Workspaces', icon: LuBuilding2, path: '/super-admin/workspaces', badge: null },
    { label: 'Users', icon: LuUsers, path: '/super-admin/users', badge: null },
    { label: 'Activity', icon: LuActivity, path: '/super-admin/activity', badge: null },
    { label: 'Email Logs', icon: LuMail, path: '/super-admin/email-logs', badge: null },
    { label: 'Settings', icon: LuSettings, path: '/super-admin/settings', badge: null },
    { label: 'Security', icon: LuLock, path: '/super-admin/security', badge: null },
  ];

  return (
    <div className="flex min-h-screen bg-slate-950 text-white font-sans antialiased selection:bg-red-500/30">

      {/* ── Collapsible Sidebar ── */}
      <aside
        className={`flex-shrink-0 bg-slate-900/90 backdrop-blur-md border-r border-slate-800/80 flex flex-col sticky top-0 h-screen transition-all duration-300 ease-in-out z-30 ${isCollapsed ? 'w-20' : 'w-64'
          }`}
      >
        {/* Brand / Logo Section */}
        <div className="flex items-center justify-between px-5 py-5 border-b border-slate-800/60">
          <div className="flex items-center gap-3 overflow-hidden">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-600 to-orange-500 flex items-center justify-center shadow-lg shadow-red-500/25 flex-shrink-0 transition-transform duration-300 hover:rotate-6">
              <LuShield className="text-white text-xl" />
            </div>
            {!isCollapsed && (
              <div className="animate-fade-in whitespace-nowrap">
                <p className="text-sm font-bold text-white tracking-tight leading-none uppercase">Strideo</p>
                <p className="text-[10px] text-slate-400 font-semibold mt-1">Platform Console</p>
              </div>
            )}
          </div>

          {/* Collapse toggle button */}
          {!isCollapsed && (
            <button
              onClick={toggleSidebar}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition duration-200 cursor-pointer"
              title="Collapse Menu"
            >
              <LuChevronLeft className="text-lg" />
            </button>
          )}
        </div>

        {/* Navigation Items */}
        <nav className="flex-1 py-6 px-3 space-y-1.5 overflow-y-auto custom-scrollbar">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              title={isCollapsed ? item.label : undefined}
              className={({ isActive }) =>
                `flex items-center gap-3.5 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 relative group ${isActive
                  ? 'bg-gradient-to-r from-red-500/10 to-orange-500/5 text-white border border-red-500/20 shadow-md shadow-red-950/10'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/50 border border-transparent'
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {/* Left accent indicator for active item */}
                  {isActive && (
                    <span className="absolute left-0 top-1/4 bottom-1/4 w-1 bg-gradient-to-b from-red-500 to-orange-500 rounded-r-md" />
                  )}

                  <item.icon className={`text-lg flex-shrink-0 transition-transform duration-200 group-hover:scale-105 ${isActive ? 'text-red-400' : 'text-slate-400'
                    }`} />

                  {!isCollapsed && (
                    <span className="flex-1 transition-all duration-200">{item.label}</span>
                  )}

                  {/* Pending Approvals live counter */}
                  {item.badge > 0 && (
                    <span className={`min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[9px] font-black rounded-full flex items-center justify-center tabular-nums shadow-sm shadow-red-500/30 animate-pulse ${isCollapsed ? 'absolute right-2 top-2' : ''
                      }`}>
                      {item.badge > 99 ? '99+' : item.badge}
                    </span>
                  )}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        {/* User Profile / Footer Section */}
        <div className="p-4 border-t border-slate-800/60 bg-slate-900/40">
          <div className="flex items-center gap-3 mb-3 px-2">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center flex-shrink-0 shadow-md">
              <span className="text-white text-xs font-black">SA</span>
            </div>
            {!isCollapsed && (
              <div className="flex-1 min-w-0 animate-fade-in">
                <p className="text-xs font-semibold text-slate-100 truncate">{session?.name || 'Super Admin'}</p>
                <p className="text-[10px] text-slate-400 truncate mt-0.5">{session?.email || 'admin@Strideo.com'}</p>
              </div>
            )}
          </div>

          {/* Sign Out Action */}
          <button
            onClick={handleLogout}
            className={`w-full flex items-center gap-3 text-xs font-medium text-slate-400 hover:text-red-400 px-3.5 py-2.5 rounded-xl hover:bg-red-500/10 border border-transparent hover:border-red-500/10 transition duration-200 cursor-pointer ${isCollapsed ? 'justify-center' : ''
              }`}
            title="Sign Out"
          >
            <LuLogOut className="text-base flex-shrink-0" />
            {!isCollapsed && <span>Sign Out</span>}
          </button>
        </div>
      </aside>

      {/* ── Main Content Area ── */}
      <div className="flex-1 flex flex-col min-h-screen min-w-0 bg-gradient-to-b from-slate-950 via-slate-950 to-slate-900">

        {/* Dynamic Top Header Bar */}
        <header className="sticky top-0 z-20 bg-slate-950/70 backdrop-blur-md border-b border-slate-900 px-8 py-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 text-xs text-slate-500">
            {/* Show toggle on collapse */}
            {isCollapsed && (
              <button
                onClick={toggleSidebar}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition duration-200 mr-2 cursor-pointer"
                title="Expand Menu"
              >
                <LuMenu className="text-base" />
              </button>
            )}
            <span>Platform Console</span>
            <LuChevronRight className="text-slate-700 text-xs" />
            <span className="text-slate-200 font-semibold">{title}</span>
          </div>

          <div className="flex items-center gap-4">
            {/* System Status Indicator */}
            <div className="flex items-center gap-2 bg-slate-900/50 border border-slate-800 px-3 py-1.5 rounded-full text-[10px] text-slate-400">
              <LuServer className="text-green-500 animate-pulse text-xs" />
              <span className="font-medium">SYSTEM: RUNNING</span>
            </div>

            {/* Live pending registrations badge */}
            {pendingCount > 0 && (
              <button
                onClick={() => navigate('/super-admin/registrations')}
                className="flex items-center gap-2 text-[10px] font-black text-red-400 bg-red-500/10 border border-red-500/20 px-3 py-1.5 rounded-full hover:bg-red-500/20 transition cursor-pointer"
              >
                <span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-ping" />
                {pendingCount} Pending Approval
              </button>
            )}

            <span className="text-[10px] font-bold tracking-wider text-red-400 bg-red-500/15 border border-red-500/30 px-3 py-1.5 rounded-full shadow-inner shadow-red-500/10">
              🛡️ SYSTEM OWNER
            </span>
          </div>
        </header>

        {/* Nested Page Routes Render Container */}
        <main className="flex-1 p-8 overflow-y-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default SuperAdminLayout;

