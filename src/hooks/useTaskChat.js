import { useState, useEffect, useCallback, useContext } from 'react';
import { supabase } from '../utils/supabaseClient';
import { UserContext }      from '../context/userContext';
import { WorkspaceContext } from '../context/WorkspaceContext';
import { playUserPrefSound } from '../utils/audioSynthesizer';

// ─────────────────────────────────────────────────────────────────────────────
// useTaskChat — Real-time chat hook for a task
//
// NOTE: task_messages has TWO foreign keys to profiles (user_id + author_id).
// PostgREST requires an explicit FK hint: profiles!user_id(...)
// ─────────────────────────────────────────────────────────────────────────────

// Shared select string — uses !user_id FK hint to resolve PGRST201 ambiguity
const MSG_SELECT = `
  id, content, message_type, mentions, reactions,
  created_at, edited_at, user_id,
  profiles!user_id(name, profile_image_url),
  task_message_reactions(user_id, emoji)
`;

export const useTaskChat = (taskId) => {
  const { user }      = useContext(UserContext);
  const { workspace } = useContext(WorkspaceContext);

  const [messages, setMessages] = useState([]);
  const [loading,  setLoading ] = useState(true);

  // ── Fetch all messages for this task ─────────────────────────────────────
  const fetchMessages = useCallback(async () => {
    if (!taskId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('task_messages')
        .select(MSG_SELECT)
        .eq('task_id', taskId)
        .order('created_at', { ascending: true })
        .limit(200);

      if (error) throw error;
      setMessages((data || []).map(normalizeMsg));
    } catch (err) {
      console.error('useTaskChat fetchMessages:', err);
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  // ── Realtime subscription ─────────────────────────────────────────────────
  useEffect(() => {
    fetchMessages();
    if (!taskId) return;

    console.log(`[useTaskChat] Initiating subscription setup for taskId: ${taskId}`);
    const channel = supabase
      .channel(`task-chat-${taskId}-${Date.now()}`)
      .on('postgres_changes', {
        event:  'INSERT',
        schema: 'public',
        table:  'task_messages',
      }, async (payload) => {
        console.log('[useTaskChat] Realtime INSERT event received:', payload);
        if (!payload.new) return;

        const eventTaskId = String(payload.new.task_id).toLowerCase();
        const activeTaskId = String(taskId).toLowerCase();

        if (eventTaskId !== activeTaskId) {
          console.log(`[useTaskChat] Task ID mismatch on INSERT. Event task: ${eventTaskId}, Active task: ${activeTaskId}`);
          return;
        }

        console.log('[useTaskChat] Task matched. Fetching message details for ID:', payload.new.id);

        if (payload.new.user_id !== user?.id) {
          playUserPrefSound();
        }
        let data = null;
        try {
          const res = await supabase
            .from('task_messages')
            .select(MSG_SELECT)
            .eq('id', payload.new.id)
            .single();
          if (res.error) {
            console.warn('[useTaskChat] Error fetching task message for realtime INSERT:', res.error);
          } else {
            data = res.data;
          }
        } catch (err) {
          console.warn('[useTaskChat] Exception fetching task message for realtime INSERT:', err);
        }

        const msg = data ? normalizeMsg(data) : normalizeMsg({
          ...payload.new,
          profiles: {
            name: payload.new.user_id === user?.id ? (user?.name || 'You') : 'Someone',
            profile_image_url: payload.new.user_id === user?.id ? (user?.profileImageUrl || null) : null
          }
        });

        console.log('[useTaskChat] Appending message to state:', msg);
        setMessages(prev => {
          if (prev.some(m => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
      })
      .on('postgres_changes', {
        event:  'DELETE',
        schema: 'public',
        table:  'task_messages',
      }, (payload) => {
        console.log('[useTaskChat] Realtime DELETE event received:', payload);
        if (payload.old && payload.old.id) {
          setMessages(prev => prev.filter(m => m.id !== payload.old.id));
        }
      })
      .on('postgres_changes', {
        event:  'UPDATE',
        schema: 'public',
        table:  'task_messages',
      }, async (payload) => {
        console.log('[useTaskChat] Realtime UPDATE event received:', payload);
        if (!payload.new) return;

        const eventTaskId = payload.new.task_id ? String(payload.new.task_id).toLowerCase() : null;
        const activeTaskId = String(taskId).toLowerCase();

        if (eventTaskId && eventTaskId !== activeTaskId) {
          console.log(`[useTaskChat] Task ID mismatch on UPDATE. Event task: ${eventTaskId}, Active task: ${activeTaskId}`);
          return;
        }

        let data = null;
        try {
          const res = await supabase
            .from('task_messages')
            .select(MSG_SELECT)
            .eq('id', payload.new.id)
            .single();
          if (res.error) {
            console.warn('[useTaskChat] Error fetching task message for realtime UPDATE:', res.error);
          } else {
            data = res.data;
          }
        } catch (err) {
          console.warn('[useTaskChat] Exception fetching task message for realtime UPDATE:', err);
        }

        if (data && String(data.task_id).toLowerCase() !== activeTaskId) {
          console.log(`[useTaskChat] Task ID mismatch after fetch. Fetched task: ${data.task_id}, Active task: ${activeTaskId}`);
          return;
        }
        if (!data && eventTaskId === null) {
          let msgExists = false;
          setMessages(prev => {
            msgExists = prev.some(m => m.id === payload.new.id);
            return prev;
          });
          if (!msgExists) return;
        }

        const msg = data ? normalizeMsg(data) : normalizeMsg({
          ...payload.new,
          profiles: {
            name: payload.new.user_id === user?.id ? (user?.name || 'You') : 'Someone',
            profile_image_url: payload.new.user_id === user?.id ? (user?.profileImageUrl || null) : null
          }
        });

        console.log('[useTaskChat] Updating message in state:', msg);
        setMessages(prev =>
          prev.map(m => m.id === msg.id ? msg : m)
        );
      })
      .subscribe((status, err) => {
        console.log(`[useTaskChat] Subscription Status for task ${taskId}:`, status, err || '');
      });

    return () => supabase.removeChannel(channel);
  }, [taskId, fetchMessages, user]);

  // ── Send message ──────────────────────────────────────────────────────────
  const sendMessage = useCallback(async (content, type = 'text') => {
    if (!content?.trim())  throw new Error('Message cannot be empty.');
    if (!user?.id)         throw new Error('You must be logged in.');
    if (!taskId)           throw new Error('No task selected.');
    if (!workspace?.id)    throw new Error('Workspace not loaded. Please wait and retry.');

    const { error } = await supabase.from('task_messages').insert({
      task_id:      taskId,
      workspace_id: workspace.id,   // required — NOT NULL in DB
      user_id:      user.id,
      content:      content.trim(),
      message_type: type,
    });
    if (error) throw error;
  }, [taskId, user?.id, workspace?.id]);

  // ── Delete message ────────────────────────────────────────────────────────
  const deleteMessage = useCallback(async (messageId) => {
    const { error } = await supabase
      .from('task_messages').delete().eq('id', messageId);
    if (error) throw error;
  }, []);

  // ── Toggle emoji reaction ─────────────────────────────────────────────────
  const toggleReaction = useCallback(async (messageId, emoji) => {
    if (!user?.id) return;

    // ── Optimistic update: toggle emoji in local state instantly ────────────
    setMessages(prev => prev.map(m => {
      if (m.id !== messageId) return m;

      // Check if user has already reacted with this emoji
      const hasReacted = (m.reactionsList || []).some(r => r.user_id === user.id && r.emoji === emoji);

      // 1. Update user reactions list
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

    // ── Sync in the background ──────────────────────────────────────────────
    try {
      const { data: existing } = await supabase
        .from('task_message_reactions')
        .select('message_id')
        .eq('message_id', messageId)
        .eq('user_id', user.id)
        .eq('emoji', emoji)
        .maybeSingle();

      if (existing) {
        await supabase.from('task_message_reactions')
          .delete()
          .eq('message_id', messageId)
          .eq('user_id', user.id)
          .eq('emoji', emoji);
      } else {
        await supabase.from('task_message_reactions')
          .insert({ message_id: messageId, user_id: user.id, emoji });
      }
    } catch (err) {
      console.error('Failed to toggle task message reaction:', err);
      // Roll back the optimistic change on error
      await fetchMessages();
    }
  }, [user?.id, fetchMessages]);

  return {
    messages,
    loading,
    sendMessage,
    deleteMessage,
    toggleReaction,
    refresh: fetchMessages,
  };
};

// ── Normalize row → message object ───────────────────────────────────────────
const normalizeMsg = (row) => ({
  id:           row.id,
  content:      row.content,
  type:         row.message_type || 'text',
  mentions:     row.mentions || [],
  reactions:    row.reactions || {},
  createdAt:    row.created_at,
  editedAt:     row.edited_at,
  authorId:     row.user_id,
  authorName:   row.profiles?.name  || 'User',
  authorAvatar: row.profiles?.profile_image_url || null,
});
