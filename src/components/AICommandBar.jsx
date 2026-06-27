import React, { useState, useEffect, useRef, useCallback, useContext } from 'react';
import {
  LuSparkles, LuX, LuLoader, LuSearch,
  LuWand, LuMessageSquare, LuCircleAlert, LuZap,
  LuCheck, LuChevronRight, LuTerminal, LuCommand
} from 'react-icons/lu';
import useAI from '../hooks/useAI';
import { UserContext }      from '../context/userContext';
import { WorkspaceContext } from '../context/WorkspaceContext';
import { useTheme }         from '../context/ThemeContext';
import { useNavigate }      from 'react-router-dom';

// ─────────────────────────────────────────────────────────────────────────────
// AICommandBar — Cmd+K / Ctrl+K overlay
// Provides a spotlight-style interface for NLP task creation, system command navigation,
// and real-time interactive auto-parsing chips.
// ─────────────────────────────────────────────────────────────────────────────

const QUICK_ACTIONS = [
  {
    id: 'warnings',
    icon: LuCircleAlert,
    label: 'Show workspace warnings',
    desc: 'Overdue, unassigned & workload alerts',
    color: 'text-amber-500 dark:text-amber-400',
    bg:    'bg-amber-50 dark:bg-amber-950/20',
  },
  {
    id: 'create',
    icon: LuZap,
    label: 'Create task from text',
    desc: 'e.g. "High priority login bug fix due Friday"',
    color: 'text-indigo-500 dark:text-indigo-400',
    bg:    'bg-indigo-50 dark:bg-indigo-950/20',
  },
  {
    id: 'help',
    icon: LuMessageSquare,
    label: 'How to use AI features',
    desc: 'Tip: type in the box then press Enter',
    color: 'text-emerald-500 dark:text-emerald-400',
    bg:    'bg-emerald-50 dark:bg-emerald-950/20',
  },
];

const HELP_TEXT = [
  '💡 In Create Task — click "✨ Suggest Priority" after filling title & description.',
  '💡 In Task Details — click "✨ AI Summary" to get a TL;DR of all comments.',
  '💡 Here in the command bar — type any task description and press Enter to auto-fill the create form.',
  '💡 Powered by Groq (Llama 3) — free & fast, no data stored externally.',
];

const AICommandBar = ({ isOpen, onClose, onTaskParsed, tasks = [] }) => {
  const { user }      = useContext(UserContext);
  const { workspace } = useContext(WorkspaceContext);
  const { parseNLTask, getWarnings, loading, error } = useAI();
  const { toggleTheme } = useTheme();
  const navigate = useNavigate();

  const [query,    setQuery   ] = useState('');
  const [result,   setResult  ] = useState(null);   // { type: 'warnings'|'task'|'help', data: any }
  const [activeQA, setActiveQA] = useState(null);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef(null);

  // System Commands list for '>' prefix
  const systemCommands = [
    { label: 'Navigate to Dashboard', action: () => navigate('/admin/dashboard') },
    { label: 'Navigate to Kanban Board', action: () => navigate('/admin/kanban') },
    { label: 'Navigate to Sprint Board', action: () => navigate('/admin/sprints') },
    { label: 'Navigate to Calendar', action: () => navigate('/admin/calendar') },
    { label: 'Navigate to Manage Users', action: () => navigate('/admin/users') },
    { label: 'Navigate to Manage Teams', action: () => navigate('/admin/teams') },
    { label: 'Navigate to Manage Tasks', action: () => navigate('/admin/tasks') },
    { label: 'Navigate to Analytics', action: () => navigate('/admin/analytics') },
    { label: 'Navigate to Reports', action: () => navigate('/admin/reports') },
    { label: 'Navigate to Integrations', action: () => navigate('/admin/integrations') },
    { label: 'Navigate to API Keys', action: () => navigate('/admin/api-keys') },
    { label: 'Navigate to Webhooks', action: () => navigate('/admin/webhooks') },
    { label: 'Navigate to Audit Log', action: () => navigate('/admin/audit') },
    { label: 'Toggle Light/Dark Theme', action: () => { toggleTheme(); onClose(); } },
  ];

  const getFilteredCommands = () => {
    if (!query.startsWith('>')) return [];
    const searchVal = query.slice(1).trim().toLowerCase();
    return systemCommands.filter(c => c.label.toLowerCase().includes(searchVal));
  };

  const filteredCmds = getFilteredCommands();

  // Real-time chip parsing helper
  const getRealtimeChips = (text) => {
    if (!text.trim() || text.startsWith('>')) return [];
    const chips = [];
    const lower = text.toLowerCase();
    
    // priority detection
    if (lower.includes('high priority') || lower.includes('priority:high') || lower.includes('🔴')) {
      chips.push({ label: 'Priority: High', color: 'text-rose-605 bg-rose-50 dark:text-rose-400 dark:bg-rose-950/35 border border-rose-200/40 dark:border-rose-900/30' });
    } else if (lower.includes('medium priority') || lower.includes('priority:medium') || lower.includes('🟡')) {
      chips.push({ label: 'Priority: Medium', color: 'text-amber-605 bg-amber-50 dark:text-amber-400 dark:bg-amber-950/35 border border-amber-200/40 dark:border-amber-900/30' });
    } else if (lower.includes('low priority') || lower.includes('priority:low') || lower.includes('🔵')) {
      chips.push({ label: 'Priority: Low', color: 'text-indigo-650 bg-indigo-50 dark:text-indigo-400 dark:bg-indigo-950/35 border border-indigo-200/40 dark:border-indigo-900/30' });
    }

    // due date detection
    if (lower.includes('due today') || lower.includes('due:today') || lower.includes('today')) {
      chips.push({ label: 'Due: Today', color: 'text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-950/35 border border-emerald-200/40 dark:border-emerald-900/30' });
    } else if (lower.includes('due tomorrow') || lower.includes('due:tomorrow') || lower.includes('tomorrow')) {
      chips.push({ label: 'Due: Tomorrow', color: 'text-purple-600 bg-purple-50 dark:text-purple-400 dark:bg-purple-950/35 border border-purple-200/40 dark:border-purple-900/30' });
    } else if (lower.includes('due friday') || lower.includes('due:friday') || lower.includes('friday')) {
      chips.push({ label: 'Due: Friday', color: 'text-pink-600 bg-pink-50 dark:text-pink-400 dark:bg-pink-950/35 border border-pink-200/40 dark:border-pink-900/30' });
    }

    // assignee
    const assigneeMatch = text.match(/@(\w+)/);
    if (assigneeMatch) {
      chips.push({ label: `Assignee: @${assigneeMatch[1]}`, color: 'text-sky-600 bg-sky-50 dark:text-sky-400 dark:bg-sky-950/35 border border-sky-200/40 dark:border-sky-900/30' });
    }

    return chips;
  };

  const realtimeChips = getRealtimeChips(query);

  // ── Focus on open ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setResult(null);
      setActiveQA(null);
      setSelectedIdx(0);
      setTimeout(() => inputRef.current?.focus(), 80);
    }
  }, [isOpen]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleWarnings = useCallback(async () => {
    setActiveQA('warnings');
    setResult(null);
    try {
      const warnings = await getWarnings(tasks);
      setResult({ type: 'warnings', data: warnings });
    } catch {
      setActiveQA(null);
    }
  }, [tasks, getWarnings]);

  const handleQuickAction = useCallback((id) => {
    if (id === 'warnings') { handleWarnings(); return; }
    if (id === 'help')     { setResult({ type: 'help', data: null }); return; }
    if (id === 'create')   { inputRef.current?.focus(); return; }
  }, [handleWarnings]);

  // ── Global Cmd+K / Ctrl+K & Keyboard Nav ──────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        isOpen ? onClose() : null;
      }
      if (e.key === 'Escape' && isOpen) onClose();

      if (!isOpen || result) return;

      const isCommandMode = query.startsWith('>');
      const itemsCount = isCommandMode ? filteredCmds.length : QUICK_ACTIONS.length;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIdx((prev) => (prev + 1) % itemsCount);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIdx((prev) => (prev - 1 + itemsCount) % itemsCount);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (isCommandMode) {
          if (filteredCmds[selectedIdx]) {
            filteredCmds[selectedIdx].action();
            onClose();
          }
        } else if (!query.trim()) {
          handleQuickAction(QUICK_ACTIONS[selectedIdx].id);
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose, result, query, selectedIdx, filteredCmds, handleQuickAction]);

  const handleSubmit = useCallback(async (e) => {
    e?.preventDefault();
    if (!query.trim() || loading || query.startsWith('>')) return;

    try {
      const parsed = await parseNLTask(query.trim());
      setResult({ type: 'task', data: parsed });
    } catch {
      // error surfaced via hook
    }
  }, [query, loading, parseNLTask]);

  const handleUseTask = () => {
    if (result?.data) {
      onTaskParsed(result.data);
      onClose();
    }
  };

  const PRIORITY_MAP = { high: 'High 🔴', medium: 'Medium 🟡', low: 'Low 🔵' };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop with elegant blur */}
      <div 
        className="fixed inset-0 bg-slate-950/40 dark:bg-black/60 backdrop-blur-[4px] z-[9998] animate-[ai-backdrop-in_0.15s_ease_both]" 
        onClick={onClose} 
      />

      {/* Modal spotlight panel */}
      <div 
        className="fixed top-[12vh] left-1/2 -translate-x-1/2 w-[92vw] md:w-full max-w-xl max-h-[75vh] md:max-h-[85vh] bg-white dark:bg-zinc-900 border border-slate-250/70 dark:border-zinc-800 rounded-2xl shadow-2xl z-[9999] overflow-hidden flex flex-col animate-[ai-slide-up_0.22s_cubic-bezier(0.16,1,0.3,1)_both]"
        role="dialog" 
        aria-modal="true" 
        aria-label="AI Assistant spotlight search"
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-zinc-800 bg-gradient-to-r from-slate-50 to-white dark:from-zinc-900 dark:to-zinc-900">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[var(--brand)] to-indigo-500 flex items-center justify-center text-white shadow-md shadow-indigo-500/10">
              <LuSparkles size={15} className="animate-pulse" />
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-black text-slate-800 dark:text-zinc-150 tracking-tight">AI Assistant & System Menu</span>
              <span className="text-[9px] text-slate-400 dark:text-zinc-500 font-bold uppercase tracking-wider mt-0.5">Spotlight Command</span>
            </div>
            <span className="text-[9px] font-black text-[var(--brand-text)] bg-[var(--brand-bg)] border border-[var(--brand-border)] rounded-md px-1.5 py-0.5 ml-2 font-mono">
              Ctrl+K
            </span>
          </div>
          <button 
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-650 hover:bg-slate-100 dark:text-zinc-500 dark:hover:text-zinc-300 dark:hover:bg-zinc-800 transition cursor-pointer"
          >
            <LuX size={15} />
          </button>
        </div>

        {/* ── Search / NLP input ── */}
        <form onSubmit={handleSubmit} className="flex items-center gap-3 px-5 py-4 border-b border-slate-150/60 dark:border-zinc-800/80 relative">
          <LuSearch className="text-slate-400 dark:text-zinc-500 flex-shrink-0" size={18} />
          <input
            ref={inputRef}
            value={query}
            onChange={e => {
              setQuery(e.target.value);
              setSelectedIdx(0);
            }}
            placeholder='Type ">" for navigation commands, or describe a task...'
            className="flex-1 text-sm text-slate-800 dark:text-zinc-100 bg-transparent border-none outline-none placeholder-slate-400 dark:placeholder-zinc-500 font-medium"
            disabled={loading}
          />
          {loading && <LuLoader className="text-[var(--brand)] animate-spin flex-shrink-0" size={16} />}
          {query && !loading && !query.startsWith('>') && (
            <button 
              type="submit" 
              className="inline-flex items-center gap-1.5 text-[10px] font-extrabold uppercase tracking-wider text-white bg-[var(--brand)] hover:bg-[var(--brand-text)] rounded-lg px-3.5 py-2 cursor-pointer shadow-md transition-all duration-200"
            >
              <LuWand size={11} /> Parse
            </button>
          )}
        </form>

        {/* Interactive auto-parsing chips */}
        {realtimeChips.length > 0 && (
          <div className="flex flex-wrap gap-2 px-5 py-3 bg-slate-50/50 dark:bg-zinc-950/40 border-b border-slate-100 dark:border-zinc-800/60 items-center">
            <span className="text-[9px] font-extrabold uppercase tracking-wider text-slate-450 dark:text-zinc-550">Interactive Tags:</span>
            {realtimeChips.map((chip, idx) => (
              <span key={idx} className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${chip.color} shadow-sm`}>
                {chip.label}
              </span>
            ))}
          </div>
        )}

        {/* ── Body ── */}
        <div className="p-5 flex-1 overflow-y-auto custom-scrollbar bg-slate-50/20 dark:bg-zinc-900/40">

          {/* Error display */}
          {error && (
            <div className="flex items-center gap-2 text-xs text-rose-600 bg-rose-50 dark:text-rose-400 dark:bg-rose-950/20 border border-rose-150/40 dark:border-rose-900/30 rounded-xl p-4 mb-4">
              <LuCircleAlert className="flex-shrink-0" size={15} />
              <span className="font-bold">{error}</span>
            </div>
          )}

          {/* ── Contextual system commands (type '>') ── */}
          {query.startsWith('>') && (
            <div className="flex flex-col gap-2.5">
              <p className="text-[10px] font-extrabold text-slate-400 dark:text-zinc-500 tracking-wider uppercase mb-1 flex items-center gap-1.5">
                <LuTerminal size={12} /> System Navigation Commands
              </p>
              {filteredCmds.length === 0 ? (
                <p className="text-xs text-slate-450 dark:text-zinc-500 font-bold py-3 text-center">No matching commands found.</p>
              ) : (
                <div className="flex flex-col gap-1">
                  {filteredCmds.map((cmd, index) => (
                    <button
                      key={cmd.label}
                      onClick={() => {
                        cmd.action();
                        onClose();
                      }}
                      onMouseEnter={() => setSelectedIdx(index)}
                      className={`w-full flex items-center justify-between p-3 rounded-xl transition-all duration-150 border border-transparent text-left cursor-pointer ${
                        index === selectedIdx 
                          ? 'bg-indigo-50/70 border-indigo-100/80 text-indigo-700 dark:bg-indigo-950/30 dark:border-indigo-900/50 dark:text-indigo-400' 
                          : 'hover:bg-slate-50 dark:hover:bg-zinc-800/40 text-slate-700 dark:text-zinc-300'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`p-1.5 rounded-lg ${index === selectedIdx ? 'bg-indigo-100/50 dark:bg-indigo-900/30' : 'bg-slate-100 dark:bg-zinc-800'}`}>
                          <LuCommand size={13} className={index === selectedIdx ? 'text-indigo-650 dark:text-indigo-400' : 'text-slate-400 dark:text-zinc-550'} />
                        </div>
                        <span className="text-xs font-bold">{cmd.label}</span>
                      </div>
                      <LuChevronRight size={14} className={index === selectedIdx ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-350 dark:text-zinc-600'} />
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Parsed NLP Task Card ── */}
          {!query.startsWith('>') && result?.type === 'task' && (
            <div className="bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800/80 rounded-2xl p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <p className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--brand-text)] bg-[var(--brand-bg)] border border-[var(--brand-border)] rounded-md px-2.5 py-1">
                  ✨ Parsed AI Task
                </p>
              </div>
              <div className="flex flex-col gap-3.5">
                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-bold text-slate-450 dark:text-zinc-550 uppercase tracking-wider">Task Title</span>
                  <span className="text-sm font-extrabold text-slate-800 dark:text-zinc-150 leading-snug">{result.data.title}</span>
                </div>
                
                <div className="grid grid-cols-2 gap-4 py-3 border-y border-slate-100 dark:border-zinc-800/60">
                  <div className="flex flex-col gap-1">
                    <span className="text-[10px] font-bold text-slate-450 dark:text-zinc-550 uppercase tracking-wider">Priority</span>
                    <span className="text-xs font-bold text-slate-700 dark:text-zinc-300 flex items-center gap-1.5">
                      {PRIORITY_MAP[result.data.priority] || result.data.priority}
                    </span>
                  </div>
                  
                  {result.data.assigneeHint && (
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] font-bold text-slate-450 dark:text-zinc-550 uppercase tracking-wider">Assignee Hint</span>
                      <span className="text-xs font-bold text-slate-700 dark:text-zinc-300 truncate">
                        👤 {result.data.assigneeHint}
                      </span>
                    </div>
                  )}

                  {result.data.dueDateOffset > 0 && (
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] font-bold text-slate-455 dark:text-zinc-550 uppercase tracking-wider">Due Date</span>
                      <span className="text-xs font-bold text-slate-700 dark:text-zinc-300">
                        📅 in {result.data.dueDateOffset} day(s)
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-1">
                  <span className="text-[10px] font-bold text-slate-450 dark:text-zinc-550 uppercase tracking-wider">Description</span>
                  <p className="text-xs text-slate-650 dark:text-zinc-400 font-medium leading-relaxed bg-slate-50/50 dark:bg-zinc-900/60 border border-slate-100 dark:border-zinc-800/40 rounded-xl p-3">
                    {result.data.description || 'No description provided.'}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-3 mt-5 pt-3 border-t border-slate-100 dark:border-zinc-800/60">
                <button 
                  className="inline-flex items-center justify-center gap-2 text-xs font-bold text-white bg-[var(--brand)] hover:bg-[var(--brand-text)] rounded-xl px-4 py-2.5 cursor-pointer shadow-md transition-all duration-200"
                  onClick={handleUseTask}
                >
                  <LuCheck size={14} /> Open in Create Task
                </button>
                <button 
                  className="inline-flex items-center justify-center text-xs font-bold text-slate-500 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-250 bg-slate-100 hover:bg-slate-200/60 dark:bg-zinc-800 dark:hover:bg-zinc-700/60 rounded-xl px-4 py-2.5 cursor-pointer transition-all"
                  onClick={() => setResult(null)}
                >
                  Dismiss
                </button>
              </div>
            </div>
          )}

          {/* ── Workspace Warnings ── */}
          {!query.startsWith('>') && result?.type === 'warnings' && (
            <div className="bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800/80 rounded-2xl p-5 shadow-sm">
              <p className="text-xs font-extrabold uppercase tracking-wider text-amber-600 dark:text-amber-400 mb-3 flex items-center gap-1.5">
                ⚡ Workspace Health Warnings
              </p>
              {result.data.length === 0 ? (
                <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-100 dark:border-emerald-900/30 rounded-xl p-4 text-center">
                  ✅ Everything looks healthy! No immediate warnings found.
                </p>
              ) : (
                <div className="flex flex-col gap-2">
                  {result.data.map((w, i) => (
                    <div key={i} className="text-xs text-slate-700 dark:text-zinc-300 font-bold p-3 bg-slate-50/60 dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800/80 rounded-xl flex items-center gap-2">
                      {w}
                    </div>
                  ))}
                </div>
              )}
              <button 
                className="mt-4 w-full inline-flex items-center justify-center text-xs font-bold text-slate-500 hover:text-slate-750 dark:text-zinc-400 dark:hover:text-zinc-200 bg-slate-100 hover:bg-slate-200/60 dark:bg-zinc-800 dark:hover:bg-zinc-700/60 rounded-xl px-4 py-2.5 cursor-pointer transition-all"
                onClick={() => setResult(null)}
              >
                Dismiss Warnings
              </button>
            </div>
          )}

          {/* ── Help Guide ── */}
          {!query.startsWith('>') && result?.type === 'help' && (
            <div className="bg-white dark:bg-zinc-950 border border-slate-200 dark:border-zinc-800/80 rounded-2xl p-5 shadow-sm">
              <p className="text-xs font-extrabold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 mb-4 flex items-center gap-1.5">
                💬 AI Assistant Features Guide
              </p>
              <div className="flex flex-col gap-3">
                {HELP_TEXT.map((t, i) => (
                  <p key={i} className="text-xs text-slate-650 dark:text-zinc-400 font-medium leading-relaxed flex items-start gap-2 bg-slate-50/50 dark:bg-zinc-900/50 border border-slate-100/65 dark:border-zinc-800/40 rounded-xl p-3">
                    {t}
                  </p>
                ))}
              </div>
              <button 
                className="mt-4 w-full inline-flex items-center justify-center text-xs font-bold text-slate-500 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-200 bg-slate-100 hover:bg-slate-200/60 dark:bg-zinc-800 dark:hover:bg-zinc-700/60 rounded-xl px-4 py-2.5 cursor-pointer transition-all"
                onClick={() => setResult(null)}
              >
                Dismiss Guide
              </button>
            </div>
          )}

          {/* ── Quick Actions (shown when no result and no commands mode) ── */}
          {!query.startsWith('>') && !result && (
            <div className="flex flex-col gap-2.5">
              <p className="text-[10px] font-extrabold text-slate-400 dark:text-zinc-550 tracking-wider uppercase mb-1">
                Quick Actions
              </p>
              <div className="flex flex-col gap-1.5">
                {QUICK_ACTIONS.map((qa, index) => (
                  <button
                    key={qa.id}
                    className={`w-full flex items-center justify-between p-3 rounded-xl transition-all duration-200 border border-transparent text-left cursor-pointer ${
                      index === selectedIdx || activeQA === qa.id 
                        ? 'bg-slate-50 border-slate-100 dark:bg-zinc-800/60 dark:border-zinc-800/80 shadow-sm' 
                        : 'hover:bg-slate-50/50 dark:hover:bg-zinc-850/30'
                    }`}
                    onClick={() => handleQuickAction(qa.id)}
                    disabled={loading && activeQA === qa.id}
                    onMouseEnter={() => setSelectedIdx(index)}
                  >
                    <div className="flex items-center gap-3.5">
                      <div className={`w-8 h-8 rounded-lg ${qa.bg} flex items-center justify-center flex-shrink-0`}>
                        <qa.icon className={qa.color} size={15} />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-slate-800 dark:text-zinc-150">{qa.label}</span>
                        <span className="text-[10px] text-slate-400 dark:text-zinc-500 font-semibold mt-0.5 leading-none">{qa.desc}</span>
                      </div>
                    </div>
                    {loading && activeQA === qa.id ? (
                      <LuLoader className="text-[var(--brand)] animate-spin flex-shrink-0" size={14} />
                    ) : (
                      <LuChevronRight size={14} className="text-slate-350 dark:text-zinc-650 flex-shrink-0" />
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3.5 border-t border-slate-100 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-950/20 text-[10px] text-slate-400 dark:text-zinc-500 font-bold">
          <span className="flex items-center gap-1">Powered by <span className="font-extrabold text-slate-500 dark:text-zinc-400">Groq · Llama 3 · 8B</span></span>
          <span>Workspace: <span className="font-extrabold text-[var(--brand)]">{workspace?.name || '—'}</span></span>
        </div>
      </div>
    </>
  );
};

export default AICommandBar;
