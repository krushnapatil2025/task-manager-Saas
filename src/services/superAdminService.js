import { supabase } from "../utils/supabaseClient";

// ─────────────────────────────────────────────────────────────────────────────
// Super Admin Service — platform-wide data queries (requires is_super_admin=true)
// All these functions will return data if RLS allows (super admin only).
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Get platform-wide stats from the platform_stats view.
 */
export const getPlatformStats = async () => {
  const { data, error } = await supabase
    .from("platform_stats")
    .select("*")
    .single();

  if (error) throw error;
  return {
    totalWorkspaces:   data.total_workspaces   || 0,
    totalUsers:        data.total_users        || 0,
    totalTasks:        data.total_tasks        || 0,
    completedTasks:    data.completed_tasks    || 0,
    totalComments:     data.total_comments     || 0,
    totalMemberships:  data.total_memberships  || 0,
    newUsers30d:       data.new_users_30d      || 0,
    newWorkspaces30d:  data.new_workspaces_30d || 0,
    newTasks30d:       data.new_tasks_30d      || 0,
  };
};

/**
 * Get all workspaces with member count + task count.
 * @param {string|null} planFilter  'free' | 'pro' | 'enterprise' | null (all)
 * @param {string}      search      Filter by name
 */
export const getAllWorkspaces = async (planFilter = null, search = "") => {
  let query = supabase
    .from("workspaces_with_stats")
    .select("*")
    .order("created_at", { ascending: false });

  if (planFilter) query = query.eq("plan", planFilter);
  if (search)     query = query.ilike("name", `%${search}%`);

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
};

/**
 * Get all users (profiles) with their workspace count.
 * @param {string} search  Filter by name/email
 */
export const getAllUsers = async (search = "") => {
  let query = supabase
    .from("profiles")
    .select("id, name, role, is_super_admin, created_at, current_workspace_id")
    .order("created_at", { ascending: false })
    .limit(200);

  if (search) {
    query = query.or(`name.ilike.%${search}%`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
};

/**
 * Manually override a workspace's plan.
 * @param {string} workspaceId
 * @param {'free'|'pro'|'enterprise'} plan
 */
export const overrideWorkspacePlan = async (workspaceId, plan) => {
  const { error } = await supabase.rpc("update_workspace_plan", {
    p_workspace_id: workspaceId,
    p_plan:         plan,
  });
  if (error) throw error;
};

/**
 * Get recent audit logs across all workspaces.
 * @param {number} limit
 */
export const getPlatformAuditLogs = async (limit = 50) => {
  const { data, error } = await supabase
    .from("audit_logs")
    .select(`
      id, action, resource, metadata, created_at, workspace_id,
      user:profiles(id, name)
    `)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;

  return (data || []).map((log) => ({
    id:          log.id,
    action:      log.action,
    resource:    log.resource,
    metadata:    log.metadata || {},
    createdAt:   log.created_at,
    workspaceId: log.workspace_id,
    userName:    log.user?.name || "System",
    userId:      log.user?.id,
  }));
};

/**
 * Delete a workspace (irreversible — cascade deletes all data).
 * @param {string} workspaceId
 */
export const deleteWorkspace = async (workspaceId) => {
  const { error } = await supabase
    .from("workspaces")
    .delete()
    .eq("id", workspaceId);
  if (error) throw error;
};
