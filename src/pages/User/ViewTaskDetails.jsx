import React, { useState, useEffect, useContext, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import DashboardLayout from '../../components/layouts/DashboardLayout';
import moment from 'moment';
import AvatarGroup from '../../components/AvatarGroup';
import TaskComments from '../../components/TaskComments';
import TaskFileUploader from '../../components/TaskFileUploader';
import {
  LuSquareArrowOutUpRight, LuLoaderCircle, LuCalendar,
  LuFlag, LuRefreshCcw, LuArrowLeft,
} from 'react-icons/lu';
import toast from 'react-hot-toast';
import {
  getTaskById, updateChecklistItem, updateTaskStatus, normalizeTask,
} from '../../services/taskService';
import { getTaskFiles } from '../../services/fileService';
import { UserContext } from '../../context/userContext';
import { WorkspaceContext } from '../../context/WorkspaceContext';
import useRealtimeTasks from '../../hooks/useRealtimeTasks';

// ─────────────────────────────────────────────────────────────────────────────
// ViewTaskDetails — full task detail view for members with:
//   • Real-time status updates via Supabase Realtime
//   • One-click status cycling (Pending → In Progress → Completed)
//   • Checklist with optimistic toggle
//   • TaskComments thread
//   • TaskFileUploader (Supabase Storage)
// ─────────────────────────────────────────────────────────────────────────────

const STATUS_CYCLE = {
  'Pending':     'In Progress',
  'In Progress': 'Completed',
  'Completed':   'Pending',
};

const STATUS_COLOR = {
  'Pending':     'text-violet-600 bg-violet-50 border-violet-200',
  'In Progress': 'text-cyan-600   bg-cyan-50   border-cyan-200',
  'Completed':   'text-lime-600   bg-lime-50   border-lime-200',
};

const PRIORITY_COLOR = {
  high:   'text-red-600   bg-red-50   border-red-200',
  medium: 'text-amber-600 bg-amber-50 border-amber-200',
  low:    'text-blue-600  bg-blue-50  border-blue-200',
};

const ViewTaskDetails = () => {
  const { id }        = useParams();
  const navigate      = useNavigate();
  const { user }      = useContext(UserContext);
  const { workspace } = useContext(WorkspaceContext);

  const [task,    setTask]    = useState(null);
  const [files,   setFiles]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // ── Fetch task + files ───────────────────────────────────────────────────
  const loadTask = useCallback(async () => {
    if (!id) return;
    try {
      setLoading(true);
      const [raw, taskFiles] = await Promise.all([
        getTaskById(id),
        getTaskFiles(id),
      ]);
      setTask(normalizeTask(raw));
      setFiles(taskFiles);
    } catch (err) {
      console.error('ViewTaskDetails load error:', err);
      toast.error('Failed to load task details');
    } finally {
      setLoading(false);
    }
  }, [id]);

  // ── Supabase Realtime — re-fetch when this task changes ─────────────────
  useRealtimeTasks(workspace?.id, {
    onTaskChange: (payload) => {
      // Only reload if the changed row is THIS task
      if (payload?.new?.id === id || payload?.old?.id === id) {
        loadTask();
      }
    },
  });

  useEffect(() => { loadTask(); }, [loadTask]);

  // ── Status cycle ─────────────────────────────────────────────────────────
  const handleStatusCycle = async () => {
    if (!task || updatingStatus) return;
    const next = STATUS_CYCLE[task.status] || 'Pending';
    setUpdatingStatus(true);

    // Optimistic update
    setTask((prev) => ({ ...prev, status: next }));
    try {
      await updateTaskStatus(id, next);
      toast.success(`Status → ${next}`);
    } catch (err) {
      toast.error('Failed to update status');
      setTask((prev) => ({ ...prev, status: task.status })); // revert
    } finally {
      setUpdatingStatus(false);
    }
  };

  // ── Checklist toggle ─────────────────────────────────────────────────────
  const handleChecklistToggle = async (index) => {
    if (!task?.todoChecklist?.[index]) return;
    const item    = task.todoChecklist[index];
    const next    = !item.completed;

    // Derive new progress + status from updated checklist
    const updatedChecklist = task.todoChecklist.map((c, i) =>
      i === index ? { ...c, completed: next } : c
    );
    const total          = updatedChecklist.length;
    const completedCount = updatedChecklist.filter((c) => c.completed).length;
    const newProgress    = total > 0 ? Math.round((completedCount / total) * 100) : 0;
    const newStatus      = completedCount === 0       ? 'Pending'
                         : completedCount === total   ? 'Completed'
                         :                             'In Progress';

    // Optimistic update — status badge + progress bar change instantly
    setTask((prev) => ({
      ...prev,
      todoChecklist:      updatedChecklist,
      completedTodoCount: completedCount,
      progress:           newProgress,
      status:             newStatus,
    }));

    try {
      await updateChecklistItem(item.id, next);
      // DB trigger (trg_sync_task_progress) automatically writes
      // progress + status back to the tasks table.
    } catch (err) {
      toast.error('Failed to update checklist');
      // Revert optimistic update on failure
      setTask((prev) => ({
        ...prev,
        todoChecklist:      task.todoChecklist,
        completedTodoCount: task.completedTodoCount,
        progress:           task.progress,
        status:             task.status,
      }));
    }
  };

  // ────────────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <DashboardLayout activeMenu="My Tasks">
        <div className="flex items-center justify-center h-64">
          <LuLoaderCircle className="text-blue-600 text-3xl animate-spin" />
        </div>
      </DashboardLayout>
    );
  }

  if (!task) {
    return (
      <DashboardLayout activeMenu="My Tasks">
        <div className="text-center py-20 text-gray-400">Task not found.</div>
      </DashboardLayout>
    );
  }

  const todoTotal     = task.todoChecklist?.length || 0;
  const todoCompleted = task.completedTodoCount || 0;
  const todoProgress  = todoTotal > 0 ? Math.round((todoCompleted / todoTotal) * 100) : task.progress;

  return (
    <DashboardLayout activeMenu="My Tasks">
      <div className="mt-5 pb-12">
        {/* ── Back button ── */}
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-blue-600 mb-5 transition"
        >
          <LuArrowLeft /> Back
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* ═══ Left column — Task details ═══════════════════════════════ */}
          <div className="lg:col-span-2 space-y-5">

            {/* Task header card */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
              {/* Title + status */}
              <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                <h1 className="text-xl font-bold text-gray-900 flex-1">{task.title}</h1>

                {/* Status badge — click to cycle */}
                <button
                  onClick={handleStatusCycle}
                  disabled={updatingStatus}
                  title="Click to change status"
                  className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full border transition hover:opacity-80 ${STATUS_COLOR[task.status]}`}
                >
                  {updatingStatus
                    ? <LuLoaderCircle className="animate-spin text-xs" />
                    : <LuRefreshCcw className="text-xs" />}
                  {task.status}
                </button>
              </div>

              {/* Meta row */}
              <div className="flex flex-wrap gap-3 mb-5">
                <span className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border capitalize ${PRIORITY_COLOR[task.priority]}`}>
                  <LuFlag className="text-xs" />
                  {task.priority}
                </span>
                {task.dueDate && (
                  <span className={`flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full border ${
                    moment(task.dueDate).isBefore(moment(), 'day')
                      ? 'text-red-600 bg-red-50 border-red-200'
                      : 'text-gray-600 bg-gray-50 border-gray-200'
                  }`}>
                    <LuCalendar className="text-xs" />
                    {moment(task.dueDate).format('Do MMM YYYY')}
                    {moment(task.dueDate).isBefore(moment(), 'day') && ' · Overdue'}
                  </span>
                )}
              </div>

              {/* Description */}
              <div className="mb-5">
                <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest">Description</label>
                <p className="text-sm text-gray-700 mt-1.5 leading-relaxed">{task.description}</p>
              </div>

              {/* Assignees */}
              {task.assignedTo?.length > 0 && (
                <div>
                  <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest">Assigned To</label>
                  <div className="flex items-center gap-2 mt-2">
                    <AvatarGroup
                      avatars={task.assignedTo.map((u) => u.profileImageUrl)}
                      maxVisible={6}
                    />
                    <span className="text-xs text-gray-500">
                      {task.assignedTo.map((u) => u.name).join(', ')}
                    </span>
                  </div>
                </div>
              )}
            </div>

            {/* ── Checklist card ── */}
            {todoTotal > 0 && (
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
                <div className="flex items-center justify-between mb-4">
                  <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest">
                    Checklist
                  </label>
                  <span className="text-xs font-bold text-gray-500">
                    {todoCompleted}/{todoTotal} · {todoProgress}%
                  </span>
                </div>

                {/* Progress bar */}
                <div className="w-full h-1.5 bg-gray-100 rounded-full mb-4 overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all duration-500"
                    style={{ width: `${todoProgress}%` }}
                  />
                </div>

                <div className="space-y-2">
                  {task.todoChecklist.map((item, index) => (
                    <label
                      key={item.id || index}
                      className="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-50 cursor-pointer transition group"
                    >
                      <input
                        type="checkbox"
                        checked={item.completed}
                        onChange={() => handleChecklistToggle(index)}
                        className="w-4 h-4 rounded accent-blue-600 cursor-pointer"
                      />
                      <span className={`text-sm transition-all ${
                        item.completed
                          ? 'line-through text-gray-400'
                          : 'text-gray-800 group-hover:text-gray-900'
                      }`}>
                        {item.title}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* ── URL Attachments (legacy string links) ── */}
            {task.attachments?.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
                <label className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest block mb-3">
                  Links
                </label>
                <div className="space-y-2">
                  {task.attachments.map((link, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        const url = /^https?:\/\//.test(link) ? link : 'https://' + link;
                        window.open(url, '_blank');
                      }}
                      className="w-full flex items-center justify-between bg-gray-50 hover:bg-blue-50 border border-gray-200 hover:border-blue-200 rounded-xl px-4 py-2.5 text-left transition group"
                    >
                      <span className="text-xs text-gray-600 truncate flex-1">{link}</span>
                      <LuSquareArrowOutUpRight className="text-gray-400 group-hover:text-blue-500 flex-shrink-0 ml-2 text-sm transition" />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ── File Uploader ── */}
            {workspace?.id && user?.id && (
              <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
                <TaskFileUploader
                  taskId={id}
                  workspaceId={workspace.id}
                  uploadedBy={user.id}
                  files={files}
                  onFilesChange={setFiles}
                />
              </div>
            )}
          </div>

          {/* ═══ Right column — Comments ═══════════════════════════════════ */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5 sticky top-20">
              <TaskComments taskId={id} />
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default ViewTaskDetails;
