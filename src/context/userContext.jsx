// @refresh reset
import React, { createContext, useState, useEffect, useContext, useCallback } from "react";
import { supabase } from "../utils/supabaseClient";

export const UserContext = createContext();

/** Key used by useSessionManager to track last user activity */
export const SESSION_STORAGE_KEY = 'strideo_last_activity';

// Valid values enforced by the check constraints on profiles.job_profile
const VALID_JOB_PROFILES = new Set([
  'company_admin', 'manager', 'employee', 'intern',
]);

const UserProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get the initial session on mount
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        await loadProfile(session.user);
      } else {
        setLoading(false);
      }
    });

    // Subscribe to auth state changes (login, logout, token refresh)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        await loadProfile(session.user);
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    // Handle custom user status updates
    const handleProfileUpdate = () => {
      updateUser();
    };
    window.addEventListener('user-profile-updated', handleProfileUpdate);

    return () => {
      subscription.unsubscribe();
      window.removeEventListener('user-profile-updated', handleProfileUpdate);
    };
  }, []);

  /**
   * Load the user's profile row from the `profiles` table.
   * Accepts the auth user object directly (already available from session)
   * to avoid an extra /auth/v1/user network call that can 403 on stale tokens.
   */
  const loadProfile = async (authUser) => {
    const userId = authUser.id;
    try {
      // Fetch profile — maybeSingle() returns null instead of error on 0 rows
      let { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) throw error;

      // If profile row doesn't exist yet, upsert a seed row from auth metadata
      if (!profile) {
        const meta = authUser.user_metadata || {};
        // meta.role may be 'admin'/'member' (old format) which violates the
        // job_profile CHECK constraint — only use it if it's a valid job profile
        const rawJobProfile = meta.job_profile || meta.role;
        const jobProfile = VALID_JOB_PROFILES.has(rawJobProfile) ? rawJobProfile : 'employee';

        const { data: seeded, error: seedErr } = await supabase
          .from('profiles')
          .upsert({
            id:              userId,
            name:            meta.name || authUser.email?.split('@')[0] || 'User',
            job_profile:     jobProfile,
            status:          'active',
            setup_completed: false,
          }, { onConflict: 'id' })
          .select('*')
          .maybeSingle();

        if (seedErr) {
          console.error('Failed to seed profile, clearing orphaned session:', seedErr);
          await clearUser();
          return;
        }
        profile = seeded;
      }

      if (profile) {
        setUser({ ...profile, email: authUser.email });
      } else {
        // Profile still missing — set minimal object so app doesn't crash
        setUser({
          id:          userId,
          email:       authUser.email,
          name:        authUser.user_metadata?.name || authUser.email?.split('@')[0] || 'User',
          job_profile: authUser.user_metadata?.job_profile || 'employee',
          role:        authUser.user_metadata?.role || 'member',
        });
      }
    } catch (err) {
      console.error('Failed to load profile:', err);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  /** Called after a successful sign-in to refresh the profile. */
  const updateUser = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) await loadProfile(session.user);
  };

  /** Sign out and clear state. Also clears the idle session timestamp. */
  const clearUser = useCallback(async () => {
    try { localStorage.removeItem(SESSION_STORAGE_KEY); } catch {}
    await supabase.auth.signOut();
    setUser(null);
  }, []);

  /** Manually extend the session by stamping Date.now() — called by useSessionManager. */
  const extendSession = useCallback(() => {
    try { localStorage.setItem(SESSION_STORAGE_KEY, String(Date.now())); } catch {}
  }, []);

  // Keep the old `clearuser` name as an alias so existing components don't break
  const clearuser = clearUser;

  return (
    <UserContext.Provider value={{ user, loading, updateUser, clearUser, clearuser, extendSession }}>
      {children}
    </UserContext.Provider>
  );
};

/** Convenience hook — replaces `useContext(UserContext)` everywhere */
export const useUser = () => useContext(UserContext);

export default UserProvider;