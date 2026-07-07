import React, { useContext, useEffect } from 'react'
import { UserContext } from '../../context/userContext';
import Navbar from './Navbar';
import SideMenu from './SideMenu';
import ApprovalStatusBanner from './ApprovalStatusBanner';
import { useBrand, applyCSSVariables } from '../../context/BrandContext';

// ─────────────────────────────────────────────────────────────────────────────
// DashboardLayout
//
// Sidebar is locked when a COMPANY ADMIN's account_approval_status is not 'approved'.
// This is profile-level gating — workspaces themselves are never blocked.
// ─────────────────────────────────────────────────────────────────────────────

const DashboardLayout = ({ children, activeMenu }) => {
  const { user } = useContext(UserContext);
  const { brand } = useBrand();

  // Only company admins who haven't been approved yet get the sidebar locked
  const isAdmin =
    user?.role === 'admin' ||
    user?.job_profile === 'company_admin' ||
    user?.role === 'company_admin';

  const isBlocked =
    isAdmin &&
    user?.account_approval_status &&
    user?.account_approval_status !== 'approved';

  useEffect(() => {
    if (brand) {
      applyCSSVariables(brand);
    }
  }, [brand]);

  return (
    <div className="min-h-screen bg-gray-25 flex flex-col font-sans">

      {/* ── Navbar — full width, always interactive ── */}
      <Navbar activeMenu={activeMenu} />

      {user && (
        <div className="flex flex-1 items-stretch">

          {/* ── SideMenu — greyed + locked when not approved ── */}
          <div
            className="max-[1080px]:hidden shrink-0"
            style={isBlocked ? {
              filter: 'grayscale(1) opacity(0.45)',
              pointerEvents: 'none',
              userSelect: 'none',
              cursor: 'not-allowed',
              position: 'relative',
            } : undefined}
            aria-disabled={isBlocked || undefined}
          >
            {/* Invisible overlay to force not-allowed cursor on every SideMenu pixel */}
            {isBlocked && (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  zIndex: 50,
                  cursor: 'not-allowed',
                  pointerEvents: 'all',
                }}
                aria-hidden="true"
              />
            )}
            <SideMenu activeMenu={activeMenu} />
          </div>

          {/* ── Content column — banner + page + footer ── */}
          <div className="grow min-w-0 flex flex-col">

            {/* Banner renders here — below navbar, aligned with page, sidebar unaffected */}
            <ApprovalStatusBanner />

            {/* Page content */}
            <div className="mx-6 my-6 md:mx-8 flex flex-col flex-1 justify-between">
              <div className="flex-grow">
                {children}
              </div>
              {activeMenu !== 'Team Chat' && (
                <footer className="mt-8 pt-4 border-t border-slate-100 dark:border-zinc-800/80 text-center flex flex-col sm:flex-row items-center justify-between gap-2 text-[10px] text-slate-400 dark:text-zinc-500 font-bold uppercase tracking-wider flex-shrink-0">
                  <p>© 2026 strideo . All rights reserved.</p>
                  <p>Built by <a href="https://www.cicdtech.in/" target="_blank" rel="noopener noreferrer" className="text-indigo-650 hover:underline">CICD Tech</a></p>
                </footer>
              )}
            </div>

          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardLayout