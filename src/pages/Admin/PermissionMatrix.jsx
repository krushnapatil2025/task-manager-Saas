import React, { useState, useContext, useEffect } from 'react';
import DashboardLayout from '../../components/layouts/DashboardLayout';
import { JOB_PROFILES } from './InviteEmployee';
import { supabase } from '../../utils/supabaseClient';
import { WorkspaceContext } from '../../context/WorkspaceContext';
import { auditPermissionOverride } from '../../services/auditService';
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

// ─────────────────────────────────────────────────────────────────────────────
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

      await auditPermissionOverride(
        workspace.id,
        `role.${profile}.permission_changed`,
        'workspace_role_permissions',
        workspace.id,
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

  const Cell = ({ profile, permKey }) => {
    const isGranted = getPermissionState(profile, permKey);
    const stateKey = `${profile}_${permKey}`;
    const isBusy = saving[stateKey];

    return (
      <td className="px-4 py-3 text-center">
        <div className="flex justify-center">
          {isBusy ? (
            <LuLoaderCircle className="animate-spin text-indigo-600" size={20}/>
          ) : (
            <button
              onClick={() => handleTogglePermission(profile, permKey)}
              disabled={loading}
              title={`Toggle ${permKey} for ${profile}`}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                isGranted ? 'bg-indigo-600' : 'bg-gray-200'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  isGranted ? 'translate-x-4' : 'translate-x-0'
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
      <div className="mt-5 mb-10">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl font-bold text-gray-800">Permission Matrix</h2>
            <p className="text-sm text-gray-400 mt-0.5">
              Customize role-level permissions for <strong>{workspace?.name}</strong>
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-blue-600 bg-blue-50 border border-blue-100 rounded-xl px-3 py-2">
            <LuInfo size={14}/> Toggles modify access workspace-wide.
          </div>
        </div>

        {/* Role summary cards */}
        <div className="grid grid-cols-3 sm:grid-cols-3 gap-3 mb-6">
          {PROFILES.map(jp => {
            const count = countGranted(jp.value);
            const pct   = Math.round((count / totalPerms) * 100);
            return (
              <div key={jp.value}
                className="rounded-xl border border-gray-100 bg-white p-3 text-center shadow-sm">
                <span className="text-2xl">{jp.emoji}</span>
                <p className="text-xs font-bold text-gray-700 mt-1 leading-tight">{jp.label}</p>
                <div className="mt-2 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full transition-all"
                    style={{ width: `${pct}%`, background: jp.color }}/>
                </div>
                <p className="text-[10px] text-gray-400 mt-1">{count}/{totalPerms} permissions</p>
              </div>
            );
          })}
        </div>

        {/* Group tabs */}
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit mb-5">
          {PERMISSION_GROUPS.map((g, i) => (
            <button key={g.group} onClick={() => setActiveGroup(i)}
              className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all ${
                activeGroup === i ? 'bg-white text-blue-700 shadow' : 'text-gray-500 hover:text-gray-700'
              }`}>
              {g.group}
            </button>
          ))}
        </div>

        {/* Matrix table */}
        <div className="overflow-x-auto rounded-2xl border border-gray-100 bg-white shadow-sm">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide w-44">
                  Permission
                </th>
                {PROFILES.map(jp => (
                  <th key={jp.value} className="px-4 py-3 text-center">
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-lg">{jp.emoji}</span>
                      <span className="text-[10px] font-semibold text-gray-500">{jp.label}</span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {currentGroup.permissions.map(perm => (
                <tr key={perm.key} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-700 text-sm">{perm.label}</p>
                    <p className="text-[10px] text-gray-400 font-mono">{perm.key}</p>
                  </td>
                  {PROFILES.map(jp => (
                    <Cell key={jp.value} profile={jp.value} permKey={perm.key}/>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 mt-4 text-xs text-gray-500">
          <span className="flex items-center gap-1.5">
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-indigo-100/10">
              <span className="w-2 h-2 rounded-full bg-indigo-600"/>
            </span> Interactive Toggle Switches
          </span>
          <span className="flex items-center gap-1.5">
            <LuShield size={13} className="text-indigo-500"/>
            Overrides are applied workspace-wide and loaded dynamically
          </span>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default PermissionMatrix;
