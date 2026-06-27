import { supabase } from "../utils/supabaseClient";

// ─────────────────────────────────────────────────────────────────────────────
// Notification Service
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch all notifications for the current user.
 * @param {string} userId
 * @param {number} limit  Max rows to fetch (default 30)
 */
export const getNotifications = async (userId, limit = 30) => {
  const { data, error } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data || [];
};

/**
 * Count unread notifications for the current user.
 * @param {string} userId
 */
export const getUnreadCount = async (userId) => {
  const { count, error } = await supabase
    .from("notifications")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("is_read", false);

  if (error) throw error;
  return count || 0;
};

/**
 * Mark a single notification as read.
 * @param {string} notificationId
 */
export const markAsRead = async (notificationId) => {
  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("id", notificationId);

  if (error) throw error;
};

/**
 * Mark ALL notifications as read for a user.
 * @param {string} userId
 */
export const markAllAsRead = async (userId) => {
  const { error } = await supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("user_id", userId)
    .eq("is_read", false);

  if (error) throw error;
};

/**
 * Create a new notification.
 *
 * For cross-user notifications (userId ≠ current user) this calls the
 * `create_notification_for_user` SECURITY DEFINER RPC which bypasses RLS
 * safely while enforcing workspace-membership authorization server-side.
 *
 * For self-notifications, a direct INSERT is used (allowed by RLS).
 */
export const createNotification = async ({ userId, type, title, body, link, workspaceId }) => {
  const { data: { user: caller } } = await supabase.auth.getUser();

  // Cross-user notification → use the SECURITY DEFINER RPC
  if (!caller || caller.id !== userId) {
    const { data, error } = await supabase.rpc('create_notification_for_user', {
      p_user_id:      userId,
      p_type:         type,
      p_title:        title,
      p_body:         body,
      p_link:         link    ?? null,
      p_workspace_id: workspaceId ?? null,
    });
    if (error) throw error;
    return data; // returns the new notification UUID
  }

  // Self-notification → direct INSERT (allowed by RLS)
  const { data, error } = await supabase
    .from("notifications")
    .insert({
      user_id:      userId,
      type,
      title,
      body,
      link,
      workspace_id: workspaceId ?? null,
      is_read:      false
    })
    .select()
    .single();

  if (error) throw error;
  return data;
};
