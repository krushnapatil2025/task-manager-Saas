import React, { useState, useEffect, useRef, useContext } from 'react';
import { LuSend, LuTrash2, LuLoaderCircle, LuMessageSquare, LuRefreshCcw } from 'react-icons/lu';
import moment from 'moment';
import { UserContext } from '../context/userContext';
import { getLogComments, addLogComment, deleteLogComment } from '../services/internLogCommentService';
import { supabase } from '../utils/supabaseClient';

const InternLogComments = ({ logId }) => {
  const { user } = useContext(UserContext);
  const [comments, setComments] = useState([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const bottomRef = useRef(null);

  // Load comments
  const loadComments = async () => {
    if (!logId) return;
    try {
      setLoading(true);
      const data = await getLogComments(logId);
      setComments(data);
    } catch (err) {
      console.error('Failed to load comments:', err);
    } finally {
      setLoading(false);
    }
  };

  // Subscribe to changes in real-time
  useEffect(() => {
    if (!logId) return;

    const uniqueChannelName = `log-comments-${logId}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    const channel = supabase
      .channel(uniqueChannelName)
      .on(
        'postgres_changes',
        {
          event: '*', // Listen to INSERT and DELETE
          schema: 'public',
          table: 'intern_log_messages',
          filter: `log_id=eq.${logId}`,
        },
        () => {
          loadComments();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [logId]);

  // Scroll to bottom when comments load or arrive
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [comments]);

  useEffect(() => {
    loadComments();
  }, [logId]);

  // Submit comment
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!text.trim() || !user?.id || !logId) return;

    setSubmitting(true);
    try {
      const newComment = await addLogComment(logId, user.id, text.trim());
      setComments((prev) => [...prev, newComment]);
      setText('');
    } catch (err) {
      console.error('Failed to add comment:', err);
    } finally {
      setSubmitting(false);
    }
  };

  // Delete comment
  const handleDelete = async (commentId) => {
    try {
      await deleteLogComment(commentId);
      setComments((prev) => prev.filter((c) => c.id !== commentId));
    } catch (err) {
      console.error('Failed to delete comment:', err);
    }
  };

  return (
    <div className="mt-6 border-t border-gray-100 pt-6 dark:border-zinc-800">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 mb-4">
        <div className="flex items-center gap-2">
          <LuMessageSquare className="text-slate-400 dark:text-zinc-500 text-base" />
          <h4 className="text-sm font-semibold text-slate-700 dark:text-zinc-200">
            Discussion & Activity <span className="text-slate-450 dark:text-zinc-400 font-normal">({comments.length})</span>
          </h4>
        </div>
        <button
          onClick={loadComments}
          disabled={loading}
          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-50 dark:hover:bg-zinc-850 dark:hover:text-zinc-300 disabled:opacity-50 transition cursor-pointer"
          title="Refresh comments"
        >
          <LuRefreshCcw size={13} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Discussion List */}
      <div className="space-y-4 max-h-80 overflow-y-auto pr-1 flex flex-col min-h-[100px] justify-start">
        {loading ? (
          <div className="flex justify-center py-6 my-auto">
            <LuLoaderCircle className="animate-spin text-indigo-500 text-xl" />
          </div>
        ) : comments.length === 0 ? (
          <div className="text-center text-xs text-slate-400 dark:text-zinc-500 py-8 border border-dashed border-slate-200 dark:border-zinc-800 rounded-xl my-auto">
            <p>No messages yet.</p>
            <p className="mt-1 text-[10px]">Start the discussion by sending a message below!</p>
          </div>
        ) : (
          comments.map((c) => {
            const isSystem = c.authorId === null;
            const isOwn = c.authorId === user?.id;

            if (isSystem) {
              return (
                <div key={c.id} className="flex justify-center my-1 select-none">
                  <div className="bg-slate-50 border border-slate-200/50 dark:bg-zinc-900/60 dark:border-zinc-800/80 rounded-full px-4 py-1 text-[10px] font-medium text-slate-500 dark:text-zinc-400 shadow-sm flex items-center gap-1.5 max-w-[90%] text-center">
                    <span>{c.content}</span>
                    <span className="text-[8px] text-slate-350 dark:text-zinc-650">• {moment(c.createdAt).fromNow()}</span>
                  </div>
                </div>
              );
            }

            return (
              <div key={c.id} className={`flex gap-3 group ${isOwn ? 'flex-row-reverse' : ''}`}>
                {/* Avatar */}
                {c.authorAvatar ? (
                  <img
                    src={c.authorAvatar}
                    className="w-8 h-8 rounded-xl object-cover flex-shrink-0 border border-slate-200/50 dark:border-zinc-800"
                    alt={c.authorName}
                  />
                ) : (
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-550 to-purple-600 flex items-center justify-center flex-shrink-0 shadow-sm text-white text-xs font-bold">
                    {c.authorName?.[0]?.toUpperCase() || 'U'}
                  </div>
                )}

                {/* Message bubble container */}
                <div className={`max-w-[75%] ${isOwn ? 'items-end' : 'items-start'} flex flex-col`}>
                  <div className="flex items-center gap-2 mb-0.5 px-1">
                    <span className={`text-[10px] font-bold text-slate-655 dark:text-zinc-300 ${isOwn ? 'order-last' : ''}`}>
                      {isOwn ? 'You' : c.authorName}
                    </span>
                    <span className="text-[9px] text-slate-400 dark:text-zinc-500">
                      {moment(c.createdAt).format('hh:mm A')}
                    </span>
                  </div>

                  <div
                    className={`rounded-2xl px-3.5 py-2 text-xs leading-relaxed shadow-sm ${
                      isOwn
                        ? 'bg-gradient-to-br from-indigo-600 to-indigo-700 text-white rounded-tr-sm'
                        : 'bg-white border border-slate-150/70 dark:bg-zinc-900 dark:border-zinc-800/80 text-slate-800 dark:text-zinc-200 rounded-tl-sm'
                    }`}
                  >
                    {c.content}
                  </div>

                  {/* Actions (like delete) */}
                  {isOwn && (
                    <button
                      onClick={() => handleDelete(c.id)}
                      className="text-[9px] text-red-500 hover:text-red-655 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-0.5 cursor-pointer px-1"
                    >
                      <LuTrash2 size={10} /> Delete
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Message input */}
      <form onSubmit={handleSubmit} className="flex items-end gap-2 mt-4">
        {user?.profileImageUrl ? (
          <img
            src={user.profileImageUrl}
            className="w-8 h-8 rounded-xl object-cover flex-shrink-0 border border-slate-200/50 dark:border-zinc-850"
            alt="You"
          />
        ) : (
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-650 flex items-center justify-center flex-shrink-0 shadow-sm text-white text-xs font-bold">
            {user?.name?.[0]?.toUpperCase()}
          </div>
        )}

        <div className="flex-1 flex items-center gap-2 bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl px-3 py-1.5 focus-within:ring-2 focus-within:ring-indigo-400 dark:focus-within:ring-indigo-500 focus-within:border-transparent transition-all">
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Write a reply or note..."
            className="flex-1 bg-transparent text-xs text-slate-800 dark:text-zinc-100 outline-none placeholder:text-slate-400"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
          />
          <button
            type="submit"
            disabled={!text.trim() || submitting}
            className="p-1 rounded-lg text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300 disabled:text-slate-300 dark:disabled:text-zinc-700 transition cursor-pointer"
          >
            {submitting ? (
              <LuLoaderCircle className="animate-spin text-sm" />
            ) : (
              <LuSend className="text-sm" />
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default InternLogComments;
