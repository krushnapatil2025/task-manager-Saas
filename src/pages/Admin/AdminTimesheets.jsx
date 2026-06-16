import React, { useContext, useEffect, useState, useCallback } from 'react';
import DashboardLayout from '../../components/layouts/DashboardLayout';
import { WorkspaceContext } from '../../context/WorkspaceContext';
import {
  LuClock, LuUsers, LuLoaderCircle, LuCalendar,
} from 'react-icons/lu';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { getWorkspaceTimesheet, formatDuration } from '../../services/timeTrackingService';
import RefreshButton from '../../components/RefreshButton';
import toast from 'react-hot-toast';
import moment from 'moment';

const DATE_RANGES = [
  { label: 'This Week',     days: 7  },
  { label: 'Last 14 Days',  days: 14 },
  { label: 'This Month',    days: 30 },
];

const BAR_COLORS = ['#6366f1','#8b5cf6','#a78bfa','#818cf8','#c4b5fd','#e0e7ff'];

const AdminTimesheets = () => {
  const { workspace } = useContext(WorkspaceContext);
  const [data,    setData   ] = useState([]);
  const [loading, setLoading] = useState(true);
  const [range,   setRange  ] = useState(7);

  const load = useCallback(async () => {
    if (!workspace?.id) return;
    setLoading(true);
    try {
      const to   = moment().format('YYYY-MM-DD');
      const from = moment().subtract(range - 1, 'days').format('YYYY-MM-DD');
      const rows = await getWorkspaceTimesheet(workspace.id, from, to);
      setData(rows);
    } catch {
      toast.error('Failed to load timesheets');
    } finally {
      setLoading(false);
    }
  }, [workspace?.id, range]);

  useEffect(() => { load(); }, [load]);

  const totalSec       = data.reduce((s, r) => s + Number(r.total_seconds || 0), 0);
  const totalSessions  = data.reduce((s, r) => s + Number(r.session_count || 0), 0);

  const chartData = data.map((r, i) => ({
    name:  (r.user_name || 'Unknown').split(' ')[0],
    hours: +(Number(r.total_seconds || 0) / 3600).toFixed(1),
    color: BAR_COLORS[i % BAR_COLORS.length],
  }));

  return (
    <DashboardLayout activeMenu="Timesheets">
      <div className="my-5 pb-12">

        {/* ── Header ── */}
        <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight">
              📋 Team Timesheets
            </h1>
            <p className="text-sm text-slate-400 mt-0.5">
              {workspace?.name} · {data.length} members tracked
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex bg-slate-100/60 p-1 rounded-xl gap-1">
              {DATE_RANGES.map(r => (
                <button key={r.days} onClick={() => setRange(r.days)}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-all ${
                    range === r.days ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  }`}>
                  {r.label}
                </button>
              ))}
            </div>
            <RefreshButton id="admin-timesheet-refresh" onRefresh={load} label="Refresh" size="sm" />
          </div>
        </div>

        {/* ── KPI cards ── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
          {[
            { label: 'Total Hours',  value: formatDuration(totalSec),  icon: LuClock,    color: 'bg-indigo-600'  },
            { label: 'Sessions',     value: totalSessions,              icon: LuCalendar, color: 'bg-emerald-500' },
            { label: 'Members',      value: data.length,                icon: LuUsers,    color: 'bg-violet-500'  },
          ].map(card => (
            <div key={card.label} className="bg-white rounded-2xl border border-slate-200/50 shadow-sm p-4 flex items-center gap-3">
              <div className={`w-10 h-10 ${card.color} rounded-xl flex items-center justify-center`}>
                <card.icon className="text-white" size={18} />
              </div>
              <div>
                <span className="block text-xl font-extrabold text-slate-800">{card.value}</span>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{card.label}</span>
              </div>
            </div>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <LuLoaderCircle className="text-indigo-500 text-3xl animate-spin" />
          </div>
        ) : data.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200/50 shadow-sm p-12 text-center">
            <LuClock className="text-slate-300 text-5xl mx-auto mb-3" />
            <p className="text-slate-500 font-medium">No time logged in this period.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* Bar chart */}
            <div className="bg-white rounded-2xl border border-slate-200/50 shadow-sm p-6">
              <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-4">
                Hours by Member
              </h3>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#94a3b8' }} stroke="none" />
                  <YAxis tick={{ fontSize: 11, fill: '#94a3b8' }} stroke="none" unit="h" />
                  <Tooltip
                    formatter={(v) => [`${v}h`, 'Hours']}
                    contentStyle={{ borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 12 }}
                  />
                  <Bar dataKey="hours" radius={[8, 8, 0, 0]} maxBarSize={48}>
                    {chartData.map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Member table */}
            <div className="bg-white rounded-2xl border border-slate-200/50 shadow-sm p-6">
              <h3 className="text-sm font-bold text-slate-500 uppercase tracking-widest mb-4">
                Member Breakdown
              </h3>
              <div className="space-y-3">
                {data.map((row, i) => {
                  const pct = totalSec > 0
                    ? Math.round((Number(row.total_seconds) / totalSec) * 100)
                    : 0;
                  return (
                    <div key={row.user_id} className="flex items-center gap-3">
                      {row.avatar_url ? (
                        <img src={row.avatar_url} alt={row.user_name}
                          className="w-8 h-8 rounded-full object-cover flex-shrink-0 border border-slate-100" />
                      ) : (
                        <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-white text-xs font-bold"
                          style={{ background: BAR_COLORS[i % BAR_COLORS.length] }}>
                          {(row.user_name || 'U')[0].toUpperCase()}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-sm font-semibold text-slate-700 truncate">{row.user_name}</span>
                          <span className="text-xs text-slate-500 ml-2 flex-shrink-0">
                            {formatDuration(Number(row.total_seconds))} · {row.session_count} sessions
                          </span>
                        </div>
                        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-700"
                            style={{ width: `${pct}%`, background: BAR_COLORS[i % BAR_COLORS.length] }} />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default AdminTimesheets;
