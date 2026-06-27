import React, { useState, useEffect, useContext, useRef } from 'react';
import moment from 'moment';
import DashboardLayout from '../../components/layouts/DashboardLayout';
import { WorkspaceContext } from '../../context/WorkspaceContext';
import { UserContext } from '../../context/userContext';
import { 
  getAllLeaveRequests, 
  getAllLeaveBalances, 
  updateLeaveBalanceManual, 
  getLeaveHolidays, 
  addLeaveHoliday, 
  deleteLeaveHoliday,
  getLeaveTypes,
  saveLeaveType
} from '../../services/leaveService';
import { supabase } from '../../utils/supabaseClient';
import LeaveStatusBadge from '../../components/Leave/LeaveStatusBadge';
import LeaveTypeBadge from '../../components/Leave/LeaveTypeBadge';
import ReviewLeaveModal from '../../components/Leave/ReviewLeaveModal';
import RefreshButton from '../../components/RefreshButton';
import toast from 'react-hot-toast';
import ExcelJS from 'exceljs';
import { 
  LuCheck, LuX, LuPlus, LuTrash2, LuFileSpreadsheet, 
  LuSettings, LuUsers, LuCalendarDays, LuLoader, LuSearch, 
  LuChevronDown, LuCalendar, LuUserCheck, LuPencil,
  LuChevronLeft, LuChevronRight
} from 'react-icons/lu';

const TABS = ['Pending Requests', 'All Applications', 'Leave Calendar', 'Employee Balances', 'Holidays & Settings'];

const LeaveManagement = () => {
  const { workspace } = useContext(WorkspaceContext);
  const { user } = useContext(UserContext);

  const [tab, setTab] = useState(0);
  const [loading, setLoading] = useState(false);
  const [requests, setRequests] = useState([]);
  const [balances, setBalances] = useState([]);
  const [holidays, setHolidays] = useState([]);
  const [leaveTypes, setLeaveTypes] = useState([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  
  // Selection/Modals
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [editingBalance, setEditingBalance] = useState(null);
  const [editTotalDays, setEditTotalDays] = useState('');
  const [expandedUser, setExpandedUser] = useState(null);
  const [calendarDate, setCalendarDate] = useState(moment());
  
  // Custom Holiday Form
  const [newHolidayName, setNewHolidayName] = useState('');
  const [newHolidayDate, setNewHolidayDate] = useState('');
  const [submittingHoliday, setSubmittingHoliday] = useState(false);

  // Leave Type Form/Settings
  const [editingType, setEditingType] = useState(null);
  const [typeMaxDays, setTypeMaxDays] = useState('');
  const [typeRequiresDoc, setTypeRequiresDoc] = useState(false);
  const [savingType, setSavingType] = useState(false);

  const loadData = async () => {
    if (!workspace?.id) return;
    setLoading(true);
    try {
      const [allRequests, allBalances, allHolidays, allTypes] = await Promise.all([
        getAllLeaveRequests(workspace.id),
        getAllLeaveBalances(workspace.id),
        getLeaveHolidays(workspace.id),
        getLeaveTypes(workspace.id)
      ]);
      setRequests(allRequests);
      setBalances(allBalances);
      setHolidays(allHolidays);
      setLeaveTypes(allTypes);
    } catch (err) {
      toast.error('Failed to load leave data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // ── Realtime subscription: auto-refresh when leave requests change ──────────
  const channelRef = useRef(null);

  useEffect(() => {
    if (!workspace?.id) return;
    loadData();

    // Subscribe to INSERT / UPDATE on leave_requests for this workspace
    const channel = supabase
      .channel(`leave_requests:${workspace.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'leave_requests',
          filter: `workspace_id=eq.${workspace.id}`,
        },
        (payload) => {
          console.log('[LeaveManagement] Realtime change:', payload.eventType);
          loadData();
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspace?.id]);

  const handleOpenReview = (req) => {
    setSelectedRequest(req);
    setShowReviewModal(true);
  };

  // Quick Action Approve
  const handleQuickApprove = async (req) => {
    if (!confirm(`Are you sure you want to approve ${req.applicant?.name}'s leave request?`)) return;
    try {
      // Reuses the review function with approved status, empty comment, and current user id
      const { reviewLeaveRequest } = await import('../../services/leaveService');
      await reviewLeaveRequest(req.id, 'approved', 'Approved via Quick Action', user.id);
      toast.success('Request approved successfully');
      loadData();
    } catch (err) {
      toast.error(err.message || 'Failed to approve request');
    }
  };

  // Balance Update
  const handleSaveBalance = async (e) => {
    e.preventDefault();
    if (!editingBalance) return;
    try {
      await updateLeaveBalanceManual(editingBalance.id, {
        total_days: parseFloat(editTotalDays)
      });
      toast.success('Leave balance updated successfully');
      setEditingBalance(null);
      loadData();
    } catch (err) {
      toast.error('Failed to update leave balance');
    }
  };

  // Holiday Actions
  const handleAddHoliday = async (e) => {
    e.preventDefault();
    if (!newHolidayName || !newHolidayDate) return;
    setSubmittingHoliday(true);
    try {
      await addLeaveHoliday({
        workspace_id: workspace.id,
        name: newHolidayName,
        date: newHolidayDate,
        country_code: 'IN',
        is_optional: false
      });
      toast.success('Holiday added successfully');
      setNewHolidayName('');
      setNewHolidayDate('');
      loadData();
    } catch (err) {
      toast.error(err.message || 'Failed to add holiday');
    } finally {
      setSubmittingHoliday(false);
    }
  };

  const handleDeleteHoliday = async (id) => {
    if (!confirm('Are you sure you want to delete this holiday?')) return;
    try {
      await deleteLeaveHoliday(id);
      toast.success('Holiday deleted');
      loadData();
    } catch (err) {
      toast.error('Failed to delete holiday');
    }
  };

  // Leave Type Save
  const handleSaveLeaveType = async (e) => {
    e.preventDefault();
    if (!editingType) return;
    setSavingType(true);
    try {
      await saveLeaveType({
        id: editingType.id,
        workspace_id: workspace.id,
        name: editingType.name,
        code: editingType.code,
        max_days_per_year: parseInt(typeMaxDays) || 0,
        requires_document: typeRequiresDoc,
        color: editingType.color
      });
      toast.success('Leave type policy updated');
      setEditingType(null);
      loadData();
    } catch (err) {
      toast.error('Failed to save leave type');
    } finally {
      setSavingType(false);
    }
  };

  // Export to Excel
  const handleExport = async () => {
    const wb = new ExcelJS.Workbook();
    const sheet = wb.addWorksheet('Leave Applications');
    sheet.columns = [
      { header: 'Applicant', key: 'applicant', width: 22 },
      { header: 'Department', key: 'department', width: 16 },
      { header: 'Leave Category', key: 'type', width: 18 },
      { header: 'Start Date', key: 'start', width: 14 },
      { header: 'End Date', key: 'end', width: 14 },
      { header: 'Days', key: 'days', width: 10 },
      { header: 'Status', key: 'status', width: 12 },
      { header: 'Reviewed By', key: 'reviewer', width: 18 },
      { header: 'Comments', key: 'comments', width: 30 }
    ];

    requests.forEach(r => {
      sheet.addRow({
        applicant: r.applicant?.name || '',
        department: r.applicant?.department || '',
        type: r.leaveType?.name || '',
        start: r.start_date,
        end: r.end_date,
        days: r.total_days,
        status: r.status,
        reviewer: r.reviewer?.name || '',
        comments: r.review_comment || ''
      });
    });

    const buf = await wb.xlsx.writeBuffer();
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([buf], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }));
    link.download = `${workspace?.name}_leave_report.xlsx`;
    link.click();
    toast.success('Leave report downloaded!');
  };

  // Filters
  const pendingRequests = requests.filter(r => r.status === 'pending');
  
  const filteredRequests = requests.filter(r => {
    const q = search.toLowerCase();
    const matchSearch = !q || 
      r.applicant?.name?.toLowerCase().includes(q) || 
      r.applicant?.department?.toLowerCase().includes(q) || 
      r.leaveType?.name?.toLowerCase().includes(q);
    const matchStatus = !statusFilter || r.status === statusFilter;
    return matchSearch && matchStatus;
  });

  const filteredBalances = balances.filter(b => {
    const q = search.toLowerCase();
    return !q || b.user?.name?.toLowerCase().includes(q) || b.user?.department?.toLowerCase().includes(q);
  });

  return (
    <DashboardLayout activeMenu="Leave Management">
      <div className="mt-5 mb-10 font-sans">
        
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
          <div>
            <h2 className="text-xl md:text-2xl font-extrabold text-slate-905 dark:text-zinc-100 tracking-tight">📅 Leave Management Hub</h2>
            <p className="text-xs text-slate-400 dark:text-zinc-550 mt-1.5 font-bold uppercase tracking-wider">
              {workspace?.name} · Review requests and adjust allowances
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={handleExport} className="card-btn flex items-center gap-1.5 text-xs cursor-pointer">
              <LuFileSpreadsheet size={14} /> Export CSV
            </button>
            <RefreshButton
              id="admin-leaves-refresh"
              onRefresh={loadData}
              label="Refresh"
              size="sm"
            />
          </div>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 bg-slate-100/60 dark:bg-zinc-900/40 p-1 rounded-xl mb-5 w-fit border border-slate-205 dark:border-zinc-800/80">
          {TABS.map((t, i) => (
            <button
              key={t}
              onClick={() => { setTab(i); setSearch(''); setStatusFilter(''); }}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                tab === i
                  ? 'bg-white dark:bg-zinc-800 text-indigo-650 dark:text-indigo-455 shadow-sm'
                  : 'text-slate-500 dark:text-zinc-450 hover:text-slate-705 dark:hover:text-zinc-200'
              }`}
            >
              {t}
              {t === 'Pending Requests' && pendingRequests.length > 0 && (
                <span className="ml-1.5 bg-amber-500 text-white text-[9px] font-extrabold px-1.5 py-0.5 rounded-full">
                  {pendingRequests.length}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Filters */}
        {[0, 1, 3].includes(tab) && (
          <div className="flex flex-col sm:flex-row gap-3 mb-6">
            <div className="relative flex-1">
              <LuSearch size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-zinc-500" />
              <input
                type="text"
                placeholder={tab === 3 ? "Search by employee name or department..." : "Search by employee, department or type..."}
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="field-input pl-9 dark:bg-[#121215] dark:border-zinc-800/80 dark:text-zinc-200"
              />
            </div>
            {tab === 1 && (
              <div className="relative">
                <select
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value)}
                  className="field-input pl-3 pr-8 dark:bg-[#121215] dark:border-zinc-800/80 dark:text-zinc-200 appearance-none cursor-pointer min-w-[130px]"
                >
                  <option value="">All Statuses</option>
                  <option value="pending">🟡 Pending</option>
                  <option value="approved">✅ Approved</option>
                  <option value="rejected">❌ Rejected</option>
                  <option value="cancelled">⭕ Cancelled</option>
                  <option value="withdrawn">↩️ Withdrawn</option>
                </select>
                <LuChevronDown size={13} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
            )}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-16">
            <LuLoader className="animate-spin text-indigo-500" size={28} />
          </div>
        ) : (
          <>
            {/* ══════════ TAB 0 — Pending Requests ══════════ */}
            {tab === 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {pendingRequests.length === 0 ? (
                  <div className="card col-span-full py-12 text-center text-slate-400 dark:text-zinc-500 font-semibold uppercase tracking-wider">
                    <LuUserCheck size={32} className="mx-auto mb-2 opacity-30 text-indigo-500" />
                    No pending leave requests.
                  </div>
                ) : (
                  pendingRequests.map(req => {
                    const applicant = req.applicant || {};
                    return (
                      <div key={req.id} className="card flex flex-col justify-between !p-5 dark:bg-[#151518]/90 dark:border-zinc-800/80 hover:shadow-md transition">
                        <div>
                          {/* Applicant details */}
                          <div className="flex items-center gap-3 mb-4 pb-3 border-b border-slate-100 dark:border-zinc-850">
                            <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-indigo-50 text-indigo-650 dark:bg-indigo-950/20 dark:text-indigo-400 font-bold">
                              {applicant.profile_image_url ? (
                                <img src={applicant.profile_image_url} alt={applicant.name} className="w-9 h-9 rounded-lg object-cover" />
                              ) : (
                                (applicant.name || 'U').substring(0, 2).toUpperCase()
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="font-extrabold text-slate-800 dark:text-zinc-200 text-xs truncate">{applicant.name}</h4>
                              <p className="text-[9px] text-slate-400 dark:text-zinc-550 font-bold uppercase tracking-wider mt-0.5">
                                {applicant.job_profile} · {applicant.department || 'No Dept'}
                              </p>
                            </div>
                          </div>

                          {/* Leave Details */}
                          <div className="space-y-2 text-xs mb-4">
                            <div className="flex justify-between">
                              <span className="text-slate-450 dark:text-zinc-500">Category</span>
                              <LeaveTypeBadge leaveType={req.leaveType} />
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-450 dark:text-zinc-500">Duration</span>
                              <span className="font-bold text-slate-700 dark:text-zinc-300">
                                {req.total_days} Day{req.total_days !== 1 ? 's' : ''}
                                {req.is_half_day && ' (Half-day)'}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-455 dark:text-zinc-500">Dates</span>
                              <span className="font-semibold text-slate-650 dark:text-zinc-400">
                                {new Date(req.start_date).toLocaleDateString()} - {new Date(req.end_date).toLocaleDateString()}
                              </span>
                            </div>
                            {req.reason && (
                              <div className="mt-1">
                                <span className="block text-[10px] text-slate-400 dark:text-zinc-550 font-bold uppercase mb-0.5">Reason</span>
                                <p className="text-[11px] text-slate-600 dark:text-zinc-400 bg-slate-50 dark:bg-zinc-900/60 p-2 rounded-lg truncate" title={req.reason}>
                                  {req.reason}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* CTAs */}
                        <div className="flex gap-2 pt-3 border-t border-slate-100 dark:border-zinc-850">
                          <button
                            onClick={() => handleOpenReview(req)}
                            className="flex-1 py-1.5 border border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-zinc-300 hover:bg-slate-50 dark:hover:bg-zinc-850 rounded-lg text-xs font-bold transition cursor-pointer"
                          >
                            Review
                          </button>
                          <button
                            onClick={() => handleQuickApprove(req)}
                            className="p-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg transition cursor-pointer flex items-center justify-center gap-1 shadow-sm"
                            title="Quick Approve"
                          >
                            <LuCheck size={14} />
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}

            {/* ══════════ TAB 1 — All Applications ══════════ */}
            {tab === 1 && (
              <div className="card overflow-x-auto !p-0 dark:bg-[#151518]/90 dark:border-zinc-800/80">
                <table className="premium-table min-w-full">
                  <thead>
                    <tr>
                      <th className="dark:text-zinc-500">Applicant</th>
                      <th className="dark:text-zinc-500">Leave Category</th>
                      <th className="dark:text-zinc-500">Dates</th>
                      <th className="dark:text-zinc-500">Duration</th>
                      <th className="dark:text-zinc-500">Status</th>
                      <th className="dark:text-zinc-500">Reviewed By</th>
                      <th className="text-right dark:text-zinc-500">Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRequests.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="text-center py-12 text-slate-400 dark:text-zinc-500 font-semibold uppercase tracking-wider">
                          No leave applications match filters.
                        </td>
                      </tr>
                    ) : (
                      filteredRequests.map(req => (
                        <tr key={req.id} className="dark:border-zinc-800/80 hover:dark:bg-zinc-900/10">
                          {/* Applicant */}
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 rounded bg-indigo-50 text-indigo-650 dark:bg-indigo-950/20 dark:text-indigo-400 font-bold flex items-center justify-center text-xs">
                                {req.applicant?.profile_image_url ? (
                                  <img src={req.applicant.profile_image_url} alt="" className="w-7 h-7 rounded object-cover" />
                                ) : (
                                  (req.applicant?.name || 'U').substring(0, 2).toUpperCase()
                                )}
                              </div>
                              <div>
                                <p className="font-bold text-slate-800 dark:text-zinc-200 text-xs">{req.applicant?.name}</p>
                                <span className="text-[9px] text-slate-400 dark:text-zinc-550 font-bold uppercase tracking-wider">{req.applicant?.department}</span>
                              </div>
                            </div>
                          </td>
                          {/* Leave Type */}
                          <td className="px-4 py-3">
                            <LeaveTypeBadge leaveType={req.leaveType} />
                          </td>
                          {/* Dates */}
                          <td className="px-4 py-3 text-[10px] text-slate-500 dark:text-zinc-400 font-bold uppercase tracking-wider">
                            {new Date(req.start_date).toLocaleDateString()} - {new Date(req.end_date).toLocaleDateString()}
                          </td>
                          {/* Duration */}
                          <td className="px-4 py-3 font-bold text-slate-800 dark:text-zinc-200 text-xs">
                            {req.total_days} Day{req.total_days !== 1 ? 's' : ''}
                          </td>
                          {/* Status */}
                          <td className="px-4 py-3">
                            <LeaveStatusBadge status={req.status} />
                          </td>
                          {/* Reviewed By */}
                          <td className="px-4 py-3 text-xs font-bold text-slate-550 dark:text-zinc-500 uppercase">
                            {req.reviewer?.name || <span className="text-slate-300 dark:text-zinc-700 font-normal">—</span>}
                          </td>
                          {/* Actions */}
                          <td className="px-4 py-3 text-right">
                            <button
                              onClick={() => handleOpenReview(req)}
                              className="text-xs font-bold text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 cursor-pointer"
                            >
                              Details
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* ══════════ TAB 2 — Leave Calendar ══════════ */}
            {tab === 2 && (
              <div className="space-y-4 animate-in fade-in duration-200">
                {/* Month Navigator Header */}
                <div className="flex flex-col sm:flex-row justify-between items-center gap-3 bg-white dark:bg-[#151518]/90 p-4 rounded-2xl border border-slate-200/50 dark:border-zinc-800/80 shadow-xs">
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => setCalendarDate(moment(calendarDate).subtract(1, 'month'))}
                      className="p-1.5 hover:bg-slate-50 dark:hover:bg-zinc-800 rounded-lg text-slate-500 dark:text-zinc-400 transition-all border border-transparent hover:border-slate-200/50 shadow-sm cursor-pointer"
                    >
                      <LuChevronLeft size={16} />
                    </button>
                    <span className="text-xs font-black text-slate-705 dark:text-zinc-205 uppercase tracking-wider min-w-[120px] text-center select-none">
                      {calendarDate.format('MMMM YYYY')}
                    </span>
                    <button 
                      onClick={() => setCalendarDate(moment(calendarDate).add(1, 'month'))}
                      className="p-1.5 hover:bg-slate-50 dark:hover:bg-zinc-800 rounded-lg text-slate-500 dark:text-zinc-400 transition-all border border-transparent hover:border-slate-200/50 shadow-sm cursor-pointer"
                    >
                      <LuChevronRight size={16} />
                    </button>
                  </div>
                  <button 
                    onClick={() => setCalendarDate(moment())}
                    className="px-3.5 py-1.5 text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-105 dark:text-indigo-400 dark:bg-indigo-950/20 dark:hover:bg-indigo-900/30 rounded-xl transition-all shadow-sm cursor-pointer"
                  >
                    Today
                  </button>
                </div>

                {/* Calendar Grid */}
                <div className="grid grid-cols-7 gap-[1px] bg-slate-200/40 dark:bg-zinc-800/40 rounded-2xl overflow-hidden border border-slate-200/40 dark:border-zinc-800/60 shadow-sm">
                  {/* Weekday Headers */}
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d, i) => (
                    <div 
                      key={i} 
                      className={`py-2.5 text-center text-[10px] font-extrabold uppercase tracking-wider bg-slate-50/70 dark:bg-zinc-900/40 border-b border-slate-200/30 ${
                        i === 0 ? 'text-red-500 font-black' : 'text-slate-400'
                      }`}
                    >
                      {d}
                    </div>
                  ))}
                  
                  {/* Grid cells */}
                  {(() => {
                    const startOfMonth = moment(calendarDate).startOf('month');
                    const endOfMonth = moment(calendarDate).endOf('month');
                    const startDate = moment(startOfMonth).startOf('week');
                    const endDate = moment(endOfMonth).endOf('week');

                    const day = moment(startDate);
                    const gridDays = [];

                    while (day.isBefore(endDate)) {
                      gridDays.push(moment(day));
                      day.add(1, 'day');
                    }

                    return gridDays.map((dayItem, idx) => {
                      const dateStr = dayItem.format('YYYY-MM-DD');
                      const isCurrentMonth = dayItem.isSame(calendarDate, 'month');
                      const isToday = dayItem.isSame(moment(), 'day');
                      const isSunday = dayItem.day() === 0;

                      // Check holidays
                      const dayHolidays = holidays.filter(h => h.date === dateStr);
                      const hasHoliday = dayHolidays.length > 0;
                      const isRedDay = isSunday || hasHoliday;

                      // Filter leave requests active on this date
                      const dayRequests = requests.filter(req => {
                        return dateStr >= req.start_date && dateStr <= req.end_date && ['approved', 'pending'].includes(req.status);
                      });

                      return (
                        <div 
                          key={idx}
                          className={`min-h-[110px] border-b border-r border-slate-105 dark:border-zinc-850/50 p-2 flex flex-col gap-1 transition-all ${
                            isCurrentMonth ? 'bg-white dark:bg-[#151518]/60' : 'bg-slate-50/40 dark:bg-zinc-900/10 text-slate-300 dark:text-zinc-800'
                          } ${isRedDay ? 'bg-red-50/10 dark:bg-red-950/5' : ''}`}
                        >
                          {/* Cell Date label */}
                          <div className="flex justify-between items-center select-none">
                            <span className={`text-[10px] font-extrabold ${
                              !isCurrentMonth 
                                ? 'text-slate-300 dark:text-zinc-700' 
                                : isToday
                                ? 'bg-indigo-650 text-white w-5 h-5 flex items-center justify-center rounded-full shadow-sm shadow-indigo-600/20'
                                : isRedDay
                                ? 'text-red-500 font-bold'
                                : 'text-slate-650 dark:text-zinc-400'
                            }`}>
                              {dayItem.date()}
                            </span>
                            {isToday && (
                              <span className="w-1.5 h-1.5 bg-indigo-600 rounded-full animate-ping" />
                            )}
                          </div>

                          {/* Holidays */}
                          {dayHolidays.map(h => (
                            <div 
                              key={h.id} 
                              className="text-[9px] bg-red-50 dark:bg-red-950/20 border border-red-105 dark:border-red-900/30 text-red-650 dark:text-red-450 font-extrabold px-1.5 py-0.5 rounded flex items-center gap-1 select-none truncate"
                              title={h.name}
                            >
                              <span>🌴</span>
                              <span className="truncate">{h.name}</span>
                            </div>
                          ))}

                          {/* Leaves list */}
                          <div className="flex flex-col gap-1 mt-1 overflow-y-auto max-h-[70px]">
                            {dayRequests.map(req => {
                              const isApproved = req.status === 'approved';
                              const color = req.leaveType?.color || '#6366F1';
                              const empName = req.applicant?.name || 'Employee';
                              const typeCode = req.leaveType?.code || 'LV';
                              return (
                                <div 
                                  key={req.id}
                                  onClick={() => handleOpenReview(req)}
                                  className={`text-[9px] font-bold px-1.5 py-0.5 rounded border-l-2 select-none truncate transition-all shadow-xs cursor-pointer ${
                                    isApproved 
                                      ? 'opacity-100 hover:scale-[1.02]' 
                                      : 'opacity-70 border-dashed border-r border-t border-b hover:opacity-90'
                                  }`}
                                  style={{
                                    borderLeftColor: color,
                                    background: isApproved ? `${color}15` : 'rgba(243,244,246,0.3)',
                                    color: isApproved ? color : '#64748b',
                                    borderColor: isApproved ? 'transparent' : '#cbd5e1',
                                  }}
                                  title={`${empName} - ${req.leaveType?.name} (${req.status.toUpperCase()})`}
                                >
                                  <span className="truncate">{empName} ({typeCode}) {!isApproved && '⏳'}</span>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            )}

            {/* ══════════ TAB 3 — Employee Balances ══════════ */}
            {tab === 3 && (
              <div className="card !p-0 dark:bg-[#151518]/90 dark:border-zinc-800/80 overflow-hidden">
                <div className="flex flex-col">
                  {(() => {
                    const grouped = filteredBalances.reduce((acc, bal) => {
                      const uid = bal.user_id;
                      if (!acc[uid]) {
                        acc[uid] = {
                          user: bal.user,
                          balances: []
                        };
                      }
                      acc[uid].balances.push(bal);
                      return acc;
                    }, {});
                    const groupedArray = Object.values(grouped);

                    if (groupedArray.length === 0) {
                      return (
                        <div className="text-center py-12 text-slate-455 dark:text-zinc-500 font-semibold uppercase tracking-wider">
                          No balance records found.
                        </div>
                      );
                    }

                    return groupedArray.map(group => {
                      const userId = group.user?.id || group.balances[0]?.user_id;
                      const isExpanded = expandedUser === userId;
                      const totalUsed = group.balances.reduce((sum, b) => sum + (b.used_days || 0), 0);
                      const totalPending = group.balances.reduce((sum, b) => sum + (b.pending_days || 0), 0);

                      return (
                        <div 
                          key={userId} 
                          className="border-b border-slate-100 dark:border-zinc-850 last:border-0 hover:bg-slate-50/20 dark:hover:bg-zinc-900/5 transition-all duration-200"
                        >
                          {/* Employee Header */}
                          <div 
                            onClick={() => setExpandedUser(isExpanded ? null : userId)}
                            className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 cursor-pointer select-none"
                          >
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-650 dark:bg-indigo-950/20 dark:text-indigo-400 font-extrabold flex items-center justify-center text-sm shadow-sm">
                                {group.user?.profile_image_url ? (
                                  <img src={group.user.profile_image_url} alt="" className="w-10 h-10 rounded-xl object-cover" />
                                ) : (
                                  (group.user?.name || 'U').substring(0, 2).toUpperCase()
                                )}
                              </div>
                              <div>
                                <p className="font-extrabold text-slate-850 dark:text-zinc-200 text-xs sm:text-sm">{group.user?.name || 'Unknown Employee'}</p>
                                <span className="text-[10px] text-slate-400 dark:text-zinc-550 font-bold uppercase tracking-wider">{group.user?.department || 'General'}</span>
                              </div>
                            </div>

                            <div className="flex items-center gap-6">
                              <div className="flex gap-4 text-right hidden sm:flex">
                                <div>
                                  <p className="text-[10px] text-slate-400 dark:text-zinc-500 font-bold uppercase tracking-wider">Leave Types</p>
                                  <p className="text-xs font-bold text-slate-700 dark:text-zinc-300">{group.balances.length}</p>
                                </div>
                                <div className="border-r border-slate-100 dark:border-zinc-800"></div>
                                <div>
                                  <p className="text-[10px] text-slate-400 dark:text-zinc-500 font-bold uppercase tracking-wider">Total Used</p>
                                  <p className="text-xs font-bold text-slate-700 dark:text-zinc-300">{totalUsed} days</p>
                                </div>
                                {totalPending > 0 && (
                                  <>
                                    <div className="border-r border-slate-100 dark:border-zinc-800"></div>
                                    <div>
                                      <p className="text-[10px] text-amber-500 font-bold uppercase tracking-wider">Pending</p>
                                      <p className="text-xs font-bold text-amber-600 dark:text-amber-400">{totalPending} days</p>
                                    </div>
                                  </>
                                )}
                              </div>

                              <div className="flex items-center justify-center p-1.5 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg text-slate-400 dark:text-zinc-500 transition-all border border-transparent shadow-sm">
                                <LuChevronDown 
                                  size={18} 
                                  className={`transform transition-transform duration-200 ${isExpanded ? 'rotate-180 text-indigo-650 dark:text-indigo-400' : ''}`}
                                />
                              </div>
                            </div>
                          </div>

                          {/* Nested Leave Balances list */}
                          {isExpanded && (
                            <div className="px-4 pb-4 pt-1 bg-slate-50/40 dark:bg-zinc-900/20 border-t border-slate-100 dark:border-zinc-850/50 animate-in slide-in-from-top-1 duration-200">
                              <div className="overflow-x-auto rounded-xl border border-slate-200/40 dark:border-zinc-800/80 shadow-sm">
                                <table className="premium-table min-w-full">
                                  <thead className="bg-slate-50 dark:bg-zinc-900/60">
                                    <tr>
                                      <th className="dark:text-zinc-500 py-2.5">Leave Type</th>
                                      <th className="dark:text-zinc-500 py-2.5">Year</th>
                                      <th className="dark:text-zinc-500 py-2.5">Total Allowance</th>
                                      <th className="dark:text-zinc-500 py-2.5">Used</th>
                                      <th className="dark:text-zinc-500 py-2.5">Pending</th>
                                      <th className="dark:text-zinc-500 py-2.5">Available</th>
                                      <th className="text-right dark:text-zinc-500 py-2.5">Action</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {group.balances.map(bal => {
                                      const isUnlimited = bal.total_days === 0;
                                      const available = isUnlimited ? '∞' : Math.max(bal.total_days - bal.used_days - bal.pending_days, 0);
                                      return (
                                        <tr key={bal.id} className="dark:border-zinc-800/50 hover:dark:bg-zinc-900/10">
                                          <td className="px-4 py-2.5">
                                            <LeaveTypeBadge leaveType={bal.leaveType} />
                                          </td>
                                          <td className="px-4 py-2.5 font-semibold text-slate-600 dark:text-zinc-400 text-xs">
                                            {bal.year}
                                          </td>
                                          <td className="px-4 py-2.5 font-extrabold text-slate-700 dark:text-zinc-200 text-xs">
                                            {isUnlimited ? 'Unlimited' : `${bal.total_days} days`}
                                          </td>
                                          <td className="px-4 py-2.5 font-semibold text-slate-600 dark:text-zinc-400 text-xs">
                                            {bal.used_days} days
                                          </td>
                                          <td className="px-4 py-2.5 text-amber-500 font-semibold text-xs">
                                            {bal.pending_days} days
                                          </td>
                                          <td className="px-4 py-2.5 font-extrabold text-indigo-650 dark:text-indigo-400 text-xs">
                                            {available} {typeof available === 'number' && 'days'}
                                          </td>
                                          <td className="px-4 py-2.5 text-right">
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                setEditingBalance(bal);
                                                setEditTotalDays(bal.total_days.toString());
                                              }}
                                              className="p-1 rounded hover:bg-slate-200 dark:hover:bg-zinc-800 text-indigo-600 dark:text-indigo-400 cursor-pointer transition-all"
                                              title="Adjust balance"
                                            >
                                              <LuPencil size={13} />
                                            </button>
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            )}

            {/* ══════════ TAB 4 — Holidays & settings ══════════ */}
            {tab === 4 && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                
                {/* 3.1 Leave Type Configuration Settings */}
                <div className="space-y-4">
                  <h3 className="text-xs font-extrabold text-slate-400 dark:text-zinc-550 uppercase tracking-widest flex items-center gap-1">
                    <LuSettings size={14} /> Leave Policy Config
                  </h3>
                  <div className="card space-y-4 dark:bg-[#151518]/90 dark:border-zinc-800/80">
                    <p className="text-xs text-slate-400 dark:text-zinc-500 leading-relaxed font-bold">
                      Set maximum annual limits and attachment requirements per leave type category.
                    </p>
                    <div className="divide-y divide-slate-100 dark:divide-zinc-850">
                      {leaveTypes.map(type => (
                        <div key={type.id} className="py-3 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-3 h-3 rounded-full" style={{ backgroundColor: type.color }} />
                            <div>
                              <p className="text-xs font-bold text-slate-700 dark:text-zinc-300">{type.name}</p>
                              <span className="text-[9px] font-semibold text-slate-400 dark:text-zinc-550 uppercase">{type.code}</span>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-3">
                            <div className="text-right text-[10px] text-slate-500 dark:text-zinc-450 font-bold uppercase">
                              <p>{type.max_days_per_year === 0 ? 'Unlimited' : `${type.max_days_per_year} Days`}</p>
                              <p className="text-[9px] mt-0.5 text-slate-400 font-normal">
                                {type.requires_document ? 'Doc Required' : 'No Doc Required'}
                              </p>
                            </div>
                            <button
                              onClick={() => {
                                setEditingType(type);
                                setTypeMaxDays(type.max_days_per_year.toString());
                                setTypeRequiresDoc(type.requires_document);
                              }}
                              className="p-1.5 border border-slate-205 dark:border-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-850 rounded-lg text-slate-500 dark:text-zinc-400 cursor-pointer"
                            >
                              <LuPencil size={12} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* 3.2 Public Holidays Settings */}
                <div className="space-y-4">
                  <h3 className="text-xs font-extrabold text-slate-400 dark:text-zinc-550 uppercase tracking-widest flex items-center gap-1">
                    <LuCalendar size={14} /> Workspace Holidays
                  </h3>
                  
                  {/* Add holiday form */}
                  <div className="card dark:bg-[#151518]/90 dark:border-zinc-800/80">
                    <form onSubmit={handleAddHoliday} className="space-y-3">
                      <p className="text-xs font-bold text-slate-400 dark:text-zinc-550 uppercase tracking-wider">Add Public Holiday</p>
                      <div className="grid grid-cols-2 gap-3">
                        <input
                          type="text"
                          placeholder="Holiday Name (e.g. Christmas)"
                          value={newHolidayName}
                          onChange={e => setNewHolidayName(e.target.value)}
                          className="field-input text-xs dark:bg-[#121215] dark:border-zinc-800 dark:text-zinc-200"
                          required
                        />
                        <input
                          type="date"
                          value={newHolidayDate}
                          onChange={e => setNewHolidayDate(e.target.value)}
                          className="field-input text-xs dark:bg-[#121215] dark:border-zinc-800 dark:text-zinc-200"
                          required
                        />
                      </div>
                      <button
                        type="submit"
                        disabled={submittingHoliday}
                        className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition cursor-pointer shadow-sm disabled:opacity-40"
                      >
                        <LuPlus size={14} /> Add Holiday
                      </button>
                    </form>
                  </div>

                  {/* Holiday List */}
                  <div className="card !p-0 overflow-hidden dark:bg-[#151518]/90 dark:border-zinc-800/80">
                    <table className="premium-table min-w-full">
                      <thead>
                        <tr>
                          <th className="dark:text-zinc-500">Holiday</th>
                          <th className="dark:text-zinc-500">Date</th>
                          <th className="text-right dark:text-zinc-500">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {holidays.length === 0 ? (
                          <tr>
                            <td colSpan={3} className="text-center py-6 text-slate-400 dark:text-zinc-500 text-xs font-bold uppercase">
                              No holidays defined yet.
                            </td>
                          </tr>
                        ) : (
                          holidays.map(h => (
                            <tr key={h.id} className="dark:border-zinc-800/80">
                              <td className="px-4 py-2 font-bold text-slate-700 dark:text-zinc-300 text-xs">
                                🇮🇳 {h.name}
                              </td>
                              <td className="px-4 py-2 text-[10px] text-slate-500 dark:text-zinc-400 font-bold uppercase tracking-wider">
                                {new Date(h.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                              </td>
                              <td className="px-4 py-2 text-right">
                                <button
                                  onClick={() => handleDeleteHoliday(h.id)}
                                  className="p-1 rounded text-red-500 hover:bg-red-50 dark:hover:bg-rose-955/15 cursor-pointer transition"
                                  title="Delete Holiday"
                                >
                                  <LuTrash2 size={13} />
                                </button>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                </div>
              </div>
            )}
          </>
        )}

        {/* Review Modal */}
        <ReviewLeaveModal
          open={showReviewModal}
          request={selectedRequest}
          reviewerId={user?.id}
          onClose={() => {
            setShowReviewModal(false);
            setSelectedRequest(null);
          }}
          onSuccess={loadData}
        />

        {/* Inline Balance Adjustment Modal */}
        {editingBalance && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs font-sans">
            <form onSubmit={handleSaveBalance} className="card w-full max-w-sm bg-white dark:bg-[#151518] dark:border-zinc-800 shadow-xl rounded-xl animate-in fade-in zoom-in-95 duration-200">
              <div className="p-5 border-b border-slate-100 dark:border-zinc-850 flex justify-between items-center">
                <h4 className="text-xs font-extrabold text-slate-800 dark:text-zinc-200 uppercase tracking-wider">Adjust Allowance</h4>
                <button type="button" onClick={() => setEditingBalance(null)} className="text-slate-450 hover:text-slate-700 dark:hover:text-zinc-300">
                  <LuX size={16} />
                </button>
              </div>
              <div className="p-5 space-y-3">
                <div className="text-xs">
                  <p className="font-bold text-slate-700 dark:text-zinc-300">Employee: <span className="font-extrabold text-indigo-600 dark:text-indigo-400">{editingBalance.user?.name}</span></p>
                  <p className="font-bold text-slate-700 dark:text-zinc-300 mt-1">Leave Type: <span className="font-semibold">{editingBalance.leaveType?.name}</span></p>
                </div>
                <div>
                  <label className="block text-[10px] font-extrabold text-slate-400 dark:text-zinc-550 uppercase tracking-wider mb-1.5">Total Yearly Days</label>
                  <input
                    type="number"
                    step="0.5"
                    value={editTotalDays}
                    onChange={e => setEditTotalDays(e.target.value)}
                    className="field-input text-xs dark:bg-[#121215] dark:border-zinc-800 dark:text-zinc-200"
                    required
                  />
                  <p className="text-[9px] text-slate-400 dark:text-zinc-500 font-bold uppercase mt-1">
                    * Set to 0 to make this category unlimited for the user.
                  </p>
                </div>
              </div>
              <div className="p-5 bg-slate-50 dark:bg-zinc-900/10 border-t border-slate-100 dark:border-zinc-850 flex gap-2">
                <button type="button" onClick={() => setEditingBalance(null)} className="flex-1 py-2 border border-slate-205 dark:border-zinc-800 hover:bg-slate-50 text-xs font-bold rounded-lg text-slate-700 dark:text-zinc-300">Cancel</button>
                <button type="submit" className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow-sm">Save Changes</button>
              </div>
            </form>
          </div>
        )}

        {/* Edit Leave Type Settings Modal */}
        {editingType && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs font-sans">
            <form onSubmit={handleSaveLeaveType} className="card w-full max-w-sm bg-white dark:bg-[#151518] dark:border-zinc-800 shadow-xl rounded-xl animate-in fade-in zoom-in-95 duration-200">
              <div className="p-5 border-b border-slate-100 dark:border-zinc-850 flex justify-between items-center">
                <h4 className="text-xs font-extrabold text-slate-800 dark:text-zinc-200 uppercase tracking-wider">Edit Leave Type Policy</h4>
                <button type="button" onClick={() => setEditingType(null)} className="text-slate-450 hover:text-slate-700 dark:hover:text-zinc-300">
                  <LuX size={16} />
                </button>
              </div>
              <div className="p-5 space-y-4">
                <div>
                  <h5 className="text-xs font-extrabold text-indigo-600 dark:text-indigo-400">{editingType.name} ({editingType.code})</h5>
                  <p className="text-[10px] text-slate-400 dark:text-zinc-550 font-bold uppercase mt-0.5">Define global limits for this leave type</p>
                </div>
                <div>
                  <label className="block text-[10px] font-extrabold text-slate-400 dark:text-zinc-550 uppercase tracking-wider mb-1.5">Max Days Per Year</label>
                  <input
                    type="number"
                    value={typeMaxDays}
                    onChange={e => setTypeMaxDays(e.target.value)}
                    className="field-input text-xs dark:bg-[#121215] dark:border-zinc-800 dark:text-zinc-200"
                    required
                  />
                  <p className="text-[9px] text-slate-400 dark:text-zinc-500 font-bold uppercase mt-1">
                    * Set to 0 for unlimited.
                  </p>
                </div>
                <div className="flex items-center gap-2 py-1">
                  <input
                    type="checkbox"
                    id="typeRequiresDoc"
                    checked={typeRequiresDoc}
                    onChange={e => setTypeRequiresDoc(e.target.checked)}
                    className="w-4 h-4 text-indigo-600 border-slate-300 rounded focus:ring-indigo-500 cursor-pointer"
                  />
                  <label htmlFor="typeRequiresDoc" className="text-xs font-bold text-slate-650 dark:text-zinc-350 cursor-pointer select-none">
                    Requires Supporting Document upload
                  </label>
                </div>
              </div>
              <div className="p-5 bg-slate-50 dark:bg-zinc-900/10 border-t border-slate-100 dark:border-zinc-850 flex gap-2">
                <button type="button" onClick={() => setEditingType(null)} className="flex-1 py-2 border border-slate-205 dark:border-zinc-800 hover:bg-slate-50 text-xs font-bold rounded-lg text-slate-700 dark:text-zinc-300">Cancel</button>
                <button type="submit" disabled={savingType} className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-lg shadow-sm flex items-center justify-center gap-1">
                  {savingType && <LuLoader size={12} className="animate-spin" />}
                  Save Policy
                </button>
              </div>
            </form>
          </div>
        )}

      </div>
    </DashboardLayout>
  );
};

export default LeaveManagement;
