import { supabase } from "../utils/supabaseClient";

// ─────────────────────────────────────────────────────────────────────────────
// Workspace Service — all Supabase queries for workspaces & members
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch a single workspace by ID.
 * @param {string} workspaceId
 */
export const getWorkspaceById = async (workspaceId) => {
  const { data, error } = await supabase
    .from("workspaces")
    .select("*")
    .eq("id", workspaceId)
    .single();

  if (error) throw error;
  return data;
};

/**
 * Fetch all workspaces the current user belongs to.
 * Returns workspace objects enriched with the user's role in each.
 */
export const getMyWorkspaces = async () => {
  const { data, error } = await supabase
    .from("workspace_members")
    .select(`
      role,
      workspace:workspaces(id, name, slug, logo_url, plan, owner_id, created_at)
    `);

  if (error) throw error;

  return (data || []).map((m) => ({
    ...m.workspace,
    myRole: m.role,
  }));
};

/**
 * Get all members of a workspace with their profile details.
 * @param {string} workspaceId
 */
export const getWorkspaceMembers = async (workspaceId) => {
  const { data, error } = await supabase
    .from("workspace_members")
    .select(`
      role,
      joined_at,
      profile:profiles(id, name, profile_image_url, role)
    `)
    .eq("workspace_id", workspaceId);

  if (error) throw error;

  return (data || []).map((m) => ({
    id: m.profile?.id,
    name: m.profile?.name,
    profileImageUrl: m.profile?.profile_image_url,
    systemRole: m.profile?.role,
    wsRole: m.role,
    joinedAt: m.joined_at,
  }));
};

/**
 * Update workspace details (admin only).
 * @param {string} workspaceId
 * @param {object} updates  { name?, logo_url? }
 */
export const updateWorkspace = async (workspaceId, updates) => {
  const { error } = await supabase
    .from("workspaces")
    .update(updates)
    .eq("id", workspaceId);

  if (error) throw error;
};

/**
 * Remove a member from a workspace (admin only).
 * @param {string} workspaceId
 * @param {string} userId
 */
export const removeMember = async (workspaceId, userId) => {
  const { error } = await supabase
    .from("workspace_members")
    .delete()
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId);

  if (error) throw error;
};

/**
 * Change a member's role in a workspace (admin only).
 * @param {string} workspaceId
 * @param {string} userId
 * @param {'admin'|'member'|'viewer'} role
 */
export const updateMemberRole = async (workspaceId, userId, role) => {
  const { error } = await supabase
    .from("workspace_members")
    .update({ role })
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId);

  if (error) throw error;
};

/**
 * Get task statistics per workspace member.
 * Used in the Team Members admin view.
 * @param {string} workspaceId
 */
export const getMembersWithTaskStats = async (workspaceId) => {
  const members = await getWorkspaceMembers(workspaceId);
  if (members.length === 0) return [];

  const memberIds = members.map((m) => m.id);

  const { data: assignments, error } = await supabase
    .from("task_assignments")
    .select("user_id, task:tasks(status, workspace_id)")
    .in("user_id", memberIds);

  if (error) throw error;

  return members.map((member) => {
    const mine = (assignments || []).filter(
      (a) =>
        a.user_id === member.id &&
        a.task?.workspace_id === workspaceId
    );
    const statuses = mine.map((a) => a.task?.status);

    return {
      ...member,
      totalTasks: statuses.length,
      completedTasks: statuses.filter((s) => s === "Completed").length,
      pendingTasks: statuses.filter((s) => s === "Pending").length,
      inProgressTasks: statuses.filter((s) => s === "In Progress").length,
    };
  });
};
