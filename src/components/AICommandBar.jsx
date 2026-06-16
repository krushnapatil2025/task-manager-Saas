import React, { useState, useEffect, useRef, useCallback, useContext } from 'react';
import {
  LuSparkles, LuX, LuLoader, LuSearch,
  LuWand, LuMessageSquare, LuCircleAlert, LuZap,
  LuCheck, LuChevronRight,
} from 'react-icons/lu';
import useAI from '../hooks/useAI';
import { UserContext }      from '../context/userContext';
import { WorkspaceContext } from '../context/WorkspaceContext';

// ─────────────────────────────────────────────────────────────────────────────
// AICommandBar — Cmd+K / Ctrl+K overlay
//
// Provides a spotlight-style interface for:
//   • Natural language task creation  ("create a high priority bug…")
//   • Smart warnings                  ("show me workspace warnings")
//   • Quick prompts via quick actions panel
//
// Props:
//   isOpen      boolean
//   onClose     () => void
//   onTaskParsed (parsedTask) => void   — navigate to CreateTask with prefilled data
//   tasks       array — current workspace tasks for warnings analysis
// ─────────────────────────────────────────────────────────────────────────────

const QUICK_ACTIONS = [
  {
    id: 'warnings',
    icon: LuCircleAlert,
    label: 'Show workspace warnings',
    desc: 'Overdue, unassigned & workload alerts',
    color: 'text-amber-500',
    bg:    'bg-amber-50',
  },
  {
    id: 'create',
    icon: LuZap,
    label: 'Create task from text',
    desc: 'e.g. "High priority login bug fix due Friday"',
    color: 'text-indigo-500',
    bg:    'bg-indigo-50',
  },
  {
    id: 'help',
    icon: LuMessageSquare,
    label: 'How to use AI features',
    desc: 'Tip: type in the box then press Enter',
    color: 'text-emerald-500',
    bg:    'bg-emerald-50',
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

  const [query,    setQuery   ] = useState('');
  const [result,   setResult  ] = useState(null);   // { type: 'warnings'|'task'|'help', data: any }
  const [activeQA, setActiveQA] = useState(null);
  const inputRef = useRef(null);

  // ── Focus on open ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setResult(null);
      setActiveQA(null);
      setTimeout(() => inputRef.current?.focus(), 80);
    }
  }, [isOpen]);

  // ── Global Cmd+K / Ctrl+K ─────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        isOpen ? onClose() : null; // parent toggles
      }
      if (e.key === 'Escape' && isOpen) onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleSubmit = useCallback(async (e) => {
    e?.preventDefault();
    if (!query.trim() || loading) return;

    try {
      const parsed = await parseNLTask(query.trim());
      setResult({ type: 'task', data: parsed });
    } catch {
      // error surfaced via hook
    }
  }, [query, loading, parseNLTask]);

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

  const handleQuickAction = (id) => {
    if (id === 'warnings') { handleWarnings(); return; }
    if (id === 'help')     { setResult({ type: 'help', data: null }); return; }
    if (id === 'create')   { inputRef.current?.focus(); return; }
  };

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
      {/* Backdrop */}
      <div className="ai-cmd-backdrop" onClick={onClose} />

      {/* Modal */}
      <div className="ai-cmd-modal" role="dialog" aria-modal="true" aria-label="AI Command Bar">

        {/* ── Header ── */}
        <div className="ai-cmd-header">
          <div className="ai-cmd-header-left">
            <div className="ai-cmd-icon-wrap">
              <LuSparkles className="ai-cmd-icon" />
            </div>
            <span className="ai-cmd-title">AI Assistant</span>
            <span className="ai-cmd-kbd">Ctrl+K</span>
          </div>
          <button className="ai-cmd-close" onClick={onClose}>
            <LuX size={16} />
          </button>
        </div>

        {/* ── Search / NLP input ── */}
        <form onSubmit={handleSubmit} className="ai-cmd-search-wrap">
          <LuSearch className="ai-cmd-search-icon" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder='Describe a task… e.g. "Fix login bug, high priority, due Friday"'
            className="ai-cmd-input"
            disabled={loading}
          />
          {loading && <LuLoader className="ai-cmd-spin" />}
          {query && !loading && (
            <button type="submit" className="ai-cmd-run-btn">
              <LuWand size={14} /> Parse
            </button>
          )}
        </form>

        {/* ── Body ── */}
        <div className="ai-cmd-body">

          {/* Error */}
          {error && (
            <div className="ai-cmd-error">
              <LuCircleAlert size={14} /> {error}
            </div>
          )}

          {/* ── Results ── */}
          {result?.type === 'task' && (
            <div className="ai-cmd-result-card">
              <p className="ai-cmd-result-title">✨ Task parsed</p>
              <div className="ai-cmd-result-row">
                <span className="ai-cmd-result-label">Title</span>
                <span className="ai-cmd-result-val">{result.data.title}</span>
              </div>
              <div className="ai-cmd-result-row">
                <span className="ai-cmd-result-label">Priority</span>
                <span className="ai-cmd-result-val">{PRIORITY_MAP[result.data.priority] || result.data.priority}</span>
              </div>
              {result.data.assigneeHint && (
                <div className="ai-cmd-result-row">
                  <span className="ai-cmd-result-label">Assign to</span>
                  <span className="ai-cmd-result-val">{result.data.assigneeHint}</span>
                </div>
              )}
              {result.data.dueDateOffset > 0 && (
                <div className="ai-cmd-result-row">
                  <span className="ai-cmd-result-label">Due in</span>
                  <span className="ai-cmd-result-val">{result.data.dueDateOffset} day(s)</span>
                </div>
              )}
              <p className="ai-cmd-result-desc">{result.data.description}</p>
              <div className="ai-cmd-result-actions">
                <button className="ai-cmd-accept" onClick={handleUseTask}>
                  <LuCheck size={14} /> Open in Create Task
                </button>
                <button className="ai-cmd-dismiss" onClick={() => setResult(null)}>
                  Dismiss
                </button>
              </div>
            </div>
          )}

          {result?.type === 'warnings' && (
            <div className="ai-cmd-result-card ai-cmd-warnings">
              <p className="ai-cmd-result-title">⚡ Workspace Warnings</p>
              {result.data.length === 0
                ? <p className="ai-cmd-no-warn">✅ Everything looks good!</p>
                : result.data.map((w, i) => (
                    <div key={i} className="ai-cmd-warn-item">{w}</div>
                  ))
              }
            </div>
          )}

          {result?.type === 'help' && (
            <div className="ai-cmd-result-card">
              <p className="ai-cmd-result-title">💬 AI Features Guide</p>
              {HELP_TEXT.map((t, i) => (
                <p key={i} className="ai-cmd-help-line">{t}</p>
              ))}
            </div>
          )}

          {/* ── Quick Actions (shown when no result) ── */}
          {!result && (
            <div className="ai-cmd-qa-list">
              <p className="ai-cmd-qa-heading">Quick Actions</p>
              {QUICK_ACTIONS.map(qa => (
                <button
                  key={qa.id}
                  className={`ai-cmd-qa-item ${activeQA === qa.id ? 'ai-cmd-qa-active' : ''}`}
                  onClick={() => handleQuickAction(qa.id)}
                  disabled={loading && activeQA === qa.id}
                >
                  <div className={`ai-cmd-qa-icon ${qa.bg}`}>
                    <qa.icon className={qa.color} size={16} />
                  </div>
                  <div className="ai-cmd-qa-text">
                    <span className="ai-cmd-qa-label">{qa.label}</span>
                    <span className="ai-cmd-qa-desc">{qa.desc}</span>
                  </div>
                  {loading && activeQA === qa.id
                    ? <LuLoader className="ai-spin ml-auto" size={14} />
                    : <LuChevronRight className="ai-cmd-qa-arrow" size={14} />
                  }
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="ai-cmd-footer">
          <span>Powered by Groq · Llama 3 · 8B</span>
          <span>Workspace: {workspace?.name || '—'}</span>
        </div>
      </div>
    </>
  );
};

export default AICommandBar;
