import React, { useContext, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserContext } from '../../context/userContext';
import { WorkspaceContext } from '../../context/WorkspaceContext';
import { useBrand } from '../../context/BrandContext';
import { SIDE_MENU_DATA, SIDE_MENU_USER_DATA } from '../../utils/data';
import { JOB_PROFILES } from '../../pages/Admin/InviteEmployee';
import { LuPanelLeftClose, LuPanelLeftOpen } from 'react-icons/lu';
import { toast } from 'react-hot-toast';

// ─────────────────────────────────────────────────────────────────────────────
// SideMenu — Grouped, light/white aesthetic enterprise navigation sidebar
// ─────────────────────────────────────────────────────────────────────────────

const SideMenu = ({ activeMenu, onItemClick, isMobile = false }) => {
  const { user, clearUser }    = useContext(UserContext);
  const { workspace, wsRole }  = useContext(WorkspaceContext);
  const { brand }              = useBrand();
  const navigate               = useNavigate();

  const [sideMenuData, setSideMenuData] = useState([]);
  const [isCollapsed, setIsCollapsed] = useState(() => {
    if (isMobile) return false;
    return localStorage.getItem('sidebar-collapsed') === 'true';
  });
  const JP_MAP = Object.fromEntries(JOB_PROFILES.map(j => [j.value, j]));

  const collapsed = isMobile ? false : isCollapsed;

  useEffect(() => {
    if (user) {
      const isAdmin = user.role === 'admin' || user.job_profile === 'company_admin';
      setSideMenuData(isAdmin ? SIDE_MENU_DATA : SIDE_MENU_USER_DATA);
    }
  }, [user]);

  const toggleCollapse = () => {
    setIsCollapsed(prev => {
      const newVal = !prev;
      localStorage.setItem('sidebar-collapsed', String(newVal));
      window.dispatchEvent(new Event('sidebar-collapse-change'));
      return newVal;
    });
  };

  const handleClick = (route) => {
    if (route === 'logout') handleLogout();
    else if (route === 'ai') {
      // Trigger the global AI Command Bar by simulating Ctrl+K
      window.dispatchEvent(new KeyboardEvent('keydown', {
        key: 'k', ctrlKey: true, bubbles: true,
      }));
    }
    else navigate(route);

    if (onItemClick) onItemClick();
  };

  const handleLogout = async () => {
    await clearUser();
    toast.success('Successfully logged out!');
    navigate('/');
  };

  // Group menu items dynamically
  const getGroupedMenu = () => {
    const groups = {
      workspace: {
        label: 'Workspace',
        items: []
      },
      team: {
        label: 'Team & Access',
        items: []
      },
      operations: {
        label: 'Operations',
        items: []
      },
      communication: {
        label: 'Collaboration',
        items: []
      },
      settings: {
        label: 'Settings',
        items: []
      },
      other: {
        label: '',
        items: []
      }
    };

    sideMenuData.forEach(item => {
      const p = item.path;
      if (p === 'logout') return;
      
      if (['/admin/dashboard', '/user/dashboard', '/admin/kanban', '/admin/tasks', '/admin/create-task', '/user/tasks', '/calendar', '/admin/calendar', '/admin/sprints', '/admin/goals', '/admin/files'].includes(p)) {
        groups.workspace.items.push(item);
      } else if (['/admin/users', '/admin/teams', '/admin/permissions', '/admin/invitations'].includes(p)) {
        groups.team.items.push(item);
      } else if (['/admin/analytics', '/admin/reports', '/admin/timesheets', '/user/timesheet', '/admin/automations', '/admin/leaves', '/user/leaves', '/admin/intern-logs', '/user/daily-log'].includes(p)) {
        groups.operations.items.push(item);
      } else if (['ai', '/chat'].includes(p)) {
        groups.communication.items.push(item);
      } else if (['/admin/integrations', '/admin/api-keys', '/admin/webhooks', '/admin/audit', '/settings'].includes(p)) {
        groups.settings.items.push(item);
      } else {
        groups.other.items.push(item);
      }
    });

    return Object.values(groups).filter(g => g.items.length > 0);
  };

  return (
    <div className={isMobile
      ? "w-full h-full bg-white dark:bg-zinc-950 flex flex-col justify-between overflow-y-auto select-none"
      : `transition-all duration-300 ease-in-out ${collapsed ? 'w-[68px]' : 'w-[248px]'} h-[calc(100vh-52px)] bg-white dark:bg-zinc-950 border-r border-slate-100 dark:border-zinc-900 sticky top-[52px] z-20 flex flex-col justify-between overflow-hidden select-none`
    }>
      
      <div className="flex flex-col flex-1 min-h-0">
        {/* ── Compact profile block ── */}
        <div 
          onClick={() => {
            navigate('/user/profile');
            if (onItemClick) onItemClick();
          }}
          className={`flex items-center ${collapsed ? 'justify-center px-2' : 'gap-3 px-5'} py-3.5 border-b border-slate-100 dark:border-zinc-900 hover:bg-slate-50 dark:hover:bg-zinc-900/60 transition cursor-pointer flex-shrink-0`}
        >
          <div className="relative flex-shrink-0">
            {user?.profile_image_url || user?.profileImageUrl ? (
              <img
                src={user.profile_image_url || user.profileImageUrl}
                alt="Profile"
                className="w-8 h-8 rounded-full object-cover ring-1 ring-slate-200 dark:ring-zinc-800"
              />
            ) : (
              <div 
                style={{ backgroundColor: brand.brandColor }}
                className="w-8 h-8 rounded-full flex items-center justify-center shadow-md text-white text-xs font-bold"
              >
                {user?.name?.[0]?.toUpperCase()}
              </div>
            )}
            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border border-white dark:border-zinc-900 bg-emerald-500" />
          </div>

          {!collapsed && (
            <div className="flex flex-col min-w-0 flex-1">
              <h5 className="text-xs font-bold text-slate-700 dark:text-zinc-300 truncate leading-tight">
                {user?.name || ''}
              </h5>
              <p className="text-[10px] text-slate-400 dark:text-zinc-500 truncate mt-0.5 font-medium">
                {user?.email || ''}
              </p>
            </div>
          )}
        </div>

        {/* ── Grouped Navigation menu ── */}
        <nav className={`flex-1 py-3 ${collapsed ? 'px-1.5' : 'px-3'} overflow-y-auto custom-scrollbar`}>
          {getGroupedMenu().map((group, gIdx) => (
            <div key={gIdx} className="mb-4">
              {group.label && !collapsed && (
                <div className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 tracking-wider uppercase px-3.5 mb-1.5">
                  {group.label}
                </div>
              )}
              {group.label && collapsed && (
                <div className="border-t border-slate-100 dark:border-zinc-900 my-2 mx-2" />
              )}
              {group.items.map((item) => {
                const isActive = activeMenu === item.label;

                return (
                  <button
                    key={item.id}
                    onClick={() => handleClick(item.path)}
                    title={collapsed ? item.label : undefined}
                    className={`w-full flex items-center ${collapsed ? 'justify-center px-0 py-2.5' : 'gap-2.5 px-3.5 py-2'} mb-0.5 rounded-lg text-xs font-bold transition-all duration-150 text-left cursor-pointer ${
                      isActive
                        ? 'text-[var(--brand-text)] bg-[var(--brand-bg)] border-l-2 border-[var(--brand)] rounded-l-none'
                        : 'text-slate-600 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200 hover:bg-slate-50 dark:hover:bg-zinc-900/60'
                    }`}
                  >
                    <item.icon
                      className={`text-[17px] flex-shrink-0 ${
                        isActive ? 'text-[var(--brand)]' : 'text-slate-400 dark:text-zinc-500'
                      }`}
                    />
                    {!collapsed && <span className="truncate flex-1">{item.label}</span>}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>
      </div>

      {/* ── Bottom Section ── */}
      <div className="flex flex-col flex-shrink-0">
        {/* Workspace Display */}
        {workspace?.name && (
          <div className={`py-3 border-t border-slate-100 dark:border-zinc-900 bg-slate-50/20 dark:bg-zinc-950/20 flex items-center justify-center ${collapsed ? 'px-0' : 'px-5'}`}>
            <div className="flex items-center gap-2 text-[10px] text-slate-500 dark:text-zinc-400 font-bold truncate">
              <span className="w-1.5 h-1.5 rounded-full bg-[var(--brand)] animate-pulse"></span>
              {!collapsed && <span className="truncate">{workspace.name}</span>}
            </div>
          </div>
        )}

        {/* Logout Row */}
        <button
          onClick={() => handleClick('logout')}
          title={collapsed ? "Logout" : undefined}
          className={`flex items-center ${collapsed ? 'justify-center px-0' : 'gap-2.5 px-6'} py-2.5 text-xs font-bold text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-955/20 border-t border-slate-100 dark:border-zinc-900 bg-slate-50/10 dark:bg-zinc-950/10 transition-all text-left cursor-pointer`}
        >
          {(() => {
            const logoutItem = SIDE_MENU_DATA.find(i => i.path === 'logout');
            const Icon = logoutItem ? logoutItem.icon : null;
            return Icon ? <Icon className="text-[17px] text-rose-500" /> : null;
          })()}
          {!collapsed && "Logout"}
        </button>

        {/* Collapse Button Row */}
        {!isMobile && (
          <button
            onClick={toggleCollapse}
            title={collapsed ? "Expand Sidebar" : "Collapse Sidebar"}
            className={`flex items-center ${collapsed ? 'justify-center px-0' : 'gap-2.5 px-6'} py-2.5 text-xs font-bold text-slate-600 dark:text-zinc-400 hover:text-slate-800 dark:hover:text-zinc-200 hover:bg-slate-50 dark:hover:bg-zinc-900/60 border-t border-slate-100 dark:border-zinc-900 transition-all text-left cursor-pointer`}
          >
            {collapsed ? <LuPanelLeftOpen className="text-[17px] text-slate-400 dark:text-zinc-555" /> : <LuPanelLeftClose className="text-[17px] text-slate-400 dark:text-zinc-555" />}
            {!collapsed && "Collapse"}
          </button>
        )}

        {/* Version Badge */}
        <div className="px-2 py-2 bg-slate-50 dark:bg-zinc-950/40 border-t border-slate-100 dark:border-zinc-900">
          <p className="text-[9px] text-slate-400 dark:text-zinc-500 text-center font-bold">
            {collapsed ? 'v2.0' : `${brand.companyName} v2.0 · Enterprise`}
          </p>
        </div>
      </div>

    </div>
  );
};

export default SideMenu;
