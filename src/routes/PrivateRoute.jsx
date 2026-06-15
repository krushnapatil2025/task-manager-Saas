import React, { useContext } from "react";
import { Outlet, Navigate } from "react-router-dom";
import { UserContext } from "../context/userContext";

/**
 * PrivateRoute — guards routes by role.
 * - Shows nothing while auth is loading.
 * - Redirects to /login if not authenticated.
 * - ADMIN (role='admin' or job_profile='company_admin') bypasses ALL role
 *   restrictions and can access every protected page with no redirect.
 *
 * Props:
 *   allowedRoles: string[]  e.g. ["admin"] or ["member"]
 */
const PrivateRoute = ({ allowedRoles }) => {
  const { user, loading } = useContext(UserContext);

  // Still loading the session — render nothing (avoid flash)
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

  // Not logged in — go to login
  if (!user) return <Navigate to="/login" replace />;

  // ── Admin bypass: company_admin can access ALL pages ───────────────────────
  const isAdmin =
    user.role === 'admin' ||
    user.job_profile === 'company_admin' ||
    user.role === 'company_admin';

  if (isAdmin) return <Outlet />;

  // ── Non-admin: enforce allowed roles ──────────────────────────────────────
  if (allowedRoles) {
    const allowed = allowedRoles.some((r) => r === user.role);
    if (!allowed) {
      return <Navigate to="/user/dashboard" replace />;
    }
  }

  return <Outlet />;
};

export default PrivateRoute;