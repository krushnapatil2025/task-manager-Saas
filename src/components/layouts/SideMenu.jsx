import React, { useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserContext } from '../../context/userContext';
import { WorkspaceContext } from '../../context/WorkspaceContext';
import { SIDE_MENU_DATA, SIDE_MENU_USER_DATA } from '../../utils/data';
import { JOB_PROFILES } from '../../pages/Admin/InviteEmployee';

// ─────────────────────────────────────────────────────────────────────────────
// SideMenu — shows correct menu items per role, workspace role badge,
//            and highlights the active page
// ─────────────────────────────────────────────────────────────────────────────

const SideMenu = ({ activeMenu }) => {
  const { user, clearUser }    = useContext(UserContext);
  const { workspace, wsRole }  = useContext(WorkspaceContext);
  const navigate               = useNavigate();

  const [sideMenuData, setSideMenuData] = useState([]);
  const JP_MAP = Object.fromEntries(JOB_PROFILES.map(j => [j.value, j]));

  useEffect(() => {
    if (user) {
      const isAdmin = user.role === 'admin' || user.job_profile === 'company_admin';
      setSideMenuData(isAdmin ? SIDE_MENU_DATA : SIDE_MENU_USER_DATA);
    }
  }, [user]);

  const handleClick = (route) => {
    if (route === 'logout') handleLogout();
    else navigate(route);
  };

  const handleLogout = async () => {
    await clearUser();
    navigate('/login');
  };

  return (
    <div className="w-64 h-[calc(100vh-57px)] bg-white/85 backdrop-blur-lg border-r border-slate-200/50 sticky top-[57px] z-20 flex flex-col overflow-y-auto">

      {/* ── Profile block ── */}
      <div className="flex flex-col items-center pt-7 pb-5 px-4 border-b border-slate-100">
        {/* Avatar */}
        {user?.profile_image_url || user?.profileImageUrl ? (
          <img
            src={user.profile_image_url || user.profileImageUrl}
            alt="Profile"
            className="w-16 h-16 rounded-full object-cover border-2 border-indigo-100 shadow-sm"
          />
        ) : (
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-sm">
            <span className="text-white text-xl font-bold">
              {user?.name?.[0]?.toUpperCase()}
            </span>
          </div>
        )}

        {/* Name + role badges */}
        <h5 className="text-sm font-bold text-slate-800 mt-3 text-center leading-tight">
          {user?.name || ''}
        </h5>
        <p className="text-[11px] text-slate-400 mt-1 text-center truncate w-full px-2">
          {user?.email || ''}
        </p>

        <div className="flex items-center gap-2 mt-3 flex-wrap justify-center">
          {/* Job profile badge — enterprise RBAC */}
          {(() => {
            const jp = JP_MAP[user?.job_profile] || JP_MAP[user?.role];
            return jp ? (
              <span className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full bg-indigo-600 text-white flex items-center gap-1 shadow-sm shadow-indigo-600/10">
                {jp.emoji} {jp.label}
              </span>
            ) : (
              <span className={`text-[10px] font-semibold px-2.5 py-0.5 rounded-full ${
                user?.role === 'admin' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-500'
              }`}>
                {user?.role}
              </span>
            );
          })()}

          {/* Workspace role (if different) */}
          {wsRole && wsRole !== user?.role && wsRole !== user?.job_profile && (
            <span className="text-[10px] font-semibold px-2.5 py-0.5 rounded-full bg-purple-100 text-purple-600">
              {wsRole}
            </span>
          )}
        </div>

        {/* Workspace name */}
        {workspace?.name && (
          <p className="text-[10px] text-slate-400 mt-2 text-center flex items-center gap-1 font-medium bg-slate-50 border border-slate-100 px-2.5 py-1 rounded-lg">
            📁 {workspace.name}
          </p>
        )}
      </div>

      {/* ── Menu items ── */}
      <nav className="flex-1 py-4 px-3">
        {sideMenuData.map((item) => {
          const isActive = activeMenu === item.label;
          const isLogout = item.path === 'logout';

          return (
            <button
              key={item.id}
              onClick={() => handleClick(item.path)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 mb-1.5 rounded-xl text-sm font-semibold transition-all duration-200 text-left ${
                isLogout
                  ? 'text-rose-500 hover:bg-rose-50/60 mt-2'
                  : isActive
                    ? 'text-indigo-600 bg-indigo-50/60 border border-indigo-100/30 shadow-sm shadow-indigo-500/5'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50/40'
              }`}
            >
              <item.icon
                className={`text-[18px] flex-shrink-0 ${
                  isLogout ? 'text-rose-400'
                  : isActive ? 'text-indigo-500'
                  : 'text-slate-400'
                }`}
              />
              {item.label}

              {/* Active indicator dot */}
              {isActive && (
                <div className="ml-auto w-1.5 h-1.5 rounded-full bg-indigo-500 shadow-sm shadow-indigo-500" />
              )}
            </button>
          );
        })}
      </nav>

      {/* ── Bottom version tag ── */}
      <div className="px-5 py-3 border-t border-slate-100">
        <p className="text-[10px] text-slate-300 text-center font-semibold">TaskFlow v2.0 · Enterprise</p>
      </div>
    </div>
  );
};

export default SideMenu;
