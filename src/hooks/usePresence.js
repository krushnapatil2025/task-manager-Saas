import { useState, useEffect, useRef, useContext, useCallback } from 'react';
import { supabase } from '../utils/supabaseClient';
import { UserContext } from '../context/userContext';

// ─────────────────────────────────────────────────────────────────────────────
// usePresence — tracks who is currently viewing a task page
// Uses Supabase Realtime presence (not postgres_changes)
//
// Returns:
//   presentUsers  Array<{ id, name, avatar, onlineAt }>
// ─────────────────────────────────────────────────────────────────────────────

export const usePresence = (taskId) => {
  const { user } = useContext(UserContext);
  const [presentUsers, setPresentUsers] = useState([]);
  const channelRef = useRef(null);

  useEffect(() => {
    if (!taskId || !user?.id) return;

    const channel = supabase.channel(`presence-task-${taskId}`, {
      config: { presence: { key: user.id } },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const rawUsers = Object.values(state)
          .flat()
          .map(p => ({
            id:       p.user_id,
            name:     p.name,
            avatar:   p.avatar,
            onlineAt: p.online_at,
          }));
        
        // Deduplicate by user_id
        const unique = [];
        const seen = new Set();
        for (const u of rawUsers) {
          if (u.id && !seen.has(u.id)) {
            seen.add(u.id);
            unique.push(u);
          }
        }
        setPresentUsers(unique);
      })
      .on('presence', { event: 'join' }, ({ newPresences }) => {
        setPresentUsers(prev => {
          const ids = new Set(prev.map(u => u.id));
          const next = newPresences
            .filter(p => p.user_id && !ids.has(p.user_id))
            .map(p => ({ id: p.user_id, name: p.name, avatar: p.avatar, onlineAt: p.online_at }));
          
          const uniqueNext = [];
          const seen = new Set();
          for (const u of next) {
            if (u.id && !seen.has(u.id)) {
              seen.add(u.id);
              uniqueNext.push(u);
            }
          }
          return [...prev, ...uniqueNext];
        });
      })
      .on('presence', { event: 'leave' }, ({ leftPresences }) => {
        const leftIds = new Set(leftPresences.map(p => p.user_id));
        setPresentUsers(prev => prev.filter(u => u.id && !leftIds.has(u.id)));
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            user_id:   user.id,
            name:      user.name || 'User',
            avatar:    user.profileImageUrl || null,
            online_at: new Date().toISOString(),
          });
        }
      });

    channelRef.current = channel;

    return () => {
      channel.untrack();
      supabase.removeChannel(channel);
    };
  }, [taskId, user?.id]);

  return { presentUsers };
};

export default usePresence;
