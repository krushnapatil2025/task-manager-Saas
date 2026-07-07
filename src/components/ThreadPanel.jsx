import React, { useState, useEffect, useRef, useCallback } from 'react';
import { LuX, LuMessageSquare, LuFileText, LuLoaderCircle } from 'react-icons/lu';
import { supabase } from '../utils/supabaseClient';
import { getThreadReplies, sendChatMessage, normalizeMsg } from '../services/chatService';
import { parseMarkdownAndMentions } from '../utils/markdown';
import ChatInput from './ChatInput';
import ReactionBar from './ReactionBar';
import VoiceMessageBubble from './VoiceMessageBubble';
import UserAvatarWithCard from './UserAvatarWithCard';
import moment from 'moment';

const ThreadPanel = ({ roomId, parentMessage, onClose, user, members = [], onlineUsers = {} }) => {
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
    console.log(`[ThreadPanel] Initiating subscription setup for parentMessage.id: ${parentMessage.id}`);
    const channel = supabase
      .channel(`chat-thread-${parentMessage.id}-${Date.now()}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_messages',
      }, async (payload) => {
        console.log('[ThreadPanel] Realtime INSERT event received:', payload);
        if (!payload.new) return;

        const eventThreadId = String(payload.new.thread_id).toLowerCase();
        const activeThreadId = String(parentMessage.id).toLowerCase();

        if (eventThreadId !== activeThreadId) {
          console.log(`[ThreadPanel] Thread ID mismatch on INSERT. Event thread: ${eventThreadId}, Active thread: ${activeThreadId}`);
          return;
        }

        console.log('[ThreadPanel] Thread matched. Fetching reply details for ID:', payload.new.id);
        
        let data = null;
        try {
          const res = await supabase
            .from('chat_messages')
            .select(`id, content, type, mentions, file_url, edited_at, created_at, sender_id, reactions, thread_id, reply_count, reply_to_id,
                     sender:profiles!sender_id(name, profile_image_url),
                     reply_to:reply_to_id(
                       id, content, type, file_url,
                       sender:profiles!sender_id(name)
                     )`)
            .eq('id', payload.new.id)
            .single();
          if (res.error) {
            console.warn('[ThreadPanel] Error fetching thread reply for realtime INSERT:', res.error);
          } else {
            data = res.data;
          }
        } catch (err) {
          console.warn('[ThreadPanel] Exception fetching thread reply for realtime INSERT:', err);
        }

        const msg = data ? normalizeMsg(data) : normalizeMsg({
          ...payload.new,
          sender: {
            name: payload.new.sender_id === user?.id ? (user?.name || 'You') : 'Someone',
            profile_image_url: payload.new.sender_id === user?.id ? (user?.profileImageUrl || null) : null
          },
          reply_to: null,
          reads: [],
          chat_message_reactions: []
        });

        console.log('[ThreadPanel] Appending reply to state:', msg);
        setReplies(prev => {
          if (prev.some(r => r.id === msg.id)) return prev;
          return [...prev, msg];
        });
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'chat_messages',
      }, async (payload) => {
        console.log('[ThreadPanel] Realtime UPDATE event received:', payload);
        if (!payload.new) return;

        const eventThreadId = payload.new.thread_id ? String(payload.new.thread_id).toLowerCase() : null;
        const activeThreadId = String(parentMessage.id).toLowerCase();

        if (eventThreadId && eventThreadId !== activeThreadId) {
          console.log(`[ThreadPanel] Thread ID mismatch on UPDATE. Event thread: ${eventThreadId}, Active thread: ${activeThreadId}`);
          return;
        }

        let data = null;
        try {
          const res = await supabase
            .from('chat_messages')
            .select(`id, content, type, mentions, file_url, edited_at, created_at, sender_id, reactions, thread_id, reply_count, reply_to_id,
                     sender:profiles!sender_id(name, profile_image_url),
                     reply_to:reply_to_id(
                       id, content, type, file_url,
                       sender:profiles!sender_id(name)
                     )`)
            .eq('id', payload.new.id)
            .single();
          if (res.error) {
            console.warn('[ThreadPanel] Error fetching thread reply for realtime UPDATE:', res.error);
          } else {
            data = res.data;
          }
        } catch (err) {
          console.warn('[ThreadPanel] Exception fetching thread reply for realtime UPDATE:', err);
        }

        if (data && String(data.thread_id).toLowerCase() !== activeThreadId) {
          console.log(`[ThreadPanel] Thread ID mismatch after fetch. Fetched thread: ${data.thread_id}, Active thread: ${activeThreadId}`);
          return;
        }
        if (!data && eventThreadId === null) {
          let replyExists = false;
          setReplies(prev => {
            replyExists = prev.some(r => r.id === payload.new.id);
            return prev;
          });
          if (!replyExists) return;
        }

        const msg = data ? normalizeMsg(data) : normalizeMsg({
          ...payload.new,
          sender: {
            name: payload.new.sender_id === user?.id ? (user?.name || 'You') : 'Someone',
            profile_image_url: payload.new.sender_id === user?.id ? (user?.profileImageUrl || null) : null
          },
          reply_to: null,
          reads: [],
          chat_message_reactions: []
        });

        console.log('[ThreadPanel] Updating reply in state:', msg);
        setReplies(prev => prev.map(r => r.id === msg.id ? msg : r));
      })
      .subscribe((status, err) => {
        console.log(`[ThreadPanel] Subscription Status for thread ${parentMessage.id}:`, status, err || '');
      });

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
            <UserAvatarWithCard 
              userId={parentMessage.senderId}
              userName={parentMessage.senderName}
              userAvatar={parentMessage.senderAvatar}
              onlineUsers={onlineUsers}
              avatarClass="w-8 h-8 rounded-full object-cover border border-white shadow-sm"
              fallbackClass="w-8 h-8 rounded-full bg-indigo-600 text-white font-bold text-xs flex items-center justify-center"
            />
            <div>
              <div className="text-xs font-bold text-slate-700">{parentMessage.senderName}</div>
              <div className="text-[10px] text-slate-400">{moment(parentMessage.createdAt).fromNow()}</div>
            </div>
          </div>
          {parentMessage.type === 'audio' ? (
            <VoiceMessageBubble fileUrl={parentMessage.fileUrl} isOwn={parentMessage.senderId === user?.id} />
          ) : (
            <>
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
            </>
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
                  <UserAvatarWithCard 
                    userId={reply.senderId}
                    userName={reply.senderName}
                    userAvatar={reply.senderAvatar}
                    onlineUsers={onlineUsers}
                    avatarClass="w-7 h-7 rounded-full object-cover shadow-sm flex-shrink-0"
                    fallbackClass="w-7 h-7 rounded-full bg-slate-200 text-slate-750 font-bold text-[10px] flex items-center justify-center flex-shrink-0"
                  />
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
                      {reply.replyTo && (
                        <div 
                          className="text-[9px] p-1.5 rounded bg-black/5 mb-1.5 cursor-pointer max-w-xs hover:bg-black/10 transition-colors border-l-2 border-indigo-500"
                        >
                          <span className="font-bold block text-[8px] uppercase tracking-wider mb-0.5 text-indigo-700">
                            {reply.replyTo.senderName}
                          </span>
                          <span className="truncate block text-slate-500">
                            {reply.replyTo.content}
                          </span>
                        </div>
                      )}
                      
                      {reply.type === 'audio' ? (
                        <VoiceMessageBubble fileUrl={reply.fileUrl} isOwn={isOwn} />
                      ) : (
                        <>
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
                        </>
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
