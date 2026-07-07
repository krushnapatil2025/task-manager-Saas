import React, { useState, useEffect, useCallback } from 'react';
import { supabase } from '../utils/supabaseClient';
import { auditPermissionOverride } from '../services/auditService';
import toast from 'react-hot-toast';
import {
  LuX, LuShield, LuShieldCheck, LuLoaderCircle,
  LuRefreshCw, LuChevronDown, LuChevronUp, LuCheck, LuTriangleAlert,
} from 'react-icons/lu';
import { JOB_PROFILES } from '../pages/Admin/InviteEmployee';

// ── Constants — 10 Permission groups synchronized with the main Matrix ───────
const PERM_GROUPS = [
  {
    group: 'Tasks',
    icon: '📝',
    color: '#3b82f6',
    permissions: [
      { key: 'canCreateTask',       label: 'Create Tasks', desc: 'Allow creating new tasks in the workspace' },
      { key: 'canEditTask',         label: 'Update / Edit Tasks', desc: 'Allow editing task descriptions, titles, dates' },
      { key: 'canDeleteTask',       label: 'Delete Tasks', desc: 'Allow deleting or archiving tasks' },
      { key: 'canAssignTask',       label: 'Assign Tasks', desc: 'Allow assigning users or teams to tasks' },
      { key: 'canViewAllTasks',     label: 'View All Tasks', desc: 'Allow viewing tasks assigned to others' },
      { key: 'canExportTasks',      label: 'Export Tasks', desc: 'Allow exporting tasks list to CSV/Excel' },
      { key: 'canChangeTaskStatus', label: 'Change Task Status', desc: 'Allow updating status of any task' },
      { key: 'canAddComment',       label: 'Add Comments', desc: 'Allow posting comments on task discussions' }
    ],
  },
  {
    group: 'Chat',
    icon: '💬',
    color: '#8b5cf6',
    permissions: [
      { key: 'canSendMessages',       label: 'Send Messages', desc: 'Allow posting messages to channels' },
      { key: 'canCreateChannels',     label: 'Create Channels', desc: 'Allow creating public/private team rooms' },
      { key: 'canDeleteMessages',     label: 'Delete Messages', desc: 'Allow deleting own or others\' messages' },
      { key: 'canManageChannels',     label: 'Manage Channels', desc: 'Allow renaming/modifying team rooms' },
      { key: 'canSendDirectMessages', label: 'Send Direct Messages', desc: 'Allow initiating 1-on-1 direct messaging' }
    ]
  },
  {
    group: 'Teams',
    icon: '👥',
    color: '#10b981',
    permissions: [
      { key: 'canCreateTeam',        label: 'Create Teams', desc: 'Allow creating new team groups' },
      { key: 'canEditTeam',          label: 'Edit Teams', desc: 'Allow modifying team details' },
      { key: 'canDeleteTeam',        label: 'Delete Teams', desc: 'Allow deleting team groups' },
      { key: 'canManageTeamMembers', label: 'Manage Team Members', desc: 'Allow adding/removing members from teams' },
      { key: 'canViewTeamMembers',   label: 'View Team Members', desc: 'Allow viewing members list in sidebar/profile' }
    ],
  },
  {
    group: 'Goals',
    icon: '🎯',
    color: '#ec4899',
    permissions: [
      { key: 'canCreateGoal', label: 'Create Goals', desc: 'Allow creating targets and milestones' },
      { key: 'canEditGoal',   label: 'Edit Goals', desc: 'Allow editing goal progress and details' },
      { key: 'canDeleteGoal', label: 'Delete Goals', desc: 'Allow removing goal targets' },
      { key: 'canViewGoals',  label: 'View Goals', desc: 'Allow viewing the goals dashboard' }
    ]
  },
  {
    group: 'Sprint Board',
    icon: '🏃',
    color: '#f59e0b',
    permissions: [
      { key: 'canCreateSprint', label: 'Create Sprints', desc: 'Allow creating sprint cycles' },
      { key: 'canManageSprint', label: 'Manage Sprints', desc: 'Allow editing/starting sprints' },
      { key: 'canViewSprints',  label: 'View Sprints', desc: 'Allow viewing active/past sprints' },
      { key: 'canMoveCards',    label: 'Move Kanban Cards', desc: 'Allow drag-and-drop on Kanban/Sprint board' }
    ]
  },
  {
    group: 'Leave',
    icon: '📅',
    color: '#14b8a6',
    permissions: [
      { key: 'canApplyLeave',        label: 'Apply Leave', desc: 'Allow submitting personal leave requests' },
      { key: 'canApproveLeave',      label: 'Approve Leaves', desc: 'Allow approving employee leave requests' },
      { key: 'canViewAllLeaves',     label: 'View All Leaves', desc: 'Allow viewing leave calendar for all staff' },
      { key: 'canManageLeavePolicy', label: 'Manage Leave Policy', desc: 'Allow modifying leave quotas and policy' }
    ]
  },
  {
    group: 'Automations',
    icon: '🤖',
    color: '#6366f1',
    permissions: [
      { key: 'canCreateAutomation', label: 'Create Automations', desc: 'Allow creating automated trigger rules' },
      { key: 'canEditAutomation',   label: 'Edit Automations', desc: 'Allow modifying existing rules' },
      { key: 'canDeleteAutomation', label: 'Delete Automations', desc: 'Allow removing automation rules' },
      { key: 'canViewAutomations',  label: 'View Automations', desc: 'Allow viewing configured automations' }
    ]
  },
  {
    group: 'Files & Media',
    icon: '📁',
    color: '#06b6d4',
    permissions: [
      { key: 'canUploadFile',  label: 'Upload Files', desc: 'Allow uploading attachments to chats and tasks' },
      { key: 'canDeleteFiles', label: 'Delete Files', desc: 'Allow removing files from drive/chat' },
      { key: 'canViewFiles',   label: 'View Files', desc: 'Allow browsing the Files Hub' },
      { key: 'canShareFiles',  label: 'Share Files', desc: 'Allow generating sharing links for assets' }
    ]
  },
  {
    group: 'Reports',
    icon: '📊',
    color: '#3b82f6',
    permissions: [
      { key: 'canViewReports',   label: 'View Reports', desc: 'Allow viewing general company reports' },
      { key: 'canExportReports', label: 'Export Reports', desc: 'Allow exporting logs/files reports to Excel' },
      { key: 'canViewAnalytics', label: 'View Analytics', desc: 'Allow viewing analytical insights dashboards' }
    ]
  },
  {
    group: 'Admin / System',
    icon: '⚙️',
    color: '#64748b',
    permissions: [
      { key: 'canInviteEmployee', label: 'Invite Employees', desc: 'Allow sending email invites to new staff' },
      { key: 'canChangeUserRole', label: 'Change User Role', desc: 'Allow promoting or demoting members' },
      { key: 'canDeactivateUser', label: 'Deactivate Users', desc: 'Allow suspending workspace accounts' },
      { key: 'canViewAuditLog',   label: 'View Audit Log', desc: 'Allow viewing complete workspace audit trails' },
      { key: 'canManageApiKeys',  label: 'Manage API Keys', desc: 'Allow generating/revoking API keys' },
      { key: 'canManageWebhooks', label: 'Manage Webhooks', desc: 'Allow configuring notification webhooks' }
    ],
  },
];

const JP_MAP = Object.fromEntries(JOB_PROFILES.map(j => [j.value, j]));

const PROFILE_DEFAULTS = {
  company_admin: {
    canCreateTask: true, canEditTask: true, canDeleteTask: true, canAssignTask: true,
    canViewAllTasks: true, canExportTasks: true, canChangeTaskStatus: true, canAddComment: true,
    canInviteEmployee: true, canViewTeamMembers: true, canChangeUserRole: true, canDeactivateUser: true,
    canCreateTeam: true, canEditTeam: true, canDeleteTeam: true, canManageTeamMembers: true,
    canViewAuditLog: true, canManageApiKeys: true, canManageWebhooks: true, canViewReports: true,
    canSendMessages: true, canCreateChannels: true, canDeleteMessages: true, canManageChannels: true, canSendDirectMessages: true,
    canCreateGoal: true, canEditGoal: true, canDeleteGoal: true, canViewGoals: true,
    canCreateSprint: true, canManageSprint: true, canViewSprints: true, canMoveCards: true,
    canApplyLeave: true, canApproveLeave: true, canViewAllLeaves: true, canManageLeavePolicy: true,
    canCreateAutomation: true, canEditAutomation: true, canDeleteAutomation: true, canViewAutomations: true,
    canUploadFile: true, canDeleteFiles: true, canViewFiles: true, canShareFiles: true,
    canExportReports: true, canViewAnalytics: true,
  },
  manager: {
    canCreateTask: true, canEditTask: true, canDeleteTask: true, canAssignTask: true,
    canViewAllTasks: true, canExportTasks: true, canChangeTaskStatus: true, canAddComment: true,
    canInviteEmployee: true, canViewTeamMembers: true, canChangeUserRole: true, canDeactivateUser: true,
    canCreateTeam: true, canEditTeam: true, canDeleteTeam: true, canManageTeamMembers: true,
    canViewAuditLog: true, canManageApiKeys: true, canManageWebhooks: true, canViewReports: true,
    canSendMessages: true, canCreateChannels: true, canDeleteMessages: true, canManageChannels: true, canSendDirectMessages: true,
    canCreateGoal: true, canEditGoal: true, canDeleteGoal: true, canViewGoals: true,
    canCreateSprint: true, canManageSprint: true, canViewSprints: true, canMoveCards: true,
    canApplyLeave: true, canApproveLeave: true, canViewAllLeaves: true, canManageLeavePolicy: true,
    canCreateAutomation: true, canEditAutomation: true, canDeleteAutomation: true, canViewAutomations: true,
    canUploadFile: true, canDeleteFiles: true, canViewFiles: true, canShareFiles: true,
    canExportReports: true, canViewAnalytics: true,
  },
  employee: {
    canCreateTask: true, canEditTask: true, canDeleteTask: true, canAssignTask: true,
    canViewAllTasks: true, canExportTasks: true, canChangeTaskStatus: true, canAddComment: true,
    canInviteEmployee: true, canViewTeamMembers: true, canChangeUserRole: true, canDeactivateUser: true,
    canCreateTeam: true, canEditTeam: true, canDeleteTeam: true, canManageTeamMembers: true,
    canViewAuditLog: true, canManageApiKeys: true, canManageWebhooks: true, canViewReports: true,
    canSendMessages: true, canCreateChannels: true, canDeleteMessages: true, canManageChannels: true, canSendDirectMessages: true,
    canCreateGoal: true, canEditGoal: true, canDeleteGoal: true, canViewGoals: true,
    canCreateSprint: true, canManageSprint: true, canViewSprints: true, canMoveCards: true,
    canApplyLeave: true, canApproveLeave: true, canViewAllLeaves: true, canManageLeavePolicy: true,
    canCreateAutomation: true, canEditAutomation: true, canDeleteAutomation: true, canViewAutomations: true,
    canUploadFile: true, canDeleteFiles: true, canViewFiles: true, canShareFiles: true,
    canExportReports: true, canViewAnalytics: true,
  },
  intern: {
    canCreateTask: false, canEditTask: false, canDeleteTask: false, canAssignTask: false,
    canViewAllTasks: true, canExportTasks: false, canChangeTaskStatus: true, canAddComment: true,
    canInviteEmployee: false, canViewTeamMembers: true, canChangeUserRole: false, canDeactivateUser: false,
    canCreateTeam: false, canEditTeam: false, canDeleteTeam: false, canManageTeamMembers: false,
    canViewAuditLog: false, canManageApiKeys: false, canManageWebhooks: false, canViewReports: false,
    canSendMessages: true, canCreateChannels: false, canDeleteMessages: false, canManageChannels: false, canSendDirectMessages: true,
    canCreateGoal: false, canEditGoal: false, canDeleteGoal: false, canViewGoals: true,
    canCreateSprint: false, canManageSprint: false, canViewSprints: true, canMoveCards: true,
    canApplyLeave: true, canApproveLeave: false, canViewAllLeaves: false, canManageLeavePolicy: false,
    canCreateAutomation: false, canEditAutomation: false, canDeleteAutomation: false, canViewAutomations: false,
    canUploadFile: true, canDeleteFiles: false, canViewFiles: true, canShareFiles: true,
    canExportReports: false, canViewAnalytics: false,
  },
};

// ─────────────────────────────────────────────────────────────────────────────
// AccessControlPanel Component
// ─────────────────────────────────────────────────────────────────────────────
const AccessControlPanel = ({ member, workspaceId, onClose }) => {
  const jp       = JP_MAP[member?.job_profile] || JP_MAP.employee;
  const defaults = PROFILE_DEFAULTS[member?.job_profile] || PROFILE_DEFAULTS.employee;

  const [overrides,   setOverrides]   = useState({});
  const [toggling,    setToggling]    = useState({});
  const [loading,     setLoading]     = useState(true);
  const [openGroups,  setOpenGroups]  = useState({ 'Tasks': true });

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

  const effectiveValue = (permKey) => {
    if (overrides[permKey] !== undefined) return overrides[permKey];
    return defaults[permKey] ?? false;
  };

  const handleToggle = async (permKey) => {
    if (toggling[permKey]) return;
    const current = effectiveValue(permKey);
    const newValue = !current;
    const isDefault = defaults[permKey] === newValue;

    setToggling(t => ({ ...t, [permKey]: true }));
    try {
      if (isDefault) {
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

      await auditPermissionOverride(workspaceId, member.user_id, permKey, newValue);
    } catch (err) {
      toast.error(err.message || 'Failed to update permission');
    } finally {
      setToggling(t => ({ ...t, [permKey]: false }));
    }
  };

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
      toast.success('All overrides cleared.');
    } catch (err) {
      toast.error(err.message);
    }
  };

  const overrideCount = Object.keys(overrides).length;
  const isCompanyAdmin = member?.job_profile === 'company_admin' || member?.role === 'company_admin';

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/50 backdrop-blur-xs" onClick={onClose} />

      <div className="fixed right-0 top-0 h-full z-50 w-full max-w-xl bg-white dark:bg-[#121215] border-l border-slate-200 dark:border-zinc-800 flex flex-col shadow-2xl animate-slide-in-right">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-200 dark:border-zinc-800 flex-shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
              style={{ background: (jp?.color || '#64748b') + '25' }}>
              {member?.profile_image_url
                ? <img src={member.profile_image_url} alt={member.name} className="w-10 h-10 rounded-xl object-cover"/>
                : jp?.emoji || '👤'}
            </div>
            <div>
              <h3 className="text-slate-800 dark:text-zinc-200 font-bold text-base leading-tight">{member?.name}</h3>
              <p className="text-slate-400 dark:text-zinc-500 text-xs mt-0.5">
                <span className="font-semibold" style={{ color: jp?.color }}>{jp?.emoji} {jp?.label}</span>
                {member?.email && <> · {member.email}</>}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {overrideCount > 0 && (
              <button
                onClick={handleResetAll}
                className="flex items-center gap-1.5 text-xs text-amber-600 bg-amber-50 hover:bg-amber-100 dark:bg-amber-950/20 dark:text-amber-400 border border-amber-250 px-3 py-1.5 rounded-lg transition"
              >
                <LuRefreshCw size={12} />
                Reset ({overrideCount})
              </button>
            )}
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-slate-50 hover:bg-slate-100 dark:bg-zinc-800 dark:hover:bg-zinc-700 flex items-center justify-center text-slate-500 hover:text-slate-700 dark:text-zinc-400 dark:hover:text-zinc-200 transition"
            >
              <LuX size={16} />
            </button>
          </div>
        </div>

        {/* Company Admin notice */}
        {isCompanyAdmin && (
          <div className="mx-6 mt-4 flex items-start gap-2.5 bg-indigo-50 dark:bg-indigo-950/20 border border-indigo-100 dark:border-indigo-900/30 rounded-xl px-4 py-3 flex-shrink-0">
            <LuShieldCheck size={15} className="text-indigo-600 dark:text-indigo-400 mt-0.5 flex-shrink-0" />
            <p className="text-indigo-700 dark:text-indigo-300 text-xs leading-relaxed">
              <strong>Company Admin</strong> — This user has full access to everything. Overrides can still be
              applied but the admin role itself grants all permissions.
            </p>
          </div>
        )}

        {/* Legend */}
        <div className="flex items-center gap-4 px-6 py-3 flex-shrink-0 text-slate-400 dark:text-zinc-500 font-bold text-[10px] uppercase tracking-wider">
          <span className="flex items-center gap-1.5">
            <span className="w-4 h-4 rounded-full bg-emerald-500 flex items-center justify-center">
              <LuCheck size={9} className="text-white" />
            </span>
            Enabled
          </span>
          <span className="flex items-center gap-1.5 text-[10px]">
            <LuTriangleAlert className="text-amber-500" size={12} />
            Yellow border = overridden
          </span>
        </div>

        {/* Permission groups */}
        <div className="flex-1 overflow-y-auto px-6 pb-8">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <LuLoaderCircle className="animate-spin text-indigo-500" size={28} />
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {PERM_GROUPS.map(group => {
                const isOpen = openGroups[group.group] !== false;
                const grantedCount = group.permissions.filter(p => effectiveValue(p.key)).length;
                const overrideInGroup = group.permissions.some(p => overrides[p.key] !== undefined);

                return (
                  <div key={group.group}
                    className="rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50/20 dark:bg-zinc-900/10 overflow-hidden">
                    
                    {/* Group header */}
                    <button
                      onClick={() => setOpenGroups(s => ({ ...s, [group.group]: !isOpen }))}
                      className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 dark:hover:bg-zinc-800/20 transition"
                    >
                      <div className="flex items-center gap-2.5">
                        <span className="text-base">{group.icon}</span>
                        <span className="text-sm font-bold text-slate-700 dark:text-zinc-200">{group.group}</span>
                        {overrideInGroup && (
                          <span className="text-[9px] font-bold uppercase tracking-wider text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full dark:bg-amber-950/20 dark:text-amber-400 dark:border-amber-900/30">
                            overridden
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] text-slate-400 dark:text-zinc-500 font-medium">
                          {grantedCount}/{group.permissions.length} enabled
                        </span>
                        {isOpen
                          ? <LuChevronUp size={14} className="text-slate-400" />
                          : <LuChevronDown size={14} className="text-slate-400" />}
                      </div>
                    </button>

                    {/* Permission rows */}
                    {isOpen && (
                      <div className="border-t border-slate-100 dark:border-zinc-800/80 divide-y divide-slate-100 dark:divide-zinc-800/80">
                        {group.permissions.map(perm => {
                          const isOn       = effectiveValue(perm.key);
                          const isOverride = overrides[perm.key] !== undefined;
                          const isBusy     = toggling[perm.key];
                          const defaultVal = defaults[perm.key] ?? false;

                          return (
                            <div key={perm.key}
                              className={`flex items-center justify-between px-4 py-3 transition-all
                                ${isOn ? 'bg-indigo-50/10 dark:bg-indigo-950/5' : ''}`}>
                              <div className="flex-1 pr-3">
                                <p className={`text-xs font-bold ${isOn ? 'text-slate-800 dark:text-zinc-200' : 'text-slate-400 dark:text-zinc-500'}`}>
                                  {perm.label}
                                </p>
                                <p className="text-[10px] text-slate-400 dark:text-zinc-500 mt-0.5 leading-snug">{perm.desc}</p>
                                {isOverride && (
                                  <p className="text-[9px] text-amber-600 dark:text-amber-400 mt-0.5 flex items-center gap-1 font-semibold">
                                    <LuTriangleAlert size={8} />
                                    Default: {defaultVal ? 'On' : 'Off'} → Overridden to: {isOn ? 'On' : 'Off'}
                                  </p>
                                )}
                              </div>

                              {/* Toggle switch */}
                              <button
                                onClick={() => handleToggle(perm.key)}
                                disabled={isBusy}
                                className={`relative flex-shrink-0 w-10 h-5.5 rounded-full transition-colors duration-300 items-center flex
                                  ${isBusy ? 'opacity-50 cursor-wait' : 'cursor-pointer'}
                                  ${isOverride ? 'ring-2 ring-amber-400/40' : ''}
                                  ${isOn ? 'bg-indigo-600' : 'bg-slate-200 dark:bg-zinc-700'}`}
                              >
                                {isBusy ? (
                                  <LuLoaderCircle size={12} className="absolute inset-0 m-auto animate-spin text-white" />
                                ) : (
                                  <span className={`pointer-events-none inline-block h-4.5 w-4.5 transform rounded-full bg-white shadow transition-all duration-300
                                    ${isOn ? 'translate-x-4.5' : 'translate-x-0.5'}`}
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

        {/* Footer info */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-zinc-800 flex-shrink-0 bg-slate-50 dark:bg-zinc-900/10">
          <p className="text-[11px] text-slate-400 dark:text-zinc-500 flex items-start gap-1.5 font-bold leading-normal">
            <LuShield size={12} className="mt-0.5 flex-shrink-0 text-indigo-500" />
            Changes take effect immediately on next page load. Overrides layer on top of the role defaults.
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
