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
