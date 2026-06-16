import React, { useState, useRef, useEffect, useContext } from 'react';
import {
  LuSend, LuLoaderCircle, LuRefreshCcw, LuSparkles,
} from 'react-icons/lu';
import { useTaskChat }   from '../hooks/useTaskChat';
import { usePresence }   from '../hooks/usePresence';
import { UserContext }   from '../context/userContext';
import ChatMessage       from './ChatMessage';
import PresenceAvatars   from './PresenceAvatars';
import useAI             from '../hooks/useAI';

// ─────────────────────────────────────────────────────────────────────────────
// TaskChatPanel — Real-time task chat (Phase 12)
// Replaces the old static TaskComments component.
// Props:
//   taskId     string
//   taskTitle  string  (for AI summary context)
// ─────────────────────────────────────────────────────────────────────────────

const MEMBER_SUGGESTIONS = []; // autocomplete pool — populated by parent if needed

const TaskChatPanel = ({ taskId, taskTitle = 'Task' }) => {
  const { user } = useContext(UserContext);

  const { messages, loading, sendMessage, deleteMessage, toggleReaction, refresh }
    = useTaskChat(taskId);
  const { presentUsers } = usePresence(taskId);

  const { summariseComments, loading: aiLoading } = useAI();

  const [input,       setInput      ] = useState('');
  const [sending,     setSending    ] = useState(false);
  const [sendErr,     setSendErr    ] = useState('');
  const [aiSummary,   setAiSummary  ] = useState('');
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');

  const bottomRef   = useRef(null);
  const inputRef    = useRef(null);

  // Auto-scroll on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── Send ────────────────────────────────────────────────────────────────
  const handleSend = async (e) => {
    e?.preventDefault();
    if (!input.trim() || sending) return;
    setSending(true);
    setSendErr('');
    try {
      await sendMessage(input.trim());
      setInput('');
    } catch (err) {
      const msg = err?.message || 'Failed to send. Check your connection and try again.';
      setSendErr(msg);
      console.error('TaskChat send failed:', err);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  // Ctrl+Enter or Enter to send
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // ── @mention autocomplete ─────────────────────────────────────────────
  const handleInputChange = (e) => {
    const val = e.target.value;
    setInput(val);
    const match = val.match(/@(\w*)$/);
    if (match) {
      setMentionQuery(match[1].toLowerCase());
      setShowSuggestions(true);
    } else {
      setShowSuggestions(false);
    }
  };

  const insertMention = (name) => {
    setInput(prev => prev.replace(/@\w*$/, `@${name} `));
    setShowSuggestions(false);
    inputRef.current?.focus();
  };

  // ── AI Summary ────────────────────────────────────────────────────────
  const handleAISummary = async () => {
    if (!messages.length) return;
    setAiSummary('');
    try {
      const formattedComments = messages.map(m => ({
        author: m.authorName || 'User',
        text: m.content || '',
      }));
      const res = await summariseComments(taskTitle, formattedComments);
      if (res) {
        const bulletText = res.bullets ? res.bullets.map(b => `• ${b}`).join('\n') : '';
        const fullText = `${res.summary || ''}\n\n${bulletText}`.trim();
        setAiSummary(fullText);
      }
    } catch (err) {
      setAiSummary('⚠️ AI summary unavailable right now.');
    }
  };

  return (
    <div className="task-chat-wrap">
      {/* ── Header ── */}
      <div className="task-chat-header">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="task-chat-title">💬 Task Chat</span>
          <span className="task-chat-count">{messages.length}</span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <PresenceAvatars users={presentUsers} />
          <button
            className="task-chat-icon-btn"
            onClick={handleAISummary}
            disabled={aiLoading || !messages.length}
            title="AI summary"
          >
            {aiLoading
              ? <LuLoaderCircle size={13} className="animate-spin" />
              : <LuSparkles size={13} />}
          </button>
          <button
            className="task-chat-icon-btn"
            onClick={refresh}
            title="Refresh messages"
          >
            <LuRefreshCcw size={13} />
          </button>
        </div>
      </div>

      {/* ── Send Error banner ── */}
      {sendErr && (
        <div className="task-chat-send-error">
          <span>⚠️ {sendErr}</span>
          <button onClick={() => setSendErr('')} title="Dismiss">✕</button>
        </div>
      )}

      {/* ── AI Summary banner ── */}
      {aiSummary && (
        <div className="task-chat-ai-summary">
          <div className="flex items-center gap-1.5 mb-1.5">
            <LuSparkles size={11} className="text-violet-500" />
            <span className="text-[10px] font-bold text-violet-500 uppercase tracking-widest">AI Summary</span>
            <button
              className="ml-auto text-[10px] text-slate-400 hover:text-slate-600"
              onClick={() => setAiSummary('')}
            >✕</button>
          </div>
          <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-line">{aiSummary}</p>
        </div>
      )}

      {/* ── Message feed ── */}
      <div className="task-chat-feed">
        {loading ? (
          <div className="flex justify-center items-center h-full">
            <LuLoaderCircle className="text-indigo-400 text-2xl animate-spin" />
          </div>
        ) : messages.length === 0 ? (
          <div className="task-chat-empty">
            <span className="text-3xl">💬</span>
            <p>No messages yet.</p>
            <span>Be the first to send a message!</span>
          </div>
        ) : (
          messages.map(msg => (
            <ChatMessage
              key={msg.id}
              message={msg}
              onDelete={deleteMessage}
              onReact={toggleReaction}
            />
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* ── @mention dropdown ── */}
      {showSuggestions && MEMBER_SUGGESTIONS.length > 0 && (
        <div className="task-chat-mention-dropdown">
          {MEMBER_SUGGESTIONS
            .filter(m => m.toLowerCase().startsWith(mentionQuery))
            .slice(0, 5)
            .map(name => (
              <button key={name} className="task-chat-mention-item" onClick={() => insertMention(name)}>
                @{name}
              </button>
            ))}
        </div>
      )}

      {/* ── Input bar ── */}
      <form onSubmit={handleSend} className="task-chat-input-wrap">
        <textarea
          ref={inputRef}
          id="task-chat-input"
          className="task-chat-input"
          placeholder="Type a message… (Enter to send)"
          value={input}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          rows={1}
          disabled={sending}
        />
        <button
          type="submit"
          className="task-chat-send-btn"
          disabled={!input.trim() || sending}
          title="Send message"
        >
          {sending
            ? <LuLoaderCircle size={14} className="animate-spin" />
            : <LuSend size={14} />}
        </button>
      </form>
    </div>
  );
};

export default TaskChatPanel;
