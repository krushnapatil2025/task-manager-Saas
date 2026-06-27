import React, { useState, useEffect, useContext } from 'react';
import DashboardLayout from '../../components/layouts/DashboardLayout';
import { WorkspaceContext } from '../../context/WorkspaceContext';
import { useParams, useNavigate } from 'react-router-dom';
import usePermissions from '../../hooks/usePermissions';
import {
  getGoalDetails,
  getKeyResults,
  createKeyResult,
  updateKeyResult,
  deleteKeyResult,
  getLinkedTasks,
  linkTaskToKeyResult,
  unlinkTaskFromKeyResult
} from '../../services/goalService';
import { getAllTasks } from '../../services/taskService';
import GoalProgressRing from '../../components/GoalProgressRing';
import toast from 'react-hot-toast';
import {
  LuArrowLeft, LuPlus, LuPencil, LuTrash2, LuLink, LuUnlink,
  LuLoaderCircle, LuTarget, LuCheck, LuX, LuInfo, LuCalendar,
  LuSave
} from 'react-icons/lu';

const IT_KR_TEMPLATES = [
  { name: "🎯 Test Coverage (85%)", title: "Achieve unit test coverage in CI pipeline", target: 85, unit: "%" },
  { name: "⚡ API Latency (200ms)", title: "Reduce P95 API endpoint response latency", target: 200, unit: "ms" },
  { name: "🔌 System Uptime (99.9%)", title: "Maintain production platform availability SLA", target: 99.9, unit: "%" },
  { name: "📊 Velocity Story Points", title: "Deliver story points in sprint cycles", target: 150, unit: "pts" }
];

const GoalDetail = () => {
  const { id: goalId } = useParams();
  const navigate = useNavigate();
  const { workspace } = useContext(WorkspaceContext);
  const perms = usePermissions();

  const [goal, setGoal] = useState(null);
  const [keyResults, setKeyResults] = useState([]);
  const [allTasks, setAllTasks] = useState([]);
  const [loading, setLoading] = useState(true);

  // Modals state
  const [showKrModal, setShowKrModal] = useState(false);
  const [editKrObj, setEditKrObj] = useState(null);
  const [showTasksModal, setShowTasksModal] = useState(null); // stores active KR for task linking
  const [linkedTasks, setLinkedTasks] = useState([]);
  const [delKrId, setDelKrId] = useState(null);

  // KR Form State
  const [krTitle, setKrTitle] = useState('');
  const [krTargetValue, setKrTargetValue] = useState(100);
  const [krCurrentValue, setKrCurrentValue] = useState(0);
  const [krUnit, setKrUnit] = useState('%');
  const [savingKr, setSavingKr] = useState(false);

  // Link Task Form State
  const [selectedTaskId, setSelectedTaskId] = useState('');
  const [linkingTask, setLinkingTask] = useState(false);

  const loadData = async () => {
    if (!goalId) return;
    try {
      const gData = await getGoalDetails(goalId);
      setGoal(gData);
      const krData = await getKeyResults(goalId);
      
      // Load linked tasks count/status info for each KR
      const krWithMeta = await Promise.all(
        krData.map(async (kr) => {
          const tasks = await getLinkedTasks(kr.id);
          return {
            ...kr,
            linkedTasks: tasks || [],
            hasTasks: (tasks || []).length > 0,
          };
        })
      );
      setKeyResults(krWithMeta);

      if (workspace?.id) {
        const tasks = await getAllTasks(workspace.id);
        setAllTasks(tasks || []);
      }
    } catch (err) {
      toast.error('Failed to load goal details');
      console.error(err);
      navigate('/admin/goals');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [goalId, workspace?.id]);

  // Key Result CRUD
  const openCreateKr = () => {
    setKrTitle('');
    setKrTargetValue(100);
    setKrCurrentValue(0);
    setKrUnit('%');
    setEditKrObj(null);
    setShowKrModal(true);
  };

  const openEditKr = (kr) => {
    setKrTitle(kr.title);
    setKrTargetValue(kr.target_value);
    setKrCurrentValue(kr.current_value);
    setKrUnit(kr.unit);
    setEditKrObj(kr);
    setShowKrModal(true);
  };

  const handleSaveKr = async (e) => {
    e.preventDefault();
    if (!krTitle.trim()) return toast.error('Title is required');
    setSavingKr(true);
    try {
      if (editKrObj) {
        await updateKeyResult(editKrObj.id, {
          title: krTitle,
          targetValue: krTargetValue,
          currentValue: editKrObj.hasTasks ? undefined : krCurrentValue,
          unit: krUnit
        });
        toast.success('Key Result updated!');
      } else {
        await createKeyResult(goalId, {
          title: krTitle,
          targetValue: krTargetValue,
          currentValue: krCurrentValue,
          unit: krUnit
        });
        toast.success('Key Result created!');
      }
      setShowKrModal(false);
      loadData();
    } catch (err) {
      toast.error(err.message || 'Error saving key result');
    } finally {
      setSavingKr(false);
    }
  };

  const handleDeleteKr = async () => {
    if (!delKrId) return;
    try {
      await deleteKeyResult(delKrId);
      toast.success('Key Result deleted.');
      setDelKrId(null);
      loadData();
    } catch (err) {
      toast.error(err.message || 'Error deleting key result');
    }
  };

  // Task linking
  const openTasksModal = async (kr) => {
    setShowTasksModal(kr);
    setSelectedTaskId('');
    try {
      const tasks = await getLinkedTasks(kr.id);
      setLinkedTasks(tasks || []);
    } catch (err) {
      console.error(err);
    }
  };

  const handleLinkTask = async () => {
    if (!selectedTaskId || !showTasksModal) return;
    setLinkingTask(true);
    try {
      await linkTaskToKeyResult(selectedTaskId, showTasksModal.id);
      toast.success('Task linked successfully!');
      setSelectedTaskId('');
      // Reload tasks inside modal and global data
      const tasks = await getLinkedTasks(showTasksModal.id);
      setLinkedTasks(tasks || []);
      loadData();
    } catch (err) {
      toast.error(err.message || 'Failed to link task');
    } finally {
      setLinkingTask(false);
    }
  };

  const handleUnlinkTask = async (taskId) => {
    if (!showTasksModal) return;
    try {
      await unlinkTaskFromKeyResult(taskId, showTasksModal.id);
      toast.success('Task unlinked.');
      const tasks = await getLinkedTasks(showTasksModal.id);
      setLinkedTasks(tasks || []);
      loadData();
    } catch (err) {
      toast.error(err.message || 'Failed to unlink task');
    }
  };

  if (loading) {
    return (
      <DashboardLayout activeMenu="Goals">
        <div className="flex justify-center items-center h-[60vh]">
          <LuLoaderCircle className="animate-spin text-indigo-500" size={32}/>
        </div>
      </DashboardLayout>
    );
  }

  if (!goal) return null;

  return (
    <DashboardLayout activeMenu="Goals">
      <div className="mt-5 mb-10 px-4 md:px-0 font-sans">
        
        {/* Back Button & Navigation */}
        <button
          onClick={() => navigate('/admin/goals')}
          className="flex items-center gap-2 text-slate-400 hover:text-slate-700 dark:hover:text-zinc-200 text-xs font-bold mb-6 transition-colors group cursor-pointer"
        >
          <LuArrowLeft size={16} className="group-hover:-translate-x-1 transition-transform" />
          Back to Goals
        </button>

        {/* Goal Overview Card */}
        <div className="card mb-8 flex flex-col md:flex-row gap-8 items-center justify-between !p-8">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-3">
              <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full uppercase tracking-wider border ${
                goal.status === 'active' ? 'bg-indigo-50 text-indigo-650 dark:bg-indigo-950/40 dark:text-indigo-400 border-indigo-100/30' :
                goal.status === 'completed' ? 'bg-emerald-50 text-emerald-650 dark:bg-emerald-950/40 dark:text-emerald-400 border-emerald-100/30' :
                'bg-slate-50 text-slate-450 dark:bg-zinc-800 dark:text-zinc-400 border-zinc-700'
              }`}>
                {goal.status}
              </span>
              {(goal.start_date || goal.due_date) && (
                <span className="flex items-center gap-1.5 text-xs text-slate-400 dark:text-zinc-500 font-bold uppercase tracking-wider">
                  <LuCalendar size={13}/>
                  {goal.start_date ? new Date(goal.start_date).toLocaleDateString() : '—'} to {goal.due_date ? new Date(goal.due_date).toLocaleDateString() : '—'}
                </span>
              )}
            </div>

            <h1 className="text-2xl md:text-3xl font-extrabold text-slate-905 dark:text-zinc-100 tracking-tight">
              {goal.title}
            </h1>
            <p className="text-slate-500 dark:text-zinc-400 text-xs md:text-sm mt-2 max-w-2xl leading-relaxed font-semibold">
              {goal.description || 'No description provided for this objective.'}
            </p>

            <div className="flex items-center gap-3 mt-6 pt-4 border-t border-slate-100 dark:border-zinc-800/80">
              {goal.owner ? (
                <div className="flex items-center gap-2 bg-slate-50 dark:bg-zinc-900/40 px-3 py-1.5 rounded-xl border border-slate-205 dark:border-zinc-800/80">
                  {goal.owner.profile_image_url ? (
                    <img src={goal.owner.profile_image_url} alt={goal.owner.name} className="w-5 h-5 rounded-full object-cover" />
                  ) : (
                    <div className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-650 flex items-center justify-center text-[10px] font-bold">
                      {goal.owner.name.charAt(0).toUpperCase()}
                    </div>
                  )}
                  <span className="text-xs font-bold text-slate-600 dark:text-zinc-350">
                    Owner: {goal.owner.name}
                  </span>
                </div>
              ) : (
                <span className="text-xs text-slate-400 dark:text-zinc-500 font-semibold">No owner assigned</span>
              )}
            </div>
          </div>

          <div className="flex-shrink-0 flex items-center justify-center bg-slate-50 dark:bg-zinc-900/40 p-6 rounded-2xl border border-slate-100 dark:border-zinc-800/80">
            <GoalProgressRing progress={goal.progress} size={130} strokeWidth={8} title="Objective Progress" />
          </div>
        </div>

        {/* Key Results Section */}
        <div className="card !p-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-xl font-extrabold text-slate-850 dark:text-zinc-200 tracking-tight">Key Results (OKRs)</h2>
              <p className="text-slate-400 dark:text-zinc-500 text-xs mt-1 font-semibold">Define measurable targets and connect tasks to track progress automatically</p>
            </div>
            {perms.isAdmin && (
              <button
                onClick={openCreateKr}
                className="card-btn-fill flex items-center gap-1.5 text-xs"
              >
                <LuPlus size={14}/> Add KR
              </button>
            )}
          </div>

          {keyResults.length === 0 ? (
            <div className="text-center py-16 bg-slate-50 dark:bg-zinc-905/45 rounded-2xl border border-dashed border-slate-205 dark:border-zinc-800">
              <LuTarget size={36} className="mx-auto text-slate-350 dark:text-zinc-650 mb-2"/>
              <p className="text-slate-500 dark:text-zinc-400 text-sm font-semibold">No key results defined yet</p>
              <p className="text-slate-400 dark:text-zinc-550 text-xs mt-1 font-medium">Create metrics or link specific tasks to automatically increment progress.</p>
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {keyResults.map((kr) => {
                const percent = kr.target_value > 0 ? (kr.current_value / kr.target_value) * 100 : 0;
                const roundedPercent = Math.min(Math.max(0, Math.round(percent)), 100);

                return (
                  <div
                    key={kr.id}
                    className="p-5 border border-slate-100 dark:border-zinc-800/85 bg-white dark:bg-zinc-900/40 hover:border-slate-200 dark:hover:border-zinc-700 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-5 transition-all duration-200"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1.5">
                        <h4 className="font-extrabold text-slate-800 dark:text-zinc-200 text-base truncate">
                          {kr.title}
                        </h4>
                        {kr.hasTasks && (
                          <span className="inline-flex items-center gap-1 text-[9px] font-extrabold px-2 py-0.5 bg-sky-50 text-sky-600 dark:bg-sky-950/20 dark:text-sky-400 border border-sky-100/20 rounded-full uppercase tracking-wider">
                            <LuCheck size={10}/> Auto-calculated
                          </span>
                        )}
                      </div>

                      {/* Progress Metrics & Bar */}
                      <div className="flex items-center gap-4 mt-2">
                        <div className="flex-1 bg-slate-100 dark:bg-zinc-800 rounded-full h-2 overflow-hidden max-w-md">
                          <div
                            className="bg-indigo-500 h-full rounded-full transition-all duration-500"
                            style={{ width: `${roundedPercent}%` }}
                          />
                        </div>
                        <span className="text-xs font-extrabold text-slate-500 dark:text-zinc-450 whitespace-nowrap min-w-[70px] text-right">
                          {kr.current_value} / {kr.target_value} {kr.unit} ({roundedPercent}%)
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 self-end md:self-center">
                      <button
                        onClick={() => openTasksModal(kr)}
                        className="flex items-center gap-1.5 text-xs font-bold px-3 py-2 border border-slate-200 dark:border-zinc-800 rounded-xl hover:bg-slate-50 dark:hover:bg-zinc-800/50 text-slate-605 dark:text-zinc-400 transition cursor-pointer"
                      >
                        <LuLink size={13}/>
                        {kr.linkedTasks.length > 0 ? `${kr.linkedTasks.length} Tasks` : 'Link Tasks'}
                      </button>

                      {perms.isAdmin && (
                        <>
                          <button
                            onClick={() => openEditKr(kr)}
                            className="p-2 rounded-xl text-slate-400 dark:text-zinc-500 hover:text-indigo-650 hover:bg-indigo-50 dark:hover:bg-indigo-950/30 border border-transparent hover:border-indigo-100/20 transition-colors cursor-pointer"
                            title="Edit Metric"
                          >
                            <LuPencil size={14}/>
                          </button>
                          <button
                            onClick={() => setDelKrId(kr.id)}
                            className="p-2 rounded-xl text-slate-400 dark:text-zinc-500 hover:text-rose-650 hover:bg-rose-50 dark:hover:bg-rose-955/20 border border-transparent hover:border-rose-100/20 transition-colors cursor-pointer"
                            title="Delete"
                          >
                            <LuTrash2 size={14}/>
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Add / Edit Key Result Modal */}
      {showKrModal && (
        <Modal title={editKrObj ? 'Edit Key Result' : 'Create Key Result'} onClose={() => setShowKrModal(false)}>
          <form onSubmit={handleSaveKr} className="flex flex-col gap-4">
            {!editKrObj && (
              <div className="bg-slate-50 dark:bg-[#121215] p-3.5 rounded-xl border border-slate-200 dark:border-zinc-800/80 mb-1">
                <span className="text-[10px] font-extrabold text-slate-550 dark:text-zinc-400 uppercase tracking-widest block mb-2.5">IT / Engineering Metric Templates</span>
                <div className="grid grid-cols-2 gap-2">
                  {IT_KR_TEMPLATES.map((tmpl, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setKrTitle(tmpl.title);
                        setKrTargetValue(tmpl.target);
                        setKrUnit(tmpl.unit);
                      }}
                      className="text-left text-[11px] font-semibold text-slate-700 dark:text-zinc-300 hover:text-indigo-650 dark:hover:text-indigo-400 hover:bg-white dark:hover:bg-[#161619] p-2 rounded-lg border border-slate-200 dark:border-zinc-800/80 hover:border-indigo-250 dark:hover:border-indigo-900/60 transition-all cursor-pointer truncate"
                    >
                      {tmpl.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label className="field-label">Key Result Title *</label>
              <input
                value={krTitle}
                onChange={e => setKrTitle(e.target.value)}
                placeholder="e.g. Complete 40 features in sprint"
                className="field-input"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="field-label">Target Value</label>
                <input
                  type="number"
                  step="any"
                  value={krTargetValue}
                  onChange={e => setKrTargetValue(Number(e.target.value))}
                  className="field-input"
                  required
                />
              </div>
              <div>
                <label className="field-label">Unit of Measure</label>
                <input
                  value={krUnit}
                  onChange={e => setKrUnit(e.target.value)}
                  placeholder="%, $, users, etc."
                  className="field-input"
                  required
                />
              </div>
            </div>

            {/* Current value only allowed for edit/create if not linked to tasks */}
            {(!editKrObj || !editKrObj.hasTasks) ? (
              <div>
                <label className="field-label">Current Value</label>
                <input
                  type="number"
                  step="any"
                  value={krCurrentValue}
                  onChange={e => setKrCurrentValue(Number(e.target.value))}
                  className="field-input"
                />
              </div>
            ) : (
              <div className="bg-sky-50/50 dark:bg-sky-955/15 border border-sky-100/30 p-3.5 rounded-xl flex gap-2.5">
                <LuInfo className="text-sky-500 flex-shrink-0" size={16} />
                <p className="text-[11px] leading-relaxed text-sky-650 dark:text-sky-400 font-semibold">
                  Current value is auto-calculated based on completion rate of linked tasks. To change this value, link/unlink tasks or update task statuses.
                </p>
              </div>
            )}

            <div className="flex gap-3 pt-4">
              <button type="button" onClick={() => setShowKrModal(false)} className="card-btn flex-1">
                Cancel
              </button>
              <button type="submit" disabled={savingKr} className="card-btn-fill flex-1 flex items-center justify-center gap-2">
                {savingKr ? <LuLoaderCircle size={15} className="animate-spin"/> : <LuSave size={15}/>}
                {savingKr ? 'Saving…' : (editKrObj ? 'Save Changes' : 'Create Key Result')}
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Delete Key Result Confirmation */}
      {delKrId && (
        <Modal title="Delete Key Result" onClose={() => setDelKrId(null)}>
          <div className="dark:text-slate-350">
            <p className="text-slate-650 dark:text-zinc-400 text-xs font-semibold mb-6 leading-relaxed">
              Are you sure you want to delete this Key Result? All associated task link alignments will be removed. This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDelKrId(null)} className="card-btn flex-1">Cancel</button>
              <button onClick={handleDeleteKr} className="flex-1 bg-rose-600 hover:bg-rose-700 text-white font-bold py-2 rounded-xl transition text-xs cursor-pointer shadow-md shadow-rose-500/10">
                Delete Key Result
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Link Tasks Modal */}
      {showTasksModal && (
        <Modal title={`Link Tasks to: ${showTasksModal.title}`} onClose={() => setShowTasksModal(null)}>
          <div className="flex flex-col gap-5 dark:text-zinc-300">
            
            {/* Add Task Connection */}
            <div>
              <label className="field-label">Link Workspace Task</label>
              <div className="flex gap-2">
                <select
                  value={selectedTaskId}
                  onChange={e => setSelectedTaskId(e.target.value)}
                  className="field-input flex-1 cursor-pointer"
                >
                  <option value="" className="dark:bg-zinc-900">Choose a task...</option>
                  {allTasks
                    .filter(t => !linkedTasks.some(lt => lt.id === t.id))
                    .filter(t => !goal?.owner_id || (t.assignees && t.assignees.some(a => a.user?.id === goal.owner_id)))
                    .map(t => (
                      <option key={t.id} value={t.id} className="dark:bg-zinc-900">{t.title} ({t.status})</option>
                    ))
                  }
                </select>
                <button
                  onClick={handleLinkTask}
                  disabled={!selectedTaskId || linkingTask}
                  className="card-btn-fill flex items-center justify-center gap-1.5 text-xs py-2"
                >
                  {linkingTask ? <LuLoaderCircle size={14} className="animate-spin"/> : <LuPlus size={14}/>}
                  Link
                </button>
              </div>
            </div>

            {/* Linked Tasks List */}
            <div>
              <label className="field-label">Currently Connected Tasks</label>
              {linkedTasks.length === 0 ? (
                <p className="text-xs text-slate-450 dark:text-zinc-500 text-center py-4 bg-slate-50 dark:bg-zinc-900/40 rounded-xl border border-dashed border-slate-200 dark:border-zinc-800">
                  No tasks connected yet.
                </p>
              ) : (
                <div className="flex flex-col gap-2 max-h-[250px] overflow-y-auto pr-1">
                  {linkedTasks.map(t => (
                    <div
                      key={t.id}
                      className="p-3 border border-slate-100 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-900/40 rounded-xl flex items-center justify-between gap-3 hover:border-slate-250 dark:hover:border-slate-700 transition"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-slate-805 dark:text-zinc-200 truncate">{t.title}</p>
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider inline-block mt-1 ${
                          t.status === 'Completed' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-450 border border-emerald-100/10' :
                          t.status === 'In Progress' ? 'bg-cyan-50 text-cyan-600 dark:bg-cyan-950/20 dark:text-cyan-450 border border-cyan-100/10' :
                          'bg-slate-100 text-slate-500 dark:bg-zinc-850 dark:text-zinc-400'
                        }`}>
                          {t.status}
                        </span>
                      </div>
                      <button
                        onClick={() => handleUnlinkTask(t.id)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 dark:hover:text-rose-455 hover:bg-rose-50 dark:hover:bg-rose-955/20 transition-colors cursor-pointer"
                        title="Unlink Task"
                      >
                        <LuUnlink size={13}/>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex justify-end border-t border-slate-100 dark:border-zinc-800/80 pt-4">
              <button
                onClick={() => setShowTasksModal(null)}
                className="card-btn text-xs px-4"
              >
                Close
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

export default GoalDetail;
