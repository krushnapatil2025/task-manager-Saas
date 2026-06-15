import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../utils/supabaseClient';
import { auditPermissionOverride } from '../services/auditService';
import toast from 'react-hot-toast';
import {
  LuX, LuShield, LuShieldCheck, LuShieldOff, LuLoaderCircle,
  LuRefreshCw, LuChevronDown, LuChevronUp, LuCheck, LuTriangleAlert,
} from 'react-icons/lu';
import { JOB_PROFILES } from '../pages/Admin/InviteEmployee';

// ─────────────────────────────────────────────────────────────────────────────
// Permission groups with friendly labels and keys that match
// the permission_overrides table's `permission` column.
// Keys also mirror the usePermissions hook's PROFILE_PERMISSIONS keys.
// ─────────────────────────────────────────────────────────────────────────────
const PERM_GROUPS = [
  {
    group: 'Tasks',
    icon: '📋',
    color: '#3b82f6',
    permissions: [
      { key: 'canCreateTask',      label: 'Create Tasks',    desc: 'Create new tasks in the workspace' },
      { key: 'canEditTask',        label: 'Update / Edit Tasks', desc: 'Update/edit any task in the workspace' },
      { key: 'canDeleteTask',      label: 'Delete Tasks',    desc: 'Permanently delete tasks' },
      { key: 'canAssignTask',      label: 'Assign Tasks',    desc: 'Assign tasks to team members' },
      { key: 'canViewAllTasks',    label: 'View All Tasks',  desc: 'See tasks across all teams' },
      { key: 'canExportTasks',     label: 'Export Tasks',    desc: 'Download tasks as CSV / Excel' },
    ],
  },
  {
    group: 'Users & Teams',
    icon: '👥',
    color: '#8b5cf6',
    permissions: [
      { key: 'canInviteEmployee',    label: 'Invite Employees',    desc: 'Send email invitations to new members' },
      { key: 'canViewTeamMembers',   label: 'View Team Members',   desc: 'See the full member list' },
      { key: 'canChangeUserRole',    label: 'Change User Roles',   desc: 'Promote or demote member roles' },
      { key: 'canDeactivateUser',    label: 'Deactivate Users',    desc: 'Remove member workspace access' },
      { key: 'canCreateTeam',        label: 'Create Teams',        desc: 'Create new workspace teams' },
      { key: 'canEditTeam',          label: 'Edit Teams',          desc: 'Rename / modify team details' },
      { key: 'canDeleteTeam',        label: 'Delete Teams',        desc: 'Permanently delete teams' },
      { key: 'canManageTeamMembers', label: 'Manage Team Members', desc: 'Add / remove members from teams' },
    ],
  },
  {
    group: 'Admin & Reports',
    icon: '🛡️',
    color: '#f59e0b',
    permissions: [
      { key: 'canViewAuditLog',    label: 'View Audit Log',    desc: 'Read the workspace activity log' },
      { key: 'canManageApiKeys',   label: 'Manage API Keys',   desc: 'Create and revoke API keys' },
      { key: 'canManageWebhooks',  label: 'Manage Webhooks',   desc: 'Configure webhook endpoints' },
      { key: 'canViewReports',     label: 'View Reports',      desc: 'Access analytics and charts' },
    ],
  },
];

const JP_MAP = Object.fromEntries(JOB_PROFILES.map(j => [j.value, j]));

// ─────────────────────────────────────────────────────────────────────────────
// Default permission values per job_profile  (mirrors usePermissions.js)
// ─────────────────────────────────────────────────────────────────────────────
const PROFILE_DEFAULTS = {
  company_admin: {
    canCreateTask: true, canEditTask: true, canDeleteTask: true, canAssignTask: true,
    canViewAllTasks: true, canExportTasks: true, canInviteEmployee: true,
    canViewTeamMembers: true, canChangeUserRole: true, canDeactivateUser: true,
    canCreateTeam: true, canEditTeam: true, canDeleteTeam: true, canManageTeamMembers: true,
    canViewAuditLog: true, canManageApiKeys: true, canManageWebhooks: true, canViewReports: true,
  },
  manager: {
    canCreateTask: true, canEditTask: true, canDeleteTask: true, canAssignTask: true,
    canViewAllTasks: true, canExportTasks: true, canInviteEmployee: true,
    canViewTeamMembers: true, canChangeUserRole: true, canDeactivateUser: true,
    canCreateTeam: true, canEditTeam: true, canDeleteTeam: true, canManageTeamMembers: true,
    canViewAuditLog: true, canManageApiKeys: true, canManageWebhooks: true, canViewReports: true,
  },
  employee: {
    canCreateTask: true, canEditTask: true, canDeleteTask: true, canAssignTask: true,
    canViewAllTasks: true, canExportTasks: true, canInviteEmployee: true,
    canViewTeamMembers: true, canChangeUserRole: true, canDeactivateUser: true,
    canCreateTeam: true, canEditTeam: true, canDeleteTeam: true, canManageTeamMembers: true,
    canViewAuditLog: true, canManageApiKeys: true, canManageWebhooks: true, canViewReports: true,
  },
  intern: {
    canCreateTask: false, canEditTask: false, canDeleteTask: false, canAssignTask: false,
    canViewAllTasks: true, canExportTasks: false, canInviteEmployee: false,
    canViewTeamMembers: true, canChangeUserRole: false, canDeactivateUser: false,
    canCreateTeam: false, canEditTeam: false, canDeleteTeam: false, canManageTeamMembers: false,
    canViewAuditLog: false, canManageApiKeys: false, canManageWebhooks: false, canViewReports: false,
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// AccessControlPanel
// Props:
//   member         { user_id, name, job_profile, profile_image_url, email, status }
//   workspaceId    string
//   onClose        () => void
// ─────────────────────────────────────────────────────────────────────────────
const AccessControlPanel = ({ member, workspaceId, onClose }) => {
  const jp       = JP_MAP[member?.job_profile] || JP_MAP.employee;
  const defaults = PROFILE_DEFAULTS[member?.job_profile] || PROFILE_DEFAULTS.employee;

  // overrides: { permKey: true | false | null }
  // null  → no override (use default)
  // true  → explicitly GRANTED
  // false → explicitly REVOKED
  const [overrides,   setOverrides]   = useState({});
  const [toggling,    setToggling]    = useState({});   // permKey → bool
  const [loading,     setLoading]     = useState(true);
  const [openGroups,  setOpenGroups]  = useState({ 'Tasks': true });

  // ── Load existing overrides ─────────────────────────────────────────────────
  const loadOverrides = useCallback(async () => {
    if (!member?.user_id || !workspaceId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('permission_overrides')
        .select('permission, granted')
        .eq('workspace_id', workspaceId)
        .eq('user_id', member.user_id);
      if (error) throw error;
      const map = {};
      (data || []).forEach(row => { map[row.permission] = row.granted; });
      setOverrides(map);
    } catch (err) {
      toast.error('Failed to load access overrides');
    } finally {
      setLoading(false);
    }
  }, [member?.user_id, workspaceId]);

  useEffect(() => { loadOverrides(); }, [loadOverrides]);

  // ── Effective value = override if set, else default ─────────────────────────
  const effectiveValue = (permKey) => {
    if (overrides[permKey] !== undefined) return overrides[permKey];
    return defaults[permKey] ?? false;
  };

  // ── Toggle a permission ────────────────────────────────────────────────────
  const handleToggle = async (permKey) => {
    if (toggling[permKey]) return;
    const current = effectiveValue(permKey);
    const newValue = !current;
    const isDefault = defaults[permKey] === newValue;

    setToggling(t => ({ ...t, [permKey]: true }));
    try {
      if (isDefault) {
        // Remove the override — user reverts to their role default
        await supabase
          .from('permission_overrides')
          .delete()
          .eq('workspace_id', workspaceId)
          .eq('user_id', member.user_id)
          .eq('permission', permKey);
        setOverrides(o => {
          const next = { ...o };
          delete next[permKey];
          return next;
        });
      } else {
        // Upsert override
        const { error } = await supabase
          .from('permission_overrides')
          .upsert({
            workspace_id: workspaceId,
            user_id:      member.user_id,
            permission:   permKey,
            granted:      newValue,
          }, { onConflict: 'workspace_id,user_id,permission' });
        if (error) throw error;
        setOverrides(o => ({ ...o, [permKey]: newValue }));
      }

      // Audit trail
      await auditPermissionOverride(workspaceId, member.user_id, permKey, newValue);
    } catch (err) {
      toast.error(err.message || 'Failed to update permission');
    } finally {
      setToggling(t => ({ ...t, [permKey]: false }));
    }
  };

  // ── Reset ALL overrides for this user ─────────────────────────────────────
  const handleResetAll = async () => {
    if (!confirm(`Reset all permission overrides for ${member.name}? They will revert to their role defaults.`)) return;
    try {
      const { error } = await supabase
        .from('permission_overrides')
        .delete()
        .eq('workspace_id', workspaceId)
        .eq('user_id', member.user_id);
      if (error) throw error;
      setOverrides({});
      toast.success('All overrides cleared — reverted to role defaults.');
    } catch (err) {
      toast.error(err.message);
    }
  };

  const overrideCount = Object.keys(overrides).length;
  const isCompanyAdmin = member?.job_profile === 'company_admin' || member?.role === 'company_admin';

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Sliding panel */}
      <div className="fixed right-0 top-0 h-full z-50 w-full max-w-xl bg-[#0f0a1e] border-l border-white/10 flex flex-col shadow-2xl animate-slide-in-right">

        {/* ── Header ── */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/10 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
              style={{ background: (jp?.color || '#64748b') + '25' }}>
              {member?.profile_image_url
                ? <img src={member.profile_image_url} alt={member.name} className="w-10 h-10 rounded-xl object-cover"/>
                : jp?.emoji || '👤'}
            </div>
            <div>
              <h3 className="text-white font-bold text-base leading-tight">{member?.name}</h3>
              <p className="text-white/50 text-xs mt-0.5">
                <span className="font-semibold" style={{ color: jp?.color }}>{jp?.emoji} {jp?.label}</span>
                {member?.email && <> · {member.email}</>}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {overrideCount > 0 && (
              <button
                onClick={handleResetAll}
                title="Reset all overrides"
                className="flex items-center gap-1.5 text-xs text-orange-300 bg-orange-400/10 hover:bg-orange-400/20 border border-orange-400/25 px-3 py-1.5 rounded-lg transition"
              >
                <LuRefreshCw size={12} />
                Reset ({overrideCount})
              </button>
            )}
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/15 flex items-center justify-center text-white/60 hover:text-white transition"
            >
              <LuX size={16} />
            </button>
          </div>
        </div>

        {/* ── Company Admin notice ── */}
        {isCompanyAdmin && (
          <div className="mx-6 mt-4 flex items-start gap-2.5 bg-indigo-500/10 border border-indigo-400/25 rounded-xl px-4 py-3 flex-shrink-0">
            <LuShieldCheck size={15} className="text-indigo-400 mt-0.5 flex-shrink-0" />
            <p className="text-indigo-300 text-xs leading-relaxed">
              <strong>Company Admin</strong> — This user has full access to everything. Overrides can still be
              applied but the admin role itself grants all permissions.
            </p>
          </div>
        )}

        {/* ── Legend ── */}
        <div className="flex items-center gap-4 px-6 py-3 flex-shrink-0">
          <span className="flex items-center gap-1.5 text-[11px] text-white/40">
            <span className="w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center">
              <LuCheck size={9} className="text-white" />
            </span>
            Enabled
          </span>
          <span className="flex items-center gap-1.5 text-[11px] text-white/40">
            <span className="w-4 h-4 rounded-full bg-white/10" />
            Disabled
          </span>
          <span className="flex items-center gap-1.5 text-[11px] text-amber-400/70">
            <LuTriangleAlert size={10} />
            Yellow border = overridden from default
          </span>
        </div>

        {/* ── Permission groups ── */}
        <div className="flex-1 overflow-y-auto px-6 pb-8">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <LuLoaderCircle className="animate-spin text-indigo-400" size={28} />
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {PERM_GROUPS.map(group => {
                const isOpen = openGroups[group.group] !== false;
                const grantedCount = group.permissions.filter(p => effectiveValue(p.key)).length;
                const overrideInGroup = group.permissions.some(p => overrides[p.key] !== undefined);

                return (
                  <div key={group.group}
                    className="rounded-xl border border-white/8 bg-white/3 overflow-hidden">
                    {/* Group header */}
                    <button
                      onClick={() => setOpenGroups(s => ({ ...s, [group.group]: !isOpen }))}
                      className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="text-base">{group.icon}</span>
                        <span className="text-sm font-semibold text-white/80">{group.group}</span>
                        {overrideInGroup && (
                          <span className="text-[9px] font-bold uppercase tracking-wider text-amber-400 bg-amber-400/10 border border-amber-400/25 px-1.5 py-0.5 rounded-full">
                            overridden
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-white/40">
                          {grantedCount}/{group.permissions.length} enabled
                        </span>
                        {isOpen
                          ? <LuChevronUp size={14} className="text-white/30" />
                          : <LuChevronDown size={14} className="text-white/30" />}
                      </div>
                    </button>

                    {/* Permission rows */}
                    {isOpen && (
                      <div className="border-t border-white/6 divide-y divide-white/5">
                        {group.permissions.map(perm => {
                          const isOn       = effectiveValue(perm.key);
                          const isOverride = overrides[perm.key] !== undefined;
                          const isBusy     = toggling[perm.key];
                          const defaultVal = defaults[perm.key] ?? false;

                          return (
                            <div key={perm.key}
                              className={`flex items-center justify-between px-4 py-3 transition-all
                                ${isOn ? 'bg-emerald-500/4' : ''}`}>
                              <div className="flex-1 pr-3">
                                <p className={`text-sm font-medium ${isOn ? 'text-white/90' : 'text-white/50'}`}>
                                  {perm.label}
                                </p>
                                <p className="text-[10px] text-white/30 mt-0.5">{perm.desc}</p>
                                {isOverride && (
                                  <p className="text-[9px] text-amber-400/70 mt-0.5 flex items-center gap-1">
                                    <LuTriangleAlert size={8} />
                                    Default: {defaultVal ? 'On' : 'Off'} → Overridden to: {isOn ? 'On' : 'Off'}
                                  </p>
                                )}
                              </div>

                              {/* Toggle switch */}
                              <button
                                onClick={() => handleToggle(perm.key)}
                                disabled={isBusy}
                                title={isOn ? 'Click to disable' : 'Click to enable'}
                                className={`relative flex-shrink-0 w-12 h-6 rounded-full transition-all duration-300
                                  ${isBusy ? 'opacity-50 cursor-wait' : 'cursor-pointer'}
                                  ${isOverride ? 'ring-2 ring-amber-400/40' : ''}
                                  ${isOn ? 'bg-emerald-500' : 'bg-white/10'}`}
                              >
                                {isBusy ? (
                                  <LuLoaderCircle size={12} className="absolute inset-0 m-auto animate-spin text-white" />
                                ) : (
                                  <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all duration-300
                                    ${isOn ? 'left-[1.6rem]' : 'left-0.5'}`}
                                  />
                                )}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Footer info ── */}
        <div className="px-6 py-4 border-t border-white/10 flex-shrink-0">
          <p className="text-[11px] text-white/30 flex items-start gap-1.5">
            <LuShield size={12} className="mt-0.5 flex-shrink-0 text-indigo-400" />
            Changes take effect immediately on the user's next page load. Overrides layer on top of the
            role-based defaults — removing all overrides restores the default behavior.
          </p>
        </div>
      </div>

      <style>{`
        @keyframes slide-in-right {
          from { transform: translateX(100%); opacity: 0; }
          to   { transform: translateX(0);   opacity: 1; }
        }
        .animate-slide-in-right {
          animation: slide-in-right 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
      `}</style>
    </>
  );
};

export default AccessControlPanel;
