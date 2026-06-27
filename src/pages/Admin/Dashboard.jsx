import React, { useContext, useEffect, useState } from 'react';
import { useUserAuth } from '../../hooks/useUserAuth';
import { UserContext } from '../../context/userContext';
import { WorkspaceContext } from '../../context/WorkspaceContext';
import DashboardLayout from '../../components/layouts/DashboardLayout';
import { useNavigate } from 'react-router-dom';
import moment from 'moment';
import InfoCard from '../../components/Cards/InfoCard';
import { addThousandsSeparator } from '../../utils/helper';
import toast from 'react-hot-toast';
import RefreshButton from '../../components/RefreshButton';
import UpcomingEventsWidget from '../../components/Calendar/UpcomingEventsWidget';
import { getGoals } from '../../services/goalService';
import { LuArrowRight, LuClipboardList, LuHourglass, LuPlay, LuCircleCheck, LuSparkles, LuTarget } from 'react-icons/lu';
import TaskListTable from '../../components/TaskListTable';
import CustomPieChart from '../../components/Charts/CustomPieChart';
import CustomBarChart from '../../components/Charts/CustomBarChart';
import { getAdminDashboardData } from '../../services/taskService';
import useRealtimeTasks from '../../hooks/useRealtimeTasks';
import usePermissions from '../../hooks/usePermissions';
import { JOB_PROFILES } from '../Admin/InviteEmployee';

const COLORS = ['#8D51FF', '#00B8DB', '#7BCE00'];

const Dashboard = () => {
  useUserAuth();

  const { user } = useContext(UserContext);
  const { workspace } = useContext(WorkspaceContext);
  const navigate = useNavigate();
  const perms  = usePermissions();
  const JP_MAP = Object.fromEntries(JOB_PROFILES.map(j => [j.value, j]));
  const myJP   = JP_MAP[user?.job_profile] || JP_MAP[user?.role] || JP_MAP.employee;

  const [dashboardData, setDashboardData] = useState(null);
  const [pieChartData, setPieChartData] = useState([]);
  const [barChartData, setBarChartData] = useState([]);
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);

  const prepareChartData = (data) => {
    const dist = data?.charts?.taskDistribution || {};
    const priority = data?.charts?.taskPriorityLevels || {};

    setPieChartData([
      { status: 'Pending', count: dist.Pending || 0 },
      { status: 'In Progress', count: dist.InProgress || 0 },
      { status: 'Completed', count: dist.Completed || 0 },
    ]);

    setBarChartData([
      { priority: 'low', count: priority.low || 0 },
      { priority: 'medium', count: priority.medium || 0 },
      { priority: 'high', count: priority.high || 0 },
    ]);
  };

  const loadDashboard = async (silent = false) => {
    if (!workspace?.id) return;
    try {
      if (!silent) setLoading(true);
      const data = await getAdminDashboardData(workspace.id);
      setDashboardData(data);
      prepareChartData(data);

      try {
        const goalsData = await getGoals(workspace.id);
        setGoals(goalsData || []);
      } catch (goalsErr) {
        console.error('Failed to load goals in dashboard:', goalsErr);
      }
    } catch (err) {
      console.error('Dashboard load error:', err);
      if (!silent) toast.error('Failed to load dashboard data');
    } finally {
      if (!silent) setLoading(false);
    }
  };

  // Silently refresh when any task changes in this workspace
  useRealtimeTasks(workspace?.id, {
    onTaskChange: () => loadDashboard(true),
  });

  useEffect(() => {
    loadDashboard();
  }, [workspace?.id]);

  return (
    <DashboardLayout activeMenu="Dashboard">
      <div className="card mt-4 animate-fade-in">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-zinc-100 tracking-tight">
                Good Morning, {user?.name}!
              </h2>
              <LuSparkles className="text-indigo-500 animate-pulse" size={18} />
            </div>
            <p className="text-[10px] text-slate-400 dark:text-zinc-500 mt-1.5 font-bold uppercase tracking-widest">
              {moment().format('dddd, Do MMMM YYYY')}
            </p>
          </div>
          {/* Refresh button */}
          <div className="flex items-center gap-3 self-start md:self-center">
            <RefreshButton
              id="dashboard-refresh"
              onRefresh={() => loadDashboard(false)}
              label="Refresh"
              size="sm"
            />
          </div>
        </div>

        {/* Role & quick-access permission chips */}
        <div className="flex flex-wrap gap-2 mt-4 pt-4 border-t border-slate-100 dark:border-zinc-800">
          {myJP && (
            <span className="inline-flex items-center gap-1.5 text-[10px] font-bold px-3 py-1 rounded-full text-white shadow-sm uppercase tracking-wider"
              style={{ background: myJP.color }}>
              {myJP.emoji} {myJP.label}
            </span>
          )}
          {perms.canCreateTask && (
            <span className="text-[10px] px-3 py-1 rounded-full bg-indigo-50/50 text-indigo-750 border border-indigo-100/50 dark:bg-indigo-950/20 dark:text-indigo-400 dark:border-indigo-900/30 font-bold uppercase tracking-wider shadow-sm">✏ Create Tasks</span>
          )}
          {perms.canInviteEmployee && (
            <span className="text-[10px] px-3 py-1 rounded-full bg-purple-50/50 text-purple-750 border border-purple-100/50 dark:bg-purple-950/20 dark:text-purple-400 dark:border-purple-900/30 font-bold uppercase tracking-wider shadow-sm">📧 Invite Members</span>
          )}
          {perms.canViewReports && (
            <span className="text-[10px] px-3 py-1 rounded-full bg-emerald-50/50 text-emerald-750 border border-emerald-100/50 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/30 font-bold uppercase tracking-wider shadow-sm">📊 Reports</span>
          )}
          {perms.canViewAuditLog && (
            <span className="text-[10px] px-3 py-1 rounded-full bg-amber-50/50 text-amber-750 border border-amber-100/50 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/30 font-bold uppercase tracking-wider shadow-sm">🔍 Audit Log</span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 mb-6">
        <InfoCard
          label="Total Tasks"
          value={addThousandsSeparator(dashboardData?.charts?.taskDistribution?.All || 0)}
          color="bg-indigo-600"
          icon={LuClipboardList}
        />
        <InfoCard
          label="Pending Tasks"
          value={addThousandsSeparator(dashboardData?.charts?.taskDistribution?.Pending || 0)}
          color="bg-amber-500"
          icon={LuHourglass}
        />
        <InfoCard
          label="In Progress"
          value={addThousandsSeparator(dashboardData?.charts?.taskDistribution?.InProgress || 0)}
          color="bg-cyan-500"
          icon={LuPlay}
        />
        <InfoCard
          label="Completed"
          value={addThousandsSeparator(dashboardData?.charts?.taskDistribution?.Completed || 0)}
          color="bg-emerald-500"
          icon={LuCircleCheck}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 my-4 md:my-6 animate-fade-in" style={{ animationDelay: '0.1s' }}>
        <div>
          <div className="card">
            <h5 className="text-[10px] font-extrabold text-slate-400 dark:text-zinc-500 uppercase tracking-widest mb-4">Task Distribution</h5>
            <CustomPieChart data={pieChartData} colors={COLORS} />
          </div>
        </div>

        <div>
          <div className="card">
            <h5 className="text-[10px] font-extrabold text-slate-400 dark:text-zinc-500 uppercase tracking-widest mb-4">Task Priority Levels</h5>
            <CustomBarChart data={barChartData} />
          </div>
        </div>

        <div>
          <div className="card h-full flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between mb-4">
                <h5 className="text-[10px] font-extrabold text-slate-400 dark:text-zinc-500 uppercase tracking-widest flex items-center gap-1.5">
                  <LuTarget size={14} className="text-indigo-500" /> Strategic Goals
                </h5>
                <button
                  className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer transition-colors"
                  onClick={() => navigate('/admin/goals')}
                >
                  See All <LuArrowRight size={14} />
                </button>
              </div>

              {goals.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <LuTarget size={30} className="text-slate-350 dark:text-zinc-700 mb-2" />
                  <p className="text-xs text-slate-450 dark:text-zinc-500 font-semibold">No active goals</p>
                  <p className="text-[10px] text-slate-400 dark:text-zinc-500 mt-0.5">Align tasks to track outcomes.</p>
                </div>
              ) : (
                <div className="space-y-3.5">
                  {goals.slice(0, 3).map((goal) => {
                    const health = goal.progress < 30 ? 'text-rose-700 bg-rose-50 border-rose-100/30 dark:bg-rose-950/20 dark:text-rose-450 dark:border-rose-900/30' :
                                   goal.progress < 75 ? 'text-amber-700 bg-amber-50 border-amber-100/30 dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/30' :
                                   'text-indigo-705 bg-indigo-50 border-indigo-100/30 dark:bg-indigo-950/20 dark:text-indigo-400 dark:border-indigo-900/30';
                    return (
                      <div
                        key={goal.id}
                        onClick={() => navigate(`/admin/goals/${goal.id}`)}
                        className="cursor-pointer group"
                      >
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-xs font-semibold text-slate-700 dark:text-zinc-200 group-hover:text-indigo-605 transition-colors truncate max-w-[150px]">
                            {goal.title}
                          </span>
                          <span className={`text-[9px] font-extrabold px-1.5 py-0.5 border rounded-full uppercase tracking-wider ${health}`}>
                            {goal.progress}%
                          </span>
                        </div>
                        <div className="w-full bg-slate-100 dark:bg-zinc-800 rounded-full h-1.5 overflow-hidden">
                          <div
                            className="bg-indigo-500 dark:bg-indigo-400 h-full rounded-full transition-all duration-300"
                            style={{ width: `${goal.progress}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            
            {goals.length > 0 && (
              <div className="mt-4 pt-3.5 border-t border-slate-100 dark:border-zinc-800 flex items-center justify-between text-[9px] text-slate-400 dark:text-zinc-500 font-bold uppercase tracking-widest">
                <span>Total: {goals.length} Goals</span>
                <span>Avg: {Math.round(goals.reduce((acc, curr) => acc + (curr.progress || 0), 0) / goals.length)}%</span>
              </div>
            )}
          </div>
        </div>

        <div className="md:col-span-3 grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="card lg:col-span-2">
            <div className="flex items-center justify-between mb-4">
              <h5 className="text-[10px] font-extrabold text-slate-400 dark:text-zinc-500 uppercase tracking-widest">Recent Tasks</h5>
              <button className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer transition-colors" onClick={() => navigate('/admin/tasks')}>
                See All <LuArrowRight size={14} />
              </button>
            </div>
            <TaskListTable tableData={dashboardData?.recentTasks || []} />
          </div>

          <div className="card flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h5 className="text-[10px] font-extrabold text-slate-400 dark:text-zinc-500 uppercase tracking-widest">📅 Upcoming Events</h5>
              <button className="text-xs font-bold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1 cursor-pointer transition-colors" onClick={() => navigate('/calendar')}>
                Calendar <LuArrowRight size={14} />
              </button>
            </div>
            <UpcomingEventsWidget />
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;