import React, { useEffect, useState, useContext, useCallback } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import DashboardLayout from '../../components/layouts/DashboardLayout';
import { WorkspaceContext } from '../../context/WorkspaceContext';
import { getAllTasks, normalizeTask, updateTaskStatus } from '../../services/taskService';
import useRealtimeTasks from '../../hooks/useRealtimeTasks';
import useAutomation    from '../../hooks/useAutomation';
import { useNavigate } from 'react-router-dom';
import moment from 'moment';
import toast from 'react-hot-toast';
import {
  LuCalendar, LuFlag, LuPaperclip, LuSquareCheck,
  LuMessageSquare, LuLoaderCircle, LuPlus, LuShare2
} from 'react-icons/lu';
import TaskSlidePanel from '../../components/TaskSlidePanel';
import ShareBoardModal from '../../components/ShareBoardModal';

// ─────────────────────────────────────────────────────────────────────────────
// Kanban Board — drag-and-drop task board for the Admin
// ─────────────────────────────────────────────────────────────────────────────

const COLUMNS = [
  { id: 'Pending',     label: 'Pending',     color: 'bg-indigo-500',  light: 'bg-white border-slate-200 shadow-sm shadow-slate-100/30'   },
  { id: 'In Progress', label: 'In Progress', color: 'bg-amber-500',   light: 'bg-white border-slate-200 shadow-sm shadow-slate-100/30'   },
  { id: 'Completed',   label: 'Completed',   color: 'bg-emerald-500', light: 'bg-white border-slate-200 shadow-sm shadow-slate-100/30'   },
];

const PRIORITY_COLOR = {
  high:   'text-red-700 bg-red-50 border border-red-200/50',
  medium: 'text-amber-700 bg-amber-50 border border-amber-250/60',
  low:    'text-indigo-700 bg-indigo-50 border border-indigo-200/40',
};

const KanbanBoard = () => {
  const { workspace } = useContext(WorkspaceContext);
  const navigate      = useNavigate();
  const { trigger: triggerAutomation } = useAutomation();

  const [columns, setColumns] = useState({
    'Pending':     [],
    'In Progress': [],
    'Completed':   [],
  });
  const [loading, setLoading] = useState(true);
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [isSlidePanelOpen, setIsSlidePanelOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);

  // ── Load & distribute tasks into columns ──────────────────────────────────
  const loadTasks = useCallback(async () => {
    if (!workspace?.id) return;
    try {
      setLoading(true);
      const raw   = await getAllTasks(workspace.id, null);
      const tasks = raw.map(normalizeTask);

      setColumns({
        'Pending':     tasks.filter((t) => t.status === 'Pending'),
        'In Progress': tasks.filter((t) => t.status === 'In Progress'),
        'Completed':   tasks.filter((t) => t.status === 'Completed'),
      });
    } catch (err) {
      console.error('Kanban load error:', err);
      toast.error('Failed to load tasks');
    } finally {
      setLoading(false);
    }
  }, [workspace?.id]);

  // Subscribe to real-time task changes and reload
  useRealtimeTasks(workspace?.id, {
    onTaskChange: () => loadTasks(),
  });

  useEffect(() => { loadTasks(); }, [loadTasks]);

  // ── Drag-and-drop handler ─────────────────────────────────────────────────
  const onDragEnd = async ({ source, destination, draggableId }) => {
    if (!destination) return;
    if (source.droppableId === destination.droppableId &&
        source.index === destination.index) return;

    const srcCol  = source.droppableId;
    const dstCol  = destination.droppableId;

    // Clone columns state
    const next = { ...columns };
    const [movedTask] = next[srcCol].splice(source.index, 1);
    movedTask.status  = dstCol;
    next[dstCol].splice(destination.index, 0, movedTask);

    // Optimistic update
    setColumns({ ...next });

    try {
      await updateTaskStatus(draggableId, dstCol);
      // Fire automation rules
      triggerAutomation('task_status_changed', {
        taskId:  draggableId,
        task:    { ...movedTask, status: dstCol },
        oldTask: { ...movedTask, status: srcCol },
      });
      if (dstCol === 'Completed') {
        triggerAutomation('task_completed', {
          taskId:  draggableId,
          task:    { ...movedTask, status: 'Completed' },
          oldTask: { ...movedTask, status: srcCol },
        });
      }
    } catch (err) {
      console.error('Status update failed:', err);
      toast.error('Failed to update task status');
      loadTasks(); // revert
    }
  };

  return (
    <DashboardLayout activeMenu="Kanban Board">
      <div className="mt-4 animate-fade-in">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl md:text-2xl font-extrabold text-slate-900 tracking-tight">Kanban Board</h2>
            <p className="text-xs text-slate-400 mt-1 font-semibold uppercase tracking-wider">Drag cards across columns to update status</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsShareModalOpen(true)}
              className="flex items-center gap-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-bold px-4 py-2.5 rounded-xl shadow-sm transition cursor-pointer"
            >
              <LuShare2 size={14} /> Share Board
            </button>
            <button
              onClick={() => { setSelectedTaskId(null); setIsSlidePanelOpen(true); }}
              className="flex items-center gap-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:opacity-90 text-white text-xs font-bold px-4 py-2.5 rounded-xl shadow-lg shadow-indigo-150 transition cursor-pointer"
            >
              <LuPlus /> New Task
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center h-72 gap-3">
            <LuLoaderCircle className="text-indigo-500 text-3xl animate-spin" />
            <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Syncing board state...</p>
          </div>
        ) : (
          <DragDropContext onDragEnd={onDragEnd}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {COLUMNS.map((col) => (
                <KanbanColumn
                  key={col.id}
                  col={col}
                  tasks={columns[col.id] || []}
                  onTaskClick={(id) => { setSelectedTaskId(id); setIsSlidePanelOpen(true); }}
                />
              ))}
            </div>
          </DragDropContext>
        )}
      </div>

      {/* Slide-over task editor */}
      <TaskSlidePanel
        taskId={selectedTaskId}
        isOpen={isSlidePanelOpen}
        onClose={() => setIsSlidePanelOpen(false)}
        onSuccess={loadTasks}
      />

      {/* Share Board Modal */}
      <ShareBoardModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        workspaceId={workspace?.id}
      />
    </DashboardLayout>
  );
};

export default KanbanBoard;

// ─────────────────────────────── Column ─────────────────────────────────────

const KanbanColumn = ({ col, tasks, onTaskClick }) => (
  <div className="flex flex-col min-h-[300px]">
    {/* Column header */}
    <div className={`flex items-center justify-between px-4 py-3 rounded-2xl ${col.light} border border-slate-200/60 mb-3`}>
      <div className="flex items-center gap-2">
        <div className={`w-2.5 h-2.5 rounded-full ${col.color} shadow-sm`} />
        <span className="font-extrabold text-sm text-slate-800 tracking-tight">{col.label}</span>
      </div>
      <span className="text-xs font-extrabold text-slate-500 bg-slate-50 border border-slate-200/50 rounded-full px-2.5 py-0.5">
        {tasks.length}
      </span>
    </div>

    <Droppable droppableId={col.id}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.droppableProps}
          className={`flex-1 flex flex-col gap-3 min-h-[120px] p-2.5 rounded-2xl transition-all duration-200 ${
            snapshot.isDraggingOver ? 'bg-indigo-50/45 border border-dashed border-indigo-200/50 shadow-inner' : 'bg-slate-25/40 border border-transparent'
          }`}
        >
          {tasks.map((task, index) => (
            <KanbanCard
              key={task.id}
              task={task}
              index={index}
              onClick={() => onTaskClick(task.id)}
            />
          ))}
          {provided.placeholder}

          {tasks.length === 0 && !snapshot.isDraggingOver && (
            <div className="flex flex-col items-center justify-center py-12 rounded-2xl border-2 border-dashed border-slate-200 bg-white/50">
              <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">No Tasks Here</p>
            </div>
          )}
        </div>
      )}
    </Droppable>
  </div>
);

// ─────────────────────────────── Card ───────────────────────────────────────

const KanbanCard = ({ task, index, onClick }) => {
  const completedCount = task.completedTodoCount || 0;
  const totalCount     = task.todoChecklist?.length || 0;
  const progress       = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : task.progress;
  const isOverdue      = task.dueDate && moment(task.dueDate).isBefore(moment(), 'day');

  return (
    <Draggable draggableId={task.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          onClick={onClick}
          className={`bg-white rounded-2xl border p-4 cursor-pointer transition-all duration-200 ${
            snapshot.isDragging
              ? 'shadow-xl rotate-1 scale-[1.02] border-indigo-400 ring-4 ring-indigo-500/5 bg-slate-25'
              : 'border-slate-200/70 hover:border-indigo-400/50 hover:shadow-md hover:shadow-slate-150/40'
          }`}
        >
          {/* Priority badge */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <span
                className={`text-[9px] font-extrabold px-2 py-0.5 rounded-md capitalize flex items-center gap-1 ${PRIORITY_COLOR[task.priority]}`}
              >
                <LuFlag size={10} />
                {task.priority}
              </span>
              {task.recurrenceRule && (
                <span className="text-[9px] font-extrabold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-200/40 flex items-center gap-0.5 uppercase tracking-wider">
                  🔁 {task.recurrenceRule}
                </span>
              )}
            </div>
            {isOverdue && (
              <span className="text-[9px] font-extrabold text-red-700 bg-red-50 px-2 py-0.5 rounded-md border border-red-200/50">
                Overdue
              </span>
            )}
          </div>

          {/* Title */}
          <h4 className="font-extrabold text-sm text-slate-800 mb-1 leading-snug line-clamp-2 hover:text-indigo-600 transition-colors">
            {task.title}
          </h4>
          <p className="text-xs text-slate-400 line-clamp-2 mb-3 font-medium">{task.description}</p>

          {/* Progress bar */}
          {totalCount > 0 && (
            <div className="mb-3">
              <div className="flex justify-between text-[10px] text-slate-400 font-bold uppercase tracking-wider mb-1">
                <span>{completedCount}/{totalCount} tasks</span>
                <span>{progress}%</span>
              </div>
              <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-indigo-500 to-violet-650 rounded-full transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-100">
            <div className="flex items-center gap-2 text-[10px] text-slate-400 font-bold uppercase tracking-wider">
              {task.dueDate && (
                <span className={`flex items-center gap-1 ${isOverdue ? 'text-red-500 font-extrabold' : ''}`}>
                  <LuCalendar size={11} />
                  {moment(task.dueDate).format('MMM D')}
                </span>
              )}
              {task.attachments?.length > 0 && (
                <span className="flex items-center gap-1">
                  <LuPaperclip size={11} />
                  {task.attachments.length}
                </span>
              )}
            </div>

            {/* Assignee avatars */}
            <div className="flex -space-x-1.5">
              {task.assignedTo?.slice(0, 3).map((u, i) =>
                u.profileImageUrl ? (
                  <img
                    key={i}
                    src={u.profileImageUrl}
                    alt={u.name}
                    className="w-5.5 h-5.5 rounded-full border border-white object-cover shadow-sm"
                  />
                ) : (
                  <div
                    key={i}
                    className="w-5.5 h-5.5 rounded-full border border-white bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-sm"
                  >
                    <span className="text-white text-[8px] font-extrabold">
                      {u.name?.[0]?.toUpperCase()}
                    </span>
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      )}
    </Draggable>
  );
};
