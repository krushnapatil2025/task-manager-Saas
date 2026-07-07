import React, { useContext, useEffect, useState, useCallback, useRef } from 'react';
import DashboardLayout from '../../components/layouts/DashboardLayout';
import { WorkspaceContext } from '../../context/WorkspaceContext';
import {
  LuTrendingUp, LuClipboardList, LuCircleCheck,
  LuHourglass, LuCircleAlert, LuUsers,
  LuLoaderCircle, LuChartBar, LuFileSpreadsheet,
  LuPrinter, LuCalendar, LuAward, LuZap, LuTarget,
  LuClock, LuFlag, LuCalendarDays, LuTreePalm
} from 'react-icons/lu';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, AreaChart, Area, LineChart, Line,
  Legend
} from 'recharts';
import ExcelJS from 'exceljs';
import InfoCard from '../../components/Cards/InfoCard';
import HealthScoreGauge from '../../components/Charts/HealthScoreGauge';
import BurndownChart from '../../components/Charts/BurndownChart';
import WorkloadHeatmap from '../../components/Charts/WorkloadHeatmap';
import RefreshButton from '../../components/RefreshButton';
import { getWorkspaceAnalyticsV2, getSprintBurndownData } from '../../services/analyticsService';
import { getAllLeaveRequests } from '../../services/leaveService';
import toast from 'react-hot-toast';
import moment from 'moment';

const AnalTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#121215] border border-zinc-800 text-zinc-100 rounded-xl p-3 shadow-xl text-xs font-bold font-sans">
      {label && <p className="text-zinc-500 mb-1.5 uppercase tracking-wider text-[10px]">{label}</p>}
      {payload.map(p => (
        <p key={p.dataKey} style={{ color: p.color || p.fill }} className="flex items-center gap-1.5 py-0.5 uppercase tracking-wider text-[9px]">
          {p.name || p.dataKey}: <span className="text-zinc-105 font-extrabold">{p.value}</span>
        </p>
      ))}
    </div>
  );
};

const Analytics = () => {
  const { workspace } = useContext(WorkspaceContext);
  
  // Date states
  const [datePreset, setDatePreset] = useState('30'); // '7', '30', '90', 'all', 'custom'
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  // Sprint burndown state
  const [selectedSprintId, setSelectedSprintId] = useState('');
  const [burndownData, setBurndownData] = useState([]);
  const [loadingBurndown, setLoadingBurndown] = useState(false);

  // Leave Analytics state
  const [leaveData, setLeaveData] = useState(null);
  const [loadingLeaves, setLoadingLeaves] = useState(false);

  // Print helper reference
  const printRef = useRef();

  // Calculate start/end dates based on preset
  const getDateLimits = useCallback(() => {
    if (datePreset === 'custom') {
      return { start: customStart || null, end: customEnd || null };
    }
    if (datePreset === 'all') {
      return { start: null, end: null };
    }
    const days = parseInt(datePreset, 10);
    const start = moment().subtract(days, 'days').format('YYYY-MM-DD');
    const end = moment().format('YYYY-MM-DD');
    return { start, end };
  }, [datePreset, customStart, customEnd]);

  // Load main metrics
  const load = useCallback(async () => {
    if (!workspace?.id) return;
    try {
      setLoading(true);
      const { start, end } = getDateLimits();
      const res = await getWorkspaceAnalyticsV2(workspace.id, start, end);
      setData(res);

      // Pre-select first/active sprint if sprint burndown is empty
      if (res.sprints?.length > 0) {
        // Prefer active sprint
        const active = res.sprints.find(s => s.status === 'active');
        const sprintId = active?.id || res.sprints[0].id;
        setSelectedSprintId(sprintId);
      } else {
        setSelectedSprintId('');
        setBurndownData([]);
      }
    } catch (err) {
      console.error('Analytics load error:', err);
      toast.error('Failed to load advanced analytics');
    } finally {
      setLoading(false);
    }
  }, [workspace?.id, getDateLimits]);

  // Load sprint burndown whenever selectedSprintId changes
  const loadBurndown = useCallback(async () => {
    if (!selectedSprintId) {
      setBurndownData([]);
      return;
    }
    try {
      setLoadingBurndown(true);
      const res = await getSprintBurndownData(selectedSprintId);
      setBurndownData(res);
    } catch (err) {
      console.error("Sprint burndown fetch error:", err);
      toast.error("Failed to load sprint burndown progress");
    } finally {
      setLoadingBurndown(false);
    }
  }, [selectedSprintId]);

  // Load leave analytics
  const loadLeaveAnalytics = useCallback(async () => {
    if (!workspace?.id) return;
    try {
      setLoadingLeaves(true);
      const requests = await getAllLeaveRequests(workspace.id);

      // ── By Leave Type utilization (approved + pending grouped) ──────────────
      const typeMap = {};
      requests.forEach(r => {
        const typeName = r.leaveType?.name || 'Unknown';
        const typeColor = r.leaveType?.color || '#6366f1';
        if (!typeMap[typeName]) {
          typeMap[typeName] = { name: typeName, color: typeColor, approved: 0, pending: 0, rejected: 0, total: 0 };
        }
        typeMap[typeName].total += Number(r.total_days || 0);
        if (r.status === 'approved') typeMap[typeName].approved += Number(r.total_days || 0);
        if (r.status === 'pending')  typeMap[typeName].pending  += Number(r.total_days || 0);
        if (r.status === 'rejected') typeMap[typeName].rejected += Number(r.total_days || 0);
      });
      const byType = Object.values(typeMap).sort((a, b) => b.total - a.total);

      // ── Monthly trend (requests submitted per month) ──────────────────────
      const monthMap = {};
      requests.forEach(r => {
        const m = moment(r.created_at).format('MMM YYYY');
        if (!monthMap[m]) monthMap[m] = { month: m, submitted: 0, approved: 0, rejected: 0 };
        monthMap[m].submitted++;
        if (r.status === 'approved') monthMap[m].approved++;
        if (r.status === 'rejected') monthMap[m].rejected++;
      });
      const monthlyTrend = Object.values(monthMap).slice(-12);

      // ── Status breakdown ──────────────────────────────────────────────────
      const statusCount = { pending: 0, approved: 0, rejected: 0, withdrawn: 0, cancelled: 0 };
      requests.forEach(r => { if (statusCount[r.status] !== undefined) statusCount[r.status]++; });
      const statusPie = [
        { name: 'Approved',  value: statusCount.approved,  color: '#10b981' },
        { name: 'Pending',   value: statusCount.pending,   color: '#f59e0b' },
        { name: 'Rejected',  value: statusCount.rejected,  color: '#ef4444' },
        { name: 'Withdrawn', value: statusCount.withdrawn, color: '#94a3b8' },
        { name: 'Cancelled', value: statusCount.cancelled, color: '#6b7280' },
      ].filter(s => s.value > 0);

      // ── Top leave takers (by approved days) ───────────────────────────────
      const personMap = {};
      requests.filter(r => r.status === 'approved').forEach(r => {
        const name = r.applicant?.name || 'Unknown';
        const img  = r.applicant?.profile_image_url || null;
        if (!personMap[name]) personMap[name] = { name, img, days: 0, count: 0 };
        personMap[name].days  += Number(r.total_days || 0);
        personMap[name].count++;
      });
      const topTakers = Object.values(personMap).sort((a, b) => b.days - a.days).slice(0, 8);

      // ── Summary KPIs ──────────────────────────────────────────────────────
      const totalApprovedDays = requests
        .filter(r => r.status === 'approved')
        .reduce((s, r) => s + Number(r.total_days || 0), 0);
      const totalRequests = requests.length;
      const approvalRate = totalRequests > 0
        ? Math.round((statusCount.approved / totalRequests) * 100)
        : 0;

      setLeaveData({ byType, monthlyTrend, statusPie, topTakers, totalApprovedDays, totalRequests, approvalRate, pendingCount: statusCount.pending });
    } catch (err) {
      console.error('Leave analytics error:', err);
      toast.error('Failed to load leave analytics');
    } finally {
      setLoadingLeaves(false);
    }
  }, [workspace?.id]);

  useEffect(() => {
    if (activeTab === 'leaves') loadLeaveAnalytics();
  }, [activeTab, loadLeaveAnalytics]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    loadBurndown();
  }, [loadBurndown]);

  // Quick Preset Handlers
  const handlePresetChange = (preset) => {
    setDatePreset(preset);
    if (preset !== 'custom') {
      setCustomStart('');
      setCustomEnd('');
    }
  };

  // PDF Export
  const handleExportPDF = () => {
    window.print();
  };

  // Excel Export
  const handleExportExcel = async () => {
    if (!data?.tasks) return toast.error('No tasks available to export');
    try {
      const workbook = new ExcelJS.Workbook();
      
      // Sheet 1: Dashboard Summary
      const summarySheet = workbook.addWorksheet('Dashboard Overview');
      summarySheet.columns = [
        { header: 'Metric Name', key: 'metric', width: 25 },
        { header: 'Value', key: 'value', width: 20 }
      ];
      const s = data.summary || {};
      summarySheet.addRows([
        { metric: 'Total Tasks', value: s.total || 0 },
        { metric: 'Completed Tasks', value: s.completed || 0 },
        { metric: 'In Progress Tasks', value: s.inProgress || 0 },
        { metric: 'Pending Tasks', value: s.pending || 0 },
        { metric: 'Overdue Tasks', value: s.overdue || 0 },
        { metric: 'Avg Cycle Time (Days)', value: s.avgCycleTime || '0.0' },
        { metric: 'Health Score', value: s.healthScore || 0 }
      ]);
      
      // Sheet 2: All Tasks Raw Data
      const taskSheet = workbook.addWorksheet('Raw Task Logs');
      taskSheet.columns = [
        { header: 'ID', key: 'id', width: 36 },
        { header: 'Title', key: 'title', width: 30 },
        { header: 'Status', key: 'status', width: 15 },
        { header: 'Priority', key: 'priority', width: 12 },
        { header: 'Due Date', key: 'dueDate', width: 15 },
        { header: 'Created At', key: 'createdAt', width: 25 }
      ];
      
      data.tasks.forEach(t => {
        taskSheet.addRow({
          id: t.id,
          title: t.title,
          status: t.status,
          priority: t.priority,
          dueDate: t.dueDate ? moment(t.dueDate).format('YYYY-MM-DD') : 'No Due Date',
          createdAt: moment(t.createdAt).format('YYYY-MM-DD HH:mm:ss')
        });
      });
      
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.href = url;
      link.download = `Workspace_Analytics_${workspace?.name?.replace(/\s+/g, '_') || 'Report'}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      toast.success('Excel spreadsheet downloaded!');
    } catch (err) {
      console.error('Excel export error:', err);
      toast.error('Failed to export Excel report');
    }
  };

  const TABS = [
    { id: 'overview',   label: 'Overview',               icon: LuChartBar },
    { id: 'agility',   label: 'Sprints & Burndown',      icon: LuTrendingUp },
    { id: 'team',      label: 'Workload & Leaderboard',  icon: LuUsers },
    { id: 'cycletime', label: 'Cycle Time & Goals',      icon: LuClock },
    { id: 'leaves',    label: 'Leave Analytics',         icon: LuTreePalm },
  ];

  if (loading && !data) {
    return (
      <DashboardLayout activeMenu="Analytics">
        <div className="flex flex-col items-center justify-center min-h-[400px] gap-3 font-sans">
          <LuLoaderCircle className="text-indigo-505 text-3xl animate-spin" />
          <p className="text-xs text-slate-400 dark:text-zinc-550 font-bold uppercase tracking-wider">Compiling dashboard analytics...</p>
        </div>
      </DashboardLayout>
    );
  }

  const s = data?.summary || {};

  return (
    <DashboardLayout activeMenu="Analytics">
      
      {/* CSS overrides for printing cleanly */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #print-area, #print-area * {
            visibility: visible;
          }
          #print-area {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      <div id="print-area" className="mt-4 pb-12 animate-fade-in font-sans">
        
        {/* Page Toolbar / Header */}
        <div className="flex items-center justify-between flex-wrap gap-4 mb-6 no-print">
          <div>
            <h1 className="text-xl md:text-2xl font-extrabold text-slate-905 dark:text-zinc-105 tracking-tight flex items-center gap-2">
              📊 Workspace Analytics <span className="text-[10px] font-extrabold uppercase bg-indigo-50/50 dark:bg-indigo-950/20 text-indigo-650 dark:text-indigo-400 px-2 py-0.5 rounded border border-indigo-100/50 dark:border-indigo-900/30 tracking-wider">v2.0</span>
            </h1>
            <p className="text-xs text-slate-400 dark:text-zinc-550 mt-1.5 font-bold uppercase tracking-wider">{workspace?.name} · Enterprise Statistics</p>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            <RefreshButton id="analytics-refresh-v2" onRefresh={load} label="Reload" size="sm" />
            <button
              onClick={handleExportExcel}
              className="card-btn flex items-center gap-1.5 text-xs font-bold transition cursor-pointer"
            >
              <LuFileSpreadsheet size={13} className="text-emerald-500" /> Export Excel
            </button>
            <button
              onClick={handleExportPDF}
              className="card-btn-fill flex items-center gap-1.5 text-xs font-bold transition cursor-pointer"
            >
              <LuPrinter size={13} /> Print/PDF Report
            </button>
          </div>
        </div>

        {/* Date Filter Bar */}
        <div className="card mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4 no-print">
          <div className="flex items-center gap-1 bg-slate-100/60 dark:bg-zinc-900/40 rounded-xl p-1 w-fit border border-slate-205 dark:border-zinc-800/80">
            {[
              { id: '7', label: '7D' },
              { id: '30', label: '30D' },
              { id: '90', label: '90D' },
              { id: 'all', label: 'All Time' },
              { id: 'custom', label: 'Custom' },
            ].map(preset => (
              <button
                key={preset.id}
                onClick={() => handlePresetChange(preset.id)}
                className={`text-[10px] font-extrabold px-3.5 py-1.5 rounded-lg uppercase tracking-wider transition-all cursor-pointer ${
                  datePreset === preset.id
                    ? 'bg-white dark:bg-zinc-800 text-indigo-650 dark:text-indigo-400 shadow-sm'
                    : 'text-slate-500 hover:text-slate-705 dark:text-zinc-400 dark:hover:text-zinc-200'
                }`}
              >
                {preset.label}
              </button>
            ))}
          </div>

          {datePreset === 'custom' && (
            <div className="flex items-center gap-2">
              <div className="relative">
                <input
                  type="date"
                  value={customStart}
                  onChange={e => setCustomStart(e.target.value)}
                  className="field-input pl-7 py-1 text-xs dark:bg-[#121215] dark:border-zinc-800 dark:text-zinc-200"
                />
                <LuCalendar className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-zinc-500" size={11} />
              </div>
              <span className="text-xs text-slate-400 dark:text-zinc-505 font-bold uppercase tracking-wider">to</span>
              <div className="relative">
                <input
                  type="date"
                  value={customEnd}
                  onChange={e => setCustomEnd(e.target.value)}
                  className="field-input pl-7 py-1 text-xs dark:bg-[#121215] dark:border-zinc-800 dark:text-zinc-200"
                />
                <LuCalendar className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-zinc-500" size={11} />
              </div>
              <button
                onClick={load}
                className="bg-indigo-50/50 hover:bg-indigo-100 dark:bg-indigo-955/15 dark:hover:bg-indigo-900/30 text-indigo-655 dark:text-indigo-400 text-[10px] font-bold px-3 py-2 rounded-lg border border-indigo-100/50 dark:border-indigo-900/30 transition cursor-pointer"
              >
                Apply
              </button>
            </div>
          )}
        </div>

        {/* ── KPI cards ── */}
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-4 mb-6">
          <InfoCard label="Total Tasks" value={s.total || 0} color="bg-indigo-600" icon={LuClipboardList} />
          <InfoCard label="Completed" value={s.completed || 0} color="bg-emerald-500" icon={LuCircleCheck} />
          <InfoCard label="In Progress" value={s.inProgress || 0} color="bg-indigo-550" icon={LuHourglass} />
          <InfoCard label="Pending" value={s.pending || 0} color="bg-amber-500" icon={LuHourglass} />
          <InfoCard label="Overdue" value={s.overdue || 0} color="bg-red-500" icon={LuCircleAlert} />
          <InfoCard label="Avg Cycle Time" value={`${s.avgCycleTime || '0.0'} Days`} color="bg-violet-650" icon={LuClock} />
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 bg-slate-100/60 dark:bg-zinc-900/60 rounded-xl p-1 mb-5 max-w-full overflow-x-auto border border-slate-205 dark:border-zinc-800/80 no-print">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 text-xs font-bold px-4 py-1.5 rounded-lg transition-all cursor-pointer ${
                activeTab === tab.id
                  ? 'bg-white dark:bg-zinc-800 text-indigo-650 dark:text-indigo-400 shadow-sm'
                  : 'text-slate-500 hover:text-slate-705 dark:text-zinc-400 dark:hover:text-zinc-200'
              }`}
            >
              <tab.icon size={13} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* PRINT ONLY HEADER */}
        <div className="hidden print:block mb-8 border-b border-slate-200 pb-4">
          <h2 className="text-xl font-extrabold text-slate-900">{workspace?.name} Analytics</h2>
          <p className="text-xs text-slate-500">Generated on {moment().format('MMMM Do YYYY, h:mm A')}</p>
        </div>

        {/* Tab 1: OVERVIEW */}
        {(activeTab === 'overview' || window.matchMedia('print').matches) && (
          <div className={`${activeTab !== 'overview' ? 'hidden print:grid' : 'grid'} grid-cols-1 lg:grid-cols-3 gap-6`}>
            
            {/* Health Score Gauge */}
            <div className="card flex flex-col justify-between">
              <div>
                <h3 className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest mb-4 flex items-center gap-1">
                  <LuZap className="text-amber-500" size={13} /> Health Score
                </h3>
                <HealthScoreGauge score={s.healthScore || 0} />
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2 text-center">
                <div className="bg-slate-50/50 dark:bg-[#121215] rounded-xl p-2.5 border border-slate-100 dark:border-zinc-800/80">
                  <span className="block text-base font-extrabold text-slate-800 dark:text-zinc-200">
                    {s.total > 0 ? Math.round((s.completed / s.total) * 100) : 0}%
                  </span>
                  <span className="text-[9px] text-slate-400 dark:text-zinc-500 font-bold uppercase tracking-wider">Completion Rate</span>
                </div>
                <div className="bg-red-50/30 dark:bg-rose-955/15 rounded-xl p-2.5 border border-red-100/50 dark:border-rose-900/30">
                  <span className="block text-base font-extrabold text-red-655 dark:text-rose-455">{s.overdue || 0}</span>
                  <span className="text-[9px] text-slate-400 dark:text-rose-450 font-bold uppercase tracking-wider">Overdue Tasks</span>
                </div>
              </div>
            </div>

            {/* Status Distribution (Pie) */}
            <div className="card">
              <h3 className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest mb-4">
                Status Distribution
              </h3>
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={data?.statusData || []}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    innerRadius={55}
                    labelLine={false}
                  >
                    {(data?.statusData || []).map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<AnalTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <div className="flex flex-wrap gap-2.5 justify-center mt-2">
                {(data?.statusData || []).map(d => (
                  <span key={d.name} className="flex items-center gap-1 text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
                    <span className="w-2 h-2 rounded-full" style={{ background: d.color }} />
                    {d.name} ({d.value})
                  </span>
                ))}
              </div>
            </div>

            {/* Priority distribution */}
            <div className="card">
              <h3 className="text-[10px] font-bold text-slate-405 dark:text-zinc-555 uppercase tracking-wider mb-4 flex items-center gap-1">
                <LuFlag size={12} /> Task Priority Breakdown
              </h3>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={data?.priorityData || []} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.12)" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'currentColor' }} className="text-slate-400 dark:text-zinc-555" stroke="none" />
                  <YAxis tick={{ fontSize: 11, fill: 'currentColor' }} className="text-slate-400 dark:text-zinc-555" stroke="none" allowDecimals={false} />
                  <Tooltip content={<AnalTooltip />} cursor={{ fill: 'rgba(99,102,241,0.02)' }} />
                  <Bar dataKey="count" radius={[6, 6, 0, 0]} maxBarSize={40}>
                    {(data?.priorityData || []).map((e, i) => (
                       <Cell key={i} fill={e.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Completion & Creation Trend */}
            <div className="lg:col-span-3 card">
              <h3 className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider mb-4">
                Task Creation vs Completion Trend
              </h3>
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={data?.trendData || []} margin={{ top: 4, right: 16, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gradCreated" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#818cf8" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#818cf8" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="gradCompleted" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.12)" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'currentColor' }} className="text-slate-455 dark:text-zinc-555" stroke="none" />
                  <YAxis tick={{ fontSize: 10, fill: 'currentColor' }} className="text-slate-455 dark:text-zinc-555" stroke="none" allowDecimals={false} />
                  <Tooltip content={<AnalTooltip />} />
                  <Legend wrapperStyle={{ fontSize: 11, paddingTop: 10 }} />
                  <Area
                    type="monotone"
                    dataKey="created"
                    name="Tasks Created"
                    stroke="#818cf8"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#gradCreated)"
                  />
                  <Area
                    type="monotone"
                    dataKey="completed"
                    name="Tasks Completed"
                    stroke="#10b981"
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill="url(#gradCompleted)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Tab 2: SPRINTS & BURNDOWN */}
        {(activeTab === 'agility' || window.matchMedia('print').matches) && (
          <div className={`${activeTab !== 'agility' ? 'hidden print:grid' : 'grid'} grid-cols-1 lg:grid-cols-2 gap-6`}>
            
            {/* Sprint Velocity */}
            <div className="card">
              <h3 className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider mb-4">
                Sprint Velocity (Completed Tasks)
              </h3>
              {data?.velocityData?.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-48 border border-dashed border-slate-200 dark:border-zinc-850 rounded-xl">
                  <p className="text-xs text-slate-405 dark:text-zinc-500 font-bold uppercase tracking-wider">No completed sprint data</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={data?.velocityData || []} margin={{ top: 8, right: 12, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.12)" />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'currentColor' }} className="text-slate-400 dark:text-zinc-550" stroke="none" />
                    <YAxis tick={{ fontSize: 10, fill: 'currentColor' }} className="text-slate-400 dark:text-zinc-550" stroke="none" />
                    <Tooltip content={<AnalTooltip />} />
                    <Bar dataKey="completed" fill="#6366f1" radius={[4, 4, 0, 0]} name="Completed Tasks" maxBarSize={35} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Burndown Chart */}
            <div className="card">
              <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
                <div>
                  <h3 className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider">
                    Sprint Burndown
                  </h3>
                  <p className="text-[10.5px] text-slate-405 dark:text-zinc-400 font-semibold mt-0.5">Ideal path vs remaining tasks</p>
                </div>
                
                {data?.sprints?.length > 0 && (
                  <select
                    value={selectedSprintId}
                    onChange={e => setSelectedSprintId(e.target.value)}
                    className="no-print field-input py-1 text-xs w-auto dark:bg-[#121215] dark:border-zinc-800/80 dark:text-zinc-200 cursor-pointer"
                  >
                    {data.sprints.map(s => (
                      <option key={s.id} value={s.id} className="dark:bg-zinc-900">{s.name} ({s.status})</option>
                    ))}
                  </select>
                )}
              </div>

              {loadingBurndown ? (
                <div className="flex justify-center items-center h-[280px]">
                  <LuLoaderCircle className="text-indigo-505 animate-spin" size={20} />
                </div>
              ) : burndownData.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-[280px] border border-dashed border-slate-200 dark:border-zinc-850 rounded-xl">
                  <p className="text-xs text-slate-400 dark:text-zinc-500 font-bold uppercase tracking-wider">No sprint tasks selected</p>
                </div>
              ) : (
                <BurndownChart data={burndownData} />
              )}
            </div>
          </div>
        )}

        {/* Tab 3: TEAM & WORKLOAD */}
        {(activeTab === 'team' || window.matchMedia('print').matches) && (
          <div className={`${activeTab !== 'team' ? 'hidden print:grid' : 'grid'} grid-cols-1 lg:grid-cols-2 gap-6`}>
            
            {/* Workload */}
            <div className="card">
              <h3 className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider mb-1">
                Active Task Workload
              </h3>
              <p className="text-[9px] text-slate-400 dark:text-zinc-550 mb-4 uppercase tracking-wider font-bold">
                🟡 5+ tasks · 🔴 8+ overloaded
              </p>
              <WorkloadHeatmap data={data?.workloadData || []} />
            </div>

            {/* Team Leaderboard */}
            <div className="card">
              <h3 className="text-[10px] font-bold text-slate-400 dark:text-zinc-505 uppercase tracking-wider mb-4 flex items-center gap-1">
                <LuAward className="text-amber-500" size={14} /> Team Performance Leaderboard
              </h3>
              {data?.leaderboard?.length === 0 ? (
                <p className="text-center text-slate-400 dark:text-zinc-500 py-10 text-xs font-semibold">No performance data compiled.</p>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-slate-200/60 dark:border-zinc-850">
                  <table className="premium-table min-w-full">
                    <thead>
                      <tr className="border-b border-slate-100 dark:border-zinc-800/80 text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
                        <th className="px-4 py-3 text-left">Member</th>
                        <th className="px-4 py-3 text-center">Assigned</th>
                        <th className="px-4 py-3 text-center">Completed</th>
                        <th className="px-4 py-3 text-center">On-Time</th>
                        <th className="px-4 py-3 text-right">On-Time Rate</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-105 dark:divide-zinc-800/80">
                      {data.leaderboard.map((member, i) => (
                        <tr key={i} className="hover:bg-slate-25/50 dark:hover:bg-zinc-900/10 transition">
                          <td className="px-4 py-3 flex items-center gap-2 text-slate-800 dark:text-zinc-200 text-xs font-bold">
                            {member.avatar ? (
                              <img src={member.avatar} alt={member.name} className="w-6 h-6 rounded-full object-cover border border-slate-100 dark:border-zinc-800" />
                            ) : (
                              <div className="w-6 h-6 rounded-full bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100/50 dark:border-indigo-900/30 text-indigo-655 dark:text-indigo-400 flex items-center justify-center text-[9px] font-extrabold">
                                {member.name[0]?.toUpperCase()}
                              </div>
                            )}
                            <span className="truncate">{member.name}</span>
                          </td>
                          <td className="px-4 py-3 text-center text-xs text-slate-500 dark:text-zinc-450 font-semibold">{member.total}</td>
                          <td className="px-4 py-3 text-center text-xs text-emerald-600 dark:text-emerald-400 font-bold">{member.completed}</td>
                          <td className="px-4 py-3 text-center text-xs text-indigo-655 dark:text-indigo-400 font-bold">{member.onTime}</td>
                          <td className="px-4 py-3 text-right">
                            <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-extrabold uppercase border ${
                              member.onTimeRate >= 80 ? 'text-emerald-700 bg-emerald-50 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/30' :
                              member.onTimeRate >= 50 ? 'text-amber-700 bg-amber-50 border-amber-200 dark:bg-amber-955/15 dark:text-amber-400 dark:border-amber-900/30' :
                              'text-rose-755 bg-rose-50 border-rose-200 dark:bg-rose-955/15 dark:text-rose-455 dark:border-rose-900/30'
                            }`}>
                              {member.onTimeRate}%
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 4: CYCLE TIME & GOALS */}
        {(activeTab === 'cycletime' || window.matchMedia('print').matches) && (
          <div className={`${activeTab !== 'cycletime' ? 'hidden print:grid' : 'grid'} grid-cols-1 lg:grid-cols-2 gap-6`}>
            
            {/* Cycle Time Distribution */}
            <div className="card">
              <h3 className="text-[10px] font-bold text-slate-400 dark:text-zinc-555 uppercase tracking-wider mb-1 flex items-center gap-1.5">
                <LuClock size={13} /> Cycle Time Distribution
              </h3>
              <p className="text-[10px] text-slate-405 dark:text-zinc-500 font-semibold mb-4">Duration from "In Progress" to completed status</p>
              
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={data?.cycleTimeData || []} margin={{ top: 8, right: 8, left: -25, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(148, 163, 184, 0.12)" />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'currentColor' }} className="text-slate-400 dark:text-zinc-550" stroke="none" />
                  <YAxis tick={{ fontSize: 10, fill: 'currentColor' }} className="text-slate-400 dark:text-zinc-550" stroke="none" allowDecimals={false} />
                  <Tooltip content={<AnalTooltip />} />
                  <Bar dataKey="count" fill="#8b5cf6" radius={[4, 4, 0, 0]} name="Completed Tasks" maxBarSize={30} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Goals & OKRs */}
            <div className="card flex flex-col justify-between">
              <div>
                <h3 className="text-[10px] font-bold text-slate-400 dark:text-zinc-555 uppercase tracking-wider mb-4 flex items-center gap-1.5">
                  <LuTarget className="text-rose-505" size={13} /> OKR Goal Progress Summary
                </h3>
                {data?.goalData?.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-48 border border-dashed border-slate-200 dark:border-zinc-850 rounded-xl">
                    <p className="text-xs text-slate-400 dark:text-zinc-500 font-bold uppercase tracking-wider">No active goals linked</p>
                  </div>
                ) : (
                  <div className="space-y-4 max-h-[220px] overflow-y-auto custom-scrollbar">
                    {data.goalData.map(goal => (
                      <div key={goal.id} className="border-b border-slate-50 dark:border-zinc-850 pb-2 flex flex-col">
                        <div className="flex justify-between items-center text-xs font-semibold text-slate-800 dark:text-zinc-200 mb-1">
                          <span className="truncate pr-4">{goal.title}</span>
                          <span className="text-[10px] text-slate-405 dark:text-zinc-500 uppercase tracking-wider">{goal.progress}%</span>
                        </div>
                        <div className="w-full h-1.5 bg-slate-100 dark:bg-zinc-855 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-rose-500 to-indigo-500 rounded-full"
                            style={{ width: `${goal.progress}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Overdue trend chart */}
              {data?.overdueTrend?.length > 0 && (
                <div className="mt-6 pt-4 border-t border-slate-150/40 dark:border-zinc-800">
                  <h4 className="text-[10px] font-bold text-slate-400 dark:text-zinc-505 uppercase tracking-wider mb-2">Overdue Trend (Last 30 Snapshots)</h4>
                  <ResponsiveContainer width="100%" height={90}>
                    <LineChart data={data.overdueTrend}>
                      <Tooltip content={<AnalTooltip />} />
                      <Line type="monotone" dataKey="overdue" stroke="#ef4444" strokeWidth={2} dot={false} name="Overdue Count" />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>
        )}
        {/* ═════════════════ Tab 5: LEAVE ANALYTICS ═════════════════ */}
        {activeTab === 'leaves' && (
          <div className="space-y-6">

            {/* KPI Row */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Total Requests',     value: leaveData?.totalRequests     ?? '—', color: 'text-indigo-655 dark:text-indigo-400',  bg: 'bg-indigo-50/30 dark:bg-indigo-950/20', border: 'border-indigo-100/50 dark:border-indigo-900/30' },
                { label: 'Approved Days',      value: leaveData?.totalApprovedDays ?? '—', color: 'text-emerald-650 dark:text-emerald-400', bg: 'bg-emerald-50/30 dark:bg-emerald-950/20', border: 'border-emerald-100/50 dark:border-emerald-900/30' },
                { label: 'Approval Rate',      value: leaveData ? `${leaveData.approvalRate}%` : '—', color: 'text-amber-650 dark:text-amber-400', bg: 'bg-amber-50/30 dark:bg-amber-955/15', border: 'border-amber-100/50 dark:border-amber-900/30' },
                { label: 'Pending Requests',   value: leaveData?.pendingCount      ?? '—', color: 'text-rose-655 dark:text-rose-455',     bg: 'bg-rose-50/30 dark:bg-rose-955/15',     border: 'border-rose-100/50 dark:border-rose-900/30' },
              ].map(k => (
                <div key={k.label} className={`card border ${k.border} ${k.bg} flex flex-col items-center justify-center py-5 text-center`}>
                  <span className={`text-2xl font-extrabold ${k.color}`}>{loadingLeaves ? <LuLoaderCircle className="animate-spin" size={22} /> : k.value}</span>
                  <span className="text-[10px] text-slate-400 dark:text-zinc-500 font-bold uppercase tracking-wider mt-1.5">{k.label}</span>
                </div>
              ))}
            </div>

            {/* Row 2 — By Type bar + Status Pie */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

              {/* Leave Days by Type */}
              <div className="card">
                <h3 className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest mb-4 flex items-center gap-1.5">
                  <LuCalendarDays size={13} className="text-indigo-500" /> Leave Days by Type
                </h3>
                {loadingLeaves ? (
                  <div className="flex justify-center items-center h-48"><LuLoaderCircle className="animate-spin text-indigo-500" size={20} /></div>
                ) : leaveData?.byType?.length === 0 ? (
                  <div className="flex items-center justify-center h-48 border border-dashed border-slate-200 dark:border-zinc-850 rounded-xl">
                    <p className="text-xs text-slate-400 dark:text-zinc-500 font-bold uppercase tracking-wider">No leave data available</p>
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={240}>
                    <BarChart data={leaveData?.byType || []} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.12)" />
                      <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'currentColor' }} className="text-slate-400 dark:text-zinc-550" stroke="none" />
                      <YAxis tick={{ fontSize: 10, fill: 'currentColor' }} className="text-slate-400 dark:text-zinc-550" stroke="none" allowDecimals={false} />
                      <Tooltip content={<AnalTooltip />} />
                      <Bar dataKey="approved" name="Approved Days" stackId="a" radius={[0,0,0,0]} maxBarSize={40}>
                        {(leaveData?.byType || []).map((e, i) => <Cell key={i} fill={e.color} />)}
                      </Bar>
                      <Bar dataKey="pending" name="Pending Days" stackId="a" fill="#f59e0b" opacity={0.6} radius={[4,4,0,0]} maxBarSize={40} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* Status Breakdown Pie */}
              <div className="card">
                <h3 className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest mb-4 flex items-center gap-1.5">
                  <LuFlag size={13} className="text-rose-500" /> Request Status Breakdown
                </h3>
                {loadingLeaves ? (
                  <div className="flex justify-center items-center h-48"><LuLoaderCircle className="animate-spin text-indigo-500" size={20} /></div>
                ) : (
                  <>
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie
                          data={leaveData?.statusPie || []}
                          dataKey="value"
                          nameKey="name"
                          cx="50%" cy="50%"
                          outerRadius={80} innerRadius={50}
                          labelLine={false}
                        >
                          {(leaveData?.statusPie || []).map((e, i) => <Cell key={i} fill={e.color} />)}
                        </Pie>
                        <Tooltip content={<AnalTooltip />} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="flex flex-wrap gap-2.5 justify-center mt-2">
                      {(leaveData?.statusPie || []).map(d => (
                        <span key={d.name} className="flex items-center gap-1 text-[10px] font-bold text-slate-500 dark:text-zinc-400 uppercase tracking-wider">
                          <span className="w-2 h-2 rounded-full" style={{ background: d.color }} />
                          {d.name} ({d.value})
                        </span>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>

            {/* Row 3 — Monthly Trend */}
            <div className="card">
              <h3 className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest mb-4 flex items-center gap-1.5">
                <LuTrendingUp size={13} className="text-emerald-500" /> Monthly Leave Request Trend
              </h3>
              {loadingLeaves ? (
                <div className="flex justify-center items-center h-40"><LuLoaderCircle className="animate-spin text-indigo-500" size={20} /></div>
              ) : leaveData?.monthlyTrend?.length === 0 ? (
                <div className="flex items-center justify-center h-40 border border-dashed border-slate-200 dark:border-zinc-850 rounded-xl">
                  <p className="text-xs text-slate-400 dark:text-zinc-500 font-bold uppercase tracking-wider">No monthly data available</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <AreaChart data={leaveData?.monthlyTrend || []} margin={{ top: 4, right: 16, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="gradSubmitted" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.25}/>
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="gradApprovedLeave" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.25}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(148,163,184,0.12)" />
                    <XAxis dataKey="month" tick={{ fontSize: 10, fill: 'currentColor' }} className="text-slate-450 dark:text-zinc-550" stroke="none" />
                    <YAxis tick={{ fontSize: 10, fill: 'currentColor' }} className="text-slate-450 dark:text-zinc-550" stroke="none" allowDecimals={false} />
                    <Tooltip content={<AnalTooltip />} />
                    <Area type="monotone" dataKey="submitted" name="Submitted" stroke="#6366f1" strokeWidth={2} fillOpacity={1} fill="url(#gradSubmitted)" />
                    <Area type="monotone" dataKey="approved"  name="Approved"  stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#gradApprovedLeave)" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Row 4 — Top Leave Takers */}
            <div className="card">
              <h3 className="text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest mb-4 flex items-center gap-1.5">
                <LuAward className="text-amber-500" size={13} /> Top Leave Takers (Approved Days)
              </h3>
              {loadingLeaves ? (
                <div className="flex justify-center items-center h-32"><LuLoaderCircle className="animate-spin text-indigo-500" size={20} /></div>
              ) : leaveData?.topTakers?.length === 0 ? (
                <div className="flex items-center justify-center h-32 border border-dashed border-slate-200 dark:border-zinc-850 rounded-xl">
                  <p className="text-xs text-slate-400 dark:text-zinc-500 font-bold uppercase tracking-wider">No approved leave data yet</p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-lg border border-slate-200/60 dark:border-zinc-850">
                  <table className="premium-table min-w-full">
                    <thead>
                      <tr className="border-b border-slate-100 dark:border-zinc-800/80 text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-zinc-500">
                        <th className="px-4 py-3 text-left">Rank</th>
                        <th className="px-4 py-3 text-left">Employee</th>
                        <th className="px-4 py-3 text-center">Total Requests</th>
                        <th className="px-4 py-3 text-right">Approved Days</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/80">
                      {leaveData.topTakers.map((p, i) => (
                        <tr key={p.name} className="hover:bg-slate-25/50 dark:hover:bg-zinc-900/10 transition">
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-extrabold ${
                              i === 0 ? 'bg-amber-50 text-amber-650 dark:bg-amber-955/20 dark:text-amber-400 border border-amber-200 dark:border-amber-900/30' :
                              i === 1 ? 'bg-slate-100 text-slate-600 dark:bg-zinc-800 dark:text-zinc-300 border border-slate-200 dark:border-zinc-700' :
                              'bg-slate-50 text-slate-500 dark:bg-zinc-900/40 dark:text-zinc-500 border border-slate-100 dark:border-zinc-800'
                            }`}>#{i + 1}</span>
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              {p.img ? (
                                <img src={p.img} alt={p.name} className="w-6 h-6 rounded-full object-cover border border-slate-100 dark:border-zinc-800" />
                              ) : (
                                <div className="w-6 h-6 rounded-full bg-indigo-50 dark:bg-indigo-950/20 text-indigo-655 dark:text-indigo-400 flex items-center justify-center text-[9px] font-extrabold">
                                  {p.name[0]?.toUpperCase()}
                                </div>
                              )}
                              <span className="text-xs font-bold text-slate-800 dark:text-zinc-200 truncate">{p.name}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center text-xs text-slate-500 dark:text-zinc-450 font-semibold">{p.count}</td>
                          <td className="px-4 py-3 text-right">
                            <span className="text-xs font-extrabold text-emerald-650 dark:text-emerald-400">{p.days} days</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

          </div>
        )}

      </div>
    </DashboardLayout>
  );
};

export default Analytics;
