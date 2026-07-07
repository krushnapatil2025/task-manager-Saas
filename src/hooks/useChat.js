import { useState, useEffect, useCallback, useContext, useRef } from 'react';
import { supabase } from '../utils/supabaseClient';
import { UserContext } from '../context/userContext';
import {
  getRoomMessages, getOlderMessages, sendChatMessage, deleteChatMessage,
  softDeleteMessage, hideMessageForMe, getHiddenMessageIds,
  editChatMessage, toggleChatReaction, markRoomRead, normalizeMsg,
  markMessageAsRead, getReplyContentPreview
} from '../services/chatService';

// ─────────────────────────────────────────────────────────────────────────────
// useChat — Real-time message hook for a chat room (Phase 16)
//
// Returns:
//   messages, loading, sending, loadingMore, hasMore
//   send(content)
//   remove(messageId), edit(messageId, content)
//   react(messageId, emoji)
//   loadMore()   ← loads older messages (pagination)
//   refresh()
// ─────────────────────────────────────────────────────────────────────────────

const PAGE_SIZE = 100; // messages per page

export const useChat = (roomId) => {
  const { user } = useContext(UserContext);

  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState(null);
  const [typingUsers, setTypingUsers] = useState({});
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  // Start with empty Set — loaded from localStorage once user.id is known
  const [hiddenIds, setHiddenIds] = useState(new Set());

  // Load persisted "Delete for Me" IDs as soon as user.id is available
  useEffect(() => {
    if (user?.id) {
      setHiddenIds(getHiddenMessageIds(user.id));
    }
  }, [user?.id]);

  const channelRef = useRef(null);
  // Keep a stable ref to roomId to avoid stale closures inside subscription callbacks
  const roomIdRef = useRef(roomId);
  useEffect(() => { roomIdRef.current = roomId; }, [roomId]);

  const userRef = useRef(user);
  useEffect(() => { userRef.current = user; }, [user]);

  const fetchMessages = useCallback(async () => {
    if (!roomId) return;
    setLoading(true);
    try {
      const data = await getRoomMessages(roomId, PAGE_SIZE);
      setMessages(data);
      // If we got a full page, assume there are older messages
      setHasMore(data.length === PAGE_SIZE);
      // Mark as read
      if (user?.id) markRoomRead(roomId, user.id);
    } catch (err) {
      console.error('useChat fetch:', err);
    } finally {
      setLoading(false);
    }
  }, [roomId, user?.id]);

  /**
   * Load an older page of messages (prepend to top).
   * Uses the createdAt of the current oldest message as the cursor.
   */
  const loadMore = useCallback(async () => {
    if (!roomId || loadingMore || !hasMore) return;
    const oldestMsg = messages[0];
    if (!oldestMsg) return;

    setLoadingMore(true);
    try {
      const older = await getOlderMessages(roomId, oldestMsg.createdAt, PAGE_SIZE);
      if (older.length === 0) {
        setHasMore(false);
        return;
      }
      // Prepend older messages; deduplicate by id
      setMessages(prev => {
        const existingIds = new Set(prev.map(m => m.id));
        const fresh = older.filter(m => !existingIds.has(m.id));
        return [...fresh, ...prev];
      });
      // If we got fewer than a full page, no more history
      setHasMore(older.length === PAGE_SIZE);
    } catch (err) {
      console.error('useChat loadMore:', err);
    } finally {
      setLoadingMore(false);
    }
  }, [roomId, loadingMore, hasMore, messages]);

  // ── Helper: fetch full message details and upsert into state ──────────────
  const upsertMessageById = useCallback(async (messageId, isUpdate = false) => {
    if (!messageId) return;
    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .select(`id, room_id, content, type, is_deleted, mentions, file_url, edited_at, created_at, sender_id, reactions, thread_id, reply_count, reply_to_id,
                 sender:profiles!sender_id(name, profile_image_url),
                 reply_to:reply_to_id(id, content, type, file_url, sender:profiles!sender_id(name)),
                 reads:chat_message_reads(user_id),
                 chat_message_reactions(user_id, emoji)`)
        .eq('id', messageId)
        .single();

      if (error || !data) {
        console.warn('[useChat] Failed to fetch message:', error?.message);
        return;
      }

      // Ensure message belongs to the currently active room
      if (String(data.room_id).toLowerCase() !== String(roomIdRef.current).toLowerCase()) return;

      const msg = normalizeMsg(data);

      if (msg.threadId) {
        setMessages(prev => prev.map(m =>
          m.id === msg.threadId ? { ...m, replyCount: (m.replyCount || 0) + 1 } : m
        ));
        return;
      }

      if (isUpdate) {
        setMessages(prev => prev.map(m => m.id === msg.id ? msg : m));
      } else {
        setMessages(prev => {
          const filtered = prev.filter(m =>
            !(m.isOptimistic && m.content?.trim() === msg.content?.trim() && m.senderId === msg.senderId)
          );
          if (filtered.some(m => m.id === msg.id)) return filtered;
          return [...filtered, msg];
        });
        if (userRef.current?.id) markRoomRead(roomIdRef.current, userRef.current.id);
      }
    } catch (err) {
      console.warn('[useChat] Exception in upsertMessageById:', err);
    }
  }, []); // stable — uses refs only

  useEffect(() => {
    setMessages([]);
    setLoading(true);
    fetchMessages();
    if (!roomId) return;

    let retryCount = 0;
    let retryTimeout = null;
    let activeChannel = null;

    const setupChannel = () => {
      if (activeChannel) {
        supabase.removeChannel(activeChannel);
        activeChannel = null;
      }

      console.log(`[useChat] Setting up realtime for room: ${roomId}`);

      const ch = supabase
        .channel(`chat-room-${roomId}-${Date.now()}`)
        // ── Filter INSERT/UPDATE at DB level so Supabase only sends relevant events ──
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `room_id=eq.${roomId}`,
        }, (payload) => {
          if (payload.new?.id) upsertMessageById(payload.new.id, false);
        })
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'chat_messages',
          filter: `room_id=eq.${roomId}`,
        }, (payload) => {
          if (payload.new?.id) upsertMessageById(payload.new.id, true);
        })
        .on('postgres_changes', {
          event: 'DELETE',
          schema: 'public',
          table: 'chat_messages',
        }, (payload) => {
          if (payload.old?.id) setMessages(prev => prev.filter(m => m.id !== payload.old.id));
        })
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_message_reads',
        }, (payload) => {
          const { message_id, user_id } = payload.new || {};
          if (!message_id) return;
          setMessages(prev => prev.map(m => {
            if (m.id !== message_id) return m;
            if (m.reads?.some(r => r.user_id === user_id)) return m;
            return { ...m, reads: [...(m.reads || []), { user_id }] };
          }));
        })
        .on('broadcast', { event: 'typing' }, (payload) => {
          const { userId, userName, isTyping } = payload.payload || {};
          if (!userId || userId === userRef.current?.id) return;
          setTypingUsers(prev => {
            const next = { ...prev };
            if (isTyping) next[userId] = { name: userName, timestamp: Date.now() };
            else delete next[userId];
            return next;
          });
        })
        .subscribe((status, err) => {
          console.log(`[useChat] Channel status for ${roomId}:`, status, err || '');
          if (status === 'SUBSCRIBED') {
            retryCount = 0;
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
            retryCount++;
            const delay = Math.min(3000 * retryCount, 15000);
            console.warn(`[useChat] Channel lost. Retry #${retryCount} in ${delay}ms`);
            retryTimeout = setTimeout(() => {
              if (roomIdRef.current === roomId) setupChannel();
            }, delay);
          }
        });

      activeChannel = ch;
      channelRef.current = ch;
    };

    setupChannel();

    // ── Polling fallback: re-fetch every 8 seconds to catch any missed messages
    const pollInterval = setInterval(async () => {
      if (!roomIdRef.current) return;
      try {
        const data = await getRoomMessages(roomIdRef.current, PAGE_SIZE);
        setMessages(prev => {
          const optimistic = prev.filter(m => m.isOptimistic);
          const merged = [...data];
          optimistic.forEach(opt => {
            const confirmed = data.some(
              m => m.content?.trim() === opt.content?.trim() && m.senderId === opt.senderId
            );
            if (!confirmed) merged.push(opt);
          });
          return merged;
        });
      } catch { /* silently ignore */ }
    }, 8000);

    // ── Typing indicator expiry
    const typingInterval = setInterval(() => {
      setTypingUsers(prev => {
        const now = Date.now();
        let changed = false;
        const next = { ...prev };
        Object.entries(next).forEach(([uid, info]) => {
          if (now - info.timestamp > 4000) { delete next[uid]; changed = true; }
        });
        return changed ? next : prev;
      });
    }, 2000);

    return () => {
      clearInterval(pollInterval);
      clearInterval(typingInterval);
      if (retryTimeout) clearTimeout(retryTimeout);
      if (activeChannel) supabase.removeChannel(activeChannel);
      channelRef.current = null;
    };
  }, [roomId, fetchMessages, upsertMessageById]);

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

  /** Delete for ME only — hides locally, no server change */
  const removeForMe = useCallback((messageId) => {
    if (!user?.id) return;
    hideMessageForMe(user.id, messageId);
    setHiddenIds(prev => new Set([...prev, messageId]));
  }, [user?.id]);

  /** Delete for EVERYONE — soft-delete so all clients see 'This message was deleted' */
  const removeForEveryone = useCallback(async (messageId) => {
    // Optimistic UI: mark deleted immediately
    setMessages(prev => prev.map(m =>
      m.id === messageId ? { ...m, isDeleted: true, content: '' } : m
    ));
    try {
      await softDeleteMessage(messageId);
    } catch (err) {
      console.error('Failed to delete for everyone:', err);
      // Roll back on failure
      await fetchMessages();
    }
  }, [fetchMessages]);

  /** Legacy hard-delete (kept for internal use) */
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
    // Filter out locally hidden messages before exposing to UI
    messages: messages.filter(m => !hiddenIds.has(m.id)),
    loading,
    sending,
    sendError,
    typingUsers,
    hasMore,
    loadingMore,
    send,
    remove,
    removeForMe,
    removeForEveryone,
    edit,
    react,
    markRead,
    sendTyping,
    loadMore,
    refresh: fetchMessages
  };
};

export default useChat;
