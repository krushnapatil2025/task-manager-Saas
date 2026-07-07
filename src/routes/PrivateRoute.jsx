import React, { useContext } from "react";
import { Outlet, Navigate, useLocation } from "react-router-dom";
import { UserContext } from "../context/userContext";

/**
 * PrivateRoute — guards routes by role.
 *
 * Approval gate is based on the COMPANY ADMIN'S PROFILE (user.account_approval_status),
 * NOT on any workspace. Once the admin is approved they can create unlimited workspaces freely.
 *
 * Behaviour when the admin's account is NOT approved (pending/rejected/restricted):
 *  - The user CAN stay on their dashboard page (they see the ApprovalStatusBanner).
 *  - Any attempt to navigate to any OTHER page is redirected back to the dashboard.
 *  - Non-admin users (employees, managers) are NEVER gated — they were invited by an
 *    already-approved admin and can always access the app normally.
 */

const FALLBACK_ADMIN = '/admin/dashboard';
const FALLBACK_MEMBER = '/user/dashboard';

const PrivateRoute = ({ allowedRoles, bypassApprovalCheck = false }) => {
  const { user, loading } = useContext(UserContext);
  const location = useLocation();

  // Still loading session — show spinner
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-gray-500 font-medium">Loading...</p>
        </div>
      </div>
    );
  }

  // Not logged in
  if (!user) return <Navigate to="/login" replace />;

  // ── Determine if the user is a company admin ──────────────────────────────
  const isAdmin =
    user.role === 'admin' ||
    user.job_profile === 'company_admin' ||
    user.role === 'company_admin';

  // ── Approval gate (company admins only) ───────────────────────────────────
  // Only NEW company admin registrations start as 'pending'.
  // Employees/managers/non-admins are never gated — they are pre-verified.
  const approvalStatus = user.account_approval_status;
  const isAccountBlocked =
    isAdmin &&
    approvalStatus &&
    approvalStatus !== 'approved' &&
    !bypassApprovalCheck;

  if (isAccountBlocked) {
    // Redirect any blocked-admin route back to their dashboard.
    // Full app shell (sidebar + navbar) stays visible.
    // ApprovalStatusBanner in DashboardLayout communicates the status in detail.
    // Sidebar is greyed/locked by DashboardLayout's isBlocked logic.
    const dashboardFallback = isAdmin ? FALLBACK_ADMIN : FALLBACK_MEMBER;
    if (location.pathname !== dashboardFallback) {
      return <Navigate to={dashboardFallback} replace />;
    }
    return <Outlet />;
  }

  // ── Admin bypass: approved company_admin can access all pages ─────────────
  if (isAdmin) return <Outlet />;

  // ── Non-admin: enforce allowed roles ─────────────────────────────────────
  if (allowedRoles) {
    const allowed = allowedRoles.some((r) => r === user.role);
    if (!allowed) {
      return <Navigate to="/user/dashboard" replace />;
    }
  }

  return <Outlet />;
};

export default PrivateRoute;