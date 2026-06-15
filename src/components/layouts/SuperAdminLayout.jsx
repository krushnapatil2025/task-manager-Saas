import React from 'react';
import { NavLink, useNavigate, Outlet } from 'react-router-dom';
import { superAdminLogout, getSuperAdminSession } from '../../utils/superAdminSession';
import {
  LuShield, LuLayoutDashboard, LuBuilding2,
  LuUsers, LuActivity, LuLogOut, LuChevronRight,
} from 'react-icons/lu';

// ─────────────────────────────────────────────────────────────────────────────
// SuperAdminLayout — dark sidebar layout for the platform console
// ─────────────────────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { label: 'Overview',   icon: LuLayoutDashboard, path: '/super-admin/dashboard'   },
  { label: 'Workspaces', icon: LuBuilding2,       path: '/super-admin/workspaces'  },
  { label: 'Users',      icon: LuUsers,           path: '/super-admin/users'       },
  { label: 'Activity',   icon: LuActivity,        path: '/super-admin/activity'    },
];

const SuperAdminLayout = ({ title = 'Super Admin' }) => {
  const session = getSuperAdminSession();
  const navigate = useNavigate();

  const handleLogout = () => {
    superAdminLogout();
    navigate('/login');
  };

  return (
    <div className="flex min-h-screen bg-slate-950 text-white">
      {/* ── Sidebar ── */}
      <aside className="w-64 flex-shrink-0 bg-slate-900 border-r border-slate-800 flex flex-col sticky top-0 h-screen">
        {/* Brand */}
        <div className="flex items-center gap-3 px-6 py-5 border-b border-slate-800">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-red-500 to-orange-500 flex items-center justify-center shadow-lg shadow-red-500/30">
            <LuShield className="text-white text-lg" />
          </div>
          <div>
            <p className="text-xs font-bold text-white tracking-tight">SUPER ADMIN</p>
            <p className="text-[10px] text-slate-400">Platform Console</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 px-3 space-y-1">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-white/10 text-white border border-white/10'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                }`
              }
            >
              <item.icon className="text-base flex-shrink-0" />
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* User footer */}
        <div className="px-4 py-4 border-t border-slate-800">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-red-500 to-orange-400 flex items-center justify-center flex-shrink-0">
              <span className="text-white text-xs font-bold">S</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-white truncate">{session?.name || 'Super Admin'}</p>
              <p className="text-[10px] text-slate-400">{session?.email || ''}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-2 text-xs font-medium text-slate-400 hover:text-red-400 px-3 py-2 rounded-lg hover:bg-red-500/10 transition"
          >
            <LuLogOut className="text-sm" /> Sign Out
          </button>
        </div>
      </aside>

      {/* ── Main content ── */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Top bar */}
        <header className="sticky top-0 z-20 bg-slate-950/80 backdrop-blur-lg border-b border-slate-800 px-8 py-4 flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <span>Platform Console</span>
            <LuChevronRight className="text-slate-600 text-xs" />
            <span className="text-white font-medium">{title}</span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <span className="text-[10px] font-bold text-red-400 bg-red-500/15 border border-red-500/30 px-2.5 py-1 rounded-full">
              ⚡ SUPER ADMIN
            </span>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default SuperAdminLayout;
