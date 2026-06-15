import { supabase } from "../utils/supabaseClient";

// ─────────────────────────────────────────────────────────────────────────────
// Audit Service — client-side audit event logging via Supabase RPC
// All writes go through the SECURITY DEFINER function so users can't forge logs.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Send an audit event to the audit_logs table via the server-side RPC.
 * Fire-and-forget — errors are swallowed so they never break the UI.
 *
 * @param {string}  workspaceId
 * @param {string}  action      e.g. 'task.created', 'member.invited'
 * @param {string}  resource    e.g. 'tasks', 'workspace_members'
 * @param {string}  [resourceId] UUID of the affected record
 * @param {object}  [metadata]  Additional context
 */
export const logAuditEvent = async (
  workspaceId,
  action,
  resource,
  resourceId = null,
  metadata   = {}
) => {
  try {
    await supabase.rpc("log_audit_event", {
      p_workspace_id: workspaceId,
      p_action:       action,
      p_resource:     resource,
      p_resource_id:  resourceId,
      p_metadata:     metadata,
      p_ip_address:   null,  // client IP is not reliable; server-side would get this via Edge Function
    });
  } catch (err) {
    // Never let audit errors bubble up to the UI
    console.warn("[audit] Failed to log event:", action, err);
  }
};

/**
 * Fetch audit logs for a workspace.
 * @param {string} workspaceId
 * @param {object} options
 * @param {number} options.limit
 * @param {string} options.action   Filter by action prefix (e.g. 'task.')
 * @param {string} options.userId   Filter by user
 */
export const getAuditLogs = async (workspaceId, { limit = 50, action = null, userId = null } = {}) => {
  let query = supabase
    .from("audit_logs")
    .select(`
      id, action, resource, resource_id, metadata, ip_address, created_at,
      user:profiles(id, name, profile_image_url)
    `)
    .eq("workspace_id", workspaceId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (action) query = query.like("action", `${action}%`);
  if (userId) query = query.eq("user_id", userId);

  const { data, error } = await query;
  if (error) throw error;

  return (data || []).map((log) => ({
    id:          log.id,
    action:      log.action,
    resource:    log.resource,
    resourceId:  log.resource_id,
    metadata:    log.metadata || {},
    ipAddress:   log.ip_address,
    createdAt:   log.created_at,
    userName:    log.user?.name || "Unknown",
    userAvatar:  log.user?.profile_image_url,
    userId:      log.user?.id,
  }));
};

// ─── Convenience wrappers ──────────────────────────────────────────────────

/** Audit a task creation */
export const auditTaskCreated = (workspaceId, taskId, title) =>
  logAuditEvent(workspaceId, "task.created", "tasks", taskId, { title });

/** Audit a task deletion */
export const auditTaskDeleted = (workspaceId, taskId, title) =>
  logAuditEvent(workspaceId, "task.deleted", "tasks", taskId, { title });

/** Audit a status change */
export const auditStatusChanged = (workspaceId, taskId, title, oldStatus, newStatus) =>
  logAuditEvent(workspaceId, "task.status_changed", "tasks", taskId, {
    title, old_status: oldStatus, new_status: newStatus,
  });

/** Audit a member invitation sent */
export const auditMemberInvited = (workspaceId, email, role) =>
  logAuditEvent(workspaceId, "member.invited", "workspace_invitations", null, { email, role });

/** Audit a login */
export const auditLogin = (workspaceId) =>
  logAuditEvent(workspaceId, "auth.login", "auth", null, {});

// ─── Phase H: Enterprise event helpers ────────────────────────────────────────

/** Employee was invited */
export const auditEmployeeInvited = (workspaceId, invitationId, email, jobProfile) =>
  logAuditEvent(workspaceId, "employee.invited", "employee_invitations", invitationId, { email, job_profile: jobProfile });

/** Employee completed account setup */
export const auditEmployeeSetup = (workspaceId, userId, email, jobProfile) =>
  logAuditEvent(workspaceId, "employee.setup_completed", "profiles", userId, { email, job_profile: jobProfile });

/** Workspace member role was changed */
export const auditRoleChanged = (workspaceId, userId, oldRole, newRole) =>
  logAuditEvent(workspaceId, "role.changed", "workspace_members", userId, { old_role: oldRole, new_role: newRole });

/** Team was created */
export const auditTeamCreated = (workspaceId, teamId, teamName) =>
  logAuditEvent(workspaceId, "team.created", "teams", teamId, { name: teamName });

/** Member added to a team */
export const auditTeamMemberAdded = (workspaceId, teamId, userId, teamName) =>
  logAuditEvent(workspaceId, "team.member_added", "team_members", teamId, { user_id: userId, team_name: teamName });

/** Per-user permission override applied */
export const auditPermissionOverride = (workspaceId, targetUserId, permission, granted) =>
  logAuditEvent(workspaceId, "permission.overridden", "permission_overrides", null, { target_user_id: targetUserId, permission, granted });

/** Invitation revoked */
export const auditInviteRevoked = (workspaceId, invitationId, email) =>
  logAuditEvent(workspaceId, "invite.revoked", "employee_invitations", invitationId, { email });

/** Invitation resent */
export const auditInviteResent = (workspaceId, invitationId, email) =>
  logAuditEvent(workspaceId, "invite.resent", "employee_invitations", invitationId, { email });
