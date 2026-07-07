import { supabase } from "../utils/supabaseClient";

// ─────────────────────────────────────────────────────────────────────────────
// Super Admin Service — platform-wide data queries.
// The SA must have is_super_admin = true in the profiles table.
// RLS policies on these views/tables allow full access when is_super_admin = true.
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
 * @param {string|null} planFilter    'free' | 'pro' | 'enterprise' | null (all)
 * @param {string}      search        Filter by name
 * @param {string|null} statusFilter  'pending' | 'approved' | 'rejected' | 'restricted' | null (all)
 */
export const getAllWorkspaces = async (planFilter = null, search = "", statusFilter = null) => {
  let query = supabase
    .from("workspaces_with_stats")
    .select("*")
    .order("created_at", { ascending: false });

  if (planFilter)   query = query.eq("plan", planFilter);
  if (statusFilter) query = query.eq("approval_status", statusFilter);
  if (search)       query = query.ilike("name", `%${search}%`);

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
    .select("id, name, role, is_super_admin, created_at, current_workspace_id, account_approval_status")
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

/**
 * Review a company registration (approve, reject, or restrict).
 * @param {string} workspaceId
 * @param {'approved'|'rejected'|'restricted'} status
 * @param {string} note  Reason/note for the company admin
 */
export const reviewCompanyRegistration = async (workspaceId, status, note) => {
  const { data, error } = await supabase.rpc("review_company_registration", {
    p_workspace_id: workspaceId,
    p_status:       status,
    p_note:         note,
    p_secret:       import.meta.env.VITE_SUPER_ADMIN_SECRET || '',
  });
  if (error) throw error;
  return data;
};

/**
 * Get the count of pending company registrations.
 * @returns {Promise<number>}
 */
export const getPendingRegistrationCount = async () => {
  const { count, error } = await supabase
    .from("workspaces_with_stats")
    .select("id", { count: "exact", head: true })
    .eq("approval_status", "pending");

  if (error) throw error;
  return count || 0;
};

/**
 * Dedicated alias for fetching registrations with optional status filtering.
 * @param {string|null} statusFilter 'pending' | 'approved' | 'rejected' | 'restricted' | null
 * @param {string}      search       Filter by name
 */
export const getCompanyRegistrations = async (statusFilter = null, search = "") => {
  return getAllWorkspaces(null, search, statusFilter);
};

/**
 * Update user's is_super_admin flag.
 */
export const setUserSuperAdminStatus = async (userId, isSuperAdmin) => {
  const { error } = await supabase.rpc("set_user_super_admin_status", {
    p_user_id:        userId,
    p_is_super_admin: isSuperAdmin,
  });
  if (error) throw error;
};

/**
 * Update user's account approval/suspension status.
 */
export const setUserApprovalStatus = async (userId, status) => {
  const { error } = await supabase.rpc("set_user_approval_status", {
    p_user_id: userId,
    p_status:  status,
  });
  if (error) throw error;
};

/**
 * Update workspace's approval/suspension status.
 */
export const setWorkspaceApprovalStatus = async (workspaceId, status) => {
  const { error } = await supabase.rpc("set_workspace_approval_status", {
    p_workspace_id: workspaceId,
    p_status:       status,
  });
  if (error) throw error;
};

/**
 * Log an outbound email delivery attempt.
 */
export const logEmailDelivery = async (recipient, type, status, workspaceId = null, errorMsg = null) => {
  const { error } = await supabase
    .from("email_logs")
    .insert([{
      recipient,
      type,
      status,
      workspace_id: workspaceId,
      error_msg:    errorMsg
    }]);
  if (error) console.error("Failed to log email delivery:", error);
};

/**
 * Fetch email delivery logs.
 */
export const getEmailLogs = async (limit = 100) => {
  const { data, error } = await supabase
    .from("email_logs")
    .select(`
      id, recipient, type, status, error_msg, sent_at,
      workspace:workspaces(name)
    `)
    .order("sent_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data || [];
};

/**
 * Fetch all platform settings as a key-value object.
 */
export const getPlatformSettings = async () => {
  try {
    const { data, error } = await supabase
      .from("platform_settings")
      .select("*");

    if (error) {
      console.warn('platform_settings fetch failed (table may not exist yet):', error.message);
      return {};
    }
    const settings = {};
    (data || []).forEach(row => {
      settings[row.key] = row.value;
    });
    return settings;
  } catch (err) {
    console.warn('getPlatformSettings error:', err.message);
    return {};
  }
};

/**
 * Update a specific platform setting key.
 */
export const updatePlatformSetting = async (key, value) => {
  const { error } = await supabase
    .from("platform_settings")
    .upsert({
      key,
      value,
      updated_at: new Date().toISOString(),
    });
  if (error) throw error;
};

/**
 * Re-send an email for a specific log entry (failed delivery retry).
 * Fetches log details, then re-inserts a new log with status 'sent'.
 */
export const resendEmailLog = async (logId) => {
  // Fetch the original log row
  const { data: log, error: fetchErr } = await supabase
    .from("email_logs")
    .select("*")
    .eq("id", logId)
    .single();

  if (fetchErr) throw fetchErr;

  // Insert a new resent log entry
  const { error: insertErr } = await supabase
    .from("email_logs")
    .insert([{
      recipient:    log.recipient,
      type:         log.type,
      status:       'sent',
      workspace_id: log.workspace_id,
      error_msg:    null,
    }]);

  if (insertErr) throw insertErr;
};

/**
 * Get top N workspaces sorted by task count.
 * @param {number} limit
 */
export const getTopWorkspaces = async (limit = 10) => {
  const { data, error } = await supabase
    .from("workspaces_with_stats")
    .select("id, name, plan, task_count, member_count, approval_status")
    .eq("approval_status", "approved")
    .order("task_count", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return data || [];
};

/**
 * Get monthly workspace registration counts (last 12 months).
 * Returns array of { month, count } for charting.
 */
export const getRegistrationTrend = async () => {
  const { data, error } = await supabase
    .from("workspaces")
    .select("created_at")
    .order("created_at", { ascending: true });

  if (error) throw error;

  const monthlyGroups = {};
  (data || []).forEach(w => {
    if (!w.created_at) return;
    const key = new Date(w.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    monthlyGroups[key] = (monthlyGroups[key] || 0) + 1;
  });

  let cumulative = 0;
  return Object.entries(monthlyGroups)
    .sort(([a], [b]) => new Date(a) - new Date(b))
    .map(([month, count]) => {
      cumulative += count;
      return { month, newRegistrations: count, totalWorkspaces: cumulative };
    });
};

