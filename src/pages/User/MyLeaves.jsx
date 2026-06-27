import React, { useState, useEffect, useContext } from 'react';
import moment from 'moment';
import DashboardLayout from '../../components/layouts/DashboardLayout';
import { WorkspaceContext } from '../../context/WorkspaceContext';
import { UserContext } from '../../context/userContext';
import { getMyLeaveBalances, getMyLeaveRequests, withdrawLeaveRequest, getLeaveHolidays } from '../../services/leaveService';
import LeaveBalanceCard from '../../components/Leave/LeaveBalanceCard';
import LeaveStatusBadge from '../../components/Leave/LeaveStatusBadge';
import LeaveTypeBadge from '../../components/Leave/LeaveTypeBadge';
import ApplyLeaveModal from '../../components/Leave/ApplyLeaveModal';
import RefreshButton from '../../components/RefreshButton';
import toast from 'react-hot-toast';
import { LuPlus, LuCalendarDays, LuInfo, LuLoader, LuTrash2, LuChevronLeft, LuChevronRight } from 'react-icons/lu';

const MyLeaves = () => {
  const { workspace } = useContext(WorkspaceContext);
  const { user } = useContext(UserContext);

  const [balances, setBalances] = useState([]);
  const [requests, setRequests] = useState([]);
  const [holidays, setHolidays] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [activeTab, setActiveTab] = useState('list'); // 'list' | 'calendar'
  const [calendarDate, setCalendarDate] = useState(moment());

  const loadData = async () => {
    if (!workspace?.id || !user?.id) return;
    setLoading(true);
    try {
      const [myBalances, myRequests, myHolidays] = await Promise.all([
        getMyLeaveBalances(workspace.id, user.id),
        getMyLeaveRequests(workspace.id, user.id),
        getLeaveHolidays(workspace.id)
      ]);
      setBalances(myBalances);
      setRequests(myRequests);
      setHolidays(myHolidays);
    } catch (err) {
      toast.error('Failed to load leave data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [workspace?.id, user?.id]);

  const handleWithdraw = async (requestId) => {
    if (!confirm('Are you sure you want to withdraw this leave request?')) return;

    try {
      await withdrawLeaveRequest(requestId);
      toast.success('Leave request withdrawn successfully');
      loadData();
    } catch (err) {
      toast.error('Failed to withdraw leave request');
      console.error(err);
    }
  };

  return (
    <DashboardLayout activeMenu="My Leaves">
      <div className="mt-5 mb-10 font-sans">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
          <div>
            <h2 className="text-xl md:text-2xl font-extrabold text-slate-905 dark:text-zinc-100 tracking-tight">🌴 My Leave Portal</h2>
            <p className="text-xs text-slate-400 dark:text-zinc-550 mt-1.5 font-bold uppercase tracking-wider">
              {workspace?.name} · Track your balances and requests
            </p>
          </div>
          <div className="flex gap-2">
            <RefreshButton
              id="my-leaves-refresh"
              onRefresh={loadData}
              label="Refresh"
              size="sm"
            />
            <button
              onClick={() => setShowApplyModal(true)}
              className="card-btn-fill flex items-center gap-1.5 text-xs cursor-pointer"
            >
              <LuPlus size={14} /> Apply for Leave
            </button>
          </div>
        </div>

        {loading && balances.length === 0 ? (
          <div className="flex justify-center py-20">
            <LuLoader className="animate-spin text-indigo-500" size={28} />
          </div>
        ) : (
          <div className="space-y-8">
            
            {/* Balance Overview Grid */}
            <div>
              <h3 className="text-xs font-extrabold text-slate-400 dark:text-zinc-550 uppercase tracking-widest mb-4">Leave Entitlements</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {balances.map((balance) => (
                  <LeaveBalanceCard key={balance.leave_type_id} balance={balance} />
                ))}
            </div>

            {/* Tab Switcher */}
            <div className="flex border-b border-slate-200 dark:border-zinc-800 mb-6">
              <button
                onClick={() => setActiveTab('list')}
                className={`px-4 py-2 text-xs font-bold transition-all border-b-2 cursor-pointer ${
                  activeTab === 'list'
                    ? 'border-indigo-650 text-indigo-600 dark:text-indigo-400'
                    : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-zinc-500'
                }`}
              >
                List View
              </button>
              <button
                onClick={() => setActiveTab('calendar')}
                className={`px-4 py-2 text-xs font-bold transition-all border-b-2 cursor-pointer ${
                  activeTab === 'calendar'
                    ? 'border-indigo-655 text-indigo-600 dark:text-indigo-400'
                    : 'border-transparent text-slate-500 hover:text-slate-800 dark:text-zinc-500'
                }`}
              >
                Calendar View
              </button>
            </div>

            {activeTab === 'list' ? (
              /* Leave History & Holidays Grid */
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                {/* Left: Leave History */}
                <div className="lg:col-span-3">
                  <h3 className="text-xs font-extrabold text-slate-400 dark:text-zinc-550 uppercase tracking-widest mb-4">My Leave Applications</h3>
                  <div className="card overflow-x-auto !p-0 dark:bg-[#151518]/90 dark:border-zinc-800/80">
                    <table className="premium-table min-w-full">
                      <thead>
                        <tr>
                          <th className="dark:text-zinc-500">Leave Type</th>
                          <th className="dark:text-zinc-500">Duration</th>
                          <th className="dark:text-zinc-500">Dates</th>
                          <th className="dark:text-zinc-500">Reason</th>
                          <th className="dark:text-zinc-500">Status</th>
                          <th className="dark:text-zinc-500">Reviewed By</th>
                          <th className="text-right dark:text-zinc-500">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {requests.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="text-center py-12 text-slate-455 dark:text-zinc-500 font-semibold uppercase tracking-wider">
                              <LuCalendarDays size={32} className="mx-auto mb-2 opacity-30 text-indigo-500" />
                              No leave applications found.
                            </td>
                          </tr>
                        ) : (
                          requests.map((req) => (
                            <tr key={req.id} className="dark:border-zinc-800/80 hover:dark:bg-zinc-900/10">
                              {/* Leave Type */}
                              <td className="px-4 py-3">
                                <LeaveTypeBadge leaveType={req.leaveType} />
                              </td>
                              {/* Duration */}
                              <td className="px-4 py-3 font-bold text-slate-800 dark:text-zinc-200 text-xs">
                                {req.total_days} Day{req.total_days !== 1 ? 's' : ''}
                                {req.is_half_day && (
                                  <span className="block text-[9px] text-slate-450 dark:text-zinc-500 font-bold uppercase mt-0.5">
                                    Half-day ({req.half_day_session})
                                  </span>
                                )}
                              </td>
                              {/* Dates */}
                              <td className="px-4 py-3 text-[10px] text-slate-500 dark:text-zinc-400 font-bold uppercase tracking-wider">
                                {new Date(req.start_date).toLocaleDateString()} - {new Date(req.end_date).toLocaleDateString()}
                              </td>
                              {/* Reason */}
                              <td className="px-4 py-3 text-xs max-w-[200px] truncate text-slate-600 dark:text-zinc-400 font-medium" title={req.reason}>
                                {req.reason || <span className="text-slate-300 dark:text-zinc-700">—</span>}
                              </td>
                              {/* Status */}
                              <td className="px-4 py-3">
                                <LeaveStatusBadge status={req.status} />
                              </td>
                              {/* Reviewed By */}
                              <td className="px-4 py-3 text-xs font-bold text-slate-500 dark:text-zinc-450 uppercase">
                                {req.reviewer?.name ? (
                                  <span className="flex flex-col">
                                    <span>{req.reviewer.name}</span>
                                    {req.review_comment && (
                                      <span className="text-[9px] font-normal text-slate-400 dark:text-zinc-550 mt-0.5 lowercase italic" title={req.review_comment}>
                                        "{req.review_comment.substring(0, 30)}..."
                                      </span>
                                    )}
                                  </span>
                                ) : (
                                  <span className="text-slate-300 dark:text-zinc-700 font-normal">—</span>
                                )}
                              </td>
                              {/* Actions */}
                              <td className="px-4 py-3 text-right">
                                {req.status === 'pending' ? (
                                  <button
                                    onClick={() => handleWithdraw(req.id)}
                                    title="Withdraw application"
                                    className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-955/15 transition cursor-pointer"
                                  >
                                    <LuTrash2 size={15} />
                                  </button>
                                ) : (
                                  <span className="text-[10px] text-slate-350 dark:text-zinc-700 font-bold uppercase tracking-wider">Locked</span>
                                )}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Right: Public Holidays List */}
                <div className="lg:col-span-1">
                  <h3 className="text-xs font-extrabold text-slate-400 dark:text-zinc-550 uppercase tracking-widest mb-4">Public Holidays</h3>
                  <div className="card dark:bg-[#151518]/90 dark:border-zinc-800/80">
                    {holidays.length === 0 ? (
                      <div className="text-center py-6 text-slate-400 dark:text-zinc-500 italic">
                        <LuCalendarDays className="mx-auto mb-1.5 opacity-30 text-indigo-500" size={24} />
                        No public holidays listed.
                      </div>
                    ) : (
                      <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
                        {holidays.map((hol) => (
                          <div key={hol.id} className="p-2.5 rounded-xl bg-slate-50/50 dark:bg-zinc-900/40 border border-slate-100 dark:border-zinc-850 flex items-center justify-between gap-2 hover:border-indigo-500/30 dark:hover:border-indigo-500/20 transition-all duration-200">
                            <div>
                              <p className="text-xs font-bold text-slate-800 dark:text-zinc-200">{hol.name}</p>
                              <p className="text-[10px] text-slate-400 dark:text-zinc-500 font-bold uppercase mt-0.5 tracking-wider">
                                {new Date(hol.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                              </p>
                            </div>
                            {hol.is_optional ? (
                              <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-amber-50 text-amber-600 dark:bg-amber-950/20 dark:text-amber-400 border border-amber-100 dark:border-amber-900/30">
                                Optional
                              </span>
                            ) : (
                              <span className="text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-600 dark:bg-indigo-950/20 dark:text-indigo-400 border border-indigo-100 dark:border-indigo-900/30">
                                Public
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              /* Calendar View */
              <div className="card dark:bg-[#151518]/90 dark:border-zinc-800/80 p-5 flex flex-col gap-4">
                {/* Calendar Navigation */}
                <div className="flex items-center justify-between bg-slate-50/80 dark:bg-zinc-900/60 p-3 rounded-2xl border border-slate-150/40 dark:border-zinc-800/60">
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => setCalendarDate(moment(calendarDate).subtract(1, 'month'))}
                      className="p-1.5 hover:bg-white dark:hover:bg-zinc-800 rounded-lg text-slate-500 dark:text-zinc-400 transition-all border border-transparent hover:border-slate-200/50 shadow-sm"
                    >
                      <LuChevronLeft size={16} />
                    </button>
                    <span className="text-xs font-black text-slate-700 dark:text-zinc-200 uppercase tracking-wider min-w-[120px] text-center">
                      {calendarDate.format('MMMM YYYY')}
                    </span>
                    <button 
                      onClick={() => setCalendarDate(moment(calendarDate).add(1, 'month'))}
                      className="p-1.5 hover:bg-white dark:hover:bg-zinc-800 rounded-lg text-slate-500 dark:text-zinc-400 transition-all border border-transparent hover:border-slate-200/50 shadow-sm"
                    >
                      <LuChevronRight size={16} />
                    </button>
                  </div>
                  <button 
                    onClick={() => setCalendarDate(moment())}
                    className="px-3.5 py-1.5 text-xs font-bold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 dark:text-indigo-400 dark:bg-indigo-950/20 dark:hover:bg-indigo-900/30 rounded-xl transition-all shadow-sm"
                  >
                    Today
                  </button>
                </div>

                {/* Calendar Grid */}
                <div className="grid grid-cols-7 gap-[1px] bg-slate-200/40 dark:bg-zinc-800/40 rounded-2xl overflow-hidden border border-slate-200/40 dark:border-zinc-800/60 shadow-sm">
                  {/* Day Headers */}
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

                      // Check leave requests
                      const dayRequests = requests.filter(req => {
                        return dateStr >= req.start_date && dateStr <= req.end_date && ['approved', 'pending'].includes(req.status);
                      });

                      return (
                        <div 
                          key={idx}
                          className={`min-h-[105px] border-b border-r border-slate-100 dark:border-zinc-850/50 p-2 flex flex-col gap-1 transition-all ${
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
                                : 'text-slate-600 dark:text-zinc-400'
                            }`}>
                              {dayItem.date()}
                            </span>

                            {hasHoliday && isCurrentMonth && (
                              <span className="text-[10px]" title={`🌴 Public Holiday: ${dayHolidays[0].name}`}>🌴</span>
                            )}
                          </div>

                          {/* List of events inside cell */}
                          <div className="flex-1 flex flex-col gap-1 overflow-y-auto custom-scrollbar pt-1">
                            {/* Leaves */}
                            {dayRequests.map(req => {
                              const isApproved = req.status === 'approved';
                              const color = req.leaveType?.color || '#6366F1';
                              return (
                                <div 
                                  key={req.id}
                                  className={`text-[9px] font-bold px-1.5 py-0.5 rounded border-l-2 select-none truncate transition-all shadow-sm ${
                                    isApproved 
                                      ? 'opacity-100' 
                                      : 'opacity-70 border-dashed border-r border-t border-b'
                                  }`}
                                  style={{
                                    borderLeftColor: color,
                                    background: isApproved ? `${color}15` : 'rgba(243,244,246,0.3)',
                                    color: isApproved ? color : '#64748b',
                                    borderColor: isApproved ? 'transparent' : '#cbd5e1',
                                  }}
                                  title={`${req.leaveType?.name} (${req.status.toUpperCase()})`}
                                >
                                  <span className="truncate">{req.leaveType?.name} {!isApproved && '⏳'}</span>
                                </div>
                              );
                            })}

                            {/* Holidays */}
                            {dayHolidays.map(hol => (
                              <div 
                                key={hol.id}
                                className="text-[9px] font-bold px-1.5 py-0.5 rounded border-l-2 bg-red-50 dark:bg-red-950/20 border-red-500 text-red-750 dark:text-red-400 select-none truncate shadow-sm"
                                title={`Public Holiday: ${hol.name}`}
                              >
                                <span className="truncate">🌴 {hol.name}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
            )}

            {/* Informational Banner */}
            <div className="p-4 bg-indigo-50/50 dark:bg-indigo-950/15 border border-indigo-150/30 dark:border-indigo-900/30 rounded-xl flex items-start gap-3">
              <LuInfo size={18} className="text-indigo-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-wider text-indigo-700 dark:text-indigo-400">Leave Policies Info</p>
                <p className="text-xs text-indigo-650 dark:text-indigo-305 mt-1 font-semibold leading-relaxed">
                  All leave requests are routed to your workspace manager or administrator for review.
                  Once approved, your balance will be adjusted automatically. You can cancel or withdraw any 
                  application while its status is still <strong>Pending</strong>.
                </p>
              </div>
            </div>  </div>

          </div>
        )}

        {/* Apply Leave Modal */}
        <ApplyLeaveModal 
          open={showApplyModal}
          onClose={() => setShowApplyModal(false)}
          onSuccess={loadData}
        />
      </div>
    </DashboardLayout>
  );
};

export default MyLeaves;
