import React, { useContext, useEffect, useState } from 'react';
import { useUserAuth } from '../../hooks/useUserAuth';
import { UserContext } from '../../context/userContext';
import { WorkspaceContext } from '../../context/WorkspaceContext';
import DashboardLayout from '../../components/layouts/DashboardLayout';
import { useNavigate } from 'react-router-dom';
import moment from 'moment';
import InfoCard from '../../components/Cards/InfoCard';
import { addThousandsSeparator } from '../../utils/helper';
import { LuArrowRight, LuClipboardList, LuHourglass, LuPlay, LuCircleCheck } from 'react-icons/lu';
import TaskListTable from '../../components/TaskListTable';
import CustomPieChart from '../../components/Charts/CustomPieChart';
import CustomBarChart from '../../components/Charts/CustomBarChart';
import { getAdminDashboardData } from '../../services/taskService';
import useRealtimeTasks from '../../hooks/useRealtimeTasks';
import usePermissions from '../../hooks/usePermissions';
import { JOB_PROFILES } from '../Admin/InviteEmployee';
import toast from 'react-hot-toast';

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
      <div className="card my-5 bg-white/90 border border-slate-200/50 shadow-sm">
        <div>
          <div className="col-span-3">
            <h2 className="text-xl md:text-2xl font-extrabold text-slate-800 tracking-tight">
              Good Morning! {user?.name}
            </h2>
            <p className="text-xs md:text-[13px] text-slate-400 mt-1.5 font-bold uppercase tracking-wider">
              {moment().format('dddd Do MMMM YYYY')}
            </p>
            {/* Role + quick-access permission chips */}
            <div className="flex flex-wrap gap-2 mt-4">
              {myJP && (
                <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3.5 py-1 rounded-full text-white shadow-sm"
                  style={{ background: myJP.color }}>
                  {myJP.emoji} {myJP.label}
                </span>
              )}
              {perms.canCreateTask && (
                <span className="text-xs px-3 py-1 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-100 font-semibold shadow-sm shadow-indigo-500/5">✏ Create Tasks</span>
              )}
              {perms.canInviteEmployee && (
                <span className="text-xs px-3 py-1 rounded-full bg-purple-50 text-purple-600 border border-purple-100 font-semibold shadow-sm shadow-purple-500/5">📧 Invite Members</span>
              )}
              {perms.canViewReports && (
                <span className="text-xs px-3 py-1 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100 font-semibold shadow-sm shadow-emerald-500/5">📊 Reports</span>
              )}
              {perms.canViewAuditLog && (
                <span className="text-xs px-3 py-1 rounded-full bg-amber-50 text-amber-600 border border-amber-100 font-semibold shadow-sm shadow-amber-500/5">🔍 Audit Log</span>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 mt-6">
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
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 my-4 md:my-6">
        <div>
          <div className="card">
            <div className="flex items-center justify-between">
              <h5 className="font-medium">Task Distribution</h5>
            </div>
            <CustomPieChart data={pieChartData} colors={COLORS} />
          </div>
        </div>

        <div>
          <div className="card">
            <div className="flex items-center justify-between">
              <h5 className="font-medium">Task Priority Levels</h5>
            </div>
            <CustomBarChart data={barChartData} />
          </div>
        </div>

        <div className="md:col-span-2">
          <div className="card">
            <div className="flex items-center justify-between">
              <h5 className="text-lg">Recent Tasks</h5>
              <button className="card-btn" onClick={() => navigate('/admin/tasks')}>
                See All <LuArrowRight className="text-base" />
              </button>
            </div>
            <TaskListTable tableData={dashboardData?.recentTasks || []} />
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;