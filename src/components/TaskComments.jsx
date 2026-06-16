import React, { useState, useEffect, useRef, useContext } from 'react';
import { LuSend, LuTrash2, LuLoaderCircle, LuMessageSquare, LuSparkles, LuX, LuRefreshCcw } from 'react-icons/lu';
import moment from 'moment';
import { UserContext } from '../context/userContext';
import { WorkspaceContext } from '../context/WorkspaceContext';
import { getComments, addComment, deleteComment } from '../services/commentService';
import { useRealtimeNotifications } from '../hooks/useRealtimeTasks';
import { supabase } from '../utils/supabaseClient';
import useAI from '../hooks/useAI';

// ─────────────────────────────────────────────────────────────────────────────
// TaskComments — threaded comment section for a task detail view
// ─────────────────────────────────────────────────────────────────────────────

const TaskComments = ({ taskId, taskTitle = 'Task' }) => {
  const { user }      = useContext(UserContext);
  const { workspace } = useContext(WorkspaceContext);

  const [comments, setComments]   = useState([]);
  const [text, setText]           = useState('');
  const [loading, setLoading]     = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [aiSummary, setAiSummary]   = useState(null);
  const bottomRef = useRef(null);
  const { summariseComments, loading: aiLoading } = useAI();

  // ── Load comments ──────────────────────────────────────────────────────────
  const loadComments = async () => {
    if (!taskId) return;
    try {
      setLoading(true);
      const data = await getComments(taskId);
      setComments(data);
    } catch (err) {
      console.error('Failed to load comments:', err);
    } finally {
      setLoading(false);
    }
  };

  // ── Real-time: subscribe to comment inserts on this task ──────────────────
  useEffect(() => {
    if (!taskId || !workspace?.id) return;

    const channel = supabase
      .channel(`comments-${taskId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'task_comments',
          filter: `task_id=eq.${taskId}`,
        },
        () => loadComments()
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'task_comments',
          filter: `task_id=eq.${taskId}`,
        },
        (payload) => {
          setComments((prev) => prev.filter((c) => c.id !== payload.old.id));
        }
      )
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [taskId, workspace?.id]);

  // Auto-scroll to bottom when new comment arrives
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [comments]);

  useEffect(() => { loadComments(); }, [taskId]);

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!text.trim() || !user?.id || !workspace?.id) return;

    setSubmitting(true);
    try {
      const newComment = await addComment(taskId, workspace.id, user.id, text.trim());
      setComments((prev) => [...prev, newComment]);
      setText('');
    } catch (err) {
      console.error('Failed to add comment:', err);
    } finally {
      setSubmitting(false);
    }
  };

  // ── AI Summary ──────────────────────────────────────────────────────
  const handleAISummary = async () => {
    if (!comments.length) return;
    const formatted = comments.map((c) => ({ author: c.authorName || 'User', text: c.content }));
    try {
      const result = await summariseComments(taskTitle, formatted);
      setAiSummary(result);
    } catch {
      // error shown by hook
    }
  };

  // ── Delete ──────────────────────────────────────────────────────────────
  const handleDelete = async (commentId) => {
    try {
      await deleteComment(commentId);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
    } catch (err) {
      console.error('Failed to delete comment:', err);
    }
  };

  return (
    <div className="mt-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <LuMessageSquare className="text-gray-400 text-base" />
          <h4 className="text-sm font-semibold text-gray-700">
            Comments <span className="text-gray-400 font-normal">({comments.length})</span>
          </h4>
        </div>
        <div className="flex items-center gap-2">
          {/* Refresh */}
          <button
            onClick={loadComments}
            disabled={loading}
            className="refresh-btn"
            title="Refresh comments"
          >
            <LuRefreshCcw size={12} className={loading ? 'ai-spin' : ''} />
          </button>
          {/* AI Summary */}
          {comments.length > 0 && (
            <button
              className="ai-summarise-btn"
              onClick={handleAISummary}
              disabled={aiLoading}
              title="Summarise all comments with AI"
            >
              {aiLoading
                ? <LuLoaderCircle size={11} className="ai-spin" />
                : <LuSparkles size={11} />}
              {aiLoading ? 'Analysing…' : '✨ AI Summary'}
            </button>
          )}
        </div>
      </div>

      {/* AI Summary Panel */}
      {aiSummary && (
        <div className="ai-summary-panel">
          <div className="ai-summary-header">
            <span className="ai-summary-title">
              <LuSparkles size={12} /> AI Summary
            </span>
            <button className="ai-summary-close" onClick={() => setAiSummary(null)}>
              <LuX size={13} />
            </button>
          </div>
          <ul className="ai-summary-bullets">
            {(aiSummary.bullets || []).map((b, i) => <li key={i}>{b}</li>)}
          </ul>
          {aiSummary.summary && (
            <p className="ai-summary-footer">🤖 {aiSummary.summary}</p>
          )}
        </div>
      )}

      {/* Comment list */}
      <div className="space-y-4 max-h-72 overflow-y-auto pr-1">
        {loading ? (
          <div className="flex justify-center py-6">
            <LuLoaderCircle className="animate-spin text-blue-500 text-xl" />
          </div>
        ) : comments.length === 0 ? (
          <p className="text-center text-xs text-gray-400 py-6">
            No comments yet. Be the first to comment!
          </p>
        ) : (
          comments.map((c) => (
            <CommentBubble
              key={c.id}
              comment={c}
              isOwn={c.authorId === user?.id}
              onDelete={() => handleDelete(c.id)}
            />
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form onSubmit={handleSubmit} className="flex items-end gap-2 mt-4">
        {user?.profileImageUrl ? (
          <img
            src={user.profileImageUrl}
            className="w-8 h-8 rounded-full object-cover flex-shrink-0 border border-gray-200"
            alt="You"
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center flex-shrink-0">
            <span className="text-white text-xs font-bold">{user?.name?.[0]?.toUpperCase()}</span>
          </div>
        )}

        <div className="flex-1 flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 focus-within:ring-2 focus-within:ring-blue-400 focus-within:border-transparent transition">
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Add a comment..."
            className="flex-1 bg-transparent text-sm text-gray-800 outline-none placeholder:text-gray-400"
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSubmit(e)}
          />
          <button
            type="submit"
            disabled={!text.trim() || submitting}
            className="text-blue-600 hover:text-blue-800 disabled:text-gray-300 transition"
          >
            {submitting
              ? <LuLoaderCircle className="animate-spin text-base" />
              : <LuSend className="text-base" />
            }
          </button>
        </div>
      </form>
    </div>
  );
};

export default TaskComments;

// ─────────────────────────────── Comment Bubble ──────────────────────────────

const CommentBubble = ({ comment, isOwn, onDelete }) => (
  <div className={`flex gap-3 group ${isOwn ? 'flex-row-reverse' : ''}`}>
    {/* Avatar */}
    {comment.authorAvatar ? (
      <img
        src={comment.authorAvatar}
        className="w-8 h-8 rounded-full object-cover flex-shrink-0 border border-gray-200"
        alt={comment.authorName}
      />
    ) : (
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center flex-shrink-0">
        <span className="text-white text-xs font-bold">
          {comment.authorName?.[0]?.toUpperCase()}
        </span>
      </div>
    )}

    {/* Bubble */}
    <div className={`max-w-[75%] ${isOwn ? 'items-end' : 'items-start'} flex flex-col`}>
      <div className="flex items-center gap-2 mb-0.5">
        <span className={`text-[11px] font-semibold text-gray-600 ${isOwn ? 'order-last' : ''}`}>
          {isOwn ? 'You' : comment.authorName}
        </span>
        <span className="text-[10px] text-gray-400">
          {moment(comment.createdAt).fromNow()}
        </span>
      </div>

      <div
        className={`rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
          isOwn
            ? 'bg-gradient-to-br from-blue-500 to-purple-600 text-white rounded-tr-sm'
            : 'bg-white border border-gray-200 text-gray-800 rounded-tl-sm shadow-sm'
        }`}
      >
        {comment.content}
      </div>

      {/* Delete button (only for own) */}
      {isOwn && (
        <button
          onClick={onDelete}
          className="text-[10px] text-red-400 hover:text-red-600 mt-1 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <LuTrash2 className="inline mr-1" />Delete
        </button>
      )}
    </div>
  </div>
);
