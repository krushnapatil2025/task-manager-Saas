import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { getPlatformStats, getPlatformAuditLogs } from '../../services/superAdminService';
import {
  LuBuilding2, LuUsers, LuClipboardCheck, LuCircleCheck,
  LuMessageSquare, LuTrendingUp, LuLoaderCircle, LuActivity,
  LuArrowUpRight,
} from 'react-icons/lu';
import moment from 'moment';
import toast from 'react-hot-toast';

// ─────────────────────────────────────────────────────────────────────────────
// SuperDashboard — platform-wide overview for Super Admins
// Route: /super-admin/dashboard
// ─────────────────────────────────────────────────────────────────────────────

const ACTION_COLOR = {
  'task.created':        'bg-blue-500/20  text-blue-400',
  'task.deleted':        'bg-red-500/20   text-red-400',
  'task.status_changed': 'bg-amber-500/20 text-amber-400',
  'member.added':        'bg-lime-500/20  text-lime-400',
  'member.invited':      'bg-cyan-500/20  text-cyan-400',
  'auth.login':          'bg-slate-500/20 text-slate-400',
};

const SuperDashboard = () => {
  const [stats,   setStats]   = useState(null);
  const [logs,    setLogs]    = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const load = async () => {
      try {
        const [s, l] = await Promise.all([
          getPlatformStats(),
          getPlatformAuditLogs(20),
        ]);
        setStats(s);
        setLogs(l);
      } catch (err) {
        toast.error('Failed to load platform stats');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const STAT_CARDS = stats ? [
    { label: 'Total Workspaces',  value: stats.totalWorkspaces,  icon: LuBuilding2,      sub: `+${stats.newWorkspaces30d} this month`, color: 'from-blue-500 to-blue-700'    },
    { label: 'Total Users',       value: stats.totalUsers,       icon: LuUsers,          sub: `+${stats.newUsers30d} this month`,       color: 'from-purple-500 to-purple-700' },
    { label: 'Total Tasks',       value: stats.totalTasks,       icon: LuClipboardCheck, sub: `+${stats.newTasks30d} this month`,       color: 'from-amber-500 to-orange-600'  },
    { label: 'Completed Tasks',   value: stats.completedTasks,   icon: LuCircleCheck,    sub: `${stats.totalTasks ? Math.round((stats.completedTasks/stats.totalTasks)*100) : 0}% completion rate`, color: 'from-lime-500 to-green-600' },
    { label: 'Comments',          value: stats.totalComments,    icon: LuMessageSquare,  sub: 'Across all workspaces', color: 'from-cyan-500 to-teal-600'   },
    { label: 'Memberships',       value: stats.totalMemberships, icon: LuTrendingUp,     sub: 'Workspace memberships', color: 'from-rose-500 to-pink-600'   },
  ] : [];

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-white">Platform Overview</h1>
        <p className="text-slate-400 text-sm mt-1">Real-time stats across all workspaces</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <LuLoaderCircle className="text-blue-400 text-3xl animate-spin" />
        </div>
      ) : (
        <>
          {/* ── Stat grid ── */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
            {STAT_CARDS.map((card) => (
              <div
                key={card.label}
                className="bg-slate-900 border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition"
              >
                <div className="flex items-center justify-between mb-3">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">
                    {card.label}
                  </p>
                  <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${card.color} flex items-center justify-center`}>
                    <card.icon className="text-white text-sm" />
                  </div>
                </div>
                <p className="text-3xl font-bold text-white">{card.value.toLocaleString()}</p>
                <p className="text-xs text-slate-500 mt-1">{card.sub}</p>
              </div>
            ))}
          </div>

          {/* ── Recent activity ── */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <LuActivity className="text-slate-400 text-base" />
                <h3 className="text-sm font-semibold text-white">Platform Activity</h3>
              </div>
              <button
                onClick={() => navigate('/super-admin/activity')}
                className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 transition"
              >
                View all <LuArrowUpRight className="text-xs" />
              </button>
            </div>

            <div className="divide-y divide-slate-800/60">
              {logs.length === 0 ? (
                <p className="text-center text-slate-500 text-sm py-10">No activity yet.</p>
              ) : (
                logs.map((log) => (
                  <div key={log.id} className="flex items-center gap-4 px-6 py-3 hover:bg-slate-800/40 transition">
                    <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-full ${ACTION_COLOR[log.action] || 'bg-slate-700 text-slate-300'}`}>
                      {log.action}
                    </span>
                    <span className="text-xs text-slate-400 flex-1 truncate">
                      by <strong className="text-slate-200">{log.userName}</strong>
                    </span>
                    <span className="text-[10px] text-slate-600 whitespace-nowrap">
                      {moment(log.createdAt).fromNow()}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default SuperDashboard;
