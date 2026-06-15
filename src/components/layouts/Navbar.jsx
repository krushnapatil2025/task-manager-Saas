import React, { useState } from 'react';
import { HiOutlineMenu, HiOutlineX } from 'react-icons/hi';
import SideMenu from './SideMenu';
import WorkspaceSwitcher from '../WorkspaceSwitcher';
import NotificationBell from '../NotificationBell';

// ─────────────────────────────────────────────────────────────────────────────
// Navbar — top bar: brand | workspace switcher | notification bell | hamburger
// ─────────────────────────────────────────────────────────────────────────────

const Navbar = ({ activeMenu }) => {
  const [openSideMenu, setOpenSideMenu] = useState(false);

  return (
    <div className="flex items-center justify-between gap-4 bg-white/85 backdrop-blur-lg border-b border-slate-200/50 py-3 px-6 sticky top-0 z-30 shadow-[0_2px_12px_rgba(0,0,0,0.02)]">
      {/* ── Left: hamburger + brand ── */}
      <div className="flex items-center gap-4">
        <button
          className="block lg:hidden text-slate-500 hover:text-slate-800 transition"
          onClick={() => setOpenSideMenu((o) => !o)}
          aria-label="Toggle menu"
        >
          {openSideMenu
            ? <HiOutlineX    className="text-2xl" />
            : <HiOutlineMenu className="text-2xl" />}
        </button>

        <h2 className="text-base font-extrabold text-slate-900 tracking-tight select-none flex items-center gap-2">
          <span className="w-2.5 h-5 bg-gradient-to-b from-indigo-500 to-violet-600 rounded-sm inline-block shadow-sm shadow-indigo-500/30"></span>
          Task<span className="text-indigo-600">Flow</span>
        </h2>
      </div>

      {/* ── Centre: workspace switcher ── */}
      <WorkspaceSwitcher />

      {/* ── Right: notification bell ── */}
      <div className="flex items-center gap-2">
        <NotificationBell />
      </div>

      {/* ── Mobile slide-down side menu ── */}
      {openSideMenu && (
        <div className="fixed top-[57px] left-0 bg-white shadow-xl z-40 lg:hidden">
          <SideMenu activeMenu={activeMenu} />
        </div>
      )}
    </div>
  );
};

export default Navbar;