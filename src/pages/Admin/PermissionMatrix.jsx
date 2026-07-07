import React, { useState, useContext, useEffect, useMemo } from 'react';
import DashboardLayout from '../../components/layouts/DashboardLayout';
import { supabase } from '../../utils/supabaseClient';
import { WorkspaceContext } from '../../context/WorkspaceContext';
import { UserContext } from '../../context/userContext';
import { logAuditEvent, getAuditLogs } from '../../services/auditService';
import { getWorkspaceMembers } from '../../services/workspaceService';
import toast from 'react-hot-toast';
import {
  LuShield,
  LuCheck,
  LuX,
  LuInfo,
  LuLoaderCircle,
  LuSearch,
  LuDownload,
  LuRefreshCcw,
  LuUser,
  LuChevronRight,
  LuRotateCcw,
  LuHistory,
  LuSlidersHorizontal,
  LuSparkles,
  LuCopy,
  LuUserCheck
} from 'react-icons/lu';

// ── Constants ─────────────────────────────────────────────────────────────────
const PERMISSION_GROUPS = [
  {
    group: 'Tasks',
    icon: '📝',
    permissions: [
      { key: 'canCreateTask',       label: 'Create Tasks', desc: 'Allow creating new tasks in the active workspace' },
      { key: 'canEditTask',         label: 'Update / Edit Tasks', desc: 'Allow editing task descriptions, titles, and dates' },
      { key: 'canDeleteTask',       label: 'Delete Tasks', desc: 'Allow deleting or archiving tasks' },
      { key: 'canAssignTask',       label: 'Assign Tasks', desc: 'Allow assigning users or teams to tasks' },
      { key: 'canViewAllTasks',     label: 'View All Tasks', desc: 'Allow viewing tasks assigned to others' },
      { key: 'canExportTasks',      label: 'Export Tasks', desc: 'Allow exporting tasks to CSV/Excel formats' },
      { key: 'canChangeTaskStatus', label: 'Change Task Status', desc: 'Allow updating status of any task' },
      { key: 'canAddComment',       label: 'Add Comments', desc: 'Allow posting comments on task discussions' }
    ],
  },
  {
    group: 'Chat',
    icon: '💬',
    permissions: [
      { key: 'canSendMessages',       label: 'Send Messages', desc: 'Allow posting messages to public and private channels' },
      { key: 'canCreateChannels',     label: 'Create Channels', desc: 'Allow creating public or private team rooms' },
      { key: 'canDeleteMessages',     label: 'Delete Messages', desc: 'Allow deleting own or others\' messages' },
      { key: 'canManageChannels',     label: 'Manage Channels', desc: 'Allow renaming or modifying team channels' },
      { key: 'canSendDirectMessages', label: 'Send Direct Messages', desc: 'Allow initiating 1-on-1 direct messaging' }
    ]
  },
  {
    group: 'Teams',
    icon: '👥',
    permissions: [
      { key: 'canCreateTeam',        label: 'Create Teams', desc: 'Allow creating new team groups' },
      { key: 'canEditTeam',          label: 'Edit Teams', desc: 'Allow modifying team details and names' },
      { key: 'canDeleteTeam',        label: 'Delete Teams', desc: 'Allow deleting team groups' },
      { key: 'canManageTeamMembers', label: 'Manage Team Members', desc: 'Allow adding/removing members from teams' },
      { key: 'canViewTeamMembers',   label: 'View Team Members', desc: 'Allow viewing members list in sidebar/profile' }
    ],
  },
  {
    group: 'Goals',
    icon: '🎯',
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
    permissions: [
      { key: 'canViewReports',   label: 'View Reports', desc: 'Allow viewing general company reports' },
      { key: 'canExportReports', label: 'Export Reports', desc: 'Allow exporting logs/files reports to Excel' },
      { key: 'canViewAnalytics', label: 'View Analytics', desc: 'Allow viewing analytical insights dashboards' }
    ]
  },
  {
    group: 'Admin / System',
    icon: '⚙️',
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

const MATRIX = {
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

const PROFILES = [
  { value: 'manager',       label: 'Manager',        emoji: '👔', color: '#8b5cf6', desc: 'Team lead' },
  { value: 'employee',      label: 'Employee',       emoji: '👤', color: '#6366f1', desc: 'Regular member' },
  { value: 'intern',        label: 'Intern',         emoji: '🎓', color: '#10b981', desc: 'Restricted member' },
];

const PermissionMatrix = () => {
  const { workspace } = useContext(WorkspaceContext);
  const { user } = useContext(UserContext);

  // Top level tabs: 'matrix' | 'overrides' | 'changelog'
  const [activeTab, setActiveTab] = useState('matrix');
  const [activeGroup, setActiveGroup] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  
  // States
  const [dbRolePermissions, setDbRolePermissions] = useState([]);
  const [members, setMembers] = useState([]);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [userOverrides, setUserOverrides] = useState({});
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState({});
  const [memberSearchQuery, setMemberSearchQuery] = useState('');
  const [showCopyModal, setShowCopyModal] = useState(false);
  const [copySource, setCopySource] = useState('employee');
  const [copyTarget, setCopyTarget] = useState('intern');

  const currentGroup = PERMISSION_GROUPS[activeGroup];

  // Load all initial configurations
  const loadDbRolePermissions = async () => {
    if (!workspace?.id) return;
    try {
      const { data, error } = await supabase
        .from('workspace_role_permissions')
        .select('*')
        .eq('workspace_id', workspace.id);
      if (error) throw error;
      setDbRolePermissions(data || []);
    } catch (err) {
      console.error('Failed to load role permissions:', err.message);
    }
  };

  const loadWorkspaceMembersList = async () => {
    if (!workspace?.id) return;
    try {
      const data = await getWorkspaceMembers(workspace.id);
      // Filter out admin or the active superuser from override targeting if they shouldn't be overriden
      if (data && data.length > 0 && !selectedUserId) {
        if (window.innerWidth >= 1024) {
          setSelectedUserId(data[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to load workspace members:', err.message);
    }
  };

  const loadUserOverrides = async (userId) => {
    if (!workspace?.id || !userId) return;
    try {
      const { data, error } = await supabase
        .from('permission_overrides')
        .select('*')
        .eq('workspace_id', workspace.id)
        .eq('user_id', userId);
      if (error) throw error;
      const map = {};
      (data || []).forEach(row => {
        map[row.permission] = row.granted;
      });
      setUserOverrides(map);
    } catch (err) {
      console.error('Failed to load user overrides:', err.message);
    }
  };

  const loadHistoryLogs = async () => {
    if (!workspace?.id) return;
    try {
      const logs = await getAuditLogs(workspace.id, { limit: 100 });
      // Filter logs for permission or role modifications
      const filtered = logs.filter(l => 
        l.action?.startsWith('role.') || 
        l.action?.startsWith('permission.')
      );
      setAuditLogs(filtered);
    } catch (err) {
      console.error('Failed to load audit logs:', err.message);
    }
  };

  const handleRefresh = async () => {
    setLoading(true);
    await Promise.all([
      loadDbRolePermissions(),
      loadWorkspaceMembersList(),
      loadHistoryLogs()
    ]);
    if (selectedUserId) {
      await loadUserOverrides(selectedUserId);
    }
    setLoading(false);
    toast.success('Access configuration re-synchronized');
  };

  useEffect(() => {
    if (workspace?.id) {
      handleRefresh();
    }
  }, [workspace?.id]);

  useEffect(() => {
    if (selectedUserId) {
      loadUserOverrides(selectedUserId);
    }
  }, [selectedUserId]);

  const getRolePermissionState = (role, permKey) => {
    const override = dbRolePermissions.find(
      p => p.role === role && p.permission === permKey
    );
    if (override !== undefined) {
      return override.granted;
    }
    return MATRIX[role]?.[permKey] === true;
  };

  const handleTogglePermission = async (role, permKey) => {
    if (!workspace?.id) return;
    const currentVal = getRolePermissionState(role, permKey);
    const newVal = !currentVal;
    const stateKey = `role_${role}_${permKey}`;

    setSaving(prev => ({ ...prev, [stateKey]: true }));
    try {
      const { error } = await supabase
        .from('workspace_role_permissions')
        .upsert({
          workspace_id: workspace.id,
          role,
          permission: permKey,
          granted: newVal
        }, { onConflict: 'workspace_id,role,permission' });

      if (error) throw error;

      await logAuditEvent(
        workspace.id,
        `role.${role}.permission_changed`,
        'workspace_role_permissions',
        null,
        { role, permission: permKey, oldVal: currentVal, newVal }
      );

      toast.success(`Updated ${role} configuration`);
      await loadDbRolePermissions();
      await loadHistoryLogs();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(prev => ({ ...prev, [stateKey]: false }));
    }
  };

  const handleToggleUserOverride = async (userId, permKey, currentState) => {
    if (!workspace?.id || !userId) return;
    const stateKey = `user_${userId}_${permKey}`;
    setSaving(prev => ({ ...prev, [stateKey]: true }));
    try {
      let nextState = null;
      if (currentState === 'inherited_granted') {
        nextState = false; // override to denied
      } else if (currentState === 'inherited_denied') {
        nextState = true; // override to granted
      } else if (currentState === 'override_granted') {
        nextState = null; // delete override, revert to inherited
      } else if (currentState === 'override_denied') {
        nextState = null; // delete override, revert to inherited
      }

      if (nextState === null) {
        const { error } = await supabase
          .from('permission_overrides')
          .delete()
          .eq('workspace_id', workspace.id)
          .eq('user_id', userId)
          .eq('permission', permKey);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('permission_overrides')
          .upsert({
            workspace_id: workspace.id,
            user_id: userId,
            permission: permKey,
            granted: nextState
          }, { onConflict: 'workspace_id,user_id,permission' });
        if (error) throw error;
      }

      await logAuditEvent(
        workspace.id,
        `permission.overridden`,
        'permission_overrides',
        userId,
        { permission: permKey, before: currentState, after: nextState }
      );

      toast.success('User access override applied');
      await loadUserOverrides(userId);
      await loadHistoryLogs();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSaving(prev => ({ ...prev, [stateKey]: false }));
    }
  };

  const handleResetUserOverrides = async (userId) => {
    if (!workspace?.id || !userId) return;
    if (!window.confirm('Are you sure you want to clear all custom overrides for this user? They will revert to standard role permissions.')) return;
    
    setLoading(true);
    try {
      const { error } = await supabase
        .from('permission_overrides')
        .delete()
        .eq('workspace_id', workspace.id)
        .eq('user_id', userId);
      if (error) throw error;

      await logAuditEvent(
        workspace.id,
        `permission.reset_all`,
        'permission_overrides',
        userId,
        {}
      );

      toast.success('Cleared all user overrides');
      await loadUserOverrides(userId);
      await loadHistoryLogs();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyRoleSubmit = async () => {
    if (copySource === copyTarget) {
      return toast.error('Source and target roles must be different');
    }
    if (!window.confirm(`Are you sure you want to overwrite all customized permissions for ${copyTarget} with those from ${copySource}?`)) return;

    setLoading(true);
    try {
      // 1. Fetch custom permissions for source role
      const { data: sourceData, error: fetchErr } = await supabase
        .from('workspace_role_permissions')
        .select('*')
        .eq('workspace_id', workspace.id)
        .eq('role', copySource);

      if (fetchErr) throw fetchErr;

      // 2. Clear target role permissions
      const { error: deleteErr } = await supabase
        .from('workspace_role_permissions')
        .delete()
        .eq('workspace_id', workspace.id)
        .eq('role', copyTarget);

      if (deleteErr) throw deleteErr;

      // 3. Insert copied permissions
      const targetRows = (sourceData || []).map(row => ({
        workspace_id: workspace.id,
        role: copyTarget,
        permission: row.permission,
        granted: row.granted
      }));

      if (targetRows.length > 0) {
        const { error: insertErr } = await supabase
          .from('workspace_role_permissions')
          .upsert(targetRows, { onConflict: 'workspace_id,role,permission' });
        if (insertErr) throw insertErr;
      }

      await logAuditEvent(
        workspace.id,
        `role.${copyTarget}.copied_from_${copySource}`,
        'workspace_role_permissions',
        null,
        { source: copySource, target: copyTarget }
      );

      toast.success(`Copied configuration to ${copyTarget}`);
      await loadDbRolePermissions();
      await loadHistoryLogs();
      setShowCopyModal(false);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleExportCSV = () => {
    try {
      let csvContent = 'data:text/csv;charset=utf-8,';
      csvContent += 'Module,Permission Key,Permission Name,Manager,Employee,Intern\n';

      PERMISSION_GROUPS.forEach(g => {
        g.permissions.forEach(perm => {
          const managerState = getRolePermissionState('manager', perm.key) ? 'Granted' : 'Denied';
          const employeeState = getRolePermissionState('employee', perm.key) ? 'Granted' : 'Denied';
          const internState = getRolePermissionState('intern', perm.key) ? 'Granted' : 'Denied';
          csvContent += `"${g.group}","${perm.key}","${perm.label}","${managerState}","${employeeState}","${internState}"\n`;
        });
      });

      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      link.setAttribute('download', `permissions_report_${workspace?.slug || 'workspace'}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success('Permissions report exported');
    } catch (err) {
      toast.error('Failed to export report: ' + err.message);
    }
  };

  // Helper counters
  const countGranted = (role) => {
    return PERMISSION_GROUPS.flatMap(g => g.permissions).filter(p => getRolePermissionState(role, p.key)).length;
  };
  const totalPerms = PERMISSION_GROUPS.flatMap(g => g.permissions).length;

  const activeUserObj = useMemo(() => {
    return members.find(m => m.id === selectedUserId);
  }, [members, selectedUserId]);

  const filteredMembersList = useMemo(() => {
    const query = memberSearchQuery.toLowerCase().trim();
    if (!query) return members;
    return members.filter(m => 
      (m.name || '').toLowerCase().includes(query) || 
      (m.wsRole || '').toLowerCase().includes(query)
    );
  }, [members, memberSearchQuery]);

  const getEffectiveUserPermission = (permKey) => {
    const role = activeUserObj?.wsRole || 'employee';
    const inherited = getRolePermissionState(role, permKey);
    const userOverride = userOverrides[permKey];

    if (userOverride === true) {
      return { state: 'override_granted', label: 'Override: Allowed', val: true };
    } else if (userOverride === false) {
      return { state: 'override_denied', label: 'Override: Denied', val: false };
    } else {
      return inherited 
        ? { state: 'inherited_granted', label: 'Inherited: Allowed', val: true }
        : { state: 'inherited_denied', label: 'Inherited: Denied', val: false };
    }
  };

  const getGroupCounts = (groupObj, role) => {
    const granted = groupObj.permissions.filter(p => getRolePermissionState(role, p.key)).length;
    return `${granted}/${groupObj.permissions.length}`;
  };

  return (
    <DashboardLayout activeMenu="Permissions">
      <div className="mt-4 mb-12 animate-fade-in font-sans max-w-7xl mx-auto px-1 sm:px-4">
        
        {/* ── HEADER ── */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 bg-white dark:bg-[#121215]/40 border border-slate-200/60 dark:border-zinc-800/80 p-5 rounded-2xl shadow-sm">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400">
                <LuShield size={22} className="animate-pulse" />
              </span>
              <div>
                <h1 className="text-xl md:text-2xl font-black text-slate-800 dark:text-zinc-150 tracking-tight">
                  Access Control Center
                </h1>
                <p className="text-xs text-slate-400 dark:text-zinc-500 font-bold uppercase tracking-wider mt-0.5">
                  Configure role settings & user permission overrides for <span className="text-indigo-600 dark:text-indigo-400">{workspace?.name}</span>
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setShowCopyModal(true)}
              className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-800/60 text-xs font-bold text-slate-600 dark:text-zinc-300 transition flex items-center gap-1.5 cursor-pointer"
            >
              <LuCopy size={14} /> Copy Config
            </button>
            <button
              onClick={handleExportCSV}
              className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-800/60 text-xs font-bold text-slate-600 dark:text-zinc-300 transition flex items-center gap-1.5 cursor-pointer"
            >
              <LuDownload size={14} /> Export CSV
            </button>
            <button
              onClick={handleRefresh}
              disabled={loading}
              className="p-2 rounded-xl border border-slate-200 dark:border-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-800/60 text-slate-500 dark:text-zinc-400 transition cursor-pointer flex items-center justify-center"
              title="Sync Permissions"
            >
              <LuRefreshCcw size={15} className={loading ? 'animate-spin text-indigo-500' : ''} />
            </button>
          </div>
        </div>

        {/* ── ROLE STATS SUMMARY CARDS ── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          {PROFILES.map(p => {
            const count = countGranted(p.value);
            const percent = Math.round((count / totalPerms) * 100);
            return (
              <div
                key={p.value}
                className="bg-white dark:bg-[#151518]/90 border border-slate-200/60 dark:border-zinc-800/80 p-5 rounded-2xl shadow-sm hover:border-slate-300 dark:hover:border-zinc-700 transition duration-200"
              >
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-xl">{p.emoji}</span>
                    <h3 className="font-extrabold text-sm text-slate-800 dark:text-zinc-200 mt-1">{p.label} Profile</h3>
                    <p className="text-[10px] text-slate-400 dark:text-zinc-500 leading-tight mt-0.5">{p.desc}</p>
                  </div>
                  <span className="text-xs font-mono font-extrabold px-2 py-0.5 rounded-full bg-slate-50 dark:bg-zinc-800/50 border border-slate-200/50 dark:border-zinc-700/50 text-slate-500 dark:text-zinc-400">
                    {percent}% Granted
                  </span>
                </div>

                <div className="mt-4">
                  <div className="flex justify-between text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-wide mb-1.5">
                    <span>Active Features</span>
                    <span>{count} / {totalPerms}</span>
                  </div>
                  <div className="h-2 bg-slate-100 dark:bg-zinc-800/80 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${percent}%`, backgroundColor: p.color }}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* ── TOP LEVEL TAB NAVIGATION ── */}
        <div className="flex gap-1.5 bg-slate-100/60 dark:bg-[#121215]/50 border border-slate-200/60 dark:border-zinc-800/80 p-1 rounded-xl w-fit mb-6">
          <button
            onClick={() => setActiveTab('matrix')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'matrix'
                ? 'bg-white dark:bg-zinc-800 text-indigo-650 dark:text-indigo-400 shadow-sm font-extrabold border-slate-200'
                : 'text-slate-400 dark:text-zinc-500 hover:text-slate-650 dark:hover:text-zinc-350'
            }`}
          >
            <LuSlidersHorizontal size={13} /> Role Matrix
          </button>
          <button
            onClick={() => setActiveTab('overrides')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'overrides'
                ? 'bg-white dark:bg-zinc-800 text-indigo-650 dark:text-indigo-400 shadow-sm font-extrabold'
                : 'text-slate-400 dark:text-zinc-500 hover:text-slate-650 dark:hover:text-zinc-350'
            }`}
          >
            <LuUserCheck size={13} /> Per-User Overrides
          </button>
          <button
            onClick={() => setActiveTab('changelog')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'changelog'
                ? 'bg-white dark:bg-zinc-800 text-indigo-650 dark:text-indigo-400 shadow-sm font-extrabold'
                : 'text-slate-400 dark:text-zinc-500 hover:text-slate-650 dark:hover:text-zinc-350'
            }`}
          >
            <LuHistory size={13} /> Change Log
          </button>
        </div>

        {/* ── TAB 1: ROLE MATRIX ── */}
        {activeTab === 'matrix' && (
          <div className="flex flex-col lg:flex-row gap-5">
            {/* Sidebar Modules */}
            <div className="w-full lg:w-64 flex-shrink-0 flex flex-col gap-1 bg-white dark:bg-[#151518]/90 border border-slate-200/60 dark:border-zinc-800/80 p-3 rounded-2xl shadow-sm h-fit">
              <span className="text-[10px] font-bold text-slate-400 dark:text-zinc-550 uppercase tracking-widest px-3.5 py-1.5">
                Module Groups
              </span>
              <div className="flex flex-row lg:flex-col overflow-x-auto lg:overflow-x-visible gap-1 pb-2 lg:pb-0">
                {PERMISSION_GROUPS.map((g, idx) => {
                  const isSelected = activeGroup === idx;
                  return (
                    <button
                      key={g.group}
                      onClick={() => setActiveGroup(idx)}
                      className={`flex items-center justify-between gap-3 px-3 py-2 rounded-xl text-xs font-bold transition-all text-left cursor-pointer whitespace-nowrap lg:whitespace-normal flex-1 lg:flex-initial ${
                        isSelected
                          ? 'bg-indigo-50/70 dark:bg-indigo-950/20 text-indigo-600 dark:text-indigo-400 border border-indigo-100/50 dark:border-indigo-900/30'
                          : 'text-slate-500 hover:bg-slate-50 dark:text-zinc-400 dark:hover:bg-zinc-850/50 border border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-base">{g.icon}</span>
                        <span>{g.group}</span>
                      </div>
                      <div className="hidden lg:flex items-center gap-1.5">
                        <span className="text-[9px] font-mono bg-slate-100 dark:bg-zinc-800 text-slate-400 dark:text-zinc-500 px-1.5 py-0.5 rounded">
                          {getGroupCounts(g, 'employee')}
                        </span>
                        <LuChevronRight size={11} className={isSelected ? 'text-indigo-550' : 'text-slate-350'} />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Matrix Table & Content */}
            <div className="flex-1 bg-white dark:bg-[#151518]/90 border border-slate-200/60 dark:border-zinc-800/80 rounded-2xl shadow-sm overflow-hidden flex flex-col">
              
              {/* Filter Row */}
              <div className="p-4 border-b border-slate-100 dark:border-zinc-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/30 dark:bg-zinc-900/10">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{currentGroup.icon}</span>
                  <div>
                    <h2 className="font-extrabold text-sm text-slate-800 dark:text-zinc-200">{currentGroup.group} Permissions</h2>
                    <p className="text-[10px] text-slate-400 dark:text-zinc-500 leading-none mt-0.5">Toggle default access across all roles</p>
                  </div>
                </div>

                <div className="relative flex items-center bg-slate-50 dark:bg-[#121215]/50 border border-slate-200 dark:border-zinc-800 rounded-xl px-2.5 py-1.5 text-slate-500 transition focus-within:ring-2 focus-within:ring-indigo-500/20 max-w-xs w-full">
                  <LuSearch size={14} className="text-slate-400 mr-2 flex-shrink-0" />
                  <input
                    type="text"
                    placeholder="Search permissions..."
                    className="bg-transparent border-none outline-none text-xs text-slate-700 dark:text-zinc-200 w-full placeholder-slate-400"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                  />
                  {searchQuery && (
                    <button onClick={() => setSearchQuery('')} className="p-0.5 hover:bg-slate-200 rounded text-slate-400">
                      <LuX size={12} />
                    </button>
                  )}
                </div>
              </div>

              {/* Permission Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/40 dark:bg-zinc-900/25 border-b border-slate-100 dark:border-zinc-800/80 text-[10px] font-bold text-slate-400 dark:text-zinc-500 uppercase tracking-widest">
                      <th className="px-5 py-3">Permission Setting</th>
                      {PROFILES.map(p => (
                        <th key={p.value} className="px-4 py-3 text-center w-32">{p.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-zinc-800/80">
                    {currentGroup.permissions
                      .filter(perm => 
                        perm.label.toLowerCase().includes(searchQuery.toLowerCase()) || 
                        perm.key.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        perm.desc.toLowerCase().includes(searchQuery.toLowerCase())
                      )
                      .map(perm => (
                        <tr key={perm.key} className="hover:bg-slate-55/30 dark:hover:bg-zinc-900/10 transition-colors">
                          <td className="px-5 py-4">
                            <span className="font-bold text-slate-750 dark:text-zinc-200 text-xs">{perm.label}</span>
                            <span className="ml-2 font-mono text-[9px] text-slate-400 dark:text-zinc-550 bg-slate-50 dark:bg-zinc-800/60 px-1.5 py-0.5 rounded">
                              {perm.key}
                            </span>
                            <p className="text-[10px] text-slate-400 dark:text-zinc-500 mt-1 leading-snug">{perm.desc}</p>
                          </td>
                          {PROFILES.map(p => {
                            const isGranted = getRolePermissionState(p.value, perm.key);
                            const cellKey = `role_${p.value}_${perm.key}`;
                            const isSaving = saving[cellKey];

                            return (
                              <td className="px-4 py-4 text-center" key={p.value}>
                                <div className="flex justify-center items-center">
                                  {isSaving ? (
                                    <LuLoaderCircle className="animate-spin text-indigo-500" size={16} />
                                  ) : (
                                    <button
                                      onClick={() => handleTogglePermission(p.value, perm.key)}
                                      disabled={loading}
                                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border border-transparent transition-colors duration-200 ease-in-out focus:outline-none items-center ${
                                        isGranted ? 'bg-indigo-600' : 'bg-slate-200 dark:bg-zinc-700'
                                      }`}
                                    >
                                      <span
                                        className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition duration-200 ease-in-out ${
                                          isGranted ? 'translate-x-4' : 'translate-x-0'
                                        }`}
                                      />
                                    </button>
                                  )}
                                </div>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    {currentGroup.permissions.length === 0 && (
                      <tr>
                        <td colSpan={4} className="text-center py-8 text-xs text-slate-450 italic">
                          No matching permissions found
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Tips Legend */}
              <div className="p-4 bg-slate-50/20 dark:bg-zinc-900/10 border-t border-slate-100 dark:border-zinc-800/80 text-[10px] text-slate-400 dark:text-zinc-500 font-bold flex flex-wrap gap-4 items-center">
                <span className="flex items-center gap-1.5">
                  <LuSparkles className="text-indigo-500" size={13} /> Modifies access workspace-wide.
                </span>
                <span className="flex items-center gap-1.5">
                  <LuShield className="text-emerald-500" size={13} /> Administrators always retain complete access.
                </span>
              </div>
            </div>
          </div>
        )}

        {/* ── TAB 2: PER-USER OVERRIDES ── */}
        {activeTab === 'overrides' && (
          <div className="flex flex-col lg:flex-row gap-5">
            {/* Left sidebar: Members list */}
            <div className={`w-full lg:w-72 flex-shrink-0 flex flex-col bg-white dark:bg-[#151518]/90 border border-slate-200/60 dark:border-zinc-800/80 rounded-2xl shadow-sm overflow-hidden h-[500px] ${selectedUserId ? 'hidden lg:flex' : 'flex'}`}>
              <div className="p-3.5 border-b border-slate-100 dark:border-zinc-800/80 flex flex-col gap-2">
                <span className="text-[10px] font-bold text-slate-400 dark:text-zinc-550 uppercase tracking-widest">
                  Workspace Members
                </span>
                
                <div className="relative flex items-center bg-slate-50 dark:bg-[#121215]/50 border border-slate-200 dark:border-zinc-800 rounded-xl px-2.5 py-1 text-slate-500 transition focus-within:ring-2 focus-within:ring-indigo-500/20">
                  <LuSearch size={13} className="text-slate-400 mr-1.5 flex-shrink-0" />
                  <input
                    type="text"
                    placeholder="Find team members..."
                    className="bg-transparent border-none outline-none text-[11px] text-slate-700 dark:text-zinc-200 w-full placeholder-slate-400"
                    value={memberSearchQuery}
                    onChange={e => setMemberSearchQuery(e.target.value)}
                  />
                  {memberSearchQuery && (
                    <button onClick={() => setMemberSearchQuery('')} className="p-0.5 hover:bg-slate-200 rounded text-slate-400">
                      <LuX size={10} />
                    </button>
                  )}
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-0.5">
                {filteredMembersList.map(member => {
                  const isSelected = selectedUserId === member.id;
                  return (
                    <button
                      key={member.id}
                      onClick={() => setSelectedUserId(member.id)}
                      className={`flex items-center gap-3 px-3 py-2 rounded-xl text-left transition-all cursor-pointer ${
                        isSelected
                          ? 'bg-indigo-50/70 dark:bg-indigo-950/20 border border-indigo-100/50 dark:border-indigo-900/30'
                          : 'hover:bg-slate-50 dark:hover:bg-zinc-850/40 border border-transparent'
                      }`}
                    >
                      {member.profileImageUrl ? (
                        <img src={member.profileImageUrl} alt={member.name} className="w-8 h-8 rounded-full object-cover border border-slate-200 dark:border-zinc-700" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-400 to-purple-500 text-white font-extrabold flex items-center justify-center text-xs">
                          {(member.name || 'U')[0].toUpperCase()}
                        </div>
                      )}

                      <div className="min-w-0 flex-1">
                        <h4 className={`text-xs font-bold truncate ${isSelected ? 'text-indigo-655 dark:text-indigo-400' : 'text-slate-705 dark:text-zinc-200'}`}>
                          {member.name || 'Member'}
                        </h4>
                        <span className="text-[10px] text-slate-400 dark:text-zinc-500 font-mono capitalize">
                          {member.wsRole || 'Employee'}
                        </span>
                      </div>
                    </button>
                  );
                })}
                {filteredMembersList.length === 0 && (
                  <p className="text-[10px] text-slate-450 italic text-center py-8">No members found</p>
                )}
              </div>
            </div>

            {/* Right: Custom overrides list */}
            <div className={`flex-1 bg-white dark:bg-[#151518]/90 border border-slate-200/60 dark:border-zinc-800/80 rounded-2xl shadow-sm flex flex-col min-w-0 ${!selectedUserId ? 'hidden lg:flex' : 'flex'}`}>
              {activeUserObj ? (
                <>
                  <div className="p-4 border-b border-slate-100 dark:border-zinc-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/30 dark:bg-zinc-900/10">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => setSelectedUserId('')}
                        className="lg:hidden p-1.5 rounded-lg border border-slate-200 dark:border-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-850/50 text-slate-600 dark:text-zinc-350 mr-1 flex items-center justify-center cursor-pointer"
                        title="Back to members"
                      >
                        <LuChevronLeft size={16} />
                      </button>
                      {activeUserObj.profileImageUrl ? (
                        <img src={activeUserObj.profileImageUrl} alt={activeUserObj.name} className="w-10 h-10 rounded-full object-cover" />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-indigo-500 text-white font-bold flex items-center justify-center text-sm">
                          {(activeUserObj.name || 'U')[0].toUpperCase()}
                        </div>
                      )}
                      <div>
                        <h2 className="font-extrabold text-sm text-slate-800 dark:text-zinc-200">
                          Access Overrides for {activeUserObj.name || 'Member'}
                        </h2>
                        <p className="text-[10px] text-slate-400 dark:text-zinc-500 mt-0.5">
                          Base Profile: <span className="capitalize font-mono">{activeUserObj.wsRole || 'employee'}</span>
                        </p>
                      </div>
                    </div>

                    <button
                      onClick={() => handleResetUserOverrides(activeUserObj.id)}
                      className="px-3 py-1.5 rounded-xl border border-rose-200 dark:border-rose-900/40 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                    >
                      <LuRotateCcw size={13} /> Reset to Defaults
                    </button>
                  </div>

                  <div className="divide-y divide-slate-100 dark:divide-zinc-850 overflow-y-auto max-h-[500px]">
                    {PERMISSION_GROUPS.map(group => {
                      return (
                        <div key={group.group} className="p-4">
                          <h3 className="font-extrabold text-xs text-indigo-600 dark:text-indigo-400 flex items-center gap-1.5 mb-2.5">
                            <span>{group.icon}</span>
                            <span>{group.group} Permissions</span>
                          </h3>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {group.permissions.map(perm => {
                              const eff = getEffectiveUserPermission(perm.key);
                              const cellKey = `user_${activeUserObj.id}_${perm.key}`;
                              const isSaving = saving[cellKey];

                              // Style tags based on states
                              let badgeColor = '';
                              if (eff.state === 'override_granted') {
                                badgeColor = 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400 border-amber-200 dark:border-amber-900/30';
                              } else if (eff.state === 'override_denied') {
                                badgeColor = 'bg-rose-50 text-rose-600 dark:bg-rose-950/20 dark:text-rose-400 border-rose-100 dark:border-rose-900/20';
                              } else if (eff.state === 'inherited_granted') {
                                badgeColor = 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900/20';
                              } else {
                                badgeColor = 'bg-slate-100 text-slate-500 dark:bg-zinc-800 dark:text-zinc-400 border-slate-200 dark:border-zinc-700/50';
                              }

                              return (
                                <div
                                  key={perm.key}
                                  className="flex items-center justify-between p-3 rounded-xl border border-slate-100 dark:border-zinc-800/80 hover:border-slate-200 dark:hover:border-zinc-700 transition"
                                >
                                  <div className="min-w-0 pr-3">
                                    <span className="font-bold text-slate-750 dark:text-zinc-200 text-xs block truncate" title={perm.label}>
                                      {perm.label}
                                    </span>
                                    <span className="text-[10px] text-slate-400 dark:text-zinc-500 font-mono">
                                      {perm.key}
                                    </span>
                                  </div>

                                  <div className="flex items-center gap-2.5 flex-shrink-0">
                                    <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${badgeColor}`}>
                                      {eff.state.startsWith('override') ? 'Custom: ' : ''}
                                      {eff.val ? 'Allowed' : 'Denied'}
                                    </span>

                                    {isSaving ? (
                                      <LuLoaderCircle className="animate-spin text-indigo-500" size={15} />
                                    ) : (
                                      <button
                                        onClick={() => handleToggleUserOverride(activeUserObj.id, perm.key, eff.state)}
                                        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border border-transparent transition-colors duration-200 ease-in-out focus:outline-none items-center ${
                                          eff.val ? 'bg-indigo-600' : 'bg-slate-200 dark:bg-zinc-750'
                                        }`}
                                      >
                                        <span
                                          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition duration-200 ease-in-out ${
                                            eff.val ? 'translate-x-4' : 'translate-x-0'
                                          }`}
                                        />
                                      </button>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center justify-center py-20 text-slate-400 dark:text-zinc-550">
                  <LuUser size={40} className="stroke-[1.2] mb-3 text-slate-350" />
                  <p className="text-xs font-bold">No member selected</p>
                  <p className="text-[10px] mt-0.5">Choose a teammate from the list to manage overrides.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── TAB 3: AUDIT CHANGE LOG ── */}
        {activeTab === 'changelog' && (
          <div className="bg-white dark:bg-[#151518]/90 border border-slate-200/60 dark:border-zinc-800/80 rounded-2xl shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 dark:border-zinc-800/80 bg-slate-50/30 dark:bg-zinc-900/10 flex items-center justify-between">
              <div>
                <h2 className="font-extrabold text-sm text-slate-800 dark:text-zinc-200">Permissions Audit Trail</h2>
                <p className="text-[10px] text-slate-400 dark:text-zinc-500 mt-0.5">Chronological record of role and user access modifications</p>
              </div>
            </div>

            <div className="overflow-x-auto max-h-[500px]">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/40 dark:bg-zinc-900/25 border-b border-slate-100 dark:border-zinc-800/80 text-[10px] font-bold text-slate-400 dark:text-zinc-550 uppercase tracking-widest">
                    <th className="px-5 py-3">Timestamp</th>
                    <th className="px-5 py-3">Modified By</th>
                    <th className="px-5 py-3">Target Profile / User</th>
                    <th className="px-5 py-3">Action Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-zinc-850 text-xs">
                  {auditLogs.map(log => {
                    const localTime = new Date(log.createdAt).toLocaleString();
                    const actionParts = log.action.split('.');
                    
                    let target = '';
                    let details = '';

                    if (actionParts[0] === 'role') {
                      target = `${actionParts[1].toUpperCase()} Role`;
                      const meta = log.metadata || {};
                      details = `Changed permission: ${meta.permission} (${meta.newVal ? 'Granted' : 'Denied'})`;
                    } else if (actionParts[0] === 'permission') {
                      target = `Specific User`;
                      const meta = log.metadata || {};
                      details = `Overrode permission: ${meta.permission} (${meta.after === true ? 'Forced Allow' : meta.after === false ? 'Forced Deny' : 'Reverted to Default'})`;
                    }

                    return (
                      <tr key={log.id} className="hover:bg-slate-50/30 dark:hover:bg-zinc-900/10">
                        <td className="px-5 py-3.5 font-mono text-[10px] text-slate-400 dark:text-zinc-500">{localTime}</td>
                        <td className="px-5 py-3.5 font-bold text-slate-700 dark:text-zinc-300">{log.userName}</td>
                        <td className="px-5 py-3.5 font-mono text-[10px] text-indigo-600 dark:text-indigo-400 font-bold">{target}</td>
                        <td className="px-5 py-3.5 text-slate-600 dark:text-zinc-400">{details}</td>
                      </tr>
                    );
                  })}
                  {auditLogs.length === 0 && (
                    <tr>
                      <td colSpan={4} className="text-center py-10 text-xs text-slate-400 italic">
                        No recent permission modifications recorded in logs.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── COPY CONFIG MODAL ── */}
        {showCopyModal && (
          <div className="fixed inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-[#151518] border border-slate-200 dark:border-zinc-800/80 rounded-2xl shadow-xl w-full max-w-sm overflow-hidden animate-scale-in">
              <div className="p-4 border-b border-slate-100 dark:border-zinc-850 flex items-center justify-between bg-slate-50/50 dark:bg-zinc-900/10">
                <h3 className="font-extrabold text-sm text-slate-805 dark:text-zinc-200 flex items-center gap-1.5">
                  <LuCopy size={15} className="text-indigo-650" /> Copy Access Template
                </h3>
                <button
                  onClick={() => setShowCopyModal(false)}
                  className="p-1 hover:bg-slate-100 dark:hover:bg-zinc-800 rounded-lg text-slate-400 transition cursor-pointer"
                >
                  <LuX size={15} />
                </button>
              </div>

              <div className="p-5 flex flex-col gap-4 text-xs">
                <p className="text-slate-450 leading-relaxed text-[11px]">
                  Duplicate permission overrides from one job profile to another role template in this workspace. This will overwrite existing custom rules for the target profile.
                </p>

                <div className="flex flex-col gap-1.5">
                  <label className="font-bold text-slate-500 dark:text-zinc-450 uppercase text-[9px] tracking-wider">Source Role</label>
                  <select
                    className="w-full rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-[#121215] p-2 text-xs font-bold text-slate-700 dark:text-zinc-200 outline-none"
                    value={copySource}
                    onChange={e => setCopySource(e.target.value)}
                  >
                    {PROFILES.map(p => (
                      <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="font-bold text-slate-500 dark:text-zinc-450 uppercase text-[9px] tracking-wider">Target Role</label>
                  <select
                    className="w-full rounded-xl border border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-[#121215] p-2 text-xs font-bold text-slate-700 dark:text-zinc-200 outline-none"
                    value={copyTarget}
                    onChange={e => setCopyTarget(e.target.value)}
                  >
                    {PROFILES.map(p => (
                      <option key={p.value} value={p.value}>{p.label}</option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-2 mt-2">
                  <button
                    onClick={() => setShowCopyModal(false)}
                    className="flex-1 py-2 rounded-xl border border-slate-200 dark:border-zinc-800 hover:bg-slate-50 dark:hover:bg-zinc-800/60 font-bold transition text-slate-500 dark:text-zinc-400 cursor-pointer text-center"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCopyRoleSubmit}
                    disabled={loading}
                    className="flex-1 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold transition cursor-pointer text-center flex items-center justify-center gap-1.5"
                  >
                    {loading ? <LuLoaderCircle className="animate-spin" size={13} /> : 'Overwrite'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

      </div>
    </DashboardLayout>
  );
};

export default PermissionMatrix;
