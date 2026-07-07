import React, { useContext, useEffect, useState, useCallback, useMemo } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import DashboardLayout from '../../components/layouts/DashboardLayout';
import { WorkspaceContext } from '../../context/WorkspaceContext';
import { UserContext }      from '../../context/userContext';
import {
  LuPlus, LuLoaderCircle, LuPlay, LuCheck,
  LuTrash2, LuCalendar, LuFlag, LuX, LuTarget,
  LuShare2, LuChevronDown, LuSearch, LuExternalLink,
  LuLayers, LuLayoutGrid, LuInbox, LuInfo, LuPen
} from 'react-icons/lu';
import ShareBoardModal from '../../components/ShareBoardModal';
import TaskSlidePanel from '../../components/TaskSlidePanel';
import {
  getSprints, createSprint, updateSprintStatus, updateSprintDetails,
  deleteSprint, getSprintTasks, addTaskToSprint, removeTaskFromSprint,
} from '../../services/sprintService';
import { getAllTasks, normalizeTask, updateTaskStatus } from '../../services/taskService';
import RefreshButton from '../../components/RefreshButton';
import toast from 'react-hot-toast';
import moment from 'moment';

// ─────────────────────────────────────────────────────────────────────────────
// SprintBoard — Industry Standard Rebuild
// ─────────────────────────────────────────────────────────────────────────────

const SPRINT_STATUS_COLORS = {
  planning:  'bg-slate-100 text-slate-650 border-slate-205 dark:bg-zinc-800/60 dark:text-zinc-355 dark:border-zinc-700',
  active:    'bg-emerald-50 text-emerald-650 border-emerald-200 dark:bg-emerald-950/20 dark:text-emerald-450 dark:border-emerald-900/30',
  completed: 'bg-indigo-50 text-indigo-650 border-indigo-200 dark:bg-indigo-950/20 dark:text-indigo-400 dark:border-indigo-900/30',
  cancelled: 'bg-rose-50 text-rose-600 border-rose-200 dark:bg-rose-955/15 dark:text-rose-400 dark:border-rose-900/30',
};

const PRIORITY_BADGES = {
  high:   'text-red-700 bg-red-50 border border-red-200/50 dark:bg-red-955/15 dark:text-red-400 dark:border-red-900/30',
  medium: 'text-amber-705 bg-amber-55 border border-amber-250/60 dark:bg-amber-955/15 dark:text-amber-400 dark:border-amber-900/30',
  low:    'text-indigo-750 bg-indigo-50 border border-indigo-200/40 dark:bg-indigo-950/20 dark:text-indigo-400 dark:border-indigo-900/30',
};

const COLUMN_CONFIGS = [
  { id: 'Pending',     label: 'To Do',       color: 'bg-indigo-500' },
  { id: 'In Progress', label: 'In Progress', color: 'bg-amber-500' },
  { id: 'Completed',   label: 'Completed',   color: 'bg-emerald-500' },
];

// ── Create Sprint Modal ───────────────────────────────────────────────────────
const CreateSprintModal = ({ onClose, onCreated, sprintsCount }) => {
  const { workspace } = useContext(WorkspaceContext);
  const { user }      = useContext(UserContext);

  const defaultStartDate = useMemo(() => moment().format('YYYY-MM-DD'), []);

  const [form, setForm] = useState({
    name: `Sprint ${sprintsCount + 1}`,
    goal: '',
    duration: '2-weeks', // default: 2 Weeks
    startDate: defaultStartDate,
    endDate: moment().add(14, 'days').format('YYYY-MM-DD'),
  });
  const [busy, setBusy] = useState(false);

  // Recalculate end date based on start date and duration preset
  useEffect(() => {
    if (form.duration === 'custom') return;

    let daysToAdd = 14; // default 2 weeks
    if (form.duration === '1-week') daysToAdd = 7;
    else if (form.duration === '2-weeks') daysToAdd = 14;
    else if (form.duration === '3-weeks') daysToAdd = 21;
    else if (form.duration === '4-weeks') daysToAdd = 28;

    if (form.startDate) {
      const calculatedEnd = moment(form.startDate).add(daysToAdd, 'days').format('YYYY-MM-DD');
      setForm(f => ({ ...f, endDate: calculatedEnd }));
    }
  }, [form.startDate, form.duration]);

  const handle = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return toast.error('Sprint name is required');
    setBusy(true);
    try {
      const sprint = await createSprint({
        workspaceId: workspace.id,
        name:        form.name,
        goal:        form.goal,
        startDate:   form.startDate || null,
        endDate:     form.endDate   || null,
        createdBy:   user?.id,
      });
      toast.success('Sprint created!');
      onCreated(sprint);
      onClose();
    } catch (err) {
      toast.error('Failed to create sprint');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="relative bg-white dark:bg-[#121215] border border-slate-100 dark:border-zinc-800 rounded-3xl shadow-2xl max-w-md w-full p-6 animate-scale-in">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-655 hover:bg-slate-50 dark:hover:bg-zinc-800 rounded-xl transition cursor-pointer"
        >
          <LuX size={18} />
        </button>

        {/* Title */}
        <div className="flex items-center gap-2.5 mb-6">
          <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/30 rounded-2xl flex items-center justify-center text-indigo-650 dark:text-indigo-400">
            <LuTarget size={20} />
          </div>
          <div>
            <h3 className="text-sm font-extrabold text-slate-800 dark:text-zinc-200 uppercase tracking-wider">
              Create Sprint
            </h3>
            <p className="text-[10px] text-slate-400 dark:text-zinc-500 font-semibold mt-0.5 uppercase tracking-wider">
              Plan a new time-boxed iteration
            </p>
          </div>
        </div>

        <form onSubmit={handle} className="space-y-4">
          <div>
            <label className="text-[10px] text-slate-400 dark:text-zinc-500 font-bold uppercase tracking-wider block mb-1.5">
              Sprint Name *
            </label>
            <input
              type="text"
              placeholder="e.g. Sprint 1 — Auth Module"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              required
              className="w-full px-3.5 py-2.5 text-xs font-semibold text-slate-700 dark:text-zinc-200 bg-slate-25 dark:bg-zinc-900/60 rounded-xl border border-slate-200 dark:border-zinc-800 outline-none focus:border-indigo-500 dark:focus:border-indigo-400 transition"
            />
          </div>

          <div>
            <label className="text-[10px] text-slate-400 dark:text-zinc-500 font-bold uppercase tracking-wider block mb-1.5">
              Duration Preset
            </label>
            <div className="relative">
              <select
                value={form.duration}
                onChange={e => setForm(f => ({ ...f, duration: e.target.value }))}
                className="w-full px-3.5 py-2.5 text-xs font-semibold text-slate-700 dark:text-zinc-200 bg-slate-25 dark:bg-zinc-900/60 rounded-xl border border-slate-200 dark:border-zinc-800 outline-none focus:border-indigo-500 dark:focus:border-indigo-400 transition appearance-none cursor-pointer"
              >
                <option value="1-week">1 Week (7 days)</option>
                <option value="2-weeks">2 Weeks (14 days)</option>
                <option value="3-weeks">3 Weeks (21 days)</option>
                <option value="4-weeks">4 Weeks (28 days)</option>
                <option value="custom">Custom Date Range</option>
              </select>
              <LuChevronDown size={14} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-slate-400 dark:text-zinc-550 font-bold uppercase tracking-wider block mb-1.5">
                Start Date
              </label>
              <input
                type="date"
                value={form.startDate}
                onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}
                className="w-full px-3.5 py-2.5 text-xs font-semibold text-slate-700 dark:text-zinc-200 bg-slate-25 dark:bg-zinc-900/60 rounded-xl border border-slate-200 dark:border-zinc-800 outline-none focus:border-indigo-500 dark:focus:border-indigo-400 transition"
              />
            </div>
            <div>
              <label className="text-[10px] text-slate-400 dark:text-zinc-550 font-bold uppercase tracking-wider block mb-1.5">
                End Date
              </label>
              <input
                type="date"
                disabled={form.duration !== 'custom'}
                value={form.endDate}
                onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))}
                className="w-full px-3.5 py-2.5 text-xs font-semibold text-slate-700 dark:text-zinc-200 bg-slate-25 dark:bg-zinc-900/60 rounded-xl border border-slate-200 dark:border-zinc-800 outline-none focus:border-indigo-500 dark:focus:border-indigo-400 transition disabled:opacity-60"
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] text-slate-400 dark:text-zinc-550 font-bold uppercase tracking-wider block mb-1.5">
              Sprint Goal
            </label>
            <textarea
              rows={3}
              placeholder="What should this sprint achieve?"
              value={form.goal}
              onChange={e => setForm(f => ({ ...f, goal: e.target.value }))}
              className="w-full px-3.5 py-2.5 text-xs font-semibold text-slate-700 dark:text-zinc-200 bg-slate-25 dark:bg-zinc-900/60 rounded-xl border border-slate-200 dark:border-zinc-800 outline-none focus:border-indigo-500 dark:focus:border-indigo-400 transition resize-none"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-800 text-slate-500 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-900/50 text-xs font-bold transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy}
              className="card-btn-fill flex-1 px-4 py-2.5 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer"
            >
              {busy ? <LuLoaderCircle size={14} className="animate-spin" /> : <LuPlus size={14} />}
              Create Sprint
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ── Edit Sprint Modal ─────────────────────────────────────────────────────────
const EditSprintModal = ({ sprint, onClose, onUpdated }) => {
  const [form, setForm] = useState({
    name: sprint?.name || '',
    goal: sprint?.goal || '',
    startDate: sprint?.start_date ? moment(sprint.start_date).format('YYYY-MM-DD') : '',
    endDate: sprint?.end_date ? moment(sprint.end_date).format('YYYY-MM-DD') : '',
  });
  const [busy, setBusy] = useState(false);

  const handle = async (e) => {
    e.preventDefault();
    if (!form.name.trim()) return toast.error('Sprint name is required');
    setBusy(true);
    try {
      await updateSprintDetails(sprint.id, {
        name:      form.name,
        goal:      form.goal,
        startDate: form.startDate || null,
        endDate:   form.endDate   || null,
      });
      toast.success('Sprint updated!');
      onUpdated();
      onClose();
    } catch (err) {
      toast.error('Failed to update sprint');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fade-in">
      <div className="relative bg-white dark:bg-[#121215] border border-slate-105 dark:border-zinc-800 rounded-3xl shadow-2xl max-w-md w-full p-6 animate-scale-in">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-slate-400 hover:text-slate-655 hover:bg-slate-50 dark:hover:bg-zinc-800 rounded-xl transition cursor-pointer"
        >
          <LuX size={18} />
        </button>

        {/* Title */}
        <div className="flex items-center gap-2.5 mb-6">
          <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/30 rounded-2xl flex items-center justify-center text-indigo-650 dark:text-indigo-400">
            <LuTarget size={20} />
          </div>
          <div>
            <h3 className="text-sm font-extrabold text-slate-800 dark:text-zinc-200 uppercase tracking-wider">
              Edit Sprint
            </h3>
            <p className="text-[10px] text-slate-400 dark:text-zinc-500 font-semibold mt-0.5 uppercase tracking-wider">
              Modify sprint specifications
            </p>
          </div>
        </div>

        <form onSubmit={handle} className="space-y-4">
          <div>
            <label className="text-[10px] text-slate-400 dark:text-zinc-550 font-bold uppercase tracking-wider block mb-1.5">
              Sprint Name *
            </label>
            <input
              type="text"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              required
              className="w-full px-3.5 py-2.5 text-xs font-semibold text-slate-700 dark:text-zinc-200 bg-slate-25 dark:bg-zinc-900/60 rounded-xl border border-slate-200 dark:border-zinc-800 outline-none focus:border-indigo-500 dark:focus:border-indigo-400 transition"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-slate-400 dark:text-zinc-550 font-bold uppercase tracking-wider block mb-1.5">
                Start Date
              </label>
              <input
                type="date"
                value={form.startDate}
                onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))}
                className="w-full px-3.5 py-2.5 text-xs font-semibold text-slate-700 dark:text-zinc-200 bg-slate-25 dark:bg-zinc-900/60 rounded-xl border border-slate-200 dark:border-zinc-800 outline-none focus:border-indigo-500 dark:focus:border-indigo-400 transition"
              />
            </div>
            <div>
              <label className="text-[10px] text-slate-400 dark:text-zinc-550 font-bold uppercase tracking-wider block mb-1.5">
                End Date
              </label>
              <input
                type="date"
                value={form.endDate}
                onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))}
                className="w-full px-3.5 py-2.5 text-xs font-semibold text-slate-700 dark:text-zinc-200 bg-slate-25 dark:bg-zinc-900/60 rounded-xl border border-slate-200 dark:border-zinc-800 outline-none focus:border-indigo-500 dark:focus:border-indigo-400 transition"
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] text-slate-400 dark:text-zinc-550 font-bold uppercase tracking-wider block mb-1.5">
              Sprint Goal
            </label>
            <textarea
              rows={3}
              placeholder="What should this sprint achieve?"
              value={form.goal}
              onChange={e => setForm(f => ({ ...f, goal: e.target.value }))}
              className="w-full px-3.5 py-2.5 text-xs font-semibold text-slate-700 dark:text-zinc-200 bg-slate-25 dark:bg-zinc-900/60 rounded-xl border border-slate-200 dark:border-zinc-800 outline-none focus:border-indigo-500 dark:focus:border-indigo-400 transition resize-none"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-zinc-800 text-slate-500 dark:text-zinc-400 hover:bg-slate-50 dark:hover:bg-zinc-900/50 text-xs font-bold transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy}
              className="card-btn-fill flex-1 px-4 py-2.5 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer"
            >
              {busy ? <LuLoaderCircle size={14} className="animate-spin" /> : <LuCheck size={14} />}
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ── Compact Task Card for Backlog/Sprints list ───────────────────────────────
const TaskItemCard = ({ task, index, onTaskClick, onRemoveFromSprint, sprintsList, onAddToSprint }) => {
  return (
    <Draggable draggableId={task.id} index={index}>
      {(provided, snapshot) => (
        <div
          ref={provided.innerRef}
          {...provided.draggableProps}
          {...provided.dragHandleProps}
          className={`flex items-center justify-between bg-white dark:bg-[#151518]/30 border rounded-xl px-4 py-3 group transition select-none ${
            snapshot.isDragging
              ? 'shadow-xl border-indigo-400 scale-[1.01] bg-slate-50 dark:bg-zinc-900/60 ring-2 ring-indigo-500/10'
              : 'border-slate-200/70 hover:border-slate-350 dark:border-zinc-800/80 dark:hover:border-zinc-700/80 hover:shadow-sm'
          }`}
        >
          <div className="flex items-center gap-3 min-w-0 flex-1" onClick={() => onTaskClick(task.id)}>
            <div className="flex flex-col gap-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                {task.taskNumber && (
                  <span className="text-[9px] bg-slate-100 border border-slate-200 text-slate-650 px-1.5 py-0.5 rounded font-mono font-bold dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-300">
                    {task.taskNumber}
                  </span>
                )}
                <span className={`text-[8.5px] font-extrabold px-1.5 py-0.5 rounded capitalize flex items-center gap-0.5 ${PRIORITY_BADGES[task.priority] || 'bg-slate-105 text-slate-500'}`}>
                  {task.priority}
                </span>
                <span className="text-xs font-bold text-slate-850 dark:text-zinc-200 truncate hover:text-indigo-650 dark:hover:text-indigo-400 transition-colors cursor-pointer">
                  {task.title}
                </span>
              </div>
              {task.description && (
                <p className="text-[10px] text-slate-450 dark:text-zinc-400/80 line-clamp-1 font-medium">
                  {task.description}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0 ml-3">
            {/* Assignees */}
            <div className="flex -space-x-1">
              {task.assignedTo?.slice(0, 2).map((a, i) => (
                <div key={i} className="w-5 h-5 rounded-full border border-white dark:border-[#121215] overflow-hidden flex items-center justify-center bg-indigo-105 text-[8px] font-extrabold text-indigo-755 shadow-sm" title={a.name}>
                  {a.profileImageUrl ? (
                    <img src={a.profileImageUrl} alt={a.name} className="w-full h-full object-cover" />
                  ) : (
                    a.name?.[0]?.toUpperCase() || '?'
                  )}
                </div>
              ))}
            </div>

            {/* Status chip */}
            <span className="text-[9px] font-extrabold border border-slate-200 dark:border-zinc-800 rounded px-1.5 py-0.5 text-slate-505 dark:text-zinc-450 bg-slate-50/50 dark:bg-zinc-900/10 uppercase tracking-wider">
              {task.status}
            </span>

            {/* Quick Actions */}
            {onRemoveFromSprint && (
              <button className="text-slate-400 hover:text-rose-600 hover:bg-rose-50/50 dark:hover:bg-zinc-800 p-1 rounded-lg transition-colors cursor-pointer"
                onClick={(e) => { e.stopPropagation(); onRemoveFromSprint(task.id); }}
                title="Remove from Sprint">
                <LuX size={13} />
              </button>
            )}

            {onAddToSprint && sprintsList?.length > 0 && (
              <div className="relative group/menu">
                <button className="flex items-center gap-0.5 text-[10px] font-bold text-indigo-650 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/20 px-2 py-1 rounded-lg transition cursor-pointer">
                  Assign Sprint <LuChevronDown size={10} />
                </button>
                <div className="absolute right-0 top-full mt-1 hidden group-hover/menu:block bg-white dark:bg-[#121215] border border-slate-202 dark:border-zinc-800 rounded-xl shadow-xl z-30 py-1 w-44">
                  {sprintsList.map(s => (
                    <button key={s.id}
                      onClick={() => onAddToSprint(s.id, task.id)}
                      className="w-full text-left px-3 py-1.5 text-[11px] font-bold text-slate-700 dark:text-zinc-200 hover:bg-slate-50 dark:hover:bg-zinc-900/40 transition">
                      🎯 {s.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <button onClick={() => onTaskClick(task.id)} className="text-slate-400 hover:text-slate-600 dark:hover:text-zinc-200 p-1 transition cursor-pointer" title="View details">
              <LuExternalLink size={12} />
            </button>
          </div>
        </div>
      )}
    </Draggable>
  );
};

// ── Sprint Collapsible Panel (Planning Tab) ──────────────────────────────────
const SprintPlanningPanel = ({ sprint, sprintTasks, allTasks, onStatusChange, onDelete, onShare, onRemoveTask, onTaskClick, sprintsList, onAddTaskToSprint, onEdit }) => {
  const [expanded, setExpanded] = useState(sprint.status === 'active');

  const tasks = sprintTasks[sprint.id] || [];
  const completed = tasks.filter(t => t.status === 'Completed').length;
  const progress  = tasks.length > 0 ? Math.round((completed / tasks.length) * 100) : 0;

  const durationWeeks = useMemo(() => {
    if (!sprint.start_date || !sprint.end_date) return null;
    const days = moment(sprint.end_date).diff(moment(sprint.start_date), 'days');
    return Math.round(days / 7);
  }, [sprint.start_date, sprint.end_date]);

  return (
    <div className="border border-slate-200/70 dark:border-zinc-800/80 bg-white dark:bg-[#151518]/30 rounded-2xl overflow-hidden shadow-sm">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between p-4 cursor-pointer hover:bg-slate-50/40 dark:hover:bg-zinc-900/10 transition"
        onClick={() => setExpanded(prev => !prev)}>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-lg">🎯</span>
            <h3 className="font-extrabold text-slate-805 dark:text-zinc-200 text-sm tracking-tight">{sprint.name}</h3>
            <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded border uppercase tracking-wider ${SPRINT_STATUS_COLORS[sprint.status]}`}>
              {sprint.status}
            </span>
            {durationWeeks && (
              <span className="text-[9px] font-extrabold text-slate-400 bg-slate-50 dark:bg-zinc-900/30 border border-slate-200/50 dark:border-zinc-800 rounded px-1.5 py-0.5">
                {durationWeeks} Week{durationWeeks > 1 ? 's' : ''}
              </span>
            )}
          </div>
          {sprint.goal && (
            <p className="text-xs text-slate-500 dark:text-zinc-455 mt-1 font-medium line-clamp-1">{sprint.goal}</p>
          )}
          {(sprint.start_date || sprint.end_date) && (
            <p className="text-[10px] text-slate-450 dark:text-zinc-500 mt-1.5 font-bold uppercase tracking-wider flex items-center gap-1">
              <LuCalendar size={11} />
              {sprint.start_date ? moment(sprint.start_date).format('MMM D, YYYY') : '?'}
              {' → '}
              {sprint.end_date ? moment(sprint.end_date).format('MMM D, YYYY') : '?'}
            </p>
          )}
        </div>

        {/* Right side metrics and actions */}
        <div className="flex items-center gap-4 mt-3 md:mt-0" onClick={e => e.stopPropagation()}>
          {tasks.length > 0 && (
            <div className="flex items-center gap-2">
              <div className="text-right">
                <p className="text-[10px] font-bold text-slate-450 dark:text-zinc-500 uppercase tracking-wider">Progress</p>
                <p className="text-xs font-extrabold text-slate-700 dark:text-zinc-300">{completed}/{tasks.length} ({progress}%)</p>
              </div>
              <div className="w-16 bg-slate-105 dark:bg-zinc-800 rounded-full h-2 overflow-hidden">
                <div className="bg-indigo-650 dark:bg-indigo-400 h-full rounded-full transition-all duration-300" style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}

          <div className="h-8 w-px bg-slate-100 dark:bg-zinc-800" />

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            {(sprint.status === 'planning' || sprint.status === 'completed' || sprint.status === 'cancelled') && (
              <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-emerald-305 text-emerald-650 bg-emerald-50 hover:bg-emerald-100/50 dark:bg-emerald-950/20 dark:text-emerald-450 dark:hover:bg-emerald-950/40 text-xs font-bold transition cursor-pointer"
                onClick={() => onStatusChange(sprint.id, 'active')}
                title="Start Sprint">
                <LuPlay size={12} /> Start Sprint
              </button>
            )}
            {sprint.status === 'active' && (
              <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-indigo-300/30 text-indigo-655 bg-indigo-50 hover:bg-indigo-100/50 dark:bg-indigo-950/20 dark:text-indigo-400 dark:hover:bg-indigo-950/40 text-xs font-bold transition cursor-pointer"
                onClick={() => onStatusChange(sprint.id, 'completed')}
                title="Complete Sprint">
                <LuCheck size={12} /> Complete Sprint
              </button>
            )}
            <button className="p-2 rounded-xl border border-slate-205 dark:border-zinc-800 text-slate-450 hover:text-indigo-650 hover:border-indigo-300/40 dark:hover:text-indigo-400 transition cursor-pointer"
              onClick={() => onEdit(sprint)}
              title="Edit Sprint"><LuPen size={13} /></button>
            <button className="p-2 rounded-xl border border-slate-205 dark:border-zinc-800 text-slate-450 hover:text-indigo-650 hover:border-indigo-300/40 dark:hover:text-indigo-400 transition cursor-pointer"
              onClick={() => onShare(sprint)}
              title="Share Sprint Board"><LuShare2 size={13} /></button>
            <button className="p-2 rounded-xl border border-slate-205 dark:border-zinc-800 text-slate-450 hover:text-rose-600 hover:border-rose-300/40 dark:hover:text-rose-455 transition cursor-pointer"
              onClick={() => { if (window.confirm('Delete this sprint?')) onDelete(sprint.id); }}
              title="Delete Sprint"><LuTrash2 size={13} /></button>
          </div>
        </div>
      </div>

      {/* Task list container */}
      {expanded && (
        <div className="border-t border-slate-100 dark:border-zinc-800/80 p-4 bg-slate-50/20 dark:bg-zinc-900/10">
          <Droppable droppableId={sprint.id}>
            {(provided, snapshot) => (
              <div
                ref={provided.innerRef}
                {...provided.droppableProps}
                className={`flex flex-col gap-2 min-h-[80px] p-2 rounded-xl transition ${
                  snapshot.isDraggingOver ? 'bg-indigo-50/30 border border-dashed border-indigo-200/50 dark:bg-indigo-950/5' : ''
                }`}
              >
                {tasks.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-6 text-slate-400 dark:text-zinc-550">
                    <LuInbox size={20} className="mb-1 opacity-40" />
                    <p className="text-[11px] font-bold uppercase tracking-wider">No tasks planned yet</p>
                    <p className="text-[10px] opacity-70">Drag tasks here or use the dropdown to assign tasks</p>
                  </div>
                ) : (
                  tasks.map((t, idx) => (
                    <TaskItemCard
                      key={t.id}
                      task={t}
                      index={idx}
                      onTaskClick={onTaskClick}
                      onRemoveFromSprint={onRemoveTask}
                    />
                  ))
                )}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </div>
      )}
    </div>
  );
};

// ── Main SprintBoard Page ──────────────────────────────────────────────────────
const SprintBoard = () => {
  const { workspace } = useContext(WorkspaceContext);

  const [activeTab,    setActiveTab  ] = useState('planning'); // 'planning' | 'board'
  const [sprints,      setSprints    ] = useState([]);
  const [allTasks,     setAllTasks   ] = useState([]);
  const [sprintTasks,  setSprintTasks] = useState({}); // { [sprintId]: Task[] }
  const [loading,      setLoading    ] = useState(true);
  const [syncing,      setSyncing    ] = useState(false);
  const [showCreate,   setShowCreate ] = useState(false);
  const [editingSprint, setEditingSprint] = useState(null);
  const [backlogFilter, setBacklogFilter] = useState('');
  const [shareSprint,  setShareSprint] = useState(null);
  
  // Slide panel state
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [isSlidePanelOpen, setIsSlidePanelOpen] = useState(false);

  // ── Load workspace sprints, tasks, and resolve mappings ───────────────────
  const load = useCallback(async (isSilent = false) => {
    if (!workspace?.id) return;
    if (!isSilent) setLoading(true);
    else setSyncing(true);
    try {
      const [s, t] = await Promise.all([
        getSprints(workspace.id),
        getAllTasks(workspace.id, null),
      ]);
      setSprints(s);
      setAllTasks(t.map(normalizeTask));
      
      // Load tasks mapping for all sprints
      const sprintTasksMap = {};
      await Promise.all(
        s.map(async (sprint) => {
          const tasks = await getSprintTasks(sprint.id);
          sprintTasksMap[sprint.id] = tasks.map(t => ({
            id: t.task_id || t.id,
            taskNumber: t.task_number || t.taskNumber,
            title: t.title,
            status: t.status,
            priority: t.priority,
            description: t.description || '',
            assignedTo: t.assigned_to ? (Array.isArray(t.assigned_to) ? t.assigned_to.map(a => ({
              id: a.id,
              name: a.name,
              profileImageUrl: a.avatar || a.profile_image_url
            })) : []) : []
          }));
        })
      );
      setSprintTasks(sprintTasksMap);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load Agile sprint data');
    } finally {
      setLoading(false);
      setSyncing(false);
    }
  }, [workspace?.id]);

  useEffect(() => { load(); }, [load]);

  // Determine active sprint
  const activeSprint = useMemo(() => {
    return sprints.find(s => s.status === 'active');
  }, [sprints]);

  // Planning view sprints (planning + active)
  const planningSprints = useMemo(() => {
    return sprints.filter(s => s.status === 'planning' || s.status === 'active');
  }, [sprints]);

  // Completed/Cancelled sprints
  const archivedSprints = useMemo(() => {
    return sprints.filter(s => s.status === 'completed' || s.status === 'cancelled');
  }, [sprints]);

  // Backlog tasks (tasks not in any sprint)
  const backlogTasks = useMemo(() => {
    const allSprintTaskIds = new Set(
      Object.values(sprintTasks).flat().map(t => t.id)
    );
    const filtered = allTasks.filter(t => !allSprintTaskIds.has(t.id));
    if (!backlogFilter.trim()) return filtered;
    return filtered.filter(t =>
      t.title.toLowerCase().includes(backlogFilter.toLowerCase()) ||
      (t.description && t.description.toLowerCase().includes(backlogFilter.toLowerCase()))
    );
  }, [allTasks, sprintTasks, backlogFilter]);

  // ── Actions ───────────────────────────────────────────────────────────────
  const handleStatusChange = async (id, status) => {
    try {
      // If we are starting a sprint, ensure we don't have multiple active sprints
      if (status === 'active' && activeSprint) {
        return toast.error('You already have an active sprint. Complete it before starting another.');
      }
      await updateSprintStatus(id, status);
      toast.success(`Sprint status updated to ${status}!`);
      load();
    } catch {
      toast.error('Failed to update sprint status');
    }
  };

  const handleDelete = async (id) => {
    try {
      await deleteSprint(id);
      toast.success('Sprint deleted');
      load();
    } catch {
      toast.error('Failed to delete sprint');
    }
  };

  const handleRemoveTask = async (sprintId, taskId) => {
    try {
      await removeTaskFromSprint(sprintId, taskId);
      // Update local state
      setSprintTasks(prev => ({
        ...prev,
        [sprintId]: (prev[sprintId] || []).filter(t => t.id !== taskId)
      }));
      toast.success('Task removed from sprint');
      load(true);
    } catch {
      toast.error('Failed to remove task');
    }
  };

  const handleAddTaskToSprint = async (sprintId, taskId) => {
    try {
      await addTaskToSprint(sprintId, taskId);
      // Trigger load to sync all properties correctly
      load(true);
      toast.success('Task added to sprint');
    } catch {
      toast.error('Failed to add task');
    }
  };

  // ── Drag & Drop handler for both tabs ─────────────────────────────────────
  const onDragEnd = async (result) => {
    const { source, destination, draggableId } = result;
    if (!destination) return;

    const srcId  = source.droppableId;
    const destId = destination.droppableId;

    if (srcId === destId && source.index === destination.index) return;

    // A: Planning Tab Interactions (Sprint Planning & Backlog allocation)
    if (activeTab === 'planning') {
      let movedTaskObj = null;
      if (srcId === 'backlog') {
        movedTaskObj = backlogTasks.find(t => t.id === draggableId);
      } else {
        movedTaskObj = (sprintTasks[srcId] || []).find(t => t.id === draggableId);
      }

      if (!movedTaskObj) return;

      // Optimistically update local state for a butter-smooth transition
      setSprintTasks(prev => {
        const next = { ...prev };
        if (srcId !== 'backlog') {
          next[srcId] = (next[srcId] || []).filter(t => t.id !== draggableId);
        }
        if (destId !== 'backlog') {
          next[destId] = [...(next[destId] || []), movedTaskObj];
        }
        return next;
      });

      try {
        // 1. Backlog → Sprint
        if (srcId === 'backlog' && destId !== 'backlog') {
          await addTaskToSprint(destId, draggableId);
          toast.success('Task added to sprint');
          load(true);
        }
        // 2. Sprint → Backlog
        else if (srcId !== 'backlog' && destId === 'backlog') {
          await removeTaskFromSprint(srcId, draggableId);
          toast.success('Task returned to Backlog');
          load(true);
        }
        // 3. Sprint A → Sprint B
        else if (srcId !== 'backlog' && destId !== 'backlog') {
          await removeTaskFromSprint(srcId, draggableId);
          await addTaskToSprint(destId, draggableId);
          toast.success('Task moved to new sprint');
          load(true);
        }
      } catch (err) {
        console.error(err);
        toast.error('Failed to move task');
        load(); // revert to correct db state
      }
    } 
    // B: Board Tab Interactions (Active Sprint Board Column status movement)
    else if (activeTab === 'board' && activeSprint) {
      // Find task to update status locally first (optimistic UI)
      const tasksInActiveSprint = sprintTasks[activeSprint.id] || [];
      const movedTask = tasksInActiveSprint.find(t => t.id === draggableId);
      if (!movedTask) return;

      const newStatus = destId; // destId will be Pending, In Progress, Completed

      try {
        // Update task status in database
        await updateTaskStatus(draggableId, newStatus);
        
        // Update local state
        setSprintTasks(prev => {
          const updatedTasks = (prev[activeSprint.id] || []).map(t => 
            t.id === draggableId ? { ...t, status: newStatus } : t
          );
          return { ...prev, [activeSprint.id]: updatedTasks };
        });

        // Also sync overall allTasks state
        setAllTasks(prev => prev.map(t => 
          t.id === draggableId ? { ...t, status: newStatus } : t
        ));

        toast.success(`Task moved to ${newStatus}`);
        load(true); // silent sync
      } catch (err) {
        console.error(err);
        toast.error('Failed to update task status');
        load();
      }
    }
  };

  const handleOpenTaskPanel = (id) => {
    setSelectedTaskId(id);
    setIsSlidePanelOpen(true);
  };

  return (
    <DashboardLayout activeMenu="Sprint Board">
      <div className="mt-4 pb-12 animate-fade-in font-sans">
        
        {/* Header Section */}
        <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
          <div>
            <h1 className="text-xl md:text-2xl font-extrabold text-slate-905 dark:text-zinc-100 tracking-tight flex items-center gap-2">
              🏃 Agile Sprint Board
              {syncing && (
                <span className="flex items-center gap-1.5 ml-2 px-2.5 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-950/40 text-indigo-650 dark:text-indigo-400 text-[10px] font-extrabold border border-indigo-150 dark:border-indigo-900/30 animate-pulse">
                  <LuLoaderCircle className="animate-spin text-indigo-500" size={10} />
                  Saving...
                </span>
              )}
            </h1>
            <p className="text-xs text-slate-400 dark:text-zinc-555 mt-1 font-bold uppercase tracking-wider">
              {workspace?.name} · <span className="text-indigo-650 dark:text-indigo-400">{sprints.length} Total Iteration{sprints.length !== 1 ? 's' : ''}</span>
            </p>
          </div>
          <div className="flex items-center gap-2.5">
            <RefreshButton id="sprint-refresh" onRefresh={load} label="Refresh" size="sm" />
            <button
              onClick={() => setShowCreate(true)}
              className="card-btn-fill flex items-center gap-1.5 text-xs font-bold transition cursor-pointer">
              <LuPlus size={14} /> New Sprint
            </button>
          </div>
        </div>

        {/* Tab switchers & metrics */}
        <div className="flex items-center justify-between border-b border-slate-200/60 dark:border-zinc-800/80 mb-6 flex-wrap gap-4">
          <div className="flex gap-4">
            <button
              onClick={() => setActiveTab('planning')}
              className={`flex items-center gap-1.5 py-3 text-xs font-bold uppercase tracking-wider transition-all border-b-2 cursor-pointer ${
                activeTab === 'planning'
                  ? 'border-indigo-600 text-indigo-600 dark:border-indigo-450 dark:text-indigo-400 font-extrabold'
                  : 'border-transparent text-slate-450 hover:text-slate-700 dark:hover:text-zinc-200'
              }`}
            >
              <LuLayers size={14} /> Backlog & Planning
            </button>
            <button
              onClick={() => setActiveTab('board')}
              className={`flex items-center gap-1.5 py-3 text-xs font-bold uppercase tracking-wider transition-all border-b-2 cursor-pointer ${
                activeTab === 'board'
                  ? 'border-indigo-600 text-indigo-600 dark:border-indigo-450 dark:text-indigo-400 font-extrabold'
                  : 'border-transparent text-slate-450 hover:text-slate-700 dark:hover:text-zinc-200'
              }`}
            >
              <LuLayoutGrid size={14} /> Active Sprint Board
              {activeSprint && (
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              )}
            </button>
          </div>

          {activeSprint && (
            <div className="flex items-center gap-2 pb-2 md:pb-0 text-slate-650 dark:text-zinc-400 text-xs font-bold">
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/20 text-emerald-605 dark:text-emerald-450 text-[10px] uppercase border border-emerald-250/25">
                Active Sprint
              </span>
              <span>{activeSprint.name}</span>
            </div>
          )}
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <LuLoaderCircle className="text-indigo-505 text-3xl animate-spin" />
            <p className="text-xs text-slate-455 dark:text-zinc-500 font-semibold uppercase tracking-wider">Syncing workspace iterations...</p>
          </div>
        ) : (
          <DragDropContext onDragEnd={onDragEnd}>
            {/* ──────── TAB 1: PLANNING & BACKLOG ──────── */}
            {activeTab === 'planning' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                
                {/* Left Pane: Sprints list (col-span-7) */}
                <div className="lg:col-span-7 space-y-5">
                  <div className="flex items-center justify-between">
                    <h2 className="font-extrabold text-sm text-slate-800 dark:text-zinc-200 uppercase tracking-wider flex items-center gap-1.5">
                      Iterations & Planning
                    </h2>
                    <span className="text-[11px] font-bold text-slate-400">
                      {planningSprints.length} Sprint{planningSprints.length !== 1 ? 's' : ''} in view
                    </span>
                  </div>

                  {planningSprints.length === 0 && archivedSprints.length === 0 ? (
                    <div className="card p-12 text-center border-dashed bg-slate-25/10 dark:bg-zinc-900/5">
                      <LuTarget size={42} className="mx-auto text-slate-300 dark:text-zinc-700 mb-3" />
                      <p className="font-extrabold text-slate-700 dark:text-zinc-200 text-sm uppercase tracking-wider">No Sprints Created</p>
                      <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">Create a sprint to organize your team's work into time-boxed iterations.</p>
                      <button onClick={() => setShowCreate(true)}
                        className="mt-4 card-btn-fill inline-flex items-center gap-1.5 text-xs">
                        <LuPlus size={14} /> Create First Sprint
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {planningSprints.map(sprint => (
                        <SprintPlanningPanel
                          key={sprint.id}
                          sprint={sprint}
                          sprintTasks={sprintTasks}
                          allTasks={allTasks}
                          onStatusChange={handleStatusChange}
                          onDelete={handleDelete}
                          onShare={s => setShareSprint({ id: s.id, name: s.name })}
                          onRemoveTask={tid => handleRemoveTask(sprint.id, tid)}
                          onTaskClick={handleOpenTaskPanel}
                          sprintsList={planningSprints}
                          onAddTaskToSprint={handleAddTaskToSprint}
                          onEdit={setEditingSprint}
                        />
                      ))}
                    </div>
                  )}

                  {/* Completed / Archived Sprints */}
                  {archivedSprints.length > 0 && (
                    <div className="mt-8 pt-6 border-t border-slate-200/60 dark:border-zinc-800/80">
                      <details className="group" open>
                        <summary className="flex items-center justify-between font-extrabold text-xs text-slate-450 hover:text-slate-700 dark:hover:text-zinc-300 uppercase tracking-wider cursor-pointer list-none select-none">
                          <span className="flex items-center gap-2">
                            📁 Completed & Archived Sprints ({archivedSprints.length})
                          </span>
                          <LuChevronDown size={14} className="transition-transform group-open:rotate-180" />
                        </summary>
                        <div className="space-y-4 mt-4">
                          {archivedSprints.map(sprint => (
                            <SprintPlanningPanel
                              key={sprint.id}
                              sprint={sprint}
                              sprintTasks={sprintTasks}
                              allTasks={allTasks}
                              onStatusChange={handleStatusChange}
                              onDelete={handleDelete}
                              onShare={s => setShareSprint({ id: s.id, name: s.name })}
                              onRemoveTask={tid => handleRemoveTask(sprint.id, tid)}
                              onTaskClick={handleOpenTaskPanel}
                              sprintsList={planningSprints}
                              onAddTaskToSprint={handleAddTaskToSprint}
                              onEdit={setEditingSprint}
                            />
                          ))}
                        </div>
                      </details>
                    </div>
                  )}
                </div>

                {/* Right Pane: Backlog Tasks (col-span-5) */}
                <div className="lg:col-span-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="font-extrabold text-sm text-slate-800 dark:text-zinc-200 uppercase tracking-wider flex items-center gap-1.5">
                      Workspace Backlog
                    </h2>
                    <span className="text-[11px] font-bold text-slate-400 bg-slate-100 dark:bg-zinc-900 px-2 py-0.5 rounded-full">
                      {backlogTasks.length} Task{backlogTasks.length !== 1 ? 's' : ''}
                    </span>
                  </div>

                  {/* Search filter */}
                  <div className="relative">
                    <LuSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                    <input
                      type="text"
                      placeholder="Filter backlog..."
                      value={backlogFilter}
                      onChange={e => setBacklogFilter(e.target.value)}
                      className="field-input pl-9 text-xs dark:bg-[#121215] dark:border-zinc-805 dark:text-zinc-250"
                    />
                    {backlogFilter && (
                      <button onClick={() => setBacklogFilter('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-655">
                        <LuX size={13} />
                      </button>
                    )}
                  </div>

                  {/* Backlog Droppable Area */}
                  <Droppable droppableId="backlog">
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={`flex flex-col gap-2 min-h-[350px] p-3 rounded-2xl border border-slate-200/50 dark:border-zinc-800/80 bg-slate-25/25 dark:bg-zinc-900/10 transition-all ${
                          snapshot.isDraggingOver ? 'bg-indigo-50/20 border-dashed border-indigo-200' : ''
                        }`}
                      >
                        {backlogTasks.length === 0 ? (
                          <div className="flex flex-col items-center justify-center py-20 text-center text-slate-400 dark:text-zinc-500">
                            <LuInbox size={32} className="mb-2 opacity-30" />
                            <p className="text-xs font-bold uppercase tracking-wider">Backlog Empty</p>
                            <p className="text-[10px] opacity-75 mt-1 max-w-xs">All workspace tasks are allocated, or match your search criteria.</p>
                          </div>
                        ) : (
                          backlogTasks.map((task, idx) => (
                            <TaskItemCard
                              key={task.id}
                              task={task}
                              index={idx}
                              onTaskClick={handleOpenTaskPanel}
                              sprintsList={planningSprints.filter(s => s.status === 'planning')}
                              onAddToSprint={handleAddTaskToSprint}
                            />
                          ))
                        )}
                        {provided.placeholder}
                      </div>
                    )}
                  </Droppable>
                </div>
              </div>
            )}

            {/* ──────── TAB 2: ACTIVE SPRINT KANBAN BOARD ──────── */}
            {activeTab === 'board' && (
              <div className="space-y-6">
                {!activeSprint ? (
                  <div className="card p-16 text-center max-w-xl mx-auto border border-slate-200/60 dark:border-zinc-800">
                    <LuLayoutGrid size={48} className="mx-auto text-indigo-505 mb-4 opacity-75" />
                    <h3 className="font-extrabold text-slate-800 dark:text-zinc-200 text-base uppercase tracking-wider">No Active Sprint</h3>
                    <p className="text-xs text-slate-505 dark:text-zinc-455 mt-2 max-w-md mx-auto leading-relaxed">
                      Active sprints power real-time Scrum tracking. Head to the Planning & Backlog tab to start one of your planning sprints.
                    </p>
                    <button
                      onClick={() => setActiveTab('planning')}
                      className="mt-5 card-btn-fill inline-flex items-center gap-1.5 text-xs font-bold cursor-pointer">
                      Go to Planning & Backlog
                    </button>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Active Sprint Summary card */}
                    <div className="p-5 border border-slate-200/60 dark:border-zinc-800/80 bg-white dark:bg-[#151518]/30 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <h2 className="text-base font-extrabold text-slate-805 dark:text-zinc-150 tracking-tight">{activeSprint.name}</h2>
                          <span className="text-[10px] font-bold text-slate-400 border border-slate-200 dark:border-zinc-800 rounded px-1.5 py-0.5">
                            {sprintTasks[activeSprint.id]?.length || 0} Task{(sprintTasks[activeSprint.id]?.length !== 1) ? 's' : ''}
                          </span>
                        </div>
                        {activeSprint.goal && (
                          <p className="text-xs text-slate-500 dark:text-zinc-400 mt-1 font-medium">{activeSprint.goal}</p>
                        )}
                        <p className="text-[10px] text-slate-450 dark:text-zinc-555 mt-1.5 font-bold uppercase tracking-wider flex items-center gap-1">
                          <LuCalendar size={11} />
                          {moment(activeSprint.start_date).format('MMM D, YYYY')} → {moment(activeSprint.end_date).format('MMM D, YYYY')}
                        </p>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setEditingSprint(activeSprint)}
                          className="p-2 rounded-xl border border-slate-205 dark:border-zinc-800 text-slate-450 hover:text-indigo-650 hover:border-indigo-300/40 dark:hover:text-indigo-400 transition cursor-pointer"
                          title="Edit Sprint Details"
                        >
                          <LuPen size={13} />
                        </button>
                        <button
                          onClick={() => { if (window.confirm('Delete this active sprint?')) handleDelete(activeSprint.id); }}
                          className="p-2 rounded-xl border border-slate-205 dark:border-zinc-800 text-slate-450 hover:text-rose-600 hover:border-rose-300/40 dark:hover:text-rose-455 transition cursor-pointer"
                          title="Delete Sprint"
                        >
                          <LuTrash2 size={13} />
                        </button>
                        <button
                          onClick={() => handleStatusChange(activeSprint.id, 'completed')}
                          className="card-btn-fill flex items-center gap-1.5 px-4 py-2 rounded-xl cursor-pointer"
                        >
                          <LuCheck size={14} /> Complete Sprint
                        </button>
                      </div>
                    </div>

                    {/* Columns Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                      {COLUMN_CONFIGS.map(col => {
                        const tasksInCol = (sprintTasks[activeSprint.id] || []).filter(t => t.status === col.id);
                        return (
                          <div key={col.id} className="flex flex-col min-h-[300px]">
                            {/* Column Header */}
                            <div className="flex items-center justify-between px-4 py-3 rounded-2xl bg-white dark:bg-[#121215] border border-slate-200/60 dark:border-zinc-800/80 mb-3 shadow-sm">
                              <div className="flex items-center gap-2">
                                <div className={`w-2.5 h-2.5 rounded-full ${col.color} shadow-sm`} />
                                <span className="font-extrabold text-sm text-slate-800 dark:text-zinc-200 tracking-tight">{col.label}</span>
                              </div>
                              <span className="text-xs font-extrabold text-slate-505 dark:text-zinc-455 bg-slate-50 dark:bg-zinc-900 border border-slate-200/50 dark:border-zinc-800 rounded-full px-2.5 py-0.5">
                                {tasksInCol.length}
                              </span>
                            </div>

                            {/* Droppable column */}
                            <Droppable droppableId={col.id}>
                              {(provided, snapshot) => (
                                <div
                                  ref={provided.innerRef}
                                  {...provided.droppableProps}
                                  className={`flex-1 flex flex-col gap-3 min-h-[150px] p-2.5 rounded-2xl transition-all duration-250 ${
                                    snapshot.isDraggingOver
                                      ? 'bg-indigo-50/35 border border-dashed border-indigo-200/60 dark:bg-indigo-950/5 dark:border-indigo-900/35'
                                      : 'bg-slate-50/20 dark:bg-zinc-900/10 border border-transparent'
                                  }`}
                                  key={col.id}
                                >
                                  {tasksInCol.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center py-12 rounded-2xl border-2 border-dashed border-slate-200/60 dark:border-zinc-800 bg-white/50 dark:bg-zinc-900/10 w-full">
                                      <p className="text-xs text-slate-400 dark:text-zinc-555 font-bold uppercase tracking-wider">Empty Column</p>
                                    </div>
                                  ) : (
                                    tasksInCol.map((task, index) => (
                                      <Draggable draggableId={task.id} index={index} key={task.id}>
                                        {(providedDraggable, snapshotDraggable) => (
                                          <div
                                            ref={providedDraggable.innerRef}
                                            {...providedDraggable.draggableProps}
                                            {...providedDraggable.dragHandleProps}
                                            onClick={() => handleOpenTaskPanel(task.id)}
                                            className={`bg-white dark:bg-[#151518] rounded-2xl border p-4 cursor-pointer transition w-full ${
                                              snapshotDraggable.isDragging
                                                ? 'shadow-xl rotate-1 scale-[1.01] border-indigo-400 bg-slate-25 dark:bg-zinc-900 ring-4 ring-indigo-500/5'
                                                : 'border-slate-200/70 hover:border-indigo-400 dark:border-zinc-800 dark:hover:border-zinc-700/80 hover:shadow-md'
                                            }`}
                                          >
                                            <div className="flex items-center gap-1.5 mb-2.5">
                                              <span className={`text-[8.5px] font-extrabold px-2 py-0.5 rounded capitalize ${PRIORITY_BADGES[task.priority] || 'bg-slate-105 text-slate-500'}`}>
                                                {task.priority}
                                              </span>
                                            </div>

                                            <h4 className="font-extrabold text-sm text-slate-805 dark:text-zinc-200 mb-1 leading-snug line-clamp-2 hover:text-indigo-655 dark:hover:text-indigo-400 transition-colors flex items-center gap-1.5">
                                              {task.taskNumber && (
                                                <span className="text-[10px] bg-slate-100 border border-slate-200 text-slate-650 px-1.5 py-0.5 rounded font-mono font-bold dark:bg-zinc-800 dark:border-zinc-700 dark:text-zinc-300">
                                                  {task.taskNumber}
                                                </span>
                                              )}
                                              {task.title}
                                            </h4>
                                            {task.description && (
                                              <p className="text-xs text-slate-450 dark:text-zinc-455 line-clamp-2 font-medium">
                                                {task.description}
                                              </p>
                                            )}

                                            <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100 dark:border-zinc-800/80">
                                              <div className="flex items-center gap-1 text-[9px] text-slate-400 font-bold uppercase tracking-wider">
                                                <LuInfo size={11} className="opacity-80" /> Details
                                              </div>

                                              {/* Assignees */}
                                              <div className="flex -space-x-1">
                                                {task.assignedTo?.slice(0, 3).map((a, i) => (
                                                  <div key={i} className="w-5 h-5 rounded-full border border-white dark:border-[#151518] overflow-hidden flex items-center justify-center bg-indigo-100 text-[8px] font-extrabold text-indigo-705 shadow-sm" title={a.name}>
                                                    {a.profileImageUrl ? (
                                                      <img src={a.profileImageUrl} alt={a.name} className="w-full h-full object-cover" />
                                                    ) : (
                                                      a.name?.[0]?.toUpperCase() || '?'
                                                    )}
                                                  </div>
                                                ))}
                                              </div>
                                            </div>
                                          </div>
                                        )}
                                      </Draggable>
                                    ))
                                  )}
                                  {provided.placeholder}
                                </div>
                              )}
                            </Droppable>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </DragDropContext>
        )}
      </div>

      {/* Create Sprint Modal */}
      {showCreate && (
        <CreateSprintModal
          onClose={() => setShowCreate(false)}
          onCreated={s => {
            setSprints(prev => [s, ...prev]);
            load();
          }}
          sprintsCount={sprints.length}
        />
      )}

      {/* Edit Sprint Modal */}
      {editingSprint && (
        <EditSprintModal
          sprint={editingSprint}
          onClose={() => setEditingSprint(null)}
          onUpdated={load}
        />
      )}

      {/* Share Board Modal */}
      {shareSprint && (
        <ShareBoardModal
          isOpen={!!shareSprint}
          onClose={() => setShareSprint(null)}
          workspaceId={workspace?.id}
          sprintId={shareSprint?.id}
          sprintName={shareSprint?.name}
        />
      )}

      {/* Slide-over task detail panel */}
      <TaskSlidePanel
        taskId={selectedTaskId}
        isOpen={isSlidePanelOpen}
        onClose={() => setIsSlidePanelOpen(false)}
        onSuccess={load}
      />
    </DashboardLayout>
  );
};

export default SprintBoard;
