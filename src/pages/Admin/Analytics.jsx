import React, { useContext, useEffect, useState, useCallback } from 'react';
import DashboardLayout from '../../components/layouts/DashboardLayout';
import { WorkspaceContext } from '../../context/WorkspaceContext';
import {
  LuTrendingUp, LuClipboardList, LuCircleCheck,
  LuHourglass, LuTriangleAlert, LuUsers,
  LuLoaderCircle, LuChartBar, LuFileText,
} from 'react-icons/lu';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
  LineChart, Line, Legend, PieChart, Pie,
} from 'recharts';
import { useNavigate } from 'react-router-dom';
import InfoCard from '../../components/Cards/InfoCard';
import HealthScoreGauge from '../../components/Charts/HealthScoreGauge';
import BurndownChart from '../../components/Charts/BurndownChart';
import WorkloadHeatmap from '../../components/Charts/WorkloadHeatmap';
import RefreshButton from '../../components/RefreshButton';
import { getWorkspaceAnalytics, getBurndownData } from '../../services/analyticsService';
import toast from 'react-hot-toast';

// ─────────────────────────────────────────────────────────────────────────────
// Analytics — Phase 10 — Workspace Intelligence Dashboard
// ─────────────────────────────────────────────────────────────────────────────

const PIE_COLORS = ['#22c55e', '#6366f1', '#f59e0b', '#ef4444'];

const AnalTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="analytics-tooltip">
      {label && <p className="analytics-tooltip-label">{label}</p>}
      {payload.map(p => (
        <p key={p.dataKey} style={{ color: p.color || p.fill }} className="analytics-tooltip-row">
          {p.name || p.dataKey}: <strong>{p.value}</strong>
        </p>
      ))}
    </div>
  );
};

const Analytics = () => {
  const { workspace } = useContext(WorkspaceContext);
  const navigate = useNavigate();

  const [data,        setData       ] = useState(null);
  const [burndown,    setBurndown   ] = useState([]);
  const [loading,     setLoading    ] = useState(true);
  const [activeTab,   setActiveTab  ] = useState('overview');

  const load = useCallback(async () => {
    if (!workspace?.id) return;
    try {
      setLoading(true);
      const [analytics, burn] = await Promise.all([
        getWorkspaceAnalytics(workspace.id),
        getBurndownData(
          workspace.id,
          new Date(Date.now() - 13 * 86_400_000), // 14-day window
          new Date()
        ),
      ]);
      setData(analytics);
      setBurndown(burn);
    } catch (err) {
      console.error('Analytics load error:', err);
      toast.error('Failed to load analytics');
    } finally {
      setLoading(false);
    }
  }, [workspace?.id]);

  useEffect(() => { load(); }, [load]);

  const TABS = [
    { id: 'overview',  label: 'Overview',       icon: LuChartBar     },
    { id: 'team',      label: 'Team',            icon: LuUsers        },
    { id: 'burndown',  label: 'Burndown',        icon: LuTrendingUp   },
  ];

  if (loading) return (
    <DashboardLayout activeMenu="Analytics">
      <div className="flex flex-col items-center justify-center h-72 gap-3">
        <LuLoaderCircle className="text-indigo-500 text-4xl animate-spin" />
        <p className="text-sm text-slate-400 font-medium">Crunching your workspace data…</p>
      </div>
    </DashboardLayout>
  );

  const s = data?.summary || {};

  return (
    <DashboardLayout activeMenu="Analytics">
      <div className="my-5 pb-12">

        {/* ── Page header ── */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight">
              📊 Analytics
            </h1>
            <p className="text-sm text-slate-400 mt-0.5">
              {workspace?.name} · {s.total || 0} tasks total
            </p>
          </div>
          <div className="flex items-center gap-3">
            <RefreshButton id="analytics-refresh" onRefresh={load} label="Refresh" />
            <button
              className="card-btn-fill"
              onClick={() => navigate('/admin/reports')}
            >
              <LuFileText size={14} /> Export Reports
            </button>
          </div>
        </div>

        {/* ── KPI cards ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-5 gap-4 mb-6">
          <InfoCard label="Total Tasks"   value={s.total      || 0} color="bg-indigo-600"  icon={LuClipboardList} />
          <InfoCard label="Completed"     value={s.completed  || 0} color="bg-emerald-500" icon={LuCircleCheck} />
          <InfoCard label="In Progress"   value={s.inProgress || 0} color="bg-cyan-500"    icon={LuHourglass} />
          <InfoCard label="Pending"       value={s.pending    || 0} color="bg-amber-500"   icon={LuHourglass} />
          <InfoCard label="Overdue"       value={s.overdue    || 0} color="bg-red-500"     icon={LuTriangleAlert} />
        </div>

        {/* ── Tabs ── */}
        <div className="flex gap-1 mb-6 bg-slate-100/60 p-1 rounded-xl w-fit">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 text-sm font-semibold px-4 py-2 rounded-lg transition-all ${
                activeTab === tab.id
                  ? 'bg-white text-indigo-600 shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <tab.icon size={15} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* ════ OVERVIEW TAB ════ */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* Health Score */}
            <div className="bg-white rounded-2xl border border-slate-200/50 shadow-sm p-6">
              <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-4">
                Health Score
              </h3>
              <HealthScoreGauge score={s.healthScore || 0} />
              <div className="mt-4 grid grid-cols-2 gap-2 text-center">
                <div className="bg-slate-50 rounded-xl p-2.5">
                  <span className="block text-lg font-extrabold text-slate-800">
                    {s.total > 0 ? Math.round((s.completed / s.total) * 100) : 0}%
                  </span>
                  <span className="text-[10px] text-slate-400 font-bold uppercase">Completion Rate</span>
                </div>
                <div className="bg-red-50 rounded-xl p-2.5">
                  <span className="block text-lg font-extrabold text-red-600">{s.overdue || 0}</span>
                  <span className="text-[10px] text-slate-400 font-bold uppercase">Overdue</span>
                </div>
              </div>
            </div>

            {/* Status Distribution Pie */}
            <div className="bg-white rounded-2xl border border-slate-200/50 shadow-sm p-6">
              <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-4">
                Status Distribution
              </h3>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={data?.statusData || []}
                    dataKey="count"
                    nameKey="status"
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    innerRadius={60}
                    labelLine={false}
                  >
                    {(data?.statusData || []).map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<AnalTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap gap-2 justify-center mt-2">
                {(data?.statusData || []).map(d => (
                  <span key={d.status} className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ background: d.color }} />
                    {d.status} ({d.count})
                  </span>
                ))}
              </div>
            </div>

            {/* Priority breakdown */}
            <div className="bg-white rounded-2xl border border-slate-200/50 shadow-sm p-6">
              <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-4">
                Priority Levels
              </h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={data?.priorityData || []} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="priority" tick={{ fontSize: 12, fill: '#94a3b8' }} stroke="none" />
                  <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} stroke="none" allowDecimals={false} />
                  <Tooltip content={<AnalTooltip />} cursor={{ fill: 'rgba(99,102,241,0.04)' }} />
                  <Bar dataKey="count" radius={[8, 8, 0, 0]} maxBarSize={48}>
                    {(data?.priorityData || []).map((e, i) => (
                      <Cell key={i} fill={e.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* 7-day Completion Trend */}
            <div className="lg:col-span-3 bg-white rounded-2xl border border-slate-200/50 shadow-sm p-6">
              <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-4">
                7-Day Completion Trend
              </h3>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={data?.trendData || []} margin={{ top: 4, right: 16, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94a3b8' }} stroke="none" />
                  <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} stroke="none" allowDecimals={false} />
                  <Tooltip content={<AnalTooltip />} />
                  <Line
                    type="monotone"
                    dataKey="completed"
                    name="Completed"
                    stroke="#6366f1"
                    strokeWidth={2.5}
                    dot={{ r: 4, fill: '#6366f1', strokeWidth: 0 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* ════ TEAM TAB ════ */}
        {activeTab === 'team' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* Team performance table */}
            <div className="bg-white rounded-2xl border border-slate-200/50 shadow-sm p-6">
              <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-4">
                Team Performance
              </h3>
              {(data?.performanceData || []).length === 0 ? (
                <p className="text-center text-slate-400 py-8 text-sm">No data available.</p>
              ) : (
                <div className="space-y-3">
                  {(data?.performanceData || []).map((member, i) => {
                    const pct = member.total > 0 ? Math.round((member.completed / member.total) * 100) : 0;
                    return (
                      <div key={i} className="flex items-center gap-3">
                        {/* Avatar */}
                        {member.avatar ? (
                          <img src={member.avatar} alt={member.name}
                            className="w-8 h-8 rounded-full object-cover flex-shrink-0 border border-slate-100" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-400 to-violet-500 flex items-center justify-center flex-shrink-0">
                            <span className="text-white text-xs font-bold">{member.name[0]?.toUpperCase()}</span>
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-sm font-semibold text-slate-700 truncate">{member.name}</span>
                            <span className="text-xs text-slate-400 ml-2 flex-shrink-0">
                              {member.completed}/{member.total} · {pct}%
                            </span>
                          </div>
                          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-700"
                              style={{
                                width: `${pct}%`,
                                background: pct >= 75 ? '#22c55e' : pct >= 40 ? '#6366f1' : '#f59e0b',
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Workload heatmap */}
            <div className="bg-white rounded-2xl border border-slate-200/50 shadow-sm p-6">
              <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-1">
                Active Workload
              </h3>
              <p className="text-xs text-slate-400 mb-4">
                🟡 5+ tasks · 🔴 8+ overloaded
              </p>
              <WorkloadHeatmap data={data?.workloadData || []} />
            </div>
          </div>
        )}

        {/* ════ BURNDOWN TAB ════ */}
        {activeTab === 'burndown' && (
          <div className="bg-white rounded-2xl border border-slate-200/50 shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest">
                  14-Day Burndown Chart
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Dashed = ideal progress · Solid = actual remaining tasks
                </p>
              </div>
              <div className="flex items-center gap-3 text-xs text-slate-500">
                <span className="flex items-center gap-1">
                  <span className="w-8 h-0.5 bg-indigo-400 inline-block" style={{ borderTop: '2px dashed #c7d2fe', display: 'inline-block', height: '0' }} />
                  Ideal
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="w-4 h-0.5 bg-indigo-600 inline-block" />
                  Actual
                </span>
              </div>
            </div>
            <BurndownChart data={burndown} />
          </div>
        )}

      </div>
    </DashboardLayout>
  );
};

export default Analytics;
