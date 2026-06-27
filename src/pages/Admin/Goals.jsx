import React, { useState, useEffect, useContext } from 'react';
import DashboardLayout from '../../components/layouts/DashboardLayout';
import { WorkspaceContext } from '../../context/WorkspaceContext';
import { supabase } from '../../utils/supabaseClient';
import usePermissions from '../../hooks/usePermissions';
import { getGoals, createGoal, updateGoal, deleteGoal } from '../../services/goalService';
import GoalProgressRing from '../../components/GoalProgressRing';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import {
  LuPlus, LuPencil, LuTrash2, LuLoaderCircle, LuTarget,
  LuX, LuSave, LuCalendar, LuUser, LuCheck, LuArrowRight
} from 'react-icons/lu';

const IT_GOAL_TEMPLATES = [
  {
    name: "🚀 Release Software Version",
    title: "Release Version 2.0.0",
    description: "Successfully build, test, and deploy the v2.0 upgrade containing key user features and performance optimizations."
  },
  {
    name: "⚡ Infrastructure & Uptime",
    title: "Optimize Server Performance & SLA Uptime",
    description: "Maintain 99.95% system availability and reduce API latency under peak loads."
  },
  {
    name: "🐛 Bug & Technical Debt Reduction",
    title: "Clear Bug Backlog & Technical Debt",
    description: "Resolve critical production bugs, refactor outdated legacy components, and improve code health scores."
  },
  {
    name: "🧪 Code Coverage & Quality",
    title: "Increase Test Coverage & CI/CD Integrity",
    description: "Write comprehensive unit and integration tests to hit 85% code coverage threshold in CI pipelines."
  }
];

const Goals = () => {
  const { workspace } = useContext(WorkspaceContext);
  const perms = usePermissions();
  const navigate = useNavigate();

  const [goals, setGoals] = useState([]);
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState('active'); // active | completed | cancelled | all
  const [viewMode, setViewMode] = useState('list'); // list | roadmap

  // Modals state
  const [showCreate, setShowCreate] = useState(false);
  const [editGoalObj, setEditGoalObj] = useState(null); // goal to edit
  const [delConfirm, setDelConfirm] = useState(null); // goal id to delete

  // Form fields
  const [fTitle, setFTitle] = useState('');
  const [fDesc, setFDesc] = useState('');
  const [fOwnerId, setFOwnerId] = useState('');
  const [fStartDate, setFStartDate] = useState('');
  const [fDueDate, setFDueDate] = useState('');
  const [saving, setSaving] = useState(false);

  const loadGoals = async () => {
    if (!workspace?.id) return;
    setLoading(true);
    try {
      const data = await getGoals(workspace.id);
      setGoals(data || []);
    } catch (err) {
      toast.error('Failed to load goals');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const loadMembers = async () => {
    if (!workspace?.id) return;
    try {
      const { data } = await supabase
        .from('workspace_members')
        .select('user_id, profiles(id, name, profile_image_url)')
        .eq('workspace_id', workspace.id);
      setMembers((data || []).map(m => m.profiles).filter(Boolean));
    } catch (err) {
      console.error('Failed to load members', err);
    }
  };

  useEffect(() => {
    loadGoals();
    loadMembers();
  }, [workspace?.id]);

  const openCreate = () => {
    setFTitle('');
    setFDesc('');
    setFOwnerId('');
    setFStartDate('');
    setFDueDate('');
    setEditGoalObj(null);
    setShowCreate(true);
  };

  const openEdit = (e, goal) => {
    e.stopPropagation();
    setFTitle(goal.title);
    setFDesc(goal.description || '');
    setFOwnerId(goal.owner_id || '');
    setFStartDate(goal.start_date || '');
    setFDueDate(goal.due_date || '');
    setEditGoalObj(goal);
    setShowCreate(true);
  };

  const handleSaveGoal = async (e) => {
    e.preventDefault();
    if (!fTitle.trim()) return toast.error('Goal title is required.');
    setSaving(true);
    try {
      if (editGoalObj) {
        await updateGoal(editGoalObj.id, {
          title: fTitle,
          description: fDesc,
          ownerId: fOwnerId || null,
          startDate: fStartDate || null,
          dueDate: fDueDate || null,
          status: editGoalObj.status
        });
        toast.success('Goal updated successfully!');
      } else {
        await createGoal(workspace.id, {
          title: fTitle,
          description: fDesc,
          ownerId: fOwnerId || null,
          startDate: fStartDate || null,
          dueDate: fDueDate || null
        });
        toast.success('Goal created successfully!');
      }
      setShowCreate(false);
      loadGoals();
    } catch (err) {
      toast.error(err.message || 'Error saving goal');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteGoal = async () => {
    if (!delConfirm) return;
    try {
      await deleteGoal(delConfirm);
      toast.success('Goal deleted.');
      setDelConfirm(null);
      loadGoals();
    } catch (err) {
      toast.error(err.message || 'Error deleting goal');
    }
  };

  const updateGoalStatus = async (e, goal, newStatus) => {
    e.stopPropagation();
    try {
      await updateGoal(goal.id, {
        title: goal.title,
        description: goal.description,
        ownerId: goal.owner_id,
        startDate: goal.start_date,
        dueDate: goal.due_date,
        status: newStatus
      });
      toast.success(`Goal marked as ${newStatus}`);
      loadGoals();
    } catch (err) {
      toast.error(err.message || 'Error updating status');
    }
  };

  // Filter goals
  const filteredGoals = goals.filter((g) => {
    if (filter === 'all') return true;
    return g.status === filter;
  });

  return (
    <DashboardLayout activeMenu="Goals">
      <div className="mt-5 mb-10 px-4 md:px-0 font-sans">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-xl md:text-2xl font-extrabold text-slate-905 dark:text-zinc-100 tracking-tight">🎯 Goals & OKRs</h1>
            <p className="text-xs text-slate-400 dark:text-zinc-550 mt-1.5 font-bold uppercase tracking-wider">
              {workspace?.name} · Align daily tasks with strategic key results
            </p>
          </div>
          {perms.isAdmin && (
            <button onClick={openCreate} className="card-btn-fill flex items-center justify-center gap-1.5 text-xs">
              <LuPlus size={14}/> New Goal
            </button>
          )}
        </div>
        {/* Stats Banner */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="card !p-5 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-extrabold text-slate-400 dark:text-zinc-550 uppercase tracking-widest">Total Goals</span>
              <h3 className="text-2xl font-black text-slate-800 dark:text-zinc-100 mt-1">{goals.length}</h3>
            </div>
            <div className="p-3 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-500 rounded-xl">
              <LuTarget size={20} />
            </div>
          </div>
          <div className="card !p-5 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-extrabold text-slate-400 dark:text-zinc-550 uppercase tracking-widest">Active Objectives</span>
              <h3 className="text-2xl font-black text-slate-800 dark:text-zinc-100 mt-1">{goals.filter(g => g.status === 'active').length}</h3>
            </div>
            <div className="p-3 bg-amber-50 dark:bg-amber-950/40 text-amber-500 rounded-xl">
              <LuLoaderCircle className="animate-spin-slow" size={20} />
            </div>
          </div>
          <div className="card !p-5 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-extrabold text-slate-400 dark:text-zinc-550 uppercase tracking-widest">Completed</span>
              <h3 className="text-2xl font-black text-slate-800 dark:text-zinc-100 mt-1">{goals.filter(g => g.status === 'completed').length}</h3>
            </div>
            <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-500 rounded-xl">
              <LuCheck size={20} />
            </div>
          </div>
          <div className="card !p-5 flex items-center justify-between">
            <div>
              <span className="text-[10px] font-extrabold text-slate-400 dark:text-zinc-550 uppercase tracking-widest">Avg. Progress</span>
              <h3 className="text-2xl font-black text-slate-800 dark:text-zinc-100 mt-1">
                {goals.length > 0 ? Math.round(goals.reduce((acc, curr) => acc + curr.progress, 0) / goals.length) : 0}%
              </h3>
            </div>
            <div className="p-3 bg-violet-50 dark:bg-violet-950/40 text-violet-500 rounded-xl">
              <div className="w-5 h-5 flex items-center justify-center font-extrabold text-xs text-violet-650 dark:text-violet-400">
                %
              </div>
            </div>
          </div>
        </div>

        {/* View Mode & Tab filters */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-1 bg-slate-100/60 dark:bg-zinc-900/40 p-1 rounded-xl w-fit border border-slate-205 dark:border-zinc-800/80">
            {['active', 'completed', 'cancelled', 'all'].map((tab) => (
              <button
                key={tab}
                onClick={() => setFilter(tab)}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold capitalize transition-all cursor-pointer ${
                  filter === tab
                    ? 'bg-white dark:bg-zinc-800 text-indigo-650 dark:text-indigo-455 shadow-sm'
                    : 'text-slate-500 dark:text-zinc-450 hover:text-slate-705 dark:hover:text-zinc-200'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 bg-slate-100/60 dark:bg-zinc-900/40 p-1 rounded-xl w-fit border border-slate-205 dark:border-zinc-800/80">
            <button
              onClick={() => setViewMode('list')}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'list'
                  ? 'bg-white dark:bg-zinc-800 text-indigo-650 dark:text-indigo-455 shadow-sm'
                  : 'text-slate-500 dark:text-zinc-450 hover:text-slate-705 dark:hover:text-zinc-200'
              }`}
            >
              List View
            </button>
            <button
              onClick={() => setViewMode('roadmap')}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                viewMode === 'roadmap'
                  ? 'bg-white dark:bg-zinc-800 text-indigo-650 dark:text-indigo-455 shadow-sm'
                  : 'text-slate-500 dark:text-zinc-450 hover:text-slate-705 dark:hover:text-zinc-200'
              }`}
            >
              Roadmap View
            </button>
          </div>
        </div>

        {/* Goal Content */}
        {loading ? (
          <div className="flex justify-center py-20">
            <LuLoaderCircle className="animate-spin text-indigo-500" size={32}/>
          </div>
        ) : filteredGoals.length === 0 ? (
          <div className="text-center py-16 card">
            <LuTarget size={48} className="mx-auto text-slate-350 dark:text-zinc-650 mb-3 animate-pulse"/>
            <h3 className="text-lg font-bold text-slate-800 dark:text-zinc-200">No goals found</h3>
            <p className="text-slate-455 dark:text-zinc-500 text-xs md:text-sm max-w-sm mx-auto mt-2 font-medium">
              Objectives help connect project execution with high-level milestones. Link your key results to track tasks automatically.
            </p>
            {perms.isAdmin && (
              <button onClick={openCreate} className="card-btn-fill mt-5 inline-flex items-center gap-2 mx-auto">
                <LuPlus size={14}/> Create Your First Goal
              </button>
            )}
          </div>
        ) : viewMode === 'list' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredGoals.map((goal) => (
              <div
                key={goal.id}
                onClick={() => navigate(`/admin/goals/${goal.id}`)}
                className="group relative flex flex-col justify-between card cursor-pointer transition-all duration-250 hover:-translate-y-0.5"
              >
                <div>
                  {/* Status Indicator */}
                  <div className="flex items-center justify-between mb-4">
                    <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider border ${
                      goal.status === 'active' ? 'bg-indigo-50 text-indigo-650 dark:bg-indigo-950/40 dark:text-indigo-400 border-indigo-100/30' :
                      goal.status === 'completed' ? 'bg-emerald-50 text-emerald-650 dark:bg-emerald-950/40 dark:text-emerald-400 border-emerald-100/30' :
                      'bg-slate-50 text-slate-450 dark:bg-zinc-800 dark:text-zinc-400 border-zinc-700'
                    }`}>
                      {goal.status}
                    </span>
                    
                    {/* Admin Actions */}
                    {perms.isAdmin && (
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {goal.status === 'active' && (
                          <button
                            onClick={(e) => updateGoalStatus(e, goal, 'completed')}
                            className="p-1.5 rounded-lg text-slate-400 dark:text-zinc-500 hover:text-emerald-600 dark:hover:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 transition-colors cursor-pointer"
                            title="Complete Goal"
                          >
                            <LuCheck size={14}/>
                          </button>
                        )}
                        <button
                          onClick={(e) => openEdit(e, goal)}
                          className="p-1.5 rounded-lg text-slate-400 dark:text-zinc-500 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 transition-colors cursor-pointer"
                          title="Edit"
                        >
                          <LuPencil size={14}/>
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); setDelConfirm(goal.id); }}
                          className="p-1.5 rounded-lg text-slate-400 dark:text-zinc-500 hover:text-rose-600 dark:hover:text-rose-455 hover:bg-rose-50 dark:hover:bg-rose-955/20 transition-colors cursor-pointer"
                          title="Delete"
                        >
                          <LuTrash2 size={14}/>
                        </button>
                      </div>
                    )}
                  </div>

                  <h3 className="font-extrabold text-slate-850 dark:text-zinc-200 text-base group-hover:text-indigo-650 dark:group-hover:text-indigo-400 transition-colors line-clamp-1">
                    {goal.title}
                  </h3>
                  <p className="text-slate-455 dark:text-zinc-500 text-xs mt-1.5 line-clamp-2 min-h-[40px] font-semibold leading-relaxed">
                    {goal.description || 'No description provided.'}
                  </p>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-100 dark:border-zinc-800/80 flex items-center justify-between">
                  {/* Progress and KRs count */}
                  <div className="flex items-center gap-4">
                    <GoalProgressRing progress={goal.progress} size={64} strokeWidth={6} />
                    <div className="flex flex-col">
                      <span className="text-[9px] font-extrabold text-slate-400 dark:text-zinc-550 uppercase tracking-wider">Key Results</span>
                      <span className="text-xs font-extrabold text-slate-700 dark:text-zinc-300">{goal.kr_count || 0} Defined</span>
                    </div>
                  </div>

                  {/* Owner info */}
                  <div className="flex flex-col items-end">
                    <span className="text-[9px] font-extrabold text-slate-400 dark:text-zinc-550 uppercase tracking-wider mb-1.5">Owner</span>
                    <div className="flex items-center gap-1.5">
                      {goal.owner_avatar ? (
                        <img src={goal.owner_avatar} alt={goal.owner_name} className="w-5.5 h-5.5 rounded-full object-cover border border-slate-100 dark:border-zinc-850" />
                      ) : (
                        <div className="w-5.5 h-5.5 rounded-full bg-indigo-50 dark:bg-indigo-950/50 flex items-center justify-center text-[10px] font-bold text-indigo-500">
                          {goal.owner_name ? goal.owner_name.charAt(0).toUpperCase() : '—'}
                        </div>
                      )}
                      <span className="text-xs font-semibold text-slate-650 dark:text-zinc-400 truncate max-w-[80px]">
                        {goal.owner_name || 'Unassigned'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Hover card indicator */}
                <div className="absolute top-6 right-6 text-slate-305 dark:text-zinc-700 group-hover:text-indigo-500 dark:group-hover:text-indigo-400 transition-colors opacity-0 group-hover:opacity-100">
                  <LuArrowRight size={16}/>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Roadmap View */
          <div className="card !p-6 overflow-x-auto">
            <div className="min-w-[800px]">
              {/* Timeline Header */}
              <div className="grid grid-cols-12 border-b border-slate-100 dark:border-zinc-800/80 pb-3 mb-4 text-[10px] font-extrabold text-slate-400 dark:text-zinc-500 uppercase tracking-widest">
                <div className="col-span-3">Goal Objective</div>
                <div className="col-span-9 grid grid-cols-12 gap-1 text-center">
                  <div>Jan</div>
                  <div>Feb</div>
                  <div>Mar</div>
                  <div>Apr</div>
                  <div>May</div>
                  <div>Jun</div>
                  <div>Jul</div>
                  <div>Aug</div>
                  <div>Sep</div>
                  <div>Oct</div>
                  <div>Nov</div>
                  <div>Dec</div>
                </div>
              </div>
              
              {/* Timeline Rows */}
              <div className="flex flex-col gap-4">
                {filteredGoals.map((goal) => {
                  const startMonth = goal.start_date ? new Date(goal.start_date).getMonth() : 0;
                  const endMonth = goal.due_date ? new Date(goal.due_date).getMonth() : 11;
                  const gridStart = startMonth + 1;
                  const gridSpan = Math.max(1, endMonth - startMonth + 1);

                  return (
                    <div
                      key={goal.id}
                      onClick={() => navigate(`/admin/goals/${goal.id}`)}
                      className="grid grid-cols-12 items-center hover:bg-slate-50/50 dark:hover:bg-zinc-900/30 p-2.5 rounded-xl cursor-pointer transition-colors"
                    >
                      <div className="col-span-3 pr-4">
                        <p className="text-xs font-bold text-slate-800 dark:text-zinc-200 truncate">{goal.title}</p>
                        <span className="text-[9px] text-slate-450 dark:text-zinc-550 font-bold uppercase">{goal.progress}% completed</span>
                      </div>
                      
                      <div className="col-span-9 grid grid-cols-12 gap-1 relative h-6">
                        {Array.from({ length: 12 }).map((_, i) => (
                          <div key={i} className="border-r border-slate-100 dark:border-zinc-800/60 h-full first:border-l dark:first:border-zinc-800/60" />
                        ))}
                        
                        <div
                          style={{
                            gridColumnStart: gridStart,
                            gridColumnEnd: gridStart + gridSpan,
                          }}
                          className="absolute inset-y-0.5 rounded-lg bg-brand-bg border border-brand-border flex items-center px-3 shadow-[0_1px_2px_rgba(99,102,241,0.06)] overflow-hidden"
                        >
                          <div
                            className="absolute left-0 top-0 bottom-0 bg-indigo-500/20 dark:bg-indigo-400/25 transition-all duration-300"
                            style={{ width: `${goal.progress}%` }}
                          />
                          <span className="text-[9px] font-black text-brand-text truncate z-10">
                            {goal.progress}% • {goal.title}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Create / Edit Objective Modal */}
      {showCreate && (
        <Modal title={editGoalObj ? 'Edit Goal' : 'Create Goal'} onClose={() => setShowCreate(false)}>
          <form onSubmit={handleSaveGoal} className="flex flex-col gap-4">
            {!editGoalObj && (
              <div className="bg-slate-50 dark:bg-[#121215] p-3.5 rounded-xl border border-slate-200 dark:border-zinc-800/80 mb-1">
                <span className="text-[10px] font-extrabold text-slate-550 dark:text-zinc-400 uppercase tracking-widest block mb-2.5">IT / Engineering Goal Templates</span>
                <div className="grid grid-cols-1 gap-1.5">
                  {IT_GOAL_TEMPLATES.map((tmpl, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setFTitle(tmpl.title);
                        setFDesc(tmpl.description);
                      }}
                      className="text-left text-xs font-semibold text-slate-700 dark:text-zinc-300 hover:text-indigo-650 dark:hover:text-indigo-400 hover:bg-white dark:hover:bg-[#161619] p-2 rounded-lg border border-transparent hover:border-slate-200 dark:hover:border-zinc-800/80 transition-all flex items-center justify-between cursor-pointer"
                    >
                      <span>{tmpl.name}</span>
                      <span className="text-[9px] text-slate-400 dark:text-zinc-500 border border-slate-200 dark:border-zinc-800 px-1.5 py-0.5 rounded-md font-bold uppercase hover:bg-slate-50 dark:hover:bg-zinc-800">Apply</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label className="field-label">Goal Title *</label>
              <input
                value={fTitle}
                onChange={e => setFTitle(e.target.value)}
                placeholder="e.g. Release SaaS Version 2.0.0"
                className="field-input"
                required
              />
            </div>
            
            <div>
              <label className="field-label">Description</label>
              <textarea
                value={fDesc}
                onChange={e => setFDesc(e.target.value)}
                placeholder="e.g. Deploy core modules of the project to production with 99.9% uptime"
                rows={3}
                className="field-input resize-none"
              />
            </div>

            <div>
              <label className="field-label">Owner</label>
              <select
                value={fOwnerId}
                onChange={e => setFOwnerId(e.target.value)}
                className="field-input cursor-pointer"
              >
                <option value="">Select a member...</option>
                {members.map(m => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="field-label flex items-center gap-1"><LuCalendar size={12}/> Start Date</label>
                <input
                  type="date"
                  value={fStartDate}
                  onChange={e => setFStartDate(e.target.value)}
                  className="field-input"
                />
              </div>
              <div>
                <label className="field-label flex items-center gap-1"><LuCalendar size={12}/> Due Date</label>
                <input
                  type="date"
                  value={fDueDate}
                  onChange={e => setFDueDate(e.target.value)}
                  className="field-input"
                />
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <button type="button" onClick={() => setShowCreate(false)} className="card-btn flex-1 px-5">
                Cancel
              </button>
              <button type="submit" disabled={saving} className="card-btn-fill flex-1 flex items-center justify-center gap-2">
                {saving ? <LuLoaderCircle size={15} className="animate-spin"/> : <LuSave size={15}/>}
                {saving ? 'Saving…' : (editGoalObj ? 'Save Changes' : 'Create Goal')}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Delete Confirmation Modal */}
      {delConfirm && (
        <Modal title="Delete Goal" onClose={() => setDelConfirm(null)}>
          <div className="dark:text-slate-300">
            <p className="text-slate-600 dark:text-zinc-400 text-xs font-semibold leading-relaxed mb-6">
              Are you sure you want to delete this goal? This will permanently delete the goal, all defined Key Results, and remove links to tasks. This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDelConfirm(null)} className="card-btn flex-1">Cancel</button>
              <button onClick={handleDeleteGoal} className="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-bold py-2 rounded-xl transition text-xs cursor-pointer shadow-md shadow-rose-500/10">
                Delete Permanently
              </button>
            </div>
          </div>
        </Modal>
      )}
    </DashboardLayout>
  );
};

// Modal Component helper
const Modal = ({ title, onClose, children }) => (
  <>
    <div className="fixed inset-0 z-[9990] bg-[#0c0c0e]/60 backdrop-blur-sm" onClick={onClose}/>
    <div className="fixed inset-0 z-[9991] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white dark:bg-[#161619] border border-slate-200 dark:border-zinc-800/80 rounded-2xl shadow-2xl animate-fade-in overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-zinc-800/80">
          <h3 className="font-extrabold text-slate-850 dark:text-zinc-200 text-sm">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-650 dark:hover:text-zinc-200 transition cursor-pointer">
            <LuX size={18}/>
          </button>
        </div>
        <div className="p-6 max-h-[80vh] overflow-y-auto">{children}</div>
      </div>
    </div>
  </>
);

export default Goals;
