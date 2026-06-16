import { useState, useEffect, useCallback, useContext, useRef } from 'react';
import { supabase } from '../utils/supabaseClient';
import { UserContext } from '../context/userContext';
import {
  getRoomMessages, sendChatMessage, deleteChatMessage, editChatMessage,
  toggleChatReaction, markRoomRead, normalizeMsg,
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

  const [messages,   setMessages  ] = useState([]);
  const [loading,    setLoading   ] = useState(true);
  const [sending,    setSending   ] = useState(false);
  const [sendError,  setSendError ] = useState(null);
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
        event:  'INSERT',
        schema: 'public',
        table:  'chat_messages',
        filter: `room_id=eq.${roomId}`,
      }, async (payload) => {
        const { data } = await supabase
          .from('chat_messages')
          .select(`id, content, type, mentions, file_url, edited_at, created_at, sender_id, reactions, thread_id, reply_count,
                   sender:profiles!sender_id(name, profile_image_url)`)
          .eq('id', payload.new.id)
          .single();
        if (data) {
          if (data.thread_id) {
            setMessages(prev => prev.map(m => m.id === data.thread_id ? { ...m, replyCount: (m.replyCount || 0) + 1 } : m));
          } else {
            setMessages(prev => {
              if (prev.some(m => m.id === data.id)) return prev;
              return [...prev, normalizeMsg(data)];
            });
            if (user?.id) markRoomRead(roomId, user.id);
          }
        }
      })
      .on('postgres_changes', {
        event:  'UPDATE',
        schema: 'public',
        table:  'chat_messages',
        filter: `room_id=eq.${roomId}`,
      }, async (payload) => {
        const { data } = await supabase
          .from('chat_messages')
          .select(`id, content, type, mentions, file_url, edited_at, created_at, sender_id, reactions, thread_id, reply_count,
                   sender:profiles!sender_id(name, profile_image_url)`)
          .eq('id', payload.new.id)
          .single();
        if (data) {
          setMessages(prev => prev.map(m => m.id === data.id ? normalizeMsg(data) : m));
        }
      })
      .on('postgres_changes', {
        event:  'DELETE',
        schema: 'public',
        table:  'chat_messages',
        filter: `room_id=eq.${roomId}`,
      }, (payload) => {
        setMessages(prev => prev.filter(m => m.id !== payload.old.id));
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

  const send = useCallback(async (content, type = 'text', fileUrl = null) => {
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
    try {
      await sendChatMessage(roomId, user.id, content, type, fileUrl);
    } catch (err) {
      const msg = err?.message || 'Failed to send message. Please try again.';
      setSendError(msg);
      console.error('useChat send error:', err);
      throw err; // re-throw so ChatWindow can also react
    } finally {
      setSending(false);
    }
  }, [roomId, user?.id]);

  const remove = useCallback(async (messageId) => {
    await deleteChatMessage(messageId);
  }, []);

  const edit = useCallback(async (messageId, newContent) => {
    await editChatMessage(messageId, newContent);
  }, []);

  const react = useCallback(async (messageId, emoji) => {
    if (!user?.id) return;
    await toggleChatReaction(messageId, user.id, emoji);
    await fetchMessages(); // refresh reaction counts
  }, [user?.id, fetchMessages]);

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
    sendTyping,
    refresh: fetchMessages
  };
};

export default useChat;
