import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getPlatformStats,
  getPlatformAuditLogs,
  getPendingRegistrationCount,
  getAllWorkspaces,
} from '../../services/superAdminService';
import {
  LuBuilding2, LuUsers, LuClipboardCheck, LuCircleCheck,
  LuMessageSquare, LuTrendingUp, LuLoaderCircle, LuActivity,
  LuArrowUpRight, LuTriangleAlert, LuTrophy, LuLayers, LuSparkles
} from 'react-icons/lu';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, BarChart, Bar
} from 'recharts';
import moment from 'moment';
import toast from 'react-hot-toast';

// ─────────────────────────────────────────────────────────────────────────────
// SuperDashboard — platform-wide overview with interactive charts & insights
// ─────────────────────────────────────────────────────────────────────────────

const ACTION_COLOR = {
  'task.created':        'bg-blue-500/10 text-blue-400 border border-blue-500/20',
  'task.deleted':        'bg-rose-500/10 text-rose-400 border border-rose-500/20',
  'task.status_changed': 'bg-amber-500/10 text-amber-400 border border-amber-500/20',
  'member.added':        'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20',
  'member.invited':      'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20',
  'auth.login':          'bg-slate-500/10 text-slate-400 border border-slate-500/20',
  'company.registration.approved':   'bg-green-500/10 text-green-400 border border-green-500/20',
  'company.registration.rejected':   'bg-rose-500/10 text-rose-400 border border-rose-500/20',
  'company.registration.restricted': 'bg-red-500/10 text-red-400 border border-red-500/20',
};

const SuperDashboard = () => {
  const [stats,        setStats]        = useState(null);
  const [logs,         setLogs]         = useState([]);
  const [loading,      setLoading]      = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [workspaces,   setWorkspaces]   = useState([]);
  
  const navigate = useNavigate();

  useEffect(() => {
    const load = async () => {
      try {
        const [s, l, pending, ws] = await Promise.all([
          getPlatformStats(),
          getPlatformAuditLogs(20),
          getPendingRegistrationCount(),
          getAllWorkspaces(),
        ]);
        setStats(s);
        setLogs(l);
        setPendingCount(pending);
        setWorkspaces(ws);
      } catch (err) {
        toast.error('Failed to load platform dashboard data');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // ── 1. Calculate Plan Distribution (Donut Chart) ───────────────────────────
  const planCounts = { free: 0, pro: 0, enterprise: 0 };
  workspaces.forEach(w => {
    const plan = (w.plan || 'free').toLowerCase();
    if (planCounts[plan] !== undefined) {
      planCounts[plan]++;
    } else {
      planCounts.free++;
    }
  });

  const planData = [
    { name: 'Free Trial', value: planCounts.free, color: '#818cf8' },
    { name: 'Professional', value: planCounts.pro, color: '#fb923c' },
    { name: 'Enterprise', value: planCounts.enterprise, color: '#34d399' },
  ];

  // ── 2. Calculate Growth Trend (Area Chart) ─────────────────────────────────
  const monthlyGroups = {};
  workspaces.forEach(w => {
    if (!w.created_at) return;
    const monthStr = moment(w.created_at).format('MMM YYYY');
    monthlyGroups[monthStr] = (monthlyGroups[monthStr] || 0) + 1;
  });

  const sortedMonths = Object.keys(monthlyGroups).sort((a, b) => new Date(a) - new Date(b));
  let cumulative = 0;
  const growthData = sortedMonths.map(month => {
    cumulative += monthlyGroups[month];
    return {
      month,
      newRegistrations: monthlyGroups[month],
      totalWorkspaces: cumulative,
    };
  });

  // Fallback for growth chart if no data yet
  const chartData = growthData.length > 0 ? growthData : [
    { month: 'Jan', newRegistrations: 0, totalWorkspaces: 0 },
    { month: 'Feb', newRegistrations: 0, totalWorkspaces: 0 }
  ];

  // ── 3. Calculate Top Active Companies (Table & Bar) ────────────────────────
  const topActiveCompanies = [...workspaces]
    .sort((a, b) => (b.task_count || 0) - (a.task_count || 0))
    .slice(0, 5);

  const topCompaniesBarData = topActiveCompanies.map(c => ({
    name: c.name,
    tasks: c.task_count || 0,
    members: c.member_count || 0,
  }));

  // KPI card configuration
  const STAT_CARDS = stats ? [
    { label: 'Total Workspaces',  value: stats.totalWorkspaces,  icon: LuBuilding2,      sub: `+${stats.newWorkspaces30d} this month`, color: 'from-indigo-600 to-indigo-800'    },
    { label: 'Total Users',       value: stats.totalUsers,       icon: LuUsers,          sub: `+${stats.newUsers30d} this month`,       color: 'from-orange-500 to-pink-600' },
    { label: 'Total Tasks',       value: stats.totalTasks,       icon: LuClipboardCheck, sub: `+${stats.newTasks30d} this month`,       color: 'from-emerald-500 to-teal-600'  },
    { label: 'Task Completed',   value: stats.completedTasks,   icon: LuCircleCheck,    sub: `${stats.totalTasks ? Math.round((stats.completedTasks/stats.totalTasks)*100) : 0}% completion rate`, color: 'from-blue-500 to-cyan-600' },
    { label: 'Platform Comments',  value: stats.totalComments,    icon: LuMessageSquare,  sub: 'Across all active channels', color: 'from-amber-500 to-yellow-600'   },
    { label: 'Memberships',       value: stats.totalMemberships, icon: LuTrendingUp,     sub: 'Average users/workspace', color: 'from-rose-500 to-red-600'   },
  ] : [];

  return (
    <div className="space-y-8 max-w-[1600px] mx-auto animate-fade-in">
      
      {/* ── Title Banner ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/50 border border-slate-800/80 p-6 rounded-2xl">
        <div>
          <h1 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
            <LuSparkles className="text-orange-500" /> Platform Statistics
          </h1>
          <p className="text-slate-400 text-xs mt-1">Cross-workspace system intelligence & platform audit log</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => navigate('/super-admin/registrations')}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 active:scale-95 text-xs text-white font-bold rounded-xl border border-slate-700/50 transition cursor-pointer"
          >
            Review Queues
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center py-32">
          <LuLoaderCircle className="text-red-500 text-4xl animate-spin" />
        </div>
      ) : (
        <>
          {/* ── Pending Registrations Alert Banner ── */}
          {pendingCount > 0 && (
            <div className="bg-gradient-to-r from-red-500/10 via-orange-500/10 to-transparent border border-red-500/30 rounded-2xl p-5 flex items-center justify-between gap-4 shadow-lg shadow-red-950/5">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-red-500/20 border border-red-500/30 flex items-center justify-center flex-shrink-0 animate-pulse">
                  <LuTriangleAlert className="text-red-400 text-xl" />
                </div>
                <div>
                  <p className="text-white font-black text-sm">
                    {pendingCount} Company Registration{pendingCount > 1 ? 's' : ''} Awaiting Review
                  </p>
                  <p className="text-red-400/80 text-xs mt-0.5">
                    New enterprise requests require approval before platform access is provisioned
                  </p>
                </div>
              </div>
              <button
                onClick={() => navigate('/super-admin/registrations')}
                className="flex-shrink-0 bg-gradient-to-r from-red-500 to-orange-500 hover:from-red-400 hover:to-orange-400 active:scale-95 text-white text-xs font-black px-6 py-2.5 rounded-xl transition-all shadow-md shadow-red-500/25 whitespace-nowrap cursor-pointer"
              >
                Launch Approvals Screen →
              </button>
            </div>
          )}

          {/* ── KPI Stat Cards ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {STAT_CARDS.map((card) => (
              <div
                key={card.label}
                className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 hover:border-slate-700/80 transition-all duration-300 relative group overflow-hidden"
              >
                {/* Background decorative glow on hover */}
                <div className="absolute inset-0 bg-gradient-to-r from-transparent to-white/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
                
                <div className="flex items-center justify-between mb-4">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                    {card.label}
                  </p>
                  <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${card.color} flex items-center justify-center shadow-md shadow-black/25`}>
                    <card.icon className="text-white text-base" />
                  </div>
                </div>
                
                <p className="text-3xl font-black text-white tracking-tight">{card.value.toLocaleString()}</p>
                <p className="text-[11px] text-slate-500 font-semibold mt-2">{card.sub}</p>
              </div>
            ))}
          </div>

          {/* ── Dynamic Charts Section ── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* 1. Area Chart: Workspace Signups Trend */}
            <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 lg:col-span-2">
              <div className="mb-6 flex justify-between items-center">
                <div>
                  <h3 className="text-sm font-black text-white uppercase tracking-wider">Workspace Growth</h3>
                  <p className="text-[10px] text-slate-500 font-semibold mt-0.5">Cumulative and monthly new company registrations</p>
                </div>
              </div>
              
              <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height={320}>
                  <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="totalWorkspaceGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#818cf8" stopOpacity={0.2}/>
                        <stop offset="95%" stopColor="#818cf8" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" vertical={false} />
                    <XAxis 
                      dataKey="month" 
                      tick={{ fontSize: 10, fill: '#64748b', fontWeight: 'bold' }} 
                      stroke="#334155"
                    />
                    <YAxis 
                      tick={{ fontSize: 10, fill: '#64748b', fontWeight: 'bold' }} 
                      stroke="#334155" 
                      allowDecimals={false}
                    />
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px' }}
                      labelStyle={{ color: '#fff', fontSize: '12px', fontWeight: 'bold' }}
                      itemStyle={{ fontSize: '11px', color: '#818cf8' }}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="totalWorkspaces" 
                      name="Total Workspaces"
                      stroke="#818cf8" 
                      strokeWidth={2}
                      fillOpacity={1} 
                      fill="url(#totalWorkspaceGrad)" 
                    />
                    <Area 
                      type="monotone" 
                      dataKey="newRegistrations" 
                      name="New Registrations"
                      stroke="#fb923c" 
                      strokeWidth={2}
                      fill="none" 
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* 2. Donut Chart: Plan Distribution */}
            <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 flex flex-col justify-between">
              <div>
                <h3 className="text-sm font-black text-white uppercase tracking-wider mb-1">Plan Distribution</h3>
                <p className="text-[10px] text-slate-500 font-semibold mb-6">Segmentation of active company accounts</p>
              </div>
              
              <div className="h-56 relative flex items-center justify-center">
                <ResponsiveContainer width="100%" height={224}>
                  <PieChart>
                    <Pie
                      data={planData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {planData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px' }}
                      itemStyle={{ fontSize: '11px', color: '#fff' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                {/* Center text */}
                <div className="absolute flex flex-col items-center justify-center">
                  <span className="text-2xl font-black text-white">{workspaces.length}</span>
                  <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Total</span>
                </div>
              </div>

              {/* Legends list */}
              <div className="grid grid-cols-3 gap-2 text-center mt-4">
                {planData.map((p) => (
                  <div key={p.name} className="flex flex-col items-center">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.color }} />
                      <span className="text-[10px] font-bold text-slate-300">{p.name}</span>
                    </div>
                    <span className="text-xs font-black text-white mt-1">{p.value} ({workspaces.length ? Math.round((p.value/workspaces.length)*100) : 0}%)</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* ── Task Activity Bar Chart (Top Workspaces) ── */}
          <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6">
            <div className="mb-6 flex justify-between items-center">
              <div>
                <h3 className="text-sm font-black text-white uppercase tracking-wider">Top Workspace Activity</h3>
                <p className="text-[10px] text-slate-500 font-semibold mt-0.5">Tasks vs. Members comparison across most active companies</p>
              </div>
            </div>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height={256}>
                <BarChart data={topCompaniesBarData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                  <CartesianGrid stroke="#1e293b" strokeDasharray="3 3" vertical={false} />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 9, fill: '#64748b', fontWeight: 'bold' }}
                    stroke="#334155"
                    tickFormatter={(v) => v.length > 12 ? v.slice(0, 12) + '…' : v}
                  />
                  <YAxis tick={{ fontSize: 10, fill: '#64748b', fontWeight: 'bold' }} stroke="#334155" allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px' }}
                    labelStyle={{ color: '#fff', fontSize: '12px', fontWeight: 'bold' }}
                    itemStyle={{ fontSize: '11px' }}
                  />
                  <Bar dataKey="tasks"   name="Total Tasks"   fill="#818cf8" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="members" name="Members"       fill="#fb923c" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* ── Bottom Grid: Top Active Workspaces & Recent Audit Logs ── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* 1. Top Active Workspaces */}
            <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 lg:col-span-1 flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <LuTrophy className="text-orange-400" />
                  <h3 className="text-sm font-black text-white uppercase tracking-wider">Top Workspaces</h3>
                </div>
                <p className="text-[10px] text-slate-500 font-semibold mb-4">Ranked by overall task output</p>
              </div>

              <div className="space-y-4 my-2 flex-1">
                {topActiveCompanies.length === 0 ? (
                  <p className="text-center text-slate-500 text-xs py-10">No active workspaces.</p>
                ) : (
                  topActiveCompanies.map((c, idx) => (
                    <div key={c.id} className="flex items-center gap-3 bg-slate-950/40 border border-slate-800/50 p-3 rounded-xl hover:border-slate-700/50 transition">
                      <div className="w-8 h-8 rounded-lg bg-slate-800 flex items-center justify-center font-black text-xs text-orange-400">
                        #{idx + 1}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-bold text-slate-200 truncate">{c.name}</p>
                        <p className="text-[9px] text-slate-500 font-semibold uppercase tracking-wider">{c.plan || 'Free'} Plan</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-black text-white">{c.task_count || 0}</p>
                        <p className="text-[9px] text-slate-500 font-medium">Tasks</p>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <button
                onClick={() => navigate('/super-admin/workspaces')}
                className="w-full text-center py-2 bg-slate-800/50 hover:bg-slate-800 border border-slate-800 hover:border-slate-750 text-[10px] font-black text-slate-300 rounded-xl transition cursor-pointer mt-4"
              >
                Manage Workspaces
              </button>
            </div>

            {/* 2. Platform Audit Logs */}
            <div className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 lg:col-span-2">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <LuActivity className="text-slate-400" />
                  <h3 className="text-sm font-black text-white uppercase tracking-wider">Live System Logs</h3>
                </div>
                <button
                  onClick={() => navigate('/super-admin/activity')}
                  className="flex items-center gap-1 text-[10px] font-bold text-indigo-400 hover:text-indigo-300 transition cursor-pointer"
                >
                  Full History <LuArrowUpRight />
                </button>
              </div>

              <div className="divide-y divide-slate-800/40 max-h-[300px] overflow-y-auto custom-scrollbar">
                {logs.length === 0 ? (
                  <p className="text-center text-slate-500 text-xs py-10">No logs captured yet.</p>
                ) : (
                  logs.map((log) => (
                    <div key={log.id} className="flex items-center gap-4 py-3 hover:bg-slate-800/20 px-2 rounded-xl transition">
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-md ${ACTION_COLOR[log.action] || 'bg-slate-800 text-slate-400 border border-slate-700/50'}`}>
                        {log.action}
                      </span>
                      <span className="text-xs text-slate-400 flex-1 truncate">
                        user <strong className="text-slate-200">{log.userName}</strong> triggered action
                      </span>
                      <span className="text-[10px] text-slate-600 font-semibold whitespace-nowrap">
                        {moment(log.createdAt).fromNow()}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default SuperDashboard;
