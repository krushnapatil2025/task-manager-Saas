import React, { useContext, useState, useRef, useEffect } from "react";
import {
  LuBuilding2,
  LuChevronDown,
  LuCheck,
  LuPlus,
  LuLoaderCircle,
} from "react-icons/lu";
import { WorkspaceContext } from "../context/WorkspaceContext";
import { UserContext } from "../context/userContext";
import { useNavigate } from "react-router-dom";

// ─────────────────────────────────────────────────────────────────────────────
// WorkspaceSwitcher — dropdown in the Navbar that lets users switch between
// workspaces or navigate to create a new one.
// ─────────────────────────────────────────────────────────────────────────────

const WorkspaceSwitcher = () => {
  const { workspace, workspaces, wsLoading, switchWorkspace } =
    useContext(WorkspaceContext);
  const { user } = useContext(UserContext);
  const navigate = useNavigate();

  const canCreateWorkspace =
    user?.role === 'admin' ||
    user?.job_profile === 'company_admin' ||
    user?.job_profile === 'manager';

  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const dropdownRef = useRef(null);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleSwitch = async (id) => {
    if (id === workspace?.id) { setOpen(false); return; }
    setSwitching(true);
    await switchWorkspace(id);
    setSwitching(false);
    setOpen(false);
    // Reload current page to re-fetch scoped data
    window.location.reload();
  };

  if (wsLoading) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-100 text-gray-400 text-sm">
        <LuLoaderCircle className="animate-spin" />
        Loading...
      </div>
    );
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger */}
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-slate-50 hover:bg-indigo-50/50 border border-slate-200/60 transition-all duration-200 group"
      >
        {workspace?.logo_url ? (
          <img
            src={workspace.logo_url}
            className="w-5 h-5 rounded object-cover shadow-sm"
            alt={workspace.name}
          />
        ) : (
          <LuBuilding2 className="text-indigo-600 text-base" />
        )}
        <span className="text-xs font-bold text-slate-700 max-w-[120px] truncate">
          {workspace?.name || "No Workspace"}
        </span>
        <LuChevronDown
          className={`text-slate-400 group-hover:text-indigo-500 text-sm transition-transform duration-200 ${
            open ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute top-full left-0 mt-2 w-64 bg-white/95 backdrop-blur-md rounded-2xl shadow-xl border border-slate-200/40 py-2 z-50 animate-fade-in">
          {/* Header */}
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-4 py-2">
            Your Workspaces
          </p>

          {/* List */}
          <div className="max-h-56 overflow-y-auto">
            {workspaces.map((ws) => (
              <button
                key={ws.id}
                onClick={() => handleSwitch(ws.id)}
                disabled={switching}
                className={`w-full flex items-center gap-3 px-4 py-2.5 hover:bg-slate-50 transition-colors text-left ${
                  ws.id === workspace?.id ? "bg-indigo-50/30" : ""
                }`}
              >
                {ws.logo_url ? (
                  <img
                    src={ws.logo_url}
                    className="w-7 h-7 rounded-lg object-cover flex-shrink-0 shadow-sm"
                    alt={ws.name}
                  />
                ) : (
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center flex-shrink-0">
                    <span className="text-white text-xs font-bold">
                      {ws.name?.[0]?.toUpperCase()}
                    </span>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-slate-800 truncate">
                    {ws.name}
                  </p>
                  <p className="text-[10px] text-slate-400 font-semibold capitalize mt-0.5">
                    {ws.myRole} · {ws.plan}
                  </p>
                </div>
                {ws.id === workspace?.id && (
                  <LuCheck className="text-indigo-600 text-sm flex-shrink-0" />
                )}
              </button>
            ))}
          </div>

          {/* Create new — only company admins can create workspaces */}
          {canCreateWorkspace && (
            <>
              <div className="border-t border-slate-100 my-1.5" />
              <button
                onClick={() => { setOpen(false); navigate("/onboarding/workspace"); }}
                className="w-full flex items-center gap-3 px-4 py-2 hover:bg-slate-50 transition text-left text-xs text-indigo-600 font-bold"
              >
                <div className="w-7 h-7 rounded-lg border-2 border-dashed border-indigo-300 flex items-center justify-center flex-shrink-0">
                  <LuPlus className="text-indigo-400 text-sm" />
                </div>
                Create new workspace
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default WorkspaceSwitcher;
