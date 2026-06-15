import React, { useEffect, useState, useContext, useCallback } from 'react';
import DashboardLayout from '../../components/layouts/DashboardLayout';
import { useNavigate } from 'react-router-dom';
import { LuFileSpreadsheet, LuLoaderCircle, LuRefreshCcw } from 'react-icons/lu';
import TaskStatusTabs from '../../components/TaskStatusTabs';
import TaskCard from '../../components/Cards/TaskCard';
import toast from 'react-hot-toast';
import { getAllTasks, normalizeTask } from '../../services/taskService';
import { WorkspaceContext } from '../../context/WorkspaceContext';
import useRealtimeTasks from '../../hooks/useRealtimeTasks';
import usePermissions from '../../hooks/usePermissions';
import PermissionGate from '../../components/PermissionGate';
import ExcelJS from 'exceljs';

const ManageTasks = () => {
  const [allTasks,     setAllTasks]      = useState([]);
  const [tabs,         setTabs]          = useState([]);
  const [filterStatus, setFilterStatus]  = useState('All');
  const [loading,      setLoading]       = useState(false);
  const [liveUpdate,   setLiveUpdate]    = useState(false); // flash indicator

  const { workspace } = useContext(WorkspaceContext);
  const navigate       = useNavigate();
  const { canEditTask, canExportTasks } = usePermissions();

  // ── Load tasks ─────────────────────────────────────────────────────────────
  const loadTasks = useCallback(async (silent = false) => {
    if (!workspace?.id) return;
    try {
      if (!silent) setLoading(true);
      const raw   = await getAllTasks(workspace.id, filterStatus);
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
      toast.error('Failed to load tasks');
    } finally {
      setLoading(false);
    }
  }, [workspace?.id, filterStatus]);

  // ── Supabase Realtime — silently refresh when tasks change ────────────────
  useRealtimeTasks(workspace?.id, {
    onTaskChange: () => {
      setLiveUpdate(true);
      loadTasks(true); // silent = no spinner
      setTimeout(() => setLiveUpdate(false), 1500);
    },
  });

  const handleClick = (taskData) => {
    if (canEditTask) navigate('/admin/create-task', { state: { taskId: taskData.id } });
  };

  const handleDownloadReport = async () => {
    try {
      const raw   = await getAllTasks(workspace.id, null);
      const tasks = raw.map(normalizeTask);

      const workbook = new ExcelJS.Workbook();
      const sheet    = workbook.addWorksheet('Tasks');
      sheet.columns = [
        { header: 'Title',       key: 'title',       width: 30 },
        { header: 'Description', key: 'description', width: 40 },
        { header: 'Priority',    key: 'priority',    width: 12 },
        { header: 'Status',      key: 'status',      width: 15 },
        { header: 'Progress',    key: 'progress',    width: 12 },
        { header: 'Due Date',    key: 'dueDate',     width: 18 },
        { header: 'Assigned To', key: 'assignedTo',  width: 35 },
      ];
      tasks.forEach((t) => sheet.addRow({
        title:       t.title,
        description: t.description,
        priority:    t.priority,
        status:      t.status,
        progress:    `${t.progress}%`,
        dueDate:     t.dueDate ? new Date(t.dueDate).toLocaleDateString() : '',
        assignedTo:  t.assignedTo.map((u) => u.name).join(', '),
      }));

      const buffer = await workbook.xlsx.writeBuffer();
      const blob   = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = `${workspace.name}_tasks.xlsx`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success('Report downloaded!');
    } catch (err) {
      console.error('Download error:', err);
      toast.error('Failed to download report');
    }
  };

  useEffect(() => { loadTasks(); }, [loadTasks]);

  return (
    <DashboardLayout activeMenu="Manage Tasks">
      <div className="my-5">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-medium">All Tasks</h2>
            {/* Live indicator */}
            {liveUpdate && (
              <span className="flex items-center gap-1.5 text-[11px] font-medium text-green-600 bg-green-50 border border-green-200 px-2.5 py-0.5 rounded-full animate-fade-in">
                <LuRefreshCcw className="text-xs animate-spin" /> Live update
              </span>
            )}
            <button className="flex lg:hidden download-btn gap-2" onClick={handleDownloadReport}
              style={{ display: canExportTasks ? undefined : 'none' }}>
              <LuFileSpreadsheet className="text-lg" /> Download
            </button>
          </div>

          {tabs?.[0]?.count > 0 && (
            <div className="flex items-center gap-3">
              <TaskStatusTabs tabs={tabs} activeTab={filterStatus} setActiveTab={setFilterStatus} />
              {canExportTasks && (
                <button className="hidden lg:flex download-btn gap-2 items-center" onClick={handleDownloadReport}>
                  <LuFileSpreadsheet className="text-lg" /> Download Report
                </button>
              )}
            </div>
          )}
        </div>

        {/* Task grid */}
        {loading ? (
          <div className="flex justify-center mt-16">
            <LuLoaderCircle className="text-blue-600 text-3xl animate-spin" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            {allTasks.length === 0 ? (
              <p className="col-span-3 text-center text-gray-400 py-10">
                No tasks found in this workspace.
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
                  onClick={() => handleClick(item)}
                />
              ))
            )}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default ManageTasks;