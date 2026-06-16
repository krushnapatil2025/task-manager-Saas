import React, { useContext, useEffect, useState, useCallback } from 'react';
import DashboardLayout from '../../components/layouts/DashboardLayout';
import { UserContext }      from '../../context/userContext';
import { WorkspaceContext } from '../../context/WorkspaceContext';
import { LuClock, LuCalendar, LuLoaderCircle, LuTrash2, LuRefreshCcw } from 'react-icons/lu';
import { getMyTimeLogs, deleteTimeLog, formatDuration } from '../../services/timeTrackingService';
import RefreshButton from '../../components/RefreshButton';
import toast from 'react-hot-toast';
import moment from 'moment';

// ─────────────────────────────────────────────────────────────────────────────
// MyTimesheet — User's personal time log page (Phase 11)
// Shows this week's sessions grouped by day, with totals.
// ─────────────────────────────────────────────────────────────────────────────

const DATE_RANGES = [
  { label: 'This Week',  days: 7  },
  { label: 'Last 14 Days', days: 14 },
  { label: 'This Month', days: 30 },
];

const MyTimesheet = () => {
  const { user }      = useContext(UserContext);
  const { workspace } = useContext(WorkspaceContext);

  const [logs,      setLogs    ] = useState([]);
  const [loading,   setLoading ] = useState(true);
  const [range,     setRange   ] = useState(7);

  const load = useCallback(async () => {
    if (!user?.id || !workspace?.id) return;
    setLoading(true);
    try {
      const to   = new Date().toISOString();
      const from = new Date(Date.now() - range * 86_400_000).toISOString();
      const data = await getMyTimeLogs(user.id, workspace.id, from, to);
      setLogs(data);
    } catch (err) {
      toast.error('Failed to load timesheets');
    } finally {
      setLoading(false);
    }
  }, [user?.id, workspace?.id, range]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (logId) => {
    try {
      await deleteTimeLog(logId);
      setLogs(prev => prev.filter(l => l.id !== logId));
      toast.success('Session deleted');
    } catch {
      toast.error('Failed to delete session');
    }
  };

  // ── Group by day ──────────────────────────────────────────────────────────
  const grouped = logs.reduce((acc, log) => {
    const day = moment(log.startedAt).format('YYYY-MM-DD');
    if (!acc[day]) acc[day] = [];
    acc[day].push(log);
    return acc;
  }, {});

  const totalSec = logs.reduce((s, l) => s + (l.durationSec || 0), 0);

  return (
    <DashboardLayout activeMenu="My Timesheet">
      <div className="my-5 pb-12">

        {/* ── Header ── */}
        <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight">
              ⏱️ My Timesheet
            </h1>
            <p className="text-sm text-slate-400 mt-0.5">
              {workspace?.name} · {logs.length} sessions
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Range selector */}
            <div className="flex bg-slate-100/60 p-1 rounded-xl gap-1">
              {DATE_RANGES.map(r => (
                <button
                  key={r.days}
                  onClick={() => setRange(r.days)}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-lg transition-all ${
                    range === r.days
                      ? 'bg-white text-indigo-600 shadow-sm'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
            <RefreshButton id="timesheet-refresh" onRefresh={load} label="Refresh" size="sm" />
          </div>
        </div>

        {/* ── Summary bar ── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-2xl border border-slate-200/50 shadow-sm p-4 flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-xl flex items-center justify-center">
              <LuClock className="text-white" size={18} />
            </div>
            <div>
              <span className="block text-xl font-extrabold text-slate-800">{formatDuration(totalSec)}</span>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Logged</span>
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200/50 shadow-sm p-4 flex items-center gap-3">
            <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center">
              <LuCalendar className="text-white" size={18} />
            </div>
            <div>
              <span className="block text-xl font-extrabold text-slate-800">{logs.length}</span>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Sessions</span>
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200/50 shadow-sm p-4 flex items-center gap-3">
            <div className="w-10 h-10 bg-violet-500 rounded-xl flex items-center justify-center">
              <LuClock className="text-white" size={18} />
            </div>
            <div>
              <span className="block text-xl font-extrabold text-slate-800">
                {formatDuration(logs.length > 0 ? Math.round(totalSec / logs.length) : 0)}
              </span>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Avg Session</span>
            </div>
          </div>
        </div>

        {/* ── Log list ── */}
        {loading ? (
          <div className="flex justify-center py-20">
            <LuLoaderCircle className="text-indigo-500 text-3xl animate-spin" />
          </div>
        ) : Object.keys(grouped).length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200/50 shadow-sm p-12 text-center">
            <LuClock className="text-slate-300 text-5xl mx-auto mb-3" />
            <p className="text-slate-500 font-medium">No time logged in this period.</p>
            <p className="text-sm text-slate-400 mt-1">
              Start a timer from any task detail page to track your time.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {Object.keys(grouped)
              .sort((a, b) => b.localeCompare(a))
              .map(day => {
                const dayLogs   = grouped[day];
                const dayTotal  = dayLogs.reduce((s, l) => s + (l.durationSec || 0), 0);
                return (
                  <div key={day} className="bg-white rounded-2xl border border-slate-200/50 shadow-sm overflow-hidden">
                    {/* Day header */}
                    <div className="flex items-center justify-between px-5 py-3 bg-slate-50/80 border-b border-slate-100">
                      <span className="text-sm font-bold text-slate-700">
                        {moment(day).isSame(moment(), 'day')
                          ? 'Today'
                          : moment(day).isSame(moment().subtract(1, 'day'), 'day')
                            ? 'Yesterday'
                            : moment(day).format('dddd, MMM D')}
                      </span>
                      <span className="text-xs font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 px-2.5 py-0.5 rounded-full">
                        {formatDuration(dayTotal)}
                      </span>
                    </div>

                    {/* Sessions */}
                    <div className="divide-y divide-slate-100">
                      {dayLogs.map(log => (
                        <div key={log.id} className="flex items-center justify-between px-5 py-3.5 group hover:bg-slate-50/40 transition">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-slate-700 truncate">
                              {log.taskTitle || 'Unknown Task'}
                            </p>
                            <p className="text-xs text-slate-400 mt-0.5">
                              {moment(log.startedAt).format('h:mm A')} → {moment(log.stoppedAt).format('h:mm A')}
                            </p>
                          </div>
                          <div className="flex items-center gap-3 ml-4">
                            <span className="text-sm font-bold text-slate-600">
                              {formatDuration(log.durationSec)}
                            </span>
                            <button
                              onClick={() => handleDelete(log.id)}
                              className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition"
                              title="Delete session"
                            >
                              <LuTrash2 size={13} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default MyTimesheet;
