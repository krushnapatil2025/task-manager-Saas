import React, { useEffect, useState, useContext, useCallback } from 'react';
import DashboardLayout from '../../components/layouts/DashboardLayout';
import { useNavigate } from 'react-router-dom';
import { LuFileSpreadsheet, LuLoaderCircle, LuRefreshCcw, LuSearch, LuInfo, LuUser, LuFlag, LuLayers, LuCalendar, LuPlus } from 'react-icons/lu';
import TaskStatusTabs from '../../components/TaskStatusTabs';
import TaskCard from '../../components/Cards/TaskCard';
import toast from 'react-hot-toast';
import { getAllTasks, normalizeTask } from '../../services/taskService';
import { WorkspaceContext } from '../../context/WorkspaceContext';
import { UserContext } from '../../context/userContext';
import useRealtimeTasks from '../../hooks/useRealtimeTasks';
import usePermissions from '../../hooks/usePermissions';
import ExcelJS from 'exceljs';
import RefreshButton from '../../components/RefreshButton';
import moment from 'moment';
import TaskSlidePanel from '../../components/TaskSlidePanel';

// ─────────────────────────────────────────────────────────────────────────────
// ManageTasks — admin and employee task manager panel with full keyboard nav
// ─────────────────────────────────────────────────────────────────────────────

const ManageTasks = () => {
  const [allTasks,     setAllTasks]      = useState([]);
  const [tabs,         setTabs]          = useState([]);
  const [filterStatus, setFilterStatus]  = useState('All');
  const [loading,      setLoading]       = useState(false);
  const [liveUpdate,   setLiveUpdate]    = useState(false); // flash indicator
  const [searchQuery,  setSearchQuery]   = useState('');
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [isSlidePanelOpen, setIsSlidePanelOpen] = useState(false);

  // Keyboard navigation & shortcut overlay states
  const [focusedTaskIdx, setFocusedTaskIdx] = useState(-1);
  const [showShortcuts, setShowShortcuts]   = useState(false);

  const { workspace } = useContext(WorkspaceContext);
  const { user }      = useContext(UserContext);
  const navigate       = useNavigate();
  const { canEditTask, canExportTasks, canCreateTask } = usePermissions();

  // Parse custom search filters
  const parseQuery = (queryStr) => {
    const tokens = {
      assignee: null,
      priority: null,
      status: null,
      due: null,
      text: '',
    };
    if (!queryStr) return tokens;

    // Regex to find patterns like key:value or key:"value"
    const regex = /(\b\w+):(?:([^"\s]+)|"([^"]+)")/g;
    let match;
    let lastIndex = 0;
    const cleanStr = queryStr.trim();

    while ((match = regex.exec(cleanStr)) !== null) {
      const key = match[1].toLowerCase();
      const val = (match[2] || match[3]).toLowerCase();
      if (['assignee', 'priority', 'status', 'due'].includes(key)) {
        tokens[key] = val;
      }
      const before = cleanStr.substring(lastIndex, match.index).trim();
      if (before) {
        tokens.text += ' ' + before;
      }
      lastIndex = regex.lastIndex;
    }
    const remainder = cleanStr.substring(lastIndex).trim();
    if (remainder) {
      tokens.text += ' ' + remainder;
    }
    tokens.text = tokens.text.trim();
    return tokens;
  };

  const parsedTokens = parseQuery(searchQuery);

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
    if (canEditTask) {
      setSelectedTaskId(taskData.id);
      setIsSlidePanelOpen(true);
    }
  };

  const handleCreateNewTask = () => {
    if (canCreateTask) {
      setSelectedTaskId(null);
      setIsSlidePanelOpen(true);
    }
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

  const filteredTasks = allTasks.filter((task) => {
    // 1. Text Search (title & description)
    if (parsedTokens.text) {
      const txt = parsedTokens.text.toLowerCase();
      const matchTitle = task.title?.toLowerCase().includes(txt);
      const matchDesc  = task.description?.toLowerCase().includes(txt);
      if (!matchTitle && !matchDesc) return false;
    }

    // 2. Assignee Search
    if (parsedTokens.assignee) {
      const val = parsedTokens.assignee.toLowerCase();
      if (val === 'me') {
        const isAssigned = task.assignedTo?.some((u) => u.id === user?.id);
        if (!isAssigned) return false;
      } else {
        const isAssigned = task.assignedTo?.some((u) => u.name?.toLowerCase().includes(val));
        if (!isAssigned) return false;
      }
    }

    // 3. Priority Search
    if (parsedTokens.priority) {
      const val = parsedTokens.priority.toLowerCase();
      if (task.priority?.toLowerCase() !== val) return false;
    }

    // 4. Status Search
    if (parsedTokens.status) {
      const val = parsedTokens.status.toLowerCase().replace(/\s+/g, '');
      const taskStatus = task.status?.toLowerCase().replace(/\s+/g, '');
      if (taskStatus !== val && !taskStatus.includes(val)) return false;
    }

    // 5. Due Date Search
    if (parsedTokens.due) {
      const val = parsedTokens.due.toLowerCase();
      const todayStr = moment().format('YYYY-MM-DD');
      const taskDueStr = task.dueDate ? moment(task.dueDate).format('YYYY-MM-DD') : null;

      if (val === 'today') {
        if (taskDueStr !== todayStr) return false;
      } else if (val === 'overdue') {
        const isOverdue = task.dueDate && moment(task.dueDate).isBefore(moment(), 'day') && task.status !== 'Completed';
        if (!isOverdue) return false;
      } else if (val === 'tomorrow') {
        const tomorrowStr = moment().add(1, 'day').format('YYYY-MM-DD');
        if (taskDueStr !== tomorrowStr) return false;
      }
    }

    return true;
  });

  // ── Keyboard Navigation listener ──────────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e) => {
      const activeEl = document.activeElement;
      if (
        activeEl && 
        (activeEl.tagName === 'INPUT' || 
         activeEl.tagName === 'TEXTAREA' || 
         activeEl.isContentEditable)
      ) {
        if (e.key === 'Escape') {
          activeEl.blur();
        }
        return;
      }

      if (e.key === 'Alt') {
        e.preventDefault();
        setShowShortcuts(true);
      }

      if (e.key === 'c' || e.key === 'C') {
        e.preventDefault();
        handleCreateNewTask();
      }

      if (e.key === '/') {
        e.preventDefault();
        document.querySelector('input[placeholder*="Search"]')?.focus();
      }

      if (filteredTasks.length === 0) return;

      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
        e.preventDefault();
        setFocusedTaskIdx((prev) => (prev + 1) % filteredTasks.length);
      } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
        e.preventDefault();
        setFocusedTaskIdx((prev) => (prev - 1 + filteredTasks.length) % filteredTasks.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (focusedTaskIdx >= 0 && filteredTasks[focusedTaskIdx]) {
          handleClick(filteredTasks[focusedTaskIdx]);
        }
      } else if (e.key === 'e' || e.key === 'E') {
        e.preventDefault();
        if (focusedTaskIdx >= 0 && filteredTasks[focusedTaskIdx]) {
          handleClick(filteredTasks[focusedTaskIdx]);
        }
      }
    };

    const handleKeyUp = (e) => {
      if (e.key === 'Alt') {
        setShowShortcuts(false);
      }
    };

    const handleBlurWindow = () => {
      setShowShortcuts(false);
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', handleBlurWindow);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', handleBlurWindow);
    };
  }, [filteredTasks, focusedTaskIdx, canCreateTask, canEditTask]);

  const handleToggleFilterChip = (chipText) => {
    if (searchQuery.includes(chipText)) {
      setSearchQuery(prev => prev.replace(chipText, '').replace(/\s+/g, ' ').trim());
    } else {
      setSearchQuery(prev => {
        const spacer = prev ? ' ' : '';
        return prev + spacer + chipText;
      });
    }
  };

  const clearFilterToken = (key) => {
    const reg = new RegExp(`\\b${key}:(?:[^"\\s]+|"[^"]+")`, 'gi');
    setSearchQuery(prev => prev.replace(reg, '').replace(/\s+/g, ' ').trim());
  };

  return (
    <DashboardLayout activeMenu="Manage Tasks">
      <div className="mt-4 pb-12 animate-fade-in font-sans">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-xl md:text-2xl font-extrabold text-slate-900 dark:text-zinc-100 tracking-tight">📝 All Tasks</h1>
            {/* Live indicator */}
            {liveUpdate && (
              <span className="flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wider text-green-700 bg-green-50 border border-green-200/50 dark:bg-emerald-950/20 dark:text-emerald-455 dark:border-emerald-900/30 px-2.5 py-0.5 rounded-md animate-pulse">
                <LuRefreshCcw size={10} className="animate-spin" /> Live sync
              </span>
            )}
            {/* Manual refresh */}
            <RefreshButton
              id="manage-tasks-refresh"
              onRefresh={() => loadTasks(false)}
              size="sm"
            />
            {canCreateTask && (
              <div className="relative">
                <button
                  onClick={handleCreateNewTask}
                  className="card-btn-fill flex items-center gap-1.5 text-xs font-bold transition cursor-pointer"
                >
                  <LuPlus size={14} /> New Task
                </button>
                {showShortcuts && (
                  <span className="absolute -top-2.5 -right-2 bg-zinc-900 border border-zinc-800 text-zinc-300 font-mono text-[9px] font-bold px-1.5 py-0.5 rounded shadow-sm z-20 animate-fade-in uppercase">
                    C
                  </span>
                )}
              </div>
            )}
            <button className="flex lg:hidden card-btn gap-2 cursor-pointer text-xs" onClick={handleDownloadReport}
              style={{ display: canExportTasks ? undefined : 'none' }}>
              <LuFileSpreadsheet className="text-sm" /> Download
            </button>
          </div>

          {tabs?.[0]?.count > 0 && (
            <div className="flex items-center gap-3">
              <TaskStatusTabs tabs={tabs} activeTab={filterStatus} setActiveTab={setFilterStatus} />
              {canExportTasks && (
                <button className="hidden lg:flex card-btn gap-2 items-center cursor-pointer text-xs" onClick={handleDownloadReport}>
                  <LuFileSpreadsheet className="text-sm" /> Download Report
                </button>
              )}
            </div>
          )}
        </div>

        {/* Query Filter Toolbar */}
        <div className="card mb-6">
          <div className="relative">
            <LuSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              type="text"
              className="field-input pl-10 pr-12 dark:bg-[#121215] dark:border-zinc-800/80 dark:text-zinc-200"
              placeholder="Search title, description or use filter tags (e.g., assignee:me priority:high due:overdue status:pending)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {showShortcuts && (
              <span className="absolute right-12 top-1/2 -translate-y-1/2 bg-zinc-900 border border-zinc-800 text-zinc-300 font-mono text-[9px] font-bold px-1.5 py-0.5 rounded shadow-sm z-20 animate-fade-in">
                /
              </span>
            )}
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold px-1.5 py-0.5 rounded hover:bg-slate-100 dark:hover:bg-zinc-800 transition cursor-pointer"
              >
                Clear
              </button>
            )}
          </div>

          {/* Active parsed query badges */}
          {(parsedTokens.assignee || parsedTokens.priority || parsedTokens.status || parsedTokens.due || parsedTokens.text) && (
            <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-slate-100 dark:border-zinc-800/80 items-center">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 dark:text-zinc-500 flex items-center gap-1">
                <LuInfo size={11} /> Active Filters:
              </span>
              {parsedTokens.assignee && (
                <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-indigo-700 bg-indigo-50 border border-indigo-200/40 dark:bg-indigo-950/20 dark:text-indigo-400 dark:border-indigo-900/30 px-2 py-0.5 rounded">
                  <LuUser size={10} /> Assignee: {parsedTokens.assignee}
                  <button onClick={() => clearFilterToken('assignee')} className="hover:text-red-500 ml-1 cursor-pointer">×</button>
                </span>
              )}
              {parsedTokens.priority && (
                <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-amber-700 bg-amber-50 border border-amber-200/40 dark:bg-amber-955/15 dark:text-amber-405 dark:border-amber-900/30 px-2 py-0.5 rounded">
                  <LuFlag size={10} /> Priority: {parsedTokens.priority}
                  <button onClick={() => clearFilterToken('priority')} className="hover:text-red-500 ml-1 cursor-pointer">×</button>
                </span>
              )}
              {parsedTokens.status && (
                <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-emerald-700 bg-emerald-50 border border-emerald-200/40 dark:bg-emerald-950/20 dark:text-emerald-400 dark:border-emerald-900/30 px-2 py-0.5 rounded">
                  <LuLayers size={10} /> Status: {parsedTokens.status}
                  <button onClick={() => clearFilterToken('status')} className="hover:text-red-500 ml-1 cursor-pointer">×</button>
                </span>
              )}
              {parsedTokens.due && (
                <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-rose-700 bg-rose-50 border border-rose-200/40 dark:bg-rose-955/15 dark:text-rose-455 dark:border-rose-900/30 px-2 py-0.5 rounded">
                  <LuCalendar size={10} /> Due: {parsedTokens.due}
                  <button onClick={() => clearFilterToken('due')} className="hover:text-red-500 ml-1 cursor-pointer">×</button>
                </span>
              )}
              {parsedTokens.text && (
                <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-slate-700 bg-slate-50 border border-slate-200 dark:bg-zinc-800/40 dark:text-zinc-400 dark:border-zinc-700 px-2 py-0.5 rounded">
                  Search: "{parsedTokens.text}"
                  <button onClick={() => setSearchQuery(prev => prev.replace(parsedTokens.text, '').trim())} className="hover:text-red-500 ml-1 cursor-pointer">×</button>
                </span>
              )}
            </div>
          )}

          {/* Quick-toggle syntax help chips */}
          <div className="flex flex-wrap items-center gap-1.5 mt-2.5">
            <span className="text-[10px] font-bold text-slate-400 dark:text-zinc-550 uppercase tracking-wider mr-1">Quick Filters:</span>
            {[
              { label: 'Assigned to me', token: 'assignee:me' },
              { label: 'Priority High', token: 'priority:high' },
              { label: 'Due Overdue', token: 'due:overdue' },
              { label: 'Status Pending', token: 'status:pending' },
              { label: 'Status In Progress', token: 'status:"In Progress"' },
            ].map(c => {
              const active = searchQuery.includes(c.token);
              return (
                <button
                  key={c.token}
                  onClick={() => handleToggleFilterChip(c.token)}
                  className={`text-[10px] font-bold px-2.5 py-1 rounded-full border transition-all cursor-pointer ${
                    active
                      ? 'bg-indigo-650 dark:bg-indigo-500 text-white border-transparent shadow-sm'
                      : 'bg-slate-50 dark:bg-zinc-900/40 text-slate-500 dark:text-zinc-450 border-slate-200 dark:border-zinc-800 hover:border-indigo-300 dark:hover:border-zinc-700'
                  }`}
                >
                  {c.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Task grid */}
        {loading ? (
          <div className="flex flex-col items-center justify-center mt-16 gap-3">
            <LuLoaderCircle className="text-indigo-500 text-3xl animate-spin" />
            <p className="text-xs text-slate-400 dark:text-zinc-500 font-semibold uppercase tracking-wider">Syncing task indices...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
            {filteredTasks.length === 0 ? (
              <div className="col-span-3 card p-12 text-center">
                <p className="text-slate-400 dark:text-zinc-500 font-extrabold uppercase tracking-wider text-xs">No tasks match the active filters.</p>
                <p className="text-xs text-slate-400 dark:text-zinc-550 mt-1.5 font-medium">Try clearing your filters or adding a new task to get started.</p>
              </div>
            ) : (
              filteredTasks.map((item, idx) => {
                const isFocused = idx === focusedTaskIdx;
                return (
                  <div
                    key={item.id}
                    className={`relative rounded-2xl transition-all duration-200 ${
                      isFocused 
                        ? 'ring-4 ring-indigo-500/35 border-2 border-indigo-500 dark:border-indigo-400 scale-[1.01] shadow-lg shadow-indigo-100/40 z-10' 
                        : 'ring-0 border border-transparent'
                    }`}
                  >
                    <TaskCard
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
                      recurrenceRule={item.recurrenceRule}
                      onClick={() => handleClick(item)}
                    />
                    {showShortcuts && (
                      <span className="absolute -top-2.5 -left-2.5 bg-zinc-900 border border-zinc-800 text-zinc-350 font-mono text-[9px] font-bold px-1.5 py-0.5 rounded shadow-sm z-20 animate-fade-in uppercase">
                        {idx + 1}
                      </span>
                    )}
                    {showShortcuts && isFocused && (
                      <span className="absolute -bottom-2.5 -right-2.5 bg-indigo-650 text-white font-mono text-[9px] font-bold px-1.5 py-0.5 rounded shadow-sm z-20 animate-fade-in uppercase">
                        Press E to Edit
                      </span>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

      {/* Slide-over task editor */}
      <TaskSlidePanel
        taskId={selectedTaskId}
        isOpen={isSlidePanelOpen}
        onClose={() => setIsSlidePanelOpen(false)}
        onSuccess={() => loadTasks(true)}
      />
    </DashboardLayout>
  );
};

export default ManageTasks;