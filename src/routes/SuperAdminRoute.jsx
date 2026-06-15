import React, { useEffect, useState } from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { isSuperAdminLoggedIn } from '../utils/superAdminSession';

// ─────────────────────────────────────────────────────────────────────────────
// SuperAdminRoute — grants access based on LOCAL sessionStorage session only.
// No Supabase auth or DB query required. Session is set by the login page
// when credentials match VITE_SUPER_ADMIN_EMAIL / VITE_SUPER_ADMIN_PASSWORD.
// ─────────────────────────────────────────────────────────────────────────────

const SuperAdminRoute = () => {
  const [checked, setChecked] = useState(false);
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    setAllowed(isSuperAdminLoggedIn());
    setChecked(true);
  }, []);

  if (!checked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-4 border-red-500 border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-slate-400 font-medium">Verifying access...</p>
        </div>
      </div>
    );
  }

  if (!allowed) return <Navigate to="/login" replace />;

  return <Outlet />;
};

export default SuperAdminRoute;

