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

    const channel = supabase
      .channel(`task-chat-${taskId}`)
      .on('postgres_changes', {
        event:  'INSERT',
        schema: 'public',
        table:  'task_messages',
        filter: `task_id=eq.${taskId}`,
      }, async (payload) => {
        if (payload.new && payload.new.user_id !== user?.id) {
          playUserPrefSound();
        }
        const { data } = await supabase
          .from('task_messages')
          .select(MSG_SELECT)
          .eq('id', payload.new.id)
          .single();
        if (data) {
          setMessages(prev => {
            if (prev.some(m => m.id === data.id)) return prev;
            return [...prev, normalizeMsg(data)];
          });
        }
      })
      .on('postgres_changes', {
        event:  'DELETE',
        schema: 'public',
        table:  'task_messages',
        filter: `task_id=eq.${taskId}`,
      }, (payload) => {
        setMessages(prev => prev.filter(m => m.id !== payload.old.id));
      })
      .on('postgres_changes', {
        event:  'UPDATE',
        schema: 'public',
        table:  'task_messages',
        filter: `task_id=eq.${taskId}`,
      }, async (payload) => {
        const { data } = await supabase
          .from('task_messages')
          .select(MSG_SELECT)
          .eq('id', payload.new.id)
          .single();
        if (data) setMessages(prev =>
          prev.map(m => m.id === data.id ? normalizeMsg(data) : m)
        );
      })
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, [taskId, fetchMessages]);

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
