import React, { useState, useContext, useEffect } from 'react';
import DashboardLayout from '../../components/layouts/DashboardLayout';
import { JOB_PROFILES } from './InviteEmployee';
import { supabase } from '../../utils/supabaseClient';
import { WorkspaceContext } from '../../context/WorkspaceContext';
import { logAuditEvent } from '../../services/auditService';
import toast from 'react-hot-toast';
import { LuShield, LuCheck, LuX, LuInfo, LuLoaderCircle } from 'react-icons/lu';


// ── Permission definitions ────────────────────────────────────────────────────
const PERMISSION_GROUPS = [
  {
    group: 'Tasks',
    permissions: [
      { key: 'canCreateTask',       label: 'Create Tasks' },
      { key: 'canEditTask',         label: 'Update / Edit Tasks' },
      { key: 'canDeleteTask',       label: 'Delete Tasks' },
      { key: 'canAssignTask',       label: 'Assign Tasks' },
      { key: 'canViewAllTasks',     label: 'View All Tasks' },
      { key: 'canExportTasks',      label: 'Export Tasks' },
    ],
  },
  {
    group: 'Users',
    permissions: [
      { key: 'canInviteEmployee',   label: 'Invite Employees' },
      { key: 'canViewTeamMembers',  label: 'View Team Members' },
      { key: 'canChangeUserRole',   label: 'Change User Role' },
      { key: 'canDeactivateUser',   label: 'Deactivate Users' },
    ],
  },
  {
    group: 'Teams',
    permissions: [
      { key: 'canCreateTeam',       label: 'Create Teams' },
      { key: 'canEditTeam',         label: 'Edit Teams' },
      { key: 'canDeleteTeam',       label: 'Delete Teams' },
      { key: 'canManageTeamMembers',label: 'Manage Team Members' },
    ],
  },
  {
    group: 'Admin',
    permissions: [
      { key: 'canViewAuditLog',     label: 'View Audit Log' },
      { key: 'canManageApiKeys',    label: 'Manage API Keys' },
      { key: 'canManageWebhooks',   label: 'Manage Webhooks' },
      { key: 'canViewReports',      label: 'View Reports' },
    ],
  },
];

// Matrix sourced from usePermissions.js PROFILE_PERMISSIONS
const MATRIX = {
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

const PROFILES = JOB_PROFILES.filter(j => j.value !== 'company_admin');

const PermissionMatrix = () => {
  const { workspace } = useContext(WorkspaceContext);
  const [activeGroup, setActiveGroup] = useState(0);
  const [saving, setSaving] = useState({});
  const [dbRolePermissions, setDbRolePermissions] = useState([]);
  const [loading, setLoading] = useState(false);

  const currentGroup = PERMISSION_GROUPS[activeGroup];

  const loadDbRolePermissions = async () => {
    if (!workspace?.id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('workspace_role_permissions')
        .select('*')
        .eq('workspace_id', workspace.id);
      if (error) throw error;
      setDbRolePermissions(data || []);
    } catch (err) {
      console.error('Failed to load role permissions:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDbRolePermissions();
  }, [workspace?.id]);

  const getPermissionState = (profile, permKey) => {
    const override = dbRolePermissions.find(
      p => p.role === profile && p.permission === permKey
    );
    if (override !== undefined) {
      return override.granted;
    }
    return MATRIX[profile]?.[permKey] === true;
  };

  const handleTogglePermission = async (profile, permKey) => {
    if (!workspace?.id) return;
    const currentVal = getPermissionState(profile, permKey);
    const newVal = !currentVal;
    const stateKey = `${profile}_${permKey}`;

    setSaving(prev => ({ ...prev, [stateKey]: true }));
    try {
      const { error } = await supabase
        .from('workspace_role_permissions')
        .upsert({
          workspace_id: workspace.id,
          role: profile,
          permission: permKey,
          granted: newVal
        }, { onConflict: 'workspace_id,role,permission' });

      if (error) throw error;

      await logAuditEvent(
        workspace.id,
        `role.${profile}.permission_changed`,
        'workspace_role_permissions',
        null,
        { role: profile, permission: permKey, oldVal: currentVal, newVal }
      );

      toast.success(`Updated permission for ${profile}`);
      await loadDbRolePermissions();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(prev => ({ ...prev, [stateKey]: false }));
    }
  };

  // ── count granted per profile ─────────────────────────────────────────────
  const countGranted = (profile) => {
    return PERMISSION_GROUPS
      .flatMap(g => g.permissions)
      .filter(p => getPermissionState(profile, p.key) === true).length;
  };
  const totalPerms = PERMISSION_GROUPS.flatMap(g => g.permissions).length;

  const renderCell = (profile, permKey) => {
    const isGranted = getPermissionState(profile, permKey);
    const stateKey = `${profile}_${permKey}`;
    const isBusy = saving[stateKey];

    return (
      <td className="px-4 py-4 text-center" key={profile}>
        <div className="flex justify-center">
          {isBusy ? (
            <LuLoaderCircle className="animate-spin text-indigo-600" size={18}/>
          ) : (
            <button
              onClick={() => handleTogglePermission(profile, permKey)}
              disabled={loading}
              title={`Toggle ${permKey} for ${profile}`}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none items-center ${
                isGranted ? 'bg-indigo-600' : 'bg-slate-200 dark:bg-zinc-700'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  isGranted ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          )}
        </div>
      </td>
    );
  };

  return (
    <DashboardLayout activeMenu="Permissions">
      <div className="mt-4 mb-12 animate-fade-in font-sans">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-xl md:text-2xl font-extrabold text-slate-900 dark:text-zinc-100 tracking-tight flex items-center gap-2">
              🛡️ Permission Matrix
            </h1>
            <p className="text-xs text-slate-400 dark:text-zinc-500 mt-1.5 font-bold uppercase tracking-wider">
              Customize role-level permissions for <strong className="text-indigo-600 dark:text-indigo-400">{workspace?.name}</strong>
            </p>
          </div>
          <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-650 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-950/20 border border-indigo-100/50 dark:border-indigo-900/30 rounded-xl px-3.5 py-2">
            <LuInfo size={14}/> Toggles modify access workspace-wide.
          </div>
        </div>

        {/* Role summary cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          {PROFILES.map(jp => {
            const count = countGranted(jp.value);
            const pct   = Math.round((count / totalPerms) * 100);
            return (
              <div key={jp.value} className="card text-center !p-4">
                <span className="text-2xl">{jp.emoji}</span>
                <p className="text-xs font-bold text-slate-800 dark:text-zinc-200 mt-1.5 leading-tight">{jp.label}</p>
                <div className="mt-3.5 h-1.5 bg-slate-100 dark:bg-zinc-800/80 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all"
                    style={{ width: `${pct}%`, background: jp.color }}/>
                </div>
                <p className="text-[9px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider mt-2.5">{count}/{totalPerms} permissions active</p>
              </div>
            );
          })}
        </div>

        {/* Group tabs */}
        <div className="flex gap-1 bg-slate-100/60 dark:bg-zinc-900/40 border border-slate-200 dark:border-zinc-800/80 p-1 rounded-xl w-fit mb-6">
          {PERMISSION_GROUPS.map((g, i) => (
            <button key={g.group} onClick={() => setActiveGroup(i)}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                activeGroup === i 
                  ? 'bg-white dark:bg-zinc-800 text-indigo-600 dark:text-indigo-400 shadow-sm font-extrabold' 
                  : 'text-slate-400 dark:text-zinc-500 hover:text-slate-600 dark:hover:text-zinc-350'
              }`}>
              {g.group}
            </button>
          ))}
        </div>

        {/* Matrix table */}
        <div className="card overflow-x-auto !p-0">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/50 dark:bg-zinc-900/20 border-b border-slate-100 dark:border-zinc-800/80">
                <th className="text-left px-6 py-3.5 text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wider w-56">
                  Permission
                </th>
                {PROFILES.map(jp => (
                  <th key={jp.value} className="px-4 py-3.5 text-center w-32">
                    <div className="flex flex-col items-center gap-0.5">
                      <span className="text-base">{jp.emoji}</span>
                      <span className="text-[10px] font-bold text-slate-500 dark:text-zinc-400">{jp.label}</span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/80">
              {currentGroup.permissions.map(perm => (
                <tr key={perm.key} className="hover:bg-slate-50/40 dark:hover:bg-zinc-900/10 transition-colors">
                  <td className="px-6 py-4">
                    <p className="font-bold text-slate-800 dark:text-zinc-200 text-xs">{perm.label}</p>
                    <p className="text-[9px] text-slate-400 dark:text-zinc-500 font-mono mt-0.5">{perm.key}</p>
                  </td>
                  {PROFILES.map(jp => renderCell(jp.value, perm.key))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Legend / Tips */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 mt-6 text-xs text-slate-400 dark:text-zinc-500 font-semibold">
          <span className="flex items-center gap-1.5">
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-indigo-550/10">
              <span className="w-2 h-2 rounded-full bg-indigo-600 dark:bg-indigo-400"/>
            </span> Dynamic Toggle Switches
          </span>
          <span className="flex items-center gap-1.5">
            <LuShield size={14} className="text-indigo-600 dark:text-indigo-400"/>
            Overrides apply workspace-wide and update permissions instantly.
          </span>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default PermissionMatrix;
