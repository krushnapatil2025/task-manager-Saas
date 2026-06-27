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
      <div className="my-5 pb-12 animate-fade-in font-sans">

        {/* ── Header ── */}
        <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
          <div>
            <h1 className="text-xl md:text-2xl font-extrabold text-slate-905 dark:text-zinc-105 tracking-tight">
              📋 Team Timesheets
            </h1>
            <p className="text-xs text-slate-400 dark:text-zinc-550 mt-1.5 font-bold uppercase tracking-wider">
              {workspace?.name} · <span className="text-indigo-650 dark:text-indigo-400">{data.length} member{data.length !== 1 ? 's' : ''} tracked</span>
            </p>
          </div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="flex bg-slate-100/60 dark:bg-zinc-900/40 p-1 rounded-xl gap-1 border border-slate-205 dark:border-zinc-800/80">
              {DATE_RANGES.map(r => (
                <button key={r.days} onClick={() => setRange(r.days)}
                  className={`text-xs font-bold px-3.5 py-1.5 rounded-lg transition-all cursor-pointer ${
                    range === r.days ? 'bg-white dark:bg-zinc-800 text-indigo-650 dark:text-indigo-400 shadow-sm' : 'text-slate-500 dark:text-zinc-450 hover:text-slate-705 dark:hover:text-zinc-200'
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
            { label: 'Total Hours',  value: formatDuration(totalSec),  icon: LuClock,    color: 'bg-indigo-50/50 dark:bg-indigo-950/20 text-indigo-650 dark:text-indigo-400 border-indigo-100/50 dark:border-indigo-900/30' },
            { label: 'Sessions',     value: totalSessions,              icon: LuCalendar, color: 'bg-emerald-50/50 dark:bg-emerald-955/15 text-emerald-600 dark:text-emerald-400 border-emerald-100/50 dark:border-emerald-900/30' },
            { label: 'Members',      value: data.length,                icon: LuUsers,    color: 'bg-violet-50/50 dark:bg-violet-950/20 text-violet-600 dark:text-violet-400 border-violet-100/50 dark:border-violet-900/30' },
          ].map(card => (
            <div key={card.label} className="card !p-4 flex items-center gap-3">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center border ${card.color.split(' ')[0]} ${card.color.split(' ')[1]} ${card.color.split(' ')[2]}`}>
                <card.icon size={16} />
              </div>
              <div>
                <span className="block text-xl font-extrabold text-slate-805 dark:text-zinc-150 leading-tight">{card.value}</span>
                <span className="text-[10px] font-bold text-slate-400 dark:text-zinc-550 uppercase tracking-wider">{card.label}</span>
              </div>
            </div>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <LuLoaderCircle className="text-indigo-505 text-3xl animate-spin" />
          </div>
        ) : data.length === 0 ? (
          <div className="card p-12 text-center">
            <LuClock className="text-slate-350 dark:text-zinc-700 text-5xl mx-auto mb-3" />
            <p className="text-slate-455 dark:text-zinc-400 text-xs font-bold uppercase tracking-wider">No time logged in this period.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* Bar chart */}
            <div className="card">
              <h3 className="text-[10px] font-bold text-slate-405 dark:text-zinc-550 uppercase tracking-wider mb-5">
                Hours by Member
              </h3>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.12)" strokeOpacity={0.4} />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fontWeight: 700, fill: '#71717a' }} stroke="none" />
                  <YAxis tick={{ fontSize: 9, fontWeight: 700, fill: '#71717a' }} stroke="none" unit="h" />
                  <Tooltip
                    formatter={(v) => [`${v}h`, 'Hours']}
                    contentStyle={{ background: 'var(--tooltip-bg, #ffffff)', border: '1px solid var(--tooltip-border, #e4e4e7)', borderRadius: 10, fontSize: 11, fontWeight: 600 }}
                    className="dark:[--tooltip-bg:#161619] dark:[--tooltip-border:#27272a] dark:text-zinc-200"
                  />
                  <Bar dataKey="hours" radius={[6, 6, 0, 0]} maxBarSize={36}>
                    {chartData.map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Member table */}
            <div className="card">
              <h3 className="text-[10px] font-bold text-slate-405 dark:text-zinc-550 uppercase tracking-wider mb-5">
                Member Breakdown
              </h3>
              <div className="space-y-4">
                {data.map((row, i) => {
                  const pct = totalSec > 0
                    ? Math.round((Number(row.total_seconds) / totalSec) * 100)
                    : 0;
                  return (
                    <div key={row.user_id} className="flex items-center gap-3">
                      {row.avatar_url ? (
                        <img src={row.avatar_url} alt={row.user_name}
                          className="w-8 h-8 rounded-full object-cover flex-shrink-0 border border-slate-100 dark:border-zinc-800" />
                      ) : (
                        <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 text-white text-xs font-bold"
                          style={{ background: BAR_COLORS[i % BAR_COLORS.length] }}>
                          {(row.user_name || 'U')[0].toUpperCase()}
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-center mb-1.5">
                          <span className="text-xs font-bold text-slate-805 dark:text-zinc-200 truncate">{row.user_name}</span>
                          <span className="text-[10px] text-slate-450 dark:text-zinc-500 ml-2 flex-shrink-0 font-bold uppercase tracking-wider">
                            {formatDuration(Number(row.total_seconds))} · {row.session_count} session{row.session_count !== 1 ? 's' : ''}
                          </span>
                        </div>
                        <div className="h-1.5 bg-slate-100 dark:bg-zinc-800/80 rounded-full overflow-hidden">
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
