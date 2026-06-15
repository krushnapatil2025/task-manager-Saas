import { useEffect, useRef, useCallback } from "react";
import { supabase } from "../utils/supabaseClient";

// ─────────────────────────────────────────────────────────────────────────────
// useRealtimeTasks
// Subscribes to Supabase Realtime changes on the tasks and task_comments tables
// for the current workspace. Calls the provided callbacks when changes arrive.
//
// Usage:
//   useRealtimeTasks(workspaceId, {
//     onTaskChange:   (payload) => refetchTasks(),
//     onCommentChange: (payload) => refetchComments(),
//   });
// ─────────────────────────────────────────────────────────────────────────────

const useRealtimeTasks = (workspaceId, { onTaskChange, onCommentChange } = {}) => {
  // Keep stable refs to the callbacks so we don't re-subscribe on every render
  const onTaskRef    = useRef(onTaskChange);
  const onCommentRef = useRef(onCommentChange);

  useEffect(() => { onTaskRef.current    = onTaskChange;    }, [onTaskChange]);
  useEffect(() => { onCommentRef.current = onCommentChange; }, [onCommentChange]);

  useEffect(() => {
    if (!workspaceId) return;

    const channelName = `workspace-${workspaceId}-tasks`;

    const channel = supabase
      .channel(channelName)
      // ── Task changes (INSERT / UPDATE / DELETE) ──────────────────────────
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "tasks",
          filter: `workspace_id=eq.${workspaceId}`,
        },
        (payload) => {
          if (onTaskRef.current) onTaskRef.current(payload);
        }
      )
      // ── Comment changes ───────────────────────────────────────────────────
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "task_comments",
          filter: `workspace_id=eq.${workspaceId}`,
        },
        (payload) => {
          if (onCommentRef.current) onCommentRef.current(payload);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [workspaceId]);
};

export default useRealtimeTasks;

// ─────────────────────────────────────────────────────────────────────────────
// useRealtimeNotifications
// Subscribes to new notifications for the current user.
//
// Usage:
//   useRealtimeNotifications(userId, () => refetchNotifications());
// ─────────────────────────────────────────────────────────────────────────────

export const useRealtimeNotifications = (userId, onNewNotification) => {
  const callbackRef = useRef(onNewNotification);
  useEffect(() => { callbackRef.current = onNewNotification; }, [onNewNotification]);

  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`notifications-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          if (callbackRef.current) callbackRef.current(payload);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [userId]);
};
