import {
  LuLayoutDashboard, LuUsers, LuClipboardCheck,
  LuSquarePlus, LuLogOut, LuKanban, LuListTodo,
  LuUserPlus, LuShield, LuKey, LuWebhook, LuPuzzle,
  LuUsersRound, LuShieldCheck, LuSparkles,
  LuChartLine, LuFileText, LuTimer, LuGitBranch,
  LuMessageSquare, LuZap, LuCalendar, LuPhone, LuSettings, LuTarget, LuFolder
} from 'react-icons/lu';

// ─── Admin sidebar ────────────────────────────────────────────────────────────
export const SIDE_MENU_DATA = [
  {
    id: '01',
    label: 'Dashboard',
    icon: LuLayoutDashboard,
    path: '/admin/dashboard',
  },
  {
    id: '02',
    label: 'Kanban Board',
    icon: LuKanban,
    path: '/admin/kanban',
  },
  {
    id: '03',
    label: 'Manage Tasks',
    icon: LuClipboardCheck,
    path: '/admin/tasks',
  },
  {
    id: '04',
    label: 'Create Task',
    icon: LuSquarePlus,
    path: '/admin/create-task',
  },
  {
    id: '05',
    label: 'Team Members',
    icon: LuUsers,
    path: '/admin/users',
  },
  {
    id: '05b',
    label: 'Teams',
    icon: LuUsersRound,
    path: '/admin/teams',
  },
  {
    id: '05c',
    label: 'Permissions',
    icon: LuShieldCheck,
    path: '/admin/permissions',
  },
  {
    id: '06',
    label: 'Invitations',
    icon: LuUserPlus,
    path: '/admin/invitations',
  },
  {
    id: '07',
    label: 'Audit Log',
    icon: LuShield,
    path: '/admin/audit',
  },
  {
    id: '08',
    label: 'Integrations',
    icon: LuPuzzle,
    path: '/admin/integrations',
  },
  {
    id: '09',
    label: 'API Keys',
    icon: LuKey,
    path: '/admin/api-keys',
  },
  {
    id: '10',
    label: 'Webhooks',
    icon: LuWebhook,
    path: '/admin/webhooks',
  },
  {
    id: '10b',
    label: 'Analytics',
    icon: LuChartLine,
    path: '/admin/analytics',
  },
  {
    id: '10c',
    label: 'Reports',
    icon: LuFileText,
    path: '/admin/reports',
  },
  {
    id: '10d',
    label: 'Timesheets',
    icon: LuTimer,
    path: '/admin/timesheets',
  },
  {
    id: '10e',
    label: 'Sprint Board',
    icon: LuGitBranch,
    path: '/admin/sprints',
  },
  {
    id: '10f',
    label: 'Automations',
    icon: LuZap,
    path: '/admin/automations',
  },
  {
    id: '10g',
    label: 'Goals',
    icon: LuTarget,
    path: '/admin/goals',
  },
  {
    id: '10h',
    label: 'Files',
    icon: LuFolder,
    path: '/admin/files',
  },
  {
    id: '10i',
    label: 'Leave Management',
    icon: LuCalendar,
    path: '/admin/leaves',
  },
  {
    id: '10j',
    label: 'Intern Logs',
    icon: LuFileText,
    path: '/admin/intern-logs',
  },
  {
    id: '11',
    label: 'AI Assistant',
    icon: LuSparkles,
    path: 'ai',
  },
  {
    id: '12',
    label: 'Team Chat',
    icon: LuMessageSquare,
    path: '/chat',
  },
  {
    id: '12b',
    label: 'Calendar',
    icon: LuCalendar,
    path: '/calendar',
  },
  {
    id: '12d',
    label: 'Settings',
    icon: LuSettings,
    path: '/settings',
  },
  {
    id: '99',
    label: 'Logout',
    icon: LuLogOut,
    path: 'logout',
  },
];

// ─── Member sidebar ───────────────────────────────────────────────────────────
export const SIDE_MENU_USER_DATA = [
  {
    id: '01',
    label: 'Dashboard',
    icon: LuLayoutDashboard,
    path: '/user/dashboard',
  },
  {
    id: '02',
    label: 'My Tasks',
    icon: LuListTodo,
    path: '/user/tasks',
  },
  {
    id: '02c',
    label: 'My Timesheet',
    icon: LuTimer,
    path: '/user/timesheet',
  },
  {
    id: '02h',
    label: 'Goals',
    icon: LuTarget,
    path: '/admin/goals',
  },
  {
    id: '02j',
    label: 'Files',
    icon: LuFolder,
    path: '/admin/files',
  },
  {
    id: '02i',
    label: 'My Leaves',
    icon: LuCalendar,
    path: '/user/leaves',
  },
  {
    id: '02k',
    label: 'My Daily Log',
    icon: LuFileText,
    path: '/user/daily-log',
  },
  {
    id: '02b',
    label: 'AI Assistant',
    icon: LuSparkles,
    path: 'ai',
  },
  {
    id: '02d',
    label: 'Team Chat',
    icon: LuMessageSquare,
    path: '/chat',
  },
  {
    id: '02e',
    label: 'Calendar',
    icon: LuCalendar,
    path: '/calendar',
  },
  {
    id: '02g',
    label: 'Settings',
    icon: LuSettings,
    path: '/settings',
  },
  {
    id: '03',
    label: 'Logout',
    icon: LuLogOut,
    path: 'logout',
  },
];

// ─── Form data ────────────────────────────────────────────────────────────────
export const PRIORITY_DATA = [
  { label: 'Low',    value: 'low'    },
  { label: 'Medium', value: 'medium' },
  { label: 'High',   value: 'high'   },
];

export const STATUS_DATA = [
  { label: 'Pending',     value: 'Pending'     },
  { label: 'In Progress', value: 'In Progress' },
  { label: 'Completed',   value: 'Completed'   },
];