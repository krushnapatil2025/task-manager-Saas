// @refresh reset
// ─────────────────────────────────────────────────────────────────────────────
// superAdminSession.js
// Manages the local-only Super Admin session (no Supabase auth required).
// Credentials are validated purely against .env variables.
// Session is stored in sessionStorage — clears on tab close.
// ─────────────────────────────────────────────────────────────────────────────

const SA_SESSION_KEY = '__sa_session__';

const SA_EMAIL    = import.meta.env.VITE_SUPER_ADMIN_EMAIL?.toLowerCase().trim();
const SA_PASSWORD = import.meta.env.VITE_SUPER_ADMIN_PASSWORD;

/**
 * Attempt a super admin login.
 * Returns true if credentials match .env, false otherwise.
 */
export const superAdminLogin = (email, password) => {
  if (!SA_EMAIL || !SA_PASSWORD) return false;
  if (email.toLowerCase().trim() !== SA_EMAIL) return false;
  if (password !== SA_PASSWORD) return false;

  // Store session token in sessionStorage
  sessionStorage.setItem(
    SA_SESSION_KEY,
    JSON.stringify({ email: SA_EMAIL, name: 'Super Admin', loggedInAt: Date.now() })
  );
  return true;
};

/**
 * Check if a valid super admin session exists.
 */
export const isSuperAdminLoggedIn = () => {
  try {
    const raw = sessionStorage.getItem(SA_SESSION_KEY);
    if (!raw) return false;
    const session = JSON.parse(raw);
    // Session valid for 8 hours
    const EIGHT_HOURS = 8 * 60 * 60 * 1000;
    return session?.email === SA_EMAIL && Date.now() - session.loggedInAt < EIGHT_HOURS;
  } catch {
    return false;
  }
};

/**
 * Get the current super admin session data.
 */
export const getSuperAdminSession = () => {
  try {
    const raw = sessionStorage.getItem(SA_SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

/**
 * Clear the super admin session (logout).
 */
export const superAdminLogout = () => {
  sessionStorage.removeItem(SA_SESSION_KEY);
};
