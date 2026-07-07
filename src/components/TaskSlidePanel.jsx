import React, { useState, useEffect, useContext, useRef } from 'react';
import { WorkspaceContext } from '../context/WorkspaceContext';
import { UserContext } from '../context/userContext';
import { supabase } from '../utils/supabaseClient';
import {
  getTaskById,
  createTask,
  updateTask,
  deleteTask,
  normalizeTask,
  getAllTasks,
} from '../services/taskService';
import {
  getTaskDependencies,
  addDependency,
  removeDependency,
} from '../services/sprintService';
import {
  LuX, LuTrash2, LuUser, LuFlag, LuCalendar, LuPlus,
  LuLock, LuTriangleAlert, LuCircleCheck, LuLink,
  LuCirclePlus, LuUserPlus, LuFolderOpen, LuTarget
} from 'react-icons/lu';
import { PRIORITY_DATA } from '../utils/data';
import toast from 'react-hot-toast';
import moment from 'moment';
import { usePresence } from '../hooks/usePresence';
import SelectDropdown from './Inputs/SelectDropdown';
import SelectDropdown2 from './Inputs/SelectDropdown'; // Fallback
import SelectUsers from './Inputs/SelectUsers';
import TodoListInput from './Inputs/TodoListInput';
import AddAttachmentsInput from './Inputs/AddAttachmentsInput';
import {
  getTaskLinkedKeyResults,
  linkTaskToKeyResult,
  unlinkTaskFromKeyResult,
  getGoals,
  getKeyResults
} from '../services/goalService';

const TaskSlidePanel = ({ taskId, isOpen, onClose, onSuccess, aiPrefill }) => {
  const { workspace } = useContext(WorkspaceContext);
  const { user } = useContext(UserContext);

  const [currentTaskId, setCurrentTaskId] = useState(taskId);

  useEffect(() => {
    setCurrentTaskId(taskId);
  }, [taskId]);

  // Core task state
  const [taskData, setTaskData] = useState({
    title: '',
    description: '',
    priority: 'low',
    dueDate: '',
    assignedTo: [],
    todoCheckList: [],
    attachments: [],
  });

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const [dependencies, setDependencies] = useState({ blocking: [], blockedBy: [] });
  const [allTasksList, setAllTasksList] = useState([]);
  const [showBlockerSelect, setShowBlockerSelect] = useState(false);
  const [showBlockedSelect, setShowBlockedSelect] = useState(false);

  // OKR Linking states
  const [linkedKrs, setLinkedKrs] = useState([]);
  const [workspaceKrs, setWorkspaceKrs] = useState([]);
  const [showKrSelect, setShowKrSelect] = useState(false);
  const [selectedKrId, setSelectedKrId] = useState('');

  // Field Locks (Co-editing conflict prevention)
  const [locks, setLocks] = useState({}); // { field: { userId, userName } }
  const channelRef = useRef(null);

  // Presence
  const { presentUsers } = usePresence(currentTaskId);

  // Load task details & dependency lists
  useEffect(() => {
    if (!isOpen) return;

    const loadData = async () => {
      setLoading(true);
      setError('');
      try {
        // Fetch list of all tasks in workspace for dependency mapping dropdown
        if (workspace?.id) {
          const rawTasks = await getAllTasks(workspace.id, null);
          setAllTasksList(rawTasks.map(normalizeTask).filter(t => t.id !== currentTaskId));

          // Fetch all key results in workspace for OKR mapping
          try {
            const wGoals = await getGoals(workspace.id);
            const krPromises = wGoals.map(async (g) => {
              const krs = await getKeyResults(g.id);
              return krs.map(kr => ({ ...kr, goalTitle: g.title }));
            });
            const krsNested = await Promise.all(krPromises);
            setWorkspaceKrs(krsNested.flat());
          } catch (krErr) {
            console.error("Error loading workspace KRs:", krErr);
          }
        }

        if (currentTaskId) {
          // Edit mode
          const raw = await getTaskById(currentTaskId);
          const task = normalizeTask(raw);
          setTaskData({
            title: task.title || '',
            description: task.description || '',
            priority: task.priority || 'low',
            dueDate: task.dueDate ? moment(task.dueDate).format('YYYY-MM-DD') : '',
            assignedTo: task.assignedTo.map((u) => u.id),
            todoCheckList: task.todoChecklist.map((c) => ({
              title: c.title,
              description: c.description || '',
              completed: c.completed
            })),
            attachments: task.attachments || [],
          });

          // Fetch dependencies
          const deps = await getTaskDependencies(currentTaskId);
          setDependencies(deps);

          // Fetch linked KRs
          try {
            const taskKrs = await getTaskLinkedKeyResults(currentTaskId);
            setLinkedKrs(taskKrs || []);
          } catch (krErr) {
            console.error("Error loading task KRs:", krErr);
          }
        } else {
          // Create mode: clear data / apply AI prefill
          setTaskData({
            title: aiPrefill?.title || '',
            description: aiPrefill?.description || '',
            priority: aiPrefill?.priority || 'low',
            dueDate: aiPrefill?.dueDate || '',
            assignedTo: [],
            todoCheckList: [],
            attachments: [],
          });
          setDependencies({ blocking: [], blockedBy: [] });
          if (aiPrefill) {
            toast('✨ AI filled the form — review and submit!', { icon: '🤖' });
          }
        }
      } catch (err) {
        console.error('Error loading task details:', err);
        toast.error('Failed to load task details');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [currentTaskId, isOpen, workspace?.id, aiPrefill]);

  // Realtime Broadcast Channel for Co-Editing Locks
  useEffect(() => {
    if (!currentTaskId || !user?.id || !isOpen) return;

    const channel = supabase.channel(`task-locks-${currentTaskId}`);

    channel
      .on('broadcast', { event: 'field_lock' }, ({ payload }) => {
        setLocks(prev => ({
          ...prev,
          [payload.field]: { userId: payload.userId, userName: payload.userName }
        }));
      })
      .on('broadcast', { event: 'field_unlock' }, ({ payload }) => {
        setLocks(prev => {
          const next = { ...prev };
          if (next[payload.field]?.userId === payload.userId) {
            delete next[payload.field];
          }
          return next;
        });
      })
      .subscribe();

    channelRef.current = channel;

    return () => {
      // Release any locks before unsubscribing
      if (channelRef.current) {
        channelRef.current.send({
          type: 'broadcast',
          event: 'field_unlock',
          payload: { userId: user.id, field: 'title' }
        });
        channelRef.current.send({
          type: 'broadcast',
          event: 'field_unlock',
          payload: { userId: user.id, field: 'description' }
        });
      }
      supabase.removeChannel(channel);
    };
  }, [currentTaskId, user?.id, isOpen]);

  const handleFocus = (field) => {
    if (channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'field_lock',
        payload: { userId: user.id, userName: user.name || 'Collaborator', field }
      });
    }
  };

  const handleBlur = (field) => {
    if (channelRef.current) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'field_unlock',
        payload: { userId: user.id, field }
      });
    }
  };

  const handleValueChange = (key, value) => {
    setTaskData((prev) => ({ ...prev, [key]: value }));
  };

  const [showSaveChoice, setShowSaveChoice] = useState(false);

  // Create or Update task
  const handleSave = async () => {
    setError('');
    if (!taskData.title.trim()) return setError('Title is required');
    if (!taskData.dueDate) return setError('Due date is required');

    setSaving(true);
    try {
      if (currentTaskId) {
        // Update task
        await updateTask(
          currentTaskId,
          {
            title: taskData.title,
            description: taskData.description,
            priority: taskData.priority,
            dueDate: new Date(taskData.dueDate).toISOString(),
            attachments: taskData.attachments,
            recurrenceRule: null,
            recurrenceInterval: 1,
            recurrenceEndDate: null,
          },
          taskData.assignedTo,
          taskData.todoCheckList
        );
        toast.success('Task updated successfully!');
      } else {
        // Create task
        await createTask(
          {
            title: taskData.title,
            description: taskData.description,
            priority: taskData.priority,
            dueDate: new Date(taskData.dueDate).toISOString(),
            attachments: taskData.attachments,
            recurrenceRule: null,
            recurrenceInterval: 1,
            recurrenceEndDate: null,
          },
          taskData.assignedTo,
          taskData.todoCheckList,
          user.id,
          workspace.id
        );
        toast.success('Task created successfully!');
      }
      setShowSaveChoice(false);
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      console.error('Save task error:', err);
      toast.error(err.message || 'Failed to save task');
    } finally {
      setSaving(false);
    }
  };

  // Delete task
  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this task?')) return;
    try {
      await deleteTask(currentTaskId);
      toast.success('Task deleted successfully!');
      if (onSuccess) onSuccess();
      onClose();
    } catch (err) {
      console.error('Delete task error:', err);
      toast.error('Failed to delete task');
    }
  };

  // Add dependency relation
  const handleAddDependency = async (targetId, type) => {
    try {
      if (type === 'blockedBy') {
        await addDependency(workspace.id, targetId, currentTaskId);
      } else {
        await addDependency(workspace.id, currentTaskId, targetId);
      }
      const deps = await getTaskDependencies(currentTaskId);
      setDependencies(deps);
      setShowBlockerSelect(false);
      setShowBlockedSelect(false);
      toast.success('Dependency mapped.');
    } catch (err) {
      console.error('Error adding dependency:', err);
      toast.error('Could not add dependency relation');
    }
  };

  // Remove dependency relation
  const handleRemoveDependency = async (depId) => {
    try {
      await removeDependency(depId);
      const deps = await getTaskDependencies(currentTaskId);
      setDependencies(deps);
      toast.success('Dependency removed.');
    } catch (err) {
      console.error('Error removing dependency:', err);
      toast.error('Could not remove dependency relation');
    }
  };

  // OKR Linking handlers
  const handleLinkKr = async () => {
    if (!selectedKrId || !currentTaskId) return;
    try {
      await linkTaskToKeyResult(currentTaskId, selectedKrId);
      toast.success('Task successfully linked to Key Result!');
      setSelectedKrId('');
      setShowKrSelect(false);
      const taskKrs = await getTaskLinkedKeyResults(currentTaskId);
      setLinkedKrs(taskKrs || []);
      if (onSuccess) onSuccess();
    } catch (err) {
      toast.error('Failed to link task to Key Result');
      console.error(err);
    }
  };

  const handleUnlinkKr = async (krId) => {
    if (!currentTaskId) return;
    try {
      await unlinkTaskFromKeyResult(currentTaskId, krId);
      toast.success('Unlinked from Key Result.');
      const taskKrs = await getTaskLinkedKeyResults(currentTaskId);
      setLinkedKrs(taskKrs || []);
      if (onSuccess) onSuccess();
    } catch (err) {
      toast.error('Failed to unlink from Key Result');
      console.error(err);
    }
  };

  // Render lock indicators helper
  const renderLockOverlay = (field) => {
    const activeLock = locks[field];
    if (activeLock && activeLock.userId !== user?.id) {
      return (
        <div className="absolute inset-0 bg-slate-100/70 backdrop-blur-[1px] flex items-center justify-center gap-2 z-10 border border-amber-300 rounded-xl animate-fade-in">
          <LuLock className="text-amber-500 text-sm animate-bounce" />
          <span className="text-xs font-bold text-slate-700">
            {activeLock.userName} is editing...
          </span>
        </div>
      );
    }
    return null;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end overflow-hidden animate-fade-in">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity"
        onClick={onClose}
      />

      {/* Drawer Body */}
      <div className="relative w-screen max-w-xl bg-white border-l border-slate-200 shadow-2xl flex flex-col h-full transform transition-transform duration-300 translate-x-0">
        
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div>
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
              {currentTaskId ? 'Workspace Task' : 'New Task'}
            </span>
            <h3 className="text-sm font-extrabold text-slate-900 mt-0.5 flex items-center gap-2">
              {currentTaskId ? `Task Details` : 'Create New Task'}
            </h3>
          </div>

          <div className="flex items-center gap-3">
            {/* Presence avatars */}
            {taskId && presentUsers.filter(u => u.id !== user?.id).length > 0 && (
              <div className="flex -space-x-1 mr-2 items-center">
                <span className="text-[10px] text-indigo-600 font-extrabold mr-1.5 bg-indigo-50 dark:bg-indigo-950/20 px-2 py-0.5 rounded-full animate-pulse flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
                  Viewing:
                </span>
                {presentUsers
                  .filter(u => u.id !== user?.id)
                  .map((u) => (
                    <div
                      key={u.id}
                      title={`${u.name} is viewing this task`}
                      className="w-6 h-6 rounded-full border-2 border-white bg-indigo-50 text-[10px] font-extrabold text-indigo-600 flex items-center justify-center overflow-hidden uppercase shadow-sm ring-1 ring-emerald-500/30"
                    >
                      {u.avatar ? (
                        <img src={u.avatar} alt={u.name} className="w-full h-full object-cover" />
                      ) : (
                        u.name?.charAt(0)
                      )}
                    </div>
                  ))}
              </div>
            )}

            {taskId && (
              <button
                onClick={handleDelete}
                className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition cursor-pointer"
                title="Delete Task"
              >
                <LuTrash2 size={16} />
              </button>
            )}

            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-xl transition cursor-pointer"
            >
              <LuX size={18} />
            </button>
          </div>
        </div>

        {/* Content body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <div className="w-8 h-8 border-3 border-indigo-650 border-t-transparent rounded-full animate-spin" />
              <p className="text-xs text-slate-400 font-semibold uppercase tracking-wider">Syncing iteration logs...</p>
            </div>
          ) : (
            <>
              {/* Task Title with lock indicator */}
              <div className="relative">
                <label className="block text-xs font-extrabold text-slate-400 uppercase tracking-wider mb-2">
                  Task Title
                </label>
                <div className="relative">
                  {renderLockOverlay('title')}
                  <input
                    type="text"
                    disabled={!!locks['title'] && locks['title'].userId !== user?.id}
                    className="w-full px-4 py-2.5 text-xs font-bold text-slate-700 placeholder-slate-350 bg-slate-25 rounded-xl border border-slate-200 outline-none focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/5 transition-all"
                    placeholder="e.g. Design Landing Hero Grid"
                    value={taskData.title}
                    onChange={(e) => handleValueChange('title', e.target.value)}
                    onFocus={() => handleFocus('title')}
                    onBlur={() => handleBlur('title')}
                  />
                </div>
              </div>

              {/* Task Description with lock indicator */}
              <div className="relative">
                <label className="block text-xs font-extrabold text-slate-400 uppercase tracking-wider mb-2">
                  Description
                </label>
                <div className="relative">
                  {renderLockOverlay('description')}
                  <textarea
                    disabled={!!locks['description'] && locks['description'].userId !== user?.id}
                    className="w-full px-4 py-3 text-xs font-semibold text-slate-700 placeholder-slate-350 bg-slate-25 rounded-xl border border-slate-200 outline-none focus:border-indigo-500 focus:bg-white focus:ring-4 focus:ring-indigo-500/5 transition-all"
                    rows={4}
                    placeholder="Provide a clear, detailed summary of scope, references, and acceptance criteria..."
                    value={taskData.description}
                    onChange={(e) => handleValueChange('description', e.target.value)}
                    onFocus={() => handleFocus('description')}
                    onBlur={() => handleBlur('description')}
                  />
                </div>
              </div>

              {/* Task Metadata Row */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-extrabold text-slate-400 uppercase tracking-wider mb-2">
                    Priority
                  </label>
                  <SelectDropdown
                    options={PRIORITY_DATA}
                    value={taskData.priority}
                    onChange={(val) => handleValueChange('priority', val)}
                    placeholder="Select Priority"
                  />
                </div>

                <div>
                  <label className="block text-xs font-extrabold text-slate-400 uppercase tracking-wider mb-2">
                    Due Date
                  </label>
                  <div className="relative">
                    <input
                      type="date"
                      className="w-full px-4 py-2.5 text-xs font-semibold text-slate-700 bg-slate-25 rounded-xl border border-slate-200 outline-none focus:border-indigo-500 focus:bg-white transition-all"
                      value={taskData.dueDate}
                      onChange={(e) => handleValueChange('dueDate', e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-extrabold text-slate-400 uppercase tracking-wider mb-2">
                    Assignees
                  </label>
                  <SelectUsers
                    selectedUsers={taskData.assignedTo}
                    setSelectedUsers={(val) => handleValueChange('assignedTo', val)}
                  />
                </div>
              </div>


              {/* Dependencies Widget (Phase 4 Rebuild highlight) */}
              {currentTaskId && (
                <div className="border border-slate-200/70 rounded-2xl p-4 bg-slate-25">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1.5 mb-3">
                    <LuLink size={12} className="text-indigo-500" /> Relational Dependencies
                  </span>

                  {/* Blocked By lists */}
                  <div className="space-y-3">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">Blocked By (Blockers)</span>
                        <button
                          onClick={() => setShowBlockerSelect(!showBlockerSelect)}
                          className="text-[10px] font-bold text-indigo-600 hover:text-indigo-850 flex items-center gap-0.5 cursor-pointer"
                        >
                          <LuCirclePlus size={11} /> Add Blocker
                        </button>
                      </div>

                      {showBlockerSelect && (
                        <div className="bg-white border border-slate-200 rounded-xl p-2 mb-2 max-h-40 overflow-y-auto shadow-sm">
                          {allTasksList.length === 0 ? (
                            <p className="text-[10px] text-slate-400 text-center py-2">No options available</p>
                          ) : (
                            allTasksList
                              .filter(t => !dependencies.blockedBy.some(x => x.id === t.id))
                              .map(t => (
                                <button
                                  key={t.id}
                                  onClick={() => handleAddDependency(t.id, 'blockedBy')}
                                  className="w-full text-left text-[11px] font-semibold text-slate-700 hover:bg-slate-50 px-2 py-1.5 rounded transition cursor-pointer"
                                >
                                  {t.title} <span className="text-[9px] text-slate-400 uppercase">({t.status})</span>
                                </button>
                              ))
                          )}
                        </div>
                      )}

                      <div className="space-y-1.5">
                        {dependencies.blockedBy.length === 0 ? (
                          <p className="text-[10px] text-slate-400 italic">No blocker tasks assigned.</p>
                        ) : (
                          dependencies.blockedBy.map(d => {
                            const isResolved = d.status === 'Completed';
                            return (
                              <div key={d.id} className="flex items-center justify-between bg-white border border-slate-200/60 rounded-xl px-3 py-2">
                                <div className="flex items-center gap-2">
                                  {isResolved ? (
                                    <LuCircleCheck size={13} className="text-emerald-500" />
                                  ) : (
                                    <LuTriangleAlert size={13} className="text-amber-500 animate-pulse" />
                                  )}
                                  <span className="text-xs font-semibold text-slate-700 truncate max-w-[280px]">
                                    {d.title}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                                    isResolved ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-amber-50 text-amber-600 border border-amber-100'
                                  }`}>
                                    {d.status}
                                  </span>
                                  <button
                                    onClick={() => handleRemoveDependency(d.depId)}
                                    className="text-xs text-slate-350 hover:text-red-500 cursor-pointer"
                                  >
                                    ×
                                  </button>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>

                    {/* Blocks (Tasks that depend on current task) */}
                    <div>
                      <div className="flex items-center justify-between mb-1 mt-2">
                        <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">Blocks (Dependencies)</span>
                        <button
                          onClick={() => setShowBlockedSelect(!showBlockedSelect)}
                          className="text-[10px] font-bold text-indigo-600 hover:text-indigo-850 flex items-center gap-0.5 cursor-pointer"
                        >
                          <LuCirclePlus size={11} /> Add Dependency
                        </button>
                      </div>

                      {showBlockedSelect && (
                        <div className="bg-white border border-slate-200 rounded-xl p-2 mb-2 max-h-40 overflow-y-auto shadow-sm">
                          {allTasksList.length === 0 ? (
                            <p className="text-[10px] text-slate-400 text-center py-2">No options available</p>
                          ) : (
                            allTasksList
                              .filter(t => !dependencies.blocking.some(x => x.id === t.id))
                              .map(t => (
                                <button
                                  key={t.id}
                                  onClick={() => handleAddDependency(t.id, 'blocks')}
                                  className="w-full text-left text-[11px] font-semibold text-slate-700 hover:bg-slate-50 px-2 py-1.5 rounded transition cursor-pointer"
                                >
                                  {t.title} <span className="text-[9px] text-slate-400 uppercase">({t.status})</span>
                                </button>
                              ))
                          )}
                        </div>
                      )}

                      <div className="space-y-1.5">
                        {dependencies.blocking.length === 0 ? (
                          <p className="text-[10px] text-slate-400 italic">No tasks blocked by this task.</p>
                        ) : (
                          dependencies.blocking.map(d => (
                            <div key={d.id} className="flex items-center justify-between bg-white border border-slate-200/60 rounded-xl px-3 py-2">
                              <span className="text-xs font-semibold text-slate-700 truncate max-w-[280px]">
                                {d.title}
                              </span>
                              <div className="flex items-center gap-2">
                                <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                                  {d.status}
                                </span>
                                <button
                                  onClick={() => handleRemoveDependency(d.depId)}
                                  className="text-xs text-slate-350 hover:text-red-500 cursor-pointer"
                                >
                                  ×
                                </button>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* OKR Alignments */}
              {currentTaskId && (
                <div className="border border-slate-200/70 rounded-2xl p-4 bg-slate-25">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                      <LuTarget size={12} className="text-indigo-500" /> Strategic OKR Alignment
                    </span>
                    <button
                      onClick={() => setShowKrSelect(!showKrSelect)}
                      className="text-[10px] font-bold text-indigo-600 hover:text-indigo-850 flex items-center gap-0.5 cursor-pointer"
                    >
                      <LuPlus size={11} /> Align Key Result
                    </button>
                  </div>

                  {showKrSelect && (
                    <div className="bg-white border border-slate-200 rounded-xl p-2.5 mb-3 flex gap-2 shadow-sm">
                      <select
                        value={selectedKrId}
                        onChange={e => setSelectedKrId(e.target.value)}
                        className="flex-1 text-xs border border-slate-200 rounded-lg p-1.5 bg-slate-25"
                      >
                        <option value="">Choose a Key Result...</option>
                        {workspaceKrs
                          .filter(kr => !linkedKrs.some(lk => lk.id === kr.id))
                          .map(kr => (
                            <option key={kr.id} value={kr.id}>
                              [{kr.goalTitle}] {kr.title} ({kr.current_value}/{kr.target_value} {kr.unit})
                            </option>
                          ))
                        }
                      </select>
                      <button
                        onClick={handleLinkKr}
                        disabled={!selectedKrId}
                        className="text-[10px] font-bold px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition disabled:opacity-50"
                      >
                        Link
                      </button>
                    </div>
                  )}

                  <div className="space-y-2">
                    {linkedKrs.length === 0 ? (
                      <p className="text-[10px] text-slate-400 italic">This task is not currently aligned with any strategic objectives.</p>
                    ) : (
                      linkedKrs.map(kr => (
                        <div key={kr.id} className="flex items-center justify-between bg-white border border-slate-200/60 rounded-xl px-3 py-2">
                          <div className="min-w-0">
                            <span className="text-[9px] font-extrabold text-indigo-500 uppercase block tracking-wider truncate">
                              {kr.goal?.title || 'Objective'}
                            </span>
                            <span className="text-xs font-semibold text-slate-700 truncate block mt-0.5 max-w-[280px]">
                              {kr.title}
                            </span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full whitespace-nowrap">
                              {kr.current_value}/{kr.target_value} {kr.unit}
                            </span>
                            <button
                              onClick={() => handleUnlinkKr(kr.id)}
                              className="text-slate-350 hover:text-red-500 cursor-pointer text-xs"
                              title="Unlink Objective"
                            >
                              ×
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              {/* Checklist */}
              <div>
                <label className="block text-xs font-extrabold text-slate-400 uppercase tracking-wider mb-2">
                  Subtasks
                </label>
                <TodoListInput
                  todoList={taskData.todoCheckList}
                  setTodoList={(val) => handleValueChange('todoCheckList', val)}
                />
              </div>

              {/* Attachments */}
              <div>
                <label className="block text-xs font-extrabold text-slate-400 uppercase tracking-wider mb-2">
                  Attachments
                </label>
                <AddAttachmentsInput
                  attachments={taskData.attachments}
                  setAttachments={(val) => handleValueChange('attachments', val)}
                />
              </div>

              {error && (
                <p className="text-xs text-rose-600 font-extrabold bg-rose-50 border border-rose-200/40 p-3 rounded-xl">
                  {error}
                </p>
              )}
            </>
          )}
        </div>

        {/* Footer controls */}
        {!loading && (
          <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-end gap-3 bg-slate-25">
            <button
              onClick={onClose}
              disabled={saving}
              className="text-xs font-bold text-slate-500 hover:text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-xl px-4 py-2 cursor-pointer transition"
            >
              Cancel
            </button>
            <button
              onClick={() => handleSave()}
              disabled={saving}
              className="text-xs font-bold text-white bg-brand hover:opacity-90 shadow-[0_4px_12px_var(--brand-ring)] rounded-xl px-5 py-2 cursor-pointer transition"
            >
              {saving ? 'Saving...' : currentTaskId ? 'Save Updates' : 'Create Task'}
            </button>
          </div>
        )}

        {/* Save Recurring Task Option Modal */}
        {showSaveChoice && (
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-6 animate-fade-in">
            <div className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-100 flex flex-col gap-4">
              <div className="text-center">
                <div className="w-12 h-12 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-650 flex items-center justify-center mx-auto mb-3">
                  <LuRefreshCw size={20} className="animate-spin-slow" />
                </div>
                <h4 className="text-sm font-extrabold text-slate-900">Update Recurring Task</h4>
                <p className="text-[11px] font-semibold text-slate-400 mt-1">
                  This is a recurring task series. How would you like to apply your changes?
                </p>
              </div>

              <div className="space-y-2">
                <button
                  onClick={() => handleSave('occurrence')}
                  className="w-full text-left px-4 py-3 bg-slate-50 hover:bg-indigo-50/30 border border-slate-200 hover:border-indigo-300 rounded-xl transition cursor-pointer group"
                >
                  <p className="text-xs font-bold text-slate-800 group-hover:text-indigo-900">This occurrence only</p>
                  <p className="text-[10px] text-slate-400 font-semibold mt-0.5">
                    Detaches this occurrence as a standalone task. The series advances.
                  </p>
                </button>

                <button
                  onClick={() => handleSave('series')}
                  className="w-full text-left px-4 py-3 bg-slate-50 hover:bg-indigo-50/30 border border-slate-200 hover:border-indigo-300 rounded-xl transition cursor-pointer group"
                >
                  <p className="text-xs font-bold text-slate-800 group-hover:text-indigo-900">All future occurrences</p>
                  <p className="text-[10px] text-slate-400 font-semibold mt-0.5">
                    Updates the template. All future spawned tasks will use these changes.
                  </p>
                </button>
              </div>

              <button
                onClick={() => setShowSaveChoice(false)}
                className="text-xs font-extrabold text-slate-400 hover:text-slate-600 py-1 cursor-pointer transition text-center"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default TaskSlidePanel;
