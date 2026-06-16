import React, { useContext, useEffect, useState, useCallback } from 'react';
import DashboardLayout from '../../components/layouts/DashboardLayout';
import { WorkspaceContext } from '../../context/WorkspaceContext';
import { UserContext }      from '../../context/userContext';
import {
  LuPlus, LuLoaderCircle, LuPlay, LuSquare, LuCheck,
  LuTrash2, LuCalendar, LuFlag, LuX, LuTarget,
} from 'react-icons/lu';
import {
  getSprints, createSprint, updateSprintStatus,
  deleteSprint, getSprintTasks, addTaskToSprint, removeTaskFromSprint,
} from '../../services/sprintService';
import { getAllTasks, normalizeTask } from '../../services/taskService';
import RefreshButton from '../../components/RefreshButton';
import toast from 'react-hot-toast';
import moment from 'moment';

// ─────────────────────────────────────────────────────────────────────────────
// SprintBoard — Phase 13
// ─────────────────────────────────────────────────────────────────────────────

const STATUS_COLORS = {
  planning:  'bg-slate-100 text-slate-600 border-slate-200',
  active:    'bg-green-50  text-green-600  border-green-200',
  completed: 'bg-indigo-50 text-indigo-600 border-indigo-200',
  cancelled: 'bg-red-50    text-red-500    border-red-200',
};

const PRIORITY_DOT = { high: '#ef4444', medium: '#f59e0b', low: '#22c55e' };

// ── Create Sprint Modal ───────────────────────────────────────────────────────
const CreateSprintModal = ({ onClose, onCreated }) => {
  const { workspace } = useContext(WorkspaceContext);
  const { user }      = useContext(UserContext);
  const [form, setForm] = useState({ name: '', goal: '', startDate: '', endDate: '' });
  const [busy, setBusy] = useState(false);

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
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-card" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-slate-800">Create Sprint</h2>
          <button className="text-slate-400 hover:text-slate-600" onClick={onClose}><LuX size={18} /></button>
        </div>
        <form onSubmit={handle} className="space-y-4">
          <div>
            <label className="modal-label">Sprint Name *</label>
            <input className="modal-input" placeholder="e.g. Sprint 1 — Auth Module"
              value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
          </div>
          <div>
            <label className="modal-label">Sprint Goal</label>
            <textarea className="modal-input" rows={2} placeholder="What should this sprint achieve?"
              value={form.goal} onChange={e => setForm(f => ({ ...f, goal: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="modal-label">Start Date</label>
              <input type="date" className="modal-input"
                value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} />
            </div>
            <div>
              <label className="modal-label">End Date</label>
              <input type="date" className="modal-input"
                value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="card-btn flex-1">Cancel</button>
            <button type="submit" disabled={busy}
              className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-500 to-violet-600 text-white font-semibold text-sm rounded-xl py-2.5 transition hover:opacity-90">
              {busy ? <LuLoaderCircle size={14} className="animate-spin" /> : <LuPlus size={14} />}
              Create Sprint
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ── Sprint Card ───────────────────────────────────────────────────────────────
const SprintCard = ({ sprint, allTasks, onStatusChange, onDelete, onRefresh }) => {
  const [tasks,       setTasks      ] = useState([]);
  const [loadingT,    setLoadingT   ] = useState(false);
  const [expanded,    setExpanded   ] = useState(sprint.status === 'active');
  const [addingTask,  setAddingTask ] = useState(false);
  const [selectedTask, setSelectedTask] = useState('');

  const loadTasks = useCallback(async () => {
    setLoadingT(true);
    try { setTasks(await getSprintTasks(sprint.id)); }
    catch { }
    finally { setLoadingT(false); }
  }, [sprint.id]);

  useEffect(() => { if (expanded) loadTasks(); }, [expanded, loadTasks]);

  const handleAddTask = async () => {
    if (!selectedTask) return;
    try {
      await addTaskToSprint(sprint.id, selectedTask);
      setSelectedTask('');
      setAddingTask(false);
      await loadTasks();
      toast.success('Task added to sprint');
    } catch { toast.error('Failed to add task'); }
  };

  const handleRemoveTask = async (taskId) => {
    try {
      await removeTaskFromSprint(sprint.id, taskId);
      setTasks(prev => prev.filter(t => t.task_id !== taskId && t.id !== taskId));
    } catch { toast.error('Failed to remove task'); }
  };

  const completed = tasks.filter(t => t.status === 'Completed').length;
  const progress  = tasks.length > 0 ? Math.round((completed / tasks.length) * 100) : 0;

  const sprintTasks = tasks.map(t => ({
    id:       t.task_id || t.id,
    title:    t.title,
    status:   t.status,
    priority: t.priority,
  }));

  // Tasks not yet in this sprint
  const availableTasks = allTasks.filter(t =>
    !sprintTasks.some(st => st.id === t.id)
  );

  return (
    <div className="sprint-card">
      {/* Header */}
      <div className="sprint-card-header" onClick={() => setExpanded(v => !v)}>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="sprint-card-name">{sprint.name}</h3>
            <span className={`sprint-status-badge ${STATUS_COLORS[sprint.status]}`}>
              {sprint.status}
            </span>
          </div>
          {sprint.goal && <p className="sprint-card-goal">{sprint.goal}</p>}
          {(sprint.start_date || sprint.end_date) && (
            <p className="sprint-card-dates">
              <LuCalendar size={11} />
              {sprint.start_date ? moment(sprint.start_date).format('MMM D') : '?'}
              {' → '}
              {sprint.end_date ? moment(sprint.end_date).format('MMM D') : '?'}
            </p>
          )}
        </div>
        {/* Progress + actions */}
        <div className="flex items-center gap-2 ml-4" onClick={e => e.stopPropagation()}>
          {tasks.length > 0 && (
            <div className="sprint-progress-wrap">
              <span className="sprint-progress-pct">{progress}%</span>
              <div className="sprint-progress-bar">
                <div className="sprint-progress-fill" style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}
          {sprint.status === 'planning' && (
            <button className="sprint-action-btn sprint-action-btn--green"
              onClick={() => onStatusChange(sprint.id, 'active')}
              title="Start Sprint"><LuPlay size={12} /></button>
          )}
          {sprint.status === 'active' && (
            <button className="sprint-action-btn sprint-action-btn--indigo"
              onClick={() => onStatusChange(sprint.id, 'completed')}
              title="Complete Sprint"><LuCheck size={12} /></button>
          )}
          <button className="sprint-action-btn sprint-action-btn--red"
            onClick={() => { if (window.confirm('Delete this sprint?')) onDelete(sprint.id); }}
            title="Delete Sprint"><LuTrash2 size={12} /></button>
        </div>
      </div>

      {/* Expanded task list */}
      {expanded && (
        <div className="sprint-tasks-section">
          {loadingT ? (
            <div className="flex justify-center py-4">
              <LuLoaderCircle className="animate-spin text-indigo-400" size={20} />
            </div>
          ) : (
            <>
              {sprintTasks.length === 0 && (
                <p className="text-xs text-slate-400 text-center py-3">No tasks in this sprint yet.</p>
              )}
              <div className="space-y-1.5">
                {sprintTasks.map(t => (
                  <div key={t.id} className="sprint-task-row group">
                    <span className="sprint-task-dot" style={{ background: PRIORITY_DOT[t.priority] || '#94a3b8' }} />
                    <span className="sprint-task-title">{t.title}</span>
                    <span className={`sprint-task-status ${
                      t.status === 'Completed'   ? 'text-emerald-600 bg-emerald-50 border-emerald-200'
                      : t.status === 'In Progress' ? 'text-cyan-600 bg-cyan-50 border-cyan-200'
                      : 'text-amber-600 bg-amber-50 border-amber-200'
                    }`}>{t.status}</span>
                    <button className="sprint-task-remove opacity-0 group-hover:opacity-100"
                      onClick={() => handleRemoveTask(t.id)}
                      title="Remove from sprint"><LuX size={10} /></button>
                  </div>
                ))}
              </div>

              {/* Add task */}
              {addingTask ? (
                <div className="flex gap-2 mt-3">
                  <select className="modal-input flex-1 py-1.5 text-xs"
                    value={selectedTask} onChange={e => setSelectedTask(e.target.value)}>
                    <option value="">Select a task…</option>
                    {availableTasks.map(t => (
                      <option key={t.id} value={t.id}>{t.title}</option>
                    ))}
                  </select>
                  <button onClick={handleAddTask}
                    className="text-xs font-semibold bg-indigo-600 text-white px-3 rounded-lg">Add</button>
                  <button onClick={() => setAddingTask(false)}
                    className="text-xs font-semibold text-slate-500 px-2">✕</button>
                </div>
              ) : (
                <button className="sprint-add-task-btn" onClick={() => setAddingTask(true)}>
                  <LuPlus size={12} /> Add Task
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

// ── Main Page ─────────────────────────────────────────────────────────────────
const SprintBoard = () => {
  const { workspace } = useContext(WorkspaceContext);
  const [sprints,    setSprints    ] = useState([]);
  const [allTasks,   setAllTasks   ] = useState([]);
  const [loading,    setLoading    ] = useState(true);
  const [showCreate, setShowCreate ] = useState(false);
  const [filterSt,   setFilterSt  ] = useState('all');

  const load = useCallback(async () => {
    if (!workspace?.id) return;
    setLoading(true);
    try {
      const [s, t] = await Promise.all([
        getSprints(workspace.id),
        getAllTasks(workspace.id, null),
      ]);
      setSprints(s);
      setAllTasks(t.map(normalizeTask));
    } catch { toast.error('Failed to load sprints'); }
    finally { setLoading(false); }
  }, [workspace?.id]);

  useEffect(() => { load(); }, [load]);

  const handleStatusChange = async (id, status) => {
    try {
      await updateSprintStatus(id, status);
      setSprints(prev => prev.map(s => s.id === id ? { ...s, status } : s));
      toast.success(`Sprint ${status}!`);
    } catch { toast.error('Failed to update sprint'); }
  };

  const handleDelete = async (id) => {
    try {
      await deleteSprint(id);
      setSprints(prev => prev.filter(s => s.id !== id));
      toast.success('Sprint deleted');
    } catch { toast.error('Failed to delete sprint'); }
  };

  const displayed = filterSt === 'all'
    ? sprints
    : sprints.filter(s => s.status === filterSt);

  const STATUS_TABS = ['all', 'planning', 'active', 'completed', 'cancelled'];

  return (
    <DashboardLayout activeMenu="Sprint Board">
      <div className="my-5 pb-12">

        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3 mb-6">
          <div>
            <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight">🏃 Sprint Board</h1>
            <p className="text-sm text-slate-400 mt-0.5">{workspace?.name} · {sprints.length} sprints</p>
          </div>
          <div className="flex items-center gap-2">
            <RefreshButton id="sprint-refresh" onRefresh={load} label="Refresh" size="sm" />
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 text-sm font-semibold text-white bg-gradient-to-r from-indigo-500 to-violet-600 rounded-xl px-4 py-2 hover:opacity-90 shadow-sm shadow-indigo-500/20">
              <LuPlus size={14} /> New Sprint
            </button>
          </div>
        </div>

        {/* KPI chips */}
        <div className="flex flex-wrap gap-2 mb-5">
          {['all','planning','active','completed','cancelled'].map(s => (
            <button key={s} onClick={() => setFilterSt(s)}
              className={`text-xs font-semibold px-3.5 py-1.5 rounded-full border transition-all capitalize ${
                filterSt === s
                  ? 'bg-indigo-600 text-white border-indigo-600'
                  : 'bg-white text-slate-600 border-slate-200 hover:border-indigo-300'
              }`}>
              {s === 'all' ? `All (${sprints.length})` : `${s} (${sprints.filter(x => x.status === s).length})`}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <LuLoaderCircle className="text-indigo-500 text-3xl animate-spin" />
          </div>
        ) : displayed.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200/50 shadow-sm p-12 text-center">
            <LuTarget className="text-slate-300 text-5xl mx-auto mb-3" />
            <p className="text-slate-500 font-medium">No sprints yet.</p>
            <p className="text-sm text-slate-400 mt-1">Create your first sprint to start organising tasks into time-boxed iterations.</p>
            <button onClick={() => setShowCreate(true)}
              className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-indigo-600 bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-2 hover:bg-indigo-100 transition">
              <LuPlus size={13} /> Create Sprint
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {displayed.map(sprint => (
              <SprintCard
                key={sprint.id}
                sprint={sprint}
                allTasks={allTasks}
                onStatusChange={handleStatusChange}
                onDelete={handleDelete}
                onRefresh={load}
              />
            ))}
          </div>
        )}
      </div>

      {showCreate && (
        <CreateSprintModal
          onClose={() => setShowCreate(false)}
          onCreated={s => setSprints(prev => [s, ...prev])}
        />
      )}
    </DashboardLayout>
  );
};

export default SprintBoard;
