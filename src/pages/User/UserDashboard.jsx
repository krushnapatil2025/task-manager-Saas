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
import { getUserDashboardData } from '../../services/taskService';
import toast from 'react-hot-toast';

const COLORS = ['#8D51FF', '#00B8DB', '#7BCE00'];

const UserDashboard = () => {
  useUserAuth();

  const { user }      = useContext(UserContext);
  const { workspace } = useContext(WorkspaceContext);
  const navigate      = useNavigate();

  const [dashboardData, setDashboardData] = useState(null);
  const [pieChartData,  setPieChartData]  = useState([]);
  const [barChartData,  setBarChartData]  = useState([]);
  const [loading, setLoading] = useState(true);

  const prepareChartData = (data) => {
    const dist     = data?.charts?.taskDistribution || {};
    const priority = data?.charts?.taskPriorityLevels || {};
    setPieChartData([
      { status: 'Pending',     count: dist.Pending    || 0 },
      { status: 'In Progress', count: dist.InProgress || 0 },
      { status: 'Completed',   count: dist.Completed  || 0 },
    ]);
    setBarChartData([
      { priority: 'low',    count: priority.low    || 0 },
      { priority: 'medium', count: priority.medium || 0 },
      { priority: 'high',   count: priority.high   || 0 },
    ]);
  };

  const loadDashboard = async () => {
    if (!user?.id || !workspace?.id) return;
    try {
      setLoading(true);
      const data = await getUserDashboardData(user.id, workspace.id);
      setDashboardData(data);
      prepareChartData(data);
    } catch (err) {
      console.error('User dashboard error:', err);
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadDashboard(); }, [user?.id, workspace?.id]);

  return (
    <DashboardLayout activeMenu="Dashboard">
      <div className="card my-5 bg-white/90 border border-slate-200/50 shadow-sm">
        <div>
          <h2 className="text-xl md:text-2xl font-extrabold text-slate-800 tracking-tight">Good Morning! {user?.name}</h2>
          <p className="text-xs md:text-[13px] text-slate-400 mt-1.5 font-bold uppercase tracking-wider">
            {moment().format('dddd Do MMMM YYYY')}
          </p>
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
        <div className="card bg-white/90 border border-slate-200/50">
          <h5 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">Task Distribution</h5>
          <CustomPieChart data={pieChartData} colors={COLORS} />
        </div>

        <div className="card bg-white/90 border border-slate-200/50">
          <h5 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-4">Task Priority Levels</h5>
          <CustomBarChart data={barChartData} />
        </div>

        <div className="md:col-span-2 card bg-white/90 border border-slate-200/50">
          <div className="flex items-center justify-between mb-4">
            <h5 className="text-xs font-bold uppercase tracking-wider text-slate-400">Recent Tasks</h5>
            <button className="card-btn" onClick={() => navigate('/user/tasks')}>
              See All <LuArrowRight className="text-base" />
            </button>
          </div>
          <TaskListTable tableData={dashboardData?.recentTasks || []} />
        </div>
      </div>
    </DashboardLayout>
  );
};

export default UserDashboard;