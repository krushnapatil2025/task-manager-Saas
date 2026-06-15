import React, { useEffect, useState, useContext, useCallback } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import DashboardLayout from '../../components/layouts/DashboardLayout';
import { WorkspaceContext } from '../../context/WorkspaceContext';
import { getAllTasks, normalizeTask, updateTaskStatus } from '../../services/taskService';
import useRealtimeTasks from '../../hooks/useRealtimeTasks';
import { useNavigate } from 'react-router-dom';
import moment from 'moment';
import toast from 'react-hot-toast';
import {
  LuCalendar, LuFlag, LuPaperclip, LuSquareCheck,
  LuMessageSquare, LuLoaderCircle, LuPlus,
} from 'react-icons/lu';

// ─────────────────────────────────────────────────────────────────────────────
// Kanban Board — drag-and-drop task board for the Admin
// ─────────────────────────────────────────────────────────────────────────────

const COLUMNS = [
  { id: 'Pending',     label: 'Pending',     color: 'bg-violet-500', light: 'bg-violet-50 border-violet-200'   },
  { id: 'In Progress', label: 'In Progress', color: 'bg-cyan-500',   light: 'bg-cyan-50 border-cyan-200'       },
  { id: 'Completed',   label: 'Completed',   color: 'bg-lime-500',   light: 'bg-lime-50 border-lime-200'       },
];

const PRIORITY_COLOR = {
  high:   'text-red-600 bg-red-50 border border-red-200',
  medium: 'text-amber-600 bg-amber-50 border border-amber-200',
  low:    'text-blue-600 bg-blue-50 border border-blue-200',
};

const KanbanBoard = () => {
  const { workspace } = useContext(WorkspaceContext);
  const navigate      = useNavigate();

  const [columns, setColumns] = useState({
    'Pending':     [],
    'In Progress': [],
    'Completed':   [],
  });
  const [loading, setLoading] = useState(true);

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
    } catch (err) {
      console.error('Status update failed:', err);
      toast.error('Failed to update task status');
      loadTasks(); // revert
    }
  };

  return (
    <DashboardLayout activeMenu="Kanban Board">
      <div className="mt-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Kanban Board</h2>
            <p className="text-sm text-gray-400 mt-0.5">Drag cards across columns to update status</p>
          </div>
          <button
            onClick={() => navigate('/admin/create-task')}
            className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white text-sm font-semibold px-4 py-2 rounded-xl shadow hover:opacity-90 transition"
          >
            <LuPlus /> New Task
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <LuLoaderCircle className="text-blue-600 text-3xl animate-spin" />
          </div>
        ) : (
          <DragDropContext onDragEnd={onDragEnd}>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {COLUMNS.map((col) => (
                <KanbanColumn
                  key={col.id}
                  col={col}
                  tasks={columns[col.id] || []}
                  onTaskClick={(id) => navigate('/admin/create-task', { state: { taskId: id } })}
                />
              ))}
            </div>
          </DragDropContext>
        )}
      </div>
    </DashboardLayout>
  );
};

export default KanbanBoard;

// ─────────────────────────────── Column ─────────────────────────────────────

const KanbanColumn = ({ col, tasks, onTaskClick }) => (
  <div className="flex flex-col min-h-[200px]">
    {/* Column header */}
    <div className={`flex items-center justify-between px-4 py-3 rounded-xl ${col.light} border mb-3`}>
      <div className="flex items-center gap-2">
        <div className={`w-2.5 h-2.5 rounded-full ${col.color}`} />
        <span className="font-semibold text-sm text-gray-700">{col.label}</span>
      </div>
      <span className="text-xs font-bold text-gray-500 bg-white rounded-full px-2.5 py-0.5 border border-gray-200">
        {tasks.length}
      </span>
    </div>

    <Droppable droppableId={col.id}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.droppableProps}
          className={`flex-1 flex flex-col gap-3 min-h-[80px] p-2 rounded-xl transition-colors ${
            snapshot.isDraggingOver ? 'bg-blue-50/60' : 'bg-gray-50/40'
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
            <div className="flex items-center justify-center h-16 rounded-xl border-2 border-dashed border-gray-200">
              <p className="text-xs text-gray-400">Drop tasks here</p>
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
          className={`bg-white rounded-2xl border p-4 cursor-pointer shadow-sm hover:shadow-md transition-all duration-200 ${
            snapshot.isDragging
              ? 'shadow-xl rotate-1 scale-105 border-blue-300'
              : 'border-gray-200 hover:border-blue-200'
          }`}
        >
          {/* Priority badge */}
          <div className="flex items-center justify-between mb-2">
            <span
              className={`text-[10px] font-semibold px-2.5 py-0.5 rounded-full capitalize ${PRIORITY_COLOR[task.priority]}`}
            >
              <LuFlag className="inline mr-1 text-[10px]" />
              {task.priority}
            </span>
            {isOverdue && (
              <span className="text-[10px] font-medium text-red-500 bg-red-50 px-2 py-0.5 rounded-full border border-red-200">
                Overdue
              </span>
            )}
          </div>

          {/* Title */}
          <h4 className="font-semibold text-sm text-gray-800 mb-1 leading-snug line-clamp-2">
            {task.title}
          </h4>
          <p className="text-xs text-gray-400 line-clamp-2 mb-3">{task.description}</p>

          {/* Progress bar */}
          {totalCount > 0 && (
            <div className="mb-3">
              <div className="flex justify-between text-[10px] text-gray-400 mb-1">
                <span>{completedCount}/{totalCount} todos</span>
                <span>{progress}%</span>
              </div>
              <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-purple-500 rounded-full transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between mt-2">
            <div className="flex items-center gap-2 text-xs text-gray-400">
              {task.dueDate && (
                <span className={`flex items-center gap-1 ${isOverdue ? 'text-red-400' : ''}`}>
                  <LuCalendar className="text-xs" />
                  {moment(task.dueDate).format('MMM D')}
                </span>
              )}
              {task.attachments?.length > 0 && (
                <span className="flex items-center gap-1">
                  <LuPaperclip className="text-xs" />
                  {task.attachments.length}
                </span>
              )}
            </div>

            {/* Assignee avatars */}
            <div className="flex -space-x-2">
              {task.assignedTo?.slice(0, 3).map((u, i) =>
                u.profileImageUrl ? (
                  <img
                    key={i}
                    src={u.profileImageUrl}
                    alt={u.name}
                    className="w-6 h-6 rounded-full border-2 border-white object-cover"
                  />
                ) : (
                  <div
                    key={i}
                    className="w-6 h-6 rounded-full border-2 border-white bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center"
                  >
                    <span className="text-white text-[8px] font-bold">
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
