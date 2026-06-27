import React, { useState, useEffect, useContext } from 'react';
import { WorkspaceContext } from '../../context/WorkspaceContext';
import { UserContext } from '../../context/userContext';
import DashboardLayout from '../../components/layouts/DashboardLayout';
import RefreshButton from '../../components/RefreshButton';
import { getAllUsers } from '../../services/userService';
import { 
  getAllWorkspaceLogs, 
  reviewLog, 
  getWorkspaceDailyStats 
} from '../../services/internLogService';
import toast from 'react-hot-toast';
import { 
  LuLoader, 
  LuCircleCheckBig, 
  LuTriangleAlert, 
  LuClock,
  LuSearch,
  LuDownload,
  LuUser,
  LuCalendar,
  LuFileText,
  LuChevronRight,
  LuMessageSquare,
  LuCircleHelp,
  LuTrendingUp,
  LuFlame,
  LuActivity,
  LuChartBar
} from 'react-icons/lu';

const AVAILABLE_TAGS = ['Frontend', 'Backend', 'Design', 'Research', 'Meeting', 'Bug Fix', 'Documentation', 'Other'];

const InternLogDashboard = () => {
  const { workspace, wsRole } = useContext(WorkspaceContext);
  const { user } = useContext(UserContext);

  const [loading, setLoading] = useState(true);
  const [interns, setInterns] = useState([]);
  const [logs, setLogs] = useState([]);
  const [activeTab, setActiveTab] = useState('review'); // 'review' | 'analytics'

  // Daily stats for selected date
  const [stats, setStats] = useState({
    total: 0,
    submitted: 0,
    acknowledged: 0,
    flagged: 0,
    missed: 0,
    draft: 0,
    totalHours: 0
  });

  // Filters State for review list
  const [selectedDate, setSelectedDate] = useState(new Date().toLocaleDateString('en-CA'));
  const [filterInternId, setFilterInternId] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterTag, setFilterTag] = useState('');
  const [filterHasBlockers, setFilterHasBlockers] = useState(false);

  // Review & Drawer State
  const [activeLog, setActiveLog] = useState(null);
  const [managerNote, setManagerNote] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // 30-Day Analytics State
  const [analyticsLogs, setAnalyticsLogs] = useState([]);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);

  // ── Access check ──────────────────────────────────────────────────────────
  const isManager = wsRole === 'company_admin' || wsRole === 'manager';

  const loadData = async () => {
    if (!workspace?.id || !isManager) return;
    setLoading(true);
    try {
      // 1. Fetch compliance stats for the selected date
      const dailyStats = await getWorkspaceDailyStats(workspace.id, selectedDate);
      setStats(dailyStats);

      // 2. Fetch all workspace users & filter to get interns
      const allUsers = await getAllUsers(workspace.id);
      const workspaceInterns = allUsers.filter(u => u.wsRole === 'intern');
      setInterns(workspaceInterns);

      // 3. Fetch all workspace logs matching currently set filters
      const filters = {
        startDate: selectedDate,
        endDate: selectedDate
      };
      if (filterInternId) filters.userId = filterInternId;
      if (filterStatus) filters.status = filterStatus;
      if (filterTag) filters.tag = filterTag;
      if (filterHasBlockers) filters.hasBlockers = true;

      const workspaceLogs = await getAllWorkspaceLogs(workspace.id, filters);
      setLogs(workspaceLogs);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load intern daily logs data');
    } finally {
      setLoading(false);
    }
  };

  const loadAnalytics = async () => {
    if (!workspace?.id || !isManager) return;
    setLoadingAnalytics(true);
    try {
      // Get logs for the last 30 calendar days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const startDateStr = thirtyDaysAgo.toLocaleDateString('en-CA');
      
      const logs30Days = await getAllWorkspaceLogs(workspace.id, {
        startDate: startDateStr
      });
      setAnalyticsLogs(logs30Days);
    } catch (err) {
      console.error(err);
      toast.error('Failed to calculate analytics metrics');
    } finally {
      setLoadingAnalytics(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [workspace?.id, wsRole, selectedDate, filterInternId, filterStatus, filterTag, filterHasBlockers]);

  useEffect(() => {
    if (activeTab === 'analytics') {
      loadAnalytics();
    }
  }, [workspace?.id, activeTab]);

  // ── Actions ────────────────────────────────────────────────────────────────

  const handleReview = async (logId, statusType) => {
    if (!user?.id) return;
    setActionLoading(true);
    try {
      await reviewLog(logId, {
        status: statusType,
        managerNote: managerNote.trim() || null,
        reviewedBy: user.id
      });
      
      toast.success(
        statusType === 'acknowledged' 
          ? 'Log acknowledged! ✓' 
          : 'Log flagged with feedback. ⚠️'
      );
      
      setActiveLog(null);
      setManagerNote('');
      await loadData();
      if (activeTab === 'analytics') {
        await loadAnalytics();
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to update log status');
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenReview = (log) => {
    setActiveLog(log);
    setManagerNote(log.manager_note || '');
  };

  const handleExportCSV = () => {
    if (logs.length === 0) {
      toast.error('No logs available to export.');
      return;
    }

    try {
      const headers = ['Date', 'Intern Name', 'Tasks Logged', 'Hours Spent', 'Learnings', 'Blockers', 'Tomorrow Plan', 'Tags', 'Status', 'Reviewer', 'Manager Feedback'];
      
      const rows = logs.map(log => {
        let tasksStr = '';
        let hoursSum = 0;
        try {
          const t = typeof log.tasks_done === 'string' ? JSON.parse(log.tasks_done) : log.tasks_done;
          tasksStr = t.map(item => `[${item.title}: ${item.description || ''} (${item.hours}h)]`).join('; ');
          hoursSum = t.reduce((sum, item) => sum + parseFloat(item.hours || 0), 0);
        } catch (e) {
          tasksStr = 'Error parsing tasks';
        }

        return [
          log.log_date,
          log.user?.name || 'Unknown',
          tasksStr,
          hoursSum,
          log.learnings || '',
          log.blockers || '',
          log.tomorrow_plan || '',
          (log.tags || []).join(', '),
          log.status,
          log.reviewer?.name || '',
          log.manager_note || ''
        ];
      });

      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(value => {
          const cleanValue = String(value || '').replace(/"/g, '""');
          return `"${cleanValue}"`;
        }).join(','))
      ].join('\n');

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      link.setAttribute('download', `intern_daily_logs_${selectedDate}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success('Logs exported successfully! 📂');
    } catch (err) {
      console.error(err);
      toast.error('Failed to export CSV');
    }
  };

  // ── Calculate 30-day analytics metrics ──────────────────────────────────────
  const getAnalyticsMetrics = () => {
    // 1. Generate working days (excluding weekends)
    const workingDays = [];
    for (let i = 0; i < 30; i++) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dayOfWeek = d.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) { // Not Sunday (0) and not Saturday (6)
        workingDays.push(d.toLocaleDateString('en-CA'));
      }
    }

    // 2. Submission Rate
    const possibleSubmissions = interns.length * workingDays.length;
    const actualSubmissions = analyticsLogs.filter(log => 
      ['submitted', 'acknowledged', 'flagged'].includes(log.status) && 
      workingDays.includes(log.log_date)
    ).length;
    const submissionRate = possibleSubmissions > 0 
      ? Math.round((actualSubmissions / possibleSubmissions) * 100)
      : 0;

    // 3. Avg. Hours Logged per active day
    let totalHours = 0;
    let loggedDaysCount = 0;
    analyticsLogs.forEach(log => {
      if (log.status !== 'draft' && log.status !== 'missed') {
        try {
          const tasks = typeof log.tasks_done === 'string' ? JSON.parse(log.tasks_done) : log.tasks_done;
          if (Array.isArray(tasks)) {
            tasks.forEach(t => {
              const h = parseFloat(t.hours);
              if (!isNaN(h)) totalHours += h;
            });
            loggedDaysCount++;
          }
        } catch (e) {}
      }
    });
    const avgHours = loggedDaysCount > 0 ? (totalHours / loggedDaysCount).toFixed(1) : 0;

    // 4. Streaks & Total Submissions per intern
    const streaks = interns.map(intern => {
      let currentStreak = 0;
      const internLogs = analyticsLogs.filter(l => l.user_id === intern.id);

      for (const dateStr of workingDays) {
        const log = internLogs.find(l => l.log_date === dateStr);
        if (log && ['submitted', 'acknowledged', 'flagged'].includes(log.status)) {
          currentStreak++;
        } else {
          // Allow today to not break streak if they haven't submitted yet
          const isToday = dateStr === new Date().toLocaleDateString('en-CA');
          if (isToday) continue;
          break;
        }
      }

      return {
        ...intern,
        streak: currentStreak,
        totalSubmitted: internLogs.filter(l => ['submitted', 'acknowledged', 'flagged'].includes(l.status)).length
      };
    }).sort((a, b) => b.streak - a.streak);

    // 5. Active Blockers list (submitted or flagged logs with active blockers field)
    const activeBlockersList = analyticsLogs.filter(log => 
      ['submitted', 'flagged'].includes(log.status) && 
      log.blockers && 
      log.blockers.trim().length > 0
    );

    // 6. Top Tags
    const tagCounts = {};
    analyticsLogs.forEach(log => {
      if (log.tags && Array.isArray(log.tags)) {
        log.tags.forEach(tag => {
          tagCounts[tag] = (tagCounts[tag] || 0) + 1;
        });
      }
    });
    const sortedTags = Object.entries(tagCounts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    // 7. Avg. Review Latency
    let totalLatencyMs = 0;
    let reviewedCount = 0;
    analyticsLogs.forEach(log => {
      if (log.reviewed_at && log.created_at) {
        const duration = new Date(log.reviewed_at) - new Date(log.created_at);
        if (duration > 0) {
          totalLatencyMs += duration;
          reviewedCount++;
        }
      }
    });
    const avgLatencyHours = reviewedCount > 0 
      ? (totalLatencyMs / (1000 * 60 * 60 * reviewedCount)).toFixed(1)
      : '—';

    return {
      submissionRate,
      avgHours,
      streaks,
      activeBlockersList,
      sortedTags,
      avgLatencyHours,
      totalHoursLogged: totalHours.toFixed(1)
    };
  };

  if (!isManager) {
    return (
      <DashboardLayout activeMenu="Intern Logs">
        <div className="flex flex-col items-center justify-center py-20 font-sans">
          <LuTriangleAlert className="text-amber-500 mb-3" size={48} />
          <h2 className="text-xl font-bold text-slate-800 dark:text-zinc-100">Access Restricted</h2>
          <p className="text-slate-500 dark:text-zinc-400 mt-2 text-sm max-w-sm text-center">
            This module is reserved for Managers and Workspace Administrators to review daily intern logs.
          </p>
        </div>
      </DashboardLayout>
    );
  }

  // Find which interns missed submissions today
  const loggedUserIds = new Set(logs.map(l => l.user_id));
  const missedInterns = interns.filter(i => !loggedUserIds.has(i.id) && stats.missed > 0);

  // Group logs into Submitted (Pending Review) vs Reviewed
  const pendingLogs = logs.filter(l => l.status === 'submitted');
  const reviewedLogs = logs.filter(l => l.status === 'acknowledged' || l.status === 'flagged');
  const draftLogs = logs.filter(l => l.status === 'draft');

  // Compute analytics if tab is selected
  const analytics = getAnalyticsMetrics();

  return (
    <DashboardLayout activeMenu="Intern Logs">
      <div className="mt-5 mb-10 font-sans max-w-7xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-xl md:text-2xl font-extrabold text-slate-905 dark:text-zinc-100 tracking-tight flex items-center gap-2">
              📊 Intern Daily Logs Review
            </h2>
            <p className="text-xs text-slate-455 dark:text-zinc-550 mt-1 font-bold uppercase tracking-wider">
              {workspace?.name} · Track daily intern logs and sign-offs
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            {activeTab === 'review' && (
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800 rounded-xl px-3.5 py-1.5 text-xs text-slate-800 dark:text-zinc-200 font-bold focus:border-indigo-500 focus:outline-none transition-all"
              />
            )}
            
            {activeTab === 'review' && (
              <button
                onClick={handleExportCSV}
                disabled={logs.length === 0}
                className="card-btn-fill flex items-center gap-1.5 text-xs cursor-pointer"
              >
                <LuDownload size={14} /> Export CSV
              </button>
            )}

            <RefreshButton
              id="intern-dashboard-refresh"
              onRefresh={activeTab === 'review' ? loadData : loadAnalytics}
              label="Refresh"
              size="sm"
            />
          </div>
        </div>

        {/* Tab Selection Bar */}
        <div className="flex border-b border-slate-100 dark:border-zinc-850 gap-6">
          <button
            onClick={() => setActiveTab('review')}
            className={`pb-3 text-sm font-black uppercase tracking-wider transition-all relative ${
              activeTab === 'review' 
                ? 'text-indigo-650 dark:text-indigo-400' 
                : 'text-slate-400 dark:text-zinc-500 hover:text-slate-655 dark:hover:text-zinc-300'
            }`}
          >
            📋 Log Submission Review
            {activeTab === 'review' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 dark:bg-indigo-500" />
            )}
          </button>
          
          <button
            onClick={() => setActiveTab('analytics')}
            className={`pb-3 text-sm font-black uppercase tracking-wider transition-all relative ${
              activeTab === 'analytics' 
                ? 'text-indigo-650 dark:text-indigo-400' 
                : 'text-slate-400 dark:text-zinc-500 hover:text-slate-655 dark:hover:text-zinc-300'
            }`}
          >
            📈 30-Day Analytics & Stats
            {activeTab === 'analytics' && (
              <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 dark:bg-indigo-500" />
            )}
          </button>
        </div>

        {/* TAB 1: LOG SUBMISSION REVIEW */}
        {activeTab === 'review' && (
          <>
            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="card dark:bg-[#151518]/90 dark:border-zinc-800/80 p-4 flex flex-col justify-between">
                <span className="text-[10px] font-black uppercase text-slate-400 dark:text-zinc-550">Total Interns</span>
                <span className="text-2xl font-black text-slate-800 dark:text-zinc-100 mt-2">{interns.length}</span>
              </div>
              <div className="card dark:bg-[#151518]/90 dark:border-zinc-800/80 p-4 flex flex-col justify-between border-b-2 border-b-blue-500">
                <span className="text-[10px] font-black uppercase text-slate-400 dark:text-zinc-550">Submitted (Pending)</span>
                <span className="text-2xl font-black text-blue-600 dark:text-blue-400 mt-2">{stats.submitted}</span>
              </div>
              <div className="card dark:bg-[#151518]/90 dark:border-zinc-800/80 p-4 flex flex-col justify-between border-b-2 border-b-emerald-500">
                <span className="text-[10px] font-black uppercase text-slate-400 dark:text-zinc-550">Reviewed / Ack</span>
                <span className="text-2xl font-black text-emerald-600 dark:text-emerald-450 mt-2">
                  {stats.acknowledged + stats.flagged}
                </span>
              </div>
              <div className="card dark:bg-[#151518]/90 dark:border-zinc-800/80 p-4 flex flex-col justify-between border-b-2 border-b-red-500">
                <span className="text-[10px] font-black uppercase text-slate-400 dark:text-zinc-550 text-rose-500">Missed Logs</span>
                <span className="text-2xl font-black text-rose-600 dark:text-rose-455 mt-2">{stats.missed}</span>
              </div>
              <div className="card dark:bg-[#151518]/90 dark:border-zinc-800/80 p-4 flex flex-col justify-between">
                <span className="text-[10px] font-black uppercase text-slate-400 dark:text-zinc-550">Total Hours Logged</span>
                <span className="text-2xl font-black text-indigo-650 dark:text-indigo-400 mt-2">{stats.totalHours} hrs</span>
              </div>
            </div>

            {/* Dashboard Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
              
              {/* Main List: Submitted & Reviewed Logs */}
              <div className="lg:col-span-3 space-y-6">
                
                {/* Filter Bar Card */}
                <div className="card dark:bg-[#151518]/90 dark:border-zinc-800/80 p-4 flex flex-wrap items-center gap-3">
                  <div className="flex-1 min-w-[200px] relative">
                    <LuSearch className="absolute left-3 top-2.5 text-slate-400" size={14} />
                    <select
                      value={filterInternId}
                      onChange={(e) => setFilterInternId(e.target.value)}
                      className="w-full bg-slate-50 dark:bg-zinc-900/60 border border-slate-200 dark:border-zinc-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-700 dark:text-zinc-300 font-bold focus:outline-none"
                    >
                      <option value="">All Interns</option>
                      {interns.map(i => (
                        <option key={i.id} value={i.id}>{i.name}</option>
                      ))}
                    </select>
                  </div>

                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="bg-slate-50 dark:bg-zinc-900/60 border border-slate-200 dark:border-zinc-800 rounded-xl px-3 py-1.5 text-xs text-slate-700 dark:text-zinc-300 font-bold focus:outline-none"
                  >
                    <option value="">All Statuses</option>
                    <option value="submitted">Pending Review</option>
                    <option value="acknowledged">Acknowledged</option>
                    <option value="flagged">Flagged</option>
                    <option value="missed">Missed</option>
                    <option value="draft">Draft</option>
                  </select>

                  <select
                    value={filterTag}
                    onChange={(e) => setFilterTag(e.target.value)}
                    className="bg-slate-50 dark:bg-zinc-900/60 border border-slate-200 dark:border-zinc-800 rounded-xl px-3 py-1.5 text-xs text-slate-700 dark:text-zinc-300 font-bold focus:outline-none"
                  >
                    <option value="">All Tags</option>
                    {AVAILABLE_TAGS.map(t => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>

                  <label className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-zinc-400 font-bold cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={filterHasBlockers}
                      onChange={(e) => setFilterHasBlockers(e.target.checked)}
                      className="rounded dark:bg-zinc-900 border-slate-300 dark:border-zinc-800 text-indigo-650 focus:ring-indigo-500 w-3.5 h-3.5"
                    />
                    Has Blockers
                  </label>
                </div>

                {/* Pending Review Queue (Most urgent items) */}
                <div>
                  <h3 className="text-xs font-black text-slate-400 dark:text-zinc-550 uppercase tracking-widest mb-3 flex items-center gap-1">
                    📥 Pending Review Queue ({pendingLogs.length})
                  </h3>
                  
                  {pendingLogs.length === 0 ? (
                    <div className="card dark:bg-[#151518]/90 dark:border-zinc-800/80 p-6 text-center text-slate-400 dark:text-zinc-500 italic">
                      <LuCircleCheckBig className="mx-auto mb-2 opacity-30 text-emerald-500" size={28} />
                      Inbox zero! All submitted intern logs have been reviewed.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {pendingLogs.map(log => (
                        <div 
                          key={log.id} 
                          className="card dark:bg-[#151518]/90 dark:border-zinc-800/80 p-4 border-l-2 border-l-blue-500 hover:border-slate-300 dark:hover:border-zinc-700 transition flex flex-col justify-between"
                        >
                          <div className="space-y-3">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2">
                                {log.user?.profile_image_url ? (
                                  <img src={log.user.profile_image_url} alt="Profile" className="w-7 h-7 rounded-full object-cover" />
                                ) : (
                                  <div className="w-7 h-7 rounded-full bg-slate-100 dark:bg-zinc-900 flex items-center justify-center font-bold text-xs text-slate-600 dark:text-zinc-400">
                                    {log.user?.name?.[0]}
                                  </div>
                                )}
                                <div>
                                  <h4 className="text-xs font-black text-slate-800 dark:text-zinc-200">{log.user?.name}</h4>
                                  <p className="text-[9px] text-slate-400 dark:text-zinc-550 uppercase tracking-wider font-bold">
                                    Submitted {new Date(log.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  </p>
                                </div>
                              </div>

                              {log.blockers && (
                                <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded-lg border bg-rose-50 text-rose-600 border-rose-100 dark:bg-rose-955/15 dark:border-rose-900/40 dark:text-rose-400 flex items-center gap-0.5 animate-pulse">
                                  <LuTriangleAlert size={10} /> blocker
                                </span>
                              )}
                            </div>

                            {/* Learnings Preview */}
                            <div className="space-y-1">
                              <span className="text-[9px] text-slate-400 dark:text-zinc-550 font-black uppercase tracking-wider">Learnings takeaway</span>
                              <p className="text-xs text-slate-655 dark:text-zinc-400 line-clamp-2 leading-relaxed">
                                {log.learnings}
                              </p>
                            </div>
                          </div>

                          <div className="flex items-center justify-between border-t border-slate-100 dark:border-zinc-850 pt-3 mt-4">
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] text-slate-450 dark:text-zinc-550 font-bold">
                                {(() => {
                                  try {
                                    const t = typeof log.tasks_done === 'string' ? JSON.parse(log.tasks_done) : log.tasks_done;
                                    return `${t.length} task${t.length !== 1 ? 's' : ''}`;
                                  } catch(e) { return '0 tasks'; }
                                })()}
                              </span>
                              <span className="text-slate-300 dark:text-zinc-800">•</span>
                              <span className="text-[10px] text-slate-455 dark:text-zinc-550 font-bold flex items-center gap-0.5">
                                <LuClock size={10} />
                                {(() => {
                                  try {
                                    const t = typeof log.tasks_done === 'string' ? JSON.parse(log.tasks_done) : log.tasks_done;
                                    return `${t.reduce((sum, item) => sum + parseFloat(item.hours || 0), 0)} hrs`;
                                  } catch(e) { return '0 hrs'; }
                                })()}
                              </span>
                            </div>
                            <button
                              onClick={() => handleOpenReview(log)}
                              className="px-3 py-1 bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/30 dark:hover:bg-indigo-900/40 text-indigo-650 dark:text-indigo-400 rounded-lg text-[10px] font-black uppercase tracking-wider cursor-pointer"
                            >
                              Review & sign-off
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Reviewed Logs Timeline List */}
                <div>
                  <h3 className="text-xs font-black text-slate-400 dark:text-zinc-550 uppercase tracking-widest mb-3 flex items-center gap-1">
                    📅 Checked/Processed Logs ({reviewedLogs.length})
                  </h3>
                  
                  {reviewedLogs.length === 0 ? (
                    <div className="card dark:bg-[#151518]/90 dark:border-zinc-800/80 p-6 text-center text-slate-400 dark:text-zinc-500 italic">
                      No reviewed logs for this date.
                    </div>
                  ) : (
                    <div className="card dark:bg-[#151518]/90 dark:border-zinc-800/80 p-0 overflow-hidden">
                      <table className="premium-table min-w-full">
                        <thead>
                          <tr>
                            <th className="dark:text-zinc-500">Intern</th>
                            <th className="dark:text-zinc-500">Hours</th>
                            <th className="dark:text-zinc-500">Learnings Takeaway</th>
                            <th className="dark:text-zinc-500">Status</th>
                            <th className="dark:text-zinc-500">Reviewed By</th>
                            <th className="text-right dark:text-zinc-500">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {reviewedLogs.map(log => {
                            let statusColor = '';
                            if (log.status === 'acknowledged') {
                              statusColor = 'bg-emerald-50 text-emerald-600 border-emerald-150 dark:bg-emerald-950/20 dark:border-emerald-900/50 dark:text-emerald-450';
                            } else if (log.status === 'flagged') {
                              statusColor = 'bg-amber-50 text-amber-600 border-amber-150 dark:bg-amber-950/20 dark:border-amber-900/50 dark:text-amber-400';
                            }

                            return (
                              <tr key={log.id} className="dark:border-zinc-800/85 hover:dark:bg-zinc-900/10">
                                <td className="px-4 py-3 font-bold text-slate-800 dark:text-zinc-200 text-xs flex items-center gap-2">
                                  {log.user?.profile_image_url ? (
                                    <img src={log.user.profile_image_url} alt="Profile" className="w-5 h-5 rounded-full object-cover" />
                                  ) : (
                                    <div className="w-5 h-5 rounded-full bg-slate-100 dark:bg-zinc-900 flex items-center justify-center font-bold text-[9px] text-slate-600 dark:text-zinc-400">
                                      {log.user?.name?.[0]}
                                    </div>
                                  )}
                                  <span>{log.user?.name}</span>
                                </td>
                                <td className="px-4 py-3 text-xs font-black text-slate-700 dark:text-zinc-300">
                                  {(() => {
                                    try {
                                      const t = typeof log.tasks_done === 'string' ? JSON.parse(log.tasks_done) : log.tasks_done;
                                      return `${t.reduce((sum, item) => sum + parseFloat(item.hours || 0), 0)}h`;
                                    } catch(e) { return '0h'; }
                                  })()}
                                </td>
                                <td className="px-4 py-3 text-xs text-slate-500 dark:text-zinc-400 max-w-[200px] truncate" title={log.learnings}>
                                  {log.learnings}
                                </td>
                                <td className="px-4 py-3">
                                  <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-lg border ${statusColor}`}>
                                    {log.status}
                                  </span>
                                </td>
                                <td className="px-4 py-3 text-xs text-slate-500 dark:text-zinc-450 font-bold uppercase">
                                  {log.reviewer?.name || '—'}
                                </td>
                                <td className="px-4 py-3 text-right">
                                  <button
                                    onClick={() => handleOpenReview(log)}
                                    className="text-slate-400 hover:text-slate-700 dark:hover:text-zinc-300 font-black text-xs cursor-pointer"
                                  >
                                    View log
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

              </div>

              {/* Right Column: Missed & Drafts Panel */}
              <div className="space-y-6">
                
                {/* Missed submissions */}
                <div>
                  <h3 className="text-xs font-black text-rose-500 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                    <LuTriangleAlert size={13} /> Missed Logs today ({stats.missed})
                  </h3>
                  
                  {missedInterns.length === 0 ? (
                    <div className="card dark:bg-[#151518]/90 dark:border-zinc-800/80 p-4 text-center text-slate-400 dark:text-zinc-500 text-xs italic">
                      No interns missed log submission.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {missedInterns.map(i => (
                        <div 
                          key={i.id} 
                          className="card dark:bg-[#151518]/90 dark:border-zinc-800/80 p-3 flex items-center justify-between border-l-2 border-l-rose-500"
                        >
                          <div className="flex items-center gap-2">
                            {i.profileImageUrl ? (
                              <img src={i.profileImageUrl} alt="Profile" className="w-6 h-6 rounded-full object-cover" />
                            ) : (
                              <div className="w-6 h-6 rounded-full bg-slate-100 dark:bg-zinc-900 flex items-center justify-center font-bold text-[10px] text-slate-600 dark:text-zinc-400">
                                {i.name?.[0]}
                              </div>
                            )}
                            <span className="text-xs font-black text-slate-800 dark:text-zinc-200">{i.name}</span>
                          </div>
                          <span className="text-[8px] font-black uppercase px-1.5 py-0.5 rounded bg-rose-50 border border-rose-100 text-rose-600 dark:bg-rose-955/20 dark:border-rose-900/50 dark:text-rose-400">
                            missed
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Interns currently writing drafts */}
                <div>
                  <h3 className="text-xs font-black text-slate-400 dark:text-zinc-550 uppercase tracking-widest mb-3">
                    ✍️ Saved Drafts ({draftLogs.length})
                  </h3>
                  
                  {draftLogs.length === 0 ? (
                    <div className="card dark:bg-[#151518]/90 dark:border-zinc-800/80 p-4 text-center text-slate-400 dark:text-zinc-550 text-xs italic">
                      No drafts saved.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {draftLogs.map(log => (
                        <div 
                          key={log.id} 
                          className="card dark:bg-[#151518]/90 dark:border-zinc-800/80 p-3 flex items-center justify-between border-l-2 border-l-slate-400"
                        >
                          <div className="flex items-center gap-2">
                            {log.user?.profile_image_url ? (
                              <img src={log.user.profile_image_url} alt="Profile" className="w-6 h-6 rounded-full object-cover" />
                            ) : (
                              <div className="w-6 h-6 rounded-full bg-slate-100 dark:bg-zinc-900 flex items-center justify-center font-bold text-[10px] text-slate-600 dark:text-zinc-400">
                                {log.user?.name?.[0]}
                              </div>
                            )}
                            <span className="text-xs font-black text-slate-800 dark:text-zinc-200">{log.user?.name}</span>
                          </div>
                          <span className="text-[8px] font-black uppercase px-1.5 py-0.5 rounded bg-slate-50 border border-slate-200 text-slate-500 dark:bg-zinc-900 dark:border-zinc-850 dark:text-zinc-450">
                            draft
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

              </div>

            </div>
          </>
        )}

        {/* TAB 2: 30-DAY ANALYTICS & STATS */}
        {activeTab === 'analytics' && (
          <div className="space-y-6">
            {loadingAnalytics ? (
              <div className="flex flex-col items-center justify-center py-20">
                <LuLoader className="animate-spin text-indigo-650" size={32} />
                <span className="text-xs text-slate-450 dark:text-zinc-500 mt-2 font-bold uppercase tracking-wider">Calculating Analytics...</span>
              </div>
            ) : (
              <>
                {/* Analytics Metrics Cards */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="card dark:bg-[#151518]/90 dark:border-zinc-800/80 p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
                      <LuChartBar size={20} />
                    </div>
                    <div>
                      <span className="text-[9px] font-black uppercase text-slate-400 dark:text-zinc-550 block">Submission Compliance</span>
                      <span className="text-xl font-black text-slate-800 dark:text-zinc-100">{analytics.submissionRate}%</span>
                    </div>
                  </div>

                  <div className="card dark:bg-[#151518]/90 dark:border-zinc-800/80 p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-450 flex items-center justify-center">
                      <LuClock size={20} />
                    </div>
                    <div>
                      <span className="text-[9px] font-black uppercase text-slate-400 dark:text-zinc-550 block">Avg Hours / Submission</span>
                      <span className="text-xl font-black text-slate-800 dark:text-zinc-100">{analytics.avgHours} hrs</span>
                    </div>
                  </div>

                  <div className="card dark:bg-[#151518]/90 dark:border-zinc-800/80 p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-955/10 text-rose-600 dark:text-rose-400 flex items-center justify-center">
                      <LuTriangleAlert size={20} />
                    </div>
                    <div>
                      <span className="text-[9px] font-black uppercase text-slate-400 dark:text-zinc-550 block">Active Blocker Flag</span>
                      <span className="text-xl font-black text-rose-600 dark:text-rose-455">{analytics.activeBlockersList.length} reports</span>
                    </div>
                  </div>

                  <div className="card dark:bg-[#151518]/90 dark:border-zinc-800/80 p-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                      <LuActivity size={20} />
                    </div>
                    <div>
                      <span className="text-[9px] font-black uppercase text-slate-400 dark:text-zinc-550 block">Avg. Sign-off Latency</span>
                      <span className="text-xl font-black text-slate-800 dark:text-zinc-100">{analytics.avgLatencyHours} hrs</span>
                    </div>
                  </div>
                </div>

                {/* Second Grid Row: Streaks & Tag Distribution */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  
                  {/* Attendance & Streaks Table */}
                  <div className="lg:col-span-2 space-y-3">
                    <h3 className="text-xs font-black text-slate-400 dark:text-zinc-550 uppercase tracking-widest flex items-center gap-1.5">
                      <LuFlame className="text-amber-500 animate-pulse" size={13} /> Active Streaks & Participation (30 Days)
                    </h3>
                    
                    <div className="card dark:bg-[#151518]/90 dark:border-zinc-800/80 p-0 overflow-hidden">
                      <table className="premium-table min-w-full">
                        <thead>
                          <tr>
                            <th className="dark:text-zinc-500">Intern</th>
                            <th className="dark:text-zinc-500">Current streak</th>
                            <th className="dark:text-zinc-500">Submitted Logs</th>
                            <th className="dark:text-zinc-500 text-right">Activity Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {analytics.streaks.map(intern => (
                            <tr key={intern.id} className="dark:border-zinc-800/85 hover:dark:bg-zinc-900/10">
                              <td className="px-4 py-3 font-bold text-slate-805 dark:text-zinc-200 text-xs flex items-center gap-2">
                                {intern.profileImageUrl ? (
                                  <img src={intern.profileImageUrl} alt="Profile" className="w-5 h-5 rounded-full object-cover" />
                                ) : (
                                  <div className="w-5 h-5 rounded-full bg-slate-100 dark:bg-zinc-900 flex items-center justify-center font-bold text-[9px] text-slate-600 dark:text-zinc-400">
                                    {intern.name?.[0]}
                                  </div>
                                )}
                                <span>{intern.name}</span>
                              </td>
                              <td className="px-4 py-3 text-xs font-black text-slate-750 dark:text-zinc-300">
                                <span className="flex items-center gap-1">
                                  🔥 {intern.streak} day{intern.streak !== 1 ? 's' : ''}
                                </span>
                              </td>
                              <td className="px-4 py-3 text-xs text-slate-500 dark:text-zinc-450 font-bold">
                                {intern.totalSubmitted} logs
                              </td>
                              <td className="px-4 py-3 text-right">
                                <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-lg border ${
                                  intern.streak >= 5 
                                    ? 'bg-emerald-50 border-emerald-100 text-emerald-650 dark:bg-emerald-950/20 dark:border-emerald-900/40 dark:text-emerald-450' 
                                    : intern.streak > 0 
                                      ? 'bg-blue-50 border-blue-100 text-blue-650 dark:bg-blue-950/20 dark:border-blue-900/40 dark:text-blue-400'
                                      : 'bg-rose-50 border-rose-100 text-rose-650 dark:bg-rose-955/15 dark:border-rose-900/40 dark:text-rose-455'
                                }`}>
                                  {intern.streak >= 5 ? 'active streak' : intern.streak > 0 ? 'engaged' : 'no active streak'}
                                </span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Top Work Categories / Tags */}
                  <div className="space-y-3">
                    <h3 className="text-xs font-black text-slate-400 dark:text-zinc-550 uppercase tracking-widest flex items-center gap-1.5">
                      <LuChartBar size={13} /> Logged Categories
                    </h3>
                    
                    <div className="card dark:bg-[#151518]/90 dark:border-zinc-800/80 p-4 space-y-4">
                      {analytics.sortedTags.length === 0 ? (
                        <p className="text-xs text-slate-400 dark:text-zinc-500 italic text-center py-6">No tags logged in the last 30 days.</p>
                      ) : (
                        analytics.sortedTags.map(tag => {
                          const maxCount = Math.max(...analytics.sortedTags.map(t => t.count));
                          const percent = Math.round((tag.count / maxCount) * 100);

                          return (
                            <div key={tag.name} className="space-y-1.5">
                              <div className="flex justify-between items-center text-xs font-bold">
                                <span className="text-slate-805 dark:text-zinc-200">{tag.name}</span>
                                <span className="text-slate-400 dark:text-zinc-500">{tag.count} logs</span>
                              </div>
                              <div className="w-full bg-slate-100 dark:bg-zinc-900/50 rounded-full h-1.5 overflow-hidden">
                                <div 
                                  className="bg-indigo-600 dark:bg-indigo-500 h-1.5 rounded-full" 
                                  style={{ width: `${percent}%` }}
                                />
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                </div>

                {/* Active Blocker Issues Log */}
                <div className="space-y-3">
                  <h3 className="text-xs font-black text-rose-500 uppercase tracking-widest flex items-center gap-1.5">
                    🚧 Unresolved Intern Blockers ({analytics.activeBlockersList.length})
                  </h3>

                  {analytics.activeBlockersList.length === 0 ? (
                    <div className="card dark:bg-[#151518]/90 dark:border-zinc-800/80 p-5 text-center text-slate-400 dark:text-zinc-550 text-xs italic">
                      No active blockers reported.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {analytics.activeBlockersList.map(log => (
                        <div 
                          key={log.id} 
                          className="card dark:bg-[#151518]/90 dark:border-zinc-800/80 p-4 border-l-2 border-l-rose-500 space-y-3 flex flex-col justify-between"
                        >
                          <div className="space-y-2">
                            <div className="flex justify-between items-start gap-2">
                              <div className="flex items-center gap-2">
                                {log.user?.profile_image_url ? (
                                  <img src={log.user.profile_image_url} alt="Profile" className="w-6.5 h-6.5 rounded-full object-cover" />
                                ) : (
                                  <div className="w-6.5 h-6.5 rounded-full bg-slate-100 dark:bg-zinc-900 flex items-center justify-center font-bold text-xs text-slate-655 dark:text-zinc-400">
                                    {log.user?.name?.[0]}
                                  </div>
                                )}
                                <div>
                                  <h4 className="text-xs font-black text-slate-805 dark:text-zinc-200">{log.user?.name}</h4>
                                  <span className="text-[9px] font-bold text-slate-400 dark:text-zinc-550 block">Log Date: {log.log_date}</span>
                                </div>
                              </div>
                              <span className="text-[8px] font-black uppercase bg-rose-50 border border-rose-100 text-rose-600 dark:bg-rose-955/20 dark:border-rose-900/50 dark:text-rose-455 px-1.5 py-0.5 rounded-md animate-pulse">blocker</span>
                            </div>
                            <p className="text-xs text-rose-950 dark:text-rose-300 font-bold bg-rose-50/30 dark:bg-rose-955/5 p-3 rounded-xl border border-rose-100/30 dark:border-rose-900/30 leading-relaxed">
                              {log.blockers}
                            </p>
                          </div>

                          <div className="flex justify-end pt-2 border-t border-slate-100 dark:border-zinc-850">
                            <button
                              onClick={() => handleOpenReview(log)}
                              className="text-[10px] font-black text-indigo-650 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-350 cursor-pointer uppercase tracking-wider"
                            >
                              Review & help unblock
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* Detailed review Drawer */}
        {activeLog && (
          <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/85 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-zinc-950 border border-slate-105 dark:border-zinc-850 rounded-2xl max-w-2xl w-full shadow-2xl p-5 relative max-h-[90vh] overflow-y-auto custom-scrollbar">
              <div className="flex items-center justify-between border-b border-slate-100 dark:border-zinc-850 pb-3 mb-4">
                <div className="flex items-center gap-2">
                  {activeLog.user?.profile_image_url ? (
                    <img src={activeLog.user.profile_image_url} alt="Profile" className="w-9 h-9 rounded-full object-cover" />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-slate-100 dark:bg-zinc-900 flex items-center justify-center font-bold text-sm text-slate-600 dark:text-zinc-400">
                      {activeLog.user?.name?.[0]}
                    </div>
                  )}
                  <div>
                    <h3 className="text-sm font-extrabold text-slate-900 dark:text-zinc-100 uppercase tracking-wider">
                      {activeLog.user?.name}'s Daily Log
                    </h3>
                    <p className="text-[10px] text-slate-450 dark:text-zinc-550 font-bold uppercase tracking-wider mt-0.5">
                      Date: {activeLog.log_date}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setActiveLog(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-900 cursor-pointer text-xs font-black uppercase tracking-wider"
                >
                  Close
                </button>
              </div>

              <div className="space-y-4 text-xs">
                {/* Tasks List */}
                <div className="space-y-2">
                  <h4 className="font-extrabold text-slate-500 dark:text-zinc-400 uppercase tracking-wider text-[10px]">
                    Tasks Logged
                  </h4>
                  <div className="space-y-2">
                    {(() => {
                      try {
                        const parsed = typeof activeLog.tasks_done === 'string' 
                          ? JSON.parse(activeLog.tasks_done) 
                          : activeLog.tasks_done;
                        
                        if (!parsed || parsed.length === 0) {
                          return <p className="text-slate-400 italic">No tasks logged.</p>;
                        }

                        return parsed.map((t, idx) => (
                          <div key={idx} className="p-3 bg-slate-50/50 dark:bg-zinc-900/25 border border-slate-100 dark:border-zinc-900/60 rounded-xl space-y-1">
                            <div className="flex justify-between items-center">
                              <span className="font-bold text-slate-800 dark:text-zinc-200">{t.title}</span>
                              <span className="text-[10px] font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-100/50 dark:border-indigo-900/30 px-1.5 py-0.5 rounded-md">{t.hours} hrs</span>
                            </div>
                            {t.description && (
                              <p className="text-slate-500 dark:text-zinc-400 text-xs mt-1 leading-normal pl-2 border-l border-slate-200 dark:border-zinc-850">{t.description}</p>
                            )}
                          </div>
                        ));
                      } catch (e) {
                        return <p className="text-rose-500">Failed to parse tasks data.</p>;
                      }
                    })()}
                  </div>
                </div>

                {/* Learnings */}
                <div className="space-y-1">
                  <h4 className="font-extrabold text-slate-500 dark:text-zinc-400 uppercase tracking-wider text-[10px]">
                    Key Learnings / Notes
                  </h4>
                  <p className="p-3.5 bg-slate-50/30 dark:bg-zinc-900/20 border border-slate-100 dark:border-zinc-900 rounded-xl text-slate-750 dark:text-zinc-300 leading-relaxed font-semibold">
                    {activeLog.learnings || <span className="text-slate-400 italic">None logged.</span>}
                  </p>
                </div>

                {/* Blockers */}
                {activeLog.blockers && (
                  <div className="space-y-1">
                    <h4 className="font-extrabold text-slate-500 dark:text-zinc-400 uppercase tracking-wider text-[10px] flex items-center gap-1 text-rose-600 dark:text-rose-455">
                      Blockers / Challenges
                    </h4>
                    <p className="p-3.5 bg-rose-50/20 dark:bg-rose-955/5 border border-rose-100/30 dark:border-rose-900/30 rounded-xl text-rose-900 dark:text-rose-300/90 leading-relaxed font-black">
                      {activeLog.blockers}
                    </p>
                  </div>
                )}

                {/* Tomorrow Plan */}
                {activeLog.tomorrow_plan && (
                  <div className="space-y-1">
                    <h4 className="font-extrabold text-slate-500 dark:text-zinc-400 uppercase tracking-wider text-[10px]">
                      Plan for Tomorrow
                    </h4>
                    <p className="p-3.5 bg-slate-50/30 dark:bg-zinc-900/20 border border-slate-100 dark:border-zinc-900 rounded-xl text-slate-700 dark:text-zinc-300 leading-relaxed">
                      {activeLog.tomorrow_plan}
                    </p>
                  </div>
                )}

                {/* Tags */}
                {activeLog.tags && activeLog.tags.length > 0 && (
                  <div className="space-y-1.5">
                    <h4 className="font-extrabold text-slate-500 dark:text-zinc-400 uppercase tracking-wider text-[10px]">
                      Tags
                    </h4>
                    <div className="flex flex-wrap gap-1">
                      {activeLog.tags.map(tag => (
                        <span key={tag} className="px-2 py-0.5 bg-indigo-50/50 dark:bg-indigo-955/15 border border-indigo-100/40 dark:border-indigo-900/35 text-indigo-650 dark:text-indigo-400 text-[10px] font-bold rounded-lg">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Manager Feedback Form */}
                <div className="border-t border-slate-100 dark:border-zinc-850 pt-4 space-y-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-black text-slate-800 dark:text-zinc-200 uppercase tracking-wide flex items-center gap-1">
                      Manager Feedback note <span className="text-[10px] text-slate-400 lowercase font-normal">(sent to intern)</span>
                    </label>
                    <textarea
                      placeholder="Write feedback comment, blocker instructions, or review remarks..."
                      value={managerNote}
                      onChange={(e) => setManagerNote(e.target.value)}
                      rows={2}
                      className="w-full bg-slate-50 dark:bg-zinc-900/60 border border-slate-200 dark:border-zinc-800 rounded-xl p-3.5 text-xs text-slate-750 dark:text-zinc-300 focus:border-indigo-500 focus:outline-none transition-all leading-normal"
                    />
                  </div>

                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={() => handleReview(activeLog.id, 'flagged')}
                      className="px-4 py-2 border border-rose-200 dark:border-rose-955 hover:bg-rose-50 dark:hover:bg-rose-955/10 rounded-xl text-xs font-bold text-rose-600 dark:text-rose-400 transition cursor-pointer"
                    >
                      ⚠️ Flag for Follow-up
                    </button>
                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={() => handleReview(activeLog.id, 'acknowledged')}
                      className="px-5 py-2 bg-indigo-650 hover:bg-indigo-600 text-white rounded-xl text-xs font-bold shadow-md shadow-indigo-600/10 transition cursor-pointer flex items-center gap-1.5"
                    >
                      {actionLoading ? <LuLoader className="animate-spin" size={14} /> : null}
                      ✓ Acknowledge Log
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </DashboardLayout>
  );
};

export default InternLogDashboard;
