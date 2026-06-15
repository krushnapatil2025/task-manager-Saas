// @refresh reset
import React, { createContext, useState, useEffect, useContext, useCallback } from "react";
import { supabase } from "../utils/supabaseClient";
import { UserContext } from "./userContext";

// ─────────────────────────────────────────────────────────────────────────────
// WorkspaceContext — manages the user's current workspace + membership data
// ─────────────────────────────────────────────────────────────────────────────

export const WorkspaceContext = createContext();

const WorkspaceProvider = ({ children }) => {
  const { user } = useContext(UserContext);

  const [workspace, setWorkspace]       = useState(null);  // current workspace object
  const [workspaces, setWorkspaces]     = useState([]);     // all workspaces the user belongs to
  const [members, setMembers]           = useState([]);     // members of the current workspace
  const [wsRole, setWsRole]             = useState(null);   // 'admin' | 'member' | 'viewer'
  const [wsLoading, setWsLoading]       = useState(true);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);

  // ── Load all workspaces for the current user ────────────────────────────────
  const loadWorkspaces = useCallback(async () => {
    if (!user?.id) {
      setWsLoading(false);
      return;
    }

    try {
      setWsLoading(true);

      // Fetch all workspace_members rows for this user, joining the workspace details
      const { data: memberships, error } = await supabase
        .from("workspace_members")
        .select(`
          role,
          workspace:workspaces(id, name, slug, logo_url, plan, owner_id, created_at)
        `)
        .eq("user_id", user.id);

      if (error) throw error;

      const wsList = (memberships || []).map((m) => ({
        ...m.workspace,
        myRole: m.role,
      }));

      setWorkspaces(wsList);

      if (wsList.length === 0) {
        // User has no workspaces → show onboarding
        setNeedsOnboarding(true);
        setWsLoading(false);
        return;
      }

      setNeedsOnboarding(false);

      // Activate the workspace stored in profile, or fall back to the first one
      const preferredId = user.current_workspace_id;
      const active =
        wsList.find((w) => w.id === preferredId) || wsList[0];

      await activateWorkspace(active);
    } catch (err) {
      console.error("WorkspaceContext — loadWorkspaces error:", err);
      setWsLoading(false);
    }
  }, [user?.id, user?.current_workspace_id]);

  // ── Activate a specific workspace (load its members & set role) ──────────────
  const activateWorkspace = useCallback(async (ws) => {
    if (!ws || !user?.id) return;
    try {
      setWorkspace(ws);
      setWsRole(ws.myRole || null);

      // Fetch members of the active workspace with profile details
      const { data: mems, error: memErr } = await supabase
        .from("workspace_members")
        .select(`
          role,
          joined_at,
          profile:profiles(id, name, profile_image_url, role)
        `)
        .eq("workspace_id", ws.id);

      if (memErr) throw memErr;

      setMembers(
        (mems || []).map((m) => ({
          id: m.profile?.id,
          name: m.profile?.name,
          profileImageUrl: m.profile?.profile_image_url,
          systemRole: m.profile?.role,
          wsRole: m.role,
          joinedAt: m.joined_at,
        }))
      );

      // Persist the selection in the user's profile
      if (user.current_workspace_id !== ws.id) {
        await supabase
          .from("profiles")
          .update({ current_workspace_id: ws.id })
          .eq("id", user.id);
      }
    } catch (err) {
      console.error("WorkspaceContext — activateWorkspace error:", err);
    } finally {
      setWsLoading(false);
    }
  }, [user?.id, user?.current_workspace_id]);

  // ── Switch to a different workspace ─────────────────────────────────────────
  const switchWorkspace = async (workspaceId) => {
    const target = workspaces.find((w) => w.id === workspaceId);
    if (target) await activateWorkspace(target);
  };

  // ── Create a new workspace (calls the DB RPC function) ──────────────────────
  const createWorkspace = async (name, logoUrl = null) => {
    const slug = name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");

    const { data, error } = await supabase.rpc("create_workspace_with_admin", {
      p_name: name,
      p_slug: `${slug}-${Date.now()}`,   // ensure uniqueness
      p_logo_url: logoUrl,
    });

    if (error) throw error;

    // Reload all workspaces and activate the new one
    await loadWorkspaces();
    return data;
  };

  // ── Reload after membership changes ─────────────────────────────────────────
  const refreshWorkspace = () => loadWorkspaces();

  useEffect(() => {
    loadWorkspaces();
  }, [loadWorkspaces]);

  return (
    <WorkspaceContext.Provider
      value={{
        workspace,          // active workspace object
        workspaces,         // all workspaces the user has
        members,            // members of the active workspace
        wsRole,             // current user's role in the active workspace
        wsLoading,          // loading state
        needsOnboarding,    // true when user has no workspace yet
        switchWorkspace,
        createWorkspace,
        refreshWorkspace,
        activateWorkspace,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
};

/** Convenience hook */
export const useWorkspace = () => useContext(WorkspaceContext);

export default WorkspaceProvider;
