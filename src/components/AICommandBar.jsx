import React, { useState, useEffect, useRef, useCallback, useContext } from 'react';
import {
  LuSparkles, LuX, LuLoader, LuSearch, LuWand, LuMessageSquare,
  LuCircleAlert, LuZap, LuCheck, LuChevronRight, LuTerminal,
  LuCommand, LuSend, LuBot, LuUser, LuListChecks, LuPenLine,
  LuTriangleAlert
} from 'react-icons/lu';
import useAI from '../hooks/useAI';
import { UserContext } from '../context/userContext';
import { WorkspaceContext } from '../context/WorkspaceContext';
import { useTheme } from '../context/ThemeContext';
import { useNavigate } from 'react-router-dom';

// ── Tabs ─────────────────────────────────────────────────────────────────────
const TABS = [
  { id: 'chat', label: '💬 Chat', icon: LuMessageSquare },
  { id: 'command', label: '⚡ Commands', icon: LuCommand },
];

// ── System navigation commands ────────────────────────────────────────────────
const buildSystemCommands = (navigate, toggleTheme, onClose) => [
  { label: 'Go to Dashboard', action: () => navigate('/admin/dashboard') },
  { label: 'Go to Kanban Board', action: () => navigate('/admin/kanban') },
  { label: 'Go to Sprint Board', action: () => navigate('/admin/sprints') },
  { label: 'Go to Calendar', action: () => navigate('/admin/calendar') },
  { label: 'Go to Manage Tasks', action: () => navigate('/admin/tasks') },
  { label: 'Go to Manage Users', action: () => navigate('/admin/users') },
  { label: 'Go to Analytics', action: () => navigate('/admin/analytics') },
  { label: 'Go to Reports', action: () => navigate('/admin/reports') },
  { label: 'Go to Goals & OKRs', action: () => navigate('/admin/goals') },
  { label: 'Go to Team Chat', action: () => navigate('/chat') },
  { label: 'Go to Audit Log', action: () => navigate('/admin/audit') },
  { label: 'Go to API Keys', action: () => navigate('/admin/api-keys') },
  { label: 'Toggle Dark/Light Theme', action: () => { toggleTheme(); onClose(); } },
];

// ── Quick actions shown in Chat tab ──────────────────────────────────────────
const QUICK_PROMPTS = [
  { label: '📋 Parse task from text', prompt: 'Create a high priority bug fix for login page due Friday' },
  { label: '⚠️ Workspace health check', prompt: 'Show me workspace warnings and health status' },
  { label: '📝 Help write task description', prompt: 'Help me write a task description for building a user authentication module' },
  { label: '✅ Generate subtasks', prompt: 'Generate a checklist for: Design and implement a dashboard analytics page' },
  { label: '📊 Productivity tips', prompt: 'Give me 3 tips to improve our team productivity in Strideo' },
  { label: '🗺️ Feature guide', prompt: 'What AI features does Strideo have and how do I use them?' },
];

const AICommandBar = ({ isOpen, onClose, onTaskParsed, tasks = [] }) => {
  const { user } = useContext(UserContext);
  const { workspace } = useContext(WorkspaceContext);
  const { loading, error, setError, chat, parseNLTask, getWarnings } = useAI();
  const { toggleTheme } = useTheme();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('chat');
  const [cmdQuery, setCmdQuery] = useState('');
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [messages, setMessages] = useState([]);        // [{ role, content }]
  const [chatInput, setChatInput] = useState('');
  const [nlResult, setNlResult] = useState(null);
  const [isTyping, setIsTyping] = useState(false);

  const inputRef = useRef(null);
  const chatEndRef = useRef(null);

  const systemCmds = buildSystemCommands(navigate, toggleTheme, onClose);

  const filteredCmds = cmdQuery.trim()
    ? systemCmds.filter(c => c.label.toLowerCase().includes(cmdQuery.toLowerCase()))
    : systemCmds;

  // ── Reset & focus on open ─────────────────────────────────────────────────
  useEffect(() => {
    if (isOpen) {
      setNlResult(null);
      setCmdQuery('');
      setSelectedIdx(0);
      setError?.(null);
      setTimeout(() => inputRef.current?.focus(), 80);
    }
  }, [isOpen]);

  // ── Auto-scroll chat ──────────────────────────────────────────────────────
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  // ── Escape key ────────────────────────────────────────────────────────────
  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape' && isOpen) onClose(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [isOpen, onClose]);

  // ── Send chat message ─────────────────────────────────────────────────────
  const sendMessage = useCallback(async (text) => {
    const trimmed = text?.trim();
    if (!trimmed || loading) return;

    const userMsg = { role: 'user', content: trimmed };
    const history = [...messages, userMsg];
    setMessages(history);
    setChatInput('');
    setNlResult(null);
    setIsTyping(true);

    const context = {
      name: workspace?.name,
      taskCount: tasks.length,
      pendingCount: tasks.filter(t => t.status === 'Pending').length,
    };

    try {
      const reply = await chat(history, context);
      setMessages(prev => [...prev, { role: 'assistant', content: reply }]);

      // Auto-detect if reply contains a parseable task structure
      if (trimmed.toLowerCase().includes('create task') || trimmed.toLowerCase().includes('parse task')) {
        try {
          const parsed = await parseNLTask(trimmed);
          setNlResult(parsed);
        } catch { /* silent */ }
      }
    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `❌ ${err.message || 'Something went wrong. Please try again.'}`,
        isError: true,
      }]);
    } finally {
      setIsTyping(false);
    }
  }, [messages, loading, chat, workspace, tasks, parseNLTask]);

  const handleChatSubmit = (e) => {
    e.preventDefault();
    sendMessage(chatInput);
  };

  // ── Parse NLP quick-submit ────────────────────────────────────────────────
  const handleParseTask = useCallback(async () => {
    if (!chatInput.trim() || loading) return;
    try {
      const parsed = await parseNLTask(chatInput.trim());
      setNlResult(parsed);
      setMessages(prev => [...prev,
      { role: 'user', content: chatInput.trim() },
      { role: 'assistant', content: `✨ I've parsed your task! Here's what I extracted. Review it and click "Open in Create Task" to proceed.` }
      ]);
      setChatInput('');
    } catch { /* error surfaced by hook */ }
  }, [chatInput, loading, parseNLTask]);

  const handleUseTask = () => {
    if (nlResult) { onTaskParsed(nlResult); onClose(); }
  };

  const PRIORITY_MAP = { high: 'High 🔴', medium: 'Medium 🟡', low: 'Low 🔵' };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-950/40 dark:bg-black/60 backdrop-blur-[4px] z-[9998] animate-[ai-backdrop-in_0.15s_ease_both]"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className="fixed top-[8vh] left-1/2 -translate-x-1/2 w-[95vw] md:w-full max-w-2xl max-h-[84vh] bg-white dark:bg-zinc-900 border border-slate-200/70 dark:border-zinc-800 rounded-2xl shadow-2xl z-[9999] overflow-hidden flex flex-col animate-[ai-slide-up_0.22s_cubic-bezier(0.16,1,0.3,1)_both]"
        role="dialog" aria-modal="true" aria-label="AI Assistant"
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 dark:border-zinc-800 bg-gradient-to-r from-slate-50 to-white dark:from-zinc-900 dark:to-zinc-900 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="ai-cmd-icon-wrap w-8 h-8 rounded-xl flex items-center justify-center text-white shadow-md">
              <LuSparkles size={15} />
            </div>
            <div>
              <span className="text-xs font-black text-slate-800 dark:text-zinc-100 tracking-tight">Aria · AI Assistant</span>
              <span className="block text-[9px] text-slate-400 dark:text-zinc-500 font-bold uppercase tracking-wider">Powered by GPT-5.4 mini</span>
            </div>
            <span className="ai-cmd-kbd text-[9px] font-black rounded-md px-1.5 py-0.5 font-mono ml-1">Ctrl+K</span>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-zinc-800 transition cursor-pointer">
            <LuX size={15} />
          </button>
        </div>

        {/* ── Tabs ── */}
        <div className="flex border-b border-slate-100 dark:border-zinc-800 bg-slate-50/50 dark:bg-zinc-900/50 flex-shrink-0">
          {TABS.map(tab => (
            <button
              key={tab.id}
              onClick={() => { setActiveTab(tab.id); setTimeout(() => inputRef.current?.focus(), 50); }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold transition cursor-pointer border-b-2 ${activeTab === tab.id
                  ? 'border-[var(--brand)] text-[var(--brand)]'
                  : 'border-transparent text-slate-500 dark:text-zinc-400 hover:text-slate-700 dark:hover:text-zinc-200'
                }`}
            >
              <tab.icon size={13} />
              {tab.label}
            </button>
          ))}
        </div>

        {/* ══════════ CHAT TAB ══════════ */}
        {activeTab === 'chat' && (
          <div className="flex flex-col flex-1 min-h-0">
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
              {messages.length === 0 && (
                <div className="space-y-3">
                  <div className="flex items-start gap-3 mb-4">
                    <div className="ai-cmd-icon-wrap w-7 h-7 rounded-xl flex items-center justify-center text-white flex-shrink-0">
                      <LuBot size={13} />
                    </div>
                    <div className="bg-slate-50 dark:bg-zinc-800/60 border border-slate-100 dark:border-zinc-800 rounded-2xl rounded-tl-sm px-4 py-3 max-w-[85%]">
                      <p className="text-xs font-semibold text-slate-700 dark:text-zinc-200 leading-relaxed">
                        Hi! I'm <span className="font-black text-[var(--brand)]">Aria</span>, your AI assistant for Strideo. I can help you create tasks, plan sprints, write descriptions, and answer questions about your workspace.
                      </p>
                      <p className="text-[10px] text-slate-400 dark:text-zinc-500 mt-1.5 font-bold">Try one of the quick prompts below, or type anything!</p>
                    </div>
                  </div>
                  {/* Quick prompts */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {QUICK_PROMPTS.map((qp, i) => (
                      <button
                        key={i}
                        onClick={() => sendMessage(qp.prompt)}
                        className="text-left px-3 py-2.5 text-[11px] font-bold text-slate-600 dark:text-zinc-300 bg-slate-50 dark:bg-zinc-800/40 border border-slate-200/60 dark:border-zinc-700/60 rounded-xl hover:bg-[var(--brand-bg)] hover:border-[var(--brand-border)] hover:text-[var(--brand-text)] transition-all cursor-pointer"
                      >
                        {qp.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((msg, idx) => (
                <div key={idx} className={`flex items-start gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-white text-[10px] font-black ${msg.role === 'user' ? 'bg-slate-700 dark:bg-zinc-600' : 'ai-cmd-icon-wrap'
                    }`}>
                    {msg.role === 'user' ? <LuUser size={11} /> : <LuBot size={11} />}
                  </div>
                  <div className={`max-w-[82%] px-4 py-2.5 rounded-2xl text-xs leading-relaxed font-medium whitespace-pre-wrap ${msg.role === 'user'
                      ? 'bg-[var(--brand)] text-white rounded-tr-sm'
                      : msg.isError
                        ? 'bg-rose-50 dark:bg-rose-950/20 border border-rose-200/40 dark:border-rose-900/30 text-rose-700 dark:text-rose-400 rounded-tl-sm'
                        : 'bg-slate-50 dark:bg-zinc-800/60 border border-slate-100 dark:border-zinc-800 text-slate-700 dark:text-zinc-200 rounded-tl-sm'
                    }`}>
                    {msg.content}
                  </div>
                </div>
              ))}

              {isTyping && (
                <div className="flex items-start gap-3">
                  <div className="ai-cmd-icon-wrap w-6 h-6 rounded-full flex items-center justify-center text-white">
                    <LuBot size={11} />
                  </div>
                  <div className="bg-slate-50 dark:bg-zinc-800/60 border border-slate-100 dark:border-zinc-800 rounded-2xl rounded-tl-sm px-4 py-2.5">
                    <div className="flex gap-1 items-center h-4">
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:0ms]" />
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:150ms]" />
                      <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-bounce [animation-delay:300ms]" />
                    </div>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* NL Task Result */}
            {nlResult && (
              <div className="mx-4 mb-3 bg-[var(--brand-bg)] border border-[var(--brand-border)] rounded-2xl p-4 flex-shrink-0">
                <p className="text-[10px] font-extrabold uppercase tracking-wider text-[var(--brand-text)] mb-2.5">✨ Parsed Task</p>
                <div className="space-y-1.5">
                  <p className="text-sm font-black text-slate-800 dark:text-zinc-100">{nlResult.title}</p>
                  <div className="flex gap-3 text-[10px] font-bold text-slate-500 dark:text-zinc-400">
                    <span>{PRIORITY_MAP[nlResult.priority] || nlResult.priority}</span>
                    {nlResult.dueDateOffset > 0 && <span>📅 in {nlResult.dueDateOffset} day(s)</span>}
                    {nlResult.assigneeHint && <span>👤 {nlResult.assigneeHint}</span>}
                  </div>
                  {nlResult.description && <p className="text-[11px] text-slate-600 dark:text-zinc-400 font-medium">{nlResult.description}</p>}
                </div>
                <div className="flex gap-2 mt-3">
                  <button onClick={handleUseTask} className="flex-1 ai-cmd-run-btn text-white text-xs font-bold py-2 rounded-xl flex items-center justify-center gap-1.5 cursor-pointer transition">
                    <LuCheck size={12} /> Open in Create Task
                  </button>
                  <button onClick={() => setNlResult(null)} className="px-4 py-2 text-xs font-bold text-slate-500 bg-white dark:bg-zinc-800 border border-slate-200 dark:border-zinc-700 rounded-xl cursor-pointer transition">
                    Dismiss
                  </button>
                </div>
              </div>
            )}

            {/* Error Banner */}
            {error && (
              <div className="mx-4 mb-3 flex items-start gap-2 text-xs text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/20 border border-rose-200/50 dark:border-rose-900/30 rounded-xl p-3 flex-shrink-0">
                <LuTriangleAlert size={14} className="flex-shrink-0 mt-0.5" />
                <span className="font-bold">{error}</span>
              </div>
            )}

            {/* Chat input */}
            <div className="border-t border-slate-100 dark:border-zinc-800 p-3 flex-shrink-0 bg-white dark:bg-zinc-900">
              <form onSubmit={handleChatSubmit} className="flex items-end gap-2">
                <div className="flex-1 relative">
                  <textarea
                    ref={inputRef}
                    value={chatInput}
                    onChange={e => setChatInput(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(chatInput); }
                    }}
                    placeholder="Ask Aria anything... (Enter to send, Shift+Enter for newline)"
                    rows={2}
                    className="w-full text-xs font-medium text-slate-800 dark:text-zinc-100 bg-slate-50 dark:bg-zinc-800/60 border border-slate-200 dark:border-zinc-700 rounded-xl px-3.5 py-2.5 outline-none resize-none placeholder:text-slate-400 dark:placeholder:text-zinc-500 focus:border-[var(--brand)] focus:ring-1 focus:ring-[var(--brand-ring)] transition"
                    disabled={loading || isTyping}
                  />
                </div>
                <div className="flex flex-col gap-1.5 flex-shrink-0">
                  <button
                    type="submit"
                    disabled={!chatInput.trim() || loading || isTyping}
                    className="ai-cmd-run-btn text-white p-2.5 rounded-xl cursor-pointer transition disabled:opacity-50"
                    title="Send (Enter)"
                  >
                    {loading || isTyping ? <LuLoader size={15} className="animate-spin" /> : <LuSend size={15} />}
                  </button>
                  <button
                    type="button"
                    disabled={!chatInput.trim() || loading || isTyping}
                    onClick={handleParseTask}
                    className="bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 p-2.5 rounded-xl cursor-pointer transition hover:bg-[var(--brand-bg)] hover:text-[var(--brand)] disabled:opacity-50"
                    title="Parse as Task"
                  >
                    <LuWand size={15} />
                  </button>
                </div>
              </form>
              <div className="flex items-center justify-between mt-2 px-0.5">
                <span className="text-[9px] text-slate-350 dark:text-zinc-600 font-bold uppercase tracking-wider">GPT-5.4 mini · Aria</span>
                {messages.length > 0 && (
                  <button onClick={() => { setMessages([]); setNlResult(null); }} className="text-[9px] text-slate-400 dark:text-zinc-500 hover:text-rose-500 font-bold cursor-pointer transition">
                    Clear chat
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ══════════ COMMANDS TAB ══════════ */}
        {activeTab === 'command' && (
          <div className="flex flex-col flex-1 min-h-0">
            {/* Search */}
            <div className="flex items-center gap-3 px-5 py-3 border-b border-slate-100/60 dark:border-zinc-800/80">
              <LuSearch className="text-slate-400 dark:text-zinc-500 flex-shrink-0" size={16} />
              <input
                ref={inputRef}
                value={cmdQuery}
                onChange={e => { setCmdQuery(e.target.value); setSelectedIdx(0); }}
                onKeyDown={e => {
                  if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIdx(p => (p + 1) % filteredCmds.length); }
                  if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIdx(p => (p - 1 + filteredCmds.length) % filteredCmds.length); }
                  if (e.key === 'Enter' && filteredCmds[selectedIdx]) { filteredCmds[selectedIdx].action(); onClose(); }
                }}
                placeholder="Search navigation commands..."
                className="flex-1 text-sm text-slate-800 dark:text-zinc-100 bg-transparent border-none outline-none placeholder-slate-400 dark:placeholder-zinc-500 font-medium"
              />
            </div>
            <div className="flex-1 overflow-y-auto p-3 custom-scrollbar">
              <p className="text-[10px] font-extrabold text-slate-400 dark:text-zinc-500 uppercase tracking-wider mb-2 px-2 flex items-center gap-1.5">
                <LuTerminal size={11} /> Navigation · {filteredCmds.length} commands
              </p>
              <div className="flex flex-col gap-0.5">
                {filteredCmds.map((cmd, index) => (
                  <button
                    key={cmd.label}
                    onClick={() => { cmd.action(); onClose(); }}
                    onMouseEnter={() => setSelectedIdx(index)}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition cursor-pointer text-left ${index === selectedIdx
                        ? 'bg-[var(--brand-bg)] border border-[var(--brand-border)] text-[var(--brand-text)]'
                        : 'hover:bg-slate-50 dark:hover:bg-zinc-800/40 text-slate-700 dark:text-zinc-300'
                      }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-1.5 rounded-lg ${index === selectedIdx ? 'bg-[var(--brand)] text-white' : 'bg-slate-100 dark:bg-zinc-800 text-slate-400 dark:text-zinc-500'}`}>
                        <LuCommand size={11} />
                      </div>
                      <span className="text-xs font-bold">{cmd.label}</span>
                    </div>
                    <LuChevronRight size={13} className="opacity-50" />
                  </button>
                ))}
              </div>

              {/* Quick AI actions */}
              <div className="mt-4 border-t border-slate-100 dark:border-zinc-800 pt-4">
                <p className="text-[10px] font-extrabold text-slate-400 dark:text-zinc-500 uppercase tracking-wider mb-2 px-2 flex items-center gap-1.5">
                  <LuSparkles size={11} /> AI Quick Actions
                </p>
                <div className="flex flex-col gap-0.5">
                  {[
                    { icon: LuZap, label: 'Create task from description', action: () => setActiveTab('chat') },
                    { icon: LuCircleAlert, label: 'Check workspace warnings', action: async () => { setActiveTab('chat'); await sendMessage('Show me workspace warnings and overdue tasks'); } },
                    { icon: LuListChecks, label: 'Generate task checklist', action: () => { setActiveTab('chat'); setChatInput('Generate a checklist for: '); inputRef.current?.focus(); } },
                    { icon: LuPenLine, label: 'Write task description', action: () => { setActiveTab('chat'); setChatInput('Help me write a task description for: '); inputRef.current?.focus(); } },
                    { icon: LuMessageSquare, label: 'Ask Aria a question', action: () => setActiveTab('chat') },
                  ].map((item, i) => (
                    <button
                      key={i}
                      onClick={item.action}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-50 dark:hover:bg-zinc-800/40 text-slate-600 dark:text-zinc-300 transition cursor-pointer text-left group"
                    >
                      <div className="p-1.5 rounded-lg bg-slate-100 dark:bg-zinc-800 text-slate-500 dark:text-zinc-400 group-hover:bg-[var(--brand-bg)] group-hover:text-[var(--brand)] transition">
                        <item.icon size={11} />
                      </div>
                      <span className="text-xs font-bold">{item.label}</span>
                      <LuChevronRight size={13} className="ml-auto opacity-40 group-hover:opacity-70" />
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="px-5 py-3 border-t border-slate-100 dark:border-zinc-800 text-[9px] text-slate-400 dark:text-zinc-500 font-bold flex justify-between">
              <span>↑↓ Navigate · Enter to select</span>
              <span>Workspace: <span className="text-[var(--brand)]">{workspace?.name || '—'}</span></span>
            </div>
          </div>
        )}
      </div>
    </>
  );
};

export default AICommandBar;
