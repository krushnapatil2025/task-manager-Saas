import { supabase } from "../utils/supabaseClient";

// ─────────────────────────────────────────────────────────────────────────────
// User Service — workspace-scoped profile queries
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch all members of a workspace (for user lists, assignment dropdowns).
 * Returns normalised camelCase objects.
 * @param {string} workspaceId
 */
export const getAllUsers = async (workspaceId) => {
  if (!workspaceId) {
    // Fallback: return all profiles (used in Phase 0 compatibility paths)
    const { data, error } = await supabase
      .from("profiles")
      .select("id, name, profile_image_url, role, created_at, status_emoji, status_text, status_expires_at, dnd_until")
      .order("name");
    if (error) throw error;
    return (data || []).map(normalizeProfile);
  }

  const { data, error } = await supabase
    .from("workspace_members")
    .select(`
      role,
      profile:profiles(id, name, profile_image_url, role, created_at, status_emoji, status_text, status_expires_at, dnd_until)
    `)
    .eq("workspace_id", workspaceId)
    .order("profile(name)");

  if (error) throw error;

  return (data || []).map((m) => ({
    ...normalizeProfile(m.profile),
    wsRole: m.role,
  }));
};

/** Update the current user's profile row. */
export const updateProfile = async (userId, updates) => {
  const { error } = await supabase
    .from("profiles")
    .update(updates)
    .eq("id", userId);
  if (error) throw error;
};

/**
 * Get workspace members enriched with task statistics.
 * Used in the admin "Team Members" view.
 * @param {string} workspaceId
 */
export const getUsersWithTaskStats = async (workspaceId) => {
  const users = await getAllUsers(workspaceId);
  if (users.length === 0) return [];

  const userIds = users.map((u) => u.id);

  const { data: assignments, error } = await supabase
    .from("task_assignments")
    .select("user_id, task:tasks(status, workspace_id)")
    .in("user_id", userIds);

  if (error) throw error;

  return users.map((user) => {
    const mine = (assignments || []).filter(
      (a) =>
        a.user_id === user.id &&
        (!workspaceId || a.task?.workspace_id === workspaceId)
    );
    const statuses = mine.map((a) => a.task?.status);
    return {
      ...user,
      totalTasks:      statuses.length,
      completedTasks:  statuses.filter((s) => s === "Completed").length,
      pendingTasks:    statuses.filter((s) => s === "Pending").length,
      inProgressTasks: statuses.filter((s) => s === "In Progress").length,
    };
  });
};

// ── Internal normalizer ────────────────────────────────────────────────────────
const normalizeProfile = (u) => ({
  id:              u.id,
  name:            u.name,
  role:            u.role,
  profileImageUrl: u.profile_image_url,
  createdAt:       u.created_at,
  statusEmoji:     u.status_emoji,
  statusText:      u.status_text,
  statusExpiresAt: u.status_expires_at,
  dndUntil:        u.dnd_until,
});
