import { useContext, useMemo, useEffect, useState } from 'react';
import { UserContext } from '../context/userContext';
import { WorkspaceContext } from '../context/WorkspaceContext';
import { supabase } from '../utils/supabaseClient';

// ─────────────────────────────────────────────────────────────────────────────
// Permission Matrix
// Maps each job_profile → set of boolean permission keys.
// Permissions are additive: higher roles inherit all lower-role permissions.
// ─────────────────────────────────────────────────────────────────────────────

const BASE_PERMISSIONS = {
  // ── Task permissions ──────────────────────────────────────────────────────
  canCreateTask:        false,
  canEditTask:          false,
  canDeleteTask:        false,
  canAssignTask:        false,
  canChangeTaskStatus:  true,   // everyone can update status of their tasks
  canViewAllTasks:      false,
  canExportTasks:       false,

  // ── User / member permissions ─────────────────────────────────────────────
  canInviteEmployee:    false,
  canViewTeamMembers:   false,
  canChangeUserRole:    false,
  canDeactivateUser:    false,

  // ── Team permissions ──────────────────────────────────────────────────────
  canCreateTeam:        false,
  canEditTeam:          false,
  canDeleteTeam:        false,
  canManageTeamMembers: false,

  // ── Workspace / admin permissions ─────────────────────────────────────────
  canViewAuditLog:      false,
  canManageApiKeys:     false,
  canManageWebhooks:    false,
  canViewReports:       false,
  canViewDashboard:     true,   // everyone sees their own dashboard

  // ── Content permissions ───────────────────────────────────────────────────
  canViewKanban:        true,
  canAddComment:        true,
  canUploadFile:        true,
};

// Per-profile overrides (merged onto base)
const PROFILE_PERMISSIONS = {
  company_admin: {
    canCreateTask:        true,
    canEditTask:          true,
    canDeleteTask:        true,
    canAssignTask:        true,
    canViewAllTasks:      true,
    canExportTasks:       true,
    canInviteEmployee:    true,
    canViewTeamMembers:   true,
    canChangeUserRole:    true,
    canDeactivateUser:    true,
    canCreateTeam:        true,
    canEditTeam:          true,
    canDeleteTeam:        true,
    canManageTeamMembers: true,
    canViewAuditLog:      true,
    canManageApiKeys:     true,
    canManageWebhooks:    true,
    canViewReports:       true,
  },

  manager: {
    canCreateTask:        true,
    canEditTask:          true,
    canDeleteTask:        true,
    canAssignTask:        true,
    canViewAllTasks:      true,
    canExportTasks:       true,
    canInviteEmployee:    true,
    canViewTeamMembers:   true,
    canChangeUserRole:    true,
    canDeactivateUser:    true,
    canCreateTeam:        true,
    canEditTeam:          true,
    canDeleteTeam:        true,
    canManageTeamMembers: true,
    canViewAuditLog:      true,
    canViewReports:       true,
    canManageApiKeys:     true,
    canManageWebhooks:    true,
  },

  employee: {
    canCreateTask:        true,
    canEditTask:          true,
    canDeleteTask:        true,
    canAssignTask:        true,
    canViewAllTasks:      true,
    canExportTasks:       true,
    canInviteEmployee:    true,
    canViewTeamMembers:   true,
    canChangeUserRole:    true,
    canDeactivateUser:    true,
    canCreateTeam:        true,
    canEditTeam:          true,
    canDeleteTeam:        true,
    canManageTeamMembers: true,
    canViewAuditLog:      true,
    canViewReports:       true,
    canManageApiKeys:     true,
    canManageWebhooks:    true,
  },

  intern: {
    canCreateTask:        false,
    canEditTask:          false,
    canDeleteTask:        false,
    canAssignTask:        false,
    canViewAllTasks:      true,
    canViewTeamMembers:   true,
    canChangeTaskStatus:  true,
    canViewKanban:        true,
    canAddComment:        true,
    canUploadFile:        true,
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// usePermissions hook
// Returns a permissions object for the current user, with DB overrides applied.
//
// Usage:
//   const { canCreateTask, canInviteEmployee } = usePermissions();
//   const { can } = usePermissions();  → can('createTask')
// ─────────────────────────────────────────────────────────────────────────────
export const usePermissions = () => {
  const { user }               = useContext(UserContext);
  const { wsRole, workspace }  = useContext(WorkspaceContext);

  // DB-sourced per-user overrides: { permKey: true | false }
  const [dbOverrides, setDbOverrides] = useState({});
  // DB-sourced workspace role-level overrides: { permKey: true | false }
  const [roleOverrides, setRoleOverrides] = useState({});

  // Load permission_overrides for the current user in the active workspace
  useEffect(() => {
    if (!user?.id || !workspace?.id) {
      setDbOverrides({});
      return;
    }
    let cancelled = false;
    supabase
      .from('permission_overrides')
      .select('permission, granted')
      .eq('workspace_id', workspace.id)
      .eq('user_id', user.id)
      .then(({ data }) => {
        if (cancelled) return;
        const map = {};
        (data || []).forEach(row => { map[row.permission] = row.granted; });
        setDbOverrides(map);
      });
    return () => { cancelled = true; };
  }, [user?.id, workspace?.id]);

  // Load workspace_role_permissions for user's profile in active workspace
  useEffect(() => {
    const profile =
      user?.job_profile ||
      wsRole            ||
      user?.role        ||
      'employee';

    if (!workspace?.id || !profile) {
      setRoleOverrides({});
      return;
    }
    let cancelled = false;
    supabase
      .from('workspace_role_permissions')
      .select('permission, granted')
      .eq('workspace_id', workspace.id)
      .eq('role', profile)
      .then(({ data }) => {
        if (cancelled) return;
        const map = {};
        (data || []).forEach(row => { map[row.permission] = row.granted; });
        setRoleOverrides(map);
      });
    return () => { cancelled = true; };
  }, [user?.job_profile, user?.role, wsRole, workspace?.id]);

  const permissions = useMemo(() => {
    // Determine effective profile: job_profile → wsRole → role → 'employee'
    const profile =
      user?.job_profile ||
      wsRole            ||
      user?.role        ||
      'employee';

    const isAdmin = ['company_admin', 'admin'].includes(profile);

    // ── ADMIN SHORT-CIRCUIT ──────────────────────────────────────────────────
    // Company admins get ALL permissions = true, unconditionally.
    // DB overrides cannot restrict an admin.
    if (isAdmin) {
      const adminPerms = {};
      Object.keys(BASE_PERMISSIONS).forEach(key => { adminPerms[key] = true; });
      adminPerms.can        = () => true;
      adminPerms.profile    = profile;
      adminPerms.isAdmin    = true;
      adminPerms.dbOverrides = {};
      adminPerms.roleOverrides = {};
      return adminPerms;
    }

    // ── Non-admin: merge base + role defaults + role overrides + DB overrides ─────────────────
    const profileOverrides = PROFILE_PERMISSIONS[profile] || {};
    const merged = { ...BASE_PERMISSIONS, ...profileOverrides };

    // Apply workspace role-level overrides on top
    Object.entries(roleOverrides).forEach(([key, val]) => {
      merged[key] = val;
    });

    // Apply DB-level user overrides on top (toggled by admin for this user)
    Object.entries(dbOverrides).forEach(([key, val]) => {
      merged[key] = val;
    });

    // Convenience: can('createTask') helper
    merged.can = (action) => {
      const key = 'can' + action.charAt(0).toUpperCase() + action.slice(1);
      return merged[key] === true;
    };

    merged.profile    = profile;
    merged.isAdmin    = false;
    merged.dbOverrides = dbOverrides;
    merged.roleOverrides = roleOverrides;

    return merged;
  }, [user?.job_profile, user?.role, wsRole, dbOverrides, roleOverrides]);

  return permissions;
};

export default usePermissions;
