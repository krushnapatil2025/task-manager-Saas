import { useState, useEffect, useCallback, useContext, useRef } from 'react';
import { supabase } from '../utils/supabaseClient';
import { UserContext } from '../context/userContext';
import {
  getRoomMessages, sendChatMessage, deleteChatMessage, editChatMessage,
  toggleChatReaction, markRoomRead, normalizeMsg, markMessageAsRead,
  getReplyContentPreview
} from '../services/chatService';

// ─────────────────────────────────────────────────────────────────────────────
// useChat — Real-time message hook for a chat room (Phase 16)
//
// Returns:
//   messages, loading, sending
//   send(content)
//   remove(messageId)
//   react(messageId, emoji)
//   refresh()
// ─────────────────────────────────────────────────────────────────────────────

export const useChat = (roomId) => {
  const { user } = useContext(UserContext);

  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState(null);
  const [typingUsers, setTypingUsers] = useState({});

  const channelRef = useRef(null);

  const fetchMessages = useCallback(async () => {
    if (!roomId) return;
    setLoading(true);
    try {
      const data = await getRoomMessages(roomId);
      setMessages(data);
      // Mark as read
      if (user?.id) markRoomRead(roomId, user.id);
    } catch (err) {
      console.error('useChat fetch:', err);
    } finally {
      setLoading(false);
    }
  }, [roomId, user?.id]);

  useEffect(() => {
    fetchMessages();
    if (!roomId) return;

    const channel = supabase
      .channel(`chat-room-${roomId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_messages',
        filter: `room_id=eq.${roomId}`,
      }, async (payload) => {
        const { data } = await supabase
          .from('chat_messages')
          .select(`id, content, type, mentions, file_url, edited_at, created_at, sender_id, reactions, thread_id, reply_count, reply_to_id,
                   sender:profiles!sender_id(name, profile_image_url),
                   reply_to:reply_to_id(
                     id, content, type, file_url,
                     sender:profiles!sender_id(name)
                   ),
                   chat_message_reactions(user_id, emoji)`)
          .eq('id', payload.new.id)
          .single();
        if (data) {
          if (data.thread_id) {
            setMessages(prev => prev.map(m => m.id === data.thread_id ? { ...m, replyCount: (m.replyCount || 0) + 1 } : m));
          } else {
            setMessages(prev => {
              // Filter out any optimistic message that matches the same content and sender
              const filtered = prev.filter(m => !(m.isOptimistic && m.content === data.content && m.senderId === data.sender_id));
              if (filtered.some(m => m.id === data.id)) return filtered;
              return [...filtered, normalizeMsg(data)];
            });
            if (user?.id) markRoomRead(roomId, user.id);
          }
        }
      })
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'chat_messages',
        filter: `room_id=eq.${roomId}`,
      }, async (payload) => {
        const { data } = await supabase
          .from('chat_messages')
          .select(`id, content, type, mentions, file_url, edited_at, created_at, sender_id, reactions, thread_id, reply_count, reply_to_id,
                   sender:profiles!sender_id(name, profile_image_url),
                   reply_to:reply_to_id(
                     id, content, type, file_url,
                     sender:profiles!sender_id(name)
                   ),
                   chat_message_reactions(user_id, emoji)`)
          .eq('id', payload.new.id)
          .single();
        if (data) {
          setMessages(prev => prev.map(m => m.id === data.id ? normalizeMsg(data) : m));
        }
      })
      .on('postgres_changes', {
        event: 'DELETE',
        schema: 'public',
        table: 'chat_messages',
        filter: `room_id=eq.${roomId}`,
      }, (payload) => {
        setMessages(prev => prev.filter(m => m.id !== payload.old.id));
      })
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_message_reads'
      }, (payload) => {
        const { message_id, user_id } = payload.new;
        setMessages(prev => prev.map(m => {
          if (m.id === message_id) {
            const alreadyRead = m.reads?.some(r => r.user_id === user_id);
            if (alreadyRead) return m;
            return { ...m, reads: [...(m.reads || []), { user_id }] };
          }
          return m;
        }));
      })
      .on('broadcast', { event: 'typing' }, (payload) => {
        const { userId, userName, isTyping } = payload.payload;
        if (userId === user?.id) return;
        setTypingUsers(prev => {
          const next = { ...prev };
          if (isTyping) {
            next[userId] = { name: userName, timestamp: Date.now() };
          } else {
            delete next[userId];
          }
          return next;
        });
      })
      .subscribe();

    channelRef.current = channel;

    const interval = setInterval(() => {
      setTypingUsers(prev => {
        const now = Date.now();
        let changed = false;
        const next = { ...prev };
        Object.entries(next).forEach(([uid, info]) => {
          if (now - info.timestamp > 4000) {
            delete next[uid];
            changed = true;
          }
        });
        return changed ? next : prev;
      });
    }, 2000);

    return () => {
      clearInterval(interval);
      channelRef.current = null;
      supabase.removeChannel(channel);
    };
  }, [roomId, fetchMessages, user?.id]);

  const sendTyping = useCallback((isTyping) => {
    if (channelRef.current && user) {
      channelRef.current.send({
        type: 'broadcast',
        event: 'typing',
        payload: {
          userId: user.id,
          userName: user.name || 'Someone',
          isTyping
        }
      });
    }
  }, [user]);

  const send = useCallback(async (content, type = 'text', fileUrl = null, replyToId = null) => {
    if (!content?.trim() && !fileUrl) return;
    if (!user?.id) {
      setSendError('You must be logged in to send messages.');
      return;
    }
    if (!roomId) {
      setSendError('No chat room selected.');
      return;
    }
    setSending(true);
    setSendError(null);

    const optimisticId = `optimistic-${Date.now()}`;

    // Optimistically update messages list using functional update to avoid stale messages closure
    setMessages(prev => {
      const repliedMsg = replyToId ? prev.find(m => m.id === replyToId) : null;
      const optimisticMsg = {
        id: optimisticId,
        content: content || '',
        type,
        fileUrl,
        senderId: user.id,
        senderName: user.name || 'You',
        sender: {
          name: user.name || 'You',
          profile_image_url: user.profileImageUrl || null,
        },
        reactions: [],
        createdAt: new Date().toISOString(),
        isOptimistic: true,
        replyToId,
        replyTo: repliedMsg ? {
          id: repliedMsg.id,
          content: getReplyContentPreview(repliedMsg.content, repliedMsg.type, repliedMsg.fileUrl),
          type: repliedMsg.type,
          fileUrl: repliedMsg.fileUrl,
          senderName: repliedMsg.senderName || 'You'
        } : null,
      };
      return [...prev, optimisticMsg];
    });

    try {
      await sendChatMessage(roomId, user.id, content, type, fileUrl, null, replyToId);
    } catch (err) {
      // Remove optimistic message on failure
      setMessages(prev => prev.filter(m => m.id !== optimisticId));
      const msg = err?.message || 'Failed to send message. Please try again.';
      setSendError(msg);
      console.error('useChat send error:', err);
      throw err; // re-throw so ChatWindow can also react
    } finally {
      setSending(false);
    }
  }, [roomId, user]);

  const remove = useCallback(async (messageId) => {
    await deleteChatMessage(messageId);
  }, []);

  const edit = useCallback(async (messageId, newContent) => {
    await editChatMessage(messageId, newContent);
  }, []);

  const react = useCallback(async (messageId, emoji) => {
    if (!user?.id) return;

    // ── Optimistic update: toggle reaction locally right away ──────────────
    setMessages(prev => prev.map(m => {
      if (m.id !== messageId) return m;

      // Check if user has already reacted with this emoji
      const hasReacted = (m.reactionsList || []).some(r => r.user_id === user.id && r.emoji === emoji);

      // 1. Update list of user reactions
      let newReactionsList = [...(m.reactionsList || [])];
      if (hasReacted) {
        newReactionsList = newReactionsList.filter(r => !(r.user_id === user.id && r.emoji === emoji));
      } else {
        newReactionsList.push({ user_id: user.id, emoji });
      }

      // 2. Update aggregated counts
      const reactions = { ...(m.reactions || {}) };
      if (hasReacted) {
        reactions[emoji] = Math.max(0, (reactions[emoji] || 1) - 1);
        if (reactions[emoji] === 0) {
          delete reactions[emoji];
        }
      } else {
        reactions[emoji] = (reactions[emoji] || 0) + 1;
      }

      return { ...m, reactions, reactionsList: newReactionsList };
    }));

    // ── Background sync ─────────────────────────────────────────────────────
    try {
      await toggleChatReaction(messageId, user.id, emoji);
    } catch (err) {
      console.error('Failed to toggle reaction:', err);
      // Roll back the optimistic change on error
      await fetchMessages();
    }
  }, [user?.id, fetchMessages]);

  const markRead = useCallback(async (messageId) => {
    if (!user?.id) return;
    await markMessageAsRead(messageId, user.id);
  }, [user?.id]);

  return {
    messages,
    loading,
    sending,
    sendError,
    typingUsers,
    send,
    remove,
    edit,
    react,
    markRead,
    sendTyping,
    refresh: fetchMessages
  };
};

export default useChat;
