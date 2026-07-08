import React, { useContext, useEffect, Suspense, lazy, useCallback } from 'react';
import {
  BrowserRouter as Router, Routes, Route,
  Navigate, Outlet, useNavigate,
} from 'react-router-dom';

// ── Auth pages (lazy) ────────────────────────────────────────────────────────
const Login = lazy(() => import('./pages/Auth/login'));
const AdminRegister = lazy(() => import('./pages/Auth/AdminRegister'));
const AcceptInvite = lazy(() => import('./pages/Auth/AcceptInvite'));
const SetupAccount = lazy(() => import('./pages/Auth/SetupAccount'));
const SetupExpired = lazy(() => import('./pages/Auth/SetupExpired'));
const RegistrationPending = lazy(() => import('./pages/Auth/RegistrationPending'));
const ForgotPassword = lazy(() => import('./pages/Auth/ForgotPassword'));

// ── Public (lazy) ────────────────────────────────────────────────────────────
const LandingPage = lazy(() => import('./pages/LandingPage'));
const PublicBoard = lazy(() => import('./pages/PublicBoard'));

// ── Admin pages (lazy) ───────────────────────────────────────────────────────
const Dashboard = lazy(() => import('./pages/Admin/Dashboard'));
const KanbanBoard = lazy(() => import('./pages/Admin/KanbanBoard'));
const ManageTasks = lazy(() => import('./pages/Admin/ManageTasks'));
const CreateTask = lazy(() => import('./pages/Admin/CreateTask'));
const ManageUsers = lazy(() => import('./pages/Admin/ManageUsers'));
const ManageTeams = lazy(() => import('./pages/Admin/ManageTeams'));
const ManageInvitations = lazy(() => import('./pages/Admin/ManageInvitations'));
const PermissionMatrix = lazy(() => import('./pages/Admin/PermissionMatrix'));
const AuditLog = lazy(() => import('./pages/Admin/AuditLog'));
const ApiKeys = lazy(() => import('./pages/Admin/ApiKeys'));
const Webhooks = lazy(() => import('./pages/Admin/Webhooks'));
const Integrations = lazy(() => import('./pages/Admin/Integrations'));
const InviteEmployee = lazy(() => import('./pages/Admin/InviteEmployee'));
const Analytics = lazy(() => import('./pages/Admin/Analytics'));
const Reports = lazy(() => import('./pages/Admin/Reports'));
const AdminTimesheets = lazy(() => import('./pages/Admin/AdminTimesheets'));
const SprintBoard = lazy(() => import('./pages/Admin/SprintBoard'));
const AutomationRules = lazy(() => import('./pages/Admin/AutomationRules'));
const LeaveManagement = lazy(() => import('./pages/Admin/LeaveManagement'));
const InternLogDashboard = lazy(() => import('./pages/Admin/InternLogDashboard'));

// ── Member pages (lazy) ──────────────────────────────────────────────────────
const UserDashboard = lazy(() => import('./pages/User/UserDashboard'));
const MyTasks = lazy(() => import('./pages/User/MyTasks'));
const ViewTaskDetails = lazy(() => import('./pages/User/ViewTaskDetails'));
const MyTimesheet = lazy(() => import('./pages/User/MyTimesheet'));
const UserProfile = lazy(() => import('./pages/User/UserProfile'));
const MyLeaves = lazy(() => import('./pages/User/MyLeaves'));
const InternDailyLog = lazy(() => import('./pages/User/InternDailyLog'));
const Goals = lazy(() => import('./pages/Admin/Goals'));
const GoalDetail = lazy(() => import('./pages/Admin/GoalDetail'));
const FilesHub = lazy(() => import('./pages/Admin/FilesHub'));

// ── Chat pages (lazy) ───────────────────────────────────────────────────
const TeamChat = lazy(() => import('./pages/Chat/TeamChat'));
const DirectMessages = lazy(() => import('./pages/Chat/DirectMessages'));

// ── Calendar pages (lazy) ────────────────────────────────────────────────
const CalendarPage = lazy(() => import('./pages/Calendar/CalendarPage'));
const Settings = lazy(() => import('./pages/Settings'));

// ── Onboarding (lazy) ────────────────────────────────────────────────────────
const CreateWorkspace = lazy(() => import('./pages/Onboarding/CreateWorkspace'));

// ── Super Admin pages (lazy) ─────────────────────────────────────────────────
import SuperAdminLayout from './components/layouts/SuperAdminLayout';
const SuperDashboard = lazy(() => import('./pages/SuperAdmin/SuperDashboard'));
const AllWorkspaces = lazy(() => import('./pages/SuperAdmin/AllWorkspaces'));
const AllUsers = lazy(() => import('./pages/SuperAdmin/AllUsers'));
const PlatformActivity = lazy(() => import('./pages/SuperAdmin/PlatformActivity'));
const CompanyRegistrations = lazy(() => import('./pages/SuperAdmin/CompanyRegistrations'));
const EmailLogs = lazy(() => import('./pages/SuperAdmin/EmailLogs'));
const SystemSettings = lazy(() => import('./pages/SuperAdmin/SystemSettings'));
const SecurityAudit = lazy(() => import('./pages/SuperAdmin/SecurityAudit'));

// ── Guards (eager — tiny files, needed immediately) ──────────────────────────
import PrivateRoute from './routes/PrivateRoute';
import SuperAdminRoute from './routes/SuperAdminRoute';

// ── Session management ────────────────────────────────────────────────────────
import { useSessionManager } from './hooks/useSessionManager';
import SessionWarningModal from './components/SessionWarningModal';

// ── Providers ─────────────────────────────────────────────────────────────────
import UserProvider, { UserContext } from './context/userContext';
import WorkspaceProvider, { WorkspaceContext } from './context/WorkspaceContext';
import { ThemeProvider } from './context/ThemeContext';
import { BrandProvider } from './context/BrandContext';
import { Toaster } from 'react-hot-toast';
import { supabase } from './utils/supabaseClient';
import ConnectionStatusBanner from './components/ConnectionStatusBanner';

// ── Page loader fallback ──────────────────────────────────────────────────────
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50">
    <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
  </div>
);


// ─────────────────────────────────────────────────────────────────────────────
// SessionGuard — activates idle-timeout tracking for authenticated users.
// Super Admins are exempt. Renders the warning modal when countdown begins.
// Must be rendered INSIDE <Router> so it can call useNavigate().
// ─────────────────────────────────────────────────────────────────────────────
const SessionGuard = ({ children }) => {
  const { user, clearUser } = useContext(UserContext);
  const navigate = useNavigate();

  const isSuperAdmin = !!user && user.email === import.meta.env.VITE_SUPER_ADMIN_EMAIL;
  const isActive     = !!user;

  const handleExpire = useCallback(async () => {
    await clearUser();
    navigate('/login', { replace: true, state: { sessionExpired: true } });
  }, [clearUser, navigate]);

  const { showWarning, secondsLeft, extendSession } = useSessionManager({
    onExpire:     handleExpire,
    isActive,
    isSuperAdmin,
  });

  return (
    <>
      {children}
      {showWarning && (
        <SessionWarningModal
          secondsLeft={secondsLeft}
          onStayLoggedIn={extendSession}
          onLogoutNow={handleExpire}
        />
      )}
    </>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// OAuthCallback — /auth/callback (Google OAuth + Magic Link redirect target)
// ─────────────────────────────────────────────────────────────────────────────
const OAuthCallback = () => {
  const navigate = useNavigate();
  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (!session) { navigate('/login'); return; }
      const { data: profile } = await supabase
        .from('profiles').select('role, job_profile').eq('id', session.user.id).single();
      const isAdmin = profile?.role === 'admin' || profile?.job_profile === 'company_admin';
      navigate(isAdmin ? '/admin/dashboard' : '/user/dashboard', { replace: true });
    });
  }, []);
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-gray-500 font-medium">Signing you in...</p>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// OnboardingGuard — redirect new admin users to workspace creation.
// Employees/members who arrived via invite already have a workspace assigned;
// they should never land on the Create Workspace page.
// ─────────────────────────────────────────────────────────────────────────────
const OnboardingGuard = () => {
  const { needsOnboarding, wsLoading } = useContext(WorkspaceContext);
  const { user } = useContext(UserContext);

  // ── CRITICAL: skip onboarding redirect for blocked admins ─────────────────
  // A blocked admin's workspace may fail to load via RLS (pending/rejected/restricted).
  // If we let needsOnboarding redirect them to /onboarding/workspace,
  // PrivateRoute will redirect them back to /admin/dashboard → infinite loop.
  const isAdmin =
    user?.role === 'admin' ||
    user?.job_profile === 'company_admin' ||
    user?.role === 'company_admin';

  const isBlocked =
    isAdmin &&
    user?.account_approval_status &&
    user?.account_approval_status !== 'approved';

  if (isBlocked) return <Outlet />;
  // ──────────────────────────────────────────────────────────────────────────

  if (wsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-500 font-medium">Loading workspace...</p>
        </div>
      </div>
    );
  }

  if (needsOnboarding) {
    // Only company admins should create a new workspace.
    // Invited employees/managers/interns always belong to an existing workspace —
    // if their workspace isn't loaded yet, they should wait, not create a new one.
    if (isAdmin) return <Navigate to="/onboarding/workspace" replace />;

    // Non-admin with no workspace: show a holding screen rather than
    // accidentally letting them create a workspace of their own.
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3 text-center px-4">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-600 font-medium">Loading your workspace…</p>
          <p className="text-xs text-gray-400 max-w-xs">
            Your workspace is being set up. If this takes too long, please contact your admin.
          </p>
        </div>
      </div>
    );
  }

  return <Outlet />;
};

// ─────────────────────────────────────────────────────────────────────────────
// App
// ─────────────────────────────────────────────────────────────────────────────
const App = () => (
  <ThemeProvider>
    <BrandProvider>
      <UserProvider>
        <WorkspaceProvider>
          <Router>
            <SessionGuard>
              <Suspense fallback={<PageLoader />}>
                <Routes>
                  {/* ── Public ──────────────────────────────────────────────────── */}
                  <Route path="/" element={<LandingPage />} />
                  <Route path="/login" element={<Login />} />
                  <Route path="/admin/register" element={<AdminRegister />} />
                  <Route path="/setup-account" element={<SetupAccount />} />
                  <Route path="/setup-expired" element={<SetupExpired />} />
                  <Route path="/forgot-password" element={<ForgotPassword />} />
                  <Route path="/auth/callback" element={<OAuthCallback />} />
                  <Route path="/invite/:token" element={<AcceptInvite />} />
                  <Route path="/public-board/:token" element={<PublicBoard />} />
                  <Route path="/registration-pending" element={<RegistrationPending />} />

                  {/* Blocked admins → redirect to dashboard where banner shows status */}
                  <Route path="/company-pending" element={<Navigate to="/admin/dashboard" replace />} />

                  {/* ── Onboarding — admin + manager only (page guard rejects others) ── */}
                  <Route element={<PrivateRoute allowedRoles={['admin', 'member']} />}>
                    <Route path="/onboarding/workspace" element={<CreateWorkspace />} />
                  </Route>

                  {/* ── Admin ───────────────────────────────────────────────────── */}
                  <Route element={<PrivateRoute allowedRoles={['admin']} />}>
                    <Route element={<OnboardingGuard />}>
                      <Route path="/admin/dashboard" element={<Dashboard />} />
                      <Route path="/admin/kanban" element={<KanbanBoard />} />
                      <Route path="/admin/tasks" element={<ManageTasks />} />
                      <Route path="/admin/users" element={<ManageUsers />} />
                      <Route path="/admin/invitations" element={<ManageInvitations />} />
                      <Route path="/admin/teams" element={<ManageTeams />} />
                      <Route path="/admin/permissions" element={<PermissionMatrix />} />
                      <Route path="/admin/audit" element={<AuditLog />} />
                      <Route path="/admin/api-keys" element={<ApiKeys />} />
                      <Route path="/admin/webhooks" element={<Webhooks />} />
                      <Route path="/admin/integrations" element={<Integrations />} />
                      <Route path="/admin/create-task" element={<CreateTask />} />
                      <Route path="/admin/analytics" element={<Analytics />} />
                      <Route path="/admin/reports" element={<Reports />} />
                      <Route path="/admin/timesheets" element={<AdminTimesheets />} />
                      <Route path="/admin/sprints" element={<SprintBoard />} />
                      <Route path="/admin/automations" element={<AutomationRules />} />
                      <Route path="/admin/calendar" element={<CalendarPage adminView />} />
                      <Route path="/admin/leaves" element={<LeaveManagement />} />
                      <Route path="/admin/intern-logs" element={<InternLogDashboard />} />
                    </Route>
                  </Route>

                  {/* ── Chat routes (shared — any logged-in user) ───────────────── */}
                  <Route element={<PrivateRoute />}>
                    <Route path="/chat" element={<TeamChat />} />
                    <Route path="/chat/dm" element={<DirectMessages />} />
                    <Route path="/chat/dm/:userId" element={<DirectMessages />} />
                    <Route path="/calendar" element={<CalendarPage />} />
                    <Route path="/calendar/event/:id" element={<CalendarPage />} />
                    <Route path="/settings" element={<Settings />} />
                  </Route>

                  {/* ── Member (also accessible by admin) ───────────────────── */}
                  <Route element={<PrivateRoute allowedRoles={['member', 'admin']} />}>
                    <Route element={<OnboardingGuard />}>
                      <Route path="/user/dashboard" element={<UserDashboard />} />
                      <Route path="/user/tasks" element={<MyTasks />} />
                      <Route path="/user/task-details/:id" element={<ViewTaskDetails />} />
                      <Route path="/user/timesheet" element={<MyTimesheet />} />
                      <Route path="/user/profile" element={<UserProfile />} />
                      <Route path="/user/leaves" element={<MyLeaves />} />
                      <Route path="/user/daily-log" element={<InternDailyLog />} />
                      <Route path="/admin/goals" element={<Goals />} />
                      <Route path="/admin/goals/:id" element={<GoalDetail />} />
                      <Route path="/admin/files" element={<FilesHub />} />
                    </Route>
                  </Route>

                  {/* ── Super Admin ─────────────────────────────────────────────── */}
                  <Route element={<SuperAdminRoute />}>
                    <Route element={<SuperAdminLayout />}>
                      <Route path="/super-admin/dashboard" element={<SuperDashboard />} />
                      <Route path="/super-admin/workspaces" element={<AllWorkspaces />} />
                      <Route path="/super-admin/users" element={<AllUsers />} />
                      <Route path="/super-admin/activity" element={<PlatformActivity />} />
                      <Route path="/super-admin/registrations" element={<CompanyRegistrations />} />
                      <Route path="/super-admin/email-logs" element={<EmailLogs />} />
                      <Route path="/super-admin/settings" element={<SystemSettings />} />
                      <Route path="/super-admin/security" element={<SecurityAudit />} />
                    </Route>
                  </Route>

                  {/* ── Fallback ────────────────────────────────────────────────── */}
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </Suspense>
            </SessionGuard>
          </Router>

          <Toaster
            position="top-right"
            toastOptions={{
              style: { fontSize: '13px' },
              success: { duration: 3000 },
              error: { duration: 5000 },
            }}
          />

          <ConnectionStatusBanner />
        </WorkspaceProvider>
      </UserProvider>
    </BrandProvider>
  </ThemeProvider>
);

export default App;
