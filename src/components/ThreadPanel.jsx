import React, { useState, useEffect, useRef, useCallback } from 'react';
import { LuX, LuMessageSquare, LuFileText, LuLoaderCircle } from 'react-icons/lu';
import { supabase } from '../utils/supabaseClient';
import { getThreadReplies, sendChatMessage, normalizeMsg } from '../services/chatService';
import { parseMarkdownAndMentions } from '../utils/markdown';
import ChatInput from './ChatInput';
import ReactionBar from './ReactionBar';
import moment from 'moment';

const ThreadPanel = ({ roomId, parentMessage, onClose, user, members = [] }) => {
  const [replies, setReplies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const repliesEndRef = useRef(null);

  const fetchReplies = useCallback(async () => {
    if (!parentMessage?.id) return;
    setLoading(true);
    try {
      const data = await getThreadReplies(parentMessage.id);
      setReplies(data);
    } catch (err) {
      console.error('Failed to fetch replies:', err);
    } finally {
      setLoading(false);
    }
  }, [parentMessage?.id]);

  useEffect(() => {
    fetchReplies();

    if (!parentMessage?.id) return;

    // Listen for new replies
    const channel = supabase
      .channel(`chat-thread-${parentMessage.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_messages',
        filter: `thread_id=eq.${parentMessage.id}`,
      }, async (payload) => {
        const { data } = await supabase
          .from('chat_messages')
          .select(`id, content, type, mentions, file_url, edited_at, created_at, sender_id, reactions, thread_id, reply_count,
                   sender:profiles!sender_id(name, profile_image_url)`)
          .eq('id', payload.new.id)
          .single();
        if (data) {
          setReplies(prev => {
            if (prev.some(r => r.id === data.id)) return prev;
            return [...prev, normalizeMsg(data)];
          });
        }
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'chat_messages',
        filter: `thread_id=eq.${parentMessage.id}`,
      }, async (payload) => {
        const { data } = await supabase
          .from('chat_messages')
          .select(`id, content, type, mentions, file_url, edited_at, created_at, sender_id, reactions, thread_id, reply_count,
                   sender:profiles!sender_id(name, profile_image_url)`)
          .eq('id', payload.new.id)
          .single();
        if (data) {
          setReplies(prev => prev.map(r => r.id === data.id ? normalizeMsg(data) : r));
        }
      })
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [parentMessage?.id, fetchReplies]);

  // Scroll to bottom on new reply
  useEffect(() => {
    repliesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [replies]);

  const handleSendReply = async (content, type = 'text', fileUrl = null) => {
    if (!user?.id || !roomId || !parentMessage?.id) return;
    setSending(true);
    try {
      await sendChatMessage(roomId, user.id, content, type, fileUrl, parentMessage.id);
    } catch (err) {
      console.error('Failed to send reply:', err);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="w-[360px] md:w-[420px] flex-shrink-0 border-l border-slate-100 bg-white flex flex-col h-full overflow-hidden animate-slide-in-right z-30 shadow-2xl">
      {/* Header */}
      <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-55/30">
        <div className="flex items-center gap-2">
          <LuMessageSquare className="text-indigo-500" size={18} />
          <h3 className="font-bold text-slate-800 text-sm">Thread</h3>
        </div>
        <button 
          onClick={onClose}
          className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
        >
          <LuX size={16} />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4 custom-scrollbar">
        {/* Parent Message Card */}
        <div className="p-3 bg-indigo-50/40 border border-indigo-100/50 rounded-2xl">
          <div className="flex items-center gap-2.5 mb-2">
            {parentMessage.senderAvatar ? (
              <img src={parentMessage.senderAvatar} alt="" className="w-8 h-8 rounded-full object-cover border border-white shadow-sm" />
            ) : (
              <div className="w-8 h-8 rounded-full bg-indigo-600 text-white font-bold text-xs flex items-center justify-center">
                {parentMessage.senderName?.substring(0, 2).toUpperCase()}
              </div>
            )}
            <div>
              <div className="text-xs font-bold text-slate-700">{parentMessage.senderName}</div>
              <div className="text-[10px] text-slate-400">{moment(parentMessage.createdAt).fromNow()}</div>
            </div>
          </div>
          <div 
            className="text-xs text-slate-650 leading-relaxed break-words"
            dangerouslySetInnerHTML={{ __html: parseMarkdownAndMentions(parentMessage.content) }}
          />
          {parentMessage.fileUrl && (
            <div className="mt-2 text-xs text-indigo-600 font-semibold flex items-center gap-1.5 bg-white/60 p-2 rounded-lg border border-slate-100">
              <LuFileText size={14} />
              <a href={parentMessage.fileUrl.split('||')[1]} target="_blank" rel="noreferrer" className="hover:underline truncate">
                {parentMessage.fileUrl.split('||')[2] || 'Attachment'}
              </a>
            </div>
          )}
        </div>

        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-2">
          <span>Replies</span>
          <div className="h-[1px] bg-slate-100 flex-1" />
        </div>

        {/* Replies List */}
        {loading ? (
          <div className="flex-1 flex items-center justify-center py-10">
            <LuLoaderCircle className="animate-spin text-indigo-500" size={24} />
          </div>
        ) : replies.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 py-10 text-xs">
            <span>No replies yet</span>
            <span className="text-[10px] text-slate-300 mt-1">Be the first to reply below!</span>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {replies.map((reply) => {
              const isOwn = reply.senderId === user?.id;
              return (
                <div key={reply.id} className={`flex items-start gap-2.5 group relative ${isOwn ? 'flex-row-reverse' : ''}`}>
                  {reply.senderAvatar ? (
                    <img src={reply.senderAvatar} alt="" className="w-7 h-7 rounded-full object-cover shadow-sm flex-shrink-0" />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-slate-200 text-slate-700 font-bold text-[10px] flex items-center justify-center flex-shrink-0">
                      {reply.senderName?.substring(0, 2).toUpperCase()}
                    </div>
                  )}
                  <div className={`max-w-[75%] flex flex-col gap-0.5 ${isOwn ? 'items-end' : ''}`}>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-bold text-slate-600">{reply.senderName}</span>
                      <span className="text-[9px] text-slate-400">{moment(reply.createdAt).format('h:mm A')}</span>
                    </div>
                    <div className={`p-2.5 rounded-2xl text-xs break-words ${
                      isOwn 
                        ? 'bg-indigo-600 text-white rounded-tr-none shadow-md' 
                        : 'bg-slate-50 text-slate-700 rounded-tl-none border border-slate-100'
                    }`}>
                      <div dangerouslySetInnerHTML={{ __html: parseMarkdownAndMentions(reply.content) }} />
                      {reply.fileUrl && (
                        <div className={`mt-1.5 p-1.5 rounded-lg text-[10px] flex items-center gap-1 ${
                          isOwn ? 'bg-indigo-700 text-indigo-100' : 'bg-white text-slate-600 border border-slate-100'
                        }`}>
                          <LuFileText size={12} />
                          <a href={reply.fileUrl.split('||')[1]} target="_blank" rel="noreferrer" className="hover:underline truncate">
                            {reply.fileUrl.split('||')[2] || 'Attachment'}
                          </a>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={repliesEndRef} />
          </div>
        )}
      </div>

      {/* Reply Input */}
      <div className="p-3 border-t border-slate-100 bg-white">
        <ChatInput
          onSend={handleSendReply}
          sending={sending}
          placeholder="Reply to thread..."
          members={members}
        />
      </div>
    </div>
  );
};

export default ThreadPanel;
