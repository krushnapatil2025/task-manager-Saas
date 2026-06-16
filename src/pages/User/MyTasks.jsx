import React, { useEffect, useState, useContext } from 'react';
import DashboardLayout from '../../components/layouts/DashboardLayout';
import { useNavigate } from 'react-router-dom';
import TaskStatusTabs from '../../components/TaskStatusTabs';
import TaskCard from '../../components/Cards/TaskCard';
import toast from 'react-hot-toast';
import { getMyTasks, normalizeTask } from '../../services/taskService';
import { UserContext } from '../../context/userContext';
import { WorkspaceContext } from '../../context/WorkspaceContext';
import RefreshButton from '../../components/RefreshButton';

const MyTasks = () => {
  const [allTasks, setAllTasks]       = useState([]);
  const [tabs, setTabs]               = useState([]);
  const [filterStatus, setFilterStatus] = useState('All');
  const [loading, setLoading]         = useState(false);

  const { user }      = useContext(UserContext);
  const { workspace } = useContext(WorkspaceContext);
  const navigate      = useNavigate();

  const loadTasks = async () => {
    if (!user?.id || !workspace?.id) return;
    try {
      setLoading(true);
      const raw   = await getMyTasks(user.id, workspace.id, filterStatus);
      const tasks = raw.map(normalizeTask);
      setAllTasks(tasks);

      const total      = tasks.length;
      const pending    = tasks.filter((t) => t.status === 'Pending').length;
      const inProgress = tasks.filter((t) => t.status === 'In Progress').length;
      const completed  = tasks.filter((t) => t.status === 'Completed').length;

      setTabs([
        { label: 'All',         count: total      },
        { label: 'Pending',     count: pending    },
        { label: 'In Progress', count: inProgress },
        { label: 'Completed',   count: completed  },
      ]);
    } catch (err) {
      console.error('Error fetching tasks:', err);
      toast.error('Failed to load your tasks');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadTasks(); }, [filterStatus, user?.id, workspace?.id]);

  return (
    <DashboardLayout activeMenu="My Tasks">
      <div className="my-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-medium">My Tasks</h2>
            <RefreshButton
              id="my-tasks-refresh"
              onRefresh={loadTasks}
              label="Refresh"
              size="sm"
            />
          </div>
          {tabs?.[0]?.count > 0 && (
            <TaskStatusTabs
              tabs={tabs}
              activeTab={filterStatus}
              setActiveTab={setFilterStatus}
            />
          )}
        </div>

        {loading ? (
          <div className="flex justify-center mt-10">
            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            {allTasks.length === 0 ? (
              <p className="col-span-3 text-center text-gray-400 py-10">
                No tasks assigned to you in this workspace yet.
              </p>
            ) : (
              allTasks.map((item) => (
                <TaskCard
                  key={item.id}
                  title={item.title}
                  description={item.description}
                  priority={item.priority}
                  status={item.status}
                  progress={item.progress}
                  createdAt={item.createdAt}
                  dueDate={item.dueDate}
                  assignedTo={item.assignedTo.map((u) => u.profileImageUrl)}
                  attachmentCount={item.attachments?.length || 0}
                  completedTodoCount={item.completedTodoCount}
                  todoChecklist={item.todoChecklist}
                  onClick={() => navigate(`/user/task-details/${item.id}`)}
                />
              ))
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default MyTasks;