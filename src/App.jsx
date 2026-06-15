import React, { useContext, useEffect, Suspense, lazy } from 'react';
import {
  BrowserRouter as Router, Routes, Route,
  Navigate, Outlet, useNavigate,
} from 'react-router-dom';

// ── Auth pages (lazy) ────────────────────────────────────────────────────────
const Login           = lazy(() => import('./pages/Auth/login'));
const AdminRegister   = lazy(() => import('./pages/Auth/AdminRegister'));
const AcceptInvite    = lazy(() => import('./pages/Auth/AcceptInvite'));
const SetupAccount    = lazy(() => import('./pages/Auth/SetupAccount'));
const SetupExpired    = lazy(() => import('./pages/Auth/SetupExpired'));

// ── Public (lazy) ────────────────────────────────────────────────────────────
const LandingPage    = lazy(() => import('./pages/LandingPage'));

// ── Admin pages (lazy) ───────────────────────────────────────────────────────
const Dashboard        = lazy(() => import('./pages/Admin/Dashboard'));
const KanbanBoard      = lazy(() => import('./pages/Admin/KanbanBoard'));
const ManageTasks      = lazy(() => import('./pages/Admin/ManageTasks'));
const CreateTask       = lazy(() => import('./pages/Admin/CreateTask'));
const ManageUsers      = lazy(() => import('./pages/Admin/ManageUsers'));
const ManageTeams      = lazy(() => import('./pages/Admin/ManageTeams'));
const ManageInvitations = lazy(() => import('./pages/Admin/ManageInvitations'));
const PermissionMatrix  = lazy(() => import('./pages/Admin/PermissionMatrix'));
const AuditLog         = lazy(() => import('./pages/Admin/AuditLog'));
const ApiKeys          = lazy(() => import('./pages/Admin/ApiKeys'));
const Webhooks         = lazy(() => import('./pages/Admin/Webhooks'));
const Integrations     = lazy(() => import('./pages/Admin/Integrations'));
const InviteEmployee   = lazy(() => import('./pages/Admin/InviteEmployee'));

// ── Member pages (lazy) ──────────────────────────────────────────────────────
const UserDashboard   = lazy(() => import('./pages/User/UserDashboard'));
const MyTasks         = lazy(() => import('./pages/User/MyTasks'));
const ViewTaskDetails = lazy(() => import('./pages/User/ViewTaskDetails'));

// ── Onboarding (lazy) ────────────────────────────────────────────────────────
const CreateWorkspace = lazy(() => import('./pages/Onboarding/CreateWorkspace'));

// ── Super Admin pages (lazy) ─────────────────────────────────────────────────
import SuperAdminLayout  from './components/layouts/SuperAdminLayout';
const SuperDashboard    = lazy(() => import('./pages/SuperAdmin/SuperDashboard'));
const AllWorkspaces     = lazy(() => import('./pages/SuperAdmin/AllWorkspaces'));
const AllUsers          = lazy(() => import('./pages/SuperAdmin/AllUsers'));
const PlatformActivity  = lazy(() => import('./pages/SuperAdmin/PlatformActivity'));

// ── Guards (eager — tiny files, needed immediately) ──────────────────────────
import PrivateRoute      from './routes/PrivateRoute';
import SuperAdminRoute   from './routes/SuperAdminRoute';

// ── Providers ─────────────────────────────────────────────────────────────────
import UserProvider,      { UserContext }      from './context/userContext';
import WorkspaceProvider, { WorkspaceContext } from './context/WorkspaceContext';
import { Toaster }   from 'react-hot-toast';
import { supabase }  from './utils/supabaseClient';

// ── Page loader fallback ──────────────────────────────────────────────────────
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50">
    <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
  </div>
);


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
    const isAdmin =
      user?.role === 'admin' ||
      user?.job_profile === 'company_admin';

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
  <UserProvider>
    <WorkspaceProvider>
      <Router>
        <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* ── Public ──────────────────────────────────────────────────── */}

          <Route path="/"               element={<LandingPage    />} />
          <Route path="/login"          element={<Login           />} />
          <Route path="/admin/register" element={<AdminRegister   />} />
          <Route path="/setup-account"  element={<SetupAccount    />} />
          <Route path="/setup-expired"  element={<SetupExpired    />} />
          <Route path="/auth/callback"  element={<OAuthCallback   />} />
          <Route path="/invite/:token"  element={<AcceptInvite    />} />

          {/* ── Onboarding — admin + manager only (page guard rejects others) ── */}
          <Route element={<PrivateRoute allowedRoles={['admin', 'member']} />}>
            <Route path="/onboarding/workspace" element={<CreateWorkspace />} />
          </Route>

          {/* ── Admin ───────────────────────────────────────────────────── */}
          <Route element={<PrivateRoute allowedRoles={['admin']} />}>
            <Route element={<OnboardingGuard />}>
              <Route path="/admin/dashboard"   element={<Dashboard         />} />
              <Route path="/admin/kanban"      element={<KanbanBoard       />} />
              <Route path="/admin/tasks"       element={<ManageTasks       />} />
              <Route path="/admin/users"       element={<ManageUsers       />} />
              <Route path="/admin/invitations" element={<ManageInvitations />} />
              <Route path="/admin/teams"        element={<ManageTeams       />} />
              <Route path="/admin/permissions"   element={<PermissionMatrix  />} />
              <Route path="/admin/audit"         element={<AuditLog          />} />
              <Route path="/admin/api-keys"    element={<ApiKeys           />} />
              <Route path="/admin/webhooks"    element={<Webhooks          />} />
              <Route path="/admin/integrations" element={<Integrations     />} />
              <Route path="/admin/create-task" element={<CreateTask        />} />
            </Route>
          </Route>

          {/* ── Member (also accessible by admin) ───────────────────── */}
          <Route element={<PrivateRoute allowedRoles={['member', 'admin']} />}>
            <Route element={<OnboardingGuard />}>
              <Route path="/user/dashboard"        element={<UserDashboard   />} />
              <Route path="/user/tasks"            element={<MyTasks         />} />
              <Route path="/user/task-details/:id" element={<ViewTaskDetails />} />
            </Route>
          </Route>

          {/* ── Super Admin ─────────────────────────────────────────────── */}
          <Route element={<SuperAdminRoute />}>
            <Route element={<SuperAdminLayout />}>
              <Route path="/super-admin/dashboard"  element={<SuperDashboard   />} />
              <Route path="/super-admin/workspaces" element={<AllWorkspaces    />} />
              <Route path="/super-admin/users"      element={<AllUsers         />} />
              <Route path="/super-admin/activity"   element={<PlatformActivity />} />
            </Route>
          </Route>

          {/* ── Fallback ────────────────────────────────────────────────── */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        </Suspense>
      </Router>

      <Toaster
        position="top-right"
        toastOptions={{
          style:   { fontSize: '13px' },
          success: { duration: 3000  },
          error:   { duration: 5000  },
        }}
      />
    </WorkspaceProvider>
  </UserProvider>
);

export default App;
